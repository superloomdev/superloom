# Auth Module - AI Reference

## Module Overview
Session lifecycle and authentication. Multi-instance per `actor_type`.
Storage adapters: sqlite, postgres, mysql, mongodb, dynamodb.
Two modes via `ENABLE_JWT` config: db-only (every request reads the store) and
JWT-mode (HS256 access tokens + opaque rotating refresh tokens). List-then-
filter policy enforces session limits and same-installation replacement
uniformly across all backends.

## Factory Pattern
```javascript
module.exports = function loader (shared_libs, config) {
  // Returns independent instance with isolated Lib + CONFIG.
  // Validates CONFIG at construction (STORE, STORE_CONFIG, ACTOR_TYPE,
  // TTL_SECONDS, LIMITS) - throws on any missing required key.
  // When ENABLE_JWT=true, JWT.signing_key (>= 32 chars) + issuer + audience
  // are also required.
  return { /* public API - see below */ };
};
```

One Auth instance per actor_type:
```javascript
Lib.AuthUser  = AuthLoader(Lib, { ACTOR_TYPE: 'user',  STORE: 'sqlite', STORE_CONFIG: { table_name: 'sessions_user',  lib_sql: Lib.SQLite } });
Lib.AuthAdmin = AuthLoader(Lib, { ACTOR_TYPE: 'admin', STORE: 'sqlite', STORE_CONFIG: { table_name: 'sessions_admin', lib_sql: Lib.SQLite } });
```

## Public Functions

### createSession(instance, options) - async
Create a new session and return its wire-format auth_id.
Same-installation replacement: if `install_id` matches an existing session,
the prior session is replaced. Limits enforced via the list-then-filter
algorithm in `parts/policy.js`.
- **options.tenant_id** - String (required)
- **options.actor_id** - String (required, no `-` or `#`)
- **options.install_id** - String (optional)
- **options.install_platform** - One of `web|ios|android|macos|windows|linux|other`
- **options.install_form_factor** - One of `mobile|tablet|desktop|tv|watch|other`
- **options.client_*** - Optional client metadata (name/version/os/screen/ip/ua)
- **options.custom_data** - Optional project-owned object
- **Returns**: `{ success, auth_id, access_token, refresh_token, session, error }`
  - `access_token` and `refresh_token` are non-null only when `ENABLE_JWT=true`.

### verifySession(instance, options) - async
Validate an inbound auth_id. Reads from header / Bearer / cookie if not
passed explicitly. Hydrates `instance.session`. Schedules a throttled
background refresh of `last_active_at` + `expires_at` once
`LAST_ACTIVE_UPDATE_INTERVAL_SECONDS` has elapsed since the last refresh.
- **options.tenant_id** - String (required)
- **options.auth_id** - String (optional - read from request if absent)
- **Returns**: `{ success, session, error }` - `error` is `INVALID_TOKEN`, `SESSION_EXPIRED`, or `ACTOR_TYPE_MISMATCH` on failure

### removeSession(instance, options) - async
Delete one session and clear the cookie.
- **options.tenant_id**, **options.actor_id**, **options.token_key** - all required
- **Returns**: `{ success, error }`

### removeOtherSessions(instance, options) - async
"Log out everywhere else" - delete all sessions for an actor except the
one identified by `keep_token_key`.
- **options.tenant_id**, **options.actor_id**, **options.keep_token_key** - all required
- **Returns**: `{ success, removed_count, error }`

### removeAllSessions(instance, options) - async
Delete every session for an actor (password reset / account compromise).
Clears the cookie.
- **options.tenant_id**, **options.actor_id** - both required
- **Returns**: `{ success, removed_count, error }`

### listSessions(instance, options) - async
Return active sessions for an actor. Used to power the "Active devices" UI.
Expired sessions are filtered out.
- **options.tenant_id**, **options.actor_id** - both required
- **Returns**: `{ success, sessions, error }` - `sessions` is an array of canonical records

### countSessions(instance, options) - async
Convenience: returns the count of active sessions for the actor.
- **options.tenant_id**, **options.actor_id** - both required
- **Returns**: `{ success, count, error }`

### listPushTargetsByActor(instance, options) - async
Return active sessions whose `push_provider` AND `push_token` are both set.
Used by a future push-notification module to fan out a message. Output is
the canonical session record shape; expired and unregistered sessions are
filtered out automatically.
- **options.tenant_id**, **options.actor_id** - both required
- **Returns**: `{ success, targets, error }`

