# @superloomdev/js-client-helper-crypto

[![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-brightgreen.svg)](https://nodejs.org)

Client-side crypto utility library. UUID generation, random strings, and base64 helpers optimized for browser environments. Uses Web Crypto API with polyfill fallback. Part of the [Superloom](https://github.com/superloomdev/superloom).

## Installation

```bash
npm install @superloomdev/js-client-helper-crypto
```

## Exported Functions

| Function | Params | Return | Description |
|---|---|---|---|
| `generateRandomString` | `(charset, length)` | `String` | Random string (Web Crypto, fallback: `Math.random`) |
| `generateUUID` | `()` | `String` | UUIDv4 (`crypto.randomUUID()` or polyfill) |
| `generateCompactUUID` | `()` | `String` | Compact UUID (25 char base36) |
| `stringToBase64` | `(str)` | `String` | UTF-8 string → base64 |
| `base64ToString` | `(str)` | `String` | Base64 → UTF-8 string |
| `urlEncodeBase64` | `(str)` | `String` | Standard → URL-safe base64 |
| `urlDecodeBase64` | `(str)` | `String` | URL-safe → standard base64 |

## Usage

```javascript
// In loader (Lib must contain Utils)
Lib.Crypto = require('@superloomdev/js-client-helper-crypto')(Lib, { /* config overrides */ });

Lib.Crypto.generateUUID();              // 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
Lib.Crypto.generateCompactUUID();       // '1a2b3c4d5e6f7g8h9i0j1k2l3'
Lib.Crypto.generateRandomString('abc123', 12);
Lib.Crypto.stringToBase64('Hello');     // 'SGVsbG8='
```

## Notes

- Uses Web Crypto API (`globalThis.crypto`) when available
- Falls back to `Math.random` only when Web Crypto is unavailable
- For server-side hashing and encryption, use `@superloomdev/js-server-helper-crypto`

## Testing

| Tier | Runtime | Status |
|---|---|---|
| **Unit Tests** | Node.js `node --test` | [![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml) |

Run locally:

```bash
cd _test
npm install && npm test
```

See [Module Testing](https://github.com/superloomdev/superloom/blob/main/docs/architecture/module-testing.md) for the full testing architecture.

## License

MIT
