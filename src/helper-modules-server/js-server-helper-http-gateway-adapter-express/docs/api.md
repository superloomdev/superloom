# API Reference

Complete reference for `@superloomdev/js-server-helper-http-gateway-adapter-express`. Application code rarely calls these methods directly — they are invoked by the gateway. This document describes what each method does so adapter behavior is fully transparent.

**Related docs:**
- [`middleware.md`](middleware.md) for the Express middleware setup the adapter relies on
- [`../ROBOTS.md`](../ROBOTS.md) for compact signature reference
- [`../../js-server-helper-http-gateway/docs/api.md`](../../js-server-helper-http-gateway/docs/api.md) for the gateway methods you call from application code

---

## Conventions

**Stateless singleton.** The adapter is a single module-level object with no per-request state. All request data lives on the gateway's `instance` parameter.

**Loader contract.** The adapter is a factory function. Pass it as `CONFIG.ADAPTER` to the gateway. The gateway calls it once at construction time and reuses the returned adapter object for every request.

---

## Adapter Contract

### loadHttpDataToInstance(instance, req, context, res)

Normalize an Express `req` object into `instance.http_request` and wire `res` as the gateway's response callback. Called by `Gateway.initHttpRequestData`.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `instance` | `Object` | Yes | Per-request instance to populate |
| `req` | `Object` | Yes | Express request |
| `context` | `*` | No | Unused (accepted for adapter contract) |
| `res` | `Object` | Yes | Express response |

**Populates on `instance`:**

| Field | Source | Type |
|-------|--------|------|
| `http_request.method` | `req.method` (uppercased) | `String` |
| `http_request.headers` | `req.headers` (already lowercased by Node http) | `Object` |
| `http_request.get` | `req.query` | `Object` |
| `http_request.post` | `req.body` (or `{}` if absent) | `Object` |
| `http_request.path` | `req.params` | `Object` |
| `http_request.cookies` | `req.cookies` if present, else parsed from `Cookie` header | `Object` |
| `http_response.cookies` | `{}` (filled later by `setCookie`) | `Object` |
| `gateway_response_callback` | Wraps `res.status().set().send()` | `Function` |

**Returns:** `void`

---

### buildHttpResponseObject(status, headers, body)

Build the response envelope. The gateway uses this to assemble the final payload before invoking `gateway_response_callback`.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | `Integer` | Yes | HTTP status code |
| `headers` | `Object` | No | Response headers (defaults to `{}`) |
| `body` | `*` | No | Body — string, object, Buffer, or null |

**Body normalization:**

| Body type | Output |
|-----------|--------|
| `null` / `undefined` | `''` |
| `Buffer` | base64 string (then sent as raw via `res.send`) |
| `Object` | `JSON.stringify(body)` |
| Any other | `String(body)` |

**Returns:** `Object` — `{ statusCode, headers, body }`

---

### getHttpRequestCountryCode(instance)

Returns the viewer country code if a CDN forwards it.

Express has no native CDN layer, so this adapter **always returns `null`**. Projects fronting Express with CloudFront should implement a custom adapter that reads the `CloudFront-Viewer-Country` header.

**Returns:** `null`

---

## Response Sending Flow

When `Gateway.returnHttpResponse(instance, status, headers, body)` is called:

1. Gateway merges caller-supplied headers over its defaults (`Cache-Control: max-age=0`, `Content-Type: application/json`)
2. Gateway calls `adapter.buildHttpResponseObject(status, merged_headers, body)`
3. Gateway calls `instance.gateway_response_callback(null, envelope)`
4. Adapter's callback invokes `res.status(envelope.statusCode).set(envelope.headers).send(envelope.body)`

This is fully synchronous from the application's perspective.

---

## Cookie Handling

Reading: prefers `req.cookies` (populated by `cookie-parser` middleware). Falls back to parsing the raw `Cookie` header when `cookie-parser` is not installed.

Writing: `Gateway.setCookie(instance, name, value, life_seconds)` builds a `Set-Cookie` string with `Path=/`, `Secure`, optional `SameSite=None`, and `Max-Age`. The adapter then sets it as a response header. See [`../../js-server-helper-http-gateway/docs/api.md`](../../js-server-helper-http-gateway/docs/api.md) for the full cookie API.

---

## Country Code Customization

To enable country detection behind a CDN, write a thin wrapper adapter:

```javascript
const ExpressAdapter = require('@superloomdev/js-server-helper-http-gateway-adapter-express');

function CustomAdapter (Lib, config, errors) {
  const base = ExpressAdapter(Lib, config, errors);
  return Object.assign({}, base, {
    getHttpRequestCountryCode: function (instance) {
      const headers = instance.http_request && instance.http_request.headers;
      return (headers && headers['cloudfront-viewer-country']) || null;
    }
  });
}

const Gateway = GatewayLoader(Lib, { ADAPTER: CustomAdapter });
```

The other two contract methods (`loadHttpDataToInstance`, `buildHttpResponseObject`) inherit from the base adapter unchanged.
