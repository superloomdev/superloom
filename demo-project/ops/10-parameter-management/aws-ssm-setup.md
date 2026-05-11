# AWS SSM Parameter Store Setup

## Prerequisites

IAM setup, S3 buckets, relational and NoSQL databases created — their endpoints and names are needed to fill parameter values.

## Steps

### Overview

AWS Systems Manager Parameter Store is used to manage configuration values for all environments. Each parameter is created in the appropriate AWS region.

Region: `[TODO: e.g., ap-south-1]`

### Create Parameters

For each key listed below:
* AWS Console → Systems Manager → Parameter Store → Create Parameter
* Name: Key name from the table
* Description: As listed
* Type: `String` for general config, `SecureString` for sensitive values
* KMS key source: My current account (for SecureString)

### Parameter Reference

Serverless Framework reads these values using: `${ssm:/variable-name}`

### Configuration Keys

| Key | Description | Type | Sandbox | Production |
|---|---|---|---|---|
| CFG_STAGE | Deployment stage | String | dev | prod |
| CFG_IAM_ROLE | Lambda execution role ARN | SecureString | [SECRET] | [SECRET] |
| CFG_DEPLOYMENT_BUCKET_NAME | S3 bucket for Lambda code | String | `[TODO]` | `[TODO]` |
| CFG_WEB_DOMAIN | Web application domain | String | `[TODO]` | `[TODO]` |
| CFG_API_URL | API endpoint domain | String | `[TODO]` | `[TODO]` |
| CFG_DB_HOST | Relational DB writer endpoint | SecureString | [SECRET] | [SECRET] |
| CFG_DB_HOST_READER | Relational DB reader endpoint | SecureString | [SECRET] | [SECRET] |
| CFG_DB_DATABASE | Relational DB name | String | `[TODO]` | `[TODO]` |
| CFG_DB_USER | Relational DB username | String | `[TODO]` | `[TODO]` |
| CFG_DB_PASS | Relational DB password | SecureString | [SECRET] | [SECRET] |
| CFG_MONGO_DB_HOST | MongoDB host endpoint | SecureString | [SECRET] | [SECRET] |
| CFG_MONGO_DB_DATABASE | MongoDB database name | String | `[TODO]` | `[TODO]` |
| CFG_MONGO_DB_USER | MongoDB username | String | `[TODO]` | `[TODO]` |
| CFG_MONGO_DB_PASS | MongoDB password | SecureString | [SECRET] | [SECRET] |
| CFG_AWS_KEY | API server IAM access key | SecureString | [SECRET] | [SECRET] |
| CFG_AWS_SECRET | API server IAM access secret | SecureString | [SECRET] | [SECRET] |
| CFG_AWS_KEY_FILE_UPLOAD | Signed URL generator access key | SecureString | [SECRET] | [SECRET] |
| CFG_AWS_SECRET_FILE_UPLOAD | Signed URL generator access secret | SecureString | [SECRET] | [SECRET] |
| CFG_BUCKET_MEDIA | S3 bucket for processed media | String | `[TODO]` | `[TODO]` |
| CFG_BUCKET_MEDIA_DOMAIN | Public domain for media files | String | `[TODO]` | `[TODO]` |
| CFG_BUCKET_FILE_RAW | S3 bucket for raw uploads | String | `[TODO]` | `[TODO]` |
| CFG_BUCKET_FILE_UPLOAD | S3 bucket for temporary uploads | String | `[TODO]` | `[TODO]` |

Values marked `[SECRET]` are runtime secrets — store in `[SECRET → __dev__/secrets/production.md]`.

### Adding Application-Specific Keys

Add custom parameters as needed:

| Key | Description | Type | Value |
|---|---|---|---|
| `[TODO]` | `[TODO]` | `[TODO]` | `[TODO]` |

## Notes

- SecureString parameters are encrypted at rest using AWS KMS
- Parameter names are case-sensitive
- Non-secret values (stage, bucket names, domains) are documented here directly
