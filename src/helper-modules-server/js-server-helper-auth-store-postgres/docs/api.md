# API

This adapter is loaded by the Auth parent module via the factory protocol. The parent calls these eight methods to satisfy its persistence requirements. This page documents the contract as implemented for PostgreSQL, with backend-specific semantics noted where they matter.

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
const factory = require('@superloomdev/js-server-helper-auth-store-postgres');
const store   = factory(Lib, CONFIG, ERRORS);
```

| Argument | Type | Purpose |
|---|---|---|
| `Lib` | Object | Dependency container. Reads `Lib.Utils` and `Lib.Debug` |
| `CONFIG` | Object | Merged Auth `CONFIG`. The factory reads `CONFIG.STORE_CONFIG` only. See [configuration.md](configuration.md) |
| `ERRORS` | Object | Auth's frozen error catalog. The adapter uses `ERRORS.SERVICE_UNAVAILABLE` only |

The factory validates `CONFIG.STORE_CONFIG` and returns a Store interface. Each factory call returns an independent Store; multiple Auth instances (different `ACTOR_TYPE` values, different tables) coexist in the same process.

The factory throws an `Error` if `STORE_CONFIG`, `STORE_CONFIG.table_name`, or `STORE_CONFIG.lib_sql` is missing.

## Store Contract

All methods are async. All accept `instance` as the first argument (the per-request scope from `Lib.Instance.initialize()`). The Auth parent uses `instance.time` for current-time references and `instance.time_ms` for slow-query timing.

Methods return one of two shapes:

| Outcome | Shape |
|---|---|
| Success | `{ success: true, [data field]: <value>, error: null }` |
| Service unavailable | `{ success: false, [data field]: <empty>, error: ERRORS.SERVICE_UNAVAILABLE }` |

The driver's underlying error is logged via `Lib.Debug.debug` with the SQL statement and driver-side type. It is not surfaced to the caller. The Auth parent translates `ERRORS.SERVICE_UNAVAILABLE` into the appropriate response.

### `setupNewStore(instance)`

Idempotent table and index setup. Issues two `CREATE ... IF NOT EXISTS` statements: the sessions table and the `expires_at` secondary index that powers `cleanupExpiredSessions`.

| Returns | Shape |
|---|---|
| Success | `{ success: true, error: null }` |
| Failure | `{ success: false, error: ERRORS.SERVICE_UNAVAILABLE }` |

Safe to call on every application boot. The full DDL is documented in [schema.md](schema.md).

### `getSession(instance, tenant_id, actor_id, token_key, token_secret_hash)`

Reads a single session by its composite primary key, then verifies the secret hash before returning the record.

| Returns | Shape |
|---|---|
| Session found and hash matches | `{ success: true, record: <record>, error: null }` |
| Session not found, **or** session exists but `token_secret_hash` mismatches | `{ success: true, record: null, error: null }` |
| Driver failure | `{ success: false, record: null, error: ERRORS.SERVICE_UNAVAILABLE }` |

**Wrong secret is intentionally indistinguishable from missing row.** The Auth module checks `record === null` and surfaces a generic authentication failure either way, which prevents timing-based enumeration of valid `token_key` values. The hash compare is a direct string comparison; the compare is fast because the secret-hash space is large enough that timing variance on the compare itself is negligible relative to the network round-trip.

### `listSessionsByActor(instance, tenant_id, actor_id)`

Returns every session row for a `(tenant_id, actor_id)` pair. Single index range read on the composite primary key.

| Returns | Shape |
|---|---|
| Success | `{ success: true, records: [<record>, ...], error: null }` |
| Driver failure | `{ success: false, records: [], error: ERRORS.SERVICE_UNAVAILABLE }` |

Returns an empty array, not `null`, when no sessions exist.

### `setSession(instance, record)`

Full UPSERT. Inserts the record, or replaces every mutable column when the composite primary key collides.

| Returns | Shape |
|---|---|
| Success | `{ success: true, error: null }` |
| Driver failure | `{ success: false, error: ERRORS.SERVICE_UNAVAILABLE }` |

The UPSERT uses `INSERT ... ON CONFLICT (tenant_id, actor_id, token_key) DO UPDATE SET col = EXCLUDED.col`. Identity and per-install fields are excluded from the `DO UPDATE` clause so re-inserts cannot tamper with the original creation metadata. The full immutability rules are documented in [schema.md](schema.md).

### `updateSessionActivity(instance, tenant_id, actor_id, token_key, updates)`

Partial `UPDATE` for the mutable per-session fields: `last_active_at`, `expires_at`, `push_provider`, `push_token`, `client_*`, `custom_data`, `refresh_token_hash`, `refresh_family_id`.

| Returns | Shape |
|---|---|
| `updates` is empty | `{ success: true, error: null }`. No round-trip |
| Success | `{ success: true, error: null }` |
| Driver failure | `{ success: false, error: ERRORS.SERVICE_UNAVAILABLE }` |

**Throws `TypeError` if `updates` contains any identity or primary-key field.** The blocked fields are `tenant_id`, `actor_id`, `actor_type`, `token_key`, `token_secret_hash`, `created_at`, `install_id`, `install_platform`, `install_form_factor`. The throw is intentional. The Auth parent never passes these; the guard exists so a regression in the parent surfaces immediately rather than silently rewriting identity columns.

### `deleteSession(instance, tenant_id, actor_id, token_key)`

Deletes one session by its composite primary key.

| Returns | Shape |
|---|---|
| Success (regardless of whether the row existed) | `{ success: true, error: null }` |
| Driver failure | `{ success: false, error: ERRORS.SERVICE_UNAVAILABLE }` |

Idempotent. Deleting a non-existent row reports success.

### `deleteSessions(instance, tenant_id, keys)`

Bulk delete. `keys` is an array of `{ actor_id, token_key }` objects. Issues one `DELETE` with a single `WHERE tenant_id = ? AND ((actor_id = ? AND token_key = ?) OR (...) OR (...))` clause, so the round-trip cost is constant regardless of the number of sessions evicted.

| Returns | Shape |
|---|---|
| `keys.length === 0` | `{ success: true, error: null }`. No round-trip |
| Success | `{ success: true, error: null }` |
| Driver failure | `{ success: false, error: ERRORS.SERVICE_UNAVAILABLE }` |

Used by the Auth parent's `revokeAllSessions` and install-id replacement paths.

### `cleanupExpiredSessions(instance)`

Sweeps every row whose `expires_at` is in the past relative to `instance.time`. Uses the `expires_at` index for an efficient range scan.

| Returns | Shape |
|---|---|
| Success | `{ success: true, deleted_count: <Number>, error: null }` |
| Driver failure | `{ success: false, deleted_count: 0, error: ERRORS.SERVICE_UNAVAILABLE }` |

PostgreSQL has no native TTL, so this is the only path for expired-row deletion. See [cleanup.md](cleanup.md) for the recommended scheduling mechanism.
