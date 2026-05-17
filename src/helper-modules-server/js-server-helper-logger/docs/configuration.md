# Configuration. `js-server-helper-logger`

Loader pattern, every configuration key, the per-backend `STORE_CONFIG` shape, peer dependencies, and the testing tier. For the function reference see [API Reference](api.md). For backend selection criteria see the [Storage Adapters](../README.md#storage-adapters) section in the module README.

## On This Page

- [Loader Pattern](#loader-pattern)
- [Configuration Keys](#configuration-keys)
- [`STORE_CONFIG` by Backend](#store_config-by-backend)
- [IP Encryption](#ip-encryption)
- [Peer Dependencies](#peer-dependencies)
- [Testing Tier](#testing-tier)

---

## Loader Pattern

Every Superloom server-side module is a factory function that takes the `Lib` container and a `CONFIG` object and returns the public interface. The logger module follows that shape exactly.

```js
Lib.Logger = require('@superloomdev/js-server-helper-logger')(Lib, {
  STORE:        require('@superloomdev/js-server-helper-logger-store-postgres'),
  STORE_CONFIG: { table_name: 'action_log', lib_sql: Lib.Postgres },
  IP_ENCRYPT_KEY: process.env.IP_ENCRYPT_KEY    // optional
});
```

**`STORE` is a factory function, not a string.** Pass the result of `require()` for the chosen adapter package, the same way you pass `Lib.Postgres` or `Lib.MongoDB`. The logger calls the factory internally with `(Lib, CONFIG, ERRORS)` and binds the returned store to the instance.

The factory validates `CONFIG` at construction time. Misconfiguration fails at boot with a thrown `Error`, never at runtime.

---

## Configuration Keys

| Key | Type | Default | Required | Notes |
|---|---|---|---|---|
| `STORE` | `function` | `null` | Yes | Store factory function. Pass `require('@superloomdev/js-server-helper-logger-store-<backend>')`. Must be a function; loader throws on string, object, or missing |
| `STORE_CONFIG` | `object` | `null` | Yes | Per-adapter configuration. Shape varies by adapter; see [below](#store_config-by-backend) |
| `IP_ENCRYPT_KEY` | `string` | `null` | No | When set, every non-empty `ip` is AES-encrypted at rest via `Lib.Crypto.aesEncrypt`. Reads transparently decrypt via `Lib.Crypto.aesDecrypt`. Empty string throws; pass `null` (or omit) to store plaintext |

---

## `STORE_CONFIG` by Backend

The exact key set lives in each adapter package's own README. The shape generally looks like one of:

| Adapter family | Typical `STORE_CONFIG` |
|---|---|
| SQL (sqlite, postgres, mysql) | `{ table_name: 'action_log', lib_sql: Lib.<Driver> }` |
| MongoDB | `{ collection_name: 'action_log', lib_mongodb: Lib.MongoDB }` |
| DynamoDB | `{ table_name: 'action_log', lib_dynamodb: Lib.DynamoDB }` |

The logger module does not validate the *contents* of `STORE_CONFIG`. Each adapter's factory validates its own required keys and throws at construction time on anything missing or malformed.

---

## IP Encryption

Setting `IP_ENCRYPT_KEY` is the difference between an audit log that survives a database dump and one that leaks plaintext IPs to anyone with read access to the table.

**Key shape.** A 256-bit hex string (64 hex characters) is recommended. The exact requirements come from `Lib.Crypto.aesEncrypt`; see the `js-server-helper-crypto` module's documentation.

**Key handling.**

- Store the key in your secret manager (AWS Secrets Manager, GCP Secret Manager, sealed Kubernetes secret).
- **Never** commit the key to source.
- Inject it as an environment variable at process start.

**Key rotation.** The logger has no built-in rotation; the deployer manages it. The pattern is:

1. Deploy a reader that knows both the old and the new key.
2. Migrate writes to the new key.
3. Wait until the cutover window passes (no rows written under the old key are still in the active retention window).
4. Retire the old key.

A decrypt failure (wrong key, key rotation in flight) returns the ciphertext rather than throwing. Audit reviewers see the opaque blob and can investigate; the request path keeps working.

**When to leave the key unset.** Fraud-detection and geo-IP pipelines need plaintext IPs. If transport-level controls (DB encryption at rest, IAM-scoped access) are sufficient for your compliance posture, omit the key and store plaintext.

---

## Peer Dependencies

Loaded through the standard Superloom loader. The logger reads only from the shared `Lib` container; nothing is `require`d directly inside the module.

| `Lib.*` | Source package | Used for |
|---|---|---|
| `Lib.Utils` | `@superloomdev/js-helper-utils` | Type checks, validation helpers |
| `Lib.Debug` | `@superloomdev/js-helper-debug` | `performanceAuditLog` per store call; `debug` for adapter-failure diagnostics on background writes |
| `Lib.Crypto` | `@superloomdev/js-server-helper-crypto` | `generateRandomString` (sort-key randomisation), `aesEncrypt` / `aesDecrypt` (IP encryption) |
| `Lib.Instance` | `@superloomdev/js-server-helper-instance` | `backgroundRoutine` for non-blocking `log()` writes |
| `Lib.HttpHandler` *(optional)* | `@superloomdev/js-server-helper-http` | `getHttpRequestIPAddress`, `getHttpRequestUserAgent` for auto-capture from `instance.http_request` |

The storage adapter (`CONFIG.STORE`) consumes its own driver helper through `CONFIG.STORE_CONFIG`. The logger module never imports `Lib.Postgres`, `Lib.MongoDB`, or any other backend-specific helper directly.

---

## Testing Tier

| Tier | Runtime | Backend |
|---|---|---|
| Unit | Node.js `node --test` | In-process memory store (`_test/memory-store.js`) implementing the full 5-method store contract |

The logger module's own tests use an in-process memory store implementing the same 5-method contract every real adapter satisfies. There is no Docker dependency in this package and no database driver is required.

Integration tests for each storage backend live in the corresponding adapter package (`@superloomdev/js-server-helper-logger-store-*`) and run the shared store-contract suite against real backends.
