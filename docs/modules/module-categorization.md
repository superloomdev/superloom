# Module Categorization

Every Superloom helper module belongs to one of six classes. The class determines the README structure, which `docs/` files (if any) accompany it, and which template to start from. This page is **the enumeration**: which module belongs to which class, and the current documentation status of each.

**Companion docs.**

- [`module-readme-structure.md`](module-readme-structure.md) - the full documentation rubric (Universal README Sections, class-specific sections, personas, ordering, three-tier model).
- [`../dev/documentation-standards.md`](../dev/documentation-standards.md) - writing-style rules (voice, prose mechanics, em-dash ban, table-cell rules, placeholder syntax).
- [`complex-module-docs-guide.md`](complex-module-docs-guide.md) - deep guide for `docs/` folders in Class E feature modules.

## On This Page

- [The Six Classes](#the-six-classes)
- [Universal Documentation Footprint](#universal-documentation-footprint)
- [Class A. Foundation Utility](#class-a-foundation-utility)
- [Class B. Extended Utility](#class-b-extended-utility)
- [Class C. Driver Wrapper](#class-c-driver-wrapper)
- [Class D. Cloud Service Wrapper](#class-d-cloud-service-wrapper)
- [Class E. Feature Module with Adapters](#class-e-feature-module-with-adapters)
- [Class F. Storage Adapter](#class-f-storage-adapter)
- [Documentation Status Matrix](#documentation-status-matrix)
- [Migration Priority](#migration-priority)

---

## The Six Classes

The classes form a **dependency staircase**: each step adds one more thing the module is allowed to depend on. A module belongs to the lowest class whose dependency budget it fits. The class is decided by where the dependency boundary sits, not by what the module does.

| Class | What it depends on (outside its own code) | Template | `docs/` folder |
|---|---|---|---|
| **A. Foundation utility** | Nothing. Pure JavaScript that runs in any modern JS environment (Node, browser, edge, mobile, server-side runtimes) | `README-foundation-module.md` | `api.md`, `configuration.md` |
| **B. Extended utility** | Only the Node.js runtime. Uses Node-built-in modules (`crypto`, `process`, `fetch`, `Buffer`, etc.). No third-party npm packages, no external services | `README-master-template.md` | `api.md`, `configuration.md` |
| **C. Driver wrapper** | A third-party-implemented service that operators **can self-host** on commodity infrastructure (Postgres, MySQL, MongoDB, SQLite) | `README-master-template.md` (driver variant) | `api.md`, `configuration.md` |
| **D. Cloud service wrapper** | A proprietary cloud service that operators **cannot self-host**. Runs only on the provider or a dedicated emulator (DynamoDB, S3, SQS) | `README-master-template.md` (cloud variant) | `api.md`, `configuration.md`, optional `iam.md` |
| **E. Feature module with adapters** | Anything required by the feature. May combine Class A utilities, Class B services, Class C/D backends, and Class F adapters. Provides a complete business-logic feature, not a primitive | `README-feature-module.md` | `api.md`, `configuration.md`, `data-model.md`, optional `runtime.md`. Storage-adapter detail lives in each Class F adapter package |
| **F. Storage adapter** | A Class E parent module. Cannot function on its own; implements the parent's store contract for a single backend | `README-storage-adapter.md` | `api.md`, `configuration.md`, `schema.md`, `cleanup.md` |

*Reading this table:* a Class B module is allowed to use everything Class A is, plus Node built-ins. A Class C module is allowed to use everything Class B is, plus a self-hostable third-party service. And so on. F is the special case: it is the only class that cannot stand alone.

---

## Universal Documentation Footprint

Every class A through F ships the same minimum set of files:

| File | Audience | Purpose |
|---|---|---|
| `README.md` | Browsers, decision-makers ("do I want this module?") | Value-first overview, what the module is, why use it, how to find more |
| `docs/api.md` | Implementers ("how do I call this function?") | Every exported function. Signature, parameters, return shape, examples, lifecycle |
| `docs/configuration.md` | Operators ("how do I set this up?") | Loader pattern, config keys, environment variables, peer/direct dependencies, runtime patterns, testing tiers |
| `ROBOTS.md` | AI agents ("how do I correctly use this in code I generate?") | Compact derived signature reference. Generated from / kept in sync with `docs/api.md` |

**Why uniform.** Two reasons:

1. **Token cost for AI tools.** A 1500-line `utils.js` file costs an order of magnitude more tokens to read than a 200-line `docs/api.md`. Every consumer (human or AI) benefits when the canonical reference is small and structured.
2. **No per-module decisions.** If some Class A modules ship `docs/api.md` and some don't, every contributor and every reviewer has to re-evaluate the call. Making it universal removes the question entirely.

Class-specific extras stack on top of the universal four. Class D adds `docs/iam.md`. Class E adds `docs/data-model.md` and an optional `docs/runtime.md`. Class F adds `docs/schema.md` and `docs/cleanup.md`, the two documents that capture what is operationally distinctive per backend. None of these *replace* the universal four; they add to them. Class E **does not** add a `docs/storage-adapters.md`: storage-adapter documentation lives in each Class F adapter package, not in the parent. The Class E README has a short "Storage Adapters" subsection that lists the available adapters and points to each adapter's own README.

For Class F adapters specifically, `docs/api.md` documents the store contract this adapter implements (with backend-specific semantic notes); `docs/configuration.md` covers the `STORE_CONFIG` keys, peer dependencies, environment variables consumed by `_test/loader.js`, and the testing tier; `docs/schema.md` documents what `setupNewStore` creates and the backend-specific syntax notes; `docs/cleanup.md` documents the TTL behavior of this backend and the recommended cleanup mechanism. The README itself follows the **same Universal Section list as every other class**, condensed to ~70-90 lines (tagline, What This Is, Why-bullets including a backend-specific bullet 5, Hot-Swappable, Aligned with Superloom, Extended Documentation, Adding to Your Project pointing to the parent, Testing Status, License); it contains no `## Install` block and no `## Usage` / Quick Start. Each adapter documents only its own backend. There is no "Postgres has X, MongoDB has Y" comparison anywhere in a Class F package.

---

## Class A. Foundation Utility

**Characteristics:** **No external dependencies at all.** Pure JavaScript that uses only language built-ins (`Date`, `Intl`, `Math`, `Array`, etc.) and universal Web standards available across runtimes (Web Crypto API for randomness and hashing, `console`, etc.). Runs identically in Node.js, browsers, React Native, Cloudflare Workers, Deno, Bun, and any modern JavaScript environment.

In the `js-helper-modules` repo, these live under `src/helper-modules-core/` (universal modules) or `src/helper-modules-client/` (modules whose tagline targets the browser-side use case but which still run anywhere). Directory placement is for discovery; the dependency boundary is what defines the class.

**README extras** (on top of the universal set): none. The categorized function survey lives in `docs/api.md`.

**`docs/`:** `api.md`, `configuration.md` (per the [universal footprint](#universal-documentation-footprint)). The configuration page is short for Class A (no config keys, no environment variables, no peer dependencies) but is still produced for shape consistency.

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

In the `js-helper-modules` repo, these live under `src/helper-modules-server/`. The `server` prefix marks the runtime requirement: Class A modules run in any JS environment; Class B modules require Node-specific built-ins.

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

**README extras:** "Credentials & IAM". Short section on credentials, IAM permissions, regional config. The shape of `docs/configuration.md` is the AWS-family template (see [Cross-Cutting Patterns → AWS Family](module-readme-structure.md#aws-family-pattern-dynamodb-s3-sqs-and-any-future-aws-service-wrapper)) regardless of whether the surface looks like a database (DynamoDB) or like object storage (S3).

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

**README extras:** Two adjacent class-specific README subsections. **"Architecture Overview"** (high-level diagram or tree of the loader / `parts/` / adapter wiring) and **"Storage Adapters"** (short list of available adapters + selection rule + pointer to each adapter package's own README). No separate `docs/storage-adapters.md` file.

**`docs/`:** `data-model.md`, `configuration.md`, optionally `runtime.md`. Storage-adapter detail is owned by each Class F adapter package, not the parent. See [`complex-module-docs-guide.md`](complex-module-docs-guide.md) for the deep guide.

| Module | Package | Purpose |
|---|---|---|
| `js-server-helper-auth` | `@superloomdev/js-server-helper-auth` | Session lifecycle and authentication; optional JWT mode with refresh-token rotation |
| `js-server-helper-verify` | `@superloomdev/js-server-helper-verify` | One-time verification codes (pin, code, token) |
| `js-server-helper-logger` | `@superloomdev/js-server-helper-logger` | Compliance-friendly action log with per-row retention and optional IP encryption |

---

## Class F. Storage Adapter

**Characteristics:** A storage adapter that **cannot function on its own**. Implements a Class E parent module's store contract for a single backend (one adapter per backend per parent feature). Always paired with the parent module via the adapter pattern: the parent passes the adapter factory at loader time and uses it to satisfy its persistence requirements.

Class F is the only class with this "cannot stand alone" property. Every other class is independently usable: install, configure, use. Class F adapters need a parent that knows what to do with them. Internally a Class F adapter is a thin wrapper around a Class C or Class D module that handles the persistence work.

**README extras:** None beyond the standard sections. The README follows the same Universal Section list as every other class (see [`module-readme-structure.md` → Class F](module-readme-structure.md#class-f-storage-adapter)), condensed to ~70-90 lines. The "extension of the parent module" framing lives in the tagline (position 2) and the brief "What This Is" paragraph (position 3); there is no separate "How this fits into the parent module" subsection in the README itself, and no per-backend table comparing siblings. Section 9 ("Adding to Your Project") points to the parent module's install instructions and the loader-pattern doc; it contains no `npm install` snippet of its own. The factory-protocol explanation lives in `docs/api.md`.

**`docs/`:** `api.md`, `configuration.md`, `schema.md`, `cleanup.md`. Each adapter is the authoritative source for its own backend's operational detail (DDL, indexes, TTL behavior, IaC notes, `STORE_CONFIG` shape). The parent's `docs/` does not duplicate any of this. See [`complex-module-docs-guide.md`](complex-module-docs-guide.md) for the deep guide.

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

---

## Documentation Status Matrix

Tracks which modules have been restructured per [`module-readme-structure.md`](module-readme-structure.md) (value-first README + `docs/` separation, full writing-guide compliance).

| Module | Class | README v2 | `docs/` present | Writing-guide pass | Notes |
|---|---|---|---|---|---|
| js-helper-utils | A | **Yes** | **Yes** (`api.md`, `configuration.md`) | **Yes** | Wave 5. Class A pilot. Established the four-bullet pattern (zero deps / runs everywhere / pre-tested / designed for review) |
| js-helper-debug | A | **Yes** | **Yes** (`api.md`, `configuration.md`) | **Yes** | Wave 5. Configurable Class A (LOG_LEVEL / LOG_FORMAT / etc.). Documents the canonical `instance.time_ms` pattern |
| js-helper-time | A | **Yes** | **Yes** (`api.md`, `configuration.md`) | **Yes** | Wave 5. 24-function pure-utility surface. Documents the plural-vs-singular Date-Data-Set key convention |
| js-client-helper-crypto | A | **Yes** | **Yes** (`api.md`, `configuration.md`) | **Yes** | Wave 5. Browser-side member of the crypto runtime pair. Hot-Swappable cross-link to `js-server-helper-crypto` |
| js-server-helper-instance | B | **Yes** | **Yes** (`api.md`, `configuration.md`) | **Yes** | Wave 6. Class B pilot. Established the lifecycle/'Behavior' section pattern. Per-request scope, background routines, FIFO cleanup |
| js-server-helper-crypto | B | **Yes** | **Yes** (`api.md`, `configuration.md`) | **Yes** | Wave 6. Server-side member of the crypto runtime pair. Reciprocal Hot-Swappable cross-link to `js-client-helper-crypto` |
| js-server-helper-sql-postgres | C | **Yes (pilot)** | **Yes** (`api.md`, `configuration.md`) | **Yes** | First module migrated under the new rubric. Em-dash sweep applied |
| js-server-helper-sql-mysql | C | **Yes** | **Yes** (`api.md`, `configuration.md`) | **Yes** | Wave 1. Mirrors the Postgres pilot |
| js-server-helper-sql-sqlite | C | **Yes** | **Yes** (`api.md`, `configuration.md`) | **Yes** | Wave 1. Embedded SQL variant (offline, in-process) |
| js-server-helper-nosql-mongodb | C | **Yes** | **Yes** (`api.md`, `configuration.md`) | **Yes** | Wave 2. NoSQL family pilot |
| js-server-helper-nosql-aws-dynamodb | D | **Yes** | **Yes** (`api.md`, `configuration.md`) | **Yes** | Wave 2. Class D cloud database. Calling shape mirrors Class C drivers (`addRecord`, `queryRecords`); classified D because DynamoDB cannot be self-hosted (only AWS or DynamoDB Local emulator) |
| js-server-helper-http | B | **Yes** | **Yes** (`api.md`, `configuration.md`) | **Yes** | Wave 7. Class B (Node built-in `fetch` wrapper). README v2 + docs/ added; corrected error-type names (`NETWORK_REQUEST_FAILED`/`NETWORK_TIMEOUT`/`NETWORK_SETUP_FAILED`) that the previous README misstated as `HTTP_ERROR`/`NETWORK_ERROR`/`REQUEST_ERROR` |
| js-server-helper-storage-aws-s3 | D | **Yes** | **Yes** (`api.md`, `configuration.md`) | **Yes** | Wave 3. First Class D pilot. AWS family pattern |
| js-server-helper-storage-aws-s3-url-signer | D | **Yes** | **Yes** (`api.md`, `configuration.md`) | **Yes** | Wave 5. Class D AWS family. Republished at 1.0.0 |
| js-server-helper-queue-aws-sqs | D | **Yes** | **Yes** (`api.md`, `configuration.md`) | **Yes** | Wave 5. Class D AWS family. Republished at 1.0.0 |
| js-server-helper-auth | E | **Yes** | **Yes** (`api.md`, `configuration.md`, `data-model.md`, `runtime.md`, `push-notifications.md`) | **Yes** | Wave 8. Class E pilot. README condensed from 546 lines to ~115. New `docs/api.md` + `docs/configuration.md` + `docs/runtime.md`. Existing `docs/` files swept of em-dashes. ROBOTS.md rebuilt. Fixed factual bug where `STORE` was documented as a string (`'postgres'`) instead of the required factory function. Added missing `NOT_IMPLEMENTED` error type; corrected `AUTH_*`-prefixed error type names. **Storage adapters moved out of `docs/`**: a short "Storage Adapters" subsection now lives in the README. Per-backend schema, indexes, TTL, and IaC notes belong in each Class F adapter's own README during Wave 9. **Runtime page rewritten lean**: `runtime.md` documents only the differences between persistent-server and serverless-function runtime shapes (how `instance` is constructed; how scheduled cleanup is wired). The previous `runtimes.md` (~590 lines, with bootstrap walk-through, Express middleware, login/refresh/logout endpoints, full Lambda handler, JWT authorizer, cold-start cost matrix, deployment checklist, and NoSQL schema provisioning) was rewritten because framework cookbook material does not belong in module docs |
| js-server-helper-verify | E | **Yes** | **Yes** (`api.md`, `configuration.md`, `data-model.md`, `runtime.md`) | **Yes** | Wave 8. Class E. README condensed from 373 lines to ~100. New `docs/api.md` + `docs/configuration.md` + `docs/runtime.md`. Existing `docs/data-model.md` swept of em-dashes and re-anchored with cross-links to api/configuration/runtime. ROBOTS.md rebuilt to remove embedded backend-schema details and the stale `require('./stores/*')` paths (those packages live as separate Class F adapters at `js-server-helper-verify-store-*`). **`STORE` factory-function pattern reaffirmed** in README, ROBOTS, and `verify.config.js`: the previous config-defaults comment described the post-factory shape as if user-supplied (wrong); now correctly documents `STORE: require(...)` and adds `STORE_CONFIG: null` default for symmetry with logger and auth. **Obsolete docker-compose claims removed** from README (the verify module's `_test/` was already simplified to an in-process memory store; the README still claimed `_test/docker-compose.yml` and shared store suites). **v1.0 migration note removed** (the registry/object distinction is no longer relevant). **Storage adapters moved out of `docs/`**: short "Storage Adapters" subsection in the README replaces the dropped per-backend tables in `data-model.md`. **Runtime page kept lean**: `runtime.md` documents only the post-verify background-delete caveat in serverless and the scheduled cleanup mechanism. Per-backend schema, indexes, TTL, and IaC notes live in each Class F adapter's own README (already present; the `verify-store-*` packages were the first Class F migrations before the Class E migration even began) |
| js-server-helper-logger | E | **Yes** | **Yes** (`api.md`, `configuration.md`, `data-model.md`, `runtime.md`) | **Yes** | Wave 8. Class E. README condensed from 441 lines to ~85. New `docs/api.md` + `docs/configuration.md` + `docs/runtime.md`. Existing `docs/data-model.md` swept of em-dashes and re-anchored with cross-links. ROBOTS.md rebuilt to remove embedded backend-schema details (those belong in adapter packages). **Same `STORE`-is-a-string bug as auth fixed** in README and ROBOTS (was documented as `STORE: 'postgres'`; the loader requires `STORE: require(...)` factory). **Error catalog corrected** in README (previously claimed `STORE_READ_FAILED` / `STORE_WRITE_FAILED`; the actual catalog has one type: `LOGGER_SERVICE_UNAVAILABLE`). **Storage adapters moved out of `docs/`**: short "Storage Adapters" subsection in the README replaces `docs/storage-adapters.md`. **Runtime page kept lean**: `runtime.md` documents only background-write lifecycle in serverless (freeze caveat) and the scheduled cleanup mechanism. Per-backend schema, indexes, TTL, and IaC notes belong in each Class F adapter's own README during Wave 9 |
| js-server-helper-verify-store-* (5) | F | **Yes (v1)** | No (pending) | **Yes** | Wave 0 (predates the Class E parents). Sqlite, postgres, mysql, mongodb, dynamodb. Each ships its own README (~150 lines) with `How This Adapter Fits In`, `Install`, `Usage`, `STORE_CONFIG`, `Schema`, `Store Contract`, `Expired Record Cleanup`, `Environment Variables`, `Peer Dependencies`, `Testing` sections. **Predates the new Class F rubric (`docs/` folder with `api.md`/`configuration.md`/`schema.md`/`cleanup.md`).** Will be re-migrated during Wave 9 cleanup to the new shape established by `auth-store-postgres`. Self-contained `_test/store-contract-suite.js` copies (intentionally not fetched from the verify package at test time) |
| js-server-helper-auth-store-postgres | F | **Yes (pilot)** | **Yes** (`api.md`, `configuration.md`, `schema.md`, `cleanup.md`) | **Yes** | Wave 9. **Class F pilot under the new four-doc rubric.** README condensed from 192 lines to ~70, following the full Universal Section list (Title, Tagline, What This Is, Why Use This Module with 5 bullets including a backend-specific bullet 5 on PostgreSQL semantics, Hot-Swappable listing the 4 sibling adapters, Aligned with Superloom Philosophy, Extended Documentation, Adding to Your Project pointing to the parent's install section, Testing Status table, License); no `## Install` block, no `## Usage` / Quick Start. New `docs/api.md` (store contract, 8 methods with backend-specific semantic notes), `docs/configuration.md` (`STORE_CONFIG`, peer deps, env vars, testing tier), `docs/schema.md` (DDL verbatim + Postgres-specific notes: identifier quoting, BIGINT coercion, native BOOLEAN, JSON encoding of `custom_data`, UPSERT semantics, index strategy), `docs/cleanup.md` (no native TTL; scheduled cleanup mechanism for persistent vs serverless runtimes; `pg_cron` alternative; recommended cadence). ROBOTS.md added with factory protocol, contract table, and ten behaviors-not-to-violate. Rubric updated first (`module-categorization.md`, `module-readme-structure.md`, `complex-module-docs-guide.md`, `documentation-standards.md`) to remove the previous Class F exemption and codify the four-doc shape. **No comparison with sibling adapters anywhere in the package.** Establishes the structural template that the remaining four `auth-store-*`, five `verify-store-*`, and five `logger-store-*` adapters will follow |
| js-server-helper-auth-store-mongodb | F | **Yes** | **Yes** (`api.md`, `configuration.md`, `schema.md`, `cleanup.md`) | **Yes** | Wave 9. NoSQL case under the new four-doc rubric. README condensed from 186 lines to ~70, following the full Universal Section list (bullet 5 calls out the composite `_id` design with token-secret hash baked in so reads are single-lookup with no hash compare path). New `docs/api.md` (store contract with MongoDB-specific semantics: `setupNewStore` returns `NOT_IMPLEMENTED`, composite `_id` lookup for `getSession`, `prefix` equality for `listSessionsByActor`, `replaceOne`+upsert for `setSession` (full-document replace, UPSERT-immutability is the Auth parent's responsibility here, not the adapter's), anchored prefix regex on `_id` for partial-update and delete paths, identity blocklist explicitly includes `_id` and `prefix`), `docs/configuration.md` (`STORE_CONFIG` keys `collection_name` and `lib_mongodb`, peer deps, **env vars corrected: `MONGO_URL`/`MONGO_DATABASE` not the old `MONGODB_URI`/`MONGODB_DATABASE` that the previous README claimed**, port 27018, `directConnection=true` rationale, testing tier), `docs/schema.md` (document shape with adapter-managed `_id` and `prefix` fields, `_id` composition rationale for timing-safe auth, `prefix` denormalization rationale for indexed actor scans, BSON type mapping including timestamps-as-Number choice, **why `setupNewStore` is NOT_IMPLEMENTED for this backend**, operator-provisioned index strategy: default `_id` always present, `prefix` required, `expires_at` recommended, TTL-on-Date-field optional), `docs/cleanup.md` (no native TTL on integer timestamps; default cron path is recommended; Date-field + TTL-index alternative documented with trade-off table). ROBOTS.md added with eleven behaviors-not-to-violate (one more than postgres, the extra being "MongoDB native TTL is not enabled by default"). **README's old false claim that UPSERT immutability is enforced by reading the existing document first was removed**; the new docs accurately describe the `replaceOne` + parent-side invariant pattern |
| js-server-helper-auth-store-sqlite | F | **Yes** | **Yes** (`api.md`, `configuration.md`, `schema.md`, `cleanup.md`) | **Yes** | Wave 9. Embedded / in-process SQL case under the new four-doc rubric. README condensed from 175 lines to ~70, following the full Universal Section list (bullet 5 calls out the embedded-persistence value: in-process, no external service, no Docker, the same adapter powers offline-first apps and `:memory:` test fixtures). New `docs/api.md` (store contract with SQLite-specific semantics: identical to Postgres's shape but on an in-process database), `docs/configuration.md` (`STORE_CONFIG` keys `table_name` and `lib_sql`, peer deps, single env var `SQLITE_FILE` defaulting to `:memory:`, in-process testing tier with no Docker), `docs/schema.md` (DDL verbatim with TEXT/INTEGER affinity instead of VARCHAR/BIGINT/BOOLEAN; SQLite-specific notes: no length enforcement on TEXT, INTEGER-as-Number on read so no driver-boundary coercion needed unlike Postgres's BIGINT-as-string, INTEGER 0/1 boolean encoding, JSON-encoding of `custom_data`, lowercase `excluded` UPSERT pseudo-table, index strategy), `docs/cleanup.md` (no native TTL; in-process cron mechanism, `:memory:` deployments do not need cleanup, WAL-mode concurrency notes, file growth and VACUUM guidance). ROBOTS.md added with eleven behaviors-not-to-violate. **No comparison with sibling adapters anywhere in the package** |
| js-server-helper-auth-store-mysql | F | **Yes** | **Yes** (`api.md`, `configuration.md`, `schema.md`, `cleanup.md`) | **Yes** | Wave 9. MySQL / MariaDB SQL case under the new four-doc rubric. README condensed from 189 lines to ~70, following the full Universal Section list (bullet 5 matches postgres: schema and cleanup built in). New `docs/api.md` (store contract with MySQL-specific semantics: UPSERT uses `ON DUPLICATE KEY UPDATE col = VALUES(col)` not Postgres's `ON CONFLICT ... EXCLUDED`, same 8 methods), `docs/configuration.md` (`STORE_CONFIG` keys `table_name` and `lib_sql`, peer deps, env vars `MYSQL_HOST`/`PORT`/`DATABASE`/`USER`/`PASSWORD` with port 3307 to avoid collision, Docker testing tier), `docs/schema.md` (DDL verbatim with backtick-quoted identifiers, `TINYINT(1)` boolean encoding with defensive driver-normalization, BIGINT handled same as postgres but without driver-string-coercion since `mysql2` returns Number, inlined `INDEX` in `CREATE TABLE` because MySQL lacks `CREATE INDEX IF NOT EXISTS`, `INSERT ... ON DUPLICATE KEY UPDATE` UPSERT semantics), `docs/cleanup.md` (no native TTL; scheduled cleanup via cron or MySQL Event Scheduler alternative, `OPTIMIZE TABLE` note for space reclamation). ROBOTS.md added with twelve behaviors-not-to-violate (includes backtick-quoting and MariaDB wire-compatibility note). **No comparison with sibling adapters anywhere in the package** |
| js-server-helper-auth-store-dynamodb | F | **Yes** | **Yes** (`api.md`, `configuration.md`, `schema.md`, `cleanup.md`) | **Yes** | Wave 9. AWS DynamoDB NoSQL case under the new four-doc rubric. README condensed from 209 lines to ~70, following the full Universal Section list (bullet 5 calls out the native TTL option and Scan-then-batchDelete fallback). **Fixed factual drift in README**: env var is `DYNAMO_ENDPOINT` (not `DYNAMODB_ENDPOINT`), local emulator port is 8001 (not 8000), Sort Key attribute is `session_key` (not `actor_id_token_key`). New `docs/api.md` (store contract with DynamoDB-specific semantics: `setupNewStore` returns `NOT_IMPLEMENTED`, `GetItem`+hash-compare for `getSession`, `Query` with `begins_with` for `listSessionsByActor`, `PutItem` full replace for `setSession`, `UpdateItem` for `updateSessionActivity` with identity blocklist including `session_key`, `DeleteItem`/`BatchWriteItem` for deletes, `Scan`-then-`BatchWriteItem` for cleanup), `docs/configuration.md` (`STORE_CONFIG` keys `table_name` and `lib_dynamodb`, peer deps, **IAM permissions table** with minimum policy JSON, env vars `AWS_REGION`/`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`/`DYNAMO_ENDPOINT`, Docker testing tier with `amazon/dynamodb-local`), `docs/schema.md` (single-table design with PK=`tenant_id`, SK=`session_key` computed as `` `${actor_id}#${token_key}` ``, CloudFormation/CDK example with **corrected `session_key` attribute name**, item shape example with DynamoDB JSON and canonical record, no GSI required, attribute type mapping including native BOOL and Map for `custom_data`), `docs/cleanup.md` (native TTL on `expires_at` as recommended path with 48-hour eventual consistency caveat, Scan-then-batchDelete fallback for immediate consistency, cost implications of Scan on large tables). ROBOTS.md added with eleven behaviors-not-to-violate (includes `session_key` as blocked identity field and chunking delegation note). **No comparison with sibling adapters anywhere in the package** |
| js-server-helper-logger-store-* (5) | F | **Yes** | **Yes** (`api.md`, `configuration.md`, `schema.md`, `cleanup.md`) | **Yes** | Wave 9. Sqlite, postgres, mysql, mongodb, dynamodb - all migrated to the four-doc Class F rubric. Each adapter ships README (~70 lines) + `docs/api.md` + `docs/configuration.md` + `docs/schema.md` + `docs/cleanup.md` + `ROBOTS.md`. Per-adapter detailed rows can be added separately when individual adapter notes are needed |

---

## Migration History

All migration waves are complete. Every module across Classes A through F now ships under the v2 README rubric. The waves are recorded here for context; the per-module notes in the [Documentation Status Matrix](#documentation-status-matrix) above carry the substantive details.

1. **Pilot (Class C SQL):** `js-server-helper-sql-postgres`. Establishes the canonical pattern.
2. **Wave 1 (Class C SQL remainder):** `sql-mysql`, `sql-sqlite`. Server-required and embedded variants.
3. **Wave 2 (Class C NoSQL):** `nosql-mongodb`, `nosql-aws-dynamodb`. NoSQL family + the first Class D credentials pattern.
4. **Wave 3 (Class D cloud storage pilot):** `storage-aws-s3`. First Class D reference, AWS family pattern.
5. **Wave 4 (writing-guide pass):** Full em-dash sweep across all six migrated modules + the rubric, with the writing-guide rules now codified in the rubric so future migrations inherit them by example.
6. **Wave 5 (Class A foundations + Class D AWS family completion):** `js-helper-utils`, `js-helper-debug`, `js-helper-time`, `js-client-helper-crypto`, plus `storage-aws-s3-url-signer` and `queue-aws-sqs`. Established the four-bullet pattern for non-I/O modules and the runtime-pair Hot-Swappable shape. Also rebased every module's `engines.node` and the framework docs from `>=20.19` to `>=24` and renamed README section #8 from "Learn More" to "Extended Documentation".
7. **Wave 6 (Class B extended utility):** `js-server-helper-instance`, `js-server-helper-crypto`. Established the Class B 'Behavior' section pattern (lifecycle semantics, cleanup ordering) and completed the reciprocal Hot-Swappable cross-link with `js-client-helper-crypto`.
8. **Wave 7 (Class B HTTP):** `js-server-helper-http`. Recategorized from Class D - wraps Node's built-in `fetch`; no cloud SDK, no IAM story, so it sits with `instance` and `server-crypto` rather than with the AWS family. Corrected error-type names (`NETWORK_REQUEST_FAILED`/`NETWORK_TIMEOUT`/`NETWORK_SETUP_FAILED`) that the previous README had misstated.
9. **Wave 8 (Class E feature modules):** `verify`, `auth`, `logger`. Highest user-visible impact (READMEs went from 370-550 lines to ~85-115). Storage adapters moved out of `docs/` into a short README subsection. Runtime pages rewritten lean (only persistent vs serverless differences). `STORE`-as-factory-function pattern reaffirmed. Multiple factual corrections in error catalogs and config documentation.
10. **Wave 9 (Class F adapters):** All 15 storage adapters - `auth-store-*` (5), `verify-store-*` (5), `logger-store-*` (5) - migrated to the four-doc rubric (`api.md` + `configuration.md` + `schema.md` + `cleanup.md`) plus `ROBOTS.md`. `auth-store-postgres` set the structural template; the remaining 14 adapters followed it across SQL, embedded SQL, NoSQL, and AWS DynamoDB cases. The `verify-store-*` packages were re-migrated from their v1 single-README shape.

The full backlog (with priority order, scope notes, and any per-module pitfalls already discovered) lives in `__dev__/plans/0008-module-readme-pilot.md` (gitignored - personal workspace).
