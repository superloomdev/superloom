# @superloomdev/js-server-helper-verify-store-mongodb

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-brightgreen.svg)](https://nodejs.org) 

A MongoDB-backed implementation of the [Verify](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-verify) module's storage contract. Plug it into the parent's `STORE` config; the Verify module's calling shape stays identical regardless of which storage backend is active. Part of [Superloom](https://superloom.dev).

## What This Is

A thin layer between the Verify parent module and a MongoDB verification collection. Uses a compound `_id = { scope, id }` for the primary key and a TTL index on a `_ttl` Date field for automatic expiry. Well-suited for projects already running MongoDB that want automatic document expiry without application-side scheduling.

The adapter cannot stand alone. It is always loaded together with the Verify parent and the [`js-server-helper-nosql-mongodb`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-nosql-mongodb) driver helper.

## Why Use This Module

- **Library updates won't break your code.** When the MongoDB native driver ships a breaking change, only this adapter and the `nosql-mongodb` driver helper need updating.

- **Pre-tested at every release.** A full store-contract and Verify-lifecycle integration suite run against a Dockerized MongoDB instance in CI on every push.

- **Native TTL.** Expired verification records are deleted automatically by MongoDB's background TTL sweeper (~60s lag) — no application scheduling required. `cleanupExpiredRecords` is also available for deterministic explicit cleanup.

- **No application cleanup needed in steady state.** Verify codes always carry an `expires_at`; the TTL index drives automatic deletion ~60s after the configured expiry. `cleanupExpiredRecords` is exposed only for deterministic test runs and explicit immediate sweeps.

## Hot-Swappable with Other Backends

This adapter is part of the `verify-store-*` family. Every sibling implements the same store contract. Swap by changing one config value; the rest of your code keeps working.

- [`@superloomdev/js-server-helper-verify-store-sqlite`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-verify-store-sqlite) - SQLite (embedded, zero-network, dev/test)
- [`@superloomdev/js-server-helper-verify-store-postgres`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-verify-store-postgres) - PostgreSQL
- [`@superloomdev/js-server-helper-verify-store-mysql`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-verify-store-mysql) - MySQL or MariaDB
- [`@superloomdev/js-server-helper-verify-store-dynamodb`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-verify-store-dynamodb) - AWS DynamoDB

## Aligned with Superloom Philosophy

If your project is built on Superloom conventions (the same loader pattern, the same response envelopes, the same testing model), this adapter slots in without you needing to learn anything new.

## Extended Documentation

- [API reference](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-verify-store-mongodb/docs/api.md). The store contract this adapter implements and MongoDB-specific semantics
- [Configuration](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-verify-store-mongodb/docs/configuration.md). `STORE_CONFIG` keys, peer dependencies, environment variables, testing tier
- [Schema](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-verify-store-mongodb/docs/schema.md). Document shape, compound `_id`, `_ttl` field, TTL index
- [Cleanup](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-verify-store-mongodb/docs/cleanup.md). Native TTL and explicit `cleanupExpiredRecords` — when to use each
- [Verify parent module](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-verify). The data model, error catalog, and Verify-side configuration this adapter plugs into

## Adding to Your Project

This adapter is installed alongside the Verify parent module and the `nosql-mongodb` driver helper. The loader pattern is documented in the Verify parent's README.

Do not vendor the source or use it as a local file dependency. The published package is the supported integration path.

## Dependencies

This module has no external dependencies.

It expects three peer modules in the `Lib` container (Utils, Debug, MongoDB). For the full dependency breakdown, see [`docs/configuration.md`](docs/configuration.md).

## Testing Status

| Tier | Runtime | Status |
|---|---|---|
| Contract + Integration | MongoDB via Docker Compose | [![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml) |

Docker lifecycle is fully automatic — `npm test` from `_test/` manages `pretest`/`posttest`. Test runtime details live in [Configuration → Testing Tier](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-verify-store-mongodb/docs/configuration.md#testing-tier).

## License

MIT

