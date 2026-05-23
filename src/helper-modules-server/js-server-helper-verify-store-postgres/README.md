# @superloomdev/js-server-helper-verify-store-postgres

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-brightgreen.svg)](https://nodejs.org) 

A PostgreSQL-backed implementation of the [Verify](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-verify) module's storage contract. Plug it into the parent's `STORE` config; the Verify module's calling shape stays identical regardless of which storage backend is active. Part of [Superloom](https://superloom.dev).

## What This Is

A thin layer between the Verify parent module and a PostgreSQL verification table. Well-suited for production deployments requiring durability, connection pooling, and SQL-standard semantics.

The adapter cannot stand alone. It is always loaded together with the Verify parent and the [`js-server-helper-sql-postgres`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-sql-postgres) driver helper.

## Why Use This Module

- **Library updates won't break your code.** When `pg` ships a breaking change, only this adapter and the `sql-postgres` driver helper need updating. Your application code and Verify call sites stay exactly as they are.

- **Pre-tested at every release.** A full store-contract and Verify-lifecycle integration suite run against a Dockerized PostgreSQL instance in CI on every push.

- **Production-grade SQL backend.** Supports connection pooling, `ON CONFLICT` UPSERT, and `CREATE INDEX IF NOT EXISTS` — all production-safe patterns.

- **Built-in observability.** Every store call is timed against the active request via `Lib.Debug`, the same way every other Superloom helper does.

## Hot-Swappable with Other Backends

This adapter is part of the `verify-store-*` family. Every sibling implements the same store contract. Swap by changing one config value; the rest of your code keeps working.

- [`@superloomdev/js-server-helper-verify-store-sqlite`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-verify-store-sqlite) - SQLite (embedded, zero-network, dev/test)
- [`@superloomdev/js-server-helper-verify-store-mysql`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-verify-store-mysql) - MySQL or MariaDB
- [`@superloomdev/js-server-helper-verify-store-mongodb`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-verify-store-mongodb) - MongoDB
- [`@superloomdev/js-server-helper-verify-store-dynamodb`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-verify-store-dynamodb) - AWS DynamoDB

## Aligned with Superloom Philosophy

If your project is built on Superloom conventions (the same loader pattern, the same response envelopes, the same testing model), this adapter slots in without you needing to learn anything new.

## Extended Documentation

- [API reference](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-verify-store-postgres/docs/api.md). The store contract this adapter implements and PostgreSQL-specific semantics
- [Configuration](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-verify-store-postgres/docs/configuration.md). `STORE_CONFIG` keys, peer dependencies, environment variables, testing tier
- [Schema](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-verify-store-postgres/docs/schema.md). DDL, identifier quoting, UPSERT semantics, index strategy
- [Cleanup](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-verify-store-postgres/docs/cleanup.md). PostgreSQL has no native TTL; scheduled cleanup is required
- [Verify parent module](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-verify). The data model, error catalog, and Verify-side configuration this adapter plugs into

## Adding to Your Project

This adapter is installed alongside the Verify parent module and the `sql-postgres` driver helper. The loader pattern is documented in the Verify parent's README.

Do not vendor the source or use it as a local file dependency. The published package is the supported integration path.

## Dependencies

This module has no external dependencies.

It expects three peer modules in the `Lib` container (Utils, Debug, Postgres). For the full dependency breakdown, see [`docs/configuration.md`](docs/configuration.md).

## Testing Status

| Tier | Runtime | Status |
|---|---|---|
| Contract + Integration | PostgreSQL via Docker Compose | [![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml) |

Docker lifecycle is fully automatic — `npm test` from `_test/` manages `pretest`/`posttest`. Test runtime details live in [Configuration → Testing Tier](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-verify-store-postgres/docs/configuration.md#testing-tier).

## License

MIT

