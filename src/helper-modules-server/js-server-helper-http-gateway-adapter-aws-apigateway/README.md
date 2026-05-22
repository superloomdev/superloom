# @superloomdev/js-server-helper-http-gateway-adapter-aws-apigateway

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-brightgreen.svg)](https://nodejs.org)

AWS Lambda + API Gateway runtime adapter for [`@superloomdev/js-server-helper-http-gateway`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-http-gateway). Implements the 3-method adapter contract. Supports payload format **v2.0 only** (HTTP API / Lambda Function URLs). Part of [Superloom](https://superloom.dev).

## What This Is

A stateless adapter that normalizes AWS API Gateway payload format v2.0 event objects (HTTP API, Lambda Function URLs) into the standard `instance.http_request` shape consumed by the gateway. Pass it as `CONFIG.ADAPTER` when constructing the gateway.

**For REST API (payload format v1.0) support,** use `js-server-helper-http-gateway-adapter-aws-apigateway-v1` (if available) or implement a custom adapter.

## Usage

```javascript
const GatewayLoader  = require('@superloomdev/js-server-helper-http-gateway');
const AwsAdapter     = require('@superloomdev/js-server-helper-http-gateway-adapter-aws-apigateway');

const Gateway = GatewayLoader(Lib, {
  ADAPTER: AwsAdapter
});

// In your Lambda handler:
exports.handler = async function (event, context, callback) {
  const instance = Lib.Instance.initialize();
  Gateway.initHttpRequestData(instance, event, context, callback);
  // ... application logic ...
  Gateway.returnHttpResponse(instance, 200, null, { ok: true });
};
```

## Adapter Contract

This adapter implements the 3-method contract required by the gateway:

| Method | Description |
|--------|-------------|
| `loadHttpDataToInstance(instance, event, context, callback)` | Normalizes the API Gateway event into `instance.http_request` |
| `buildHttpResponseObject(status, headers, body)` | Builds the `{ statusCode, headers, body, isBase64Encoded }` Lambda response envelope |
| `getHttpRequestCountryCode(instance)` | Returns `CloudFront-Viewer-Country` header value or `null` |

## Supported Payload Format

This adapter **only supports payload format v2.0**. It expects:

- `event.version === '2.0'`
- `event.requestContext.http.method` for the HTTP method
- `event.cookies` array for cookies
- `event.queryStringParameters`, `event.pathParameters`, `event.headers`, `event.body`

Format v2.0 is used by:
- API Gateway **HTTP API** (default)
- **Lambda Function URLs**

API Gateway **REST API** uses payload format v1.0 and is **not supported** by this adapter.

## Body Parsing

| Content-Type | Behavior |
|-------------|---------|
| `application/json` | `JSON.parse` → object. Falls back to `{}` on parse error |
| `application/x-www-form-urlencoded` | `URLSearchParams` parse → object |
| Any other | `{}` (not parsed) |

Base64-encoded bodies (`event.isBase64Encoded = true`) are decoded before parsing.

## Country Code

When a CloudFront distribution sits in front of API Gateway and forwards the `CloudFront-Viewer-Country` header, `getHttpRequestCountryCode` returns the ISO 3166-1 alpha-2 country code string. Returns `null` when absent.

## Dependencies

No runtime dependencies. Zero npm packages installed. No AWS SDK required.

## Extended Documentation

- [`docs/api.md`](docs/api.md). Full 3-method adapter contract with parameter, return, and behavior tables
- [`docs/configuration.md`](docs/configuration.md). Loader pattern, the (zero) configuration keys, Lambda handler pattern, supported runtimes
- [`docs/payload-format.md`](docs/payload-format.md). v2.0 schema reference, body-parsing rules, authorizer context, v1.0 unsupported boundary
- [`ROBOTS.md`](ROBOTS.md). Compact reference for AI assistants

## Testing Status

| Tier | Runtime | Status |
|------|---------|--------|
| Integration | Node.js built-in test runner against 23 real API Gateway v2.0 event fixtures | [![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml) |

Tests are fixture-driven. 6 fixtures are copied verbatim from [`aws/aws-lambda-go events/testdata`](https://github.com/aws/aws-lambda-go/tree/main/events/testdata) — the exact shapes the AWS Go SDK uses to test its own event handling, which is the closest "real Lambda input" available without provisioning AWS infrastructure. 17 hand-written fixtures cover scenarios AWS does not publish (cookies, bearer/basic auth, API key, malformed body, multipart, unicode, base64, edge cases). The v1.0 REST API authorizer payload in the AWS testdata is included as a documented unsupported boundary.

## License

MIT
