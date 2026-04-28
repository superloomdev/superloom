# Verify Module - AI Reference

## Module Overview
One-time verification code lifecycle: generate, store, validate, consume. Storage-agnostic adapter pattern. Three create interfaces (pin, code, token) over one core flow plus a single verify interface. Three independent defenses: cooldown on creation, expiry (TTL), per-record fail counter. One-time use (background delete on match).

## Factory Pattern
```javascript
module.exports = function loader (shared_libs, config) {
  // Returns independent instance with isolated Lib + CONFIG.
  // CONFIG.STORE and CONFIG.ERRORS are both required;
  // loader throws at construction if STORE is missing/invalid or any of the
  // 7 ERRORS keys is missing.
  return { createPin, createCode, createToken, verify };
};
```

## Public Functions

### createPin(instance, options) - async
Generate, store, and return a numeric PIN (charset `0-9`). SMS OTP use case.
- **instance**: Request instance from `Lib.Instance.initialize`
- **options.scope**: String - logical owner namespace
- **options.key**: String - specific verification purpose
- **options.length**: Integer - number of digits
- **options.ttl_seconds**: Integer - lifetime before expiry
- **options.cooldown_seconds**: Integer - min gap before next pin (use 0 to disable)
- **Returns**: `{ success, code, expires_at, error }`

### createCode(instance, options) - async
Generate, store, and return an alphanumeric code (Crockford Base32: `0-9 A-Z` minus `I L O U`). Login or 2FA codes printed or read aloud.
- Parameters identical to `createPin`
- **Returns**: `{ success, code, expires_at, error }`

### createToken(instance, options) - async
Generate, store, and return a URL-safe token (charset `a-z A-Z 0-9`). Magic-link tail.
- Parameters identical to `createPin`
- **Returns**: `{ success, code, expires_at, error }`

### verify(instance, options) - async
Validate a submitted value. On match, the record is deleted in the background. On mismatch, fail counter is incremented.
- **instance**: Request instance from `Lib.Instance.initialize`
- **options.scope**: String - same scope used at creation
- **options.key**: String - same key used at creation
- **options.value**: String - value submitted by the caller
- **options.max_fail_count**: Integer - reject after this many failed attempts
- **Returns**: `{ success, error }` - `success: true, error: null` on match; `success: false, error: <CONFIG.ERRORS[X]>` on any failure (NOT_FOUND, EXPIRED, MAX_FAILS, WRONG_VALUE, STORE_READ_FAILED)

### cleanupExpiredRecords(instance) - async
Delete expired records from storage. Only works when the adapter provides `cleanupExpiredRecords`. For SQL backends (Postgres, MySQL, SQLite) without native TTL. DynamoDB and MongoDB handle expiry natively and do not need this. Recommended frequency: once per day via external cron (Docker cron, Linux/macOS crontab, or AWS EventBridge + Lambda). Not per-request.
- **instance**: Request instance for time reference
- **Returns**: `{ success, deleted_count, error }` - `CLEANUP_NOT_SUPPORTED` when adapter omits the method, `CLEANUP_FAILED` on exception

## Configuration

| Key | Default | Notes |
|---|---|---|
| `STORE` | `null` (required) | Adapter object - 4 required + 1 optional async method |
| `ERRORS` | `null` (required) | Domain error catalog - map of 7 fixed keys to your `[entity].errors.js` entries. Returned verbatim by the helper on every failure path. |
| `PIN_CHARSET` | `'0123456789'` | |
| `CODE_CHARSET` | `'0123456789ABCDEFGHJKMNPQRSTVWXYZ'` | Crockford Base32 |
| `TOKEN_CHARSET` | `'a-zA-Z0-9'` | URL-safe |

### CONFIG.ERRORS - required keys

