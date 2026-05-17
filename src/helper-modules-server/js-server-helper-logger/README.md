# @superloomdev/js-server-helper-logger

[![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-brightgreen.svg)](https://nodejs.org)

Compliance-friendly action log for Superloom applications. One immutable row per log-worthy event records *who* acted (`actor_type` / `actor_id`), *on what* (`entity_type` / `entity_id`), doing *which* action (dot-notation string), with structured per-action `data` and optional IP / user-agent capture for regulator-facing audit trails. The storage backend is chosen at construction time through a pluggable Class F adapter. Part of the [Superloom](https://github.com/superloomdev/superloom) framework.

## What It Does

The logger solves three problems every audit-logging surface faces, in one module:

- **Don't block the request.** `log()` returns immediately by default. The row commits asynchronously via `Lib.Instance.backgroundRoutine`. Compliance callers opt in to durable writes with `options.await: true`.
- **Mix retention policies in one table.** Every row is either `'persistent'` (never deleted) or `{ ttl_seconds: N }` (auto-deleted at `created_at + N`). A single table happily mixes forever-rows ("user created") with short-retention rows ("login event").
- **Encrypt sensitive data at rest.** Set `CONFIG.IP_ENCRYPT_KEY` and IP addresses are AES-encrypted transparently. Audit reviewers still see the data; attackers with database access see only ciphertext.

## Why

- **No string-dispatched backends.** The chosen storage adapter is passed as a factory function via `CONFIG.STORE`. Unused backends never get loaded, never pull their npm dependencies, and the module has no internal `switch (STORE) { ... }` block to maintain.
- **One factory call. One independent instance.** No singletons. Run multiple Logger instances in the same process if you genuinely need to (rare; one suffices for almost every project).
- **No correctness dependency on cleanup.** List queries return whatever rows exist. If the cleanup cron is paused for a week, queries still work; expired rows are just included until the next sweep.
- **Out-of-scope by design.** The logger is not a metrics system, not a structured request logger, not a notification dispatcher. It records audit-trail events. [`Lib.Debug`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-core/js-helper-debug), Datadog / Prometheus, and your own notification surface handle the rest.

## Architecture Overview

```
Logger instance
 ├─ CONFIG.STORE         (store adapter factory, e.g. require('...logger-store-postgres'))
 ├─ CONFIG.STORE_CONFIG  (table_name / collection_name + lib_sql / lib_mongodb / lib_dynamodb)
 ├─ CONFIG.IP_ENCRYPT_KEY (optional AES key)
 └─ Store                (instantiated from CONFIG.STORE; reads/writes log rows)
```

`CONFIG.STORE` is the adapter factory function itself. You pass the result of `require(...)` directly, the same way you pass `Lib.Postgres` or `Lib.MongoDB` to other helpers. Every adapter uses the same `factory(Lib, CONFIG, ERRORS)` signature, so adding a new backend never changes the call-site code.

For the full data-model walk-through and design rationale, see [`docs/data-model.md`](docs/data-model.md). For per-backend index, TTL, and `STORE_CONFIG` details, see each adapter package's own README (linked below).

## Storage Adapters

Five storage adapters are available, each a separate package. Install only the one you need.

| Adapter | Backend |
|---|---|
| [`@superloomdev/js-server-helper-logger-store-sqlite`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-logger-store-sqlite) | SQLite (embedded, in-process) |
| [`@superloomdev/js-server-helper-logger-store-postgres`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-logger-store-postgres) | PostgreSQL |
| [`@superloomdev/js-server-helper-logger-store-mysql`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-logger-store-mysql) | MySQL or MariaDB |
| [`@superloomdev/js-server-helper-logger-store-mongodb`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-logger-store-mongodb) | MongoDB |
| [`@superloomdev/js-server-helper-logger-store-dynamodb`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-logger-store-dynamodb) | AWS DynamoDB |

**Pick the one that matches your application's database.** A Postgres-backed app uses `logger-store-postgres`, a MongoDB app uses `logger-store-mongodb`, and so on. The logger module's calling shape is identical across all five backends, so the choice is operational, not application-code.

A legitimate deviation is using a NoSQL adapter in a SQL-backed application when the audit log has different scaling characteristics from the rest of the app (very high write volume, append-only access pattern, separate retention policies). Mixing SQL families (Postgres app with MySQL or SQLite logger) is not a useful pattern.

Each adapter package ships its own README with the backend-specific schema, indexes, TTL behaviour, IaC provisioning notes, and `STORE_CONFIG` shape. The logger module itself owns no per-backend documentation: every Class F adapter is the authoritative source for its own backend.

## Aligned with Superloom Philosophy

If your project is built on Superloom conventions (the same loader pattern, the same testing model, the same `instance`-first call shape), this module slots in without you needing to learn anything new. Every function takes `instance` as its first argument and routes its store calls through `Lib.Debug.performanceAuditLog`. Background writes use `Lib.Instance.backgroundRoutine`.

If you are not yet using Superloom, the principles are documented at [superloom.dev](https://superloom.dev).

## Extended Documentation

- [API reference](docs/api.md). Every exported function with its signature, parameters, return shape, options, and error catalog
- [Configuration](docs/configuration.md). Loader pattern, every configuration key, per-backend `STORE_CONFIG` shape, IP-encryption key handling, peer dependencies, testing tier
- [Data model](docs/data-model.md). Every record field, core concepts (entity, actor, scope, action), the `sort_key` design, retention quick reference, design decisions
- [Runtime](docs/runtime.md). The runtime-shape differences for the logger: background-write lifecycle in serverless versus persistent server, scheduled cleanup mechanism
- [Superloom](https://superloom.dev). The framework

## Adding to Your Project

Install this module **and** the one storage adapter you need as peer dependencies in your project's `package.json` and load them through the standard Superloom loader. Do not vendor the source or use it as a local file dependency. The published package is the supported integration path.

```bash
npm install @superloomdev/js-server-helper-logger \
            @superloomdev/js-server-helper-logger-store-postgres
```

Substitute `logger-store-postgres` with the adapter for your database. The full list is in the [Storage Adapters](#storage-adapters) section above; the `STORE_CONFIG` shape for each adapter is in the adapter package's own README.

The loader pattern, including the full `Lib` container shape, is documented in [Server Loader Architecture](https://github.com/superloomdev/superloom/blob/main/docs/server/server-loader.md). For one-time GitHub Packages registry setup, see the [npmrc setup guide](https://github.com/superloomdev/superloom/blob/main/docs/dev/npmrc-setup.md).

## Testing Status

| Tier | Runtime | Status |
|---|---|---|
| Unit (offline) | Node.js `node --test` against an in-process memory store | [![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml) |

The logger module's own tests use the in-process memory fixture (`_test/memory-store.js`) which implements the full five-method store contract (`setupNewStore`, `addLog`, `getLogsByEntity`, `getLogsByActor`, `cleanupExpiredLogs`). There is no Docker dependency in this package and no database driver is required. Integration tests for each storage backend live in the corresponding adapter package (`js-server-helper-logger-store-*`) and run the shared store-contract suite against real backends.

## License

MIT
