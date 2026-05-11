# AWS DynamoDB Setup Guide

## Overview

DynamoDB is a fully managed NoSQL database. It requires no server provisioning, patching, or scaling configuration when using on-demand capacity mode. It is the recommended NoSQL database for AWS-based Superloom projects.

## Key Concepts

- **Table**: A collection of items (rows)
- **Partition Key**: Primary key for item distribution
- **Sort Key**: Optional secondary key for ordering within a partition
- **Capacity Mode**: On-Demand (pay per request) or Provisioned (pre-allocated)

## Table Creation

Tables are defined in the project's database schema and created via the AWS Console or CLI:

- Table Name: Follow the project's naming convention
- Partition Key: As defined in the schema
- Sort Key: As defined in the schema (if applicable)
- Capacity Mode: On-Demand (recommended for most cases)

## Testing Tables

For unit testing, create tables prefixed with `test_`:

- Same schema as production tables
- Accessible only by the `unit-tester` IAM user
- Can be created and destroyed by test scripts

## Local Development

Use DynamoDB Local for offline development and testing:

```bash
docker compose -f docs/dev/docker-compose.yml up dynamodb -d
```

DynamoDB Local runs on port `8000` and supports the same API as the cloud service.

## Capacity Modes

| Mode | Best For | Cost Model |
|---|---|---|
| On-Demand | Variable or unpredictable traffic | Pay per read/write request |
| Provisioned | Predictable, steady traffic | Pre-allocated capacity units |

On-Demand is recommended for sandbox and most production workloads unless traffic patterns are well understood.

## Security

- Access is controlled entirely through IAM policies
- No network configuration needed (DynamoDB is a public-endpoint service)
- Encryption at rest is enabled by default
