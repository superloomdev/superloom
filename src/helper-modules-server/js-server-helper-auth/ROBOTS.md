# js-server-helper-auth

Session lifecycle and authentication feature module. Multi-instance per `actor_type`. Five storage adapters (sqlite, postgres, mysql, mongodb, dynamodb). Two operating modes: DB-mode (default) and JWT-mode (`ENABLE_JWT: true`, HS256 + rotating refresh tokens, RFC 6819). List-then-filter session-limit policy enforced uniformly across all backends. Never throws on operational failures; `TypeError` on programmer errors only.

## Type
Server helper. Class E (feature module with adapters). Offline test tier (in-process memory store fixture).

## Peer Dependencies
- `@superloomdev/js-helper-utils` - injected as `Lib.Utils`
- `@superloomdev/js-helper-debug` - injected as `Lib.Debug`
- `@superloomdev/js-server-helper-crypto` - injected as `Lib.Crypto`
- `@superloomdev/js-server-helper-instance` - injected as `Lib.Instance`

The chosen storage adapter brings its own peer requirement on the driver helper (`Lib.Postgres`, `Lib.MongoDB`, `Lib.DynamoDB`, etc.).

## Direct Dependencies
None. JWT signing uses Node's built-in `crypto` (via `Lib.Crypto`).

## Loader Pattern (Factory)

```javascript
Lib.AuthUser = require('@superloomdev/js-server-helper-auth')(Lib, {
  STORE:        require('@superloomdev/js-server-helper-auth-store-postgres'),   // FACTORY FUNCTION, not a string
  STORE_CONFIG: { table_name: 'sessions_user', lib_sql: Lib.Postgres },
  ACTOR_TYPE:   'user',
  TTL_SECONDS:  2592000,
  LIMITS:       { total_max: 20, evict_oldest_on_limit: true },
  COOKIE_PREFIX: 'sl_user_'
});
```

One Auth instance per `actor_type`:

```javascript
Lib.AuthUser  = AuthLoader(Lib, { ACTOR_TYPE: 'user',  STORE: require('...auth-store-postgres'), STORE_CONFIG: { table_name: 'sessions_user',  lib_sql: Lib.Postgres } });
Lib.AuthAdmin = AuthLoader(Lib, { ACTOR_TYPE: 'admin', STORE: require('...auth-store-postgres'), STORE_CONFIG: { table_name: 'sessions_admin', lib_sql: Lib.Postgres } });
```

**STORE must be the factory function returned by `require(...)`, never a string.** Passing a string is rejected at loader time.

## Config Keys

| Key | Type | Default | Notes |
|---|---|---|---|
| `STORE` | Function | `null` | **Required.** Pass `require('@superloomdev/js-server-helper-auth-store-*')` directly. Must be a function, not a string |
| `STORE_CONFIG` | Object | `null` | **Required.** Shape varies by adapter. See per-adapter README |
| `ACTOR_TYPE` | String | `null` | **Required.** This instance owns one actor_type |
| `TTL_SECONDS` | Number | `2592000` (30 days) | Session lifetime |
| `LAST_ACTIVE_UPDATE_INTERVAL_SECONDS` | Number | `600` | Throttle for last_active refresh |
| `LIMITS.total_max` | Number | `20` | Required positive int |
| `LIMITS.by_form_factor_max` | Object\|null | `null` | Partial map allowed: `{ mobile: 3 }` |
| `LIMITS.by_platform_max` | Object\|null | `null` | Partial map allowed: `{ ios: 2 }` |
| `LIMITS.evict_oldest_on_limit` | Boolean | `true` | `false` rejects with `AUTH_LIMIT_REACHED` |
| `ENABLE_JWT` | Boolean | `false` | When `true`, `createSession` also returns `access_token` + `refresh_token` |
| `JWT.signing_key` | String | `null` | HMAC secret, required >= 32 chars when `ENABLE_JWT` |
| `JWT.algorithm` | String | `'HS256'` | Only HS256 currently supported (Node native crypto) |
| `JWT.issuer` / `audience` | String | `null` | Required when `ENABLE_JWT` |
| `JWT.access_token_ttl_seconds` | Number | `900` | 15 minutes |
| `JWT.refresh_token_ttl_seconds` | Number | `2592000` | 30 days |
| `JWT.rotate_refresh_token` | Boolean | `true` | RFC 6819 single-use rotation |
| `COOKIE_PREFIX` | String | `null` | Full cookie name = `${COOKIE_PREFIX}${tenant_id}` |
| `COOKIE_OPTIONS` | Object | `{ http_only: true, secure: true, same_site: 'lax', path: '/' }` | |

