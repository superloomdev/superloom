# Operations Runbook — superloom.dev Website

This directory contains the complete infrastructure setup documentation for hosting the Superloom website. Follow the numbered directories in order when setting up or handing over the environment.

## Structure

| # | Directory | Purpose |
|---|---|---|
| 00 | `00-domain/` | Domain registration and Route 53 hosted zone |
| 01 | `01-dns/` | DNS configuration and nameserver delegation |
| 02 | `02-ssl-certificates/` | TLS certificate provisioning via ACM |
| 03 | `03-object-storage/` | S3 bucket for website assets |
| 04 | `04-cdn/` | CloudFront distribution |
| 05 | `05-identity-access/` | IAM policy for CI/CD deployment |
| 06 | `06-deployment/` | CI/CD pipeline (GitHub Actions) |

## Conventions

- **Directory names** are vendor-agnostic (`object-storage/`, not `s3/`)
- **File names** are vendor-prefixed (`aws-s3-setup.md`, not `setup.md`)
- **Secret values** are never stored here — reference `__dev__/secrets/` instead
- **Secret format:** `[SECRET → __dev__/secrets/production.md]`

## Reference

For generic how-to guides, see [`docs/ops/`](../../docs/ops/).
For the full documentation standard, see [`docs/architecture/operations-documentation.md`](../../docs/architecture/operations-documentation.md).
