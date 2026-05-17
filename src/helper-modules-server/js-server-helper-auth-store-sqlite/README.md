# @superloomdev/js-server-helper-auth-store-sqlite

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-brightgreen.svg)](https://nodejs.org)

A SQLite-backed implementation of the [Auth](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-auth) module's storage contract. Plug it into the parent's `STORE` config; the Auth module's calling shape stays identical regardless of which storage backend is active. Part of [Superloom](https://superloom.dev).

## What This Is

A thin layer between the Auth parent module and a SQLite sessions table. SQLite runs in-process through Node's built-in `node:sqlite` module, so there is no external database to provision and no network round-trip on a query. The adapter is well suited to offline-first applications, single-node deployments, command-line tools, and ephemeral test fixtures; for high-concurrency production deployments the Postgres, MySQL, or MongoDB adapter is a better fit.

The adapter cannot stand alone. It is always loaded together with the Auth parent and the underlying [`js-server-helper-sql-sqlite`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-sql-sqlite) driver helper, and inherits whatever the driver helper provides (file-backed or `:memory:` mode, request-level timing, error envelopes).

## Why Use This Module

- **Library updates won't break your code.** When `node:sqlite` ships a breaking change, only this adapter and the [`sql-sqlite`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-sql-sqlite) driver helper need updating. Your application code and the Auth-module call sites stay exactly as they are.

- **Pre-tested at every release.** A full store-contract suite plus a full Auth-lifecycle integration suite run against an in-process `:memory:` SQLite database in CI on every push. Your project trusts the adapter instead of re-verifying session plumbing on each release.

- **Designed for human review.** The adapter is laid out as clearly-marked visual sections (section banners, short functions, scoped comments) so a reviewer can read it top to bottom and follow each store-contract method without ever getting lost in dense logic. Open `store.js` to see the structure.

- **Built-in observability.** Every store call is timed against the active request via `Lib.Debug.performanceAuditLog`, the same way every other Superloom helper does. Slow-store review and request profiling are built in. No instrumentation code to write.

- **Embedded persistence, no infrastructure.** Runs in-process. No external database to provision, no network to debug, no connection string to manage. The same adapter powers offline-first apps, single-node deployments, `:memory:` test fixtures, and edge runtimes. Schema creation (`setupNewStore`) and expired-row cleanup (`cleanupExpiredSessions`) are built in and work the same way as every sibling adapter. The schema, the index strategy, and the recommended cleanup cadence live in [`docs/schema.md`](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-auth-store-sqlite/docs/schema.md) and [`docs/cleanup.md`](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-auth-store-sqlite/docs/cleanup.md).

## Hot-Swappable with Other Backends

This adapter is part of the `auth-store-*` family. Every sibling implements the same store contract. Swap by changing one config value; the rest of your code keeps working.

- [`@superloomdev/js-server-helper-auth-store-postgres`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-auth-store-postgres) - PostgreSQL
- [`@superloomdev/js-server-helper-auth-store-mysql`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-auth-store-mysql) - MySQL or MariaDB
- [`@superloomdev/js-server-helper-auth-store-mongodb`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-auth-store-mongodb) - MongoDB
- [`@superloomdev/js-server-helper-auth-store-dynamodb`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-auth-store-dynamodb) - AWS DynamoDB

## Aligned with Superloom Philosophy

If your project is built on Superloom conventions (the same loader pattern, the same response envelopes, the same testing model), this adapter slots in without you needing to learn anything new. It is written using the same opinionated principles as the Auth parent and the `sql-sqlite` driver helper, so adopting it does not introduce inconsistency into your codebase.

If you are not yet using Superloom, the principles are documented at [superloom.dev](https://superloom.dev).

## Extended Documentation

- [API reference](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-auth-store-sqlite/docs/api.md). The store contract this adapter implements and the adapter factory protocol
- [Configuration](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-auth-store-sqlite/docs/configuration.md). `STORE_CONFIG` keys, peer dependencies, environment variables, testing tier
- [Schema](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-auth-store-sqlite/docs/schema.md). DDL, identifier quoting, boolean encoding, JSON encoding, UPSERT semantics, index strategy
- [Cleanup](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-auth-store-sqlite/docs/cleanup.md). SQLite has no native TTL; scheduled cleanup is required for file-backed deployments
- [Auth parent module](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-auth). The data model, error catalog, and Auth-side configuration this adapter plugs into
- [Superloom](https://superloom.dev). The framework

## Adding to Your Project

This adapter is installed alongside the Auth parent module and the `sql-sqlite` driver helper as peer dependencies through the standard Superloom loader. The canonical install command for the parent + adapter + driver triple lives in the Auth parent's [Adding to Your Project](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-auth#adding-to-your-project) section; substitute `auth-store-sqlite` for the adapter name and add `js-server-helper-sql-sqlite` to the install list.

Do not vendor the source or use it as a local file dependency. The published package is the supported integration path.

The loader pattern, including the full `Lib` container shape and how the adapter factory is passed to the Auth parent's `STORE` config key, is documented in [Server Loader Architecture](https://github.com/superloomdev/superloom/blob/main/docs/architecture/server/server-loader.md). For one-time GitHub Packages registry setup, see the [npmrc setup guide](https://github.com/superloomdev/superloom/blob/main/docs/dev/npmrc-setup.md).

## Testing Status

| Tier | Runtime | Status |
|---|---|---|
| Contract + Integration | SQLite (`:memory:`, in-process via `node:sqlite`) | [![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml) |

Tests run fully in-process; no Docker, no service to provision. Test runtime details live in [Configuration → Testing Tier](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-auth-store-sqlite/docs/configuration.md#testing-tier).

## License

MIT
