# Verify Module - AI Reference

## Module Overview
One-time verification code lifecycle: generate, store, validate, consume.
Multi-backend - one Verify instance per loader call, backed by one of:
sqlite, postgres, mysql, mongodb, dynamodb. Three create
interfaces (pin, code, token) over one core flow plus one verify interface.
Three independent defenses: cooldown on creation, expiry (TTL), per-record
fail counter. One-time use (background delete on match).

## Factory Pattern

```javascript
module.exports = function loader (shared_libs, config) {
  // Returns independent instance with isolated Lib + CONFIG.
  // Validates CONFIG at construction (STORE factory fn, STORE_CONFIG) -
  // throws on any missing required key.
  return { createPin, createCode, createToken, verify, setupNewStore, cleanupExpiredRecords };
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
- **Returns**: `{ success, error }`. On failure, error.type
    is one of: NOT_FOUND, EXPIRED, MAX_FAILS, WRONG_VALUE, SERVICE_UNAVAILABLE.

### setupNewStore(instance) - async
Idempotent backend setup. SQL: CREATE TABLE IF NOT EXISTS +
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
| `STORE` | `null` (required) | Store factory function (e.g. `require('./stores/sqlite')`) |
| `STORE_CONFIG` | `null` (required) | Per-store config; shape varies |
| `PIN_CHARSET` | `'0123456789'` | |
| `CODE_CHARSET` | `'0123456789ABCDEFGHJKMNPQRTVWXYZ'` | Crockford Base32 |
| `TOKEN_CHARSET` | `a-zA-Z0-9` | |

### STORE_CONFIG per backend

| `STORE` factory | Required keys |
|---|---|
| `require('./stores/sqlite')` | `{ table_name, lib_sql: Lib.SQLite }` |
| `require('./stores/postgres')` | `{ table_name, lib_sql: Lib.Postgres }` |
| `require('./stores/mysql')` | `{ table_name, lib_sql: Lib.MySQL }` |
| `require('./stores/mongodb')` | `{ collection_name, lib_mongodb: Lib.MongoDB }` |
| `require('./stores/dynamodb')` | `{ table_name, lib_dynamodb: Lib.DynamoDB }` |

### Error Catalog

All operational errors are defined in `verify.errors.js`:

| Error Type | When Returned |
|---|---|
| `COOLDOWN_ACTIVE` | createPin/Code/Token during cooldown window |
| `NOT_FOUND` | verify with no matching record |
| `EXPIRED` | verify past `expires_at` |
| `MAX_FAILS` | verify after `fail_count >= max_fail_count` |
| `WRONG_VALUE` | verify with non-matching code |
| `SERVICE_UNAVAILABLE` | Any store adapter operation failed |

Shape: `{ type: string, message: string }` (frozen). Projects may pass through
directly or map `error.type` to domain errors in service layer.

## Storage Internals

| Backend | Primary key | Native TTL | Recommended cleanup |
|---|---|---|---|
| sqlite | composite `(scope, id)` PK + index `(expires_at)` | No | `cleanupExpiredRecords` |
| postgres | same | No | EventBridge / cron / `pg_cron` |
| mysql | same | No | EventBridge / cron / `EVENT` scheduler |
| mongodb | compound `_id: { scope, id }` + TTL index on `_ttl` (Date) | Yes (~60 s) | TTL index is automatic; explicit fallback exists |
| dynamodb | PK `scope`, SK `id`; AWS table-level TTL on `expires_at` | Yes (~48 h) | Enable AWS TTL; explicit fallback exists |

All access patterns use indexes - never a scan (except DynamoDB
`cleanupExpiredRecords`, which is the only operation that requires a scan).

## Tested Backends

SQLite runs on every push (no Docker; in-memory file). Postgres / MySQL / MongoDB /
DynamoDB-Local run via the module's `_test/docker-compose.yml`. The shared
store suite (`_test/shared-store-suite.js`) runs identical end-to-end
coverage against every backend - 14 tests per backend × 5 backends + unit
tests in `test.js` (offline, inline factory store).

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
2. `getRecord(scope, key)` - on adapter failure return `{ success: false, error: SERVICE_UNAVAILABLE }`
3. If `record == null` -> `{ success: false, error: NOT_FOUND }`
4. If `instance.time > record.expires_at` -> `{ success: false, error: EXPIRED }`
5. If `record.fail_count >= max_fail_count` -> `{ success: false, error: MAX_FAILS }`
6. If `record.code !== value` -> call `incrementFailCount` (best-effort), return `WRONG_VALUE`
7. Match -> schedule background delete via `Lib.Instance.backgroundRoutine`, return `{ success: true, error: null }`
