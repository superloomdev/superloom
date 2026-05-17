# API

This adapter is loaded by the Auth parent module via the factory protocol. The parent calls these methods to satisfy its persistence requirements. This page documents the contract as implemented for MongoDB, with backend-specific semantics noted where they matter.

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
const factory = require('@superloomdev/js-server-helper-auth-store-mongodb');
const store   = factory(Lib, CONFIG, ERRORS);
```

| Argument | Type | Purpose |
|---|---|---|
| `Lib` | Object | Dependency container. Reads `Lib.Utils` and `Lib.Debug` |
| `CONFIG` | Object | Merged Auth `CONFIG`. The factory reads `CONFIG.STORE_CONFIG` only. See [configuration.md](configuration.md) |
| `ERRORS` | Object | Auth's frozen error catalog. The adapter uses `ERRORS.SERVICE_UNAVAILABLE` and `ERRORS.NOT_IMPLEMENTED` |

The factory validates `CONFIG.STORE_CONFIG` and returns a Store interface. Each factory call returns an independent Store; multiple Auth instances (different `ACTOR_TYPE` values, different collections) coexist in the same process.

The factory throws an `Error` if `STORE_CONFIG`, `STORE_CONFIG.collection_name`, or `STORE_CONFIG.lib_mongodb` is missing.

## Store Contract

All methods are async. All accept `instance` as the first argument (the per-request scope from `Lib.Instance.initialize()`). The Auth parent uses `instance.time` for current-time references and `instance.time_ms` for slow-query timing.

Methods return one of two shapes:

| Outcome | Shape |
|---|---|
| Success | `{ success: true, [data field]: <value>, error: null }` |
| Failure | `{ success: false, [data field]: <empty>, error: <ERROR> }` |

The driver's underlying error is logged via `Lib.Debug.debug` with the failing call and the driver-side error type. It is not surfaced to the caller. The Auth parent translates `ERRORS.SERVICE_UNAVAILABLE` into the appropriate response.

### `setupNewStore(instance)`

**Not implemented.** This adapter does not manage its own schema. MongoDB auto-creates the collection on the first write, and indexes are provisioned out-of-band by the operator.

| Returns | Shape |
|---|---|
| Always | `{ success: false, error: ERRORS.NOT_IMPLEMENTED }` |

Application code that runs against multiple `auth-store-*` backends must handle the `NOT_IMPLEMENTED` envelope on this backend; do not assume the call succeeds. The Auth parent treats `NOT_IMPLEMENTED` as a soft failure: it logs the result and continues, on the assumption that the operator has provisioned indexes out-of-band. See [schema.md](schema.md) for the indexes the operator must create.

### `getSession(instance, tenant_id, actor_id, token_key, token_secret_hash)`

Reads a single session by its composite `_id`. The token-secret hash is part of the key, so a wrong hash naturally produces a miss.

| Returns | Shape |
|---|---|
| Session found and hash matches | `{ success: true, record: <record>, error: null }` |
| Session not found, **or** session exists but `token_secret_hash` mismatches | `{ success: true, record: null, error: null }` |
| Driver failure | `{ success: false, record: null, error: ERRORS.SERVICE_UNAVAILABLE }` |

**Wrong secret is intentionally indistinguishable from missing document.** The composite `_id` is `"<tenant_id>#<actor_id>#<token_key>#<token_secret_hash>"`. A caller supplying a wrong hash constructs a different `_id` string; MongoDB's default `_id` index returns null with no extra read and no timing variance from a separate hash compare. The Auth module checks `record === null` and surfaces a generic authentication failure either way, which prevents timing-based enumeration of valid `token_key` values.

The returned record is the document with `_id` and `prefix` stripped (those are adapter-managed fields, not part of the canonical record shape).

### `listSessionsByActor(instance, tenant_id, actor_id)`

Returns every session document for a `(tenant_id, actor_id)` pair. Uses equality on the indexed `prefix` field.

| Returns | Shape |
|---|---|
| Success | `{ success: true, records: [<record>, ...], error: null }` |
| Driver failure | `{ success: false, records: null, error: ERRORS.SERVICE_UNAVAILABLE }` |

The `prefix` field is denormalized on every document at write time (value: `"<tenant_id>#<actor_id>#"`). Equality on this field hits the operator-provisioned B-tree index directly. Without the `prefix` index this call degenerates to a collection scan, so the index is **required** for production use; see [schema.md](schema.md).

The returned records have `_id` and `prefix` stripped.

### `setSession(instance, record)`

Full-document upsert via `replaceOne` with `upsert: true`. Inserts the document, or replaces every field when the composite `_id` collides.

| Returns | Shape |
|---|---|
| Success | `{ success: true, error: null }` |
| Driver failure | `{ success: false, error: ERRORS.SERVICE_UNAVAILABLE }` |

The adapter computes `_id` and `prefix` from the record's identity fields, merges them in front of the canonical record, and writes the whole document. **No read-then-merge.** Unlike the Postgres adapter (which excludes identity and per-install fields from its `DO UPDATE` clause), the MongoDB adapter does not enforce UPSERT-immutability at the adapter level. The Auth parent ensures consistency by always passing the original `created_at`, `install_id`, `install_platform`, and `install_form_factor` values on every `setSession` call for the same session.

Callers that bypass the Auth parent and invoke this method directly must respect that contract.

### `updateSessionActivity(instance, tenant_id, actor_id, token_key, updates)`

Partial `$set` update on the mutable per-session fields: `last_active_at`, `expires_at`, `push_provider`, `push_token`, `client_*`, `custom_data`, `refresh_token_hash`, `refresh_family_id`.

| Returns | Shape |
|---|---|
| `updates` is empty | `{ success: true, error: null }`. No round-trip |
| Success | `{ success: true, error: null }` |
| Driver failure | `{ success: false, error: ERRORS.SERVICE_UNAVAILABLE }` |

**Throws `TypeError` if `updates` contains any identity or adapter-managed field.** The blocked keys are `tenant_id`, `actor_id`, `actor_type`, `token_key`, `token_secret_hash`, `created_at`, `install_id`, `install_platform`, `install_form_factor`, `_id`, and `prefix`. The two MongoDB-specific fields (`_id`, `prefix`) are added to the blocklist because mutating them would break document identity. The throw is intentional; the Auth parent never passes these, and the guard exists so a regression surfaces immediately.

The caller supplies `(tenant_id, actor_id, token_key)` but not the hash. The adapter builds an anchored prefix regex (`new RegExp('^' + escapeRegExp(tenant_id + '#' + actor_id + '#' + token_key + '#'))`) and runs `updateOne` against the matching document. Regex metacharacters in the identifier values are escaped automatically. At most one document matches, since `(tenant_id, actor_id, token_key)` uniquely identifies a session.

### `deleteSession(instance, tenant_id, actor_id, token_key)`

Deletes one session document by anchored prefix regex on `_id`.

| Returns | Shape |
|---|---|
| Success (regardless of whether the document existed) | `{ success: true, error: null }` |
| Driver failure | `{ success: false, error: ERRORS.SERVICE_UNAVAILABLE }` |

Idempotent. Deleting a non-existent document reports success. The driver's `deleteRecordsByFilter` returns success even when zero documents match.

### `deleteSessions(instance, tenant_id, keys)`

Bulk delete. `keys` is an array of `{ actor_id, token_key }` objects. Issues one `deleteMany` with an `$or` of anchored prefix regexes, so the round-trip cost is constant regardless of the number of sessions evicted.

| Returns | Shape |
|---|---|
| `keys.length === 0` | `{ success: true, error: null }`. No round-trip |
| Success | `{ success: true, error: null }` |
| Driver failure | `{ success: false, error: ERRORS.SERVICE_UNAVAILABLE }` |

Used by the Auth parent's `revokeAllSessions` and install-id replacement paths.

### `cleanupExpiredSessions(instance)`

Sweeps every document whose `expires_at` is in the past relative to `instance.time`. Uses `deleteMany({ expires_at: { $lt: now } })`.

| Returns | Shape |
|---|---|
| Success | `{ success: true, deleted_count: <Number>, error: null }` |
| Driver failure | `{ success: false, deleted_count: 0, error: ERRORS.SERVICE_UNAVAILABLE }` |

`deleted_count` is taken from the driver's `deletedCount`. Without an operator-provisioned `expires_at` secondary index, this call is a collection scan; the index makes the sweep proportional to the number of expired documents instead of the total document count. See [cleanup.md](cleanup.md) for the recommended scheduling mechanism and the alternative Date-field + TTL-index path.
