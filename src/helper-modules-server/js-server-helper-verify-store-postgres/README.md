# @superloomdev/js-server-helper-verify-store-postgres

[![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-brightgreen.svg)](https://nodejs.org)

PostgreSQL store adapter for [`@superloomdev/js-server-helper-verify`](../js-server-helper-verify). Implements the 6-method store contract backed by Postgres via `@superloomdev/js-server-helper-sql-postgres`.

> **Service-dependent.** Tests require a running Postgres instance. The Docker lifecycle is managed automatically by `npm test` via `pretest`/`posttest` scripts — no manual `docker compose` needed.

## How This Adapter Fits In

The verify module calls this adapter as a factory:

```js
const store = require('@superloomdev/js-server-helper-verify-store-postgres')(Lib, CONFIG, ERRORS);
```

The adapter receives the full narrowed `Lib` (Utils, Debug), the merged `CONFIG` (from which it extracts `CONFIG.STORE_CONFIG` internally), and the frozen verify `ERRORS` catalog. It returns the 6-method store interface consumed by `verify.js`. The caller never needs to know which backend is active.

This is the standard **adapter factory protocol** shared by all `verify-store-*` packages.

## Install

```bash
npm install @superloomdev/js-server-helper-verify \
            @superloomdev/js-server-helper-verify-store-postgres \
            @superloomdev/js-server-helper-sql-postgres
```

## Usage

Pass the adapter factory to `STORE`. Pass the `Lib.Postgres` instance in `STORE_CONFIG`.

```js
const Lib = {};
Lib.Utils = require('@superloomdev/js-helper-utils')(Lib, {});
Lib.Debug = require('@superloomdev/js-helper-debug')(Lib, {});

Lib.Postgres = require('@superloomdev/js-server-helper-sql-postgres')(Lib, {
  HOST:     process.env.DB_HOST,
  DATABASE: process.env.DB_NAME,
  USER:     process.env.DB_USER,
  PASSWORD: process.env.DB_PASSWORD,
  POOL_MAX: 10
});

Lib.Verify = require('@superloomdev/js-server-helper-verify')(Lib, {
  STORE: require('@superloomdev/js-server-helper-verify-store-postgres'),
  STORE_CONFIG: {
    table_name: 'verification_codes',
    lib_sql:    Lib.Postgres
  }
});

// Create table + index at boot (idempotent)
await Lib.Verify.setupNewStore(Lib.Instance.initialize());
```

## STORE_CONFIG

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `table_name` | `String` | Yes | Name of the verification table. One table per verify instance. |
| `lib_sql` | `Object` | Yes | An initialized `Lib.Postgres` instance. |

## Schema

`setupNewStore` issues two idempotent DDL statements:

```sql
CREATE TABLE IF NOT EXISTS "verification_codes" (
  "scope" VARCHAR(64) NOT NULL,
  "key" VARCHAR(128) NOT NULL,
  "code" VARCHAR(32) NOT NULL,
  "fail_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" BIGINT NOT NULL,
  "expires_at" BIGINT NOT NULL,
  PRIMARY KEY ("scope", "key")
);

CREATE INDEX IF NOT EXISTS "idx_verification_codes_expires_at"
  ON "verification_codes" ("expires_at") WHERE "expires_at" IS NOT NULL;
```

### Postgres-Specific Notes

- **Identifiers** are double-quoted (`"col"`).
- **Partial index** on `expires_at` — only indexes rows that expire.
- **UPSERT** uses `INSERT ... ON CONFLICT (scope, key) DO UPDATE`.

## Store Contract

| Method | Signature | Returns |
|--------|-----------|---------|
| `setupNewStore` | `(instance)` | `{ success, error }` |
| `getRecord` | `(instance, scope, key)` | `{ success, record, error }` |
| `setRecord` | `(instance, scope, key, record)` | `{ success, error }` |
| `incrementFailCount` | `(instance, scope, key)` | `{ success, error }` |
| `deleteRecord` | `(instance, scope, key)` | `{ success, error }` |
| `cleanupExpiredRecords` | `(instance)` | `{ success, deleted_count, error }` |

## Expired Record Cleanup

Postgres has no native TTL. Run `cleanupExpiredRecords` on a cron or use `pg_cron`.

## Environment Variables

| Variable | Default (Docker) | Description |
|----------|------------------|-------------|
| `POSTGRES_HOST` | `localhost` | Postgres host |
| `POSTGRES_PORT` | `5432` | Postgres port |
| `POSTGRES_DATABASE` | `test_db` | Database name |
| `POSTGRES_USER` | `test_user` | Postgres user |
| `POSTGRES_PASSWORD` | `test_pw` | Postgres password |

## Peer Dependencies

| Package | Purpose |
|---------|---------|
| `@superloomdev/js-helper-utils` | Type checks |
| `@superloomdev/js-helper-debug` | Structured debug logging |
| `@superloomdev/js-server-helper-sql-postgres` | Postgres driver wrapper |

## Testing

```bash
cd _test && npm install && npm test
```

Docker lifecycle is fully automatic. `pretest` starts a Postgres 17 container; `posttest` stops and removes it.

## License

MIT
