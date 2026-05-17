# Schema — js-server-helper-logger-store-mongodb

## Collection Structure

MongoDB does not use DDL. `setupNewStore` creates three indexes; the document shape is enforced by the adapter's read/write path.

## Document Shape

```js
{
  _id:          "1715180412345-xqp",          // sort_key — primary deduplication key
  scope:        "myapp",
  entity_type:  "user",
  entity_id:    "usr_123",
  actor_type:   "user",
  actor_id:     "usr_456",
  action:       "auth.login",
  data:         { browser: "Chrome", os: "macOS" },  // native embedded document
  ip:           "192.168.1.1",
  user_agent:   "Mozilla/5.0 ...",
  created_at:   1715180412,                    // Unix epoch seconds
  created_at_ms: 1715180412345,                // Unix epoch milliseconds
  sort_key:     "1715180412345-xqp",           // same as _id
  expires_at:   1722956412,                    // Unix epoch seconds; null for persistent
  _ttl:         ISODate("2024-08-06T12:00:12Z") // Date; absent for persistent records
}
```

No denormalized compound keys (`entity_pk`, `actor_pk`) are stored. The two query paths use compound indexes on the individual fields directly.

## Field Details

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `_id` | String | No | Equals `sort_key`. Unique. MongoDB creates a unique index on `_id` automatically. |
| `scope` | String | No | Namespace. |
| `entity_type` | String | No | Entity type. |
| `entity_id` | String | No | Entity identifier. |
| `actor_type` | String | No | Actor type. |
| `actor_id` | String | No | Actor identifier. |
| `action` | String | No | Action name. |
| `data` | Object | Yes | Native embedded document. `null` for no payload. Unlike SQL adapters, NOT JSON text. |
| `ip` | String | Yes | IP address (may be encrypted). |
| `user_agent` | String | Yes | User-agent string. |
| `created_at` | Number | No | Unix epoch seconds. |
| `created_at_ms` | Number | No | Unix epoch milliseconds. |
| `sort_key` | String | No | Primary sort key. Same as `_id`. |
| `expires_at` | Number | Yes | Unix epoch seconds. `null` for persistent records. |
| `_ttl` | Date | Yes | `new Date(expires_at * 1000)`. Absent for persistent records. Drives TTL index. |

## Indexes

`setupNewStore` creates three indexes:

```js
// Entity query path
key:     { scope: 1, entity_type: 1, entity_id: 1, sort_key: -1 }
name:    'logger_entity_idx'

// Actor query path
key:     { scope: 1, actor_type: 1, actor_id: 1, sort_key: -1 }
name:    'logger_actor_idx'

// Sparse TTL index
key:     { _ttl: 1 }
name:    'logger_ttl_idx'
options: { expireAfterSeconds: 0, sparse: true }
```

## MongoDB-Specific Details

### `_id` as `sort_key`

Setting `_id = sort_key` gives every log document a stable, predictable identity string. This makes `addLog` idempotent — `replaceOne` on `{ _id: sort_key }` with `upsert: true` either inserts (first write) or replaces with identical content (retry).

### `data` as Embedded Document

Unlike SQL adapters that serialize `data` to JSON text, this adapter stores `data` as a native MongoDB embedded document. Querying, projecting, or indexing sub-fields of `data` is possible without string parsing — a MongoDB-native advantage.

### Compound Indexes on Canonical Fields

The two query paths use compound indexes directly on `(scope, entity_type, entity_id, sort_key)` and `(scope, actor_type, actor_id, sort_key)`. No denormalized compound key strings are stored on documents — MongoDB's compound-index implementation handles equality matches across multiple fields efficiently.

### Sparse TTL Index

`sparse: true` means documents without a `_ttl` field (persistent records where `expires_at` is null) are not included in the TTL index and are never auto-deleted. The `_ttl` field is set on write **only** when `expires_at` is non-null.
