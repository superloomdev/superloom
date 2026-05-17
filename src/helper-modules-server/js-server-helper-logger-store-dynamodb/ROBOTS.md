# js-server-helper-logger-store-dynamodb. AI Reference

Class F storage adapter. AWS DynamoDB backend for `@superloomdev/js-server-helper-logger`. Cannot stand alone. Always loaded by the Logger parent via the factory protocol; not called directly by application code.

Requires a DynamoDB table provisioned **out-of-band** (CloudFormation, CDK, Terraform, AWS Console). The adapter does not create the table — `setupNewStore` is a no-op that returns success. Uses `js-server-helper-nosql-aws-dynamodb` injected via `STORE_CONFIG.lib_dynamodb`.

## Adapter Factory

```js
const factory = require('@superloomdev/js-server-helper-logger-store-dynamodb');
const store   = factory(Lib, CONFIG, ERRORS);
```

| Argument | Type | Source |
|---|---|---|
| `Lib` | Object | Dependency container with `Utils` and `Debug` at minimum |
| `CONFIG` | Object | Merged Logger config; the factory reads `CONFIG.STORE_CONFIG` only |
| `ERRORS` | Object | Logger error catalog; the adapter uses `SERVICE_UNAVAILABLE` only |

Returns a Store interface.

## `STORE_CONFIG`

```js
{
  table_name:   'action_log',  // required. one table per logger instance
  lib_dynamodb: Lib.DynamoDB   // required. initialized js-server-helper-nosql-aws-dynamodb
}
```

Both keys are required.

## Table Design

| Attribute | DynamoDB type | Role |
|-----------|---------------|------|
| `pk` | String (S) | Partition key (PK) of the base table — written as `"{scope}#{entity_type}#{entity_id}"` |
| `sort_key` | String (S) | Sort key (SK) of the base table — timestamp-based unique string |
| `actor_pk` | String (S) | Partition key of the GSI — written as `"{scope}#{actor_type}#{actor_id}"` |
| `expires_at` | Number (N) | TTL attribute (Unix epoch seconds). Enable TTL out-of-band. |

GSI name: `actor_pk-sort_key-index`. GSI keys: PK=`actor_pk`, SK=`sort_key`.

## Store Contract

| Method | Signature | Returns |
|---|---|---|
| `setupNewStore` | `(instance)` | `{ success, error }` |
| `addLog` | `(instance, record)` | `{ success, error }` |
| `getLogsByEntity` | `(instance, query)` | `{ success, records, next_cursor, error }` |
| `getLogsByActor` | `(instance, query)` | `{ success, records, next_cursor, error }` |
| `cleanupExpiredLogs` | `(instance)` | `{ success, deleted_count, error }` |

## Behaviors That Must Not Be Violated When Generating Code

1. **Never call the adapter directly from application code.** Always go through the parent Logger module.

2. **`setupNewStore` is a no-op.** Returns `{ success: true, error: null }` without calling DynamoDB. The table and GSI must be provisioned out-of-band (CloudFormation, CDK, Terraform, AWS Console). The contract is satisfied so the Logger parent's idempotent setup flow still works.

3. **`addLog` uses `PutItem` and computes the keys at write time.** The adapter assigns `pk = "{scope}#{entity_type}#{entity_id}"` and `actor_pk = "{scope}#{actor_type}#{actor_id}"` to the record before writing. The `sort_key` carries a random suffix making collisions effectively impossible — no UPSERT logic needed.

4. **`getLogsByEntity` queries the base table** with `pkName: 'pk'`, `pk` set to `"{scope}#{entity_type}#{entity_id}"`, sort key descending, optional `sort_key` cursor.

5. **`getLogsByActor` queries the GSI** with `indexName: 'actor_pk-sort_key-index'`, `pkName: 'actor_pk'`, `pk` set to `"{scope}#{actor_type}#{actor_id}"`, sort key descending.

6. **`cleanupExpiredLogs` does a full table `Scan` (no `FilterExpression`) then filters client-side and `BatchWriteItem` deletes.** Delete keys are `{ pk, sort_key }`. Native TTL handles automatic expiry (~48h) — this method provides deterministic `deleted_count` for tests and immediate cleanup.

7. **Enable TTL out-of-band.** The adapter does not call `UpdateTimeToLive`. Enable TTL on `expires_at` via the AWS Console, IaC, or AWS CLI as part of table provisioning.

8. **Test environment uses DynamoDB Local on port 8002.** Set `AWS_ACCESS_KEY_ID=local AWS_SECRET_ACCESS_KEY=local AWS_REGION=us-east-1` to avoid the EC2 credential chain timeout.

9. **IAM permissions required:** `PutItem`, `Query`, `Scan`, `BatchWriteItem` on the table ARN and `Query` on the `actor_pk-sort_key-index` GSI ARN.

## Peer Dependencies

```
@superloomdev/js-helper-utils                        (type checks)
@superloomdev/js-helper-debug                        (structured logging)
@superloomdev/js-server-helper-nosql-aws-dynamodb    (DynamoDB wrapper)
```

## Error Catalog Used

| Error | When |
|---|---|
| `ERRORS.SERVICE_UNAVAILABLE` | Driver-level call failed. Logged via `Lib.Debug.error`, never surfaced to caller |

## Single Source of Truth

The store's source file is `store.js`. Base table PK attribute: `pk`. GSI: `actor_pk-sort_key-index` (PK: `actor_pk`, SK: `sort_key`). TTL attribute: `expires_at`. `setupNewStore` is a no-op.
