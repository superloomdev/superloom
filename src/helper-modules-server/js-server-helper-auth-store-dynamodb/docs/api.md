# API

This adapter is loaded by the Auth parent module via the factory protocol. The parent calls these methods to satisfy its persistence requirements. This page documents the contract as implemented for DynamoDB, with backend-specific semantics noted where they matter.

The contract is identical in shape across every `auth-store-*` adapter; only the surrounding implementation differs. Application code does not call these methods directly. It calls the parent Auth module, which calls the store.

## On This Page

- [Adapter Factory](#adapter-factory)
- [Store Contract](#store-contract)
- [`setupNewStore`](#setupnewstoreinstance)
- [`getSession`](#getsessioninstance-tenant_id-actor_id-token_key-token_secret_hash)
- [`listSessionsByActor`](#listsessionsbyactorinstance-tenant_id-actor_id)
- [`setSession`](#setsessioninstance-record)
- [`updateSessionActivity`](#updatesessionactivityinstance-tenant_id-actor_id-token_key-updates)
- [`deleteSession`](#deletesessioninstance-tenant_id-actor_id-token_key)
- [`deleteSessions`](#deletesessionsinstance-tenant_id-keys)
- [`cleanupExpiredSessions`](#cleanupexpiredsessionsinstance)

## Adapter Factory

```js
const factory = require('@superloomdev/js-server-helper-auth-store-dynamodb');
const store   = factory(Lib, CONFIG, ERRORS);
```

| Argument | Type | Purpose |
|---|---|---|
| `Lib` | Object | Dependency container. Reads `Lib.Utils` and `Lib.Debug` |
| `CONFIG` | Object | Merged Auth `CONFIG`. The factory reads `CONFIG.STORE_CONFIG` only. See [configuration.md](configuration.md) |
| `ERRORS` | Object | Auth's frozen error catalog. The adapter uses `ERRORS.SERVICE_UNAVAILABLE` and `ERRORS.NOT_IMPLEMENTED` |

The factory validates `CONFIG.STORE_CONFIG` and returns a Store interface. Each factory call returns an independent Store; multiple Auth instances (different `ACTOR_TYPE` values, different tables) coexist in the same process and share the same `Lib.DynamoDB` driver helper if it is the same instance.

The factory throws an `Error` if `STORE_CONFIG`, `STORE_CONFIG.table_name`, or `STORE_CONFIG.lib_dynamodb` is missing.

## Store Contract

All methods are async. All accept `instance` as the first argument (the per-request scope from `Lib.Instance.initialize()`). The Auth parent uses `instance.time` for current-time references and `instance.time_ms` for slow-query timing.

Methods return one of two shapes:

| Outcome | Shape |
|---|---|
| Success | `{ success: true, [data field]: <value>, error: null }` |
| Service unavailable | `{ success: false, [data field]: <empty>, error: ERRORS.SERVICE_UNAVAILABLE }` |
| Not implemented | `{ success: false, error: ERRORS.NOT_IMPLEMENTED }` (only for `setupNewStore`) |

The driver's underlying error is logged via `Lib.Debug.debug` with the operation name and driver-side error type. It is not surfaced to the caller. The Auth parent translates `ERRORS.SERVICE_UNAVAILABLE` into the appropriate response.

### `setupNewStore(instance)`

**Not implemented for DynamoDB.** Returns `NOT_IMPLEMENTED` error. The table must be provisioned out-of-band via IaC, AWS Console, or the driver helper's table-management API (if it gains one).

| Returns | Shape |
|---|---|
| Always | `{ success: false, error: ERRORS.NOT_IMPLEMENTED }` |

### `getSession(instance, tenant_id, actor_id, token_key, token_secret_hash)`

Performs a `GetItem` by composite primary key, then verifies the secret hash before returning the record.

| Returns | Shape |
|---|---|
| Item found and hash matches | `{ success: true, record: <record>, error: null }` |
| Item not found, **or** item exists but `token_secret_hash` mismatches | `{ success: true, record: null, error: null }` |
| Driver failure | `{ success: false, record: null, error: ERRORS.SERVICE_UNAVAILABLE }` |

**Wrong secret is intentionally indistinguishable from missing row.** The Auth module checks `record === null` and surfaces a generic authentication failure either way, which prevents timing-based enumeration of valid `token_key` values.

The Sort Key is computed as `` `${actor_id}#${token_key}` `` (stored as the `session_key` attribute). This is internal to the adapter; the returned record strips `session_key` so callers receive a clean canonical record.

### `listSessionsByActor(instance, tenant_id, actor_id)`

Returns every session for a `(tenant_id, actor_id)` pair using a `Query` with `begins_with(session_key, :prefix)`.

| Returns | Shape |
|---|---|
| Success | `{ success: true, records: [<record>, ...], error: null }` |
| Driver failure | `{ success: false, records: [], error: ERRORS.SERVICE_UNAVAILABLE }` |

Returns an empty array, not `null`, when no sessions exist.

The `begins_with` condition targets the Sort Key's prefix (`` `${actor_id}#` ``), so all sessions for the actor are returned in a single Query with no GSI required.

### `setSession(instance, record)`

Full UPSERT via `PutItem`. Overwrites the item entirely when the composite primary key collides.

| Returns | Shape |
|---|---|
| Success | `{ success: true, error: null }` |
| Driver failure | `{ success: false, error: ERRORS.SERVICE_UNAVAILABLE }` |

Unlike SQL adapters which use UPSERT with immutable-column exclusions, DynamoDB `PutItem` is a full-document replace. Immutability of creation metadata is the Auth parent's responsibility here, not the adapter's. The adapter simply writes whatever record the parent provides, adding the computed `session_key` Sort Key.

### `updateSessionActivity(instance, tenant_id, actor_id, token_key, updates)`

Partial update via `UpdateItem`. Only the supplied mutable fields are modified.

| Returns | Shape |
|---|---|
| `updates` is empty | `{ success: true, error: null }`. No round-trip |
| Success | `{ success: true, error: null }` |
| Driver failure | `{ success: false, error: ERRORS.SERVICE_UNAVAILABLE }` |

**Throws `TypeError` if `updates` contains any identity or primary-key field.** The blocked fields are `tenant_id`, `actor_id`, `actor_type`, `token_key`, `token_secret_hash`, `created_at`, `install_id`, `install_platform`, `install_form_factor`, `session_key`. The throw is intentional. The Auth parent never passes these; the guard exists so a regression surfaces immediately rather than silently rewriting identity columns or corrupting the composite Sort Key.

### `deleteSession(instance, tenant_id, actor_id, token_key)`

Deletes one session by its composite primary key via `DeleteItem`.

| Returns | Shape |
|---|---|
| Success (regardless of whether the item existed) | `{ success: true, error: null }` |
| Driver failure | `{ success: false, error: ERRORS.SERVICE_UNAVAILABLE }` |

Idempotent. Deleting a non-existent item reports success.

### `deleteSessions(instance, tenant_id, keys)`

Bulk delete via `BatchWriteItem`. `keys` is an array of `{ actor_id, token_key }` objects.

| Returns | Shape |
|---|---|
| `keys.length === 0` | `{ success: true, error: null }`. No round-trip |
| Success | `{ success: true, error: null }` |
| Driver failure | `{ success: false, error: ERRORS.SERVICE_UNAVAILABLE }` |

AWS limits `BatchWriteItem` to 25 items per call. The driver helper handles automatic chunking; the adapter builds the `keysByTable` map and delegates.

Used by the Auth parent's `revokeAllSessions` and install-id replacement paths.

### `cleanupExpiredSessions(instance)`

Sweeps expired items using Scan-then-batchDelete.

| Returns | Shape |
|---|---|
| Success | `{ success: true, deleted_count: <Number>, error: null }` |
| Driver failure (scan) | `{ success: false, deleted_count: 0, error: ERRORS.SERVICE_UNAVAILABLE }` |
| Driver failure (delete) | `{ success: false, deleted_count: 0, error: ERRORS.SERVICE_UNAVAILABLE }` |

Because DynamoDB does not support a single-shot DELETE by predicate, this method:
1. Scans the table with a `FilterExpression` on `expires_at < :now`
2. Calls `batchDeleteRecords` on the returned items

This is O(table-size). For large tables, enable DynamoDB native TTL on the `expires_at` attribute at the table level; the cleanup then happens automatically without scans. See [cleanup.md](cleanup.md) for details.
