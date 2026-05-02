# js-server-helper-auth

Session lifecycle and authentication for Superloom. Multi-instance per
`actor_type`, with built-in storage adapters for Postgres, MySQL, SQLite,
DynamoDB, and MongoDB. Optional JWT mode (HS256) with single-use rotating
refresh tokens.

Documentation:
- [`docs/integration-express.md`](docs/integration-express.md) - Express bootstrap, middleware, login/refresh/logout endpoints.
- [`docs/integration-lambda.md`](docs/integration-lambda.md) - Per-entity Lambda + JWT authorizer pattern.
- [`docs/push-notifications.md`](docs/push-notifications.md) - Push API contract for a future push helper.

## Quick Start

```js
// loader.js (project)
const Lib = {};
Lib.Utils    = require('@superloomdev/js-helper-utils')(Lib, {});
Lib.Debug    = require('@superloomdev/js-helper-debug')(Lib, {});
Lib.Crypto   = require('@superloomdev/js-server-helper-crypto')(Lib, {});
Lib.Instance = require('@superloomdev/js-server-helper-instance')(Lib, {});

// One Auth instance per actor_type. Each gets its own table/collection
// and its own configuration. Below uses the in-memory store, which is
// for tests only.
Lib.AuthUser = require('@superloomdev/js-server-helper-auth')(Lib, {
  STORE: 'memory',
  STORE_CONFIG: {},
  ACTOR_TYPE: 'user',
  TTL_SECONDS: 2592000,
  LIMITS: {
    total_max: 20,
    by_form_factor_max: null,
    by_platform_max: null,
    evict_oldest_on_limit: true
  },
  COOKIE_PREFIX: 'sl_user_',
  ERRORS: {
    LIMIT_REACHED:        Lib.Errors.AUTH_LIMIT_REACHED,
    SESSION_NOT_FOUND:    Lib.Errors.AUTH_SESSION_NOT_FOUND,
    SESSION_EXPIRED:      Lib.Errors.AUTH_SESSION_EXPIRED,
    INVALID_TOKEN:        Lib.Errors.AUTH_INVALID_TOKEN,
    ACTOR_TYPE_MISMATCH:  Lib.Errors.AUTH_ACTOR_TYPE_MISMATCH,
    SERVICE_UNAVAILABLE:  Lib.Errors.SERVICE_UNAVAILABLE
  }
});
```

```js
// service layer
const result = await Lib.AuthUser.createSession(instance, {
  tenant_id: 'acme',
  actor_id: user.id,
  install_id: req.body.install_id,            // optional
  install_platform: 'web',
  install_form_factor: 'desktop',
  client_user_agent: req.headers['user-agent'],
  client_ip_address: req.ip
});
if (!result.success) {
  return result;        // Pass through directly to controller
}
// result.auth_id is the wire-format token; the cookie is also set.
```

## Public API

| Function | Purpose |
|---|---|
| `createSession(instance, options)` | Create a session for an actor; enforces limits + same-installation replacement. |
| `verifySession(instance, options)` | Validate inbound auth (header / bearer / cookie); hydrate `instance.session`. |
| `removeSession(instance, options)` | Logout one session by `(tenant_id, actor_id, token_key)`. |
| `removeOtherSessions(instance, options)` | "Log out everywhere else" — keeps the named token. |
| `removeAllSessions(instance, options)` | Logout every session for an actor; clears the cookie. |
| `listSessions(instance, options)` | Active sessions for an actor; powers the "Active devices" UI. |
| `countSessions(instance, options)` | Convenience count over `listSessions`. |
| `attachDeviceToSession(instance, options)` | Bind a push token to an existing session. |
| `detachDeviceFromSession(instance, options)` | Unbind the push token. |
| `listPushTargetsByActor(instance, options)` | List sessions with push tokens (push fan-out). |
| `initializeSessionStore(instance)` | Idempotent backend setup (tables, indexes, TTL). |
| `cleanupExpiredSessions(instance)` | Sweep expired rows (cron-driven). |
| `createAuthId({ actor_id, token_key, token_secret })` | Pure helper. |
| `parseAuthId(auth_id)` | Pure helper; returns `null` on malformed input. |

### JWT mode (only when `ENABLE_JWT=true`)