## STORE_CONFIG by Backend

| Adapter | Required keys |
|---|---|
| `auth-store-sqlite` | `table_name`, `lib_sql` (Lib.SQLite instance) |
| `auth-store-postgres` | `table_name`, `lib_sql` (Lib.Postgres instance) |
| `auth-store-mysql` | `table_name`, `lib_sql` (Lib.MySQL instance) |
| `auth-store-mongodb` | `collection_name`, `lib_mongodb` (Lib.MongoDB instance) |
| `auth-store-dynamodb` | `table_name`, `lib_dynamodb` (Lib.DynamoDB instance) |

## Public Functions

### Session lifecycle

createSession(instance, options) → { success, session, auth_id, [access_token, refresh_token], error } | async:yes
  Validates options, runs limit policy (list-then-filter), batch-deletes evictions, inserts new session, writes cookie. In JWT mode also mints access_token + refresh_token.
  - options.tenant_id (required), options.actor_id (required; no `-` or `#`)
  - options.install_id (optional; matches existing session for atomic same-device replacement)
  - options.install_platform (required: web|ios|android|macos|windows|linux|other)
  - options.install_form_factor (required: mobile|tablet|desktop|tv|watch|other)
  - options.client_* (optional metadata: name/version/os/screen/ip/ua)
  - options.custom_data (optional project-owned object)
  - Errors: AUTH_LIMIT_REACHED, AUTH_SERVICE_UNAVAILABLE

verifySession(instance, options) → { success, session, error } | async:yes
  Reads token from Authorization: Bearer or cookie. Hydrates `instance.session`. Schedules a throttled background refresh of last_active_at + expires_at.
  - options.tenant_id (required), options.auth_id (optional override)
  - Errors: AUTH_INVALID_TOKEN, AUTH_SESSION_EXPIRED, AUTH_ACTOR_TYPE_MISMATCH, AUTH_SERVICE_UNAVAILABLE

removeSession(instance, options) → { success, error } | async:yes
  Delete one session and clear the cookie. Idempotent.
  - options.tenant_id, actor_id, token_key (all required)

removeOtherSessions(instance, options) → { success, removed_count, error } | async:yes
  Delete all sessions for the actor except `keep_token_key`. Useful after password reset.
  - options.tenant_id, actor_id, keep_token_key (all required)

removeAllSessions(instance, options) → { success, removed_count, error } | async:yes
  Delete every session for the actor (account compromise / password reset). Clears the cookie.
  - options.tenant_id, actor_id (both required)

### Session inventory

listSessions(instance, options) → { success, sessions, error } | async:yes
  Active sessions for the actor. Expired sessions filtered out. Powers the "Active devices" UI.
  - options.tenant_id, actor_id (both required)

countSessions(instance, options) → { success, count, error } | async:yes
  Count of active sessions. Delegates to listSessions internally.
  - options.tenant_id, actor_id (both required)

### Push notification hooks

attachDeviceToSession(instance, options) → { success, error } | async:yes
  Bind push_provider + push_token to an existing session (partial update).
  - options.tenant_id, actor_id, token_key, push_provider, push_token (all required)
  - push_provider is opaque to auth (e.g. apns|fcm|webpush|expo)

