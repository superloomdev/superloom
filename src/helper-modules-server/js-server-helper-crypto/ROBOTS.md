# js-server-helper-crypto - AI Agent Reference

## Module Type
Server module. Node.js-specific cryptography helpers using the built-in `crypto` module.

## Peer Dependencies
- `@superloomdev/js-helper-utils` (injected as `Lib.Utils`)

## Direct Dependencies
- `crypto` (Node.js built-in)

## Loader Pattern (Factory)

```javascript
Lib.Crypto = require('@superloomdev/js-server-helper-crypto')(Lib, { /* config overrides */ });
```

Each loader call returns an independent Crypto interface with its own `Lib` and `CONFIG`. Stateless - no per-instance resources. The shared Node.js `crypto` module is cached at module level.

## Config Keys
| Key | Type | Default | Description |
|---|---|---|---|
| BASE36_CHARSET | String | `'0123456789abcdefghijklmnopqrstuvwxyz'` | Alphabet for base-36 conversion |
| HEX_CHARSET | String | `'0123456789abcdef'` | Alphabet for hex |
| INT_CHARSET | String | `'0123456789'` | Alphabet for integer strings |

## Exported Functions

### Random & UUIDs
generateRandomString(charset, length) → String | async:no - cryptographically secure random from charset
generateTimeRandomString(time, min_length, epoch_offset) → String | async:no - time-prefixed base36 random
generateUUID() → String | async:no - standard UUID v4
generateCompactUUID() → String | async:no - UUID in base36 (25 chars)

### Hashing
md5String(str) → String | async:no - 32-char hex MD5 (use only for checksums, NOT security)
sha256String(str, secret?) → String | async:no - 64-char hex HMAC-SHA256

### AES Encryption (AES-128-CBC)
aesEncrypt(str, secret) → String | async:no - returns hex ciphertext
aesDecrypt(str, secret) → String | async:no - returns plaintext from hex

### Base Conversion
intToBase36(num) → String | async:no
base36ToInt(str) → Number | async:no

### Base64
stringToBase64(str) → String | async:no
base64ToString(str) → String | async:no
bufferToBase64(obj) → String | async:no
urlEncodeBase64(str) → String | async:no - URL-safe variant (+/= → -_)
urlDecodeBase64(str) → String | async:no

## Patterns
- **Server-only:** Uses Node.js `crypto` module. For browser/client use `@superloomdev/js-client-helper-crypto` instead
- **AES key derivation:** Uses MD5 of secret for key, MD5 of key+secret for IV - consistent with legacy encryption contracts
- **MD5 warning:** MD5 is cryptographically broken. Only use `md5String` for checksums/legacy compatibility, never for passwords or security
- **HMAC-SHA256:** Use `sha256String(str, secret)` for secure hashing with a secret
- **Uses Lib.Utils:** For input validation (e.g., `Lib.Utils.isEmpty`, `Lib.Utils.isNullOrUndefined`)
