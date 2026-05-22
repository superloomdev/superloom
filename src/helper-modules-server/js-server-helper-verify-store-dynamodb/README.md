# @superloomdev/js-server-helper-verify-store-dynamodb

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-brightgreen.svg)](https://nodejs.org)

An AWS DynamoDB-backed implementation of the [Verify](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-verify) module's storage contract. Plug it into the parent's `STORE` config; the Verify module's calling shape stays identical regardless of which storage backend is active. Part of [Superloom](https://superloom.dev).

## What This Is

A thin layer between the Verify parent module and a DynamoDB verification table. Uses a single-table design with `scope` as the partition key and `id` as the sort key. The `expires_at` attribute doubles as the DynamoDB TTL attribute, enabling automatic item expiry without application-side scheduling.

The adapter cannot stand alone. It is always loaded together with the Verify parent and the [`js-server-helper-nosql-aws-dynamodb`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-nosql-aws-dynamodb) driver helper.

## Why Use This Module

- **Library updates won't break your code.** When the AWS SDK ships a breaking change, only this adapter and the `nosql-aws-dynamodb` driver helper need updating.

- **Pre-tested at every release.** A full store-contract and Verify-lifecycle integration suite run against DynamoDB Local (Docker) in CI on every push.

- **Native TTL.** Enable TTL on `expires_at` out-of-band after `setupNewStore`; DynamoDB handles automatic expiry asynchronously (~48h sweep lag). `cleanupExpiredRecords` provides explicit deterministic cleanup when needed.

- **`setupNewStore` provisions the table.** Calls `CreateTable` with `PAY_PER_REQUEST` billing. `ResourceInUseException` is treated as success — safe to call on every boot.

## Hot-Swappable with Other Backends

This adapter is part of the `verify-store-*` family. Every sibling implements the same store contract. Swap by changing one config value; the rest of your code keeps working.

- [`@superloomdev/js-server-helper-verify-store-sqlite`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-verify-store-sqlite) - SQLite (embedded, zero-network, dev/test)
- [`@superloomdev/js-server-helper-verify-store-postgres`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-verify-store-postgres) - PostgreSQL
- [`@superloomdev/js-server-helper-verify-store-mysql`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-verify-store-mysql) - MySQL or MariaDB
- [`@superloomdev/js-server-helper-verify-store-mongodb`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-verify-store-mongodb) - MongoDB

## Aligned with Superloom Philosophy

If your project is built on Superloom conventions (the same loader pattern, the same response envelopes, the same testing model), this adapter slots in without you needing to learn anything new.

## Extended Documentation

- [API reference](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-verify-store-dynamodb/docs/api.md). The store contract this adapter implements and DynamoDB-specific semantics
- [Configuration](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-verify-store-dynamodb/docs/configuration.md). `STORE_CONFIG` keys, peer dependencies, environment variables, testing tier, post-deployment TTL step
- [Schema](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-verify-store-dynamodb/docs/schema.md). Key schema, CloudFormation snippet, TTL attribute, access patterns
- [Cleanup](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-verify-store-dynamodb/docs/cleanup.md). Native TTL vs explicit `cleanupExpiredRecords` — cost and latency tradeoffs
- [Verify parent module](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-verify). The data model, error catalog, and Verify-side configuration this adapter plugs into

## Adding to Your Project

This adapter is installed alongside the Verify parent module and the `nosql-aws-dynamodb` driver helper. The loader pattern is documented in the Verify parent's README.

Do not vendor the source or use it as a local file dependency. The published package is the supported integration path.

## Dependencies

This module has no external dependencies.

It expects three peer modules in the `Lib` container (Utils, Debug, DynamoDB). For the full dependency breakdown, see [`docs/configuration.md`](docs/configuration.md).

## Testing Status

| Tier | Runtime | Status |
|---|---|---|
| Contract + Integration | DynamoDB Local via Docker Compose | [![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml) |

Docker lifecycle is fully automatic — `npm test` from `_test/` manages `pretest`/`posttest`. Test runtime details live in [Configuration → Testing Tier](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-verify-store-dynamodb/docs/configuration.md#testing-tier).

## License

MIT
