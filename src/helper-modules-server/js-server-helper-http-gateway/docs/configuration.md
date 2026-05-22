# Configuration

Configuration reference for `@superloomdev/js-server-helper-http-gateway`.

**Related docs:**
- [`api.md`](api.md) for function reference
- [Server Loader Architecture](https://github.com/superloomdev/superloom/blob/main/docs/server/server-loader.md) for the loader pattern

---

## Loader Pattern

The gateway is a factory module. Each `require()(Lib, config)` call returns an independent HttpGateway interface bound to one adapter and one configuration.

```javascript
const GatewayLoader = require('@superloomdev/js-server-helper-http-gateway');

const Gateway = GatewayLoader(Lib, {
  ADAPTER: require('@superloomdev/js-server-helper-http-gateway-adapter-aws-apigateway')
});
```

The loader validates configuration at construction time and throws on misconfiguration. This ensures setup errors surface at startup, not on first request.

---

## Configuration Keys

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `ADAPTER` | `Function` | Yes | Adapter factory function (for example, `require('js-server-helper-http-gateway-adapter-aws-apigateway')`) |
| `ADAPTER_CONFIG` | `Object` | No | Per-adapter configuration passed to the adapter factory |

### ADAPTER

The adapter factory function. Pass the result of `require()` for your chosen runtime adapter. The gateway has no runtime dependencies. You install only the adapter you need.

**Available adapters:**

| Adapter | Runtime |
|---------|---------|
| `@superloomdev/js-server-helper-http-gateway-adapter-aws-apigateway` | AWS Lambda + API Gateway HTTP API (payload v2.0) / Lambda Function URLs |
| `@superloomdev/js-server-helper-http-gateway-adapter-express` | Docker or Express |

**Example:**
```javascript
const Gateway = GatewayLoader(Lib, {
  ADAPTER: require('@superloomdev/js-server-helper-http-gateway-adapter-express')
});
```

### ADAPTER_CONFIG

Optional configuration passed through to the adapter factory. The shape varies by adapter. See each adapter's `docs/configuration.md` for available options.

**Example:**
```javascript
const Gateway = GatewayLoader(Lib, {
  ADAPTER: require('@superloomdev/js-server-helper-http-gateway-adapter-aws-apigateway'),
  ADAPTER_CONFIG: {
    // Adapter-specific options
  }
});
```

---

## Peer Dependencies

The gateway expects these modules in the `Lib` container:

| Module | Purpose |
|--------|---------|
| `Lib.Utils` | Type checking and validation utilities |
| `Lib.Debug` | Structured logging |
| `Lib.Instance` | Per-request instance lifecycle |

These are typically provided by your application's loader setup. See [Server Loader Architecture](https://github.com/superloomdev/superloom/blob/main/docs/server/server-loader.md).

---

## Direct Dependencies

These npm packages are bundled with the gateway:

| Package | Purpose | Version |
|---------|---------|---------|
| `cookie` | RFC 6265 cookie serialization and parsing | 1.x |
| `tldts` | URL parsing via Mozilla Public Suffix List | 5.x |

---

## Optional Peer Dependencies

Runtime adapters are optional peer dependencies. Install only the adapter for your runtime:

| Package | Version |
|---------|---------|
| `@superloomdev/js-server-helper-http-gateway-adapter-aws-apigateway` | ^1.0.0 |
| `@superloomdev/js-server-helper-http-gateway-adapter-express` | ^1.0.0 |

---

## Environment Variables

The gateway itself does not read environment variables. Configuration is explicit via the loader.

The `_test/loader.js` used by the test suite does not read environment variables either. The gateway's own tests use only the in-process stub adapter.

---

## Testing Tiers

| Tier | Runtime | Status |
|------|---------|--------|
| Emulated | Node.js built-in test runner against in-process stub adapter | [![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml) |

The gateway's own tests use the in-process stub adapter (`_test/stub-adapter.js`) which satisfies the three-method adapter contract with minimal fixed-output behavior. It is not a simulation of API Gateway or Express internals. It exists only to let the gateway module exercise its own logic without any real runtime.

Integration tests for each runtime adapter live in the corresponding adapter package.

### Running Tests

From the module's `_test/` directory:

```bash
npm install && npm test
```

The test suite covers:
- Loader validation (throws on misconfiguration)
- `initHttpRequestData` and `isHttpInstance`
- `setArgsFromRequest` (all methods, types, validators, edge cases)
- `returnHttpResponse`, `returnHttpStatus`, `returnHttpRedirect`, `returnHttpRedirect404`
- `setCookie` (including SameSite=None omission for incompatible user-agents)
- `getRequestIPAddress`, `getRequestUserAgent`, `getRequestOrigin`
- `getRequestCountryCode` (adapter-delegated)
- `getHttpTime`
- `getUrlParts`
- Internal parts: `cookies.js`, `params.js`, `url-parts.js`

---

## Default Headers

`returnHttpResponse` automatically adds these headers unless overridden:

| Header | Value |
|--------|-------|
| `Cache-Control` | `max-age=0` |
| `Content-Type` | `application/json` |

Caller-supplied headers win over defaults.

---

## Instance Shape

After calling `initHttpRequestData`, the instance contains:

```javascript
instance.http_request = {
  headers: { /* lowercase header names */ },
  get: { /* query parameters */ },
  post: { /* POST body fields (JSON or form-urlencoded) */ },
  path: { /* URL path parameters */ },
  method: 'GET' | 'POST' | ...,
  cookies: { /* parsed Cookie header */ }
};

instance.http_response = {
  cookies: { /* Set-Cookie headers to be sent */ }
};

instance.gateway_response_callback = Function;
```
