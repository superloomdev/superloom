# Configuration. `js-server-helper-storage-aws-s3-url-signer`

Every loader option, every environment variable, credentials and IAM expectations, and the runtime patterns that combine them. For the function reference see [API Reference](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-storage-aws-s3-url-signer/docs/api.md).

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
- [S3-Compatible Stores (MinIO, R2, LocalStack)](#s3-compatible-stores-minio-r2-localstack)
- [Multi-Region / Multi-Account Setup](#multi-region--multi-account-setup)
- [URL Expiry Tuning](#url-expiry-tuning)
- [Testing Tiers](#testing-tiers)

---

## Loader Pattern

The module is a singleton. The first call configures the `S3Client` and the AWS SDK presigner; every subsequent call reuses the same client. The SDK (`@aws-sdk/client-s3` plus `@aws-sdk/s3-request-presigner`) is cached at module scope and shared across loader invocations because it is stateless. Only the configured `S3Client` instance holds region/credential state.

```javascript
Lib.S3UrlSigner = require('@superloomdev/js-server-helper-storage-aws-s3-url-signer')(Lib, {
  REGION: process.env.AWS_REGION,
  KEY:    process.env.AWS_ACCESS_KEY_ID,
  SECRET: process.env.AWS_SECRET_ACCESS_KEY
});
```

Loader call semantics:

- The first argument is the `Lib` container. The module reads `Lib.Utils` and `Lib.Debug` from it (see [Peer Dependencies](#peer-dependencies-injected)).
- The second argument is the config override. Whatever you pass is merged on top of the module's defaults (see [s3-url-signer.config.js](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-storage-aws-s3-url-signer/s3-url-signer.config.js)).
- The SDK client is **not** created at loader time. It is created lazily on the first signing call. This keeps cold-start fast in serverless deployments where most invocations skip presigning entirely.

---

## Configuration Keys

| Key | Type | Required | Default | Description |
|---|---|---|---|---|
| `REGION` | `String` | Yes (override) | `'us-east-1'` | AWS region. Override per deployment. `us-east-1` is rarely correct for production |
| `KEY` | `String` | Yes (override) | `undefined` | AWS access key. **Explicit**, not picked up from an ambient SDK credential chain |
| `SECRET` | `String` | Yes (override) | `undefined` | AWS secret key. **Explicit**, not picked up from an ambient SDK credential chain |
| `ENDPOINT` | `String` | No | `undefined` | Custom endpoint URL (for S3-compatible services like MinIO, LocalStack, Cloudflare R2). Leave unset for real AWS S3 |
| `FORCE_PATH_STYLE` | `Boolean` | No | `false` | Use path-style addressing (`http://host/bucket/key`). Required by MinIO and most self-hosted S3-compatible servers. AWS S3 uses virtual-hosted style. Leave `false` for real AWS |
| `UPLOAD_URL_EXPIRY` | `Number` | No | `900` | Default upload URL expiry, in seconds. Per-call override available via `options.expiresIn` |
| `DOWNLOAD_URL_EXPIRY` | `Number` | No | `3600` | Default download URL expiry, in seconds. Per-call override available via `options.expiresIn` |

"Required (override)" means the key has a default but every production deployment must override it. `REGION`'s default (`us-east-1`) is a placeholder; `KEY` and `SECRET` are `undefined` by default and presigning will fail loudly if they aren't set.

> **Implementation note:** the module is deliberately strict about credentials. It does **not** fall back to the SDK's default provider chain (instance profile, `~/.aws/credentials`, environment variables read by the SDK). If you want to read credentials from any of those sources, do it in your project's loader and pass them explicitly. This makes it impossible to accidentally sign URLs with the wrong AWS account.

---

## Environment Variables

Environment variables are consumed only by `_test/loader.js`. The module itself never reads `process.env` directly. All configuration flows through the loader.

| Variable | Emulated (Dev) | Integration (Real AWS) | Purpose |
|---|---|---|---|
| `S3_REGION` | `us-east-1` | Your region | Region |
| `S3_ACCESS_KEY` | `dev_access_key` | Real access key | Credential |
| `S3_SECRET_KEY` | `dev_secret_key` | Real secret key | Credential |
| `S3_ENDPOINT` | `http://localhost:9000` | *(not set)* | Endpoint override for emulator. Leave unset for real AWS |
| `S3_FORCE_PATH_STYLE` | `true` | `false` | Path-style addressing. Required for MinIO; disabled for real S3 |

In your application code, set the variables you need and forward them to the loader explicitly. The module does not assume any specific variable names. `REGION`, `KEY`, etc. accept any source.

**Where to set these:**

- **Dev (local):** `__dev__/.env.dev` → loaded via `source init-env.sh` (select `dev`)
- **Integration:** `__dev__/.env.integration` → loaded via `source init-env.sh` (select `integration`)
- **CI/CD:** the `env:` block on the `test-storage-aws-s3-url-signer` and `publish-storage-aws-s3-url-signer` jobs in `.github/workflows/ci-helper-modules.yml`

---

## Peer Dependencies (Injected)

These come from your project's `Lib` container, not from this module's `package.json`. You install them in your project once and inject them into every helper.

| Package | Purpose |
|---|---|
| `@superloomdev/js-helper-utils` | Type checks, validation, data manipulation |
| `@superloomdev/js-helper-debug` | Structured logging |

The module is a singleton-style loader (the same client is reused across loader calls in the same process), so it does not currently take a per-request `instance` argument. If you want per-request performance logging, wrap the module with your own thin function that calls `Lib.Debug.performanceAuditLog` around the signer.

---

## Direct Dependencies (Bundled)

| Package | Version range | Purpose |
|---|---|---|
| `@aws-sdk/client-s3` | `^3.x` | AWS S3 client and command constructors. Lazy-loaded on first call, cached at module scope |
| `@aws-sdk/s3-request-presigner` | `^3.x` | Presigned URL generation. Lazy-loaded on first call, cached at module scope |

You should never `require('@aws-sdk/client-s3')` or `require('@aws-sdk/s3-request-presigner')` in your application code. The module exists to wrap them.

---

## Credentials and IAM Permissions

The module accepts an explicit `KEY` + `SECRET` pair and a region. It does **not** fall back to the SDK's ambient credential chain. Your project loader decides where credentials come from. Environment variables, secret manager, IAM role assumption, whatever your deployment shape requires.

### Minimum IAM permissions

Presigning a URL is a cryptographic operation that runs on the credentials you pass to the loader. AWS still checks that the credentials are authorized for the underlying action **at the moment the client uses the URL**. The signing call itself does not consume IAM. The client side does.

| Function | S3 actions the client must be authorized for |
|---|---|
| `generateUploadUrlPut` | `s3:PutObject` |
| `generateUploadUrlPost` | `s3:PutObject` (current implementation generates a PUT-style URL under the hood) |
| `generateDownloadUrlGet` | `s3:GetObject` |

Scope `Resource` to specific bucket and object ARNs:

```
arn:aws:s3:::<bucket>           # bucket-level (rarely needed for the signer)
arn:aws:s3:::<bucket>/*         # object-level (for PutObject, GetObject)
arn:aws:s3:::<bucket>/<prefix>/* # restrict to a key prefix
```

Example minimal policy for a "user-uploads" worker that signs both upload and download URLs against a single bucket:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject"],
      "Resource": "arn:aws:s3:::user-uploads/*"
    }
  ]
}
```

### Credential rotation

Because credentials are explicit per loader call, rotating credentials means restarting the process (or re-invoking the loader). The module does not refresh credentials in-flight; there is no built-in support for temporary STS credentials with auto-refresh. Pass refreshed values on a fresh loader call instead.

> **Important.** A presigned URL is valid until its expiry timestamp regardless of whether the underlying credentials are rotated afterwards. Plan expiry windows accordingly. The default 15 minutes (upload) and 1 hour (download) are short enough that credential rotation rarely overlaps an in-flight URL.

---

## S3-Compatible Stores (MinIO, R2, LocalStack)

The same module works against any S3-compatible service. The two config keys that matter are `ENDPOINT` (the alternate URL) and `FORCE_PATH_STYLE` (most non-AWS implementations require path-style addressing).

| Service | `ENDPOINT` | `FORCE_PATH_STYLE` | Notes |
|---|---|---|---|
| **Real AWS S3** | unset | `false` | The default. Uses virtual-hosted style addressing |
| **MinIO** (self-hosted, used by tests) | e.g. `http://localhost:9000` | `true` | Path-style required |
| **Cloudflare R2** | `https://<account-id>.r2.cloudflarestorage.com` | `true` | Free egress; access keys via R2 dashboard |
| **Backblaze B2** | `https://s3.<region>.backblazeb2.com` | `true` | S3-compatible since 2020 |
| **LocalStack** | `http://localhost:4566` | `true` | Useful for whole-AWS local emulation |

For any of these, set `REGION` to whatever the service expects (often `us-east-1` for emulators that ignore region; the actual region for managed services).

---

## Multi-Region / Multi-Account Setup

Each loader call returns an independent singleton instance with its own SDK client, region, and credentials. Load the module multiple times for cross-region buckets or cross-account access:

```javascript
Lib.PrimarySigner = require('@superloomdev/js-server-helper-storage-aws-s3-url-signer')(Lib, {
  REGION: 'us-east-1',
  KEY:    process.env.PRIMARY_AWS_KEY,
  SECRET: process.env.PRIMARY_AWS_SECRET
});

Lib.BackupSigner = require('@superloomdev/js-server-helper-storage-aws-s3-url-signer')(Lib, {
  REGION: 'eu-west-1',
  KEY:    process.env.BACKUP_AWS_KEY,
  SECRET: process.env.BACKUP_AWS_SECRET
});
```

Each instance has its own client, retry budget, and timeout state. Buckets are not shared between instances at the API level. Pass the bucket name on every call.

---

## URL Expiry Tuning

The two expiry defaults are chosen for the most common use case (browser-driven uploads and downloads):

- `UPLOAD_URL_EXPIRY = 900` (15 minutes). Long enough for the browser to load, the user to pick a file, the JavaScript to compute a hash, and the upload to complete on a slow connection. Short enough that a leaked URL is not a long-term liability.
- `DOWNLOAD_URL_EXPIRY = 3600` (1 hour). Long enough for the user to finish reading a page and click a link. Short enough that a URL pasted into an email is unlikely to still work the next day.

Override per call when those defaults do not fit. Three patterns:

| Use case | `expiresIn` | Why |
|---|---|---|
| One-click immediate download (force-redirect) | `60`-`300` | The URL is consumed within seconds of being signed; minimum window minimises leak risk |
| Long-running batch upload (mobile, poor network) | `1800`-`3600` | Allow time for retries on connection blips |
| Pre-staged download in an email or async notification | up to `604800` (7 days) | The maximum AWS allows for SigV4 |

AWS S3 caps presigned URL expiry at 7 days. The module does not enforce this; passing a longer value will produce a URL the SDK accepts but the S3 endpoint rejects.

---

## Testing Tiers

The module ships two test tiers:

| Tier | Runtime | When to run | CI Status |
|---|---|---|---|
| **Emulated** | MinIO in Docker (S3-compatible) | Every commit, every CI run | [![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml) |
| **Integration** | Real AWS S3 (sandbox bucket) | Manually, against a sandbox bucket | ![Integration Tests](https://img.shields.io/badge/Integration_Tests-not_yet_tested-lightgrey) |

### Emulated (Docker)

```bash
cd _test && npm install && npm test
```

`pretest` starts a MinIO container; `posttest` stops and removes the container and its volumes (the image is cached). No manual `docker compose up` is needed and starting it manually will conflict with `pretest`.

Full setup guide: [MinIO Setup](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-storage-aws-s3-url-signer/_test/ops/00-local-testing/minio-setup.md) (lives alongside the test files; mirrors the setup of the companion `storage-aws-s3` module).

### Integration (Real AWS S3)

```bash
source init-env.sh   # select 'integration'
cd _test && npm install && npm test
```

The integration tier connects to a real AWS S3 bucket using credentials from `__dev__/secrets/`. The credentials must have the IAM actions listed in [Credentials and IAM Permissions](#credentials-and-iam-permissions) on the test bucket ARN. It is opt-in because it costs money (request and storage pricing for any objects the test side-effects create) and writes real data.

Full setup guide: [AWS S3 Integration Setup](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-storage-aws-s3-url-signer/_test/ops/01-integration-testing/aws-s3-integration-setup.md).

For the framework-wide testing architecture see [Module Testing](https://github.com/superloomdev/superloom/blob/main/docs/architecture/module-testing.md).
