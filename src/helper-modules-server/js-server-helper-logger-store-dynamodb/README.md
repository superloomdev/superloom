# @superloomdev/js-server-helper-logger-store-dynamodb

[![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-brightgreen.svg)](https://nodejs.org)

DynamoDB store adapter for [`@superloomdev/js-server-helper-logger`](../js-server-helper-logger). Implements the 5-method store contract backed by DynamoDB via `@superloomdev/js-server-helper-nosql-aws-dynamodb`.

> **Service-dependent.** Tests require Docker (DynamoDB Local) for emulated testing and real AWS credentials for integration testing.

## How This Adapter Fits In

The logger module calls this adapter as a factory:

```js
const store = require('@superloomdev/js-server-helper-logger-store-dynamodb')(Lib, CONFIG, ERRORS);
```

The adapter receives the full narrowed `Lib` (Utils, Debug, Crypto, Instance), the merged `CONFIG` (from which it extracts `CONFIG.STORE_CONFIG` internally), and the frozen logger `ERRORS` catalog. It returns the 5-method store interface consumed by `logger.js`. The caller never needs to know which backend is active.

This is the standard **adapter factory protocol** shared by all `logger-store-*` packages.

## Store Contract

This adapter implements the 5-method contract consumed by `logger.js`:

| Method | Signature | Returns |
|--------|-----------|---------|
| `setupNewStore` | `(instance)` | `{ success, error }` — idempotent table + GSI setup |
| `addLog` | `(instance, record)` | `{ success, error }` — persist one log record |
| `getLogsByEntity` | `(instance, query)` | `{ success, records, next_cursor, error }` — "what happened to this entity?" |
| `getLogsByActor` | `(instance, query)` | `{ success, records, next_cursor, error }` — "what did this actor do?" |
| `cleanupExpiredLogs` | `(instance)` | `{ success, deleted_count, error }` — explicit sweep (fallback) |

## Install

```bash
npm install @superloomdev/js-server-helper-logger \
            @superloomdev/js-server-helper-logger-store-dynamodb \
            @superloomdev/js-server-helper-nosql-aws-dynamodb
```

## Usage

Pass the adapter factory to `STORE`. Pass the `Lib.DynamoDB` instance in `STORE_CONFIG`.

```js
const Lib = {};
Lib.Utils    = require('@superloomdev/js-helper-utils')(Lib, {});
Lib.Debug    = require('@superloomdev/js-helper-debug')(Lib, {});
Lib.Crypto   = require('@superloomdev/js-server-helper-crypto')(Lib, {});
Lib.Instance = require('@superloomdev/js-server-helper-instance')(Lib, {});

Lib.DynamoDB = require('@superloomdev/js-server-helper-nosql-aws-dynamodb')(Lib, {
  REGION: process.env.AWS_REGION || 'us-east-1',
  KEY: process.env.AWS_ACCESS_KEY_ID,
  SECRET: process.env.AWS_SECRET_ACCESS_KEY
});

Lib.Logger = require('@superloomdev/js-server-helper-logger')(Lib, {
  STORE: require('@superloomdev/js-server-helper-logger-store-dynamodb'),
  STORE_CONFIG: {
    table_name: 'action_log',
    lib_dynamodb: Lib.DynamoDB
  },
  IP_ENCRYPT_KEY: process.env.IP_ENCRYPT_KEY  // optional
});

// Create table + GSI at boot (idempotent)
await Lib.Logger.setupNewStore(Lib.Instance.initialize());
```

## STORE_CONFIG

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `table_name` | `String` | Yes | Name of the DynamoDB table. One table per logger instance. |
| `lib_dynamodb` | `Object` | Yes | An initialized `Lib.DynamoDB` instance (`@superloomdev/js-server-helper-nosql-aws-dynamodb`). |

## Schema

DynamoDB table layout:

**Base table:**
- Partition key: `entity_pk` — `"{scope}#{entity_type}#{entity_id}"`
- Sort key: `sort_key` — `"{created_at_ms}-{random}"` (timestamp-based)
- Other fields: `scope`, `entity_type`, `entity_id`, `actor_type`, `actor_id`, `action`, `data`, `ip`, `user_agent`, `created_at`, `created_at_ms`, `expires_at`

**GSI (Global Secondary Index):**
- Name: `actor_gsi`
- Partition key: `actor_pk` — `"{scope}#{actor_type}#{actor_id}"`
- Sort key: `sort_key`

### DynamoDB-Specific Notes

- **Composite keys** (`entity_pk`, `actor_pk`) enable efficient queries on the two main access patterns.
- **TTL** — Enable AWS native TTL on `expires_at` (~48 hour sweep, free).
- **Sort key** format matches other backends: `"{created_at_ms}-{3 random chars}"`

## Expired Log Cleanup

DynamoDB has native TTL via the `expires_at` attribute. Records are automatically removed ~48 hours after expiry.

The explicit `cleanupExpiredLogs` function is provided for:
- Deterministic test cleanup
- Immediate removal needs
- Environments where TTL is disabled

```js
// Optional: explicit cleanup (native TTL handles most cases)
const result = await Lib.Logger.cleanupExpiredLogs(Lib.Instance.initialize());
```

## IAM Permissions

Required IAM permissions for the DynamoDB table:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:Query",
        "dynamodb:DeleteItem",
        "dynamodb:BatchWriteItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:*:*:table/action_log",
        "arn:aws:dynamodb:*:*:table/action_log/index/actor_gsi"
      ]
    }
  ]
}
```

## Peer Dependencies

| Package | Purpose |
|---------|---------|
| `@superloomdev/js-helper-utils` | Type checks |
| `@superloomdev/js-helper-debug` | Structured debug logging |
| `@superloomdev/js-server-helper-nosql-aws-dynamodb` | DynamoDB driver wrapper (`Lib.DynamoDB`) |

## Testing

```bash
cd _test && npm install && npm test
```

Docker lifecycle is fully automatic. `pretest` starts a DynamoDB Local container; `posttest` stops and removes it (containers and volumes only — images are cached). No manual `docker compose up` needed.

`_test/store-contract-suite.js` is a local copy of the shared integration suite maintained by the logger module. It is not fetched from the logger package at test time — this keeps the adapter's test harness self-contained and records which contract version it was built against.

The suite covers:
- Adapter unit tests (Tier 1): store loader config validation, key construction, TTL behavior
- Full logger lifecycle integration (Tier 3): every public Logger API path driven against the real DynamoDB backend via the store contract suite

## License

MIT
