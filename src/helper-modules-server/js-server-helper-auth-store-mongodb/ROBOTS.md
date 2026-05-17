# js-server-helper-auth-store-mongodb. AI Reference

Class F storage adapter. MongoDB backend for `@superloomdev/js-server-helper-auth`. Cannot stand alone. Always loaded by the Auth parent via the factory protocol; not called directly by application code.

## Adapter Factory

```js
const factory = require('@superloomdev/js-server-helper-auth-store-mongodb');
const store   = factory(Lib, CONFIG, ERRORS);
```

| Argument | Type | Source |
|---|---|---|
| `Lib` | Object | Dependency container with `Utils` and `Debug` at minimum |
| `CONFIG` | Object | Merged Auth config; the factory reads `CONFIG.STORE_CONFIG` only |
| `ERRORS` | Object | Auth error catalog; the adapter uses `SERVICE_UNAVAILABLE` and `NOT_IMPLEMENTED` |

Returns a Store interface. The Auth parent retains the reference and calls the contract methods to satisfy its persistence needs.

## `STORE_CONFIG`

```js
{
  collection_name: 'sessions_user',  // required. one collection per actor_type
  lib_mongodb:     Lib.MongoDB       // required. initialized js-server-helper-nosql-mongodb
}
```

Both keys are required. The loader throws an `Error` if either is missing, null, or empty.

## Store Contract

| Method | Signature | Returns |
|---|---|---|
| `setupNewStore` | `(instance)` | `{ success: false, error: ERRORS.NOT_IMPLEMENTED }` always |
| `getSession` | `(instance, tenant_id, actor_id, token_key, token_secret_hash)` | `{ success, record, error }` |
| `listSessionsByActor` | `(instance, tenant_id, actor_id)` | `{ success, records, error }` |
| `setSession` | `(instance, record)` | `{ success, error }` |
| `updateSessionActivity` | `(instance, tenant_id, actor_id, token_key, updates)` | `{ success, error }` |
| `deleteSession` | `(instance, tenant_id, actor_id, token_key)` | `{ success, error }` |
| `deleteSessions` | `(instance, tenant_id, keys)` | `{ success, error }` |
| `cleanupExpiredSessions` | `(instance)` | `{ success, deleted_count, error }` |

All methods except `setupNewStore` are async and use the standard envelope. `setupNewStore` is the only contract method that returns a typed error (`ERRORS.NOT_IMPLEMENTED`) on every call.

## Document Shape

Each session is a single document. The shape is the canonical record plus two adapter-managed fields:

```js
{
  _id:    '<tenant_id>#<actor_id>#<token_key>#<token_secret_hash>',
  prefix: '<tenant_id>#<actor_id>#',
  /* every canonical session-record field, stored as native BSON */
}
```

| Adapter-managed field | Purpose |
|---|---|
| `_id` | Composite key. Token-secret hash is part of the key. Default index gives O(1) lookup. Wrong-secret probes return null naturally |
| `prefix` | Denormalized `<tenant_id>#<actor_id>#`. Indexed equality query for `listSessionsByActor` |

## Behaviors That Must Not Be Violated When Generating Code

1. **Never call the adapter directly from application code.** Always go through the parent Auth module. The adapter expects `Lib`, the full Auth `CONFIG`, and the frozen Auth `ERRORS` catalog. Application code does not have those.

2. **`setupNewStore` is not implemented.** Always returns `{ success: false, error: ERRORS.NOT_IMPLEMENTED }`. Indexes and the collection are provisioned out-of-band. Generated code that calls `setupNewStore` on this backend must handle the `NOT_IMPLEMENTED` error envelope; do not assume it succeeds.

3. **`getSession` returns `record: null` on hash mismatch.** The token-secret hash is part of `_id`; a wrong hash means the constructed `_id` does not match any document and MongoDB returns null. Identical to a missing session. Do not surface the wrong-secret case as a distinct error or envelope; it must look identical to a missing document to prevent timing-based enumeration.

4. **`updateSessionActivity` throws `TypeError` on identity fields.** Programmer-error guard. The blocked fields are `tenant_id`, `actor_id`, `actor_type`, `token_key`, `token_secret_hash`, `created_at`, `install_id`, `install_platform`, `install_form_factor`, **`_id`**, and **`prefix`**. The two MongoDB-specific fields (`_id`, `prefix`) are added to the blocklist because mutating them would break the document's identity. Do not catch and swallow the throw.

5. **`setSession` is a full-document `replaceOne` + upsert.** It replaces every field of the existing document. The adapter does not read-then-merge; UPSERT-immutability of identity and per-install fields is the Auth parent's responsibility (the parent always passes the original `created_at`, `install_id`, `install_platform`, `install_form_factor` values on every `setSession`). Generated code that bypasses the parent and calls `setSession` directly must respect this invariant.

6. **`deleteSessions` with `keys.length === 0` is a no-op success.** Returns `{ success: true, error: null }` without round-trip to MongoDB.

7. **`updateSessionActivity`, `deleteSession`, and `deleteSessions` use anchored prefix regex on `_id`.** The caller only has `(tenant_id, actor_id, token_key)`, not the hash baked into `_id`. The adapter constructs `new RegExp('^' + escapeRegExp(prefix))` to match the unique document. Regex metacharacters in `tenant_id` or `actor_id` are escaped automatically.

8. **`custom_data` is stored as a native BSON sub-document.** No JSON serialization. Reads return the native object. Application code can put any BSON-encodable value in `custom_data`; the adapter does not coerce.

9. **Timestamps are stored as Number (Unix seconds), not BSON Date.** This matches every other adapter's record shape. MongoDB's native TTL index requires a Date-typed field, so the integer `expires_at` cannot drive TTL directly; see `docs/cleanup.md` for the two operator options.

10. **MongoDB native TTL is not enabled by default.** `cleanupExpiredSessions` is the deletion path. Application code must schedule it (cron, scheduled function invocation). Operators who want native TTL provision a separate Date field and TTL index, documented in `docs/schema.md` and `docs/cleanup.md`.

11. **`cleanupExpiredSessions` does a `deleteMany({ expires_at: { $lt: now } })`.** Without an `expires_at` secondary index this is a collection scan. The index is operator-provisioned, not adapter-created; see `docs/schema.md`.

## Peer Dependencies

```
@superloomdev/js-helper-utils                  (type checks)
@superloomdev/js-helper-debug                  (structured logging)
@superloomdev/js-server-helper-nosql-mongodb   (MongoDB driver wrapper)
```

These are loaded into `Lib` by the application before the Auth parent is loaded. The adapter does not require any of them directly; it accesses them through `Lib`.

## Error Catalog Used

Two types from the Auth `ERRORS` catalog:

| Error | When |
|---|---|
| `ERRORS.SERVICE_UNAVAILABLE` | Driver-level call failed. The driver's underlying error is logged via `Lib.Debug.debug` and never surfaced |
| `ERRORS.NOT_IMPLEMENTED` | Returned unconditionally from `setupNewStore` |

`getSession` with a hash mismatch is **not** an error. It is success with `record: null`.

## Single Source of Truth

The store's source file is `store.js`; the config validator is `store.validators.js`. The composite-`_id` helpers, the regex-escape function, the document-shape mapping, and the identity blocklist all live as private functions inside `store.js`. The blocklist explicitly includes `_id` and `prefix` alongside the canonical identity fields.
