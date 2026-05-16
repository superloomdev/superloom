# js-server-helper-sql-sqlite

SQLite client built on Node.js built-in `node:sqlite` module.
Async/await. Multi-DB capable. **API-compatible with `js-server-helper-sql-mysql`
and `js-server-helper-sql-postgres`** - same placeholders, same function signatures,
same return shapes.

## Type
Server helper. Offline (no Docker, no network - uses `:memory:` or a local file).

## Peer Dependencies
- `@superloomdev/js-helper-utils` - injected as `Lib.Utils`
- `@superloomdev/js-helper-debug` - injected as `Lib.Debug`
- `@superloomdev/js-server-helper-instance` - injected as `Lib.Instance`

## Direct Dependencies
- `node:sqlite` - Node.js built-in SQLite driver (lazy-loaded, requires Node 22.13+)

## Loader Pattern (Multi-DB Capable)

```javascript
Lib.CacheDB     = require('@superloomdev/js-server-helper-sql-sqlite')(Lib, { FILE: '/var/data/cache.db' });
Lib.AnalyticsDB = require('@superloomdev/js-server-helper-sql-sqlite')(Lib, { FILE: '/var/data/analytics.db' });
```

Each loader call returns an independent public interface with its own database handle - no singleton state.

## Placeholder Translation
- `?`  → kept as-is (SQLite natively supports ? anonymous parameters)
- `??` → inlined double-quoted identifier

The translator walks the SQL character-by-character and skips placeholders inside single-quoted strings, double-quoted identifiers, and `--` line comments.

## insert_id semantics
SQLite provides `sqlite3_last_insert_rowid()` out-of-the-box - no `RETURNING` clause needed (unlike Postgres). For tables with `INTEGER PRIMARY KEY`, `insert_id` equals the primary key value. For `INSERT ... RETURNING *`, `insert_id` is also extracted from the returned row's `id` column when present.

## Param normalisation
node:sqlite can bind only `null | number | bigint | string | Buffer | TypedArray | DataView`. The module converts additional types at bind time:
- `undefined` → `null`
- `boolean` → `1` / `0`
- `Date` → ISO 8601 string

## Statement classification
`query()` dispatches between `statement.all()` and `statement.run()` using the first SQL keyword:
- `SELECT` / `WITH` / `PRAGMA` / `EXPLAIN` → `all()` (returns rows)
- Anything containing `RETURNING` → `all()` (returns rows, also surfaces affected_rows and insert_id)
- All other DML / DDL → `run()` (returns `{changes, lastInsertRowid}`)

## Config Keys
| Key | Type | Default | Required |
|---|---|---|---|
| FILE | String | ':memory:' | no (defaults to in-memory) |
| READONLY | Boolean | false | no |
| ENABLE_FOREIGN_KEYS | Boolean | true | no |
| TIMEOUT_MS | Number | 5000 | no (busy handler) |
| JOURNAL_MODE | String | 'WAL' | no ('DELETE' / 'TRUNCATE' / 'PERSIST' / 'MEMORY' / 'WAL' / 'OFF') |
| SYNCHRONOUS | String | 'NORMAL' | no ('OFF' / 'NORMAL' / 'FULL' / 'EXTRA') |
| CLOSE_TIMEOUT_MS | Number | 5000 | no (present for MySQL/Postgres parity) |

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
  affected_rows is summed across statements; insert_id is the last seen `lastInsertRowid`.

### Manual transactions

getClient(instance) → { success, client, error } | async:yes
  Returns the underlying `DatabaseSync` handle for manual transaction control.
  Caller is responsible for `BEGIN`/`COMMIT`/`ROLLBACK` (via `client.exec(...)`) and `releaseClient()`.

releaseClient(client) → void | async:no
  No-op for SQLite. Kept for API parity with MySQL / Postgres.

### Query builders (pure, no I/O)

buildQuery(sql, params) → String | async:no
  Format `?` / `??` into a fully-escaped SQLite SQL string. Supports scalar,
  array (IN clauses), and object (SET/WHERE) expansions.

buildRawText(str) → Object | async:no
  Emit fragment unescaped. Use for CURRENT_TIMESTAMP and nested function calls.

buildMultiCondition(data, operator?) → String | async:no
  "k1 = v1 AND k2 = v2" joiner. operator default 'AND'.

### Lifecycle

close() → Promise<void> | async:yes
  Close the database handle. SQLite's close is synchronous; the async signature is kept for MySQL/Postgres parity. `CLOSE_TIMEOUT_MS` is unused but kept for config parity.

## Patterns
- **Factory per loader:** every loader call returns its own instance with its own handle. No module-level singletons.
- **Lazy adapter load:** `node:sqlite` is `require()`-d on first use via `ensureAdapter()`. Cached at module scope and shared across every instance because the driver module is stateless.
- **Lazy handle init:** handle is created on the first query, not at loader time. Friendly to serverless functions.
- **Performance logging:** `Lib.Debug.performanceAuditLog` on every I/O function using `instance.time_ms`.
- **Placeholder translation:** `?`/`??` in source SQL → native `?` with identifiers inlined before `prepare()`.
- **Quote-aware walker:** translator respects string literals, quoted identifiers, and line comments.
- **Private workhorses:** `query()`, `execute()`, and `transaction()` are internal helpers. The public API exposes only the high-level `get/getRow/getRows/getValue/write` helpers plus `getClient/releaseClient` for manual transaction control.
- **Polymorphic write:** `write()` accepts a string (single statement) or an array (atomic transaction). `affected_rows` is summed across statements; `insert_id` is the last seen `lastInsertRowid`.
- **insert_id for free:** SQLite's `lastInsertRowid` populates `insert_id` automatically. `RETURNING` is also supported through the read path.
- **Auto-shaping helper:** `get` is a convenience wrapper useful when the caller does not know the result shape up-front (scalar vs row-object vs row-array vs null).
- **PRAGMAs at open:** `journal_mode` and `synchronous` are applied at handle init. Values are whitelisted to prevent SQL injection via config.
- **No pool:** SQLite is embedded (single file handle). `getClient` returns the same handle every call; `releaseClient` is a no-op.
