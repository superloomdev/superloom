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
| **Secrets** | `__dev__/secrets/` | No | Actual passwords, keys, tokens | Owner/Lead only |

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

Each project (including the demo project) has an `ops/` directory at the project root, alongside `src/`. This is the **numbered, sequential, handover-ready** documentation for that specific project.

```
my-project/
  src/
  ops/
    README.md
    00-domain/
      domain-setup.md
    01-cloud-provider/
      aws-account-setup.md
    02-billing/
      aws-budget-setup.md
    03-development-environment/
      aws-workspace-setup.md
    04-source-control/
      github-org-setup.md
      github-tokens-setup.md
      github-actions-setup.md
    05-identity-access/
      aws-iam-setup.md
      policy-api-server.json
    06-networking/
      aws-vpc-setup.md
    07-object-storage/
      aws-s3-setup.md
    08-parameter-management/
      aws-ssm-setup.md
    09-relational-database/
      aws-rds-mysql-setup.md
    10-nosql-database/
      aws-dynamodb-setup.md
      mongodb-atlas-setup.md
    11-ssl-certificates/
      aws-acm-setup.md
    12-cdn/
      aws-cloudfront-setup.md
    13-dns/
      aws-route53-setup.md
    14-messaging/
      aws-ses-setup.md
    15-deployment/
      serverless-setup.md
      serverless-custom-domains-setup.md
    16-scheduled-tasks/
      aws-eventbridge-setup.md
```

**Rules:**
- Top-level entries are always numbered directories: `00-domain/`, `01-cloud-provider/`, etc.
- Numbers define the setup sequence - a new team lead follows them in order
- Vendor-agnostic directory names, vendor-prefixed file names
- Files are always named `{vendor}-{service}-setup.md` (never bare `setup.md`)
- If a project uses multiple services in the same category (e.g., DynamoDB and MongoDB), each gets its own file
- Policy JSON files, SQL scripts, and other supporting files live alongside their setup doc
- **No actual secret values** - reference `__dev__/secrets/` for any sensitive data
- Secret references use the format: `[SECRET → __dev__/secrets/sandbox.md]`

**Numbering Convention:**
The number prefix ensures the runbook is followed in order. A developer setting up a new environment starts at `00` and works through each folder sequentially.

---

## Layer 3 - Secrets (`__dev__/secrets/`)

Actual secret values (passwords, API keys, encryption salts, tokens) are stored in the developer's personal gitignored workspace.

```
__dev__/
  secrets/
    README.md           # Explains what files are expected and how to obtain them
    sandbox.md          # Secret values for the sandbox/dev environment
    production.md       # Secret values for the production environment
```

**Rules:**
- `__dev__/` is fully gitignored - no partial gitignore exceptions
- Each developer is responsible for safekeeping their own `__dev__/secrets/` folder
- Handover of secrets happens through secure channels (not git)
- The `README.md` inside `__dev__/secrets/` explains what files should exist and how to obtain them
- Secret values in the runbook (`ops/`) always reference `__dev__/secrets/` rather than containing actual values

**Example reference in a runbook file (`ops/08-parameter-management/aws-ssm-setup.md`):**

```markdown
| Key | Description | Type | Value |
|---|---|---|---|
| CFG_STAGE | Deployment stage | String | dev |
| CFG_DB_HOST | MySQL writer endpoint | SecureString | [SECRET → __dev__/secrets/sandbox.md] |
| CFG_DB_PASS | MySQL password | SecureString | [SECRET → __dev__/secrets/sandbox.md] |
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

**Directory Names (vendor-agnostic):**

| Category | Directory Name | What It Covers |
|---|---|---|
| Domain registration | `domain` | Domain purchase, MX records |
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
| TLS/SSL | `ssl-certificates` | ACM, Let's Encrypt, Cloudflare |
| Content delivery | `cdn` | CloudFront, Cloudflare, Fastly |
| DNS management | `dns` | Route 53, Cloudflare DNS |
| Notifications | `messaging` | SES, SNS, SendGrid, Twilio |
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

> Reference: docs/ops/[category]/[vendor]-[service]-setup.md

## Prerequisites

- [List what must be completed before this step]

## Steps

### [Step Title]

* [Actionable step]
* [Actionable step]
* Config Value: [value or SECRET reference]

## Verification

- [How to verify this step was completed correctly]

## Notes

- [Any important observations or gotchas]
```

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
