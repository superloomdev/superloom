# js-server-helper-logger-store-mongodb. AI Reference

Class F storage adapter. MongoDB backend for `@superloomdev/js-server-helper-logger`. Cannot stand alone. Always loaded by the Logger parent via the factory protocol; not called directly by application code.

Requires a running MongoDB instance. Uses `js-server-helper-nosql-mongodb` (native driver wrapper) injected via `STORE_CONFIG.lib_mongodb`.

## Adapter Factory

```js
const factory = require('@superloomdev/js-server-helper-logger-store-mongodb');
const store   = factory(Lib, CONFIG, ERRORS);
```

| Argument | Type | Source |
|---|---|---|
| `Lib` | Object | Dependency container with `Utils` and `Debug` at minimum |
| `CONFIG` | Object | Merged Logger config; the factory reads `CONFIG.STORE_CONFIG` only |
| `ERRORS` | Object | Logger error catalog; the adapter uses `SERVICE_UNAVAILABLE` only |

Returns a Store interface.

## `STORE_CONFIG`

```js
{
  collection_name: 'action_log',  // required. one collection per logger instance
  lib_mongodb:     Lib.MongoDB    // required. initialized js-server-helper-nosql-mongodb
}
```

Both keys are required.

## Store Contract

| Method | Signature | Returns |
|---|---|---|
| `setupNewStore` | `(instance)` | `{ success, error }` |
| `addLog` | `(instance, record)` | `{ success, error }` |
| `getLogsByEntity` | `(instance, query)` | `{ success, records, next_cursor, error }` |
| `getLogsByActor` | `(instance, query)` | `{ success, records, next_cursor, error }` |
| `cleanupExpiredLogs` | `(instance)` | `{ success, deleted_count, error }` |

## Behaviors That Must Not Be Violated When Generating Code

1. **Never call the adapter directly from application code.** Always go through the parent Logger module.

2. **`_id` is set to `sort_key`.** MongoDB document ID equals `sort_key` — no auto-generated ObjectId. This is the primary deduplication key for `addLog`.

3. **`addLog` is idempotent.** Uses `replaceOne` with `upsert: true` on `{ _id: sort_key }`. Re-inserting the same `sort_key` silently replaces the document with identical content.

4. **No denormalized compound keys.** Documents store the canonical fields only (`scope`, `entity_type`, `entity_id`, `actor_type`, `actor_id`, etc.). The two query paths use compound indexes on the individual fields — no `entity_pk`/`actor_pk` strings are computed or stored.

5. **`_ttl` is a `Date` field derived from `expires_at * 1000`.** Drives the sparse TTL index. Absent for persistent (never-expiring) log records (where `expires_at` is null).

6. **`setupNewStore` creates exactly two compound indexes plus one TTL index:**
   - `{ scope: 1, entity_type: 1, entity_id: 1, sort_key: -1 }` named `logger_entity_idx` for `getLogsByEntity`.
   - `{ scope: 1, actor_type: 1, actor_id: 1, sort_key: -1 }` named `logger_actor_idx` for `getLogsByActor`.
   - `{ _ttl: 1 }` named `logger_ttl_idx` with `expireAfterSeconds: 0, sparse: true` for automatic TTL.

7. **`cleanupExpiredLogs` is an explicit sweep** on `{ expires_at: { $ne: null, $lte: now } }`. Complements the native TTL sweeper.

8. **`MONGO_URL` defaults to port 27020** in the test environment (not the standard 27017 or 27019 used by verify-store-mongodb) to avoid collisions.

9. **`data` is stored as a native MongoDB object** (not serialized to a string), because MongoDB supports embedded documents. This is different from SQL adapters where `data` is JSON TEXT.

## Peer Dependencies

```
@superloomdev/js-helper-utils                    (type checks)
@superloomdev/js-helper-debug                    (structured logging)
@superloomdev/js-server-helper-nosql-mongodb     (MongoDB driver wrapper)
```

## Error Catalog Used

| Error | When |
|---|---|
| `ERRORS.SERVICE_UNAVAILABLE` | Driver-level call failed. Logged via `Lib.Debug.error`, never surfaced to caller |

## Single Source of Truth

The store's source file is `store.js`. `_id = sort_key`. No denormalized compound keys — indexes are compound on the canonical fields. TTL field: `_ttl` (sparse index, only set when `expires_at` is non-null).
