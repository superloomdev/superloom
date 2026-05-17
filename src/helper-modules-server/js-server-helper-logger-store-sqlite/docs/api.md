# API Reference — js-server-helper-logger-store-sqlite

This adapter implements the 5-method store contract consumed by `js-server-helper-logger`. The contract shape is identical across all `logger-store-*` adapters; this document focuses on the SQLite-specific semantics.

## Adapter Factory

```js
const store = require('@superloomdev/js-server-helper-logger-store-sqlite')(Lib, CONFIG, ERRORS);
```

The factory validates `CONFIG.STORE_CONFIG`, builds the DDL array and INSERT template once, and returns the Store interface.

## Store Contract

### `setupNewStore(instance)`

Executes four idempotent DDL statements in order:

1. `CREATE TABLE IF NOT EXISTS "{table_name}" (...)` — creates the log table with `sort_key` as the sole primary key.
2. `CREATE INDEX IF NOT EXISTS "idx_{table_name}_entity" ON ...` — covers entity query path.
3. `CREATE INDEX IF NOT EXISTS "idx_{table_name}_actor" ON ...` — covers actor query path.
4. `CREATE INDEX IF NOT EXISTS "idx_{table_name}_expires_at" ON ...` — covers cleanup path.

All use `IF NOT EXISTS`, making repeated calls on every boot safe.

**Return:** `{ success, error }`

---

### `addLog(instance, record)`

Inserts one log record. Conflicts on `sort_key` (PK) are silently ignored:

```sql
INSERT INTO "{table_name}" (...)
VALUES (?, ?, ...)
ON CONFLICT ("sort_key") DO NOTHING
```

This makes `addLog` idempotent — re-sending the same `sort_key` is not an error.

`record.data` is JSON-serialized to TEXT before insert. `record.expires_at` may be `null` for persistent records.

**Return:** `{ success, error }`

---

### `getLogsByEntity(instance, query)`

Retrieves log records for a `(scope, entity_type, entity_id)` triple, most-recent first.

Query parameters:

| Field | Required | Description |
|-------|----------|-------------|
| `scope` | Yes | Namespace filter |
| `entity_type` | Yes | Entity type filter |
| `entity_id` | Yes | Entity ID filter |
| `actions` | No | Array of action strings to filter by |
| `limit` | No | Page size (default 50) |
| `cursor` | No | `sort_key` value from previous page's `next_cursor` |

The adapter fetches `limit + 1` rows internally to detect whether a next page exists. `next_cursor` is the `sort_key` of the last item on the current page when more rows exist, or `null` when on the last page.

**Return:** `{ success, records, next_cursor, error }`

---

### `getLogsByActor(instance, query)`

Same pagination contract as `getLogsByEntity` but queries by `(scope, actor_type, actor_id)`.

Query parameters:

| Field | Required | Description |
|-------|----------|-------------|
| `scope` | Yes | Namespace filter |
| `actor_type` | Yes | Actor type filter |
| `actor_id` | Yes | Actor ID filter |
| `limit` | No | Page size (default 50) |
| `cursor` | No | `sort_key` value from previous page's `next_cursor` |

**Return:** `{ success, records, next_cursor, error }`

---

### `cleanupExpiredLogs(instance)`

Deletes all rows with an `expires_at` that is non-null and in the past:

```sql
DELETE FROM "{table_name}"
WHERE "expires_at" IS NOT NULL
  AND "expires_at" <= ?
```

The bound parameter is `Lib.Utils.getUnixTime()` (real wall-clock seconds, not `instance.time`). SQLite has no native TTL; schedule this on a cron.

Returns `deleted_count` equal to `result.affected_rows || 0`.

**Return:** `{ success, deleted_count, error }`

---

## Error Handling

All methods return `{ success: false, error: ERRORS.SERVICE_UNAVAILABLE }` on driver failure. The driver error is logged via `Lib.Debug.error`. No underlying error is surfaced to the caller.
