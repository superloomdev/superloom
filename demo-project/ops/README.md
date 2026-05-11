# Operations Runbook

This directory contains the complete infrastructure setup documentation for the project. It is organized as a numbered sequence of directories, each covering one infrastructure concern.

## How to Use

Follow the numbered directories in order when setting up a new environment. Each directory contains one or more vendor-specific setup files.

## Structure

| # | Directory | Purpose |
|---|---|---|
| 00 | `00-domain/` | Domain registration |
| 01 | `01-dns/` | DNS hosted zone and nameserver delegation |
| 02 | `02-ssl-certificates/` | TLS/SSL certificate provisioning |
| 03 | `03-cloud-provider/` | Cloud account setup (AWS, GCP, etc.) |
| 04 | `04-billing/` | Budget alerts and cost management |
| 05 | `05-development-environment/` | Virtual workspaces and local tooling |
| 06 | `06-source-control/` | Repository hosting, CI/CD, access tokens |
| 07 | `07-identity-access/` | IAM users, roles, policies |
| 08 | `08-networking/` | VPC, security groups, network config |
| 09 | `09-object-storage/` | S3 buckets, file storage |
| 10 | `10-parameter-management/` | Configuration keys and secret references |
| 11 | `11-relational-database/` | MySQL, Postgres, Aurora |
| 12 | `12-nosql-database/` | DynamoDB, MongoDB |
| 13 | `13-messaging/` | Email, push, SMS services |
| 14 | `14-cdn/` | Content delivery network setup |
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
