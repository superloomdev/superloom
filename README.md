<div align="center">
  <a href="https://superloom.dev">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/superloomdev/superloom/main/Superloom.png" height="80">
      <img alt="Superloom" src="https://raw.githubusercontent.com/superloomdev/superloom/main/Superloom.png" height="80">
    </picture>
  </a>
  <h1>Superloom</h1>
  <p>A modular application framework, designed for AI-assisted development.</p>

  [![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
  [![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-brightgreen.svg)](https://nodejs.org)
  [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/superloomdev/superloom/blob/main/CONTRIBUTING.md)

</div>

Superloom is an opinionated application framework designed for AI-assisted development. It ships with a complete set of rules, patterns, and documentation so that an AI coding assistant can understand the entire project structure from its first interaction.

- **AI-Native** - every project ships with `AGENTS.md` - a complete AI configuration file covering coding standards, module boundaries, parameter naming, directory layout, and architectural rules. Every module includes `ROBOTS.md` - a compact, machine-readable API reference. Open a Superloom project in any agentic IDE (Windsurf, Cursor, etc.) and the AI can generate code that matches existing patterns from its first interaction.
- **Modular** - 15 independent helper modules for databases, cloud services, crypto, time, and more. Each module has its own tests, docs, and CI pipeline. Use one module or use them all - they follow the same patterns.
- **Deploy Anywhere** - the same business logic runs on Docker (Express) and AWS Lambda (Serverless). Your domain layer has zero platform-specific code.

## Get Started

There are two ways to use Superloom:

### Start with the boilerplate

Download the starter project, open it in your AI-powered IDE, and start building. The AI reads the included `AGENTS.md` and follows the framework's patterns automatically.

```bash
git clone https://github.com/superloomdev/superloom.git
cd superloom

# Copy the starter project
cp -r demo-project/ my-project/
cd my-project

# Open in your IDE - the AI reads AGENTS.md and is ready to build
```

### Use modules directly

If you prefer manual control, install individual modules and wire them up yourself.

```bash
# Packages are on GitHub Packages - configure registry first:
# echo "@superloomdev:registry=https://npm.pkg.github.com" >> ~/.npmrc
# echo "//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN" >> ~/.npmrc
npm install @superloomdev/js-helper-utils @superloomdev/js-helper-debug @superloomdev/js-server-helper-instance @superloomdev/js-server-helper-nosql-aws-dynamodb
```

```javascript
const Lib = {};
Lib.Utils    = require('@superloomdev/js-helper-utils')(Lib, {});
Lib.Debug    = require('@superloomdev/js-helper-debug')(Lib, { LOG_LEVEL: 'info' });
Lib.Instance = require('@superloomdev/js-server-helper-instance')(Lib, {});
Lib.DynamoDB = require('@superloomdev/js-server-helper-nosql-aws-dynamodb')(Lib, {
  REGION: 'us-east-1',
  KEY: process.env.AWS_ACCESS_KEY_ID,
  SECRET: process.env.AWS_SECRET_ACCESS_KEY
});

const instance = Lib.Instance.initialize();
await Lib.DynamoDB.put(instance, 'users', { pk: 'user_001', name: 'Alice' });
const result = await Lib.DynamoDB.get(instance, 'users', { pk: 'user_001' });
// { success: true, data: { pk: 'user_001', name: 'Alice' }, error: null }
```

Every module uses the same pattern: factory loader, explicit config injection, and consistent `{ success, data, error }` return envelopes.

## Why Superloom

Large codebases degrade over time. Business logic leaks into route handlers. Validation gets duplicated. Helpers have inconsistent APIs. When AI assistants start contributing to an unstructured codebase, they make the problem worse - generating code that drifts from existing patterns because there are no patterns to follow.

Superloom solves this by making every decision upfront:

- **One shape per entity** - no separate create/update/response DTOs. One canonical data builder. Absent keys are simply not added.
- **Strict layer separation** - Model (validation, DTOs) → Controller (thin adapter) → Core (business logic) → Interface (Express or Lambda). Each layer has exactly one job.
- **Dependency injection everywhere** - all modules receive dependencies through a central `Lib` container. No module reads environment variables directly.
- **Pure models** - domain models are IO-free, safe to share between server and client.
- **Everything documented** - not just API references, but the reasoning behind every architectural decision across 21 architecture documents.

The framework does not just tell AI what code to write. It tells AI *how to think about the codebase* - what patterns to follow, what boundaries to respect, and what tradeoffs have already been made.

## Modules

### Core (platform-agnostic)

| Module | Package | Purpose |
|---|---|---|
| js-helper-utils | `@superloomdev/js-helper-utils` | Type checks, validation, sanitization, data manipulation |
| js-helper-debug | `@superloomdev/js-helper-debug` | Structured logging with levels (debug, info, warn, error) |
| js-helper-time | `@superloomdev/js-helper-time` | Date/time math, timezone handling, formatting |
| js-client-helper-crypto | `@superloomdev/js-client-helper-crypto` | UUID, random strings, base64 (browser-safe) |

### Server (Node.js)

| Module | Package | Purpose |
|---|---|---|
| js-server-helper-instance | `@superloomdev/js-server-helper-instance` | Request lifecycle, cleanup, background tasks |
| js-server-helper-crypto | `@superloomdev/js-server-helper-crypto` | Hashing, encryption, UUID, random strings |
| js-server-helper-http | `@superloomdev/js-server-helper-http` | Outgoing HTTP client (native fetch wrapper) |
| js-server-helper-sql-postgres | `@superloomdev/js-server-helper-sql-postgres` | PostgreSQL with connection pooling |
| js-server-helper-sql-mysql | `@superloomdev/js-server-helper-sql-mysql` | MySQL with connection pooling |
| js-server-helper-sql-sqlite | `@superloomdev/js-server-helper-sql-sqlite` | SQLite via built-in `node:sqlite` |
| js-server-helper-nosql-aws-dynamodb | `@superloomdev/js-server-helper-nosql-aws-dynamodb` | DynamoDB CRUD, batch, and query operations |
| js-server-helper-nosql-mongodb | `@superloomdev/js-server-helper-nosql-mongodb` | MongoDB native driver wrapper |
| js-server-helper-storage-aws-s3 | `@superloomdev/js-server-helper-storage-aws-s3` | S3 file operations |
| js-server-helper-storage-aws-s3-url-signer | `@superloomdev/js-server-helper-storage-aws-s3-url-signer` | S3 presigned URL generation |
| js-server-helper-queue-aws-sqs | `@superloomdev/js-server-helper-queue-aws-sqs` | SQS message queue (send, receive, delete) |
| js-server-helper-verify | `@superloomdev/js-server-helper-verify` | One-time verification codes (pin, code, token) with storage-agnostic adapter |

### Client (browser)

| Module | Package | Purpose |
|---|---|---|
| js-client-helper-crypto | `@superloomdev/js-client-helper-crypto` | UUID, random strings, base64 (Web Crypto API) |

## Architecture

```
your-project/
  AGENTS.md                       # AI configuration - coding standards, rules, context
  src/
    model/[entity]/               # Domain models - validation, DTOs, errors (pure, IO-free)
    model-server/[entity]/        # Server-only model extensions
    server/
      common/                     # Bootstrap, config, loader
      controller/[entity]/        # Thin adapters: validate + build DTO + delegate
      core/[entity]/              # Business logic and orchestration
      interfaces/api/
        express/                  # Express routes (Docker deployment)
        lambda-aws/[entity]/      # Lambda handlers (Serverless deployment)
    _deploy/[entity]/             # Per-entity Serverless Framework configs
```

**Request flow:** Interface (transport adapter) → Controller (validate, build DTO, delegate) → Core (business logic, uses helpers via `Lib`) → response.

Models are shared between server and client. Controllers are 10-30 lines. All business logic lives in Core.

## Documentation

Full documentation is available at [superloom.dev](https://superloom.dev).

| Section | Audience | Content |
|---|---|---|
| [Guides](docs/guide/) | Users | Getting started, creating entities |
| [Philosophy](docs/philosophy/) | Users | Why MVC, the one-shape DTO rule |
| [Architecture](docs/architecture/) | Contributors, AI | 21 documents: coding standards, module patterns, testing |
| [Developer Setup](docs/dev/) | New contributors | Environment, tokens, Docker, Git identity |
| [Operations](docs/ops/) | DevOps | Infrastructure reference guides |

Each module also has its own `README.md` (human docs) and `ROBOTS.md` (AI-readable function reference).

## Built by Engineers, Improved with AI

The architecture, module boundaries, coding standards, and testing strategies were designed by engineers with extensive experience shipping production software. Every module has been used in production systems. Every architectural decision has a documented reason.

Starting in 2025, AI coding assistants were used to systematically modernize the codebase - migrating legacy patterns to consistent factory modules, upgrading dependencies, standardizing error handling, and bringing comprehensive documentation and test coverage. Every AI-generated change was reviewed, tested, and validated against production behavior before merging.

## Contributing

Read the [Developer Setup Guide](docs/dev/README.md), then the [Unit Test Authoring Guide](docs/architecture/unit-test-authoring.md). Every change must include passing tests.

We use [Conventional Commits](https://conventionalcommits.org) and [Semantic Versioning](https://semver.org).

## License

[MIT](LICENSE) - free for commercial use.

---

<div align="center">
  <a href="https://superloom.dev">Website</a> · <a href="https://github.com/superloomdev/superloom">GitHub</a> · <a href="https://superloom.dev/docs">Documentation</a>
</div>