# @superloomdev/js-server-helper-sql-sqlite

[![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 22.13+](https://img.shields.io/badge/Node.js-22.13%2B-brightgreen.svg)](https://nodejs.org)

SQLite client for Node.js built on the **built-in `node:sqlite` module** (stable since Node.js 22.13 / 23.4). Zero external dependencies - the driver ships with Node. Part of the [Superloom](https://github.com/superloomdev/superloom).

> **Offline module** - tests run against an in-memory SQLite database. No Docker, no credentials, no network.

> **Usage-agnostic with MySQL and Postgres.** The public API is identical to `@superloomdev/js-server-helper-sql-mysql` and `@superloomdev/js-server-helper-sql-postgres` - same placeholders (`?` / `??`), same function signatures, same return shapes. Swap `Lib.SqlDB = require('...mysql')` for `require('...sqlite')` and your application code keeps running.

## API

All I/O functions accept `instance` (from `Lib.Instance.initialize`) as their first argument - enabling request-level performance tracing via `instance.time_ms`.

| Function | Purpose |
|---|---|
| `getRow(instance, sql, params)` | First row (or null) |
| `getRows(instance, sql, params)` | All rows |
| `getValue(instance, sql, params)` | First column of first row (scalar) |
| `get(instance, sql, params)` | Auto-shape result (scalar / row / rows / null) when the caller doesn't know the shape |
| `write(instance, sql, params?)` | INSERT / UPDATE / DELETE. String = single statement. Array = atomic transaction. Returns `affected_rows` + `insert_id` (from `sqlite3_last_insert_rowid()`) |
| `getClient(instance)` / `releaseClient(client)` | Return the underlying `DatabaseSync` handle. `releaseClient` is a no-op (SQLite has no pool) |
| `buildQuery(sql, params)` | Compile to a fully-escaped SQLite SQL string (`?`/`??` syntax) |
| `buildRawText(str)` | Wrap a raw fragment so it bypasses escaping |
| `buildMultiCondition(data, operator?)` | Join equality conditions with AND/OR |
| `close()` | Close the database handle. SQLite's close is synchronous; returns a resolved promise for API parity |

**Placeholders:** `?` for values, `??` for identifiers - identical to the MySQL / Postgres helpers. `??` is inlined as `"name"` before execution; `?` is bound natively by `node:sqlite`.

**`insert_id`:** SQLite populates `insert_id` automatically from `sqlite3_last_insert_rowid()` - no `RETURNING id` needed (unlike Postgres). For tables with `INTEGER PRIMARY KEY`, this IS the primary key. `INSERT ... RETURNING *` is also supported (row data is returned on read helpers).

## Multi-DB Support

Each loader call returns an **independent instance** with its own database handle. Load the module twice to use a cache DB plus an analytics DB from the same process:

```javascript
Lib.CacheDB = require('@superloomdev/js-server-helper-sqlite')(Lib, {
  FILE: '/var/data/cache.db',
  JOURNAL_MODE: 'WAL'
});

Lib.AnalyticsDB = require('@superloomdev/js-server-helper-sqlite')(Lib, {
  FILE: '/var/data/analytics.db',
  JOURNAL_MODE: 'WAL',
  SYNCHRONOUS: 'NORMAL'
});
```

Each instance maintains its own handle - call `close()` on each at process exit.

## Usage

```javascript
const Lib = {};
Lib.Utils = require('@superloomdev/js-helper-utils')();
Lib.Debug = require('@superloomdev/js-helper-debug')(Lib, { LOG_LEVEL: 'info' });
Lib.Instance = require('@superloomdev/js-server-helper-instance')(Lib, {});
Lib.SqlDB = require('@superloomdev/js-server-helper-sqlite')(Lib, {
  FILE: '/var/data/app.db',
  JOURNAL_MODE: 'WAL',
  ENABLE_FOREIGN_KEYS: true
});

const instance = Lib.Instance.initialize();

// Read many rows
const users = await Lib.SqlDB.getRows(
  instance,
  'SELECT id, name FROM ?? WHERE status = ?',
  ['users', 'active']
);

// INSERT - insert_id comes free via sqlite3_last_insert_rowid()
const res = await Lib.SqlDB.write(
  instance,
  'INSERT INTO ?? (name, email) VALUES (?, ?)',
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

## Configuration (Loader)

| Config Key | Default | Description |
|---|---|---|
| `FILE` | `':memory:'` | Path to the SQLite file, or `':memory:'` for an in-memory DB |
| `READONLY` | `false` | Open in read-only mode |
| `ENABLE_FOREIGN_KEYS` | `true` | Enforce foreign key constraints |
| `TIMEOUT_MS` | `5000` | Busy-handler timeout in milliseconds (how long to wait when the DB is locked) |
| `JOURNAL_MODE` | `'WAL'` | `'DELETE'`, `'TRUNCATE'`, `'PERSIST'`, `'MEMORY'`, `'WAL'`, or `'OFF'`. Ignored for `:memory:` |
| `SYNCHRONOUS` | `'NORMAL'` | `'OFF'`, `'NORMAL'`, `'FULL'`, or `'EXTRA'` |
| `CLOSE_TIMEOUT_MS` | `5000` | Present for API parity with MySQL / Postgres. `close()` is synchronous in SQLite |

## Peer Dependencies (Injected via Loader)

| Package | Purpose |
|---|---|
| `@superloomdev/js-helper-utils` | Type checks, data manipulation |
| `@superloomdev/js-helper-debug` | Structured logging, `performanceAuditLog` |
| `@superloomdev/js-server-helper-instance` | Request lifecycle - `instance.time_ms` |

## Direct Dependencies

None. The SQLite driver is the built-in `node:sqlite` module (lazy-loaded on first query).

## Testing

| Tier | Runtime | Status |
|---|---|---|
| **Offline Tests** | In-memory SQLite via `node:sqlite` | [![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml) |

```bash
cd _test
npm install
npm test
```

Full guide: `_test/ops/00-local-testing/sqlite-local-setup.md`

## Notes

- Placeholders are `?` / `??` (not `:name`) to keep application code identical across MySQL, Postgres, and SQLite. `??` is inlined at query time; `?` is bound natively.
- `insert_id` is auto-populated by SQLite's `lastInsertRowid`. `RETURNING id` works too (for `INSERT ... RETURNING *`) and is routed through the read path.
- `write()` is polymorphic: pass a single SQL string for one statement, or an array of statements (strings or `{sql, params}` objects) for an atomic transaction.
- Booleans are stored as `1` / `0` (SQLite has no native boolean type). Dates are stored as ISO 8601 text.
- For on-disk databases, `WAL` journal mode is applied at open for better concurrent-read performance.
