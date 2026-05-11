# AWS Account Setup

## Prerequisites

Domain registered.

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

## Notes

- Maintain separate AWS accounts for sandbox and production environments
- Store root account credentials in a secure password manager
