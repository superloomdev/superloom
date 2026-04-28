# @superloomdev/js-server-helper-sql-postgres

[![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 20.19+](https://img.shields.io/badge/Node.js-20.19%2B-brightgreen.svg)](https://nodejs.org)

PostgreSQL client with connection pooling for Node.js. Compatible with Postgres 15+. Async/await API built on `pg` (node-postgres). Part of the [Superloom](https://github.com/superloomdev/superloom).

> **Service-dependent module** - tests require either Docker (emulated) or a real PostgreSQL-compatible database (integration).

> **Usage-agnostic with MySQL.** The public API is identical to `@superloomdev/js-server-helper-mysql` - same placeholders (`?` / `??`), same function signatures, same return shapes. Swap `Lib.SqlDB = require('...mysql')` for `require('...postgres')` and your application code keeps running.

## API

All I/O functions accept `instance` (from `Lib.Instance.initialize`) as their first argument - enabling request-level performance tracing via `instance.time_ms`.

| Function | Purpose |
|---|---|
| `getRow(instance, sql, params)` | First row (or null) |
| `getRows(instance, sql, params)` | All rows |
| `getValue(instance, sql, params)` | First column of first row (scalar) |
| `get(instance, sql, params)` | Auto-shape result (scalar / row / rows / null) when the caller doesn't know the shape |
| `write(instance, sql, params?)` | INSERT / UPDATE / DELETE. String = single statement. Array = atomic transaction. Returns `affected_rows` + `insert_id` (use `RETURNING id`) |
| `getClient(instance)` / `releaseClient(client)` | Manual transaction management for complex commit/rollback flows |
| `buildQuery(sql, params)` | Compile to a fully-escaped Postgres SQL string (`?`/`??` syntax) |
| `buildRawText(str)` | Wrap a raw fragment so it bypasses escaping |
| `buildMultiCondition(data, operator?)` | Join equality conditions with AND/OR |
| `close()` | Close pool gracefully on SIGTERM (timeout controlled by `CLOSE_TIMEOUT_MS`) |

**Placeholders:** `?` for values, `??` for identifiers - identical to the MySQL helper. Internally translated to Postgres-native `$1, $2, …` with identifiers inlined as `"name"`.

**`insert_id`:** Postgres does not have `LAST_INSERT_ID()`. Add a `RETURNING id` clause to your INSERT - the module surfaces it as `insert_id`.

## Multi-DB Support

Each loader call returns an **independent instance** with its own pool. Load the module twice to connect to two databases - or a writer and a reader - from the same process:

```javascript
Lib.PrimaryDB = require('@superloomdev/js-server-helper-postgres')(Lib, {
  HOST: 'primary-db.example.com',
  DATABASE: 'app_db',
  USER: 'app_user',
  PASSWORD: process.env.PRIMARY_DB_PASSWORD,
  POOL_MAX: 20
});

Lib.ReaderDB = require('@superloomdev/js-server-helper-postgres')(Lib, {
  HOST: 'reader-db.example.com',
  DATABASE: 'app_db',
  USER: 'readonly_user',
  PASSWORD: process.env.READER_DB_PASSWORD,
  POOL_MAX: 10
});
```

Each instance maintains its own pool and lifecycle - call `close()` on each at process exit.

## Usage

```javascript
const Lib = {};
Lib.Utils = require('@superloomdev/js-helper-utils')();
Lib.Debug = require('@superloomdev/js-helper-debug')(Lib, { LOG_LEVEL: 'info' });
Lib.Instance = require('@superloomdev/js-server-helper-instance')(Lib, {});
Lib.SqlDB = require('@superloomdev/js-server-helper-postgres')(Lib, {
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

// INSERT with RETURNING for insert_id
const res = await Lib.SqlDB.write(
  instance,
  'INSERT INTO ?? (name, email) VALUES (?, ?) RETURNING id',
  ['users', 'Alice', 'alice@example.com']
);
console.log(res.insert_id);   // new primary key

// Build once, run atomically
const sql = [
  Lib.SqlDB.buildQuery('INSERT INTO ?? (name) VALUES (?)', ['users', 'Bob']),
  Lib.SqlDB.buildQuery('UPDATE ?? SET count = count + ? WHERE id = ?',
    ['stats', 1, 42])
];
await Lib.SqlDB.write(instance, sql);   // atomic transaction
```

## Spatial Data (PostGIS)

Spatial SQL is supported via `buildRawText()` - no dedicated helpers needed:

```javascript
const point = Lib.SqlDB.buildRawText(
  "ST_GeomFromText('POINT(28.6139 77.2090)', 4326)"
);

await Lib.SqlDB.write(
  instance,
  Lib.SqlDB.buildQuery('INSERT INTO address (line1, point, latitude, longitude) VALUES (?, ?, ?, ?)',
    ['221B', point, 28.6139, 77.2090])
);
```

## Configuration (Loader)

| Config Key | Default | Description |
|---|---|---|
| `HOST` | `'localhost'` | Postgres host |
| `PORT` | `5432` | Postgres port |
| `DATABASE` | `''` | Database name |
| `USER` | `'postgres'` | Postgres user |
| `PASSWORD` | `''` | Postgres password |
| `SSL` | `false` | `false`, `true` (defaults), or explicit `{ ca, rejectUnauthorized }` for TLS-enforced managed databases |
| `POOL_MAX` | `10` | Max clients in pool. Lambda: `1`. Docker/EC2: `10-20` |
| `POOL_MIN` | `0` | Min idle clients |
| `POOL_IDLE_TIMEOUT_MS` | `60000` | Close idle clients after this many ms |
| `KEEP_ALIVE_INITIAL_DELAY_MS` | `10000` | TCP keep-alive probe delay |
| `CONNECT_TIMEOUT_MS` | `10000` | Connection establishment timeout |
| `STATEMENT_TIMEOUT_MS` | `0` | Postgres statement timeout (`0` = disabled) |
| `APPLICATION_NAME` | `'superloom'` | Surfaces in `pg_stat_activity.application_name` |
| `CLOSE_TIMEOUT_MS` | `5000` | Max ms `close()` waits for active queries before force-destroying the pool |

## Environment Variables

Consumed by `_test/loader.js` - never read anywhere else.

| Variable | Emulated (Dev) | Integration (Real DB) |
|---|---|---|
| `POSTGRES_HOST` | `localhost` | `<cluster-endpoint>` |
| `POSTGRES_PORT` | `5432` | `5432` |
| `POSTGRES_DATABASE` | `test_db` | `test_db` |
| `POSTGRES_USER` | `test_user` | `unit_tester` |
| `POSTGRES_PASSWORD` | `test_pw` | `__dev__/secrets/sandbox.md` |

## Peer Dependencies (Injected via Loader)

| Package | Purpose |
|---|---|
| `@superloomdev/js-helper-utils` | Type checks, data manipulation |
| `@superloomdev/js-helper-debug` | Structured logging, `performanceAuditLog` |
| `@superloomdev/js-server-helper-instance` | Request lifecycle - `instance.time_ms` |

## Direct Dependencies (Bundled)

| Package | Purpose |
|---|---|
| `pg` | node-postgres driver (lazy-loaded) |

## Testing

| Tier | Runtime | Status |
|---|---|---|
| **Emulated Tests** | Postgres 17 (Docker) | [![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml) |
| **Integration Tests** | Real PostgreSQL 15+ database | ![Integration Tests](https://img.shields.io/badge/Integration_Tests-not_yet_tested-lightgrey) |

### Emulated (Docker)

```bash
cd _test && npm install && npm test
```

Docker lifecycle is automatic: `pretest` starts the Postgres container, `posttest` stops and removes it (containers and volumes only — images are cached). No manual `docker compose up` needed.

Full guide: `_test/ops/00-local-testing/postgres-local-setup.md`

### Integration (Real Database)

```bash
source init-env.sh   # select 'integration'
cd _test && npm install && npm test
```

Full guide: `_test/ops/01-integration-testing/postgres-integration-setup.md`

See [Module Testing](https://github.com/superloomdev/superloom/blob/main/docs/architecture/module-testing.md) for the full testing architecture.

## Notes

- Placeholders are `?` / `??` (not `$1`) to keep application code identical across MySQL and Postgres backends. Internally translated to Postgres-native `$1, $2, ...` before execution.
- Append `RETURNING id` to your INSERT statements to populate `insert_id` in the response - Postgres does not have MySQL's `LAST_INSERT_ID()`.
- `write()` is polymorphic: pass a single SQL string for one statement, or an array of statements (strings or `{sql, params}` objects) for an atomic transaction.
