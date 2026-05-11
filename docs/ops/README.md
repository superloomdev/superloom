# Infrastructure Reference Guides

Generic, project-agnostic guides for setting up infrastructure services used by projects. These are framework-level **knowledge** - they explain *how* to set up each service. Project-specific values, ARNs, and configuration belong in your project's own `ops/` runbook (numbered `00-domain/`, `01-cloud-provider/`, ...). Real secrets belong in `__dev__/secrets/` and never in git.

## On This Page

- [Purpose](#purpose)
- [Structure](#structure)
- [How to Use These Guides](#how-to-use)
- [Full Standard](#full-standard)

---

## Purpose

These guides explain **how** to set up each service. They contain no project-specific names, secrets, or configuration values. Use them as a knowledge base when filling in your project's `ops/` runbook.

## Structure

Each directory represents a vendor-agnostic infrastructure category. Inside each directory, files are named by vendor and service.

| Directory | Category | Example Services |
|---|---|---|
| `domain/` | Domain registration | Namecheap, GoDaddy, Google Domains |
| `dns/` | DNS management | Route 53, Cloudflare DNS |
| `ssl-certificates/` | TLS/SSL provisioning | AWS ACM, Let's Encrypt |
| `cloud-provider/` | Cloud accounts | AWS, GCP, Azure |
| `billing/` | Cost management | AWS Budgets, GCP Billing |
| `development-environment/` | Dev tooling and workspaces | AWS Cloud9, local setup |
| `source-control/` | Repository and CI/CD | GitHub, GitLab, Bitbucket |
| `identity-access/` | Authentication and authorization | AWS IAM, GCP IAM |
| `networking/` | Network configuration | VPC, Security Groups |
| `object-storage/` | File storage | AWS S3, GCP GCS, MinIO |
| `parameter-management/` | Configuration and secrets | AWS SSM, HashiCorp Vault |
| `relational-database/` | SQL databases | AWS RDS, Cloud SQL |
| `nosql-database/` | NoSQL databases | DynamoDB, MongoDB, Firestore |
| `messaging/` | Email, push, SMS | SES, SNS, SendGrid |
| `cdn/` | Content delivery | CloudFront, Cloudflare |
| `deployment/` | Application deployment | Serverless Framework, Docker |
| `scheduled-tasks/` | Timed jobs | EventBridge, Cloud Scheduler |

---

## How to Use

1. Read the relevant guide here to understand the service and approach
2. Create the corresponding entry in your project's `ops/` runbook with project-specific values
3. Store any actual secret values in `__dev__/secrets/`

The three-layer split keeps generic knowledge here, project values in the project repo, and secrets on each developer's machine - never in git.

---

## Full Standard

See [`architecture/operations-documentation.md`](../architecture/operations-documentation.md) for the complete documentation standard - naming conventions, content format, and the three-layer strategy.

## Further Reading

- [Operations Documentation](../architecture/operations-documentation.md) - the standard these guides follow
- [Architectural Philosophy](../architecture/architectural-philosophy.md) - the broader directory layout
- Project runbook example: `demo-project/ops/`
