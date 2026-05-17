# Schema — js-server-helper-verify-store-dynamodb

## Table Design

DynamoDB uses a single-table design with composite keys:

| Attribute | DynamoDB Type | Role |
|-----------|---------------|------|
| `scope` | String (S) | Partition key (PK) — logical namespace |
| `id` | String (S) | Sort key (SK) — verification key (called `key` in the store contract) |
| `code` | String (S) | The verification code (hashed or plain) |
| `fail_count` | Number (N) | Count of failed verify attempts |
| `created_at` | Number (N) | Unix epoch seconds |
| `expires_at` | Number (N) | Unix epoch seconds. Also the DynamoDB TTL attribute |

## `setupNewStore` Provisioning

`setupNewStore` calls `createTable` with:

```js
{
  TableName: table_name,
  KeySchema: [
    { AttributeName: 'scope', KeyType: 'HASH' },
    { AttributeName: 'id',    KeyType: 'RANGE' }
  ],
  AttributeDefinitions: [
    { AttributeName: 'scope', AttributeType: 'S' },
    { AttributeName: 'id',    AttributeType: 'S' }
  ],
  BillingMode: 'PAY_PER_REQUEST'
}
```

`ResourceInUseException` (table already exists) is treated as success. The adapter does **not** call `UpdateTimeToLive` — enable TTL separately after the table is created.

## CloudFormation / CDK Snippet

```yaml
# CloudFormation
Type: AWS::DynamoDB::Table
Properties:
  TableName: verification_codes
  BillingMode: PAY_PER_REQUEST
  KeySchema:
    - AttributeName: scope
      KeyType: HASH
    - AttributeName: id
      KeyType: RANGE
  AttributeDefinitions:
    - AttributeName: scope
      AttributeType: S
    - AttributeName: id
      AttributeType: S
  TimeToLiveSpecification:
    AttributeName: expires_at
    Enabled: true
```

## TTL Attribute

`expires_at` is a Unix epoch seconds Number. DynamoDB's TTL sweeper deletes items asynchronously within ~48 hours after `expires_at` passes when TTL is enabled on this attribute.

Enable TTL after `setupNewStore`:

```bash
aws dynamodb update-time-to-live \
  --table-name verification_codes \
  --time-to-live-specification "Enabled=true, AttributeName=expires_at"
```

## Access Patterns

| Operation | DynamoDB call | Key used |
|-----------|---------------|----------|
| `getRecord` | `GetItem` | PK=`scope`, SK=`id` |
| `setRecord` | `PutItem` | PK=`scope`, SK=`id` |
| `incrementFailCount` | `UpdateItem` | PK=`scope`, SK=`id` |
| `deleteRecord` | `DeleteItem` | PK=`scope`, SK=`id` |
| `cleanupExpiredRecords` | `Scan` + `BatchWriteItem` | Full table scan |

All access patterns except cleanup use the primary key — no GSIs are required for the verify store.
