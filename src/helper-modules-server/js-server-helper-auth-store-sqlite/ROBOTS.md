# js-server-helper-auth-store-sqlite. AI Reference

Class F storage adapter. SQLite backend for `@superloomdev/js-server-helper-auth`. Cannot stand alone. Always loaded by the Auth parent via the factory protocol; not called directly by application code.

Embedded / in-process. Uses Node's built-in `node:sqlite` through the `js-server-helper-sql-sqlite` driver helper. No external service, no Docker, no network.

## Adapter Factory

```js
const factory = require('@superloomdev/js-server-helper-auth-store-sqlite');
const store   = factory(Lib, CONFIG, ERRORS);
```

| Argument | Type | Source |
|---|---|---|
| `Lib` | Object | Dependency container with `Utils` and `Debug` at minimum |
| `CONFIG` | Object | Merged Auth config; the factory reads `CONFIG.STORE_CONFIG` only |
| `ERRORS` | Object | Auth error catalog; the adapter uses `SERVICE_UNAVAILABLE` only |

Returns a Store interface. The Auth parent retains the reference and calls the contract methods to satisfy its persistence needs.

## `STORE_CONFIG`

```js
{
  table_name: 'sessions_user',  // required. one table per actor_type
  lib_sql:    Lib.SQLite        // required. initialized js-server-helper-sql-sqlite
}
```

Both keys are required. The loader throws an `Error` if either is missing, null, or empty.

## Store Contract

| Method | Signature | Returns |
|---|---|---|
| `setupNewStore` | `(instance)` | `{ success, error }` |
| `getSession` | `(instance, tenant_id, actor_id, token_key, token_secret_hash)` | `{ success, record, error }` |
| `listSessionsByActor` | `(instance, tenant_id, actor_id)` | `{ success, records, error }` |
| `setSession` | `(instance, record)` | `{ success, error }` |
| `updateSessionActivity` | `(instance, tenant_id, actor_id, token_key, updates)` | `{ success, error }` |
| `deleteSession` | `(instance, tenant_id, actor_id, token_key)` | `{ success, error }` |
| `deleteSessions` | `(instance, tenant_id, keys)` | `{ success, error }` |
| `cleanupExpiredSessions` | `(instance)` | `{ success, deleted_count, error }` |

All methods are async. `instance` is the per-request scope object from `Lib.Instance.initialize()`. Methods return either `success: true` with the requested data, or `success: false` with `error: ERRORS.SERVICE_UNAVAILABLE` and any data field set to a typed empty value (`null` / `[]` / `0`).

## Behaviors That Must Not Be Violated When Generating Code

1. **Never call the adapter directly from application code.** Always go through the parent Auth module. The adapter expects `Lib`, the full Auth `CONFIG`, and the frozen Auth `ERRORS` catalog. Application code does not have those.

2. **`getSession` returns `record: null` on hash mismatch.** Identical to the "session does not exist" shape. The wrong-secret path must not surface as an error envelope or distinct return; it must look identical to a missing row to prevent timing-based enumeration. The compare happens after the primary-key read; the row is fetched first, then `token_secret_hash` is verified.

3. **`updateSessionActivity` throws `TypeError` on identity fields.** Programmer-error guard. The blocked fields are `tenant_id`, `actor_id`, `actor_type`, `token_key`, `token_secret_hash`, `created_at`, `install_id`, `install_platform`, `install_form_factor`. The Auth parent never passes these; the guard exists so a regression surfaces immediately rather than silently rewriting identity columns. Do not catch and swallow.

4. **`setSession` is an UPSERT.** Uses `INSERT ... ON CONFLICT (pk) DO UPDATE SET col = excluded.col`. Re-inserts the same composite primary key without complaint. The `DO UPDATE` clause excludes the primary-key triple and the per-install fields (`created_at`, `install_id`, `install_platform`, `install_form_factor`) from update, so a second `setSession` cannot rewrite the session's creation metadata.

5. **`deleteSessions` with `keys.length === 0` is a no-op success.** Returns `{ success: true, error: null }` without round-trip to the driver.

6. **INTEGER columns return as JavaScript Numbers.** SQLite has no separate BIGINT type and `node:sqlite` returns INTEGER values as native JS `Number`. Unlike the Postgres adapter, no coercion-at-the-driver-boundary is needed.

7. **`client_is_browser` is stored as INTEGER 0/1.** SQLite has no native boolean type. The adapter encodes `Boolean(value)` to `0` or `1` on write and decodes back to a JS boolean on read. `undefined` and `null` reads surface as `false` so the record shape always has a stable boolean.

8. **`custom_data` is JSON-encoded into a TEXT column.** On read the JSON is parsed back to an object. Corrupt stored values surface as `null`, not as throws.

9. **`table_name` cannot contain a double-quote.** The adapter throws at quoting time. The loader does not reject this at config-validation time; a malformed `table_name` surfaces on first call.

10. **`setupNewStore` is idempotent and safe to call on every boot.** Uses `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`. Both are supported by SQLite without ceremony.

11. **SQLite has no native TTL.** `cleanupExpiredSessions` is the only deletion path for expired rows. Application code must schedule it (cron in a persistent server). The `:memory:` mode makes cleanup moot because the database disappears on process exit; the recommendation applies to file-backed deployments.

## Peer Dependencies

```
@superloomdev/js-helper-utils                (type checks)
@superloomdev/js-helper-debug                (structured logging)
@superloomdev/js-server-helper-sql-sqlite    (node:sqlite wrapper)
```

These are loaded into `Lib` by the application before the Auth parent is loaded. The adapter does not require any of them directly; it accesses them through `Lib`.

## Error Catalog Used

Only one type from the Auth `ERRORS` catalog:

| Error | When |
|---|---|
| `ERRORS.SERVICE_UNAVAILABLE` | Driver-level call failed. The driver's underlying error is logged via `Lib.Debug.debug` and never surfaced |

`getSession` with a hash mismatch is **not** an error. It is success with `record: null`.

## Single Source of Truth

The store's source file is `store.js`; the config validator is `store.validators.js`. Schema definitions, UPSERT template, column lists, and identity blocklists live in `_Store` private functions inside `store.js`. The column ordering aligns with the Auth parent's `parts/record-shape.js` `getFieldNames()`. The UPSERT template is precomputed once per Store instance and cached for every subsequent `setSession`.
