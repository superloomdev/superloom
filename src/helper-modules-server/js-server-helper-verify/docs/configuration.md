# Configuration. `js-server-helper-verify`

Loader pattern, every configuration key, the per-backend `STORE_CONFIG` shape, peer dependencies, and the testing tier. For the function reference see [API Reference](api.md). For backend selection criteria see the [Storage Adapters](../README.md#storage-adapters) section in the module README.

## On This Page

- [Loader Pattern](#loader-pattern)
- [Configuration Keys](#configuration-keys)
- [`STORE_CONFIG` by Backend](#store_config-by-backend)
- [Charset Overrides](#charset-overrides)
- [Peer Dependencies](#peer-dependencies)
- [Testing Tier](#testing-tier)

---

## Loader Pattern

Every Superloom server-side module is a factory function that takes the `Lib` container and a `CONFIG` object and returns the public interface. The verify module follows that shape exactly.

```js
Lib.Verify = require('@superloomdev/js-server-helper-verify')(Lib, {
  STORE:        require('@superloomdev/js-server-helper-verify-store-postgres'),
  STORE_CONFIG: { table_name: 'verification_codes', lib_sql: Lib.Postgres }
});
```

**`STORE` is a factory function, not a string.** Pass the result of `require()` for the chosen adapter package, the same way you pass `Lib.Postgres` or `Lib.MongoDB`. The verify module calls the factory internally with `(Lib, CONFIG, ERRORS)` and binds the returned store to the instance.

The factory validates `CONFIG` at construction time. Misconfiguration fails at boot with a thrown `Error`, never at runtime.

---

## Configuration Keys

| Key | Type | Default | Required | Notes |
|---|---|---|---|---|
| `STORE` | `function` | `null` | Yes | Store factory function. Pass `require('@superloomdev/js-server-helper-verify-store-<backend>')`. Loader throws on string, object, or missing |
| `STORE_CONFIG` | `object` | `null` | Yes | Per-adapter configuration. Shape varies by adapter; see [below](#store_config-by-backend) |
| `PIN_CHARSET` | `string` | `'0123456789'` | No | Charset used by `createPin`. Override only if you need a non-numeric "pin" |
| `CODE_CHARSET` | `string` | Crockford Base32 (`'0123456789ABCDEFGHJKMNPQRSTVWXYZ'`) | No | Charset used by `createCode`. The default deliberately omits `I`, `L`, `O`, `U` to avoid visual confusion |
| `TOKEN_CHARSET` | `string` | `a-zA-Z0-9` (62 chars) | No | Charset used by `createToken`. The default is URL-safe without escaping |

---

## `STORE_CONFIG` by Backend

The exact key set lives in each adapter package's own README. The shape generally looks like one of:

| Adapter family | Typical `STORE_CONFIG` |
|---|---|
| SQL (sqlite, postgres, mysql) | `{ table_name: 'verification_codes', lib_sql: Lib.<Driver> }` |
| MongoDB | `{ collection_name: 'verification_codes', lib_mongodb: Lib.MongoDB }` |
| DynamoDB | `{ table_name: 'verification_codes', lib_dynamodb: Lib.DynamoDB }` |

The verify module does not validate the *contents* of `STORE_CONFIG`. Each adapter's factory validates its own required keys and throws at construction time on anything missing or malformed.

---

## Charset Overrides

The three default charsets are chosen for human ergonomics. Override them only when the use case requires it.

| Charset | Default rationale | When to override |
|---|---|---|
| `PIN_CHARSET` | `0-9`. Smallest entropy per character, easiest to enter on a numeric phone keypad. Pairs naturally with SMS OTP delivery | Almost never. Override only if your delivery channel cannot represent digits |
| `CODE_CHARSET` | Crockford Base32 (`0-9 A-Z` minus `I L O U`). Designed for spoken or printed delivery; omits visually ambiguous glyphs | If your audience needs lowercase letters (e.g. some IVR systems) or full alphanumeric entropy |
| `TOKEN_CHARSET` | `a-zA-Z0-9` (62 chars). Highest entropy per character; safe in URL query strings without percent-encoding | If your transport layer is strict about URL-safe characters and you want to add `-`/`_` (URL-safe base64); never include characters that require encoding |

Custom charsets are passed verbatim to `Lib.Crypto.generateRandomString(charset, length)`. The verify module does not deduplicate or sort the characters; if your charset has duplicates, those characters will be over-represented in the generated code.

---

## Peer Dependencies

Loaded through the standard Superloom loader. The verify module reads only from the shared `Lib` container; nothing is `require`d directly inside the module.

| `Lib.*` | Source package | Used for |
|---|---|---|
| `Lib.Utils` | `@superloomdev/js-helper-utils` | Type checks, validation helpers |
| `Lib.Debug` | `@superloomdev/js-helper-debug` | `performanceAuditLog` per store call; diagnostics for the post-verify background delete |
| `Lib.Crypto` | `@superloomdev/js-server-helper-crypto` | `generateRandomString(charset, length)` for code generation |
| `Lib.Instance` | `@superloomdev/js-server-helper-instance` | `backgroundRoutine` for the post-verify record deletion |

The storage adapter (`CONFIG.STORE`) consumes its own driver helper (`Lib.SQLite`, `Lib.Postgres`, `Lib.MySQL`, `Lib.MongoDB`, or `Lib.DynamoDB`) through `CONFIG.STORE_CONFIG`. The verify module never imports a database driver helper directly.

---

## Testing Tier

| Tier | Runtime | Backend |
|---|---|---|
| Unit | Node.js `node --test` | In-process memory store (`_test/memory-store.js`) implementing the full 6-method store contract |

The verify module's own tests use an in-process memory store implementing the same 6-method contract every real adapter satisfies. There is no Docker dependency in this package and no database driver is required.

Integration tests for each storage backend live in the corresponding adapter package (`@superloomdev/js-server-helper-verify-store-*`) and run the shared store-contract suite against real backends. Each adapter ships its own `_test/store-contract-suite.js` as a self-contained local copy of that suite.
