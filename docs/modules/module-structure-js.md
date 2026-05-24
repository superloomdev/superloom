# Module Structure

> **Language:** [JavaScript](module-structure-js)

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
- [Parts Pattern (Complex Helper Modules)](#parts-pattern-complex-helper-modules)
- [Singleton Module Pattern](#singleton-module-pattern)
  - [Canonical Shape: Main Module Singleton](#canonical-shape-main-module-singleton)
  - [Canonical Shape: Module-Root Singleton (Validators)](#canonical-shape-module-root-singleton-validators)
  - [Module-Scope Declaration Ordering](#module-scope-declaration-ordering)
- [Adapter Pattern (Multi-Backend Helper Modules)](#adapter-pattern-multi-backend-helper-modules)
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

| Module Type | AKA | Location | Purpose |
|---|---|---|---|
| Core Helper Modules | `core-helper-modules` | `helper-modules-core/[js\|py]-helper-[name]/` | Generic, reusable, platform-agnostic utilities |
| Server Helper Modules | `server-helper-modules` | `helper-modules-server/[js\|py]-server-helper-[name]/` | Server-only helpers (DB, cloud SDKs, filesystem) |
| Client Helper Modules | `client-helper-modules` | `helper-modules-client/[js]-[platform]-helper-[name]/` | Platform-specific client utilities |
| Base Model Modules | `base-model` | `[project]/src/model/[entity]/` | Shared domain model: data, validations, DTOs, errors |
| Server Model Modules | `server-model` | `[project]/src/model-server/[entity]/` | Server-only extensions over `base-model` |
| Client Model Modules | `client-model` | `[project]/src/model-client/[entity]/` | Client-only extensions over `base-model` |
| Server Controller | `server-controller` | `[project]/src/server/controller/` | Thin adapters between interfaces and services |
| Server Service | `server-service` | `[project]/src/server/service/` | Business logic, orchestration, use cases |
| Server Common | `server-common` | `[project]/src/server/common/` | Bootstrap, config loaders, DI, shared infra |
| Server Interfaces | `server-interfaces` | `[project]/src/server/interfaces/` | Entry points: API (Express + Lambda), Hook, Job |
| Deploy Configs | `deploy` | `[project]/src/server/_deploy/[entity]/` | Per-entity Serverless Framework configs |

Helper module directories live in their own implementation repo (for JavaScript: `js-helper-modules`). Model and project-side directories live inside each application project under `src/`.

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

`createInterface` takes only the parameters the module actually needs. Use the minimal shape that fits — do not add parameters a module does not use.

| Signature | Use when | Reference |
|---|---|---|
| `createInterface()` | Foundation module with no peer deps and no config (self-contained utility library) | `js-helper-utils` |
| `createInterface(CONFIG)` | Foundation module with config but no peer deps (structured logging primitives) | `js-helper-debug` |
| `createInterface(Lib, CONFIG)` | Stateless helper - uses peer deps and config but holds no per-instance resource | `js-helper-time`, `js-server-helper-crypto`, `js-server-helper-http`, `js-server-helper-instance` |
| `createInterface(Lib, CONFIG, state)` | Stateful helper - holds a per-instance resource (pool, persistent client, authenticated session) | `js-server-helper-sql-mysql`, `js-server-helper-nosql-aws-dynamodb` |
| `createInterface(Lib, CONFIG, ERRORS, Validators, store)` | Domain helper with adapter pattern - Validators singleton + externally-supplied store, no parts | `js-server-helper-verify` |
| `createInterface(Lib, CONFIG, ERRORS, Parts, adapter)` | Domain helper with parts + externally-supplied adapter, no Validators singleton | `js-server-helper-http-gateway` |
| `createInterface(Lib, CONFIG, ERRORS, Validators, Parts, store)` | Domain helper with adapter pattern + Validators singleton + decomposed parts (fullest shape) | `js-server-helper-auth` |

The loader body mirrors the signature: it builds only the parameters it will pass. A stateless helper's loader ends with `return createInterface(Lib, CONFIG);` and never declares a `state` object.

### Parameter Casing Convention

Parameters passed to `createInterface` (and to module loaders in general) follow a strict casing rule based on what the parameter represents:

| Parameter kind | Casing | Rationale | Examples |
|---|---|---|---|
| **Internally-assembled namespaced containers** — bags of named keys built by this module's own loader | `PascalCase` | These are namespaces, not scalars. PascalCase signals "look inside for named sub-things" | `Lib`, `CONFIG`, `ERRORS`, `Parts`, `Validators` |
| **Externally-supplied resolved dependencies** — a single instance of a contract, obtained by calling a factory that arrived from outside (via `CONFIG.STORE`, `CONFIG.ADAPTER`, etc.) | `camelCase` | These are resolved objects, not namespaces. `camelCase` signals "this is one specific thing that implements a contract" | `store`, `adapter`, `state` |

**Why `store` and `adapter` are lowercase — and why that is intentional:**

`store` (in auth/verify) and `adapter` (in http-gateway) are the result of calling an externally-supplied factory function: `CONFIG.STORE(Lib, CONFIG, ERRORS)`. The module did not build this object from its own parts; the caller chose it and injected it through config. It is the module's external boundary — the one thing it cannot reason about internally. Lowercase signals: *"this came from outside; we hold it but we did not build it."*

This is the same reason `state` is lowercase in simpler stateful modules: `state` is a mutable container, not a named namespace.

### Parameter Ordering Convention

Parameters follow **internal-before-external** ordering. The full ordering rule:

```
createInterface(Lib, CONFIG, ERRORS, [Validators,] [Parts,] [store | adapter | state])
```

1. **`Lib`** — always first; the shared dependency container, present in almost every module
2. **`CONFIG`** — always second when present; merged runtime configuration
3. **`ERRORS`** — always third when present; frozen error catalog
4. **`Validators`** — fourth when present; internally-built singleton from `[module].validators.js`
5. **`Parts`** — fifth when present; internally-built container of `parts/` sub-modules
6. **`store` / `adapter` / `state`** — always last; the externally-supplied or mutable resource

The rule is: **everything the module built for itself comes before the one thing that was handed to it from outside.** This makes the signature self-documenting — a reader scanning the parameter list sees the module's own infrastructure first and the external dependency at the end.

Modules without all roles stay minimal:

```javascript
// No Parts, no external dependency — just the base three
createInterface(Lib, CONFIG, ERRORS)

// With store but no Parts (verify)
createInterface(Lib, CONFIG, ERRORS, Validators, store)

// With Parts and adapter (http-gateway)
createInterface(Lib, CONFIG, ERRORS, Parts, adapter)

// With Parts, Validators, and store (auth — fullest shape)
createInterface(Lib, CONFIG, ERRORS, Validators, Parts, store)
```


### Required Rules

| Rule | Detail |
|---|---|
| **Cached adapters at module scope** | `let [AdapterRef] = null;` declared above the loader. A descriptive comment explains each cached reference and why it is shared across instances |
| **Config defaults inlined in the loader** | Use `require('./[module].config')` as one of the operands of `Object.assign` - no top-level `const CONFIG_DEFAULTS` |
| **Three-job loader body** | Loader does only three things: build `Lib`, build merged `CONFIG`, build mutable `state`. Then call `createInterface(Lib, CONFIG, state)` and return the result |
| **Public first, private second** | `createInterface` hosts both objects; public is declared before private |
| **Level 2 subsections when warranted** | Use `// ~~~~~~~ [Name] ~~~~~~~` + one-line purpose comment when public/private has 5+ functions or 2+ responsibility groups - see [`code-formatting-js.md`](../foundations/code-formatting-js.md) |
| **Top-down dependency order** | Order functions so the file reads top-to-bottom as a dependency chain. Put the most common caller-facing helper first; declare each function after its dependencies |
| **Escape-hatch primitives last** | Low-level primitives (manual checkout, raw connection access) go in the **last** public subsection, labelled with `(Escape Hatch)` and a copy-paste usage example |
| **Prescriptive private helper names** | `ensureAdapter` loads the vendor library, `initIfNot` builds the per-instance resource, `destroyResource` tears it down. Do not invent new names per module |
| **`module.exports = function loader (...)`** | Assigned on the first executable line after the top-of-file block comment. No separate `module.exports = loader` at the bottom |
| **No factory singletons** | Factory modules (`createInterface` pattern with `state`) must not be used as singletons. Callers hold the returned interface reference per logical instance. For genuinely stateless, shared concerns use the [Singleton Module Pattern](#singleton-module-pattern) instead |
| **Header documents the pattern** | Top-of-file block comment describes factory pattern, lazy-load behavior, and version compatibility |

### Reference Implementations

- **Stateful (full shape):** `js-server-helper-sql-mysql` in `js-helper-modules`
- **Stateless (no `state` param):** `js-server-helper-http` in `js-helper-modules`

When extending an existing Pattern 1 (Singleton) module to Pattern 2 (Factory), treat it as a breaking change for that module: update the header comment, move all functions into `createInterface`, switch `module.exports` to the loader assignment, and document the migration in `__dev__/migration-changelog.md`.

---

## Parts Pattern (Complex Helper Modules)

Helper modules that grow beyond a few hundred lines split their pure stateless logic into **parts** - small co-located factory modules under a `parts/` directory. The parent module instantiates each part during loader execution and exposes the resulting interfaces internally as `Parts.<Name>`.

### When To Use

Apply the Parts pattern when the module has **independent, named responsibilities** that can each be owned by a dedicated sub-module. The key signal is not line count - it is whether the main module's purpose is fundamentally different from the concerns that support it. In `js-server-helper-auth`, for example, the auth module owns session orchestration; sub-modules like `AuthId`, `Policy`, and `TokenSource` each own a single concern that assists that purpose. Physical separation makes each responsibility legible in isolation.

Apply when **all** of these are true:

- The module has distinct, nameable responsibilities (`AuthId`, `Policy`, `RecordShape`, `TokenSource`, `Cookie`, `Jwt`) - each a coherent concept that could be described independently
- The main module's role is orchestration or a high-level concern; the parts exist only to serve that higher-level purpose
- Each candidate part is **stateless and pure** - takes inputs, returns outputs, holds no per-instance resource

> **Validators are not parts.** Config validators and per-call options validators belong in a module-root singleton (`[module].validators.js`), not in `parts/`. See [Singleton Module Pattern](#singleton-module-pattern) below.

If a part would need to manage its own pool, persistent client, or other lifecycle state, it does not belong in `parts/` - lift it into a separate helper module and depend on it via `Lib`.

### Folder Layout

```
[module-root]/
  [module].js              Main loader + createInterface
  [module].config.js
  [module].errors.js       Internal error catalog
  parts/
    [name-1].js            Each part is its own factory file
    [name-2].js
    [name-3].js
  _test/
```

### Uniform Loader Signature

**Every part loader — singleton or factory — always accepts `(shared_libs, config, errors)`.** This is a hard rule with no exceptions. It ensures the parent module can instantiate all parts with identical call sites and a new part can be added without touching existing call sites.

### Part Shape: Singleton or Factory

The loader signature is always the same. What differs is what happens inside:

| Shape | When to use | What the loader does |
|---|---|---|
| **Singleton** | Part needs no per-instance closure — all state is module-scope | Assigns to module-scope `let` vars, returns the module-scope public object directly |
| **Factory** | Part needs a per-instance closure (e.g. over per-call `CONFIG` slice, per-instance resource) | Calls `createInterface(Lib, CONFIG, ERRORS)` and returns the result |

### Singleton Part Shape

All three variables are declared at module scope and assigned in the loader, regardless of which are consumed today. Unused variables get `// eslint-disable-line no-unused-vars` inline. Remove the directive when a variable is first used.

> **This is different from the module-root singleton shape** (`[module].validators.js`). Module-root singletons inject only `Lib` and take no `CONFIG`/`ERRORS` because validators run before config is validated. Parts always accept all three for call-site uniformity.

```javascript
// Shared dependencies injected by loader (uniform parts signature)
let Lib;               // remove eslint comment when first used
let CONFIG;            // eslint-disable-line no-unused-vars
let ERRORS;            // eslint-disable-line no-unused-vars

module.exports = function loader (shared_libs, config, errors) {

  // Assign to module-scope vars so public and private objects can close over them
  Lib = shared_libs;
  CONFIG = config;
  ERRORS = errors;

  return PartName;

};

const PartName = {
  // ... methods close over module-scope Lib, CONFIG, ERRORS
};
```

### Factory Part Shape

When a part needs a per-instance closure:

```javascript
module.exports = function loader (shared_libs, config, errors) {
  return createInterface(shared_libs, config, errors);
};

const createInterface = function (Lib, CONFIG, ERRORS) {
  const PartName = {
    // ... methods close over Lib, CONFIG, ERRORS from this call
  };
  return PartName;
};
```

### Parent Loader Body

The parent module's `createInterface` (or its loader, before `createInterface` is invoked) builds a `Parts` object once per instance and threads it into every public method that needs it:

```javascript
const Parts = {
  RecordShape: require('./parts/record-shape')(Lib, CONFIG, ERRORS),
  AuthId:      require('./parts/auth-id')(Lib, CONFIG, ERRORS),
  Policy:      require('./parts/policy')(Lib, CONFIG, ERRORS),
  TokenSource: require('./parts/token-source')(Lib, CONFIG, ERRORS),
  Cookie:      require('./parts/cookie')(Lib, CONFIG, ERRORS),
  Jwt:         CONFIG.ENABLE_JWT ? require('./parts/jwt')(Lib, CONFIG, ERRORS) : null
};
```

Parts are **never exported** through the package's `exports` map. They are an internal organization technique - external consumers only ever see the parent module's public interface.

### Inter-Part Dependencies

If one part needs another, it `require`s the dependency itself with the **same** `(Lib, CONFIG, ERRORS)` signature. The parent loader treats every part as opaque and independent:

```javascript
// Inside parts/token-source.js
const Cookie = require('./cookie')(Lib, CONFIG, ERRORS);
```

This convention keeps the parent loader free of part-ordering knowledge. If the part graph ever becomes deep enough that this self-resolution feels fragile, the part is too large and should be split, lifted to a sibling helper, or merged back into the parent.

### Reference Implementation

The canonical example is `js-server-helper-auth` in `js-helper-modules`: six parts (auth-id, cookie, jwt, policy, record-shape, token-source) all consumed by `auth.js`. Validators live in the module-root singleton `auth.validators.js`, not in `parts/`.

---

## Singleton Module Pattern

Some modules are **stateless, pure, and globally shared**. They need no per-instance state, no per-caller config variation, and no lifecycle management. These modules use the singleton pattern: one object, one `let Lib;` injection, same reference everywhere.

> **Not the same as Legacy Pattern 1.** The old pattern (preserved in the appendix) also used module-level `let` variables but mutated them on every loader call, meaning the last caller's config won. The singleton pattern here injects `Lib` exactly once and never changes it. Node.js `require` caching guarantees the same module object is returned on every subsequent `require` call; the singleton is free.

### When To Use

Use the singleton pattern when **all four** of these are true:

| Criterion | Detail |
|---|---|
| **Stateless** | No per-instance resource, pool, client, connection, or mutable state |
| **Pure** | Every method takes inputs, returns a result or throws (no I/O, no side effects) |
| **Shared identity** | One instance is always correct. There is no architectural reason for two callers to have different instances |
| **No per-caller CONFIG** | All callers need the same behavior. `CONFIG` does not vary at runtime between callers |

**Do not use the singleton pattern when:**

- The module holds a DB connection pool, persistent client, or any per-instance resource → use the **factory pattern** with `state`
- Different callers legitimately need different `CONFIG` at runtime (different DB, different bucket, different queue) → use the **factory pattern**
- The module wraps a vendor SDK or driver → use the **factory pattern** with `ensureAdapter`
- The module is a `parts/` sub-module **and has at least one factory dependency** → use the factory `createInterface` shape (see [Part Shape: Singleton or Factory](#part-shape-singleton-or-factory))

### Three Singleton Subtypes

| Subtype | Shape | Examples |
|---|---|---|
| **Data-only** | Pure `module.exports = Object.freeze({...})`, no loader, no `let` variables | `[module].errors.js`, `[module].config.js` |
| **Lib-injected** | `let Lib;` at module scope, loader sets it once, public/private objects at module scope | `[module].validators.js` |
| **No-dep** | No `let` variables at all, no loader needed. Pure functions with zero external dependencies | `js-helper-utils` (upgrade candidate) |

### Canonical Shape: Main Module Singleton

This is the full shape for a main module file (`[module].js`) converted to singleton. It shows the complete declaration ordering and loader body.

```javascript
// Info: [What this singleton provides - 1 line]
// [Second line if needed]
//
// Singleton: Lib and CONFIG are injected once by the loader. Public and
// private objects are declared at module scope - Node.js require cache
// guarantees the same reference is returned on every subsequent require.
// No factory needed.
'use strict';


// Shared dependency injected by loader
let Lib;

// Domain config injected by loader
let CONFIG;

// Error catalog (frozen)
const ERRORS = require('./[module].errors'); // eslint-disable-line no-unused-vars

// Validators module (singleton, set by loader after Lib is available)
let Validators;

// [Module-specific data - loaded once at require time]
const [DATA] = require('./data/[name].json');


/////////////////////////// Module-Loader START ////////////////////////////////

/********************************************************************
Singleton loader. Injects Lib and CONFIG, initializes Validators,
and returns the module-scope [Name] object directly. Node.js require
cache guarantees a single instance across the process.

@param {Object} shared_libs - Lib container with Utils, Debug
@param {Object} config - Overrides merged over module config defaults

@return {Object} - Public [Name] interface
*********************************************************************/
module.exports = function loader (shared_libs, config) {

  // Inject shared dependencies
  Lib = {
    Utils: shared_libs.Utils,
    Debug: shared_libs.Debug
  };

  // Merge overrides over defaults
  CONFIG = Object.assign(
    {},
    require('./[module].config'),
    config || {}
  );

  // Initialize validators (needs Lib to be set first)
  Validators = require('./[module].validators')(Lib);

  // Validate config immediately so misconfiguration fails at startup
  Validators.validateConfig(CONFIG);

  return [Name];

};///////////////////////////// Module-Loader END ///////////////////////////////



///////////////////////////Public Functions START//////////////////////////////
const [Name] = {

  // ~~~~~~~~~~~~~~~~~~~~ [Subsection Name] ~~~~~~~~~~~~~~~~~~~~
  // One-line purpose of this subsection.

  /********************************************************************
  Function description.

  @param {Type} param - Description

  @return {void}
  *********************************************************************/
  methodName: function (param) {

    // Step comment
    _[Name].helperName(param);

  }

};///////////////////////////Public Functions END//////////////////////////////



///////////////////////////Private Functions START/////////////////////////////
const _[Name] = {

  /********************************************************************
  Private helper description.

  @param {Type} param - Description

  @return {void}
  *********************************************************************/
  helperName: function (param) {

    // Step comment
    if (Lib.Utils.isNullOrUndefined(param)) {
      throw new TypeError('[module-name] methodName param is required');
    }

  }

};//////////////////////////Private Functions END///////////////////////////////
```

Not every module uses every declaration. Omit any that do not apply — but preserve the relative order of those that remain. A module with no validators and no data files would declare only `Lib`, `CONFIG`, and `ERRORS`.

### Canonical Shape: Module-Root Singleton (Validators)

Module-root singletons (`[module].validators.js`) are a **special case** of the singleton pattern. They are singletons, but they do not follow the full main-module singleton shape. Key differences:

- **Accept only `Lib`** — no `CONFIG`, no `ERRORS`. Validators run before config is validated, so they cannot depend on a merged config object.
- **No config merging in the loader** — the loader is a single assignment (`Lib = shared_libs`) and a return.
- **No `validateConfig` call** — validators *are* the config validation; they cannot validate themselves.
- **No error catalog** — validators throw `TypeError` for programmer errors. They do not return operational error envelopes.

This shape should not be confused with the main-module singleton. It is a stripped-down, single-purpose pattern for config and input validation only.

```javascript
// Info: [What this singleton provides - 1 line]
//
// Singleton: Lib is injected once by the loader. No factory needed.
'use strict';


// Shared dependency injected by loader
let Lib;


/////////////////////////// Module-Loader START ////////////////////////////////

/********************************************************************
Singleton loader. Injects Lib and returns the module-scope [Name]
object. Takes only Lib — no CONFIG or ERRORS.

@param {Object} shared_libs - Dependency container (Utils)

@return {Object} - Public [Name] interface
*********************************************************************/
module.exports = function loader (shared_libs) {

  // Inject shared dependency
  Lib = shared_libs;

  return [Name];

};///////////////////////////// Module-Loader END ///////////////////////////////



///////////////////////////Public Functions START//////////////////////////////
const [Name] = {

  /********************************************************************
  Function description.

  @param {Type} param - Description

  @return {void}
  *********************************************************************/
  methodName: function (param) {

    // Step comment
    _[Name].helperName(param);

  }

};///////////////////////////Public Functions END//////////////////////////////



///////////////////////////Private Functions START/////////////////////////////
const _[Name] = {

  /********************************************************************
  Private helper description.

  @param {Type} param - Description

  @return {void}
  *********************************************************************/
  helperName: function (param) {

    // Step comment
    if (Lib.Utils.isNullOrUndefined(param)) {
      throw new TypeError('[module-name] methodName param is required');
    }

  }

};//////////////////////////Private Functions END///////////////////////////////
```

### Module-Scope Declaration Ordering

Module-scope declarations above the loader follow a fixed sequence. This mirrors the `createInterface` parameter ordering convention (internal-before-external) and ensures every module reads top-to-bottom in the same predictable order.

| Position | Declaration | Mutability | Present in |
|---|---|---|---|
| 1 | `let Lib` | Set once by loader | All modules except no-dep singletons |
| 2 | `let CONFIG` | Set once by loader | Main modules with config |
| 3 | `const ERRORS` | Loaded at require time, never reassigned | Main modules with error catalogs |
| 4 | `let Validators` | Initialized once by loader (needs Lib) | Main modules with validators |
| 5 | Module-specific data (`const [DATA]`) | Loaded at require time, never reassigned | Only modules that ship static reference data |

**Rules:**

- **Omit positions that do not apply** — a simple Lib-only singleton declares only position 1. A main module without data files declares positions 1-4. The relative order of those that remain is always preserved.
- **Common infrastructure before module-specific data** — positions 1-4 are the same across all modules. A developer scanning any singleton knows exactly where to find `Lib`, `CONFIG`, `ERRORS`, and `Validators`. Module-specific items (data files, cached adapter refs, etc.) come last because they vary per module.
- **Each declaration gets a one-line comment above it** — the comment describes what it is and how it is populated (injected by loader, loaded at require time, set by loader after Lib).

### Section Header Rules for Singletons

The same 3/2/1 spacing and banner rules from [`code-formatting-js.md`](../foundations/code-formatting-js.md) apply in full. Key differences from the factory shape:

| Element | Factory shape | Singleton shape |
|---|---|---|
| **Module-Loader body** | Builds `Lib`, `CONFIG`, `state`; calls `createInterface` | Sets `let Lib = shared_libs`; returns the module-scope public object directly |
| **`createInterface`** | Present (closes over `Lib`, `CONFIG`, `state`) | **Absent** (not needed; closures are replaced by module-scope `let Lib`) |
| **Public object** | Declared inside `createInterface` | Declared at **module scope**, after the loader section |
| **Private object** | Declared inside `createInterface` | Declared at **module scope**, after the public object |
| **3 blank lines** | Before `createInterface START` banner | Before `Public Functions START` banner (replaces `createInterface`) |

### Key Rules

| Rule | Detail |
|---|---|
| **`let Lib;` at module scope** | Declared above the loader with a one-line comment. No initializer (`undefined` until the loader runs) |
| **Loader sets `Lib` once** | `Lib = shared_libs;` is the only assignment. Never reassigned after the first call |
| **Loader returns the public object directly** | `return [Name];`, not `return createInterface(Lib)` |
| **Module-root vs parts singleton shape** | Module-root singletons (`[module].validators.js`) inject only `Lib` — they run before config is validated so `CONFIG`/`ERRORS` are not accepted. Parts singletons always accept all three `(shared_libs, config, errors)` for call-site uniformity. Do not conflate the two shapes. |
| **No `createInterface`** | Singletons have no factory wrapper. Public and private objects are declared at module scope |
| **Public before private, both at module scope** | Same order as inside `createInterface` in a factory: public first, private second |
| **Private helpers use module-scope `Lib`** | `_[Name].helper()` closes over `let Lib` directly, same as factory pattern closes over the `Lib` const inside `createInterface` |
| **File named `[module].[concern].js`** | Sits at the module root alongside `[module].config.js` and `[module].errors.js` |
| **Module-root singletons live at module root** | `[module].validators.js`, `[module].errors.js`, `[module].config.js` are module-root files. `parts/` sub-modules may also be singletons when their dependencies are singleton-eligible — see [Part Shape: Singleton or Factory](#part-shape-singleton-or-factory) |
| **Not part of the main module** | `[module].validators.js` is a separate file. Not inlined into `[module].js` or tucked into `_Auth`/`_Verify`. The main module's loader calls it and passes `Validators` in |

### Standard Files Using This Pattern

| File | Subtype | Notes |
|---|---|---|
| `[module].errors.js` | Data-only | Pure `Object.freeze({...})`, no loader |
| `[module].config.js` | Data-only | Pure `Object.assign({}, defaults)` export, no loader |
| `[module].validators.js` | Lib-injected | Config + options validators; `Lib.Utils` for type checks |

### Upgrade Candidates (Currently Factory, Should Become Singleton)

These modules are currently written as factories but meet all four singleton criteria. Each is a **breaking change** when converted. Treat each as its own versioned migration step, not a bulk change.

| Module | Why it qualifies | Migration notes |
|---|---|---|
| `js-helper-utils` | Zero dependencies, zero state, pure type-check functions. No valid reason for two separate instances. | No-dep singleton subtype; no `let Lib` needed at all |
| `js-helper-debug` | Pure structured logging. Config (`log_level`, `output_format`) is set once at app startup and never varies between callers at runtime. | Lib-injected singleton. `CONFIG` injected once via loader |
| `js-helper-time` | Pure date math + formatting. Uses only `Lib.Utils` and timezone config that is the same for all callers. | Lib-injected singleton. `CONFIG` injected once via loader |
| `js-server-helper-crypto` | Pure hashing/UUID/encoding functions. Uses `Lib.Utils` + config defaults that never vary per-caller. | Lib-injected singleton |
| `js-server-helper-instance` | Pure request lifecycle management. No held state; the per-request object is returned to the caller, never stored inside the module. | Lib-injected singleton |
| `js-server-helper-http` | `CONFIG` only holds `TIMEOUT` and `USER_AGENT`, both are app-wide constants. All per-call variation (auth headers, per-request timeout) is already passed via `options` params, not baked into `CONFIG`. No held state. | Lib-injected singleton |

**Do not convert:** all DB modules (`sql-*`, `nosql-*`), all cloud SDK modules (`storage-aws-*`, `queue-aws-*`), `js-server-helper-auth`, `js-server-helper-verify`, `js-server-helper-logger`, and all `*-store-*` adapters. These legitimately have per-caller `CONFIG` or per-instance state.

### Reference Implementations

- **Main module singleton (full shape):** `js-helper-money` in `js-helper-modules` (`money.js`)
- **Module-root singleton (validators, special case):** `js-server-helper-auth` in `js-helper-modules` (`auth.validators.js`)

---

## Adapter Pattern (Multi-Backend Helper Modules)

Some helper modules need to support multiple interchangeable backends - different databases, different transports, different key/value stores. The framework convention is to publish each backend as its **own standalone npm package**, and have the parent module accept the adapter factory directly via configuration.

### Naming

| Concept | Naming |
|---|---|
| Database-backed adapters | `[parent-module]-store-[backend]` (e.g. `js-server-helper-auth-store-postgres`) |
| Non-database adapters (HTTP-backed, IPC, etc.) | `[parent-module]-adapter-[name]` |
| The general concept | "Adapter". The word "store" is reserved for database backings |

For a parent module `js-server-helper-[X]` with multiple backends, ship `js-server-helper-[X]-store-[backend]` (or `-adapter-[name]`) packages alongside it.

### Factory Injection, Not String Dispatch

The parent module accepts the **adapter factory function itself** through `CONFIG.STORE`. There is no internal registry, no string-to-factory lookup, no `require()` of unused backends:

```javascript
// At the call site (loader.js or service wiring)
const Auth = require('@superloomdev/js-server-helper-auth')(Lib, {
  STORE: require('@superloomdev/js-server-helper-auth-store-postgres'),  // factory function
  STORE_CONFIG: { table_name: 'sessions_user', lib_sql: Lib.Postgres },
  ACTOR_TYPE: 'user',
  TTL_SECONDS: 2592000
});
```

This pattern has three concrete benefits:

1. **No dead requires.** The application bundle includes only the adapter package(s) actually used.
2. **No string-keyed registries.** Adding a new backend is a new package; the parent module's source never changes.
3. **Validation at loader time.** `validateConfig` checks `typeof CONFIG.STORE === 'function'` and throws if a string or `null` was passed - misconfiguration fails at startup, never on first request.

### Uniform Factory Signature for Adapters

Adapters use the same factory signature as parts: `(Lib, CONFIG, ERRORS)`. The parent module's loader narrows `Lib` to the dependencies it shares with adapters (typically `{ Utils, Debug, Crypto, Instance }`), forwards the merged `CONFIG` whole, and forwards its frozen `ERRORS` catalog so adapter return envelopes match the parent's contract:

```javascript
// Inside the parent loader, after building Lib + CONFIG + ERRORS
const store = CONFIG.STORE(Lib, CONFIG, ERRORS);
```

The adapter extracts its slice of `CONFIG` internally (`CONFIG.STORE_CONFIG.table_name`, `CONFIG.STORE_CONFIG.lib_sql`, etc.). Callers never pre-extract anything before passing `CONFIG`.

### Internal Error Catalog Forwarding

The parent module's error catalog is the **single source of truth** for the public envelope shape. Adapters must use the same catalog objects in their failure returns so envelopes are identical regardless of which backend is active. The catalog is forwarded as `ERRORS`; adapters never define their own envelope shapes.

This is the operational consequence of the wrapper-purity rule - see [`error-handling.md`](../foundations/error-handling#wrapper-purity-the-catalog-owns-the-envelope).

### Adapter Contract: Documented Method Set

Each parent module that uses the Adapter pattern publishes its **adapter contract** - the set of methods every adapter must implement. The contract lives in two places:

1. **Top-of-file comment** in the adapter source (e.g. `store.js`) listing every method, its signature, and its return shape.
2. **Store Contract table** in the adapter's `README.md`, repeated verbatim across all adapters for the same parent module.

When the parent module evolves the contract (adds a method, changes a return shape), every adapter updates synchronously - this is enforced via the shared contract test suite (see [`testing-strategy.md`](../testing/testing-strategy.md)).

### Where Store Instantiation Lives

The store is instantiated in the **loader**, not inside `createInterface`. This keeps `createInterface` a pure factory that only builds an interface from what it is given:

```javascript
// In the loader, after Validators.validateConfig(CONFIG)
const store = CONFIG.STORE(Lib, CONFIG, ERRORS);

// store is threaded into createInterface last — external dependency goes after
// all internally-assembled containers (Lib, CONFIG, ERRORS, Validators, Parts).
// See Parameter Ordering Convention above.
return createInterface(Lib, CONFIG, ERRORS, Validators, Parts, store);
```

Instantiating `store` inside `createInterface` instead is a structural error: `createInterface` would have a hidden side effect and could no longer be tested by passing a mock store directly.

### Reference Implementations

Several modules in `js-helper-modules` implement the full adapter pattern, each for a different kind of adapter:

- **Storage adapters** (`-store-[backend]`): `js-server-helper-auth` and `js-server-helper-verify` each ship a defined store contract and a matching set of storage adapters (one per backend: SQLite, Postgres, MySQL, MongoDB, DynamoDB). Refer to each module's `docs/api.md` for the current contract.
- **Transport adapters** (`-adapter-[name]`): `js-server-helper-http-gateway` ships a defined adapter contract and separate adapter packages per HTTP runtime (e.g. Express, AWS API Gateway). The parent module is runtime-agnostic; only the adapter knows the transport.

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

Vertical spacing rules (the 3/2/1 rule) are detailed in [`code-formatting-js.md`](../foundations/code-formatting-js.md).

---

## Standard Files Per Module

Most modules follow a consistent file structure:

| File | Purpose |
|---|---|
| `index.js` | Public export surface |
| `[name].js` | Main implementation |
| `[name].config.js` | Module-specific constants and defaults (optional) |
| `[name].errors.js` | **Required** - frozen error catalog for operational errors (see [Module Error File Policy](#module-error-file-policy)) |
| `[name].validators.js` | (Optional) Singleton validators module - see [Singleton Module Pattern](#singleton-module-pattern) |
| `data/` | (Optional) Static intrinsic reference data shipped with the module - see [Static Data Files](#static-data-files) |
| `package.json` | Module metadata and dependencies |
| `README.md` | Human documentation (badges, usage examples, testing guides) |
| `ROBOTS.md` | AI agent reference (compact, token-efficient) |
| `eslint.config.js` | **Required** - ESLint flat config (ESLint v9+). Canonical shape: refer to `js-helper-utils`. See [Linter Configuration](module-publishing.md#linter-configuration) |
| `.npmignore` | **Required** - controls what files are included in the published tarball. Canonical shape: refer to `js-helper-utils`. See [Registry Ignore File](module-publishing.md#registry-ignore-file-npmignore) |
| `_test/test.js` | Tests using `node --test` and `node:assert/strict` |
| `_test/loader.js` | Test loader (env reading, dep injection) - required for any module using DI |
| `_test/package.json` | Test-only dependencies, `private: true`, references module as `file:../` |
| `_test/mock-data/` | (Optional) JSON fixtures |
| `_test/docker-compose.yml` | (Service-dependent modules only) emulator definitions |
| `_test/ops/` | (Service-dependent modules only) testing setup runbook |
| `provider/` | (Optional) vendor-specific implementations |

### Module Error File Policy

Every module **must** include a `[name].errors.js` file to maintain consistency across the framework. This file contains the frozen error catalog for operational errors returned via `{success: false, error}` envelopes.

**Rules:**

| Module Type | Error File Content |
|---|---|
| **Complex server modules** (DB, cloud SDKs, HTTP, auth, logger, verify) | Full error catalog with all operational error types |
| **Simple server modules** (crypto, instance) | Empty frozen object (consistency placeholder) |
| **Core modules** (utils, debug, time) | Exempt - too simple, programmer errors only |
| **Client modules** | Include if module has operational errors; exempt if purely functional |

**Template for modules with operational errors:**
```javascript
'use strict';

/**
 * Error catalog for [module-name].
 * Operational errors returned via {success: false, error}.
 * Frozen to prevent accidental mutation.
 */

module.exports = Object.freeze({

  ERROR_NAME: Object.freeze({
    type: 'ERROR_NAME',
    message: 'Human-readable error description'
  })
  // ... more errors

});
```

**Template for simple modules (no operational errors):**
```javascript
'use strict';

/**
 * Error catalog for [module-name].
 * This module has no operational errors - programmer errors throw TypeError.
 * Empty frozen object provided for consistency across all server modules.
 * Frozen to prevent accidental mutation.
 */

module.exports = Object.freeze({
  // No operational errors defined
  // All failures are programmer errors that throw synchronously
});
```

See [error-handling.md](../foundations/error-handling) for full error handling patterns.

### Static Data Files

Some modules ship with **intrinsic reference data** - facts that are immutable, language-independent, and part of what the module *is*. Examples: ISO 4217 currency tables, ISO 3166 country codes, character-set tables, unit-conversion factors. When a module needs this kind of data, it lives in a `data/` directory at the module root.

```
[module-root]/
  [module].js
  [module].config.js
  [module].errors.js
  [module].validators.js
  data/
    [name].json
  _test/
```

**Rules:**

| Rule | Detail |
|---|---|
| **Intrinsic facts only** | Data files contain immutable, framework-neutral facts that ship as part of the module (e.g. `iso_alpha`, `iso_numeric`, `decimals` for a currency). Locale-specific names, country-to-language mappings, project-specific labels, or anything a consuming application might reasonably override do **not** belong here |
| **Required at module top-level** | `const DATA = require('./data/[name].json');` near the top of `[module].js` or `[module].validators.js`. Never injected through the loader signature - the data is part of the module's identity, not a per-instance dependency |
| **One concern per file** | Split independent data sets into separate files (`data/currencies.json`, `data/regions.json`) rather than one mega-file. Each file should answer one question |
| **Lowercase keys, snake_case fields** | Match the JavaScript convention used elsewhere in the framework. Keys are normalized (lowercased) currency / country / locale codes; field names use snake_case |
| **No code in `data/`** | Pure JSON only. Any transformation logic belongs in the module body or validators, not in the data file |
| **Plain JSON, no comments** | JSON files are loaded verbatim. If a fact needs explaining, document it in the module README under "Data Sources" or "Reference Data" |

**When to use a static data file vs. a separate helper module:**

- **Static data file** when the data is *small, intrinsic, and changes only when the underlying standard changes* (e.g. ISO 4217 revisions every few years). Ships with the module, versioned with the module.
- **Separate helper module** when the data is *large, dynamic, or has its own update cadence* (e.g. timezone database, IP-to-country mapping). Lives in its own module so it can be updated independently.

**Reference Implementation**

The `js-helper-money` module in `js-helper-modules` ships `data/currencies.json` with ISO codes, English names, symbols, decimal precision, and transactional units for each supported currency. Required inside `money.validators.js` at module load time.

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
| Coding standards (formatting, naming, JSDoc) | [`code-formatting-js.md`](../foundations/code-formatting-js.md) |
| Architectural philosophy | [`architectural-philosophy.md`](../foundations/architectural-philosophy.md) |
| Server bootstrap and DI | [`server-loader.md`](../server/server-loader.md) |
| Data philosophy | [`model-modules.md`](../server/model-modules.md) |
| Validation approach | [`validation-approach.md`](../foundations/validation-approach.md) |
| Error handling rules | [`error-handling.md`](../foundations/error-handling) |
| Module testing | [`module-testing.md`](../testing/module-testing.md) |
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

When migrating a Pattern 1 module to Pattern 2, treat it as a breaking change for that module. See [Reference Implementations](#reference-implementations) above.
