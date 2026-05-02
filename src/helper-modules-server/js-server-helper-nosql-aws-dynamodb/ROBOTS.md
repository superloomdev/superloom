# js-server-helper-aws-dynamodb

AWS DynamoDB CRUD, batch, query, scan. Lazy-loaded SDK v3. Explicit credentials.

## Type
Server helper. Service-dependent (needs Docker for emulated, AWS for integration).

## Peer Dependencies
- `@superloomdev/js-helper-utils` - injected as `Lib.Utils`
- `@superloomdev/js-helper-debug` - injected as `Lib.Debug`
- `@superloomdev/js-server-helper-instance` - injected as `Lib.Instance`

## Direct Dependencies
- `@aws-sdk/client-dynamodb` - base DynamoDB client
- `@aws-sdk/lib-dynamodb` - Document Client + Commands

## Loader Pattern (Factory)

```javascript
Lib.DynamoDB = require('@superloomdev/js-server-helper-aws-dynamodb')(Lib, { /* config overrides */ });
```

Each loader call returns an independent DynamoDB interface with its own `Lib`, `CONFIG`, and DynamoDB client instance.

## Config Keys
| Key | Type | Default | Required |
|---|---|---|---|
| REGION | String | 'us-east-1' | yes |
| KEY | String | undefined | yes (AWS access key) |
| SECRET | String | undefined | yes (AWS secret key) |
| ENDPOINT | String | undefined | no (set for DynamoDB Local) |
| MAX_RETRIES | Number | 3 | no |
| REMOVE_UNDEFINED_VALUES | Boolean | true | no |

## Exported Functions (19 total)

All functions with `instance` param use instance.time_ms for request-level performance timeline.

### Builders (pure, no I/O - used by executors, transactWriteRecords, and updateRecord)

commandBuilderForAddRecord(table, data) → Object | async:no
  Build Put service params. { TableName, Item }

commandBuilderForDeleteRecord(table, key) → Object | async:no
  Build Delete service params. { TableName, Key }

commandBuilderForUpdateRecord(table, key, update_data?, remove_keys?, increment?, decrement?, return_state?) → Object | async:no
  Build Update service params with SET/REMOVE/INCREMENT/DECREMENT.
  Uses ExpressionAttributeNames (#n1) to avoid DynamoDB reserved word conflicts.
  Note: list_append, if_not_exists, ADD/DELETE on sets, and ConditionExpression will be added as needed.

### Command Executors (I/O - execute pre-built params)

commandAddRecord(instance, service_params) → { success, error } | async:yes
  Execute pre-built Put command.

commandDeleteRecord(instance, service_params) → { success, error } | async:yes
  Execute pre-built Delete command.

commandUpdateRecord(instance, service_params) → { success, attributes, error } | async:yes
  Execute pre-built Update command.

### Convenience (DRY - build + execute internally)

getRecord(instance, table, key) → { success, item, error } | async:yes
  Get single record by primary key.

writeRecord(instance, table, item) → { success, error } | async:yes
  Write (create or replace) a record. Always upsert. Uses commandBuilderForAddRecord + commandAddRecord.

deleteRecord(instance, table, key) → { success, error } | async:yes
  Delete a single record. Uses commandBuilderForDeleteRecord + commandDeleteRecord.

updateRecord(instance, table, key, update_data?, remove_keys?, increment?, decrement?, return_state?) → { success, attributes, error } | async:yes
  Update with structured builder. SET/REMOVE/INCREMENT/DECREMENT.

query(instance, table, params) → { success, items, count, last_key, error } | async:yes
  Full-featured query. params = { pk, pkName, skCondition?, skValues?, limit?, indexName?, startKey?, scanForward?, fields?, select? }

count(instance, table, params) → { success, count, error } | async:yes
  Count records. Delegates to query with SELECT='COUNT'.

scan(instance, table, filter?) → { success, items, count, error } | async:yes
  Scan entire table. filter = { expression, names, values }

batchGetRecords(instance, keysByTable) → { success, items, error } | async:yes
  Batch get. keysByTable = { tableName: [key1, key2] }

batchWriteAndDeleteRecords(instance, requestsByTable) → { success, unprocessed, error } | async:yes
  Batch put/delete. requestsByTable = { tableName: [{ put: item }, { delete: key }] }

batchWriteRecords(instance, itemsByTable) → { success, error } | async:yes
  Batch put with auto 25-item chunking. itemsByTable = { tableName: [item1, item2, ...] }

batchDeleteRecords(instance, keysByTable) → { success, error } | async:yes
  Batch delete with auto 25-item chunking. keysByTable = { tableName: [key1, key2, ...] }

### Table Management

createTable(instance, table, params) → { success, already_exists, error } | async:yes
  Create a table idempotently. params: { attribute_definitions, key_schema, billing_mode?, global_secondary_indexes? }
  attribute_definitions: [{ name, type: 'S'|'N'|'B' }]
  key_schema: [{ name, type: 'HASH'|'RANGE' }]
  billing_mode: 'PAY_PER_REQUEST' (default) or 'PROVISIONED'
  Use for app-managed single-table designs; production prefers IaC.

deleteTable(instance, table) → { success, already_absent, error } | async:yes
  Delete a table idempotently. Primarily for test teardown.

### Transactions

transactWriteRecords(instance, add_records?, update_records?, delete_records?) → { success, error } | async:yes
  Atomic multi-table write (up to 100 actions). Uses pre-built command objects from builders.

## Builder Usage Patterns

Builders produce service-param objects consumed by executors or transactions. Two primary patterns:

### 1. Standalone (convenience functions call builders internally)
```javascript
await DynamoDB.updateRecord(instance, table, key, { name: 'New' }, ['old_field'], { views: 1 });
await DynamoDB.writeRecord(instance, table, item);
await DynamoDB.deleteRecord(instance, table, key);
```

### 2. Transaction (build commands, pass arrays to transactWriteRecords)
```javascript
const add_cmd = DynamoDB.commandBuilderForAddRecord(table, item);
const upd_cmd = DynamoDB.commandBuilderForUpdateRecord(table, key, { status: 'paid' });
const del_cmd = DynamoDB.commandBuilderForDeleteRecord(table, key);
await DynamoDB.transactWriteRecords(instance, [add_cmd], [upd_cmd], [del_cmd]);
```

Pattern 2 is the dominant real-world usage - most update commands are built individually and bundled into atomic transactions.

## Patterns
- 3-layer DRY: Builder → Command Executor → Convenience function
- Instance first: every I/O function receives instance for request-level performance tracking
- Lazy loading: SDK loaded on first function call via initIfNot
- Performance: Lib.Debug.performanceAuditLog with instance.time_ms
- Credentials: explicit KEY + SECRET via config, not implicit env chain
- Reserved words: builders use ExpressionAttributeNames (#n1, #n2) to avoid DynamoDB reserved word conflicts
- Batch limits: batchWriteRecords/batchDeleteRecords handle 25-item AWS limit with recursion
- Transaction limits: transactWriteRecords supports up to 100 actions per call (AWS limit)
