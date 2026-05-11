# @superloomdev/js-server-helper-crypto

[![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-brightgreen.svg)](https://nodejs.org)

Server-side cryptography utility library. Hashing, encryption, UUID generation, random strings, and base conversion using Node.js `crypto`. Self-contained - no external dependencies. Part of the [Superloom](https://github.com/superloomdev/superloom).

## Installation

```bash
npm install @superloomdev/js-server-helper-crypto
```

## Exported Functions

| Function | Params | Return | Description |
|---|---|---|---|
| `generateRandomString` | `(charset, length)` | `String` | Cryptographically secure random string |
| `generateTimeRandomString` | `(time, min_length?, epoch_offset?)` | `String` | Time-prefixed base36 random ID |
| `generateUUID` | `()` | `String` | UUIDv4 (36 char hex) |
| `generateCompactUUID` | `()` | `String` | Compact UUID (25 char base36) |
| `md5String` | `(str)` | `String` | MD5 hash (32 char hex) |
| `sha256String` | `(str, secret?)` | `String` | HMAC-SHA256 (64 char hex) |
| `aesEncrypt` | `(str, secret)` | `String` | AES-128-CBC encrypt → hex |
| `aesDecrypt` | `(str, secret)` | `String` | AES-128-CBC decrypt → utf8 |
| `intToBase36` | `(num)` | `String` | Integer → base36 |
| `base36ToInt` | `(str)` | `Integer` | Base36 → integer |
| `stringToBase64` | `(str)` | `String` | String → base64 |
| `base64ToString` | `(str)` | `String` | Base64 → UTF-8 string |
| `bufferToBase64` | `(buf)` | `String` | Buffer → base64 |
| `urlEncodeBase64` | `(str)` | `String` | Standard → URL-safe base64 |
| `urlDecodeBase64` | `(str)` | `String` | URL-safe → standard base64 |

## Usage

```javascript
// In loader (Lib must contain Utils)
Lib.Crypto = require('@superloomdev/js-server-helper-crypto')(Lib, { /* config overrides */ });

// UUID
Lib.Crypto.generateUUID();          // 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
Lib.Crypto.generateCompactUUID();   // '1a2b3c4d5e6f7g8h9i0j1k2l3' (25 chars)

// Hashing
Lib.Crypto.md5String('hello');            // '5d41402abc4b2a76b9719d911017c592'
Lib.Crypto.sha256String('data', 'key');   // 64-char hex

// Encryption
const encrypted = Lib.Crypto.aesEncrypt('secret data', 'my-key');
const decrypted = Lib.Crypto.aesDecrypt(encrypted, 'my-key'); // 'secret data'

// Base conversion
Lib.Crypto.intToBase36(1600000000);  // 'qi0dts'
Lib.Crypto.base36ToInt('qi0dts');    // 1600000000
```

## Notes

- Uses Node.js built-in `crypto` module - no npm dependencies
- For client-side UUID and base64 helpers, use `@superloomdev/js-client-helper-crypto`

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
