# Serverless Framework Deployment Guide

## Overview

The Serverless Framework deploys Lambda functions, API Gateway endpoints, and related resources to AWS. Superloom uses per-entity deployment - each entity has its own `serverless.yml` and is deployed independently.

## Prerequisites

- Node.js 24+ installed
- Serverless Framework installed globally: `npm install -g serverless`
- AWS IAM credentials configured (see identity-access guide)

## AWS Credentials Configuration

Create a named profile for each environment:

```bash
serverless config credentials \
  --provider aws \
  --key [IAM_ACCESS_KEY] \
  --secret [IAM_ACCESS_SECRET] \
  --profile [project]-aws-[stage]
```

## Deployment

### Deploy All Functions for an Entity

```bash
cd _deploy/[entity-name]
serverless deploy --stage [stage]
```

### Deploy a Single Function

```bash
cd _deploy/[entity-name]
serverless deploy function -f [function-name] --stage [stage]
```

## SSM Parameter Integration

Serverless reads configuration from SSM Parameter Store at deploy time:

```yaml
provider:
  environment:
    STAGE: ${ssm:/CFG_STAGE}
    DB_HOST: ${ssm:/CFG_DB_HOST}
```

Syntax: `${ssm:/parameter-name}`

## Per-Entity Architecture

Each entity is a separate Serverless service:

```
_deploy/
  user/
    serverless.yml          # User entity Lambda config
  order/
    serverless.yml          # Order entity Lambda config
  brand/
    serverless.yml          # Brand entity Lambda config
```

This allows independent deployment, scaling, and rollback per entity.

## Custom Domains

API Gateway custom domains map paths to entity services. See the custom domains setup guide for configuration.

## Lambda Layers

Pre-packaged dependencies that are shared across Lambda functions:

- Install layer dependencies in the layer directory
- Reference layers in `serverless.yml`
- Common layers: Puppeteer/Chromium, GraphicsMagick, monitoring agents

## Maintenance

- Keep Serverless Framework updated: `npm install -g serverless@latest`
- Review deployment logs in CloudWatch
- Use `serverless print` to verify resolved configuration values

## Alternatives

| Approach | When to Use |
|---|---|
| Serverless Framework | Lambda + API Gateway, per-entity deployment |
| AWS SAM | AWS-native, CloudFormation-based |
| Docker + ECS/EKS | Container-based, long-running processes |
| Express on EC2/ECS | Traditional server deployment |

Superloom supports both Serverless (Lambda) and Express (Docker) from the same codebase.