| Function | Purpose |
|---|---|
| `verifyJwt(instance, options)` | Stateless verification of an access JWT (no DB read). |
| `signSessionJwt(instance, options)` | Mint a fresh access JWT for an existing session. |
| `refreshSessionJwt(instance, options)` | Single-use refresh-token rotation; mints new access + new refresh. |

## Multi-Instance Per Actor Type

Each `require(...)(Lib, config)` call returns an independent Auth instance
bound to one `actor_type`, one storage backend, and one CONFIG. Use this
pattern when you have distinct kinds of actors with different lifetime,
capacity, or storage policies:

```js
Lib.AuthUser     = AuthLoader(Lib, { ACTOR_TYPE: 'user',     ... });
Lib.AuthAdmin    = AuthLoader(Lib, { ACTOR_TYPE: 'admin',    ... });   // shorter TTL, stricter limits
Lib.AuthMerchant = AuthLoader(Lib, { ACTOR_TYPE: 'merchant', ... });   // separate table; per-tenant audit
```

Sessions never cross actor types: each instance writes to its own
`sessions_{actor_type}` table/collection, and `verifySession` rejects any
record whose `actor_type` doesn't match `CONFIG.ACTOR_TYPE` (defense in
depth against table mis-pointing).

## Multi-Session Limits

`createSession` runs the **list-then-filter** policy on every call:

1. Load all existing sessions for `(tenant_id, actor_id)` (one indexed query).
2. Drop expired sessions; ignore them.
3. **Same-installation replacement:** if `install_id` is provided and matches an
   existing session, that session is queued for deletion before any cap check.
4. Apply caps in order: `total_max`, `by_form_factor_max`, `by_platform_max`.
   Each cap is independent; per-tier maps default to `null` (unlimited).
5. When a cap is hit:
   - `evict_oldest_on_limit: true`  → silently evict the LRU session within
     the violated tier.
   - `evict_oldest_on_limit: false` → return `LIMIT_REACHED` error.
6. Batch-delete the queued sessions, then insert the new one.

This same pattern works uniformly across all five backends with no
backend-specific tricks. No per-installation index is required.

## JWT Mode (Phase 5)

When `ENABLE_JWT: true`:
- `createSession` returns both `auth_id` (refresh token) and `access_jwt`.
- `verifySession` accepts an access JWT, validates it without a DB hit.
- `refreshSessionJwt(instance, options)` exchanges the refresh token for a
  new pair, rotating the refresh token (RFC 6819).
- Revocation latency for any single device equals `JWT.access_token_ttl_seconds`
  (default 15 min) — this is a fundamental property of stateless JWTs and
  cannot be made instant without giving up the JWT's stateless benefit.

In Phase 1, `ENABLE_JWT: true` throws at loader time.

## Storage Backends

| Backend | Status | Native TTL | Cleanup mechanism |
|---|---|---|---|
| `memory` | Phase 1 ✓ (test only) | n/a | Manual via `cleanupExpiredSessions` |
| `postgres` | Phase 3 | No | `cleanupExpiredSessions` cron |
| `mysql` | Phase 3 | No | `cleanupExpiredSessions` cron |
| `sqlite` | Phase 3 | No | `cleanupExpiredSessions` cron |
| `dynamodb` | Phase 4 | Yes (TTL attribute) | Built-in |
| `mongodb` | Phase 4 | Yes (TTL index) | Built-in |

Each backend's per-table schema is documented in `docs/schema-{backend}.md`
(arriving in the corresponding phase).

## Compatibility

- Node.js 24+
- ESLint 9+
- No production dependencies (except the chosen `lib_*` driver helper).

## Testing

```bash
cd _test
npm install
npm test
```

The unit suite covers:
- Loader validation (every required CONFIG key)
- Pure helpers (`auth-id`, `record-shape`, `cookie`, `token-source`)
- Pure policy (`policy.js`) — every cap and eviction path
- End-to-end lifecycle (`createSession` → `verifySession` → `removeSession`)
- Same-installation replacement
- Limits (`evict_oldest_on_limit` true / false)
- `attachDeviceToSession` / `detachDeviceFromSession`
- `cleanupExpiredSessions`

All offline; no Docker required. Integration tests against real backends
arrive in Phases 3–4 under `_test/integration/`.

## License

MIT
