# @superloomdev/js-server-helper-logger-store-mysql

[![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-brightgreen.svg)](https://nodejs.org)

MySQL store adapter for [`@superloomdev/js-server-helper-logger`](../js-server-helper-logger). Implements the 5-method store contract backed by MySQL via `@superloomdev/js-server-helper-sql-mysql`.

> **Service-dependent.** Tests require a running MySQL instance. The Docker lifecycle is managed automatically by `npm test` via `pretest`/`posttest` scripts — no manual `docker compose` needed.

## How This Adapter Fits In

The logger module calls this adapter as a factory:

```js
const store = require('@superloomdev/js-server-helper-logger-store-mysql')(Lib, CONFIG, ERRORS);
```

The adapter receives the full narrowed `Lib` (Utils, Debug, Crypto, Instance), the merged `CONFIG` (from which it extracts `CONFIG.STORE_CONFIG` internally), and the frozen logger `ERRORS` catalog (used verbatim in error envelopes). It returns the 5-method store interface consumed by `logger.js`. The caller never needs to know which backend is active.

This is the standard **adapter factory protocol** shared by all `logger-store-*` packages.

## Install

```bash
npm install @superloomdev/js-server-helper-logger \
            @superloomdev/js-server-helper-logger-store-mysql \
            @superloomdev/js-server-helper-sql-mysql
```

## Usage

Pass the adapter factory to `STORE`. Pass the `Lib.MySQL` instance in `STORE_CONFIG`.

```js
const Lib = {};
Lib.Utils    = require('@superloomdev/js-helper-utils')(Lib, {});
Lib.Debug    = require('@superloomdev/js-helper-debug')(Lib, {});
Lib.Crypto   = require('@superloomdev/js-server-helper-crypto')(Lib, {});
Lib.Instance = require('@superloomdev/js-server-helper-instance')(Lib, {});

Lib.MySQL = require('@superloomdev/js-server-helper-sql-mysql')(Lib, {
  HOST:     process.env.DB_HOST,
  DATABASE: process.env.DB_NAME,
  USER:     process.env.DB_USER,
  PASSWORD: process.env.DB_PASSWORD,
  POOL_MAX: 10
});

Lib.Logger = require('@superloomdev/js-server-helper-logger')(Lib, {
  STORE: require('@superloomdev/js-server-helper-logger-store-mysql'),
  STORE_CONFIG: {
    table_name: 'action_log',
    lib_sql:    Lib.MySQL
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
| `lib_sql` | `Object` | Yes | An initialized `Lib.MySQL` instance (`@superloomdev/js-server-helper-sql-mysql`). |

## Schema

`setupNewStore` issues two idempotent DDL statements:

```sql
CREATE TABLE IF NOT EXISTS `action_log` (
  `scope` VARCHAR(64) NOT NULL,
  `entity_type` VARCHAR(64) NOT NULL,
  `entity_id` VARCHAR(128) NOT NULL,
  `actor_type` VARCHAR(64) NOT NULL,
  `actor_id` VARCHAR(128) NOT NULL,
  `action` VARCHAR(128) NOT NULL,
  `data` TEXT,
  `ip` VARCHAR(64),
  `user_agent` TEXT,
  `created_at` BIGINT NOT NULL,
  `created_at_ms` BIGINT NOT NULL,
  `sort_key` VARCHAR(24) NOT NULL,
  `expires_at` BIGINT,
  PRIMARY KEY (`scope`, `entity_type`, `entity_id`, `sort_key`)
) ENGINE=InnoDB;

CREATE INDEX IF NOT EXISTS `idx_action_log_expires_at`
  ON `action_log` (`expires_at`);
```

### MySQL-Specific Notes

- **Backticks** for identifiers (`` `col` ``). The adapter rejects any `table_name` containing backticks at loader time.
- **Engine** is `InnoDB` for transaction support.
- **BIGINT** stores Unix timestamps. Returned as JavaScript numbers.
- **JSON** fields (`data`) are stored as `TEXT` and parsed on read for cross-backend consistency.
- **Upsert** uses `INSERT ... ON DUPLICATE KEY UPDATE` (MySQL-specific syntax).
- **Partial indexes** — MySQL 8.0.13+ supports partial indexes via `WHERE`; older versions create full index.

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

MySQL has no native TTL. Run `cleanupExpiredLogs` on a cron:

```js
setInterval(async function () {
  const result = await Lib.Logger.cleanupExpiredLogs(Lib.Instance.initialize());
  if (result.success) {
    Lib.Debug.info('Cleanup deleted ' + result.deleted_count + ' expired logs');
  }
}, 3600 * 1000);  // hourly, or daily for low-traffic systems
```

Alternative: Use MySQL `EVENT` scheduler for database-native cleanup.

## Environment Variables

Consumed by `_test/loader.js` — never read anywhere else.

| Variable | Default (Docker) | Description |
|----------|------------------|-------------|
| `MYSQL_HOST` | `localhost` | MySQL host |
| `MYSQL_PORT` | `3306` | MySQL port |
| `MYSQL_DATABASE` | `test_db` | Database name |
| `MYSQL_USER` | `test_user` | MySQL user |
| `MYSQL_PASSWORD` | `test_pw` | MySQL password |

## Peer Dependencies

| Package | Purpose |
|---------|---------|
| `@superloomdev/js-helper-utils` | Type checks |
| `@superloomdev/js-helper-debug` | Structured debug logging |
| `@superloomdev/js-server-helper-sql-mysql` | MySQL driver wrapper (`Lib.MySQL`) |

## Testing

```bash
cd _test && npm install && npm test
```

Docker lifecycle is fully automatic. `pretest` starts a MySQL 8 container; `posttest` stops and removes it (containers and volumes only — images are cached). No manual `docker compose up` needed.

`_test/store-contract-suite.js` is a local copy of the shared integration suite maintained by the logger module. It is not fetched from the logger package at test time — this keeps the adapter's test harness self-contained and records which contract version it was built against.

The suite covers:
- Adapter unit tests (Tier 1): store loader config validation, SQL coercion, index behavior, upsert idempotency
- Full logger lifecycle integration (Tier 3): every public Logger API path driven against the real MySQL backend via the store contract suite

## License

MIT
