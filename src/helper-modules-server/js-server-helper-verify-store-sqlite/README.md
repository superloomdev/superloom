# @superloomdev/js-server-helper-verify-store-sqlite

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-brightgreen.svg)](https://nodejs.org)

A SQLite-backed implementation of the [Verify](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-verify) module's storage contract. Plug it into the parent's `STORE` config; the Verify module's calling shape stays identical regardless of which storage backend is active. Part of [Superloom](https://superloom.dev).

## What This Is

A thin layer between the Verify parent module and a SQLite verification table. SQLite runs in-process through Node's built-in `node:sqlite` module, so there is no external database to provision and no network round-trip on a query. The adapter is well suited to offline-first applications, single-node deployments, command-line tools, and ephemeral test fixtures; for high-concurrency production deployments the Postgres, MySQL, or MongoDB adapter is a better fit.

The adapter cannot stand alone. It is always loaded together with the Verify parent and the underlying [`js-server-helper-sql-sqlite`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-sql-sqlite) driver helper.

## Why Use This Module

- **Library updates won't break your code.** When `node:sqlite` ships a breaking change, only this adapter and the `sql-sqlite` driver helper need updating. Your application code and the Verify-module call sites stay exactly as they are.

- **Pre-tested at every release.** A full store-contract suite plus a full Verify-lifecycle integration suite run against an in-process `:memory:` SQLite database in CI on every push. Your project trusts the adapter instead of re-verifying code plumbing on each release.

- **Designed for human review.** The adapter is laid out as clearly-marked visual sections so a reviewer can read it top to bottom and follow each store-contract method without getting lost in dense logic.

- **Built-in observability.** Every store call is timed against the active request via `Lib.Debug`, the same way every other Superloom helper does.

- **Embedded persistence, no infrastructure.** Runs in-process. No external database to provision, no network to debug, no connection string to manage. Schema creation (`setupNewStore`) and expired-record cleanup (`cleanupExpiredRecords`) are built in. The schema, index strategy, and recommended cleanup cadence live in [`docs/schema.md`](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-verify-store-sqlite/docs/schema.md) and [`docs/cleanup.md`](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-verify-store-sqlite/docs/cleanup.md).

## Hot-Swappable with Other Backends

This adapter is part of the `verify-store-*` family. Every sibling implements the same store contract. Swap by changing one config value; the rest of your code keeps working.

- [`@superloomdev/js-server-helper-verify-store-postgres`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-verify-store-postgres) - PostgreSQL
- [`@superloomdev/js-server-helper-verify-store-mysql`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-verify-store-mysql) - MySQL or MariaDB
- [`@superloomdev/js-server-helper-verify-store-mongodb`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-verify-store-mongodb) - MongoDB
- [`@superloomdev/js-server-helper-verify-store-dynamodb`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-verify-store-dynamodb) - AWS DynamoDB

## Aligned with Superloom Philosophy

If your project is built on Superloom conventions (the same loader pattern, the same response envelopes, the same testing model), this adapter slots in without you needing to learn anything new.

## Extended Documentation

- [API reference](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-verify-store-sqlite/docs/api.md). The store contract this adapter implements and SQLite-specific semantics
- [Configuration](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-verify-store-sqlite/docs/configuration.md). `STORE_CONFIG` keys, peer dependencies, environment variables, testing tier
- [Schema](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-verify-store-sqlite/docs/schema.md). DDL, identifier quoting, UPSERT semantics, index strategy
- [Cleanup](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-verify-store-sqlite/docs/cleanup.md). SQLite has no native TTL; scheduled cleanup is required for file-backed deployments
- [Verify parent module](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-verify). The data model, error catalog, and Verify-side configuration this adapter plugs into

## Adding to Your Project

This adapter is installed alongside the Verify parent module and the `sql-sqlite` driver helper. The loader pattern, including the full `Lib` container shape and how the adapter factory is passed to the Verify parent's `STORE` config key, is documented in the Verify parent's README.

Do not vendor the source or use it as a local file dependency. The published package is the supported integration path.

## Testing Status

| Tier | Runtime | Status |
|---|---|---|
| Contract + Integration | SQLite (`:memory:`, in-process via `node:sqlite`) | [![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml) |

Tests run fully in-process; no Docker, no service to provision. Test runtime details live in [Configuration → Testing Tier](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-verify-store-sqlite/docs/configuration.md#testing-tier).

## License

MIT
