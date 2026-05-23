# @superloomdev/js-server-helper-logger-store-sqlite

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-brightgreen.svg)](https://nodejs.org) 

A SQLite-backed implementation of the [Logger](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-logger) module's storage contract. Plug it into the parent's `STORE` config; the Logger module's calling shape stays identical regardless of which storage backend is active. Part of [Superloom](https://superloom.dev).

## What This Is

A thin layer between the Logger parent module and a SQLite log table. SQLite runs in-process through Node's built-in `node:sqlite` module — no external database, no network round-trip. Well-suited for offline-first applications, single-node deployments, command-line audit trails, and ephemeral test fixtures.

The adapter cannot stand alone. It is always loaded together with the Logger parent and the [`js-server-helper-sql-sqlite`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-sql-sqlite) driver helper.

## Why Use This Module

- **Library updates won't break your code.** When `node:sqlite` ships a breaking change, only this adapter and the `sql-sqlite` driver helper need updating. Your application code and the Logger call sites stay exactly as they are.

- **Pre-tested at every release.** A full store-contract suite plus a full Logger-lifecycle integration suite run against an in-process `:memory:` SQLite database in CI on every push.

- **Embedded persistence, no infrastructure.** Runs in-process. No service to provision. Schema creation (`setupNewStore`) and expired-log cleanup (`cleanupExpiredLogs`) are built in.

- **Built-in observability.** Every store call is timed against the active request via `Lib.Debug`, the same way every other Superloom helper does.

- **Idempotent `addLog`.** Uses `INSERT ... ON CONFLICT ("sort_key") DO NOTHING`. Re-sending the same log record is always safe.

## Hot-Swappable with Other Backends

This adapter is part of the `logger-store-*` family. Every sibling implements the same store contract. Swap by changing one config value; the rest of your code keeps working.

- [`@superloomdev/js-server-helper-logger-store-postgres`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-logger-store-postgres) - PostgreSQL
- [`@superloomdev/js-server-helper-logger-store-mysql`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-logger-store-mysql) - MySQL or MariaDB
- [`@superloomdev/js-server-helper-logger-store-mongodb`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-logger-store-mongodb) - MongoDB
- [`@superloomdev/js-server-helper-logger-store-dynamodb`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-logger-store-dynamodb) - AWS DynamoDB

## Aligned with Superloom Philosophy

If your project is built on Superloom conventions (the same loader pattern, the same response envelopes, the same testing model), this adapter slots in without you needing to learn anything new.

## Extended Documentation

- [API reference](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-logger-store-sqlite/docs/api.md). The store contract this adapter implements and SQLite-specific semantics
- [Configuration](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-logger-store-sqlite/docs/configuration.md). `STORE_CONFIG` keys, peer dependencies, environment variables, testing tier
- [Schema](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-logger-store-sqlite/docs/schema.md). DDL, identifier quoting, index strategy, persistent vs. TTL records
- [Cleanup](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-logger-store-sqlite/docs/cleanup.md). SQLite has no native TTL; scheduled cleanup is required for file-backed deployments
- [Logger parent module](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-logger). The data model, error catalog, and Logger-side configuration this adapter plugs into

## Adding to Your Project

This adapter is installed alongside the Logger parent module and the `sql-sqlite` driver helper. The loader pattern is documented in the Logger parent's README.

Do not vendor the source or use it as a local file dependency. The published package is the supported integration path.

## Dependencies

This module has no external dependencies.

It expects three peer modules in the `Lib` container (Utils, Debug, SQLite). For the full dependency breakdown, see [`docs/configuration.md`](docs/configuration.md).

## Testing Status

| Tier | Runtime | Status |
|---|---|---|
| Contract + Integration | SQLite (`:memory:`, in-process via `node:sqlite`) | [![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml) |

Tests run fully in-process; no Docker, no service to provision. Test runtime details live in [Configuration → Testing Tier](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-logger-store-sqlite/docs/configuration.md#testing-tier).

## License

MIT