Every key must be present at construction or the loader throws. The values are whatever shape your application uses (typically `{ code, message, status }`):
- `COOLDOWN_ACTIVE` - createPin/Code/Token, status 429
- `NOT_FOUND` - verify, status 400
- `EXPIRED` - verify, status 400
- `MAX_FAILS` - verify, status 429
- `WRONG_VALUE` - verify, status 400
- `STORE_READ_FAILED` - createPin/Code/Token + verify, status 503
- `STORE_WRITE_FAILED` - createPin/Code/Token, status 503

## Tested Backends

The integration suite at `_test/integration/` exercises the full lifecycle contract against five real backends:

| Backend | Adapter file | Native TTL | Cleanup |
|---|---|---|---|
| Postgres 17 | `_test/integration/adapters/sql.adapter.js` (dialect: `postgres`) | No | `cleanup-sql.js` helper, or `pg_cron` |
| MySQL 8.0.44 | same SQL adapter (dialect: `mysql`) | No | `cleanup-sql.js` helper, or MySQL `EVENT` scheduler |
| SQLite (`node:sqlite`) | same SQL adapter (dialect: `sqlite`) | No | `cleanup-sql.js` from `setInterval` or external cron |
| MongoDB 8.2 | `_test/integration/adapters/mongodb.adapter.js` | Yes (~60s sweep) | Native TTL index on `_ttl` (BSON Date) |
| DynamoDB | `_test/integration/adapters/dynamodb.adapter.js` | Yes (~48h sweep) | Native TTL on `expires_at` attribute |

46/46 tests pass across all 5 backends. See README "Schema Specifications" for per-backend setup commands (TTL, indexes, cleanup) and `_test/integration/README.md` for the run procedure.

## Storage Adapter Contract

`CONFIG.STORE` must be an object with these four async methods. The loader validates them at construction.

```javascript
{
  // @returns { success, record: { code, fail_count, created_at, expires_at } | null, error }
  getRecord: async function (instance, scope, key) { },

  // @param record - { code, fail_count: 0, created_at, expires_at }
  // @returns { success, error }
  setRecord: async function (instance, scope, key, record) { },

  // @returns { success, error }
  incrementFailCount: async function (instance, scope, key) { },

  // @returns { success, error }
  deleteRecord: async function (instance, scope, key) { },

  // OPTIONAL - for backends without native TTL (SQL)
  // @returns { success, deleted_count, error }
  cleanupExpiredRecords: async function (instance) { }
}
```

Record fields:
- `code` - the generated value (String)
- `fail_count` - Integer, starts at 0, atomically incremented on wrong value
- `created_at` - Unix epoch seconds
- `expires_at` - Unix epoch seconds (drives native TTL on backends that support it)

Adapter-side `error` objects are internal: the verify module logs them at `Lib.Debug.debug` and surfaces a `CONFIG.ERRORS[*]` value to the caller instead. Adapters can return whatever error shape they prefer.

## Lifecycle Flow

### Create flow
1. Validate options shape (throws `TypeError` on bad input - programmer error)
2. `getRecord(scope, key)` - on adapter failure return `{ success: false, error: CONFIG.ERRORS.STORE_READ_FAILED }`
3. If existing record and `instance.time - record.created_at < cooldown_seconds`, return `{ success: false, error: CONFIG.ERRORS.COOLDOWN_ACTIVE }`
4. Generate code via `Lib.Crypto.generateRandomString(charset, length)`
5. Build record `{ code, fail_count: 0, created_at: instance.time, expires_at: instance.time + ttl_seconds }`
6. `setRecord(scope, key, record)` - on adapter failure return `{ success: false, error: CONFIG.ERRORS.STORE_WRITE_FAILED }`
7. Return `{ success: true, code, expires_at, error: null }`

### Verify flow
1. Validate options shape (throws `TypeError` on bad input - programmer error)
2. `getRecord(scope, key)` - on adapter failure return `{ success: false, error: CONFIG.ERRORS.STORE_READ_FAILED }`
3. If `record == null` -> `{ success: false, error: CONFIG.ERRORS.NOT_FOUND }`
4. If `instance.time > record.expires_at` -> `{ success: false, error: CONFIG.ERRORS.EXPIRED }`
5. If `record.fail_count >= max_fail_count` -> `{ success: false, error: CONFIG.ERRORS.MAX_FAILS }`
6. If `record.code !== value` -> call `incrementFailCount` (best-effort), return `{ success: false, error: CONFIG.ERRORS.WRONG_VALUE }`
7. Match -> schedule background delete via `Lib.Instance.backgroundRoutine`, return `{ success: true, error: null }`

