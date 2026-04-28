# @superloomdev/js-server-helper-storage-aws-s3

[![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-brightgreen.svg)](https://nodejs.org)

AWS S3 wrapper for cloud file storage. List, upload, download, delete, copy, move. Lazy-loaded AWS SDK v3. Part of the [Superloom](https://github.com/superloomdev/superloom).

> **Service-dependent module** - requires Docker for emulated testing (MinIO) and real cloud credentials for integration testing. See testing tiers below.

## API

All functions accept `instance` as first parameter (from `Lib.Instance.initialize`).

| Function | Description |
|---|---|
| `listObjects(instance, bucket, prefix?)` | List up to 1000 keys in a bucket, optionally filtered by prefix |
| `uploadFile(instance, bucket, key, body, content_type?, metadata?, is_public?)` | Upload a single file |
| `uploadFiles(instance, files)` | Upload multiple files in parallel |
| `getFile(instance, bucket, key, output_as_string?)` | Download a file as Buffer or string |
| `deleteFile(instance, bucket, key)` | Delete a single file |
| `deleteFiles(instance, bucket, keys)` | Delete multiple files (auto-chunks to 1000-key AWS limit) |
| `copyFile(instance, source_bucket, source_key, dest_bucket, dest_key, is_public?)` | Copy a file within or across buckets |
| `moveFile(instance, source_bucket, source_key, dest_bucket, dest_key, is_public?)` | Copy then delete source |

Low-level builders and executors (`commandBuilderForUploadObject`, `commandUploadObject`, etc.) are also exported for advanced use cases - see `ROBOTS.md`.

## Usage

```javascript
// In loader
Lib.Instance = require('@superloomdev/js-server-helper-instance')(Lib, {});
Lib.S3 = require('@superloomdev/js-server-helper-aws-s3')(Lib, {
  REGION: 'us-east-1',
  KEY: process.env.AWS_ACCESS_KEY_ID,
  SECRET: process.env.AWS_SECRET_ACCESS_KEY
});

// In application code
const instance = Lib.Instance.initialize();
const upload = await Lib.S3.uploadFile(instance, 'my-bucket', 'docs/readme.txt', 'Hello world', 'text/plain');
const file = await Lib.S3.getFile(instance, 'my-bucket', 'docs/readme.txt', true);
console.log(file.body); // 'Hello world'
```

## Configuration (Loader)

| Config Key | Environment Variable | Default | Description |
|---|---|---|---|
| `REGION` | `AWS_REGION` / `S3_REGION` | `'us-east-1'` | AWS region |
| `KEY` | `AWS_ACCESS_KEY_ID` / `S3_ACCESS_KEY` | `undefined` | AWS access key (explicit, not implicit) |
| `SECRET` | `AWS_SECRET_ACCESS_KEY` / `S3_SECRET_KEY` | `undefined` | AWS secret key (explicit, not implicit) |
| `ENDPOINT` | `S3_ENDPOINT` | `undefined` | Custom endpoint (MinIO, LocalStack). Leave unset for real AWS. |
| `FORCE_PATH_STYLE` | `S3_FORCE_PATH_STYLE` | `false` | Required `true` for MinIO, `false` for AWS |
| `MAX_RETRIES` | - | `3` | Maximum retry attempts for failed requests |

When `ENDPOINT` is `undefined`, the SDK uses real AWS S3.

## Environment Variables

This module depends on the following environment variables. They must be set before loading.

| Variable | Emulated (Dev) | Integration (Real) | Description |
|---|---|---|---|
| `S3_ACCESS_KEY` | `dev_access_key` | Real access key | Credentials |
| `S3_SECRET_KEY` | `dev_secret_key` | Real secret key | Credentials |
| `S3_REGION` | `us-east-1` | Your region | Region |
| `S3_ENDPOINT` | `http://localhost:9000` | *(not set)* | Endpoint override for emulator |
| `S3_FORCE_PATH_STYLE` | `true` | `false` | Required for MinIO; disable for real S3 |

**Where to set these:**
- **Dev (local):** `__dev__/.env.dev` → loaded via `source init-env.sh` (select `dev`)
- **Integration:** `__dev__/.env.integration` → loaded via `source init-env.sh` (select `integration`)
- **CI/CD:** `env:` block in `.github/workflows/ci-helper-modules.yml` (under the `test-s3` and `publish-s3` jobs)

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
| `@aws-sdk/client-s3` | AWS S3 client (lazy-loaded) |

## Testing

| Tier | Runtime | Status |
|---|---|---|
| **Emulated Tests** | MinIO (Docker) | [![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml) |
| **Integration Tests** | Real S3 (sandbox) | ![Integration Tests](https://img.shields.io/badge/Integration_Tests-not_yet_tested-lightgrey) |

### Emulated (Docker)

```bash
cd _test && npm install && npm test
```

Docker lifecycle is automatic: `pretest` starts the MinIO container, `posttest` stops and removes it (containers and volumes only — images are cached). No manual `docker compose up` needed.

Full guide: `_test/ops/00-local-testing/minio-setup.md`

### Integration (Real Service)

```bash
source init-env.sh   # select 'integration'
cd _test && npm install && npm test
```

Full guide: `_test/ops/01-integration-testing/aws-s3-integration-setup.md`

See [Module Testing](https://github.com/superloomdev/superloom/blob/main/docs/architecture/module-testing.md) for the full testing architecture.
