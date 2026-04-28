# AWS Account Setup

> Reference: docs/ops/cloud-provider/aws-account-setup.md

## Prerequisites

- Completed: `00-domain/`

## Steps

### Create AWS Account

* Sign up at [aws.amazon.com](https://aws.amazon.com)
* Account Name: `[TODO: project-name]-[stage]` (e.g., `myapp-sandbox`, `myapp-production`)
* Email: `[TODO: aws-account-email]`
* Support Plan: Basic (free)

### Set Default Region

* Region: `[TODO: e.g., ap-south-1 (Mumbai), us-east-1 (N. Virginia)]`
* Note: Some services (API Gateway Custom Domains, CloudFront) require `us-east-1` for SSL certificates

### Enable MFA on Root Account

* Security Credentials → Assign MFA device
* Use a virtual authenticator (e.g., Google Authenticator, Authy)

### Create Account Alias

* IAM → Account Settings → Account Alias
* Alias: `[TODO: short-project-name]`

## Verification

- Root account login works with MFA
- Default region is set correctly
- Account alias is configured

## Notes

- Maintain separate AWS accounts for sandbox and production environments
- Root account credentials stored in: `[SECRET → __dev__/secrets/sandbox.md]`
