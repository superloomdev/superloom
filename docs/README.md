# Superloom Documentation

This directory is the canonical documentation set for Superloom. Every file is plain Markdown - readable on GitHub today, ready to render as a static site at [superloom.dev](https://superloom.dev) when published.

The landing page is [`intro.md`](intro.md). Start there.

## Who Should Read What

| Reader | Start with | Then read |
|---|---|---|
| **First-time visitor** | [`intro.md`](intro.md) | [`philosophy/why-mvc.md`](philosophy/why-mvc.md) |
| **New contributor** | [`guide/getting-started.md`](guide/getting-started.md) | [`dev/README.md`](dev/README.md) |
| **Adding a domain entity** | [`guide/creating-entities.md`](guide/creating-entities.md) | [`architecture/entity-creation-guide.md`](architecture/entity-creation-guide.md) |
| **Architect evaluating the framework** | [`philosophy/`](philosophy/) | [`architecture/architectural-philosophy.md`](architecture/architectural-philosophy.md) |
| **AI agent (Cascade, Cursor, Copilot)** | [`../AGENTS.md`](../AGENTS.md) | Module-level `ROBOTS.md` files |
| **DevOps / infrastructure** | [`ops/README.md`](ops/README.md) | [`architecture/operations-documentation.md`](architecture/operations-documentation.md) |
| **CI/CD or publishing** | [`dev/cicd-publishing.md`](dev/cicd-publishing.md) | [`architecture/module-publishing.md`](architecture/module-publishing.md) |

## Section Map

| Section | Purpose | Audience |
|---|---|---|
| [`intro.md`](intro.md) | Landing page - what Superloom is and why it exists | Everyone |
| [`philosophy/`](philosophy/) | Design philosophy and the convictions behind the rules | Framework users |
| [`guide/`](guide/) | Step-by-step task guides (getting started, entities, IDE) | Framework users |
| [`architecture/`](architecture/) | Technical standards - the rules the codebase actually follows | Contributors, AI agents |
| [`dev/`](dev/) | Developer machine setup (Git, npm, Docker, environment files) | New developers |
| [`ops/`](ops/) | Generic, vendor-agnostic infrastructure setup guides | DevOps, infrastructure |

## Directory Tree

```
docs/
  intro.md                            # Landing page
  README.md                           # This file - the index

  philosophy/                         # Why we do things the way we do
    why-mvc.md                        # Why MVC, plus the Service layer adaptation
    dto-philosophy.md                 # The one-shape rule for data transfer objects

  guide/                              # Task-driven walkthroughs
    getting-started.md                # Run the demo project locally
    creating-entities.md              # Add a new domain entity
    ide-setup.md                      # Recommended IDE configuration

  architecture/                       # Technical standards (~22 documents)
    architectural-philosophy.md       #   High-level rules and directory layout
    code-formatting-js.md             #   JavaScript coding standards
    error-handling.md                 #   Throw vs return, three error categories
    validation-approach.md            #   Hand-written, co-located validation
    module-structure.md               #   How helper modules are built
    module-testing.md                 #   Testing tiers and emulator setup
    module-publishing.md              #   CI/CD publishing pipeline
    peer-dependencies.md              #   Self-contained foundation + peer deps
    entity-creation-guide.md          #   Full entity creation walkthrough
    model-modules.md                  #   Base, server, and client model layers
    server-loader.md                  #   Dependency injection and the Lib container
    server-interfaces.md              #   Express and Lambda adapters
    server-controller-modules.md      #   Thin adapters between interfaces and services
    server-service-modules.md         #   Business logic and orchestration
    server-helper-modules.md          #   Server-only helper modules
    server-common.md                  #   Bootstrap, config, runtime helpers
    core-helper-modules.md            #   Platform-agnostic helper modules
    operations-documentation.md       #   Three-layer ops documentation strategy
    testing-strategy.md               #   Test layout and runner conventions
    unit-test-authoring.md            #   How to write unit tests
    integration-testing.md            #   Real cloud testing in a sandbox account
    migration-pitfalls.md             #   Common issues during module migrations

  dev/                                # Developer setup
    README.md                         #   Onboarding quick start
    docker-compose.yml                #   Local services (databases, S3, queue)
    .env.dev.example                  #   Dev environment template
    .env.integration.example          #   Integration environment template
    onboarding-git-account.md         #   Git identity for multiple GitHub accounts
    onboarding-github-packages.md     #   GitHub token + npm registry setup
    npmrc-setup.md                    #   Global npmrc configuration guide
    cicd-publishing.md                #   How CI/CD tests and publishes modules
    mcp-github-setup.md               #   AI assistant GitHub MCP configuration
    repo-setup.md                     #   One-time repository creation (founder only)

  ops/                                # Infrastructure reference (17 categories)
    README.md                         #   Overview and how to consume these guides
    domain/                           #   Domain registration
    cloud-provider/                   #   AWS, GCP, Azure account setup
    billing/                          #   Cost management and budget alerts
    development-environment/          #   Cloud-hosted developer workspaces
    source-control/                   #   GitHub org, tokens, Actions
    identity-access/                  #   IAM policies, roles, users
    networking/                       #   VPC, security groups, firewalls
    object-storage/                   #   S3, GCS, MinIO
    parameter-management/             #   Secrets and config (SSM, Vault)
    relational-database/              #   RDS, Aurora, Cloud SQL
    nosql-database/                   #   DynamoDB, MongoDB Atlas
    ssl-certificates/                 #   ACM, Let's Encrypt
    cdn/                              #   CloudFront, Cloudflare
    dns/                              #   Route 53, Cloudflare DNS
    messaging/                        #   SES, SNS, SendGrid, Twilio
    deployment/                       #   Serverless Framework, Docker
    scheduled-tasks/                  #   EventBridge, Cloud Scheduler
```

## Documentation Principles

Every file in this directory follows the rules in [`.windsurf/GOD.md`](../.windsurf/GOD.md) Directive 12:

- **Prescriptive over prohibitive** - state what to do, not what to avoid
- **Generic over specific** - use placeholders (`[module]`, `[entity]`) in framework rules
- **DRY** - each rule lives in exactly one canonical file; others cross-reference
- **Compact** - tables and bullets, never prose paragraphs for rules
- **No preamble** - skip "This section explains..." and similar throat-clearing

The compressed, AI-facing mirror of these documents lives in [`AGENTS.md`](../AGENTS.md). When a file in `docs/` changes, run the `/propagate-changes` workflow to keep the mirror in sync.

## Local Preview (Future)

When the Docusaurus site is set up at `superloom.dev`, the local preview will be:

```bash
cd docs
npm install
npm start          # Local dev server at http://localhost:3000
npm run build      # Build the static site for production
```

Until then, every file is fully readable directly on GitHub.

## Why Markdown

- Every file is readable on GitHub without any tooling
- Plays well with Docusaurus, Hugo, MkDocs, or any static site generator
- Plays well with `git diff`, code review, and AI agents
- No proprietary formats, no vendor lock-in
- MIT licensed - free for commercial use
