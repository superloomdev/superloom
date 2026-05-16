# Configuration. `js-server-helper-sql-postgres`

Every loader option, every environment variable, dependency expectations, and the runtime patterns that combine them. For the function reference see [API Reference](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-sql-postgres/docs/api.md).

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
- [SSL Configuration](#ssl-configuration)
- [Connection Pool Tuning](#connection-pool-tuning)
- [Testing Tiers](#testing-tiers)

---

## Loader Pattern

The module is a factory. Each loader call returns an independent public interface with its own pool, config, and lifecycle. The driver (`pg`) is cached at the module scope and shared across instances because it is stateless.

```javascript
Lib.SqlDB = require('@superloomdev/js-server-helper-sql-postgres')(Lib, {
  HOST:     process.env.DB_HOST,
  DATABASE: process.env.DB_NAME,
  USER:     process.env.DB_USER,
  PASSWORD: process.env.DB_PASSWORD
});
```

Loader call semantics:

- The first argument is the `Lib` container. The module reads `Lib.Utils` and `Lib.Debug` from it (see [Peer Dependencies](#peer-dependencies-injected)).
- The second argument is the config override. Whatever you pass is merged on top of the module's defaults (see [postgres.config.js](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-sql-postgres/postgres.config.js)). Missing keys fall back to defaults.
- The pool is **not** created at loader time. It is created lazily on the first query. This keeps cold-start fast in serverless deployments.

---

## Configuration Keys

| Key | Type | Required | Default | Description |
|---|---|---|---|---|
| `HOST` | `String` | Yes (override) | `'localhost'` | Postgres host or cluster endpoint |
| `PORT` | `Number` | No | `5432` | Postgres port |
| `DATABASE` | `String` | Yes (override) | `''` | Database name |
| `USER` | `String` | Yes (override) | `'postgres'` | Postgres user |
| `PASSWORD` | `String` | Yes (override) | `''` | Postgres password |
| `SSL` | `Boolean \| Object` | No | `false` | See [SSL Configuration](#ssl-configuration) |
| `POOL_MAX` | `Number` | No | `10` | Maximum clients in the pool. See [Connection Pool Tuning](#connection-pool-tuning) |
| `POOL_MIN` | `Number` | No | `0` | Minimum idle clients held open |
| `POOL_IDLE_TIMEOUT_MS` | `Number` | No | `60000` | Close idle clients after this many ms |
| `KEEP_ALIVE_INITIAL_DELAY_MS` | `Number` | No | `10000` | TCP keep-alive probe delay (helps with NAT timeouts) |
| `CONNECT_TIMEOUT_MS` | `Number` | No | `10000` | Max time to establish a connection before failing |
| `STATEMENT_TIMEOUT_MS` | `Number` | No | `0` | Postgres `statement_timeout` (`0` = disabled). Useful guardrail for long-running queries |
| `APPLICATION_NAME` | `String` | No | `'superloom'` | Surfaces in `pg_stat_activity.application_name`. Override to identify multiple services in the same DB |
| `CLOSE_TIMEOUT_MS` | `Number` | No | `5000` | Max ms `close()` waits for active queries before force-destroying the pool |

"Required (override)" means the default exists but is unlikely to match a real deployment. Practically every project must override it. Every other key has a usable default for most cases.

---

## Environment Variables

Environment variables are consumed only by `_test/loader.js`. The module itself never reads `process.env` directly. All configuration flows through the loader.

| Variable | Emulated (Dev) | Integration (Real DB) |
|---|---|---|
| `POSTGRES_HOST` | `localhost` | `<cluster-endpoint>` |
| `POSTGRES_PORT` | `5432` | `5432` |
| `POSTGRES_DATABASE` | `test_db` | `test_db` |
| `POSTGRES_USER` | `test_user` | `unit_tester` |
| `POSTGRES_PASSWORD` | `test_pw` | From `__dev__/secrets/sandbox.md` |

In your application code, set the variables you need and forward them to the loader explicitly. The module does not assume any specific variable names. `HOST`, `DATABASE`, etc. accept any source.

---

## Peer Dependencies (Injected)

These come from your project's `Lib` container, not from this module's `package.json`. You install them in your project once and inject them into every helper.

| Package | Purpose |
|---|---|
| `@superloomdev/js-helper-utils` | Type checks, validation, data manipulation |
| `@superloomdev/js-helper-debug` | Structured logging plus `performanceAuditLog` for per-query timing |
| `@superloomdev/js-server-helper-instance` | Request lifecycle. Provides `instance.time_ms` used by performance logging |

The `Lib.Instance` peer is technically optional. The module reads `instance.time_ms` defensively. But every production deployment should pass a real instance. Otherwise performance logging is degraded.

---

## Direct Dependencies (Bundled)

| Package | Version range | Purpose |
|---|---|---|
| `pg` | `^8.x` | node-postgres driver. Lazy-loaded on first query, cached at module scope. |

The driver is the only direct dependency. It is bundled because it is the implementation detail this module exists to wrap. You should never `require('pg')` in your application code.

---

## Multi-Database Setup

Each loader call returns an independent instance with its own pool. Load the module twice (or more) to connect to several databases (or a writer plus a reader) from the same process:

```javascript
Lib.PrimaryDB = require('@superloomdev/js-server-helper-sql-postgres')(Lib, {
  HOST: 'primary-db.example.com',
  DATABASE: 'app_db',
  USER: 'app_user',
  PASSWORD: process.env.PRIMARY_DB_PASSWORD,
  POOL_MAX: 20
});

Lib.ReaderDB = require('@superloomdev/js-server-helper-sql-postgres')(Lib, {
  HOST: 'reader-db.example.com',
  DATABASE: 'app_db',
  USER: 'readonly_user',
  PASSWORD: process.env.READER_DB_PASSWORD,
  POOL_MAX: 10
});
```

Each instance maintains its own pool and lifecycle. Call `close()` on each at process exit. Multiple loader calls **do not** share connections, transactions, or statement timeouts.

---

## SSL Configuration

| Value | Behaviour | When to use |
|---|---|---|
| `false` | TLS disabled | Local development, Docker |
| `true` | TLS enabled with `{ rejectUnauthorized: true }` (default) | Most managed services with a trusted CA chain |
| `Object` | Passed through to `pg` verbatim | TLS-enforced managed databases that require a custom CA, mTLS, or `rejectUnauthorized: false` |

**Custom CA example (managed databases that publish their own root CA):**

```javascript
SSL: {
  ca: require('fs').readFileSync('/path/to/managed-db-ca.pem').toString(),
  rejectUnauthorized: true
}
```

**Permissive example (development only, never production):**

```javascript
SSL: { rejectUnauthorized: false }
```

---

## Connection Pool Tuning

The right `POOL_MAX` depends on your deployment shape and the database's `max_connections` setting. Two broad deployment categories:

| Category | Recommended `POOL_MAX` | Reasoning |
|---|---|---|
| **Serverless** (cloud functions, on-demand workers. E.g. Lambda, Cloud Functions, Cloud Run) | `1` | Each invocation holds one connection. Larger pools waste warm-pool capacity and exhaust `max_connections` under concurrency. |
| **Persistent** (containers, virtual machines, orchestrated platforms. E.g. Docker, Kubernetes, EC2) | `10–20` | Tune per instance: `POOL_MAX × instance_count ≤ db_max_connections × 0.8`. |
| **Auto-scaling managed databases** (e.g. Aurora Serverless v2, scale-to-zero clusters) | `5–10` | Scale-down behaviour means very large pools can hold connections through scale events. |

**General formula** for persistent deployments:

```
POOL_MAX × app_instance_count ≤ db_max_connections × 0.8
```

The `0.8` leaves headroom for database admin connections, monitoring, and burst handling. Cross this threshold and new connection attempts will fail under load.

**Recommendation:** start at `10`, observe `pg_stat_activity` in production, raise as needed.

---

## Testing Tiers

The module ships two test tiers:

| Tier | Runtime | When to run | CI Status |
|---|---|---|---|
| **Emulated** | Postgres 17 in Docker | Every commit, every CI run | [![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml) |
| **Integration** | Real PostgreSQL 15+ instance | Manually, against a sandbox cluster | ![Integration Tests](https://img.shields.io/badge/Integration_Tests-not_yet_tested-lightgrey) |

### Emulated (Docker)

```bash
cd _test && npm install && npm test
```

`pretest` starts a Postgres 17 container via `docker-compose.yml`; `posttest` stops it and removes the volume. The container image is cached between runs. No manual `docker compose up` is needed and starting it manually will conflict with `pretest`.

Full setup guide: [Postgres Local Setup](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-sql-postgres/_test/ops/00-local-testing/postgres-local-setup.md).

### Integration (Real Database)

```bash
source init-env.sh   # select 'integration'
cd _test && npm install && npm test
```

The integration tier connects to a real Postgres-compatible database (any managed PostgreSQL 15+ service or self-hosted instance) using credentials from `__dev__/secrets/`. It is opt-in because it costs money and writes real data.

Full setup guide: [Postgres Integration Setup](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-sql-postgres/_test/ops/01-integration-testing/postgres-integration-setup.md).

For the framework-wide testing architecture see [Module Testing](https://github.com/superloomdev/superloom/blob/main/docs/architecture/module-testing.md).
