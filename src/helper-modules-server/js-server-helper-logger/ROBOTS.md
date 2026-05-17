# ROBOTS.md. `js-server-helper-logger`

Compact, AI-targeted reference for the public interface. Humans should read `README.md` and `docs/`.

## Module Overview

Compliance-friendly action log. One immutable row per log-worthy event recording `actor_type` / `actor_id`, `entity_type` / `entity_id`, dot-notation `action`, structured per-action `data`, optional `ip` / `user_agent`. Storage backends are standalone Class F adapter packages (`@superloomdev/js-server-helper-logger-store-*`); the caller passes the adapter factory directly as `CONFIG.STORE`. Background-by-default writes via `Lib.Instance.backgroundRoutine`; per-row retention (`'persistent'` or `{ ttl_seconds: N }`); optional AES IP encryption at rest.

## Factory Pattern

```js
module.exports = function loader (shared_libs, config) {
  // Returns independent instance with isolated Lib + CONFIG.
  // Validates CONFIG at construction (STORE must be a function; STORE_CONFIG must be an object).
  // Throws synchronously on misconfiguration.
  return { log, listByEntity, listByActor, cleanupExpiredLogs, setupNewStore };
};
```

`CONFIG.STORE` is a **factory function**, not a string. The loader calls it as `CONFIG.STORE(Lib, CONFIG, ERRORS)` and binds the returned store object to the instance. Passing a string throws `CONFIG.STORE must be a store factory function`.

```js
Lib.Logger = require('@superloomdev/js-server-helper-logger')(Lib, {
  STORE:        require('@superloomdev/js-server-helper-logger-store-postgres'),
  STORE_CONFIG: { table_name: 'action_log', lib_sql: Lib.Postgres },
  IP_ENCRYPT_KEY: process.env.IP_ENCRYPT_KEY    // optional
});
```

## Public Functions

### `log(instance, options)` *(async)*

Records one event. Background by default; `options.await: true` for durable compliance writes.

- **options.scope**: String, optional, default `''`. Multi-tenant namespace.
- **options.entity_type**: String, required.
- **options.entity_id**: String, required.
- **options.actor_type**: String, required.
- **options.actor_id**: String, required.
- **options.action**: String, required. Dot-notation event name.
- **options.data**: Object \| null, optional. Free-form JSON payload.
- **options.ip**: String, optional. Auto-captured from `instance.http_request` when `Lib.HttpHandler` is in the `Lib` container.
- **options.user_agent**: String, optional. Same auto-capture.
- **options.retention**: `'persistent'` \| `{ ttl_seconds: positive_integer }`, required.
- **options.await**: Boolean, optional, default `false`. If `true`, awaits the store write and surfaces failures.
- **Returns**: `{ success, error }`. `error.type` is `LOGGER_SERVICE_UNAVAILABLE` on adapter failure (only when `await: true`).

Programmer errors (missing required option, wrong type, invalid `retention`) throw `TypeError` synchronously and never appear in the envelope.

### `listByEntity(instance, options)` *(async)*

Lists events recorded against one entity, most-recent first.

- **options.scope**, **options.entity_type**, **options.entity_id**: required.
- **options.actions**: String[], optional. Literal action names or `'auth.*'`-style glob prefixes.
- **options.start_time_ms**: Integer, optional. Inclusive lower bound on `created_at_ms`.
- **options.end_time_ms**: Integer, optional. Exclusive upper bound on `created_at_ms`.
- **options.cursor**: String, optional. Resume token from the previous page's `next_cursor`.
- **options.limit**: Integer, optional, default 50.
- **Returns**: `{ success, records, next_cursor, error }`. `next_cursor` is `null` on the final page.

### `listByActor(instance, options)` *(async)*

Same shape as `listByEntity`. `actor_type` and `actor_id` replace the entity pair.

### `cleanupExpiredLogs(instance)` *(async)*

Bulk-deletes rows whose `expires_at` is in the past. Persistent rows (`expires_at = null`) are never touched.

- **Returns**: `{ success, deleted_count, error }`.

### `setupNewStore(instance)` *(async)*

Idempotent backend setup. Behaviour varies by adapter: SQL creates table + indexes; the memory adapter is a no-op; NoSQL adapters may provision indexes or rely on out-of-band IaC.

- **Returns**: `{ success, error }`.

## Configuration

