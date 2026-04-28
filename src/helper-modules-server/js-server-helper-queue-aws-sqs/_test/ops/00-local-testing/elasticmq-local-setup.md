# ElasticMQ Local Testing Setup

## Overview

ElasticMQ is an in-memory SQS-compatible message queue that runs in Docker. Use it for offline development and unit testing without needing an AWS account.

## Prerequisites

- Docker Desktop installed and running
- Environment loaded: `source init-env.sh` (select `dev`)

## Steps

### Start ElasticMQ

Using the framework's Docker Compose:

```bash
docker compose -f docs/dev/docker-compose.yml up elasticmq -d
```

ElasticMQ runs on `http://localhost:9324` (SQS API) and `http://localhost:9325` (management UI).

> **Note:** If the `elasticmq` service is not yet in the Docker Compose file, add it:
> ```yaml
> elasticmq:
>   image: softwaremill/elasticmq:1.6.9
>   ports:
>     - "9324:9324"
>     - "9325:9325"
> ```

### Configure Environment

Ensure these environment variables are set (in `__dev__/.env.dev`):

```
AWS_ACCESS_KEY_ID=local
AWS_SECRET_ACCESS_KEY=local
AWS_REGION=us-east-1
SQS_ENDPOINT=http://localhost:9324
```

The access key and secret can be any non-empty string for ElasticMQ - they are not validated.

### Run Tests

```bash
cd _test
npm install
npm test
```

## Verification

- ElasticMQ is running: `curl http://localhost:9324` (should return an XML response confirming the service is up)
- Management UI is accessible: `http://localhost:9325` in a browser
- Tests pass: `npm test` exits with code 0

## Notes

- ElasticMQ data is ephemeral by default (lost on container restart)
- ElasticMQ supports most SQS operations including standard and FIFO queues
- Queue creation happens automatically in tests via the `before()` hook
- No configuration file is needed for basic usage - ElasticMQ auto-creates queues on first use
