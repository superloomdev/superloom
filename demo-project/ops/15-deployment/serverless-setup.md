# Serverless Framework Setup

> Reference: docs/ops/deployment/serverless-setup.md

## Prerequisites

- Completed: `05-identity-access/`, `08-parameter-management/`

## Steps

### Install Dependencies

* Install Node.js (v24+ recommended): [nodejs.org](https://nodejs.org)
* Install Serverless Framework globally:
```bash
npm install -g serverless
```

### Configure AWS Credentials

Create a Serverless user profile for AWS access:

```bash
serverless config credentials \
  --provider aws \
  --key [SECRET: IAM access key] \
  --secret [SECRET: IAM access secret] \
  --profile [TODO: project]-aws-[stage]
```

### Deploy

From the project root:

```bash
serverless deploy --stage [TODO: stage]
```

Or deploy a specific entity:

```bash
cd _deploy/[entity-name]
serverless deploy --stage [TODO: stage]
```

### Update Serverless

Keep the framework up to date:

```bash
npm install -g serverless@latest
```

## Verification

- `serverless --version` shows the installed version
- `serverless deploy` completes without errors
- Lambda functions appear in AWS Console
- API endpoints are accessible

## Notes

- Each entity has its own `serverless.yml` in `_deploy/`
- SSM parameters are read automatically during deployment: `${ssm:/variable-name}`
- All deployment credentials stored in: `[SECRET → __dev__/secrets/sandbox.md]`
- See `docs/architecture/server-interfaces.md` for the per-entity deployment pattern
