# js-server-helper-verify-store-mysql. AI Reference

Class F storage adapter. MySQL / MariaDB backend for `@superloomdev/js-server-helper-verify`. Cannot stand alone. Always loaded by the Verify parent via the factory protocol; not called directly by application code.

Requires a running MySQL or MariaDB instance. Uses `js-server-helper-sql-mysql` (pooled `mysql2` driver wrapper) injected via `STORE_CONFIG.lib_sql`.

## Adapter Factory

```js
const factory = require('@superloomdev/js-server-helper-verify-store-mysql');
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
  lib_sql:    Lib.MySQL              // required. initialized js-server-helper-sql-mysql
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

All methods are async. `instance` is the per-request scope object from `Lib.Instance.initialize()`.

## Behaviors That Must Not Be Violated When Generating Code

1. **Never call the adapter directly from application code.** Always go through the parent Verify module.

2. **`getRecord` returns `record: null` on a miss.** Not an error.

3. **`setRecord` is a full UPSERT.** Uses `INSERT ... ON DUPLICATE KEY UPDATE col = VALUES(col)`. Re-inserting the same `(scope, id)` composite key replaces all mutable columns in one round-trip.

4. **`incrementFailCount` is an atomic in-place UPDATE.** Issues `SET \`fail_count\` = \`fail_count\` + 1`. Safe under concurrent verify attempts.

5. **`deleteRecord` is idempotent.** A missing row is treated as success.

6. **`cleanupExpiredRecords` uses real wall-clock time.** Not `instance.time`.

7. **Identifiers are backtick-quoted (`` `col` ``).** The adapter rejects any `table_name` containing a backtick at quoting time.

8. **MySQL does not support `CREATE INDEX IF NOT EXISTS` as a standalone statement.** All indexes are inlined inside `CREATE TABLE IF NOT EXISTS`, making `setupNewStore` fully idempotent in a single statement.

9. **`setupNewStore` is idempotent** via `CREATE TABLE IF NOT EXISTS` with all indexes inlined.

10. **MySQL has no native TTL.** `cleanupExpiredRecords` is the only deletion path for expired rows. Schedule it on a cron or use the MySQL Event Scheduler.

11. **BIGINT columns (`created_at`, `expires_at`) may be returned as strings by the `mysql2` driver.** Coercion is handled at the verify module boundary.

## Peer Dependencies

```
@superloomdev/js-helper-utils               (type checks)
@superloomdev/js-helper-debug               (structured logging)
@superloomdev/js-server-helper-sql-mysql    (mysql2 driver wrapper)
```

## Error Catalog Used

| Error | When |
|---|---|
| `ERRORS.SERVICE_UNAVAILABLE` | Driver-level call failed. The driver's underlying error is logged via `Lib.Debug.debug` and never surfaced |

## Single Source of Truth

The store's source file is `store.js`; the config validator is `store.validators.js`. The composite primary key is `(\`scope\`, \`id\`)`. All indexes are inlined in the `CREATE TABLE` statement.
