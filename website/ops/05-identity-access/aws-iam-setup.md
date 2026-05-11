# AWS IAM Setup — Website CI/CD

## Prerequisites

S3 bucket and CloudFront distribution created.

## Steps

### Create an IAM Policy

* AWS Console → IAM → Policies → Create policy
* Use the JSON editor and paste the policy from `policy-website-deploy.json`
* Name: `superloom-website-deploy-policy`

### Create an IAM User for CI/CD

* AWS Console → IAM → Users → Create user
* Username: `superloom-website-ci`
* Access type: **Programmatic access only**
* Attach policy: `superloom-website-deploy-policy`

### Generate Access Keys

* IAM → Users → `superloom-website-ci` → Security credentials → Create access key
* Use case: Application running outside AWS
* Copy the Access Key ID and Secret Access Key immediately — shown only once
* Store both in `.env.production`

## Notes

- Access key grants S3 write and CloudFront invalidation only — no other AWS permissions
- Rotate the access key if ever exposed
