# js-server-helper-verify-store-mongodb. AI Reference

Class F storage adapter. MongoDB backend for `@superloomdev/js-server-helper-verify`. Cannot stand alone. Always loaded by the Verify parent via the factory protocol; not called directly by application code.

Requires a running MongoDB instance. Uses `js-server-helper-nosql-mongodb` (native driver wrapper) injected via `STORE_CONFIG.lib_mongodb`.

## Adapter Factory

```js
const factory = require('@superloomdev/js-server-helper-verify-store-mongodb');
const store   = factory(Lib, CONFIG, ERRORS);
```

| Argument | Type | Source |
|---|---|---|
| `Lib` | Object | Dependency container with `Utils` and `Debug` at minimum |
| `CONFIG` | Object | Merged Verify config; the factory reads `CONFIG.STORE_CONFIG` only |
| `ERRORS` | Object | Verify error catalog; the adapter uses `SERVICE_UNAVAILABLE` only |

Returns a Store interface. The Verify parent retains the reference and calls the contract methods.

## `STORE_CONFIG`

```js
{
  collection_name: 'verification_codes',  // required. one collection per verify instance
  lib_mongodb:     Lib.MongoDB            // required. initialized js-server-helper-nosql-mongodb
}
```

Both keys are required. The loader throws an `Error` if either is missing, null, or empty.

## Store Contract

| Method | Signature | Returns |
|---|---|---|
| `setupNewStore` | `(instance)` | `{ success, error }` |
| `getRecord` | `(instance, scope, key)` | `{ success, record, error }` |
| `setRecord` | `(instance, scope, key, record)` | `{ success, error }` |
| `incrementFailCount` | `(instance, scope, key)` | `{ success, error }` |
| `deleteRecord` | `(instance, scope, key)` | `{ success, error }` |
| `cleanupExpiredRecords` | `(instance)` | `{ success, deleted_count, error }` |

All methods are async. `instance` is the per-request scope object from `Lib.Instance.initialize()`.

## Behaviors That Must Not Be Violated When Generating Code

1. **Never call the adapter directly from application code.** Always go through the parent Verify module.

2. **`getRecord` returns `record: null` on a miss.** Not an error.

3. **`setRecord` is a full UPSERT via `replaceOne`.** The filter is `{ _id: { scope, id } }` — the compound `_id` field. A second `setRecord` on the same `(scope, key)` pair replaces the entire document.

4. **`incrementFailCount` uses `$inc` for atomic increment.** Issues `{ $inc: { fail_count: 1 } }`. Does not read first.

5. **`deleteRecord` is idempotent.** A missing document is treated as success.

6. **`_id` is a compound object `{ scope, id }`.** Not a string, not an ObjectId. The adapter constructs this on every write/read.

7. **`_ttl` is a `Date` field derived from `expires_at * 1000`.** The TTL index on `_ttl` (`expireAfterSeconds: 0`) triggers automatic MongoDB background deletion approximately 60 seconds after the Date passes. Verify codes always carry `expires_at`, so every document has `_ttl` — the index is non-sparse.

8. **`setupNewStore` creates exactly one index:** a TTL index `{ _ttl: 1 }` with `{ name: 'verify_ttl_idx', expireAfterSeconds: 0 }`. The primary key is the compound `_id`; MongoDB creates a unique index on `_id` automatically.

9. **`cleanupExpiredRecords` is an explicit sweep.** Deletes documents where `expires_at` is not null and `<= Lib.Utils.getUnixTime()`. This complements the native TTL sweeper for environments needing deterministic `deleted_count` reporting.

10. **`MONGO_URL` defaults to port 27019** in the test environment (not the standard 27017) to avoid collisions with other running MongoDB instances.

## Peer Dependencies

```
@superloomdev/js-helper-utils                    (type checks)
@superloomdev/js-helper-debug                    (structured logging)
@superloomdev/js-server-helper-nosql-mongodb     (MongoDB driver wrapper)
```

## Error Catalog Used

| Error | When |
|---|---|
| `ERRORS.SERVICE_UNAVAILABLE` | Driver-level call failed. Logged via `Lib.Debug.debug`, never surfaced to caller |

## Single Source of Truth

The store's source file is `store.js`; the config validator is `store.validators.js`. The compound `_id` key is `{ scope, id }`. The `_ttl` field is the TTL index key.
