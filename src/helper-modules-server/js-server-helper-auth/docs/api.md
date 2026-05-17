# API Reference. `js-server-helper-auth`

Every exported function on the public interface, with parameters, return shape, and notes. For loader semantics and configuration keys see [Configuration](configuration.md). For the canonical session-record shape and per-field design rationale see [Data Model](data-model.md). For backend selection see the [Storage Adapters](../README.md#storage-adapters) section in the module README; for per-backend `STORE_CONFIG` shape see each adapter package's own README.

## On This Page

- [Conventions](#conventions)
- [The Response Envelope](#the-response-envelope)
- [Session Lifecycle](#session-lifecycle)
- [Session Inventory](#session-inventory)
- [Push Notification Hooks](#push-notification-hooks)
- [Operational Functions](#operational-functions)
- [Pure Helpers](#pure-helpers)
- [JWT-Mode Functions](#jwt-mode-functions)
- [Error Catalog](#error-catalog)

---

## Conventions

| Pattern | Behaviour |
|---|---|
| **`instance` is always the first argument** | Every operation receives the per-request lifecycle object returned by `Lib.Instance.initialize()`. The module reads `instance.time` for timestamps, calls `Lib.Debug.performanceAuditLog` against `instance.time_ms` on every store call, and (for cookie-driven flows) reads `instance.http_request` and writes through `instance.http_response` |
| **Never throws on operational failures** | HTTP errors, store driver failures, expired tokens, malformed tokens, cap rejections, and mismatched actor types all return `{ success: false, error }`. The only thrown errors are `TypeError`s on **programmer** mistakes (missing required option, reserved characters in `actor_id`, identity-field mutation) which surface in development |
| **`success` is the discriminator** | Branch once on `result.success`. On success, read the named fields (`session`, `auth_id`, `access_token`, etc.). On failure, read `result.error.type` and `result.error.message` |
| **One instance per `actor_type`** | The Auth instance is bound to the `ACTOR_TYPE` it was constructed with. Sessions stored under another `actor_type` are rejected by `verifySession` with `ACTOR_TYPE_MISMATCH` even when the token is otherwise valid |
| **Multi-tenant scoping is mandatory** | Every function that reads or writes the store requires `tenant_id`. There is no cross-tenant query path |

---

## The Response Envelope

Every async function resolves to an object with this shape (named fields vary by function):

| Field | Type | Description |
|---|---|---|
| `success` | `boolean` | `true` on success. `false` on any operational failure |
| `error` | `object \| null` | `{ type, message }` on failure. `null` on success. See [Error Catalog](#error-catalog) |
| `session` | `object` | Canonical session record (on success, where applicable). See [Data Model → Record Fields](data-model.md#record-fields) |
| `auth_id` | `string` | Wire-format token (on `createSession`). See [Pure Helpers](#pure-helpers) |
| `sessions` | `array` | Array of canonical records (on list functions) |
| `count` | `number` | Count (on `countSessions`) |
| `targets` | `array` | Subset of sessions with `push_provider` and `push_token` set |
| `removed_count` / `deleted_count` | `number` | Number of records affected |
| `access_token` / `refresh_token` | `string` | JWT-mode credentials |
| `claims` | `object` | Decoded JWT claims (on `verifyJwt`) |

---

## Session Lifecycle

### `createSession(instance, options)` *(async)*

Validates options, runs the limit policy (list-then-filter), batch-deletes evicted sessions, inserts the new session record, and writes the cookie. In JWT mode also mints and returns the access and refresh tokens.

| Option | Type | Required | Description |
|---|---|---|---|
| `tenant_id` | `string` | Yes | Tenant scoping key. All store queries are scoped to this value |
| `actor_id` | `string` | Yes | The authenticating actor. Reserved characters `-` and `#` are forbidden and throw `TypeError` |
| `install_id` | `string` | No | Device or browser install identifier. When supplied and matching an existing session, that session is replaced atomically regardless of caps |
| `install_platform` | `string` | Yes | One of `'web'`, `'ios'`, `'android'`, `'macos'`, `'windows'`, `'linux'`, `'other'`. Used by `LIMITS.by_platform_max` |
| `install_form_factor` | `string` | Yes | One of `'desktop'`, `'mobile'`, `'tablet'`, `'tv'`, `'watch'`, `'other'`. Used by `LIMITS.by_form_factor_max` |
| `client_name` | `string` | No | Browser or app name |
| `client_version` | `string` | No | Browser or app version |
| `client_is_browser` | `boolean` | No | `true` for browser sessions |
| `client_os_name` | `string` | No | OS name |
| `client_os_version` | `string` | No | OS version |
| `client_screen_w` | `number` | No | Screen width in logical pixels |
| `client_screen_h` | `number` | No | Screen height in logical pixels |
| `client_ip_address` | `string` | No | IPv4 or IPv6 of the request origin |
| `client_user_agent` | `string` | No | HTTP `User-Agent` at login time |
| `custom_data` | `object` | No | Arbitrary JSON stored verbatim with the session |

**Returns** `{ success, session, auth_id, error }` in DB mode. In JWT mode also `{ access_token, refresh_token }`.

Possible errors: `LIMIT_REACHED` (when caps are hit and `LIMITS.evict_oldest_on_limit` is `false`), `SERVICE_UNAVAILABLE` (store failure).

### `verifySession(instance, options)` *(async)*

Extracts the token from `Authorization: Bearer` header or the cookie, looks up the session, checks expiry, throttle-refreshes `last_active_at`, and hydrates `instance.session`.

| Option | Type | Required | Description |
|---|---|---|---|
| `tenant_id` | `string` | Yes | Must match the session record |
| `auth_id` | `string` | No | Override the token source. When supplied, the module verifies this token directly instead of reading the request |

Token-source priority (when `auth_id` is not supplied): `Authorization: Bearer <token>` header → cookie named `${COOKIE_PREFIX}${tenant_id}`.

**Side effect.** On success, sets `instance.session` to the canonical record so downstream code can use it without another lookup. The throttled `last_active_at` refresh runs as a background routine on `Lib.Instance` so it does not block the response.

**Returns** `{ success, session, error }`.

Possible errors: `INVALID_TOKEN` (malformed token, missing row, wrong secret), `SESSION_EXPIRED`, `ACTOR_TYPE_MISMATCH`, `SERVICE_UNAVAILABLE`.

### `removeSession(instance, options)` *(async)*

Deletes one session row and clears the cookie. Idempotent: a missing session is still `{ success: true }`.

| Option | Type | Required | Description |
|---|---|---|---|
| `tenant_id` | `string` | Yes | |
| `actor_id` | `string` | Yes | |
| `token_key` | `string` | Yes | The 16-char identifier portion of the session (not the full `auth_id`) |

**Returns** `{ success, error }`.

### `removeOtherSessions(instance, options)` *(async)*

"Log out everywhere else." Deletes every session for the actor **except** the one identified by `keep_token_key`. Useful after a password reset where the current device should stay logged in.

| Option | Type | Required | Description |
|---|---|---|---|
| `tenant_id` | `string` | Yes | |
| `actor_id` | `string` | Yes | |
| `keep_token_key` | `string` | Yes | The session to preserve |

**Returns** `{ success, removed_count, error }`.

### `removeAllSessions(instance, options)` *(async)*

Deletes every session for the actor. Used by account-compromise flows. Also clears the cookie.

| Option | Type | Required | Description |
|---|---|---|---|
| `tenant_id` | `string` | Yes | |
| `actor_id` | `string` | Yes | |

**Returns** `{ success, removed_count, error }`.

---

## Session Inventory

### `listSessions(instance, options)` *(async)*

Returns every active session for the actor. Expired sessions are filtered out. Used to power the "Active devices" UI.

| Option | Type | Required | Description |
|---|---|---|---|
| `tenant_id` | `string` | Yes | |
| `actor_id` | `string` | Yes | |

**Returns** `{ success, sessions, error }`. `sessions` is an array of canonical session records.

### `countSessions(instance, options)` *(async)*

Convenience function returning the count of active sessions. Internally delegates to `listSessions` and returns the array length, so expired sessions are excluded.

| Option | Type | Required | Description |
|---|---|---|---|
| `tenant_id` | `string` | Yes | |
| `actor_id` | `string` | Yes | |

**Returns** `{ success, count, error }`.

---

## Push Notification Hooks

The three push functions let a future `js-server-helper-push` module fan out notifications without maintaining its own device table. See [Push Notifications](push-notifications.md) for the full contract.

### `attachDeviceToSession(instance, options)` *(async)*

Binds a push token to an existing session. Partial update: only `push_provider` and `push_token` are touched on the record.

| Option | Type | Required | Description |
|---|---|---|---|
| `tenant_id` | `string` | Yes | |
| `actor_id` | `string` | Yes | |
| `token_key` | `string` | Yes | |
| `push_provider` | `string` | Yes | Provider identifier. Opaque to auth (e.g. `'apns'`, `'fcm'`, `'webpush'`, `'expo'`) |
| `push_token` | `string` | Yes | Provider-specific device registration token |

**Returns** `{ success, error }`.

### `detachDeviceFromSession(instance, options)` *(async)*

Clears `push_provider` and `push_token` on the session. The session itself remains valid.

| Option | Type | Required | Description |
|---|---|---|---|
| `tenant_id` | `string` | Yes | |
| `actor_id` | `string` | Yes | |
| `token_key` | `string` | Yes | |

**Returns** `{ success, error }`.

### `listPushTargetsByActor(instance, options)` *(async)*

Returns every active session for the actor that has both `push_provider` and `push_token` set. Expired and unregistered sessions are filtered out automatically.

| Option | Type | Required | Description |
|---|---|---|---|
| `tenant_id` | `string` | Yes | |
| `actor_id` | `string` | Yes | |

**Returns** `{ success, targets, error }`. `targets` is the same shape as `listSessions.sessions`, just filtered to push-ready rows.

---

## Operational Functions

### `setupNewStore(instance)` *(async)*

Idempotent schema setup for SQL backends. Issues `CREATE TABLE IF NOT EXISTS` plus a `CREATE INDEX IF NOT EXISTS` on `expires_at`. Safe to call on every boot.

NoSQL backends (`auth-store-mongodb`, `auth-store-dynamodb`) do **not** implement this method. Calling it throws `TypeError`. Provision the collection or table and any required secondary indexes or native TTL out-of-band via IaC or a one-shot script.

**Returns** `{ success, error }`.

### `cleanupExpiredSessions(instance)` *(async)*

Sweeps expired sessions across the chosen backend. Required on SQL (no native TTL). Required on MongoDB (the module stores `expires_at` as an integer, not the `Date` MongoDB TTL requires). Required on DynamoDB unless native TTL on the `expires_at` attribute was enabled out-of-band. Recommended frequency: once per day via cron or EventBridge.

**Returns** `{ success, deleted_count, error }`.

---

## Pure Helpers

Synchronous, side-effect-free, do not touch the store. Useful for token introspection in middleware that does not need a database round-trip.

### `createAuthId({ actor_id, token_key, token_secret })`

Builds the wire-format `auth_id`. Throws `TypeError` if `actor_id` contains the reserved characters `-` or `#`.

| Param | Type | Description |
|---|---|---|
| `actor_id` | `string` | The owning actor |
| `token_key` | `string` | Random 16-char hex (created internally by `createSession`) |
| `token_secret` | `string` | Random 32-char hex (created internally by `createSession`; only the SHA-256 hash is stored) |

**Returns** the string `"{actor_id}-{token_key}-{token_secret}"`.

### `parseAuthId(auth_id)`

Inverse of `createAuthId`. Returns `{ actor_id, token_key, token_secret }` on a well-formed input, or `null` when the input does not parse.

**Returns** `{ actor_id, token_key, token_secret }` or `null`.

---

## JWT-Mode Functions

These functions are inert in DB mode. They become available when `CONFIG.ENABLE_JWT: true`. See [Configuration → JWT mode](configuration.md#jwt-mode) for the required keys.

### `verifyJwt(instance, options)` *(sync)*

Stateless verification of an access token. Decodes the header and payload, checks the HS256 signature, the expiry, the issuer, the audience, and the `ACTOR_TYPE`. **No store read.** Used inside HTTP authorizers and on every request in JWT mode.

| Option | Type | Required | Description |
|---|---|---|---|
| `jwt` | `string` | Yes | Compact JWS string |

**Returns** `{ success, claims, error }`. On success, `claims` contains `iss`, `aud`, `iat`, `exp`, `jti`, `sub`, `atp` (actor type), `tid` (tenant), `ikd` (install kind), `tkk` (token key).

Possible errors: `INVALID_TOKEN`, `SESSION_EXPIRED`, `ACTOR_TYPE_MISMATCH`.

### `signSessionJwt(instance, options)` *(sync)*

Mints a fresh access JWT for an existing session record. Useful after a successful `verifySession` when the application wants to issue an access token without going through the full refresh flow.

| Option | Type | Required | Description |
|---|---|---|---|
| `session` | `object` | Yes | A canonical session record (e.g. from `verifySession` or `listSessions`) |

**Returns** `{ success, access_token, error }`.

### `refreshSessionJwt(instance, options)` *(async)*

Exchanges a refresh token for a new access-and-refresh token pair. The old refresh token is invalidated by hash rotation (single-use, RFC 6819). The session's `expires_at` is rolled forward by `TTL_SECONDS`.

| Option | Type | Required | Description |
|---|---|---|---|
| `tenant_id` | `string` | Yes | Refresh tokens are tenant-scoped |
| `refresh_token` | `string` | Yes | Wire format: `{actor_id}-{token_key}-{refresh_secret}` |

**Returns** `{ success, session, access_token, refresh_token, error }`.

Possible errors: `INVALID_TOKEN` (malformed, expired, or already-used refresh token), `SESSION_EXPIRED`, `SERVICE_UNAVAILABLE`.

---

## Error Catalog

All operational errors are frozen objects from `auth.errors.js` with shape `{ type: string, message: string }`. The `type` is the programmatic discriminator; `message` is human-readable.

| `error.type` | Returned by | Meaning |
|---|---|---|
| `AUTH_SERVICE_UNAVAILABLE` | Every store-touching function | Store driver reported an error |
| `AUTH_LIMIT_REACHED` | `createSession` | A configured cap was hit and `LIMITS.evict_oldest_on_limit` is `false` |
| `AUTH_INVALID_TOKEN` | `verifySession`, `verifyJwt`, `refreshSessionJwt` | Malformed token, wrong secret, missing row, or replayed refresh token |
| `AUTH_SESSION_EXPIRED` | `verifySession`, `verifyJwt`, `refreshSessionJwt` | `expires_at` is in the past |
| `AUTH_ACTOR_TYPE_MISMATCH` | `verifySession`, `verifyJwt` | Stored `actor_type` does not match `CONFIG.ACTOR_TYPE` |
| `NOT_IMPLEMENTED` | `setupNewStore` on NoSQL backends | The operation has no meaning on this backend; provision the schema out-of-band |

> **Programmer errors throw.** Invalid `STORE_CONFIG` shape at loader time, mutation of identity fields, and reserved characters in `actor_id` throw `TypeError` immediately. The catalog above only covers operational failures.
