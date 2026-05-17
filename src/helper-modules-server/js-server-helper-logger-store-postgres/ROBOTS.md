# js-server-helper-logger-store-postgres. AI Reference

Class F storage adapter. PostgreSQL backend for `@superloomdev/js-server-helper-logger`. Cannot stand alone. Always loaded by the Logger parent via the factory protocol; not called directly by application code.

Requires a running PostgreSQL instance. Uses `js-server-helper-sql-postgres` (pooled `pg` driver wrapper) injected via `STORE_CONFIG.lib_sql`.

## Adapter Factory

```js
const factory = require('@superloomdev/js-server-helper-logger-store-postgres');
const store   = factory(Lib, CONFIG, ERRORS);
```

| Argument | Type | Source |
|---|---|---|
| `Lib` | Object | Dependency container with `Utils` and `Debug` at minimum |
| `CONFIG` | Object | Merged Logger config; the factory reads `CONFIG.STORE_CONFIG` only |
| `ERRORS` | Object | Logger error catalog; the adapter uses `SERVICE_UNAVAILABLE` only |

Returns a Store interface. The Logger parent retains the reference and calls the contract methods.

## `STORE_CONFIG`

```js
{
  table_name: 'action_log',  // required. one table per logger instance
  lib_sql:    Lib.Postgres   // required. initialized js-server-helper-sql-postgres
}
```

Both keys are required. The loader throws an `Error` if either is missing, null, or empty.

## Store Contract

| Method | Signature | Returns |
|---|---|---|
| `setupNewStore` | `(instance)` | `{ success, error }` |
| `addLog` | `(instance, record)` | `{ success, error }` |
| `getLogsByEntity` | `(instance, query)` | `{ success, records, next_cursor, error }` |
| `getLogsByActor` | `(instance, query)` | `{ success, records, next_cursor, error }` |
| `cleanupExpiredLogs` | `(instance)` | `{ success, deleted_count, error }` |

All methods are async. `instance` is the per-request scope object from `Lib.Instance.initialize()`.

## Behaviors That Must Not Be Violated When Generating Code

1. **Never call the adapter directly from application code.** Always go through the parent Logger module.

2. **`sort_key` is the primary key.** Globally unique, timestamp-based string from the Logger parent.

3. **`addLog` is idempotent.** Uses `INSERT ... ON CONFLICT ("sort_key") DO NOTHING`. Re-inserting the same `sort_key` is silently ignored.

4. **`getLogsByEntity` and `getLogsByActor` use cursor pagination.** `cursor` is a `sort_key` value. The adapter fetches `limit + 1` rows to detect next page.

5. **`cleanupExpiredLogs` uses real wall-clock time.** Not `instance.time`. Condition: `"expires_at" IS NOT NULL AND "expires_at" <= ?`.

6. **`data` column is JSON-serialized TEXT.** Serialized on write, parsed on read.

7. **Identifiers are double-quoted (`"col"`).** The adapter rejects any `table_name` containing a double-quote.

8. **Three separate `CREATE INDEX IF NOT EXISTS` statements** are used (entity, actor, expires_at). Unlike MySQL, PostgreSQL supports standalone `CREATE INDEX IF NOT EXISTS`.

9. **`setupNewStore` is idempotent.** Uses `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`.

10. **PostgreSQL has no native TTL.** `cleanupExpiredLogs` is the only deletion path for TTL log rows.

11. **BIGINT columns (`created_at`, `created_at_ms`, `expires_at`) may be returned as strings by the `pg` driver.** The adapter coerces these to `Number` on read via `Number(row.col)`.

## Peer Dependencies

```
@superloomdev/js-helper-utils                  (type checks)
@superloomdev/js-helper-debug                  (structured logging)
@superloomdev/js-server-helper-sql-postgres    (pg driver wrapper)
```

## Error Catalog Used

| Error | When |
|---|---|
| `ERRORS.SERVICE_UNAVAILABLE` | Driver-level call failed. Logged via `Lib.Debug.error`, never surfaced to caller |

## Single Source of Truth

The store's source file is `store.js`; the config validator is `store.validators.js`. Primary key is `"sort_key"`. All three index names are derived deterministically from `STORE_CONFIG.table_name`.
