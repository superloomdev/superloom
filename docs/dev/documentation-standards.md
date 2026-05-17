# Documentation Writing Guide

> **Language:** JavaScript

This guide defines how to write human-readable, consistent documentation for Superloom modules. Every module in the framework follows these patterns so that a person can pick up any module and immediately understand its purpose and usage.

## Core Philosophy

**Documentation is for humans.** AI can generate the structure, but the words must sound like they came from a person explaining something to a colleague. Simple sentences. No fluff. No buzzwords.

**Key principles:**

- **Lead with the problem.** What does this module do, and why would someone need it?
- **Show, don't just tell.** Code examples should be copy-paste ready and runnable.
- **Consistency across modules.** Once a developer learns one module, learning the next should feel familiar.
- **Progressive disclosure.** Quick start for the impatient, deep docs for the curious.

---

## Module Categories

Every module falls into one of these categories. Each category has a specific README template:

### 1. Core Foundation Modules

**Examples:** `js-helper-utils`, `js-helper-debug`, `js-helper-time`

**Characteristics:**
- Zero or minimal dependencies
- Pure utility functions
- Platform-agnostic (run anywhere)
- Self-contained building blocks

**README Style:** Simple, function-focused. List what it does. Show examples.

### 2. Service/Helper Modules

**Examples:** `js-server-helper-crypto`, `js-server-helper-instance`, `js-server-helper-http`

**Characteristics:**
- Provides a specific service (crypto, request lifecycle, HTTP)
- Depends on foundation modules
- Factory pattern: returns configured instance
- Single purpose, well-scoped

**README Style:** Clear purpose statement. Factory pattern explanation. API table.

### 3. Database Driver Modules

**Examples:** `js-server-helper-sql-postgres`, `js-server-helper-sql-mysql`, `js-server-helper-nosql-mongodb`, `js-server-helper-sql-sqlite`

**Characteristics:**
- Wraps a specific database driver
- Provides common API across different backends
- Connection management, query building

**README Style:** Connection setup prominently. Query examples. Placeholder syntax explanation.

### 4. Feature Modules with Storage Adapters

**Examples:** `js-server-helper-auth`, `js-server-helper-verify`, `js-server-helper-logger`

**Characteristics:**
- Core business logic module
- Multiple storage adapter options (SQL, NoSQL, etc.)
- Complex configuration
- Multi-tenancy support

**README Style:** Architecture overview prominently. Storage adapter comparison table. Deep data model documentation. Separate `docs/` folder for implementation details.

### 5. Storage Adapter Modules

**Examples:** `js-server-helper-auth-store-postgres`, `js-server-helper-verify-store-mongodb`

**Characteristics:**
- Implements store contract for a specific backend
- Thin wrapper around driver module
- Used with parent feature module

