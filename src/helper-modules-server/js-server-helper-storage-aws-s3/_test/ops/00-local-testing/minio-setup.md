# MinIO Local Testing Setup

## Overview

MinIO is a Docker-based S3-compatible object storage server that implements the AWS S3 API on your machine. Use it for offline development and unit testing without needing an AWS account.

## Prerequisites

- Docker Desktop installed and running
- Environment loaded: `source init-env.sh` (select `dev`)

## Steps

### Start MinIO

Using the module's Docker Compose:

```bash
cd src/helper-modules-server/js-server-helper-storage-aws-s3/_test
docker compose up -d
```

Or the framework's shared Docker Compose:

```bash
docker compose -f docs/dev/docker-compose.yml up minio -d
```

MinIO runs on `http://localhost:9000` (S3 API) and `http://localhost:9001` (Web console).

### Configure Environment

Ensure these environment variables are set (in `__dev__/.env.dev`):

```
S3_ACCESS_KEY=dev_access_key
S3_SECRET_KEY=dev_secret_key
S3_REGION=us-east-1
S3_ENDPOINT=http://localhost:9000
S3_FORCE_PATH_STYLE=true
```

`S3_FORCE_PATH_STYLE=true` is required - MinIO does not support virtual-hosted style addressing by default.

### Create Test Buckets

Test buckets are prefixed with `test-` and created by the test setup hook (`before`). If manual creation is needed (e.g. to inspect data in the MinIO console):

```bash
# Using AWS CLI against MinIO
aws s3 mb s3://test-example \
  --endpoint-url http://localhost:9000
```

The AWS CLI requires a dummy profile configured with the same credentials as `S3_ACCESS_KEY` and `S3_SECRET_KEY`.

### Run Tests

```bash
cd _test
npm install
npm test
```

## Verification

- MinIO is healthy: `curl http://localhost:9000/minio/health/live` returns HTTP 200
- MinIO web console: open `http://localhost:9001` in a browser - login with `dev_access_key` / `dev_secret_key`
- Test buckets are created and cleaned up automatically: check console during a test run
- Tests pass: `npm test` exits with code 0

## Notes

- MinIO data is ephemeral by default (lost on container stop - the compose file uses `-d` mode without a host volume mount)
- MinIO supports most S3 operations. A few advanced features (e.g. Object Lock, Glacier) may differ or be unavailable
- Bucket names must follow S3 rules: lowercase, no underscores, 3-63 chars
- For persistent data across restarts, add a named volume to the compose file (see `docs/dev/docker-compose.yml` for reference)
