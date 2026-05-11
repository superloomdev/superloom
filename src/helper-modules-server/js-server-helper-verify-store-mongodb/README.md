# @superloomdev/js-server-helper-verify-store-mongodb

[![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-brightgreen.svg)](https://nodejs.org)

MongoDB store adapter for [`@superloomdev/js-server-helper-verify`](../js-server-helper-verify). Implements the 6-method store contract backed by MongoDB via `@superloomdev/js-server-helper-nosql-mongodb`.

> **Service-dependent.** Tests require a running MongoDB instance. Docker lifecycle managed automatically by `npm test`.

## How This Adapter Fits In

```js
const store = require('@superloomdev/js-server-helper-verify-store-mongodb')(Lib, CONFIG, ERRORS);
```

## Install

```bash
npm install @superloomdev/js-server-helper-verify \
            @superloomdev/js-server-helper-verify-store-mongodb \
            @superloomdev/js-server-helper-nosql-mongodb
```

## Usage

```js
Lib.MongoDB = require('@superloomdev/js-server-helper-nosql-mongodb')(Lib, {
  URI: process.env.MONGODB_URI,
  DATABASE: 'verify'
});

Lib.Verify = require('@superloomdev/js-server-helper-verify')(Lib, {
  STORE: require('@superloomdev/js-server-helper-verify-store-mongodb'),
  STORE_CONFIG: {
    collection_name: 'verification_codes',
    lib_mongodb:     Lib.MongoDB
  }
});

await Lib.Verify.setupNewStore(Lib.Instance.initialize());
```

## STORE_CONFIG

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `collection_name` | `String` | Yes | Name of the verification collection. |
| `lib_mongodb` | `Object` | Yes | An initialized `Lib.MongoDB` instance. |

## Schema

`setupNewStore` creates two indexes:

```javascript
// Primary key (composite)
db.verification_codes.createIndex(
  { scope: 1, key: 1 },
  { name: 'idx_scope_key', unique: true }
);

// TTL index for automatic expiration
db.verification_codes.createIndex(
  { _ttl: 1 },
  { name: 'idx_ttl', expireAfterSeconds: 0 }
);
```

### Document Structure

```javascript
{
  _id: ObjectId,           // auto-generated
  scope: "user.usr_9f2a",
  key: "login-phone.+919999912345",
  code: "742856",
  fail_count: 0,
  created_at: 1715180412,
  expires_at: 1715184012,
  _ttl: ISODate("2024-05-08T14:00:12Z")  // Date type for TTL index
}
```

### MongoDB-Specific Notes

- **TTL index** on `_ttl` field — automatic cleanup ~60 seconds after expiry.
- **Composite key** via `{ scope: 1, key: 1 }` unique index.

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

MongoDB has native TTL via the `_ttl` index. `cleanupExpiredRecords` is provided as explicit fallback.

## Testing

```bash
cd _test && npm install && npm test
```

Docker lifecycle is fully automatic.

## License

MIT
