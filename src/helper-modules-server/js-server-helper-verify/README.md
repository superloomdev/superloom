# @superloomdev/js-server-helper-verify

[![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-brightgreen.svg)](https://nodejs.org)

One-time verification code lifecycle: generate, store, validate, consume. Storage-agnostic adapter pattern so the same module backs DynamoDB, MongoDB, Postgres, MySQL, SQLite, or a JSON file. Three create interfaces for the three common shapes (numeric pin, alphanumeric code, URL-safe token) and one verify interface that consumes any of them. Part of the [Superloom](https://github.com/superloomdev/superloom).

## Tested Against

The integration suite at `_test/integration/` runs the same assertion suite against five real storage backends. All seven contract tests pass on every backend, plus the SQL cleanup helper passes on all three SQL dialects:

| Backend | Adapter | Schema | Native TTL | Status |
|---|---|---|---|---|
| **PostgreSQL 17** | `_test/integration/adapters/sql.adapter.js` | `verification_codes` table, composite PK `(scope, id)` | No - use `cleanup-sql.js` | Passing |
| **MySQL 8.0.44** | same SQL adapter (dialect: `mysql`) | same SQL schema | No - use `cleanup-sql.js` or `EVENT` scheduler | Passing |
| **SQLite** (built-in `node:sqlite`) | same SQL adapter (dialect: `sqlite`) | same SQL schema | No - use `cleanup-sql.js` from setInterval/cron | Passing |
| **MongoDB 8.2** | `_test/integration/adapters/mongodb.adapter.js` | collection with compound `_id: { scope, id }`, TTL index on `_ttl` | Yes (sweeps every ~60s) | Passing |
| **DynamoDB** (Local + AWS) | `_test/integration/adapters/dynamodb.adapter.js` | partition key `scope`, sort key `id`, TTL on `expires_at` | Yes (sweeps within 48h) | Passing |

Run `_test/integration/` locally with `docker compose up -d && npm test`. See `_test/integration/README.md` for the full setup.

## Peer Dependencies (Injected via Loader)

- `@superloomdev/js-helper-utils` - injected as `Lib.Utils`
- `@superloomdev/js-helper-debug` - injected as `Lib.Debug`
- `@superloomdev/js-server-helper-crypto` - injected as `Lib.Crypto`
- `@superloomdev/js-server-helper-instance` - injected as `Lib.Instance`

## Direct Dependencies (Bundled)

None.

## Installation

```bash
npm install @superloomdev/js-server-helper-verify
```

The four peer dependencies above (`js-helper-utils`, `js-helper-debug`, `js-server-helper-crypto`, `js-server-helper-instance`) come from the host project's `package.json` and are injected via the loader's `Lib` argument. The verify module never imports them directly.

## Quick Start

```javascript
// Build the project's storage adapter (see "Storage Adapter" section)
const store = buildStoreAdapter(Lib);

// Wire the verify module - both STORE and ERRORS are required
Lib.Verify = require('@superloomdev/js-server-helper-verify')(Lib, {
  STORE: store,
  ERRORS: Lib.Auth.errors  // your domain error catalog - see "Caller Responsibility"
});

// Send a 6-digit numeric pin
const created = await Lib.Verify.createPin(instance, {
  scope: 'user.123',
  key: 'login-phone.+919999912345',
  length: 6,
  ttl_seconds: 300,
  cooldown_seconds: 60
});
// { success: true, code: '742856', expires_at: 1730000300, error: null }

// User submits the pin from their SMS
const result = await Lib.Verify.verify(instance, {
  scope: 'user.123',
  key: 'login-phone.+919999912345',
  value: '742856',
  max_fail_count: 3
});
// { success: true, error: null }
```

## Public API

| Function | Charset | Typical Use |
|---|---|---|
| `createPin(instance, options)` | `0-9` (10 chars) | SMS OTP, phone-keypad codes |
| `createCode(instance, options)` | `0-9 A-Z` minus `I L O U` (32 chars, Crockford Base32) | Login codes printed or read aloud |
| `createToken(instance, options)` | `a-z A-Z 0-9` (62 chars) | Magic-link query parameter |
| `verify(instance, options)` | (any of the above) | Validate a submitted value |
| `cleanupExpiredRecords(instance)` | n/a | Delete expired records (optional adapter method) |

### `options` for `createPin` / `createCode` / `createToken`

| Field | Type | Description |
|---|---|---|
| `scope` | String | Logical owner namespace (e.g. `'user.123'`) |
| `key` | String | Specific verification purpose (e.g. `'login-phone.+12345'`) |
| `length` | Integer | Number of characters in the generated code |
| `ttl_seconds` | Integer | Lifetime before expiry |
| `cooldown_seconds` | Integer | Minimum gap before another code can be issued for the same scope+key. Use `0` for no cooldown. |

### `options` for `verify`

| Field | Type | Description |
|---|---|---|
| `scope` | String | Same scope used at creation |
| `key` | String | Same key used at creation |
| `value` | String | Value the caller submitted |
| `max_fail_count` | Integer | Reject after this many failed attempts on the record |

### Return envelopes

```javascript
// createPin / createCode / createToken
{ success: true,  code: '742856', expires_at: 1730000300, error: null }
{ success: false, code: null,     expires_at: null,       error: <CONFIG.ERRORS.COOLDOWN_ACTIVE> }
{ success: false, code: null,     expires_at: null,       error: <CONFIG.ERRORS.STORE_READ_FAILED> }
{ success: false, code: null,     expires_at: null,       error: <CONFIG.ERRORS.STORE_WRITE_FAILED> }
// Bad arguments throw TypeError synchronously - never returned as envelope

// verify
{ success: true,  error: null }                                  // matched
{ success: false, error: <CONFIG.ERRORS.NOT_FOUND> }
{ success: false, error: <CONFIG.ERRORS.EXPIRED> }
{ success: false, error: <CONFIG.ERRORS.MAX_FAILS> }
{ success: false, error: <CONFIG.ERRORS.WRONG_VALUE> }
{ success: false, error: <CONFIG.ERRORS.STORE_READ_FAILED> }
// Bad arguments throw TypeError synchronously - never returned as envelope

// cleanupExpiredRecords
{ success: true,  deleted_count: 5,  error: null }                // cleaned
{ success: false, deleted_count: 0,  error: { type: 'CLEANUP_NOT_SUPPORTED', ... } }
{ success: false, deleted_count: 0,  error: { type: 'CLEANUP_FAILED', ... } }
```

`success: true` means "this verify operation completed positively". Anything else - business outcome (NOT_FOUND, EXPIRED, etc.) or infrastructure failure (STORE_*) - returns `success: false` with `error` populated by the matching `CONFIG.ERRORS[*]` object. The caller branches on `success`, never on `error.type` or `error.code`.

## Caller Responsibility (Error Handling)

Every failure mode in this module falls into one of three buckets. The bucket determines who handles the failure and how the caller branches on it.

### 1. Programmer errors -> thrown synchronously (TypeError)

Malformed arguments to `createPin` / `createCode` / `createToken` / `verify` (missing `options`, missing `scope`, non-integer `length`, etc.) **throw a `TypeError`**. These are bugs in the calling service and must surface loudly in development. They are never returned as an envelope. Do not catch them and translate - fix the caller.

### 2. Domain / business outcomes -> envelope, status 4xx

These are normal expected outcomes that the user must be told about:

- `COOLDOWN_ACTIVE` - another code is still inside the cooldown window (HTTP 429)
- `NOT_FOUND` - no record for this scope+key (HTTP 400)
- `EXPIRED` - record exists but is past its TTL (HTTP 400)
- `MAX_FAILS` - record locked after too many wrong attempts (HTTP 429)
- `WRONG_VALUE` - submitted value did not match (HTTP 400)

The system is working correctly - the user just needs feedback on what to do.

### 3. Infrastructure errors -> envelope, status 5xx

These mean something is broken and dev-ops should be alerted:

- `STORE_READ_FAILED` / `STORE_WRITE_FAILED` - adapter (storage) returned a failure (HTTP 503)

The verify module logs these internally at `Lib.Debug.debug` level; the caller does not need to log them again.

### How the caller stays one-line per call

Because both bucket 2 and bucket 3 produce envelopes whose `error` is already a domain-shape object (whatever you injected via `CONFIG.ERRORS`), the calling service does not need a per-error `if`/`switch`:

```javascript
// auth.service.js
const requestOtp = async function (instance, phone_number) {

  const result = await Lib.Verify.createPin(instance, {
    scope: 'user',
    key: 'login-phone.' + phone_number,
    length: 6,
    ttl_seconds: 300,
    cooldown_seconds: 60
  });

  // Pass-through: result.error is already a domain error from Lib.Auth.errors
  if (result.success === false) {
    return { success: false, error: result.error };
  }

  // Success - return code so the SMS module can deliver it
  return { success: true, data: { code: result.code, expires_at: result.expires_at } };

};


const consumeOtp = async function (instance, phone_number, value) {

  const result = await Lib.Verify.verify(instance, {
    scope: 'user',
    key: 'login-phone.' + phone_number,
    value: value,
    max_fail_count: 3
  });

  // Pass-through covers NOT_FOUND, EXPIRED, MAX_FAILS, WRONG_VALUE, and STORE_*
  if (result.success === false) {
    return { success: false, error: result.error };
  }

  return { success: true, data: { verified: true } };

};
```

### Wiring the ERRORS catalog

The verify loader **requires** a `CONFIG.ERRORS` object. The keys are fixed (the seven failure modes above); the values are whatever shape your application uses for client-facing errors. The verify module never inspects the values - it just stores them at construction and returns the matching one on each failure path.

```javascript
// auth.errors.js - your domain error catalog (already exists in your model layer)
module.exports = {

  OTP_COOLDOWN_ACTIVE: {
    code: 'AUTH_OTP_COOLDOWN_ACTIVE',
    message: 'Please wait a moment before requesting another code.',
    status: 429
  },

  OTP_NOT_FOUND: {
    code: 'AUTH_OTP_NOT_FOUND',
    message: 'No verification code is active. Please request a new one.',
    status: 400
  },

  OTP_EXPIRED: {
    code: 'AUTH_OTP_EXPIRED',
    message: 'This verification code has expired. Please request a new one.',
    status: 400
  },

  OTP_LOCKED: {
    code: 'AUTH_OTP_LOCKED',
    message: 'Too many failed attempts. Please request a new code.',
    status: 429
  },

  OTP_WRONG_VALUE: {
    code: 'AUTH_OTP_WRONG_VALUE',
    message: 'The code you entered is incorrect.',
    status: 400
  },

  SERVICE_UNAVAILABLE: {
    code: 'AUTH_SERVICE_UNAVAILABLE',
    message: 'Authentication service is temporarily unavailable. Please try again.',
    status: 503
  }

};

// auth.loader.js - inject the catalog when constructing the verify module
Lib.Verify = require('@superloomdev/js-server-helper-verify')(Lib, {
  STORE: buildStoreAdapter(Lib),
  ERRORS: {
    COOLDOWN_ACTIVE:    Lib.Auth.errors.OTP_COOLDOWN_ACTIVE,
    NOT_FOUND:          Lib.Auth.errors.OTP_NOT_FOUND,
    EXPIRED:            Lib.Auth.errors.OTP_EXPIRED,
    MAX_FAILS:          Lib.Auth.errors.OTP_LOCKED,
    WRONG_VALUE:        Lib.Auth.errors.OTP_WRONG_VALUE,
    STORE_READ_FAILED:  Lib.Auth.errors.SERVICE_UNAVAILABLE,
    STORE_WRITE_FAILED: Lib.Auth.errors.SERVICE_UNAVAILABLE
  }
});
```

The loader validates that all seven keys are present and throws at construction if any is missing. There is no silent fallback. Bad-argument errors (TypeError) are not in the map because the helper throws on them - they bubble up as uncaught `TypeError`, fail the request loudly in development, and force the caller bug to be fixed.

## Lifecycle

Three independent defenses against abuse:

### Cooldown - rate-limit on creation

Before storing a new code, the module looks up the record for `(scope, key)`. If a record exists and `now - record.created_at < cooldown_seconds`, creation is refused with `COOLDOWN_ACTIVE`. This protects against an attacker spamming OTP requests (and your SMS bill). It applies even if the existing code was already used or is expired - any record inside the window blocks.

### Expiry - TTL

Each record carries `expires_at = now + ttl_seconds`. DynamoDB and MongoDB can use native TTL to auto-delete after `expires_at`. SQL and JSON adapters do not need native TTL: at consume time the module rejects any record where `now > expires_at` with `EXPIRED`. Expired rows linger until manual cleanup but cannot validate.

### Fail counter

The record stores `fail_count`, starting at `0`. On a wrong submitted value the adapter atomically increments `fail_count`. Once `fail_count >= max_fail_count` the record is rejected with `MAX_FAILS` even if the right value is later submitted. The user must request a fresh code (subject to cooldown).

### One-time use

On a successful match the record is deleted via `Lib.Instance.backgroundRoutine`. The same code cannot be reused; replays return `NOT_FOUND`.

### Scheduled cleanup of expired records

Expired records are **never validated** — the verify module rejects them at every call regardless of whether they still exist in storage. Cleanup is purely a storage hygiene concern: it bounds table size and prevents unbounded growth.

**Which backends need scheduled cleanup?**

| Backend | Native TTL | Cleanup needed? |
|---|---|---|
| **DynamoDB** | Yes — sweeps within 48 hours of `expires_at`, free, automatic | No. Enable TTL once (see [Schema Specifications](#schema-specifications)) and forget. |
| **MongoDB** | Yes — TTL index sweeps every ~60 seconds | No. Create the TTL index once (see [Schema Specifications](#schema-specifications)) and forget. |
| **PostgreSQL** | No | Yes — schedule `cleanupExpiredRecords` |
| **MySQL** | No | Yes — schedule `cleanupExpiredRecords` |
| **SQLite** | No | Yes — schedule `cleanupExpiredRecords` |

**Recommended frequency:** once per day is sufficient for most applications. Verification records are small (one row per active code) and expired records are harmless — they cannot validate. Higher frequency (every hour, every 5 minutes) is fine but rarely necessary.

**The cleanup script:**

```javascript
// cleanup-verify.js — one-shot script, called by cron / scheduler
'use strict';

// Bootstrap your project's Lib and Verify instance the same way your server does
const { Lib } = require('./path-to-your-loader')();

async function main () {

  const instance = Lib.Instance.initialize();
  const result = await Lib.Verify.cleanupExpiredRecords(instance);

  if (result.success) {
    Lib.Debug.info('Verify cleanup completed', { deleted_count: result.deleted_count });
  } else {
    Lib.Debug.error('Verify cleanup failed', { error: result.error });
    process.exitCode = 1;
  }

  // Close database connections so the process exits cleanly
  await Lib.Postgres.close(); // or Lib.MySQL.close(), etc.

}

main();
```

**Scheduling options:**

#### Docker (containerised deployments)

Add a cron service to your `docker-compose.yml`. This runs alongside your application container and executes the cleanup script on schedule:

```yaml
services:

  app:
    # ... your Express application

  verify-cleanup:
    image: node:24-alpine
    working_dir: /app
    volumes:
      - ./:/app
    entrypoint: ["crond", "-f", "-l", "2"]
    configs:
      - source: verify-crontab
        target: /var/spool/cron/crontabs/root

configs:
  verify-crontab:
    content: |
      0 3 * * * cd /app && node cleanup-verify.js >> /proc/1/fd/1 2>&1
```

This runs cleanup daily at 03:00 UTC. Output goes to the container's stdout for log collection.

#### Linux server (without Docker)

Use the system crontab. The cleanup script runs as a standalone Node process:

```bash
# Edit the crontab for the application user
crontab -e

# Add this line — runs daily at 03:00 server time
0 3 * * * cd /path/to/your/project && node cleanup-verify.js >> /var/log/verify-cleanup.log 2>&1
```

#### macOS (development / local server)

macOS uses `launchd` natively, but crontab also works:

```bash
crontab -e

# Runs daily at 03:00
0 3 * * * cd /path/to/your/project && node cleanup-verify.js >> /tmp/verify-cleanup.log 2>&1
```

#### AWS serverless (vendor-specific)

Use Amazon EventBridge (formerly CloudWatch Events) to trigger a Lambda function on a schedule. The Lambda handler calls `cleanupExpiredRecords` and exits:

```javascript
// handler.js — AWS Lambda handler for scheduled cleanup
'use strict';

const { Lib } = require('./loader')();

module.exports.handler = async function () {

  const instance = Lib.Instance.initialize();
  const result = await Lib.Verify.cleanupExpiredRecords(instance);

  return {
    statusCode: result.success ? 200 : 500,
    body: JSON.stringify(result)
  };

};
```

**EventBridge rule** (via `serverless.yml` or AWS Console):

```yaml
functions:
  verifyCleanup:
    handler: handler.handler
    events:
      - schedule:
          rate: rate(1 day)
          description: Delete expired verification records from SQL backend
```

> **Note:** if your SQL backend is DynamoDB or MongoDB, you do not need this Lambda at all — those backends handle expiry natively.

## Storage Adapter

The verify module never touches a database directly. The project supplies a `STORE` object with four async methods. The module loader validates the adapter at construction so misconfiguration fails fast.

```javascript
const store = {

  // Look up a record by composite (scope, key)
  // @returns { success, record: { code, fail_count, created_at, expires_at } | null, error }
  getRecord: async function (instance, scope, key) { /* ... */ },

  // Insert or overwrite (used on createPin / createCode / createToken)
  // @param record - { code, fail_count: 0, created_at, expires_at }
  // @returns { success, error }
  setRecord: async function (instance, scope, key, record) { /* ... */ },

  // Atomically increment fail counter (used on wrong submission)
  // @returns { success, error }
  incrementFailCount: async function (instance, scope, key) { /* ... */ },

  // Remove the record (used after a successful verify)
  // @returns { success, error }
  deleteRecord: async function (instance, scope, key) { /* ... */ },

  // OPTIONAL - delete all records where expires_at < now
  // For backends without native TTL (SQL). Omit for DynamoDB/MongoDB.
  // @returns { success, deleted_count, error }
  cleanupExpiredRecords: async function (instance) { /* ... */ }

};
```

The `error` returned by adapter methods is **internal** - the verify module logs it at `Lib.Debug.debug` level for diagnostics and then surfaces a domain error from `CONFIG.ERRORS` to the caller. Adapters can return whatever error shape they prefer (e.g. `{ type, message }` from a SQL helper); the verify module never forwards it.

If `STORE` is missing or any required method is not a function, the loader throws immediately. The optional `cleanupExpiredRecords` method is validated only when present - if provided as a non-function, the loader throws. If omitted, calling `Verify.cleanupExpiredRecords()` returns `{ success: false, error: { type: 'CLEANUP_NOT_SUPPORTED' } }`. There is no silent fallback adapter.

### Reference Adapter Implementations

Tested working adapters live under `_test/integration/adapters/`. Each is independently exercised against a real running database by the integration suite, so the code is guaranteed to compile, type-check, and satisfy the storage contract.

| Backend | File | Notes |
|---|---|---|
| **PostgreSQL / MySQL / SQLite** | `_test/integration/adapters/sql.adapter.js` | One adapter, three dialects. Pass `dialect: 'postgres' | 'mysql' | 'sqlite'` to select the upsert syntax. Uses the framework's SQL helpers (`Lib.Postgres`, `Lib.MySQL`, `Lib.SQLite`) which share an API. |
| **MongoDB** | `_test/integration/adapters/mongodb.adapter.js` | Uses the raw `mongodb` driver because the framework's MongoDB helper exposes `updateOne(filter, update)` with no options parameter, so `upsert: true` is unreachable. Compound `_id: { scope, id }` for the composite identifier. Stores `expires_at` (epoch seconds, read by the verify module) plus `_ttl` (BSON Date) for the TTL index. The leading underscore on `_ttl` marks it as a storage-layer mechanism. |
| **DynamoDB** | `_test/integration/adapters/dynamodb.adapter.js` | Uses `Lib.DynamoDB`. Atomic `fail_count` increment via the helper's `updateRecord(instance, table, key, null, null, { fail_count: 1 })`. |

To use an adapter in your project, copy the file and adjust the configuration:

```javascript
const buildSqlAdapter = require('./adapters/sql.adapter'); // or wherever you placed it

const Verify = require('@superloomdev/js-server-helper-verify')(Lib, {
  STORE: buildSqlAdapter(Lib.Postgres, { table: 'verification_codes', dialect: 'postgres' }),
  ERRORS: {
    COOLDOWN_ACTIVE:    Lib.Auth.errors.OTP_COOLDOWN_ACTIVE,
    NOT_FOUND:          Lib.Auth.errors.OTP_NOT_FOUND,
    EXPIRED:            Lib.Auth.errors.OTP_EXPIRED,
    MAX_FAILS:          Lib.Auth.errors.OTP_LOCKED,
    WRONG_VALUE:        Lib.Auth.errors.OTP_WRONG_VALUE,
    STORE_READ_FAILED:  Lib.Auth.errors.SERVICE_UNAVAILABLE,
    STORE_WRITE_FAILED: Lib.Auth.errors.SERVICE_UNAVAILABLE
  }
});
```

The schema each adapter expects is documented in [Schema Specifications](#schema-specifications) below.

#### JSON file (single-instance, low-volume)

No tested fixture yet. A reference implementation can be written using `node:fs/promises` and `proper-lockfile` (or similar) for read-modify-write under a file lock. Filter expired entries on read and rewrite the file. See the JSON schema in [Schema Specifications](#schema-specifications).

## Configuration

| Key | Default | Description |
|---|---|---|
| `STORE` | `null` (required) | Storage adapter object (4 required + 1 optional method) - see [Storage Adapter](#storage-adapter) |
| `ERRORS` | `null` (required) | Domain error catalog - map of seven keys (`COOLDOWN_ACTIVE`, `NOT_FOUND`, `EXPIRED`, `MAX_FAILS`, `WRONG_VALUE`, `STORE_READ_FAILED`, `STORE_WRITE_FAILED`) to your `[entity].errors.js` entries. See [Wiring the ERRORS catalog](#wiring-the-errors-catalog) |
| `PIN_CHARSET` | `'0123456789'` | Charset for `createPin` |
| `CODE_CHARSET` | `'0123456789ABCDEFGHJKMNPQRSTVWXYZ'` (Crockford Base32) | Charset for `createCode` |
| `TOKEN_CHARSET` | `'a-zA-Z0-9'` | Charset for `createToken` |

## Testing

| Tier | Runtime | Backends | Status |
|---|---|---|---|
| **Unit Tests** | Node.js `node --test` | In-memory `Map` adapter | [![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml) |
| **Integration Tests** | Node.js + Docker Compose | Postgres 17, MySQL 8.0.44, SQLite (`node:sqlite`), MongoDB 8.2, DynamoDB Local | Run locally - see below |

### Unit (offline)

```bash
cd _test
npm install && npm test
```

In-memory adapter, no database or service required. Runs in CI on every push.

### Integration (5 real backends)

```bash
cd _test/integration
npm install
docker compose up -d        # postgres + mysql + mongodb + dynamodb-local
cp .env.example .env
set -a && source .env && set +a
npm test                    # 46 tests across 5 backends, ~16 seconds
docker compose down -v
```

The integration loader builds five separate `Verify` instances - one per backend - and the test file runs the full lifecycle assertion suite against each. If a backend's adapter or schema is wrong, the failure is isolated to that backend.

See `_test/integration/README.md` for the per-backend details and `_test/integration/test.js` for the full assertion list.

See [Module Testing](https://github.com/superloomdev/superloom/blob/main/docs/architecture/module-testing.md) for the framework-wide testing architecture.

## Schema Specifications

The verify module is storage-agnostic. The shapes below are recommendations - any equivalent layout that the adapter can read and write satisfies the contract. Every example here is exercised by `_test/integration/` against a real running database.

> **Important:** TTL is a *storage hygiene* concern, not a *security* concern. The verify module's `consume` function rejects expired records at every call regardless of whether the storage layer has swept them. Cleanup only bounds table size.

### DynamoDB

**Schema**

```
Table:           verification_codes
Partition Key:   scope (String)        -> e.g. 'user.123'
Sort Key:        id    (String)        -> e.g. 'login-phone.+12345'
Attributes:
  code        (String)                  -> the generated value
  fail_count  (Number)                  -> atomic ADD on wrong value
  created_at  (Number)                  -> Unix epoch seconds
  expires_at  (Number)                  -> Unix epoch seconds (drives TTL)

Capacity:        On-demand (recommended - workload is intentionally bursty)
Backups:         disabled - this table is intentionally ephemeral
```

**TTL setup** (one-shot, idempotent)

```javascript
// Using @aws-sdk/client-dynamodb (UpdateTimeToLive is operational, not data-plane,
// so the framework's DynamoDB helper does not expose it)
import { DynamoDBClient, UpdateTimeToLiveCommand } from '@aws-sdk/client-dynamodb';

await dynamoClient.send(new UpdateTimeToLiveCommand({
  TableName: 'verification_codes',
  TimeToLiveSpecification: { Enabled: true, AttributeName: 'expires_at' }
}));
// AWS sweeps within 48 hours of expires_at being in the past - free, no app-side cron needed
```

**Cleanup:** automatic. DynamoDB deletes expired items in the background at no extra cost. No scheduled job or `cleanupExpiredRecords` adapter method needed. The adapter should omit `cleanupExpiredRecords`.

**Tested adapter:** `_test/integration/adapters/dynamodb.adapter.js`

### MongoDB

**Schema**

```
Collection:      verification_codes
Document shape:
  {
    _id:        { scope: 'user.123', id: 'login-phone.+12345' },   // compound _id
    code:       '742856',
    fail_count: 0,
    created_at: 1730000000,                                          // epoch seconds
    expires_at: 1730000300,                                          // epoch seconds (read by app)
    _ttl:       ISODate('2026-04-25T18:25:00Z')                      // BSON Date (drives TTL)
  }
```

**Indexes**

```javascript
// Compound _id is unique by definition - no extra unique index needed.
// Native TTL index on a Date field. MongoDB sweeps every ~60 seconds.
db.verification_codes.createIndex(
  { _ttl: 1 },
  { expireAfterSeconds: 0, name: 'verify_ttl_idx' }
);
```

The adapter writes both `expires_at` (Unix epoch, used by app logic) and `_ttl` (BSON Date, used by the TTL index). MongoDB's TTL only fires on Date fields; the verify module reads `expires_at`. The leading underscore on `_ttl` marks it as a storage-layer mechanism, not part of the verify record contract.

**Cleanup:** automatic. MongoDB's background TTL thread deletes expired documents every ~60 seconds. No scheduled job or `cleanupExpiredRecords` adapter method needed. The adapter should omit `cleanupExpiredRecords`.

**Tested adapter:** `_test/integration/adapters/mongodb.adapter.js`

### PostgreSQL / MySQL / SQLite

The same SQL schema works for all three engines because the column types are the intersection of the three:

```sql
CREATE TABLE verification_codes (
  scope        VARCHAR(255) NOT NULL,
  id           VARCHAR(255) NOT NULL,
  code         VARCHAR(255) NOT NULL,
  fail_count   INTEGER      NOT NULL DEFAULT 0,
  created_at   BIGINT       NOT NULL,
  expires_at   BIGINT       NOT NULL,
  PRIMARY KEY (scope, id)
);

CREATE INDEX verification_codes_expires_at_idx ON verification_codes (expires_at);
```

None of these engines has a native column TTL. Cleanup must be scheduled via `Verify.cleanupExpiredRecords(instance)` — see [Scheduled cleanup of expired records](#scheduled-cleanup-of-expired-records) for the full setup (Docker cron, Linux/macOS cron, AWS EventBridge + Lambda).

The verify module's `consume` check guarantees correctness regardless — cleanup only keeps the table small.

**Alternative: database-side schedulers** (no application-side cron needed)

If you prefer to handle cleanup entirely within the database rather than through the application's `cleanupExpiredRecords` adapter method:

**Postgres `pg_cron` extension:**

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'verify-cleanup',
  '0 3 * * *',                                            -- daily at 03:00
  $$DELETE FROM verification_codes WHERE expires_at < extract(epoch from now())$$
);
```

**MySQL `EVENT` scheduler:**

```sql
-- Requires `event_scheduler=ON` (set in my.cnf or `SET GLOBAL event_scheduler = ON`)
CREATE EVENT IF NOT EXISTS verify_cleanup
  ON SCHEDULE EVERY 1 DAY
  STARTS CURRENT_DATE + INTERVAL 3 HOUR
  DO DELETE FROM verification_codes WHERE expires_at < UNIX_TIMESTAMP();
```

SQLite has no built-in scheduler — use the application-side approach described in [Scheduled cleanup of expired records](#scheduled-cleanup-of-expired-records).

**Tested adapter:** `_test/integration/adapters/sql.adapter.js` (one adapter, three dialects via the `dialect: 'postgres'|'mysql'|'sqlite'` option).

**Tested cleanup helper:** `_test/integration/cleanup-sql.js`

Backups: exclude this table from your backup script regardless of engine.

### JSON file (future / single-instance)

```
File:            verification_codes.json
Shape:
  {
    'user.123::login-phone.+12345': {
      'code': '742856',
      'fail_count': 0,
      'created_at': 1730000000,
      'expires_at': 1730000300
    },
    'user.456::register-email.foo@bar.com': { ... }
  }

Concurrency:     OS-level file lock on read+write
Cleanup:         on every read, drop entries where expires_at < now and rewrite file
Backups:         exclude this file
Best for:        single-instance apps with very low verification volume
```

No tested fixture for this yet; the offline test (`_test/test.js`) uses an in-memory `Map` adapter that demonstrates the same shape.

## Recovery Codes - Out of Scope

Recovery codes are deliberately **not** managed by this module. They have a different lifecycle (durable, batch-generated, no TTL, no cooldown) and live with the user/auth model. This module's storage table is intended to be deletable at any time and never backed up. Recovery codes need to be backed up.

Store recovery codes inside the user model:

```javascript
{
  user_id: '...',
  recovery_codes: [
    { hash: '...', created_at: ..., used_at: null },
    { hash: '...', created_at: ..., used_at: null }
  ]
}
```

Hash the codes (don't store plaintext - they are long-lived). Mark `used_at` on use rather than deleting the entry.

## Patterns

- **Factory per loader:** every loader call returns its own `Verify` interface. Functions close over the `Lib`, `CONFIG`, and `STORE` captured at loader time. No module-level singletons.
- **Adapter validated at construction:** missing or non-function adapter methods throw at startup, not on first request.
- **Stateless module:** the verify module holds no per-instance resource. State lives behind the adapter.
- **Composite identity:** every operation uses `(scope, key)` as the record's identity. The adapter is free to map this to a partition+sort key, compound `_id`, composite primary key, or string composite as it sees fit.
- **Background cleanup:** post-success deletes use `Lib.Instance.backgroundRoutine` so the request returns immediately while cleanup runs in parallel.
- **Optional cleanup:** `cleanupExpiredRecords` is an optional fifth adapter method. SQL adapters implement it; NoSQL adapters (DynamoDB, MongoDB) omit it because they have native TTL. Calling `Verify.cleanupExpiredRecords(instance)` when the adapter omits the method returns `{ success: false, error: { type: 'CLEANUP_NOT_SUPPORTED' } }` - safe to call unconditionally.
