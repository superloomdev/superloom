# @superloomdev/js-server-helper-queue-aws-sqs

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 20.19+](https://img.shields.io/badge/Node.js-20.19%2B-brightgreen.svg)](https://nodejs.org)

An AWS SQS helper for Node.js that insulates your application from SDK changes and ships pre-tested, so your project never has to re-verify queue connectivity. Part of [Superloom](https://superloom.dev).

## What This Is

A thin, opinionated layer over [AWS SDK v3 SQS](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/sqs/) with a friendly four-function surface (send, receive, delete, sendDelayed), automatic queue-URL resolution and caching, request-level performance timing, and a single consistent response shape across every operation.

Every read and every write returns the same envelope:

```
success / data / error
```

Error handling, result reading, and exception expectations are the same in every place you touch the queue. There are no surprises between functions, and operational failures never throw. Each call comes back as `{ success: false, error }` with a typed error name your code can branch on.

## Why Use This Module

- **Library updates won't break your code.** When the underlying AWS SDK ships a breaking change, only this module needs updating. Your application code stays exactly as it is.

- **Pre-tested at every release.** A full test suite runs against ElasticMQ (an SQS-compatible emulator) in CI on every push. Your project trusts the wrapper instead of re-verifying SDK plumbing on each release.

- **Designed for human review.** The code is laid out as clearly-marked visual sections (section banners, short functions, scoped comments) so a reviewer can read it top to bottom in order, use the section breaks as checkpoints to mark how far they have got, and finish without ever getting lost in dense logic. This matters most when an AI assistant is generating the change and a human still has to sign off on it. Open `sqs.js` to see the structure.

- **Built-in observability.** Every operation can be timed against the active request and routed into your structured logs automatically. Slow-call review, request profiling, and the toggle to enable it during local development or silence it in production are all built in. No instrumentation code to write.

- **Explicit credentials, not implicit ones.** Credentials are passed through the loader, not picked up from an ambient SDK environment chain. This makes it impossible to accidentally talk to the wrong AWS account from a developer machine, a CI runner, or a multi-tenant deployment. Local emulator runs the same way as real SQS. Only the `ENDPOINT` config changes.

- **Queue-by-name, not by URL.** Your application code says `send(instance, 'order_processing', message)`, not `send(instance, 'https://sqs.us-east-1.amazonaws.com/123456789012/order_processing', message)`. The module resolves names to URLs once and caches the result. Moving a queue to a different account or region only changes loader config; your code stays the same.

## Aligned with Superloom Philosophy

If your project is built on Superloom conventions (the same loader pattern, the same response envelope, the same testing model), this module slots in without you needing to learn anything new. It is written using the same opinionated principles, so adopting it does not introduce inconsistency into your codebase.

If you are not yet using Superloom, the principles are documented at [superloom.dev](https://superloom.dev).

## Learn More

Extended documentation lives alongside the source on GitHub:

- [API reference](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-queue-aws-sqs/docs/api.md) - every exported function with its signature, parameters, return shape, and worked examples
- [Configuration](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-queue-aws-sqs/docs/configuration.md) - all config keys, environment variables, IAM permissions, ElasticMQ emulator setup, FIFO queue notes, multi-region setup
- [Superloom](https://superloom.dev) - the framework

## Adding to Your Project

Install this module as a peer dependency in your project's `package.json` and inject its peer modules through the standard Superloom loader. Do not vendor the source or use it as a local file dependency. The published package is the supported integration path.

The peer-dependency / loader pattern, including the full `Lib` container shape, is documented in [Server Loader Architecture](https://github.com/superloomdev/superloom/blob/main/docs/architecture/server-loader.md). For one-time GitHub Packages registry setup, see the [npmrc setup guide](https://github.com/superloomdev/superloom/blob/main/docs/dev/npmrc-setup.md).

## Testing Status

| Tier | Runtime | Status |
|---|---|---|
| Emulated | ElasticMQ in Docker (SQS-compatible) | [![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml) |
| Integration | Real AWS SQS (sandbox queue) | ![Integration Tests](https://img.shields.io/badge/Integration_Tests-not_yet_tested-lightgrey) |

Test runtime details (Docker lifecycle, environment variables, integration setup) live in [Configuration → Testing Tiers](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-queue-aws-sqs/docs/configuration.md#testing-tiers).

## License

MIT
