# API Reference

Complete function reference for `@superloomdev/js-server-helper-http-gateway`. All functions are methods on the HttpGateway interface returned by the loader.

**Related docs:**
- [`configuration.md`](configuration.md) for loader pattern and config keys
- [`ROBOTS.md`](../ROBOTS.md) for compact signature reference

---

## Conventions

**Error handling:** This module uses the Superloom standard return envelope. Functions return `[err, result]` where `err` is `null` on success. Parameter extraction uses `[null, false]` to signal validation failure without an error object.

**Instance pattern:** All request-scoped functions operate on a per-request `instance` object. Initialize it with `initHttpRequestData` before calling other functions.

---

## Request Lifecycle

### initHttpRequestData(instance, raw_request, raw_context, response_callback)

Initialize HTTP request data in the instance from raw runtime data. Delegates to the configured adapter which normalizes the wire-format into `instance.http_request`, `instance.http_response`, and `instance.gateway_response_callback`.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `instance` | `Object` | Yes | Per-request instance to populate |
| `raw_request` | `Object` | Yes | Raw request from runtime (event or req) |
| `raw_context` | `Object` | No | Runtime execution context (ctx or null) |
| `response_callback` | `Function` | Yes | Runtime response callback (cb or res) |

**Returns:** `void`

**Example:**
```javascript
const instance = Lib.Instance.initialize();
Gateway.initHttpRequestData(instance, event, context, callback);
```

---

### isHttpInstance(instance)

Returns `true` if the instance was initialized with HTTP request data.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `instance` | `Object` | Yes | Per-request instance |

**Returns:** `Boolean`

---

## Parameter Extraction

### setArgsFromRequest(instance, params)

Build a typed, validated args object from the normalized HTTP request data in `instance.http_request`.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `instance` | `Object` | Yes | Per-request instance with http_request populated |
| `params` | `Object[]` | Yes | Array of parameter descriptor objects |

**Param descriptor shape:**

| Field | Type | Description |
|-------|------|-------------|
| `method` | `String` | Source location: `'GET'` \| `'POST'` \| `'PATH'` \| `'HEADER'` \| `'FIXED'` |
| `name` | `String` | Key name in the source location |
| `rename` | `String` | Output key name in returned args object |
| `value` | `*` | Literal value (only for `method: 'FIXED'`) |
| `required` | `Boolean` | `true` aborts and returns `[null, false]` if missing |
| `default` | `*` | Value used when param is absent and not required |
| `is_number` | `Boolean` | Typecast string to Number |
| `is_boolean` | `Boolean` | Typecast via `Boolean(Number(value))` |
| `is_json` | `Boolean` | Parse value with `JSON.parse` |
| `trim` | `Boolean` | Trim whitespace; converts empty string to null |
| `json_func` | `Function` | Transform applied after `JSON.parse` |
| `sanatize_func` | `Function` | Sanitization function applied to the value |
| `validate_func` | `Function` | Must return truthy; failure returns `[null, false]` |
| `invalidate_func` | `Function` | Must return falsy; truthy return is forwarded as `[err, false]` |

**Returns:**
- `[null, {Object}]` on success
- `[null, false]` on required-param or validation failure
- `[{Object}, false]` on `invalidate_func` failure

**Example:**
```javascript
const [err, args] = Gateway.setArgsFromRequest(instance, [
  { method: 'GET', name: 'page', rename: 'page', required: false, default: 1, is_number: true },
  { method: 'POST', name: 'email', rename: 'email', required: true, trim: true },
  { method: 'HEADER', name: 'authorization', rename: 'token', required: true }
]);

if (!args) {
  return Gateway.returnHttpStatus(instance, 'bad_request');
}
```

---

## Response Functions

### returnHttpResponse(instance, status, headers, body)

Send an HTTP response back through the runtime callback. Merges default headers with any cookies set on `instance.http_response.cookies`, then adds caller-supplied headers.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `instance` | `Object` | Yes | Per-request instance |
| `status` | `Integer` | Yes | HTTP status code |
| `headers` | `Object` | No | Additional response headers |
| `body` | `Object` | No | Response body (serialized as JSON) |

**Returns:** `Boolean` (always `true`)

**Example:**
```javascript
return Gateway.returnHttpResponse(instance, 200, null, { ok: true, data: result });
```

---

### returnHttpStatus(instance, status_name)

Send a body-less HTTP status response.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `instance` | `Object` | Yes | Per-request instance |
| `status_name` | `String` | Yes | One of: `'not_modified'` \| `'bad_request'` \| `'unauthorized'` \| `'not_found'` \| `'invalid_token'` |

**Returns:** `Boolean` (always `true`)

**Status code mapping:**

| status_name | HTTP Code |
|-------------|-----------|
| `not_modified` | 304 |
| `bad_request` | 400 |
| `unauthorized` | 401 |
| `not_found` | 404 |
| `invalid_token` | 498 |

---

### returnHttpRedirect(instance, location)

Send a 301 permanent redirect response.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `instance` | `Object` | Yes | Per-request instance |
| `location` | `String` | Yes | Redirect target URI |

**Returns:** `Boolean` (always `true`)

---

### returnHttpRedirect404(instance)

Send a 301 redirect to `/404`.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `instance` | `Object` | Yes | Per-request instance |

**Returns:** `Boolean` (always `true`)

---

## Request Accessors

### getRequestIPAddress(instance)

