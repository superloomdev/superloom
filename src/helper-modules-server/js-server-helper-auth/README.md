# @superloomdev/js-server-helper-auth

[![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-brightgreen.svg)](https://nodejs.org)

Session lifecycle and authentication for Superloom applications. One loader call returns one independent Auth instance bound to one `actor_type`, one storage backend, and one configuration — enabling distinct session policies per user kind within the same process.

Storage adapters are standalone packages. Install only the one you need. Optional JWT mode (HS256) adds stateless access token verification with single-use rotating refresh tokens (RFC 6819).

**Further reading:**
- [`docs/data-model.md`](docs/data-model.md) — Session record fields and design rationale.
- [`docs/integration-express.md`](docs/integration-express.md) — Express bootstrap, middleware, login/refresh/logout endpoints.
- [`docs/integration-lambda.md`](docs/integration-lambda.md) — Per-entity Lambda + JWT authorizer pattern.
- [`docs/push-notifications.md`](docs/push-notifications.md) — Push token contract for push fan-out.

## Install

```bash
# Install auth + one store adapter (choose the adapter for your backend)
npm install @superloomdev/js-server-helper-auth \
            @superloomdev/js-server-helper-auth-store-postgres
```

Available adapters:

| Backend | Adapter package |
|---|---|
| SQLite (offline / embedded) | `@superloomdev/js-server-helper-auth-store-sqlite` |
| PostgreSQL | `@superloomdev/js-server-helper-auth-store-postgres` |
| MySQL / MariaDB | `@superloomdev/js-server-helper-auth-store-mysql` |
| MongoDB | `@superloomdev/js-server-helper-auth-store-mongodb` |
| AWS DynamoDB | `@superloomdev/js-server-helper-auth-store-dynamodb` |

## How It Works

### Architecture

Auth is a **factory module**: each `require()(Lib, config)` call returns a fully independent Auth interface bound to one actor type, one store, and one configuration. Multiple instances co-exist in the same process — they share no state.

```
Auth instance
 ├─ CONFIG.STORE   (store adapter factory, e.g. require('...auth-store-postgres'))
 ├─ CONFIG.STORE_CONFIG  (table_name / collection_name + lib_sql / lib_mongodb / lib_dynamodb)
 ├─ CONFIG.ACTOR_TYPE    ('user', 'admin', 'merchant', ...)
 ├─ Parts (pure stateless helpers: policy, auth-id, cookie, jwt, ...)
 └─ Store (instantiated from CONFIG.STORE; reads/writes sessions)
```

`CONFIG.STORE` is the adapter factory function — it receives `(Lib, CONFIG, ERRORS)` and returns the 8-method store interface. You pass the factory directly (the same pattern as passing `Lib.Postgres` or `Lib.MongoDB` to other helpers):

```js
STORE: require('@superloomdev/js-server-helper-auth-store-postgres')
```

### Adapter Factory Protocol

Every store adapter (and every internal `parts/` helper) uses the same uniform factory signature:

```
factory(Lib, CONFIG, ERRORS) → interface
```

- **`Lib`** — a narrowed dependency container `{ Utils, Debug, Crypto, Instance }` built by the auth loader. Adapters receive this full narrowed `Lib` and extract only what they need.
- **`CONFIG`** — the merged auth configuration. Adapters extract their slice internally via `CONFIG.STORE_CONFIG` — they do not require the caller to pre-extract it.
- **`ERRORS`** — the frozen auth error catalog (`auth.errors.js`). Adapters use these catalog objects directly in their return envelopes so error shapes are consistent regardless of which backend is in use.

This convention means: adding a new store adapter or a new `parts/` helper never requires changing the call-site signature. The adapter is responsible for pulling out exactly what it needs.

**Terminology:** when adapters handle database backends they are called **stores** (prefixed `auth-store-*`). The general concept is **adapters** — a future non-database adapter (e.g. an HTTP-backed token store) would not use the `store` prefix.

### Session Lifecycle

1. **`createSession`** — Validates options, runs the limit policy (list-then-filter), batch-deletes evicted sessions, inserts the new session record, sets the cookie.
2. **`verifySession`** — Extracts the token from `Authorization: Bearer` header or cookie; looks up the session; checks expiry; updates `last_active_at` (throttled); hydrates `instance.session`.
3. **`removeSession` / `removeOtherSessions` / `removeAllSessions`** — Delete one, all-except-current, or all sessions; clear cookie.

### Token Format

An auth token (`auth_id`) is a URL-safe string with three segments:

```
{actor_id}-{token_key}-{token_secret}
```

- `actor_id` — the owning actor (URL-safe, required)
- `token_key` — a random 16-char hex string identifying the session row
- `token_secret` — a random 32-char hex string; only its SHA-256 hash is stored

The store only ever stores `token_secret_hash`. A wrong secret returns the same "not found" response as a missing row — no timing oracle.

### Multi-Tenancy

Every session record carries `tenant_id`. All queries are scoped to `(tenant_id, actor_id, ...)`. Tenants are completely isolated within a single table/collection.

## Quick Start

```js
// loader.js
const Lib = {};
Lib.Utils    = require('@superloomdev/js-helper-utils')(Lib, {});
Lib.Debug    = require('@superloomdev/js-helper-debug')(Lib, {});
Lib.Crypto   = require('@superloomdev/js-server-helper-crypto')(Lib, {});
Lib.Instance = require('@superloomdev/js-server-helper-instance')(Lib, {});

// Wire up the DB helper (example: Postgres)
Lib.Postgres = require('@superloomdev/js-server-helper-sql-postgres')(Lib, {
  HOST: process.env.DB_HOST,
  DATABASE: process.env.DB_NAME,
  USER: process.env.DB_USER,
  PASSWORD: process.env.DB_PASSWORD
});

// One Auth instance per actor_type
Lib.AuthUser = require('@superloomdev/js-server-helper-auth')(Lib, {
  STORE: require('@superloomdev/js-server-helper-auth-store-postgres'),
  STORE_CONFIG: { table_name: 'sessions_user', lib_sql: Lib.Postgres },
  ACTOR_TYPE: 'user',
  TTL_SECONDS: 2592000,          // 30 days
  LIMITS: {
    total_max: 20,
    evict_oldest_on_limit: true
  },
  COOKIE_PREFIX: 'sl_user_'
});

// One-time schema setup at boot (SQL backends only)
await Lib.AuthUser.setupNewStore(Lib.Instance.initialize());
```

```js
// Login endpoint
const result = await Lib.AuthUser.createSession(instance, {
  tenant_id:           req.body.tenant_id,
  actor_id:            user.id,
  install_id:          req.body.install_id,       // optional; enables same-device replacement
  install_platform:    'web',
  install_form_factor: 'desktop',
  client_name:         'Chrome',
  client_version:      '124.0',
  client_is_browser:   true,
  client_user_agent:   req.headers['user-agent'],
  client_ip_address:   req.ip
});
if (!result.success) { return res.status(401).json(result.error); }
// result.session  — the full session record
// result.auth_id  — wire token; send via cookie or response body
```

```js
// Auth middleware
const result = await Lib.AuthUser.verifySession(instance, {
  tenant_id: req.params.tenant_id
  // token is read automatically from Authorization: Bearer or cookie
});
if (!result.success) { return res.status(401).json(result.error); }
// instance.session is now populated
```

## Configuration

All keys are merged over the module defaults. Keys marked **Required** throw at loader time if absent.

| Key | Type | Default | Description |
|---|---|---|---|
| `STORE` | `Function` | — | **Required.** Store adapter factory: `require('@superloomdev/js-server-helper-auth-store-*')`. |
| `STORE_CONFIG` | `Object` | — | **Required.** Adapter-specific config. Shape varies by backend (see [Store Adapters](#store-adapters) below). |
| `ACTOR_TYPE` | `String` | — | **Required.** Non-empty string naming the kind of actor (`'user'`, `'admin'`, `'merchant'`). Stamped on every record and verified on every read. |
| `TTL_SECONDS` | `Number` | `2592000` (30 days) | Session lifetime in seconds. Rolls forward by `TTL_SECONDS` on each throttled activity refresh. |
| `LAST_ACTIVE_UPDATE_INTERVAL_SECONDS` | `Number` | `600` (10 min) | Minimum gap between `last_active_at` write-backs. Prevents one DB write per request on busy actors. |
| `LIMITS.total_max` | `Number` | `20` | Hard cap on total active sessions per actor per tenant. |
| `LIMITS.by_form_factor_max` | `Object\|null` | `null` | Per-form-factor cap map, e.g. `{ mobile: 3 }`. `null` = unlimited. Partial maps cap only listed keys. |
| `LIMITS.by_platform_max` | `Object\|null` | `null` | Per-platform cap map, e.g. `{ ios: 2, android: 2 }`. |
| `LIMITS.evict_oldest_on_limit` | `Boolean` | `true` | `true` = evict LRU session within violated tier. `false` = return `LIMIT_REACHED`. |
| `ENABLE_JWT` | `Boolean` | `false` | Enable JWT mode. Requires `JWT.*` to be configured. |
| `JWT.signing_key` | `String` | `null` | **Required when `ENABLE_JWT: true`.** HS256 key, minimum 32 characters. |
| `JWT.algorithm` | `String` | `'HS256'` | Signing algorithm. |
| `JWT.issuer` | `String` | `null` | **Required when `ENABLE_JWT: true`.** JWT `iss` claim. |
| `JWT.audience` | `String` | `null` | **Required when `ENABLE_JWT: true`.** JWT `aud` claim. |
| `JWT.access_token_ttl_seconds` | `Number` | `900` (15 min) | Access token lifetime. |
| `JWT.refresh_token_ttl_seconds` | `Number` | `2592000` (30 days) | Refresh token lifetime (controls `expires_at` on the session record in JWT mode). |
| `JWT.rotate_refresh_token` | `Boolean` | `true` | Rotate the refresh token on each `refreshSessionJwt` call (RFC 6819). |
| `COOKIE_PREFIX` | `String` | `null` | Cookie name prefix. Full cookie name is `${COOKIE_PREFIX}${tenant_id}`. Required when reading/writing cookies. |
| `COOKIE_OPTIONS.http_only` | `Boolean` | `true` | |
| `COOKIE_OPTIONS.secure` | `Boolean` | `true` | |
| `COOKIE_OPTIONS.same_site` | `String` | `'lax'` | |
| `COOKIE_OPTIONS.path` | `String` | `'/'` | |

### STORE_CONFIG by Backend

| Adapter | Required keys | Notes |
|---|---|---|
| `auth-store-sqlite` | `table_name`, `lib_sql` | `lib_sql` = `Lib.SQLite` instance |
| `auth-store-postgres` | `table_name`, `lib_sql` | `lib_sql` = `Lib.Postgres` instance |
| `auth-store-mysql` | `table_name`, `lib_sql` | `lib_sql` = `Lib.MySQL` instance |
| `auth-store-mongodb` | `collection_name`, `lib_mongodb` | `lib_mongodb` = `Lib.MongoDB` instance |
| `auth-store-dynamodb` | `table_name`, `lib_dynamodb` | `lib_dynamodb` = `Lib.DynamoDB` instance |

## Public API

Every function receives `instance` (from `Lib.Instance.initialize()`) as its first argument for request-level lifecycle tracking.

All functions return `{ success: true, ..., error: null }` on success or `{ success: false, error: { type, message } }` on failure. Projects may pass errors through directly or map `error.type` to domain errors.

### DB-Mode (ENABLE_JWT=false, default)

| Function | Signature | Returns |
|---|---|---|
| `createSession` | `(instance, options)` | `{ success, session, auth_id, error }` |
| `verifySession` | `(instance, options)` | `{ success, session, error }` — also hydrates `instance.session` |
| `removeSession` | `(instance, options)` | `{ success, error }` |
| `removeOtherSessions` | `(instance, options)` | `{ success, error }` |
| `removeAllSessions` | `(instance, options)` | `{ success, error }` |
| `listSessions` | `(instance, options)` | `{ success, sessions, error }` |
| `countSessions` | `(instance, options)` | `{ success, count, error }` |
| `attachDeviceToSession` | `(instance, options)` | `{ success, error }` — binds a push token |
| `detachDeviceFromSession` | `(instance, options)` | `{ success, error }` — unbinds the push token |
| `listPushTargetsByActor` | `(instance, options)` | `{ success, sessions, error }` — sessions with a push token |
| `setupNewStore` | `(instance)` | `{ success, error }` — SQL only; NoSQL returns `NOT_IMPLEMENTED` |
| `cleanupExpiredSessions` | `(instance)` | `{ success, deleted_count, error }` |
| `createAuthId` | `({ actor_id, token_key, token_secret })` | `String` — pure, synchronous |
| `parseAuthId` | `(auth_id)` | `{ actor_id, token_key, token_secret }` or `null` — pure, synchronous |

#### `createSession` options

| Field | Required | Description |
|---|---|---|
| `tenant_id` | Yes | Tenant scoping key |
| `actor_id` | Yes | The authenticating actor |
| `install_id` | No | Device/browser install identifier. If supplied and matches an existing session, that session is replaced atomically. |
| `install_platform` | Yes | e.g. `'web'`, `'ios'`, `'android'`, `'desktop'` |
| `install_form_factor` | Yes | e.g. `'desktop'`, `'mobile'`, `'tablet'` |
| `client_name` | No | Browser or app name |
| `client_version` | No | Browser or app version |
| `client_is_browser` | No | Boolean |
| `client_os_name` | No | |
| `client_os_version` | No | |
| `client_screen_w` | No | Screen width (px) |
| `client_screen_h` | No | Screen height (px) |
| `client_ip_address` | No | |
| `client_user_agent` | No | |
| `custom_data` | No | Arbitrary JSON object stored with the session |

#### `verifySession` options

| Field | Required | Description |
|---|---|---|
| `tenant_id` | Yes | Must match the session record |
| `auth_id` | No | Override: supply token explicitly instead of reading from header/cookie |

The token is read in priority order: `Authorization: Bearer <token>` → cookie `${COOKIE_PREFIX}${tenant_id}`. Supply `auth_id` to bypass this and verify an explicit token.

### JWT Mode (ENABLE_JWT=true)

When JWT mode is active, `createSession` additionally returns `access_token` and `refresh_token` alongside the standard `session` and `auth_id`. The three additional functions become available:

| Function | Signature | Description |
|---|---|---|
| `verifyJwt` | `(instance, { jwt })` | Stateless HS256 verification — no DB read. Returns `{ success, claims, error }`. |
| `signSessionJwt` | `(instance, { session })` | Mint a fresh access JWT for an existing session object. Returns `{ success, access_token, error }`. |
| `refreshSessionJwt` | `(instance, { tenant_id, refresh_token })` | Exchange a valid refresh token for a new access + refresh token pair. Rotates the refresh token. Returns `{ success, session, access_token, refresh_token, error }`. |

#### JWT mode flow

```
Login:   createSession → returns access_token (15 min) + refresh_token (30 days)
Request: verifyJwt(access_token) → stateless, no DB hit
Refresh: refreshSessionJwt(refresh_token) → new pair, old refresh token invalidated
Logout:  removeSession → invalidates both tokens (DB record deleted)
```

**Revocation latency:** access tokens remain valid until `JWT.access_token_ttl_seconds` elapses after logout — this is inherent to stateless JWTs. Reduce `access_token_ttl_seconds` to tighten the window; set `ENABLE_JWT: false` to eliminate it entirely.

## Multi-Instance Per Actor Type

Each loader call returns an independent instance with its own store, table/collection, and configuration. Use this to give different actor types independent session policies:

```js
const PostgresStore = require('@superloomdev/js-server-helper-auth-store-postgres');

Lib.AuthUser = require('@superloomdev/js-server-helper-auth')(Lib, {
  STORE: PostgresStore,
  STORE_CONFIG: { table_name: 'sessions_user', lib_sql: Lib.Postgres },
  ACTOR_TYPE: 'user',
  TTL_SECONDS: 2592000,
  LIMITS: { total_max: 20, evict_oldest_on_limit: true }
});

Lib.AuthAdmin = require('@superloomdev/js-server-helper-auth')(Lib, {
  STORE: PostgresStore,
  STORE_CONFIG: { table_name: 'sessions_admin', lib_sql: Lib.Postgres },
  ACTOR_TYPE: 'admin',
  TTL_SECONDS: 86400,            // 24 h for admins
  LIMITS: { total_max: 3, evict_oldest_on_limit: false }  // reject if cap hit
});
```

Sessions never cross actor types. `verifySession` rejects any record whose stored `actor_type` does not match `CONFIG.ACTOR_TYPE` (defense in depth against table mis-pointing).

## Session Limit Policy

`createSession` runs the **list-then-filter** policy before every insert:

1. Load all existing sessions for `(tenant_id, actor_id)` — one indexed read.
2. Filter out expired sessions (they count for nothing).
3. **Same-installation replacement**: if `install_id` is provided and matches an active session's `install_id`, that session is queued for deletion regardless of caps.
4. Check `total_max`. If hit: evict LRU (all actor_ids, all form_factors) or return `LIMIT_REACHED`.
5. Check `by_form_factor_max[install_form_factor]` if configured. Same evict/reject logic within the form factor bucket.
6. Check `by_platform_max[install_platform]` if configured. Same logic within the platform bucket.
7. Batch-delete all queued evictions in one round-trip, then insert the new session.

No per-installation DB index is required. The per-actor query is the only read; policy enforcement is in-process.

## Session Record Shape

All adapters surface the same canonical record object:

| Field | Type | Notes |
|---|---|---|
| `tenant_id` | `String` | Immutable after creation |
| `actor_id` | `String` | Immutable after creation |
| `actor_type` | `String` | Matches `CONFIG.ACTOR_TYPE` |
| `token_key` | `String` | Random 16-char hex; part of the composite PK |
| `token_secret_hash` | `String` | SHA-256 of the secret; never returned to clients |
| `refresh_token_hash` | `String\|null` | JWT mode only; rotated on each refresh |
| `refresh_family_id` | `String\|null` | JWT mode; tracks the token family for replay detection |
| `created_at` | `Number` | Unix epoch seconds; immutable |
| `expires_at` | `Number` | Unix epoch seconds; rolls forward on activity |
| `last_active_at` | `Number` | Updated on `verifySession` (throttled) |
| `install_id` | `String\|null` | Enables same-device replacement |
| `install_platform` | `String` | |
| `install_form_factor` | `String` | |
| `client_name` | `String\|null` | |
| `client_version` | `String\|null` | |
| `client_is_browser` | `Boolean` | |
| `client_os_name` | `String\|null` | |
| `client_os_version` | `String\|null` | |
| `client_screen_w` | `Number\|null` | |
| `client_screen_h` | `Number\|null` | |
| `client_ip_address` | `String\|null` | |
| `client_user_agent` | `String\|null` | |
| `push_provider` | `String\|null` | e.g. `'fcm'`, `'apns'` |
| `push_token` | `String\|null` | Device push registration token |
| `custom_data` | `Object\|null` | Arbitrary JSON |

## Error Catalog

All operational errors are frozen objects in `auth.errors.js` with shape `{ type: String, message: String }`.

| `error.type` | Returned by | Meaning |
|---|---|---|
| `SERVICE_UNAVAILABLE` | All store operations | Store driver reported an error |
| `LIMIT_REACHED` | `createSession` | Cap was hit and `evict_oldest_on_limit: false` |
| `INVALID_TOKEN` | `verifySession`, `verifyJwt`, `refreshSessionJwt` | Malformed token, wrong secret, or used/replayed refresh token |
| `SESSION_EXPIRED` | `verifySession`, `refreshSessionJwt` | `expires_at` is in the past |
| `ACTOR_TYPE_MISMATCH` | `verifySession`, `verifyJwt` | Stored `actor_type` ≠ `CONFIG.ACTOR_TYPE` |

Errors never throw — they are returned as `{ success: false, error }`. The only exceptions are programmer errors (invalid `STORE_CONFIG` shape, identity field mutation in `updateSessionActivity`) which throw `TypeError` immediately so they surface in development.

## Storage Backends

| Adapter | `setupNewStore` | Native TTL | Cleanup |
|---|---|---|---|
| `auth-store-sqlite` | Creates table + `expires_at` index | None | `cleanupExpiredSessions` cron |
| `auth-store-postgres` | Creates table + `expires_at` index | None | `cleanupExpiredSessions` cron |
| `auth-store-mysql` | Creates table (index inline) | None | `cleanupExpiredSessions` cron |
| `auth-store-mongodb` | Not implemented — auto-collection | Requires Date-typed TTL index provisioned out-of-band | `cleanupExpiredSessions` cron |
| `auth-store-dynamodb` | Not implemented — provision via IaC | Optional: enable DynamoDB TTL on `expires_at` column out-of-band | `cleanupExpiredSessions` cron unless native TTL is enabled |

See each adapter's own README for schema details, index recommendations, and backend-specific quirks.

## Peer Dependencies

| Package | Purpose |
|---|---|
| `@superloomdev/js-helper-utils` | Type checks, validation |
| `@superloomdev/js-helper-debug` | Structured debug logging |
| `@superloomdev/js-server-helper-crypto` | Token generation, SHA-256 hashing |
| `@superloomdev/js-server-helper-instance` | Request lifecycle, `instance.time` |

The chosen store adapter package brings its own peer dependency on the relevant driver helper (`js-server-helper-sql-postgres`, `js-server-helper-nosql-mongodb`, etc.).

## Testing

Auth's own tests are **fully offline** — no Docker, no database driver. They use an in-process memory store fixture (`createInMemoryAuthStore()` in `_test/`) that implements the full 8-method store contract without any real backend.

```bash
cd _test && npm install && npm test
```

Coverage:
- Loader validation (every required config key; `STORE` must be a function)
- Pure helpers: `auth-id`, `record-shape`, `cookie`, `token-source`
- Pure policy: every cap tier, LRU eviction, `evict_oldest_on_limit` false path, same-install replacement priority
- JWT mode: `createSession`, `verifyJwt`, `refreshSessionJwt` rotation, single-use enforcement, expiry, cross-actor-type rejection

`_test/store-contract-suite.js` contains the shared integration test suite run by every adapter. It is **not exported** from the auth package — each adapter ships its own copy as a local file in its `_test/` directory. The copy acts as a snapshot: it records the exact contract shape the adapter was built and tested against, which makes version compatibility audits straightforward.

Integration tests for each storage backend live in the corresponding adapter module (`js-server-helper-auth-store-*`). See each adapter's README for instructions.

## Data Model

Every session event is stored as a single flat record. This section explains what each field means, why it exists, and how to populate it correctly.

### Core concepts

**Tenant** — the top-level isolation boundary. Every session record carries a `tenant_id` and all queries are scoped to `(tenant_id, actor_id, ...)`. Two tenants in the same table are completely invisible to each other.

```
tenant_id: 'tenant_42'        // SaaS tenant
tenant_id: 'org_acme'         // organisation slug
tenant_id: 'default'          // single-tenant deployment (one known value)
```

Tenant isolation is enforced at every store method — there is no cross-tenant query. Your application must ensure the tenant_id passed in is authoritative for the caller before passing it to auth.

**Actor** — the authenticated principal. An actor has a `type` (what kind of actor it is) and an `id` (which specific principal). The Auth module is instantiated once per `actor_type`; the instance only ever reads and writes sessions for that type.

```
actor_type: 'user'            actor_id: 'usr_9f2a'      // end user
actor_type: 'admin'           actor_id: 'adm_002'       // staff member
actor_type: 'merchant'        actor_id: 'mrch_10'       // B2B account
actor_type: 'service'         actor_id: 'billing-api'   // machine-to-machine
```

`actor_type` is validated on every `verifySession` call — a session stored under `actor_type: 'user'` will be rejected by an `admin` Auth instance even if the token is otherwise valid. This is a defense-in-depth guard against misconfigured table pointers.

**Token key and secret** — together these are the session identity:

- `token_key` — a random 16-char hex string. Forms part of the composite primary key. Safe to log.
- `token_secret` — a random 32-char hex string. **Never stored.** Only its SHA-256 hash (`token_secret_hash`) is persisted. A lookup with the wrong secret returns the same "not found" response as a missing row — no timing oracle.

**auth_id** — the wire-format token the client holds:

```
auth_id = "{actor_id}-{token_key}-{token_secret}"
```

Reserved characters are `-` (segment separator) and `#` (composite-key separator inside MongoDB `_id` and DynamoDB sort key). Both are forbidden in any user-supplied `actor_id`. Validation runs at `createSession` and `createAuthId`.

**install_id** — an optional client-supplied device or browser identifier. When provided and it matches an existing session's `install_id`, the prior session is **replaced atomically** regardless of session limits. This implements "log in again on the same device overrides the previous session" without requiring the client to remember the old `token_key`.

```
install_id: 'device-uuid-1234'   // generated once on first install, persisted client-side
install_id: null                  // omit when the platform has no stable device ID
```

---

### Record fields

| Field | Type | Set by | Description |
|---|---|---|---|
| `tenant_id` | String | caller | Top-level isolation boundary. All store queries are scoped to this value. Immutable after creation. |
| `actor_id` | String | caller | The authenticated principal. Forbidden characters: `-` and `#`. Immutable after creation. |
| `actor_type` | String | auth module | Copied from `CONFIG.ACTOR_TYPE`. Validated on every `verifySession`. Immutable. |
| `token_key` | String | auth module | Random 16-char hex. Part of the composite primary key. Returned inside `auth_id`. |
| `token_secret_hash` | String | auth module | SHA-256 of the client's secret. Never returned to callers. Wrong-secret lookups return null, not an error. |
| `refresh_token_hash` | String\|null | auth module | JWT mode only. SHA-256 of the current refresh token secret. Rotated on each `refreshSessionJwt` call. |
| `refresh_family_id` | String\|null | auth module | JWT mode only. Stable across rotations within one session; used to detect refresh-token replay. |
| `created_at` | Number | auth module | Unix epoch seconds. Immutable. Derived from `instance.time`. |
| `expires_at` | Number | auth module | Unix epoch seconds. Set to `created_at + TTL_SECONDS` and rolled forward by `TTL_SECONDS` on each throttled activity refresh. |
| `last_active_at` | Number | auth module | Unix epoch seconds. Updated by `verifySession` at most once per `LAST_ACTIVE_UPDATE_INTERVAL_SECONDS` to avoid a DB write on every request. |
| `install_id` | String\|null | caller | Client-assigned device identifier. Enables same-device replacement. **Immutable** after creation — not updated by activity refresh. |
| `install_platform` | String | caller | e.g. `'web'`, `'ios'`, `'android'`, `'macos'`, `'windows'`, `'linux'`, `'other'`. Used by `by_platform_max` limits. Immutable. |
| `install_form_factor` | String | caller | e.g. `'desktop'`, `'mobile'`, `'tablet'`, `'tv'`, `'watch'`, `'other'`. Used by `by_form_factor_max` limits. Immutable. |
| `client_name` | String\|null | caller | Browser or app name (e.g. `'Chrome'`, `'Safari'`, `'MyApp'`). |
| `client_version` | String\|null | caller | Browser or app version string. |
| `client_is_browser` | Boolean | caller | `true` for browser-based sessions; used to separate browser from native app in the "active devices" UI. |
| `client_os_name` | String\|null | caller | OS name (e.g. `'iOS'`, `'Windows'`). |
| `client_os_version` | String\|null | caller | OS version string. |
| `client_screen_w` | Number\|null | caller | Screen width in logical pixels. |
| `client_screen_h` | Number\|null | caller | Screen height in logical pixels. |
| `client_ip_address` | String\|null | caller | IPv4 or IPv6 of the request origin at login time. Not updated on activity refresh. |
| `client_user_agent` | String\|null | caller | HTTP `User-Agent` string at login time. |
| `push_provider` | String\|null | caller | Push notification provider (e.g. `'fcm'`, `'apns'`, `'webpush'`, `'expo'`). Set via `attachDeviceToSession`. |
| `push_token` | String\|null | caller | Provider-specific push registration token. Set via `attachDeviceToSession`. Used by `listPushTargetsByActor` to fan out notifications. |
| `custom_data` | Object\|null | caller | Project-owned arbitrary JSON. Opaque to auth — returned as-is on every read. |

---

### `custom_data` convention

`custom_data` is the extension point for any per-session state your application needs to carry without adding a join. It is stored verbatim and returned on every successful `verifySession`.

```javascript
// Store the user's role at login time so the request handler doesn't need a DB call
custom_data: { role: 'editor', org_id: 'org_42' }

// Carry the OAuth provider and upstream user-id for federated accounts
custom_data: { oauth_provider: 'google', oauth_sub: '1047283904' }

// Keep it null when there is nothing extra to carry
custom_data: null
```

Do **not** store secrets, session tokens from other systems, or large blobs in `custom_data`. The column is stored as-is and returned to any code that calls `verifySession`.

---

### install_platform / install_form_factor quick reference

| Scenario | `install_platform` | `install_form_factor` |
|---|---|---|
| Chrome on a laptop | `'web'` | `'desktop'` |
| Safari on an iPhone | `'ios'` | `'mobile'` |
| Android app on a phone | `'android'` | `'mobile'` |
| Android app on a tablet | `'android'` | `'tablet'` |
| macOS desktop app | `'macos'` | `'desktop'` |
| Windows desktop app | `'windows'` | `'desktop'` |
| CLI / server tool | `'other'` | `'other'` |

These values feed directly into `LIMITS.by_platform_max` and `LIMITS.by_form_factor_max`. Use consistent values across your codebase; a typo silently creates a new bucket that never hits any cap.

---

## Testing

| Tier | Runtime | Status |
|------|---------|--------|
| **Unit Tests** | Node.js `node --test` | [![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml) |

Run locally:

```bash
cd _test
npm install && npm test
```

Auth's own tests are **fully offline** — no Docker, no database driver. They use an in-process memory store fixture (`createInMemoryAuthStore()` in `_test/`) that implements the full 8-method store contract without any real backend.

Coverage:
- Loader validation (every required config key; `STORE` must be a function)
- Pure helpers: `auth-id`, `record-shape`, `cookie`, `token-source`
- Pure policy: every cap tier, LRU eviction, `evict_oldest_on_limit` false path, same-install replacement priority
- JWT mode: `createSession`, `verifyJwt`, `refreshSessionJwt` rotation, single-use enforcement, expiry, cross-actor-type rejection

`_test/store-contract-suite.js` contains the shared integration test suite run by every adapter. It is **not exported** from the auth package — each adapter ships its own copy as a local file in its `_test/` directory. The copy acts as a snapshot: it records the exact contract shape the adapter was built and tested against, which makes version compatibility audits straightforward.

Integration tests for each storage backend live in the corresponding adapter module (`js-server-helper-auth-store-*`). See each adapter's README for instructions.

---

## License

MIT
