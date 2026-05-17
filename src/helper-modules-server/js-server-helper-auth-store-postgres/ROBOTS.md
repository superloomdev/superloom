# js-server-helper-auth-store-postgres. AI Reference

Class F storage adapter. PostgreSQL backend for `@superloomdev/js-server-helper-auth`. Cannot stand alone. Always loaded by the Auth parent via the factory protocol; not called directly by application code.

## Adapter Factory

```js
const factory = require('@superloomdev/js-server-helper-auth-store-postgres');
const store   = factory(Lib, CONFIG, ERRORS);
```

| Argument | Type | Source |
|---|---|---|
| `Lib` | Object | Dependency container with `Utils` and `Debug` at minimum |
| `CONFIG` | Object | Merged Auth config; the factory reads `CONFIG.STORE_CONFIG` only |
| `ERRORS` | Object | Auth error catalog; used verbatim in error envelopes |

Returns a Store interface with eight async methods. The Auth parent retains the reference and calls these methods to satisfy its persistence needs.

## `STORE_CONFIG`

```js
{
  table_name: 'sessions_user',  // required. one table per actor_type
  lib_sql:    Lib.Postgres      // required. initialized js-server-helper-sql-postgres
}
```

Both keys are required. The loader throws an `Error` if either is missing, null, or empty.

## Store Contract. Eight Methods

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

2. **`getSession` returns `record: null` on hash mismatch.** Identical to the "session does not exist" shape. The wrong-secret path must not surface as an error envelope or distinct return; it must look identical to a missing row to prevent timing-based enumeration.

3. **`updateSessionActivity` throws `TypeError` on identity fields.** Programmer-error guard. The Auth module never passes identity fields. If a generated caller passes any of `tenant_id`, `actor_id`, `actor_type`, `token_key`, `token_secret_hash`, `created_at`, `install_id`, `install_platform`, `install_form_factor`, the throw is the intended behavior. Do not catch and swallow.

4. **`setSession` is an UPSERT.** It re-inserts the same composite primary key without complaint. Application code that wants exclusive insert semantics must check the parent's API, not bypass the adapter.

5. **`deleteSessions` with `keys.length === 0` is a no-op success.** Returns `{ success: true, error: null }` without round-trip to the database.

6. **BIGINT columns surface as Numbers on read.** The `pg` driver returns them as strings; the adapter coerces. Downstream code can rely on `record.expires_at` being a `Number`.

7. **`custom_data` is JSON-encoded into a `TEXT` column.** On read the JSON is parsed back to an object. Corrupt stored values surface as `null`, not as throws.

8. **`table_name` cannot contain a double-quote.** The adapter throws at quoting time. The loader does not reject this at config-validation time; a malformed `table_name` surfaces on first call.

9. **`setupNewStore` is idempotent and safe to call on every boot.** Uses `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`.

10. **PostgreSQL has no native TTL.** `cleanupExpiredSessions` is the only deletion path for expired rows. Application code must schedule it (cron, scheduled function invocation, or `pg_cron`).

## Peer Dependencies

```
@superloomdev/js-helper-utils                 (type checks)
@superloomdev/js-helper-debug                 (structured logging)
@superloomdev/js-server-helper-sql-postgres   (Postgres driver wrapper)
```

These are loaded into `Lib` by the application before the Auth parent is loaded. The adapter does not require any of them directly; it accesses them through `Lib`.

## Error Catalog Used

Only one type from the Auth `ERRORS` catalog:

| Error | When |
|---|---|
| `ERRORS.SERVICE_UNAVAILABLE` | Driver-level call failed. The driver's underlying error is logged via `Lib.Debug.debug` and never surfaced |

`getSession` with a hash mismatch is **not** an error. It is success with `record: null`.

## Single Source of Truth

The store's source file is `store.js`; the config validator is `store.validators.js`. Schema definitions, UPSERT template, column lists, and identity blocklists live in `_Store` private functions inside `store.js`. The column ordering aligns with the Auth parent's `parts/record-shape.js` `getFieldNames()`.
