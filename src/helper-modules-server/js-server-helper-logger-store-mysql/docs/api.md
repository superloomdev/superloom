# API Reference — js-server-helper-logger-store-mysql

This adapter implements the 5-method store contract consumed by `js-server-helper-logger`. This document focuses on the MySQL-specific semantics.

## Adapter Factory

```js
const store = require('@superloomdev/js-server-helper-logger-store-mysql')(Lib, CONFIG, ERRORS);
```

## Store Contract

### `setupNewStore(instance)`

Executes one idempotent DDL statement with all indexes inlined:

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

MySQL does not support standalone `CREATE INDEX IF NOT EXISTS`, so all indexes are inlined for full idempotency in one round-trip.

**Return:** `{ success, error }`

---

### `addLog(instance, record)`

Idempotent insert (MySQL no-op pattern):

```sql
INSERT INTO `action_log` (...)
VALUES (?, ?, ...)
ON DUPLICATE KEY UPDATE `sort_key` = `sort_key`
```

A `sort_key` collision results in a no-op update — the existing row is unchanged. `record.data` is JSON-serialized to TEXT.

**Return:** `{ success, error }`

---

### `getLogsByEntity(instance, query)`

Queries records by `(scope, entity_type, entity_id)`, most-recent first.

| Field | Required | Description |
|-------|----------|-------------|
| `scope` | Yes | Namespace filter |
| `entity_type` | Yes | Entity type |
| `entity_id` | Yes | Entity ID |
| `actions` | No | Array of action strings |
| `limit` | No | Page size (default 50) |
| `cursor` | No | `sort_key` from previous page's `next_cursor` |

Fetches `limit + 1` rows to detect next page.

**Return:** `{ success, records, next_cursor, error }`

---

### `getLogsByActor(instance, query)`

Same as `getLogsByEntity` but queries by `(scope, actor_type, actor_id)`.

**Return:** `{ success, records, next_cursor, error }`

---

### `cleanupExpiredLogs(instance)`

```sql
DELETE FROM `action_log`
WHERE `expires_at` IS NOT NULL
  AND `expires_at` <= ?
```

Bound parameter is `Lib.Utils.getUnixTime()`. MySQL has no native TTL; schedule this on a cron.

**Return:** `{ success, deleted_count, error }`

---

## Error Handling

All methods return `{ success: false, error: ERRORS.SERVICE_UNAVAILABLE }` on driver failure. The driver error is logged via `Lib.Debug.error`.
