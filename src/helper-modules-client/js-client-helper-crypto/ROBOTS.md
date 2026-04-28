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
  Random string from given charset, using Web Crypto for entropy.

generateUUID() → String | async:no
  Standard UUID v4 via `crypto.randomUUID()`.

generateCompactUUID() → String | async:no
  Shorter identifier suitable for URLs and logs (non-hyphenated, base-36).

### Low-level Web Crypto Access
webCrypto() → SubtleCrypto | async:no
  Returns the runtime Web Crypto reference (`globalThis.crypto`).

getRandomValues(length) → Uint8Array | async:no
  Fill a typed array with cryptographically-strong random bytes.

## Patterns
- **Browser-safe:** Uses Web Crypto API, works in browsers, React Native, Node.js 19+
- **No Node.js-specific APIs:** Avoids `crypto` module, `Buffer` (except via Uint8Array)
- **Uses Lib.Utils:** For input validation (e.g., `Lib.Utils.isString`, `Lib.Utils.isNumber`)
- **Server equivalent:** For server-side hashing, encryption, base conversion - use `@superloomdev/js-server-helper-crypto` instead
