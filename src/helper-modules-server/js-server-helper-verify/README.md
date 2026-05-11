# @superloomdev/js-server-helper-verify

[![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 20.19+](https://img.shields.io/badge/Node.js-20.19%2B-brightgreen.svg)](https://nodejs.org)

One-time verification code lifecycle: generate, store, validate, consume. Built-in storage adapters for **sqlite**, **postgres**, **mysql**, **mongodb**, and **dynamodb** — pass the factory function instead of a string. Three create interfaces (numeric pin, alphanumeric code, URL-safe token) and one verify interface that consumes any of them. Part of the [Superloom](https://github.com/superloomdev/superloom) framework.

Three independent defenses against abuse:

- **Cooldown** on creation — minimum gap between successive codes for the same `(scope, key)`.
- **Expiry (TTL)** — codes are useless after `expires_at`, regardless of cleanup cadence.
- **Per-record fail counter** — too many wrong attempts and the code is locked out.

A successful verify deletes the record in the background — codes are strictly one-time.

**Further reading:**
- [`docs/data-model.md`](docs/data-model.md) — Record fields and design rationale.

---

## Tested Backends

The shared store suite (`_test/shared-store-suite.js`) runs the same 14-case contract against every backend. SQLite needs no Docker; the rest run via `_test/docker-compose.yml`.

| Backend | Schema | Native TTL | Cleanup |
|---|---|---|---|
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

| `STORE` factory | Required helper |
|---|---|
| `stores/sqlite` | `Lib.SQLite` (`@superloomdev/js-server-helper-sql-sqlite`) |
| `stores/postgres` | `Lib.Postgres` (`@superloomdev/js-server-helper-sql-postgres`) |
| `stores/mysql` | `Lib.MySQL` (`@superloomdev/js-server-helper-sql-mysql`) |
| `stores/mongodb` | `Lib.MongoDB` (`@superloomdev/js-server-helper-nosql-mongodb`) |
| `stores/dynamodb` | `Lib.DynamoDB` (`@superloomdev/js-server-helper-nosql-aws-dynamodb`) |

The verify module **never** imports these helpers directly.

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
  STORE: require('@superloomdev/js-server-helper-verify/stores/postgres'),
  STORE_CONFIG: {
    table_name: 'verification_codes',
    lib_sql: Lib.Postgres
  }
});

// Idempotent table + index creation
await Lib.Verify.setupNewStore(instance);

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
| `setupNewStore(instance)` | n/a | Idempotent backend setup (CREATE TABLE / createIndex / CreateTable) |
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
{ success: false, code: null,     expires_at: null,        error: { type, message } }

// verify
{ success: true,  error: null }
{ success: false, error: { type, message } }
```

On failure, `error` is an object from the internal `verify.errors.js` catalog. The `type` field is a stable string identifier; the `message` is a human-readable operational description (English). Projects may pass these through directly to clients, or map them to domain-specific errors in the service layer.

---

## Configuration

| Key | Default | Notes |
|---|---|---|
| `STORE` | `null` (required) | Store factory function (e.g. `require('./stores/sqlite')`) |
| `STORE_CONFIG` | `null` (required) | Per-store config; shape varies (see below) |
| `PIN_CHARSET` | `'0123456789'` | Override only if you need a non-numeric "pin" |
| `CODE_CHARSET` | `'0123456789ABCDEFGHJKMNPQRSTVWXYZ'` | Crockford Base32 |
| `TOKEN_CHARSET` | `a-zA-Z0-9` | URL-safe |

### `STORE_CONFIG` per backend

| Backend | Required `STORE_CONFIG` keys |
|---|---|
| `sqlite` | `{ table_name: 'verification_codes', lib_sql: Lib.SQLite }` |
| `postgres` | `{ table_name: 'verification_codes', lib_sql: Lib.Postgres }` |
| `mysql` | `{ table_name: 'verification_codes', lib_sql: Lib.MySQL }` |
| `mongodb` | `{ collection_name: 'verification_codes', lib_mongodb: Lib.MongoDB }` |
| `dynamodb` | `{ table_name: 'verification_codes', lib_dynamodb: Lib.DynamoDB }` |

## Error Catalog

All operational errors are defined in [`verify.errors.js`](./verify.errors.js):

| Error Type | Trigger |
|---|---|
| `COOLDOWN_ACTIVE` | createPin/Code/Token while a previous code is still inside the cooldown window |
| `NOT_FOUND` | verify with no record for this `scope`+`key` |
| `EXPIRED` | verify on a record past `expires_at` |
| `MAX_FAILS` | verify after `record.fail_count >= max_fail_count` |
| `WRONG_VALUE` | verify on a record whose code does not match |
| `SERVICE_UNAVAILABLE` | Any store adapter operation failed |

Errors are frozen objects with shape `{ type: string, message: string }`. Projects may pass them through directly, or map `error.type` to domain-specific errors in the service layer.

No per-error `if`/`switch` is needed.

---

## Lifecycle Flow

### Create

1. Validate options (throws `TypeError` on programmer errors).
2. `getRecord(scope, key)` — failure ⇒ `SERVICE_UNAVAILABLE`.
3. If existing record and `instance.time - record.created_at < cooldown_seconds` ⇒ `COOLDOWN_ACTIVE`.
4. Generate code via `Lib.Crypto.generateRandomString(charset, length)`.
5. `setRecord(scope, key, { code, fail_count: 0, created_at, expires_at })` — failure ⇒ `SERVICE_UNAVAILABLE`.
6. Return `{ success: true, code, expires_at, error: null }`.

### Verify

1. Validate options (throws on programmer errors).
2. `getRecord(scope, key)` — failure ⇒ `SERVICE_UNAVAILABLE`.
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
| `mongodb` | The store's `setupNewStore` creates a TTL index on `_ttl` (~60 s sweep). `cleanupExpiredRecords` is the explicit fallback. |
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

## Data Model

Every verification attempt is represented as a single flat record. This section explains what each field means, why it exists, and how to populate it correctly.

### Core concepts

**Scope** — the logical owner of the verification code. It acts as a namespace that groups all codes belonging to the same context. All store queries are keyed on `(scope, key)` together.

```
scope: 'user.usr_9f2a'          // one user's verifications
scope: 'tenant.42'              // tenant-level namespace
scope: ''                       // single-tenant / no isolation needed (default)
```

Scope is **not** a security boundary on its own — your application must ensure the caller's scope is authoritative before passing it in. Two callers with different scopes cannot see each other's codes; two callers with the same scope can (assuming they also know the key).

**Key** — the specific purpose or channel within the scope. Together with `scope` it forms the composite primary key. One `(scope, key)` pair holds at most one active code at a time — a new `createPin` / `createCode` / `createToken` call replaces the previous record.

```
key: 'login-phone.+919999912345'    // phone OTP for a specific number
key: 'email-verify.user@example.com' // email confirmation link
key: 'password-reset'               // password reset token (one per user, under user scope)
key: 'totp-setup'                   // TOTP enrollment confirmation
```

Convention: `<purpose>.<channel-identifier>`. The key is opaque to the module — choose a naming scheme that lets your application reconstruct it at verify time without looking it up.

**Code types** — three generators covering the three common surfaces:

| Generator | Charset | Example | Typical use |
|---|---|---|---|
| `createPin` | `0-9` | `742856` | SMS OTP, phone-keypad entry |
| `createCode` | Crockford Base32 (`0-9 A-Z` minus `I L O U`) | `X7K3M9` | Codes read aloud or printed — avoids visually ambiguous characters |
| `createToken` | `a-zA-Z0-9` | `aB3kZ9qR...` | Magic-link query parameter, click-to-verify email link |

All three write the same record shape and are verified by the same `verify` function.

**Cooldown** — the minimum gap in seconds before another code can be issued for the same `(scope, key)`. Prevents an attacker from flooding the channel. The cooldown window is checked against `instance.time - record.created_at`.

```
cooldown_seconds: 60     // at most one SMS per minute
cooldown_seconds: 0      // no cooldown (e.g. for test environments)
```

**Fail counter** — each failed `verify` call increments `fail_count` in-place. Once `fail_count >= max_fail_count`, the record is locked out (`MAX_FAILS`) until a new code is created. The counter resets to `0` on every successful create.

---

### Record fields

| Field | Type | Set by | Description |
|---|---|---|---|
| `scope` | String | caller | Logical owner namespace. Part of the composite primary key. Default `''`. |
| `key` | String | caller | Specific verification purpose within the scope. Part of the composite primary key. |
| `code` | String | verify module | The generated value the recipient must submit. Derived from `Lib.Crypto.generateRandomString`. |
| `fail_count` | Number | verify module | Number of consecutive failed `verify` attempts since this record was last created. Starts at `0`. Incremented atomically by the store. |
| `created_at` | Number | verify module | Unix epoch seconds when this record was written. Used to enforce `cooldown_seconds`. Derived from `instance.time`. |
| `expires_at` | Number | verify module | Unix epoch seconds at which the code becomes invalid. Computed as `created_at + ttl_seconds`. Checked at verify time regardless of whether `cleanupExpiredRecords` has run. |

---

### `scope` and `key` design guide

The two keys together answer "what is this code for and who owns it?" Design them so your application can reconstruct both values from the same information available at verify time.

```javascript
// Phone OTP — scope is the user, key identifies the phone number
scope: 'user.' + user.id
key:   'login-phone.' + normalized_phone

// Email confirmation — scope is the tenant, key identifies the email address
scope: 'tenant.' + tenant_id
key:   'email-confirm.' + email_address

// Password reset — scope is the user, key is the action (one per user at a time)
scope: 'user.' + user.id
key:   'password-reset'

// Two-factor setup — scope is the user, key includes the method
scope: 'user.' + user.id
key:   'totp-setup'
```

A new `create*` call for the same `(scope, key)` **replaces** the previous record — there is no accumulation. If your flow needs two simultaneous codes for the same user (e.g. phone + email), use distinct keys.

---

### Cleanup and expiry

The `expires_at` field is the authoritative expiry check. `verify` rejects expired records even if `cleanupExpiredRecords` has never run. The cleanup function is a storage hygiene tool, not a correctness requirement.

| Backend | Recommended cleanup |
|---|---|
| `dynamodb` | Enable AWS native TTL on `expires_at` (~48 h sweep) |
| `mongodb` | `setupNewStore` creates a TTL index on `_ttl` (~60 s sweep). `cleanupExpiredRecords` is the explicit fallback. |
| `postgres` | `pg_cron` / EventBridge — call `Verify.cleanupExpiredRecords` once per day |
| `mysql` | MySQL `EVENT` scheduler / cron — same daily cadence |
| `sqlite` | `setInterval` inside the Node process or external cron |

---

## Migration from v1.0

v1.0 accepted a fully-built adapter object as `CONFIG.STORE`. v1.1 replaces that with the `STORE` name + `STORE_CONFIG` pair so applications no longer write or maintain adapter code. The handful of v1.0 adopters that built custom adapters can pin to v1.0 indefinitely; new code should use the registry pattern shown above.

---

## Testing

| Tier | Runtime | Status |
|------|---------|--------|
| **Unit Tests** | Node.js `node --test` | [![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml) |

Run locally:

```bash
cd _test
npm install && npm test
```

Docker lifecycle is fully automatic. `pretest` starts the required containers; `posttest` stops and removes them (volumes only — images are cached). No manual `docker compose up` needed.

The test suite runs the same 14-case store contract suite against every backend. Coverage:
- Adapter unit tests (Tier 1): loader validation, SQL/NoSQL coercions, cooldown enforcement
- Full verify lifecycle integration (Tier 3): `createPin`/`createCode`/`createToken`, `verify`, `cleanupExpiredRecords`, fail counting, expiry handling

Integration tests for each storage backend live in the corresponding adapter module (`js-server-helper-verify-store-*`). See each adapter's README for instructions.

---

## License

MIT
