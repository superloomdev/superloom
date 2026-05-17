# Configuration. `js-server-helper-auth`

Loader pattern, every configuration key, the per-backend `STORE_CONFIG` shape, peer dependencies, and the testing tier. For the function reference see [API Reference](api.md). For backend selection criteria see the [Storage Adapters](../README.md#storage-adapters) section in the module README.

## On This Page

- [Loader Pattern](#loader-pattern)
- [Configuration Keys](#configuration-keys)
- [`STORE_CONFIG` by Backend](#store_config-by-backend)
- [JWT Mode](#jwt-mode)
- [Cookie Options](#cookie-options)
- [Limit Policy](#limit-policy)
- [Environment Variables](#environment-variables)
- [Peer Dependencies](#peer-dependencies)
- [Direct Dependencies](#direct-dependencies)
- [Testing Tiers](#testing-tiers)

---

## Loader Pattern

The module is a factory. Each `require(...)(Lib, config)` call returns an independent public interface bound to one `actor_type`, one store, and one configuration. Two simultaneous instances (e.g. one for `user` sessions and one for `admin` sessions) share no state.

```javascript
Lib.AuthUser = require('@superloomdev/js-server-helper-auth')(Lib, {
  STORE:        require('@superloomdev/js-server-helper-auth-store-postgres'),
  STORE_CONFIG: { table_name: 'sessions_user', lib_sql: Lib.Postgres },
  ACTOR_TYPE:   'user',
  TTL_SECONDS:  2592000,
  LIMITS:       { total_max: 20, evict_oldest_on_limit: true },
  COOKIE_PREFIX: 'sl_user_'
});
```

Loader call semantics:

- **First argument: `Lib`.** A container exposing peer modules. Auth reads `Lib.Utils` (type checks, validation), `Lib.Debug` (logging, performance audit), `Lib.Crypto` (token generation, SHA-256 hashing), and `Lib.Instance` (request lifecycle, `instance.time`). The chosen store adapter brings its own peer requirement on the corresponding driver module (`Lib.Postgres`, `Lib.MongoDB`, etc.).
- **Second argument: config overrides.** Merged on top of `auth.config.js` defaults. Required keys (`STORE`, `STORE_CONFIG`, `ACTOR_TYPE`) throw `TypeError` at loader time when absent. JWT-required keys (`JWT.signing_key`, `JWT.issuer`, `JWT.audience`) throw at loader time when `ENABLE_JWT: true` and they are still `null`.
- **One instance per `actor_type`.** Calling the loader twice with the same `ACTOR_TYPE` and a different `TTL_SECONDS` is allowed but rarely useful. The common pattern is one loader call per actor type, with each instance scoped to a different `table_name` or `collection_name`.

```javascript
// Two actor types, two policies, one process.
Lib.AuthUser  = require('...auth')(Lib, { ACTOR_TYPE: 'user',  STORE_CONFIG: { table_name: 'sessions_user',  ... }, TTL_SECONDS: 2592000, ... });
Lib.AuthAdmin = require('...auth')(Lib, { ACTOR_TYPE: 'admin', STORE_CONFIG: { table_name: 'sessions_admin', ... }, TTL_SECONDS: 3600,    ... });
```

Sessions never cross actor types. The stored `actor_type` is verified on every `verifySession` call (defense-in-depth against misconfigured table pointers).

---

## Configuration Keys

All keys are merged over `auth.config.js` defaults. Keys with a `null` default are **required** and throw at loader time if absent.

| Key | Type | Default | Required | Description |
|---|---|---|---|---|
| `STORE` | `Function` | `null` | Yes | The store adapter factory function. Pass the result of `require('@superloomdev/js-server-helper-auth-store-*')` directly. **The value must be a function, not a string.** Strings will be rejected at loader time |
| `STORE_CONFIG` | `object` | `null` | Yes | Adapter-specific config. Shape varies by backend. See [`STORE_CONFIG` by Backend](#store_config-by-backend) |
| `ACTOR_TYPE` | `string` | `null` | Yes | Non-empty string naming the kind of actor (`'user'`, `'admin'`, `'merchant'`, ...). Stamped on every record and verified on every read |
| `TTL_SECONDS` | `number` | `2592000` (30 days) | No | Session lifetime in seconds. `expires_at` rolls forward by `TTL_SECONDS` on each throttled activity refresh |
| `LAST_ACTIVE_UPDATE_INTERVAL_SECONDS` | `number` | `600` (10 min) | No | Minimum gap between `last_active_at` write-backs. Prevents one DB write per request on busy actors |
| `LIMITS` | `object` | `{ total_max: 20, by_form_factor_max: null, by_platform_max: null, evict_oldest_on_limit: true }` | No | Session-limit policy. See [Limit Policy](#limit-policy) |
| `ENABLE_JWT` | `boolean` | `false` | No | Enable JWT mode. When `true`, `JWT.signing_key`, `JWT.issuer`, and `JWT.audience` become required |
| `JWT` | `object` | See [JWT Mode](#jwt-mode) | When `ENABLE_JWT: true` | JWT signing and lifetime settings |
| `COOKIE_PREFIX` | `string` | `null` | When using cookies | Cookie name prefix. Full cookie name is `${COOKIE_PREFIX}${tenant_id}`. Required for any flow that reads or writes cookies |
| `COOKIE_OPTIONS` | `object` | `{ http_only: true, secure: true, same_site: 'lax', path: '/' }` | No | Cookie attributes applied to every `Set-Cookie` written by this instance. See [Cookie Options](#cookie-options) |

---

## `STORE_CONFIG` by Backend

Each adapter validates its own `STORE_CONFIG` keys. The shape is documented here for cross-reference; the canonical source is each adapter package's README.

| Adapter | Required keys | Notes |
|---|---|---|
| `auth-store-sqlite` | `table_name`, `lib_sql` | `lib_sql` is a `Lib.SQLite` instance |
| `auth-store-postgres` | `table_name`, `lib_sql` | `lib_sql` is a `Lib.Postgres` instance |
| `auth-store-mysql` | `table_name`, `lib_sql` | `lib_sql` is a `Lib.MySQL` instance |
| `auth-store-mongodb` | `collection_name`, `lib_mongodb` | `lib_mongodb` is a `Lib.MongoDB` instance |
| `auth-store-dynamodb` | `table_name`, `lib_dynamodb` | `lib_dynamodb` is a `Lib.DynamoDB` instance |

Example: Postgres

```javascript
STORE_CONFIG: {
  table_name: 'sessions_user',
  lib_sql:    Lib.Postgres
}
```

Example: MongoDB

```javascript
STORE_CONFIG: {
  collection_name: 'sessions_user',
  lib_mongodb:     Lib.MongoDB
}
```

---

## JWT Mode

Enable with `ENABLE_JWT: true`. When enabled, `createSession` additionally returns `access_token` and `refresh_token`, and the three JWT functions (`verifyJwt`, `signSessionJwt`, `refreshSessionJwt`) become available.

| `JWT.*` key | Type | Default | Required when `ENABLE_JWT: true` | Description |
|---|---|---|---|---|
| `signing_key` | `string` | `null` | Yes | HMAC secret. Minimum 32 characters for HS256 security. Loaded from a secret store, never committed |
| `algorithm` | `string` | `'HS256'` | No | Only `HS256` is currently supported (Node's native crypto) |
| `issuer` | `string` | `null` | Yes | JWT `iss` claim |
| `audience` | `string` | `null` | Yes | JWT `aud` claim |
| `access_token_ttl_seconds` | `number` | `900` (15 min) | No | Access token lifetime |
| `refresh_token_ttl_seconds` | `number` | `2592000` (30 days) | No | Refresh token lifetime. Also drives `expires_at` on the session record in JWT mode |
| `rotate_refresh_token` | `boolean` | `true` | No | Rotate the refresh token on every `refreshSessionJwt` call. RFC 6819 best practice |

**Revocation latency.** Access tokens remain valid until `JWT.access_token_ttl_seconds` elapses after logout. This is inherent to stateless JWTs. Reduce `access_token_ttl_seconds` to tighten the window. Set `ENABLE_JWT: false` to eliminate it entirely.

**Refresh token replay protection.** When `rotate_refresh_token: true` (the default), the stored `refresh_token_hash` is rotated on every refresh. A second use of an already-rotated token returns `INVALID_TOKEN`. The optional `refresh_family_id` is reserved for future token-family replay detection.

---

## Cookie Options

| `COOKIE_OPTIONS.*` key | Type | Default | Description |
|---|---|---|---|
| `http_only` | `boolean` | `true` | Sets the `HttpOnly` attribute. Prevents JS access to the cookie |
| `secure` | `boolean` | `true` | Sets the `Secure` attribute. Cookie is only sent over HTTPS |
| `same_site` | `string` | `'lax'` | Sets the `SameSite` attribute. `'lax'`, `'strict'`, or `'none'` |
| `path` | `string` | `'/'` | Cookie `Path` attribute |

`COOKIE_PREFIX` is set separately at the top level of `CONFIG`. The full cookie name is `${COOKIE_PREFIX}${tenant_id}`, so two tenants on the same domain do not collide.

---

## Limit Policy

`createSession` runs the list-then-filter policy before every insert.

| `LIMITS.*` key | Type | Default | Description |
|---|---|---|---|
| `total_max` | `number` | `20` | Hard cap on total active sessions per actor per tenant |
| `by_form_factor_max` | `object \| null` | `null` | Per-form-factor cap map, e.g. `{ mobile: 3 }`. `null` means unlimited. Partial maps cap only listed keys |
| `by_platform_max` | `object \| null` | `null` | Per-platform cap map, e.g. `{ ios: 2, android: 2 }` |
| `evict_oldest_on_limit` | `boolean` | `true` | When a cap is hit: `true` evicts the LRU session within the violated tier; `false` returns `LIMIT_REACHED` |

The policy algorithm:

1. Load all existing sessions for `(tenant_id, actor_id)`. One indexed read.
2. Filter out expired sessions (they count for nothing).
3. **Same-installation replacement.** If `install_id` is provided and matches an active session's `install_id`, that session is queued for deletion regardless of caps.
4. Check `total_max`. If hit, evict LRU across all sessions, or return `LIMIT_REACHED`.
5. Check `by_form_factor_max[install_form_factor]` if configured. Same evict-or-reject logic within the form-factor bucket.
6. Check `by_platform_max[install_platform]` if configured. Same logic within the platform bucket.
7. Batch-delete all queued evictions in one round-trip, then insert the new session.

No per-installation database index is required. The per-actor query is the only read; policy enforcement is in-process.

---

## Environment Variables

The auth module itself reads no environment variables. All configuration flows through the loader's second argument. Adapter packages may read environment variables (typically AWS region or database connection strings via the underlying driver helper); see each adapter's README.

---

## Peer Dependencies

| Package | Purpose |
|---|---|
| `@superloomdev/js-helper-utils` | Type checks, validation, sanitization (`Lib.Utils`) |
| `@superloomdev/js-helper-debug` | Structured logging, performance audit (`Lib.Debug`) |
| `@superloomdev/js-server-helper-crypto` | Token generation (UUID, random hex strings), SHA-256 hashing, HMAC for JWT (`Lib.Crypto`) |
| `@superloomdev/js-server-helper-instance` | Per-request lifecycle, `instance.time`, background routines (`Lib.Instance`) |

The chosen storage adapter package brings its own peer dependency on the relevant database driver helper (`js-server-helper-sql-postgres`, `js-server-helper-nosql-mongodb`, `js-server-helper-nosql-aws-dynamodb`, ...).

---

## Direct Dependencies

None. The module's `package.json` declares no `dependencies`. JWT signing and verification use Node's built-in `crypto` module (consumed indirectly via `Lib.Crypto`). The supply chain you audit ends at this package and its four peers plus the chosen adapter.

---

## Testing Tiers

The auth module's own tests are **fully offline**. They use an in-process memory store fixture (`createInMemoryAuthStore()` in `_test/`) that implements the full eight-method store contract without any real backend. There is no Docker dependency in this package and no database driver is required to run them.

| Tier | Runtime | When to run | CI Status |
|---|---|---|---|
| **Unit (offline)** | Node.js `node --test` against the in-process memory store | Every commit, every CI run | [![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml) |

```bash
cd _test && npm install && npm test
```

Coverage:

- Loader validation. Every required config key. `STORE` must be a function. JWT-mode required keys
- Pure helpers. `auth-id`, `record-shape`, `cookie`, `token-source`
- Pure policy. Every cap tier. LRU eviction. `evict_oldest_on_limit: false` path. Same-installation replacement priority
- JWT mode. `createSession` issuance. `verifyJwt`. `refreshSessionJwt` rotation and single-use enforcement. Expiry. Cross-actor-type rejection

**Shared store contract suite.** `_test/store-contract-suite.js` contains the end-to-end coverage that every adapter runs against its real backend. It is **not exported** from the auth package. Each adapter ships its own copy as a local file in its own `_test/` directory. The copy acts as a snapshot of the exact contract shape the adapter was built against, making version-compatibility audits straightforward.

Integration tests for each storage backend live in the corresponding adapter package (`js-server-helper-auth-store-*`). Those packages have their own `docker-compose.yml` (where needed) and run real network round-trips against PostgreSQL, MySQL, MongoDB, DynamoDB Local, or in-process SQLite.

For the framework-wide testing architecture see [Module Testing](https://github.com/superloomdev/superloom/blob/main/docs/architecture/module-testing.md).
