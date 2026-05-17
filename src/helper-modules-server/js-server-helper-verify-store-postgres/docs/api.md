# API Reference — js-server-helper-verify-store-postgres

This adapter implements the 6-method store contract consumed by `js-server-helper-verify`. The contract shape is identical across all `verify-store-*` adapters; this document focuses on the PostgreSQL-specific semantics.

## Adapter Factory

```js
const store = require('@superloomdev/js-server-helper-verify-store-postgres')(Lib, CONFIG, ERRORS);
```

The factory validates `CONFIG.STORE_CONFIG`, builds the DDL array and UPSERT template once, and returns the Store interface.

## Store Contract

### `setupNewStore(instance)`

Executes two idempotent DDL statements in order:

1. `CREATE TABLE IF NOT EXISTS "..." (...)` — creates the verification table.
2. `CREATE INDEX IF NOT EXISTS "..." ON "..." ("expires_at")` — creates the cleanup index.

Both statements use `IF NOT EXISTS`, making repeated calls on every boot safe.

**Return:** `{ success, error }`

---

### `getRecord(instance, scope, key)`

Fetches one record by composite primary key `("scope", "id")`. Returns `record: null` when the row does not exist — this is not an error.

```sql
SELECT "code", "fail_count", "created_at", "expires_at"
FROM "{table_name}"
WHERE "scope" = ? AND "id" = ?
```

**Return:** `{ success, record, error }`

`record` shape when found:
```js
{
  code:       String,
  fail_count: Number,
  created_at: Number,   // may be returned as string by pg driver
  expires_at: Number    // may be returned as string by pg driver
}
```

---

### `setRecord(instance, scope, key, record)`

Upsert via `INSERT ... ON CONFLICT ("scope", "id") DO UPDATE SET col = excluded.col`. A second call with the same `(scope, key)` pair replaces all mutable columns in a single round-trip.

**Return:** `{ success, error }`

---

### `incrementFailCount(instance, scope, key)`

Atomic in-place increment:

```sql
UPDATE "{table_name}"
SET "fail_count" = "fail_count" + 1
WHERE "scope" = ? AND "id" = ?
```

Safe under concurrent verify attempts.

**Return:** `{ success, error }`

---

### `deleteRecord(instance, scope, key)`

Idempotent delete by composite key. A missing row is treated as success.

**Return:** `{ success, error }`

---

### `cleanupExpiredRecords(instance)`

Sweeps all rows whose `expires_at` is in the past:

```sql
DELETE FROM "{table_name}"
WHERE "expires_at" < ?
```

The bound parameter is `Lib.Utils.getUnixTime()` (real wall-clock seconds). Returns `deleted_count` equal to `result.affected_rows || 0`. PostgreSQL has no native TTL; schedule this on a cron.

**Return:** `{ success, deleted_count, error }`

---

## Error Handling

All methods return `{ success: false, error: ERRORS.SERVICE_UNAVAILABLE }` on driver failure. The underlying driver error is logged via `Lib.Debug.debug`. A missing row from `getRecord` returns `{ success: true, record: null, error: null }`.
