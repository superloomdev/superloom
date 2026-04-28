# AWS Account Setup Guide

## Overview

AWS is the primary cloud provider for Superloom projects using Lambda, DynamoDB, S3, and related services. Each environment (sandbox, production) should use a separate AWS account for isolation.

## Account Creation

- Sign up at [aws.amazon.com](https://aws.amazon.com)
- Use a dedicated email address per account (e.g., `aws-sandbox@domain.com`)
- Select the Basic (free) support plan unless enterprise support is needed

## Essential First Steps

### Enable MFA on Root Account

- Security Credentials → Assign MFA device
- Use a virtual authenticator (Google Authenticator, Authy)
- Root account should rarely be used after initial setup

### Set Default Region

Choose a region close to your users:

| Region | Code | Typical Use |
|---|---|---|
| US East (N. Virginia) | `us-east-1` | Global services, CloudFront certificates |
| Asia Pacific (Mumbai) | `ap-south-1` | India-focused applications |
| EU (Ireland) | `eu-west-1` | Europe-focused applications |

Note: Some AWS services (API Gateway Custom Domains, CloudFront) require SSL certificates in `us-east-1` regardless of your primary region.

### Create Account Alias

- IAM → Account Settings → Account Alias
- Makes the sign-in URL human-readable

## Multi-Account Strategy

| Account | Purpose |
|---|---|
| Sandbox | Development, testing, staging |
| Production | Live customer-facing services |

Separate accounts provide:
- Complete resource isolation
- Independent billing tracking
- No risk of sandbox changes affecting production

## Next Steps

After account setup, proceed to budget configuration and IAM user creation.
