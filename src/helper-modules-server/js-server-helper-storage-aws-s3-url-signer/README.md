# @superloomdev/js-server-helper-storage-aws-s3-url-signer

[![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-brightgreen.svg)](https://nodejs.org)

S3 presigned URL signer for direct browser uploads and downloads. Generate secure, time-limited URLs for client-side file operations without exposing credentials. Lazy-loaded AWS SDK v3. Part of the [Superloom](https://github.com/superloomdev/superloom).

> **Service-dependent module** - requires Docker for emulated testing (MinIO) and real cloud credentials for integration testing. See testing tiers below.

## API

| Function | Description |
|---|---|
| `generateUploadUrlPut(bucket, key, contentType, options?)` | Generate presigned PUT URL for upload (default 15 min expiry) |
| `generateUploadUrlPost(bucket, key, contentType, options?)` | Generate presigned POST URL for upload with form fields (default 15 min expiry) |
| `generateDownloadUrlGet(bucket, key, options?)` | Generate presigned GET URL for download (default 1 hour expiry) |

## Usage

```javascript
// In loader
Lib.S3UrlSigner = require('@superloomdev/js-server-helper-aws-s3-url-signer')(Lib, {
  REGION: 'us-east-1',
  KEY: process.env.AWS_ACCESS_KEY_ID,
  SECRET: process.env.AWS_SECRET_ACCESS_KEY
});

// In application code
const uploadPut = await Lib.S3UrlSigner.generateUploadUrlPut(
  'my-bucket', 
  'uploads/document.pdf', 
  'application/pdf'
);

if (uploadPut.success) {
  // Send uploadPut.url to browser for direct PUT upload to S3
  console.log('PUT Upload URL:', uploadPut.url);
}

const uploadPost = await Lib.S3UrlSigner.generateUploadUrlPost(
  'my-bucket', 
  'uploads/document.pdf', 
  'application/pdf'
);

if (uploadPost.success) {
  // Send uploadPost.url and uploadPost.fields to browser for POST upload
  console.log('POST Upload URL:', uploadPost.url);
  console.log('Form fields:', uploadPost.fields);
}

const download = await Lib.S3UrlSigner.generateDownloadUrlGet(
  'my-bucket', 
  'uploads/document.pdf',
  { responseContentDisposition: 'attachment; filename="document.pdf"' }
);

if (download.success) {
  // Send download.url to browser for direct download from S3
  console.log('Download URL:', download.url);
}
```

## Configuration (Loader)

| Config Key | Environment Variable | Default | Description |
|---|---|---|---|
| `REGION` | `AWS_REGION` / `S3_REGION` | `'us-east-1'` | AWS region |
| `KEY` | `AWS_ACCESS_KEY_ID` / `S3_ACCESS_KEY` | `undefined` | AWS access key (explicit, not implicit) |
| `SECRET` | `AWS_SECRET_ACCESS_KEY` / `S3_SECRET_KEY` | `undefined` | AWS secret key (explicit, not implicit) |
| `ENDPOINT` | `S3_ENDPOINT` | `undefined` | Custom endpoint (MinIO, LocalStack). Leave unset for real AWS. |
| `FORCE_PATH_STYLE` | `S3_FORCE_PATH_STYLE` | `false` | Required `true` for MinIO, `false` for AWS |
| `UPLOAD_URL_EXPIRY` | - | `900` | Upload URL expiry in seconds (15 minutes) |
| `DOWNLOAD_URL_EXPIRY` | - | `3600` | Download URL expiry in seconds (1 hour) |

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
- **CI/CD:** `env:` block in `.github/workflows/ci-helper-modules.yml` (under the `test-aws-s3-url-signer` and `publish-aws-s3-url-signer` jobs)

## Peer Dependencies (Injected via Loader)

These are `@superloomdev` framework modules. They are not bundled - they are injected through the `shared_libs` parameter in the loader.

| Package | Purpose |
|---|---|
| `@superloomdev/js-helper-utils` | Type checks, validation, data manipulation |
| `@superloomdev/js-helper-debug` | Structured logging |

## Direct Dependencies (Bundled)

These are third-party packages listed in `package.json` `dependencies`. They are installed and bundled with the module.

| Package | Purpose |
|---|---|
| `@aws-sdk/client-s3` | AWS S3 client (lazy-loaded) |
| `@aws-sdk/s3-request-presigner` | Presigned URL generation (lazy-loaded) |

## Testing

| Tier | Runtime | Status |
|---|---|---|
| **Emulated Tests** | MinIO (Docker) | [![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml) |
| **Integration Tests** | Real S3 (sandbox) | ![Integration Tests](https://img.shields.io/badge/Integration_Tests-not_yet_tested-lightgrey) |

### Emulated (Docker)

```bash
source init-env.sh   # select 'dev'
cd _test && npm install && npm test
```

Full guide: `_test/ops/00-local-testing/minio-setup.md`

### Integration (Real Service)

```bash
source init-env.sh   # select 'integration'
cd _test && npm install && npm test
```

Full guide: `_test/ops/01-integration-testing/aws-s3-integration-setup.md`

See [Module Testing](https://github.com/superloomdev/superloom/blob/main/docs/architecture/module-testing.md) for the full testing architecture.
