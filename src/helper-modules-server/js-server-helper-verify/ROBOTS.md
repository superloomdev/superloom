# Verify Module - AI Reference

## Module Overview
One-time verification code lifecycle: generate, store, validate, consume.
Multi-backend - one Verify instance per loader call, backed by one of:
memory (tests), sqlite, postgres, mysql, mongodb, dynamodb. Three create
interfaces (pin, code, token) over one core flow plus one verify interface.
Three independent defenses: cooldown on creation, expiry (TTL), per-record
fail counter. One-time use (background delete on match).

## Factory Pattern

```javascript
module.exports = function loader (shared_libs, config) {
  // Returns independent instance with isolated Lib + CONFIG.
  // Validates CONFIG at construction (STORE name, STORE_CONFIG, ERRORS) -
  // throws on any missing required key.
  return { createPin, createCode, createToken, verify, initializeStore, cleanupExpiredRecords };
};
```

## Public Functions

### createPin(instance, options) - async
Generate, store, and return a numeric PIN (charset `0-9`). SMS OTP use case.
- **options.scope**: String - logical owner namespace
- **options.key**: String - specific verification purpose
- **options.length**: Integer - number of digits
- **options.ttl_seconds**: Integer - lifetime before expiry
- **options.cooldown_seconds**: Integer - min gap before next pin (use 0 to disable)
- **Returns**: `{ success, code, expires_at, error }`

### createCode(instance, options) - async
Crockford Base32 (`0-9 A-Z` minus `I L O U`). Login or 2FA codes.
- Same `options` shape as `createPin`.
- **Returns**: `{ success, code, expires_at, error }`

### createToken(instance, options) - async
URL-safe alphanumeric (`a-zA-Z0-9`). Magic-link tail.
- Same `options` shape as `createPin`.
- **Returns**: `{ success, code, expires_at, error }`

### verify(instance, options) - async
Validate a submitted value. On match: record deleted in the background.
On mismatch: fail counter incremented atomically.
- **options.scope**, **options.key**, **options.value**, **options.max_fail_count** - all required
- **Returns**: `{ success, error }` - on failure, `error` is one of `CONFIG.ERRORS.*` (NOT_FOUND, EXPIRED, MAX_FAILS, WRONG_VALUE, STORE_READ_FAILED).

### initializeStore(instance) - async
Idempotent backend setup. Memory: no-op. SQL: CREATE TABLE IF NOT EXISTS +
index on `expires_at`. MongoDB: TTL index on `_ttl` with `expireAfterSeconds: 0`.
DynamoDB: CreateTable with composite key (table-level TTL on `expires_at` is
enabled separately via AWS console / IaC).
- **Returns**: `{ success, error }`

### cleanupExpiredRecords(instance) - async
Sweep expired records. Cron-driven. SQL backends rely on this; MongoDB has
native TTL but exposes this for explicit lifecycle control; DynamoDB exposes
this as a fallback to AWS's ~48 h native sweep.
- **Returns**: `{ success, deleted_count, error }`

## Configuration

| Key | Default | Notes |
|---|---|---|
| `STORE` | `null` (required) | One of `memory|sqlite|postgres|mysql|mongodb|dynamodb` |
| `STORE_CONFIG` | `null` (required) | Per-store config; shape varies |
| `ERRORS` | `null` (required) | Domain error catalog (7 keys) |
| `PIN_CHARSET` | `'0123456789'` | |
| `CODE_CHARSET` | `'0123456789ABCDEFGHJKMNPQRSTVWXYZ'` | Crockford Base32 |
| `TOKEN_CHARSET` | `a-zA-Z0-9` | |

### STORE_CONFIG per backend

| `STORE` | Required keys |
|---|---|
| `memory` | `{}` |
| `sqlite` | `{ table_name, lib_sql: Lib.SQLite }` |
| `postgres` | `{ table_name, lib_sql: Lib.Postgres }` |
| `mysql` | `{ table_name, lib_sql: Lib.MySQL }` |
| `mongodb` | `{ collection_name, lib_mongodb: Lib.MongoDB }` |
| `dynamodb` | `{ table_name, lib_dynamodb: Lib.DynamoDB }` |

