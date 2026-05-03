# Superloom

> Build once. Deploy anywhere. Modular, opinionated, AI-native.

A modular Node.js framework for backend applications that run unchanged on **Docker (Express)** or **AWS Lambda (Serverless)** - one codebase, zero duplication. Designed from the ground up for AI-assisted development.

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

| Symptom | Consequence |
|---|---|
| **Platform lock-in** | Express code cannot run on AWS Lambda without a rewrite |
| **Duplicated logic** | Validation, DTOs, and error handling live in three places at once |
| **Inconsistent helpers** | Every database wrapper, HTTP client, and cache layer has a different API shape |
| **Fat controllers** | Business logic tangles with request parsing - untestable without HTTP mocks |
| **Hostile to AI** | Without structure, AI assistants generate code that drifts from existing patterns |

### The Solution

Superloom separates **what your application does** from **how it is deployed**:

- **Shared across all deployment targets:** Models (validation, DTOs, errors) → Controllers (thin adapters) → Services (business logic)
- **Separate per deployment target:** only the transport adapters (Express routes vs AWS Lambda handlers)

Both adapters produce the **same standardized request object** and receive the **same standardized response**. The entire business layer is transport-agnostic.

---

## Philosophy

The framework rests on a single conviction: **the best way to maintain a large codebase - whether by humans or AI - is to make every piece small, self-contained, and predictable.**

### Modularity as a First Principle

Every module is independent. Every module has its own README, its own tests, its own CI/CD pipeline. An engineer - or an AI assistant - can work on one module without holding the context of the entire project. There is no shared mutable state. There are no implicit dependencies. Configuration is injected, never read from the environment directly.

This means a large project can be maintained by a team of people working on small pieces - or by an AI system that operates on one module at a time with full understanding of that module's contract.

### Decisions, Not Options

Superloom is opinionated. There is one way to structure a DTO. One way to inject dependencies. One way to separate layers. One testing strategy. One CI/CD pattern. This is deliberate - when every module follows the same rules, there is nothing to debate and nothing to misinterpret.

### Document the Why, Not Just the What

We document not just API references, but the reasoning behind every architectural decision. [Why MVC](philosophy/why-mvc.md). [Why one DTO shape](philosophy/dto-philosophy.md). Why factory pattern over singletons. Why explicit parameters over object passthrough. The architecture documents exist so that anyone - human or AI - can understand the intent, not just the code.

### AI-Native by Design

Every project built with Superloom ships with `AGENTS.md` - a complete AI configuration file containing coding standards, boundaries, and project context. Every module includes a `ROBOTS.md` - a compact, machine-readable API reference listing every exported function, parameter, return type, and pattern. An AI pair programmer can onboard to a Superloom project in seconds, not hours. Open it in any agentic IDE - Windsurf, Cursor, or anything that reads `AGENTS.md` - and the AI understands the entire codebase from its first interaction.

---

## Core Principles

- **One data shape, one builder** - each entity has ONE canonical data builder. No separate create/update/response shapes. Absent keys are simply not added.
- **Per-entity Lambda deployment** - each entity owns its own handler files and `serverless.yml`. Different endpoints can have different memory, timeout, and IAM settings.
- **Dependency injection always** - modules receive dependencies through a central `Lib` container. No module reads environment variables directly.
- **Pure models** - domain models are IO-free and safe to share between server and client. Validation lives next to domain rules.
- **Wrapped libraries** - every external library is wrapped in a helper module. Swapping a library means changing one module, not the codebase.

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

- **Interfaces** handle protocol translation only - Express vs Lambda
- **Controllers** stay thin (10-30 lines per action)
- **Services** hold all business logic
- **Models** are shared between server and (future) client

---

## Modules

### Core (platform-agnostic)

| Module | Purpose |
|---|---|
| `@your-org/js-helper-utils` | Type checks, validation, sanitization, data manipulation |
| `@your-org/js-helper-debug` | Structured logging with levels (debug, info, warn, error) |
| `@your-org/js-helper-time` | Date/time math, timezone handling, formatting |

### Server (Node.js)

