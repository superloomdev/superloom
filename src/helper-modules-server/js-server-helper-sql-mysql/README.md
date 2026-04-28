# @superloomdev/js-server-helper-sql-mysql

[![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 20.19+](https://img.shields.io/badge/Node.js-20.19%2B-brightgreen.svg)](https://nodejs.org)

MySQL client with connection pooling for Node.js. Compatible with MySQL 8+. Async/await API built on `mysql2`. Part of the [Superloom](https://github.com/superloomdev/superloom).

> **Service-dependent module** - tests require either Docker (emulated) or a real MySQL-compatible database (integration).

## API

All I/O functions accept `instance` (from `Lib.Instance.initialize`) as their first argument - enabling request-level performance tracing via `instance.time_ms`.

| Function | Purpose |
|---|---|
| `getRow(instance, sql, params)` | First row (or null) |
| `getRows(instance, sql, params)` | All rows |
| `getValue(instance, sql, params)` | First column of first row (scalar) |
| `get(instance, sql, params)` | Auto-shape result (scalar / row / rows / null) when the caller doesn't know the shape |
| `write(instance, sql, params?)` | INSERT / UPDATE / DELETE. String = single statement. Array = atomic transaction. Returns `affected_rows` + `insert_id` |
| `getClient(instance)` / `releaseClient(client)` | Manual transaction management for complex commit/rollback flows |
| `buildQuery(sql, params)` | Compile to a fully-escaped SQL string (`?`/`??` syntax) |
| `buildRawText(str)` | Wrap a raw fragment so it bypasses escaping |
| `buildMultiCondition(data, operator?)` | Join equality conditions with AND/OR |
| `close()` | Close pool gracefully on SIGTERM (timeout controlled by `CLOSE_TIMEOUT_MS`) |

Placeholders: `?` for values, `??` for identifiers (table/column names) - the standard `mysql2` format.

## Multi-DB Support

Each loader call returns an **independent instance** with its own pool. Load the module twice to connect to two different databases - or a writer and a reader - from the same process:

```javascript
Lib.PrimaryDB = require('@superloomdev/js-server-helper-mysql')(Lib, {
  HOST: 'primary-db.example.com',
  DATABASE: 'app_db',
  USER: 'app_user',
  PASSWORD: process.env.PRIMARY_DB_PASSWORD,
  POOL_MAX: 20
});

Lib.ReaderDB = require('@superloomdev/js-server-helper-mysql')(Lib, {
  HOST: 'reader-db.example.com',
  DATABASE: 'app_db',
  USER: 'readonly_user',
  PASSWORD: process.env.READER_DB_PASSWORD,
  POOL_MAX: 10
});
```

Each instance maintains its own pool and lifecycle - call `close()` on each one at process exit.

## Usage

```javascript
const Lib = {};
Lib.Utils = require('@superloomdev/js-helper-utils')();
Lib.Debug = require('@superloomdev/js-helper-debug')(Lib, { LOG_LEVEL: 'info' });
Lib.Instance = require('@superloomdev/js-server-helper-instance')(Lib, {});
Lib.SqlDB = require('@superloomdev/js-server-helper-mysql')(Lib, {
  HOST: process.env.DB_HOST,
  DATABASE: process.env.DB_NAME,
  USER: process.env.DB_USER,
  PASSWORD: process.env.DB_PASSWORD,
  SSL: true,
  POOL_MAX: 20
});

const instance = Lib.Instance.initialize();

// Modern
const users = await Lib.SqlDB.getRows(
  instance,
  'SELECT id, name FROM ?? WHERE status = ?',
  ['users', 'active']
);

// Single INSERT / UPDATE / DELETE
await Lib.SqlDB.write(
  instance,
  'UPDATE ?? SET name = ? WHERE id = ?',
  ['users', 'John', 1]
);

// Build once, run atomically
const sql = [
  Lib.SqlDB.buildQuery('INSERT INTO ?? SET ?', ['orders', orderData]),
  Lib.SqlDB.buildQuery('UPDATE ?? SET total = total + ? WHERE id = ?',
    ['customers', orderTotal, customerId])
];
await Lib.SqlDB.write(instance, sql);   // atomic transaction
```

## Spatial Data

Spatial SQL is supported via `buildRawText()` - no dedicated helpers needed:

```javascript
const point = Lib.SqlDB.buildRawText(
  "ST_GeomFromText('POINT(28.6139 77.2090)', 4326)"
);

await Lib.SqlDB.write(
  instance,
  Lib.SqlDB.buildQuery('INSERT INTO address SET ?', {
    line1: '221B',
    point: point,
    latitude: 28.6139,
    longitude: 77.2090
  })
);
```

## Configuration (Loader)

| Config Key | Default | Description |
|---|---|---|
| `HOST` | `'localhost'` | MySQL host |
| `PORT` | `3306` | MySQL port |
| `DATABASE` | `''` | Database name |
| `USER` | `'root'` | MySQL user |
| `PASSWORD` | `''` | MySQL password |
| `SSL` | `false` | `false`, `true` (defaults), or explicit `{ ca, rejectUnauthorized }` for TLS-enforced managed databases |
| `POOL_MAX` | `10` | Max connections in pool. Serverless function: `1`. Persistent server: `10-20` |
| `POOL_QUEUE_LIMIT` | `0` | Queue depth for requests when pool is full (`0` = unlimited) |
| `POOL_IDLE_TIMEOUT_MS` | `60000` | Close idle connections after this many ms |
| `KEEP_ALIVE_INITIAL_DELAY_MS` | `10000` | TCP keep-alive probe delay |
| `MULTIPLE_STATEMENTS` | `false` | Allow `;`-separated statements in a single call |
| `CHARSET` | `'utf8mb4'` | Character set for the connection |
| `TIMEZONE` | `'Z'` | UTC - keep DB times in UTC |
| `CONNECT_TIMEOUT_MS` | `10000` | Connection establishment timeout |
| `CLOSE_TIMEOUT_MS` | `5000` | Max ms `close()` waits for active queries before force-destroying the pool |

## Environment Variables

Consumed by `_test/loader.js` - never read anywhere else.

| Variable | Emulated (Dev) | Integration (Real DB) |
|---|---|---|
| `MYSQL_HOST` | `localhost` | `<cluster-endpoint>` |
| `MYSQL_PORT` | `3306` | `3306` |
| `MYSQL_DATABASE` | `test_db` | `test_db` |
| `MYSQL_USER` | `test_user` | `unit_tester` |
| `MYSQL_PASSWORD` | `test_pw` | `__dev__/secrets/sandbox.md` |
| `MYSQL_ROOT_PASSWORD` | `test_root_pw` | Sandbox master user pw |

## Peer Dependencies (Injected via Loader)

| Package | Purpose |
|---|---|
| `@superloomdev/js-helper-utils` | Type checks, data manipulation |
| `@superloomdev/js-helper-debug` | Structured logging, `performanceAuditLog` |
| `@superloomdev/js-server-helper-instance` | Request lifecycle - `instance.time_ms` |

## Direct Dependencies (Bundled)

| Package | Purpose |
|---|---|
| `mysql2` | MySQL driver with native Promise support (lazy-loaded) |

## Testing

| Tier | Runtime | Status |
|---|---|---|
| **Emulated Tests** | MySQL 8.0.44 (Docker) | [![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml) |
| **Integration Tests** | Real MySQL 8+ database | ![Integration Tests](https://img.shields.io/badge/Integration_Tests-not_yet_tested-lightgrey) |

### Emulated (Docker)

```bash
cd _test && npm install && npm test
```

Docker lifecycle is automatic: `pretest` starts the MySQL container, `posttest` stops and removes it (containers and volumes only — images are cached). No manual `docker compose up` needed.

Full guide: `_test/ops/00-local-testing/mysql-local-setup.md`

### Integration (Real Database)

```bash
source init-env.sh   # select 'integration'
cd _test && npm install && npm test
```

Full guide: `_test/ops/01-integration-testing/mysql-integration-setup.md`

See [Module Testing](https://github.com/superloomdev/superloom/blob/main/docs/architecture/module-testing.md) for the full testing architecture.