### CONFIG.ERRORS - required keys

Every key must be present at construction or the loader throws. Values are
whatever shape your application uses (typically `{ code, message, status }`):
- `COOLDOWN_ACTIVE` - createPin/Code/Token, status 429
- `NOT_FOUND` - verify, status 400
- `EXPIRED` - verify, status 400
- `MAX_FAILS` - verify, status 429
- `WRONG_VALUE` - verify, status 400
- `STORE_READ_FAILED` - createPin/Code/Token + verify, status 503
- `STORE_WRITE_FAILED` - createPin/Code/Token, status 503

## Storage Internals

| Backend | Primary key | Native TTL | Recommended cleanup |
|---|---|---|---|
| memory | composite `(scope, key)` Map | n/a | `cleanupExpiredRecords` |
| sqlite | composite `(scope, id)` PK + index `(expires_at)` | No | `cleanupExpiredRecords` |
| postgres | same | No | EventBridge / cron / `pg_cron` |
| mysql | same | No | EventBridge / cron / `EVENT` scheduler |
| mongodb | compound `_id: { scope, id }` + TTL index on `_ttl` (Date) | Yes (~60 s) | TTL index is automatic; explicit fallback exists |
| dynamodb | PK `scope`, SK `id`; AWS table-level TTL on `expires_at` | Yes (~48 h) | Enable AWS TTL; explicit fallback exists |

All access patterns use indexes - never a scan (except DynamoDB
`cleanupExpiredRecords`, which is the only operation that requires a scan).

## Tested Backends

Memory + SQLite run on every push (no Docker). Postgres / MySQL / MongoDB /
DynamoDB-Local run via the module's `_test/docker-compose.yml`. The shared
store suite (`_test/shared-store-suite.js`) runs identical end-to-end
coverage against every backend - 14 tests per backend × 5 backends + 39
memory unit tests = 109 total.

## Dependencies (peer)
- **Lib.Utils**: type checks (`isNullOrUndefined`, `isFunction`, `isString`, `isInteger`, `isEmptyString`)
- **Lib.Debug**: `debug` for adapter-failure diagnostic logs
- **Lib.Crypto**: `generateRandomString(charset, length)` for code generation
- **Lib.Instance**: `backgroundRoutine(instance)` for non-blocking post-match cleanup

Plus one of: Lib.SQLite / Lib.Postgres / Lib.MySQL / Lib.MongoDB / Lib.DynamoDB
- depending on which `STORE` is selected. The verify module never imports any
of these directly; it consumes them through `STORE_CONFIG`.

## Caller Pattern - Pass-Through

Because every envelope failure carries a domain error from `CONFIG.ERRORS`,
the caller branches on `success` once:

```javascript
const result = await Lib.Verify.verify(instance, options);
if (result.success === false) {
  return { success: false, error: result.error };  // pass-through
}
// success path
```

No per-error `if`/`switch` is needed.

## Out of Scope
- **Recovery codes**: handled by the user/auth model, not here.
- **Notification delivery**: this module returns the generated code. Sending
  it via SMS, email, or push is the caller's responsibility.
- **Rate limiting beyond per-record cooldown**: per-IP or per-account global
  rate limits live one layer up.

## Wire Format

This module has no wire format. Codes are bytes returned to the caller, and
the caller passes any value back as `verify(options.value)`. The module never
parses or composes its own envelope.

## Lifecycle (verify flow)

1. Validate options shape (throws `TypeError` on bad input - programmer error)
2. `getRecord(scope, key)` - on adapter failure return `{ success: false, error: STORE_READ_FAILED }`
3. If `record == null` -> `{ success: false, error: NOT_FOUND }`
4. If `instance.time > record.expires_at` -> `{ success: false, error: EXPIRED }`
5. If `record.fail_count >= max_fail_count` -> `{ success: false, error: MAX_FAILS }`
6. If `record.code !== value` -> call `incrementFailCount` (best-effort), return `WRONG_VALUE`
7. Match -> schedule background delete via `Lib.Instance.backgroundRoutine`, return `{ success: true, error: null }`
