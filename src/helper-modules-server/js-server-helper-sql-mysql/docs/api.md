# API Reference. `js-server-helper-sql-mysql`

Every exported function with its signature, parameters, return shape, semantics, and examples. For configuration keys and environment variables see [Configuration](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-sql-mysql/docs/configuration.md).

## On This Page

- [Conventions](#conventions)
- [Placeholders](#placeholders)
- [`insert_id` Semantics](#insert_id-semantics)
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

All I/O functions are **async** and accept `instance` as their first argument. The `instance` is built once per request by `Lib.Instance.initialize()` and threaded through the call chain; it is what gives every database operation a stable `instance.time_ms` for request-level timing.

Every function returns a consistent response envelope:

```javascript
{ success: true,  /* result fields */, error: null }
{ success: false, /* zeroed fields */, error: { type, message } }
```

Operational failures (connection lost, statement timeout, constraint violation) never throw. They come back through `error` so the caller can branch without a try/catch. Programming errors (bad arguments, missing peers) still throw, because those are bugs.

---

## Placeholders

Placeholders are **native to `mysql2`** and pass through to the driver unchanged. No translation step.

| Token | Meaning | Example |
|---|---|---|
| `?` | Value (escaped) | `SELECT * FROM users WHERE id = ?` |
| `??` | Identifier (quoted) | `SELECT * FROM ?? WHERE active = ?` |

Identifiers may be a single string (`'users'`) or a `Database.Table` pair (`['app_db', 'users']`).

```javascript
const { rows } = await Lib.SqlDB.getRows(
  instance,
  'SELECT id, name FROM ?? WHERE status = ?',
  ['users', 'active']
);
```

---

## `insert_id` Semantics

MySQL populates `insert_id` automatically from the driver's `lastInsertId` value. No `RETURNING` clause needed (unlike Postgres). For tables with `AUTO_INCREMENT` primary keys, `insert_id` equals the new primary key. For tables without an auto-increment column, `insert_id` is `0`.

When `write()` runs a transaction (array form), `insert_id` is the **last seen** auto-increment ID across the statements.

---

## Read Helpers

Typed wrappers over the internal `query()` for common SELECT shapes. Prefer the typed helpers (`getRow`, `getRows`, `getValue`) when the result shape is known; use `get` only when the caller cannot know up-front whether the result will be a scalar, a row, a rows array, or null.

### `getRow`

```javascript
async getRow(instance, sql, params) → { success, row, error }
```

Run a `SELECT` and return the **first row**, or `null` if there are no rows. The result is always a single row object (or `null`) - never an array, never a scalar.

| Parameter | Type | Description |
|---|---|---|
| `instance` | `Object` | Request instance from `Lib.Instance.initialize()` |
| `sql` | `String` | SQL with `?` / `??` placeholders, or a pre-built string from `buildQuery` |
| `params` | `Array` *(optional)* | Placeholder values |

**Returns:** `{ success: true, row: Object|null, error: null }` or `{ success: false, row: null, error: {...} }`.

```javascript
const res = await Lib.SqlDB.getRow(
  instance,
  'SELECT id, name, email FROM ?? WHERE id = ?',
  ['users', 42]
);

if (!res.success) { /* handle error */ }
if (res.row === null) { /* user 42 doesn't exist */ }
console.log(res.row.email);
```

### `getRows`

```javascript
async getRows(instance, sql, params) → { success, rows, count, error }
```

Run a `SELECT` and return **all matching rows** as an array, plus a `count` for convenience. `rows` is always an array (possibly empty); `count` is always a number.

| Parameter | Type | Description |
|---|---|---|
| `instance` | `Object` | Request instance |
| `sql` | `String` | SQL with placeholders |
| `params` | `Array` *(optional)* | Placeholder values |

**Returns:** `{ success: true, rows: Array, count: Number, error: null }` or `{ success: false, rows: [], count: 0, error: {...} }`.

```javascript
const res = await Lib.SqlDB.getRows(
  instance,
  'SELECT id, name FROM ?? WHERE status = ? ORDER BY name',
  ['users', 'active']
);

console.log(`${res.count} active users`);
res.rows.forEach(r => console.log(r.id, r.name));
```

### `getValue`

```javascript
async getValue(instance, sql, params) → { success, value, error }
```

Return the **first column of the first row** as a scalar. Useful for `COUNT(*)`, `SUM(...)`, `MAX(...)`, single-column lookups. If there are no rows the value is `null` (not an error).

| Parameter | Type | Description |
|---|---|---|
| `instance` | `Object` | Request instance |
| `sql` | `String` | SQL with placeholders |
| `params` | `Array` *(optional)* | Placeholder values |

**Returns:** `{ success: true, value: Any, error: null }` or `{ success: false, value: null, error: {...} }`.

```javascript
const res = await Lib.SqlDB.getValue(
  instance,
  'SELECT COUNT(*) FROM ?? WHERE created_at > ?',
  ['users', new Date('2026-01-01')]
);

console.log(`${res.value} new users this year`);
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

Use `get` when the caller does not know the expected shape up-front (for example, an admin tool that runs arbitrary SQL). For production code prefer `getRow` / `getRows` / `getValue`. They are explicit about what they expect.

---

## Write Helper

### `write`

```javascript
async write(instance, sql, params) → { success, affected_rows, insert_id, error }
```

Polymorphic INSERT / UPDATE / DELETE runner. Two calling shapes:

**Single statement.** Pass a SQL string with optional params:

```javascript
const res = await Lib.SqlDB.write(
  instance,
  'INSERT INTO ?? (name, email) VALUES (?, ?)',
  ['users', 'Alice', 'alice@example.com']
);
console.log(res.insert_id);   // new primary key
```

**Atomic transaction.** Pass an array. Each entry is either a SQL string (built with `buildQuery`) or a `{ sql, params }` object. The whole array runs inside `BEGIN` / `COMMIT` / `ROLLBACK`.

```javascript
const sql = [
  Lib.SqlDB.buildQuery('INSERT INTO ?? (name) VALUES (?)', ['users', 'Bob']),
  Lib.SqlDB.buildQuery('UPDATE ?? SET count = count + ? WHERE id = ?',
    ['stats', 1, 42])
];
const res = await Lib.SqlDB.write(instance, sql);
console.log(res.affected_rows);   // summed across all statements
console.log(res.insert_id);       // last auto-increment seen
```

**Semantics:**

- `affected_rows` is the count of rows inserted, updated, or deleted. For SELECT statements (if any are passed) it is `0`.
- `insert_id` is the last `AUTO_INCREMENT` value generated. `null` for UPDATE / DELETE only.
- Empty array (`[]`) or `null` / `undefined` SQL is a no-op. Returns `{ success: true, affected_rows: 0, insert_id: null }`.
- On transaction failure the entire batch rolls back; `error` describes the failure.

---

## Manual Transactions

Use `getClient` + manual `BEGIN` / `COMMIT` / `ROLLBACK` when application logic needs to interleave with SQL statements (read a row, decide based on application state, write conditionally). For straightforward all-or-nothing transactions, prefer the array form of `write()`.

### `getClient`

```javascript
async getClient(instance) → { success, client, error }
```

Acquire a dedicated connection from the pool. The caller is responsible for `BEGIN` / `COMMIT` / `ROLLBACK` and **must call `releaseClient(client)`** when done, even on error paths.

```javascript
const { success, client, error } = await Lib.SqlDB.getClient(instance);
if (!success) { /* handle */ }

try {
  await client.beginTransaction();
  const [rows] = await client.query('SELECT balance FROM accounts WHERE id = ? FOR UPDATE', [accountId]);
  if (rows[0].balance < amount) {
    await client.rollback();
    return { success: false, error: 'Insufficient funds' };
  }
  await client.query('UPDATE accounts SET balance = balance - ? WHERE id = ?', [amount, accountId]);
  await client.commit();
} catch (e) {
  await client.rollback();
  throw e;
} finally {
  Lib.SqlDB.releaseClient(client);
}
```

### `releaseClient`

```javascript
releaseClient(client) → void
```

Return the client to the pool. Safe to call with `null` or `undefined`. Synchronous.

---

## Query Builders

Pure functions. No I/O, no `instance` argument. Used to compose SQL strings before they are handed to read or write helpers.

### `buildQuery`

```javascript
buildQuery(sql, params) → String
```

Format `?` / `??` placeholders into a fully-escaped SQL string. Thin wrapper over `mysql2.format()`. Useful when you want to pre-build a statement to pass into the array form of `write()`.

```javascript
const stmt = Lib.SqlDB.buildQuery(
  'INSERT INTO ?? (name, email) VALUES (?, ?)',
  ['users', 'Alice', 'alice@example.com']
);
// stmt is "INSERT INTO `users` (name, email) VALUES ('Alice', 'alice@example.com')"
```

**`?` supports:** scalars, arrays (expanded as `(v1, v2, v3)` for `IN` clauses), and objects (expanded as `column1 = value1, column2 = value2` for `SET` / `WHERE` clauses).

```javascript
// IN clause
Lib.SqlDB.buildQuery('SELECT * FROM ?? WHERE id IN (?)', ['users', [1, 2, 3]]);
// SET clause
Lib.SqlDB.buildQuery('UPDATE ?? SET ? WHERE id = ?', ['users', { name: 'Bob', email: 'bob@x.com' }, 42]);
```

### `buildRawText`

```javascript
buildRawText(str) → Object
```

Wrap a SQL fragment so `buildQuery` emits it **unescaped**. Equivalent to `mysql2.raw()`. Useful for spatial SQL, `CURRENT_TIMESTAMP`, nested function calls.

```javascript
const point = Lib.SqlDB.buildRawText(
  "ST_GeomFromText('POINT(28.6139 77.2090)', 4326)"
);

await Lib.SqlDB.write(
  instance,
  Lib.SqlDB.buildQuery('INSERT INTO ?? SET ?', [
    'address',
    { line1: '221B', point: point, latitude: 28.6139, longitude: 77.2090 }
  ])
);
```

### `buildMultiCondition`

```javascript
buildMultiCondition(data, operator) → String
```

Build a condition string from an object of equality predicates. `operator` is `'AND'` (default) or `'OR'`. Convenient for building dynamic `WHERE` clauses without hand-stitching SQL.

```javascript
const where = Lib.SqlDB.buildMultiCondition(
  { status: 'active', tenant_id: 7 },
  'AND'
);
// where is "status = 'active' AND tenant_id = 7"

const rows = await Lib.SqlDB.getRows(
  instance,
  `SELECT * FROM ?? WHERE ${where}`,
  ['users']
);
```

---

## Lifecycle

### `close`

```javascript
async close() → Promise<void>
```

Close the pool gracefully. Waits up to `CONFIG.CLOSE_TIMEOUT_MS` (default `5000` ms) for in-flight queries to finish, then force-destroys remaining connections.

Call once on `SIGTERM` (or in your container shutdown hook). After `close()` returns, new query calls will create a fresh pool on demand. `close` does not invalidate the public interface.

```javascript
process.on('SIGTERM', async () => {
  await Lib.SqlDB.close();
  process.exit(0);
});
```

For multi-database setups, call `close()` on **each loader instance** separately. Pools are not shared.
