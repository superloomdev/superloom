# Schema

`setupNewStore` is the only function that issues DDL. It runs one idempotent statement: `CREATE TABLE IF NOT EXISTS` with the `expires_at` index inlined. Safe to call on every application boot.

The canonical data model lives in the Auth parent. This page documents only what is specific to the MySQL implementation: column types, identifier quoting, type encoding for booleans and free-form data, UPSERT semantics, and the index strategy.

## On This Page

- [What `setupNewStore` Creates](#what-setupnewstore-creates)
- [Column-to-Record Mapping](#column-to-record-mapping)
- [Identifier Quoting](#identifier-quoting)
- [Boolean Encoding](#boolean-encoding)
- [BIGINT Handling](#bigint-handling)
- [JSON Encoding of `custom_data`](#json-encoding-of-custom_data)
- [UPSERT Semantics](#upsert-semantics)
- [Index Strategy](#index-strategy)
- [Native TTL](#native-ttl)

## What `setupNewStore` Creates

For a `table_name` of `sessions_user`, the adapter emits a single statement:

```sql
CREATE TABLE IF NOT EXISTS `sessions_user` (
  `tenant_id`           VARCHAR(64)  NOT NULL,
  `actor_id`            VARCHAR(128) NOT NULL,
  `actor_type`          VARCHAR(64)  NOT NULL,
  `token_key`           VARCHAR(64)  NOT NULL,
  `token_secret_hash`   VARCHAR(128) NOT NULL,
  `refresh_token_hash`  VARCHAR(128),
  `refresh_family_id`   VARCHAR(64),
  `created_at`          BIGINT NOT NULL,
  `expires_at`          BIGINT NOT NULL,
  `last_active_at`      BIGINT NOT NULL,
  `install_id`          VARCHAR(64),
  `install_platform`    VARCHAR(32)  NOT NULL,
  `install_form_factor` VARCHAR(32)  NOT NULL,
  `client_name`         VARCHAR(128),
  `client_version`      VARCHAR(64),
  `client_is_browser`   TINYINT(1) NOT NULL DEFAULT 0,
  `client_os_name`      VARCHAR(64),
  `client_os_version`   VARCHAR(64),
  `client_screen_w`     INT,
  `client_screen_h`     INT,
  `client_ip_address`   VARCHAR(64),
  `client_user_agent`   TEXT,
  `push_provider`       VARCHAR(32),
  `push_token`          VARCHAR(1024),
  `custom_data`         TEXT,
  PRIMARY KEY (`tenant_id`, `actor_id`, `token_key`),
  INDEX `idx_expires_at` (`expires_at`)
)
```

The `expires_at` index is **inlined** into the `CREATE TABLE` statement. MySQL does not support `CREATE INDEX IF NOT EXISTS` as a standalone statement, so this is the only idempotent path that creates both the table and the index in one call.

## Column-to-Record Mapping

Twenty-five columns. The order in the table matches the canonical record-shape ordering defined by the Auth parent (`parts/record-shape.js` `getFieldNames()`), which the adapter relies on for positional `INSERT` parameter alignment.

Each column maps one-to-one to a field in the canonical record. The mapping diverges from a direct pass-through at two points, documented in the sections below: TINYINT boolean encoding and JSON encoding of `custom_data`.

## Identifier Quoting

Every identifier in the generated SQL is backtick-quoted using MySQL's native style: `` `col` ``. The adapter's private `Q(name)` helper handles all quoting; column names and the table name pass through it before they reach the driver.

`Q` throws an `Error` if the identifier contains a backtick. This guards against identifier injection through a malformed `table_name`. The check fires lazily on the first SQL build (not at `validateConfig` time), so a misconfigured `table_name` surfaces on first call rather than at adapter construction.

A correctly named table never triggers the check. Use lowercase, underscored names: `sessions_user`, `sessions_admin`. Do not put backticks, double-quotes, or whitespace in the name.

This differs from Postgres and SQLite (which use double-quoted identifiers) but matches the MySQL / MariaDB native convention.

## Boolean Encoding

MySQL's `BOOLEAN` type is a synonym for `TINYINT(1)`. The adapter uses `TINYINT(1)` explicitly and encodes `client_is_browser` as `0` or `1`:

- **On write.** `Boolean(value)` is coerced to `1` (true) or `0` (false). `undefined` is mapped to `null` before this stage, so a missing boolean writes as `null`; the `NOT NULL DEFAULT 0` column constraint then resolves it to `0`.
- **On read.** The driver (`mysql2`) may return TINYINT as a JS Number or as a Buffer depending on version and connection flags. The adapter normalizes both to a JS boolean: truthy values become `true`, falsy become `false`. `null` reads also surface as `false` so the record shape always has a stable boolean (matching the memory store and every other adapter's behavior).

This is one of two encodings the adapter applies (the other is JSON for `custom_data`). Every other column passes through unchanged.

## BIGINT Handling

`created_at`, `expires_at`, `last_active_at`, `client_screen_w`, `client_screen_h` are declared as `BIGINT`.

The `mysql2` driver typically returns BIGINT values as native JS Numbers when they fit in the safe integer range (which they do for epoch-second timestamps and screen dimensions). However, driver behavior can vary by version and `supportBigNumbers` / `bigNumberStrings` flags. The adapter defensively coerces from string on read so downstream code can rely on `record.expires_at` being a `Number` regardless of driver configuration.

This differs from the Postgres adapter, which must coerce BIGINT from string on every read because `pg` returns BIGINT as string by default.

## JSON Encoding of `custom_data`

`custom_data` is a free-form object that applications use for tenant-specific session metadata. MySQL 8 has a native `JSON` column type, but the adapter stores `custom_data` as a JSON-encoded string in a `TEXT` column. The trade-off matches every other SQL-backed sibling:

| Option | Pros | Cons |
|---|---|---|
| `JSON` column type | Server-side JSON queries, validation | Cross-backend portability breaks; the schema DDL differs between MySQL, Postgres, and SQLite |
| `TEXT` with JSON string (chosen) | Identical to every other backend's encoding. The record shape is the truth, not the column type | No server-side JSON queries. `custom_data` is opaque to the database |

The Auth module's design rule is "the record shape is the truth". Cross-backend portability beats per-backend optimization; if an application needs server-side JSON queries on session metadata, it stores that metadata in a different table outside the session row.

Corrupt stored values (manual `UPDATE` with non-JSON text) surface as `null` on read, not as a parse exception. The adapter's integrity contract is to never throw from a normal read path.

## UPSERT Semantics

`setSession` uses `INSERT ... ON DUPLICATE KEY UPDATE`:

```sql
INSERT INTO `sessions_user` (col_1, col_2, ..., col_25)
VALUES (?, ?, ..., ?)
ON DUPLICATE KEY UPDATE
  `actor_type`          = VALUES(`actor_type`),
  `token_secret_hash`   = VALUES(`token_secret_hash`),
  ...
```

The `VALUES(col)` function references the values that would have been inserted for each column. This is MySQL's native UPSERT syntax; differs from Postgres (`ON CONFLICT ... DO UPDATE SET col = EXCLUDED.col`) and SQLite (`ON CONFLICT ... DO UPDATE SET col = excluded.col`).

**Six columns are excluded from the `ON DUPLICATE KEY UPDATE` list.** The primary-key triple (`tenant_id`, `actor_id`, `token_key`) by definition cannot change (it is what triggers the duplicate-key condition); the per-install fields (`created_at`, `install_id`, `install_platform`, `install_form_factor`) are also locked to their original values. A second `setSession` on the same composite primary key updates everything else but cannot rewrite the session's creation metadata or the install record.

This is enforced through the adapter's `UPSERT_IMMUTABLE_COLUMNS` list, evaluated at UPSERT-SQL build time. The build runs once per adapter instance and the result is cached for every subsequent `setSession`.

## Index Strategy

The schema has **two indexes**.

| Index | Kind | Columns | Created by |
|---|---|---|---|
| `PRIMARY` | Primary key | `(tenant_id, actor_id, token_key)` | The `PRIMARY KEY (...)` clause inside `CREATE TABLE`. MySQL names it automatically |
| `idx_expires_at` | Secondary | `(expires_at)` | Inlined `INDEX idx_expires_at (expires_at)` inside `CREATE TABLE` |

### Primary Key Index

`(tenant_id, actor_id, token_key)`. The column order is intentional. MySQL's B-tree uses left-to-right prefix matching, so this order serves every adapter access pattern with no additional index.

| Adapter method | Predicate | How the index serves it |
|---|---|---|
| `getSession` | `tenant_id = ? AND actor_id = ? AND token_key = ?` | Full-triple equality. Single-row lookup |
| `listSessionsByActor` | `tenant_id = ? AND actor_id = ?` | Two-column prefix. Bounded range scan |
| `setSession` | `ON DUPLICATE KEY UPDATE` triggered by PK collision | Duplicate-key detection for the UPSERT |
| `updateSessionActivity` | `tenant_id = ? AND actor_id = ? AND token_key = ?` | Full-triple equality inside the `UPDATE ... WHERE` |
| `deleteSession` | Same as `updateSessionActivity` | Full-triple equality inside the `DELETE ... WHERE` |
| `deleteSessions` | `(tenant_id = ? AND actor_id = ? AND token_key = ?) OR (...) OR (...)` | Series of full-triple equalities. All served by the same index in one query plan |

`tenant_id` is the leading column because tenancy is the primary isolation boundary. No current adapter method restricts on `tenant_id` alone, but putting it first keeps every per-tenant scan within one contiguous sub-tree of the index.

### `expires_at` Secondary Index

`idx_expires_at`. Inlined into `CREATE TABLE` because MySQL does not support `CREATE INDEX IF NOT EXISTS` as a standalone statement.

| Adapter method | Predicate | How the index serves it |
|---|---|---|
| `cleanupExpiredSessions` | `expires_at < <now>` | Range scan. Sweep cost is proportional to the number of expired rows, not to the total row count |

Without this index, `cleanupExpiredSessions` would degenerate to a full table scan. With it, the sweep stays bounded by the size of the expired set. The index pays for itself on the very first non-trivial cleanup.

### No Other Indexes

The adapter does not create indexes on `actor_type`, `install_id`, `install_platform`, `install_form_factor`, `last_active_at`, `refresh_token_hash`, `refresh_family_id`, `push_token`, `client_ip_address`, or any other column. The Auth parent module never queries on these columns; every read restricts on `(tenant_id, actor_id, token_key)` or a prefix, every write restricts on the same triple, and the only secondary access pattern is the `expires_at` sweep already covered by the secondary index. Adding indexes for unused queries would cost write throughput and storage on every `setSession` and `updateSessionActivity` call with no payoff on any read path.

## Native TTL

MySQL has no built-in row-level TTL. The closest equivalent is the **MySQL Event Scheduler**, which can run a scheduled `DELETE` statement server-side. This is documented in [cleanup.md](cleanup.md) as an alternative to application-side cron jobs.

`cleanupExpiredSessions` is the only adapter-provided deletion path for expired rows. It is a standard `DELETE` with a `WHERE expires_at < ?` predicate, served by the `expires_at` index.
