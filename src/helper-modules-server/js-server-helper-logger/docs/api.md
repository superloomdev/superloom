# API Reference. `js-server-helper-logger`

Every exported function on the public interface, with parameters, return shape, and notes. For loader semantics and configuration keys see [Configuration](configuration.md). For the canonical log-record shape and per-field design rationale see [Data Model](data-model.md). For backend selection see the [Storage Adapters](../README.md#storage-adapters) section in the module README; for per-backend `STORE_CONFIG` shape see each adapter package's own README.

## On This Page

- [Conventions](#conventions)
- [The Response Envelope](#the-response-envelope)
- [Write](#write)
- [Read](#read)
- [Operational Functions](#operational-functions)
- [Error Catalog](#error-catalog)

---

## Conventions

| Pattern | Behaviour |
|---|---|
| **`instance` is always the first argument** | Every operation receives the per-request lifecycle object returned by `Lib.Instance.initialize()`. The module reads `instance.time` and `instance.time_ms` for timestamps. For background writes it registers a `Lib.Instance.backgroundRoutine`. When `Lib.HttpHandler` is in the `Lib` container, it also reads `instance.http_request` to auto-capture `ip` and `user_agent` |
| **Programmer errors throw `TypeError` synchronously** | Missing required option, wrong type, or invalid `retention` shape throw `TypeError` at the call-site. These are mistakes that should be caught in development, never at runtime |
| **Operational errors return `{ success: false, error }`** | Store failures (adapter unavailable, network error, write rejection) come back through the response envelope. The auth-style "branch on `success`" pattern applies |
| **Background writes never surface store errors** | The default `log()` call is fire-and-forget. Adapter failures are logged via `Lib.Debug.debug` but the caller's `Promise` resolves immediately with `{ success: true }`. To see write failures, pass `options.await: true` |
| **One Logger instance per backend** | The factory binds one `STORE` adapter at construction time. Run multiple instances in parallel if you genuinely want to write to multiple backends (rare; usually one suffices) |

---

## The Response Envelope

Every async function resolves to an object with this shape (named fields vary by function):

| Field | Type | Description |
|---|---|---|
| `success` | `boolean` | `true` on success. `false` on operational failure |
| `error` | `object \| null` | `{ type, message }` on failure. `null` on success. See [Error Catalog](#error-catalog) |
| `records` | `array` | Array of canonical log records (on `listByEntity` / `listByActor`) |
| `next_cursor` | `string \| null` | Pagination token. The `sort_key` of the last record, or `null` on the final page |
| `deleted_count` | `number` | Number of records removed (on `cleanupExpiredLogs`) |

---

## Write

### `log(instance, options)` *(async)*

Validates options, builds the canonical record, auto-captures `ip` and `user_agent` if `Lib.HttpHandler` is present, optionally AES-encrypts `ip`, and writes the record to the store. By default the write runs in the background through `Lib.Instance.backgroundRoutine` and the call resolves immediately. Pass `options.await: true` for compliance flows where the caller must know whether the row is durable before responding.

| Option | Type | Required | Description |
|---|---|---|---|
| `scope` | `string` | No (default `''`) | Multi-tenant namespace. List queries are scoped to this value; there is no cross-scope query path |
| `entity_type` | `string` | Yes | What kind of thing was affected (`'user'`, `'project'`, `'invoice'`, ...) |
| `entity_id` | `string` | Yes | The specific instance of that thing |
| `actor_type` | `string` | Yes | What kind of agent triggered the event (`'user'`, `'admin'`, `'system'`, `'webhook'`, ...) |
| `actor_id` | `string` | Yes | The specific agent |
| `action` | `string` | Yes | Dot-notation event name (`'auth.login'`, `'profile.name.changed'`). Application-owned namespace |
| `data` | `object \| null` | No | Free-form JSON payload. Opaque to the logger. Do not store secrets, full card numbers, raw passwords, or large blobs here |
| `ip` | `string \| null` | No | Request origin IP. Auto-captured from `instance.http_request` when `Lib.HttpHandler` is in the `Lib` container. AES-encrypted at rest when `CONFIG.IP_ENCRYPT_KEY` is set |
| `user_agent` | `string \| null` | No | HTTP `User-Agent`. Same auto-capture pattern as `ip` |
| `retention` | `'persistent' \| { ttl_seconds: positive_integer }` | Yes | Per-row retention. `'persistent'` writes `expires_at = null` (never deleted). `{ ttl_seconds: N }` writes `expires_at = created_at + N` |
| `await` | `boolean` | No (default `false`) | If `true`, the call awaits the store write and surfaces any `SERVICE_UNAVAILABLE` error. If `false`, the call resolves immediately with `{ success: true }` and the store write runs in the background |

**Return shape.**

```js
// Background write (default)
{ success: true, error: null }

// Awaited write, store accepted the row
{ success: true, error: null }

// Awaited write, store failed
{ success: false, error: { type: 'LOGGER_SERVICE_UNAVAILABLE', message: '...' } }
```

---

## Read

### `listByEntity(instance, options)` *(async)*

List events recorded against one entity, most-recent first. Pagination via cursor returns the prior page's `next_cursor` until `null`.

| Option | Type | Required | Description |
|---|---|---|---|
| `scope` | `string` | No (default `''`) | Must match the scope used at write time |
| `entity_type` | `string` | Yes | Entity discriminator |
| `entity_id` | `string` | Yes | Entity identifier |
| `actions` | `string[]` | No | Filter to literal action names or `'auth.*'`-style globs. Glob is prefix-only |
| `start_time_ms` | `integer` | No | Inclusive lower bound on `created_at_ms` |
| `end_time_ms` | `integer` | No | Exclusive upper bound on `created_at_ms` |
| `cursor` | `string` | No | Resume token from the previous page's `next_cursor` |
| `limit` | `integer` | No (default 50) | Page size |

**Return shape.**

```js
{
  success: true,
  records: [
    {
      scope, entity_type, entity_id, actor_type, actor_id, action,
      data, ip, user_agent,
      created_at, created_at_ms, sort_key, expires_at
    },
    /* ... */
  ],
  next_cursor: '1715180412345-xqp',   // or null on the final page
  error: null
}
```

For the full record-field reference see [Data Model](data-model.md#record-fields).

### `listByActor(instance, options)` *(async)*

List events performed by one actor, most-recent first. Same shape, same pagination, same filters as `listByEntity`. The `actor_type` and `actor_id` options replace the entity pair.

| Option | Type | Required | Description |
|---|---|---|---|
| `scope` | `string` | No | Same default as `listByEntity` |
| `actor_type` | `string` | Yes | Actor discriminator |
| `actor_id` | `string` | Yes | Actor identifier |
| `actions`, `start_time_ms`, `end_time_ms`, `cursor`, `limit` | | | Identical to `listByEntity` |

---

## Operational Functions

### `setupNewStore(instance)` *(async)*

Idempotent backend setup. The actual work depends on the chosen storage adapter. SQL adapters typically run `CREATE TABLE IF NOT EXISTS` plus index DDL. The memory adapter is a no-op. NoSQL adapters may provision indexes or rely on out-of-band IaC. See your adapter's README for the exact behaviour.

**Return shape.** `{ success, error }`.

### `cleanupExpiredLogs(instance)` *(async)*

Bulk-delete rows whose `expires_at` is in the past. Rows with `expires_at = null` (persistent) are never touched. Some adapters' native TTL handles expiry automatically; in those cases this function is the explicit fallback and is safe to call even when nothing needs deleting. See your adapter's README for whether scheduling is required.

**Return shape.** `{ success, deleted_count, error }`.

---

## Error Catalog

The logger module exports exactly one operational error type. Programmer errors (missing required option, wrong type, invalid `retention`) throw `TypeError` synchronously and are not catalogued.

| `error.type` | When returned | Surfaces in |
|---|---|---|
| `LOGGER_SERVICE_UNAVAILABLE` | The chosen storage adapter returned `{ success: false }` from `addLog`, `getLogsByEntity`, `getLogsByActor`, or `cleanupExpiredLogs` | `log(..., { await: true })`, `listByEntity`, `listByActor`, `cleanupExpiredLogs` |

Background `log()` calls do not surface `LOGGER_SERVICE_UNAVAILABLE`. Adapter failures during background writes are logged through `Lib.Debug.debug` and the caller's `Promise` still resolves with `{ success: true }`. If you need the write to be guaranteed durable before responding to the user (password change, GDPR deletion request, financial event), pass `options.await: true`.

Error shape is frozen at construction time:

```js
{ type: 'LOGGER_SERVICE_UNAVAILABLE', message: 'Logger service temporarily unavailable' }
```
