# Module Categorization Analysis

This document maps every Superloom module to its category for documentation purposes. Use this to determine which README template to apply.

---

## Category 1: Core Foundation Modules

**Characteristics:** Zero runtime dependencies, pure utility functions, platform-agnostic.

**Template:** `README-foundation-module.md`

| Module | Package | Purpose | Template Applied |
|--------|---------|---------|------------------|
| js-helper-utils | `@superloomdev/js-helper-utils` | Type checks, validation, sanitization | Yes |
| js-helper-debug | `@superloomdev/js-helper-debug` | Structured logging with levels | Yes |
| js-helper-time | `@superloomdev/js-helper-time` | Date/time math, timezone handling | Needs review |
| js-client-helper-crypto | `@superloomdev/js-client-helper-crypto` | UUID, random strings, base64 (browser) | Needs creation |

**Documentation Style:**
- Simple function-focused
- List what it does, show examples
- Minimal configuration
- Badge: "Foundation module"

---

## Category 2: Service/Helper Modules

**Characteristics:** Single service purpose, factory pattern, depends on foundation modules.

**Template:** `README-master-template.md` (standard)

| Module | Package | Purpose | Template Applied |
|--------|---------|---------|------------------|
| js-server-helper-crypto | `@superloomdev/js-server-helper-crypto` | Hashing, encryption, UUID | Yes |
| js-server-helper-instance | `@superloomdev/js-server-helper-instance` | Request lifecycle, cleanup | Yes |
| js-server-helper-http | `@superloomdev/js-server-helper-http` | HTTP client wrapper | Needs review |

**Documentation Style:**
- Clear purpose statement
- Factory pattern explanation
- API table with returns column
- Badge: Service-specific tag

---

## Category 3: Database Driver Modules

**Characteristics:** Database driver wrapper, connection management, query building.

**Template:** `README-master-template.md` (driver-specific variant)

| Module | Package | Purpose | Notes |
|--------|---------|---------|-------|
| js-server-helper-sql-sqlite | `@superloomdev/js-server-helper-sql-sqlite` | SQLite via node:sqlite | Needs badge update |
| js-server-helper-sql-postgres | `@superloomdev/js-server-helper-sql-postgres` | PostgreSQL driver | Needs consistency pass |
| js-server-helper-sql-mysql | `@superloomdev/js-server-helper-sql-mysql` | MySQL driver | Needs consistency pass |
| js-server-helper-nosql-mongodb | `@superloomdev/js-server-helper-nosql-mongodb` | MongoDB native driver | Needs consistency pass |
| js-server-helper-nosql-aws-dynamodb | `@superloomdev/js-server-helper-nosql-aws-dynamodb` | DynamoDB wrapper | Needs consistency pass |

**Documentation Style:**
- Connection setup prominently
- Placeholder syntax (`?` / `??`)
- Query examples with all helper types (getRow, getRows, write)
- Badge: "Offline module" (SQLite) or "Service-dependent" (others)

---

## Category 4: Feature Modules with Storage Adapters

**Characteristics:** Complex business logic, multiple storage options, multi-tenancy, deep data model.

**Template:** `README-feature-module.md` + `docs/` folder

| Module | Package | Purpose | docs/ Needed |
|--------|---------|---------|--------------|
| js-server-helper-auth | `@superloomdev/js-server-helper-auth` | Session lifecycle | Yes - exists |
| js-server-helper-verify | `@superloomdev/js-server-helper-verify` | Verification codes | Yes - exists |
| js-server-helper-logger | `@superloomdev/js-server-helper-logger` | Action logging | Yes - needs creation |

**Documentation Style:**
- Architecture overview first
- Storage adapter comparison table
- Data model deep dive in docs/
- Framework integration guides
- Badge: Complex module tag

### docs/ Folder Contents

**auth module:**
- `docs/integration-express.md` — Express middleware patterns
- `docs/integration-lambda.md` — Lambda + JWT authorizer
- `docs/push-notifications.md` — Push token contract

**verify module:**
- (Currently has no docs/ folder — evaluate if needed)

**logger module:**
- `docs/data-model.md` — Record fields, retention policies
- `docs/integration-express.md` — IP capture setup
- `docs/storage-adapters.md` — Backend selection guide

---

## Category 5: Storage Adapter Modules

**Characteristics:** Implements store contract, thin wrapper, used with parent feature module.

**Template:** `README-storage-adapter.md`

### Auth Store Adapters

| Module | Package | Backend | Parent |
|--------|---------|---------|--------|
| js-server-helper-auth-store-sqlite | `@superloomdev/...auth-store-sqlite` | SQLite | auth |
| js-server-helper-auth-store-postgres | `@superloomdev/...auth-store-postgres` | PostgreSQL | auth |
| js-server-helper-auth-store-mysql | `@superloomdev/...auth-store-mysql` | MySQL | auth |
| js-server-helper-auth-store-mongodb | `@superloomdev/...auth-store-mongodb` | MongoDB | auth |
| js-server-helper-auth-store-dynamodb | `@superloomdev/...auth-store-dynamodb` | DynamoDB | auth |

