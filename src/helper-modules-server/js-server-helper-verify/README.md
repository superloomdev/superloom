# @superloomdev/js-server-helper-verify

[![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 20.19+](https://img.shields.io/badge/Node.js-20.19%2B-brightgreen.svg)](https://nodejs.org)

One-time verification code lifecycle: generate, store, validate, consume. Built-in storage adapters for **memory** (tests), **sqlite**, **postgres**, **mysql**, **mongodb**, and **dynamodb** — pick one with a config string instead of writing your own. Three create interfaces (numeric pin, alphanumeric code, URL-safe token) and one verify interface that consumes any of them. Part of the [Superloom](https://github.com/superloomdev/superloom) framework.

Three independent defenses against abuse:

- **Cooldown** on creation — minimum gap between successive codes for the same `(scope, key)`.
- **Expiry (TTL)** — codes are useless after `expires_at`, regardless of cleanup cadence.
- **Per-record fail counter** — too many wrong attempts and the code is locked out.

A successful verify deletes the record in the background — codes are strictly one-time.

---

## Tested Backends

The shared store suite (`_test/shared-store-suite.js`) runs the same 14-case contract against every backend. Memory + SQLite need no Docker; the rest run via `_test/docker-compose.yml`.

| Backend | Schema | Native TTL | Cleanup |
|---|---|---|---|
| `memory` | In-memory `Map` | n/a (process-scoped) | `cleanupExpiredRecords` (linear scan) |
| `sqlite` | `verification_codes` table, composite PK `(scope, id)` | No | `cleanupExpiredRecords` |
| `postgres` | same SQL schema | No | `cleanupExpiredRecords` (or `pg_cron`) |
| `mysql` | same SQL schema | No | `cleanupExpiredRecords` (or `EVENT` scheduler) |
| `mongodb` | compound `_id: { scope, id }` + TTL index on `_ttl` | Yes (~60 s sweep) | TTL is automatic; `cleanupExpiredRecords` is the explicit fallback |
| `dynamodb` | partition `scope` + sort `id`, TTL on `expires_at` | Yes (~48 h sweep) | Enable AWS table-level TTL; `cleanupExpiredRecords` is the explicit fallback |

Run all backends end-to-end:

```bash
cd _test/
npm install
npm test     # spins up docker compose, runs every backend, tears it down
```

---

## Peer Dependencies (Injected via Loader)

- `@superloomdev/js-helper-utils` — `Lib.Utils`
- `@superloomdev/js-helper-debug` — `Lib.Debug`
- `@superloomdev/js-server-helper-crypto` — `Lib.Crypto`
- `@superloomdev/js-server-helper-instance` — `Lib.Instance`

Plus **one** of the following depending on the chosen `STORE`:

| `STORE` | Required helper |
|---|---|
| `'sqlite'` | `Lib.SQLite` (`@superloomdev/js-server-helper-sql-sqlite`) |
| `'postgres'` | `Lib.Postgres` (`@superloomdev/js-server-helper-sql-postgres`) |
| `'mysql'` | `Lib.MySQL` (`@superloomdev/js-server-helper-sql-mysql`) |
| `'mongodb'` | `Lib.MongoDB` (`@superloomdev/js-server-helper-nosql-mongodb`) |
| `'dynamodb'` | `Lib.DynamoDB` (`@superloomdev/js-server-helper-nosql-aws-dynamodb`) |
| `'memory'` | (none — for tests) |

The verify module **never** imports these helpers directly. Only the chosen store's source file is loaded, so unused backends never pull in their npm dependencies.

---

## Installation

```bash
npm install @superloomdev/js-server-helper-verify
```

---

## Quick Start

```javascript
// One-time setup at boot
Lib.Verify = require('@superloomdev/js-server-helper-verify')(Lib, {
  STORE: 'postgres',
  STORE_CONFIG: {
    table_name: 'verification_codes',
    lib_sql: Lib.Postgres
  },
  ERRORS: Lib.Auth.errors    // your domain error catalog (see below)
});

// Idempotent table + index creation
await Lib.Verify.initializeStore(instance);

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

---

## Public API

| Function | Charset | Typical Use |
|---|---|---|
| `createPin(instance, options)` | `0-9` (10 chars) | SMS OTP, phone-keypad codes |
| `createCode(instance, options)` | Crockford Base32 (`0-9 A-Z` minus `I L O U`) | Login codes printed or read aloud |
| `createToken(instance, options)` | `a-z A-Z 0-9` (62 chars) | Magic-link query parameter |
| `verify(instance, options)` | any of the above | Validate a submitted value |
| `initializeStore(instance)` | n/a | Idempotent backend setup (CREATE TABLE / createIndex / CreateTable) |
| `cleanupExpiredRecords(instance)` | n/a | Sweep expired records (cron-driven) |

### `options` for `createPin` / `createCode` / `createToken`

| Field | Type | Description |
|---|---|---|
| `scope` | String | Logical owner namespace (e.g. `'user.123'`) |
| `key` | String | Specific verification purpose (e.g. `'login-phone.+12345'`) |
| `length` | Integer | Number of characters in the generated code |
| `ttl_seconds` | Integer | Lifetime before expiry |
| `cooldown_seconds` | Integer | Minimum gap before another code can be issued for the same `scope`+`key`. Use `0` for no cooldown. |

### `options` for `verify`

| Field | Type | Description |
|---|---|---|
| `scope` | String | Same scope used at creation |
| `key` | String | Same key used at creation |
| `value` | String | Value the caller submitted |
| `max_fail_count` | Integer | After this many failed attempts, the record is locked out |

### Return shapes

```javascript
// createPin / createCode / createToken
{ success: true,  code: '742856', expires_at: 1730000300, error: null }
{ success: false, code: null,     expires_at: null,        error: <DOMAIN_ERROR> }

// verify
{ success: true,  error: null }
{ success: false, error: <DOMAIN_ERROR> }
```

---

## Configuration

| Key | Default | Notes |
|---|---|---|
| `STORE` | `null` (required) | One of `'memory' | 'sqlite' | 'postgres' | 'mysql' | 'mongodb' | 'dynamodb'` |
| `STORE_CONFIG` | `null` (required) | Per-store config; shape varies (see below) |
| `ERRORS` | `null` (required) | Map of seven failure keys to your domain error objects |
| `PIN_CHARSET` | `'0123456789'` | Override only if you need a non-numeric "pin" |
| `CODE_CHARSET` | `'0123456789ABCDEFGHJKMNPQRSTVWXYZ'` | Crockford Base32 |
| `TOKEN_CHARSET` | `a-zA-Z0-9` | URL-safe |

### `STORE_CONFIG` per backend

| Backend | Required `STORE_CONFIG` keys |
|---|---|
| `memory` | `{}` (no config) |
| `sqlite` | `{ table_name: 'verification_codes', lib_sql: Lib.SQLite }` |
| `postgres` | `{ table_name: 'verification_codes', lib_sql: Lib.Postgres }` |
| `mysql` | `{ table_name: 'verification_codes', lib_sql: Lib.MySQL }` |
| `mongodb` | `{ collection_name: 'verification_codes', lib_mongodb: Lib.MongoDB }` |
| `dynamodb` | `{ table_name: 'verification_codes', lib_dynamodb: Lib.DynamoDB }` |

### `ERRORS` — required keys

Every key must be present at construction or the loader throws. Each value is whatever shape your application uses for client-facing errors (typically `{ code, message, status }` from your `[entity].errors.js`).

| Key | Status | Surfaced when |
|---|---|---|
| `COOLDOWN_ACTIVE` | 429 | createPin/Code/Token while a previous code is still inside the cooldown window |
| `NOT_FOUND` | 400 | verify with no record for this `scope`+`key` |
| `EXPIRED` | 400 | verify on a record past `expires_at` |
| `MAX_FAILS` | 429 | verify after `record.fail_count >= max_fail_count` |
| `WRONG_VALUE` | 400 | verify on a record whose code does not match |
| `STORE_READ_FAILED` | 503 | Adapter `getRecord` returned `success: false` |
| `STORE_WRITE_FAILED` | 503 | Adapter `setRecord` returned `success: false` |

The verify module returns these objects **verbatim** on every failure path so your controllers can pass-through:

```javascript
const result = await Lib.Verify.verify(instance, options);
if (result.success === false) {
  return { success: false, error: result.error };  // pass-through
}
// success path
```

No per-error `if`/`switch` is needed.

---

## Lifecycle Flow

### Create

1. Validate options (throws `TypeError` on programmer errors).
2. `getRecord(scope, key)` — failure ⇒ `STORE_READ_FAILED`.
3. If existing record and `instance.time - record.created_at < cooldown_seconds` ⇒ `COOLDOWN_ACTIVE`.
4. Generate code via `Lib.Crypto.generateRandomString(charset, length)`.
5. `setRecord(scope, key, { code, fail_count: 0, created_at, expires_at })` — failure ⇒ `STORE_WRITE_FAILED`.
6. Return `{ success: true, code, expires_at, error: null }`.

### Verify

1. Validate options (throws on programmer errors).
2. `getRecord(scope, key)` — failure ⇒ `STORE_READ_FAILED`.
3. `record == null` ⇒ `NOT_FOUND`.
4. `instance.time > record.expires_at` ⇒ `EXPIRED`.
5. `record.fail_count >= max_fail_count` ⇒ `MAX_FAILS`.
6. `record.code !== value` ⇒ `incrementFailCount` (best-effort), return `WRONG_VALUE`.
7. Match ⇒ schedule background delete via `Lib.Instance.backgroundRoutine`, return `{ success: true, error: null }`.

---

## Cleanup cadence

| Backend | Recommended cleanup |
|---|---|
| `dynamodb` | Enable AWS native TTL on `expires_at` (Dynamo sweeps within ~48 h, free) |
| `mongodb` | The store's `initializeStore` creates a TTL index on `_ttl` (~60 s sweep). `cleanupExpiredRecords` is the explicit fallback. |
| `postgres` | EventBridge / cron / `pg_cron` — call `Verify.cleanupExpiredRecords` once per day |
| `mysql` | EventBridge / cron / MySQL `EVENT` scheduler — same daily cadence |
| `sqlite` | `setInterval` inside the Node process or external cron |

The verify module **never depends on cleanup running** — the consume-time `instance.time > record.expires_at` check guarantees correctness regardless.

---

## Out of Scope

- **Recovery codes** — handled by the user/auth model, not here. Recovery codes are durable, batch-generated, and need backup. The verify table is ephemeral.
- **Notification delivery** — this module returns the generated code; sending it via SMS/email/push is the caller's job.
- **Rate limiting beyond per-record cooldown** — per-IP or per-account global rate limits live one layer up.

---

## Migration from v1.0

v1.0 accepted a fully-built adapter object as `CONFIG.STORE`. v1.1 replaces that with the `STORE` name + `STORE_CONFIG` pair so applications no longer write or maintain adapter code. The handful of v1.0 adopters that built custom adapters can pin to v1.0 indefinitely; new code should use the registry pattern shown above.
