# AWS DynamoDB Integration Testing Setup

## Overview

Integration testing runs tests against a real AWS DynamoDB instance in the sandbox AWS account. This validates behavior with the actual service, including features not supported by DynamoDB Local (streams, TTL, global tables).

## Prerequisites

- AWS sandbox account set up (see project `ops/01-cloud-provider/`)
- IAM unit-tester user created with `test_` table access (see project `ops/05-identity-access/`)
- Environment loaded: `source init-env.sh` (select `integration`)

## Steps

### Configure Environment

Ensure these environment variables are set (in `__dev__/.env.integration`):

```
AWS_ACCESS_KEY_ID=[SECRET: unit-tester access key]
AWS_SECRET_ACCESS_KEY=[SECRET: unit-tester access secret]
AWS_REGION=[region, e.g., ap-south-1]
```

Do NOT set `DYNAMODB_ENDPOINT` - the AWS SDK will use the real DynamoDB endpoint automatically.

### Create Test Tables

Create test tables in the AWS Console or via CLI:

```bash
aws dynamodb create-table \
  --table-name test_example \
  --attribute-definitions AttributeName=pk,AttributeType=S \
  --key-schema AttributeName=pk,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region [region]
```

Ensure the unit-tester IAM policy only allows access to tables prefixed with `test_`.

### Run Tests

```bash
source init-env.sh    # Select 'integration'
cd _test
npm install
npm test
```

## Verification

- Tests connect to real AWS DynamoDB (no endpoint override)
- Test tables are created in the correct region
- IAM unit-tester can CRUD on `test_` tables but not production tables
- Tests pass: `npm test` exits with code 0

## Notes

- Integration testing may incur small AWS charges (DynamoDB on-demand pricing)
- Clean up test data after test runs to avoid unnecessary storage costs
- The unit-tester IAM policy restricts access to `test_` prefixed tables only - this prevents accidental modification of production data
- All sandbox credentials stored in: `[SECRET → __dev__/secrets/sandbox.md]`
