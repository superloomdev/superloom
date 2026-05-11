# @superloomdev/js-server-helper-verify-store-mysql

[![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-brightgreen.svg)](https://nodejs.org)

MySQL store adapter for [`@superloomdev/js-server-helper-verify`](../js-server-helper-verify). Implements the 6-method store contract backed by MySQL via `@superloomdev/js-server-helper-sql-mysql`.

> **Service-dependent.** Tests require a running MySQL instance. The Docker lifecycle is managed automatically by `npm test` via `pretest`/`posttest` scripts.

## How This Adapter Fits In

```js
const store = require('@superloomdev/js-server-helper-verify-store-mysql')(Lib, CONFIG, ERRORS);
```

The adapter receives `Lib` (Utils, Debug), `CONFIG` (extracts `STORE_CONFIG`), and `ERRORS`. It returns the 6-method store interface consumed by `verify.js`.

## Install

```bash
npm install @superloomdev/js-server-helper-verify \
            @superloomdev/js-server-helper-verify-store-mysql \
            @superloomdev/js-server-helper-sql-mysql
```

## Usage

```js
Lib.MySQL = require('@superloomdev/js-server-helper-sql-mysql')(Lib, {
  HOST:     process.env.DB_HOST,
  DATABASE: process.env.DB_NAME,
  USER:     process.env.DB_USER,
  PASSWORD: process.env.DB_PASSWORD,
  POOL_MAX: 10
});

Lib.Verify = require('@superloomdev/js-server-helper-verify')(Lib, {
  STORE: require('@superloomdev/js-server-helper-verify-store-mysql'),
  STORE_CONFIG: {
    table_name: 'verification_codes',
    lib_sql:    Lib.MySQL
  }
});

await Lib.Verify.setupNewStore(Lib.Instance.initialize());
```

## STORE_CONFIG

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `table_name` | `String` | Yes | Name of the verification table. |
| `lib_sql` | `Object` | Yes | An initialized `Lib.MySQL` instance. |

## Schema

```sql
CREATE TABLE IF NOT EXISTS `verification_codes` (
  `scope` VARCHAR(64) NOT NULL,
  `key` VARCHAR(128) NOT NULL,
  `code` VARCHAR(32) NOT NULL,
  `fail_count` INTEGER NOT NULL DEFAULT 0,
  `created_at` BIGINT NOT NULL,
  `expires_at` BIGINT NOT NULL,
  PRIMARY KEY (`scope`, `key`)
) ENGINE=InnoDB;

CREATE INDEX IF NOT EXISTS `idx_verification_codes_expires_at`
  ON `verification_codes` (`expires_at`);
```

### MySQL-Specific Notes

- **Backticks** for identifiers (`` `col` ``).
- **Engine** is `InnoDB` for transaction support.
- **UPSERT** uses `INSERT ... ON DUPLICATE KEY UPDATE`.

## Store Contract

| Method | Signature | Returns |
|--------|-----------|---------|
| `setupNewStore` | `(instance)` | `{ success, error }` |
| `getRecord` | `(instance, scope, key)` | `{ success, record, error }` |
| `setRecord` | `(instance, scope, key, record)` | `{ success, error }` |
| `incrementFailCount` | `(instance, scope, key)` | `{ success, error }` |
| `deleteRecord` | `(instance, scope, key)` | `{ success, error }` |
| `cleanupExpiredRecords` | `(instance)` | `{ success, deleted_count, error }` |

## Cleanup

MySQL has no native TTL. Run `cleanupExpiredRecords` via cron or MySQL `EVENT` scheduler.

## Testing

```bash
cd _test && npm install && npm test
```

Docker lifecycle is fully automatic.

## License

MIT
