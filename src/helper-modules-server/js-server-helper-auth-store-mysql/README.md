# @superloomdev/js-server-helper-auth-store-mysql

[![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-brightgreen.svg)](https://nodejs.org)

MySQL / MariaDB session store adapter for [`@superloomdev/js-server-helper-auth`](../js-server-helper-auth). Implements the 8-method store contract backed by MySQL via `@superloomdev/js-server-helper-sql-mysql`.

> **Service-dependent.** Tests require a running MySQL instance. The Docker lifecycle is managed automatically by `npm test` via `pretest`/`posttest` scripts — no manual `docker compose` needed.

## How This Adapter Fits In

The auth module calls this adapter as a factory:

```js
const store = require('@superloomdev/js-server-helper-auth-store-mysql')(Lib, CONFIG, ERRORS);
```

The adapter receives the full narrowed `Lib` (Utils, Debug, Crypto, Instance), the merged `CONFIG` (from which it extracts `CONFIG.STORE_CONFIG` internally), and the frozen auth `ERRORS` catalog (used verbatim in error envelopes). It returns the 8-method store interface consumed by `auth.js`. The caller — `auth.js` — never needs to know which backend is active.

This is the standard **adapter factory protocol** shared by all `auth-store-*` packages.

## Install

```bash
npm install @superloomdev/js-server-helper-auth \
            @superloomdev/js-server-helper-auth-store-mysql \
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

Lib.AuthUser = require('@superloomdev/js-server-helper-auth')(Lib, {
  STORE: require('@superloomdev/js-server-helper-auth-store-mysql'),
  STORE_CONFIG: {
    table_name: 'sessions_user',
    lib_sql:    Lib.MySQL
  },
  ACTOR_TYPE:  'user',
  TTL_SECONDS: 2592000
});

// Create table + index at boot (idempotent)
await Lib.AuthUser.setupNewStore(Lib.Instance.initialize());
```

## STORE_CONFIG

| Key | Type | Required | Description |
|---|---|---|---|
| `table_name` | `String` | Yes | Name of the sessions table. Use one table per `actor_type` (e.g. `sessions_user`, `sessions_admin`). |
| `lib_sql` | `Object` | Yes | An initialized `Lib.MySQL` instance (`@superloomdev/js-server-helper-sql-mysql`). |

## Schema

`setupNewStore` issues a single idempotent `CREATE TABLE IF NOT EXISTS` statement. The `expires_at` index is **inlined** into the `CREATE TABLE` definition (MySQL does not support `CREATE INDEX IF NOT EXISTS` as a standalone statement):

```sql
CREATE TABLE IF NOT EXISTS `sessions_user` (
  `tenant_id`           VARCHAR(64)  NOT NULL,
  `actor_id`            VARCHAR(128) NOT NULL,
  `actor_type`          VARCHAR(64)  NOT NULL,
  `token_key`           VARCHAR(64)  NOT NULL,
  `token_secret_hash`   VARCHAR(128) NOT NULL,
  `refresh_token_hash`  VARCHAR(128),
  `refresh_family_id`   VARCHAR(64),
  `created_at`          BIGINT NOT NULL,
  `expires_at`          BIGINT NOT NULL,
  `last_active_at`      BIGINT NOT NULL,
  `install_id`          VARCHAR(64),
  `install_platform`    VARCHAR(32)  NOT NULL,
  `install_form_factor` VARCHAR(32)  NOT NULL,
  `client_name`         VARCHAR(128),
  `client_version`      VARCHAR(64),
  `client_is_browser`   TINYINT(1) NOT NULL DEFAULT 0,
  `client_os_name`      VARCHAR(64),
  `client_os_version`   VARCHAR(64),
  `client_screen_w`     INT,
  `client_screen_h`     INT,
  `client_ip_address`   VARCHAR(64),
  `client_user_agent`   TEXT,
  `push_provider`       VARCHAR(32),
  `push_token`          VARCHAR(1024),
  `custom_data`         TEXT,
  PRIMARY KEY (`tenant_id`, `actor_id`, `token_key`),
  INDEX `idx_expires_at` (`expires_at`)
)
```

### MySQL-Specific Notes

- **Identifiers** are backtick-quoted (`` `col` ``) instead of double-quoted.
- **Booleans** (`client_is_browser`) are stored as `TINYINT(1)` (`0`/`1`). Defensively coerced on both write and read regardless of what `mysql2` returns.
- **BIGINT columns** (`created_at`, `expires_at`, `last_active_at`, `client_screen_w`, `client_screen_h`) usually arrive as JS numbers from `mysql2` but are defensively coerced from strings too.
- **`custom_data`** is serialized as a JSON string in the `TEXT` column and parsed back on read.
- **UPSERT** uses `INSERT ... ON DUPLICATE KEY UPDATE col = VALUES(col)` — the MySQL syntax, not the Postgres `ON CONFLICT` syntax.
- **`CREATE INDEX IF NOT EXISTS`** is not supported as a standalone DDL statement in MySQL. The `expires_at` index is inlined into the `CREATE TABLE` definition so that a single idempotent statement creates both the table and the index.

## Store Contract

This adapter implements the 8-method contract consumed by `auth.js`:

| Method | Signature | Returns |
|---|---|---|
| `setupNewStore` | `(instance)` | `{ success, error }` |
| `getSession` | `(instance, tenant_id, actor_id, token_key, token_secret_hash)` | `{ success, record, error }` |
| `listSessionsByActor` | `(instance, tenant_id, actor_id)` | `{ success, records, error }` |
| `setSession` | `(instance, record)` | `{ success, error }` |
| `updateSessionActivity` | `(instance, tenant_id, actor_id, token_key, updates)` | `{ success, error }` |
| `deleteSession` | `(instance, tenant_id, actor_id, token_key)` | `{ success, error }` |
| `deleteSessions` | `(instance, tenant_id, keys)` | `{ success, error }` |
| `cleanupExpiredSessions` | `(instance)` | `{ success, deleted_count, error }` |

`getSession` checks `token_secret_hash` after the primary key read. A wrong secret returns `{ record: null }` — identical to a missing row — to prevent timing-based enumeration.

`updateSessionActivity` throws `TypeError` if `updates` contains any identity or primary-key field. This is a programmer-error guard; `auth.js` never passes those fields.

`deleteSessions` batches all keys into a single `DELETE ... WHERE tenant_id = ? AND (...)` — one round-trip regardless of how many sessions are evicted.

`cleanupExpiredSessions` deletes all rows where `expires_at < instance.time` using the secondary index.

## Expired Session Cleanup

MySQL has no native TTL. Run `cleanupExpiredSessions` on a cron:

```js
setInterval(async function () {
  const result = await Lib.AuthUser.cleanupExpiredSessions(Lib.Instance.initialize());
  if (result.success) {
    Lib.Debug.info('Cleanup deleted ' + result.deleted_count + ' expired sessions');
  }
}, 3600 * 1000);
```

## Environment Variables

Consumed by `_test/loader.js` — never read anywhere else.

| Variable | Default (Docker) | Description |
|---|---|---|
| `MYSQL_HOST` | `localhost` | MySQL host |
| `MYSQL_PORT` | `3306` | MySQL port |
| `MYSQL_DATABASE` | `test_db` | Database name |
| `MYSQL_USER` | `test_user` | MySQL user |
| `MYSQL_PASSWORD` | `test_pw` | MySQL password |

## Peer Dependencies

| Package | Purpose |
|---|---|
| `@superloomdev/js-helper-utils` | Type checks |
| `@superloomdev/js-helper-debug` | Structured debug logging |
| `@superloomdev/js-server-helper-sql-mysql` | MySQL driver wrapper (`Lib.MySQL`) |

## Testing

```bash
cd _test && npm install && npm test
```

Docker lifecycle is fully automatic. `pretest` starts a MySQL 8 container; `posttest` stops and removes it (containers and volumes only — images are cached). No manual `docker compose up` needed.

`_test/store-contract-suite.js` is a local copy of the shared integration suite maintained by the auth module. It is not fetched from the auth package at test time — this keeps the adapter's test harness self-contained and records which contract version it was built against.

The suite covers:
- Adapter unit tests (Tier 1): store loader config validation, identifier quoting, boolean and `custom_data` coercions, hash-mismatch "not found" behavior, `updateSessionActivity` identity blocklist, upsert immutability, `cleanupExpiredSessions` deleted count
- Full auth lifecycle integration (Tier 3): every public Auth API path driven against the real MySQL backend via the store contract suite

## License

MIT
