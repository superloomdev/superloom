# AWS IAM Setup

## Prerequisites

AWS account active.

## Steps

### Create Policies

Create custom IAM policies for each service access level.

#### API Server Access Policy

* IAM → Policies → Create Policy → JSON
* Policy Document: See `policy-api-server.json` in this directory
* Name: `[TODO: Project]-Server-AWS-Access`
* Description: Allows server Lambda functions to access AWS services

#### Signed URL Generator Policy

* IAM → Policies → Create Policy → JSON
* Policy Document: See `policy-signed-url.json` in this directory
* Name: `[TODO: Project]-Server-Generate-Public-Signed-Url`
* Description: Allows server to generate time-bound signed URLs for client-side file uploads

#### Unit Tester Policy (Sandbox Only)

* IAM → Policies → Create Policy → JSON
* Policy Document: See `policy-unit-tester.json` in this directory
* Name: `[TODO: Project]-Unit-Tester-Access`
* Description: Allows access to DynamoDB tables with `test_` prefix

### Create Roles

#### Lambda Execution Role

* IAM → Roles → Create Role
* Trusted Entity: AWS Lambda
* Attach Policy: `[TODO: Project]-Server-AWS-Access`
* Name: `[TODO: Project]-Lambda-AWS-Access`
* Description: Allows Lambda functions to call AWS services

#### API Gateway CloudWatch Role

* IAM → Roles → Create Role
* Trusted Entity: API Gateway
* Attach Policy: `AmazonAPIGatewayPushToCloudWatchLogs` (AWS managed)
* Name: `[TODO: Project]-Api-Gateway-Access-To-Cloud-Watch`
* Description: Allows API Gateway to push logs to CloudWatch

### Create Users

#### API Server User

* IAM → Users → Create User
* Name: `[TODO: project]-api-server`
* Access type: Programmatic access
* Attach Policy: `[TODO: Project]-Server-AWS-Access`
* After creation → Security Credentials → Create Access Key
* Store access key in `.env.production`

#### Signed URL Generator User

* IAM → Users → Create User
* Name: `[TODO: project]-signed-url-generator`
* Access type: Programmatic access
* Attach Policy: `[TODO: Project]-Server-Generate-Public-Signed-Url`
* Store access key in `.env.production`

#### Serverless Deployer User

* IAM → Users → Create User
* Name: `[TODO: project]-serverless-builder`
* Access type: Programmatic access
* Attach Policy: `AdministratorAccess` (AWS managed)
* Store access key in `.env.production`

#### Unit Tester User (Sandbox Only)

* IAM → Users → Create User
* Name: `[TODO: project]-unit-tester`
* Access type: Programmatic access
* Attach Policy: `[TODO: Project]-Unit-Tester-Access`
* Store access key in `.env.production`

## Notes

- Follow the principle of least privilege — only grant permissions each user/role needs
- Maintain separate IAM users for sandbox and production
- Rotate access keys periodically
