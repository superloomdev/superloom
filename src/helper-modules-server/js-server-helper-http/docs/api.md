# API Reference. `js-server-helper-http`

Every exported function on the public interface, with parameters, return shape, and notes. For loader and dependency notes see [Configuration](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-http/docs/configuration.md).

## On This Page

- [Conventions](#conventions)
- [The Response Object](#the-response-object)
- [Core Function. `fetchJSON`](#core-function-fetchjson)
- [Convenience Methods](#convenience-methods)
- [Authentication](#authentication)
- [Content Types](#content-types)
- [Error Types](#error-types)
- [Worked Examples](#worked-examples)

---

## Conventions

Every function in this module is **asynchronous, side-effect-free with respect to module state, and never throws**. The only mutation is the optional performance-audit log line emitted to `Lib.Debug`. Every call returns the same envelope on success and on every failure mode.

| Pattern | Behaviour |
|---|---|
| **Never throws.** | Every failure (HTTP 4xx/5xx, timeout, DNS failure, TLS error, malformed JSON) is converted into a structured result with `success: false`. Calling code does not need `try`/`catch` around the call |
| **Result is always the same shape.** | `{ success, status, headers, data, error }` for every outcome. Two requests with different outcomes can be compared field by field; no branch shapes |
| **HTTP error vs network failure is distinguished by `status`.** | `status` greater than zero means a response was received from the server (even if 4xx or 5xx). `status` equal to zero means no response was received (timeout, network failure, request-setup error) |
| **Headers are lowercased.** | Response headers are returned as a plain object with lowercase keys. This matches the iteration order of the native `Headers` object |
| **Body parsing is best-effort.** | The response body is read once as text. If the text parses as JSON it is returned as the parsed value; otherwise the raw text is returned. An empty body returns `null` |

---

## The Response Object

Every function returns a Promise resolving to an object with the following fields:

| Field | Type | Description |
|---|---|---|
| `success` | `boolean` | `true` if the server returned a 2xx status code. `false` otherwise |
| `status` | `number` | HTTP status code returned by the server. `0` if no response was received (timeout, network failure, request-setup error) |
| `headers` | `object` | Response headers as a plain object with lowercase keys. Empty object `{}` when no response was received |
| `data` | `object` \| `string` \| `null` | Parsed JSON when the body is valid JSON. Raw text when the body is not JSON. `null` when the body is empty or when no response was received |
| `error` | `object` \| `null` | A `{ type, message }` object on failure. `null` on success. See [Error Types](#error-types) |

> **Reading the envelope.** Branch once on `result.success`. If `success` is `false`, read `result.status` to distinguish an HTTP error (status > 0) from a network failure (status == 0). Read `result.error.type` for a programmatic discriminator. The `data` field is still populated on 4xx/5xx responses when the server sends a body (typical for API error JSON).

---

## Core Function. `fetchJSON`

`fetchJSON(url, method, params?, content_type?, options?)`

Generic HTTP request. Used internally by every convenience method. Call directly when you need a method or content type not covered by the wrappers, or when you need to send multipart data.

| Param | Type | Required | Description |
|---|---|---|---|
| `url` | `string` | Yes | Full URL including protocol |
| `method` | `string` | Yes | One of `'GET'`, `'POST'`, `'PUT'`, `'DELETE'`, `'PATCH'` |
| `params` | `object` \| `FormData` | No | Query parameters for `GET`/`DELETE`. Request body for `POST`/`PUT`/`PATCH`. For multipart, pass a `FormData` instance |
| `content_type` | `string` | No | One of `'json'`, `'urlencoded'`, `'multipart'`. Default: `'urlencoded'`. Only used by body-bearing methods |
| `options` | `object` | No | Per-call overrides. See the options table below |

**Options object:**

| Option | Type | Description |
|---|---|---|
| `timeout` | `number` | Override the default timeout for this call (in seconds). Default comes from `CONFIG.TIMEOUT` (30 seconds) |
| `headers` | `object` | Additional headers to merge onto the request. Caller headers override the framework defaults (`Accept`, `User-Agent`) |
| `auth` | `object` | Authentication credentials. See [Authentication](#authentication) |

**Returns:** `Promise<object>` resolving to the standard envelope. See [The Response Object](#the-response-object).

---

## Convenience Methods

Six convenience methods. Each is a thin wrapper around `fetchJSON` with a fixed method and content type. They all return the same envelope.

| Function | Method | Content type | Use for |
|---|---|---|---|
| `get(url, params?, options?)` | `GET` | n/a (params become query string) | Reads |
| `post(url, params?, options?)` | `POST` | `json` | Standard API writes with a JSON body |
| `postForm(url, params?, options?)` | `POST` | `urlencoded` | Form posts (OAuth token endpoints, legacy APIs) |
| `put(url, params?, options?)` | `PUT` | `json` | Updates with a JSON body |
| `delete(url, params?, options?)` | `DELETE` | n/a (params become query string) | Deletes |
| `patch(url, params?, options?)` | `PATCH` | `json` | Partial updates with a JSON body |

All six take the same option-object shape as `fetchJSON`. For multipart uploads or for methods/content-type combinations not in this table, call `fetchJSON` directly.

---

## Authentication

The `options.auth` object accepts one of two shapes. The module sets the `Authorization` header accordingly.

### Bearer token

```javascript
await Lib.Http.get('https://api.example.com/me', null, {
  auth: { bearer_token: 'eyJhbGciOi...' }
});
```

Sets `Authorization: Bearer eyJhbGciOi...`.

### Basic auth

```javascript
await Lib.Http.get('https://api.example.com/admin', null, {
  auth: { basic: { username: 'admin', password: 's3cret' } }
});
```

The credentials are base64-encoded via `Buffer.from(...).toString('base64')` and set as `Authorization: Basic <encoded>`.

> **Precedence.** When both `bearer_token` and `basic` are present, the bearer token wins. Practically, pass only one.

> **Empty values are ignored.** An `auth.bearer_token` that is `''`, `null`, or `undefined` is treated as "no auth" and the `Authorization` header is not set. Same for `auth.basic.username`.

---

## Content Types

The `content_type` argument selects the body encoder. It is ignored for `GET` and `DELETE` (which use query strings) and used by `POST`, `PUT`, and `PATCH`.

| Value | Body encoder | Content-Type header set | Pass as `params` |
|---|---|---|---|
| `'json'` | `JSON.stringify(params)` | `application/json` | A plain object or array |
| `'urlencoded'` *(default)* | `new URLSearchParams(params).toString()` | `application/x-www-form-urlencoded` | A flat object of string-coercible values |
| `'multipart'` | The `FormData` instance is passed straight to `fetch` | Set automatically by `fetch` (includes the boundary) | A `FormData` instance |

For multipart, the caller is responsible for constructing the `FormData` instance and appending parts. The module does not interpret the entries; it hands the `FormData` to `fetch` and lets the runtime set the `Content-Type` header (including the multipart boundary).

---

## Error Types

When `success` is `false`, the `error` field is one of four frozen catalog entries. Each has a `type` (programmatic discriminator) and a `message` (human-readable).

| `error.type` | When | Companion `status` |
|---|---|---|
| `NETWORK_REQUEST_FAILED` | The server returned a 4xx or 5xx status code. The response body, if any, is still in `data` | The HTTP status code (e.g. `404`, `500`) |
| `NETWORK_REQUEST_FAILED` | The request never reached the server. DNS failure, connection refused, TLS error, or any other `TypeError` thrown by `fetch` | `0` |
| `NETWORK_TIMEOUT` | The request exceeded the timeout. `AbortSignal.timeout` fired | `0` |
| `NETWORK_SETUP_FAILED` | An unexpected error occurred during request setup (e.g. a malformed URL that `URL` cannot parse). Rare in practice | `0` |

> **`NETWORK_REQUEST_FAILED` covers two cases.** The same `type` is returned for HTTP errors (4xx/5xx) and for network failures. The reason is historical: callers typically read `status` to distinguish them. `status > 0` means the server responded; `status == 0` means the request never reached the server. The `error.message` differs between the two cases.

---

## Worked Examples

### Simple GET with query parameters

```javascript
const result = await Lib.Http.get('https://api.example.com/users', {
  active: true,
  limit: 50
});

if (result.success) {
  console.log(result.data.users);
} else if (result.status === 404) {
  console.log('Endpoint not found');
} else {
  console.error(result.error.type, result.error.message);
}
```

### POST JSON with bearer token

```javascript
const result = await Lib.Http.post(
  'https://api.example.com/orders',
  { customer_id: 'c_123', amount: 49.99 },
  { auth: { bearer_token: process.env.API_TOKEN } }
);

if (result.success) {
  const order = result.data;
  // ...
}
```

### POST form data to an OAuth token endpoint

```javascript
const result = await Lib.Http.postForm('https://auth.example.com/oauth/token', {
  grant_type: 'client_credentials',
  client_id: process.env.CLIENT_ID,
  client_secret: process.env.CLIENT_SECRET
});

if (result.success) {
  const access_token = result.data.access_token;
}
```

### Multipart file upload

```javascript
const form = new FormData();
form.append('file', new Blob([file_buffer]), 'report.pdf');
form.append('title', 'Quarterly Report');

const result = await Lib.Http.fetchJSON(
  'https://api.example.com/upload',
  'POST',
  form,
  'multipart',
  {
    timeout: 60,
    auth: { bearer_token: process.env.API_TOKEN }
  }
);
```

The runtime sets the `Content-Type: multipart/form-data; boundary=...` header automatically when `fetch` receives a `FormData` body.

### Custom headers + per-call timeout

```javascript
const result = await Lib.Http.get('https://api.example.com/data', null, {
  headers: { 'X-API-Key': process.env.API_KEY },
  timeout: 10
});
```

Caller-supplied headers override the framework defaults (`Accept`, `User-Agent`) if the same key is provided.

### Handling timeouts

```javascript
const result = await Lib.Http.get('https://slow.example.com/report', null, {
  timeout: 5
});

if (!result.success && result.error.type === 'NETWORK_TIMEOUT') {
  // Fall back to cached value, retry, surface a 504, etc.
}
```

### Distinguishing HTTP error from network failure

```javascript
const result = await Lib.Http.get('https://api.example.com/things/42');

if (result.success) {
  // 2xx
  return result.data;
}

if (result.status > 0) {
  // Server replied with a non-2xx (e.g. 404, 500). result.data may contain
  // the server's error envelope.
  return { server_error: result.status, body: result.data };
}

// Status is 0: timeout or network failure. result.error.type tells which.
return { transport_error: result.error.type };
```