| Key | Type | Required | Notes |
|---|---|---|---|
| `STORE` | function | Yes | Store factory function. `require('@superloomdev/js-server-helper-logger-store-<backend>')` |
| `STORE_CONFIG` | object | Yes | Per-adapter config. Shape lives in each adapter's README |
| `IP_ENCRYPT_KEY` | string \| null | No | When set, AES-encrypts `ip` at rest via `Lib.Crypto.aesEncrypt` |

## Error Catalog

| `error.type` | Trigger | Surfaces in |
|---|---|---|
| `LOGGER_SERVICE_UNAVAILABLE` | Adapter returned `{ success: false }` | `log(..., { await: true })`, `listByEntity`, `listByActor`, `cleanupExpiredLogs` |

Error shape is frozen at module load: `{ type: 'LOGGER_SERVICE_UNAVAILABLE', message: 'Logger service temporarily unavailable' }`.

## Lifecycle (log flow)

1. Validate options (throws `TypeError` on programmer error).
2. Build the canonical record:
   - `created_at` and `created_at_ms` from `instance.time` / `instance.time_ms`.
   - `sort_key = "${created_at_ms}-${rand3}"` (3 lowercase-alpha chars).
   - `expires_at = (retention === 'persistent') ? null : created_at + ttl_seconds`.
   - Auto-capture `ip` / `user_agent` from `instance.http_request` when `Lib.HttpHandler` is in `Lib` and the option was not provided.
   - AES-encrypt `ip` under `CONFIG.IP_ENCRYPT_KEY` if configured.
3. If `options.await === true`: `await store.addLog(...)`. Map adapter failure to `LOGGER_SERVICE_UNAVAILABLE`.
4. Otherwise: register `Lib.Instance.backgroundRoutine(instance, () => store.addLog(...))`. Return `{ success: true }` immediately. Adapter failures during background writes are logged via `Lib.Debug.debug` and never surface to the caller.

## Critical Behaviour for Code-Generating Tools

- **`instance` is always the first argument.** Every function reads `instance.time` and routes timing through `Lib.Debug.performanceAuditLog`.
- **`STORE` is a factory function, not a string.** The loader throws on string or missing.
- **Background writes never surface store errors.** Use `await: true` for compliance writes that must be durable before responding.
- **Programmer errors throw, operational errors return.** Type errors and missing required options throw `TypeError`; store failures return `{ success: false, error }`.
- **One Logger instance per backend.** The factory binds one adapter at construction time; instances are independent.
- **Sort-key collisions are statistically impossible.** Millisecond timestamp + 3 random alpha characters per row. The `sort_key` doubles as `_id` in MongoDB and the range key in DynamoDB, making `addLog` idempotent on duplicate delivery.

## Peer Dependencies

| `Lib.*` | Source | Used for |
|---|---|---|
| `Lib.Utils` | `@superloomdev/js-helper-utils` | Type checks |
| `Lib.Debug` | `@superloomdev/js-helper-debug` | `performanceAuditLog`, `debug` for background-write diagnostics |
| `Lib.Crypto` | `@superloomdev/js-server-helper-crypto` | `generateRandomString` (sort-key randomisation), `aesEncrypt` / `aesDecrypt` (IP encryption) |
| `Lib.Instance` | `@superloomdev/js-server-helper-instance` | `backgroundRoutine` for non-blocking `log()` writes |
| `Lib.HttpHandler` *(optional)* | `@superloomdev/js-server-helper-http` | `getHttpRequestIPAddress`, `getHttpRequestUserAgent` for auto-capture |

The store adapter (`CONFIG.STORE`) consumes its own driver helper (`Lib.Postgres`, `Lib.MongoDB`, etc.) through `CONFIG.STORE_CONFIG`. The logger module never imports database drivers directly.

## Documentation

- `docs/api.md`. Full API reference (every function, every option, every error type)
- `docs/configuration.md`. Loader pattern, every config key, peer dependencies, testing tier
- `docs/data-model.md`. Canonical record shape, core concepts, design decisions
- `docs/runtime.md`. The runtime-shape differences for the logger (background-write lifecycle in serverless, scheduled cleanup mechanism). Not a framework cookbook
- Storage adapters: see the README's "Storage Adapters" section for the list + selection rule. Per-backend schema, indexes, TTL, IaC notes, and `STORE_CONFIG` shape live in each adapter package's own README (`@superloomdev/js-server-helper-logger-store-*`)
