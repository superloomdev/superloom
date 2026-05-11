# @superloomdev/js-server-helper-verify-store-dynamodb

[![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-brightgreen.svg)](https://nodejs.org)

DynamoDB store adapter for [`@superloomdev/js-server-helper-verify`](../js-server-helper-verify). Implements the 6-method store contract backed by DynamoDB via `@superloomdev/js-server-helper-nosql-aws-dynamodb`.

> **Service-dependent.** Tests require Docker (DynamoDB Local) for emulated testing and real AWS credentials for integration testing.

## How This Adapter Fits In

```js
const store = require('@superloomdev/js-server-helper-verify-store-dynamodb')(Lib, CONFIG, ERRORS);
```

## Install

```bash
npm install @superloomdev/js-server-helper-verify \
            @superloomdev/js-server-helper-verify-store-dynamodb \
            @superloomdev/js-server-helper-nosql-aws-dynamodb
```

## Usage

```js
Lib.DynamoDB = require('@superloomdev/js-server-helper-nosql-aws-dynamodb')(Lib, {
  REGION: process.env.AWS_REGION || 'us-east-1',
  KEY: process.env.AWS_ACCESS_KEY_ID,
  SECRET: process.env.AWS_SECRET_ACCESS_KEY
});

Lib.Verify = require('@superloomdev/js-server-helper-verify')(Lib, {
  STORE: require('@superloomdev/js-server-helper-verify-store-dynamodb'),
  STORE_CONFIG: {
    table_name: 'verification_codes',
    lib_dynamodb: Lib.DynamoDB
  }
});

await Lib.Verify.setupNewStore(Lib.Instance.initialize());
```

## STORE_CONFIG

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `table_name` | `String` | Yes | Name of the DynamoDB table. |
| `lib_dynamodb` | `Object` | Yes | An initialized `Lib.DynamoDB` instance. |

## Schema

DynamoDB table layout:
- Partition key: `scope` (String)
- Sort key: `key` (String)
- Attributes: `code`, `fail_count`, `created_at`, `expires_at`

### DynamoDB-Specific Notes

- **Primary key**: composite `(scope, key)`
- **TTL**: Enable AWS native TTL on `expires_at` column (~48h sweep)

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

Enable AWS native TTL on `expires_at` for automatic cleanup. `cleanupExpiredRecords` is provided as explicit fallback.

## Testing

```bash
cd _test && npm install && npm test
```

Docker lifecycle is fully automatic.

## License

MIT
