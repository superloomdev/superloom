# @superloomdev/js-server-helper-storage-aws-s3

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 20.19+](https://img.shields.io/badge/Node.js-20.19%2B-brightgreen.svg)](https://nodejs.org)

An S3 file-storage helper for Node.js that insulates your application from SDK changes and ships pre-tested, so your project never has to re-verify object-storage connectivity. Part of [Superloom](https://superloom.dev).

## What This Is

A thin, opinionated layer over the [AWS SDK v3 S3 client](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-client-s3/) for object storage. List, upload, download, delete, copy, and move objects with built-in request-level timing, explicit credentials, auto-chunked bulk delete (handling the AWS 1000-key limit), parallel uploads, and a single consistent response shape across every operation.

Every operation returns the same envelope:

```
success / data / error
```

Error handling, result reading, and exception expectations are the same in every place you touch the storage layer. There are no surprises between functions, and operational failures never throw. `NoSuchKey` is normalised to `error.type: 'NOT_FOUND'` so callers can branch on missing objects without parsing AWS-specific error codes.

## Why Use This Module

- **Library updates won't break your code.** When the underlying SDK ships a breaking change, only this module needs updating. Your application code stays exactly as it is.

- **Pre-tested at every release.** A full test suite runs against [MinIO](https://min.io/) (an S3-compatible emulator) in CI on every push. Your project trusts the wrapper instead of re-verifying object-storage plumbing on each release.

- **Designed for human review.** The code is laid out as clearly-marked visual sections (section banners, short functions, scoped comments) so a reviewer can read it top to bottom in order, use the section breaks as checkpoints to mark how far they have got, and finish without ever getting lost in dense logic. This matters most when an AI assistant is generating the change and a human still has to sign off on it. Open `s3.js` to see the structure.

- **Built-in observability.** Every operation can be timed against the active request and routed into your structured logs automatically. Slow-upload review, request profiling, and the toggle to enable it during local development or silence it in production are all built in. No instrumentation code to write.

- **Explicit credentials, works against any S3-compatible store.** Credentials are passed through the loader, not picked up from an ambient SDK environment chain. Making it impossible to talk to the wrong account from a developer machine or CI runner. The same module works against real AWS S3 and against any S3-compatible service (MinIO, LocalStack, Cloudflare R2, Backblaze B2, etc.) by setting `ENDPOINT` and `FORCE_PATH_STYLE`.

## Aligned with Superloom Philosophy

If your project is built on Superloom conventions (the same loader pattern, the same response envelope, the same testing model), this module slots in without you needing to learn anything new. It is written using the same opinionated principles, so adopting it does not introduce inconsistency into your codebase.

If you are not yet using Superloom, the principles are documented at [superloom.dev](https://superloom.dev).

## Learn More

Extended documentation lives alongside the source on GitHub:

- [API reference](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-storage-aws-s3/docs/api.md) - every exported function (file operations, command builders, executors) with signature, parameters, return shape, and worked examples
- [Configuration](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-storage-aws-s3/docs/configuration.md) - all config keys, environment variables, credentials and IAM permissions, S3-compatible emulator setup
- [`@superloomdev/js-server-helper-storage-aws-s3-url-signer`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-storage-aws-s3-url-signer) - companion module for generating S3 presigned URLs (different concern, same family)
- [Superloom](https://superloom.dev) - the framework

## Adding to Your Project

Install this module as a peer dependency in your project's `package.json` and inject its peer modules through the standard Superloom loader. Do not vendor the source or use it as a local file dependency. The published package is the supported integration path.

The peer-dependency / loader pattern, including the full `Lib` container shape, is documented in [Server Loader Architecture](https://github.com/superloomdev/superloom/blob/main/docs/architecture/server-loader.md). For one-time GitHub Packages registry setup, see the [npmrc setup guide](https://github.com/superloomdev/superloom/blob/main/docs/dev/npmrc-setup.md).

## Testing Status

| Tier | Runtime | Status |
|---|---|---|
| Emulated | MinIO in Docker (S3-compatible) | [![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml) |
| Integration | Real AWS S3 (sandbox bucket) | ![Integration Tests](https://img.shields.io/badge/Integration_Tests-not_yet_tested-lightgrey) |

Test runtime details (Docker lifecycle, environment variables, integration setup, IAM permissions) live in [Configuration → Testing Tiers](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-storage-aws-s3/docs/configuration.md#testing-tiers).

## License

MIT
