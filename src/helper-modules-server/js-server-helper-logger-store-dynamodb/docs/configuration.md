# Configuration — js-server-helper-logger-store-dynamodb

## Loader Pattern

```js
Lib.Logger = require('@superloomdev/js-server-helper-logger')(Lib, {
  STORE: require('@superloomdev/js-server-helper-logger-store-dynamodb'),
  STORE_CONFIG: {
    table_name:   'action_log',
    lib_dynamodb: Lib.DynamoDB
  },
  IP_ENCRYPT_KEY: process.env.IP_ENCRYPT_KEY  // optional
});
```

## `STORE_CONFIG` Keys

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `table_name` | `String` | Yes | Name of the DynamoDB table. |
| `lib_dynamodb` | `Object` | Yes | An initialized `Lib.DynamoDB` instance (`@superloomdev/js-server-helper-nosql-aws-dynamodb`). |

## Peer Dependencies

| Package | Purpose |
|---------|---------|
| `@superloomdev/js-helper-utils` | Type checks (`getUnixTime`) |
| `@superloomdev/js-helper-debug` | Structured debug logging |
| `@superloomdev/js-server-helper-nosql-aws-dynamodb` | DynamoDB wrapper (`Lib.DynamoDB`) |

## Environment Variables

Consumed only by `_test/loader.js` — never read by the adapter itself.

| Variable | Default | Description |
|----------|---------|-------------|
| `DYNAMO_ENDPOINT` | `http://127.0.0.1:8002` | DynamoDB endpoint (DynamoDB Local for tests) |
| `AWS_REGION` | `us-east-1` | AWS region |

The test script also sets `AWS_ACCESS_KEY_ID=local` and `AWS_SECRET_ACCESS_KEY=local` to prevent the AWS SDK from walking the EC2 credential chain.

## Testing Tier

| Tier | Runtime | Notes |
|------|---------|-------|
| Contract + Integration | DynamoDB Local via Docker Compose | `pretest`/`posttest` manage the Docker lifecycle |

```bash
cd _test && npm install && npm test
```

The `pretest` script runs `docker compose down -v` then `docker compose up -d --wait`. Never start Docker manually before running tests.

## IAM Permissions (Production)

```json
{
  "Effect": "Allow",
  "Action": [
    "dynamodb:PutItem",
    "dynamodb:Query",
    "dynamodb:DeleteItem",
    "dynamodb:BatchWriteItem",
    "dynamodb:Scan"
  ],
  "Resource": [
    "arn:aws:dynamodb:*:*:table/action_log",
    "arn:aws:dynamodb:*:*:table/action_log/index/actor_pk-sort_key-index"
  ]
}
```

## Provisioning and Post-Deployment

The adapter does **not** provision the table — `setupNewStore` is a no-op. Provision the table out-of-band (CloudFormation, CDK, Terraform, AWS Console). See [`docs/schema.md`](./schema.md) for the CloudFormation template.

After the table is provisioned, enable TTL on `expires_at` (skip this if your IaC template already includes `TimeToLiveSpecification`):

```bash
aws dynamodb update-time-to-live \
  --table-name action_log \
  --time-to-live-specification "Enabled=true, AttributeName=expires_at"
```
