# Schema

`setupNewStore` is the only function that issues DDL. It runs two idempotent statements: `CREATE TABLE IF NOT EXISTS` for the sessions table and `CREATE INDEX IF NOT EXISTS` for the `expires_at` secondary index. Safe to call on every application boot.

The canonical data model lives in the Auth parent. This page documents only what is specific to the PostgreSQL implementation: column types, identifier quoting, type-coercion at the driver boundary, JSON serialization, and UPSERT semantics.

## On This Page

- [What `setupNewStore` Creates](#what-setupnewstore-creates)
- [Column-to-Record Mapping](#column-to-record-mapping)
- [Identifier Quoting](#identifier-quoting)
- [BIGINT Coercion at the Driver Boundary](#bigint-coercion-at-the-driver-boundary)
- [Native BOOLEAN](#native-boolean)
- [JSON Encoding of `custom_data`](#json-encoding-of-custom_data)
- [UPSERT Semantics](#upsert-semantics)
- [Index Strategy](#index-strategy)
- [Native TTL](#native-ttl)

## What `setupNewStore` Creates

For a `table_name` of `sessions_user`, the adapter emits the following two statements in order. Both use `IF NOT EXISTS`, so repeated invocations are no-ops.

```sql
CREATE TABLE IF NOT EXISTS "sessions_user" (
  "tenant_id"           VARCHAR(64)  NOT NULL,
  "actor_id"            VARCHAR(128) NOT NULL,
  "actor_type"          VARCHAR(64)  NOT NULL,
  "token_key"           VARCHAR(64)  NOT NULL,
  "token_secret_hash"   VARCHAR(128) NOT NULL,
  "refresh_token_hash"  VARCHAR(128),
  "refresh_family_id"   VARCHAR(64),
  "created_at"          BIGINT NOT NULL,
  "expires_at"          BIGINT NOT NULL,
  "last_active_at"      BIGINT NOT NULL,
  "install_id"          VARCHAR(64),
  "install_platform"    VARCHAR(32)  NOT NULL,
  "install_form_factor" VARCHAR(32)  NOT NULL,
  "client_name"         VARCHAR(128),
  "client_version"      VARCHAR(64),
  "client_is_browser"   BOOLEAN NOT NULL DEFAULT FALSE,
  "client_os_name"      VARCHAR(64),
  "client_os_version"   VARCHAR(64),
  "client_screen_w"     INTEGER,
  "client_screen_h"     INTEGER,
  "client_ip_address"   VARCHAR(64),
  "client_user_agent"   TEXT,
  "push_provider"       VARCHAR(32),
  "push_token"          VARCHAR(1024),
  "custom_data"         TEXT,
  PRIMARY KEY ("tenant_id", "actor_id", "token_key")
);

CREATE INDEX IF NOT EXISTS "idx_sessions_user_expires_at"
  ON "sessions_user" ("expires_at");
```

The index name is derived deterministically as `idx_<table_name>_expires_at` so multiple Auth instances on the same database produce non-colliding index names.

## Column-to-Record Mapping

Twenty-five columns. The order in the table matches the canonical record-shape ordering defined by the Auth parent (`parts/record-shape.js` `getFieldNames()`), which the adapter relies on for positional `INSERT` parameter alignment.

Each column maps one-to-one to a field in the canonical record. The mapping diverges from a direct pass-through only at four points, documented in the sections below: BIGINT-as-string coercion, native BOOLEAN handling, JSON encoding of `custom_data`, and the column-vs-field name match (which is direct for every column).

## Identifier Quoting

Every identifier in the generated SQL is double-quoted using PostgreSQL's native style: `"col"`. The adapter's private `Q(name)` helper handles all quoting; column names and the table name pass through it before they reach the driver.

`Q` throws an `Error` if the identifier contains a double-quote. This guards against identifier injection through a malformed `table_name`. The check fires lazily on the first SQL build (not at `validateConfig` time), so a misconfigured `table_name` surfaces on first call rather than at adapter construction.

A correctly named table never triggers the check. Use lowercase, underscored names: `sessions_user`, `sessions_admin`. Do not put backticks, double-quotes, or whitespace in the name.

## BIGINT Coercion at the Driver Boundary

PostgreSQL's `BIGINT` type can hold values larger than JavaScript's safe integer range, so the `pg` driver returns BIGINT columns as **strings** by default. This is correct behavior from the driver, but the adapter's in-memory record shape must match across every backend (the memory store, the SQLite store, the MongoDB store), so every BIGINT column is coerced back to `Number` on read.

The coerced columns are:

| Column | Why BIGINT |
|---|---|
| `created_at` | UNIX seconds. BIGINT future-proofs beyond 2038 |
| `expires_at` | UNIX seconds. BIGINT future-proofs beyond 2038 |
| `last_active_at` | UNIX seconds. BIGINT future-proofs beyond 2038 |
| `client_screen_w` | Stored as INTEGER, included for symmetry on read |
| `client_screen_h` | Stored as INTEGER, included for symmetry on read |

The coercion uses `parseInt(value, 10)` only when the value arrives as a string. Numbers pass through. The adapter does not attempt to handle the case where a timestamp legitimately exceeds `Number.MAX_SAFE_INTEGER` (year 2255 and beyond); the assumption is that any application running on UNIX-seconds time stays well within safe integer range.

## Native BOOLEAN

`client_is_browser` is stored as PostgreSQL's native `BOOLEAN`. No INTEGER 0/1 encoding. The `pg` driver returns it as a native JavaScript `Boolean`. On read, the adapter normalizes `undefined` and `null` to `false` so the record shape always has a stable boolean (matching the memory store's behavior). On write, any truthy value is coerced via `Boolean(value)`.

This is one of two backends in the Auth family that uses native booleans. The other SQL backends (SQLite, MySQL) encode booleans as INTEGER and require explicit coercion on every read.

## JSON Encoding of `custom_data`

The `custom_data` field is a free-form object that applications use for tenant-specific session metadata. PostgreSQL supports `JSONB` natively, but the adapter stores `custom_data` as a JSON-encoded string in a `TEXT` column. The trade-off is intentional:

| Option | Pros | Cons |
|---|---|---|
| `JSONB` column | Server-side queries, partial updates, indexable | Each adapter would need its own JSON-query API. Cross-backend portability breaks |
| `TEXT` with JSON string (chosen) | Identical to every other backend's encoding. The record shape is the truth, not the column type | No server-side JSON queries. `custom_data` is opaque to the database |

The Auth module's design rule is "the record shape is the truth". Cross-backend portability beats per-backend optimization; if an application needs server-side JSON queries on session metadata, it stores that metadata in a different table outside the session row.

Corrupt stored values (manual `UPDATE` with non-JSON text) surface as `null` on read, not as a parse exception. The adapter's integrity contract is to never throw from a normal read path.

## UPSERT Semantics

`setSession` uses `INSERT ... ON CONFLICT (pk) DO UPDATE`:

```sql
INSERT INTO "sessions_user" (col_1, col_2, ..., col_25)
VALUES (?, ?, ..., ?)
ON CONFLICT ("tenant_id", "actor_id", "token_key")
DO UPDATE SET
  "actor_type"          = EXCLUDED."actor_type",
  "token_secret_hash"   = EXCLUDED."token_secret_hash",
  ...
```

`EXCLUDED` (uppercase) is the PostgreSQL pseudo-table that holds the conflicting row's proposed values during an `ON CONFLICT` resolution. The `DO UPDATE` clause sets every mutable column to its `EXCLUDED.col` value.

**Six columns are excluded from `DO UPDATE`.** The primary-key triple (`tenant_id`, `actor_id`, `token_key`) by definition cannot change (it is the conflict target); the per-install fields (`created_at`, `install_id`, `install_platform`, `install_form_factor`) are also locked to their original values. A second `setSession` on the same composite primary key updates everything else but cannot rewrite the session's creation metadata or the install record.

This is enforced through the adapter's `UPSERT_IMMUTABLE_COLUMNS` list, evaluated at UPSERT-SQL build time. The build runs once per adapter instance and the result is cached for every subsequent `setSession`.

## Index Strategy

The schema has **two indexes**. Both are B-trees. PostgreSQL chooses B-tree by default for the syntax used here, and B-tree is the right choice for every adapter access pattern (equality lookups and ordered range scans).

| Index | Kind | Columns | Created by |
|---|---|---|---|
| `<table_name>_pkey` | Primary key | `(tenant_id, actor_id, token_key)` | The `PRIMARY KEY (...)` clause inside `CREATE TABLE`. PostgreSQL names the underlying index `<table_name>_pkey` automatically |
| `idx_<table_name>_expires_at` | Secondary | `(expires_at)` | A separate `CREATE INDEX IF NOT EXISTS` statement, issued after `CREATE TABLE` |

### Primary Key Index

`(tenant_id, actor_id, token_key)`. The column order is intentional. PostgreSQL's B-tree uses left-to-right prefix matching, so this order serves every adapter access pattern with no additional index.

| Adapter method | Predicate | How the index serves it |
|---|---|---|
| `getSession` | `tenant_id = ? AND actor_id = ? AND token_key = ?` | Full-triple equality. Single-row lookup |
| `listSessionsByActor` | `tenant_id = ? AND actor_id = ?` | Two-column prefix. Bounded range scan |
| `setSession` | `ON CONFLICT (tenant_id, actor_id, token_key)` | Conflict detection inside the UPSERT |
| `updateSessionActivity` | `tenant_id = ? AND actor_id = ? AND token_key = ?` | Full-triple equality inside the `UPDATE ... WHERE` |
| `deleteSession` | Same as `updateSessionActivity` | Full-triple equality inside the `DELETE ... WHERE` |
| `deleteSessions` | `(tenant_id = ? AND actor_id = ? AND token_key = ?) OR (...) OR (...)` | Series of full-triple equalities. All served by the same index in one query plan |

`tenant_id` is the leading column because tenancy is the primary isolation boundary. No current adapter method restricts on `tenant_id` alone, but putting it first keeps every per-tenant scan within one contiguous sub-tree of the index. `actor_id` second matches the call shape that `listSessionsByActor` uses for active-device listings. `token_key` last because it is the unique within-actor identifier and so completes the triple only when the caller has a specific session in hand.

### `expires_at` Secondary Index

`idx_<table_name>_expires_at`. The name is derived deterministically from the configured `table_name`, so multiple Auth instances on the same database (different `actor_type` values, different tables) produce non-colliding index names.

| Adapter method | Predicate | How the index serves it |
|---|---|---|
| `cleanupExpiredSessions` | `expires_at < <now>` | Range scan. Sweep cost is proportional to the number of expired rows, not to the total row count |

Without this index, `cleanupExpiredSessions` would degenerate to a sequential scan of the whole table. With it, the sweep stays bounded by the size of the expired set. The index pays for itself on the very first non-trivial cleanup.

**No partial index.** PostgreSQL supports `CREATE INDEX ... WHERE expires_at IS NOT NULL`, but `expires_at` is `NOT NULL` in this schema (every session must have an expiry), so a partial predicate would index the same rows the full index already covers.

### No Other Indexes

The adapter intentionally does **not** create indexes on `actor_type`, `install_id`, `install_platform`, `install_form_factor`, `last_active_at`, `refresh_token_hash`, `refresh_family_id`, `push_token`, `client_ip_address`, or any other column. The Auth parent module never queries on these columns; every read restricts on `(tenant_id, actor_id, token_key)` or a prefix, every write restricts on the same triple, and the only secondary access pattern is the `expires_at` sweep already covered by the secondary index. Adding indexes for unused queries would cost write throughput and storage on every `setSession` and `updateSessionActivity` call with no payoff on any read path.

## Native TTL

PostgreSQL has no built-in row-level TTL. Expired rows do not disappear automatically. `cleanupExpiredSessions` is the only deletion path; the application is responsible for scheduling it. See [cleanup.md](cleanup.md) for the recommended mechanism.
