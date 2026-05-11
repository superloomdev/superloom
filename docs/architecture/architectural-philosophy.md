# Architectural Philosophy

The high-level rules that shape every project. This document explains the ideas behind the directory layout, the conventions that hold the codebase together, and the contract between framework code and application code. Specific patterns and templates live in the other `architecture/` documents - see [Further Reading](#further-reading).

## On This Page

- [Top-Level Goals](#top-level-goals)
- [Coding Practices](#coding-practices)
- [Platform Identifiers](#platform-identifiers)
- [Directory Layout](#directory-layout)
  - [Helper Modules (Framework Level)](#helper-modules-framework-level)
  - [Server Application](#server-application)
  - [Client Application](#client-application)
- [Repository Conventions](#repository-conventions)
  - [Personal Workspace (`__dev__/`)](#personal-workspace-dev)
  - [Developer Documentation (`docs/dev/`)](#developer-documentation-docsdev)
  - [Environment Strategy](#environment-strategy)
  - [Git Identity](#git-identity)
- [Further Reading](#further-reading)

---

## Top-Level Goals

The architecture serves four non-negotiable goals. Every other rule in `architecture/` exists to support one of these:

| Goal | Implication |
|---|---|
| **Feature-independent architecture** | Adding or removing a feature touches a known set of files in a known order. No special cases |
| **Self-hostable on Docker AND Serverless** | The same business code runs unchanged behind Express (Docker) or AWS Lambda (Serverless). Only the transport adapter differs |
| **JSON as the universal transport** | All internal and external data shapes are JSON. No proprietary serialization formats |

### Supported Deployment Targets

| Mode | Stack |
|---|---|
| **Docker (self-hosted)** | Single container with the full Express server |
| **AWS Lambda (Serverless)** | Per-entity Lambda functions behind API Gateway, with DynamoDB / Aurora / S3 |
| **Future** | The transport-agnostic architecture is designed so that adding a new target (e.g., Cloud Run, Azure Functions) requires only a new interface adapter |

---

## Coding Practices

Four rules govern every line of code in the project. Full detail in [`code-formatting-js.md`](code-formatting-js.md).

| Rule | Summary |
|---|---|
| **Strict modular separation** | Every module has one responsibility. No "utility kitchen sinks" (modules that collect unrelated utility functions) |
| **All external libraries wrapped** | Third-party packages are imported only by helper modules; business code uses the wrapper |
| **Identical coding standards across modules** | Same loader pattern, same vertical spacing rule, same JSDoc style, same error envelope |
| **DRY helper functions** | Before writing inline utility functions, check all helper modules (`Lib.Utils`, `Lib.Debug`, `Lib.Time`, etc.). If it exists, use it. Application code focuses on integrations, business logic, and domain logic - utility functions belong in separate, reusable modules |

The vertical spacing rule (3 lines between sections, 2 between functions, 1 between logical blocks within a function, etc.) is enforced in [`code-formatting-js.md`](code-formatting-js.md) - these examples illustrate the pattern, but the complete rules are in the formatting guide. This makes module files visually scannable at any size.

---

## Platform Identifiers

Concise platform tags appear in folder names, package names, and configuration files. They identify the **execution environment**, never business logic.

| Key | Platform | Description |
|---|---|---|
| `and` | Android (Native) | Native Android applications using Android SDK (Kotlin / Java) |
| `ios` | iOS (Native) | Native iOS applications using Apple SDKs (Swift / Objective-C) |
| `rn` | React Native | Cross-platform mobile apps built with React Native |
| `rw` | React Web | Web apps built with React (SPA / CSR) |
| `web` | Web (Framework-Independent) | Framework-agnostic web (HTML, CSS, JS, static, or backend-rendered) |

**Rules:**

- All keys are lowercase, 2-3 characters
- Keys are an **orthogonal dimension** to domain or business concerns - never mix them
- Used consistently across folders, package names, build targets, deploy configs, and documentation

---

## Directory Layout

The repository is structured by **responsibility and execution context**, with strict separation between utilities, server code, and client code.

### Helper Modules (Framework Level)

Helper modules provide reusable utilities and can be integrated into your project in three different ways. For detailed implementation approaches, pros/cons, and setup instructions, see [`module-structure-js.mdx`](module-structure-js.mdx#implementation-approaches) and [`getting-started.md`](../guide/getting-started.md#step-1---choose-your-implementation-approach).

#### Framework Structure (Reference)

**In this framework repository:**
- Helper modules live at the **repository root** and are published under `@superloomdev/*`
- They are framework-level, not project-specific

| Path | Purpose |
|---|---|
| `src/helper-modules-core/[js\|py]-helper-[name]/` | Platform-agnostic, server-safe helpers (validation, time math, structured logging) |
| `src/helper-modules-server/[js\|py]-server-helper-[name]/` | Server-only helpers (DB drivers, cloud SDKs, filesystem) |
| `src/helper-modules-client/[js]-[platform]-helper-[name]/` | Platform-specific client helpers (browser, React Native, mobile) |

**In Your Project:**
- **Approach 1**: Same structure as framework, publish as `@your-org/*`
- **Approach 2**: Copy to `your-project/src/helper-modules-*/` or `your-project/helpers/`
- **Approach 3**: No local helper modules - use external packages

**Naming convention:**

- Core: `[js|py]-helper-[name]` (no platform prefix)
- Server: `[js|py]-server-helper-[name]`
- Client: `[js|py]-[platform]-helper-[name]` where `[platform]` is one of the [platform keys](#platform-identifiers)

Module file structure and the configuration patterns for each helper type live in [`module-structure-js.mdx`](module-structure-js.mdx).

### Server Application

Project code lives inside a project directory (e.g., `demo-project/`). The server side is split into seven directories under `src/server/`, plus the model layers under `src/`.

| Path | AKA | Purpose |
|---|---|---|
| `src/model/[entity]/` | `base-model` | Shared domain model: data shapes, validations, DTOs, errors. Pure, IO-free |
| `src/model-server/[entity]/` | `server-model` | Server-only model extensions (audit fields, internal flags) |
| `src/model-client/[entity]/` | `client-model` | Client-only model extensions (cache metadata, sync status) |
| `src/server/common/` | `server-common` | Bootstrap, config, loader, shared infrastructure |
| `src/server/controller/` | `server-controller` | Thin adapters: validate, build DTO, delegate |
| `src/server/service/` | `server-service` | Business logic and orchestration |
| `src/server/interfaces/api/` | `server-api` | Public API entry points (Express + Lambda) |
| `src/server/interfaces/hook/` | `server-hook` | Third-party webhook entry points |
| `src/server/interfaces/job/` | `server-job` | Cron / background worker entry points |
| `src/server/_deploy/` | `deploy` | Deployment configs (Dockerfile, per-entity `serverless.yml`) |

**Layer dependencies (top to bottom only):**

```
Server Interfaces (API / Hook / Job)
  v
Server Controller
  v
Base Model + Server Model + Server Service
  v
Server Helper Modules + Core Helper Modules
  v
External libraries (always wrapped)
```

A controller never reaches into another entity's service. A model never imports anything from `server/`. The dependency arrows always flow downward.

### Client Application

Client applications live under `src/client/[platform]/`, organized by [platform identifier](#platform-identifiers). Each platform directory contains its own application structure and dependencies. Client model extensions live separately under `src/model-client/`.

```
src/client/
  web/                # Framework-independent web (HTML/CSS/JS)
  rw/                 # React Web (SPA)
  rn/                 # React Native
  ios/                # Native iOS (Swift)
  and/                # Native Android (Kotlin/Java)
```

The client side is largely a future expansion. The framework's foundations (helper modules, model layer, transport-agnostic controllers) are already in place to support it.

---

## Repository Conventions

### Personal Workspace (`__dev__/`)

Every contributor has a personal workspace folder at the repository root called `__dev__/`. It is gitignored - **never committed**.

| File | Purpose |
|---|---|
| `me.md` | Your GitHub username, SSH key name, local aliases, machine-specific notes |
| `.env.dev` | Dev environment values (copied from [`docs/dev/.env.dev.example`](../dev/.env.dev.example)) |
| `.env.integration` | Integration environment values (copied from [`docs/dev/.env.integration.example`](../dev/.env.integration.example)) |
| `progress.md` | Current work, pending tasks, session notes |
| `context.md` | Developer-specific AI context - your patterns, preferences, working notes |
| `migration-changelog.md` | Personal log of module migrations (see [`migration-pitfalls.md`](migration-pitfalls.md)) |
| `secrets/` | Real credentials, API keys, sandbox passwords (never copied anywhere committed) |

The `__dev__/` convention guarantees that no developer's personal configuration or credentials ever accidentally reach the repository, while still giving each contributor a well-defined place to keep local context organized.

### Developer Documentation (`docs/dev/`)

All documentation a developer needs to set up and work on the project lives in [`docs/dev/`](../dev/). This is committed and shared with all contributors. It covers Git account setup, GitHub Packages tokens, npm registry configuration, local Docker services, and environment variable templates.

The developer documentation is part of the repository knowledge base - written for humans **and** AI agents. Keep it current as the project evolves.

### Environment Strategy

Modules in this framework support two environments:

| Environment | Purpose | Configuration source |
|---|---|---|
| **dev** | Local machine, Docker emulators (databases, S3-compatible store, message queue) defined in [`docs/dev/docker-compose.yml`](../dev/docker-compose.yml) | `__dev__/.env.dev`, loaded via `source init-env.sh` |
| **integration** (sandbox) | Real cloud services with isolated test data. Mirrors the production configuration | Cloud provider's parameter store (e.g., AWS SSM); credentials in `__dev__/secrets/` |

Production testing is the responsibility of the **application project** consuming these modules, not the modules themselves.

### Git Identity

The project is hosted under a GitHub organization. Contributors use their personal GitHub account (which must be a member of the org). Each contributor configures their own machine so commits to this repository use the correct GitHub identity. The step-by-step guide is in [`docs/dev/onboarding-git-account.md`](../dev/onboarding-git-account.md).

The repository remote always uses the canonical `github.com` URL. Developers with multiple GitHub accounts optionally override the remote URL locally using an SSH alias - this override is never committed.

---

## Further Reading

| Topic | Document |
|---|---|
| **Coding standards** (formatting, naming, JSDoc) | [`code-formatting-js.md`](code-formatting-js.md) |
| **Module structure** (loader pattern, factory pattern) | [`module-structure-js.mdx`](module-structure-js.mdx) |
| **Model layer** (base, server, client) | [`model-modules.md`](model-modules.md) |
| **Server layers** (controller, service, common, interfaces) | [`server-controller-modules.md`](server-controller-modules.md), [`server-service-modules.md`](server-service-modules.md), [`server-common.md`](server-common.md), [`server-interfaces.mdx`](server-interfaces.mdx) |
| **Helper modules** (core and server) | [`core-helper-modules.md`](core-helper-modules.md), [`server-helper-modules.md`](server-helper-modules.md) |
| **Validation, errors, testing** | [`validation-approach.md`](validation-approach.md), [`error-handling.mdx`](error-handling.mdx), [`testing-strategy.md`](testing-strategy.md) |
| **Operations and deployment** | [`operations-documentation.md`](operations-documentation.md), [`module-publishing.md`](module-publishing.md) |
