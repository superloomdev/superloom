# Model Modules

> **Language:** JavaScript

The model layer is where every entity defines its **shape, validation rules, errors, and business processes**. It is split into three peer packages - `base-model`, `server-model`, `client-model` - that compose into a single namespace at runtime via key-by-key merge in the loader. This document covers all three.

## On This Page

- [Base Model Modules](#base-model-modules)
  - [Purpose](#base-model---purpose)
  - [Design Principles](#base-model---design-principles)
  - [Naming Convention](#base-model---naming-convention)
  - [Standard Files](#base-model---standard-files)
  - [DTO Terminology](#dto-terminology)
  - [Boundary Rules](#base-model---boundary-rules)
- [Server Model Modules](#server-model-modules)
  - [Peer Package Pattern](#peer-package-pattern)
  - [Merge Mechanics](#merge-mechanics)
  - [What Belongs Here](#what-belongs-in-server-model)
- [Client Model Modules](#client-model-modules)
- [Further Reading](#further-reading)

---

## Base Model Modules

`base-model` defines the **shared domain model** for an entity. It provides canonical data structures, validation, domain rules, and DTO transformations. Pure and IO-free, it is safe to share between server and client.

### Base Model - Purpose

- Define the **shared domain model** for an entity or domain
- Provide **canonical data structures**, **validations**, **domain rules**, and **DTO transformations**
- Be **pure and IO-free** so it can be safely shared between **server** and **client** when both run JavaScript

### Base Model - Design Principles

| Principle | Detail |
|---|---|
| **Domain-focused and deterministic** | Same input always produces the same output |
| **Pure functions preferred** | No hidden state |
| **No database calls, no network calls** | Belongs in service layer |
| **No secrets, no environment config** | Belongs in the loader |
| **Explicit inputs and outputs** | Function signatures are the contract |
| **Stable contracts** | Data and entity shapes evolve deliberately |

### Base Model - Naming Convention

| Element | Convention |
|---|---|
| Module directory name | `[entity-name]` (singular, e.g., `user`, `survey`) |
| Location | `[project]/src/model/[entity-name]/` |

### Base Model - Standard Files

| File | Purpose |
|---|---|
| `index.js` | Package entry - returns `{ Contact: fn, User: fn, Survey: fn, Shared: fn }`. Each property is a constructor function. The loader calls `Models.Contact(Lib, {})` to execute it and get `{ data, errors, process, validation, _config }` |
| `[entity].config.js` | Domain constants and rules (min/max lengths, regex patterns, enums, limits). Domain policy, not environment configuration |
| `[entity].errors.js` | Domain error catalog (error codes + default messages + optional HTTP status) |
| `[entity].data.js` | **Consolidated entity constructors and DTO transformations.** All DTOs are derived from the canonical entity shape. Each entity has ONE canonical structure |
| `[entity].process.js` | Pure business logic - calculations, transformations, collections management. Receives `Lib` (with `Lib.Utils`) via the loader pattern |
| `[entity].validation.js` | Pure validation functions based on `[entity].config.js` |

### `index.js` File Comments and Pattern

| Comment | Format |
|---|---|
| **Header** | `// Info: Public export surface for [Entity] base model module` |
| **Dependencies note** | `// Dependencies: Contact, User (uses Contact.validation, User.process)` |
| **Pattern note** | `// Standard pattern: Loader receives Lib and config override, returns { data, errors, process, validation, _config }` |

The full `index.js` template lives in [`module-structure-js.mdx`](module-structure-js.mdx#model-package-index).

### `[entity].data.js` Function Set

Each entity's data module typically exports:

| Function | Purpose |
|---|---|
| `create(...)` | Build a complete internal shape with defaults |
| `createUpdate(...)` | Partial update shape - only provided fields |
| `toPublic(...)` | Strip server-only fields for API output |
| `toSummary(...)` | Minimal version for list views |
| `toInternal(...)` | Map external input to canonical internal shape |

Keys not provided (`undefined`) are simply **not added** to the resulting object. See [DTO Philosophy (JavaScript)](../philosophy/dto-philosophy-js.md) for the rationale.

### `[entity].validation.js` Cross-Module Validation

If validation delegates to another model (e.g., `User` validating an email via `Contact`), the validation module must use the **loader pattern** to receive `Lib` and access `Lib.OtherModel`.

```javascript
// User validation that uses Contact's email validator
// Inside user.validation.js
const result = Lib.Contact.validation.validateEmail(email);
```

Never directly `require()` another entity's model from inside a validation file - it bypasses the loader and breaks dependency injection.

### DTO Terminology

| Term | Where it appears |
|---|---|
| **DTO** (Data Transfer Object) | Documentation - describes the conceptual pattern of transforming data shapes |
| **Data** | Code - the actual API uses `data` for the module name (e.g., `user.data.create()`, `user.data.toPublic()`) |

This is intentional. Docs describe the **what** (DTO pattern); code implements the **how** (data module).

### Base Model - Boundary Rules

#### `base-model` may be used by

- `server-service`
- `server-controller`
- Client applications

#### `base-model` must NOT

- Access database or repositories
- Call external services (SMS, email, payments, ...)
- Depend on server-only runtime assumptions
- Contain authorization or policy decisions

---

## Server Model Modules

`server-model` adds **server-only properties and methods** to base models - audit trails, internal IDs, admin-only DTOs, policy rules. They are **peer packages** to the base model, not subclasses. Both packages produce the same shape independently; the loader merges them at runtime.

### Peer Package Pattern

| Rule | Detail |
|---|---|
| **No imports between base and server** | Server models do not import or reference the base model internally |
| **Same return shape** | Both packages produce `{ data, errors, process, validation, _config }` |
| **Loader merges key-by-key** | Object spread combines the two |
| **Composition, not inheritance** | The merge happens in the loader, not in the modules |

### Merge Mechanics

The loader is responsible for the merge:

```javascript
// Base loads first, assigned to Lib
const SurveyModel = Models.Survey(Lib, {});
Lib.Survey = {
  data: SurveyModel.data,
  errors: SurveyModel.errors,
  process: SurveyModel.process,
  validation: SurveyModel.validation
};

// Server extension loads second (can reference Lib.Survey)
const SurveyModelExtended = ModelsExtended.Survey(Lib, {});

// Loader merges key-by-key (extended adds to or overrides base)
Lib.Survey = {
  data: { ...Lib.Survey.data, ...SurveyModelExtended.data },
  errors: { ...Lib.Survey.errors, ...SurveyModelExtended.errors },
  process: { ...Lib.Survey.process, ...SurveyModelExtended.process },
  validation: { ...Lib.Survey.validation, ...SurveyModelExtended.validation }
};

// Config merged privately, never exposed on Lib
const SurveyConfig = { ...SurveyModel._config, ...SurveyModelExtended._config };
```

After the merge, callers access `Lib.Survey.data.*` transparently - both base and server methods are available on the same namespace.

### Config Privacy

`_config` is private. The loader merges `base._config + extended._config` into a local variable and passes it to service and controller. **Never** exposed on `Lib.Entity`.

### Structure

`server-model` follows the **same file naming and layout** as `base-model`:

- `index.js`, `[entity].config.js`, `[entity].data.js`, `[entity].errors.js`, `[entity].process.js`, `[entity].validation.js`
- Each entity constructor returns `{ data, errors, process, validation, _config }`

### What Belongs in Server Model

- Server-only fields: `created_by`, `organization_id`, `internal_notes`, `audit_trail`
- Admin-only DTOs and output shapes
- Server-side policy logic

### What Does NOT Belong Here

- Base entity shapes (those live in `model/`)
- Universal validations (those live in `model/`)
- Client-relevant logic (that lives in `model-client/`)

### Server Model - Naming Convention

| Element | Convention |
|---|---|
| Module directory name | `[entity-name]` (singular) |
| Location | `[project]/src/model-server/[entity-name]/` |

---

## Client Model Modules

`client-model` adds **client-relevant properties and methods** to base models - client-side metadata, state tracking, lightweight presentation validations. Same peer-package pattern as `server-model`. Independently loaded; merged by the client-side loader.

### What Belongs in Client Model

- Client-relevant metadata: `last_fetched_date`, `cache_expiry`, `sync_status`
- Client-side state tracking helpers
- Lightweight client-only validations (e.g., real-time form checks)
- Client-specific formatting and presentation helpers

### What Does NOT Belong Here

- Server logic (lives in `model-server/`)
- Security-critical validations (must be in `model/` or `model-server/`)
- Browser-specific or platform-specific APIs (`localStorage`, `window`, `document`)

### Merge Pattern

Same as server model - the client-side loader merges base + client extension key-by-key.

### Client Model - Naming Convention

| Element | Convention |
|---|---|
| Module directory name | `[entity-name]` (singular) |
| Location | `[project]/src/model-client/[entity-name]/` |

---

## Further Reading

- [DTO Philosophy (JavaScript)](../philosophy/dto-philosophy-js.md) - the one-shape rule for data transfer objects
- [Validation Approach](validation-approach.md) - how `[entity].validation.js` produces user-facing errors
- [Module Structure (JavaScript)](module-structure-js.mdx#model-package-index) - the index file template and the merge pattern in detail
- [Server Loader](server-loader.md) - where the merge actually happens at runtime
- [Entity Creation Guide (JavaScript)](entity-creation-guide-js.mdx) - end-to-end walkthrough for adding a new entity
