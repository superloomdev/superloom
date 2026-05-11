# AWS IAM Setup Guide

## Overview

IAM (Identity and Access Management) controls who can access what in your AWS account. For an Superloom serverless project, you need policies, roles, and users for different access levels.

## Concept: Policies → Roles → Users

1. **Policy**: A JSON document defining permissions (what actions on what resources)
2. **Role**: An identity assumed by AWS services (e.g., Lambda assumes a role to access DynamoDB)
3. **User**: An identity for humans or external systems (programmatic access via access keys)

## Typical Policies

| Policy | Purpose | Attached To |
|---|---|---|
| Server AWS Access | Allows Lambda to access DynamoDB, S3, SES, SQS, SSM, CloudWatch | Lambda execution role |
| Signed URL Generator | Allows generating pre-signed S3 URLs for client uploads | Dedicated IAM user |
| Unit Tester | Allows access to `test_` prefixed DynamoDB tables only | Sandbox testing user |
| Frontend Dev Access | Full access to web hosting S3 buckets (sandbox only) | Frontend developer user |
| Data Admin Access | Full access to DynamoDB, CloudWatch, SSM | Database administrator |
| Data Monitor Access | Read-only access to DynamoDB, CloudWatch | Monitoring user |

## Principle of Least Privilege

- Each policy should grant only the permissions needed for its specific task
- Use resource-level restrictions (specific ARNs, not `*`) wherever possible
- Sandbox and production should have separate IAM users and roles
- Review and audit permissions periodically

## Policy JSON Structure

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["dynamodb:GetItem", "dynamodb:PutItem"],
      "Resource": "arn:aws:dynamodb:REGION:ACCOUNT:table/PROJECT-*"
    }
  ]
}
```

## Roles vs Users

| Use | Mechanism |
|---|---|
| Lambda functions accessing AWS services | Role (assumed automatically) |
| API Gateway writing to CloudWatch | Role |
| Serverless Framework deploying | User (programmatic access) |
| Developer running tests against sandbox | User (programmatic access) |
| Frontend developer uploading to S3 | User (console or programmatic) |

## Security Best Practices

- Enable MFA for all console-access users
- Rotate access keys regularly
- Never share access keys between services or team members
- Use IAM Access Analyzer to identify unused permissions
- Store all access keys and secrets in `__dev__/secrets/`, never in code
