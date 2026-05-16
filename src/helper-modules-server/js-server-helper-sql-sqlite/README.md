# @superloomdev/js-server-helper-sql-sqlite

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 22.13+](https://img.shields.io/badge/Node.js-22.13%2B-brightgreen.svg)](https://nodejs.org)

A SQLite helper for Node.js that runs in-process with zero external infrastructure and ships pre-tested, so your project never has to re-verify SQL connectivity. Part of [Superloom](https://superloom.dev).

## What This Is

A thin, opinionated layer over the **built-in [`node:sqlite`](https://nodejs.org/api/sqlite.html) module** (stable since Node.js 22.13). The driver ships with Node itself — there is no external dependency to install, manage, or upgrade. The wrapper adds request-level timing, a single consistent response shape, and the same calling pattern as the other Superloom SQL helpers.

Every read and every write returns the same envelope:

```
success / data / error
```

— so error handling, result reading, and exception expectations are the same in every place you touch the database. There are no surprises between functions, and operational failures never throw.

## Why Use This Module

- **Library updates won't break your code.** When `node:sqlite` evolves (or when this module switches to a different SQLite driver entirely), only this module updates. Your application code stays exactly as it is.

- **Pre-tested at every release.** A full test suite runs against `node:sqlite` in CI on every push. Your project trusts the wrapper instead of re-verifying SQL plumbing on each release.

- **Designed for human review.** The code is laid out as clearly-marked visual sections — section banners, short functions, scoped comments — so a reviewer can read it top to bottom in order, use the section breaks as checkpoints to mark how far they have got, and finish without ever getting lost in dense logic. This matters most when an AI assistant is generating the change and a human still has to sign off on it. Open `sqlite.js` to see the structure.

- **Built-in observability.** Every operation can be timed against the active request and routed into your structured logs automatically. Slow-query review, request profiling, and the toggle to enable it during local development or silence it in production are all built in. No instrumentation code to write.

- **Runs in-process, with zero infrastructure.** SQLite is embedded — there is no server to provision, no credentials to manage, no network to debug. The same module powers an in-memory test database, a local file-backed cache, an offline-first desktop or edge app, or a per-process analytics store. Switch between in-memory and on-disk by changing one config value.

## Hot-Swappable with Other Backends

This module is part of a family of database helpers that share the same calling shape. Switch by changing the loader line — the rest of your code keeps working.

- [`@superloomdev/js-server-helper-sql-postgres`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-sql-postgres) — PostgreSQL
- [`@superloomdev/js-server-helper-sql-mysql`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-sql-mysql) — MySQL

NoSQL helpers with similarly-shaped APIs (MongoDB, DynamoDB) live as their own family — see the [Superloom helper modules index](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server).

## Aligned with Superloom Philosophy

If your project is built on Superloom conventions — the same loader pattern, the same response envelope, the same testing model — this module slots in without you needing to learn anything new. It is written using the same opinionated principles, so adopting it does not introduce inconsistency into your codebase.

If you are not yet using Superloom, the principles are documented at [superloom.dev](https://superloom.dev).

## Learn More

Extended documentation lives alongside the source on GitHub:

- [API reference](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-sql-sqlite/docs/api.md) — every exported function with its signature, parameters, return shape, and worked examples
- [Configuration](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-sql-sqlite/docs/configuration.md) — all config keys, environment variables, multi-database setup, journal modes, file-vs-memory patterns
- [Superloom](https://superloom.dev) — the framework

## Adding to Your Project

Install this module as a peer dependency in your project's `package.json` and inject its peer modules through the standard Superloom loader. Do not vendor the source or use it as a local file dependency — the published package is the supported integration path.

The peer-dependency / loader pattern, including the full `Lib` container shape, is documented in [Server Loader Architecture](https://github.com/superloomdev/superloom/blob/main/docs/architecture/server-loader.md). For one-time GitHub Packages registry setup, see the [npmrc setup guide](https://github.com/superloomdev/superloom/blob/main/docs/dev/npmrc-setup.md).

## Testing Status

| Tier | Runtime | Status |
|---|---|---|
| Offline | In-memory SQLite via `node:sqlite` | [![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml) |

SQLite has no separate integration tier — the offline `node:sqlite` runtime is the production runtime. There is no managed service to integrate against. Test runtime details (in-memory vs file-backed, journal mode) live in [Configuration → Testing Tiers](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-sql-sqlite/docs/configuration.md#testing-tiers).

## License

MIT
