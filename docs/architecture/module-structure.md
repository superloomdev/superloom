# Module Structure

A reference for how every module in Superloom is shaped: the standard application-module skeleton, the helper-module factory pattern, the model package index, and the server-extension merge mechanics. Use this when creating a new module or migrating an existing one.

## On This Page

- [Module Types Overview](#module-types-overview)
- [Application Module Pattern](#application-module-pattern)
- [Helper Module Pattern (Factory)](#helper-module-pattern-factory)
  - [Loader Body](#loader-body)
  - [createInterface](#createinterface)
  - [createInterface Signature Variants](#createinterface-signature-variants)
  - [Required Rules](#required-rules)
  - [Reference Implementations](#reference-implementations)
- [Model Package Index](#model-package-index)
- [Server Extension Merge Pattern](#server-extension-merge-pattern)
- [Required Structure Elements](#required-structure-elements)
- [Standard Files Per Module](#standard-files-per-module)
- [Dependency Flow](#dependency-flow)
- [Cross-References](#cross-references)
- [Appendix: Pattern 1 (Singleton, Legacy)](#appendix-pattern-1-singleton-legacy)

---

## Module Types Overview

Helper modules can be implemented in three different ways depending on your project's needs:

### Implementation Approaches

| Approach | Description | When to Use | Dependencies |
|---|---|---|---|
| **1. Fork and Publish** | Fork the framework repository, modify helper modules, and publish under your own org (`@your-org/*`) | You need custom helper functionality and want to distribute as packages | External: npm registry, GitHub Packages |
| **2. Local Copy** | Copy all helper modules into your project's source and use via `file:` references | Zero external dependencies, complete control, offline development | None - fully self-contained |
| **3. Direct Usage** | Use the published `@superloomdev/*` packages directly | Quick start, no custom helper modifications needed | External: GitHub Packages |

### Module Locations

**In the Framework Repository:**
- Helper modules live at the **repository root** under `src/helper-modules-*/` and publish under `@superloomdev/*`
- Application modules live inside a project (e.g., `demo-project/`)

**In Your Project (depends on approach):**
- **Approach 1**: Same structure as framework, publish as `@your-org/*`
- **Approach 2**: Helper modules copied to `your-project/src/helper-modules-*/` or `your-project/helpers/`
- **Approach 3**: No local helper modules - use external packages

| Module Type | AKA | Location | Purpose |
|---|---|---|---|
| Core Helper Modules | `core-helper-modules` | `src/helper-modules-core/[js\|py]-helper-[name]/` | Generic, reusable, platform-agnostic utilities |
| Server Helper Modules | `server-helper-modules` | `src/helper-modules-server/[js\|py]-server-helper-[name]/` | Server-only helpers (DB, cloud SDKs, filesystem) |
| Client Helper Modules | `client-helper-modules` | `src/helper-modules-client/[js]-[platform]-helper-[name]/` | Platform-specific client utilities |
| Base Model Modules | `base-model` | `[project]/src/model/[entity]/` | Shared domain model: data, validations, DTOs, errors |
| Server Model Modules | `server-model` | `[project]/src/model-server/[entity]/` | Server-only extensions over `base-model` |
| Client Model Modules | `client-model` | `[project]/src/model-client/[entity]/` | Client-only extensions over `base-model` |
| Server Controller | `server-controller` | `[project]/src/server/controller/` | Thin adapters between interfaces and services |
| Server Service | `server-service` | `[project]/src/server/service/` | Business logic, orchestration, use cases |
| Server Common | `server-common` | `[project]/src/server/common/` | Bootstrap, config loaders, DI, shared infra |
| Server Interfaces | `server-interfaces` | `[project]/src/server/interfaces/` | Entry points: API (Express + Lambda), Hook, Job |
| Deploy Configs | `deploy` | `[project]/src/server/_deploy/[entity]/` | Per-entity Serverless Framework configs |

---

## Application Module Pattern

All application modules (models, services, controllers) follow a **strict, identical pattern** for dependency injection, lifecycle management, and visual structure. This pattern is mandatory and must be copied exactly.

### Standard Module Template

```javascript
// [Module purpose - 1 line]
// [What it does - 1 line]
// [Pattern indicator - 1 line]
'use strict';

// Shared dependencies (injected by loader; avoids passing Lib everywhere)
let Lib;

// Domain config (injected; constants/enums, not runtime env)
let CONFIG;


/////////////////////////// Module-Loader START ////////////////////////////////

  /********************************************************************
  Loader: inject Lib + CONFIG + ERRORS for this module.

  @param {Object} shared_libs - loaded libraries + models (Lib)
  @param {Object} config - domain config for this module
  @param {Object} errors - error catalog for this module (independent from config)
  @return {void}
  *********************************************************************/
  const loader = function (shared_libs, config, errors) {

    Lib = shared_libs;
    CONFIG = config;
    ERRORS = errors;

  };

//////////////////////////// Module-Loader END /////////////////////////////////



///////////////////////////// Module Exports START /////////////////////////////
module.exports = function (shared_libs, config) {

  // Run module-scope loader (local DI)
  loader(shared_libs, config);

  // Return public functions of this module
  return ModuleName;

};//////////////////////////// Module Exports END //////////////////////////////



////////////////////////////Public Functions START//////////////////////////////
const ModuleName = {

  /********************************************************************
  Function description

  @param {Type} name - Description
  @return {Type} - Description
  *********************************************************************/
  functionName: function (params) {

    // Implementation
    return result;

  }

};////////////////////////////Public Functions END///////////////////////////////
```

---

## Helper Module Pattern (Factory)

Helper modules use **Pattern 2 (Multi-Instance Factory)**. Each loader call returns an independent instance with its own `Lib`, `CONFIG`, and (for stateful modules) `state`. This is the standard shape for **all** helper modules going forward.

> **Pattern 1 (Singleton Config) is legacy** and no longer used in new modules. It is preserved at the bottom of this document for historical reference and downstream projects that still have the shape. Do not use it for new modules.

The canonical shape is a thin `loader` function that delegates to a `createInterface` factory. The loader stays minimal (merge config, build state) and `createInterface` holds all public/private function bodies, where they close over `Lib`, `CONFIG`, and `state` without module-level globals.

### Loader Body

```javascript
// Info: [Module purpose in one line].
//
// Compatibility: [Target runtime versions]
//
// Factory pattern: each loader call returns an independent instance with
// its own state and config. Useful for multi-db or reader/writer splits.
// Adapter and resource are both lazy-loaded on first use.
'use strict';


// [Adapter caching comment - describe every cached module-scope reference]
let [AdapterRef] = null;


/////////////////////////// Module-Loader START ////////////////////////////////

/********************************************************************
Factory loader. One call = one independent instance with its own
state and config.

@param {Object} shared_libs - Lib container with Utils and Debug
@param {Object} config - Overrides merged over module config defaults

@return {Object} - Public interface for this module
*********************************************************************/
module.exports = function loader (shared_libs, config) {

  // Dependencies for this instance
  const Lib = {
    Utils: shared_libs.Utils,
    Debug: shared_libs.Debug
  };

  // Merge overrides over defaults
  const CONFIG = Object.assign(
    {},
    require('./[module].config'),
    config || {}
  );

  // Mutable per-instance state ([resource] lives here)
  const state = {
    [resource]: null
  };

  return createInterface(Lib, CONFIG, state);

};/////////////////////////// Module-Loader END /////////////////////////////////
```

### createInterface

```javascript
/////////////////////////// createInterface START //////////////////////////////

/********************************************************************
Builds the public interface for one instance. Public and private
functions close over the provided Lib, CONFIG, and state.

@param {Object} Lib - Dependency container (Utils, Debug)
@param {Object} CONFIG - Merged configuration for this instance
@param {Object} state - Mutable state holder (e.g. resource reference)

@return {Object} - Public interface for this module
*********************************************************************/
const createInterface = function (Lib, CONFIG, state) {

  ///////////////////////////Public Functions START//////////////////////////////
  const [ModuleName] = {

    // ~~~~~~~~~~~~~~~~~~~~ [Subsection Name] ~~~~~~~~~~~~~~~~~~~~
    // One-line purpose of this subsection.

    [functionName]: function () {
      // Public functions close over CONFIG, Lib, and state
    }

  };///////////////////////////Public Functions END//////////////////////////////



  //////////////////////////Private Functions START//////////////////////////////

  const _[ModuleName] = {

    // ~~~~~~~~~~~~~~~~~~~~ Adapter and Resource Init ~~~~~~~~~~~~~~~~~~~~
    // Lazy-load the adapter and build the resource on first use.

    /********************************************************************
    Lazy-load the vendor adapter. Shared across every instance because
    the adapter itself is stateless - only the resource holds state.
    *********************************************************************/
    ensureAdapter: function () {

      if (Lib.Utils.isNullOrUndefined([AdapterRef])) {
        [AdapterRef] = require('[vendor-package]');
      }

    }

  };//////////////////////////Private Functions END//////////////////////////////


  return [ModuleName];

};/////////////////////////// createInterface END //////////////////////////////
```

### createInterface Signature Variants

`createInterface` takes only the parameters the module actually needs. Four canonical shapes exist - use the minimal one that fits.

| Signature | Use when | Reference |
|---|---|---|
| `createInterface()` | Foundation module with no peer deps and no config (self-contained utility library) | `js-helper-utils` |
| `createInterface(CONFIG)` | Foundation module with config but no peer deps (structured logging primitives) | `js-helper-debug` |
| `createInterface(Lib, CONFIG)` | Stateless helper - uses peer deps and config but holds no per-instance resource | `js-helper-time`, `js-server-helper-crypto`, `js-server-helper-http`, `js-server-helper-instance` |
| `createInterface(Lib, CONFIG, state)` | Stateful helper - holds a per-instance resource (pool, persistent client, authenticated session) | `js-server-helper-sql-mysql`, `js-server-helper-nosql-aws-dynamodb` |

The loader body mirrors the signature: it builds only the parameters it will pass. A stateless helper's loader ends with `return createInterface(Lib, CONFIG);` and never declares a `state` object.

### Required Rules

| Rule | Detail |
|---|---|
| **Cached adapters at module scope** | `let [AdapterRef] = null;` declared above the loader. A descriptive comment explains each cached reference and why it is shared across instances |
| **Config defaults inlined in the loader** | Use `require('./[module].config')` as one of the operands of `Object.assign` - no top-level `const CONFIG_DEFAULTS` |
| **Three-job loader body** | Loader does only three things: build `Lib`, build merged `CONFIG`, build mutable `state`. Then call `createInterface(Lib, CONFIG, state)` and return the result |
| **Public first, private second** | `createInterface` hosts both objects; public is declared before private |
| **Level 2 subsections when warranted** | Use `// ~~~~~~~ [Name] ~~~~~~~` + one-line purpose comment when public/private has 5+ functions or 2+ responsibility groups - see [`code-formatting-js.md`](code-formatting-js.md) |
| **Top-down dependency order** | Order functions so the file reads top-to-bottom as a dependency chain. Put the most common caller-facing helper first; declare each function after its dependencies |
| **Escape-hatch primitives last** | Low-level primitives (manual checkout, raw connection access) go in the **last** public subsection, labelled with `(Escape Hatch)` and a copy-paste usage example |
| **Prescriptive private helper names** | `ensureAdapter` loads the vendor library, `initIfNot` builds the per-instance resource, `destroyResource` tears it down. Do not invent new names per module |
| **`module.exports = function loader (...)`** | Assigned on the first executable line after the top-of-file block comment. No separate `module.exports = loader` at the bottom |
| **No singletons via require** | Callers hold the returned interface reference per logical instance - there is no module-level singleton to `require` into |
| **Header documents the pattern** | Top-of-file block comment describes factory pattern, lazy-load behavior, and version compatibility |

### Reference Implementations

- **Stateful (full shape):** `src/helper-modules-server/js-server-helper-sql-mysql/mysql.js`
- **Stateless (no `state` param):** `src/helper-modules-server/js-server-helper-http/http.js`

When extending an existing Pattern 1 (Singleton) module to Pattern 2 (Factory), treat it as a breaking change for that module: update the header comment, move all functions into `createInterface`, switch `module.exports` to the loader assignment, and document the migration in `__dev__/migration-changelog.md`.

---

## Model Package Index

Model modules return objects with named keys for clean loader assignment. **Only the `shared` module exports its config**; entity modules keep config private.

| Module type | Returns | Config visibility |
|---|---|---|
| **`shared`** | `{ data, errors, process, validation, config }` | `config` is exported - other modules need it |
| **Entity modules** (Contact, User, Survey, ...) | `{ data, errors, process, validation, _config }` | `_config` is private - loader passes it to server layers only |

### Standard Index Module

```javascript
// Info: Public export surface for [Entity] base model module
// Standard pattern: Loader receives Lib and config override, returns { data, errors, process, validation, _config }
'use strict';


///////////////////////////// Module Exports START /////////////////////////////
module.exports = function (shared_libs, config_override) {

  // Merge domain config with env overrides (internal only, not exported)
  const Config = Object.assign(
    {},
    require('./[entity].config'),
    config_override || {}
  );

  // Load error catalog (independent, not attached to config)
  const Errors = require('./[entity].errors');

  // Load sub-modules with merged module-specific config
  const Data = require('./[entity].data')(shared_libs, Config);
  const Process = require('./[entity].process')(shared_libs, Config);
  const Validation = require('./[entity].validation')(shared_libs, Config, Errors);


  // Return public APIs as object { data, errors, process, validation, _config }
  // Note: _config is private, for loader use only (passed to server layers)
  return {
    data: Data,
    errors: Errors,
    process: Process,
    validation: Validation,
    _config: Config
  };

};//////////////////////////// Module Exports END //////////////////////////////
```

### Loader Pattern (Entity Modules)

```javascript
// Load package index (non-executed)
const Models = require('../../model');

// Execute individual entity: Models.Entity(Lib, {})
const UserModel = Models.User(Lib, {});

// Build Lib namespace (without _config)
Lib.User = {
  data: UserModel.data,
  errors: UserModel.errors,
  process: UserModel.process,
  validation: UserModel.validation
};

// Use _config privately (not exposed on Lib)
Lib.User.service = require('../service/user.service')(Lib, UserModel._config);
Lib.User.controller = require('../controller/user.controller')(Lib, UserModel._config);
```

### Loader Pattern (Shared Module)

```javascript
// Shared module returns { data, errors, process, validation, config }
Lib.Shared = require('./shared')(Lib, {});
// Lib.Shared = { data, errors, process, validation, config }
```

---

## Server Extension Merge Pattern

Entities with server-only extensions use a six-step load and merge pattern. The base model executes first; the server extension merges into the same namespace key-by-key.

```javascript
// Step 1: Load base model package (returns { Contact: fn, User: fn, ... })
const Models = require('../../model');

// Step 2: Execute base entity (assigns to Lib first so extended can reference it)
const SurveyModel = Models.Survey(Lib, {});
Lib.Survey = {
  data: SurveyModel.data,
  errors: SurveyModel.errors,
  process: SurveyModel.process,
  validation: SurveyModel.validation
};

// Step 3: Load and execute extended entity
const ModelsExtended = require('../../model-server');
const SurveyModelExtended = ModelsExtended.Survey(Lib, {});

// Step 4: Merge key-by-key (extended overrides/adds to base)
Lib.Survey = {
  data: { ...Lib.Survey.data, ...SurveyModelExtended.data },
  errors: { ...Lib.Survey.errors, ...SurveyModelExtended.errors },
  process: { ...Lib.Survey.process, ...SurveyModelExtended.process },
  validation: { ...Lib.Survey.validation, ...SurveyModelExtended.validation }
};

// Step 5: Merge configs privately (not exposed on Lib)
const SurveyConfig = { ...SurveyModel._config, ...SurveyModelExtended._config };

// Step 6: Build server layers with merged config
Lib.Survey.service = require('../service/survey.service')(Lib, SurveyConfig);
Lib.Survey.controller = require('../controller/survey.controller')(Lib, SurveyConfig);
```

### Why This Sequence Matters

1. `Models.Survey(Lib, {})` executes base first
2. `Lib.Survey = {...}` assigns base to the `Lib` namespace
3. `ModelsExtended.Survey(Lib, {})` executes the extended package and can now reference `Lib.Survey` for its dependencies
4. The merge spreads base + extended together
5. Config stays private in loader scope - never exposed on `Lib.Entity`
6. Service and controller receive the merged config

### Progressive Entity Buildup

Entities are namespaces that grow layer by layer as the loader runs:

```javascript
// Phase 1: Load base model package (returns { Contact: fn, User: fn, ... })
const Models = require('../../model');

// Phase 2: Execute Contact (independent, no dependencies)
const ContactModel = Models.Contact(Lib, {});
Lib.Contact = {
  data: ContactModel.data,
  errors: ContactModel.errors,
  process: ContactModel.process,
  validation: ContactModel.validation
};

// Phase 3: Execute User (depends on Contact, now available in Lib)
const UserModel = Models.User(Lib, {});
Lib.User = {
  data: UserModel.data,
  errors: UserModel.errors,
  process: UserModel.process,
  validation: UserModel.validation
};

// Phase 4: Build service layer (receives private _config from model)
Lib.User.service = require('../service/user.service')(Lib, UserModel._config);

// Phase 5: Build controller layer
Lib.User.controller = require('../controller/user.controller')(Lib, UserModel._config);

// Lib.User now has: { data, errors, process, validation, service, controller }
```

**Key principles:**

- Package index loads once: `const Models = require('../../model')`
- Each entity executes individually: `Models.Entity(Lib, {})`
- Dependencies are available in `Lib` for subsequent entities
- `_config` stays in loader scope, passed to service and controller
- All entities have service and controller (uniform pattern, even if placeholder)

---

## Required Structure Elements

| Element | Specification |
|---|---|
| **Header** | 3 lines: purpose, function, pattern indicator |
| **`'use strict'`** | On its own line after the header |
| **`Lib` declaration** | `let Lib;` - no initializer, with comment above |
| **`CONFIG` declaration** | `let CONFIG;` - no initializer, with comment above |
| **Spacing before Loader** | Exactly 2 empty lines after `CONFIG` |
| **Loader section** | `Module-Loader START` to `Module-Loader END` with docblock |
| **Loader function** | `const loader = function (shared_libs, config) {` (space before paren) |
| **Loader body** | 1 empty line, assignments, 1 empty line, close brace |
| **Spacing after Loader** | Exactly 3 empty lines |
| **Exports section** | `Module Exports START` to `Module Exports END` |
| **Export function** | `module.exports = function (shared_libs, config) {` (space before paren) |
| **Export body** | Loader invocation comment, loader call, return comment, return statement |
| **Spacing after Exports** | Exactly 3 empty lines |
| **Public Functions** | `Public Functions START` to `Public Functions END` with const declaration |
| **Function spacing** | 2 empty lines between functions |

Vertical spacing rules (the 3/2/1 rule) are detailed in [`code-formatting-js.md`](code-formatting-js.md).

---

## Standard Files Per Module

Most modules follow a consistent file structure:

| File | Purpose |
|---|---|
| `index.js` | Public export surface |
| `[name].js` | Main implementation |
| `[name].config.js` | Module-specific constants and defaults (optional) |
| `package.json` | Module metadata and dependencies |
| `README.md` | Human documentation (badges, usage examples, testing guides) |
| `ROBOTS.md` | AI agent reference (compact, token-efficient) |
| `eslint.config.js` | ESLint flat config (required for ESLint v9+) |
| `_test/test.js` | Tests using `node --test` and `node:assert/strict` |
| `_test/loader.js` | Test loader (env reading, dep injection) - required for any module using DI |
| `_test/package.json` | Test-only dependencies, `private: true`, references module as `file:../` |
| `_test/mock-data/` | (Optional) JSON fixtures |
| `_test/docker-compose.yml` | (Service-dependent modules only) emulator definitions |
| `_test/ops/` | (Service-dependent modules only) testing setup runbook |
| `provider/` | (Optional) vendor-specific implementations |

---

## Dependency Flow

Dependencies always flow downward:

```
Server Interfaces (API / Hook / Job)
  |  (Express adapter or per-entity AWS Lambda handlers)
  v
Server Controller
  |  (Validate via model, build DTO - one shape)
  v
Base Model + Server Model Extended
  |  (DTO creation, domain rules)
  v
Server Service
  |  (Orchestration, business logic)
  v
Server Helper Modules + Core Helper Modules
  |  (DB, cloud, generic utilities)
  v
External libraries (always wrapped)
```

### Key Rules

- **Helpers** are stateless or factory-instantiated, reusable, and wrap external libraries
- **Models** are pure and IO-free. Safe to share between server and client
- **DTOs** use ONE complete shape per entity. Absent keys are not added. No separate create/update shapes
- **Controllers** are thin adapters - no business logic
- **Services** contain all orchestration and business logic
- **Interfaces** handle protocol translation only (request → standard format → controller → standard output)
- **Common** handles bootstrap and dependency injection - no domain logic
- **AWS Lambda handlers** are split per entity per endpoint, each with its own deploy config (RAM, timeout)

---

## Cross-References

| Topic | Document |
|---|---|
| Coding standards (formatting, naming, JSDoc) | [`code-formatting-js.md`](code-formatting-js.md) |
| Architectural philosophy | [`architectural-philosophy.md`](architectural-philosophy.md) |
| Server bootstrap and DI | [`server-loader.md`](server-loader.md) |
| Data philosophy | [`model-modules.md`](model-modules.md) |
| Validation approach | [`validation-approach.md`](validation-approach.md) |
| Error handling rules | [`error-handling.md`](error-handling.md) |
| Module testing | [`module-testing.md`](module-testing.md) |
| Module publishing | [`module-publishing.md`](module-publishing.md) |
| Peer dependency strategy | [`peer-dependencies.md`](peer-dependencies.md) |
| Creating a new project | [Getting Started](../guide/getting-started.md) |

---

## Appendix: Pattern 1 (Singleton, Legacy)

Pattern 1 is preserved here for historical reference and for downstream projects that may still have the shape. **Do not use it for new modules.** All new helper modules use Pattern 2 (Factory) - see [Helper Module Pattern (Factory)](#helper-module-pattern-factory).

In Pattern 1, the module-level `CONFIG` is mutated in place by the loader. There is one config per process; public functions live at module level.

```javascript
// Base configuration (overridden by loader-injected config)
const CONFIG = require('./[module].config');

/////////////////////////// Module-Loader START ////////////////////////////////

const loader = function (shared_libs, config) {

  // Shared dependencies
  Lib.Utils = shared_libs.Utils;
  Lib.Debug = shared_libs.Debug;

  // Merge loader-injected config (overrides base values)
  if (config && typeof config === 'object') {
    Object.assign(CONFIG, config);
  }

};

//////////////////////////// Module-Loader END /////////////////////////////////
```

**Pattern 1 rules (legacy):**

- `const CONFIG = require('./[module].config')` at module level
- Base config comment: `// Base configuration (overridden by loader-injected config)`
- Merge comment: `// Merge loader-injected config (overrides base values)`
- Always guard with `if (config && typeof config === 'object')` before `Object.assign`
- Public functions (`const [ModuleName] = { ... }`) declared at module level
- `module.exports` calls `loader(shared_libs, config)` once and returns the module-level public interface

When migrating a Pattern 1 module to Pattern 2, treat it as a breaking change for that module - see [Reference Implementations](#reference-implementations) above.
