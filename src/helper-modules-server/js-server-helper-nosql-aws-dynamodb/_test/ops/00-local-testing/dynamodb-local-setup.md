# DynamoDB Local Testing Setup

## Overview

DynamoDB Local is a Docker-based emulator that replicates the DynamoDB API on your machine. Use it for offline development and unit testing without needing an AWS account.

## Prerequisites

- Docker Desktop installed and running
- Environment loaded: `source init-env.sh` (select `dev`)

## Steps

### Start DynamoDB Local

Using the framework's Docker Compose:

```bash
docker compose -f docs/dev/docker-compose.yml up dynamodb -d
```

DynamoDB Local runs on `http://localhost:8000`.

> **Note:** If the `dynamodb` service is not yet in the Docker Compose file, add it:
> ```yaml
> dynamodb:
>   image: amazon/dynamodb-local:latest
>   ports:
>     - "8000:8000"
>   command: ["-jar", "DynamoDBLocal.jar", "-sharedDb"]
> ```

### Configure Environment

Ensure these environment variables are set (in `__dev__/.env.dev`):

```
AWS_ACCESS_KEY_ID=local
AWS_SECRET_ACCESS_KEY=local
AWS_REGION=us-east-1
DYNAMODB_ENDPOINT=http://localhost:8000
```

The access key and secret can be any non-empty string for DynamoDB Local - they are not validated.

### Create Test Tables

Test tables are prefixed with `test_` and created by the test setup script. If manual creation is needed:

```bash
aws dynamodb create-table \
  --table-name test_example \
  --attribute-definitions AttributeName=pk,AttributeType=S \
  --key-schema AttributeName=pk,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --endpoint-url http://localhost:8000
```

### Run Tests

```bash
cd _test
npm install
npm test
```

## Verification

- DynamoDB Local is running: `curl http://localhost:8000` (should return a 400 with a DynamoDB error, confirming the service is up)
- Tables are created: `aws dynamodb list-tables --endpoint-url http://localhost:8000`
- Tests pass: `npm test` exits with code 0

## Notes

- DynamoDB Local data is ephemeral by default (lost on container restart)
- Use `--sharedDb` flag (included above) so all clients share the same database
- DynamoDB Local supports most DynamoDB operations but may not support all features (e.g., DAX, Streams)
- For persistent data across restarts, mount a Docker volume
