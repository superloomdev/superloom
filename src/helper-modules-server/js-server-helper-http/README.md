# @superloomdev/js-server-helper-http

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-brightgreen.svg)](https://nodejs.org)

An outgoing HTTP client for Node.js that ships pre-tested, has zero runtime dependencies, and never throws. Part of [Superloom](https://superloom.dev).

## What This Is

A thin wrapper around Node's built-in `fetch` global that adds three things: a normalized response envelope, request-level timing, and pluggable auth (Bearer or Basic). One core function (`fetchJSON`) plus six convenience methods (`get`, `post`, `postForm`, `put`, `delete`, `patch`).

Every call returns the same envelope, on success and on every failure mode:

```
success / status / headers / data / error
```

Error handling, result reading, and exception expectations are the same across every function. There are no surprises between methods, and the module never throws.

## Why Use This Module

- **Zero npm dependencies.** Built on Node's standard-library `fetch` global (Node 24+). Adding the module to your project adds zero packages to your dependency tree. The supply chain you audit ends at this package itself.

- **One response shape for every outcome.** Successful response, HTTP 4xx/5xx, timeout, DNS failure, TLS error, or a body that fails to parse as JSON. Each one returns the same `{ success, status, headers, data, error }` envelope. The module never throws. Calling code branches once on `result.success` instead of stitching together `try`/`catch`, `response.ok`, and manual body parsing.

- **Pre-tested at every release.** A real-network integration suite runs against `httpbin.org` in CI on every push. Your project trusts the wrapper instead of re-verifying fetch, auth, multipart, and timeout plumbing on each release.

- **Designed for human review.** The code is laid out as clearly-marked visual sections (section banners, short functions, scoped comments) so a reviewer can read it top to bottom in order, use the section breaks as checkpoints to mark how far they have got, and finish without ever getting lost in dense logic. This matters most when an AI assistant is generating the change and a human still has to sign off on it. Open `http.js` to see the structure.

- **Built-in observability.** Every outbound request is timed against the active request and routed into your structured logs automatically. Slow-call review, request profiling, and the toggle to enable it during local development or silence it in production are all built in. No instrumentation code to write.

## Behavior

The module is a thin layer over Node's native `fetch`. Three concerns shape its behavior:

- **Normalized envelope.** Every call returns `{ success, status, headers, data, error }`. `success` is `true` only for 2xx responses. `status` is the HTTP status code, or `0` when no response was received (timeout, network failure, request-setup error). `headers` is a plain object with lowercase keys. `data` is parsed JSON, falls back to raw text when the body is not valid JSON, and is `null` when the body is empty. `error` is a `{ type, message }` object on failure, or `null` on success.

- **Never throws.** HTTP errors (4xx/5xx), timeouts (`AbortSignal.timeout`), network failures (DNS, connection refused, TLS), and request-setup errors all become structured results with `success: false`. Calling code does not need `try`/`catch` around the call. The distinction between an HTTP error and a network failure is `result.status`: greater than zero means the server replied; zero means no response was received.

- **Performance audit reference.** Every outbound request emits a `Lib.Debug.performanceAuditLog('HTTP <METHOD>', url, start_ms)` line on both success and failure paths. Combined with `js-server-helper-instance` providing `instance.time_ms`, slow-call review and request profiling work out of the box.

Full mechanics, the parameter tables for `fetchJSON` and the six convenience methods, the content-type matrix, the four error types, and worked examples for auth, multipart upload, and timeouts live in [`docs/api.md`](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-http/docs/api.md).

## Aligned with Superloom Philosophy

If your project is built on Superloom conventions (the same loader pattern, the same testing model), this module slots in without you needing to learn anything new.

If you are not yet using Superloom, the principles are documented at [superloom.dev](https://superloom.dev).

## Extended Documentation

- [API reference](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-http/docs/api.md) - every exported function with its signature, parameters, return shape, content types, error types, and worked examples
- [Configuration](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-http/docs/configuration.md) - loader pattern, two configuration keys, dependency notes, testing tier
- [`js-server-helper-instance`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-instance) - the per-request lifecycle module whose `instance.time_ms` powers the request-level timing
- [Superloom](https://superloom.dev) - the framework

## Adding to Your Project

Install this module as a peer dependency in your project's `package.json` and load it through the standard Superloom loader. Do not vendor the source or use it as a local file dependency. The published package is the supported integration path.

The loader pattern, including the full `Lib` container shape, is documented in [Server Loader Architecture](https://github.com/superloomdev/superloom/blob/main/docs/architecture/server/server-loader.md). For one-time GitHub Packages registry setup, see the [npmrc setup guide](https://github.com/superloomdev/superloom/blob/main/docs/dev/npmrc-setup.md).

## Testing Status

| Tier | Runtime | Status |
|---|---|---|
| Unit | Node.js `node --test` (real network, hits `httpbin.org`) | [![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml) |

Test runtime details (no Docker, but network access is required) live in [Configuration → Testing Tiers](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-http/docs/configuration.md#testing-tiers).

## License

MIT

