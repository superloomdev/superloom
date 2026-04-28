# @superloomdev/js-server-helper-queue-aws-sqs

[![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-brightgreen.svg)](https://nodejs.org)

AWS SQS message queue wrapper. Send, receive, delete, and schedule messages. Lazy-loaded AWS SDK v3. Part of the [Superloom](https://github.com/superloomdev/superloom).

> **Service-dependent module** - requires Docker for emulated testing (ElasticMQ) and real cloud credentials for integration testing. See testing tiers below.

## API

All functions accept `instance` as first parameter (from `Lib.Instance.initialize`).

| Function | Description |
|---|---|
| `send(instance, queue_name, message, options?)` | Send a message to a named queue |
| `receive(instance, queue_name, options?)` | Receive messages from a queue (polling) |
| `delete(instance, queue_name, receipt_handle)` | Delete a message after processing |
| `sendDelayed(instance, queue_name, message, delay_seconds)` | Send a message with delivery delay (0-900s) |

## Usage

```javascript
// In loader
Lib.Instance = require('@superloomdev/js-server-helper-instance')(Lib, {});
Lib.SQS = require('@superloomdev/js-server-helper-queue-aws-sqs')(Lib, {
  REGION: 'us-east-1',
  KEY: process.env.AWS_ACCESS_KEY_ID,
  SECRET: process.env.AWS_SECRET_ACCESS_KEY
});

// In application code
const instance = Lib.Instance.initialize();

// Send a message
const result = await Lib.SQS.send(instance, 'order_processing', { order_id: 'ORD_001', action: 'process' });

// Receive messages
const recv = await Lib.SQS.receive(instance, 'order_processing', { max_messages: 5, wait_time_seconds: 10 });

// Process and delete
for (const msg of recv.messages) {
  // ... process msg.body
  await Lib.SQS.delete(instance, 'order_processing', msg.receipt_handle);
}
```

## Configuration (Loader)

| Config Key | Environment Variable | Default | Description |
|---|---|---|---|
| `REGION` | `AWS_REGION` | `'us-east-1'` | AWS region |
| `KEY` | `AWS_ACCESS_KEY_ID` | `undefined` | AWS access key (explicit, not implicit) |
| `SECRET` | `AWS_SECRET_ACCESS_KEY` | `undefined` | AWS secret key (explicit, not implicit) |
| `ENDPOINT` | `SQS_ENDPOINT` | `undefined` | Custom endpoint (ElasticMQ). Leave unset for real AWS. |
| `QUEUE_URL_PREFIX` | - | `undefined` | Optional URL prefix. If set, queue names are appended to this instead of calling GetQueueUrl API. |
| `DEFAULT_VISIBILITY_TIMEOUT` | - | `30` | Default visibility timeout in seconds |
| `MAX_RETRIES` | - | `3` | Maximum retry attempts for failed requests |

When `ENDPOINT` is `undefined`, the SDK uses real AWS SQS.

## Environment Variables

This module depends on the following environment variables. They must be set before loading.

| Variable | Emulated (Dev) | Integration (Real) | Description |
|---|---|---|---|
| `AWS_ACCESS_KEY_ID` | `local` | Real access key | Credentials |
| `AWS_SECRET_ACCESS_KEY` | `local` | Real secret key | Credentials |
| `AWS_REGION` | `us-east-1` | Your region | Region |
| `SQS_ENDPOINT` | `http://localhost:9324` | *(not set)* | Endpoint override for emulator |

**Where to set these:**
- **Dev (local):** `__dev__/.env.dev` -> loaded via `source init-env.sh` (select `dev`)
- **Integration:** `__dev__/.env.integration` -> loaded via `source init-env.sh` (select `integration`)
- **CI/CD:** `env:` block in `.github/workflows/ci-helper-modules.yml` (under the `test-queue-aws-sqs` and `publish-queue-aws-sqs` jobs)

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
| `@aws-sdk/client-sqs` | AWS SQS client and commands (lazy-loaded) |

## Testing

| Tier | Runtime | Status |
|---|---|---|
| **Emulated Tests** | ElasticMQ (Docker) | [![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml) |
| **Integration Tests** | Real SQS (sandbox) | ![Integration Tests](https://img.shields.io/badge/Integration_Tests-not_yet_tested-lightgrey) |

### Emulated (Docker)

```bash
cd _test && npm install && npm test
```

Docker lifecycle is automatic: `pretest` starts the ElasticMQ container, `posttest` stops and removes it (containers and volumes only — images are cached). No manual `docker compose up` needed.

Full guide: `_test/ops/00-local-testing/elasticmq-local-setup.md`

### Integration (Real Service)

```bash
source init-env.sh   # select 'integration'
cd _test && npm install && npm test
```

Full guide: `_test/ops/01-integration-testing/aws-sqs-integration-setup.md`

See [Module Testing](https://github.com/superloomdev/superloom/blob/main/docs/architecture/module-testing.md) for the full testing architecture.
