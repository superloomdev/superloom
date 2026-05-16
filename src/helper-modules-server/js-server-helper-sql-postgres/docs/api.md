# API Reference. `js-server-helper-sql-postgres`

Every exported function with its signature, parameters, return shape, semantics, and examples. For configuration keys and environment variables see [Configuration](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-sql-postgres/docs/configuration.md).

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
- [Query Builders (pure, no I/O)](#query-builders-pure-no-io)
  - [`buildQuery`](#buildquery)
  - [`buildRawText`](#buildrawtext)
  - [`buildMultiCondition`](#buildmulticondition)
- [Lifecycle](#lifecycle)
  - [`close`](#close)
- [Spatial Data (PostGIS)](#spatial-data-postgis)

---

## Conventions

- Every I/O function accepts an `instance` (from `Lib.Instance.initialize()`) as its first argument. This lets each query be timed against the active request via `instance.time_ms` and routed through `Lib.Debug.performanceAuditLog`.
- Every return value follows the `{ success, ...data, error }` envelope. `success` is always a boolean; `error` is `null` on success or a `{ type, message }` object on failure. Functions never `throw` for operational errors. Programmer errors (wrong argument types) still throw.
- The factory returns an independent instance per loader call. Two loader calls = two pools = two independent lifecycles. See [Multi-Database Setup](configuration.md#multi-database-setup) for usage.

## Placeholders

Two placeholder symbols, identical to `@superloomdev/js-server-helper-sql-mysql` and `@superloomdev/js-server-helper-sql-sqlite`:

| Symbol | Meaning | Example |
|---|---|---|
| `?`  | Value (bound parameter) | `'WHERE id = ?'` with params `[42]` |
| `??` | Identifier (table/column name) | `'SELECT * FROM ??'` with params `['users']` |

At query time the wrapper translates `?` to Postgres-native `$1, $2, …` and inlines `??` as a double-quoted identifier (`"users"`). The translator is quote-aware. It skips placeholders inside string literals (`'?'`), double-quoted identifiers (`"col?"`), and `--` line comments.

## `insert_id` Semantics

Postgres does not have `LAST_INSERT_ID()`. The module emulates MySQL's behaviour by reading the `id` column returned by `RETURNING`:

| Pattern | `insert_id` value |
|---|---|
| `INSERT ... RETURNING id` | New primary key |
| `INSERT ...` (no RETURNING) | `null` |
| `INSERT ... RETURNING *` | The full row goes to the read path; `insert_id` extracted from the `id` column if present |

If your primary key column is not literally named `id`, alias it: `RETURNING user_id AS id`.

---

## Read Helpers

### `getRow`

Return the first row of a SELECT, or `null` if there are no rows.

```javascript
getRow(instance, sql, params?) -> Promise<{ success, row, error }>
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `instance` | `Object` | Yes | Request instance from `Lib.Instance.initialize()` |
| `sql` | `String` | Yes | SQL with `?`/`??` placeholders |
| `params` | `Array` | No | Placeholder values, in order |

**Success return:**

```javascript
{ success: true,  row: { id: 1, name: 'Alice' }, error: null }
{ success: true,  row: null,                       error: null }  // no rows
```

**Failure return:**

```javascript
{ success: false, row: null, error: { type, message } }
```

**Example:**

```javascript
const { success, row } = await Lib.SqlDB.getRow(
  instance,
  'SELECT * FROM ?? WHERE email = ?',
  ['users', 'alice@example.com']
);
```

---

### `getRows`

Return every row of a SELECT plus a count.

```javascript
getRows(instance, sql, params?) -> Promise<{ success, rows, count, error }>
```

**Success return:**

```javascript
{ success: true, rows: [ { id: 1, name: 'Alice' }, ... ], count: 12, error: null }
{ success: true, rows: [],                                  count: 0,  error: null }
```

**Failure return:**

```javascript
{ success: false, rows: [], count: 0, error: { type, message } }
```

**Example:**

```javascript
const { rows, count } = await Lib.SqlDB.getRows(
  instance,
  'SELECT id, name FROM ?? WHERE status = ? ORDER BY id',
  ['users', 'active']
);
```

---

### `getValue`

Return the first column of the first row as a scalar. Useful for `COUNT(*)`, `MAX(...)`, single-value lookups.

```javascript
getValue(instance, sql, params?) -> Promise<{ success, value, error }>
```

**Success return:**

```javascript
{ success: true, value: 42,    error: null }
{ success: true, value: null,  error: null }  // no rows, or NULL column value
```

**Example:**

```javascript
const { value: total } = await Lib.SqlDB.getValue(
  instance,
  'SELECT COUNT(*) FROM ?? WHERE status = ?',
  ['users', 'active']
);
```

---

### `get`

Auto-shape the result based on what came back. Use only when the caller does not know the shape upfront. Prefer `getRow` / `getRows` / `getValue` when the shape is known.

```javascript
get(instance, sql, params?) -> Promise<{ success, result, has_multiple_rows, error }>
```

Shape rules:

| Result shape | Returned `result` | `has_multiple_rows` |
|---|---|---|
| 0 rows | `null` | `false` |
| 1 row, 1 column | scalar value | `false` |
| 1 row, N columns | row object | `false` |
| N rows | row array | `true` |

**Failure return:**

```javascript
{ success: false, result: null, has_multiple_rows: false, error: { type, message } }
```

---

## Write Helper

### `write`

Polymorphic `INSERT` / `UPDATE` / `DELETE` runner. Accepts a single SQL string or an array of statements (atomic transaction).

```javascript
write(instance, sql, params?) -> Promise<{ success, affected_rows, insert_id, error }>
```

**Forms:**

| `sql` value | Behaviour |
|---|---|
| `String` | Single statement, optional `params` array |
| `Array<String>` | Multiple pre-built statements, run inside `BEGIN/COMMIT` |
| `Array<{ sql, params }>` | Multiple parameterised statements, run inside `BEGIN/COMMIT` |
| Mixed array | Both forms in the same array are supported |

**Success return:**

```javascript
{ success: true,  affected_rows: 1, insert_id: 42, error: null }
{ success: true,  affected_rows: 3, insert_id: null, error: null }  // UPDATE / DELETE, or INSERT without RETURNING
```

**Failure return:**

```javascript
{ success: false, affected_rows: 0, insert_id: null, error: { type, message } }
```

**Semantics:**

- `affected_rows` is summed across statements in a transaction.
- `insert_id` is the last seen `RETURNING id` value across statements.
- Any statement failure rolls back the whole transaction.

**Examples. Single statement:**

```javascript
const res = await Lib.SqlDB.write(
  instance,
  'INSERT INTO ?? (name, email) VALUES (?, ?) RETURNING id',
  ['users', 'Alice', 'alice@example.com']
);
console.log(res.insert_id);   // new primary key
```

**Examples. Atomic transaction:**

```javascript
const sql = [
  Lib.SqlDB.buildQuery('INSERT INTO ?? (name) VALUES (?)', ['users', 'Bob']),
  Lib.SqlDB.buildQuery('UPDATE ?? SET count = count + ? WHERE id = ?',
    ['stats', 1, 42])
];
await Lib.SqlDB.write(instance, sql);
```

---

## Manual Transactions

For flows that need to interleave business logic between SQL statements (e.g. read a value, decide what to write, write it), use the `getClient` / `releaseClient` pair. The caller owns `BEGIN`, `COMMIT`, `ROLLBACK`, and the `releaseClient` call.

### `getClient`

Check out a dedicated pool client.

```javascript
getClient(instance) -> Promise<{ success, client, error }>
```

**Success return:** `{ success: true, client: <pg.PoolClient>, error: null }`
**Failure return:** `{ success: false, client: null, error: { type, message } }`

The `client` is a raw `pg.PoolClient`. You can call `client.query(...)` directly.

### `releaseClient`

Return the client to the pool. Safe on `null` (no-op).

```javascript
releaseClient(client) -> void
```

**Pattern:**

```javascript
const { client } = await Lib.SqlDB.getClient(instance);
try {
  await client.query('BEGIN');
  const { rows } = await client.query('SELECT balance FROM accounts WHERE id = $1 FOR UPDATE', [acct_id]);
  if (rows[0].balance < amount) {
    await client.query('ROLLBACK');
    return { success: false, error: 'INSUFFICIENT_FUNDS' };
  }
  await client.query('UPDATE accounts SET balance = balance - $1 WHERE id = $2', [amount, acct_id]);
  await client.query('COMMIT');
} catch (err) {
  await client.query('ROLLBACK');
  throw err;
} finally {
  Lib.SqlDB.releaseClient(client);
}
```

---

## Query Builders (pure, no I/O)

Builders compile placeholder SQL into fully-escaped Postgres strings. They are synchronous and do not touch the pool. Useful for pre-building transaction arrays or composing nested fragments.

### `buildQuery`

Compile a `?`/`??` SQL string into a Postgres-ready, fully-escaped string.

```javascript
buildQuery(sql, params) -> String
```

| `params[i]` value | Inlining |
|---|---|
| scalar (string / number / boolean / Date / null) | escaped literal |
| `Array` (e.g. `[1, 2, 3]`) | `(1, 2, 3)`. Useful for `WHERE x IN ?` |
| `Object` (e.g. `{ a: 1, b: 'x' }`) | `"a" = 1, "b" = 'x'`. Useful for `SET ?` |
| return value of `buildRawText(...)` | inlined unescaped |

**Example:**

```javascript
const sql = Lib.SqlDB.buildQuery(
  'SELECT * FROM ?? WHERE id IN ?',
  ['users', [1, 2, 3]]
);
// SELECT * FROM "users" WHERE id IN (1, 2, 3)
```

### `buildRawText`

Wrap a raw SQL fragment so it bypasses escaping when passed to `buildQuery`. Use for spatial functions, nested subqueries, or any expression you have already escaped yourself.

```javascript
buildRawText(str) -> Object   // opaque wrapper
```

**Example:**

```javascript
const point = Lib.SqlDB.buildRawText(
  "ST_GeomFromText('POINT(28.6139 77.2090)', 4326)"
);

await Lib.SqlDB.write(
  instance,
  Lib.SqlDB.buildQuery(
    'INSERT INTO address (line1, point, latitude, longitude) VALUES (?, ?, ?, ?)',
    ['221B', point, 28.6139, 77.2090]
  )
);
```

### `buildMultiCondition`

Join an object's key-value pairs into a `k1 = v1 AND k2 = v2` fragment. Useful when filter columns are dynamic.

```javascript
buildMultiCondition(data, operator?) -> String
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `data` | `Object` | - | `{ status: 'active', role: 'admin' }` |
| `operator` | `String` | `'AND'` | `'AND'` or `'OR'` |

**Example:**

```javascript
const where = Lib.SqlDB.buildMultiCondition({ status: 'active', role: 'admin' });
// "status" = 'active' AND "role" = 'admin'
```

---

## Lifecycle

### `close`

Gracefully drain and close the connection pool. Call on `SIGTERM` to ensure in-flight queries finish before the process exits.

```javascript
close() -> Promise<void>
```

Behaviour:

1. Waits up to `CONFIG.CLOSE_TIMEOUT_MS` (default 5000 ms) for active queries to finish.
2. Force-destroys any remaining connections after the timeout.
3. Resolves once the pool is fully closed.

**Example:**

```javascript
process.on('SIGTERM', async () => {
  await Lib.SqlDB.close();
  process.exit(0);
});
```

---

## Spatial Data (PostGIS)

Spatial SQL works through `buildRawText()`. No dedicated helpers needed. Wrap any `ST_*` expression in `buildRawText` and pass it as a placeholder value:

```javascript
const point = Lib.SqlDB.buildRawText(
  "ST_GeomFromText('POINT(28.6139 77.2090)', 4326)"
);

await Lib.SqlDB.write(
  instance,
  Lib.SqlDB.buildQuery(
    'INSERT INTO address (line1, point, latitude, longitude) VALUES (?, ?, ?, ?)',
    ['221B', point, 28.6139, 77.2090]
  )
);
```

For reads, `ST_AsGeoJSON(...)` returns text that you can `JSON.parse` in your service layer:

```javascript
const { row } = await Lib.SqlDB.getRow(
  instance,
  'SELECT line1, ST_AsGeoJSON(point) AS geo FROM ?? WHERE id = ?',
  ['address', 1]
);
const geometry = JSON.parse(row.geo);
```
