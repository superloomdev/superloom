# Module README Structure

How every helper module documents itself. Each module ships three files: `README.md`, `docs/*.md`, and `ROBOTS.md`. Each one targets a distinct reader and serves a distinct purpose. This page defines what goes where, in what order, and why.

## On This Page

- [The Three-Tier Model](#the-three-tier-model)
- [Audiences and Personas](#audiences-and-personas)
- [Universal README Sections](#universal-readme-sections)
- [Class-Specific Sections](#class-specific-sections)
- [`docs/` Folder Pattern by Class](#docs-folder-pattern-by-class)
- [Class-Specific Templates and Reusable Wording](#class-specific-templates-and-reusable-wording)
- [Cross-Cutting Patterns](#cross-cutting-patterns)
- [Link Form](#link-form)
- [Section Order and Why It Matters](#section-order-and-why-it-matters)
- [Readability Test Passes](#readability-test-passes)
- [Writing Style and Prose Quality](#writing-style-and-prose-quality)
- [Anti-Patterns to Avoid](#anti-patterns-to-avoid)
- [Authoring Checklist](#authoring-checklist)
- [Further Reading](#further-reading)

---

## The Three-Tier Model

Each module's documentation is split across three files. Each file has one audience and one job. They do not duplicate each other.

| File | Audience | Tone | Length budget |
|---|---|---|---|
| `README.md` | Non-technical evaluator, developer evaluating, developer integrating (first read) | Plain language, value-first | ~150 lines |
| `docs/*.md` | Developer integrating (deep), maintainer, code reviewer | Reference-grade, exhaustive | No fixed limit |
| `ROBOTS.md` | AI assistant generating or reviewing code | Compact, dense, machine-friendly | ~100-150 lines |

**The README is the entry point.** It explains *what the module is and why it exists* in plain language. It links into `docs/` for reference detail and to `ROBOTS.md` for AI-specific guidance. It does not contain configuration tables, function signatures, or return shapes. Those belong in `docs/`.

**The `docs/` folder is the reference layer.** Complete, exhaustive, written for someone actively integrating or maintaining the module. Adapter modules and simple foundation modules usually skip this folder; driver and feature modules need it.

**`ROBOTS.md` is the AI surface.** Compact, structured, every exported function with its signature and return shape. See `ROBOTS.md` in each module for the existing convention.

---

## Audiences and Personas

Five personas guide README authoring. Run a readability pass against each one before publishing.

| # | Persona | Reads | Looking for |
|---|---|---|---|
| 1 | **Manager / decision-maker** | README only | Identity, value, social proof, philosophy frame |
| 2 | **Developer evaluating** | README + skims `docs/` | What it does, what it does NOT do, how it differs from raw `pg`/`mysql2`/etc. |
| 3 | **Developer integrating** | README quick-start, then `docs/api.md` + `docs/configuration.md` | Install, minimal example, full API |
| 4 | **Code reviewer / auditor** | README "Why use this" + scans source | Confidence the wrapper is well-built, predictable, well-tested |
| 5 | **AI assistant** (Cascade, Cursor, Copilot) | `ROBOTS.md` first, README only on user request | Exact signatures, return shapes, gotchas, config keys |

**The single most important rule:** persona 1 (manager) must be able to read the README top-to-bottom and finish with a clear, accurate understanding of what the module is and why it exists. Without ever seeing a configuration table or function signature.

---

## Universal README Sections

Every module README follows this section order, regardless of class. Two sections are class-conditional and slot in between the Why bullets and the Aligned-with-Superloom paragraph; everything else is universal.

| # | Section | Purpose |
|---|---|---|
| 1 | **Title + Identity Badges** | Visual identity. License + runtime version only. The CI / test status badges are NOT here. They belong with the testing block at the bottom. |
| 2 | **Tagline** | One sentence; plain English; ends with "Part of [Superloom](https://superloom.dev)". Do NOT mention sibling backends or competitor modules in the tagline. See [Anti-Patterns](#anti-patterns-to-avoid). |
| 3 | **What this is** | 1-2 short paragraphs in plain English explaining the module's role. May include a tiny vertically-spaced illustration of the module's response shape. Never a full code example. |
| 4 | **Why use this module** | Value bullets (5-7 points) - the core marketing pitch. Jargon-free, vendor-neutral. Each bullet is one sentence + at most one supporting sentence. |
| 5 | **Hot-Swappable with Other Backends** *(class-conditional)* | Bullet list of sibling modules with the same API. Present for any module with at least one sibling (Class C drivers, some Class D cloud wrappers, some Class E feature modules). |
| 6 | **Class-Specific Section** *(class-conditional)* | One section per [Class-Specific Sections](#class-specific-sections) (e.g. "Architecture overview" for Class E feature modules). |
| 7 | **Aligned with Superloom Philosophy** | One short paragraph explaining that the module follows Superloom conventions, so adopting it preserves consistency for projects already on Superloom. |
| 8 | **Learn More** | Links to extended documentation in `docs/` and to Superloom. Does NOT link to `ROBOTS.md`. That file is for AI assistants, not human readers. |
| 9 | **Adding to Your Project** | Recommends installation as a peer dependency through the project's loader pattern. Does NOT include a copy-paste `npm install` snippet. Links to the loader-pattern doc instead. |
| 10 | **Testing Status** | Status table showing which test tiers have passed (Emulated / Integration). Test runtime details (Docker lifecycle, env vars) live in `docs/configuration.md` under "Testing Tiers", not here. |
| 11 | **License** | MIT |

### Section 4. Why Use This Module

This is the heart of the README. The bullets articulate the value of the wrapper pattern in concrete, persona-friendly language. Most modules can adapt these recurring themes. But adapt the **wording** to the module class and audience:

| Theme | Framing example |
|---|---|
| **Insulation** | "When the underlying driver ships a breaking change, only this module needs updating. Your application code stays exactly as it is." |
| **Pre-tested** | "A full test suite runs against a real instance in CI on every push. Your project trusts the wrapper instead of re-verifying plumbing on each release." |
| **Reviewability** | Frame around what a reviewer can SEE: clearly-marked visual sections, short functions, comments as checkpoints, scannable top-to-bottom flow. Do NOT use the word "metaprogramming". Invite the reader to open the source to verify. |
| **Observability** | Frame around capabilities (timing, slow-query review, toggle for prod vs dev). Do NOT name the specific functions or config keys. Those go in `docs/`. |
| **Deployment flexibility** | "Works on both serverless and persistent infrastructure". Use industry-neutral category names. Vendor names (Lambda, EC2, Kubernetes) only as illustrative examples in parentheses, never as headline categories. |

Pick the five-to-seven themes that apply to the module's class. The principle behind these bullets lives in [`architectural-philosophy.md`](architectural-philosophy.md#coding-practices) - "All external libraries wrapped".

### Section 5. Hot-Swappable with Other Backends *(class-conditional)*

A short paragraph followed by a bullet list of sibling modules. Each bullet links to the sibling on GitHub. Drives home that switching backends is a one-line loader change. Belongs in its own section so adding a new sibling is a single-line edit, not a hunt across the whole README.

### Section 7. Aligned with Superloom Philosophy

One short paragraph. Frames Superloom alignment as **consistency for projects that already use Superloom**, not as a "why use this wrapper" benefit. The framing is: "if your project is built on Superloom conventions, this module slots in without you needing to learn anything new."

This deliberately is NOT one of the Why bullets. See [Anti-Patterns](#anti-patterns-to-avoid).

### Section 8. Learn More

A short list pointing to:

- `docs/api.md` (if present) - full API reference
- `docs/configuration.md` (if present) - all config keys, environment variables, patterns
- `docs/data-model.md` / `docs/storage-adapters.md` (Class E only)
- [Superloom](https://superloom.dev) - the framework

Do NOT link to `ROBOTS.md` from the README. `ROBOTS.md` is the AI surface; humans should not be directed there.

### Section 9. Adding to Your Project

Frame the integration as **package peer-dependency through the loader pattern**, not as a `npm install <pkg>` command. Recommend the published package; warn against vendoring or local file dependencies. Link to:

- [Server Loader Architecture](https://github.com/superloomdev/superloom/blob/main/docs/architecture/server-loader.md) - the loader pattern doc on GitHub
- [npmrc setup](https://github.com/superloomdev/superloom/blob/main/docs/dev/npmrc-setup.md) - one-time GitHub Packages registry setup

### Section 10. Testing Status

A status table showing which tiers have passed:

| Tier | Runtime | Status |
|---|---|---|
| Emulated | (e.g. Postgres 17 in Docker) | CI badge |
| Integration | (e.g. real PostgreSQL 15+) | Status badge |

Detailed test instructions (Docker lifecycle, env vars, integration setup) live in `docs/configuration.md` under "Testing Tiers", not in the README.

---

## Class-Specific Sections

Every module belongs to one of six classes (enumerated in [`module-categorization.md`](module-categorization.md)). Each class can add one section between sections 4 (Why bullets) and 7 (Aligned with Superloom). The class-specific section sits at position 6 in the section order.

| Class | Section name | Contents |
|---|---|---|
| **A. Foundation utility** | "API Categories" | Grouped overview of available functions, one line each. No signatures. |
| **C. Driver wrapper** | (none extra) | The Hot-Swappable section at position 5 already serves Class C's special case. |
| **D. Cloud service wrapper** | "Credentials & Permissions" | Short section on credentials, regional config, IAM/permissions. Vendor-neutral wording. |
| **B. Extended utility** | "Behavior" | Explains lifecycle semantics (cleanup ordering, background tasks). |
| **E. Feature module with adapters** | "Architecture Overview" | High-level diagram or tree. Storage-adapter selection callout linking to `docs/storage-adapters.md`. |
| **F. Storage adapter** | "How This Fits Into the Parent Module" | Adapter factory protocol explanation. Link to parent module's docs. |

The Hot-Swappable section at position 5 is itself class-conditional. It appears whenever a module has at least one sibling, irrespective of class.

---

## `docs/` Folder Pattern by Class

The `docs/` folder is where the dense technical material lives. Different classes need different depths.

| Class | Recommended `docs/` files |
|---|---|
| **A. Foundation** | None. The README is enough |
| **C. Driver** | `docs/api.md`, `docs/configuration.md` |
| **D. Cloud service** | `docs/api.md`, `docs/configuration.md`, optionally `docs/iam.md` |
| **B. Lifecycle** | Usually none; `docs/api.md` only if the lifecycle is non-trivial |
| **E. Feature** | `docs/data-model.md`, `docs/configuration.md`, `docs/storage-adapters.md`, optionally `docs/integration-express.md`, `docs/integration-lambda.md` |
| **F. Adapter** | None. The README and the schema section inside it are enough |

For the long-form structure of feature-module `docs/` folders see [`complex-module-docs-guide.md`](complex-module-docs-guide.md).

### `docs/api.md`

Full function reference. One subsection per function with:

- Signature
- Parameter table (name, type, required, description)
- Return shape (success and error envelopes)
- Examples
- Semantics, gotchas, library-specific notes

The intro of `docs/api.md` cross-references `docs/configuration.md` (the user often needs both). It does NOT cross-reference `ROBOTS.md`. That file is for AI agents and lives in a separate flow.

### `docs/configuration.md`

Every config key the loader accepts. Every environment variable consumed by `_test/loader.js`. Peer dependencies. Multi-instance patterns. Pool tuning guidance. SSL configuration for managed services.

**Internal ordering rule:** the page splits into two halves:

| Half | Sections |
|---|---|
| **Reference** (top) | Loader Pattern → Configuration Keys → Environment Variables → Peer Dependencies → Direct Dependencies |
| **Patterns and Examples** (bottom) | Multi-instance / Multi-DB Setup → SSL / TLS Configuration → Pool / Resource Tuning → Testing Tiers |

The reference half answers "what can I set?". The patterns half answers "how do I combine those settings for X scenario?". An example needs the reader to have absorbed the keys first, so examples never sit between the keys.

The `Configuration Keys` table includes a **Required** column. Use "Yes (override)" for keys whose default exists but is never useful in production (`HOST`, `DATABASE`, `USER`, `PASSWORD`); "No" for everything else.

---

## Class-Specific Templates and Reusable Wording

Concrete starting points per class so two modules in the same class look like near-twins. Validated across Class C (SQL + NoSQL drivers) and Class D (cloud DB + cloud storage). Class A / D / E / F sub-sections are placeholders until those migration waves run. Fill them in as the first pilot for each class lands.

**Principle:** *structural choices are universal, wording is class-specific, source-specific tweaks come last.* When migrating a new module, copy the closest pilot's README and adjust only the parts called out as class-specific in this section.

### Universal "Why Use This Module" Bullets

Four of the five value bullets transfer near-verbatim across Class C + Class D. Only **bullet 5** is class-specific. Use these four as a copy-paste starting point:

**Bullet 1. Insulation:**

> **Library updates won't break your code.** When the underlying [driver | SDK] ships a breaking change, only this module needs updating. Your application code stays exactly as it is.

**Bullet 2. Pre-tested:**

> **Pre-tested at every release.** A full test suite runs against [a real PostgreSQL instance | MongoDB single-node replica set | DynamoDB Local in Docker | MinIO | ...] in CI on every push. Your project trusts the wrapper instead of re-verifying [SQL | NoSQL | object-storage | ...] plumbing on each release.

**Bullet 3. Designed for human review:**

> **Designed for human review.** The code is laid out as clearly-marked visual sections (section banners, short functions, scoped comments) so a reviewer can read it top to bottom in order, use the section breaks as checkpoints to mark how far they have got, and finish without ever getting lost in dense logic. This matters most when an AI assistant is generating the change and a human still has to sign off on it. Open the module's source file (e.g. `postgres.js`, `mysql.js`, `s3.js`) to see the structure.

**Bullet 4. Built-in observability:**

> **Built-in observability.** Every operation can be timed against the active request and routed into your structured logs automatically. [Slow-query | slow-upload | slow-call] review, request profiling, and the toggle to enable it during local development or silence it in production are all built in. No instrumentation code to write.

**Bullet 5. Class-specific.** See per-class subsections below.

These four bullets do not apply unchanged to Class A foundation modules (which often have no wrapped third-party library to insulate against). Class B extended-utility modules also need different framing. See the relevant subsection.

### Class A. Foundation Utility

Platform-agnostic utilities with no service dependencies and no `docs/` folder.

**Tagline template:**

> A [domain] helper for [Node.js | the browser | both] that ships pre-tested and has zero runtime dependencies. Part of [Superloom](https://superloom.dev).

**Value bullets.** The four universal bullets transfer **with adjustments**:
- **Bullet 1 (insulation):** keep if the module wraps a built-in (e.g. `node:crypto`); drop or rephrase as "Zero dependencies, drop in anywhere" if pure JavaScript
- **Bullet 2 (pre-tested):** keep, with appropriate test target ("comprehensive unit suite in CI on every push")
- **Bullets 3, 4:** keep verbatim
- **Bullet 5:** "Zero dependencies, drop in anywhere" (pure JavaScript with no external packages, works in Node, browsers, edge runtimes) anywhere the right module system runs

**Class-specific section. "API Categories":** a grouped one-line listing of available function categories. NOT a full signature table. Example shape:

> - **Type checks:** `isString`, `isNumber`, `isArray`, `isObject`, …
> - **Validation:** `isEmail`, `isPhoneNumber`, …
> - **Data manipulation:** `pick`, `omit`, `merge`, …

**No `docs/` folder needed.** No Hot-Swappable section (foundation modules typically don't have functional siblings. The `js-helper-crypto` server/client pair is the exception and should cross-link in Hot-Swappable form).

**Pilot status:** *not yet migrated.* The first Class A migration sets the concrete reference. Planned in [plan 0008](../../__dev__/plans/0008-module-readme-pilot.md).

### Class B. Extended Utility

Per-request or per-process plumbing rather than data I/O (e.g. `js-server-helper-instance`).

**Class-specific section. "Behavior":** short, central. Explains the lifecycle semantics. Cleanup ordering, background tasks, scope boundaries.

**Value bullets.** Class B modules often need a substantially different bullet set because they don't wrap a third-party library and don't do I/O. Bullets 3 (human review) and 4 (observability) usually still transfer. The first migration of a Class B module sets the pattern.

**Pilot status:** *not yet migrated.* `js-server-helper-instance` is the planned reference.

### Class C. Driver Wrapper

**Tagline template. Server-required driver** (Postgres, MySQL, MongoDB):

> A [DB Name] helper for Node.js that insulates your application from driver changes and ships pre-tested, so your project never has to re-verify [SQL | NoSQL] connectivity. Part of [Superloom](https://superloom.dev).

**Tagline template. Embedded / in-process driver** (SQLite):

> A [DB Name] helper for Node.js that runs in-process with zero external infrastructure and ships pre-tested, so your project never has to re-verify [SQL | NoSQL] connectivity. Part of [Superloom](https://superloom.dev).

**Bullet 5 variants:**

| Variant | Bullet 5 wording |
|---|---|
| **SQL driver. Server-required** | "Works on both serverless and persistent infrastructure. The same module configures cleanly for serverless deployments (cloud functions, on-demand workers) and persistent ones (containers, virtual machines, orchestrated platforms). Switch deployment shape by changing one config value, not by changing the driver or the calling code." |
| **SQL driver. Embedded** | "Runs in-process, with zero infrastructure. [DB] is embedded. There is no server to provision, no credentials to manage, no network to debug. The same module powers an in-memory test database, a local file-backed cache, an offline-first desktop or edge app, or a per-process analytics store. Switch between in-memory and on-disk by changing one config value." |
| **NoSQL driver. Managed** | Either the universal serverless-or-persistent framing, **or** a domain-specific safety-net bullet ("Built-in safety nets against accidental full-collection writes. `query()`, `count()`, and `deleteRecordsByFilter()` reject empty filters at runtime. There is no path by which an empty or `null` filter can accidentally read or wipe an entire collection."). Pick whichever is the stronger pitch for the module. |
| **NoSQL driver. Cloud-managed** (DynamoDB) | The Class D "Explicit credentials" bullet. See Class D below. Cloud-managed NoSQL drivers inherit the Class D credentials treatment. |

**Hot-Swappable section template** (replace the placeholders in `[...]` with concrete values):

```text
## Hot-Swappable with Other Backends

This module is part of a [SQL or NoSQL] family of database helpers that share the same calling shape. Switch by changing the loader line. The rest of your code keeps working.

- [`@superloomdev/[sibling-1-package-name]`]([full GitHub URL]) - [one-line description]
- [`@superloomdev/[sibling-2-package-name]`]([full GitHub URL]) - [one-line description]
```

**Do NOT add a closing paragraph pointing to "the other family" (NoSQL→SQL or SQL→NoSQL).** The cross-family pointer was tried in the first wave of v2 migrations and dropped after review. It added noise without serving any persona, and the Learn More section + the Superloom site already give cross-discovery. Keep the Hot-Swappable section focused on direct siblings only.

**`docs/api.md` structure. SQL driver variant:**

- Conventions
- Placeholders
- `insert_id` Semantics
- Read Helpers (`getRow`, `getRows`, `getValue`, `get`)
- Write Helper (`write`)
- Manual Transactions (`getClient`, `releaseClient`)
- Query Builders (`buildQuery`, `buildRawText`, `buildMultiCondition`)
- Lifecycle (`close`)

**`docs/api.md` structure. NoSQL driver variant:**

- Conventions
- Safety Nets *(if the module rejects unsafe inputs)*
- Single-Record CRUD (`getRecord`, `writeRecord`, `updateRecord`, `deleteRecord`)
- Query / Count / Scan
- Batch Operations
- Transactions
- Indexes *(if applicable)*
- Lifecycle (`close`)

**`docs/configuration.md` structure. SQL driver (server-required):**

Reference block:
- Loader Pattern
- Configuration Keys (with `Required` column)
- Environment Variables
- Peer Dependencies (Injected)
- Direct Dependencies (Bundled)

Patterns block:
- Multi-Database Setup
- SSL Configuration
- Connection Pool Tuning
- Testing Tiers

**`docs/configuration.md` structure. SQL driver (embedded, e.g. SQLite):**

Reference block: same.

Patterns block: drop SSL Configuration and Connection Pool Tuning. Add **In-Memory vs On-Disk** and **Journal Mode and Concurrency** before Testing Tiers.

**`docs/configuration.md` structure. NoSQL driver (managed, e.g. MongoDB):**

Reference block: same.

Patterns block: replace SSL + Pool Tuning with the domain-specific concerns (e.g. **Replica-Set Requirement for Transactions** for MongoDB).

**Pilot references** (copy from one of these when migrating a new Class C module):
- SQL driver: `src/helper-modules-server/js-server-helper-sql-mysql/` (most generic SQL shape)
- SQL driver. Embedded: `src/helper-modules-server/js-server-helper-sql-sqlite/`
- NoSQL driver: `src/helper-modules-server/js-server-helper-nosql-mongodb/`
- NoSQL driver. Cloud-managed: `src/helper-modules-server/js-server-helper-nosql-aws-dynamodb/` (also follows Class D credentials pattern)

### Class D. Cloud Service Wrapper

**Tagline template:**

> A [Service Name] helper for Node.js that insulates your application from SDK changes and ships pre-tested, so your project never has to re-verify [domain] connectivity. Part of [Superloom](https://superloom.dev).

**Bullet 5. Explicit credentials** *(reusable across every AWS-family or other-cloud wrapper):*

> **Explicit credentials, not implicit ones.** Credentials are passed through the loader, not picked up from an ambient SDK environment chain. This makes it impossible to accidentally talk to the wrong account from a developer machine, a CI runner, or a multi-tenant deployment. *(Optional second sentence. Add when an emulator exists:)* Local emulator runs the same way as real [service] - only the `ENDPOINT` config changes.

**Hot-Swappable section.** Only when there's a real same-API sibling. S3 ↔ URL-signer is NOT a Hot-Swap (different surfaces). DynamoDB ↔ MongoDB IS a Hot-Swap (NoSQL family). When in doubt, omit and surface the related module in Learn More instead.

**`docs/api.md` structure. Three-Layer pattern** (recommended for SDK-wrapped CRUD; works whenever the SDK exposes Command objects, including AWS SDK v3):

- Conventions
- Three-Layer Pattern *(Builder → Executor → Convenience)*
- Command Builders *(pure, no I/O)*
- Command Executors *(async I/O)*
- Domain operations *(convenience layer: single-record CRUD, file ops, etc.)*
- Lifecycle *(if applicable. Many SDK-managed clients don't need `close()`)*

**`docs/configuration.md` structure. AWS-flavour cloud wrapper:**

Reference block: same as Class C.

Patterns block:
- **Credentials and IAM Permissions** *(required for any Class D wrapper around a cloud SDK)*
- **Local Emulator vs Real Service** *(only if an emulator exists)*
- **Multi-Region / Multi-Account Setup**
- Testing Tiers

**Required content of the "Credentials and IAM Permissions" section:**

1. Statement of explicit-credentials policy (no fallback to the SDK's ambient provider chain)
2. **Minimum IAM permissions table.** One row per exported function, listing the cloud-specific actions it uses
3. Resource ARN format example
4. **Worked example minimal IAM policy** (JSON)
5. Brief note about credential rotation behaviour. The module does not refresh in-flight; pass refreshed values on a new loader call

**Pilot references:**
- AWS cloud DB: `src/helper-modules-server/js-server-helper-nosql-aws-dynamodb/`
- AWS cloud storage: `src/helper-modules-server/js-server-helper-storage-aws-s3/`

### Class E. Feature Module with Adapters

Business logic + pluggable storage. Each Class E module already has a `docs/` folder from the framework's earlier era; the migration audits and reorganises rather than rebuilds.

**Class-specific section. "Architecture Overview":** high-level diagram or tree. Includes a callout pointing to `docs/storage-adapters.md` for storage adapter selection.

**`docs/` folder shape** per [`complex-module-docs-guide.md`](complex-module-docs-guide.md):
- `docs/data-model.md`. Record fields and design rationale
- `docs/configuration.md`. Config keys, env vars, patterns
- `docs/storage-adapters.md`. Adapter selection guide
- `docs/integration-express.md`. Express integration *(optional)*
- `docs/integration-lambda.md`. Lambda integration *(optional)*

**Pilot status:** *not yet migrated.* `verify`, `logger`, `auth` are the planned waves (smallest to largest).

### Class F. Storage Adapter

Implements a parent module's store contract. Thin.

**Class-specific section. "How This Fits Into the Parent Module":** explains the adapter factory protocol. Links to the parent's `docs/storage-adapters.md`.

**No `docs/` folder.** README should be small (60–80 lines), with the data schema inline if it's brief.

**Pilot status:** *not yet migrated.* `auth-store-dynamodb` and `auth-store-mongodb` are the planned waves.

---

## Cross-Cutting Patterns

These patterns span multiple classes and modules. When working on a new module, check whether any apply.

### AWS Family Pattern (DynamoDB, S3, SQS, and any future AWS service wrapper)

All AWS-service wrappers share:

- **Value bullet 5.** The "Explicit credentials, not implicit ones" wording (no fallback to ambient SDK provider chain).
- **`docs/configuration.md` "Credentials and IAM Permissions" section.** Minimum-IAM-action table per function, resource ARN format, and a worked example IAM policy in JSON.
- **`docs/configuration.md` "Local Emulator vs Real Service" section.** Only if an emulator exists (DynamoDB Local, MinIO, LocalStack, ElasticMQ).
- **`docs/configuration.md` "Multi-Region / Multi-Account Setup" section.** Same boilerplate; only the config keys differ.
- **Configuration keys.** `REGION`, `KEY`, `SECRET`, `ENDPOINT`, `MAX_RETRIES` are universal across AWS modules; add service-specific extras (e.g. `FORCE_PATH_STYLE` for S3-compatible stores).
- **Environment variable convention.** `AWS_*` for cross-service shared values (`AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`), service-specific prefixes for overrides (`DYNAMODB_ENDPOINT`, `S3_ENDPOINT`, etc.).
- **Cross-link in Learn More.** Every AWS module should reference at least one sibling AWS module in its Learn More section when there's a logical companion (S3 ↔ S3 URL signer, etc.).

When adding a new AWS-service wrapper, copy the closest existing AWS module's `docs/configuration.md` and edit the service-specific bits; the structural sections transfer near-verbatim.

### Hot-Swap Families

Modules that share an API shape should reference each other in their Hot-Swappable sections. Current and planned families:

| Family | Members | Status |
|---|---|---|
| **SQL drivers** | `sql-postgres` ↔ `sql-mysql` ↔ `sql-sqlite` | All three migrated |
| **NoSQL drivers** | `nosql-mongodb` ↔ `nosql-aws-dynamodb` | Both migrated. Disclaimer in each: overlap is API-shape, not feature-parity |
| **Auth storage adapters** | `auth-store-dynamodb` ↔ `auth-store-mongodb` | Pending |
| **Crypto** | `js-server-helper-crypto` ↔ `js-client-helper-crypto` | Pending. Different runtimes (Node vs Web Crypto), same conceptual surface |

**Adding a new sibling to a family** triggers a small chore: every existing sibling's README must add a bullet to its Hot-Swappable section. This is an explicit checklist item.

### "Required (override)" Pattern in Configuration Tables

Configuration keys that have technically-valid defaults but practically must be overridden in every deployment should be marked `Yes (override)` in the `Required` column. Examples:
- DB drivers: `HOST`, `DATABASE`, `USER`, `PASSWORD`
- AWS wrappers: `REGION` (when default is `us-east-1`), `KEY`, `SECRET`

A brief sentence after the Configuration Keys table explains the semantic:

> "Required (override)" means the default exists but is unlikely to match a real deployment. Practically every project must override it.

### Response Envelope Illustration in "What This Is"

Every module's "What This Is" section includes a small vertically-spaced illustration of the response shape:

````markdown
Every read and every write returns the same envelope:

```
success / data / error
```

Error handling, result reading, and exception expectations are the same in every place you touch the [database | storage | service]. There are no surprises between functions, and operational failures never throw.
````

This sets the response-shape expectation before the reader hits the API details.

### Lazy Initialization Note

Most Class C and Class D modules lazy-initialize their underlying client (pool, SDK client, file handle) on the **first call**, not at loader time. This belongs in `docs/configuration.md` under "Loader Pattern" as a bullet:

> The [pool | client | handle] is **not** created at loader time. It is created lazily on the first call. This keeps cold-start fast in serverless deployments.

### `close()` / Lifecycle Convention

Class C and Class D modules that hold connection state expose a `close()` function (or `close(instance)` for some MongoDB-style modules) documented under "Lifecycle" in `docs/api.md`. The README does not need to mention `close()`. That's a `docs/api.md` concern.

For SDK-managed connections where there's no pool to close (e.g. AWS SDK clients), omit `close()` from the API entirely rather than implementing a no-op.

---

## Link Form

**README.md ships to npm and is rendered on the package page.** npm does not resolve relative paths. Therefore:

- **Every link in `README.md` must be a fully-qualified GitHub URL** (`https://github.com/superloomdev/superloom/blob/main/...` for files, `.../tree/main/...` for directories). Relative paths (`docs/api.md`, `../foo`) silently break on the npm page.
- Links inside `docs/*.md` may be relative or full GitHub URLs. Full GitHub URLs are still preferred for cross-references, because docs files may be opened in standalone viewers (GitHub raw, search results) where relative resolution is brittle.
- Use `blob/main/...` for files, `tree/main/...` for directories.

---

## Section Order and Why It Matters

The universal section order serves four reading paths simultaneously:

| Reader path | Sections read | Outcome |
|---|---|---|
| **Manager skim** (60 seconds) | 1 → 2 → 3 → 4 → stop | Understands identity and value; can decide whether to dig deeper |
| **Developer evaluating** (5 minutes) | 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → stop | Knows what it does, what it does NOT do, what's swappable, where to go next |
| **Developer integrating** (15+ minutes) | 1 → 8 → 9 → `docs/api.md` → `docs/configuration.md` | Skips marketing, jumps to install / loader / API |
| **Code reviewer** | 4 → source | Confirms the wrapper claims and verifies them in `postgres.js` |

The "Why use this module" section at position 4 (before any code, before installation, before configuration) is the single biggest structural choice. It serves the manager/evaluator before they bounce.

"Adding to Your Project" at position 9 (just before testing status) is intentional. An npm package's job is to be installed via `package.json`, not via copy-paste. The readers who need to install it want a pointer to the loader pattern, not a `npm install` line that bypasses the project's existing peer-dependency conventions.

---

## Readability Test Passes

Before publishing a README, run two passes:

### Pass 1. Layman pass (Persona 1)

Read the README top-to-bottom with a non-technical hat on. After each section, ask:

- Did I understand what this section said in plain language?
- Did anything assume technical knowledge I would not have?
- By the end of section 4, do I know what the module is and why someone would use it?

If the answer to either of the first two is "no", revise. If the answer to the third is "no" by the end of section 4, the Why bullets need work.

### Pass 2. Integrator pass (Persona 3)

Read the README looking at sections 8 (Learn More) and 9 (Adding to Your Project). Ask:

- Do I know which extended docs to read for the API and the configuration?
- Do I know how to add this module to my project as a peer dependency?
- Did I have to copy-paste a shell command, or did the README direct me to the loader pattern?

If any answer is "no" or you copy-pasted a shell command, sections 8 / 9 need work.

---

## Writing Style and Prose Quality

The full prose-style guide lives in [`documentation-standards.md`](../dev/documentation-standards.md). The spelling and prose-quality table lives in [`code-formatting-js.md`](code-formatting-js.md#spelling-and-prose-quality). Every module `README.md`, every `docs/*.md` file, and every `ROBOTS.md` follows those rules. The list below is a fast reference for the rules most often violated when authoring new module docs. It is not a replacement for the writing guide.

### No Em Dashes Anywhere

The project does not use em dashes (the `—` character, U+2014) in any file: `.js`, `.md`, `package.json`, `ROBOTS.md`, or commit messages. Em dashes read as AI-generated prose. Use one of the patterns below instead.

| Where the em dash appeared | Use this instead |
|---|---|
| Sentence aside, like `X — Y` | Split into two sentences: `X. Y.` Use a comma if the aside is short, or parentheses for a true parenthetical. |
| Bullet item with bold lead, like `- **Term** — explanation` | Format as `- **Term.** Explanation sentence.` Bold the term, end it with a period, then write a complete sentence. |
| Bullet item with link lead, like `- [link](url) — description` | Use a hyphen separator: `- [link](url) - description`. The hyphen-with-spaces form is the canonical compound separator. |
| Compound modifier, like `per — request` | Use a hyphen: `per-request`, `transport-agnostic`, `hand-written`. |
| Two em dashes mid-sentence, like `X — Y — Z` | Use parentheses: `X (Y) Z`. Or split into separate sentences. |
| List separator inside running prose | Restructure. Two ideas joined by an em dash usually become two sentences without losing anything. |

The same rule applies to ASCII double-hyphen (`--`) used as a stand-in for an em dash. Do not write `X -- Y`. Split, comma, or parenthesise.

### Table Cells Do Not End With Periods

Table cells are not sentences. Do not end them with a period unless the cell contains multiple sentences and the last one is a complete sentence in its own right.

### Sentence Length

Aim for 30 words or fewer per sentence. If a sentence grows past 30 words, split at the conjunction (`and`, `but`, `because`, `so`). Long sentences are harder to scan and harder for AI agents to parse unambiguously.

### AI-Sounding Phrases

The full ban-list lives in [`documentation-standards.md`](../dev/documentation-standards.md#human-writing-style). The most-violated entries while authoring module docs are: `facilitate`, `leverage`, `utilize`, `comprehensive`, `robust`, `streamline`, `it is worth noting`, `this ensures that`, `in order to`. Every one of these has a shorter plain replacement.

### American English

All project text uses American English (`-ize` not `-ise`, `-or` not `-our`, `license` not `licence`). The full table lives in [`documentation-standards.md`](../dev/documentation-standards.md#language-and-spelling).

---

## Anti-Patterns to Avoid

These were the failure modes surfaced when the rubric was first applied to the Postgres pilot. Codified here so future migrations skip them.

- **Sibling-backend mention in the tagline.** "Same API across Postgres, MySQL, SQLite" in the tagline reads as "this module does all three" to a non-technical evaluator. Hot-swap goes in its own section (position 5), not in the headline.
- **Vendor lock-in language.** Cloud product names (AWS Lambda, EC2, RDS) at category headings make the module read as AWS-only. Use industry-neutral category names ("serverless", "persistent infrastructure", "auto-scaling managed databases") with vendor names only as illustrative examples in parentheses.
- **Jargon in marketing prose.** Words like *metaprogramming*, *idempotent*, *cargo cult* mean nothing to persona 1 and are pretentious to persona 4. Replace with concrete observable claims ("clearly-marked visual sections you can scan top to bottom").
- **Function names as marketing.** Listing `getRow / getRows / getValue / write / buildQuery` in a Why bullet is tone-deaf to persona 1. Function listings live in `docs/api.md` and `ROBOTS.md`. The Why bullet talks about capability, not surface.
- **"Part of Superloom" as a Why bullet.** Belonging to a framework is not a benefit; consistency with a project's existing philosophy is. Frame as alignment ("if your project uses Superloom conventions, this slots in") in its own section, not as a value bullet.
- **Quick Start in the README.** Pilot showed Quick Start adds noise without serving any persona well. The layman skips it, the integrator wants real examples in `docs/api.md`. Drop it. If a class genuinely needs an example block, it goes in `docs/api.md`.
- **"What this module is NOT" section.** Pilot showed boundary clarity is better served by precise wording in "What this is" than by a separate negative-list section. Drop it.
- **"Installation" with `npm install` snippet.** Wrong framing for a module published as a peer dependency. The reader who would copy-paste an install command is the wrong reader; the right reader follows the loader pattern. Replace with peer-dependency / loader pointer.
- **Test instructions in the README.** Test runtime detail (Docker lifecycle, env vars) is reference material; it lives in `docs/configuration.md`. README has only the testing **status** at the bottom.
- **Relative links in the README.** npm strips relative paths. Always use full `https://github.com/superloomdev/superloom/blob/main/...` URLs in `README.md`.
- **CI / test status badges at the top of the README.** They distract from identity. Identity badges (license, runtime) at top; test status badges in the testing-status block at the bottom.
- **Cross-family "see the other family" closing paragraph in Hot-Swappable.** Tried in the first v2 wave and dropped after review. It adds noise without serving any persona. The Learn More section and the Superloom site already provide cross-discovery. Keep the Hot-Swappable section focused on direct siblings only.
- **Em dashes (`—`) anywhere in the module docs.** Tell-tale sign of AI-generated prose. Use the patterns in [Writing Style and Prose Quality](#writing-style-and-prose-quality). Source of truth: [`documentation-standards.md`](../dev/documentation-standards.md).
- **Table cells ending with a period.** Cells are not sentences. Ending them with a period reads as machine-generated.

---

## Authoring Checklist

When writing or revising a module README:

- [ ] Section order matches [Universal README Sections](#universal-readme-sections)
- [ ] Class-conditional sections (Hot-Swappable, class-specific) are present where applicable
- [ ] Value bullets at section 4 use plain language. No jargon ([Anti-Patterns](#anti-patterns-to-avoid))
- [ ] No vendor product names as category headings (Lambda, EC2, RDS, etc.) - only as illustrative examples
- [ ] No function names in marketing prose. They live in `docs/api.md` / `ROBOTS.md`
- [ ] Sibling backends (if any) are listed in the Hot-Swappable section, not in the tagline or Why bullets
- [ ] "Aligned with Superloom" sits in its own section, not in the Why bullets
- [ ] No `npm install` snippet. Section 9 points to the loader pattern instead
- [ ] No detailed test instructions. Section 10 shows status only; details live in `docs/configuration.md`
- [ ] Test status badges sit in the testing block at the bottom; only license + runtime badges sit at the top
- [ ] Every link in the README is a full `https://github.com/...` URL (no relative paths)
- [ ] No configuration tables in the README. They live in `docs/configuration.md`
- [ ] No function signature tables in the README. They live in `docs/api.md`
- [ ] No `ROBOTS.md` link in the README's Learn More. `ROBOTS.md` is for AI agents, not human readers
- [ ] `ROBOTS.md` is current and matches the actual exported surface
- [ ] `docs/configuration.md` reference block (Loader, Keys, Env Vars, Deps) precedes its patterns block (Multi-instance, SSL, Pool tuning, Testing)
- [ ] Tagline ends with "Part of [Superloom](https://superloom.dev)". No sibling backends or competitor modules mentioned in the tagline itself
- [ ] **Universal value bullets 1–4** used near-verbatim from [Class-Specific Templates → Universal Bullets](#universal-why-use-this-module-bullets); only bullet 5 is class-specific
- [ ] **License section** at bottom is present and names the license explicitly (typically `## License\n\nMIT`)
- [ ] **Identity badges** use the standard `img.shields.io/badge/...` URL pattern; runtime version badge reflects the actual `engines.node` value from `package.json`
- [ ] **Testing Status table** at bottom uses the standard `Tier \| Runtime \| Status` columns
- [ ] **For Class D cloud wrappers:** `docs/configuration.md` includes a "Credentials and IAM Permissions" section with a minimum-IAM-action table per function and a worked example IAM policy (see [Cross-Cutting Patterns → AWS Family](#aws-family-pattern-dynamodb-s3-sqs-and-any-future-aws-service-wrapper))
- [ ] **For modules in a Hot-Swap family:** every existing sibling's README has been updated to reference this module in its Hot-Swappable section (see [Cross-Cutting Patterns → Hot-Swap Families](#hot-swap-families))
- [ ] **No em dashes (`—`)** in `README.md`, `docs/*.md`, `ROBOTS.md`, or any commit message that ships with the migration (see [Writing Style and Prose Quality](#writing-style-and-prose-quality))
- [ ] **No table cells end with a period** (cells are not sentences)
- [ ] **No AI-sounding phrases** (`facilitate`, `leverage`, `utilize`, `comprehensive`, `robust`, `streamline`, `in order to`, `this ensures that`)
- [ ] **Sentences are 30 words or fewer** wherever possible (split at conjunctions when they grow longer)
- [ ] **American English** spelling throughout (`initialize`, `behavior`, `optimization`, `license`)
- [ ] Passes the Layman pass (Persona 1)
- [ ] Passes the Integrator pass (Persona 3)

---

## Further Reading

- [`documentation-standards.md`](../dev/documentation-standards.md) is the canonical writing guide. It defines the human-first prose style, the em-dash ban, the AI-sounding-phrase ban-list, the table-cell-period rule, and the spelling and sentence-length rules that every module README and `docs/*.md` file follows.
- [`code-formatting-js.md`](code-formatting-js.md#spelling-and-prose-quality) holds the spelling and prose-quality table that applies to every file the project ships, including `.js` comments, `.md` docs, `package.json`, `ROBOTS.md`, and commit messages.
- [`module-categorization.md`](module-categorization.md) lists the six module classes and which class each existing module belongs to.
- [`complex-module-docs-guide.md`](complex-module-docs-guide.md) is the deep guide for `docs/` folders in Class E feature modules.
- [`templates/`](templates/) - historical README skeletons from the v1 era (`README-foundation-module.md`, `README-master-template.md`, `README-feature-module.md`, `README-storage-adapter.md`). **Currently out of date.** These do NOT match the v2 patterns documented above. Until they are refreshed (or deleted), the authoritative templates are the migrated pilots in `src/helper-modules-server/`: `js-server-helper-sql-mysql/` for Class C SQL (server-required), `js-server-helper-sql-sqlite/` for Class C SQL (embedded), `js-server-helper-nosql-mongodb/` for Class C NoSQL, `js-server-helper-nosql-aws-dynamodb/` for Class C/C cloud-managed NoSQL, `js-server-helper-storage-aws-s3/` for Class D cloud storage. See [Class-Specific Templates and Reusable Wording](#class-specific-templates-and-reusable-wording) for which pilot to copy per class.
- [`architectural-philosophy.md`](architectural-philosophy.md#coding-practices) - the "All external libraries wrapped" principle that the value bullets articulate
