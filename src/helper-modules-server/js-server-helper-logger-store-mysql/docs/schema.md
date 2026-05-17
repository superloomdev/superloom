# Schema — js-server-helper-logger-store-mysql

## DDL

`setupNewStore` issues one idempotent DDL statement with all indexes inlined:

```sql
CREATE TABLE IF NOT EXISTS `action_log` (
  `scope`         VARCHAR(128) NOT NULL DEFAULT '',
  `entity_type`   VARCHAR(64)  NOT NULL,
  `entity_id`     VARCHAR(128) NOT NULL,
  `actor_type`    VARCHAR(64)  NOT NULL,
  `actor_id`      VARCHAR(128) NOT NULL,
  `action`        VARCHAR(128) NOT NULL,
  `data`          TEXT,
  `ip`            VARCHAR(64),
  `user_agent`    TEXT,
  `created_at`    BIGINT       NOT NULL,
  `created_at_ms` BIGINT       NOT NULL,
  `sort_key`      VARCHAR(64)  NOT NULL,
  `expires_at`    BIGINT,
  PRIMARY KEY (`sort_key`),
  INDEX `idx_action_log_entity_sort` (`scope`, `entity_type`, `entity_id`, `sort_key`),
  INDEX `idx_action_log_actor_sort` (`scope`, `actor_type`, `actor_id`, `sort_key`),
  INDEX `idx_action_log_expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

## Column Mapping

| Column | MySQL Type | Nullable | Notes |
|--------|------------|----------|-------|
| `scope` | `VARCHAR(128)` | No | Namespace. Default `''`. |
| `entity_type` | `VARCHAR(64)` | No | Entity type. |
| `entity_id` | `VARCHAR(128)` | No | Entity identifier. |
| `actor_type` | `VARCHAR(64)` | No | Actor type. |
| `actor_id` | `VARCHAR(128)` | No | Actor identifier. |
| `action` | `VARCHAR(128)` | No | Action name. |
| `data` | `TEXT` | Yes | JSON-serialized payload. |
| `ip` | `VARCHAR(64)` | Yes | IP address (may be encrypted). |
| `user_agent` | `TEXT` | Yes | User-agent string. |
| `created_at` | `BIGINT` | No | Unix epoch seconds. |
| `created_at_ms` | `BIGINT` | No | Unix epoch milliseconds. |
| `sort_key` | `VARCHAR(64)` | No | Primary key. Timestamp-based unique string. |
| `expires_at` | `BIGINT` | Yes | Unix epoch seconds. `NULL` for persistent records. |

## MySQL-Specific Details

### Identifier Quoting

All identifiers are backtick-quoted (`` `col` ``). The adapter rejects any `table_name` containing a backtick.

### Inlined Indexes

MySQL does not support `CREATE INDEX IF NOT EXISTS` standalone. All three indexes are inlined inside `CREATE TABLE IF NOT EXISTS` for full idempotency in one round-trip.

### `addLog` Idempotency

Uses `INSERT ... ON DUPLICATE KEY UPDATE \`sort_key\` = \`sort_key\`` (a MySQL no-op: updating the primary key to its current value). The row is not modified; `affected_rows` returns 0. This ensures re-sending the same `sort_key` is always safe.

### `data` Column

JSON-serialized TEXT. Parsed back on read. `null` for no payload.

### Engine and Charset

`ENGINE=InnoDB` for row-level locking. `CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` for full Unicode support.

### Index Strategy

- **`idx_<table>_entity_sort`** — compound `(scope, entity_type, entity_id, sort_key)` covering `getLogsByEntity` + cursor pagination (`sort_key < ?` then `ORDER BY sort_key DESC`).
- **`idx_<table>_actor_sort`** — compound `(scope, actor_type, actor_id, sort_key)` covering `getLogsByActor` + cursor pagination.
- **`idx_<table>_expires_at`** — single column covering `cleanupExpiredLogs`. MySQL indexes `NULL` values, unlike SQLite's partial index; the `IS NOT NULL` filter in the query WHERE clause is evaluated after the index scan.

Index names follow the pattern `idx_{table_name}_{suffix}`, computed deterministically from `STORE_CONFIG.table_name`.
