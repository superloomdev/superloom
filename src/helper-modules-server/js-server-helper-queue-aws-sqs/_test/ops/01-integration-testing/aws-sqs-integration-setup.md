# AWS SQS Integration Testing Setup

## Overview

Integration testing runs tests against a real AWS SQS instance in the sandbox AWS account. This validates behavior with the actual service, including features not fully supported by ElasticMQ (FIFO deduplication, dead-letter queues, message attributes).

## Prerequisites

- AWS sandbox account set up (see project `ops/01-cloud-provider/`)
- IAM unit-tester user created with `test_` queue access (see project `ops/05-identity-access/`)
- Environment loaded: `source init-env.sh` (select `integration`)

## Steps

### Configure Environment

Ensure these environment variables are set (in `__dev__/.env.integration`):

```
AWS_ACCESS_KEY_ID=[SECRET: unit-tester access key]
AWS_SECRET_ACCESS_KEY=[SECRET: unit-tester access secret]
AWS_REGION=[region, e.g., ap-south-1]
```

Do NOT set `SQS_ENDPOINT` - the AWS SDK will use the real SQS endpoint automatically.

### Create Test Queues

Create test queues in the AWS Console or via CLI:

```bash
aws sqs create-queue \
  --queue-name test_sqs_module \
  --region [region]
```

Ensure the unit-tester IAM policy only allows access to queues prefixed with `test_`.

### Run Tests

```bash
source init-env.sh    # Select 'integration'
cd _test
npm install
npm test
```

## Verification

- Tests connect to real AWS SQS (no endpoint override)
- Test queues are created in the correct region
- IAM unit-tester can send/receive/delete on `test_` queues but not production queues
- Tests pass: `npm test` exits with code 0

## Notes

- Integration testing may incur small AWS charges (SQS pricing is per-request)
- Clean up test queues after test runs to avoid unnecessary charges
- The unit-tester IAM policy restricts access to `test_` prefixed queues only - this prevents accidental modification of production queues
- All sandbox credentials stored in: `[SECRET -> __dev__/secrets/sandbox.md]`
