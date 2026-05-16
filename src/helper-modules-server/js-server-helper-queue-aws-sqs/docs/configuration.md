# Configuration. `js-server-helper-queue-aws-sqs`

Every loader option, every environment variable, credentials and IAM expectations, and the runtime patterns that combine them. For the function reference see [API Reference](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-queue-aws-sqs/docs/api.md).

The page is split into two halves: a **reference** block (what you can set) at the top, and a **patterns** block (worked examples that combine those settings) at the bottom.

## On This Page

**Reference**

- [Loader Pattern](#loader-pattern)
- [Configuration Keys](#configuration-keys)
- [Environment Variables](#environment-variables)
- [Peer Dependencies (Injected)](#peer-dependencies-injected)
- [Direct Dependencies (Bundled)](#direct-dependencies-bundled)

**Patterns and Examples**

- [Credentials and IAM Permissions](#credentials-and-iam-permissions)
- [Local Emulator vs Real Service](#local-emulator-vs-real-service)
- [FIFO Queues](#fifo-queues)
- [Visibility Timeout and Long Polling](#visibility-timeout-and-long-polling)
- [Multi-Region / Multi-Account Setup](#multi-region--multi-account-setup)
- [Testing Tiers](#testing-tiers)

---

## Loader Pattern

The module is a factory. Each loader call returns an independent public interface with its own SQS client, queue-URL cache, and config. The SDK adapter (`@aws-sdk/client-sqs`) is cached at module scope and shared across instances because it is stateless.

```javascript
Lib.Instance = require('@superloomdev/js-server-helper-instance')(Lib, {});
Lib.SQS = require('@superloomdev/js-server-helper-queue-aws-sqs')(Lib, {
  REGION: process.env.AWS_REGION,
  KEY:    process.env.AWS_ACCESS_KEY_ID,
  SECRET: process.env.AWS_SECRET_ACCESS_KEY
});
```

Loader call semantics:

- The first argument is the `Lib` container. The module reads `Lib.Utils`, `Lib.Debug`, and `Lib.Instance` from it (see [Peer Dependencies](#peer-dependencies-injected)).
- The second argument is the config override. Whatever you pass is merged on top of the module's defaults (see [sqs.config.js](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-queue-aws-sqs/sqs.config.js)).
- The SDK client is **not** created at loader time. It is created lazily on the first call. This keeps cold-start fast in serverless deployments where many invocations skip queue access entirely.

---

## Configuration Keys

| Key | Type | Required | Default | Description |
|---|---|---|---|---|
| `REGION` | `String` | Yes (override) | `'us-east-1'` | AWS region. Override per deployment. `us-east-1` is rarely correct for production |
| `KEY` | `String` | Yes (override) | `undefined` | AWS access key. **Explicit**, not picked up from an ambient SDK credential chain |
| `SECRET` | `String` | Yes (override) | `undefined` | AWS secret key. **Explicit**, not picked up from an ambient SDK credential chain |
| `ENDPOINT` | `String` | No | `undefined` | Custom endpoint URL (for SQS-compatible services like ElasticMQ). Leave unset for real AWS SQS |
| `QUEUE_URL_PREFIX` | `String` | No | `undefined` | Optional URL prefix to construct queue URLs without calling `GetQueueUrl`. See [Queue URL Resolution](#queue-url-resolution) |
| `DEFAULT_VISIBILITY_TIMEOUT` | `Number` | No | `30` | Default visibility timeout in seconds. Per-call override available via `options.visibility_timeout` on `receive` |
| `MAX_RETRIES` | `Number` | No | `3` | Maximum retry attempts for failed SDK requests |

"Required (override)" means the key has a default but every production deployment must override it. `REGION`'s default (`us-east-1`) is a placeholder; `KEY` and `SECRET` are `undefined` by default and SDK calls will fail loudly if they aren't set.

> **Implementation note:** the module is deliberately strict about credentials. It does **not** fall back to the SDK's default provider chain (instance profile, `~/.aws/credentials`, environment variables read by the SDK). If you want to read credentials from any of those sources, do it in your project's loader and pass them explicitly. This makes it impossible to accidentally talk to the wrong AWS account.

### Queue URL Resolution

The module always works in terms of **queue names**. SQS internally identifies queues by URL. The module resolves names to URLs in one of two ways:

| `QUEUE_URL_PREFIX` | Behaviour | Cost | IAM impact |
|---|---|---|---|
| Not set | Calls `GetQueueUrl(name)` once per name, caches the result | One extra round-trip per cold queue | Requires `sqs:GetQueueUrl` |
| Set to e.g. `https://sqs.us-east-1.amazonaws.com/123456789012/` | Constructs `<prefix><name>` directly | Zero round-trips, zero cache cost | No `sqs:GetQueueUrl` needed |

In production you almost always know the URL pattern. Set `QUEUE_URL_PREFIX` to skip the lookup and trim one IAM action off your role. The format is `https://sqs.<region>.amazonaws.com/<account-id>/`.

---

## Environment Variables

Environment variables are consumed only by `_test/loader.js`. The module itself never reads `process.env` directly. All configuration flows through the loader.

| Variable | Emulated (Dev) | Integration (Real AWS) | Purpose |
|---|---|---|---|
| `AWS_REGION` | `us-east-1` | Your region | Region |
| `AWS_ACCESS_KEY_ID` | `local` | Real access key | Credential |
| `AWS_SECRET_ACCESS_KEY` | `local` | Real secret key | Credential |
| `SQS_ENDPOINT` | `http://localhost:9324` | *(not set)* | Endpoint override for emulator. Leave unset for real AWS |

In your application code, set the variables you need and forward them to the loader explicitly. The module does not assume any specific variable names. `REGION`, `KEY`, etc. accept any source.

**Where to set these:**

- **Dev (local):** `__dev__/.env.dev` → loaded via `source init-env.sh` (select `dev`)
- **Integration:** `__dev__/.env.integration` → loaded via `source init-env.sh` (select `integration`)
- **CI/CD:** the `env:` block on the `test-queue-aws-sqs` and `publish-queue-aws-sqs` jobs in `.github/workflows/ci-helper-modules.yml`

---

## Peer Dependencies (Injected)

These come from your project's `Lib` container, not from this module's `package.json`. You install them in your project once and inject them into every helper.

| Package | Purpose |
|---|---|
| `@superloomdev/js-helper-utils` | Type checks, validation, data manipulation |
| `@superloomdev/js-helper-debug` | Structured logging plus `performanceAuditLog` for per-operation timing |
| `@superloomdev/js-server-helper-instance` | Per-request `instance` object passed as the first argument to every queue function |

The `instance` argument is read on every call: `instance.time_ms` is the start timestamp of the current request, used to anchor the operation in the per-request performance timeline. Without an `instance`, performance log lines lose their request correlation.

---

## Direct Dependencies (Bundled)

| Package | Version range | Purpose |
|---|---|---|
| `@aws-sdk/client-sqs` | `^3.x` | AWS SQS client and command constructors. Lazy-loaded on first call, cached at module scope |

You should never `require('@aws-sdk/client-sqs')` in your application code. The module exists to wrap it.

---

## Credentials and IAM Permissions

The module accepts an explicit `KEY` + `SECRET` pair and a region. It does **not** fall back to the SDK's ambient credential chain. Your project loader decides where credentials come from. Environment variables, secret manager, IAM role assumption, whatever your deployment shape requires.

### Minimum IAM permissions

Functions in this module use the following SQS API actions. Grant the smallest set your application needs.

| Function | SQS actions |
|---|---|
| `send`, `sendDelayed` | `sqs:SendMessage` |
| `receive` | `sqs:ReceiveMessage` |
| `delete` | `sqs:DeleteMessage` |
| (any function, when `QUEUE_URL_PREFIX` is unset) | `sqs:GetQueueUrl` |

Scope `Resource` to specific queue ARNs:

```
arn:aws:sqs:<region>:<account-id>:<queue-name>
```

Example minimal policy for a "send-only" producer (e.g. a web tier that emits events but never consumes them):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["sqs:SendMessage"],
      "Resource": "arn:aws:sqs:us-east-1:123456789012:order_processing"
    }
  ]
}
```

Example minimal policy for a "consume-and-delete" worker:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["sqs:ReceiveMessage", "sqs:DeleteMessage"],
      "Resource": "arn:aws:sqs:us-east-1:123456789012:order_processing"
    }
  ]
}
```

If `QUEUE_URL_PREFIX` is **not** set, also add `sqs:GetQueueUrl` to both policies for the same `Resource`. Setting the prefix removes the need.

### Credential rotation

Because credentials are explicit per loader call, rotating credentials means restarting the process (or re-invoking the loader). The module does not refresh credentials in-flight; there is no built-in support for temporary STS credentials with auto-refresh. Pass refreshed values on a fresh loader call instead.

---

## Local Emulator vs Real Service

The module works against the same code path whether you point it at AWS or at a local emulator. ElasticMQ is the recommended emulator. It speaks the SQS wire protocol exactly and is small enough to start in a Docker container in under a second.

| Setup | `ENDPOINT` | `KEY`/`SECRET` | Notes |
|---|---|---|---|
| **Real AWS SQS** | unset | Real keys | Default. The SDK constructs the URL from `REGION` |
| **ElasticMQ** (used by the test suite) | `http://localhost:9324` | Any non-empty values | The emulator does not validate credentials but the SDK requires the key fields to exist |
| **LocalStack SQS** | `http://localhost:4566` | `test` / `test` | Useful when other AWS services are also being emulated |

Switching between emulator and real service is a single config change. Application code, queue names, and message shapes stay identical.

---

## FIFO Queues

SQS supports two queue types: standard (best-effort ordering, at-least-once delivery) and FIFO (strict order within a message group, exactly-once delivery on opt-in). The module supports FIFO via the `options.message_group_id` parameter on `send`:

```javascript
await Lib.SQS.send(instance, 'orders.fifo', { order_id }, {
  message_group_id: 'customer-' + customer_id
});
```

The convention for FIFO queue names: end them with `.fifo` (AWS requirement). Messages with the same `message_group_id` are delivered in send-order; messages in different groups can be delivered in parallel.

The module does not currently surface `MessageDeduplicationId`. If you need de-duplication beyond AWS's content-based dedup, set the `ContentBasedDeduplication` attribute on the queue (during queue creation) and ensure your message bodies are deterministic for the events you want collapsed.

---

## Visibility Timeout and Long Polling

The two knobs that govern the consumer side:

| Knob | Where set | Purpose |
|---|---|---|
| `DEFAULT_VISIBILITY_TIMEOUT` (config) | Loader | The default visibility timeout for `receive` calls. Per-call override via `options.visibility_timeout` |
| `wait_time_seconds` (per-call) | `receive` options | Long-polling wait time. 0-20 seconds |

Recommended starting values:

- **Visibility timeout:** roughly 1.5x the worst-case time your worker takes to process one message. Too short and the message reappears mid-processing (you double-process). Too long and crashes mean a long delay before the message becomes visible to a different worker.
- **Long-polling wait:** `20` (the maximum). Any value above zero significantly reduces empty-receive cost. The default `0` (short polling) is rarely the right choice for a long-lived consumer.

If processing time is highly variable (e.g. some messages take 2 seconds, others take 5 minutes), use the SQS `ChangeMessageVisibility` API to extend the visibility timeout while a long-running message is in flight. The module does not currently surface this; call it directly via the AWS SDK if you need it.

---

## Multi-Region / Multi-Account Setup

Each loader call returns an independent instance with its own SDK client, region, and credentials. Load the module multiple times for cross-region queues or cross-account access:

```javascript
Lib.PrimarySQS = require('@superloomdev/js-server-helper-queue-aws-sqs')(Lib, {
  REGION: 'us-east-1',
  KEY:    process.env.PRIMARY_AWS_KEY,
  SECRET: process.env.PRIMARY_AWS_SECRET,
  QUEUE_URL_PREFIX: 'https://sqs.us-east-1.amazonaws.com/111111111111/'
});

Lib.BackupSQS = require('@superloomdev/js-server-helper-queue-aws-sqs')(Lib, {
  REGION: 'eu-west-1',
  KEY:    process.env.BACKUP_AWS_KEY,
  SECRET: process.env.BACKUP_AWS_SECRET,
  QUEUE_URL_PREFIX: 'https://sqs.eu-west-1.amazonaws.com/222222222222/'
});
```

Each instance has its own SDK client, retry budget, and queue-URL cache. Queue names are not shared between instances at the API level. Pass the queue name on every call.

---

## Testing Tiers

The module ships two test tiers:

| Tier | Runtime | When to run | CI Status |
|---|---|---|---|
| **Emulated** | ElasticMQ in Docker (SQS-compatible) | Every commit, every CI run | [![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml) |
| **Integration** | Real AWS SQS (sandbox queue) | Manually, against a sandbox queue | ![Integration Tests](https://img.shields.io/badge/Integration_Tests-not_yet_tested-lightgrey) |

### Emulated (Docker)

```bash
cd _test && npm install && npm test
```

`pretest` starts an ElasticMQ container on port `9324`; `posttest` stops and removes the container and its volumes (the image is cached). No manual `docker compose up` is needed and starting it manually will conflict with `pretest`.

Full setup guide: [ElasticMQ Local Setup](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-queue-aws-sqs/_test/ops/00-local-testing/elasticmq-local-setup.md).

### Integration (Real AWS SQS)

```bash
source init-env.sh   # select 'integration'
cd _test && npm install && npm test
```

The integration tier connects to a real AWS SQS queue using credentials from `__dev__/secrets/`. The credentials must have the IAM actions listed in [Credentials and IAM Permissions](#credentials-and-iam-permissions) on the test queue ARN. It is opt-in because it costs money (request pricing on the queue) and writes real messages.

Full setup guide: [AWS SQS Integration Setup](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-queue-aws-sqs/_test/ops/01-integration-testing/aws-sqs-integration-setup.md).

For the framework-wide testing architecture see [Module Testing](https://github.com/superloomdev/superloom/blob/main/docs/architecture/module-testing.md).
