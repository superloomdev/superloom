# js-server-helper-http

Outgoing HTTP client. Thin wrapper over Node's native `fetch` with a normalized response envelope, Bearer/Basic auth, AbortSignal timeouts, and FormData passthrough for multipart uploads. Never throws.

## Type
Server helper. Class B (depends only on Node built-ins). Real-network test tier (requires outbound HTTP access).

## Peer Dependencies
- `@superloomdev/js-helper-utils` - injected as `Lib.Utils`
- `@superloomdev/js-helper-debug` - injected as `Lib.Debug`

## Direct Dependencies
None. Uses Node built-in globals: `fetch`, `AbortSignal`, `URL`, `URLSearchParams`, `Buffer`, `FormData`.

## Loader Pattern (Factory)

```javascript
Lib.Http = require('@superloomdev/js-server-helper-http')(Lib, { /* config overrides */ });
```

Each loader call returns an independent Http interface with its own `Lib` and `CONFIG`. Stateless. No per-instance resources, no connection pools, no caches.

## Config Keys
| Key | Type | Default | Description |
|---|---|---|---|
| TIMEOUT | Number | 30 | Default request timeout in seconds (drives `AbortSignal.timeout`). Per-call override via `options.timeout` |
| USER_AGENT | String | 'Open-Framework-HTTP/2.0' | Default `User-Agent` header. Per-call override via `options.headers['User-Agent']` |

## Exported Functions

### Core
fetchJSON(url, method, params?, content_type?, options?) → { success, status, headers, data, error } | async:yes
  Main HTTP function. Underlies every convenience method.
  method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  content_type = 'json' | 'urlencoded' | 'multipart' (default 'urlencoded'; ignored for GET/DELETE)
  options = { timeout?, headers?, auth? }
  auth = { bearer_token?, basic: { username, password }? }

### Convenience Wrappers (all async, all return same envelope as fetchJSON)
get(url, params?, options?)      - GET; params become query string
post(url, params?, options?)     - POST with JSON body
postForm(url, params?, options?) - POST with urlencoded body
put(url, params?, options?)      - PUT with JSON body
delete(url, params?, options?)   - DELETE; params become query string
patch(url, params?, options?)    - PATCH with JSON body

## Standard Response Shape
```javascript
{
  success: Boolean,             // true only for 2xx
  status:  Number,              // HTTP status; 0 if no response received
  headers: Object,              // lowercase keys; {} if no response received
  data:    Object|String|null,  // parsed JSON, raw text on parse failure, null on empty/no-response
  error:   { type, message } | null
}
```

## Error Types
| error.type | When | status |
|---|---|---|
| NETWORK_REQUEST_FAILED | HTTP 4xx/5xx response (server replied, non-2xx) | > 0 (the HTTP status code) |
| NETWORK_REQUEST_FAILED | Network failure (DNS, connection refused, TLS, any `TypeError` from `fetch`) | 0 |
| NETWORK_TIMEOUT | AbortSignal.timeout fired (request exceeded the timeout) | 0 |
| NETWORK_SETUP_FAILED | Unexpected error during request setup (e.g. malformed URL) | 0 |

> NETWORK_REQUEST_FAILED is reused for HTTP errors AND for network failures. Distinguish via `result.status`: greater than zero means the server replied; zero means no response was received.

## Patterns
- **Never throws.** Every failure mode (HTTP 4xx/5xx, timeout, DNS, TLS, malformed JSON) becomes a structured result with `success: false`
- **Branch on `result.success` first.** Then on `result.status > 0` to distinguish HTTP error from network failure. Then on `result.error.type` if needed
- **Headers are lowercase-keyed.** Native `Headers` iteration is already lowercase; the module preserves that
- **Body parsing is best-effort.** Body read as text, parsed as JSON if possible, raw text otherwise. Empty body returns `null`
- **Content-type driven body encoding.** `json` → `JSON.stringify`. `urlencoded` → `new URLSearchParams(params).toString()`. `multipart` → caller passes a `FormData` instance, `fetch` sets the boundary
- **Timeouts via `AbortSignal.timeout(ms)`.** Caught separately and mapped to `NETWORK_TIMEOUT`
- **Basic auth** uses `Buffer.from('user:pass').toString('base64')`. No external crypto dependency
- **Performance audit on every request.** `Lib.Debug.performanceAuditLog('HTTP <METHOD>', url, start_ms)` on both success and failure paths
- **Caller headers override defaults.** `options.headers` is merged last; user `User-Agent`, `Accept`, etc. win over framework defaults
- **Empty auth values are ignored.** `auth.bearer_token` that is `''`/`null`/`undefined` is treated as no auth; same for `auth.basic.username`
