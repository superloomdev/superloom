# Configuration

Configuration reference for `@superloomdev/js-server-helper-http-gateway-adapter-aws-apigateway`.

**Related docs:**
- [`api.md`](api.md) for the 3-method adapter contract
- [`payload-format.md`](payload-format.md) for the v2.0 event schema and v1.0 boundary
- [`../../js-server-helper-http-gateway/docs/configuration.md`](../../js-server-helper-http-gateway/docs/configuration.md) for the gateway loader and `CONFIG.ADAPTER` slot

---

## Loader Pattern

The adapter is a factory function. Pass it as `CONFIG.ADAPTER` to the gateway:

```javascript
const GatewayLoader = require('@superloomdev/js-server-helper-http-gateway');
const AwsAdapter    = require('@superloomdev/js-server-helper-http-gateway-adapter-aws-apigateway');

const Gateway = GatewayLoader(Lib, {
  ADAPTER: AwsAdapter
});
```

Pass the factory function itself (the result of `require()`), not the result of calling it. The gateway invokes it once at construction time with `(Lib, ADAPTER_CONFIG, errors)` and reuses the returned adapter object for every request.

---

## Configuration Keys

The AWS adapter accepts **no configuration**. All three loader parameters are unused:

| Loader parameter | Used by adapter? |
|---|---|
| `Lib` (the gateway's dependency container) | No |
| `ADAPTER_CONFIG` (the `CONFIG.ADAPTER_CONFIG` you pass to the gateway) | No |
| `errors` (the gateway's error catalog) | No |

The parameters are accepted only to satisfy the adapter factory contract.

---

## Runtime Dependencies

The adapter installs **zero npm packages**. It uses only Node.js built-ins (`Buffer`, `URLSearchParams`). **No AWS SDK is required** — the adapter reads from the Lambda event object directly and writes through the Lambda callback.

This keeps the deployment artifact small. A typical Lambda function bundle that uses the gateway + this adapter + your application code is well under the 250 MB unzipped Lambda layer limit even without a layer.

---

## Lambda Handler Pattern

```javascript
const GatewayLoader = require('@superloomdev/js-server-helper-http-gateway');
const AwsAdapter    = require('@superloomdev/js-server-helper-http-gateway-adapter-aws-apigateway');

// Build the gateway once at module scope so it survives across warm invocations:
const Gateway = GatewayLoader(Lib, { ADAPTER: AwsAdapter });

exports.handler = function (event, context, callback) {
  const instance = Lib.Instance.initialize();
  Gateway.initHttpRequestData(instance, event, context, callback);

  // ... application logic, including Gateway.setArgsFromRequest, etc. ...

  Gateway.returnHttpResponse(instance, 200, null, { ok: true });
};
```

The gateway is stateless across requests but its construction cost (and the adapter's) is non-trivial. Building it at module scope means each warm Lambda invocation reuses the same gateway instance — the adapter creates no per-request state outside of `instance`.

---

## Supported Runtimes

| Runtime | Supported |
|---|---|
| AWS Lambda with API Gateway **HTTP API** (v2.0 integration) | ✅ Yes |
| AWS Lambda with **Function URL** | ✅ Yes (same v2.0 payload) |
| AWS Lambda with API Gateway **REST API** (v1.0 integration) | ❌ No — use a different adapter |
| AWS Lambda with **ALB target group** | ❌ No — different event shape (separate adapter needed) |

See [`payload-format.md`](payload-format.md) for the supported v2.0 schema and the graceful-degradation behavior for v1.0 events.

---

## Country Code

`getHttpRequestCountryCode` reads `instance.http_request.headers['cloudfront-viewer-country']`. To enable it, configure CloudFront in front of API Gateway and forward the `CloudFront-Viewer-Country` header. No adapter configuration is required.
