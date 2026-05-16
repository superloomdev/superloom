# Configuration — `js-server-helper-nosql-aws-dynamodb`

Every loader option, every environment variable, credentials and IAM expectations, and the runtime patterns that combine them. For the function reference see [API Reference](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-nosql-aws-dynamodb/docs/api.md).

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
- [Local Emulator vs Real DynamoDB](#local-emulator-vs-real-dynamodb)
- [Multi-Region / Multi-Account Setup](#multi-region--multi-account-setup)
- [Testing Tiers](#testing-tiers)

---

## Loader Pattern

The module is a factory. Each loader call returns an independent public interface with its own AWS SDK client, config, and lifecycle. The SDK clients (`@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`) are cached at the module scope and shared across instances because they are stateless — only the configured `DynamoDBClient` instance holds region/credential state.

```javascript
Lib.DynamoDB = require('@superloomdev/js-server-helper-nosql-aws-dynamodb')(Lib, {
  REGION: process.env.AWS_REGION,
  KEY:    process.env.AWS_ACCESS_KEY_ID,
  SECRET: process.env.AWS_SECRET_ACCESS_KEY
});
```

Loader call semantics:

- The first argument is the `Lib` container — the module reads `Lib.Utils`, `Lib.Debug`, and `Lib.Instance` from it (see [Peer Dependencies](#peer-dependencies-injected)).
- The second argument is the config override. Whatever you pass is merged on top of the module's defaults (see [dynamodb.config.js](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-nosql-aws-dynamodb/dynamodb.config.js)).
- The SDK client is **not** created at loader time. It is created lazily on the first call. This keeps cold-start fast in serverless deployments.

---

## Configuration Keys

| Key | Type | Required | Default | Description |
|---|---|---|---|---|
| `REGION` | `String` | Yes (override) | `'us-east-1'` | AWS region. Override per deployment — `us-east-1` is rarely correct for production |
| `KEY` | `String` | Yes (override) | `undefined` | AWS access key. **Explicit**, not picked up from an ambient SDK credential chain |
| `SECRET` | `String` | Yes (override) | `undefined` | AWS secret key. **Explicit**, not picked up from an ambient SDK credential chain |
| `ENDPOINT` | `String` | No | `undefined` | Custom endpoint URL (for DynamoDB Local or a private VPC endpoint). Leave unset for real AWS DynamoDB |
| `MAX_RETRIES` | `Number` | No | `3` | Maximum retry attempts for failed requests (passed to the SDK client) |
| `REMOVE_UNDEFINED_VALUES` | `Boolean` | No | `true` | Strip `undefined` values from items before sending to DynamoDB. DynamoDB rejects `undefined`; this flag prevents the resulting errors |

"Required (override)" means the key has a default but every production deployment must override it. `REGION`'s default (`us-east-1`) is a placeholder; `KEY` and `SECRET` are `undefined` by default and the SDK call will fail loudly if they aren't set.

> **Implementation note:** the module is deliberately strict about credentials — it does **not** fall back to the SDK's default provider chain (instance profile, `~/.aws/credentials`, environment variables read by the SDK). If you want to read credentials from any of those sources, do it in your project's loader and pass them explicitly. This makes it impossible to accidentally talk to the wrong AWS account.

---

## Environment Variables

Environment variables are consumed only by `_test/loader.js`. The module itself never reads `process.env` directly — all configuration flows through the loader.

| Variable | Emulated (Dev) | Integration (Real AWS) | Purpose |
|---|---|---|---|
| `AWS_REGION` | `us-east-1` | Your region | Region |
| `AWS_ACCESS_KEY_ID` | `local` | Real access key | Credential |
| `AWS_SECRET_ACCESS_KEY` | `local` | Real secret key | Credential |
| `DYNAMODB_ENDPOINT` | `http://localhost:8000` | *(not set)* | Endpoint override for emulator. Leave unset for real AWS |

In your application code, set the variables you need and forward them to the loader explicitly. The module does not assume any specific variable names — `REGION`, `KEY`, etc. accept any source.

**Where to set these:**

- **Dev (local):** `__dev__/.env.dev` → loaded via `source init-env.sh` (select `dev`)
- **Integration:** `__dev__/.env.integration` → loaded via `source init-env.sh` (select `integration`)
- **CI/CD:** the `env:` block on the `test-nosql-aws-dynamodb` and `publish-nosql-aws-dynamodb` jobs in `.github/workflows/ci-helper-modules.yml`

---

## Peer Dependencies (Injected)

These come from your project's `Lib` container, not from this module's `package.json`. You install them in your project once and inject them into every helper.

| Package | Purpose |
|---|---|
| `@superloomdev/js-helper-utils` | Type checks, validation, data manipulation |
| `@superloomdev/js-helper-debug` | Structured logging plus `performanceAuditLog` for per-operation timing |
| `@superloomdev/js-server-helper-instance` | Request lifecycle — provides `instance.time_ms` used by performance logging |

---

## Direct Dependencies (Bundled)

| Package | Version range | Purpose |
|---|---|---|
| `@aws-sdk/client-dynamodb` | `^3.x` | Base DynamoDB client. Lazy-loaded on first call, cached at module scope. |
| `@aws-sdk/lib-dynamodb` | `^3.x` | Document Client and `*Command` classes. Lazy-loaded, cached. |

You should never `require('@aws-sdk/*')` in your application code — the module exists to wrap them.

---

## Credentials and IAM Permissions

The module accepts an explicit `KEY` + `SECRET` pair and (optionally) a region. It does **not** fall back to the SDK's ambient credential chain. Your project loader decides where credentials come from — environment variables, secret manager, IAM role assumption, whatever your deployment shape requires.

### Minimum IAM permissions

Functions in this module use the following DynamoDB API actions. Grant the smallest set your application needs.

| Function | DynamoDB actions |
|---|---|
| `getRecord`, `batchGetRecords` | `dynamodb:GetItem`, `dynamodb:BatchGetItem` |
| `writeRecord`, `commandAddRecord`, `batchWriteRecords`, `batchWriteAndDeleteRecords` | `dynamodb:PutItem`, `dynamodb:BatchWriteItem` |
| `updateRecord`, `commandUpdateRecord` | `dynamodb:UpdateItem` |
| `deleteRecord`, `commandDeleteRecord`, `batchDeleteRecords`, `batchWriteAndDeleteRecords` | `dynamodb:DeleteItem`, `dynamodb:BatchWriteItem` |
| `query`, `count` | `dynamodb:Query` |
| `scan` | `dynamodb:Scan` |
| `transactWriteRecords` | `dynamodb:TransactWriteItems` (plus the underlying `PutItem` / `UpdateItem` / `DeleteItem` per resource) |
| `createTable`, `deleteTable` | `dynamodb:CreateTable`, `dynamodb:DeleteTable`, `dynamodb:DescribeTable` |

Scope `Resource` to specific table ARNs:

```
arn:aws:dynamodb:<region>:<account>:table/<table-name>
arn:aws:dynamodb:<region>:<account>:table/<table-name>/index/*
```

### Credential rotation

Because credentials are explicit per loader call, rotating credentials means restarting the process (or re-invoking the loader). The module does not refresh credentials in-flight; there is no built-in support for temporary STS credentials with auto-refresh — pass refreshed values on a fresh loader call instead.

---

## Local Emulator vs Real DynamoDB

The same module works against both real AWS DynamoDB and [DynamoDB Local](https://hub.docker.com/r/amazon/dynamodb-local). Only the `ENDPOINT` config changes.

| Mode | `ENDPOINT` | `KEY` / `SECRET` |
|---|---|---|
| **Real AWS DynamoDB** | unset (or omitted) | Real IAM credentials |
| **DynamoDB Local** (Docker) | `http://localhost:8000` (or your container address) | Any non-empty string (the emulator accepts anything; the SDK requires non-empty values) |

The test loader uses `KEY: 'local'` and `SECRET: 'local'` for the emulated tier. Use any pair you like in your own dev environment — the emulator does not validate them.

---

## Multi-Region / Multi-Account Setup

Each loader call returns an independent instance with its own SDK client, region, and credentials. Load the module multiple times for cross-region replicas or cross-account access:

```javascript
Lib.PrimaryDB = require('@superloomdev/js-server-helper-nosql-aws-dynamodb')(Lib, {
  REGION: 'us-east-1',
  KEY:    process.env.PRIMARY_AWS_KEY,
  SECRET: process.env.PRIMARY_AWS_SECRET
});

Lib.DRDB = require('@superloomdev/js-server-helper-nosql-aws-dynamodb')(Lib, {
  REGION: 'us-west-2',
  KEY:    process.env.DR_AWS_KEY,
  SECRET: process.env.DR_AWS_SECRET
});
```

Each instance has its own SDK client, retry budget, and timeout state. Tables are not shared between instances at the API level — pass the table name on every call.

---

## Testing Tiers

The module ships two test tiers:

| Tier | Runtime | When to run | CI Status |
|---|---|---|---|
| **Emulated** | DynamoDB Local in Docker | Every commit, every CI run | [![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml) |
| **Integration** | Real AWS DynamoDB (sandbox account) | Manually, against a sandbox table | ![Integration Tests](https://img.shields.io/badge/Integration_Tests-not_yet_tested-lightgrey) |

### Emulated (Docker)

```bash
cd _test && npm install && npm test
```

`pretest` starts the DynamoDB Local container on port `8000`; `posttest` stops and removes the container and volume (the image is cached). No manual `docker compose up` is needed and starting it manually will conflict with `pretest`.

Full setup guide: [DynamoDB Local Setup](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-nosql-aws-dynamodb/_test/ops/00-local-testing/dynamodb-local-setup.md).

### Integration (Real AWS)

```bash
source init-env.sh   # select 'integration'
cd _test && npm install && npm test
```

The integration tier connects to real AWS DynamoDB using credentials from `__dev__/secrets/`. The credentials must have the IAM actions listed in [Credentials and IAM Permissions](#credentials-and-iam-permissions) on the test table ARN. It is opt-in because it costs money (per-request pricing) and writes real data.

Full setup guide: [AWS DynamoDB Integration Setup](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-nosql-aws-dynamodb/_test/ops/01-integration-testing/aws-dynamodb-integration-setup.md).

For the framework-wide testing architecture see [Module Testing](https://github.com/superloomdev/superloom/blob/main/docs/architecture/module-testing.md).
