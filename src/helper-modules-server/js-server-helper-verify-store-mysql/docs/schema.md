# Schema — js-server-helper-verify-store-mysql

## DDL

`setupNewStore` issues one idempotent DDL statement (built by `_Store.buildSchemaDDL()` at `createInterface` time) with all indexes inlined:

```sql
CREATE TABLE IF NOT EXISTS `verification_codes` (
  `scope`      VARCHAR(255) NOT NULL,
  `id`         VARCHAR(255) NOT NULL,
  `code`       VARCHAR(255) NOT NULL,
  `fail_count` INTEGER      NOT NULL DEFAULT 0,
  `created_at` BIGINT       NOT NULL,
  `expires_at` BIGINT       NOT NULL,
  PRIMARY KEY (`scope`, `id`),
  INDEX `idx_verification_codes_expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

The table name and index name are derived from `STORE_CONFIG.table_name` at runtime.

## Column Mapping

| Column | MySQL Type | Nullable | Notes |
|--------|------------|----------|-------|
| `scope` | `VARCHAR(255)` | No | Logical namespace. Part of composite PK. |
| `id` | `VARCHAR(255)` | No | Verification key. Part of composite PK. Called `key` in contract; stored as `id`. |
| `code` | `VARCHAR(255)` | No | Hashed or plain verification code. |
| `fail_count` | `INTEGER` | No | Failed attempt count. Default `0`. |
| `created_at` | `BIGINT` | No | Unix epoch seconds. |
| `expires_at` | `BIGINT` | No | Unix epoch seconds. |

## MySQL-Specific Details

### Identifier Quoting

All identifiers are backtick-quoted (`` `col` ``). The adapter rejects any `table_name` containing a backtick at quoting time.

### Inlined Indexes

MySQL does not support `CREATE INDEX IF NOT EXISTS` as a standalone DDL statement. All indexes are inlined inside `CREATE TABLE IF NOT EXISTS`, which is itself idempotent. This keeps `setupNewStore` to a single round-trip.

### BIGINT Coercion

The `mysql2` driver may return `BIGINT` columns as JavaScript strings. The verify module performs coercion when comparing against `instance.time`.

### UPSERT Semantics

`setRecord` uses:

```sql
INSERT INTO `verification_codes`
  (`scope`, `id`, `code`, `fail_count`, `created_at`, `expires_at`)
VALUES (?, ?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
  `code`       = VALUES(`code`),
  `fail_count` = VALUES(`fail_count`),
  `created_at` = VALUES(`created_at`),
  `expires_at` = VALUES(`expires_at`)
```

`VALUES(col)` refers to the value that would have been inserted. The primary key columns (`scope`, `id`) are never part of the `ON DUPLICATE KEY UPDATE` clause.

### Engine and Charset

`ENGINE=InnoDB` provides transaction support and row-level locking. `CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` ensures full Unicode support including 4-byte characters (emoji, supplementary ideographs).

## Index Name

The index name is `idx_{table_name}_expires_at`, computed deterministically from `STORE_CONFIG.table_name` at `createInterface` time.
