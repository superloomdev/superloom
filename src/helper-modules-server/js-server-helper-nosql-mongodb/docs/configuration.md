# Configuration — `js-server-helper-nosql-mongodb`

Every loader option, every environment variable, dependency expectations, and the runtime patterns that combine them. For the function reference see [API Reference](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-nosql-mongodb/docs/api.md).

The page is split into two halves: a **reference** block (what you can set) at the top, and a **patterns** block (worked examples that combine those settings) at the bottom.

## On This Page

**Reference**

- [Loader Pattern](#loader-pattern)
- [Configuration Keys](#configuration-keys)
- [Environment Variables](#environment-variables)
- [Peer Dependencies (Injected)](#peer-dependencies-injected)
- [Direct Dependencies (Bundled)](#direct-dependencies-bundled)

**Patterns and Examples**

- [Multi-Database Setup](#multi-database-setup)
- [Replica-Set Requirement for Transactions](#replica-set-requirement-for-transactions)
- [Testing Tiers](#testing-tiers)

---

## Loader Pattern

The module is a factory. Each loader call returns an independent public interface with its own `MongoClient`, config, and lifecycle. The driver (`mongodb`) is cached at the module scope and shared across instances because it is stateless — only the client and database references hold state.

```javascript
Lib.MongoDB = require('@superloomdev/js-server-helper-nosql-mongodb')(Lib, {
  CONNECTION_STRING: process.env.MONGODB_CONNECTION_STRING,
  DATABASE_NAME:     process.env.MONGODB_DATABASE
});
```

Loader call semantics:

- The first argument is the `Lib` container — the module reads `Lib.Utils`, `Lib.Debug`, and `Lib.Instance` from it (see [Peer Dependencies](#peer-dependencies-injected)).
- The second argument is the config override. Missing keys fall back to defaults.
- The `MongoClient` is **not** created at loader time. It is created lazily on the first call. This keeps cold-start fast in serverless deployments.

---

## Configuration Keys

| Key | Type | Required | Default | Description |
|---|---|---|---|---|
| `CONNECTION_STRING` | `String` | Yes | `''` | MongoDB connection string. Standard `mongodb://...` or `mongodb+srv://...` URI. Supports auth, replica set, options |
| `DATABASE_NAME` | `String` | Yes | *(undefined)* | Database name to bind the loader instance to |
| `MAX_POOL_SIZE` | `Number` | No | `10` | Maximum connections in the pool. See [Multi-Database Setup](#multi-database-setup) for tuning across deployment categories |
| `SERVER_SELECTION_TIMEOUT` | `Number` | No | `5000` | Maximum milliseconds the driver will wait for a server to be selected before failing |

`CONNECTION_STRING` and `DATABASE_NAME` have no useful defaults — every project must override them. The other keys have reasonable defaults for most workloads.

> **Implementation note:** the `mongodb.config.js` defaults file currently lists keys (`URI`, `HOST`, `POOL_MAX`, etc.) that the source code does not read — only the four keys above flow through to the `MongoClient`. The defaults file will be reconciled in a follow-up; pass the four keys above explicitly to be sure.

---

## Environment Variables

Environment variables are consumed only by `_test/loader.js`. The module itself never reads `process.env` directly — all configuration flows through the loader.

| Variable | Emulated (Dev) | Integration (Real DB) |
|---|---|---|
| `MONGODB_CONNECTION_STRING` | `mongodb://localhost:27017/?replicaSet=rs0` | `<atlas-or-cluster-connection-string>` |
| `MONGODB_DATABASE` | `test_db` | `test_db` |

In your application code, set the variables you need and forward them to the loader explicitly. The module does not assume any specific variable names — `CONNECTION_STRING` and `DATABASE_NAME` accept any source.

---

## Peer Dependencies (Injected)

These come from your project's `Lib` container, not from this module's `package.json`. You install them in your project once and inject them into every helper.

| Package | Purpose |
|---|---|
| `@superloomdev/js-helper-utils` | Type checks, validation, data manipulation |
| `@superloomdev/js-helper-debug` | Structured logging plus `performanceAuditLog` for per-operation timing |
| `@superloomdev/js-server-helper-instance` | Request lifecycle — provides `instance.time_ms` used by performance logging |

---

## Direct Dependencies (Bundled)

| Package | Version range | Purpose |
|---|---|---|
| `mongodb` | `^6.x` | Official MongoDB Node.js driver. Lazy-loaded on first call, cached at module scope. |

The driver is the only direct dependency. It is bundled because it is the implementation detail this module exists to wrap — you should never `require('mongodb')` in your application code.

---

## Multi-Database Setup

Each loader call returns an independent instance with its own `MongoClient`. Load the module twice (or more) to bind to multiple databases — or a primary database plus a read replica — from the same process:

```javascript
Lib.PrimaryDB = require('@superloomdev/js-server-helper-nosql-mongodb')(Lib, {
  CONNECTION_STRING: process.env.PRIMARY_MONGODB_URI,
  DATABASE_NAME:     'app_db',
  MAX_POOL_SIZE:     20
});

Lib.AnalyticsDB = require('@superloomdev/js-server-helper-nosql-mongodb')(Lib, {
  CONNECTION_STRING: process.env.ANALYTICS_MONGODB_URI,
  DATABASE_NAME:     'analytics_db',
  MAX_POOL_SIZE:     10
});
```

Each instance maintains its own pool and lifecycle — call `close(instance)` on each at process exit. Multiple loader calls **do not** share connections or transactions.

**Pool sizing by deployment shape:**

| Category | Recommended `MAX_POOL_SIZE` | Reasoning |
|---|---|---|
| **Serverless** (cloud functions, on-demand workers) | `1–3` | Each invocation holds a small slice. Larger pools waste warm-pool capacity. |
| **Persistent** (containers, virtual machines, orchestrated platforms) | `10–20` | Tune per instance against the cluster's connection limit. |
| **Managed clusters** (e.g. Atlas) | Match the cluster's allotted connection budget | Atlas's M-tier connection limit is shared across all clients. Stay under `cluster_limit × 0.8`. |

---

## Replica-Set Requirement for Transactions

`transactWriteRecords` uses MongoDB's session-based transaction API, which **requires a replica set** at the server side. This is not a distributed multi-node concern — a single-node replica set works fine.

| Deployment | Replica set status |
|---|---|
| **MongoDB Atlas** | Enabled by default on every tier, including free M0. Transactions work out of the box. |
| **Local Docker** | Pass `--replSet rs0` to `mongod` and run `rs.initiate()` once at container start. The test `docker-compose.yml` handles this automatically. |
| **Self-hosted** | Add `replication.replSetName: rs0` to `mongod.conf` and run `rs.initiate()` once. |

If you call `transactWriteRecords` against a standalone (non-replica-set) `mongod`, the driver returns an error to that effect.

---

## Testing Tiers

The module ships two test tiers:

| Tier | Runtime | When to run | CI Status |
|---|---|---|---|
| **Emulated** | MongoDB 7 single-node replica set in Docker | Every commit, every CI run | [![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml) |
| **Integration** | Real MongoDB cluster (Atlas or self-hosted) | Manually, against a sandbox cluster | ![Integration Tests](https://img.shields.io/badge/Integration_Tests-not_yet_tested-lightgrey) |

### Emulated (Docker)

```bash
cd _test && npm install && npm test
```

`pretest` starts a MongoDB 7 container as a single-node replica set; `posttest` stops and removes the container and volume (the image is cached). No manual `docker compose up` is needed and starting it manually will conflict with `pretest`.

### Integration (Real Cluster)

```bash
export MONGODB_CONNECTION_STRING="mongodb+srv://user:pass@cluster.example.com"
export MONGODB_DATABASE="test_db"
cd _test && npm install && npm test
```

The integration tier connects to a real MongoDB cluster (Atlas, self-hosted, or any MongoDB 6+ instance with a replica set). It is opt-in because it costs money and writes real data.

For the framework-wide testing architecture see [Module Testing](https://github.com/superloomdev/superloom/blob/main/docs/architecture/module-testing.md).
