# CI/CD Deployment Setup

## Prerequisites

IAM user and access keys created. GitHub repository: `superloomdev/superloom`.

## Steps

### Add GitHub Actions Secrets

* GitHub → Repository → Settings → Secrets and variables → Actions → New repository secret

| Secret name | Value |
|---|---|
| `WEBSITE_DEPLOY_AWS_ACCESS_KEY_ID` | From `.env.production` |
| `WEBSITE_DEPLOY_AWS_SECRET_ACCESS_KEY` | From `.env.production` |
| `WEBSITE_DEPLOY_AWS_REGION` | `us-east-1` |
| `WEBSITE_DEPLOY_S3_BUCKET` | `superloom-website` |
| `WEBSITE_DEPLOY_CLOUDFRONT_DISTRIBUTION_ID` | CloudFront distribution ID |

### Workflow File

Already created at `.github/workflows/deploy-website.yml`.

Triggers on push to `main` when files under `website/` or `docs/` change, or manually via `workflow_dispatch`. Builds VitePress, syncs `website/.vitepress/dist/` to S3, then invalidates the CloudFront cache.

## Notes

- `--delete` removes files from S3 that no longer exist in the build output
