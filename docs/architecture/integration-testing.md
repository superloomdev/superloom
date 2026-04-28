# Integration Testing (Cloud)

How to set up and run integration tests against **real cloud services** in an isolated sandbox account. Integration testing covers behavior the local emulators cannot - DynamoDB Streams, IAM policies, S3 versioning, real network latency, and so on. The same test code runs both tiers; only the environment variables change.

## On This Page

- [Terminology](#terminology)
- [Architecture](#architecture)
- [Setup Steps](#setup-steps)
- [Safety Rules](#safety-rules)
- [Per-Module Documentation](#per-module-documentation)
- [When to Run Integration Tests](#when-to-run-integration-tests)

---

## Terminology

| Term | Meaning |
|---|---|
| **Emulated integration testing** | Tests against local emulators (DynamoDB Local, MinIO, etc.) via Docker |
| **Integration testing** | Tests against real cloud services in an isolated non-production (sandbox) AWS account |

Both are forms of integration testing. The key difference is whether the external service is emulated locally or real.

## Architecture

```
Developer Machine                        AWS Sandbox Account
┌──────────────────┐                     ┌───────────────────────────────┐
│ source init-env.sh│                     │  IAM: unit-tester             │
│ (select integration)│                     │    - test_* tables only       │
│                   │ ─── AWS SDK ──────> │    - test_* buckets only      │
│ cd _test          │                     │    - test_* queues only       │
│ npm test          │                     │                               │
└──────────────────┘                     │  Resources (test_ prefix):    │
                                         │    - DynamoDB: test_crud       │
                                         │    - S3: test-uploads          │
                                         │    - SQS: test_actions         │
                                         └───────────────────────────────┘
```

## Setup Steps

### 1. AWS Sandbox Account

Follow `demo-project/ops/01-cloud-provider/aws-account-setup.md` to create a sandbox AWS account. This should be a separate account from production (or at minimum, a separate region with resource isolation).

### 2. IAM Unit-Tester User

Create a dedicated IAM user for running tests. This user must have **minimal permissions** - only access to resources prefixed with `test_`.

Example IAM policy for DynamoDB testing:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan",
        "dynamodb:BatchGetItem",
        "dynamodb:BatchWriteItem",
        "dynamodb:CreateTable",
        "dynamodb:DeleteTable",
        "dynamodb:DescribeTable",
        "dynamodb:ListTables"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/test_*"
    }
  ]
}
```

**Naming convention:** `unit-tester-{service}` (e.g., `unit-tester-dynamodb`)

See `demo-project/ops/05-identity-access/aws-iam-setup.md` for detailed IAM setup.

### 3. Store Credentials

Store the IAM access key in `__dev__/secrets/sandbox.md`:

```
## unit-tester-dynamodb
Access Key ID: AKIA...
Secret Access Key: ...
Region: ap-south-1
```

This file is fully gitignored. Never commit credentials.

### 4. Environment File

Create `__dev__/.env.integration` with:

```
AWS_ACCESS_KEY_ID=[from __dev__/secrets/sandbox.md]
AWS_SECRET_ACCESS_KEY=[from __dev__/secrets/sandbox.md]
AWS_REGION=ap-south-1
```

Do **not** set `DYNAMODB_ENDPOINT` - the SDK uses real AWS endpoints when no endpoint is specified.

### 5. Run Tests

```bash
source init-env.sh    # Select 'integration'
cd src/helper-modules-server/js-server-helper-aws-dynamodb/_test
npm install
npm test
```

## Safety Rules

- **Resource prefix:** All test resources must use `test_` prefix
- **IAM restriction:** Unit-tester user can only access `test_*` resources
- **Cleanup:** Tests should clean up after themselves (delete test data)
- **Cost awareness:** Integration testing against real cloud may incur small charges
- **No CI/CD:** Integration tests are developer-triggered only - never in CI pipelines
- **No production data:** Sandbox accounts must never contain production data

## Per-Module Documentation

Each service-dependent module documents its specific integration testing setup in:

```
_test/ops/01-integration-testing/{vendor-service-integration-setup.md}
```

This includes:
- Specific IAM policy for that service
- How to create test resources
- Environment variables needed
- Verification steps

## When to Run Integration Tests

- **Before major version releases** - validates real cloud behavior
- **After cloud-specific changes** - IAM, encryption, streams, TTL
- **Optional for patches** - if emulated tests cover the change
- **Not required for CI/CD** - emulated tests gate publishing

## Further Reading

- [Module Testing](module-testing.md) - the emulated tier and CI/CD setup
- [Testing Strategy](testing-strategy.md) - directory layout and the test loader pattern
- [Operations Documentation](operations-documentation.md) - the three-layer ops doc strategy
- [Architectural Philosophy](architectural-philosophy.md#environment-strategy) - dev vs integration environments
