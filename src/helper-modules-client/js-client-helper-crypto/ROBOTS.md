# js-client-helper-crypto - AI Agent Reference

## Module Type
Client module. Browser-safe crypto helpers using Web Crypto API (available in modern browsers, React Native, and Node.js 19+).

## Peer Dependencies
- `@superloomdev/js-helper-utils` (injected as `Lib.Utils`)

## Direct Dependencies
None. Uses browser/runtime-native Web Crypto API (`globalThis.crypto`).

## Loader Pattern (Factory)

```javascript
Lib.Crypto = require('@superloomdev/js-client-helper-crypto')(Lib, { /* config overrides */ });
```

Each loader call returns an independent Crypto interface with its own `Lib` and `CONFIG`. Stateless - no per-instance resources.

## Config Keys
| Key | Type | Default | Description |
|---|---|---|---|
| BASE36_CHARSET | String | `'0123456789abcdefghijklmnopqrstuvwxyz'` | Alphabet for base-36 conversion |

## Exported Functions

### Random & UUIDs
generateRandomString(charset, length) → String | async:no
  Random string from given charset, using Web Crypto for entropy. Returns '' on empty/non-positive input.

generateUUID() → String | async:no
  Standard UUID v4 via `crypto.randomUUID()` with polyfill fallback.

generateCompactUUID() → String | async:no
  Shorter identifier suitable for URLs and logs (25 chars, base-36).

### Base64 Encoding
stringToBase64(str) → String | async:no
  UTF-8 string to standard base64 (`+`/`/` with `=` padding). Uses Buffer in Node, btoa+TextEncoder in browsers.

base64ToString(str) → String | async:no
  Standard base64 to UTF-8 string. Uses Buffer in Node, atob+TextDecoder in browsers.

### URL-Safe Base64
urlEncodeBase64(str) → String | async:no
  Standard base64 to URL-safe form. `+`→`-`, `/`→`_`, strips trailing `=`.

urlDecodeBase64(str) → String | async:no
  Inverse: re-pads then `_`→`/`, `-`→`+`. Returns input unchanged when empty.

## Patterns
- **Web Crypto first, polyfill fallback:** Uses `globalThis.crypto` when available; falls back to `Math.random` only when Web Crypto is missing entirely (the latter is NOT cryptographically secure)
- **Runtime-symmetric base64:** `Buffer.from` in Node; `btoa`/`atob` + `TextEncoder`/`TextDecoder` in browsers. Throws when neither is available (rare)
- **Uses Lib.Utils:** For input validation (`isEmpty`, `isFunction`)
- **Server-side sibling:** `@superloomdev/js-server-helper-crypto` shares the same names and signatures for the seven functions above and adds hashing, HMAC, encryption, and base conversion on top