### attachDeviceToSession(instance, options) - async
Bind push provider + token to an existing session.
- **options.tenant_id**, **options.actor_id**, **options.token_key** - required
- **options.push_provider** - e.g., `apns|fcm|webpush|expo` (opaque to auth)
- **options.push_token** - Provider-specific routing token
- **Returns**: `{ success, error }`

### detachDeviceFromSession(instance, options) - async
Unbind push provider + token (set both to null).
- **options.tenant_id**, **options.actor_id**, **options.token_key** - required
- **Returns**: `{ success, error }`

### setupNewStore(instance) - async
Idempotent SQL-backend schema setup. Issues `CREATE TABLE IF NOT EXISTS`
plus `CREATE INDEX IF NOT EXISTS` for the `expires_at` index. Safe to
call on every boot.

NoSQL backends (mongodb, dynamodb) do **not** implement this method -
calling it throws `TypeError`. Provision the collection / table /
secondary indexes / native TTL out-of-band via IaC or a one-shot
script that uses the underlying helper module (e.g.
`DynamoDB.createTable`, `MongoDB.createIndex`).
- **Returns**: `{ success, error }`

### cleanupExpiredSessions(instance) - async
Sweep expired sessions across every backend. Required on SQL (no
native TTL). Required on MongoDB (auth stores `expires_at` as an
integer, not the `Date` MongoDB TTL needs) and on DynamoDB unless
native TTL on `expires_at` was enabled out-of-band. Recommended
frequency: once per day via cron / EventBridge.
- **Returns**: `{ success, deleted_count, error }`

### createAuthId({ actor_id, token_key, token_secret })
Pure helper. Builds the wire-format auth_id `actor_id-token_key-token_secret`.
Throws TypeError on `-` or `#` inside actor_id.
- **Returns**: String

### parseAuthId(auth_id)
Pure helper. Parses the wire format. Returns `null` if malformed.
- **Returns**: `{ actor_id, token_key, token_secret }` or `null`

### JWT-mode public functions (only when `ENABLE_JWT=true`)

#### verifyJwt(instance, options) - sync
Stateless verification of an access JWT. Decodes header + payload, checks
HS256 signature, expiry, issuer, audience, and ACTOR_TYPE. **No DB read.**
- **options.jwt** - Compact JWS string
- **Returns**: `{ success, claims, error }` - claims include `iss aud iat exp jti sub atp tid ikd tkk`

#### signSessionJwt(instance, options) - sync
Mint a fresh access JWT for an existing session record.
- **options.session** - Canonical session record
- **Returns**: `{ success, access_token, error }`

#### refreshSessionJwt(instance, options) - async
Exchange a refresh token for a new access + new refresh. Old refresh is
invalidated by hash rotation (single-use). Session lifecycle is rolled
forward by `TTL_SECONDS`.
- **options.tenant_id** - Required (refresh tokens are tenant-scoped)
- **options.refresh_token** - Wire format: `{actor_id}-{token_key}-{refresh_secret}`
- **Returns**: `{ success, access_token, refresh_token, session, error }`

## Configuration

| Key | Default | Notes |
|---|---|---|
| `STORE` | `null` (required) | One of `postgres|mysql|sqlite|dynamodb|mongodb` |
| `STORE_CONFIG` | `null` (required) | Per-store config; shape varies (see store docs) |
| `ACTOR_TYPE` | `null` (required) | This instance owns one actor_type |
| `TTL_SECONDS` | `2592000` (30d) | Session lifetime |
| `LAST_ACTIVE_UPDATE_INTERVAL_SECONDS` | `600` | Throttle for last_active refresh |
| `LIMITS.total_max` | `20` (required positive int) | |
| `LIMITS.by_form_factor_max` | `null` | Partial map allowed: `{ mobile: 3 }` |
| `LIMITS.by_platform_max` | `null` | Partial map allowed: `{ ios: 2 }` |
| `LIMITS.evict_oldest_on_limit` | `true` | `false` rejects with `LIMIT_REACHED` |
| `ENABLE_JWT` | `false` | When `true`, createSession also returns access_token + refresh_token |
| `JWT.signing_key` | `null` | HMAC secret, required >= 32 chars when ENABLE_JWT |
| `JWT.algorithm` | `'HS256'` | Only HS256 currently supported (Node native crypto) |
| `JWT.issuer` / `audience` | `null` | Required when ENABLE_JWT |
| `JWT.access_token_ttl_seconds` | `900` | 15 minutes |
| `JWT.refresh_token_ttl_seconds` | `2592000` | 30 days |
| `COOKIE_PREFIX` | `null` | Cookie name = `${COOKIE_PREFIX}${tenant_id}` |
| `COOKIE_OPTIONS` | `{ http_only: true, secure: true, same_site: 'lax', path: '/' }` | |

