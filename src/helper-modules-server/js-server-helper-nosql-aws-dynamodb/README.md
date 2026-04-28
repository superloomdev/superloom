# @superloomdev/js-server-helper-nosql-aws-dynamodb

[![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-brightgreen.svg)](https://nodejs.org)

AWS DynamoDB wrapper with CRUD, batch, and query operations. Lazy-loaded AWS SDK v3. Part of the [Superloom](https://github.com/superloomdev/superloom).

> **Service-dependent module** - requires Docker for emulated testing (DynamoDB Local) and real cloud credentials for integration testing. See testing tiers below.

## API

All functions accept `instance` as first parameter (from `Lib.Instance.initialize`).

| Function | Description |
|---|---|
| `getRecord(instance, table, key)` | Get a single record by primary key |
| `writeRecord(instance, table, item)` | Write (create or replace) a record. Always upsert |
| `updateRecord(instance, table, key, ...)` | Update a record with structured builder (SET/REMOVE/INCREMENT/DECREMENT) |
| `deleteRecord(instance, table, key)` | Delete a single record |
| `query(instance, table, params)` | Query by partition key with optional sort key conditions |
| `scan(instance, table, filter)` | Scan entire table with optional filter |
| `batchGetRecords(instance, keysByTable)` | Batch get from one or more tables |
| `batchWriteAndDeleteRecords(instance, requestsByTable)` | Batch put/delete across tables |
| `batchWriteRecords(instance, itemsByTable)` | Batch put with auto 25-item chunking |
| `batchDeleteRecords(instance, keysByTable)` | Batch delete with auto 25-item chunking |
| `transactWriteRecords(instance, adds, updates, deletes)` | Atomic write transaction (up to 100 actions) |

## Usage

```javascript
// In loader
Lib.Instance = require('@superloomdev/js-server-helper-instance')(Lib, {});
Lib.DynamoDB = require('@superloomdev/js-server-helper-nosql-aws-dynamodb')(Lib, {
  REGION: 'us-east-1',
  KEY: process.env.AWS_ACCESS_KEY_ID,
  SECRET: process.env.AWS_SECRET_ACCESS_KEY
});

// In application code
const instance = Lib.Instance.initialize();
const result = await Lib.DynamoDB.writeRecord(instance, 'my_table', { pk: 'user_001', name: 'Alice' });
const item = await Lib.DynamoDB.getRecord(instance, 'my_table', { pk: 'user_001' });
```

## Command Builders

Command builders are pure functions that produce DynamoDB service-param objects. They are used in two ways:

**Standalone** — convenience functions like `writeRecord`, `updateRecord`, and `deleteRecord` call builders internally. Use these for simple single-record operations.

```javascript
await Lib.DynamoDB.updateRecord(instance, 'orders', { pk: 'ord_1' }, { status: 'shipped' });
```

**Transactions** — build commands individually, then pass them as arrays to `transactWriteRecords` for atomic multi-record writes. This is the dominant real-world pattern for builders.

```javascript
const add_cmd = Lib.DynamoDB.commandBuilderForAddRecord('audit_log', { pk: 'log_1', action: 'ship' });
const upd_cmd = Lib.DynamoDB.commandBuilderForUpdateRecord('orders', { pk: 'ord_1' }, { status: 'shipped' });
const del_cmd = Lib.DynamoDB.commandBuilderForDeleteRecord('pending', { pk: 'ord_1' });

await Lib.DynamoDB.transactWriteRecords(instance, [add_cmd], [upd_cmd], [del_cmd]);
```

All three builders are available: `commandBuilderForAddRecord`, `commandBuilderForUpdateRecord`, `commandBuilderForDeleteRecord`.

The update builder supports SET, REMOVE, INCREMENT, and DECREMENT. Additional operations (list_append, if_not_exists, set operations, condition expressions) will be added to the builder as needed.

## Configuration (Loader)

| Config Key | Environment Variable | Default | Description |
|---|---|---|---|
| `REGION` | `AWS_REGION` | `'us-east-1'` | AWS region |
| `KEY` | `AWS_ACCESS_KEY_ID` | `undefined` | AWS access key (explicit, not implicit) |
| `SECRET` | `AWS_SECRET_ACCESS_KEY` | `undefined` | AWS secret key (explicit, not implicit) |
| `ENDPOINT` | `DYNAMODB_ENDPOINT` | `undefined` | Custom endpoint (DynamoDB Local). Leave unset for real AWS. |
| `MAX_RETRIES` | - | `3` | Maximum retry attempts for failed requests |
| `REMOVE_UNDEFINED_VALUES` | - | `true` | Strip undefined values before sending to DynamoDB |

When `ENDPOINT` is `undefined`, the SDK uses real AWS DynamoDB.

## Environment Variables

This module depends on the following environment variables. They must be set before loading.

| Variable | Emulated (Dev) | Integration (Real) | Description |
|---|---|---|---|
| `AWS_ACCESS_KEY_ID` | `local` | Real access key | Credentials |
| `AWS_SECRET_ACCESS_KEY` | `local` | Real secret key | Credentials |
| `AWS_REGION` | `us-east-1` | Your region | Region |
| `DYNAMODB_ENDPOINT` | `http://localhost:8000` | *(not set)* | Endpoint override for emulator |

**Where to set these:**
- **Dev (local):** `__dev__/.env.dev` → loaded via `source init-env.sh` (select `dev`)
- **Integration:** `__dev__/.env.integration` → loaded via `source init-env.sh` (select `integration`)
- **CI/CD:** `env:` block in `.github/workflows/ci-helper-modules.yml` (under the `test-dynamodb` and `publish-dynamodb` jobs)

## Peer Dependencies (Injected via Loader)

These are `@superloomdev` framework modules. They are not bundled - they are injected through the `shared_libs` parameter in the loader.

| Package | Purpose |
|---|---|
| `@superloomdev/js-helper-utils` | Type checks, validation, data manipulation |
| `@superloomdev/js-helper-debug` | Structured logging, `performanceAuditLog` for timing |
| `@superloomdev/js-server-helper-instance` | Request lifecycle - `instance.time_ms` for performance timeline |

## Direct Dependencies (Bundled)

These are third-party packages listed in `package.json` `dependencies`. They are installed and bundled with the module.

| Package | Purpose |
|---|---|
| `@aws-sdk/client-dynamodb` | AWS DynamoDB client (lazy-loaded) |
| `@aws-sdk/lib-dynamodb` | DynamoDB Document Client (lazy-loaded) |

## Testing

| Tier | Runtime | Status |
|---|---|---|
| **Emulated Tests** | DynamoDB Local (Docker) | [![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml) |
| **Integration Tests** | Real DynamoDB (sandbox) | ![Integration Tests](https://img.shields.io/badge/Integration_Tests-not_yet_tested-lightgrey) |

### Emulated (Docker)

```bash
cd _test && npm install && npm test
```

Docker lifecycle is automatic: `pretest` starts the DynamoDB Local container, `posttest` stops and removes it (containers and volumes only — images are cached). No manual `docker compose up` needed.

Full guide: `_test/ops/00-local-testing/dynamodb-local-setup.md`

### Integration (Real Service)

```bash
source init-env.sh   # select 'integration'
cd _test && npm install && npm test
```

Full guide: `_test/ops/01-integration-testing/aws-dynamodb-integration-setup.md`

See [Module Testing](https://github.com/superloomdev/superloom/blob/main/docs/architecture/module-testing.md) for the full testing architecture.
