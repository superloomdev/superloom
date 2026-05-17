# @superloomdev/js-server-helper-logger-store-mongodb

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-brightgreen.svg)](https://nodejs.org)

A MongoDB-backed implementation of the [Logger](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-logger) module's storage contract. Plug it into the parent's `STORE` config; the Logger module's calling shape stays identical regardless of which storage backend is active. Part of [Superloom](https://superloom.dev).

## What This Is

A thin layer between the Logger parent module and a MongoDB log collection. Uses `_id = sort_key` for deterministic document identity, compound indexes on the canonical fields for the two query paths, and a sparse TTL index on `_ttl` for automatic expiry.

The adapter cannot stand alone. It is always loaded together with the Logger parent and the [`js-server-helper-nosql-mongodb`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-nosql-mongodb) driver helper.

## Why Use This Module

- **Library updates won't break your code.** When the MongoDB native driver ships a breaking change, only this adapter and the `nosql-mongodb` driver helper need updating.

- **Pre-tested at every release.** A full store-contract and Logger-lifecycle integration suite run against a Dockerized MongoDB instance in CI on every push.

- **Native TTL.** Expired log records are automatically deleted by MongoDB's TTL sweeper (~60s lag). `cleanupExpiredLogs` is also available for deterministic explicit cleanup.

- **`data` stored as embedded document.** Unlike SQL adapters that JSON-serialize `data` to a string, this adapter stores it as a native MongoDB embedded document — enabling sub-field queries, projections, and indexing without string parsing.

## Hot-Swappable with Other Backends

- [`@superloomdev/js-server-helper-logger-store-sqlite`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-logger-store-sqlite) - SQLite (embedded, zero-network, dev/test)
- [`@superloomdev/js-server-helper-logger-store-postgres`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-logger-store-postgres) - PostgreSQL
- [`@superloomdev/js-server-helper-logger-store-mysql`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-logger-store-mysql) - MySQL or MariaDB
- [`@superloomdev/js-server-helper-logger-store-dynamodb`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-logger-store-dynamodb) - AWS DynamoDB

## Aligned with Superloom Philosophy

If your project is built on Superloom conventions (the same loader pattern, the same response envelopes, the same testing model), this adapter slots in without you needing to learn anything new.

## Extended Documentation

- [API reference](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-logger-store-mongodb/docs/api.md). The store contract this adapter implements and MongoDB-specific semantics
- [Configuration](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-logger-store-mongodb/docs/configuration.md). `STORE_CONFIG` keys, peer dependencies, environment variables, testing tier
- [Schema](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-logger-store-mongodb/docs/schema.md). Document shape, compound indexes, sparse TTL index, `data` as embedded document
- [Cleanup](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-logger-store-mongodb/docs/cleanup.md). Native TTL and explicit `cleanupExpiredLogs` — when to use each
- [Logger parent module](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-logger). The data model, error catalog, and Logger-side configuration this adapter plugs into

## Adding to Your Project

This adapter is installed alongside the Logger parent module and the `nosql-mongodb` driver helper. The loader pattern is documented in the Logger parent's README.

Do not vendor the source or use it as a local file dependency. The published package is the supported integration path.

## Testing Status

| Tier | Runtime | Status |
|---|---|---|
| Contract + Integration | MongoDB via Docker Compose | [![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml) |

Docker lifecycle is fully automatic — `npm test` from `_test/` manages `pretest`/`posttest`. Test runtime details live in [Configuration → Testing Tier](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-logger-store-mongodb/docs/configuration.md#testing-tier).

## License

MIT
