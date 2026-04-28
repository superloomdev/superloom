# Operations Runbook

This directory contains the complete infrastructure setup documentation for the project. It is organized as a numbered sequence of directories, each covering one infrastructure concern.

## How to Use

Follow the numbered directories in order when setting up a new environment. Each directory contains one or more vendor-specific setup files.

## Structure

| # | Directory | Purpose |
|---|---|---|
| 00 | `00-domain/` | Domain registration and DNS foundation |
| 01 | `01-cloud-provider/` | Cloud account setup (AWS, GCP, etc.) |
| 02 | `02-billing/` | Budget alerts and cost management |
| 03 | `03-development-environment/` | Virtual workspaces and local tooling |
| 04 | `04-source-control/` | Repository hosting, CI/CD, access tokens |
| 05 | `05-identity-access/` | IAM users, roles, policies |
| 06 | `06-networking/` | VPC, security groups, network config |
| 07 | `07-object-storage/` | S3 buckets, file storage |
| 08 | `08-parameter-management/` | Configuration keys and secret references |
| 09 | `09-relational-database/` | MySQL, Postgres, Aurora |
| 10 | `10-nosql-database/` | DynamoDB, MongoDB |
| 11 | `11-ssl-certificates/` | TLS/SSL certificate provisioning |
| 12 | `12-cdn/` | Content delivery network setup |
| 13 | `13-dns/` | DNS records and routing |
| 14 | `14-messaging/` | Email, push, SMS services |
| 15 | `15-deployment/` | Serverless deployment, custom domains |
| 16 | `16-scheduled-tasks/` | Cron jobs, scheduled triggers |

## Conventions

- **Directory names** are vendor-agnostic (e.g., `object-storage/`, not `s3/`)
- **File names** are vendor-prefixed (e.g., `aws-s3-setup.md`, `cloudflare-setup.md`)
- **No bare `setup.md`** - always prefix with the vendor/service name
- **Secret values** are never stored here - reference `__dev__/secrets/` instead
- **Format:** `[SECRET → __dev__/secrets/sandbox.md]` for any sensitive value

## Secrets

All secret values (passwords, API keys, encryption salts) are stored in `__dev__/secrets/`, which is fully gitignored. See `__dev__/secrets/README.md` for details.

## Reference

For generic how-to guides (not project-specific), see `docs/ops/` in the Superloom repository.

For the full documentation standard, see `docs/architecture/operations-documentation.md`.
