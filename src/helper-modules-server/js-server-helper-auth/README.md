# @superloomdev/js-server-helper-auth

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-brightgreen.svg)](https://nodejs.org)

A session-lifecycle and authentication module for Node.js servers that ships pre-tested, runs on any of five storage backends, and offers an optional stateless-JWT mode. Part of [Superloom](https://superloom.dev). 

## What This Is

A complete authentication feature module. One loader call returns one independent Auth instance bound to one `actor_type`, one storage backend, and one configuration. Different actor types (`user`, `admin`, `merchant`, ...) coexist in the same process with independent session policies, table or collection names, cookies, and TTLs.

Two operating modes share the same public surface:

- **DB-mode** (default). Every `verifySession` reads the store. Session revocation is immediate. The cookie or `Authorization: Bearer <auth_id>` header is the credential.
- **JWT-mode** (`ENABLE_JWT: true`). `verifyJwt` is a stateless HS256 check that does not read the store. A single-use rotating refresh token (RFC 6819) extends the session. Access-token revocation latency is bounded by `JWT.access_token_ttl_seconds`.

Storage backends are independent packages. Install only the adapter for the database you use. The module's contract is the same across all five: every adapter implements the eight-method store interface and returns the canonical session record shape.

## Why Use This Module

- **One module, five storage backends.** SQLite, PostgreSQL, MySQL, MongoDB, AWS DynamoDB. The calling shape is identical across all of them. Swap backend by changing one config value; no rewrite of business logic.

- **Library updates won't break your code.** When an upstream driver or AWS SDK ships a breaking change, only the adapter package needs updating. Your application code stays exactly as it is.

- **Pre-tested at every release.** A shared store contract suite (`_test/store-contract-suite.js`) runs every adapter through the same end-to-end coverage on every push. Auth's own unit tests use an in-process memory fixture, so the package itself runs offline. Your project trusts the wrapper instead of re-verifying session plumbing on each release.

- **Designed for human review.** The code is laid out as clearly-marked visual sections (section banners, short functions, scoped comments) and split into single-purpose `parts/` helpers (policy, auth-id, cookie, jwt, token-source, record-shape). A reviewer can read the entry-point top to bottom and follow the dispatches without ever getting lost in dense logic. Open `auth.js` and `parts/` to see the structure.

- **Built-in observability.** Every store call is timed against the active request via `Lib.Debug.performanceAuditLog`. Slow-store review, request profiling, and the toggle to silence it in production are all built in. No instrumentation code to write.

## Architecture Overview

Auth is a **factory module**. Each `require()(Lib, config)` call returns a fully independent Auth interface bound to one actor type, one store, and one configuration. Multiple instances coexist in the same process and share no state.

```
Auth instance
 ├─ CONFIG.STORE         (store adapter factory, e.g. require('...auth-store-postgres'))
 ├─ CONFIG.STORE_CONFIG  (table_name / collection_name + lib_sql / lib_mongodb / lib_dynamodb)
 ├─ CONFIG.ACTOR_TYPE    ('user', 'admin', 'merchant', ...)
 ├─ parts/               (stateless helpers: policy, auth-id, cookie, jwt, token-source, ...)
 └─ Store                (instantiated from CONFIG.STORE; reads/writes sessions)
```

`CONFIG.STORE` is the adapter factory function itself. You pass the result of `require(...)` directly, the same way you pass `Lib.Postgres` or `Lib.MongoDB` to other helpers. Every adapter (and every internal `parts/` helper) uses the same `factory(Lib, CONFIG, ERRORS)` signature, so adding a new backend never changes the call-site code.

For the full data-model walk-through and design rationale, see [`docs/data-model.md`](docs/data-model.md). For per-backend index, TTL, and `STORE_CONFIG` details, see each adapter package's own README (linked below).

## Storage Adapters

Five storage adapters are available, each a separate package. Install only the one you need.

| Adapter | Backend |
|---|---|
| [`@superloomdev/js-server-helper-auth-store-sqlite`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-auth-store-sqlite) | SQLite (embedded, in-process) |
| [`@superloomdev/js-server-helper-auth-store-postgres`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-auth-store-postgres) | PostgreSQL |
| [`@superloomdev/js-server-helper-auth-store-mysql`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-auth-store-mysql) | MySQL or MariaDB |
| [`@superloomdev/js-server-helper-auth-store-mongodb`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-auth-store-mongodb) | MongoDB |
| [`@superloomdev/js-server-helper-auth-store-dynamodb`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-auth-store-dynamodb) | AWS DynamoDB |

**Pick the one that matches your application's database.** A Postgres-backed app uses `auth-store-postgres`, a MongoDB app uses `auth-store-mongodb`, and so on. The auth module's calling shape is identical across all five backends, so the choice is operational, not application-code.

A legitimate deviation is using a NoSQL adapter for auth in a SQL-backed application when sessions need different scaling characteristics from the rest of the app (burstiness, serverless cold-start, compliance segregation). Mixing SQL families (Postgres app with MySQL or SQLite auth) is not a useful pattern.

Each adapter package ships its own README with the backend-specific schema, indexes, TTL behaviour, IaC provisioning notes, and `STORE_CONFIG` shape. The auth module itself owns no per-backend documentation: every Class F adapter is the authoritative source for its own backend.

## Aligned with Superloom Philosophy

If your project is built on Superloom conventions (the same loader pattern, the same testing model, the same `instance`-first call shape), this module slots in without you needing to learn anything new. Every function takes `instance` as its first argument and routes its store calls through `Lib.Debug.performanceAuditLog`.

If you are not yet using Superloom, the principles are documented at [superloom.dev](https://superloom.dev).

## Extended Documentation

- [API reference](docs/api.md). Every exported function with its signature, parameters, return shape, options, and error types. DB-mode and JWT-mode functions side by side
- [Configuration](docs/configuration.md). Loader pattern, every configuration key, per-backend `STORE_CONFIG` shape, peer dependencies, testing tiers
- [Data model](docs/data-model.md). Every session-record field, the design decisions behind the composite primary key, the throttled `last_active_at` refresh, and the `custom_data` extension point
- [Runtime](docs/runtime.md). The two or three concrete differences between running the auth module in a persistent-server runtime and a serverless-function runtime
- [Push notifications](docs/push-notifications.md). The push-token contract the auth module exposes for a future `js-server-helper-push` to consume
- [Superloom](https://superloom.dev). The framework

## Adding to Your Project

Install this module **and** the one storage adapter you need as peer dependencies in your project's `package.json` and load them through the standard Superloom loader. Do not vendor the source or use it as a local file dependency. The published package is the supported integration path.

```bash
npm install @superloomdev/js-server-helper-auth \
            @superloomdev/js-server-helper-auth-store-postgres
```

Substitute `auth-store-postgres` with the adapter for your database. The full list is in the [Storage Adapters](#storage-adapters) section above; the `STORE_CONFIG` shape for each adapter is in the adapter package's own README.

The loader pattern, including the full `Lib` container shape, is documented in [Server Loader Architecture](https://github.com/superloomdev/superloom/blob/main/docs/server/server-loader.md). For one-time GitHub Packages registry setup, see the [npmrc setup guide](https://github.com/superloomdev/superloom/blob/main/docs/dev/npmrc-setup.md).

## Dependencies

This module has no external dependencies.

It expects four peer modules in the `Lib` container (Utils, Debug, Crypto, Instance) and one optional peer adapter package for your storage backend. For the full dependency breakdown, see [`docs/configuration.md`](docs/configuration.md).

## Testing Status

| Tier | Runtime | Status |
|---|---|---|
| Unit (offline) | Node.js `node --test` against an in-process memory store | [![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml) |

Auth's own tests use the in-process memory fixture (`createInMemoryAuthStore()` in `_test/`) which implements the full eight-method store contract. There is no Docker dependency in this package and no database driver is required. Integration tests for each storage backend live in the corresponding adapter package (`js-server-helper-auth-store-*`) and run the shared store contract suite against real backends.

Test runtime details live in [Configuration → Testing Tiers](docs/configuration.md#testing-tiers).

## License

MIT
