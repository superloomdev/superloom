# @superloomdev/js-server-helper-http-gateway-adapter-express

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-brightgreen.svg)](https://nodejs.org)

Express (Docker) runtime adapter for [`@superloomdev/js-server-helper-http-gateway`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-http-gateway). Implements the 3-method adapter contract. Part of [Superloom](https://superloom.dev).

## What This Is

A stateless adapter that reads from the Express `req` object and stores `res` as the response callback. Pass it as `CONFIG.ADAPTER` when constructing the gateway.

## Usage

```javascript
const GatewayLoader    = require('@superloomdev/js-server-helper-http-gateway');
const ExpressAdapter   = require('@superloomdev/js-server-helper-http-gateway-adapter-express');
const express          = require('express');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const Gateway = GatewayLoader(Lib, {
  ADAPTER: ExpressAdapter
});

app.post('/api/example', function (req, res) {
  const instance = Lib.Instance.initialize();
  Gateway.initHttpRequestData(instance, req, null, res);
  // ... application logic ...
  Gateway.returnHttpResponse(instance, 200, null, { ok: true });
});
```

## Adapter Contract

This adapter implements the 3-method contract required by the gateway:

| Method | Description |
|--------|-------------|
| `loadHttpDataToInstance(instance, req, context, res)` | Reads from Express `req` into `instance.http_request`; stores `res` as the response callback |
| `buildHttpResponseObject(status, headers, body)` | Builds the `{ statusCode, headers, body }` response envelope |
| `getHttpRequestCountryCode(instance)` | Always returns `null` |

## Body Parsing

This adapter reads `req.body` directly. Body parsing is the responsibility of Express middleware:

- `express.json()` for `application/json`
- `express.urlencoded({ extended: true })` for `application/x-www-form-urlencoded`

Install the appropriate middleware before your route handler. The adapter stores whatever `req.body` contains.

## Cookie Parsing

The adapter prefers `req.cookies` (populated by the `cookie-parser` middleware). If `req.cookies` is absent, it falls back to parsing the raw `Cookie` header.

## Country Code

Express has no CDN layer. `getHttpRequestCountryCode` always returns `null`. Projects fronting Express with CloudFront can implement a custom adapter that reads the forwarded `CloudFront-Viewer-Country` header.

## Response Sending

The gateway calls `gateway_response_callback(null, response)` when sending a response. This adapter wraps Express `res` to call `res.status(code).set(headers).send(body)`.

## Dependencies

No runtime dependencies. Zero npm packages installed.

The adapter relies on the application providing standard Express middleware (`express.json`, `express.urlencoded`, optional `cookie-parser`) — see [`docs/middleware.md`](docs/middleware.md).

## Extended Documentation

- [`docs/api.md`](docs/api.md). Full 3-method adapter contract with parameter, return, and behavior tables
- [`docs/configuration.md`](docs/configuration.md). Loader pattern, the (zero) configuration keys, country-code customization
- [`docs/middleware.md`](docs/middleware.md). Required and optional Express middleware setup, Express 5 migration notes
- [`ROBOTS.md`](ROBOTS.md). Compact reference for AI assistants

## Testing Status

| Tier | Runtime | Status |
|------|---------|--------|
| Integration | Node.js built-in test runner against a real Express 5 server on a random free port | [![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml) |

Tests boot a real Express 5 server (`app.listen(0)`), install `express.json`, `express.urlencoded`, and `cookie-parser` middleware, then hit the server with native `fetch`. No mocked `req`/`res` objects. Coverage includes request normalization, auth patterns, cookie round-trip (with and without `cookie-parser`), response building, full parameter-extraction pipeline, unicode, large bodies, and graceful error handling for malformed JSON.

## License

MIT
