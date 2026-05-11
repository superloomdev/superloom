# @superloomdev/js-server-helper-nosql-mongodb

[![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-brightgreen.svg)](https://nodejs.org)

MongoDB wrapper with CRUD, batch, query, scan, and transaction operations. Lazy-loaded native driver with connection pooling. Factory pattern with per-instance state management. Part of the [Superloom](https://github.com/superloomdev/superloom).

> **Service-dependent module** - requires MongoDB server for testing. See testing tiers below.

## API

| # | Function | Scope | Description |
|---|---|---|---|
| 1 | `getRecord` | single doc | Get by filter |
| 2 | `writeRecord` | single doc | Upsert (insert or replace) |
| 3 | `deleteRecord` | single doc | Delete one |
| 4 | `updateRecord` | single doc | Update with `$set`, `$inc`, etc. |
| 5 | `query` | single collection | Filter required (safety net) |
| 6 | `count` | single collection | Filter required (safety net) |
| 7 | `scan` | single collection | Filter optional |
| 8 | `deleteRecordsByFilter` | single collection | MongoDB-unique filter-based deleteMany |
| 9 | `batchGetRecords` | multi-collection | Get by _id list |
| 10 | `batchWriteAndDeleteRecords` | multi-collection | Mixed put/delete via bulkWrite |
| 11 | `batchWriteRecords` | multi-collection | Batch insert |
| 12 | `batchDeleteRecords` | multi-collection | Delete by _id list |
| 13 | `transactWriteRecords` | multi-collection | Atomic transaction (requires replica set) |
| 14 | `close` | instance | Close connection |

### Factory Pattern
```javascript
const MongoDB = require('@superloomdev/js-server-helper-nosql-mongodb');

const mongo = MongoDB(shared_libs, config);
```

### Single-Record CRUD
```javascript
// Get a single record
const result = await mongo.getRecord(instance, 'users', { _id: userId });

// Write (upsert) a single record
const result = await mongo.writeRecord(instance, 'users',
  { _id: userId },
  { _id: userId, name: 'John', email: 'john@example.com' }
);

// Delete a single record
const result = await mongo.deleteRecord(instance, 'users', { _id: userId });

// Update fields in a single record
const result = await mongo.updateRecord(instance, 'users',
  { _id: userId },
  { $set: { status: 'active' } }
);
```

### Query / Count / Scan
```javascript
// Query (filter required - safety net against accidental full-collection scans)
const result = await mongo.query(instance, 'users', { status: 'active' });

// Count documents matching filter
const result = await mongo.count(instance, 'users', { status: 'active' });

// Scan entire collection (use sparingly on large collections)
const all = await mongo.scan(instance, 'users');

// Scan with filter and options
const sorted = await mongo.scan(instance, 'users', { status: 'active' }, { sort: { name: 1 } });
```

### MongoDB-Unique: Filter-Based Bulk Delete
```javascript
// Delete multiple records matching a filter (no DynamoDB equivalent)
const result = await mongo.deleteRecordsByFilter(instance, 'users', { status: 'inactive' });
// result.deletedCount === 15
```

### Batch Operations (Multi-Collection)

MongoDB does not natively support cross-collection batch operations. These functions internally loop through each collection and merge results, providing a consistent interface with DynamoDB batch functions.

```javascript
// Batch get by _id from multiple collections
const result = await mongo.batchGetRecords(instance, {
  users: ['user_1', 'user_2'],
  orders: ['order_1', 'order_2', 'order_3']
});
// result.documents.users = [{ _id: 'user_1', ... }, ...]
// result.documents.orders = [{ _id: 'order_1', ... }, ...]

// Batch write (insert) across collections
const result = await mongo.batchWriteRecords(instance, {
  users: [{ _id: 'u1', name: 'John' }, { _id: 'u2', name: 'Jane' }],
  logs: [{ _id: 'l1', action: 'signup' }]
});
// result.results.users.insertedCount === 2

// Batch delete by _id across collections
const result = await mongo.batchDeleteRecords(instance, {
  users: ['user_1', 'user_2'],
  sessions: ['sess_1']
});
// result.results.users.deletedCount === 2

// Mixed put/delete in one call per collection
const result = await mongo.batchWriteAndDeleteRecords(instance, {
  users: [
    { put: { _id: 'u3', name: 'New User' } },
    { delete: { _id: 'u1' } }
  ]
});
// result.results.users = { insertedCount: 1, deletedCount: 1 }
```

### Transactions

Transactions require a MongoDB **replica set**. MongoDB Atlas has replica set enabled by default. For local Docker, start `mongod` with `--replSet rs0` (single container, no distributed complexity). See the Testing section below for the Docker setup.

```javascript
// Atomic multi-collection write
const result = await mongo.transactWriteRecords(instance, async function (session, db) {

  await db.collection('accounts').updateOne(
    { _id: 'acc_1' },
    { $inc: { balance: -100 } },
    { session }
  );

  await db.collection('accounts').updateOne(
    { _id: 'acc_2' },
    { $inc: { balance: 100 } },
    { session }
  );

  return { transferred: 100 };

});
// result.success === true, result.result === { transferred: 100 }
// If any operation fails, all are rolled back automatically
```

### Connection Management
```javascript
// Close connection (DynamoDB handles this internally; MongoDB requires explicit close)
const result = await mongo.close(instance);
```

## Response Format

All operations return:
```javascript
{
  success: boolean,
  data: any,        // document, documents, results, etc.
  error: object     // null on success, { type, message } on failure
}
```

## Configuration

```javascript
const config = {
  CONNECTION_STRING: 'mongodb://localhost:27017',
  DATABASE_NAME: 'myapp',
  MAX_POOL_SIZE: 10,
  SERVER_SELECTION_TIMEOUT: 5000
};
```

## Testing Tiers

### Local Testing
Docker lifecycle is managed automatically by npm scripts. The container runs as a **single-node replica set** to support transaction testing:
```bash
cd _test
npm install
npm test
```

`npm test` runs: `pretest` (cleanup + start MongoDB replica set container) → `test` (run tests) → `posttest` (stop + remove containers and volumes only — images are cached).

### Integration Testing
Requires real MongoDB connection credentials in environment variables:
```bash
export MONGODB_CONNECTION_STRING="mongodb://user:pass@host:27017"
export MONGODB_DATABASE="test_db"
npm test
```

## Replica Set for Transactions

Transaction support requires a replica set. This is **not** a distributed multi-node concern:

- **MongoDB Atlas**: Replica set is enabled by default on all tiers (including free M0). Transactions work out of the box.
- **Local Docker**: Pass `--replSet rs0` to `mongod` and run `rs.initiate()` once. Single container, no sync overhead. The test `docker-compose.yml` handles this automatically.
- **Self-hosted**: Add `--replSet rs0` to your `mongod` config and initiate once.

## Safety Nets

- `query()`, `count()`, and `deleteRecordsByFilter()` throw `TypeError` on empty/null/undefined filter to prevent accidental full-collection operations
- `scan()` permits empty filter for intentional full-collection reads
- `writeRecord()` always uses upsert (insert or replace)

## Dependencies

- `mongodb` - MongoDB Node.js driver (lazy-loaded)

## License

MIT License - see LICENSE file for details.
