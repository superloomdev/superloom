# @superloomdev/js-server-helper-http-gateway

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-brightgreen.svg)](https://nodejs.org)

An incoming HTTP gateway for Node.js servers. Normalizes raw runtime request data into a per-request instance and writes responses back through runtime-specific adapters. Part of [Superloom](https://superloom.dev).

## What This Is

A runtime-abstraction layer that sits between your application logic and the HTTP transport. One loader call returns one independent HttpGateway interface bound to one runtime adapter. The calling shape is identical regardless of whether the request arrived from AWS API Gateway or Express.

Your application code reads `instance.http_request` and calls `returnHttpResponse`. The adapter wires it to the real runtime underneath.

## Why Use This Module

- **One codebase, two runtimes.** The same application handler runs unchanged on Docker (Express) and on AWS Lambda (API Gateway). Swap the adapter in configuration. No application rewrite.

- **Typed parameter extraction.** `setArgsFromRequest` reads from GET, POST, HEADER, PATH, or FIXED sources. It typecasts (string to Number, Boolean, JSON), trims, validates, and sanitizes in one declarative pass. It returns `[null, args]` on success or `[null, false]` on validation failure. No conditional chains scattered across handler code.

- **Cookie management with browser-compatibility handling.** `setCookie` automatically omits the `SameSite=None` attribute for browsers that mishandle it (iOS 12, macOS 10.14 Safari, UC Browser, Chromium 51-66). Applications set cookies by name without managing browser quirks.

- **Runtime adapters are separate packages.** Install only the adapter for your runtime. The module has no AWS SDK or Express dependency. A future adapter for a new runtime does not change any application code.

- **Designed for human review.** The code is laid out as clearly marked visual sections (section banners, short functions, scoped comments) so a reviewer can read it top to bottom in order. Open the module's source to see the structure.

## Behavior

HttpGateway is a **factory module**. Each `require()(Lib, config)` call returns a fully independent interface bound to one adapter and one configuration.

```
HttpGateway instance
 ├─ CONFIG.ADAPTER        (adapter factory function)
 ├─ CONFIG.ADAPTER_CONFIG (optional adapter-specific options)
 ├─ parts/cookies.js      (serialize, parse, SameSite compatibility)
 ├─ parts/url-parts.js    (tldts wrapper for URL parsing)
 └─ parts/params.js       (typed request parameter extraction)
```

`CONFIG.ADAPTER` is the adapter factory function itself. Pass it as `require()` directly, the same way you pass `Lib.Postgres` to other helpers.

The loader validates configuration at construction time and throws on misconfiguration. Setup errors surface at startup, not on first request.

### Request lifecycle

1. Initialize the per-request instance: `Lib.Instance.initialize()`
2. Populate HTTP data: `Gateway.initHttpRequestData(instance, raw_request, raw_context, callback)`
3. Extract typed parameters: `Gateway.setArgsFromRequest(instance, params)`
4. Send response: `Gateway.returnHttpResponse(instance, status, headers, body)`

### Runtime adapters

Two runtime adapters are available, each a separate package.

| Adapter | Runtime |
|---------|---------|
| [`@superloomdev/js-server-helper-http-gateway-adapter-aws-apigateway`](../js-server-helper-http-gateway-adapter-aws-apigateway) | AWS Lambda + API Gateway HTTP API (payload v2.0) / Lambda Function URLs |
| [`@superloomdev/js-server-helper-http-gateway-adapter-express`](../js-server-helper-http-gateway-adapter-express) | Docker or Express |

Install only the adapter for your runtime.

### SameSite=None cookie compatibility

`setCookie` automatically manages the `SameSite=None` attribute based on the request's `User-Agent` header. Several browser families have known bugs that cause them to reject or mishandle cookies set with `SameSite=None`:

| Affected client | Bug |
|-----------------|-----|
| iOS 12 (all browsers) | Treats `SameSite=None` as `SameSite=Strict`. Cookie is blocked on cross-site requests |
| macOS 10.14 Safari and embedded browser | Same WebKit bug as iOS 12 |
| UC Browser below 12.13.2 | Drops the cookie entirely when `SameSite=None` is present |
| Chromium 51-66 | Drops any cookie with an unrecognised `SameSite` value |

For these clients, `setCookie` serializes the cookie without any `SameSite` attribute. Modern browsers (Chromium 67+, Safari 13+, Firefox 79+) receive `SameSite=None; Secure` as intended by RFC 6265bis.

If you set cookies yourself using raw `Set-Cookie` headers rather than `setCookie`, you are responsible for this UA check.

### Multipart or form-data not supported

This module does **not** support `multipart/form-data` request bodies. Sending a multipart request results in an empty `instance.http_request.post`. The body is not parsed and no error is raised.

Use `application/json` or `application/x-www-form-urlencoded` for all POST data. Multipart support will be added in a future version via a dedicated adapter-level option. The current contract is intentionally scoped to text payloads.

## Aligned with Superloom Philosophy

This module follows Superloom conventions. It uses the factory loader pattern, depends on `Lib` container injection, and returns errors via the standard `[err, result]` envelope. If your project is built on Superloom conventions, this module slots in without you needing to learn anything new.

## Extended Documentation

- [`docs/api.md`](docs/api.md). Full function reference with signatures and examples
- [`docs/configuration.md`](docs/configuration.md). Loader pattern, config keys, dependencies
- [`ROBOTS.md`](ROBOTS.md). Compact reference for AI assistants

## Adding to Your Project

Install as a peer dependency through your project's loader pattern. See [Server Loader Architecture](https://github.com/superloomdev/superloom/blob/main/docs/server/server-loader.md) for the loader pattern and [npmrc setup](https://github.com/superloomdev/superloom/blob/main/docs/dev/npmrc-setup.md) for GitHub Packages registry configuration.

```javascript
const GatewayLoader = require('@superloomdev/js-server-helper-http-gateway');

const Gateway = GatewayLoader(Lib, {
  ADAPTER: require('@superloomdev/js-server-helper-http-gateway-adapter-aws-apigateway')
});
```

Substitute the adapter package for your runtime.

## Dependencies

This module bundles two runtime npm packages:

- **`cookie`** (jshttp). RFC 6265 cookie serialization and parsing. Used because cookie handling contains non-obvious security pitfalls (attribute injection, prototype pollution via hostile headers, malformed percent-encoding) that a purpose-built library handles reliably

- **`tldts`**. URL parsing via the Mozilla Public Suffix List. Used because the Public Suffix List has thousands of entries, changes monthly, and cannot be approximated by any programmatic rule

It expects three peer modules in the `Lib` container (Utils, Debug, Instance) and one optional peer adapter package for your runtime. For the full dependency breakdown, see [`docs/configuration.md`](docs/configuration.md).

## Testing Status

| Tier | Runtime | Status |
|------|---------|--------|
| Emulated | Node.js built-in test runner against in-process stub adapter | [![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml) |

The gateway's own tests use the in-process stub adapter which satisfies the three-method adapter contract with minimal fixed-output behavior. It is not a simulation of API Gateway or Express internals. It exists only to let the gateway module exercise its own logic without any real runtime.

**Integration tests for each runtime adapter live in the corresponding adapter package** and run as part of the same CI workflow:

| Adapter | Test approach | Test count |
|---|---|---|
| [`adapter-express`](../js-server-helper-http-gateway-adapter-express) | Real Express 5 server on a random free port, hit with native `fetch`. Real `express.json`, `express.urlencoded`, `cookie-parser` middleware exercised | 54 |
| [`adapter-aws-apigateway`](../js-server-helper-http-gateway-adapter-aws-apigateway) | 23 real API Gateway v2.0 event fixtures (6 copied verbatim from `aws/aws-lambda-go events/testdata`, 17 hand-written) piped through the full adapter→gateway pipeline | 66 |

## License

MIT
