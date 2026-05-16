# API Reference — `js-server-helper-nosql-mongodb`

Every exported function with its signature, parameters, return shape, semantics, and examples. For configuration keys and runtime patterns see [Configuration](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-nosql-mongodb/docs/configuration.md).

## On This Page

- [Conventions](#conventions)
- [Safety Nets](#safety-nets)
- [Single-Record CRUD](#single-record-crud)
  - [`getRecord`](#getrecord)
  - [`writeRecord`](#writerecord)
  - [`deleteRecord`](#deleterecord)
  - [`updateRecord`](#updaterecord)
- [Query / Count / Scan](#query--count--scan)
  - [`query`](#query)
  - [`count`](#count)
  - [`scan`](#scan)
  - [`deleteRecordsByFilter`](#deleterecordsbyfilter)
- [Batch Operations](#batch-operations)
  - [`batchGetRecords`](#batchgetrecords)
  - [`batchWriteRecords`](#batchwriterecords)
  - [`batchDeleteRecords`](#batchdeleterecords)
  - [`batchWriteAndDeleteRecords`](#batchwriteanddeleterecords)
- [Transactions](#transactions)
  - [`transactWriteRecords`](#transactwriterecords)
- [Indexes](#indexes)
  - [`createIndex`](#createindex)
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

Operational failures (connection lost, duplicate key, validation failure) never throw — they come back through `error` so the caller can branch without a try/catch. Programming errors (bad arguments, missing peers, empty filters where forbidden) still throw, because those are bugs.

---

## Safety Nets

Three functions reject empty filters at runtime to prevent accidental full-collection reads or wipes:

| Function | Behaviour on empty / null / undefined filter |
|---|---|
| `query` | Throws `TypeError` |
| `count` | Throws `TypeError` |
| `deleteRecordsByFilter` | Throws `TypeError` |

If you genuinely want to read every document in a collection, call `scan()` — its name makes the intent explicit at the call site.

---

## Single-Record CRUD

### `getRecord`

```javascript
async getRecord(instance, collection, filter, options) → { success, document, error }
```

Get a single record by filter (typically `{ _id: ... }`). Returns the document, or `null` if no document matches.

| Parameter | Type | Description |
|---|---|---|
| `instance` | `Object` | Request instance from `Lib.Instance.initialize()` |
| `collection` | `String` | Collection name |
| `filter` | `Object` | MongoDB filter document |
| `options` | `Object` *(optional)* | `projection`, `sort`, etc. — passed through to the driver's `findOne` |

**Returns:** `{ success: true, document: Object|null, error: null }` or `{ success: false, document: null, error: {...} }`.

```javascript
const res = await Lib.MongoDB.getRecord(instance, 'users', { _id: 'user_1' });
if (res.document === null) { /* not found */ }
```

### `writeRecord`

```javascript
async writeRecord(instance, collection, filter, document) → { success, matchedCount, modifiedCount, upsertedId, error }
```

Write (create or replace) a single record. **Always upsert** — if the filter matches, the document is replaced; if not, it is inserted.

`filter` identifies the record (typically `{ _id: ... }`). `document` is a full replacement document — do **not** use `$` operators here (use `updateRecord` for that).

```javascript
await Lib.MongoDB.writeRecord(
  instance,
  'users',
  { _id: 'user_1' },
  { _id: 'user_1', name: 'Alice', email: 'alice@example.com', status: 'active' }
);
```

### `deleteRecord`

```javascript
async deleteRecord(instance, collection, filter) → { success, deletedCount, error }
```

Delete a single record matched by `filter` (typically `{ _id: ... }`). `deletedCount` is `0` or `1`.

### `updateRecord`

```javascript
async updateRecord(instance, collection, filter, update) → { success, modifiedCount, error }
```

Update specific fields in a single record. `update` uses MongoDB update operators (`$set`, `$inc`, `$push`, `$unset`, etc.).

```javascript
await Lib.MongoDB.updateRecord(
  instance,
  'users',
  { _id: 'user_1' },
  { $set: { status: 'inactive' }, $inc: { logins: 1 } }
);
```

---

## Query / Count / Scan

### `query`

```javascript
async query(instance, collection, filter, options) → { success, documents, error }
```

Query multiple records. **Throws `TypeError` on empty / null / undefined filter** ([safety net](#safety-nets)). Use `scan()` for intentional full-collection reads.

`options` is passed through to the driver's `find` — `projection`, `sort`, `limit`, `skip`, etc.

```javascript
const res = await Lib.MongoDB.query(
  instance,
  'users',
  { status: 'active' },
  { sort: { created_at: -1 }, limit: 100 }
);
```

### `count`

```javascript
async count(instance, collection, filter) → { success, count, error }
```

Count documents matching `filter`. **Throws `TypeError` on empty filter** ([safety net](#safety-nets)).

### `scan`

```javascript
async scan(instance, collection, filter, options) → { success, documents, count, error }
```

Full-collection read. **Permits empty / null filter** — use this when you intend to read everything. Optional `filter` narrows results. Use sparingly on large collections.

```javascript
const all = await Lib.MongoDB.scan(instance, 'users');
const sorted = await Lib.MongoDB.scan(instance, 'users', { status: 'active' }, { sort: { name: 1 } });
```

### `deleteRecordsByFilter`

```javascript
async deleteRecordsByFilter(instance, collection, filter) → { success, deletedCount, error }
```

Filter-based bulk delete (wraps `deleteMany`). **MongoDB-unique** — there is no DynamoDB equivalent. **Throws `TypeError` on empty filter** ([safety net](#safety-nets)).

```javascript
const res = await Lib.MongoDB.deleteRecordsByFilter(
  instance,
  'sessions',
  { expires_at: { $lt: new Date() } }
);
console.log(`Deleted ${res.deletedCount} expired sessions`);
```

---

## Batch Operations

All batch functions accept a map of `{ collectionName: [...] }`. MongoDB does not natively support cross-collection batch operations, so these functions loop through each collection internally and merge the results — the calling shape stays consistent with the DynamoDB sibling.

### `batchGetRecords`

```javascript
async batchGetRecords(instance, idsByCollection) → { success, documents, error }
```

Batch get by `_id` from one or more collections.

```javascript
const res = await Lib.MongoDB.batchGetRecords(instance, {
  users:  ['user_1', 'user_2'],
  orders: ['order_1', 'order_2', 'order_3']
});
// res.documents.users  = [{ _id: 'user_1',  ... }, { _id: 'user_2', ... }]
// res.documents.orders = [{ _id: 'order_1', ... }, ...]
```

### `batchWriteRecords`

```javascript
async batchWriteRecords(instance, documentsByCollection) → { success, results, error }
```

Batch insert across collections.

```javascript
const res = await Lib.MongoDB.batchWriteRecords(instance, {
  users: [{ _id: 'u1', name: 'John' }, { _id: 'u2', name: 'Jane' }],
  logs:  [{ _id: 'l1', action: 'signup' }]
});
// res.results.users.insertedCount === 2
```

### `batchDeleteRecords`

```javascript
async batchDeleteRecords(instance, idsByCollection) → { success, results, error }
```

Batch delete by explicit `_id` from one or more collections.

```javascript
await Lib.MongoDB.batchDeleteRecords(instance, {
  users:    ['user_1', 'user_2'],
  sessions: ['sess_1']
});
```

### `batchWriteAndDeleteRecords`

```javascript
async batchWriteAndDeleteRecords(instance, operationsByCollection) → { success, results, error }
```

Mixed put/delete via `bulkWrite` per collection. Each operation is `{ put: doc }` or `{ delete: filter }`.

```javascript
await Lib.MongoDB.batchWriteAndDeleteRecords(instance, {
  users: [
    { put: { _id: 'u3', name: 'New User' } },
    { delete: { _id: 'u1' } }
  ]
});
```

---

## Transactions

### `transactWriteRecords`

```javascript
async transactWriteRecords(instance, callback) → { success, result, error }
```

Atomic multi-collection write using MongoDB's Convenient Transaction API (`withSession` + `withTransaction`). The `callback` runs inside a transactional session — all writes inside must pass `{ session }` as an option.

```javascript
const res = await Lib.MongoDB.transactWriteRecords(
  instance,
  async function (session, db) {
    await db.collection('accounts').updateOne(
      { _id: 'acc_1' }, { $inc: { balance: -100 } }, { session }
    );
    await db.collection('accounts').updateOne(
      { _id: 'acc_2' }, { $inc: { balance:  100 } }, { session }
    );
    return { transferred: 100 };
  }
);
// res.result === { transferred: 100 }
```

If any operation inside the callback throws, the entire transaction rolls back; `res.error` describes the failure.

**Requires a replica set.** MongoDB Atlas has replica set enabled by default on all tiers. For local Docker, run `mongod --replSet rs0` (single container, no sync overhead). See [Configuration → Replica-Set Requirement](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-nosql-mongodb/docs/configuration.md#replica-set-requirement-for-transactions).

---

## Indexes

### `createIndex`

```javascript
async createIndex(instance, collection, spec, options) → { success, index_name, error }
```

Create or verify an index. **Idempotent** when the same name + spec is used — calling it repeatedly on application startup is safe.

| Parameter | Type | Description |
|---|---|---|
| `spec` | `Object` | Key map. `{ field: 1 }` ascending, `{ field: -1 }` descending, `{ field: 'text' }` text index |
| `options` | `Object` *(optional)* | `name`, `unique`, `sparse`, `expireAfterSeconds`, etc. |

```javascript
await Lib.MongoDB.createIndex(
  instance,
  'sessions',
  { expires_at: 1 },
  { expireAfterSeconds: 0 }   // TTL index
);
```

---

## Lifecycle

### `close`

```javascript
async close(instance) → { success, error }
```

Close the MongoDB connection for this loader instance. Unlike the DynamoDB sibling (which manages its connections internally via the AWS SDK), MongoDB requires an explicit close to release the pool.

Call once on `SIGTERM`:

```javascript
process.on('SIGTERM', async () => {
  await Lib.MongoDB.close(instance);
  process.exit(0);
});
```

For multi-database setups, call `close()` on **each loader instance** separately — connections are not shared.
