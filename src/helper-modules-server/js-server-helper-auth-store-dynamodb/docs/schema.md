# Schema

DynamoDB is schema-on-read. The adapter does not issue DDL; the table must be provisioned out-of-band via IaC, AWS Console, or a one-shot script before the auth module is used.

This page documents the single-table design, the composite key strategy, attribute type mapping, and the IaC example (CloudFormation/CDK) with the correct Sort Key attribute name.

## On This Page

- [Single-Table Design](#single-table-design)
- [Primary Key Strategy](#primary-key-strategy)
- [Attribute Mapping](#attribute-mapping)
- [Item Shape Example](#item-shape-example)
- [Table Provisioning (CloudFormation)](#table-provisioning-cloudformation)
- [Index Strategy](#index-strategy)
- [Native TTL](#native-ttl)

## Single-Table Design

The adapter uses one DynamoDB table per `actor_type` (e.g. `sessions_user`, `sessions_admin`). All sessions for all tenants and actors live in the same table, partitioned by `tenant_id` and sorted by a composite key.

| Key | Attribute Name | Type | Value |
|---|---|---|---|
| Partition Key (PK) | `tenant_id` | String | The tenant identifier |
| Sort Key (SK) | `session_key` | String | `` `${actor_id}#${token_key}` `` |

The Sort Key attribute name is `session_key`. This is an internal implementation detail; the canonical record shape exposed to callers never contains `session_key` (it is stripped on read).

This layout ensures every hot-path query is a direct primary-index hit. No Global Secondary Index (GSI) is required for any auth operation.

## Primary Key Strategy

| Operation | PK Value | SK Value / Condition | DynamoDB API |
|---|---|---|---|
| `getSession` | `tenant_id` | `session_key = "${actor_id}#${token_key}"` | `GetItem` |
| `listSessionsByActor` | `tenant_id` | `begins_with(session_key, "${actor_id}#")` | `Query` |
| `setSession` | `tenant_id` | `session_key = "${actor_id}#${token_key}"` | `PutItem` |
| `deleteSession` | `tenant_id` | `session_key = "${actor_id}#${token_key}"` | `DeleteItem` |
| `deleteSessions` (each key) | `tenant_id` | `session_key = "${actor_id}#${token_key}"` | `BatchWriteItem` |
| `cleanupExpiredSessions` | (scan entire table) | `FilterExpression: expires_at < :now` | `Scan` then `BatchWriteItem` |

The `begins_with` condition for `listSessionsByActor` leverages DynamoDB's sort-key prefix matching. All sessions for an actor share the same prefix (`` `${actor_id}#` ``), so the Query returns them in a single operation with no GSI.

## Attribute Mapping

Canonical record fields map to DynamoDB attribute types as follows:

| Canonical Field | DynamoDB Type | Notes |
|---|---|---|
| `tenant_id` | String (S) | Also the PK |
| `actor_id` | String (S) | Embedded in SK; also stored as top-level attribute |
| `actor_type` | String (S) | |
| `token_key` | String (S) | Embedded in SK; also stored as top-level attribute |
| `token_secret_hash` | String (S) | Stored as regular attribute (not in SK) so hash rotation does not change the PK/SK |
| `refresh_token_hash` | String (S) or Null | |
| `refresh_family_id` | String (S) or Null | |
| `created_at` | Number (N) | Unix epoch seconds |
| `expires_at` | Number (N) | Unix epoch seconds; used for native TTL if enabled |
| `last_active_at` | Number (N) | Unix epoch seconds |
| `install_id` | String (S) or Null | |
| `install_platform` | String (S) | |
| `install_form_factor` | String (S) | |
| `client_name` | String (S) or Null | |
| `client_version` | String (S) or Null | |
| `client_is_browser` | Boolean (BOOL) | Native DynamoDB boolean type |
| `client_os_name` | String (S) or Null | |
| `client_os_version` | String (S) or Null | |
| `client_screen_w` | Number (N) or Null | |
| `client_screen_h` | Number (N) or Null | |
| `client_ip_address` | String (S) or Null | |
| `client_user_agent` | String (S) or Null | |
| `push_provider` | String (S) or Null | |
| `push_token` | String (S) or Null | |
| `custom_data` | Map (M) or Null | Stored as native Map; `null` omits the attribute entirely |

**DynamoDB-specific attribute:** `session_key` (String) is the Sort Key. It is computed as `` `${actor_id}#${token_key}` `` and is stripped from the returned record on read.

## Item Shape Example

A session item as stored in DynamoDB (JSON representation):

```json
{
  "tenant_id": { "S": "tenant_abc123" },
  "session_key": { "S": "user_xyz789#token_def456" },
  "actor_id": { "S": "user_xyz789" },
  "actor_type": { "S": "user" },
  "token_key": { "S": "token_def456" },
  "token_secret_hash": { "S": "sha256$..." },
  "refresh_token_hash": { "S": "sha256$..." },
  "refresh_family_id": { "S": "fam_001" },
  "created_at": { "N": "1700000000" },
  "expires_at": { "N": "1702592000" },
  "last_active_at": { "N": "1700000000" },
  "install_id": { "S": "install_mobile_001" },
  "install_platform": { "S": "ios" },
  "install_form_factor": { "S": "phone" },
  "client_name": { "S": "SuperloomApp" },
  "client_version": { "S": "1.2.3" },
  "client_is_browser": { "BOOL": false },
  "client_os_name": { "S": "iOS" },
  "client_os_version": { "S": "17.0" },
  "client_screen_w": { "N": "390" },
  "client_screen_h": { "N": "844" },
  "client_ip_address": { "S": "203.0.113.42" },
  "client_user_agent": { "S": "Superloom/1.2.3 (iPhone; iOS 17.0)" },
  "push_provider": { "S": "apns" },
  "push_token": { "S": "<apns_device_token>" },
  "custom_data": { "M": { "theme": { "S": "dark" }, "beta": { "BOOL": true } } }
}
```

The same item, as returned by the adapter (canonical record with `session_key` stripped):

```js
{
  tenant_id: 'tenant_abc123',
  actor_id: 'user_xyz789',
  actor_type: 'user',
  token_key: 'token_def456',
  token_secret_hash: 'sha256$...',
  refresh_token_hash: 'sha256$...',
  refresh_family_id: 'fam_001',
  created_at: 1700000000,
  expires_at: 1702592000,
  last_active_at: 1700000000,
  install_id: 'install_mobile_001',
  install_platform: 'ios',
  install_form_factor: 'phone',
  client_name: 'SuperloomApp',
  client_version: '1.2.3',
  client_is_browser: false,
  client_os_name: 'iOS',
  client_os_version: '17.0',
  client_screen_w: 390,
  client_screen_h: 844,
  client_ip_address: '203.0.113.42',
  client_user_agent: 'Superloom/1.2.3 (iPhone; iOS 17.0)',
  push_provider: 'apns',
  push_token: '<apns_device_token>',
  custom_data: { theme: 'dark', beta: true }
}
```

## Table Provisioning (CloudFormation)

Provision the table out-of-band before using the auth module. The Sort Key attribute name must be `session_key`.

```yaml
# CloudFormation snippet
SessionsUserTable:
  Type: AWS::DynamoDB::Table
  Properties:
    TableName: sessions_user
    BillingMode: PAY_PER_REQUEST
    AttributeDefinitions:
      - AttributeName: tenant_id
        AttributeType: S
      - AttributeName: session_key
        AttributeType: S
    KeySchema:
      - AttributeName: tenant_id
        KeyType: HASH
      - AttributeName: session_key
        KeyType: RANGE
    # Optional but recommended: enable native TTL
    TimeToLiveSpecification:
      AttributeName: expires_at
      Enabled: true
```

**Important:** The Sort Key attribute name is `session_key`, not `actor_id_token_key` or any other variant. The adapter source computes `session_key` as `` `${actor_id}#${token_key}` ``. The CloudFormation definition must match exactly.

For CDK (TypeScript):

```ts
new dynamodb.Table(this, 'SessionsUserTable', {
  tableName: 'sessions_user',
  partitionKey: { name: 'tenant_id', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'session_key', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  timeToLiveAttribute: 'expires_at',  // optional but recommended
});
```

## Index Strategy

**Only the primary index is used.** No GSI is created or required.

| Index | Type | Keys | Purpose |
|---|---|---|---|
| Primary | Primary | PK: `tenant_id`, SK: `session_key` | All auth operations |

The primary index serves every access pattern:
- Point reads (`GetItem`) for `getSession`
- Range queries (`Query` with `begins_with`) for `listSessionsByActor`
- Full item writes (`PutItem`) for `setSession`
- Partial updates (`UpdateItem`) for `updateSessionActivity`
- Point deletes (`DeleteItem`) for `deleteSession`
- Batch deletes (`BatchWriteItem`) for `deleteSessions`
- Full scans (`Scan`) for `cleanupExpiredSessions` (fallback when native TTL is not enabled)

Adding a GSI would not improve any auth operation. The `expires_at` field is not indexed; cleanup relies on either native TTL (preferred) or a full Scan with filter.

## Native TTL

DynamoDB supports table-level TTL. When enabled on the `expires_at` attribute:

1. Set `TimeToLiveSpecification.AttributeName` to `expires_at` during table creation (or via `UpdateTable`)
2. DynamoDB automatically deletes items whose `expires_at` value is in the past
3. Deletion is **eventually consistent** — items may remain visible for up to 48 hours after expiry
4. No application code or cron job is required for garbage collection

The adapter's `cleanupExpiredSessions` method remains available for immediate hard-delete when needed (e.g., to purge sessions immediately upon security revocation). When native TTL is enabled, calling `cleanupExpiredSessions` is optional but safe.

**Format requirement:** `expires_at` must be a Number (Unix epoch seconds). DynamoDB TTL expects this format; ISO strings will not work.
