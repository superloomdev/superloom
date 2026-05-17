# js-server-helper-logger-store-mysql. AI Reference

Class F storage adapter. MySQL / MariaDB backend for `@superloomdev/js-server-helper-logger`. Cannot stand alone. Always loaded by the Logger parent via the factory protocol; not called directly by application code.

Requires a running MySQL or MariaDB instance. Uses `js-server-helper-sql-mysql` (pooled `mysql2` driver wrapper) injected via `STORE_CONFIG.lib_sql`.

## Adapter Factory

```js
const factory = require('@superloomdev/js-server-helper-logger-store-mysql');
const store   = factory(Lib, CONFIG, ERRORS);
```

| Argument | Type | Source |
|---|---|---|
| `Lib` | Object | Dependency container with `Utils` and `Debug` at minimum |
| `CONFIG` | Object | Merged Logger config; the factory reads `CONFIG.STORE_CONFIG` only |
| `ERRORS` | Object | Logger error catalog; the adapter uses `SERVICE_UNAVAILABLE` only |

Returns a Store interface.

## `STORE_CONFIG`

```js
{
  table_name: 'action_log',  // required. one table per logger instance
  lib_sql:    Lib.MySQL      // required. initialized js-server-helper-sql-mysql
}
```

Both keys are required.

## Store Contract

| Method | Signature | Returns |
|---|---|---|
| `setupNewStore` | `(instance)` | `{ success, error }` |
| `addLog` | `(instance, record)` | `{ success, error }` |
| `getLogsByEntity` | `(instance, query)` | `{ success, records, next_cursor, error }` |
| `getLogsByActor` | `(instance, query)` | `{ success, records, next_cursor, error }` |
| `cleanupExpiredLogs` | `(instance)` | `{ success, deleted_count, error }` |

## Behaviors That Must Not Be Violated When Generating Code

1. **Never call the adapter directly from application code.** Always go through the parent Logger module.

2. **`sort_key` is the primary key.** Globally unique, timestamp-based string.

3. **`addLog` is idempotent.** Uses `INSERT ... ON DUPLICATE KEY UPDATE sort_key = sort_key` (MySQL no-op pattern). Re-inserting the same `sort_key` is silently ignored.

4. **`getLogsByEntity` and `getLogsByActor` use cursor pagination.** `cursor` is a `sort_key` value.

5. **`cleanupExpiredLogs` uses real wall-clock time.** Not `instance.time`. Condition: `` `expires_at` IS NOT NULL AND `expires_at` <= ? ``.

6. **`data` column is JSON-serialized TEXT.** Serialized on write, parsed on read.

7. **Identifiers are backtick-quoted (`` `col` ``).** The adapter rejects any `table_name` containing a backtick.

8. **All indexes are inlined in `CREATE TABLE IF NOT EXISTS`.** MySQL does not support `CREATE INDEX IF NOT EXISTS` standalone. Entity, actor, and expires_at indexes are all inlined.

9. **`setupNewStore` is idempotent** via `CREATE TABLE IF NOT EXISTS` with all indexes inlined in one statement.

10. **MySQL has no native TTL.** `cleanupExpiredLogs` is the only deletion path for TTL log rows.

## Peer Dependencies

```
@superloomdev/js-helper-utils               (type checks)
@superloomdev/js-helper-debug               (structured logging)
@superloomdev/js-server-helper-sql-mysql    (mysql2 driver wrapper)
```

## Error Catalog Used

| Error | When |
|---|---|
| `ERRORS.SERVICE_UNAVAILABLE` | Driver-level call failed. Logged via `Lib.Debug.error`, never surfaced to caller |

## Single Source of Truth

The store's source file is `store.js`. Primary key is `` `sort_key` ``. All three indexes inlined in `CREATE TABLE`.
