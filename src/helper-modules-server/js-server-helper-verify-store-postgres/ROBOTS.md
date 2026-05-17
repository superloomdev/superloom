# js-server-helper-verify-store-postgres. AI Reference

Class F storage adapter. PostgreSQL backend for `@superloomdev/js-server-helper-verify`. Cannot stand alone. Always loaded by the Verify parent via the factory protocol; not called directly by application code.

Requires a running PostgreSQL instance. Uses `js-server-helper-sql-postgres` (pooled `pg` driver wrapper) injected via `STORE_CONFIG.lib_sql`.

## Adapter Factory

```js
const factory = require('@superloomdev/js-server-helper-verify-store-postgres');
const store   = factory(Lib, CONFIG, ERRORS);
```

| Argument | Type | Source |
|---|---|---|
| `Lib` | Object | Dependency container with `Utils` and `Debug` at minimum |
| `CONFIG` | Object | Merged Verify config; the factory reads `CONFIG.STORE_CONFIG` only |
| `ERRORS` | Object | Verify error catalog; the adapter uses `SERVICE_UNAVAILABLE` only |

Returns a Store interface. The Verify parent retains the reference and calls the contract methods to satisfy its persistence needs.

## `STORE_CONFIG`

```js
{
  table_name: 'verification_codes',  // required. one table per verify instance
  lib_sql:    Lib.Postgres           // required. initialized js-server-helper-sql-postgres
}
```

Both keys are required. The loader throws an `Error` if either is missing, null, or empty.

## Store Contract

| Method | Signature | Returns |
|---|---|---|
| `setupNewStore` | `(instance)` | `{ success, error }` |
| `getRecord` | `(instance, scope, key)` | `{ success, record, error }` |
| `setRecord` | `(instance, scope, key, record)` | `{ success, error }` |
| `incrementFailCount` | `(instance, scope, key)` | `{ success, error }` |
| `deleteRecord` | `(instance, scope, key)` | `{ success, error }` |
| `cleanupExpiredRecords` | `(instance)` | `{ success, deleted_count, error }` |

All methods are async. `instance` is the per-request scope object from `Lib.Instance.initialize()`. Methods return either `success: true` with the requested data, or `success: false` with `error: ERRORS.SERVICE_UNAVAILABLE` and any data field set to a typed empty value (`null` / `0`).

## Behaviors That Must Not Be Violated When Generating Code

1. **Never call the adapter directly from application code.** Always go through the parent Verify module. The adapter expects `Lib`, the full Verify `CONFIG`, and the frozen Verify `ERRORS` catalog. Application code does not have those.

2. **`getRecord` returns `record: null` on a miss.** A missing row is not an error. The verify module checks the returned record before comparing the submitted code.

3. **`setRecord` is a full UPSERT.** Uses `INSERT ... ON CONFLICT ("scope", "id") DO UPDATE SET col = excluded.col`. Re-inserting the same `(scope, id)` composite key replaces all mutable columns (`code`, `fail_count`, `created_at`, `expires_at`) in one round-trip.

4. **`incrementFailCount` is an atomic in-place UPDATE.** Issues `SET "fail_count" = "fail_count" + 1`. Safe under concurrent verify attempts — each call adds exactly 1. Does not read the current value before writing.

5. **`deleteRecord` is idempotent.** A missing row is treated as success; callers never need to check existence first.

6. **`cleanupExpiredRecords` uses real wall-clock time (`Lib.Utils.getUnixTime()`).** Not `instance.time`. Cleanup must use the real clock so expired rows sweep on schedule.

7. **Identifiers are double-quoted (`"col"`).** Same quoting style as SQLite. The adapter rejects any `table_name` containing a double-quote at quoting time.

8. **Index name is `{table_name}_expires_at_idx`.** Deterministic, derived from `STORE_CONFIG.table_name` at createInterface time.

9. **`setupNewStore` is idempotent.** Uses `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`. Both are fully supported by PostgreSQL.

10. **PostgreSQL has no native TTL.** `cleanupExpiredRecords` is the only deletion path for expired rows. Schedule it on a cron.

11. **BIGINT columns (`created_at`, `expires_at`) may be returned as strings by the `pg` driver.** The verify module reads these as numbers. Coercion is handled by the verify module, not the adapter; the adapter returns raw driver values.

## Peer Dependencies

```
@superloomdev/js-helper-utils                  (type checks)
@superloomdev/js-helper-debug                  (structured logging)
@superloomdev/js-server-helper-sql-postgres    (pg driver wrapper)
```

These are loaded into `Lib` by the application before the Verify parent is loaded. The adapter does not require any of them directly; it accesses them through `Lib`.

## Error Catalog Used

Only one type from the Verify `ERRORS` catalog:

| Error | When |
|---|---|
| `ERRORS.SERVICE_UNAVAILABLE` | Driver-level call failed. The driver's underlying error is logged via `Lib.Debug.debug` and never surfaced |

## Single Source of Truth

The store's source file is `store.js`; the config validator is `store.validators.js`. The DDL array and UPSERT template are precomputed once per Store instance at `createInterface` time. The composite primary key is `("scope", "id")`.