## Dependencies
- **Lib.Utils**: type checks (`isNullOrUndefined`, `isFunction`, `isString`, `isInteger`, `isEmpty`)
- **Lib.Debug**: `debug` for adapter-failure diagnostic logs
- **Lib.Crypto**: `generateRandomString(charset, length)` for code generation
- **Lib.Instance**: `backgroundRoutine(instance)` for non-blocking post-match cleanup

## Error Buckets

Failure modes fall into three buckets. The bucket determines who handles the failure.

### 1. Programmer errors (thrown synchronously - `TypeError`)
Malformed arguments to `createPin` / `createCode` / `createToken` / `verify` (missing object, missing `scope`/`key`, non-integer `length`/`ttl_seconds`/`cooldown_seconds`/`max_fail_count`, missing `value` for verify). Bugs in the caller - never returned as an envelope. Fix the caller.

### 2. Domain / business outcomes (envelope, status 4xx)
- `COOLDOWN_ACTIVE` - 429 - another code is still inside the cooldown window
- `NOT_FOUND` - 400 - no record for this scope+key
- `EXPIRED` - 400 - record exists but `instance.time > record.expires_at`
- `MAX_FAILS` - 429 - record exists but `record.fail_count >= max_fail_count`
- `WRONG_VALUE` - 400 - record exists, not expired, not maxed-out, but value mismatched

Normal expected outcomes. The system is working - tell the user what to do.

### 3. Infrastructure errors (envelope, status 5xx)
- `STORE_READ_FAILED` / `STORE_WRITE_FAILED` - adapter returned `success: false`

Logged internally at `Lib.Debug.debug` level - the caller does not need to log them again.

## Caller Pattern - Pass-Through

Because every envelope failure carries a domain error from `CONFIG.ERRORS`, the caller branches on `success` once:

```javascript
const result = await Lib.Verify.verify(instance, options);
if (result.success === false) {
  return { success: false, error: result.error };  // pass-through
}
// success path
```

No per-error `if`/`switch` is needed. The application's domain error catalog is wired into `CONFIG.ERRORS` once at construction; the helper returns the matching catalog entry verbatim on each failure.

## Out of Scope
- **Recovery codes**: handled by the user/auth model, not here. Recovery codes are durable, batch-generated, and need backup. The verify table is ephemeral.
- **Notification delivery**: this module returns the generated code. Sending it via SMS, email, or push is the caller's responsibility.
- **Rate limiting beyond per-record cooldown**: per-IP or per-account global rate limits live one layer up.

## Usage Pattern

```javascript
// 1. Use a tested adapter from `_test/integration/adapters/` or build your own.
//    The DynamoDB adapter handles the keys (scope, id) and atomic fail_count
//    increment via Lib.DynamoDB.updateRecord.
const buildDynamoDbAdapter = require('./adapters/dynamodb.adapter');
const store = buildDynamoDbAdapter(Lib.DynamoDB, { table: 'verification_codes' });

// 2. Wire the verify module - both STORE and ERRORS are required
Lib.Verify = require('@superloomdev/js-server-helper-verify')(Lib, {
  STORE: store,
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

// 3. Use it
const created = await Lib.Verify.createPin(instance, {
  scope: 'user.123',
  key: 'login-phone.+12345',
  length: 6,
  ttl_seconds: 300,
  cooldown_seconds: 60
});
// { success: true, code: '742856', expires_at: 1730000300, error: null }

const result = await Lib.Verify.verify(instance, {
  scope: 'user.123',
  key: 'login-phone.+12345',
  value: created.code,
  max_fail_count: 3
});
// { success: true, error: null }
```
