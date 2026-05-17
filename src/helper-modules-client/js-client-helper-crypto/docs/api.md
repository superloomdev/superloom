# API Reference. `js-client-helper-crypto`

Every exported function on the public interface, with parameters, return shape, and notes. For loader and dependency notes see [Configuration](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-client/js-client-helper-crypto/docs/configuration.md).

## On This Page

- [Conventions](#conventions)
- [Random and UUIDs](#random-and-uuids)
- [Base64 Encoding and Decoding](#base64-encoding-and-decoding)
- [URL-Safe Base64](#url-safe-base64)
- [Lifecycle](#lifecycle)

---

## Conventions

Every function in this module is **synchronous, side-effect-free, and runtime-agnostic**. There is no async function, no `instance` argument, no `success / data / error` envelope. Each function returns a string.

| Pattern | Behaviour |
|---|---|
| **Web Crypto first.** | When the runtime exposes `globalThis.crypto`, it is used for entropy and (where available) for `randomUUID`. The fallback path is reached only on older targets that lack Web Crypto |
| **Empty-input guard.** | `generateRandomString` returns `''` on null, undefined, empty, or non-positive `length`. The base64 helpers return their input unchanged on empty values where the operation is a no-op |
| **No throwing on bad input.** | Most functions return a sentinel value (`''` or the input unchanged) rather than throwing. The exception is base64 encoding when neither `Buffer` nor `btoa` is available; that throws because there is no safe fallback |

---

## Random and UUIDs

### `generateRandomString(charset, length)`

Returns a random string of the requested length, drawn from the supplied character set. Uses Web Crypto for entropy where available; falls back to `Math.random` only when Web Crypto is missing entirely.

| Param | Type | Required | Description |
|---|---|---|---|
| `charset` | `string` | Yes | Superset of characters to draw from. May contain repeated characters; bias is proportional to repetition |
| `length` | `number` | Yes | Desired length of the output string. Must be positive |

| Returns | Description |
|---|---|
| `string` | Random string of the requested length, or `''` if either argument is empty / non-positive |

```javascript
Lib.Crypto.generateRandomString('0123456789abcdef', 16);
// '7f3a8c12e9b0d4f6'
```

> **Cryptographic strength caveat.** When Web Crypto is available, the entropy is suitable for tokens, salts, and short-lived secrets. On runtimes without Web Crypto, the fallback uses `Math.random` and is **not** cryptographically secure. Test for `globalThis.crypto` if your use case demands the secure path.

### `generateUUID()`

Returns a standard RFC 4122 UUID v4. Delegates to `crypto.randomUUID()` when the runtime exposes it; falls back to a polyfill that fills 16 random bytes and sets the version + variant nibbles.

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

## Base64 Encoding and Decoding

The two base64 helpers transparently use `Buffer.from(...)` when running under Node and the browser pair `btoa` / `atob` (with `TextEncoder` / `TextDecoder`) elsewhere. UTF-8 is preserved end to end.

### `stringToBase64(str)`

UTF-8 encode → base64.

| Param | Type | Description |
|---|---|---|
| `str` | `string` | Any UTF-8 string |

| Returns | Description |
|---|---|
| `string` | Standard base64 (with `+` / `/` and `=` padding) |

### `base64ToString(str)`

Inverse of `stringToBase64`. Standard base64 → UTF-8 string.

| Param | Type | Description |
|---|---|---|
| `str` | `string` | Standard base64 input |

| Returns | Description |
|---|---|
| `string` | The decoded UTF-8 string |

> **Throws when no encoder is available.** If the runtime exposes neither `Buffer` nor `btoa` / `atob`, both functions throw `Error('Base64 [encode\|decode] is not supported in this environment')`. Every modern runtime exposes at least one path; this is a guard, not a common case.

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

There is nothing to clean up. The module exposes only synchronous functions that operate on their arguments and return a value. Each loader call captures `Lib` and `CONFIG` in a closure; after that, no module-level state changes for the lifetime of the process.

For module-level setup details (loader signature, peer-dep notes, the single configuration key) see [Configuration → Loader Pattern](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-client/js-client-helper-crypto/docs/configuration.md#loader-pattern).
