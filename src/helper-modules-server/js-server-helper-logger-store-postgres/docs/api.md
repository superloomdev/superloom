# API Reference — js-server-helper-logger-store-postgres

This adapter implements the 5-method store contract consumed by `js-server-helper-logger`. This document focuses on the PostgreSQL-specific semantics.

## Adapter Factory

```js
const store = require('@superloomdev/js-server-helper-logger-store-postgres')(Lib, CONFIG, ERRORS);
```

## Store Contract

### `setupNewStore(instance)`

Executes four idempotent DDL statements:

1. `CREATE TABLE IF NOT EXISTS "{table_name}" (...)` — log table with `sort_key` as sole primary key.
2. `CREATE INDEX IF NOT EXISTS "idx_{table_name}_entity_sort" ON ...` — entity query path.
3. `CREATE INDEX IF NOT EXISTS "idx_{table_name}_actor_sort" ON ...` — actor query path.
4. `CREATE INDEX IF NOT EXISTS "idx_{table_name}_expires_at" ON ...` — cleanup path.

**Return:** `{ success, error }`

---

### `addLog(instance, record)`

Idempotent insert:

```sql
INSERT INTO "{table_name}" (...)
VALUES (?, ?, ...)
ON CONFLICT ("sort_key") DO NOTHING
```

`record.data` is JSON-serialized to TEXT. `record.expires_at` may be `null` for persistent records.

**Return:** `{ success, error }`

---

### `getLogsByEntity(instance, query)`

Queries log records for a `(scope, entity_type, entity_id)` triple, most-recent first.

| Field | Required | Description |
|-------|----------|-------------|
| `scope` | Yes | Namespace filter |
| `entity_type` | Yes | Entity type |
| `entity_id` | Yes | Entity ID |
| `actions` | No | Array of action strings |
| `limit` | No | Page size (default 50) |
| `cursor` | No | `sort_key` from previous page's `next_cursor` |

Fetches `limit + 1` rows internally. `next_cursor` is non-null when more rows exist.

**Return:** `{ success, records, next_cursor, error }`

---

### `getLogsByActor(instance, query)`

Same contract as `getLogsByEntity` but queries by `(scope, actor_type, actor_id)`.

| Field | Required | Description |
|-------|----------|-------------|
| `scope` | Yes | Namespace filter |
| `actor_type` | Yes | Actor type |
| `actor_id` | Yes | Actor ID |
| `limit` | No | Page size (default 50) |
| `cursor` | No | `sort_key` from previous page's `next_cursor` |

**Return:** `{ success, records, next_cursor, error }`

---

### `cleanupExpiredLogs(instance)`

```sql
DELETE FROM "{table_name}"
WHERE "expires_at" IS NOT NULL
  AND "expires_at" <= ?
```

Bound parameter is `Lib.Utils.getUnixTime()` (real wall-clock seconds). Returns `deleted_count` from `result.affected_rows || 0`. PostgreSQL has no native TTL; schedule this on a cron.

**Return:** `{ success, deleted_count, error }`

---

## BIGINT Coercion

The `pg` driver may return `BIGINT` columns as JavaScript strings. The adapter coerces `created_at`, `created_at_ms`, and `expires_at` to `Number` via `Number(row.col)` in `rowToRecord`.

## Error Handling

All methods return `{ success: false, error: ERRORS.SERVICE_UNAVAILABLE }` on driver failure. The underlying error is logged via `Lib.Debug.error`.