Get the client IP address from the request headers. Uses the `x-forwarded-for` header and returns the first IP in the chain (the originating client address).

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `instance` | `Object` | Yes | Per-request instance |

**Returns:** `String` - IP address or empty string if not available

---

### getRequestUserAgent(instance)

Get the User-Agent string from the request headers.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `instance` | `Object` | Yes | Per-request instance |

**Returns:** `String` - User-Agent or empty string if not present

---

### getRequestOrigin(instance)

Get the Origin header from the request. Returns the scheme plus host (for example, `https://api.example.com`).

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `instance` | `Object` | Yes | Per-request instance |

**Returns:** `String` - Origin string or empty string if not present

---

### getRequestCountryCode(instance)

Get the viewer country code from the request. Availability depends on the adapter. Adapters that cannot supply this (for example, Express without a CDN) return `null`.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `instance` | `Object` | Yes | Per-request instance |

**Returns:** `String` \| `null` - ISO 3166-1 alpha-2 country code or null

---

## Utilities

### setCookie(instance, cookie_name, cookie_value, cookie_life)

Set a cookie on the HTTP response. The serialized Set-Cookie string is stored in `instance.http_response.cookies` and flushed by `returnHttpResponse` when the response is sent.

SameSite=None is automatically omitted for browsers known to mishandle it (iOS 12, macOS 10.14 Safari, UC Browser below 12.13.2, Chromium 51-66).

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `instance` | `Object` | Yes | Per-request instance |
| `cookie_name` | `String` | Yes | Cookie name |
| `cookie_value` | `String` | Yes | Cookie value |
| `cookie_life` | `Number` | Yes | Lifetime in seconds (maxAge) |

**Returns:** `void`

**Example:**
```javascript
Gateway.setCookie(instance, 'session', sessionToken, 86400); // 24 hours
```

---

### getHttpTime(timestamp_seconds)

Format a Unix timestamp (seconds) as an HTTP-date string. If no timestamp is provided, the current time is used.

**Format:** `"Day, DD Mon YYYY HH:MM:SS GMT"`

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `timestamp_seconds` | `Number` | No | Unix timestamp in seconds |

**Returns:** `String` - HTTP-date formatted string

**Example:**
```javascript
const expires = Gateway.getHttpTime(Date.now() / 1000 + 86400);
// "Wed, 21 Oct 2015 07:28:00 GMT"
```

---

### getUrlParts(url)

Extract the component parts of a URL.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | `String` | Yes | Full URL string to parse |

**Returns:** `Object` with keys:

| Key | Type | Description |
|-----|------|-------------|
| `sub_domain` | `String` | Subdomain portion (for example, `www.abc`) |
| `domain` | `String` | Full domain with TLD (for example, `example.co.uk`) |
| `domain_without_tld` | `String` | Domain name without TLD (for example, `example`) |
| `tld` | `String` | Public suffix or TLD (for example, `co.uk`) |
| `hostname` | `String` | Full hostname (for example, `www.abc.example.co.uk`) |
| `is_ip` | `Boolean` | `true` when URL is an IP address |

**Example:**
```javascript
const parts = Gateway.getUrlParts('http://www.abc.example.co.uk:8080/path');
// {
//   sub_domain: 'www.abc',
//   domain: 'example.co.uk',
//   domain_without_tld: 'example',
//   tld: 'co.uk',
//   hostname: 'www.abc.example.co.uk',
//   is_ip: false
// }
```

---

## Adapter Contract

Every runtime adapter implements three methods. The gateway calls these; application code does not.

### loadHttpDataToInstance(instance, raw_request, raw_context, response_callback)

Populate the instance with normalized request data from the raw runtime input. The adapter extracts headers, query params, path params, and body from the runtime-specific format and writes them into `instance.http_request`.

### buildHttpResponseObject(status, headers, body)

Build the runtime-specific response envelope. Returns an object suitable for the runtime (for example, API Gateway response format or Express res object).

### getHttpRequestCountryCode(instance)

Return the viewer country code if the runtime can supply it (for example, CloudFront). Returns `null` when unavailable.

---

## SameSite=None Compatibility

The `setCookie` function automatically manages the `SameSite=None` attribute based on the request's `User-Agent` header. The following browser families have known bugs that cause them to reject or mishandle cookies set with `SameSite=None`:

| Affected client | Bug |
|-----------------|-----|
| iOS 12 (all browsers) | Treats `SameSite=None` as `SameSite=Strict` — cookie is blocked on cross-site requests |
| macOS 10.14 Safari and embedded browser | Same WebKit bug as iOS 12 |
| UC Browser below 12.13.2 | Drops the cookie entirely when `SameSite=None` is present |
| Chromium 51-66 | Drops any cookie with an unrecognised `SameSite` value |

For these clients, `setCookie` serializes the cookie without any `SameSite` attribute. Modern browsers (Chromium 67+, Safari 13+, Firefox 79+) receive `SameSite=None; Secure` as intended by RFC 6265bis.

This detection is based on the [Chromium SameSite incompatible clients list](https://www.chromium.org/updates/same-site/incompatible-clients).

---

## Multipart Limitation

This module does **not** support `multipart/form-data` request bodies. Sending a multipart request results in an empty `instance.http_request.post`. The body is not parsed and no error is raised.

Use `application/json` or `application/x-www-form-urlencoded` for all POST data. Multipart support will be added in a future version via a dedicated adapter-level option.
