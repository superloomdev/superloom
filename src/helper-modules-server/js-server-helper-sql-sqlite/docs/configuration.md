# Configuration — `js-server-helper-sql-sqlite`

Every loader option, every environment variable, dependency expectations, and the runtime patterns that combine them. For the function reference see [API Reference](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-sql-sqlite/docs/api.md).

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
- [In-Memory vs On-Disk](#in-memory-vs-on-disk)
- [Journal Mode and Concurrency](#journal-mode-and-concurrency)
- [Testing Tiers](#testing-tiers)

---

## Loader Pattern

The module is a factory. Each loader call returns an independent public interface with its own database handle, config, and lifecycle. The driver (`node:sqlite`) is cached at the module scope and shared across instances because it is stateless — only the handle holds state.

```javascript
Lib.SqlDB = require('@superloomdev/js-server-helper-sql-sqlite')(Lib, {
  FILE: '/var/data/app.db',
  JOURNAL_MODE: 'WAL',
  ENABLE_FOREIGN_KEYS: true
});
```

Loader call semantics:

- The first argument is the `Lib` container — the module reads `Lib.Utils` and `Lib.Debug` from it (see [Peer Dependencies](#peer-dependencies-injected)).
- The second argument is the config override. Whatever you pass is merged on top of the module's defaults (see [sqlite.config.js](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-sql-sqlite/sqlite.config.js)). Missing keys fall back to defaults.
- The database handle is **not** opened at loader time. It is opened lazily on the first query. This keeps cold-start fast in serverless and edge runtimes.

---

## Configuration Keys

| Key | Type | Required | Default | Description |
|---|---|---|---|---|
| `FILE` | `String` | No | `':memory:'` | Path to the SQLite file, or `':memory:'` for an in-memory database. See [In-Memory vs On-Disk](#in-memory-vs-on-disk) |
| `READONLY` | `Boolean` | No | `false` | When `true`, the handle is opened read-only. Writes will fail |
| `ENABLE_FOREIGN_KEYS` | `Boolean` | No | `true` | Enforce foreign-key constraints. SQLite defaults to disabled at the driver level — this module enables them at open by default |
| `TIMEOUT_MS` | `Number` | No | `5000` | Busy-handler timeout in milliseconds. How long SQLite will wait when a lock cannot be acquired before returning `SQLITE_BUSY`. `0` disables the busy handler |
| `JOURNAL_MODE` | `String` | No | `'WAL'` | `'DELETE'` (default in raw SQLite) / `'TRUNCATE'` / `'PERSIST'` / `'MEMORY'` / `'WAL'` / `'OFF'`. Ignored when `FILE` is `:memory:` (in-memory databases force `MEMORY`). See [Journal Mode and Concurrency](#journal-mode-and-concurrency) |
| `SYNCHRONOUS` | `String` | No | `'NORMAL'` | `'OFF'` / `'NORMAL'` / `'FULL'` / `'EXTRA'`. `'NORMAL'` is a good default for WAL. Use `'FULL'` for extra durability at the cost of throughput |
| `CLOSE_TIMEOUT_MS` | `Number` | No | `5000` | Present for API parity with MySQL / Postgres. SQLite's `close()` is synchronous; this value is unused |

Every key has a usable default. The most common override is `FILE` (point at a real path instead of `:memory:`) and occasionally `JOURNAL_MODE` (set to `'MEMORY'` or `'OFF'` for ephemeral on-disk data).

---

## Environment Variables

Environment variables are consumed only by `_test/loader.js`. The module itself never reads `process.env` directly — all configuration flows through the loader.

| Variable | Default | Purpose |
|---|---|---|
| `SQLITE_FILE` | unset → `:memory:` | Optional path to a file-backed test database. Leave unset (or `:memory:`) for in-memory tests |

When `SQLITE_FILE` points at a real file, the test loader switches `JOURNAL_MODE` to `WAL`; for `:memory:` it uses `MEMORY` automatically.

In your application code, set the variables you need and forward them to the loader explicitly. The module does not assume any specific variable names — `FILE`, `JOURNAL_MODE`, etc. accept any source.

---

## Peer Dependencies (Injected)

These come from your project's `Lib` container, not from this module's `package.json`. You install them in your project once and inject them into every helper.

| Package | Purpose |
|---|---|
| `@superloomdev/js-helper-utils` | Type checks, validation, data manipulation |
| `@superloomdev/js-helper-debug` | Structured logging plus `performanceAuditLog` for per-query timing |
| `@superloomdev/js-server-helper-instance` | Request lifecycle — provides `instance.time_ms` used by performance logging |

The `Lib.Instance` peer is technically optional — the module reads `instance.time_ms` defensively — but every production deployment should pass a real instance. Otherwise performance logging is degraded.

---

## Direct Dependencies (Bundled)

| Package | Source | Purpose |
|---|---|---|
| `node:sqlite` | Node.js built-in | SQLite driver. Lazy-loaded on first query, cached at module scope. Requires Node 22.13+ (stable) or 24+. |

There are **no** direct npm dependencies. The driver ships with Node itself.

---

## Multi-Database Setup

Each loader call returns an independent instance with its own database handle. Load the module twice (or more) to use several databases — for example a cache database plus an analytics database — from the same process:

```javascript
Lib.CacheDB = require('@superloomdev/js-server-helper-sql-sqlite')(Lib, {
  FILE: '/var/data/cache.db',
  JOURNAL_MODE: 'WAL'
});

Lib.AnalyticsDB = require('@superloomdev/js-server-helper-sql-sqlite')(Lib, {
  FILE: '/var/data/analytics.db',
  JOURNAL_MODE: 'WAL',
  SYNCHRONOUS: 'NORMAL'
});
```

Each instance maintains its own handle and lifecycle — call `close()` on each at process exit. Multiple loader calls **do not** share handles, transactions, or busy-handler state.

---

## In-Memory vs On-Disk

SQLite supports both modes through the same `FILE` key.

| `FILE` value | Mode | When to use |
|---|---|---|
| `':memory:'` | In-memory, lives for the lifetime of the loader instance | Tests, ephemeral computation, scratch databases. Forced `JOURNAL_MODE: 'MEMORY'` regardless of the configured value. |
| File path (e.g. `'/var/data/app.db'`) | On-disk, persists across restarts | Application data, caches, analytics, embedded config. Honors `JOURNAL_MODE` (typically `'WAL'`). |

In-memory databases are completely isolated per loader instance — two `:memory:` loaders **do not** share data. If you need a shared in-memory database between threads or processes, you need an external SQLite server (which defeats the purpose of using SQLite).

---

## Journal Mode and Concurrency

SQLite's journal mode determines how transactions are persisted to disk and which concurrency model the database uses. The default for this module is **`WAL`** (Write-Ahead Logging), which is the recommended mode for on-disk databases with concurrent readers.

| Mode | Behaviour | When to use |
|---|---|---|
| `'WAL'` | Writers and readers do not block each other. Concurrent reads + one writer. Two extra files (`-wal`, `-shm`) live next to the database. | **Default.** On-disk databases with concurrent reads. |
| `'DELETE'` | Classic rollback journal. Readers block on writes and vice versa. | Single-process applications where you don't want the `-wal`/`-shm` sidecar files. |
| `'TRUNCATE'` / `'PERSIST'` | Variants of `DELETE` with different teardown semantics. Rarely needed. | Edge cases involving filesystems that don't support file truncation efficiently. |
| `'MEMORY'` | Journal lives in memory. Faster, but a crash mid-write can corrupt the database. Forced for `:memory:`. | Ephemeral databases where durability is not a concern. |
| `'OFF'` | No journal. Crash mid-write **will** corrupt. Fastest possible writes. | Scratch databases that can be rebuilt from source. |

**`SYNCHRONOUS`** trades durability for throughput:

| Value | Behaviour |
|---|---|
| `'OFF'` | Returns from `write()` before disk has confirmed. Can corrupt on power loss. |
| `'NORMAL'` | **Default.** Syncs at critical moments. Good balance for WAL. |
| `'FULL'` | Syncs after every transaction. Safer, slower. |
| `'EXTRA'` | Even more aggressive syncing. Rarely needed. |

**Recommendation:** start with `JOURNAL_MODE: 'WAL'` and `SYNCHRONOUS: 'NORMAL'` (the defaults). Only deviate when you have a measured reason.

---

## Testing Tiers

SQLite has a single test tier — there is no managed service to integrate against. The offline `node:sqlite` runtime is also the production runtime.

| Tier | Runtime | When to run | CI Status |
|---|---|---|---|
| **Offline** | In-memory SQLite via `node:sqlite` (or file-backed when `SQLITE_FILE` is set) | Every commit, every CI run | [![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml) |

### Offline (Default)

```bash
cd _test && npm install && npm test
```

By default the tests open an in-memory database. Nothing is persisted. The `node:sqlite` driver is built into Node — no separate install step is required.

### Optional: Test Against a File

To exercise on-disk behaviour (WAL journal, durable writes, busy-handler timeouts):

```bash
export SQLITE_FILE=/tmp/sqlite-test.db
cd _test && npm install && npm test
rm -f /tmp/sqlite-test.db /tmp/sqlite-test.db-wal /tmp/sqlite-test.db-shm
```

Leave `SQLITE_FILE` unset (or set to `:memory:`) for the default in-memory flow.

Full setup guide: [SQLite Local Setup](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-sql-sqlite/_test/ops/00-local-testing/sqlite-local-setup.md).

For the framework-wide testing architecture see [Module Testing](https://github.com/superloomdev/superloom/blob/main/docs/architecture/module-testing.md).
