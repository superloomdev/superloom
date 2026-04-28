# @superloomdev/js-server-helper-http

[![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-brightgreen.svg)](https://nodejs.org)

Outgoing HTTP client for Node.js. Modern async/await wrapper around the **built-in `fetch` API** (Node 22+) with Bearer/Basic auth, timeouts via `AbortSignal.timeout`, custom headers, and a normalized response shape. Zero runtime dependencies. Part of the [Superloom](https://github.com/superloomdev/superloom).

## Installation

```bash
npm install @superloomdev/js-server-helper-http
```

## Peer Dependencies (Injected via Loader)

- `@superloomdev/js-helper-utils` - type checks (`Lib.Utils`)
- `@superloomdev/js-helper-debug` - logging and performance audit (`Lib.Debug`)

## Direct Dependencies (Bundled)

None. Uses Node.js 22+ built-in globals: `fetch`, `AbortSignal`, `URL`, `URLSearchParams`, `Buffer`, `FormData`.

## Exported Functions

### Core Request Function

| Function | Params | Return | Description |
|---|---|---|---|
| `fetchJSON` | `(url, method, params?, content_type?, options?)` | `Promise<Object>` | Generic HTTP request |

### Convenience Methods

| Function | Params | Return | Description |
|---|---|---|---|
| `get` | `(url, params?, options?)` | `Promise<Object>` | GET request |
| `post` | `(url, params?, options?)` | `Promise<Object>` | POST with JSON body |
| `postForm` | `(url, params?, options?)` | `Promise<Object>` | POST with url-encoded body |
| `put` | `(url, params?, options?)` | `Promise<Object>` | PUT with JSON body |
| `delete` | `(url, params?, options?)` | `Promise<Object>` | DELETE request |
| `patch` | `(url, params?, options?)` | `Promise<Object>` | PATCH with JSON body |

## Response Format

All functions return a standardized response object (never throws):

```javascript
{
  success: true,        // Boolean: request succeeded (2xx status)
  status: 200,          // Integer: HTTP status code (0 on network error / timeout)
  headers: {},          // Object: response headers (lowercase keys)
  data: {},             // Object | String | null: parsed JSON, raw text, or null on empty body
  error: null           // Object | null: error details if success=false
}
```

Error object structure:

```javascript
{
  type: 'HTTP_ERROR',   // 'HTTP_ERROR' | 'NETWORK_ERROR' | 'REQUEST_ERROR'
  message: '...'        // Human-readable error description
}
```

| Error Type | When |
|---|---|
| `HTTP_ERROR` | Server responded with non-2xx status |
| `NETWORK_ERROR` | Timeout, DNS failure, connection refused, TLS error |
| `REQUEST_ERROR` | Unexpected failure in request setup |

## Options Object

```javascript
{
  timeout: 30,          // Override default timeout (seconds)
  headers: {},          // Additional headers to send
  auth: {
    bearer_token: '...',  // Bearer token
    basic: { username: '...', password: '...' }  // Basic auth (base64 encoded via Buffer)
  }
}
```

## Usage

```javascript
// In loader (Lib must contain Utils and Debug)
Lib.Http = require('@superloomdev/js-server-helper-http')(Lib, { /* config overrides */ });

// Simple GET
const result = await Lib.Http.get('https://api.example.com/users');
if (result.success) {
  console.log(result.data);
}

// POST with JSON
const result = await Lib.Http.post('https://api.example.com/users', {
  name: 'John',
  email: 'john@example.com'
});

// Authenticated request
const result = await Lib.Http.get('https://api.example.com/protected', null, {
  auth: { bearer_token: 'my-token' }
});

// Custom headers + timeout
const result = await Lib.Http.get('https://api.example.com/data', null, {
  headers: { 'X-API-Key': 'secret-key' },
  timeout: 10
});

// Multipart upload - pass a FormData instance as params
const form = new FormData();
form.append('file', new Blob([file_buffer]), 'report.pdf');
form.append('title', 'Quarterly Report');
const result = await Lib.Http.fetchJSON(
  'https://api.example.com/upload',
  'POST',
  form,
  'multipart',
  { timeout: 60, auth: { bearer_token: 'token' } }
);
```

## Content Types

| Type | Used For | Content-Type Header |
|---|---|---|
| `json` | POST/PUT/PATCH with JSON body | `application/json` |
| `urlencoded` | POST/PUT/PATCH with form data | `application/x-www-form-urlencoded` |
| `multipart` | File uploads (pass a `FormData` instance) | Set automatically by `fetch` (with boundary) |

## Configuration

| Key | Default | Description |
|---|---|---|
| `TIMEOUT` | `30` | Default timeout in seconds (`AbortSignal.timeout`) |
| `USER_AGENT` | `'Open-Framework-HTTP/2.0'` | Default User-Agent header |

## Testing

| Tier | Runtime | Status |
|---|---|---|
| **Unit Tests** | Node.js `node --test` (hits `httpbin.org`) | [![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml) |

Run locally (requires network access):

```bash
cd _test
npm install && npm test
```

See [Module Testing](https://github.com/superloomdev/superloom/blob/main/docs/architecture/module-testing.md) for the full testing architecture.
