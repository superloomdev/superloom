# Superloom Documentation

> **The published documentation lives at [superloom.dev/docs](https://superloom.dev/docs).**

This directory is the canonical source for all Superloom technical documentation. Files here are the single source of truth — the website at `superloom.dev` renders from this content.

The introductory overview and landing page content lives in the [website repository](https://github.com/superloomdev/superloom.dev). Start at [superloom.dev](https://superloom.dev) for the full experience.

For contributors: edit files in this directory directly. Changes are picked up by the website on the next build.

## Who Should Read What

| Reader | Start with | Then read |
|---|---|---|
| **First-time visitor** | [superloom.dev/docs/intro](https://superloom.dev/docs/intro) | [`philosophy/why-mvc.md`](philosophy/why-mvc.md) |
| **New contributor** | [`guide/getting-started.md`](guide/getting-started.md) | [`dev/README.md`](dev/README.md) |
| **Adding a domain entity** | [`guide/creating-entities-js.md`](guide/creating-entities-js.md) | [`architecture/entity-creation-guide-js.mdx`](architecture/entity-creation-guide-js.mdx) |
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
    dto-philosophy-js.md                 # The one-shape rule for data transfer objects

  guide/                              # Task-driven walkthroughs
    getting-started.md                # Run the demo project locally
    creating-entities-js.md              # Add a new domain entity
    ide-setup.md                      # Recommended IDE configuration

  architecture/                       # Technical standards (~22 documents)
    architectural-philosophy.md       #   High-level rules and directory layout
    code-formatting-js.md             #   JavaScript coding standards
    error-handling.mdx                 #   Throw vs return, three error categories
    validation-approach.md            #   Hand-written, co-located validation
    module-structure-js.mdx               #   How helper modules are built
    module-testing.md                 #   Testing tiers and emulator setup
    module-publishing.md              #   CI/CD publishing pipeline
    peer-dependencies.md              #   Self-contained foundation + peer deps
    entity-creation-guide-js.mdx          #   Full entity creation walkthrough
    model-modules.md                  #   Base, server, and client model layers
    server-loader.md                  #   Dependency injection and the Lib container
    server-interfaces.mdx              #   Express and Lambda adapters
    server-controller-modules.md      #   Thin adapters between interfaces and services
    server-service-modules.md         #   Business logic and orchestration
    server-helper-modules.md          #   Server-only helper modules
    server-common.md                  #   Bootstrap, config, runtime helpers
    core-helper-modules.md            #   Platform-agnostic helper modules
    operations-documentation.md       #   Three-layer ops documentation strategy
    testing-strategy.md               #   Test layout and runner conventions
    unit-test-authoring-js.md            #   How to write unit tests
    integration-testing.md            #   Real cloud testing in a sandbox account
    migration-pitfalls.md             #   Common issues during module migrations
    module-categorization.md          #   Which template to use for each module
    complex-module-docs-guide.md      #   docs/ folder structure for feature modules
    templates/                        #   README templates for each module category

  dev/                                # Developer setup
    README.md                         #   Onboarding quick start
    documentation-standards.md        #   Writing standards, American English, formatting rules
    .env.dev.example                  #   Dev environment template
    .env.integration.example          #   Integration environment template
    onboarding-git-account.md         #   Git identity for multiple GitHub accounts
    onboarding-github-packages.md     #   GitHub token + npm registry setup
    npmrc-setup.md                    #   Global npmrc configuration guide
    cicd-publishing.md                #   CI/CD philosophy and workflow design
    testing-local-modules.md          #   Healthcheck philosophy, test concurrency
    mcp-github-setup.md               #   AI assistant GitHub MCP configuration
    pitfalls.md                       #   AI journal: every dev-environment failure ever fixed
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

### Pitfall Journals (AI-Oriented)

Every `docs/<section>/` folder that accumulates enough "real failures we fixed" gets a single `pitfalls.md` file alongside the philosophy docs:

- [`dev/pitfalls.md`](dev/pitfalls.md) — AI terminal, CI/CD publishing, local module testing.
- [`architecture/migration-pitfalls.md`](architecture/migration-pitfalls.md) — module-migration failures (kept under its current filename).

Rules:

- One pitfall file per folder. No nested `pitfalls/` directories. No root-level pitfall file.
- Every entry is **Symptom → Cause → Lesson/Fix**.
- Philosophy docs keep only the *positive* rules. Symptoms and root causes always live in the pitfall file.
- Pitfall files are **AI-oriented**, not first-read material. Humans jump to them only when a specific failure needs a confirmed fix.
- Anchors in pitfall files are stable — `AGENTS.md` and other cross-references rely on them. Never rename an H2 or H3 after it is published.

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