detachDeviceFromSession(instance, options) → { success, error } | async:yes
  Clear push_provider + push_token. The session itself remains valid.
  - options.tenant_id, actor_id, token_key (all required)

listPushTargetsByActor(instance, options) → { success, targets, error } | async:yes
  Active sessions for the actor with both push_provider and push_token set. Expired and unregistered sessions filtered out.
  - options.tenant_id, actor_id (both required)

### Operational

setupNewStore(instance) → { success, error } | async:yes
  Idempotent SQL schema setup (CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS on expires_at). Safe on every boot.
  NoSQL backends (mongodb, dynamodb) **throw TypeError** - provision out-of-band via IaC.

cleanupExpiredSessions(instance) → { success, deleted_count, error } | async:yes
  Sweep expired sessions. Required on SQL (no native TTL). Required on MongoDB (we store expires_at as integer, not Date). Optional on DynamoDB when native TTL is enabled on expires_at. Run once per day via cron / EventBridge.

### Pure helpers (sync, no store I/O)

createAuthId({ actor_id, token_key, token_secret }) → String
  Builds wire format `{actor_id}-{token_key}-{token_secret}`. Throws TypeError on `-` or `#` in actor_id.

parseAuthId(auth_id) → { actor_id, token_key, token_secret } | null
  Inverse. Returns null on malformed input.

### JWT mode (only when `ENABLE_JWT: true`)

verifyJwt(instance, { jwt }) → { success, claims, error } | async:no
  Stateless HS256 verification. **No store read.** Checks signature, expiry, issuer, audience, ACTOR_TYPE.
  - claims = { iss, aud, iat, exp, jti, sub, atp, tid, ikd, tkk }
  - Errors: AUTH_INVALID_TOKEN, AUTH_SESSION_EXPIRED, AUTH_ACTOR_TYPE_MISMATCH

signSessionJwt(instance, { session }) → { success, access_token, error } | async:no
  Mint a fresh access JWT for an existing session record.

refreshSessionJwt(instance, { tenant_id, refresh_token }) → { success, session, access_token, refresh_token, error } | async:yes
  Exchange a refresh token for a new pair. Old refresh token invalidated by hash rotation (single-use). expires_at rolled forward by TTL_SECONDS.
  - refresh_token wire format: `{actor_id}-{token_key}-{refresh_secret}`
  - Errors: AUTH_INVALID_TOKEN, AUTH_SESSION_EXPIRED, AUTH_SERVICE_UNAVAILABLE

## Error Catalog

All errors are frozen objects from `auth.errors.js` with shape `{ type, message }`. The `type` is the programmatic discriminator (note the `AUTH_*` prefix on most types).

| error.type | Returned by | Meaning |
|---|---|---|
| AUTH_SERVICE_UNAVAILABLE | every store-touching function | Store driver reported an error |
| AUTH_LIMIT_REACHED | createSession | Cap hit and `LIMITS.evict_oldest_on_limit: false` |
| AUTH_INVALID_TOKEN | verifySession, verifyJwt, refreshSessionJwt | Malformed token, wrong secret, missing row, replayed refresh token |
| AUTH_SESSION_EXPIRED | verifySession, verifyJwt, refreshSessionJwt | `expires_at` is in the past |
| AUTH_ACTOR_TYPE_MISMATCH | verifySession, verifyJwt | Stored actor_type != CONFIG.ACTOR_TYPE |
| NOT_IMPLEMENTED | setupNewStore on NoSQL backends | Operation has no meaning on this backend; provision out-of-band |

> Programmer errors throw `TypeError` immediately (invalid STORE_CONFIG shape, reserved characters in actor_id, identity-field mutation). The catalog above only covers operational failures.

## Canonical Session Record Shape

Every store serializes/deserializes this shape:

