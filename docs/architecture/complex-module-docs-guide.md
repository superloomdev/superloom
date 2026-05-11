# Complex Module Docs/ Folder Guide

Complex modules like `auth`, `verify`, and `logger` need deeper documentation than fits comfortably in a README. This guide defines the `docs/` folder structure and content patterns for these modules.

## When to Create a docs/ Folder

Create a `docs/` folder when your module has:

- **Multiple storage backends** with different configuration needs
- **Complex data model** with 10+ record fields
- **Framework integrations** (Express, Lambda, etc.) that need detailed setup
- **Security considerations** that need explanation (encryption, token handling)
- **Advanced configuration** options beyond basic setup

**Don't create a docs/ folder for:**
- Simple utility modules (utils, debug, time)
- Thin wrapper modules (sql-* adapters)
- Single-purpose modules with minimal config

---

## docs/ Folder Structure

```
module-name/
  README.md                 # Overview, quick start, basic API
  docs/
    _config.yml             # (Optional) If using GitHub Pages
    data-model.md           # Record fields, data types, design rationale
    configuration.md        # Deep config reference
    integration-express.md    # Express.js setup
    integration-lambda.md     # AWS Lambda setup
    storage-adapters.md     # Backend comparison, selection guide
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
- **Tenant** — what it is, why it matters, examples
- **Actor** — what it is, actor_type vs actor_id
- **Entity** — for logger-style modules
- **Token/Code/Session** — the thing being stored

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

### integration-express.md

**Purpose:** Complete Express.js integration guide.

**Structure:**

```markdown
# Express Integration

## Bootstrap Setup

Loader configuration for Express apps.

## Middleware Pattern

```javascript
// Example auth middleware
```

## Route Handlers

### Login endpoint

```javascript
// Complete login handler
```

### Protected routes

```javascript
// Middleware + handler pattern
```

## Error Handling

How to handle module errors in Express.

## Cookie Configuration

Express-specific cookie setup if applicable.

## Session Storage

Where sessions are stored in the request lifecycle.
```

---

### integration-lambda.md

**Purpose:** AWS Lambda integration guide.

**Structure:**

```markdown
# Lambda Integration

## Handler Structure

```javascript
// Lambda handler pattern
```

## Request Context

How to build an `instance` from Lambda event.

## Authorizer Pattern

JWT or token-based authorizer setup.

## Cold Start Considerations

Module initialization in Lambda context.

## IAM Permissions

Required AWS permissions.
```

---

### storage-adapters.md

**Purpose:** Help users choose and configure the right backend.

**Structure:**

```markdown
# Storage Adapters

## Quick Comparison

| Backend | Best For | Native TTL | Complexity |
|---------|----------|------------|------------|
| SQLite | Local dev, embedded | No | Low |
| Postgres | Production SQL | No | Medium |
| MongoDB | Document patterns | Yes | Medium |
| DynamoDB | AWS native | Yes | High |

## Selection Guide

Decision tree or criteria.

## Backend-Specific Notes

### SQLite
- File-based
- WAL mode recommendations
- When to use

### PostgreSQL
- Connection pooling
- Schema recommendations
- Index guidance

### MongoDB
- TTL index setup
- Compound key patterns
- When to use

### DynamoDB
- Partition key design
- GSI patterns
- TTL enablement
- IAM permissions needed

## Migration Between Backends

How to switch backends if needed.
```

---

## Writing Style for docs/

Same human-first approach as READMEs:

1. **Lead with the use case.** "You need this when..."
2. **Progressive examples.** Start simple, add complexity.
3. **Explain the why.** "We use composite keys because..."
4. **Cross-link liberally.** "See [configuration](configuration.md) for details."
5. **Tables for reference.** Quick lookup tables for common scenarios.

---

## Linking from README

The README should reference docs/ files in the "Further reading" section:

```markdown
## What It Does

{Module description}

**Further reading:**
- [`docs/data-model.md`](docs/data-model.md) — Record fields and design rationale
- [`docs/integration-express.md`](docs/integration-express.md) — Express middleware patterns
- [`docs/storage-adapters.md`](docs/storage-adapters.md) — Choosing and configuring backends
```

---

## Review Checklist for docs/

- [ ] Every record field is documented
- [ ] Design decisions explained (not just what, but why)
- [ ] Code examples are runnable
- [ ] Backend comparison helps decision-making
- [ ] Integration guides cover complete setup
- [ ] Cross-links work (relative paths)
- [ ] No duplication with README (README = overview, docs/ = depth)
