# @superloomdev/js-server-helper-auth-store-dynamodb

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-brightgreen.svg)](https://nodejs.org)

An AWS DynamoDB-backed implementation of the [Auth](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-auth) module's storage contract. Plug it into the parent's `STORE` config; the Auth module's calling shape stays identical regardless of which storage backend is active. Table provisioning is out-of-band (IaC). Part of [Superloom](https://superloom.dev).

## What This Is

A thin layer between the Auth parent module and a DynamoDB sessions table. The adapter uses a single-table design with composite keys so every hot-path query is a direct primary-index hit; no secondary indexes are required for the auth access patterns.

The adapter cannot stand alone. It is always loaded together with the Auth parent and the underlying [`js-server-helper-nosql-aws-dynamodb`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-nosql-aws-dynamodb) driver helper, and inherits whatever the driver helper provides (AWS SDK client configuration, request-level timing, error envelopes, credential chain). The table itself must be provisioned out-of-band before the adapter is used; `setupNewStore` is not implemented for DynamoDB.

## Why Use This Module

- **Library updates won't break your code.** When the AWS SDK ships a breaking change, only this adapter and the [`nosql-aws-dynamodb`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-nosql-aws-dynamodb) driver helper need updating. Your application code and the Auth-module call sites stay exactly as they are.

- **Pre-tested at every release.** A full store-contract suite plus a full Auth-lifecycle integration suite run against a local DynamoDB emulator in CI on every push. Your project trusts the adapter instead of re-verifying session plumbing on each release.

- **Designed for human review.** The adapter is laid out as clearly-marked visual sections (section banners, short functions, scoped comments) so a reviewer can read it top to bottom and follow each store-contract method without ever getting lost in dense logic. Open `store.js` to see the structure.

- **Built-in observability.** Every store call is timed against the active request via `Lib.Debug.performanceAuditLog`, the same way every other Superloom helper does. Slow-store review and request profiling are built in. No instrumentation code to write.

- **Native TTL option.** DynamoDB supports automatic item expiry via table-level TTL. Enable it on the `expires_at` attribute during table provisioning and expired sessions disappear without application-managed cleanup. The fallback `cleanupExpiredSessions` path is available for immediate consistency when needed. The table design, the key schema, the TTL configuration, and the IaC examples live in [`docs/schema.md`](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-auth-store-dynamodb/docs/schema.md) and [`docs/cleanup.md`](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-auth-store-dynamodb/docs/cleanup.md).

## Hot-Swappable with Other Backends

This adapter is part of the `auth-store-*` family. Every sibling implements the same store contract. Swap by changing one config value; the rest of your code keeps working.

- [`@superloomdev/js-server-helper-auth-store-sqlite`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-auth-store-sqlite) - SQLite (embedded, in-process)
- [`@superloomdev/js-server-helper-auth-store-postgres`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-auth-store-postgres) - PostgreSQL
- [`@superloomdev/js-server-helper-auth-store-mysql`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-auth-store-mysql) - MySQL / MariaDB
- [`@superloomdev/js-server-helper-auth-store-mongodb`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-auth-store-mongodb) - MongoDB

## Aligned with Superloom Philosophy

If your project is built on Superloom conventions (the same loader pattern, the same response envelopes, the same testing model), this adapter slots in without you needing to learn anything new. It is written using the same opinionated principles as the Auth parent and the `nosql-aws-dynamodb` driver helper, so adopting it does not introduce inconsistency into your codebase.

If you are not yet using Superloom, the principles are documented at [superloom.dev](https://superloom.dev).

## Extended Documentation

- [API reference](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-auth-store-dynamodb/docs/api.md). The store contract this adapter implements and the adapter factory protocol
- [Configuration](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-auth-store-dynamodb/docs/configuration.md). `STORE_CONFIG` keys, IAM permissions, peer dependencies, environment variables, testing tier
- [Schema](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-auth-store-dynamodb/docs/schema.md). Single-table design, PK/SK strategy, CloudFormation example, attribute type mapping
- [Cleanup](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-auth-store-dynamodb/docs/cleanup.md). Native TTL vs application-managed cleanup, Scan-then-batchDelete fallback, operational notes
- [Auth parent module](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-auth). The data model, error catalog, and Auth-side configuration this adapter plugs into
- [Superloom](https://superloom.dev). The framework

## Adding to Your Project

This adapter is installed alongside the Auth parent module and the `nosql-aws-dynamodb` driver helper as peer dependencies through the standard Superloom loader. The canonical install command for the parent + adapter + driver triple lives in the Auth parent's [Adding to Your Project](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-auth#adding-to-your-project) section; substitute `auth-store-dynamodb` for the adapter name and add `js-server-helper-nosql-aws-dynamodb` to the install list.

Do not vendor the source or use it as a local file dependency. The published package is the supported integration path.

The loader pattern, including the full `Lib` container shape and how the adapter factory is passed to the Auth parent's `STORE` config key, is documented in [Server Loader Architecture](https://github.com/superloomdev/superloom/blob/main/docs/architecture/server-loader.md). For one-time GitHub Packages registry setup, see the [npmrc setup guide](https://github.com/superloomdev/superloom/blob/main/docs/dev/npmrc-setup.md).

## Testing Status

| Tier | Runtime | Status |
|---|---|---|
| Contract + Integration | DynamoDB Local emulator in Docker | [![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml) |

Test runtime details (Docker lifecycle, environment variables, contract suite coverage) live in [Configuration → Testing Tier](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-auth-store-dynamodb/docs/configuration.md#testing-tier).

## License

MIT