```
tenant_id, actor_id, actor_type,
token_key, token_secret_hash,
refresh_token_hash, refresh_family_id,         // null in DB mode
created_at, expires_at, last_active_at,
install_id, install_platform, install_form_factor,   // immutable post-creation
client_name, client_version, client_is_browser,
client_os_name, client_os_version,
client_screen_w, client_screen_h,
client_ip_address, client_user_agent,           // mutable on throttled refresh
push_provider, push_token,                       // set/cleared via attach/detach
custom_data                                      // project-owned envelope
```

## Wire Format

```
auth_id = "{actor_id}-{token_key}-{token_secret}"
```

Reserved characters: `-` (segment separator) and `#` (composite-key separator inside DynamoDB sort key and MongoDB `_id`). Forbidden in any user-supplied identifier; validated at `createAuthId` and `createSession`.

## Storage Internals

| Backend | Primary key | Operator-provisioned indexes | Native TTL |
|---|---|---|---|
| DynamoDB | PK=tenant_id, SK={actor_id}#{token_key} | None | Optional: enable TTL on `expires_at` out-of-band |
| MongoDB | `_id = {tenant_id}#{actor_id}#{token_key}#{hash}` | `prefix` (equality), `expires_at` (range) | None (the module stores integer seconds, not Date) |
| Postgres | (tenant_id, actor_id, token_key) | (expires_at) - created by `setupNewStore` | None (cron) |
| MySQL | (tenant_id, actor_id, token_key) | (expires_at) - created by `setupNewStore` | None (cron) |
| SQLite | (tenant_id, actor_id, token_key) | (expires_at) - created by `setupNewStore` | None (cron, embedded) |

Access patterns:
- **DynamoDB.** Composite primary key serves every hot path. `verifySession` is GetItem, `listSessions` is Query `begins_with(SK, "actor_id#")`, removes are DeleteItem / BatchWriteItem. No GSI required. `cleanupExpiredSessions` is a filtered scan when native TTL is off.
- **MongoDB.** `_id` lookup is O(1) for `verifySession`. `listSessions` is equality match on the denormalised `prefix` sidecar field - the operator MUST provision both `prefix` and `expires_at` indexes out-of-band.
- **SQL.** Composite primary key serves every hot path. `setupNewStore(instance)` creates the table + `expires_at` index.

## Patterns
- **Never throws on operational failures.** Returns structured `{ success: false, error }` envelope. Only TypeError on programmer errors
- **`instance` is always first argument.** Every function reads `instance.time` for timestamps, routes timing through `Lib.Debug.performanceAuditLog`
- **One Auth instance per actor_type.** Sessions never cross types - `verifySession` rejects mismatches with `AUTH_ACTOR_TYPE_MISMATCH`
- **Tenant scoping is mandatory.** Every store function requires tenant_id
- **STORE_CONFIG is extracted internally.** The adapter pulls its slice from `CONFIG.STORE_CONFIG`; caller passes the full config object
- **Token secret never stored.** Only SHA-256 hash (`token_secret_hash`). Wrong-secret lookups return null, not an error - no timing oracle
- **Throttled last_active_at.** `verifySession` writes back at most once per `LAST_ACTIVE_UPDATE_INTERVAL_SECONDS` (default 600s) via `Lib.Instance.backgroundRoutine`

## Documentation

- `docs/api.md` - full API reference (every function, every option, every error type)
- `docs/configuration.md` - loader pattern, every config key, STORE_CONFIG by backend, testing tiers
- `docs/data-model.md` - canonical record shape, core concepts, design decisions
- `docs/runtime.md` - the differences between persistent-server and serverless-function runtime shapes only (how `instance` is constructed; how scheduled cleanup is wired). Not a framework cookbook
- Storage adapters: see the README's "Storage Adapters" section for the list + selection rule. Per-backend schema, indexes, TTL, IaC notes, and `STORE_CONFIG` shape live in each adapter package's own README (`@superloomdev/js-server-helper-auth-store-*`)
- `docs/push-notifications.md` - push-token contract for a future `js-server-helper-push`