| Module | Purpose |
|---|---|
| `@your-org/js-server-helper-instance` | Request lifecycle, cleanup, background tasks |
| `@your-org/js-server-helper-crypto` | Hashing, encryption, UUID, random strings |
| `@your-org/js-server-helper-http` | Outgoing HTTP client (native fetch wrapper) |
| `@your-org/js-server-helper-sql-postgres` | PostgreSQL with connection pooling |
| `@your-org/js-server-helper-sql-mysql` | MySQL with connection pooling |
| `@your-org/js-server-helper-sql-sqlite` | SQLite via built-in `node:sqlite` |
| `@your-org/js-server-helper-nosql-aws-dynamodb` | DynamoDB CRUD, batch, and query operations |
| `@your-org/js-server-helper-nosql-mongodb` | MongoDB native driver wrapper |
| `@your-org/js-server-helper-storage-aws-s3` | S3 file operations |
| `@your-org/js-server-helper-storage-aws-s3-url-signer` | S3 presigned URL generation |
| `@your-org/js-server-helper-queue-aws-sqs` | SQS message queue (send, receive, delete) |
| `@your-org/js-server-helper-verify` | One-time verification codes (pin, code, token) with storage-agnostic adapter |
| `@your-org/js-server-helper-logger` | Compliance-friendly action log: per-row retention (persistent or TTL) + optional IP encryption, multi-backend |
| `@your-org/js-server-helper-auth` | Session lifecycle and authentication: create, verify, list, remove. Multi-instance per actor_type, JWT mode with refresh-token rotation |

### Client (browser)

| Module | Purpose |
|---|---|
| `@your-org/js-client-helper-crypto` | UUID, random strings, base64 (Web Crypto API) |

Every module follows the same pattern: factory loader, explicit config injection, lazy-loaded dependencies, consistent `{ success, data, error }` return envelopes. See any module's `ROBOTS.md` for the full AI-readable API reference.

---

## Quick Start

Choose your implementation approach:

**For detailed approach comparison and setup instructions, see [`getting-started.md`](guide/getting-started.md#step-1---choose-your-implementation-approach).**

### Quick Commands

**Approach 1: Fork and Publish**
```bash
git clone https://github.com/YOUR-USERNAME/superloom.git
cd superloom
cp -r demo-project/ my-new-project/
```

**Approach 2: Local Copy**
```bash
git clone https://github.com/superloomdev/superloom.git
cd superloom
cp -r src/helper-modules-* ../my-new-project/src/
cp -r demo-project/ ../my-new-project/
cd ../my-new-project
```

**Approach 3: Direct Usage**
```bash
git clone https://github.com/superloomdev/superloom.git
cd superloom
cp -r demo-project/ ../my-new-project/
cd ../my-new-project
```

Then continue with dependency installation:
cd src/model && npm install
cd ../model-server && npm install
cd ../server && npm install

# Start the Express server
cd src/server && npm start

# Run tests
cd src/model && npm test
```

## Testing

Every module includes tests. Service-dependent modules (databases, S3, SQS) use Docker-based emulators for local testing and support real cloud integration testing with the same test code - only the environment variables change.

| Tier | Purpose | CI/CD |
|---|---|---|
| **Emulated** | Tests against local Docker emulators (DynamoDB Local, ElasticMQ, MinIO, PostgreSQL, MySQL, MongoDB) | Automated on every push |
| **Integration** | Tests against real cloud services in a sandbox account | Developer-triggered |

```bash
# Example: run any service-dependent module's tests
cd src/helper-modules-server/js-server-helper-sql-postgres/_test
docker compose up -d && npm install && npm test
```

---

## Where to Next

| If you want to... | Read |
|---|---|
| Set up a new project from the demo | [Getting Started](guide/getting-started.md) |
| Add your first domain entity | [Creating Entities](guide/creating-entities.md) |
| Configure your IDE | [IDE Setup](guide/ide-setup.md) |
| Understand why MVC | [Why MVC](philosophy/why-mvc.md) |
| Understand the one-shape rule | [DTO Philosophy](philosophy/dto-philosophy.md) |
| Read every technical rule | [Architectural Philosophy](architecture/architectural-philosophy.md) and the rest of `architecture/` |
| Set up your dev machine | [Developer Setup](dev/README.md) |
| Provision infrastructure | [Infrastructure Guides](ops/README.md) |

Full section index lives in [`docs/README.md`](README.md).

---

## Built by Engineers, Improved with AI

This framework was designed and built by hand over several years by engineers with more than two decades of experience shipping production software. Every module has been used in production. Every architectural decision has a reason behind it.

**What is human:** the architecture, module boundaries, design decisions, philosophy, and testing strategy. None of this was generated.

**Where AI helped:** starting in 2025, AI assistants modernized the codebase - migrating legacy patterns to factory modules, upgrading dependencies, adding structured performance tracking, standardizing error handling, and broadening documentation and test coverage. Every AI-generated change was reviewed, tested, and validated against production behavior before merging.

The AI accelerated consistency. The humans ensured correctness.

---

## Contributing

Read the [Developer Setup Guide](dev/README.md), then the [Unit Test Authoring Guide](architecture/unit-test-authoring.md). Every change must include passing tests. We use [Conventional Commits](https://conventionalcommits.org) and [Semantic Versioning](https://semver.org).

## License

[MIT](https://opensource.org/licenses/MIT) - free for commercial use.

**Repository:** [github.com/superloomdev/superloom](https://github.com/superloomdev/superloom)
