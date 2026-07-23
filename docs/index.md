# Superloom

> One way to structure data, one way to inject dependencies, one way to handle errors. A modular application framework and an engineering reference, built for human and AI development together.

Modern development has a new pressure: AI agents generate code faster than humans can review it. Without structure, the result is drift; every feature adds a slightly different way of doing the same thing, and six months later nobody, human or machine, can say what the house style is.

Superloom is the opposite bet. It is an opinionated engineering standard expressed as documentation, precise enough to build production modules and applications from. The same business logic runs unchanged on Docker (Express) and AWS Lambda; only the transport adapter at the edge changes. The architecture is language-independent; JavaScript is the current reference implementation.

---

## Why Superloom

- **Build once, reuse on every project.** Every module ships pre-tested with a stable contract, so the next codebase, and the AI agent helping build it, relies on the wrapper instead of re-discovering the plumbing.

- **Designed for review of AI output.** Section banners, strict vertical rhythm, step comments, and a single response envelope let a reviewer read any module top to bottom and spot what an AI got wrong, without getting lost in dense logic.

- **Opinionated enough that AI cannot drift.** One loader shape, one validation contract, one error envelope, one skeleton per file archetype. Every contributor stays on the same rails, so a six-month-old codebase still looks like a six-day-old one.

- **Real modules, not an abstraction layer.** Each helper wraps one production library (Postgres, S3, MongoDB, ...) so when an upstream driver changes, only the wrapper updates.

- **Forkable by design.** The documentation separates universal principles from language-specific opinions. A team can adopt it as-is, extend it to Python or Java, or fork it and substitute their own opinions layer by layer.

---

## The Three Documentation Layers

| Layer | What it holds | Start at |
|---|---|---|
| **Principles** | Universal engineering rules and the reasoning behind them, language-independent | [Engineering Philosophy](principles/engineering-philosophy) |
| **Languages** | Each language's complete, opinionated implementation of the principles | [JavaScript](languages/js/index) |
| **AI** | Standards for AI-assisted development: agent configuration, workflow authoring, model tiering | [AI-Assisted Development](ai/index) |

A JavaScript developer works entirely from the languages layer. An architect evaluating the framework reads principles. A team extending to a new language reads [Extending to a Language](principles/extending-to-a-language).

---

## Anatomy of a Superloom Module File

Every helper module follows the same internal shape. A developer who has read one file can navigate any file.

### Section banners as scroll anchors

```javascript
/////////////////////////// Module-Loader START ////////////////////////////////

const loader = function (shared_libs, config) {
  Lib = shared_libs;
  CONFIG = config;
};

//////////////////////////// Module-Loader END /////////////////////////////////
```

Sections are large and few (loader, public functions, private functions, exports), identical across every module, so navigating a new module costs nothing.

### JSDoc on every public function

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

A reviewer answers "what does this function expect, and what does it give back" without reading the body. The return shape is the same envelope every other public function in every other module uses.

### The 3/2/1 vertical-spacing rule

| Spacing | Where it appears |
|---|---|
| **3 blank lines** | Between major module sections |
| **2 blank lines** | Between function definitions |
| **1 blank line** | Inside functions, between logical blocks |

The spacing is a structural reading aid: a reader tells section boundaries from function boundaries peripherally, without reading. Full rules in [Code Formatting](languages/js/code-formatting).

### AI configuration next to the code

Every repository ships an `AGENTS.md` at the root and every module ships a `ROBOTS.md` beside its source: compact rule files an agent reads first, so AI-assisted work starts from the rules, not a guess. The standard is in [Agent Configuration](ai/agent-configuration).

---

## Architecture at a Glance

```
your-project/
  src/
    model/[entity]/                  # Domain models: validation, DTOs, errors (pure, IO-free)
    model-server/[entity]/           # Server-only model extensions
    server/
      common/                        # Bootstrap, config, loader
      controller/[entity]/           # Thin adapters: validate, build DTO, delegate
      service/[entity]/              # Business logic and orchestration
      interfaces/api/
        express/                     # Express routes (Docker deployment)
        lambda-aws/[entity]/         # Per-entity AWS Lambda handlers (Serverless)
      _deploy/[entity]/              # Per-entity Serverless Framework configs
```

```
Interface (transport adapter)
  -> Controller (validate, build DTO, delegate)
    -> Service (business logic, uses helpers via Lib)
  <- response envelope { success, data | error }
```

The pattern and its reasoning: [Server Architecture](principles/server-architecture).

---

## Module Catalogs

The JavaScript layer documents three module catalogs: platform-agnostic core helpers, server-only helpers (databases, storage, queues), and client helpers. Every documented module follows the same loader shape, response envelope, and testing contract.

The per-tier catalogs: [core](languages/js/catalog-core), [server](languages/js/catalog-server), [client](languages/js/catalog-client).

---

## Where to Next

| If you want to... | Read |
|---|---|
| Set up a new project | [Getting Started](guide/getting-started) |
| Add your first domain entity | [Creating Entities](guide/creating-entities-js) |
| Understand the rules and their reasons | [Principles](principles/engineering-philosophy) |
| Write or review JavaScript modules | [JavaScript Implementation](languages/js/index) |
| Configure AI agents for this codebase | [AI-Assisted Development](ai/index) |
| Extend the framework to another language | [Extending to a Language](principles/extending-to-a-language) |
| Set up your dev machine | [Developer Setup](dev/README) |
| Provision infrastructure | [Operations](ops/README) |
