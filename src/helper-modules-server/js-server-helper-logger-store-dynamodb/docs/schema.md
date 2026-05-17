# Schema — js-server-helper-logger-store-dynamodb

## Table Design

Single-table design with a GSI for the second query pattern. The adapter does **not** provision the table; it must be created out-of-band before `addLog` is called.

**Base table:**
| Attribute | DynamoDB Type | Role |
|-----------|---------------|------|
| `pk` | String (S) | Partition key (PK) — written by `addLog` as `"{scope}#{entity_type}#{entity_id}"` |
| `sort_key` | String (S) | Sort key (SK) — timestamp-based unique string |

**GSI (`actor_pk-sort_key-index`):**
| Attribute | DynamoDB Type | Role |
|-----------|---------------|------|
| `actor_pk` | String (S) | GSI Partition key — written by `addLog` as `"{scope}#{actor_type}#{actor_id}"` |
| `sort_key` | String (S) | GSI Sort key |

## Item Attributes

| Attribute | DynamoDB Type | Nullable | Notes |
|-----------|---------------|----------|-------|
| `pk` | S | No | Computed on write from scope + entity_type + entity_id. Base table PK. |
| `actor_pk` | S | No | Computed on write from scope + actor_type + actor_id. GSI PK. |
| `sort_key` | S | No | Timestamp-based unique string. Same format as SQL adapters. Also the base table SK and the GSI SK. |
| `scope` | S | No | Namespace. |
| `entity_type` | S | No | Entity type. |
| `entity_id` | S | No | Entity identifier. |
| `actor_type` | S | No | Actor type. |
| `actor_id` | S | No | Actor identifier. |
| `action` | S | No | Action name. |
| `data` | Object/Map | Yes | Logger writes the canonical record as-is; the DynamoDB driver marshals nested values natively. |
| `ip` | S | Yes | IP address (may be encrypted). |
| `user_agent` | S | Yes | User-agent string. |
| `created_at` | N | No | Unix epoch seconds. |
| `created_at_ms` | N | No | Unix epoch milliseconds. |
| `expires_at` | N | Yes | Unix epoch seconds. Also the DynamoDB TTL attribute. `null` for persistent records. |

## `setupNewStore` Behavior

The adapter's `setupNewStore` is a **no-op** that returns `{ success: true, error: null }` without calling DynamoDB. The table and GSI must already exist when `addLog` is called.

Provision the table out-of-band before deploying. CloudFormation example:

## CloudFormation / CDK Snippet

```yaml
Type: AWS::DynamoDB::Table
Properties:
  TableName: action_log
  BillingMode: PAY_PER_REQUEST
  KeySchema:
    - AttributeName: pk
      KeyType: HASH
    - AttributeName: sort_key
      KeyType: RANGE
  AttributeDefinitions:
    - AttributeName: pk
      AttributeType: S
    - AttributeName: actor_pk
      AttributeType: S
    - AttributeName: sort_key
      AttributeType: S
  GlobalSecondaryIndexes:
    - IndexName: actor_pk-sort_key-index
      KeySchema:
        - AttributeName: actor_pk
          KeyType: HASH
        - AttributeName: sort_key
          KeyType: RANGE
      Projection:
        ProjectionType: ALL
  TimeToLiveSpecification:
    AttributeName: expires_at
    Enabled: true
```

During testing, the test harness provisions the table directly via the AWS SDK against DynamoDB Local.

## Access Patterns

| Operation | DynamoDB call | Index used |
|-----------|---------------|------------|
| `addLog` | `PutItem` | Base table |
| `getLogsByEntity` | `Query` | Base table (`pk` + `sort_key`) |
| `getLogsByActor` | `Query` | `actor_pk-sort_key-index` GSI (`actor_pk` + `sort_key`) |
| `cleanupExpiredLogs` | `Scan` (no FilterExpression) + client-side filter + `BatchWriteItem` | Full table scan |
