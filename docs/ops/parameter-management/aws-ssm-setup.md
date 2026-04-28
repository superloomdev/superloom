# AWS SSM Parameter Store Guide

## Overview

AWS Systems Manager Parameter Store provides centralized configuration management for all environments. It stores both plain-text configuration and encrypted secrets, accessible by Lambda functions and the Serverless Framework during deployment.

## How It Works

- Parameters are key-value pairs stored in a specific AWS region
- **String** type for non-sensitive values (stage, bucket names, domains)
- **SecureString** type for sensitive values (passwords, API keys, encryption salts) - encrypted using AWS KMS
- Serverless Framework reads parameters at deploy time: `${ssm:/key-name}`

## Creating Parameters

For each parameter:
- AWS Console > Systems Manager > Parameter Store > Create Parameter
- Name: The config key name (e.g., `CFG_STAGE`)
- Description: What this parameter is for
- Type: `String` or `SecureString`
- KMS key source: My current account (for SecureString)

## Typical Configuration Keys

### Application Configuration

| Key Pattern | Description | Type |
|---|---|---|
| `CFG_STAGE` | Deployment stage (dev/prod) | String |
| `CFG_WEB_DOMAIN` | Primary web domain | String |
| `CFG_API_URL` | API endpoint domain | String |

### Database Configuration

| Key Pattern | Description | Type |
|---|---|---|
| `CFG_DB_HOST` | Database writer endpoint | SecureString |
| `CFG_DB_HOST_READER` | Database reader endpoint | SecureString |
| `CFG_DB_DATABASE` | Database name | String |
| `CFG_DB_USER` | Database username | String |
| `CFG_DB_PASS` | Database password | SecureString |

### AWS Service Configuration

| Key Pattern | Description | Type |
|---|---|---|
| `CFG_IAM_ROLE` | Lambda execution role ARN | SecureString |
| `CFG_AWS_KEY` | API server IAM access key | SecureString |
| `CFG_AWS_SECRET` | API server IAM access secret | SecureString |
| `CFG_BUCKET_*` | S3 bucket names | String |
| `CFG_DEPLOYMENT_BUCKET_NAME` | Lambda code deployment bucket | String |

### Security Configuration

| Key Pattern | Description | Type |
|---|---|---|
| `CFG_*_ENCRYPT_KEY` | Encryption/decryption keys | SecureString |
| `CFG_AUTH_TOKEN_SALT_*` | Token hashing salts (per user type) | SecureString |
| `CFG_PASSWORD_SALT_*` | Password hashing salts (per user type) | SecureString |

## Naming Convention

- All keys use `UPPER_SNAKE_CASE` with a `CFG_` prefix
- Group related keys by prefix: `CFG_DB_*`, `CFG_AWS_*`, `CFG_BUCKET_*`
- Use descriptive names that indicate purpose

## Serverless Framework Integration

In `serverless.yml`, reference parameters directly:

```yaml
environment:
  STAGE: ${ssm:/CFG_STAGE}
  DB_HOST: ${ssm:/CFG_DB_HOST}
```

## Security

- Always use `SecureString` for passwords, keys, secrets, and tokens
- `String` parameters are stored in plaintext - only use for non-sensitive config
- Access to SSM parameters is controlled by IAM policies
- Parameter values should be documented in the project `ops/` runbook, with actual secret values stored in `__dev__/secrets/`