### Verify Store Adapters

| Module | Package | Backend | Parent |
|--------|---------|---------|--------|
| js-server-helper-verify-store-sqlite | `@superloomdev/...verify-store-sqlite` | SQLite | verify |
| js-server-helper-verify-store-postgres | `@superloomdev/...verify-store-postgres` | PostgreSQL | verify |
| js-server-helper-verify-store-mysql | `@superloomdev/...verify-store-mysql` | MySQL | verify |
| js-server-helper-verify-store-mongodb | `@superloomdev/...verify-store-mongodb` | MongoDB | verify |
| js-server-helper-verify-store-dynamodb | `@superloomdev/...verify-store-dynamodb` | DynamoDB | verify |

### Logger Store Adapters (New)

| Module | Package | Backend | Parent |
|--------|---------|---------|--------|
| js-server-helper-logger-store-sqlite | `@superloomdev/...logger-store-sqlite` | SQLite | logger |
| js-server-helper-logger-store-postgres | `@superloomdev/...logger-store-postgres` | PostgreSQL | logger |
| js-server-helper-logger-store-mysql | `@superloomdev/...logger-store-mysql` | MySQL | logger |
| js-server-helper-logger-store-mongodb | `@superloomdev/...logger-store-mongodb` | MongoDB | logger |
| js-server-helper-logger-store-dynamodb | `@superloomdev/...logger-store-dynamodb` | DynamoDB | logger |

**Documentation Style:**
- "How This Fits In" section first
- Link to parent module prominently
- Store contract table (8 methods for auth, 5 for logger, etc.)
- Schema DDL
- Badge: "Service-dependent" (except SQLite = "Offline")

---

## Category 6: AWS Service Modules

**Characteristics:** AWS SDK wrapper, credential management, regional config.

**Template:** `README-master-template.md` (AWS-specific)

| Module | Package | AWS Service | Notes |
|--------|---------|-------------|-------|
| js-server-helper-storage-aws-s3 | `@superloomdev/...storage-aws-s3` | S3 operations | Needs review |
| js-server-helper-storage-aws-s3-url-signer | `@superloomdev/...storage-aws-s3-url-signer` | S3 presigned URLs | Needs review |
| js-server-helper-queue-aws-sqs | `@superloomdev/...queue-aws-sqs` | SQS messaging | Needs review |

**Documentation Style:**
- Credentials section early
- IAM permissions table
- Regional configuration note
- AWS SDK version compatibility

---

## Documentation Status Matrix

| Module | Category | README Status | Human-Written | Has Template | Needs Work |
|--------|----------|---------------|---------------|--------------|------------|
| js-helper-utils | 1 - Foundation | Complete | Yes | Yes | No |
| js-helper-debug | 1 - Foundation | Complete | Yes | Yes | No |
| js-helper-time | 1 - Foundation | Needs review | Unknown | Yes | Review |
| js-client-helper-crypto | 1 - Foundation | Needs creation | N/A | Yes | Create |
| js-server-helper-crypto | 2 - Service | Complete | Yes | Yes | No |
| js-server-helper-instance | 2 - Service | Complete | Yes | Yes | No |
| js-server-helper-http | 2 - Service | Needs review | Unknown | Yes | Review |
| js-server-helper-sql-sqlite | 3 - Driver | Needs review | Partial | Yes | Consistency pass |
| js-server-helper-sql-postgres | 3 - Driver | Needs review | Unknown | Yes | Consistency pass |
| js-server-helper-sql-mysql | 3 - Driver | Needs review | Unknown | Yes | Consistency pass |
| js-server-helper-nosql-mongodb | 3 - Driver | Needs review | Unknown | Yes | Consistency pass |
| js-server-helper-nosql-aws-dynamodb | 3 - Driver | Needs review | Unknown | Yes | Consistency pass |
| js-server-helper-auth | 4 - Feature | Complete | Yes | Yes | docs/ exists |
| js-server-helper-verify | 4 - Feature | Complete | Yes | Yes | Evaluate docs/ need |
| js-server-helper-logger | 4 - Feature | Complete | Yes | Yes | Create docs/ folder |
| js-server-helper-auth-store-* | 5 - Adapter | Partial | Mixed | Yes | Apply template |
| js-server-helper-verify-store-* | 5 - Adapter | Needs review | Mixed | Yes | Apply template |
| js-server-helper-logger-store-* | 5 - Adapter | New | N/A | Yes | Use template |
| js-server-helper-storage-aws-* | 6 - AWS | Needs review | Unknown | Yes | Review |
| js-server-helper-queue-aws-sqs | 6 - AWS | Needs review | Unknown | Yes | Review |

---

## Recommended Documentation Priority

1. **High Priority (Apply templates immediately):**
   - All logger store adapters (new modules being created)
   - js-server-helper-logger docs/ folder
   - js-client-helper-crypto (missing)

2. **Medium Priority (Consistency pass):**
   - All SQL/NoSQL driver modules
   - All AWS service modules
   - Verify module docs/ evaluation

3. **Low Priority (Review when touched):**
   - js-helper-time (minimal usage)
   - js-server-helper-http (stable)
