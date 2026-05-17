# @superloomdev/js-server-helper-verify

[![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-brightgreen.svg)](https://nodejs.org)

One-time verification code lifecycle for Superloom applications. Three create interfaces (numeric pin, alphanumeric code, URL-safe token) over one shared flow, plus one `verify` function that consumes any of them. The storage backend is chosen at construction time through a pluggable Class F adapter. Part of the [Superloom](https://github.com/superloomdev/superloom) framework.

## What It Does

The verify module solves the one-time-code problem with three independent defenses against abuse:

- **Cooldown on creation.** A minimum gap between successive codes for the same `(scope, key)`. Prevents an attacker from flooding the delivery channel.
- **Expiry (TTL).** Codes become useless after `expires_at`, regardless of whether the cleanup sweep has run. The expiry check is enforced at consume time.
- **Per-record fail counter.** Too many wrong attempts and the code locks out (`VERIFY_MAX_FAILS`). The counter resets on every successful create.

A successful `verify(...)` deletes the record in the background, making the code strictly one-time. The same value cannot be re-submitted.

## Why

- **No string-dispatched backends.** The chosen storage adapter is passed as a factory function via `CONFIG.STORE`. Unused backends never get loaded, never pull their npm dependencies, and the module has no internal `switch (STORE) { ... }` block to maintain.
- **One factory call. One independent instance.** No singletons. Run multiple Verify instances in parallel if you need different cooldowns or charsets for different flows.
- **Cleanup is hygiene, not correctness.** The consume-time `instance.time > record.expires_at` check guarantees expired codes are rejected even when the sweep is delayed.
- **Three charsets for three surfaces.** Numeric pins for SMS, Crockford Base32 for spoken or printed codes (omits visually ambiguous characters), URL-safe alphanumeric for magic links. Same call shape; same `verify` function.

## Architecture Overview

```
Verify instance
 ├─ CONFIG.STORE         (store adapter factory, e.g. require('...verify-store-postgres'))
 ├─ CONFIG.STORE_CONFIG  (table_name / collection_name + lib_sql / lib_mongodb / lib_dynamodb)
 ├─ CONFIG.PIN_CHARSET   ('0123456789' by default)
 ├─ CONFIG.CODE_CHARSET  (Crockford Base32 by default)
 ├─ CONFIG.TOKEN_CHARSET ('a-zA-Z0-9' by default)
 └─ Store                (instantiated from CONFIG.STORE; reads/writes verification records)
```

`CONFIG.STORE` is the adapter factory function itself. You pass the result of `require(...)` directly, the same way you pass `Lib.Postgres` or `Lib.MongoDB` to other helpers. Every adapter uses the same `factory(Lib, CONFIG, ERRORS)` signature, so adding a new backend never changes the call-site code.

For the full data-model walk-through and design rationale, see [`docs/data-model.md`](docs/data-model.md). For per-backend index, TTL, and `STORE_CONFIG` details, see each adapter package's own README (linked below).

## Storage Adapters

Five storage adapters are available, each a separate package. Install only the one you need.

| Adapter | Backend |
|---|---|
| [`@superloomdev/js-server-helper-verify-store-sqlite`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-verify-store-sqlite) | SQLite (embedded, in-process) |
| [`@superloomdev/js-server-helper-verify-store-postgres`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-verify-store-postgres) | PostgreSQL |
| [`@superloomdev/js-server-helper-verify-store-mysql`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-verify-store-mysql) | MySQL or MariaDB |
| [`@superloomdev/js-server-helper-verify-store-mongodb`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-verify-store-mongodb) | MongoDB |
| [`@superloomdev/js-server-helper-verify-store-dynamodb`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-verify-store-dynamodb) | AWS DynamoDB |

**Pick the one that matches your application's database.** A Postgres-backed app uses `verify-store-postgres`, a MongoDB app uses `verify-store-mongodb`, and so on. The verify module's calling shape is identical across all five backends, so the choice is operational, not application-code.

A legitimate deviation is using a NoSQL adapter in a SQL-backed application when the verification table has different scaling characteristics from the rest of the app (very high write volume during user-onboarding bursts, short TTLs that benefit from native sweepers). Mixing SQL families (Postgres app with MySQL or SQLite verify) is not a useful pattern.

Each adapter package ships its own README with the backend-specific schema, indexes, TTL behaviour, IaC provisioning notes, and `STORE_CONFIG` shape. The verify module itself owns no per-backend documentation: every Class F adapter is the authoritative source for its own backend.

## Aligned with Superloom Philosophy

If your project is built on Superloom conventions (the same loader pattern, the same testing model, the same `instance`-first call shape), this module slots in without you needing to learn anything new. Every function takes `instance` as its first argument. The post-verify record delete uses `Lib.Instance.backgroundRoutine`.

If you are not yet using Superloom, the principles are documented at [superloom.dev](https://superloom.dev).

## Extended Documentation

- [API reference](docs/api.md). Every exported function with its signature, parameters, return shape, options, lifecycle, and error catalog
- [Configuration](docs/configuration.md). Loader pattern, every configuration key, charset overrides, per-backend `STORE_CONFIG` shape, peer dependencies, testing tier
- [Data model](docs/data-model.md). Every record field, core concepts (scope, key, cooldown, fail counter), scope-and-key design guide, design decisions
- [Runtime](docs/runtime.md). The runtime-shape differences for the verify module: post-verify background delete caveat in serverless, scheduled cleanup mechanism
- [Superloom](https://superloom.dev). The framework

## Adding to Your Project

Install this module **and** the one storage adapter you need as peer dependencies in your project's `package.json` and load them through the standard Superloom loader. Do not vendor the source or use it as a local file dependency. The published package is the supported integration path.

```bash
npm install @superloomdev/js-server-helper-verify \
            @superloomdev/js-server-helper-verify-store-postgres
```

Substitute `verify-store-postgres` with the adapter for your database. The full list is in the [Storage Adapters](#storage-adapters) section above; the `STORE_CONFIG` shape for each adapter is in the adapter package's own README.

The loader pattern, including the full `Lib` container shape, is documented in [Server Loader Architecture](https://github.com/superloomdev/superloom/blob/main/docs/architecture/server-loader.md). For one-time GitHub Packages registry setup, see the [npmrc setup guide](https://github.com/superloomdev/superloom/blob/main/docs/dev/npmrc-setup.md).

## Testing Status

| Tier | Runtime | Status |
|---|---|---|
| Unit (offline) | Node.js `node --test` against an in-process memory store | [![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml) |

The verify module's own tests use the in-process memory fixture (`_test/memory-store.js`) which implements the full six-method store contract (`setupNewStore`, `getRecord`, `setRecord`, `incrementFailCount`, `deleteRecord`, `cleanupExpiredRecords`). There is no Docker dependency in this package and no database driver is required. Integration tests for each storage backend live in the corresponding adapter package (`js-server-helper-verify-store-*`) and run the shared store-contract suite against real backends.

## License

MIT
