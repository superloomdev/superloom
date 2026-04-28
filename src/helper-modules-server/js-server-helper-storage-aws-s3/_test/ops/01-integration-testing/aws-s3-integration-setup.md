# AWS S3 Integration Testing Setup

## Overview

Integration testing runs tests against a real AWS S3 service in the sandbox AWS account. This validates behavior with the actual service, including features not fully covered by MinIO (e.g., bucket policies, server-side encryption, lifecycle rules, signed URLs against real endpoints).

## Prerequisites

- AWS sandbox account set up (see project `ops/01-cloud-provider/`)
- IAM unit-tester user created with `test-` bucket access (see project `ops/05-identity-access/`)
- Environment loaded: `source init-env.sh` (select `integration`)

## Steps

### Configure Environment

Ensure these environment variables are set (in `__dev__/.env.integration`):

```
S3_ACCESS_KEY=[SECRET: unit-tester access key]
S3_SECRET_KEY=[SECRET: unit-tester access secret]
S3_REGION=[region, e.g., ap-south-1]
S3_FORCE_PATH_STYLE=false
```

Do NOT set `S3_ENDPOINT` - the AWS SDK will use the real S3 endpoint automatically when it is unset or empty.

`S3_FORCE_PATH_STYLE=false` is required for real AWS - the modern S3 API uses virtual-hosted style addressing.

### Create Test Buckets

Test bucket names are generated per run (prefixed `test-crud-<timestamp>` and `test-copy-<timestamp>`) and are created and torn down automatically by the test hooks. The IAM unit-tester user must be allowed to create, use, and delete buckets matching the `test-*` pattern.

If IAM permissions are restricted to pre-existing buckets, create them in advance with:

```bash
aws s3 mb s3://test-yourteam-crud --region [region]
aws s3 mb s3://test-yourteam-copy --region [region]
```

and update the test file to reference those fixed names.

### Run Tests

```bash
source init-env.sh    # Select 'integration'
cd _test
npm install
npm test
```

## Verification

- Tests connect to real AWS S3 (no endpoint override)
- Test buckets are created in the correct region
- IAM unit-tester can CRUD on `test-*` buckets but not production buckets
- Tests pass: `npm test` exits with code 0

## Notes

- Integration testing may incur small AWS charges (S3 request pricing + short-lived storage)
- Test hooks empty and delete buckets after each run - re-runs should not accumulate storage
- The unit-tester IAM policy restricts access to `test-*` prefixed buckets only - this prevents accidental modification of production data
- For cross-region testing, ensure the bucket region matches `S3_REGION` - S3 errors with 301 Moved Permanently when region is wrong
- All sandbox credentials stored in: `[SECRET → __dev__/secrets/sandbox.md]`
