# Schema

`setupNewStore` is the only function that issues DDL. It runs two idempotent statements: `CREATE TABLE IF NOT EXISTS` for the sessions table and `CREATE INDEX IF NOT EXISTS` for the `expires_at` secondary index. Safe to call on every application boot.

The canonical data model lives in the Auth parent. This page documents only what is specific to the SQLite implementation: column types, identifier quoting, type encoding for booleans and free-form data, UPSERT semantics, and the index strategy.

## On This Page

- [What `setupNewStore` Creates](#what-setupnewstore-creates)
- [Column-to-Record Mapping](#column-to-record-mapping)
- [SQLite Type Affinity](#sqlite-type-affinity)
- [Identifier Quoting](#identifier-quoting)
- [Boolean Encoding](#boolean-encoding)
- [JSON Encoding of `custom_data`](#json-encoding-of-custom_data)
- [UPSERT Semantics](#upsert-semantics)
- [Index Strategy](#index-strategy)
- [Native TTL](#native-ttl)

## What `setupNewStore` Creates

For a `table_name` of `sessions_user`, the adapter emits the following two statements in order. Both use `IF NOT EXISTS`, so repeated invocations are no-ops.

```sql
CREATE TABLE IF NOT EXISTS "sessions_user" (
  "tenant_id"           TEXT NOT NULL,
  "actor_id"            TEXT NOT NULL,
  "actor_type"          TEXT NOT NULL,
  "token_key"           TEXT NOT NULL,
  "token_secret_hash"   TEXT NOT NULL,
  "refresh_token_hash"  TEXT,
  "refresh_family_id"   TEXT,
  "created_at"          INTEGER NOT NULL,
  "expires_at"          INTEGER NOT NULL,
  "last_active_at"      INTEGER NOT NULL,
  "install_id"          TEXT,
  "install_platform"    TEXT NOT NULL,
  "install_form_factor" TEXT NOT NULL,
  "client_name"         TEXT,
  "client_version"      TEXT,
  "client_is_browser"   INTEGER NOT NULL DEFAULT 0,
  "client_os_name"      TEXT,
  "client_os_version"   TEXT,
  "client_screen_w"     INTEGER,
  "client_screen_h"     INTEGER,
  "client_ip_address"   TEXT,
  "client_user_agent"   TEXT,
  "push_provider"       TEXT,
  "push_token"          TEXT,
  "custom_data"         TEXT,
  PRIMARY KEY ("tenant_id", "actor_id", "token_key")
);

CREATE INDEX IF NOT EXISTS "idx_sessions_user_expires_at"
  ON "sessions_user" ("expires_at");
```

The index name is derived deterministically as `idx_<table_name>_expires_at` so multiple Auth instances on the same database produce non-colliding index names.

## Column-to-Record Mapping

Twenty-five columns. The order in the table matches the canonical record-shape ordering defined by the Auth parent (`parts/record-shape.js` `getFieldNames()`), which the adapter relies on for positional `INSERT` parameter alignment.

Each column maps one-to-one to a field in the canonical record. The mapping diverges from a direct pass-through only at two points, documented in the sections below: boolean encoding (INTEGER 0/1) and JSON encoding of `custom_data`. Integer columns return as native JS Numbers; no coercion is needed.

## SQLite Type Affinity

SQLite is dynamically typed. The column-type keywords (`TEXT`, `INTEGER`) in the `CREATE TABLE` statement express **affinity**, not constraints. A column declared as `TEXT` accepts any value, and the driver coerces according to affinity rules. This adapter relies on the following affinity behaviors:

| Affinity | Why this adapter uses it | Notable consequence |
|---|---|---|
| `TEXT` | Every string column (identifiers, hashes, names, IP addresses) | No length enforcement. A `VARCHAR(64)` style limit cannot be expressed; the column accepts any length |
| `INTEGER` | Timestamps (`created_at`, `expires_at`, `last_active_at`), pixel counts (`client_screen_w`, `client_screen_h`), and the boolean stand-in (`client_is_browser`) | Stored as a 64-bit signed integer. Returned as a native JavaScript Number on read |

No `VARCHAR(n)` length constraints are present because SQLite does not enforce them. The column declarations document intent ("this field is a string") but do not validate. The Auth parent's input validation is the layer where field-length and field-shape rules live; the adapter trusts the parent to pass conforming values.

## Identifier Quoting

Every identifier in the generated SQL is double-quoted using SQLite's native style: `"col"`. The adapter's private `Q(name)` helper handles all quoting; column names and the table name pass through it before they reach the driver.

`Q` throws an `Error` if the identifier contains a double-quote. This guards against identifier injection through a malformed `table_name`. The check fires lazily on the first SQL build (not at `validateConfig` time), so a misconfigured `table_name` surfaces on first call rather than at adapter construction.

A correctly named table never triggers the check. Use lowercase, underscored names: `sessions_user`, `sessions_admin`. Do not put backticks, double-quotes, or whitespace in the name.

## Boolean Encoding

SQLite has no native boolean type. The adapter stores `client_is_browser` as `INTEGER 0/1`:

- **On write.** `Boolean(value)` is coerced to `1` (true) or `0` (false). `undefined` is mapped to `null` before this stage, so a missing boolean writes as `null`; the `NOT NULL DEFAULT 0` column constraint then resolves it to `0`.
- **On read.** The integer returned by the driver is decoded back to a JavaScript boolean: `1` becomes `true`, anything else becomes `false`. `null` reads also surface as `false` so the record shape always has a stable boolean (matching the memory store and every other adapter's behavior).

This is one of two encodings the adapter applies (the other is JSON for `custom_data`). Every other column passes through unchanged.

## JSON Encoding of `custom_data`

`custom_data` is a free-form object that applications use for tenant-specific session metadata. SQLite has a `JSON1` extension for in-database JSON queries, but the adapter stores `custom_data` as a JSON-encoded string in a `TEXT` column. The trade-off matches every other SQL-backed sibling:

| Option | Pros | Cons |
|---|---|---|
| `JSON1` extension queries | Server-side queries on JSON fields | Requires the JSON1 extension to be available (it is in `node:sqlite`, but not in every other SQL adapter). Cross-backend portability breaks |
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
  "actor_type"          = excluded."actor_type",
  "token_secret_hash"   = excluded."token_secret_hash",
  ...
```

`excluded` (lowercase) is the SQLite pseudo-table that holds the conflicting row's proposed values during an `ON CONFLICT` resolution. The `DO UPDATE` clause sets every mutable column to its `excluded.col` value.

This syntax is supported since SQLite 3.24 (2018) and is available everywhere `node:sqlite` ships.

**Six columns are excluded from `DO UPDATE`.** The primary-key triple (`tenant_id`, `actor_id`, `token_key`) by definition cannot change (it is the conflict target); the per-install fields (`created_at`, `install_id`, `install_platform`, `install_form_factor`) are also locked to their original values. A second `setSession` on the same composite primary key updates everything else but cannot rewrite the session's creation metadata or the install record.

This is enforced through the adapter's `UPSERT_IMMUTABLE_COLUMNS` list, evaluated at UPSERT-SQL build time. The build runs once per adapter instance and the result is cached for every subsequent `setSession`.

## Index Strategy

The schema has **two indexes**. Both are B-trees, the default SQLite index type.

| Index | Kind | Columns | Created by |
|---|---|---|---|
| `sqlite_autoindex_<table_name>_1` | Primary key | `(tenant_id, actor_id, token_key)` | The `PRIMARY KEY (...)` clause inside `CREATE TABLE`. SQLite names the underlying index automatically |
| `idx_<table_name>_expires_at` | Secondary | `(expires_at)` | A separate `CREATE INDEX IF NOT EXISTS` statement, issued after `CREATE TABLE` |

### Primary Key Index

`(tenant_id, actor_id, token_key)`. The column order is intentional. SQLite's B-tree uses left-to-right prefix matching, so this order serves every adapter access pattern with no additional index.

| Adapter method | Predicate | How the index serves it |
|---|---|---|
| `getSession` | `tenant_id = ? AND actor_id = ? AND token_key = ?` | Full-triple equality. Single-row lookup |
| `listSessionsByActor` | `tenant_id = ? AND actor_id = ?` | Two-column prefix. Bounded range scan |
| `setSession` | `ON CONFLICT (tenant_id, actor_id, token_key)` | Conflict detection in the UPSERT |
| `updateSessionActivity` | `tenant_id = ? AND actor_id = ? AND token_key = ?` | Full-triple equality inside the `UPDATE ... WHERE` |
| `deleteSession` | Same as `updateSessionActivity` | Full-triple equality inside the `DELETE ... WHERE` |
| `deleteSessions` | `(tenant_id = ? AND actor_id = ? AND token_key = ?) OR (...) OR (...)` | Series of full-triple equalities. All served by the same index in one query plan |

`tenant_id` is the leading column because tenancy is the primary isolation boundary. No current adapter method restricts on `tenant_id` alone, but putting it first keeps every per-tenant scan within one contiguous sub-tree of the index.

### `expires_at` Secondary Index

`idx_<table_name>_expires_at`. The name is derived deterministically from the configured `table_name`, so multiple Auth instances on the same database (different `actor_type` values, different tables) produce non-colliding index names.

| Adapter method | Predicate | How the index serves it |
|---|---|---|
| `cleanupExpiredSessions` | `expires_at < <now>` | Range scan. Sweep cost is proportional to the number of expired rows, not to the total row count |

Without this index, `cleanupExpiredSessions` would degenerate to a full table scan. With it, the sweep stays bounded by the size of the expired set. The index pays for itself on the very first non-trivial cleanup.

### No Other Indexes

The adapter does not create indexes on `actor_type`, `install_id`, `install_platform`, `install_form_factor`, `last_active_at`, `refresh_token_hash`, `refresh_family_id`, `push_token`, `client_ip_address`, or any other column. The Auth parent module never queries on these columns; every read restricts on `(tenant_id, actor_id, token_key)` or a prefix, every write restricts on the same triple, and the only secondary access pattern is the `expires_at` sweep already covered by the secondary index. Adding indexes for unused queries would cost write throughput and storage on every `setSession` and `updateSessionActivity` call with no payoff on any read path.

## Native TTL

SQLite has no built-in row-level TTL. Expired rows do not disappear automatically. `cleanupExpiredSessions` is the only deletion path; for file-backed deployments the application is responsible for scheduling it. For `:memory:` deployments cleanup is moot because the database disappears on process exit. See [cleanup.md](cleanup.md) for the recommended mechanism.
