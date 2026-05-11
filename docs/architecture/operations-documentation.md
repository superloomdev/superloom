# Operations Documentation

How infrastructure and deployment documentation is organized across the framework and individual projects. The strategy is a **three-layer split** based on security, distribution, and audience: framework knowledge in `docs/ops/`, project runbook in the project's own `ops/`, and secrets in the developer's gitignored `__dev__/secrets/`.

## On This Page

- [Three-Layer Documentation Strategy](#three-layer-documentation-strategy)
- [Layer 1 - Framework Knowledge (`docs/ops/`)](#layer-1---framework-knowledge-docsops)
- [Layer 2 - Project Runbook (`ops/`)](#layer-2---project-runbook-ops)
- [Layer 3 - Secrets (`__dev__/secrets/`)](#layer-3---secrets-__dev__secrets)
- [Module-Level Testing Ops (`_test/ops/`)](#module-level-testing-ops-_testops)
- [Naming Conventions](#naming-conventions)
- [Content Format](#content-format)
- [Handover Scenario](#handover-scenario)

---

## Three-Layer Documentation Strategy

Operations documentation is split into three layers based on security, distribution, and audience:

| Layer | Location | In Git? | Content | Audience |
|---|---|---|---|---|
| **Framework Knowledge** | `docs/ops/` | Yes | Generic how-to guides, no secrets | All framework users |
| **Project Runbook** | `ops/` (project root) | Yes | Project-specific steps, config names, endpoints | Project team |
| **CI/CD credentials** | `.env.production`, `.env.integration` | No | Access keys, tokens consumed by CI | Owner/Lead only |
| **Runtime secrets** | `__dev__/secrets/` | No | Passwords, encryption keys used at runtime | Owner/Lead only |

---

## Layer 1 - Framework Knowledge (`docs/ops/`)

Generic, project-agnostic reference guides. These explain **how to** set up a service for any project built with Superloom. They contain no project-specific names, no secrets, no specific values.

```
docs/
  ops/
    README.md
    source-control/
      github-org-setup.md
      github-tokens-setup.md
    identity-access/
      aws-iam-setup.md
    object-storage/
      aws-s3-setup.md
    ...
```

**Rules:**
- Vendor-agnostic folder names (e.g., `object-storage/` not `s3/`)
- Vendor-prefixed file names (e.g., `aws-s3-setup.md`, `gcp-gcs-setup.md`)
- No project-specific resource names, ARNs, endpoints, or credentials
- Educational tone - explain the "why" alongside the "how"

---

## Layer 2 - Project Runbook (`ops/`)

Each project has an `ops/` directory at the project root, alongside `src/`. This is the **numbered, sequential, handover-ready** documentation for that specific project.

```
my-project/
  src/
  ops/
    README.md
    00-domain/
      domain-setup.md
    01-dns/
      aws-route53-setup.md
    02-ssl-certificates/
      aws-acm-setup.md
    03-cloud-provider/
      aws-account-setup.md
    04-billing/
      aws-budget-setup.md
    05-development-environment/
      aws-workspace-setup.md
    06-source-control/
      github-org-setup.md
      github-tokens-setup.md
      github-actions-setup.md
    07-identity-access/
      aws-iam-setup.md
      policy-api-server.json
    08-networking/
      aws-vpc-setup.md
    09-object-storage/
      aws-s3-setup.md
    10-parameter-management/
      aws-ssm-setup.md
    11-relational-database/
      aws-rds-mysql-setup.md
    12-nosql-database/
      aws-dynamodb-setup.md
      mongodb-atlas-setup.md
    13-messaging/
      aws-ses-setup.md
    14-cdn/
      aws-cloudfront-setup.md
    15-deployment/
      serverless-setup.md
      serverless-custom-domains-setup.md
    16-scheduled-tasks/
      aws-eventbridge-setup.md
```

**Rules:**
- Top-level entries are always numbered directories: `00-domain/`, `01-dns/`, etc.
- Numbers define both **setup sequence and dependency order** — a step is numbered after everything it depends on. DNS comes before SSL because ACM validation requires a live hosted zone; SSL comes before CDN because CloudFront requires a certificate.
- Vendor-agnostic directory names, vendor-prefixed file names.
- Files are named `{vendor}-{service}-setup.md`. A bare `setup.md` with no prefix is not acceptable.
- Multiple services in the same category each get their own file (e.g. `aws-dynamodb-setup.md`, `mongodb-atlas-setup.md`).
- Policy JSON files, SQL scripts, and other supporting artifacts live alongside their setup doc in the same directory.
- Secret values are never written inline — see the Secrets section for the correct reference format.
- Projects using only a subset of categories renumber from `00` in their own dependency order. Never carry over numbers from this reference example — the numbers here are illustrative, not fixed.

**Numbering Convention:**
The number prefix ensures the runbook is followed in order. A developer setting up a new environment starts at `00` and works through each folder sequentially. The canonical dependency order is:

| # | Category | Depends On |
|---|---|---|
| 00 | `domain` | — |
| 01 | `dns` | 00 — nameservers must be set before DNS validation |
| 02 | `ssl-certificates` | 01 — DNS must be live for ACM validation |
| 03 | `cloud-provider` | — |
| 04 | `billing` | 03 |
| 05 | `development-environment` | 03 |
| 06 | `source-control` | — |
| 07 | `identity-access` | 03 — IAM lives inside the cloud account |
| 08 | `networking` | 07 — VPCs need IAM roles to attach |
| 09 | `object-storage` | 07 — buckets need IAM policies |
| 10 | `parameter-management` | 07 — SSM needs IAM access |
| 11 | `relational-database` | 08, 10 — needs VPC and config |
| 12 | `nosql-database` | 07, 10 |
| 13 | `messaging` | 07 |
| 14 | `cdn` | 02, 09 — needs cert and origin bucket |
| 15 | `deployment` | 07, 14 — needs IAM and CDN live |
| 16 | `scheduled-tasks` | 15 — triggers deployed functions |

---

## Layer 3 - Secrets

Secret values are never written into runbook files. Where a value goes depends on how it is consumed:

| Secret type | Where it lives | Reference format in runbook |
|---|---|---|
| CI/CD credentials (access keys, tokens) | `.env.production`, `.env.integration` | `From .env.production` |
| Runtime config (DB passwords, encryption keys) | `__dev__/secrets/production.md` | `[SECRET → __dev__/secrets/production.md]` |

**Rules:**
- `__dev__/` is fully gitignored — no partial exceptions
- `.env.*` files are gitignored — never commit them
- Runbook files always use a reference, never the actual value
- Handover of secrets happens through secure channels, not git

**Example — CI/CD credentials (`ops/05-identity-access/aws-iam-setup.md`):**

```markdown
* Copy the Access Key ID and Secret Access Key immediately — shown only once
* Store both in `.env.production`
```

**Example — runtime config (`ops/10-parameter-management/aws-ssm-setup.md`):**

```markdown
| Key | Description | Type | Value |
|---|---|---|---|
| CFG_STAGE | Deployment stage | String | dev |
| CFG_DB_HOST | MySQL writer endpoint | SecureString | [SECRET → __dev__/secrets/production.md] |
| CFG_DB_PASS | MySQL password | SecureString | [SECRET → __dev__/secrets/production.md] |
```

---

## Module-Level Testing Ops (`_test/ops/`)

Service-dependent helper modules (e.g., DynamoDB, S3, Postgres) may need their own operational setup for testing. These docs live inside the module's `_test/ops/` directory and follow the same pattern:

```
js-server-helper-aws-dynamodb/
  _test/
    ops/
      00-local-testing/
        dynamodb-local-setup.md
      01-integration-testing/
        aws-dynamodb-integration-setup.md
    package.json
    test.js
```

**Rules:**
- Only include categories relevant to the module's testing needs
- Numbered sequence for setup order
- Same vendor-agnostic folder / vendor-prefixed file naming convention
- Local testing ops (Docker-based) come first, integration testing ops follow
- These docs travel with the module when published

---

## Naming Conventions

**Directory Names (vendor-agnostic), listed in canonical dependency order:**

| Category | Directory Name | What It Covers |
|---|---|---|
| Domain registration | `domain` | Domain purchase, MX records |
| DNS management | `dns` | Route 53, Cloudflare DNS |
| TLS/SSL | `ssl-certificates` | ACM, Let's Encrypt, Cloudflare |
| Cloud account | `cloud-provider` | AWS, GCP, Azure account setup |
| Cost management | `billing` | Budget alerts, cost tracking |
| Dev tools | `development-environment` | Virtual workspaces, local tools |
| Repository hosting | `source-control` | GitHub, GitLab, Bitbucket |
| Authentication | `identity-access` | IAM, service accounts, roles |
| Network config | `networking` | VPC, security groups, firewalls |
| File storage | `object-storage` | S3, GCS, Azure Blob |
| Config/secrets | `parameter-management` | SSM, Vault, Secret Manager |
| SQL databases | `relational-database` | RDS, Cloud SQL, Aurora |
| NoSQL databases | `nosql-database` | DynamoDB, MongoDB, Firestore |
| Notifications | `messaging` | SES, SNS, SendGrid, Twilio |
| Content delivery | `cdn` | CloudFront, Cloudflare, Fastly |
| App deployment | `deployment` | Serverless, ECS, Kubernetes |
| Timed jobs | `scheduled-tasks` | EventBridge, Cloud Scheduler |

**File Names (vendor-prefixed):**
- `aws-s3-setup.md` - AWS S3 setup guide
- `aws-rds-postgres-setup.md` - AWS RDS Postgres setup
- `mongodb-atlas-setup.md` - MongoDB Atlas setup
- `cloudflare-setup.md` - Cloudflare CDN setup
- `serverless-setup.md` - Serverless Framework setup

This ensures top-level directories remain stable even when switching vendors.

---

## Content Format

Every setup file follows this structure:

```markdown
# [Service Name] Setup

## Prerequisites

[One or two plain sentences describing what must exist before this step. Name the concept, not the folder.]

## Steps

### [Step Title]

* [Actionable step]
* [Actionable step]
* Config Value: [value or .env reference]

## Notes

- [Non-obvious gotcha, cost implication, or important constraint — omit if nothing meaningful to say]
```

**Rules:**
- Start Prerequisites with a plain sentence — describe what must be ready, not which folder number to complete first. Folder numbers change; concepts don't.
- Use `## Notes` only when there is something genuinely non-obvious. Omit it entirely if there is nothing to say.
- No `## Verification` section. Ops runbooks record configuration, not test scripts. If something needs confirming, note it inline within the step.
- No `> Reference:` line. The reader can consult `docs/ops/` directly if they need background.
- Secret and token values are never written inline. Use `.env.production` / `.env.integration` for CI/CD credentials. Use `[SECRET → __dev__/secrets/production.md]` only for values that are not environment variables (e.g. database passwords used outside CI).
- Keep language direct and minimal. Every sentence a reviewer has to read is overhead.

---

## Handover Scenario

When transferring project ownership:

1. **Grant git access** - the new owner gets the full `ops/` runbook with all procedures, config names, and setup steps
2. **Transfer secrets securely** - send `__dev__/secrets/` files through a secure channel (encrypted email, password manager, etc.)
3. **Walk through the runbook** - the numbered sequence guides the new owner through the entire infrastructure

The new owner can then follow the runbook from `00-domain/` to `16-scheduled-tasks/` to understand and manage every piece of the infrastructure.

## Further Reading

- [Infrastructure Reference](../ops/README.md) - the framework-level guides themselves
- [Architectural Philosophy](architectural-philosophy.md) - the broader directory layout
- [Module Testing](module-testing.md) - how `_test/ops/` slots into the testing strategy
