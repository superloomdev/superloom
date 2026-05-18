# Superloom

> A modular Node.js framework for backend applications. Consistent. Modular. Ready for AI-assisted development.

Modern backends face a familiar pressure: AI agents can now generate code faster than humans can review it. Without structure, the result is architectural drift. Every new feature adds a slightly different way of doing the same thing.

Superloom is an opinionated frame for backend applications: one way to structure data, one way to inject dependencies, one way to handle errors, and a catalog of pre-tested helper modules so the same plumbing never gets rewritten twice. The same business logic runs unchanged on **Docker (Express)** and **AWS Lambda**; only the transport adapter at the edge changes. Currently implemented in JavaScript.

---

## Why Superloom

- **Build once. Reuse on every new project.** Every module ships pre-tested with a stable contract, so the next codebase (and the AI agent helping build it) relies on the wrapper instead of re-discovering the plumbing each time.

- **Designed for human review of AI output.** Section banners, short functions, scoped comments, and a single response envelope let a reviewer read any module top-to-bottom and spot what an AI got wrong, without getting lost in dense logic.

- **Opinionated enough that AI can't drift.** One loader shape, one validation contract, one error envelope. Every contributor stays on the same rails, human or AI, so a six-month-old codebase still looks like a six-day-old one.

- **Real modules, not an abstraction layer.** Each helper wraps one production library (Postgres, S3, MongoDB, …) so when an upstream driver changes, only the wrapper updates. Your application code stays exactly as it is.

---

## Anatomy of a Superloom Module File

Every Superloom helper module follows the same internal shape. A developer who has read one file can navigate any file. Three details, all visible in the wild in [`postgres.js`](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-sql-postgres/postgres.js):

### Section banners as scroll-stop checkpoints

Every major section of a module file is wrapped in a START/END banner like this:

```javascript
/////////////////////////// Module-Loader START ////////////////////////////////

const loader = function (shared_libs, config) {
  Lib = shared_libs;
  CONFIG = config;
};

//////////////////////////// Module-Loader END /////////////////////////////////
```

A reviewer uses these as anchor points. *"I've read the loader, now onto the public functions."* Sections are large and few (loader, exports, public functions, private functions), so a file never has more than four or five banners. The shape is identical across every module, so navigating a new module costs you zero learning.

### JSDoc on every public function

Every exported function carries a JSDoc block that names its parameters and return shape:

```javascript
/********************************************************************
Run a query and return the first row, or null if there are no results.

@param {Object} instance - Request instance
@param {String} sql - SQL with ?/?? placeholders
@param {Array} [params] - Placeholder values

@return {Promise<Object>} - { success, row, error }
*********************************************************************/
getRow: async function (instance, sql, params) {

  const result = await _Postgres.query(instance, sql, params);

  if (!result.success) {
    return {
      success: false,
      row: null,
      error: result.error
    };
  }

  return {
    success: true,
    row: result.rows[0] || null,
    error: null
  };

},
```

A reviewer can answer *"what does this function expect, and what does it give back?"* without reading the body. The return shape uses the same response envelope (`success` + named data field + `error`) as every other public function in every other helper module.

### The 3/2/1 vertical-spacing rule

Module files use a strict vertical-spacing hierarchy so a reviewer can tell from line spacing alone whether they are moving between sections, functions, or logical blocks:

| Spacing | Where it appears |
|---|---|
| **3 blank lines** | Between major module sections |
| **2 blank lines** | Between function definitions |
| **1 blank line** | Inside functions, between logical blocks; after `if`/`else`, after `return` |

Look back at the two code blocks above; the spacing is not accidental. It is a structural reading aid.

The full rules (naming, comments, banner widths, section header hierarchy) live in [Code Formatting](foundations/code-formatting-js).

### AI configuration sits next to the code

Every Superloom project ships with an `AGENTS.md` at the repo root and every module ships with a `ROBOTS.md` alongside its source. They are compact, machine-readable rule files an AI agent reads first, so when you ask an AI assistant to add a new entity or change a helper, it starts with the rules, not a guess.

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

