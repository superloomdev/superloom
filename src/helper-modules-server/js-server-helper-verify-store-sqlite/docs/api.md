# API Reference — js-server-helper-verify-store-sqlite

This adapter implements the 6-method store contract consumed by `js-server-helper-verify`. The contract shape is identical across all `verify-store-*` adapters; this document focuses on the SQLite-specific semantics.

## Adapter Factory

```js
const store = require('@superloomdev/js-server-helper-verify-store-sqlite')(Lib, CONFIG, ERRORS);
```

The factory validates `CONFIG.STORE_CONFIG`, builds the DDL array and UPSERT template once, and returns the Store interface. Calling the factory a second time with a different `table_name` returns an independent Store instance — each instance manages its own table.

## Store Contract

### `setupNewStore(instance)`

Executes two idempotent DDL statements in order:

1. `CREATE TABLE IF NOT EXISTS "{table_name}" (...)` — creates the verification table.
2. `CREATE INDEX IF NOT EXISTS "{table_name}_expires_at_idx" ON "{table_name}" ("expires_at")` — creates the cleanup index.

Both statements use `IF NOT EXISTS`, making repeated calls on every boot safe. Returns `{ success: false, error: ERRORS.SERVICE_UNAVAILABLE }` if any statement fails.

**Return:** `{ success, error }`

---

### `getRecord(instance, scope, key)`

Fetches one record by composite primary key `("scope", "id")`. Returns `record: null` when the row does not exist — this is not an error.

The query selects only the columns the verify module needs: `code`, `fail_count`, `created_at`, `expires_at`.

**Return:** `{ success, record, error }`

`record` shape when found:
```js
{
  code:       String,   // hashed or plain code depending on verify config
  fail_count: Number,   // integer count of failed attempts
  created_at: Number,   // Unix epoch seconds
  expires_at: Number    // Unix epoch seconds
}
```

---

### `setRecord(instance, scope, key, record)`

Upsert via `INSERT ... ON CONFLICT ("scope", "id") DO UPDATE SET`. A second call with the same `(scope, key)` pair replaces all mutable columns in a single round-trip.

Parameters bound in order: `scope`, `key` (stored as `id`), `record.code`, `record.fail_count`, `record.created_at`, `record.expires_at`.

**Return:** `{ success, error }`

---

### `incrementFailCount(instance, scope, key)`

Atomic in-place increment via:

```sql
UPDATE "{table_name}"
SET "fail_count" = "fail_count" + 1
WHERE "scope" = ? AND "id" = ?
```

Safe under concurrent verify attempts — each call adds exactly 1. Does not read the current value before writing.

**Return:** `{ success, error }`

---

### `deleteRecord(instance, scope, key)`

Idempotent delete by composite key:

```sql
DELETE FROM "{table_name}"
WHERE "scope" = ? AND "id" = ?
```

A missing row is treated as success. Callers do not need to check existence first.

**Return:** `{ success, error }`

---

### `cleanupExpiredRecords(instance)`

Sweeps all rows whose `expires_at` is in the past:

```sql
DELETE FROM "{table_name}"
WHERE "expires_at" < ?
```

The bound parameter is `Lib.Utils.getUnixTime()` (real wall-clock seconds), not `instance.time`. This ensures cleanup sweeps on schedule regardless of when the request's frozen clock was captured.

Returns `deleted_count` equal to the number of rows removed (`result.affected_rows || 0`).

SQLite has no native TTL; this method is the only automated deletion path for expired rows. Schedule it on a cron for file-backed deployments.

**Return:** `{ success, deleted_count, error }`

---

## Error Handling

All methods return `{ success: false, error: ERRORS.SERVICE_UNAVAILABLE }` on driver failure. The underlying driver error is logged via `Lib.Debug.debug` with the driver type and message. It is never surfaced to the caller.

`getRecord` on a missing row is **not** a failure — it returns `{ success: true, record: null, error: null }`.
