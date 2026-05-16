# js-server-helper-sql-mysql

MySQL 8.0.44+ client with connection pooling. Async/await. Multi-DB capable. **API-compatible with `js-server-helper-sql-postgres` and `js-server-helper-sql-sqlite`** — same placeholders, same function signatures, same return shapes.

## Type
Server helper. Service-dependent (needs Docker for emulated, real MySQL-compatible database for integration).

## Peer Dependencies
- `@superloomdev/js-helper-utils` - injected as `Lib.Utils`
- `@superloomdev/js-helper-debug` - injected as `Lib.Debug`
- `@superloomdev/js-server-helper-instance` - injected as `Lib.Instance` (for `instance.time_ms`)

## Direct Dependencies
- `mysql2` - Node.js MySQL driver (lazy-loaded)

## Loader Pattern (Multi-DB Capable)

```javascript
Lib.PrimaryDB = require('@superloomdev/js-server-helper-sql-mysql')(Lib, { HOST: ..., DATABASE: ... });
Lib.ReaderDB  = require('@superloomdev/js-server-helper-sql-mysql')(Lib, { HOST: ..., DATABASE: ... });
```

Each loader call returns an independent public interface with its own pool - no shared singleton state.

## Config Keys
| Key | Type | Default | Required |
|---|---|---|---|
| HOST | String | 'localhost' | yes |
| PORT | Number | 3306 | no |
| DATABASE | String | '' | yes |
| USER | String | 'root' | yes |
| PASSWORD | String | '' | yes |
| SSL | Boolean \| Object | false | no (true for TLS-enforced managed databases) |
| POOL_MAX | Number | 10 | no (1 for serverless function, 10-20 for persistent server) |
| POOL_QUEUE_LIMIT | Number | 0 | no |
| POOL_IDLE_TIMEOUT_MS | Number | 60000 | no |
| KEEP_ALIVE_INITIAL_DELAY_MS | Number | 10000 | no |
| MULTIPLE_STATEMENTS | Boolean | false | no |
| CHARSET | String | 'utf8mb4' | no |
| TIMEZONE | String | 'Z' | no (UTC) |
| CONNECT_TIMEOUT_MS | Number | 10000 | no |

## Exported Functions (12 total)

All I/O functions accept `instance` first. Placeholder style: `?` for values, `??` for identifiers.

### Read helpers

getRow(instance, sql, params?) → { success, row, error } | async:yes
  First row, or null.

getRows(instance, sql, params?) → { success, rows, count, error } | async:yes
  All rows.

get(instance, sql, params?) → { success, result, has_multiple_rows, error } | async:yes
  Ambiguous auto-shaping: scalar / row-object / row-array / null depending on rows x columns.
  Use when the expected shape is not known upfront. Prefer getRow/getRows/getValue when shape is known.

getValue(instance, sql, params?) → { success, value, error } | async:yes
  First column of first row (scalar).

### Write helper

write(instance, sql, params?) → { success, affected_rows, insert_id, error } | async:yes
  Polymorphic INSERT / UPDATE / DELETE runner.
  sql = String: single statement with optional params array.
  sql = Array: atomic transaction, entries are SQL strings or { sql, params } objects.
  affected_rows is summed across statements; insert_id is the last seen auto-increment ID.

### Manual transactions

getClient(instance) → { success, client, error } | async:yes
  Dedicated pool connection for manual transaction control.
  Use when you need to interleave business logic between SQL statements.
  Caller is responsible for BEGIN/COMMIT/ROLLBACK and releaseClient().

releaseClient(client) → void | async:no
  Return client to pool. Safe on null.

### Query builders (pure, no I/O)

buildQuery(sql, params) → String | async:no
  mysql2.format passthrough. `?` values, `??` identifiers.

buildRawText(str) → Object | async:no
  mysql2.raw - emit fragment unescaped. Use for spatial SQL and nested functions.

buildMultiCondition(data, operator?) → String | async:no
  "k1 = v1 AND k2 = v2" joiner. operator default 'AND'.

### Lifecycle

close() → Promise<void> | async:yes
  Close the pool gracefully. Waits up to CONFIG.CLOSE_TIMEOUT_MS (default 5000 ms) for active queries to finish, then force-destroys any remaining connections. Call on SIGTERM.

## Patterns
- **Factory per loader:** every loader call returns its own instance with its own pool. No module-level singletons.
- **Lazy adapter load:** `mysql2` and `mysql2/promise` are `require()`-d on first use via `ensureAdapter()`. The adapter modules are cached at module scope and shared across every instance because they are stateless.
- **Lazy pool init:** pool is created on the first query, not at loader time. Friendly to serverless functions.
- **Performance logging:** `Lib.Debug.performanceAuditLog` on every I/O function using `instance.time_ms`.
- **Placeholders:** `?` for values, `??` for identifiers. MySQL native, no translation needed.
- **Spatial data:** use `buildRawText()` - no dedicated geometry helpers.
- **Private workhorses:** `query()`, `execute()`, and `transaction()` are internal helpers. The public API exposes only the high-level `get/getRow/getRows/getValue/write` helpers plus `getClient/releaseClient` for manual transaction control.
- **Polymorphic write:** `write()` accepts a string (single statement) or an array (atomic transaction). `affected_rows` is summed across statements; `insert_id` is the last seen auto-increment ID.
- **Manual transactions:** use `getClient(instance)` + explicit `BEGIN`/`COMMIT`/`ROLLBACK` + `releaseClient(client)` when logic needs to interleave between SQL statements.
- **Auto-shaping helper:** `get` is a convenience wrapper useful when the caller does not know the result shape up-front (scalar vs row-object vs row-array vs null).
