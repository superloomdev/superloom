# Complex Module Docs/ Folder Guide

> **Language:** JavaScript

Class E feature modules (`auth`, `verify`, `logger`) and Class F storage adapters (`auth-store-*`, `verify-store-*`, `logger-store-*`) both ship a `docs/` folder. This guide defines the structure and content patterns for both. The two classes share the universal `docs/api.md` + `docs/configuration.md` pair and add different class-specific files on top: Class E adds `data-model.md` and an optional `runtime.md`; Class F adds `schema.md` and `cleanup.md`.

## When to Create a docs/ Folder

Every helper module ships a `docs/` folder. The exception that previously applied to Class F adapters (the README's schema section is enough) was reversed during Wave 9: per-backend operational detail (DDL, indexes, TTL behavior, IaC notes) is dense enough to warrant its own pages, and keeping it out of the README lets the README stay short. The shape of the folder differs by class. See the [class-by-class table](#class-by-class-folder-shape) below.

A `docs/` folder is genuinely deeper for modules with:

- **Multiple storage backends** with different configuration needs (Class E feature modules)
- **A non-trivial data model** with 10+ record fields (Class E feature modules)
- **Framework integrations** that need explicit runtime-shape documentation (Class E feature modules)
- **Backend-specific schema, TTL, and cleanup behavior** that the parent's data model does not cover (Class F storage adapters)
- **Identifier-quoting, type-coercion, and UPSERT semantics** specific to the backend (Class F storage adapters)
- **Advanced configuration** options beyond basic setup (any class)

---

## docs/ Folder Structure

```
module-name/
  README.md                 # Overview, quick start, basic API
  docs/
    _config.yml             # (Optional) If using GitHub Pages
    data-model.md           # Record fields, data types, design rationale
    configuration.md        # Deep config reference
    runtime.md              # Persistent-server vs serverless-function runtime differences
    {feature}-guide.md       # Feature-specific deep dive
```

---

## File Contents

### data-model.md

**Purpose:** Explain every field in the record, why it exists, and how to use it correctly.

**Structure:**

```markdown
# Data Model

## Core Concepts

Define the domain terms:
- **Tenant.** What it is, why it matters, examples
- **Actor.** What it is, actor_type vs actor_id
- **Entity.** For logger-style modules
- **Token/Code/Session.** The thing being stored

## Record Fields

| Field | Type | Set by | Description |
|-------|------|--------|-------------|
| `field_name` | `String` | caller/module | What it is, constraints, example values |

## Field Groups

Group related fields:
- Identity fields (who)
- Timing fields (when)
- Client/device fields (what)
- Custom data guidance

## Design Decisions

Explain why things are the way they are:
- Why this primary key structure?
- Why these field names?
- Why not normalized tables?
```

**Example from auth module:**
- Core concepts: Tenant, Actor, Token key/secret, auth_id format
- Record fields table with 20+ fields
- install_platform/install_form_factor quick reference table
- custom_data convention guide

---

### configuration.md

**Purpose:** Exhaustive configuration reference beyond the quick start.

**Structure:**

```markdown
# Configuration

## Required Configuration

What must be provided, what happens if missing.

## Optional Configuration

Grouped by category:
- Behavior tuning (timeouts, limits)
- Security (encryption keys, JWT options)
- Performance (batch sizes, caching)

## Configuration Examples

### Minimal setup

```javascript
// The bare minimum to work
```

### Production setup

```javascript
// Recommended production config
```

### Multi-instance setup

```javascript
// Multiple instances with different policies
```

## Environment-Specific Configuration

How to handle dev/staging/prod differences.
```

---

### runtime.md

**Purpose:** Document **only** what differs when the module runs in a persistent-server runtime versus a serverless-function runtime. Nothing else.

**What this file is for.** A persistent server (Express, Fastify, Koa, plain Node HTTP, ...) and a serverless function (AWS Lambda, Google Cloud Functions, Azure Functions, ...) construct the per-request `instance` differently and write responses differently. The rest of the module's call shape is identical. `runtime.md` exists to surface those two or three concrete adaptations and nothing more.

**Why "runtime", not "runtimes".** Singular: one document about runtime-shape adaptation, not a per-runtime cookbook. There is no per-framework integration guide on this page (no Express middleware tutorial, no Lambda handler boilerplate, no login/refresh/logout endpoint code). Those belong to the user's application code, not to module docs. The auth module documents its own call shape in [`api.md`](api.md) and its own configuration in [`configuration.md`](configuration.md); the user wires those into whatever framework they like.

**What does NOT go here:**

- Bootstrap walk-throughs (covered by `configuration.md`).
- Auth-module function call sites (covered by `api.md`).
- Express middleware, login/refresh/logout endpoint code, active-devices UI examples (framework-specific application code, not module documentation).
- Cold-start cost figures or RDS Proxy / connection-pool guidance (those depend on the storage adapter; covered in each Class F adapter's README).
- Schema provisioning (covered in each Class F adapter's README).
- Error-type → HTTP status mapping (covered by `api.md`).

**Structure:**

```markdown
# Runtime

One-paragraph intro: the auth module is runtime-agnostic at the call-site; the per-request `instance` is constructed differently in each runtime shape and that is what this page documents.

## Persistent Server

Two or three lines of code showing how a long-lived framework's request/response objects get bound to `instance.http_request` / `instance.http_response`. One short paragraph explaining that the framework streams the response normally.

## Serverless Function

Two short code blocks: (1) adapt the platform's event into `instance.http_request` (lowercase header map + cookies array), (2) buffer writes into `instance.http_response` and include the buffered cookies/headers in the returned response object. One callout: the container exits when the handler returns; cookies missing from the response are silently dropped. Mention building `Lib` at module scope so it survives warm invocations.

## Scheduled Cleanup

One short paragraph: whether `cleanupExpiredSessions` needs scheduling depends on the storage adapter (cross-link to the adapter's README). The call shape is identical in both runtimes; only the scheduling mechanism differs (cron library inside the process vs scheduled function invocation outside it).
```

A realistic `runtime.md` is **80–120 lines**. Anything longer almost certainly contains framework cookbook material that should be deleted or moved.

---

## Class F Adapters: Their Own `docs/` Folder

Class F storage adapters (`auth-store-*`, `verify-store-*`, `logger-store-*`) ship their own `docs/` folder with four files: `api.md`, `configuration.md`, `schema.md`, `cleanup.md`. The README itself follows the **same Universal Section list as every other class** (see [`module-readme-structure.md` → Universal README Sections](module-readme-structure.md#universal-readme-sections)), with each section condensed. A realistic Class F README is **~70-90 lines** (comparable to a Class C driver). The README does NOT include a `## Install` block (Section 9 points to the parent's install instructions instead) and does NOT include a `## Usage` or Quick Start. The schema, the contract, the configuration table, the environment variables, and the testing-runtime detail all live in `docs/`, never in the README.

### docs/api.md (Class F)

**Purpose:** Document the store contract this adapter implements. The contract is identical across all sibling adapters of the same parent (all `auth-store-*` packages implement the same eight methods), but each adapter documents its own version because the semantics around the contract can differ per backend (timing-safe lookups, batch deletes, programmer-error guards, integer coercion at the driver boundary).

**Structure:**

```markdown
# API

One-paragraph intro: this adapter is loaded by the parent module via the factory protocol; the parent calls these methods to satisfy its persistence requirements.

## Adapter Factory

Factory call signature, what `Lib`, `CONFIG`, and `ERRORS` are, what the factory returns.

## Store Contract

Method-by-method reference. One subsection per method:

### setupNewStore(instance)
Signature, what it creates, idempotency guarantee, return shape.

### getRecord / getSession / etc.
Signature, parameter table, return shape, backend-specific semantics (e.g. timing-safe hash compare on a wrong secret returns null instead of an error).

### setRecord / setSession / etc.
Signature, return shape, UPSERT semantics for this backend.

[... one subsection per method, in the order the contract defines them ...]
```

### docs/configuration.md (Class F)

**Purpose:** Document `STORE_CONFIG`, peer dependencies, environment variables consumed by `_test/loader.js`, and the testing tier.

**Structure:**

```markdown
# Configuration

## Loader Pattern

How the parent calls into this adapter. The factory protocol.

## STORE_CONFIG Keys

| Key | Type | Required | Description |
|---|---|---|---|
| `table_name` | String | Yes | What the table or collection is named |
| `lib_sql` | Object | Yes | Initialized driver helper instance |
| [other keys specific to this adapter, e.g. `aws_region` for DynamoDB] |

## Peer Dependencies

The driver helper this adapter expects (`Lib.Postgres`, `Lib.Mongo`, etc.).

## Environment Variables

Consumed by `_test/loader.js` only. One row per variable, with the docker-compose default.

## Testing Tier

Docker lifecycle (if service-dependent), the contract suite, what runs in CI.
```

### docs/schema.md (Class F)

**Purpose:** Document what `setupNewStore` creates and the backend-specific syntax notes that matter when reading or modifying the adapter.

**Structure:**

```markdown
# Schema

## What setupNewStore Creates

The DDL or `createIndex` / `CreateTable` calls verbatim. For SQL backends, the `CREATE TABLE` and `CREATE INDEX` statements. For MongoDB, the `createIndex` calls and any TTL-index parameters. For DynamoDB, the `CreateTableCommand` shape.

## Backend-Specific Notes

Identifier quoting (Postgres `"col"`, MySQL `` `col` ``, MongoDB N/A).

Integer coercion (BIGINT-as-string from the `pg` driver, NumberLong vs Long for Mongo, Number for DynamoDB).

UPSERT semantics (`INSERT ... ON CONFLICT ... DO UPDATE` for Postgres, `INSERT ... ON DUPLICATE KEY UPDATE` for MySQL, `INSERT OR REPLACE` for SQLite, `replaceOne` with `upsert: true` for MongoDB, `PutItem` for DynamoDB).

JSON serialization (which columns are encoded, which are passed through native).

Native TTL configuration (only present on backends that support it).
```

### docs/cleanup.md (Class F)

**Purpose:** Document the TTL behavior of this specific backend and the recommended cleanup mechanism. This is what is most distinctive per adapter and most actionable for an operator deciding how to provision.

**Structure:**

```markdown
# Cleanup

One short paragraph stating the TTL story for this backend: native, none, or partial.

## TTL Behavior

For SQL: "Backend has no native TTL."
For MongoDB: "Native TTL via `expireAfterSeconds: 0` on the `_ttl` index. Sweep cadence is approximately 60 seconds; expired records may remain readable for up to that long."
For DynamoDB: "Native AWS table-level TTL on `expires_at`. Sweep cadence is up to 48 hours after expiry; the operator must enable TTL explicitly via the AWS console or IaC."

## Recommended Cleanup Mechanism

For backends with no native TTL: scheduled invocation of `cleanupExpired*`. Recommended cadence. Pointers to the parent's `docs/runtime.md` for the persistent-server vs serverless-function scheduling shape.

For backends with native TTL: still recommend a scheduled `cleanupExpired*` as a defence-in-depth, with reduced cadence.

## How cleanupExpired* Is Implemented

Which query the function uses (`DELETE FROM … WHERE expires_at < ?` for SQL, `deleteMany({ expires_at: { $lt: now } })` for Mongo, scan + batch-delete for DynamoDB without GSI). Which index it uses.
```

A realistic Class F `docs/` folder is **~300-400 lines total** (api.md ~100, configuration.md ~70, schema.md ~90, cleanup.md ~40). Each file is small and focused.

---

### Storage Adapters. Documented in each Class F adapter package, not in the parent's `docs/`

**No `docs/storage-adapters.md` file.** Class E parent modules ship a short **Storage Adapters** subsection inside the README (between Architecture Overview and Aligned-with-Superloom-Philosophy), not a separate documentation page. The subsection contains:

- A short list or table of available adapters with the backend each one wraps.
- A one- or two-sentence selection rule (typically: match your application's database).
- A pointer to each adapter package for backend-specific details. Each adapter's `docs/` folder has `api.md`, `configuration.md`, `schema.md`, `cleanup.md`.

**Why no separate doc?** Each Class F adapter is a standalone package with its own README and its own `docs/` folder. Duplicating the per-backend operational detail in the Class E parent's `docs/` folder created two sources of truth: the parent might say one thing about index requirements while the adapter package said another. The framework's principle is one canonical source per concern. The adapter package is the authoritative source for that backend; the parent's README only points to the list.

**README subsection template** (the only documentation the parent owns about adapters):

```markdown
## Storage Adapters

N storage adapters are available, each a separate package. Install only the one you need.

| Adapter | Backend |
|---|---|
| `@superloomdev/{module}-store-sqlite` | SQLite (embedded, in-process) |
| `@superloomdev/{module}-store-postgres` | PostgreSQL |
| `@superloomdev/{module}-store-mysql` | MySQL or MariaDB |
| `@superloomdev/{module}-store-mongodb` | MongoDB |
| `@superloomdev/{module}-store-dynamodb` | AWS DynamoDB |

**Pick the one that matches your application's database.** A Postgres-backed app uses `{module}-store-postgres`, a MongoDB app uses `{module}-store-mongodb`, and so on. The {module}'s calling shape is identical across all five backends, so the choice is operational, not application-code.

A legitimate deviation is using a NoSQL adapter in a SQL-backed application when the {module}'s data has different scaling characteristics from the rest of the app. Mixing SQL families (Postgres app with MySQL adapter) is not a useful pattern.

Each adapter package ships its own `docs/` folder with the backend-specific schema, indexes, TTL behavior, IaC provisioning notes, and `STORE_CONFIG` shape.
```

---

## Writing Style for docs/

Same human-first approach as READMEs:

1. **Lead with the use case.** "You need this when..."
2. **Progressive examples.** Start simple, add complexity.
3. **Explain the why.** "We use composite keys because..."
4. **Cross-link liberally.** Inside each module's `docs/` write things like `` See [configuration](configuration.md) for details. `` so readers can hop between files.
5. **Tables for reference.** Quick lookup tables for common scenarios.

---

## Linking from README

The README should reference docs/ files in the "Further reading" section:

```markdown
## What It Does

{Module description}

**Further reading:**
- [`docs/data-model.md`](docs/data-model.md). Record fields and design rationale
- [`docs/runtime.md`](docs/runtime.md). Persistent-server vs serverless-function runtime differences

For backend-specific configuration, schema, indexes, and TTL behavior, see each adapter package's `docs/` folder (`@superloomdev/{module}-store-*`).
```

---

## Review Checklist for docs/

### Class E parent modules

- [ ] Every record field is documented in `docs/data-model.md`
- [ ] Design decisions explained (not just what, but why)
- [ ] Code examples are runnable
- [ ] `docs/runtime.md` covers **only** the differences between persistent-server and serverless-function runtime shapes. No framework cookbook material (Express middleware, login endpoint code), no cold-start cost numbers, no schema provisioning
- [ ] No per-backend operational detail in the parent's `docs/`. Schema, indexes, TTL, IaC provisioning live in each Class F adapter's `docs/`, not in the parent
- [ ] Cross-links work (relative paths)
- [ ] No duplication with README (README = overview, docs/ = depth)

### Class F storage adapters

- [ ] `docs/api.md` documents the full store contract (one subsection per method) with backend-specific semantics noted where they differ
- [ ] `docs/configuration.md` documents every `STORE_CONFIG` key, peer dependency, environment variable, and the testing tier
- [ ] `docs/schema.md` contains the verbatim DDL or createIndex / CreateTable calls and backend-specific syntax notes
- [ ] `docs/cleanup.md` states the TTL behavior of this backend and the recommended cleanup mechanism
- [ ] No `docs/data-model.md` (the parent owns the data model; document only mapping divergences in `docs/schema.md`)
- [ ] No `docs/runtime.md` (cross-link to the parent's `docs/runtime.md` from `docs/cleanup.md` instead)
- [ ] No comparison with sibling adapters anywhere in the package
- [ ] README follows the full Universal Section list (Title, Tagline, What This Is, Why Use This Module, Hot-Swappable, Aligned with Superloom Philosophy, Extended Documentation, Adding to Your Project, Testing Status, License) condensed to ~70-90 lines
- [ ] No `## Install` block in the README. Section 9 ("Adding to Your Project") points to the parent module's install instructions and the loader-pattern doc
- [ ] No `## Usage` or Quick Start in the README
