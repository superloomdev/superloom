# @superloomdev/js-server-helper-storage-aws-s3-url-signer

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 20.19+](https://img.shields.io/badge/Node.js-20.19%2B-brightgreen.svg)](https://nodejs.org)

A presigned-URL helper for Node.js that lets your browser, mobile app, or partner system upload to and download from your object store directly, without ever sending the file through your own server. Part of [Superloom](https://superloom.dev).

## What This Is

A thin, opinionated layer over the [AWS SDK v3 S3 Request Presigner](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-s3-request-presigner/) that produces short-lived URLs the client side can use to talk to S3 directly. It generates three URL shapes: a PUT upload URL (the simple case), a POST upload URL (for HTML form uploads with extra fields), and a GET download URL (for direct browser downloads with optional content disposition).

Every call returns the same envelope:

```
success / url / fields / error
```

Error handling, return-value reading, and exception expectations are the same in every place you generate a URL. Operational failures never throw; they come back as `{ success: false, error }` with a typed error name your code can branch on.

## Why Use This Module

- **Library updates won't break your code.** When the underlying AWS SDK ships a breaking change, only this module needs updating. Your application code stays exactly as it is.

- **Pre-tested at every release.** A full test suite runs against MinIO (an S3-compatible store) in CI on every push. Your project trusts the wrapper instead of re-verifying SDK plumbing on each release.

- **Designed for human review.** The code is laid out as clearly-marked visual sections (section banners, short functions, scoped comments) so a reviewer can read it top to bottom in order, use the section breaks as checkpoints to mark how far they have got, and finish without ever getting lost in dense logic. This matters most when an AI assistant is generating the change and a human still has to sign off on it. Open `s3-url-signer.js` to see the structure.

- **Direct-to-storage uploads and downloads, no server bandwidth.** Your server never has to receive the file before passing it on. The client uploads straight into your bucket using a URL the server signed in milliseconds. Big files do not occupy your application's memory, network, or compute. You stay billable only for the signing call itself.

- **Explicit credentials, not implicit ones.** Credentials are passed through the loader, not picked up from an ambient SDK environment chain. This makes it impossible to accidentally generate a URL signed by the wrong AWS account from a developer machine, a CI runner, or a multi-tenant deployment. Local emulator runs the same way as real S3. Only the `ENDPOINT` config changes.

## Aligned with Superloom Philosophy

If your project is built on Superloom conventions (the same loader pattern, the same response envelope, the same testing model), this module slots in without you needing to learn anything new. It is written using the same opinionated principles, so adopting it does not introduce inconsistency into your codebase.

If you are not yet using Superloom, the principles are documented at [superloom.dev](https://superloom.dev).

## Learn More

Extended documentation lives alongside the source on GitHub:

- [API reference](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-storage-aws-s3-url-signer/docs/api.md) - every exported function with its signature, parameters, return shape, and worked examples
- [Configuration](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-storage-aws-s3-url-signer/docs/configuration.md) - all config keys, environment variables, IAM permissions, S3-compatible store setup, multi-region setup
- [`@superloomdev/js-server-helper-storage-aws-s3`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-storage-aws-s3) - the companion S3 file-operations module (list, upload, get, delete, copy)
- [Superloom](https://superloom.dev) - the framework

## Adding to Your Project

Install this module as a peer dependency in your project's `package.json` and inject its peer modules through the standard Superloom loader. Do not vendor the source or use it as a local file dependency. The published package is the supported integration path.

The peer-dependency / loader pattern, including the full `Lib` container shape, is documented in [Server Loader Architecture](https://github.com/superloomdev/superloom/blob/main/docs/architecture/server-loader.md). For one-time GitHub Packages registry setup, see the [npmrc setup guide](https://github.com/superloomdev/superloom/blob/main/docs/dev/npmrc-setup.md).

## Testing Status

| Tier | Runtime | Status |
|---|---|---|
| Emulated | MinIO in Docker (S3-compatible) | [![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml) |
| Integration | Real AWS S3 (sandbox bucket) | ![Integration Tests](https://img.shields.io/badge/Integration_Tests-not_yet_tested-lightgrey) |

Test runtime details (Docker lifecycle, environment variables, integration setup) live in [Configuration → Testing Tiers](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-storage-aws-s3-url-signer/docs/configuration.md#testing-tiers).

## License

MIT
