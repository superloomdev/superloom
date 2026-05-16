# Superloom

> Build once. Deploy anywhere. Modular, opinionated, AI-native.

A modular framework for backend and frontend applications that run unchanged on **Docker (Express)** or **AWS Lambda (Serverless)**. One codebase, zero duplication. Currently implemented in JavaScript. Designed from the ground up for AI-assisted development.

## On This Page

- [Why Superloom](#why-superloom) - the problem and the shape of the solution
- [Philosophy](#philosophy) - the convictions that drive every design choice
- [Core Principles](#core-principles) - the five rules every module follows
- [Architecture at a Glance](#architecture-at-a-glance) - directory layout and request flow
- [Modules](#modules) - what ships in the box
- [Quick Start](#quick-start) - run the demo project locally
- [Testing](#testing) - the two-tier model (emulated and integration)
- [Where to Next](#where-to-next) - one link per reader profile

---

## Why Superloom

### The Problem

Most backend codebases degrade in the same predictable ways:

| Symptom | Consequence | Superloom Solution |
|---|---|---|
| **Platform lock-in** | Express code cannot run on AWS Lambda without a rewrite | Transport-agnostic controllers and services; only the interface adapter changes |
| **Duplicated logic** | Validation, DTOs, and error handling live in three places at once | One canonical builder per entity; validation co-located with domain rules |
| **Inconsistent helpers** | Every database wrapper, HTTP client, and cache layer has a different API shape | Every helper returns the same `{ success, data, error }` envelope |
| **Fat controllers** | Business logic tangles with request parsing - untestable without HTTP mocks | Service layer owns all business logic; controllers are thin, 10-30 lines |
| **Hostile to AI** | Without structure, AI assistants generate code that drifts from existing patterns | `AGENTS.md` + per-module `ROBOTS.md` give AI agents full context and rules |

### The Solution

Superloom separates **what your application does** from **how it is deployed**:

- **Shared across all deployment targets:** Models (validation, DTOs, errors) → Controllers (thin adapters) → Services (business logic)
- **Separate per deployment target:** only the transport adapters (Express routes vs AWS Lambda handlers)

Both adapters produce the **same standardized request object** and receive the **same standardized response**. The entire business layer is transport-agnostic.

---

## Philosophy

The framework rests on a single conviction: **the best way to maintain a large codebase (whether by humans or AI) is to make every piece small, self-contained, and predictable.**

### Modularity as a First Principle

Every module is independent. Every module has its own README, its own tests, its own CI/CD pipeline. An engineer or an AI assistant can work on one module without holding the context of the entire project. There is no shared mutable state. There are no implicit dependencies. Configuration is injected, never read from the environment directly.

### Decisions, Not Options

Superloom is opinionated. There is one way to structure a DTO. One way to inject dependencies. One way to separate layers. One testing strategy. One CI/CD pattern. This is deliberate: when every module follows the same rules, there is nothing to debate and nothing to misinterpret.

### Document the Why, Not Just the What

We document not just API references, but the reasoning behind every architectural decision. [Why the server uses MVC](philosophy/why-server-mvc). [Why one DTO shape](philosophy/dto-philosophy-js). Why factory pattern over singletons. Why explicit parameters over object passthrough. The architecture documents exist so that anyone, human or AI, can understand the intent, not just the code.

### AI-Native by Design

Every project built with Superloom ships with `AGENTS.md`, a complete AI configuration file containing coding standards, boundaries, and project context. Every module includes a `ROBOTS.md`, a compact machine-readable API reference listing every exported function, parameter, return type, and pattern. An AI pair programmer can onboard to a Superloom project in seconds, not hours.

---

## Core Principles

- **One data shape, one builder.** Each entity has one canonical data builder. No separate create/update/response shapes. Absent keys are simply not added.
- **Per-entity Lambda deployment.** Each entity owns its handler files and `serverless.yml`. Different endpoints can have different memory, timeout, and IAM settings.
- **Dependency injection always.** Modules receive dependencies through a central `Lib` container. Nothing reads environment variables directly.
- **Pure models.** Domain models are IO-free and safe to share between server and client. Validation lives next to domain rules.
- **Wrapped libraries.** Every external library is wrapped in a helper module. Swapping a library means changing one module, not the codebase.

---

## Architecture at a Glance

```
your-project/
  src/
    model/[entity]/                  # Domain models: validation, DTOs, errors (pure, IO-free)
    model-server/[entity]/           # Server-only model extensions
    server/
      common/                        # Bootstrap, config, loader, shared functions
      controller/[entity]/           # Thin adapters: validate, build DTO, delegate
      service/[entity]/              # Business logic and orchestration
      interfaces/api/
        express/                     # Express routes (Docker deployment)
        lambda-aws/[entity]/         # Per-entity AWS Lambda handlers (Serverless)
      _deploy/[entity]/              # Per-entity Serverless Framework configs
```

The request flow:

```
Interface (transport adapter)
  -> Controller (validate, build DTO, delegate)
    -> Service (business logic, uses helpers via Lib)
  <- response envelope { success, data | error }
```

- **Interfaces** handle protocol translation only — Express vs Lambda
- **Controllers** stay thin (10-30 lines per action)
- **Services** hold all business logic
- **Models** are shared between server and (future) client

---

## Modules

### Core (platform-agnostic)

| Module | Purpose |
|---|---|
| `@superloom/utils` | Type checks, validation, sanitization, data manipulation |
| `@superloom/debug` | Structured logging with levels (debug, info, warn, error) |
| `@superloom/time` | Date/time math, timezone handling, formatting |

### Server

> Currently implemented in JavaScript.

| Module | Purpose |
|---|---|
| `@superloom/instance` | Request lifecycle, cleanup, background tasks |
| `@superloom/crypto` | Hashing, encryption, UUID, random strings |
| `@superloom/http` | Outgoing HTTP client (native fetch wrapper) |
| `@superloom/postgres` | PostgreSQL with connection pooling |
| `@superloom/mysql` | MySQL with connection pooling |
| `@superloom/sqlite` | SQLite via built-in `node:sqlite` |
| `@superloom/dynamodb` | DynamoDB CRUD, batch, and query operations |
| `@superloom/mongodb` | MongoDB native driver wrapper |
| `@superloom/s3` | S3 file operations |
| `@superloom/s3-url-signer` | S3 presigned URL generation |
| `@superloom/sqs` | SQS message queue (send, receive, delete) |
| `@superloom/verify` | One-time verification codes with storage-agnostic adapter |
| `@superloom/logger` | Compliance-friendly action log with per-row retention |
| `@superloom/auth` | Session lifecycle and authentication with JWT + refresh-token rotation |

### Client (browser)

| Module | Purpose |
|---|---|
| `@superloom/client-crypto` | UUID, random strings, base64 (Web Crypto API) |

---

## Quick Start

```bash
git clone https://github.com/superloomdev/superloom.git
cd superloom
cp -r demo-project/ my-new-project/
cd my-new-project
npm install
npm start
```

For detailed setup and approach options, see [Getting Started](guide/getting-started).

---

## Testing

Every module includes tests. Service-dependent modules use Docker-based emulators for local testing.

| Tier | Purpose | CI/CD |
|---|---|---|
| **Emulated** | Tests against local Docker emulators (DynamoDB Local, ElasticMQ, MinIO, PostgreSQL, MySQL, MongoDB) | Automated on every push |
| **Integration** | Tests against real cloud services in a sandbox account | Developer-triggered |

---

## Where to Next

| If you want to... | Read |
|---|---|
| Set up a new project | [Getting Started](guide/getting-started) |
| Add your first domain entity | [Creating Entities](guide/creating-entities-js) |
| Configure your IDE | [IDE Setup](guide/ide-setup) |
| Understand the server architecture pattern | [Why the Server Uses MVC](philosophy/why-server-mvc) |
| Understand the one-shape rule | [DTO Philosophy](philosophy/dto-philosophy-js) |
| Read every technical rule | [Architectural Philosophy](architecture/architectural-philosophy) |
| Set up your dev machine | [Developer Setup](dev/README) |
| Provision infrastructure | [Operations](ops/README) |
