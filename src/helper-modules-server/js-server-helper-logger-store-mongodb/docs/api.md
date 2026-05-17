# API Reference — js-server-helper-logger-store-mongodb

This adapter implements the 5-method store contract consumed by `js-server-helper-logger`. This document focuses on the MongoDB-specific semantics.

## Adapter Factory

```js
const store = require('@superloomdev/js-server-helper-logger-store-mongodb')(Lib, CONFIG, ERRORS);
```

## Store Contract

### `setupNewStore(instance)`

Creates three indexes (idempotent via MongoDB's `createIndex`):

```js
// Entity query index
createIndex(
  { scope: 1, entity_type: 1, entity_id: 1, sort_key: -1 },
  { name: 'logger_entity_idx' }
);

// Actor query index
createIndex(
  { scope: 1, actor_type: 1, actor_id: 1, sort_key: -1 },
  { name: 'logger_actor_idx' }
);

// Sparse TTL index: auto-deletes documents ~60s after _ttl Date passes
createIndex(
  { _ttl: 1 },
  { name: 'logger_ttl_idx', expireAfterSeconds: 0, sparse: true }
);
```

`createIndex` is idempotent — calling it on an already-existing index with identical options is a no-op.

**Return:** `{ success, error }`

---

### `addLog(instance, record)`

Idempotent upsert via the driver's `writeRecord` (a `replaceOne` with `upsert: true`):

```js
filter:      { _id: record.sort_key }
replacement: { _id: sort_key, scope, entity_type, entity_id,
               actor_type, actor_id, action, data, ip, user_agent,
               created_at, created_at_ms, sort_key, expires_at, _ttl? }
options:     { upsert: true }
```

- `_id` is set to `record.sort_key` — deterministic identity, makes the call idempotent on retries.
- `_ttl` = `new Date(record.expires_at * 1000)` — added **only** when `expires_at` is non-null. Persistent records omit the field entirely so the sparse TTL index skips them.
- `data` is stored as a native MongoDB embedded document (not JSON text).

**Return:** `{ success, error }`

---

### `getLogsByEntity(instance, query)`

Query filter: `{ scope, entity_type, entity_id }` plus optional `action`, `created_at_ms` range, and `sort_key` cursor. Sort: `{ sort_key: -1 }`. Served by the `logger_entity_idx` compound index.

| Field | Required | Description |
|-------|----------|-------------|
| `scope` | Yes | Namespace filter |
| `entity_type` | Yes | Entity type |
| `entity_id` | Yes | Entity ID |
| `actions` | No | Array of action strings |
| `limit` | No | Page size (default 50) |
| `cursor` | No | `sort_key` from previous page's `next_cursor` |

Fetches `limit + 1` documents to detect next page. `next_cursor` is the `sort_key` of the last document on the current page when more exist, or `null` when on the last page.

**Return:** `{ success, records, next_cursor, error }`

---

### `getLogsByActor(instance, query)`

Query filter: `{ scope, actor_type, actor_id }` plus optional `action`, `created_at_ms` range, and `sort_key` cursor. Sort: `{ sort_key: -1 }`. Served by the `logger_actor_idx` compound index.

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

Explicit sweep complementing the native TTL index:

```js
filter: { expires_at: { $ne: null, $lte: Lib.Utils.getUnixTime() } }
```

Returns `deleted_count` from the driver's `deletedCount`.

**Return:** `{ success, deleted_count, error }`

---

## Error Handling

All methods return `{ success: false, error: ERRORS.SERVICE_UNAVAILABLE }` on driver failure. The underlying error is logged via `Lib.Debug.error`.
