# API Reference — js-server-helper-verify-store-mysql

This adapter implements the 6-method store contract consumed by `js-server-helper-verify`. This document focuses on the MySQL-specific semantics.

## Adapter Factory

```js
const store = require('@superloomdev/js-server-helper-verify-store-mysql')(Lib, CONFIG, ERRORS);
```

## Store Contract

### `setupNewStore(instance)`

Executes one idempotent DDL statement that creates the table and all indexes inline:

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

MySQL does not support `CREATE INDEX IF NOT EXISTS` as a standalone DDL statement. Inlining all indexes into `CREATE TABLE IF NOT EXISTS` achieves full idempotency in a single round-trip.

**Return:** `{ success, error }`

---

### `getRecord(instance, scope, key)`

Fetches one record by composite primary key `(\`scope\`, \`id\`)`. Returns `record: null` when the row does not exist.

**Return:** `{ success, record, error }`

`record` shape when found:
```js
{
  code:       String,
  fail_count: Number,   // may be returned as string by mysql2 driver
  created_at: Number,   // may be returned as string by mysql2 driver
  expires_at: Number    // may be returned as string by mysql2 driver
}
```

---

### `setRecord(instance, scope, key, record)`

Upsert via `INSERT ... ON DUPLICATE KEY UPDATE col = VALUES(col)`. Replaces all mutable columns on key collision.

**Return:** `{ success, error }`

---

### `incrementFailCount(instance, scope, key)`

Atomic in-place increment:

```sql
UPDATE `verification_codes`
SET `fail_count` = `fail_count` + 1
WHERE `scope` = ? AND `id` = ?
```

**Return:** `{ success, error }`

---

### `deleteRecord(instance, scope, key)`

Idempotent delete. A missing row is treated as success.

**Return:** `{ success, error }`

---

### `cleanupExpiredRecords(instance)`

```sql
DELETE FROM `verification_codes`
WHERE `expires_at` < ?
```

Bound parameter is `Lib.Utils.getUnixTime()` (real wall-clock seconds). MySQL has no native TTL; schedule this on a cron.

**Return:** `{ success, deleted_count, error }`

---

## Error Handling

All methods return `{ success: false, error: ERRORS.SERVICE_UNAVAILABLE }` on driver failure. The underlying error is logged via `Lib.Debug.debug`. `getRecord` on a missing row returns `{ success: true, record: null, error: null }`.
