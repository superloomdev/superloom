# Serverless Framework Setup

## Prerequisites

IAM deployer user created and SSM parameters configured.

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
  --key [From .env.production: deployer access key] \
  --secret [From .env.production: deployer secret access key] \
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

## Notes

- Each entity has its own `serverless.yml` in `_deploy/`
- SSM parameters are read automatically during deployment: `${ssm:/variable-name}`
- See `docs/architecture/server-interfaces.md` for the per-entity deployment pattern
