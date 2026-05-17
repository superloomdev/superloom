# API Reference. `js-server-helper-crypto`

Every exported function on the public interface, with parameters, return shape, and notes. For loader and configuration details see [Configuration](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-crypto/docs/configuration.md).

## On This Page

- [Conventions](#conventions)
- [Random and UUIDs](#random-and-uuids)
- [Hashing](#hashing)
- [AES Encryption](#aes-encryption)
- [Base Conversion](#base-conversion)
- [Base64 Encoding and Decoding](#base64-encoding-and-decoding)
- [URL-Safe Base64](#url-safe-base64)
- [Lifecycle](#lifecycle)

---

## Conventions

Every function in this module is **synchronous, side-effect-free, and built on Node's built-in `crypto` module**. There is no async function, no `instance` argument, no `success / data / error` envelope. Each function returns a string or a number.

| Pattern | Behaviour |
|---|---|
| **Cryptographic strength.** | Random and UUID functions use OS-level entropy via `crypto.randomBytes` and `crypto.randomUUID`. They are suitable for tokens, salts, IDs, and short-lived secrets |
| **Hex-encoded outputs.** | MD5, SHA256, and AES outputs are returned as lowercase hex strings. Convert via `urlEncodeBase64(stringToBase64(value))` if you need URL-safe transport |
| **Empty-input guard.** | `generateRandomString` returns `''` on null, undefined, empty, or non-positive `length`. Other functions return the runtime's natural error type (e.g. `parseInt` returns `NaN` for invalid input) |
| **AES key derivation.** | `aesEncrypt` and `aesDecrypt` derive the 128-bit key and 128-bit IV from the supplied `secret` via two MD5 passes (see the AES section below for the exact derivation). The pair is consistent across calls; the same `secret` reproduces the same key / IV |

> **Browser parity.** The seven functions in [Random and UUIDs](#random-and-uuids), [Base64 Encoding](#base64-encoding-and-decoding), and [URL-Safe Base64](#url-safe-base64) have identical names and signatures in `@superloomdev/js-client-helper-crypto`. The remaining functions (hashing, AES, base conversion, `generateTimeRandomString`, `bufferToBase64`) are server-only.

---

## Random and UUIDs

### `generateRandomString(charset, length)`

Returns a cryptographically secure random string of the requested length, drawn from the supplied character set. Uses `crypto.randomBytes` for entropy.

| Param | Type | Required | Description |
|---|---|---|---|
| `charset` | `string` | Yes | Superset of characters to draw from. May contain repeated characters; bias is proportional to repetition |
| `length` | `number` | Yes | Desired length of the output string. Must be positive |

| Returns | Description |
|---|---|
| `string` | Random string of the requested length, or `''` if either argument is empty / non-positive |

```javascript
Lib.Crypto.generateRandomString('0123456789abcdef', 16);
// '4d2a9f1e3c8b7a06'
```

### `generateTimeRandomString(time, min_length?, epoch_offset?)`

Returns a base-36 string consisting of a time prefix and (optionally) random padding. Useful for generating monotonically-sortable IDs that include a creation timestamp.

| Param | Type | Required | Description |
|---|---|---|---|
| `time` | `number` | Yes | Current unix time in seconds (typically `instance.time`) |
| `min_length` | `number` | No | If provided and the time prefix is shorter, the result is padded to this length with random base-36 characters |
| `epoch_offset` | `number` | No | If provided, `time` is offset by this value before encoding. Useful when you want shorter prefixes by counting from a recent epoch |

```javascript
Lib.Crypto.generateTimeRandomString(1763341500, 12, 1700000000);
// '15tk96o' + 5 random chars (truncated example)
```

### `generateUUID()`

Returns a standard RFC 4122 UUID v4 via `crypto.randomUUID()`.

| Returns | Description |
|---|---|
| `string` | A 36-character UUID v4 with hyphens, e.g. `'58f1d3b8-2a47-4ed3-8c0c-9f8b2c5d4e7a'` |

### `generateCompactUUID()`

Returns a 25-character base-36 identifier. Internally generates a UUID v4, strips the hyphens, and converts the resulting hex value to base 36. Padded to 25 characters so all outputs sort consistently.

| Returns | Description |
|---|---|
| `string` | A 25-character base-36 string |

> **Use case.** Compact UUIDs are useful in URLs and logs where the standard 36-character form is visually noisy. The character set is `0-9a-z`, so the result is URL-safe without further encoding.

---

## Hashing

### `md5String(str)`

| Param | Type | Description |
|---|---|---|
| `str` | `string` | The input to hash |

| Returns | Description |
|---|---|
| `string` | 32-character lowercase hex MD5 |

> **MD5 is cryptographically broken.** Use `md5String` only for non-security purposes such as cache keys, content checksums, and legacy-protocol compatibility. **Never** use it for password hashing, authentication tokens, or anything where collision resistance matters. Use `sha256String` with a secret for those cases.

### `sha256String(str, secret?)`

HMAC-SHA256. When `secret` is omitted, an empty-string key is used (so the result is a plain SHA256 of the input).

| Param | Type | Required | Description |
|---|---|---|---|
| `str` | `string` | Yes | The input to hash |
| `secret` | `string` | No | HMAC secret. Defaults to `''` |

| Returns | Description |
|---|---|
| `string` | 64-character lowercase hex |

```javascript
Lib.Crypto.sha256String('hello world', 'shared-secret');
// '734cc62f32841568f45ea0aa1cf48e791d68a8d5f3...'
```

---

## AES Encryption

`aesEncrypt` and `aesDecrypt` use AES-128-CBC. Both derive the 16-byte key and 16-byte initialisation vector from the supplied `secret`:

- **Key:** First 16 bytes of `MD5(secret)`.
- **IV:** `MD5(key || secret)`, where `||` is byte concatenation.

The derivation is deterministic, so the same `secret` produces the same key and IV every time. Ciphertexts are returned as lowercase hex.

> **About the key derivation.** This scheme is a fixed, intentionally-stable contract used by the legacy code paths that this module replaces. It does not include a per-message salt; the same `(secret, plaintext)` pair always produces the same ciphertext. For new applications that need authenticated encryption with random IVs, use Node's `crypto` module directly with `aes-256-gcm` instead.

### `aesEncrypt(str, secret)`

| Param | Type | Description |
|---|---|---|
| `str` | `string` | UTF-8 plaintext |
| `secret` | `string` | Secret used to derive the key and IV |

| Returns | Description |
|---|---|
| `string` | Hex-encoded ciphertext |

### `aesDecrypt(str, secret)`

Inverse of `aesEncrypt`. Re-derives the same key and IV from the secret, decrypts, and returns UTF-8.

| Returns | Description |
|---|---|
| `string` | Decrypted UTF-8 plaintext |

---

## Base Conversion

Two helpers for moving integers between base-10 and base-36. Useful for compacting numeric IDs in URLs and external identifiers.

### `intToBase36(num)`

| Param | Type | Description |
|---|---|---|
| `num` | `number` | Non-negative integer |

| Returns | Description |
|---|---|
| `string` | Base-36 representation. `123 -> '3f'` |

### `base36ToInt(str)`

| Param | Type | Description |
|---|---|---|
| `str` | `string` | Base-36 string |

| Returns | Description |
|---|---|
| `number` | The decoded integer. Returns `NaN` for unparseable input |

---

## Base64 Encoding and Decoding

The base64 helpers use Node's `Buffer` for both encoding and decoding. UTF-8 is preserved end to end.

### `stringToBase64(str)`

UTF-8 encode → standard base64.

| Param | Type | Description |
|---|---|---|
| `str` | `string` | Any UTF-8 string |

| Returns | Description |
|---|---|
| `string` | Standard base64 (with `+` / `/` and `=` padding) |

### `base64ToString(str)`

Inverse of `stringToBase64`. Standard base64 → UTF-8 string.

### `bufferToBase64(buffer)`

Convenience for the common server-side case of encoding a `Buffer` directly without an intermediate string round-trip.

| Param | Type | Description |
|---|---|---|
| `buffer` | `Buffer` | A Node `Buffer` of arbitrary bytes |

| Returns | Description |
|---|---|
| `string` | Standard base64 |

---

## URL-Safe Base64

The two helpers below convert between standard base64 and the URL-safe variant defined in RFC 4648. They operate purely on string characters; no UTF-8 decoding is involved.

### `urlEncodeBase64(str)`

Standard base64 → URL-safe base64.

| Transform | Effect |
|---|---|
| `+` → `-` | Avoids URL-reserved character |
| `/` → `_` | Avoids URL-reserved character |
| trailing `=` removed | Avoids URL-reserved character; padding is reconstructible |

### `urlDecodeBase64(str)`

URL-safe base64 → standard base64. Re-applies the missing padding before reversing the character substitutions, so the output is suitable as input to `base64ToString`.

| Returns | Description |
|---|---|
| `string` | Standard base64; `''` is returned unchanged |

```javascript
const token = Lib.Crypto.urlEncodeBase64(Lib.Crypto.stringToBase64('hello+world/'));
// 'aGVsbG8rd29ybGQv'
const round_trip = Lib.Crypto.base64ToString(Lib.Crypto.urlDecodeBase64(token));
// 'hello+world/'
```

---

## Lifecycle

There is nothing to clean up. The module exposes only synchronous functions that operate on their arguments and return a value. Each loader call captures `Lib` and `CONFIG` in a closure; after that, no module-level state changes for the lifetime of the process. The Node `crypto` module itself is loaded once at module initialisation and shared across all interface instances.

For module-level setup details (loader signature, configuration keys, peer-dep notes) see [Configuration → Loader Pattern](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-crypto/docs/configuration.md#loader-pattern).
