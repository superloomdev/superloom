# @superloomdev/js-server-helper-http-gateway-adapter-express

**Class:** B (Extended Utility - Node.js runtime only)
**Scope:** Express (Docker) runtime adapter for `js-server-helper-http-gateway`. Reads from `req`, writes through `res`, conforms to the 3-method adapter contract. Stateless singleton.

---

## Factory Loader

```javascript
const ExpressAdapter = require('@superloomdev/js-server-helper-http-gateway-adapter-express');

// Pass the factory function (not the result of calling it) as CONFIG.ADAPTER:
const Gateway = GatewayLoader(Lib, {
  ADAPTER: ExpressAdapter
});
```

**Peer dependencies in Lib:** none (the adapter is self-contained)

**Runtime peers:** `express@>=5`, optional `cookie-parser@>=1`

---

## Public Interface

The adapter exposes the 3-method contract consumed by the gateway. Application code does **not** call the adapter directly — it calls `Gateway.*` methods which delegate.

```javascript
// Populate instance.http_request, http_response, gateway_response_callback
adapter.loadHttpDataToInstance(instance, req, _context, res);
// Returns: void

// Build the response envelope sent through res.status().set().send()
adapter.buildHttpResponseObject(status, headers, body);
// Returns: Object - { statusCode, headers, body }

// Country code from a CDN layer (Express has none)
adapter.getHttpRequestCountryCode(instance);
// Returns: null (always)
```

---

## Request Normalization

| `instance.http_request` field | Source on Express `req` |
|---|---|
| `method` | `req.method.toUpperCase()` |
| `headers` | `req.headers` (already lowercased by Node http) |
| `get` | `req.query` (Express default parser, returns arrays for repeated keys) |
| `post` | `req.body` (populated by `express.json()` / `express.urlencoded()`) |
| `path` | `req.params` (Express route parameters) |
| `cookies` | `req.cookies` if set by `cookie-parser`, else parsed from raw `Cookie` header |

`gateway_response_callback` is wired to `res.status(code).set(headers).send(body)`.

---

## Required Middleware

Body parsing is the application's responsibility:

```javascript
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // optional - adapter falls back to raw Cookie header
```

Without `express.json()`, `instance.http_request.post` remains `{}` for JSON bodies. Without `cookieParser()`, the adapter parses the raw `Cookie` header itself.

---

## Express 5 Compatibility

Tested against Express 5.x (`express@^5.2.0`).

| Concern | Status |
|---|---|
| `express.json` middleware | Compatible — no adapter changes |
| `express.urlencoded` middleware | Compatible — no adapter changes |
| `cookie-parser` middleware | Compatible — no adapter changes |
| Optional route param syntax (`/path/:id?`) | **Removed in Express 5.** Register two explicit routes instead |
| Default query parser | Still returns arrays for repeated keys (`?tag=a&tag=b` → `['a','b']`) |
| Malformed JSON body | Short-circuited by `express.json()` with 400 **before** reaching the adapter |
| `text/plain` body without `express.text()` | `req.body` is `{}` — adapter passes through cleanly |

---

## Important Constraints

**Multipart/form-data not supported.** The adapter reads `req.body` directly. Multipart support requires application-level middleware (e.g. `multer`) that populates `req.body` before the adapter runs.

**Country code always `null`.** Express has no CDN layer. Projects fronting Express with CloudFront should implement a custom adapter that reads the forwarded `CloudFront-Viewer-Country` header.

**Response is sent synchronously.** `buildHttpResponseObject` returns the envelope; the gateway then calls `gateway_response_callback` which invokes `res.send`. There is no async write path.

---

## Testing

Tests boot a real Express server on a random free port (`app.listen(0)`), exercise it with `fetch`, then shut down. No mocked `req`/`res` objects.

```bash
cd _test && npm install && npm test
```

**Coverage:** 54 tests across 8 groups — request normalization, auth patterns, cookies (with and without cookie-parser), response building, full parameter-extraction pipeline, edge cases (unicode, large bodies, multi-value query, X-Forwarded-For), graceful error handling (malformed JSON, text/plain, empty body).

See [`docs/api.md`](docs/api.md) and [`docs/middleware.md`](docs/middleware.md) for extended documentation.
