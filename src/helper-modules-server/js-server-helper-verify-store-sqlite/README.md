# @superloomdev/js-server-helper-verify-store-sqlite

[![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 22.13+](https://img.shields.io/badge/Node.js-22.13%2B-brightgreen.svg)](https://nodejs.org)

SQLite store adapter for [`@superloomdev/js-server-helper-verify`](../js-server-helper-verify). Implements the 6-method store contract backed by SQLite via `@superloomdev/js-server-helper-sql-sqlite`.

> **Offline module** — tests run against an in-memory SQLite database. No Docker, no credentials, no network.

## How This Adapter Fits In

The verify module calls this adapter as a factory:

```js
const store = require('@superloomdev/js-server-helper-verify-store-sqlite')(Lib, CONFIG, ERRORS);
```

The adapter receives the full narrowed `Lib` (Utils, Debug), the merged `CONFIG` (from which it extracts `CONFIG.STORE_CONFIG` internally), and the frozen verify `ERRORS` catalog (used verbatim in error envelopes). It returns the 6-method store interface consumed by `verify.js`. The caller never needs to know which backend is active.

This is the standard **adapter factory protocol** shared by all `verify-store-*` packages.

## Install

```bash
npm install @superloomdev/js-server-helper-verify \
            @superloomdev/js-server-helper-verify-store-sqlite \
            @superloomdev/js-server-helper-sql-sqlite
```

## Usage

Pass the adapter factory to `STORE`. Pass the `Lib.SQLite` instance in `STORE_CONFIG`.

```js
const Lib = {};
Lib.Utils = require('@superloomdev/js-helper-utils')(Lib, {});
Lib.Debug = require('@superloomdev/js-helper-debug')(Lib, {});

Lib.SQLite = require('@superloomdev/js-server-helper-sql-sqlite')(Lib, {
  FILE: '/var/data/verify.db',  // or ':memory:' for tests
  JOURNAL_MODE: 'WAL'
});

Lib.Verify = require('@superloomdev/js-server-helper-verify')(Lib, {
  STORE: require('@superloomdev/js-server-helper-verify-store-sqlite'),
  STORE_CONFIG: {
    table_name: 'verification_codes',
    lib_sql:    Lib.SQLite
  }
});

// Create table + index at boot (idempotent)
await Lib.Verify.setupNewStore(Lib.Instance.initialize());
```

## STORE_CONFIG

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `table_name` | `String` | Yes | Name of the verification table. One table per verify instance. |
| `lib_sql` | `Object` | Yes | An initialized `Lib.SQLite` instance (`@superloomdev/js-server-helper-sql-sqlite`). |

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

### SQLite-Specific Notes

- **Identifiers** are double-quoted (`"col"`). The adapter rejects any `table_name` containing a double-quote at loader time.
- **Partial index** on `expires_at` — SQLite ignores it for expired cleanup, keeping index size small.
- **UPSERT** uses `INSERT ... ON CONFLICT (scope, key) DO UPDATE` for idempotent writes.
- **Transaction safety** — SQLite `node:sqlite` module handles atomicity natively.

## Store Contract

This adapter implements the 6-method contract consumed by `verify.js`:

| Method | Signature | Returns |
|--------|-----------|---------|
| `setupNewStore` | `(instance)` | `{ success, error }` — idempotent table + index creation |
| `getRecord` | `(instance, scope, key)` | `{ success, record, error }` — fetch one verification record |
| `setRecord` | `(instance, scope, key, record)` | `{ success, error }` — upsert a verification record |
| `incrementFailCount` | `(instance, scope, key)` | `{ success, error }` — atomically increment fail counter |
| `deleteRecord` | `(instance, scope, key)` | `{ success, error }` — delete record after successful verify |
| `cleanupExpiredRecords` | `(instance)` | `{ success, deleted_count, error }` — sweep expired records |

## Expired Record Cleanup

SQLite has no native TTL. Run `cleanupExpiredRecords` on a cron:

```js
setInterval(async function () {
  const result = await Lib.Verify.cleanupExpiredRecords(Lib.Instance.initialize());
  if (result.success) {
    Lib.Debug.info('Cleanup deleted ' + result.deleted_count + ' expired codes');
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

`_test/store-contract-suite.js` is a local copy of the shared integration suite maintained by the verify module. It is not fetched from the verify package at test time — this keeps the adapter's test harness self-contained and records which contract version it was built against.

The suite covers:
- Adapter unit tests (Tier 1): store loader config validation, SQL coercion, partial index behavior, upsert idempotency, fail count increment
- Full verify lifecycle integration (Tier 3): `createPin`/`createCode`/`createToken`, `verify`, `cleanupExpiredRecords`, fail counting, expiry handling

## License

MIT