- **Interfaces** - protocol translation only (Express vs Lambda)
- **Controllers** - stay thin (10–30 lines per action)
- **Services** - hold all business logic
- **Models** - shared between server and (future) client

For the full picture see [Architectural Philosophy](foundations/architectural-philosophy).

---

## Modules at a Glance

Every module is published independently to GitHub Packages under `@superloomdev/*`. Pick the ones you need; they install as peer dependencies.

### Core helpers (platform-agnostic)

- **`@superloomdev/js-helper-utils`** - type checks, validation, sanitization, data manipulation. Zero external dependencies; safe to share between server and client.
- **`@superloomdev/js-helper-debug`** - structured logging with levels (debug, info, warn, error). Routes to console, JSON, or your own sink.
- **`@superloomdev/js-helper-time`** - date/time math, timezone handling, and formatting, without pulling in a heavy library.

### Databases (hot-swappable, same calling shape)

- **`@superloomdev/js-server-helper-sql-postgres`** - PostgreSQL with pooling, automatic placeholder translation, request-level timing.
- **`@superloomdev/js-server-helper-sql-mysql`** - MySQL with pooling and the same query API as the Postgres helper.
- **`@superloomdev/js-server-helper-sql-sqlite`** - SQLite via Node's built-in `node:sqlite`. Zero external dependency; ideal for offline or embedded use.
- **`@superloomdev/js-server-helper-nosql-mongodb`** - MongoDB with lazy-loaded native driver and connection pooling.
- **`@superloomdev/js-server-helper-nosql-aws-dynamodb`** - DynamoDB CRUD, batch, query, scan; lazy-loaded SDK v3.

### Storage and queues

- **`@superloomdev/js-server-helper-storage-aws-s3`** - S3 file operations with the same response envelope as every other helper.
- **`@superloomdev/js-server-helper-storage-aws-s3-url-signer`** - S3 presigned URL generation, isolated so credentials never need to leave the signer.
- **`@superloomdev/js-server-helper-queue-aws-sqs`** - SQS message queue: send, receive, delete, with structured logging built in.

### Auth, verification, and logging

- **`@superloomdev/js-server-helper-auth`** - session lifecycle plus JWT auth with refresh-token rotation. Storage-agnostic adapter pattern (SQLite, Postgres, MySQL, MongoDB, DynamoDB).
- **`@superloomdev/js-server-helper-verify`** - one-time verification codes (pin / code / token) with hot-swappable store adapters per backend.
- **`@superloomdev/js-server-helper-logger`** - compliance-friendly action log: per-row retention (persistent or TTL), optional IP encryption, multi-backend stores.

### Cross-cutting helpers

- **`@superloomdev/js-server-helper-instance`** - request lifecycle, cleanup, background tasks. Lambda-aware.
- **`@superloomdev/js-server-helper-crypto`** - hashing, encryption, UUID, random strings. Standard Node crypto with opinionated defaults.
- **`@superloomdev/js-server-helper-http`** - outgoing HTTP client wrapping native fetch; includes multipart upload.

### Client (browser-only)

- **`@superloomdev/js-client-helper-crypto`** - UUID, random strings, base64 via the Web Crypto API. Same naming as the server crypto helper.

---

## Where to Next

| If you want to... | Read |
|---|---|
| Set up a new project | [Getting Started](guide/getting-started) |
| Add your first domain entity | [Creating Entities](guide/creating-entities-js) |
| Configure your IDE | [IDE Setup](guide/ide-setup) |
| Understand the server architecture pattern | [Why the Server Uses MVC](philosophy/why-server-mvc) |
| Understand the one-shape rule | [DTO Philosophy](philosophy/dto-philosophy-js) |
| Read every technical rule | [Architectural Philosophy](foundations/architectural-philosophy) |
| Set up your dev machine | [Developer Setup](dev/README) |
| Provision infrastructure | [Operations](ops/README) |