**README Style:** Same Universal Section list as every other class (Title, Tagline, What This Is, Why Use This Module, Hot-Swappable, Aligned with Superloom Philosophy, Extended Documentation, Adding to Your Project, Testing Status, License); each section is condensed. No `## Install` block (Section 9 points to the parent module's install instructions and the loader-pattern doc instead). No `## Usage` / Quick Start. The contract, configuration, schema, and cleanup behaviour live in `docs/` (`api.md`, `configuration.md`, `schema.md`, `cleanup.md`). No comparison to sibling adapters anywhere in the package.

### 6. AWS Service Modules

**Examples:** `js-server-helper-nosql-aws-dynamodb`, `js-server-helper-storage-aws-s3`, `js-server-helper-queue-aws-sqs`

**Characteristics:**
- Wraps AWS SDK
- Credential management
- Regional configuration

**README Style:** Credential setup. AWS-specific options. IAM permissions required.

---

## Human Writing Style

### Sentence Structure

**Do:**
- "This module handles session lifecycle."
- "You create an Auth instance per actor type."
- "The token expires after 30 days."

**Don't:**
- "This module is designed to facilitate the comprehensive management of authentication sessions."
- "It is recommended that one instantiates an Auth instance for each respective actor type."
- "Upon the elapsing of a 30-day temporal window, the token will be rendered invalid."

### Active Voice

**Do:** "The module returns an error."
**Don't:** "An error is returned by the module."

### Concrete Over Abstract

**Do:** "Checks if the value is null or undefined."
**Don't:** "Performs nullity validation on the input parameter."

### Second Person for Instructions

**Do:** "Install the module with npm."
**Don't:** "The module should be installed."

### Consistent Terminology

Use the same words across all docs:

| Concept | Use This | Not This |
|---------|----------|----------|
| Function return | returns | yields, produces, emits |
| Error handling | returns an error | throws, raises, surfaces |
| Configuration | config | configuration object, settings |
| Initialize | loader | factory, constructor |
| Required parameter | required | mandatory, compulsory |
| Optional parameter | optional | not required |

---

## README Structure Template

Every README follows this structure. Sections marked [optional] can be omitted if not relevant.

### Header Block

```markdown
# @superloomdev/{package-name}

[Badges: Test, License, Node version]

One-sentence description. What it does, not how it works.

Part of the [Superloom](https://github.com/superloomdev/superloom) framework.
```

**Badge order:** Test status → License → Node version

### Tag Line (for specific module types)

```markdown
> **Foundation module** - zero runtime dependencies. Other modules may depend on this, never the reverse.

> **Service-dependent.** Tests require [resource]. Docker lifecycle managed by npm test.

> **Offline module** - tests use in-memory [resource]. No Docker, no credentials.
```

### What It Does (2-3 paragraphs max)

Explain the problem this module solves. Not an API reference - the "why" and "what."

**Good example:**
> This module manages session lifecycle for Superloom applications. One loader call creates an independent Auth instance bound to one actor type and one storage backend. Multiple instances coexist in the same process with completely isolated state.

### Quick Links [optional for complex modules]

```markdown
**Further reading:**
- [`docs/runtime.md`](docs/runtime.md). Persistent-server vs serverless-function runtime differences
- [`docs/data-model.md`](docs/data-model.md). Session record fields explained
```

### Installation

```markdown
## Installation

```bash
npm install @superloomdev/{package-name}
```
```

For modules with peer dependencies (store adapters, etc.):

```markdown
## Installation

```bash
npm install @superloomdev/{parent-module} \
            @superloomdev/{this-adapter}
```
```

### Quick Start

Runnable code example. Should work if copied into a test file.

```markdown
## Quick Start

```javascript
// Setup
Lib.Module = require('@superloomdev/{package-name}')(Lib, {
  // minimal config
});

// Usage
const result = await Lib.Module.doSomething(instance, {
  // minimal example
});
```
```

### API Reference

**Simple modules:** Inline function list with descriptions.

**Complex modules:** Table format.

```markdown
## API

| Function | Params | Returns | Description |
|----------|--------|---------|-------------|
| `doSomething` | `(instance, options)` | `{ success, data, error }` | Description here |
```

### Configuration

Table of config options. Mark required fields.

```markdown
## Configuration

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `OPTION_NAME` | `String` | — | **Required.** What this does. |
| `OPTIONAL_ONE` | `Boolean` | `false` | What this does. |
```

### Peer Dependencies [if applicable]

```markdown
## Peer Dependencies

| Package | Purpose |
|---------|---------|
| `@superloomdev/js-helper-utils` | Type checks |
```

### Testing

Consistent across all modules:

```markdown
## Testing

| Tier | Runtime | Status |
|------|---------|--------|
| **Unit Tests** | Node.js `node --test` | [Badge] |

Run locally:

```bash
cd _test
npm install && npm test
```
```

For service-dependent modules, note the Docker lifecycle:

```markdown
Docker lifecycle is fully automatic. `pretest` starts the container; `posttest` stops it.
```

### License

```markdown
## License

MIT
```

---

## Complex Module Docs/ Folder

Modules like `auth`, `verify`, and `logger` need deeper documentation. Create a `docs/` folder inside the module with:

```
module-name/
  README.md              # Overview, quick start, API
  docs/
    data-model.md        # Record fields, data types, constraints
    runtime.md           # Persistent-server vs serverless-function runtime differences only
    configuration.md     # Deep config reference
```

**data-model.md should include:**
- Core concepts (tenant, actor, entity, etc.)
- Record field table (field, type, set by, description)
- Design rationale for key decisions
- Quick reference tables for common scenarios

**runtime.md should include only the differences between runtime shapes:**
- How `instance.http_request` and `instance.http_response` are constructed in a persistent server (bind framework `req` / `res` directly) vs in a serverless function (adapt the platform event; buffer writes for the returned response object)
- How scheduled cleanup is wired (cron library inside the process vs scheduled function invocation outside it). Only when the chosen storage adapter requires it

**runtime.md should NOT include:**
- Framework cookbook material (Express middleware, login/refresh/logout endpoint code, active-devices UI examples). That belongs in the user's application code, not module docs
- Bootstrap walk-throughs (those live in `configuration.md`)
- Auth-module function call sites (those live in `api.md`)
- Cold-start cost figures, connection-pool guidance, schema provisioning (those live in each Class F adapter's README)
- Error-type → HTTP status mapping (that lives in `api.md`)

---

## Category-Specific Variations

### Foundation Modules (utils, debug, time)

- Simple header, no "What It Does" essay
- Function list is the focus
- Minimal configuration section
- Example: `js-helper-debug` README

### Storage Adapter Modules

- README follows the full Universal Section list (same as every other class), condensed to ~70-90 lines
- Section 4 (Why Use This Module) has 4-5 bullets, not the parent's 5-7. Bullets 1-4 are the universal set (insulation, pre-tested, designed-for-review, observability); bullet 5 is backend-specific (e.g. "PostgreSQL-correct semantics handled for you")
- Section 5 (Hot-Swappable) lists the sibling adapter packages with a one-line framing
- Section 9 (Adding to Your Project) points to the parent module's install instructions and the loader-pattern doc. No `npm install` snippet in the adapter's README
- `docs/api.md` holds the store contract (one subsection per method)
- `docs/configuration.md` holds `STORE_CONFIG`, peer dependencies, environment variables, testing tier
- `docs/schema.md` holds the DDL or createIndex / CreateTable calls and backend-specific syntax notes
- `docs/cleanup.md` holds the TTL behaviour and recommended cleanup mechanism
- No comparison with sibling adapters; each adapter documents only its own backend

### AWS Modules

- Credentials section early
- IAM permissions required table
- Regional configuration note
- AWS SDK version compatibility note

---

## Template Placeholder Syntax

When writing template files (fill-in-the-blank READMEs, guides, or any document with placeholder values), use **angle brackets with uppercase names**:

```
<PACKAGE_NAME>
<ONE_SENTENCE_DESCRIPTION>
<DRIVER_MODULE>
```

Do not use curly braces `{PLACEHOLDER}` — VitePress parses them as Vue template expressions and will crash when building the documentation site.

| Correct | Incorrect |
|---|---|
| `<PACKAGE_NAME>` | `{PACKAGE_NAME}` |
| `<ONE_SENTENCE_DESCRIPTION>` | `{ONE_SENTENCE_DESCRIPTION}` |
| `<VERSION>` | `{VERSION}` |

This convention also matches the standard placeholder syntax used in CLI documentation, RFCs, and man pages, so readers recognize fill-in slots immediately.

---

## Common Mistakes to Avoid

1. **Starting with implementation details.** Lead with purpose, not mechanics.
2. **Writing for yourself.** The reader doesn't know your design decisions.
3. **Skipping the "why."** Every section should answer why, not just what.
4. **Inconsistent formatting.** Pick one format for tables, code blocks, lists.
5. **Missing runnable examples.** Every code block should be copy-paste ready.
6. **Assuming context.** Mention Superloom, link to related modules, explain terminology.

---

## Review Checklist

Before finalizing a README:

- [ ] One-sentence description is clear and accurate
- [ ] Quick start example runs without modification
- [ ] All code blocks have language tags
- [ ] Configuration table includes all options
- [ ] Peer dependencies listed if applicable
- [ ] Testing section follows standard format
- [ ] No AI-sounding phrases (facilitate, comprehensive, robust)
- [ ] Active voice used throughout
- [ ] Second person for instructions
- [ ] Consistent terminology with other modules

---

## Language and Spelling

All project text uses **American English**: code comments, documentation, `package.json` descriptions, commit messages, and README files.

| Pattern | Correct | Incorrect |
|---|---|---|
| **-ize not -ise** | `initialize`, `standardize`, `optimize` | `initialise`, `standardise`, `optimise` |
| **-or not -our** | `behavior`, `color`, `favor` | `behaviour`, `colour`, `favour` |
| **-ization not -isation** | `optimization`, `organization` | `optimisation`, `organisation` |
| **license** | `license` | `licence` |

The full spelling and prose-quality table lives in [`code-formatting-js.md`](../foundations/code-formatting-js.md#spelling-and-prose-quality).

---

## Punctuation and Formatting Rules

### Em Dash

Em dashes are not used in any project file: `.js`, `.md`, `package.json`, commit messages, or any other format. Use a hyphen `-` only for compound words. Use a period to end a term description in a bullet list.

| Pattern | Correct | Incorrect |
|---|---|---|
| Sentence aside | `The loader runs once. It is the only place that reads env vars.` | `The loader runs once — it is the only place that reads env vars.` |
| Bullet list item | `**Term.** Explanation sentence.` | `**Term** — explanation` |
| Compound word | `transport-agnostic`, `hand-written`, `per-entity` | `transport—agnostic` |

### Table Cell Punctuation

Do not end table cells with a period. Table cells are not sentences.

| Correct | Incorrect |
|---|---|
| `Transport-agnostic controllers and services` | `Transport-agnostic controllers and services.` |

### Code Comments in Examples

Code blocks in documentation must contain only comments that would appear in real code. Do not use code comments as doc instructions (e.g. `// Correct`, `// Do this instead`). Move all instructional labels to prose above the code block.

### Sentence Length

Keep prose sentences to approximately 30 words or fewer. Split at conjunctions (`and`, `but`, `because`, `so`) when a sentence grows beyond that. Long sentences are harder to scan and harder for AI agents to parse unambiguously.

---

## Related Documentation

- [Module Structure (JavaScript)](../modules/module-structure-js)
- [Module Testing](../testing/module-testing.md)
- [Unit Test Authoring (JavaScript)](../testing/unit-test-authoring-js.md)
