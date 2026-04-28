# js-server-helper-http - AI Agent Reference

## Module Type
Server module. Outgoing HTTP client built on Node.js 22+ native `fetch`. Async/await API, auth support, normalized response shape. Zero runtime dependencies.

## Peer Dependencies
- `@superloomdev/js-helper-utils` (injected as `Lib.Utils`)
- `@superloomdev/js-helper-debug` (injected as `Lib.Debug`)

## Direct Dependencies
None. Uses Node.js built-in globals: `fetch`, `AbortSignal`, `URL`, `URLSearchParams`, `Buffer`, `FormData`.

## Loader Pattern (Factory)

```javascript
Lib.Http = require('@superloomdev/js-server-helper-http')(Lib, { /* config overrides */ });
```

Each loader call returns an independent Http interface with its own `Lib` and `CONFIG`. Stateless - no per-instance resources. Uses Node.js built-in `fetch` (globals are always available, no adapter to cache).

## Config Keys
| Key | Type | Default | Description |
|---|---|---|---|
| TIMEOUT | Number | 30 | Default request timeout in seconds (drives `AbortSignal.timeout`) |
| USER_AGENT | String | 'Open-Framework-HTTP/2.0' | Default User-Agent header |

## Exported Functions

### Core
fetchJSON(url, method, params?, content_type?, options?) → { success, status, headers, data, error } | async:yes
  Main HTTP function. `content_type` = 'json' | 'urlencoded' | 'multipart' (default 'urlencoded').
  `options` = { timeout?, headers?, auth? }
  `auth` = { bearer_token?, basic: { username, password }? }

### Convenience Wrappers (all async, all return same shape as fetchJSON)
get(url, params?, options?) - GET with query params (urlencoded)
post(url, params?, options?) - POST with JSON body
postForm(url, params?, options?) - POST with urlencoded form body
put(url, params?, options?) - PUT with JSON body
delete(url, params?, options?) - DELETE
patch(url, params?, options?) - PATCH with JSON body

## Standard Response Shape
```javascript
{
  success: Boolean,                       // true if 2xx response
  status: Number,                         // HTTP status code (0 on network error / timeout)
  headers: Object,                        // lowercase header keys
  data: Object | String | null,           // parsed JSON, raw text, or null on empty body
  error: { type, message } | null         // type ∈ 'HTTP_ERROR' | 'NETWORK_ERROR' | 'REQUEST_ERROR'
}
```

## Patterns
- **Never throws:** Always returns a structured result object, even on network failures and timeouts
- **Normalized headers:** Response headers are lowercase-keyed (native `Headers` iteration is already lowercase)
- **Content-type driven encoding:** `content_type` parameter selects body encoder - `json` uses `JSON.stringify`, `urlencoded` uses `URLSearchParams`, `multipart` expects a caller-supplied `FormData` instance (fetch sets the boundary)
- **Timeouts:** Implemented via `AbortSignal.timeout(ms)` - caught separately and mapped to `NETWORK_ERROR`
- **Basic auth:** Encoded with `Buffer.from(user:pass).toString('base64')` - no external crypto dependency
- **Performance logging:** Every outbound request logs via `Lib.Debug.performanceAuditLog('HTTP <METHOD>', url, start_ms)` for success and failure paths
- **Uses Lib.Utils:** For type checks and validation (e.g., `Lib.Utils.isEmpty`, `Lib.Utils.isNullOrUndefined`)
- **Uses Lib.Debug:** For request logging and performance audit
- **Native fetch:** Implementation detail - callers only see the Http public object
