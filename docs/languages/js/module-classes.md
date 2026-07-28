# Module Categorization

Every Superloom helper module belongs to one of nine classes. The class determines the README structure, which `docs/` files (if any) accompany it, and which template to start from. This page is **the enumeration**: which module belongs to which class, and the current documentation status of each.

**Companion docs.**

- [`module-docs.md`](module-docs.md) - the full documentation rubric (Universal README Sections, class-specific sections, personas, ordering, three-tier model).
- [`../../principles/documentation-authoring.md`](../../principles/documentation-authoring.md) - writing-style rules (voice, prose mechanics, em-dash ban, table-cell rules, placeholder syntax).
- [`module-docs-complex.md`](module-docs-complex.md) - deep guide for `docs/` folders in Class E feature modules.

## On This Page

- [The Nine Classes](#the-nine-classes)
- [Universal Documentation Footprint](#universal-documentation-footprint)
- [Class A. Foundation Utility](#class-a-foundation-utility)
- [Class B. Extended Utility](#class-b-extended-utility)
- [Class C. Driver Wrapper](#class-c-driver-wrapper)
- [Class D. Cloud Service Wrapper](#class-d-cloud-service-wrapper)
- [Class E. Feature Module with Adapters](#class-e-feature-module-with-adapters)
- [Class F. Dependent Adapter](#class-f-dependent-adapter)
- [Class G. Feature Module with Extensions](#class-g-feature-module-with-extensions)
- [Class H. Extension](#class-h-extension)
- [Class I. Framework Module](#class-i-framework-module)
- [Documentation Status Matrix](#documentation-status-matrix)
- [Migration Priority](#migration-priority)

---

## The Nine Classes

The classes form a **dependency staircase**: each step adds one more thing the module is allowed to depend on. A module belongs to the lowest class whose dependency budget it fits. The class is decided by where the dependency boundary sits, not by what the module does.

| Class | What it depends on (outside its own code) | Template | `docs/` folder |
|---|---|---|---|
| **A. Foundation utility** | Nothing. Pure JavaScript that runs in any modern JS environment (Node, browser, edge, mobile, server-side runtimes) | `README-foundation-module.md` | `api.md`, `configuration.md` |
| **B. Extended utility** | Only the Node.js runtime. Uses Node-built-in modules (`crypto`, `process`, `fetch`, `Buffer`, etc.). No third-party npm packages, no external services | `README-master-template.md` | `api.md`, `configuration.md` |
| **C. Driver wrapper** | A third-party-implemented service that operators **can self-host** on commodity infrastructure (Postgres, MySQL, MongoDB, SQLite) | `README-master-template.md` (driver variant) | `api.md`, `configuration.md` |
| **D. Cloud service wrapper** | A proprietary cloud service that operators **cannot self-host**. Runs only on the provider or a dedicated emulator (DynamoDB, S3, SQS) | `README-master-template.md` (cloud variant) | `api.md`, `configuration.md`, optional `iam.md` |
| **E. Feature module with adapters** | Anything required by the feature. May combine Class A utilities, Class B services, Class C/D backends, and Class F adapters. Provides a complete business-logic feature, not a primitive | `README-feature-module.md` | `api.md`, `configuration.md`, `schemas.md`, `data-model.md`, optional `runtime.md`. Storage-adapter detail lives in each Class F adapter package |
| **F. Dependent adapter** | A Class E parent module. Cannot function on its own; implements the parent's adapter contract for a single backend or runtime. The parent utilizes the adapter - adapter is the instrument, parent is boss. | `README-storage-adapter.md` (store) / `README-master-template.md` (adapter) | Store: `api.md`, `configuration.md`, `schema.md`, `cleanup.md`. Adapter: `api.md`, `configuration.md` |
| **G. Feature module with extensions** | Anything required by the feature. May combine Class A utilities, Class B services, Class C/D backends, and Class H extensions. Provides a complete business-logic feature designed for framework integration | `README-feature-with-extensions.md` | `api.md`, `configuration.md`, `schemas.md` (when the validators file enforces real contracts), `data-model.md`, optional `runtime.md`. Extension detail lives in each Class H package |
| **H. Extension** | A Class G parent module only. Cannot function on its own; adds framework-specific bindings (React, Vue, Angular) to a Class G parent module. The extension utilizes the parent - extension is boss. | `README-extension.md` | `api.md` (hooks/components), `philosophy.md` (extension pattern). No `configuration.md` - config lives in parent |
| **I. Framework module** | A UI framework received by injection, plus optionally the platform APIs of one pipeline. **Standalone:** no pure parent above it and no extensions below it. Holds its framework-free logic in-package because that logic has no second consumer | `README-master-template.md` (framework variant) | `api.md`, `configuration.md`, `schemas.md` (when the validators file enforces real contracts) |

*Class I versus G and H:* all three involve frameworks, and they are distinguished by whether a pure parent exists. Class G is a **pure** module that publishes extension points; Class H is the **dependent** binding that consumes a Class G parent; Class I is **standalone** and framework-bound, with no parent and no extensions. A module becomes Class G plus H only when its framework-free logic has a second consumer; otherwise it is Class I. The deciding procedure is the decision test in [`client/client-modules.md`](client/client-modules.md#pure-core-with-extensions-or-a-single-framework-module).

*Reading this table:* a Class B module is allowed to use everything Class A is, plus Node built-ins. A Class C module is allowed to use everything Class B is, plus a self-hostable third-party service. And so on. F, G, and H are special cases: they cannot stand alone. Class F has two subtypes: **stores** (data persistence, named `-store-[backend]`) and **adapters** (everything else: runtimes, transports, integrations, named `-adapter-[name]`). Class H has the naming pattern `-ext-[framework]`. Both Class F subtypes share one internal shape identical to every other factory module (loader takes `(shared_libs, config)`, `Lib` picked by reference from the injected container, companion config/errors/validators files, factory `createInterface` with fixed slots); whether `createInterface` closes over per-instance state varies by adapter. See `module-structure.md` for the skeletons.

---

## Universal Documentation Footprint

Every class A through I ships the same minimum set of files:

| File | Audience | Purpose |
|---|---|---|
| `README.md` | Browsers, decision-makers ("do I want this module?") | Value-first overview, what the module is, why use it, how to find more |
| `docs/api.md` | Implementers ("how do I call this function?") | Every exported function. Signature, parameters, return shape, examples, lifecycle |
| `docs/configuration.md` | Operators ("how do I set this up?") | Loader pattern, config keys, environment variables, peer/direct dependencies, runtime patterns, testing tiers |
| `ROBOTS.md` | AI agents ("how do I correctly use this in code I generate?") | Compact derived signature reference. Generated from / kept in sync with `docs/api.md` |

**Why uniform.** Two reasons:

1. **Token cost for AI tools.** A 1500-line `utils.js` file costs an order of magnitude more tokens to read than a 200-line `docs/api.md`. Every consumer (human or AI) benefits when the canonical reference is small and structured.
2. **No per-module decisions.** If some Class A modules ship `docs/api.md` and some don't, every contributor and every reviewer has to re-evaluate the call. Making it universal removes the question entirely.

Class-specific extras stack on top of the universal four. Class D adds `docs/iam.md`. Class E adds `docs/data-model.md` and an optional `docs/runtime.md`. Any module that ships a `*.validators.js` also adds `docs/schemas.md`, the page that documents every validated boundary contract (the config schema, the per-call options, the injected-dependency contract, the response envelope) and the throw-versus-return discipline; Class E and G always carry one, and a lighter class carries one only when it validates input (for example a Class A `money` module). `docs/schemas.md` (plural) documents the boundary contracts a caller and an injected dependency must satisfy and is distinct from a Class F store's `docs/schema.md` (singular), which documents backend DDL and indexes; the two cross-link and never overlap. Class F stores add `docs/schema.md` and `docs/cleanup.md`, the two documents that capture what is operationally distinctive per backend; Class F adapters ship only the universal pair (`api.md` + `configuration.md`). Class G modules ship the standard docs plus optional `runtime.md`. Extension documentation lives in each Class H package. Class H extensions ship `api.md` (hooks/components) and `philosophy.md` (extension pattern), but not `configuration.md` - configuration lives in the parent module. None of these *replace* the universal four; they add to them. Class E **does not** add a `docs/storage-adapters.md`: adapter documentation lives in each Class F package, not in the parent. The Class E README has a short "Storage Adapters" or "Transport Adapters" subsection that lists the available adapters and points to each package's own README. The Class G README has a short "Extensions" subsection listing available Class H packages.

For Class F stores specifically, `docs/api.md` documents the store contract (with backend-specific semantic notes); `docs/configuration.md` covers the `STORE_CONFIG` keys, peer dependencies, environment variables consumed by `_test/loader.js`, and the testing tier; `docs/schema.md` documents what `setupNewStore` creates and the backend-specific syntax notes; `docs/cleanup.md` documents the TTL behavior and the recommended cleanup mechanism. For Class F adapters, `docs/api.md` documents the adapter contract (one subsection per method with runtime-specific notes); `docs/configuration.md` covers any adapter-specific config, peer dependencies, and the testing tier. The README for both subtypes follows the **same Universal Section list as every other class**, condensed to ~70-90 lines (tagline, What This Is, Why-bullets including a backend/runtime-specific bullet 5, Hot-Swappable, Aligned with Superloom, Extended Documentation, Adding to Your Project pointing to the parent, Testing Status, License); it contains no `## Install` block and no `## Usage` / Quick Start. Each Class F package documents only its own backend or runtime. There is no cross-adapter comparison anywhere in a Class F package.

---

## Class A. Foundation Utility

**Characteristics:** **No external dependencies at all.** Pure JavaScript that uses only language built-ins (`Date`, `Intl`, `Math`, `Array`, etc.) and universal Web standards available across runtimes (Web Crypto API for randomness and hashing, `console`, etc.). Runs identically in Node.js, browsers, React Native, Cloudflare Workers, Deno, Bun, and any modern JavaScript environment.

In the JS implementation repository, these live under `src/helper-modules-core/` (universal modules) or `src/helper-modules-client/` (modules whose tagline targets the browser-side use case but which still run anywhere). Directory placement is for discovery; the dependency boundary is what defines the class. Client modules that depend on a specific React variant (DOM only, native only, or the RNW universal pipeline) carry framework-tier prefixes (`js-rw-helper-*`, `js-rn-helper-*`, `js-rnw-helper-*`). The full client naming taxonomy, including the tier placement flowchart and promotion rule, lives in [`client/client-modules.md`](./client/client-modules.md).

**README extras** (on top of the universal set): none. The categorized function survey lives in `docs/api.md`.

**`docs/`:** `api.md`, `configuration.md` (per the [universal footprint](#universal-documentation-footprint)), plus `schemas.md` when the module's `*.validators.js` enforces real contracts (for example `money`). Every module ships a validators file; a no-op one needs no schemas page. The configuration page is short for Class A (no config keys, no environment variables, no peer dependencies) but is still produced for shape consistency.

| Module | Package | Purpose |
|---|---|---|
| `js-helper-utils` | `@superloomdev/js-helper-utils` | Type checks, validation, sanitization, data manipulation |
| `js-helper-debug` | `@superloomdev/js-helper-debug` | Structured logging with levels (debug, info, warn, error) |
| `js-helper-time` | `@superloomdev/js-helper-time` | Date/time math, timezone handling, formatting |
| `js-client-helper-crypto` | `@superloomdev/js-client-helper-crypto` | UUID, random strings, base64 (browser; Web Crypto API) |

---

## Class B. Extended Utility

**Characteristics:** Depends only on the **Node.js runtime**. May use any Node-built-in module (`crypto`, `process`, `fetch`, `Buffer`, `URL`, `URLSearchParams`, `AbortSignal`, etc.) but **no third-party npm packages and no external services**. The classification is about where the dependency boundary sits, not about what the module does or which surface it presents.

Three very different-feeling utilities sit at this level: a per-request lifecycle manager (`instance`), a cryptography utility (`crypto`), and an outgoing HTTP client (`http`). What unites them is that none of them reach beyond Node itself. Each provides server-side plumbing built on the runtime's standard library.

In the JS implementation repository, these live under `src/helper-modules-server/`. The `server` prefix marks the runtime requirement: Class A modules run in any JS environment; Class B modules require Node-specific built-ins.

**README extras:** "Behavior". Explains the lifecycle semantics (cleanup ordering, background tasks) or the categorized utility surface.

**`docs/`:** `api.md`, `configuration.md` (per the [universal footprint](#universal-documentation-footprint)).

| Module | Package | Purpose |
|---|---|---|
| `js-server-helper-instance` | `@superloomdev/js-server-helper-instance` | Per-request instance lifecycle, cleanup hooks, background tasks |
| `js-server-helper-crypto` | `@superloomdev/js-server-helper-crypto` | Hashing, encryption, UUID, random strings, base conversion |
| `js-server-helper-http` | `@superloomdev/js-server-helper-http` | Outgoing HTTP client. Native `fetch` wrapper with multipart support |

---

## Class C. Driver Wrapper

**Characteristics:** Wraps a **third-party-implemented service** whose engine operators **can self-host** on commodity infrastructure. The "third party" is the team that wrote the engine (the SQLite Consortium, the PostgreSQL team, the MySQL team, MongoDB Inc., etc.); whether the wrapper reaches that engine through an npm package (`pg`, `mysql2`, `mongodb`) or a Node built-in driver (`node:sqlite`) is incidental. What matters is that the engine itself is third-party and free to self-host.

The self-hostable criterion is what separates Class C from Class D. SQLite, Postgres, MySQL, and MongoDB all have free, downloadable engines an operator can run on their own machine, in a Docker container, on a virtual machine, or on a managed-but-portable platform. DynamoDB, S3, and SQS do not: the engine itself runs only on the provider's infrastructure (or a dedicated emulator), so they are Class D.

Class C modules present a unified API (`getRow`, `getRows`, `getValue`, `write`, etc.) so calling code is identical across backends. They insulate the application from upstream driver churn.

**README extras:** "Common Patterns". 2-3 progressive examples (read, write, transaction); brief callout about cross-backend API compatibility.

**`docs/`:** `api.md`, `configuration.md`.

| Module | Package | Underlying driver |
|---|---|---|
| `js-server-helper-sql-sqlite` | `@superloomdev/js-server-helper-sql-sqlite` | Node.js built-in `node:sqlite` |
| `js-server-helper-sql-postgres` | `@superloomdev/js-server-helper-sql-postgres` | `pg` (node-postgres) |
| `js-server-helper-sql-mysql` | `@superloomdev/js-server-helper-sql-mysql` | `mysql2` |
| `js-server-helper-nosql-mongodb` | `@superloomdev/js-server-helper-nosql-mongodb` | `mongodb` (native driver) |

---

## Class D. Cloud Service Wrapper

**Characteristics:** Wraps a **proprietary cloud service** whose engine **cannot be self-hosted** on commodity infrastructure. The service runs only on the provider (DynamoDB on AWS, S3 on AWS, SQS on AWS) or on a dedicated emulator that exists specifically to mimic the provider for development (DynamoDB Local, MinIO, LocalStack, ElasticMQ). The emulator is not a real self-hosted version of the service; it is a stand-in that lets developers run tests without paying provider bills.

The surface domain does not change the classification. DynamoDB looks like a database and presents the same `addRecord` / `queryRecords` calling shape as the Class C drivers, but it is Class D because operators cannot run real DynamoDB themselves. S3 looks like file storage; SQS looks like a queue; the deciding criterion is the operational dependency on the provider, not the API shape.

**README extras:** "Credentials & IAM". Short section on credentials, IAM permissions, regional config. The shape of `docs/configuration.md` is the AWS-family template (see [Cross-Cutting Patterns → AWS Family](module-docs.md#aws-family-pattern-dynamodb-s3-sqs-and-any-future-aws-service-wrapper)) regardless of whether the surface looks like a database (DynamoDB) or like object storage (S3).

**`docs/`:** `api.md`, `configuration.md`, optionally `iam.md`.

| Module | Package | Service | Surface |
|---|---|---|---|
| `js-server-helper-nosql-aws-dynamodb` | `@superloomdev/js-server-helper-nosql-aws-dynamodb` | DynamoDB | Database (`addRecord`, `queryRecords`) |
| `js-server-helper-storage-aws-s3` | `@superloomdev/js-server-helper-storage-aws-s3` | S3 | File storage |
| `js-server-helper-storage-aws-s3-url-signer` | `@superloomdev/js-server-helper-storage-aws-s3-url-signer` | S3 | Presigned URL generation |
| `js-server-helper-queue-aws-sqs` | `@superloomdev/js-server-helper-queue-aws-sqs` | SQS | Message queue |

---

## Class E. Feature Module with Adapters

**Characteristics:** A **full-featured business-logic module**. Provides a complete, opinionated solution to a problem domain (authentication, verification codes, action logging) rather than a utility primitive. Class E modules are the only modules permitted to **combine arbitrary other classes**: they typically depend on Class A utilities, Class B services like `instance` and `crypto`, and one of several Class F adapters chosen at runtime via the loader pattern. The choice of storage backend (Class C self-hosted database vs Class D cloud service) is deferred to the operator through the adapter.

The data model is deep enough to warrant a dedicated `docs/data-model.md`. The differences between the two runtime shapes the framework supports (persistent server, serverless function) live on a single optional `docs/runtime.md` page. The page documents **only** those differences (how the per-request `instance` is constructed in each shape; how scheduled cleanup is wired in each shape) and nothing else. It is deliberately not a framework cookbook: no Express middleware tutorial, no Lambda handler boilerplate, no login/refresh/logout endpoint code. Per-framework integration code is application code, not module documentation.

**README extras:** Two adjacent class-specific README subsections. **"Architecture Overview"** (high-level diagram or tree of the loader / `parts/` / adapter wiring) and **"Storage Adapters"** or **"Transport Adapters"** depending on what the module delegates (short list of available adapters + selection rule + pointer to each adapter package's own README). No separate `docs/storage-adapters.md` file.

**`docs/`:** `api.md`, `configuration.md`, `schemas.md`, `data-model.md`, optionally `runtime.md`. The `schemas.md` page documents every contract the module's `*.validators.js` enforces. Storage-adapter detail is owned by each Class F adapter package, not the parent. See [`module-docs-complex.md`](module-docs-complex.md) for the deep guide.

| Module | Package | Purpose |
|---|---|---|
| `js-server-helper-auth` | `@superloomdev/js-server-helper-auth` | Session lifecycle and authentication; optional JWT mode with refresh-token rotation |
| `js-server-helper-verify` | `@superloomdev/js-server-helper-verify` | One-time verification codes (pin, code, token) |
| `js-server-helper-logger` | `@superloomdev/js-server-helper-logger` | Compliance-friendly action log with per-row retention and optional IP encryption |
| `js-server-helper-http-gateway` | `@superloomdev/js-server-helper-http-gateway` | Runtime-agnostic HTTP request/response gateway with pluggable transport adapters |

---

## Class F. Dependent Adapter

**Characteristics:** An adapter that **cannot function on its own**. Implements a Class E parent module's adapter contract for a single backend or runtime. Always paired with the parent module via the adapter pattern: the parent passes the adapter factory at loader time and uses it to satisfy its persistence or transport requirements.

Class F is the only class with this "cannot stand alone" property. Every other class is independently usable: install, configure, use. Class F adapters need a parent that knows what to do with them.

Class F has two subtypes, distinguished by **what they adapt**:

| Subtype | Naming | What it adapts | Typical use cases |
|---|---|---|---|
| **Store** (`-store-`) | `[parent]-store-[backend]` | Data persistence and storage backends | Databases (SQL, NoSQL), file systems, caches |
| **Adapter** (`-adapter-`) | `[parent]-adapter-[name]` | Everything else: runtimes, transports, integrations | HTTP runtimes, queue consumers, notification channels, future use cases |

**Internal shape (one shape for both subtypes):** Every Class F module - store or adapter, stateful or stateless - uses the **standard injected-Lib factory shape**: the loader takes `(shared_libs, config)` like every other helper module, picks `Lib` by reference from the injected container, merges `config` over its companion config defaults, owns its own `ERRORS` and `Validators` (companion files, per the Universal Companion Files rule in `module-structure.md`), and returns a ready-to-use object via `createInterface(Lib, CONFIG, ERRORS, Validators)`. Statelessness only means `createInterface` closes over nothing beyond the four fixed slots.

**README extras:** None beyond the standard sections. The README follows the same Universal Section list as every other class (see [`module-docs.md` → Class F](module-docs.md#class-f-dependent-adapter)), condensed to ~70-90 lines. The "extension of the parent module" framing lives in the tagline (position 2) and the brief "What This Is" paragraph (position 3); there is no separate "How this fits into the parent module" subsection in the README itself, and no per-backend table comparing siblings. Section 9 ("Adding to Your Project") points to the parent module's install instructions and the loader-pattern doc; it contains no `npm install` snippet of its own. The loader and store-contract explanation lives in `docs/api.md`.

**`docs/`:** Stores: `api.md`, `configuration.md`, `schema.md`, `cleanup.md`. Adapters: `api.md`, `configuration.md`. Each Class F package is the authoritative source for its own backend or runtime's operational detail. The parent's `docs/` does not duplicate any of this. See [`module-docs-complex.md`](module-docs-complex.md) for the deep guide.

### Auth Store Adapters

| Module | Package | Backend | Parent |
|---|---|---|---|
| `js-server-helper-auth-store-sqlite` | `@superloomdev/...auth-store-sqlite` | SQLite | `auth` |
| `js-server-helper-auth-store-postgres` | `@superloomdev/...auth-store-postgres` | PostgreSQL | `auth` |
| `js-server-helper-auth-store-mysql` | `@superloomdev/...auth-store-mysql` | MySQL | `auth` |
| `js-server-helper-auth-store-mongodb` | `@superloomdev/...auth-store-mongodb` | MongoDB | `auth` |
| `js-server-helper-auth-store-dynamodb` | `@superloomdev/...auth-store-dynamodb` | DynamoDB | `auth` |

### Verify Store Adapters

| Module | Package | Backend | Parent |
|---|---|---|---|
| `js-server-helper-verify-store-sqlite` | `@superloomdev/...verify-store-sqlite` | SQLite | `verify` |
| `js-server-helper-verify-store-postgres` | `@superloomdev/...verify-store-postgres` | PostgreSQL | `verify` |
| `js-server-helper-verify-store-mysql` | `@superloomdev/...verify-store-mysql` | MySQL | `verify` |
| `js-server-helper-verify-store-mongodb` | `@superloomdev/...verify-store-mongodb` | MongoDB | `verify` |
| `js-server-helper-verify-store-dynamodb` | `@superloomdev/...verify-store-dynamodb` | DynamoDB | `verify` |

### Logger Store Adapters

| Module | Package | Backend | Parent |
|---|---|---|---|
| `js-server-helper-logger-store-sqlite` | `@superloomdev/...logger-store-sqlite` | SQLite | `logger` |
| `js-server-helper-logger-store-postgres` | `@superloomdev/...logger-store-postgres` | PostgreSQL | `logger` |
| `js-server-helper-logger-store-mysql` | `@superloomdev/...logger-store-mysql` | MySQL | `logger` |
| `js-server-helper-logger-store-mongodb` | `@superloomdev/...logger-store-mongodb` | MongoDB | `logger` |
| `js-server-helper-logger-store-dynamodb` | `@superloomdev/...logger-store-dynamodb` | DynamoDB | `logger` |

### HTTP Gateway Transport Adapters

| Module | Package | Runtime | Parent |
|---|---|---|---|
| `js-server-helper-http-gateway-adapter-aws-apigateway` | `@superloomdev/...http-gateway-adapter-aws-apigateway` | AWS Lambda + API Gateway v2.0 | `http-gateway` |
| `js-server-helper-http-gateway-adapter-express` | `@superloomdev/...http-gateway-adapter-express` | Express (Docker) | `http-gateway` |

---

## Class G. Feature Module with Extensions

**Characteristics:** A **full-featured business-logic module** with built-in extension points for framework integration. Similar to Class E, but designed for extension by Class H modules rather than adaptation by Class F modules.

Class G modules provide complete solutions to problem domains (like theming, UI state, form handling) that naturally benefit from framework-specific bindings. They expose a clean JavaScript API for the core functionality and documented extension points for React, Vue, Angular, etc.

**Extension pattern vs Adapter pattern:**
- **Class E + F (adapter pattern):** Parent utilizes adapter. Adapter is instrument, parent is boss.
- **Class G + H (extension pattern):** Extension utilizes parent. Extension is instrument, extension is boss.

**README extras:** "Architecture Overview" showing extension points, "Extensions" subsection listing available Class H packages.

**`docs/`:** `api.md`, `configuration.md`, `schemas.md` (when the validators file enforces real contracts), `data-model.md`, optional `runtime.md`. Extension details live in each Class H package.

| Module | Package | Purpose | Extensions Available |
|---|---|---|---|
| `js-client-helper-styler` | `@superloomdev/js-client-helper-styler` | Theme engine with template-driven tokens | `js-client-helper-styler-ext-react` (React) |

---

## Class H. Extension

**Characteristics:** An extension that **cannot function on its own**. Adds framework-specific bindings (React hooks, Vue composables, Angular services) to a parent module (Class G). Always paired with a Class G parent via the extension pattern: the extension imports the parent and wraps it for the target framework.

Class H is the counterpart to Class G. Where Class G provides extension points for frameworks, Class H implements those extensions for a specific framework. The key difference is the dependency direction:
- **Class F (adapter pattern):** Parent utilizes adapter. Adapter is instrument, parent is boss.
- **Class H (extension pattern):** Extension utilizes parent. Extension is instrument, extension is boss.

**Class G + H relationship:** Just as Class F (dependent adapter) pairs with Class E (feature module with adapters), Class H (extension) pairs with Class G (feature module with extensions). The key difference is the dependency direction:
- **Class E + F:** Parent utilizes adapter - adapter is instrument, parent is boss
- **Class G + H:** Extension utilizes parent - extension is instrument, extension is boss

**Naming convention:** `[parent-name]-ext-[framework]`. Example: `js-client-helper-styler-ext-react`.

**Entry point:** `extension.js` (not `index.js`). This makes the module type discoverable by filename and keeps the extension pattern consistent with store/adapter naming conventions.

**README extras:** "Extension vs Parent" comparison table. Brief explanation of the extension pattern. No Install section (peer dependencies only). Points to parent module for full API documentation.

**`docs/`:** `api.md` (hooks/components reference), `philosophy.md` (extension pattern explained). No `configuration.md` - configuration lives in the parent module.

| Module | Package | Parent Module | Framework | Purpose |
|---|---|---|---|---|
| `js-client-helper-styler-ext-react` | `@superloomdev/js-client-helper-styler-ext-react` | `js-client-helper-styler` | React 18+ | React hooks and ThemeProvider for Styler |

---

## Class I. Framework Module

**Characteristics:** A **standalone** module that depends on a UI framework received by injection. It has no pure parent above it and publishes no extensions below it. Its framework-free logic stays in-package, because that logic has no consumer outside the framework. A Class I module may additionally depend on the platform APIs of one pipeline, and that choice determines its prefix rather than its class.

Class I exists because the Class G plus H pair is not free: it costs two packages, two CI job pairs, two publish cycles, and a version range pinned between them. That price buys framework independence, which is only worth paying when the framework-free logic actually has a second consumer. When the framework is the only consumer, Class I is the correct shape and the split would be ceremony. See the decision test in [`client/client-modules.md`](client/client-modules.md#pure-core-with-extensions-or-a-single-framework-module).

**Not to be confused with:**

- **Class G** is pure and publishes extension points. Class I depends on a framework directly.
- **Class H** cannot stand alone and consumes a Class G parent. Class I stands alone and has no parent.

**Naming convention:** a framework-tier prefix, never a suffix. `js-react-helper-[name]` when the module needs nothing beyond `react`; `js-rw-helper-*`, `js-rn-helper-*`, or `js-rnw-helper-*` when it is bound to the DOM, to React Native, or to the Expo/Metro pipeline respectively. The full prefix table is in [`client/client-modules.md`](client/client-modules.md#framework-tier-prefixes).

**Entry point:** `[name].js`, matching every other standalone module. The `extension.js` filename is reserved for Class H, so the entry filename alone distinguishes a standalone framework module from a dependent extension.

**Dependency direction:** a Class I module may depend on pure modules (Class A, B, and Class E parents). No pure module may depend on a Class I module. Dependencies point from framework-bound toward pure, never the reverse.

**Framework injection:** the framework arrives through the `Lib` container (`Lib.React`), never through a direct `import React`. This keeps the dependency centralized, keeps `react` a peer dependency rather than a bundled one, and lets `_test/` inject a stub so tests run in pure Node with no Metro and no emulator.

**README extras:** "Supported Renderers" (which React targets the module runs on, and what it requires to be installed). Install section lists `react` as a peer dependency.

**`docs/`:** `api.md`, `configuration.md`, plus `schemas.md` when the validators file enforces real contracts. Unlike Class H, a Class I module owns its own configuration, so `configuration.md` is required.

| Module | Package | Prefix tier | Framework | Purpose |
|---|---|---|---|---|
| _none shipped yet_ | | | | First Class I modules arrive with the client helper module wave |

---

## Documentation Status Matrix

Tracks which modules have been restructured per [`module-docs.md`](module-docs.md) (value-first README + `docs/` separation, full writing-guide compliance).

| Module | Class | README v2 | `docs/` present | Writing-guide pass | Notes |
|---|---|---|---|---|---|
| js-helper-utils | A | **Yes** | **Yes** (`api.md`, `configuration.md`) | **Yes** | Class A pilot. Established the four-bullet pattern |
| js-helper-debug | A | **Yes** | **Yes** (`api.md`, `configuration.md`) | **Yes** | Configurable Class A. Documents the canonical local-`start_ms` performance-audit pattern |
| js-helper-time | A | **Yes** | **Yes** (`api.md`, `configuration.md`) | **Yes** | 24-function pure-utility surface. Documents the plural-vs-singular Date-Data-Set key convention |
| js-client-helper-crypto | A | **Yes** | **Yes** (`api.md`, `configuration.md`) | **Yes** | Browser-side member of the crypto runtime pair |
| js-client-helper-styler | G | **Yes** | **Yes** (`api.md`, `configuration.md`, `template.md`, `philosophy.md`) | **Yes** | Class G pilot. First extension-based module. Four-doc pattern: api, configuration, template, philosophy |
| js-client-helper-styler-ext-react | H | **Yes** | **Yes** (`api.md`, `philosophy.md`) | **Yes** | Extension pattern pilot. Establishes naming convention `*-ext-[framework]` |
| js-server-helper-instance | B | **Yes** | **Yes** (`api.md`, `configuration.md`) | **Yes** | Class B pilot. Established the lifecycle/'Behavior' section pattern |
| js-server-helper-crypto | B | **Yes** | **Yes** (`api.md`, `configuration.md`) | **Yes** | Server-side member of the crypto runtime pair |
| js-server-helper-sql-postgres | C | **Yes** | **Yes** (`api.md`, `configuration.md`) | **Yes** | Class C SQL pilot |
| js-server-helper-sql-mysql | C | **Yes** | **Yes** (`api.md`, `configuration.md`) | **Yes** | Mirrors the Postgres pilot |
| js-server-helper-sql-sqlite | C | **Yes** | **Yes** (`api.md`, `configuration.md`) | **Yes** | Embedded SQL variant (offline, in-process) |
| js-server-helper-nosql-mongodb | C | **Yes** | **Yes** (`api.md`, `configuration.md`) | **Yes** | NoSQL family pilot |
| js-server-helper-nosql-aws-dynamodb | D | **Yes** | **Yes** (`api.md`, `configuration.md`) | **Yes** | Class D cloud database. Calling shape mirrors Class C drivers |
| js-server-helper-http | B | **Yes** | **Yes** (`api.md`, `configuration.md`) | **Yes** | Class B (Node built-in `fetch` wrapper) |
| js-server-helper-storage-aws-s3 | D | **Yes** | **Yes** (`api.md`, `configuration.md`) | **Yes** | First Class D pilot. AWS family pattern |
| js-server-helper-storage-aws-s3-url-signer | D | **Yes** | **Yes** (`api.md`, `configuration.md`) | **Yes** | Class D AWS family |
| js-server-helper-queue-aws-sqs | D | **Yes** | **Yes** (`api.md`, `configuration.md`) | **Yes** | Class D AWS family |
| js-server-helper-auth | E | **Yes** | **Yes** (`api.md`, `configuration.md`, `data-model.md`, `runtime.md`, `push-notifications.md`) | **Yes** | Class E pilot |
| js-server-helper-verify | E | **Yes** | **Yes** (`api.md`, `configuration.md`, `data-model.md`, `runtime.md`) | **Yes** | Class E |
| js-server-helper-logger | E | **Yes** | **Yes** (`api.md`, `configuration.md`, `data-model.md`, `runtime.md`) | **Yes** | Class E |
| js-server-helper-verify-store-* (5) | F | **Yes (v1)** | No (pending) | **Yes** | Predates the Class E parents. Five adapters: sqlite, postgres, mysql, mongodb, dynamodb |
| js-server-helper-auth-store-postgres | F | **Yes (pilot)** | **Yes** (`api.md`, `configuration.md`, `schema.md`, `cleanup.md`) | **Yes** | Class F pilot under the four-doc rubric |
| js-server-helper-auth-store-mongodb | F | **Yes** | **Yes** (`api.md`, `configuration.md`, `schema.md`, `cleanup.md`) | **Yes** | NoSQL case under the four-doc rubric |
| js-server-helper-auth-store-sqlite | F | **Yes** | **Yes** (`api.md`, `configuration.md`, `schema.md`, `cleanup.md`) | **Yes** | Embedded / in-process SQL case under the four-doc rubric |
| js-server-helper-auth-store-mysql | F | **Yes** | **Yes** (`api.md`, `configuration.md`, `schema.md`, `cleanup.md`) | **Yes** | MySQL / MariaDB SQL case under the four-doc rubric |
| js-server-helper-auth-store-dynamodb | F | **Yes** | **Yes** (`api.md`, `configuration.md`, `schema.md`, `cleanup.md`) | **Yes** | AWS DynamoDB NoSQL case under the four-doc rubric |
| js-server-helper-logger-store-* (5) | F | **Yes** | **Yes** (`api.md`, `configuration.md`, `schema.md`, `cleanup.md`) | **Yes** | Five adapters: sqlite, postgres, mysql, mongodb, dynamodb |
| js-server-helper-http-gateway-adapter-aws-apigateway | F | No (pending) | No (pending) | No | Transport adapter subtype. First Class F transport adapter |
| js-server-helper-http-gateway-adapter-express | F | No (pending) | No (pending) | No | Transport adapter subtype |

