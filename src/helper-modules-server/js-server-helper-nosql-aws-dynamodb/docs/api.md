# API Reference. `js-server-helper-nosql-aws-dynamodb`

Every exported function with its signature, parameters, return shape, semantics, and examples. For configuration keys, credentials, IAM permissions, and runtime patterns see [Configuration](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-nosql-aws-dynamodb/docs/configuration.md).

## On This Page

- [Conventions](#conventions)
- [Three-Layer Pattern](#three-layer-pattern)
- [Command Builders](#command-builders) *(pure, no I/O)*
  - [`commandBuilderForAddRecord`](#commandbuilderforaddrecord)
  - [`commandBuilderForUpdateRecord`](#commandbuilderforupdaterecord)
  - [`commandBuilderForDeleteRecord`](#commandbuilderfordeleterecord)
- [Command Executors](#command-executors) *(async I/O)*
  - [`commandAddRecord`](#commandaddrecord)
  - [`commandUpdateRecord`](#commandupdaterecord)
  - [`commandDeleteRecord`](#commanddeleterecord)
- [Single-Record CRUD](#single-record-crud)
  - [`getRecord`](#getrecord)
  - [`writeRecord`](#writerecord)
  - [`updateRecord`](#updaterecord)
  - [`deleteRecord`](#deleterecord)
- [Query / Count / Scan](#query--count--scan)
  - [`query`](#query)
  - [`count`](#count)
  - [`scan`](#scan)
- [Batch Operations](#batch-operations)
  - [`batchGetRecords`](#batchgetrecords)
  - [`batchWriteRecords`](#batchwriterecords)
  - [`batchDeleteRecords`](#batchdeleterecords)
  - [`batchWriteAndDeleteRecords`](#batchwriteanddeleterecords)
- [Transactions](#transactions)
  - [`transactWriteRecords`](#transactwriterecords)
- [Table Management](#table-management)
  - [`createTable`](#createtable)
  - [`deleteTable`](#deletetable)

---

## Conventions

All I/O functions are **async** and accept `instance` as their first argument. The `instance` is built once per request by `Lib.Instance.initialize()` and threaded through the call chain; it is what gives every database operation a stable `instance.time_ms` for request-level timing.

Every function returns a consistent response envelope:

```javascript
{ success: true,  /* result fields */, error: null }
{ success: false, /* zeroed fields */, error: { type, message } }
```

Operational failures (throttling, conditional-check failure, validation error) never throw. They come back through `error` so the caller can branch without a try/catch. Programming errors (bad arguments, missing peers) still throw.

---

## Three-Layer Pattern

This module exposes its single-record operations through three layers, each useful in different situations:

| Layer | Functions | When to use |
|---|---|---|
| **Builder** (pure) | `commandBuilderForAddRecord`, `commandBuilderForUpdateRecord`, `commandBuilderForDeleteRecord` | Build a command object for use inside `transactWriteRecords`. Or compose commands ahead of time and execute later. |
| **Executor** (async) | `commandAddRecord`, `commandUpdateRecord`, `commandDeleteRecord` | Execute a pre-built command. Pair with the builders when you need fine-grained control. |
| **Convenience** (async) | `getRecord`, `writeRecord`, `updateRecord`, `deleteRecord` | Build + execute in one call. Use for straightforward single-record operations. |

Most application code uses the **Convenience** layer. The **Builder + Executor** layers exist primarily so that `transactWriteRecords` can accept pre-built command arrays.

---

## Command Builders

Builders are **pure functions** that produce DynamoDB service-parameter objects. They do not call AWS. They prepare arguments that an executor or transaction will send.

### `commandBuilderForAddRecord`

```javascript
commandBuilderForAddRecord(table, item) → Object
```

Build a `Put` service-params object. Returns `{ TableName, Item }`. Pair with `commandAddRecord` or pass into `transactWriteRecords`.

```javascript
const add_cmd = Lib.DynamoDB.commandBuilderForAddRecord(
  'audit_log',
  { pk: 'log_1', action: 'ship', timestamp: Date.now() }
);
```

### `commandBuilderForUpdateRecord`

```javascript
commandBuilderForUpdateRecord(table, key, update_data, remove_keys, increment, decrement, return_state) → Object
```

Build an `Update` service-params object with `SET` / `REMOVE` / `INCREMENT` / `DECREMENT` operations. All operations after `table` and `key` are optional. Pass `null` or `undefined` to skip.

| Parameter | Purpose |
|---|---|
| `update_data` | Map of fields to `SET` to specific values |
| `remove_keys` | Array of field names to `REMOVE` |
| `increment` | Map of field names to amounts to add |
| `decrement` | Map of field names to amounts to subtract |
| `return_state` | `'NONE'` / `'ALL_OLD'` / `'UPDATED_OLD'` / `'ALL_NEW'` / `'UPDATED_NEW'`. Default `'NONE'` |

Uses `ExpressionAttributeNames` (`#n1`, `#n2`, …) under the hood to avoid DynamoDB reserved-word conflicts on arbitrary field names.

```javascript
const upd_cmd = Lib.DynamoDB.commandBuilderForUpdateRecord(
  'orders',
  { pk: 'ord_1' },
  { status: 'shipped', shipped_at: Date.now() },   // SET
  ['draft_notes'],                                  // REMOVE
  { views: 1 },                                     // INCREMENT
  null,                                             // no DECREMENT
  'ALL_NEW'
);
```

> *Note:* `list_append`, `if_not_exists`, set-type operations, and `ConditionExpression` are not yet covered by the builder. They will be added as production demand surfaces.

### `commandBuilderForDeleteRecord`

```javascript
commandBuilderForDeleteRecord(table, key) → Object
```

Build a `Delete` service-params object. Returns `{ TableName, Key }`.

```javascript
const del_cmd = Lib.DynamoDB.commandBuilderForDeleteRecord(
  'pending_orders',
  { pk: 'ord_1' }
);
```

---

## Command Executors

Executors are **async** and accept a pre-built `service_params` object from a builder. Use these when you have built commands ahead of time and want to execute one at a time (without using `transactWriteRecords`).

### `commandAddRecord`

```javascript
async commandAddRecord(instance, service_params) → { success, error }
```

Execute a pre-built `Put` command.

### `commandUpdateRecord`

```javascript
async commandUpdateRecord(instance, service_params) → { success, attributes, error }
```

Execute a pre-built `Update` command. `attributes` reflects whatever was requested in `return_state` (empty unless `return_state` was non-`NONE`).

### `commandDeleteRecord`

```javascript
async commandDeleteRecord(instance, service_params) → { success, error }
```

Execute a pre-built `Delete` command.

---

## Single-Record CRUD

The convenience layer. Builds and executes in a single call. Use these for ordinary single-record operations.

### `getRecord`

```javascript
async getRecord(instance, table, key) → { success, item, error }
```

Get a single record by primary key. `key` is the full primary key object (partition key alone for tables without a sort key; partition + sort otherwise). `item` is `null` if no record matches.

```javascript
const res = await Lib.DynamoDB.getRecord(instance, 'users', { pk: 'user_001' });
if (res.item === null) { /* not found */ }
```

### `writeRecord`

```javascript
async writeRecord(instance, table, item) → { success, error }
```

Write (create or replace) a record. **Always upsert.** There is no separate insert vs update path at the API surface. Uses `commandBuilderForAddRecord` + `commandAddRecord` internally.

```javascript
await Lib.DynamoDB.writeRecord(
  instance,
  'users',
  { pk: 'user_001', name: 'Alice', status: 'active' }
);
```

### `updateRecord`

```javascript
async updateRecord(instance, table, key, update_data, remove_keys, increment, decrement, return_state) → { success, attributes, error }
```

Update a record with the same structured parameters as `commandBuilderForUpdateRecord`. Internally calls the builder and the executor.

```javascript
await Lib.DynamoDB.updateRecord(
  instance,
  'orders',
  { pk: 'ord_1' },
  { status: 'shipped' },
  null,
  { views: 1 }
);
```

### `deleteRecord`

```javascript
async deleteRecord(instance, table, key) → { success, error }
```

Delete a single record. Uses `commandBuilderForDeleteRecord` + `commandDeleteRecord` internally.

---

## Query / Count / Scan

### `query`

```javascript
async query(instance, table, params) → { success, items, count, last_key, error }
```

Full-featured Query. `params` is an object:

| Field | Type | Purpose |
|---|---|---|
| `pk` | `Any` | Partition key value |
| `pkName` | `String` | Partition key attribute name |
| `skCondition` | `String` *(optional)* | Sort-key condition: `'='`, `'>'`, `'<'`, `'>='`, `'<='`, `'BEGINS_WITH'`, `'BETWEEN'` |
| `skValues` | `Array` *(optional)* | Values for the sort-key condition (one value, or two for `BETWEEN`) |
| `limit` | `Number` *(optional)* | Maximum items to return |
| `indexName` | `String` *(optional)* | Query a GSI / LSI instead of the base table |
| `startKey` | `Object` *(optional)* | `last_key` from a previous page. For pagination |
| `scanForward` | `Boolean` *(optional)* | `false` to reverse sort-key direction |
| `fields` | `Array<String>` *(optional)* | Limit returned attributes (`ProjectionExpression`) |
| `select` | `String` *(optional)* | `'ALL_ATTRIBUTES'` / `'COUNT'` / `'SPECIFIC_ATTRIBUTES'` |

`last_key` is present when there are more results to page through.

### `count`

```javascript
async count(instance, table, params) → { success, count, error }
```

Same parameters as `query`, but delegates with `Select: 'COUNT'`. Returns only the matched count, no items.

### `scan`

```javascript
async scan(instance, table, filter) → { success, items, count, error }
```

Scan the entire table. `filter` is optional and uses a structured shape:

```javascript
{
  expression: '#status = :st',
  names:  { '#status': 'status' },
  values: { ':st': 'active' }
}
```

Pass `null` / `undefined` to read every item without filtering. Use sparingly. Scans are expensive on large tables.

---

## Batch Operations

All batch functions accept a `{ tableName: [...] }` map. Limits are enforced by AWS (25 items per `BatchWriteItem`, 100 per `BatchGetItem`); the helpers chunk automatically.

### `batchGetRecords`

```javascript
async batchGetRecords(instance, keysByTable) → { success, items, error }
```

Batch get from one or more tables. `keysByTable = { tableName: [key1, key2, ...] }`. `items` is shaped the same way: `{ tableName: [item1, item2, ...] }`.

### `batchWriteRecords`

```javascript
async batchWriteRecords(instance, itemsByTable) → { success, error }
```

Batch insert with auto 25-item chunking. The helper recurses across chunks until everything is written.

```javascript
await Lib.DynamoDB.batchWriteRecords(instance, {
  users: [
    { pk: 'u1', name: 'Alice' },
    { pk: 'u2', name: 'Bob' },
    /* ... up to thousands; the helper chunks 25 at a time */
  ]
});
```

### `batchDeleteRecords`

```javascript
async batchDeleteRecords(instance, keysByTable) → { success, error }
```

Batch delete with auto 25-item chunking.

### `batchWriteAndDeleteRecords`

```javascript
async batchWriteAndDeleteRecords(instance, requestsByTable) → { success, unprocessed, error }
```

Mixed put/delete per table. Each operation is `{ put: item }` or `{ delete: key }`.

```javascript
await Lib.DynamoDB.batchWriteAndDeleteRecords(instance, {
  users: [
    { put: { pk: 'u3', name: 'New User' } },
    { delete: { pk: 'u1' } }
  ]
});
```

`unprocessed` lists any items that AWS returned as unprocessed (typically due to provisioned-throughput throttling). The helper does **not** auto-retry these. Callers may decide whether to retry or fail.

---

## Transactions

### `transactWriteRecords`

```javascript
async transactWriteRecords(instance, add_records, update_records, delete_records) → { success, error }
```

Atomic multi-table write. Up to 100 actions per call (AWS limit). All three arrays are optional. Pass `null` or `[]` to skip an action type.

Each entry is a pre-built command object from one of the builders:

```javascript
const add_cmd = Lib.DynamoDB.commandBuilderForAddRecord('audit_log', { pk: 'log_1', action: 'ship' });
const upd_cmd = Lib.DynamoDB.commandBuilderForUpdateRecord('orders', { pk: 'ord_1' }, { status: 'shipped' });
const del_cmd = Lib.DynamoDB.commandBuilderForDeleteRecord('pending', { pk: 'ord_1' });

await Lib.DynamoDB.transactWriteRecords(
  instance,
  [add_cmd],
  [upd_cmd],
  [del_cmd]
);
```

The entire transaction commits or rolls back atomically. On failure, `error` describes the conflict (e.g. `TransactionCanceledException`).

---

## Table Management

These functions exist primarily for **application-managed single-table designs** and **test setup / teardown**. Production deployments typically manage tables through Infrastructure-as-Code (Terraform, CloudFormation, CDK).

### `createTable`

```javascript
async createTable(instance, table, params) → { success, already_exists, error }
```

Create a table **idempotently.** `already_exists: true` is returned (with `success: true`) when the table is already there.

| `params` field | Purpose |
|---|---|
| `attribute_definitions` | `[{ name, type: 'S' \| 'N' \| 'B' }]`. Declare key attributes |
| `key_schema` | `[{ name, type: 'HASH' \| 'RANGE' }]`. Primary key shape |
| `billing_mode` *(optional)* | `'PAY_PER_REQUEST'` (default) or `'PROVISIONED'` |
| `global_secondary_indexes` *(optional)* | GSI definitions |

### `deleteTable`

```javascript
async deleteTable(instance, table) → { success, already_absent, error }
```

Delete a table **idempotently.** `already_absent: true` is returned when the table does not exist. Primarily for test teardown.
