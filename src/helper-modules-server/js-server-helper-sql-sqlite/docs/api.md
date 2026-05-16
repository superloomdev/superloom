# API Reference — `js-server-helper-sql-sqlite`

Every exported function with its signature, parameters, return shape, semantics, and examples. For configuration keys and runtime patterns see [Configuration](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-sql-sqlite/docs/configuration.md).

## On This Page

- [Conventions](#conventions)
- [Placeholders](#placeholders)
- [Parameter Normalisation](#parameter-normalisation)
- [`insert_id` Semantics](#insert_id-semantics)
- [Statement Classification](#statement-classification)
- [Read Helpers](#read-helpers)
  - [`getRow`](#getrow)
  - [`getRows`](#getrows)
  - [`getValue`](#getvalue)
  - [`get`](#get)
- [Write Helper](#write-helper)
  - [`write`](#write)
- [Manual Transactions](#manual-transactions)
  - [`getClient`](#getclient)
  - [`releaseClient`](#releaseclient)
- [Query Builders](#query-builders)
  - [`buildQuery`](#buildquery)
  - [`buildRawText`](#buildrawtext)
  - [`buildMultiCondition`](#buildmulticondition)
- [Lifecycle](#lifecycle)
  - [`close`](#close)

---

## Conventions

All I/O functions are **async** (even though SQLite is synchronous under the hood) and accept `instance` as their first argument. Keeping the I/O surface async preserves API parity with the MySQL and Postgres helpers — the same application code works against any of the three.

Every function returns a consistent response envelope:

```javascript
{ success: true,  /* result fields */, error: null }
{ success: false, /* zeroed fields */, error: { type, message } }
```

Operational failures (locked database, busy-handler timeout, constraint violation) never throw — they come back through `error` so the caller can branch without a try/catch. Programming errors (bad arguments, missing peers) still throw, because those are bugs.

---

## Placeholders

Placeholders match the MySQL / Postgres helpers exactly so the same SQL strings work across all three backends:

| Token | Meaning | How it is handled |
|---|---|---|
| `?` | Value | Bound natively by `node:sqlite` |
| `??` | Identifier | Inlined as a double-quoted SQLite identifier before the statement is prepared |

The internal translator walks the SQL character-by-character and **skips placeholders inside string literals, quoted identifiers, and `--` line comments**, so `'?'` in a string and `?` in actual SQL syntax are never confused.

```javascript
const { rows } = await Lib.SqlDB.getRows(
  instance,
  'SELECT id, name FROM ?? WHERE status = ?',
  ['users', 'active']
);
```

---

## Parameter Normalisation

`node:sqlite` accepts only `null | number | bigint | string | Buffer | TypedArray | DataView` for bound parameters. This module converts additional JavaScript types at bind time:

| JavaScript type | Bound as |
|---|---|
| `undefined` | `null` |
| `boolean` | `1` (true) / `0` (false) |
| `Date` | ISO 8601 string (`toISOString()`) |
| Everything else | passed through to `node:sqlite` |

Booleans are stored as integers, dates as ISO text — same as the convention in many SQLite applications. There are no native boolean or date types in SQLite.

---

## `insert_id` Semantics

SQLite provides `sqlite3_last_insert_rowid()` out of the box — no `RETURNING` clause needed (unlike Postgres). For tables with `INTEGER PRIMARY KEY`, `insert_id` equals the row's primary key. For tables without an integer primary key, `insert_id` is the SQLite-assigned rowid.

`INSERT ... RETURNING *` is also supported. When `RETURNING` is present the row data is returned through the read path; `insert_id` is extracted from the returned row's `id` column when present.

---

## Statement Classification

The internal `query()` function inspects the first SQL keyword to decide whether to route through `statement.all()` (rows returned) or `statement.run()` (no rows, just metadata):

| First keyword | Route | Returns |
|---|---|---|
| `SELECT`, `WITH`, `PRAGMA`, `EXPLAIN` | `all()` | Rows |
| Any DML/DDL containing `RETURNING` | `all()` | Rows + affected_rows + insert_id |
| Other DML / DDL (`INSERT`, `UPDATE`, `DELETE`, `CREATE`, `DROP`, etc.) | `run()` | `{ changes, lastInsertRowid }` |

You do not need to think about this when calling the helpers — they pick the right path automatically.

---

## Read Helpers

Typed wrappers over the internal `query()` for common SELECT shapes. Prefer the typed helpers (`getRow`, `getRows`, `getValue`) when the result shape is known; use `get` only when the caller cannot know up-front whether the result will be a scalar, a row, a rows array, or null.

### `getRow`

```javascript
async getRow(instance, sql, params) → { success, row, error }
```

Run a `SELECT` and return the **first row**, or `null` if there are no rows.

| Parameter | Type | Description |
|---|---|---|
| `instance` | `Object` | Request instance from `Lib.Instance.initialize()` |
| `sql` | `String` | SQL with `?` / `??` placeholders |
| `params` | `Array` *(optional)* | Placeholder values |

**Returns:** `{ success: true, row: Object|null, error: null }` or `{ success: false, row: null, error: {...} }`.

```javascript
const res = await Lib.SqlDB.getRow(
  instance,
  'SELECT id, name, email FROM ?? WHERE id = ?',
  ['users', 42]
);
```

### `getRows`

```javascript
async getRows(instance, sql, params) → { success, rows, count, error }
```

Run a `SELECT` and return **all rows** as an array, plus a `count` for convenience.

**Returns:** `{ success: true, rows: Array, count: Number, error: null }` or `{ success: false, rows: [], count: 0, error: {...} }`.

```javascript
const res = await Lib.SqlDB.getRows(
  instance,
  'SELECT id, name FROM ?? WHERE status = ? ORDER BY name',
  ['users', 'active']
);
console.log(`${res.count} active users`);
```

### `getValue`

```javascript
async getValue(instance, sql, params) → { success, value, error }
```

Return the **first column of the first row** as a scalar. Useful for `COUNT(*)`, `SUM(...)`, single-column lookups.

**Returns:** `{ success: true, value: Any, error: null }` or `{ success: false, value: null, error: {...} }`.

```javascript
const res = await Lib.SqlDB.getValue(
  instance,
  'SELECT COUNT(*) FROM ?? WHERE created_at > ?',
  ['users', new Date('2026-01-01')]
);
```

### `get`

```javascript
async get(instance, sql, params) → { success, result, has_multiple_rows, error }
```

**Ambiguous auto-shaping.** Returns the result in the most appropriate shape:

| Rows × columns | `result` | `has_multiple_rows` |
|---|---|---|
| 0 rows | `null` | `false` |
| 1 row × 1 column | the scalar value | `false` |
| 1 row × many columns | the row object | `false` |
| many rows | the array of rows | `true` |

Use `get` only when the caller does not know the expected shape up-front. For production code prefer `getRow` / `getRows` / `getValue`.

---

## Write Helper

### `write`

```javascript
async write(instance, sql, params) → { success, affected_rows, insert_id, error }
```

Polymorphic INSERT / UPDATE / DELETE runner. Two calling shapes:

**Single statement** — pass a SQL string with optional params:

```javascript
const res = await Lib.SqlDB.write(
  instance,
  'INSERT INTO ?? (name, email) VALUES (?, ?)',
  ['users', 'Alice', 'alice@example.com']
);
console.log(res.insert_id);   // primary key, via sqlite3_last_insert_rowid()
```

**Atomic transaction** — pass an array of SQL strings (built with `buildQuery`) or `{ sql, params }` objects. The whole array runs inside `BEGIN` / `COMMIT` / `ROLLBACK`:

```javascript
const sql = [
  Lib.SqlDB.buildQuery('INSERT INTO ?? (name) VALUES (?)', ['users', 'Bob']),
  Lib.SqlDB.buildQuery('UPDATE ?? SET count = count + ? WHERE id = ?',
    ['stats', 1, 42])
];
const res = await Lib.SqlDB.write(instance, sql);
console.log(res.affected_rows);   // summed across all statements
console.log(res.insert_id);       // last lastInsertRowid seen
```

**Semantics:**

- `affected_rows` is summed across statements (count of rows inserted, updated, or deleted).
- `insert_id` is the last `lastInsertRowid` seen. `null` for transactions that did not insert.
- Empty array (`[]`) or `null` / `undefined` SQL is a no-op — returns `{ success: true, affected_rows: 0, insert_id: null }`.
- On transaction failure the entire batch rolls back; `error` describes the failure.

---

## Manual Transactions

SQLite has a single handle per loader instance (no pool). `getClient` / `releaseClient` are kept for API parity with MySQL and Postgres — `getClient` returns the same handle every call, and `releaseClient` is a no-op. Use them when application logic needs to interleave with SQL statements; for straightforward all-or-nothing transactions, prefer the array form of `write()`.

### `getClient`

```javascript
async getClient(instance) → { success, client, error }
```

Returns the underlying `DatabaseSync` handle for manual transaction control. The caller is responsible for `BEGIN` / `COMMIT` / `ROLLBACK` (via `client.exec(...)`).

```javascript
const { success, client, error } = await Lib.SqlDB.getClient(instance);
if (!success) { /* handle */ }

try {
  client.exec('BEGIN');
  const stmt = client.prepare('SELECT balance FROM accounts WHERE id = ?');
  const row = stmt.get(accountId);
  if (row.balance < amount) {
    client.exec('ROLLBACK');
    return { success: false, error: 'Insufficient funds' };
  }
  client.prepare('UPDATE accounts SET balance = balance - ? WHERE id = ?')
    .run(amount, accountId);
  client.exec('COMMIT');
} catch (e) {
  client.exec('ROLLBACK');
  throw e;
} finally {
  Lib.SqlDB.releaseClient(client);
}
```

### `releaseClient`

```javascript
releaseClient(client) → void
```

No-op for SQLite — there is no pool to return the handle to. Kept for API parity with MySQL / Postgres. Safe to call with `null` or `undefined`.

---

## Query Builders

Pure functions — no I/O, no `instance` argument. Used to compose SQL strings before they are handed to read or write helpers.

### `buildQuery`

```javascript
buildQuery(sql, params) → String
```

Format `?` / `??` placeholders into a fully-escaped SQLite SQL string. Supports scalar, array (for `IN` clauses), and object (for `SET` / `WHERE`) expansions.

```javascript
const stmt = Lib.SqlDB.buildQuery(
  'INSERT INTO ?? (name, email) VALUES (?, ?)',
  ['users', 'Alice', 'alice@example.com']
);

// IN clause
Lib.SqlDB.buildQuery('SELECT * FROM ?? WHERE id IN (?)', ['users', [1, 2, 3]]);

// SET clause
Lib.SqlDB.buildQuery('UPDATE ?? SET ? WHERE id = ?',
  ['users', { name: 'Bob', email: 'bob@x.com' }, 42]);
```

### `buildRawText`

```javascript
buildRawText(str) → Object
```

Wrap a SQL fragment so `buildQuery` emits it **unescaped**. Useful for `CURRENT_TIMESTAMP`, nested function calls, and other fragments that should not be quoted.

```javascript
const now = Lib.SqlDB.buildRawText('CURRENT_TIMESTAMP');

await Lib.SqlDB.write(
  instance,
  Lib.SqlDB.buildQuery('INSERT INTO ?? SET ?', [
    'audit_log',
    { action: 'login', user_id: 42, created_at: now }
  ])
);
```

### `buildMultiCondition`

```javascript
buildMultiCondition(data, operator) → String
```

Build a condition string from an object of equality predicates. `operator` is `'AND'` (default) or `'OR'`.

```javascript
const where = Lib.SqlDB.buildMultiCondition(
  { status: 'active', tenant_id: 7 },
  'AND'
);
// where is "status = 'active' AND tenant_id = 7"
```

---

## Lifecycle

### `close`

```javascript
async close() → Promise<void>
```

Close the database handle. SQLite's underlying `close` is synchronous — the async signature is kept for API parity with MySQL / Postgres. `CLOSE_TIMEOUT_MS` is unused for SQLite but kept as a config key for parity.

Call once on `SIGTERM` (or in your container shutdown hook):

```javascript
process.on('SIGTERM', async () => {
  await Lib.SqlDB.close();
  process.exit(0);
});
```

For multi-database setups, call `close()` on **each loader instance** separately — handles are not shared.
