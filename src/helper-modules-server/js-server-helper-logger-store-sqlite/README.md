# @superloomdev/js-server-helper-logger-store-sqlite

[![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 22.13+](https://img.shields.io/badge/Node.js-22.13%2B-brightgreen.svg)](https://nodejs.org)

SQLite store adapter for [`@superloomdev/js-server-helper-logger`](../js-server-helper-logger). Implements the 5-method store contract backed by SQLite via `@superloomdev/js-server-helper-sql-sqlite`.

> **Offline module** — tests run against an in-memory SQLite database. No Docker, no credentials, no network.

## How This Adapter Fits In

The logger module calls this adapter as a factory:

```js
const store = require('@superloomdev/js-server-helper-logger-store-sqlite')(Lib, CONFIG, ERRORS);
```

The adapter receives the full narrowed `Lib` (Utils, Debug, Crypto, Instance), the merged `CONFIG` (from which it extracts `CONFIG.STORE_CONFIG` internally), and the frozen logger `ERRORS` catalog (used verbatim in error envelopes). It returns the 5-method store interface consumed by `logger.js`. The caller never needs to know which backend is active.

This is the standard **adapter factory protocol** shared by all `logger-store-*` packages.

## Install

```bash
npm install @superloomdev/js-server-helper-logger \
            @superloomdev/js-server-helper-logger-store-sqlite \
            @superloomdev/js-server-helper-sql-sqlite
```

## Usage

Pass the adapter factory to `STORE`. Pass the `Lib.SQLite` instance in `STORE_CONFIG`.

```js
const Lib = {};
Lib.Utils    = require('@superloomdev/js-helper-utils')(Lib, {});
Lib.Debug    = require('@superloomdev/js-helper-debug')(Lib, {});
Lib.Crypto   = require('@superloomdev/js-server-helper-crypto')(Lib, {});
Lib.Instance = require('@superloomdev/js-server-helper-instance')(Lib, {});

Lib.SQLite = require('@superloomdev/js-server-helper-sql-sqlite')(Lib, {
  FILE: '/var/data/audit.db',  // or ':memory:' for tests
  JOURNAL_MODE: 'WAL'
});

Lib.Logger = require('@superloomdev/js-server-helper-logger')(Lib, {
  STORE: require('@superloomdev/js-server-helper-logger-store-sqlite'),
  STORE_CONFIG: {
    table_name: 'action_log',
    lib_sql:    Lib.SQLite
  },
  IP_ENCRYPT_KEY: process.env.IP_ENCRYPT_KEY  // optional
});

// Create table + index at boot (idempotent)
await Lib.Logger.setupNewStore(Lib.Instance.initialize());
```

## STORE_CONFIG

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `table_name` | `String` | Yes | Name of the log table. One table per logger instance. |
| `lib_sql` | `Object` | Yes | An initialized `Lib.SQLite` instance (`@superloomdev/js-server-helper-sql-sqlite`). |

## Schema

`setupNewStore` issues two idempotent DDL statements:

```sql
CREATE TABLE IF NOT EXISTS "action_log" (
  "scope" VARCHAR(64) NOT NULL,
  "entity_type" VARCHAR(64) NOT NULL,
  "entity_id" VARCHAR(128) NOT NULL,
  "actor_type" VARCHAR(64) NOT NULL,
  "actor_id" VARCHAR(128) NOT NULL,
  "action" VARCHAR(128) NOT NULL,
  "data" TEXT,
  "ip" VARCHAR(64),
  "user_agent" TEXT,
  "created_at" BIGINT NOT NULL,
  "created_at_ms" BIGINT NOT NULL,
  "sort_key" VARCHAR(24) NOT NULL,
  "expires_at" BIGINT,
  PRIMARY KEY ("scope", "entity_type", "entity_id", "sort_key")
);

CREATE INDEX IF NOT EXISTS "idx_action_log_expires_at"
  ON "action_log" ("expires_at") WHERE "expires_at" IS NOT NULL;
```

### SQLite-Specific Notes

- **Identifiers** are double-quoted (`"col"`). The adapter rejects any `table_name` containing a double-quote at loader time.
- **Partial index** on `expires_at` — SQLite ignores it for persistent rows (where `expires_at IS NULL`), keeping index size small.
- **Booleans** are not native in SQLite; the module stores the JSON representation directly.
- **Upsert** uses `INSERT ... ON CONFLICT (pk) DO UPDATE` for idempotent writes.
- **Transaction safety** — SQLite `node:sqlite` module handles atomicity natively.

## Store Contract

This adapter implements the 5-method contract consumed by `logger.js`:

| Method | Signature | Returns |
|--------|-----------|---------|
| `setupNewStore` | `(instance)` | `{ success, error }` — idempotent table + index creation |
| `addLog` | `(instance, record)` | `{ success, error }` — persist one log record |
| `getLogsByEntity` | `(instance, query)` | `{ success, records, next_cursor, error }` — "what happened to this entity?" |
| `getLogsByActor` | `(instance, query)` | `{ success, records, next_cursor, error }` — "what did this actor do?" |
| `cleanupExpiredLogs` | `(instance)` | `{ success, deleted_count, error }` — sweep expired rows |

`getLogsByEntity` and `getLogsByActor` support:
- Cursor-based pagination via `next_cursor`
- Optional action glob filtering (`'auth.*'`)
- Time range filtering (`start_time_ms`, `end_time_ms`)

## Expired Log Cleanup

SQLite has no native TTL. Run `cleanupExpiredLogs` on a cron:

```js
setInterval(async function () {
  const result = await Lib.Logger.cleanupExpiredLogs(Lib.Instance.initialize());
  if (result.success) {
    Lib.Debug.info('Cleanup deleted ' + result.deleted_count + ' expired logs');
  }
}, 3600 * 1000);  // hourly
```

## Environment Variables

Consumed by `_test/loader.js` — never read anywhere else.

| Variable | Default | Description |
|----------|---------|-------------|
| `SQLITE_FILE` | `':memory:'` | SQLite database file (or `:memory:`) |

## Peer Dependencies

| Package | Purpose |
|---------|---------|
| `@superloomdev/js-helper-utils` | Type checks |
| `@superloomdev/js-helper-debug` | Structured debug logging |
| `@superloomdev/js-server-helper-sql-sqlite` | SQLite driver wrapper (`Lib.SQLite`) |

## Testing

```bash
cd _test && npm install && npm test
```

Tests run against an in-memory SQLite database. No Docker, no external services.

`_test/store-contract-suite.js` is a local copy of the shared integration suite maintained by the logger module. It is not fetched from the logger package at test time — this keeps the adapter's test harness self-contained and records which contract version it was built against.

The suite covers:
- Adapter unit tests (Tier 1): store loader config validation, SQL coercion, partial index behavior, upsert idempotency
- Full logger lifecycle integration (Tier 3): every public Logger API path driven against the real SQLite backend via the store contract suite

## License

MIT
