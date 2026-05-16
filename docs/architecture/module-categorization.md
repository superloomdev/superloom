# Module Categorization

Every Superloom helper module belongs to one of six classes. The class determines the README structure, which `docs/` files (if any) accompany it, and which template to start from. For the full documentation rubric (universal sections, class-specific sections, personas, ordering, prose style), see [`module-readme-structure.md`](module-readme-structure.md).

This page is the enumeration: which module belongs to which class, and the current documentation status of each.

## On This Page

- [The Six Classes](#the-six-classes)
- [Class A — Foundation Utility](#class-a--foundation-utility)
- [Class B — Driver Wrapper](#class-b--driver-wrapper)
- [Class C — Cloud Service Wrapper](#class-c--cloud-service-wrapper)
- [Class D — Lifecycle Helper](#class-d--lifecycle-helper)
- [Class E — Feature Module with Adapters](#class-e--feature-module-with-adapters)
- [Class F — Storage Adapter](#class-f--storage-adapter)
- [Documentation Status Matrix](#documentation-status-matrix)
- [Migration Priority](#migration-priority)

---

## The Six Classes

| Class | Distinguishing trait | Template | `docs/` folder |
|---|---|---|---|
| **A. Foundation utility** | Zero runtime deps; pure functions; platform-agnostic | `README-foundation-module.md` | Usually none |
| **B. Driver wrapper** | Wraps a third-party DB driver; presents a unified API | `README-master-template.md` (driver variant) | `api.md`, `configuration.md` |
| **C. Cloud service wrapper** | Wraps a cloud / network SDK | `README-master-template.md` (cloud variant) | `api.md`, `configuration.md`, optional `iam.md` |
| **D. Lifecycle helper** | Server-side utility / per-request plumbing | `README-master-template.md` | Usually none; small `api.md` if non-trivial |
| **E. Feature module with adapters** | Business logic + pluggable storage backends | `README-feature-module.md` | `data-model.md`, `storage-adapters.md`, integrations |
| **F. Storage adapter** | Implements a parent module's store contract; thin | `README-storage-adapter.md` | None (schema sits inside the README) |

---

## Class A — Foundation Utility

**Characteristics:** Zero runtime dependencies, pure utility functions, platform-agnostic. Live under `src/helper-modules-core/` and `src/helper-modules-client/`.

**README extras** (on top of the universal set): "API Categories" — a grouped overview of available functions, one line each.

| Module | Package | Purpose |
|---|---|---|
| `js-helper-utils` | `@superloomdev/js-helper-utils` | Type checks, validation, sanitization, data manipulation |
| `js-helper-debug` | `@superloomdev/js-helper-debug` | Structured logging with levels (debug, info, warn, error) |
| `js-helper-time` | `@superloomdev/js-helper-time` | Date/time math, timezone handling, formatting |
| `js-client-helper-crypto` | `@superloomdev/js-client-helper-crypto` | UUID, random strings, base64 (browser; Web Crypto API) |

---

## Class B — Driver Wrapper

**Characteristics:** Wraps a third-party database driver. Presents a unified API (`getRow`, `getRows`, `getValue`, `write`, etc.) so calling code is identical across backends. Insulates the application from upstream driver churn.

**README extras:** "Common Patterns" — 2-3 progressive examples (read, write, transaction); brief callout about cross-backend API compatibility.

**`docs/`:** `api.md`, `configuration.md`.

| Module | Package | Underlying driver |
|---|---|---|
| `js-server-helper-sql-sqlite` | `@superloomdev/js-server-helper-sql-sqlite` | Node.js built-in `node:sqlite` |
| `js-server-helper-sql-postgres` | `@superloomdev/js-server-helper-sql-postgres` | `pg` (node-postgres) |
| `js-server-helper-sql-mysql` | `@superloomdev/js-server-helper-sql-mysql` | `mysql2` |
| `js-server-helper-nosql-mongodb` | `@superloomdev/js-server-helper-nosql-mongodb` | `mongodb` (native driver) |
| `js-server-helper-nosql-aws-dynamodb` | `@superloomdev/js-server-helper-nosql-aws-dynamodb` | `@aws-sdk/client-dynamodb` |

---

## Class C — Cloud Service Wrapper

**Characteristics:** Wraps a cloud SDK or network library. Similar README shape to Class B, but the surface is service-domain (storage, queue, HTTP) rather than data.

**README extras:** "Credentials & IAM" — short section on credentials, IAM permissions, regional config.

**`docs/`:** `api.md`, `configuration.md`, optionally `iam.md`.

| Module | Package | Service |
|---|---|---|
| `js-server-helper-http` | `@superloomdev/js-server-helper-http` | Native `fetch` wrapper (outgoing HTTP, multipart) |
| `js-server-helper-storage-aws-s3` | `@superloomdev/js-server-helper-storage-aws-s3` | S3 file operations |
| `js-server-helper-storage-aws-s3-url-signer` | `@superloomdev/js-server-helper-storage-aws-s3-url-signer` | S3 presigned URLs |
| `js-server-helper-queue-aws-sqs` | `@superloomdev/js-server-helper-queue-aws-sqs` | SQS message queue |

---

## Class D — Lifecycle Helper

**Characteristics:** Provides server-side utility plumbing rather than data I/O. Either manages per-request lifecycle (`instance`) or exposes operational utilities used during requests (`crypto`).

**README extras:** "Behavior" — explains the lifecycle semantics (cleanup ordering, background tasks) or the categorized utility surface.

**`docs/`:** Usually none. Small `api.md` only if the surface is non-trivial.

| Module | Package | Purpose |
|---|---|---|
| `js-server-helper-instance` | `@superloomdev/js-server-helper-instance` | Per-request instance lifecycle, cleanup hooks, background tasks |
| `js-server-helper-crypto` | `@superloomdev/js-server-helper-crypto` | Hashing, encryption, UUID, random strings, base conversion |

---

## Class E — Feature Module with Adapters

**Characteristics:** Self-contained business-logic module. Pluggable storage backends via the adapter pattern. Deep data model. Needs a `docs/` folder.

**README extras:** "Architecture overview" — high-level diagram or tree; "Storage adapter selection" — short callout linking to `docs/storage-adapters.md`.

**`docs/`:** `data-model.md`, `configuration.md`, `storage-adapters.md`, optionally `integration-express.md`, `integration-lambda.md`. See [`complex-module-docs-guide.md`](complex-module-docs-guide.md) for the deep guide.

| Module | Package | Purpose |
|---|---|---|
| `js-server-helper-auth` | `@superloomdev/js-server-helper-auth` | Session lifecycle and authentication; optional JWT mode with refresh-token rotation |
| `js-server-helper-verify` | `@superloomdev/js-server-helper-verify` | One-time verification codes (pin, code, token) |
| `js-server-helper-logger` | `@superloomdev/js-server-helper-logger` | Compliance-friendly action log with per-row retention and optional IP encryption |

---

## Class F — Storage Adapter

**Characteristics:** Implements a parent module's store contract. Thin wrapper around a Class B or Class C module. One adapter per backend per parent feature.

**README extras:** "How this fits into the parent module" — explains the adapter factory protocol; links to the parent module's docs.

**`docs/`:** None — the README plus the schema section it contains is enough.

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
| js-helper-utils | A | No | n/a | No | Pre-rubric README. Review during Class A migration |
| js-helper-debug | A | No | n/a | No | Pre-rubric README. Review during Class A migration |
| js-helper-time | A | No | n/a | No | Pre-rubric README. Review during Class A migration |
| js-client-helper-crypto | A | No | n/a | No | Pre-rubric README. Review during Class A migration |
| js-server-helper-sql-postgres | B | **Yes (pilot)** | **Yes** (`api.md`, `configuration.md`) | **Yes** | First module migrated under the new rubric. Em-dash sweep applied |
| js-server-helper-sql-mysql | B | **Yes** | **Yes** (`api.md`, `configuration.md`) | **Yes** | Wave 1. Mirrors the Postgres pilot |
| js-server-helper-sql-sqlite | B | **Yes** | **Yes** (`api.md`, `configuration.md`) | **Yes** | Wave 1. Embedded SQL variant (offline, in-process) |
| js-server-helper-nosql-mongodb | B | **Yes** | **Yes** (`api.md`, `configuration.md`) | **Yes** | Wave 2. NoSQL family pilot |
| js-server-helper-nosql-aws-dynamodb | B/C | **Yes** | **Yes** (`api.md`, `configuration.md`) | **Yes** | Wave 2. Cloud-managed NoSQL. Inherits Class C credentials pattern |
| js-server-helper-http | C | No | No | No | Pending Class C wave |
| js-server-helper-storage-aws-s3 | C | **Yes** | **Yes** (`api.md`, `configuration.md`) | **Yes** | Wave 3. First Class C reference. AWS family pattern |
| js-server-helper-storage-aws-s3-url-signer | C | No | No | No | Pending Class C wave |
| js-server-helper-queue-aws-sqs | C | No | No | No | Pending Class C wave |
| js-server-helper-instance | D | No | No | No | Pending Class D wave |
| js-server-helper-crypto | D | No | No | No | Pending Class D wave |
| js-server-helper-auth | E | No | Yes | No | README currently 546 lines. Strong restructure candidate |
| js-server-helper-verify | E | No | Yes | No | README currently 372 lines. Strong restructure candidate |
| js-server-helper-logger | E | No | Yes | No | README currently 440 lines. Strong restructure candidate |
| js-server-helper-*-store-* (15) | F | No | n/a | No | Migrate after Class B/E land |

---

## Migration Priority

1. **Done. Pilot (Class B SQL):** `js-server-helper-sql-postgres`. Establishes the canonical pattern.
2. **Done. Wave 1 (Class B SQL remainder):** `sql-mysql`, `sql-sqlite`. Server-required and embedded variants.
3. **Done. Wave 2 (Class B NoSQL):** `nosql-mongodb`, `nosql-aws-dynamodb`. NoSQL family + the first Class C credentials pattern.
4. **Done. Wave 3 (Class C cloud storage pilot):** `storage-aws-s3`. First Class C reference, AWS family pattern.
5. **Done. Wave 4 (writing-guide pass):** Full em-dash sweep across all six migrated modules + the rubric, with the writing-guide rules now codified in the rubric so future migrations inherit them by example.
6. **Next. Class E feature modules:** `auth`, `verify`, `logger`. Highest user-visible impact (current READMEs are 370-550 lines). The existing `docs/` folders mean less new content. Mostly pruning the README and reframing the value bullets.
7. **Then. Class C remainder:** `http`, `storage-aws-s3-url-signer`, `queue-aws-sqs`. Smaller surface per module than Class E.
8. **Then. Class D and Class A:** lifecycle (`instance`, `crypto`) and foundation (`utils`, `debug`, `time`, `client-crypto`). Smallest surface; sets the reference for non-driver modules.
9. **Last. Class F adapters:** 15 modules, all mechanical once the parent feature modules land.

The full backlog (with priority order, scope notes, and any per-module pitfalls already discovered) lives in [`__dev__/plans/0008-module-readme-pilot.md`](../../__dev__/plans/0008-module-readme-pilot.md).