### Error Catalog

All errors are defined in `auth.errors.js`:

| Error Type | When Returned |
|---|---|
| `LIMIT_REACHED` | createSession when caps hit + reject mode |
| `SESSION_NOT_FOUND` | verifySession with no matching session |
| `SESSION_EXPIRED` | verifySession past `expires_at` |
| `INVALID_TOKEN` | verifySession with malformed auth_id / bad secret |
| `ACTOR_TYPE_MISMATCH` | layer-2 defense when token actor_type differs |
| `SERVICE_UNAVAILABLE` | any store operation failure |

Shape: `{ type: string, message: string }` (frozen).

## Canonical Record Shape

Every store serializes/deserializes this shape:

```
tenant_id, actor_id, actor_type, token_key, token_secret_hash,
refresh_token_hash, refresh_family_id,                     // null in db_only mode
created_at, expires_at, last_active_at,
install_id, install_platform, install_form_factor,         // immutable post-creation
client_name, client_version, client_is_browser,
client_os_name, client_os_version,
client_screen_w, client_screen_h,
client_ip_address, client_user_agent,                      // mutable on throttled refresh
push_provider, push_token,                                 // forward-compat for notifications
custom_data                                                // project-owned envelope
```

## Wire Format

```
auth_id = "{actor_id}-{token_key}-{token_secret}"
```

Reserved characters: `-` (separator) and `#` (composite-key separator inside
DynamoDB sort key and MongoDB `_id`). Forbidden in any user-supplied
identifier; validated at `createAuthId` and `createSession`.

## Storage Internals

| Backend | Primary key | Operator-provisioned indexes | Native TTL |
|---|---|---|---|
| DynamoDB | PK `tenant_id`, SK `{actor_id}#{token_key}` | None | Optional: enable TTL on `expires_at` attribute out-of-band |
| MongoDB | `_id = {tenant_id}#{actor_id}#{token_key}#{hash}` | `prefix` (equality), `expires_at` (range) | None (we store integer seconds, not `Date`) |
| Postgres | `(tenant_id, actor_id, token_key)` | `(expires_at)` - created by `setupNewStore` | None (cron) |
| MySQL | `(tenant_id, actor_id, token_key)` | `(expires_at)` - created by `setupNewStore` | None (cron) |
| SQLite | `(tenant_id, actor_id, token_key)` | `(expires_at)` - created by `setupNewStore` | None (cron, embedded) |

Access-pattern map:

- **DynamoDB** rides the composite primary key for every hot path. `getSession` is `GetItem`, `listSessionsByActor` is `Query` with `begins_with(session_key, "actor_id#")`, `deleteSession*` are `DeleteItem` / `BatchWriteItem`. No GSI required. The only scan is `cleanupExpiredSessions` when native TTL is not enabled.
- **MongoDB** `getSession` is O(1) on `_id` (auto-indexed). `listSessionsByActor` does an equality match on the denormalised `prefix` sidecar field (`"{tenant_id}#{actor_id}#"`) - you MUST create an index on `prefix` to avoid a collection scan. `cleanupExpiredSessions` does a range query on `expires_at` - create that index too. Operators provision both indexes out-of-band (the auth module does not create them; MongoDB has no `createIndex IF NOT EXISTS` that is safe across drivers).
- **SQL backends** create both the table and the `expires_at` index in `setupNewStore(instance)` - call this once at boot.

All backends rely on `cleanupExpiredSessions` as the garbage-collection path (cron-driven, typically once per day). DynamoDB deployments may skip the cron by enabling native TTL on `expires_at` out-of-band.

## Tested Backends

SQLite (no Docker) and JWT-mode tests run on every push.
Postgres / MySQL / MongoDB / DynamoDB-Local run via the module's
`docker-compose.yml`. The shared store suite (`_test/shared-store-suite.js`)
runs identical end-to-end coverage against every backend.

## Documentation

- `docs/push-notifications.md` - push API contract for a future push helper.
- `docs/integration-express.md` - end-to-end Express bootstrap + middleware.
- `docs/integration-lambda.md` - per-entity Lambda + JWT authorizer pattern.
