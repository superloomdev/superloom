# Module Structure

> **Language:** [JavaScript](module-structure-js)

A reference for how every module in Superloom is shaped: the standard application-module skeleton, the helper-module factory pattern, the model package index, and the server-extension merge mechanics. Use this when creating a new module or migrating an existing one.

## On This Page

- [Module Types Overview](#module-types-overview)
- [Application Module Pattern](#application-module-pattern)
- [Helper Module Pattern (Factory)](#helper-module-pattern-factory)
  - [Universal Companion Files](#universal-companion-files)
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
  - [Storage Adapter Skeleton](#storage-adapter-skeleton)
  - [Adapter Skeleton](#adapter-skeleton)
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

The canonical shape is a thin `loader` function that delegates to a `createInterface` factory. The loader stays minimal (merge config, wire companions, build state) and `createInterface` holds all public/private function bodies, where they close over `Lib`, `CONFIG`, `ERRORS`, `Validators`, and `state` without module-level globals.

### Universal Companion Files

**Every helper module ships all three companion files, even when a file has nothing to put in it yet.** This is a hard rule with no exceptions:

| File | Minimum content when empty | Loader wiring (always present) |
|---|---|---|
| `[module].config.js` | `module.exports = {};` | `const CONFIG = Object.assign({}, require('./[module].config'), config \|\| {});` |
| `[module].errors.js` | `module.exports = Object.freeze({});` | `const ERRORS = require('./[module].errors');` |
| `[module].validators.js` | Returns a Validators object with a no-op `validateConfig` | `const Validators = require('./[module].validators')(Lib, ERRORS);` |

**Rationale.** Extending a module with its first config key, error, or validator must never require refactoring the loader, the `createInterface` signature, or any call site - only filling in the already-wired file. Uniform signatures across every module also mean a developer or AI assistant scanning any loader sees the identical shape everywhere. An empty frozen object costs nothing at runtime.

**Single-require rule.** The main module file (`[module].js`) is the only file that may `require` the module's companion files and static data files (`data/*.json`). Everything else - validators, parts - receives them by injection from the loader:

- `ERRORS` is required once in `[module].js` and injected into the validators singleton and forwarded to `createInterface` - even when no interface function consumes it yet. Removing the parameter is a consistency violation, not a dead-code cleanup.
- Static reference data (`data/*.json`) is required once at module scope in `[module].js` and injected wherever needed (validators, parts). No other file requires it directly.
- `[module].validators.js` never self-requires the error catalog or data files. Node's require cache would make a second require harmless at runtime, but it hides the dependency from the loader's wiring, breaks the single-owner principle, and makes the injection graph unauditable.

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

  // Error catalog (frozen, owned by the main module)
  const ERRORS = require('./[module].errors');

  // Validators singleton - Lib, ERRORS, and any static data injected here
  const Validators = require('./[module].validators')(Lib, ERRORS);

  // Validate config immediately so misconfiguration fails at startup
  Validators.validateConfig(CONFIG);

  // Mutable per-instance state ([resource] lives here)
  const state = {
    [resource]: null
  };

  return createInterface(Lib, CONFIG, ERRORS, Validators, state);

};/////////////////////////// Module-Loader END /////////////////////////////////
```

### createInterface

```javascript
/////////////////////////// createInterface START //////////////////////////////

/********************************************************************
Builds the public interface for one instance. Public and private
functions close over the provided Lib, CONFIG, ERRORS, Validators,
and state.

@param {Object} Lib - Dependency container (Utils, Debug)
@param {Object} CONFIG - Merged configuration for this instance
@param {Object} ERRORS - Frozen error catalog (kept in scope even when
                         only validators consume it today - see
                         Universal Companion Files)
@param {Object} Validators - Validators singleton (Lib + ERRORS injected)
@param {Object} state - Mutable state holder (e.g. resource reference)

@return {Object} - Public interface for this module
*********************************************************************/
const createInterface = function (Lib, CONFIG, ERRORS, Validators, state) {

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

**The first four slots are fixed and always present**: every factory module's `createInterface` takes `(Lib, CONFIG, ERRORS, Validators, ...)` regardless of whether every slot is consumed today. Only the trailing slots (`Parts`, `store`/`adapter`/`state`) vary by module shape. This follows directly from [Universal Companion Files](#universal-companion-files) - since every module ships config, errors, and validators, every module wires them.

| Signature | Use when | Reference |
|---|---|---|
| `createInterface(Lib, CONFIG, ERRORS, Validators)` | Stateless helper - no per-instance resource, no parts, no external dependency | `js-helper-money`, `js-helper-time`, `js-server-helper-crypto`, `js-server-helper-http`, `js-server-helper-instance` |
| `createInterface(Lib, CONFIG, ERRORS, Validators, state)` | Stateful helper - holds a per-instance resource (pool, persistent client, authenticated session) | `js-server-helper-sql-mysql`, `js-server-helper-nosql-aws-dynamodb` |
| `createInterface(Lib, CONFIG, ERRORS, Validators, store)` | Domain helper with adapter pattern - externally-supplied store, no parts | `js-server-helper-verify` |
| `createInterface(Lib, CONFIG, ERRORS, Validators, Parts, adapter)` | Domain helper with parts + externally-supplied adapter | _(use `js-server-helper-auth` as the closest shape)_ |
| `createInterface(Lib, CONFIG, ERRORS, Validators, Parts, store)` | Domain helper with adapter pattern + decomposed parts (fullest shape) | `js-server-helper-auth` |

> Standalone store adapters (`[parent]-store-[backend]`) follow the same fixed-slots rule - they own their own `Lib`, `CONFIG`, `ERRORS`, and `Validators`. See [Storage Adapter Skeleton](#storage-adapter-skeleton).

> **Unused fixed slots are kept, not removed.** When a module has an empty error catalog or a no-op validators file, the parameters stay in the signature. If a trailing parameter is unused, suppress the lint warning with `// eslint-disable-line no-unused-vars` on the `createInterface` line (the `after-used` ESLint setting already ignores unused params that precede a used one). Remove the directive the day the parameter is first consumed. `js-server-helper-crypto` is the reference precedent: its `ERRORS` catalog is empty, forwarded anyway, with a JSDoc note explaining it is kept for cross-module consistency.

> **Legacy minimal shapes are deprecated.** Older modules with `createInterface()`, `createInterface(CONFIG)`, or `createInterface(Lib, CONFIG)` are brought to the fixed-slots shape during their unification pass.

The loader body always builds all four fixed parameters, then any trailing ones the module shape needs.

### Parameter Casing Convention

Parameters passed to `createInterface` (and to module loaders in general) follow a strict casing rule based on what the parameter represents:

| Parameter kind | Casing | Rationale | Examples |
|---|---|---|---|
| **Internally-assembled namespaced containers** - bags of named keys built by this module's own loader | `PascalCase` | These are namespaces, not scalars. PascalCase signals "look inside for named sub-things" | `Lib`, `CONFIG`, `ERRORS`, `Parts`, `Validators` |
| **Externally-supplied resolved dependencies** - a single instance of a contract, obtained from outside via config | `camelCase` | These are resolved objects, not namespaces. `camelCase` signals "this is one specific thing that implements a contract" | `store`, `adapter`, `state` |

**Why `store` and `adapter` are lowercase - and why that is intentional:**

`store` is a ready-to-use store object received via `CONFIG.Store` (the caller loads the adapter, then passes the resulting object in). The module did not build this object from its own parts; the caller chose the adapter and injected the resulting store through config. It is the module's external boundary - the one thing it cannot reason about internally. Lowercase signals: *"this came from outside; we hold it but we did not build it."*

This is the same reason `state` is lowercase in simpler stateful modules: `state` is a mutable container, not a named namespace.

### Parameter Ordering Convention

Parameters follow **internal-before-external** ordering. The full ordering rule:

```
createInterface(Lib, CONFIG, ERRORS, Validators, [Parts,] [store | adapter | state])
```

1. **`Lib`** - always first; the shared dependency container
2. **`CONFIG`** - always second; merged runtime configuration
3. **`ERRORS`** - always third; frozen error catalog (empty object when the module has no errors yet)
4. **`Validators`** - always fourth; internally-built singleton from `[module].validators.js` (no-op when the module has nothing to validate yet)
5. **`Parts`** - fifth when present; internally-built container of `parts/` sub-modules
6. **`store` / `adapter` / `state`** - always last; the externally-supplied or mutable resource

The rule is: **everything the module built for itself comes before the one thing that was handed to it from outside.** This makes the signature self-documenting - a reader scanning the parameter list sees the module's own infrastructure first and the external dependency at the end.

Only the trailing slots vary:

```javascript
// No Parts, no external dependency - the four fixed slots
createInterface(Lib, CONFIG, ERRORS, Validators)

// With per-instance state
createInterface(Lib, CONFIG, ERRORS, Validators, state)

// With store but no Parts (verify)
createInterface(Lib, CONFIG, ERRORS, Validators, store)

// With Parts and store (auth - fullest shape)
createInterface(Lib, CONFIG, ERRORS, Validators, Parts, store)
```


### Required Rules

| Rule | Detail |
|---|---|
| **Cached adapters at module scope** | `let [AdapterRef] = null;` declared above the loader. A descriptive comment explains each cached reference and why it is shared across instances |
| **Config defaults inlined in the loader** | Use `require('./[module].config')` as one of the operands of `Object.assign` - no top-level `const CONFIG_DEFAULTS` |
| **Canonical loader body** | Loader does exactly these jobs in order: build `Lib`, build merged `CONFIG`, require `ERRORS`, build `Validators` (injecting `Lib`, `ERRORS`, and any static data), call `Validators.validateConfig(CONFIG)`, build mutable `state` (stateful modules only). Then call `createInterface(Lib, CONFIG, ERRORS, Validators[, state])` and return the result |
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
  [module].validators.js   Validators singleton (Lib + ERRORS injected)
  parts/
    [name-1].js            Each part is its own factory file
    [name-2].js
    [name-3].js
  _test/
```

### Uniform Loader Signature

**Every part loader - singleton or factory - always accepts `(shared_libs, config, errors)`.** This is a hard rule with no exceptions. It ensures the parent module can instantiate all parts with identical call sites and a new part can be added without touching existing call sites.

### Part Shape: Singleton or Factory

The loader signature is always the same. What differs is what happens inside:

| Shape | When to use | What the loader does |
|---|---|---|
| **Singleton** | Part needs no per-instance closure - all state is module-scope | Assigns to module-scope `let` vars, returns the module-scope public object directly |
| **Factory** | Part needs a per-instance closure (e.g. over per-call `CONFIG` slice, per-instance resource) | Calls `createInterface(Lib, CONFIG, ERRORS)` and returns the result |

### Singleton Part Shape

All three variables are declared at module scope and assigned in the loader, regardless of which are consumed today. Unused variables get `// eslint-disable-line no-unused-vars` inline. Remove the directive when a variable is first used.

> **This is different from the module-root singleton shape** (`[module].validators.js`). Module-root singletons inject `(Lib, ERRORS[, static data])` and take no `CONFIG` because validators run before config is validated. Parts always accept all three `(shared_libs, config, errors)` for call-site uniformity.

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

**Factory pattern is the default for all modules** except in rare cases where all criteria are met. Use the singleton pattern only when **all five** of these are true:

| Criterion | Detail |
|---|---|
| **Stateless** | No per-instance resource, pool, client, connection, or mutable state |
| **Pure** | Every method takes inputs, returns a result or throws (no I/O, no side effects) |
| **Shared identity** | One instance is always correct. There is no architectural reason for two callers to have different instances |
| **No per-caller CONFIG** | All callers need the same behavior. `CONFIG` does not vary at runtime between callers |
| **No external dependencies** | Module takes no `shared_libs`, `config`, or other injected dependencies that need test isolation |

**Always use the factory pattern when:**

- The module holds a DB connection pool, persistent client, or any per-instance resource → use the **factory pattern** with `state`
- Different callers legitimately need different `CONFIG` at runtime (different DB, different bucket, different queue) → use the **factory pattern**
- The module wraps a vendor SDK or driver → use the **factory pattern** with `ensureAdapter`
- The module is a `parts/` sub-module **and has at least one factory dependency** → use the factory `createInterface` shape (see [Part Shape: Singleton or Factory](#part-shape-singleton-or-factory))
- **The module takes any external dependencies** (libs, config, adapters) → use the **factory pattern** for test isolation

### Testability Considerations

**Factory pattern enables proper test isolation:**
- Each test can create independent instances with different configurations
- Tests can run in parallel without conflicting global state
- Mock dependencies can be injected per test
- Multiple instances can coexist for different test scenarios

**Singleton pattern creates testing problems:**
- Global state makes test isolation impossible
- Last test's configuration affects subsequent tests
- Cannot run tests in parallel
- Difficult to mock dependencies per test

### Three Singleton Subtypes

| Subtype | Shape | Examples |
|---|---|---|
| **Data-only** | Pure `module.exports = Object.freeze({...})`, no loader, no `let` variables | `[module].errors.js`, `[module].config.js` |
| **Lib-injected** | `let Lib;` (plus `let ERRORS;` for validators) at module scope, loader sets them once, public/private objects at module scope | `[module].validators.js`, `js-server-helper-http-gateway` |
| **Loader-initialized** | `let Validators;` at module scope, loader initializes internal singletons and returns the module-scope public object. No external `Lib` or `CONFIG` dependencies | `js-helper-utils` |

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

// Error catalog (frozen, owned by this module - injected into validators)
const ERRORS = require('./[module].errors');

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

  // Initialize validators (needs Lib to be set first; ERRORS and static data injected)
  Validators = require('./[module].validators')(Lib, ERRORS);

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

Every module declares positions 1-4 (`Lib`, `CONFIG`, `ERRORS`, `Validators`) - the companion files always exist per [Universal Companion Files](#universal-companion-files). Only module-specific data declarations (position 5) are omitted when the module ships no static data. The relative order of declarations is always preserved.

### Canonical Shape: Module-Root Singleton (Validators)

Module-root singletons (`[module].validators.js`) are a **special case** of the singleton pattern. They are singletons, but they do not follow the full main-module singleton shape. Key differences:

- **Accept `(Lib, ERRORS[, static data])`** - no `CONFIG`. Validators run before config is validated, so they cannot depend on a merged config object. When a per-call validator needs config values, the caller passes `CONFIG` as a per-call argument.
- **Everything is injected, nothing self-required** - the main module's loader owns the single `require` of the error catalog and any static data files, and injects them here. Validators never `require('./[module].errors')` or `require('./data/*.json')` themselves. See [Universal Companion Files](#universal-companion-files).
- **No config merging in the loader** - the loader assigns the injected values to module-scope `let` variables and returns.
- **No `validateConfig` self-call** - validators *are* the config validation; they cannot validate themselves.
- **Two error styles** - validators throw `TypeError` for programmer errors (bad arguments). Domain-style validators return `false` on success or an array of error objects from the injected `ERRORS` catalog on failure. See [`validation-approach.md`](../foundations/validation-approach.md).

This shape should not be confused with the main-module singleton. It is a stripped-down, single-purpose pattern for config and input validation only.

> **Store / adapter contract validation belongs here too.** A module that accepts an externally-supplied `store` (via `CONFIG.Store`) or `adapter` (via `CONFIG.Adapter`) adds a contract validator method to its validators singleton. Call it `validateStoreContract(store)` or `validateAdapterContract(adapter)` depending on which dependency the module receives.
>
> The loader calls this method once, immediately after receiving the ready-to-use store or adapter object. This ensures a backend missing a required method fails fast at boot instead of on the first live request.
>
> Like `validateConfig`, a contract validator throws `Error` because a missing method is a setup error, not a programmer call error. Use the canonical message format: `[module-name] Invalid store contract: missing method [name]`.
>
> Only **required** methods belong in the contract list. Optional maintenance methods such as `setupNewStore` or `cleanupExpired*` keep their call-time `isFunction` guards. Do not list them in the contract validator.
>
> **When an optional method is absent, the guard no-ops with `{ success: true }`** - never a throw, never an error envelope. Absence is a documented backend property (native TTL instead of cron cleanup, operator-provisioned schema instead of `setupNewStore`), not a runtime failure. Callers stay backend-agnostic: a setup script or cron calls the method unconditionally and never branches on which backend is installed. The backend's own `docs/` (schema, cleanup) state what the method does or why it is not needed there.
>
> Reference implementations: `js-server-helper-http-gateway` (adapter), `js-server-helper-auth` / `js-server-helper-verify` / `js-server-helper-logger` (store).

```javascript
// Info: [What this singleton provides - 1 line]
//
// Singleton: Lib and ERRORS are injected once by the loader. No factory needed.
'use strict';


// Shared dependencies injected by loader - never self-required
let Lib;
let ERRORS;


/////////////////////////// Module-Loader START ////////////////////////////////

/********************************************************************
Singleton loader. Injects Lib and ERRORS and returns the module-scope
[Name] object. Takes no CONFIG - validators run before config is
validated; per-call validators receive CONFIG as an argument.

@param {Object} shared_libs - Dependency container (Utils)
@param {Object} errors - Frozen error catalog owned by the main module

@return {Object} - Public [Name] interface
*********************************************************************/
module.exports = function loader (shared_libs, errors) {

  // Inject shared dependencies
  Lib = shared_libs;
  ERRORS = errors;

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
| 1 | `let Lib` | Set once by loader | All modules except loader-initialized singletons (e.g. `js-helper-utils`) |
| 2 | `let CONFIG` | Set once by loader | All main modules ([Universal Companion Files](#universal-companion-files)) |
| 3 | `const ERRORS` | Loaded at require time, never reassigned | All main modules ([Universal Companion Files](#universal-companion-files)) |
| 4 | `let Validators` | Initialized once by loader (needs Lib) | All main modules ([Universal Companion Files](#universal-companion-files)) |
| 5 | Module-specific data (`const [DATA]`) | Loaded at require time, never reassigned | Only modules that ship static reference data |

**Rules:**

- **Main modules declare all of positions 1-4** - the companion files always exist. Only sub-module singletons (validators themselves, parts) declare the narrower shapes their own loaders receive.
- **Common infrastructure before module-specific data** - positions 1-4 are the same across all modules. A developer scanning any singleton knows exactly where to find `Lib`, `CONFIG`, `ERRORS`, and `Validators`. Module-specific items (data files, cached adapter refs, etc.) come last because they vary per module.
- **Single-require rule** - `const ERRORS` and `const [DATA]` requires appear only in the main module file. Validators and parts receive these values by injection, never by their own `require`.
- **Each declaration gets a one-line comment above it** - the comment describes what it is and how it is populated (injected by loader, loaded at require time, set by loader after Lib).

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
| **Module-root vs parts singleton shape** | Module-root singletons (`[module].validators.js`) inject `(Lib, ERRORS[, static data])` - they run before config is validated so `CONFIG` is not accepted (it is passed per-call where needed). Parts singletons always accept all three `(shared_libs, config, errors)` for call-site uniformity. Do not conflate the two shapes. |
| **No `createInterface`** | Singletons have no factory wrapper. Public and private objects are declared at module scope |
| **Public before private, both at module scope** | Same order as inside `createInterface` in a factory: public first, private second |
| **Private helpers use module-scope `Lib`** | `_[Name].helper()` closes over `let Lib` directly, same as factory pattern closes over the `Lib` const inside `createInterface` |
| **File named `[module].[concern].js`** | Sits at the module root alongside `[module].config.js` and `[module].errors.js` |
| **Module-root singletons live at module root** | `[module].validators.js`, `[module].errors.js`, `[module].config.js` are module-root files. `parts/` sub-modules may also be singletons when their dependencies are singleton-eligible - see [Part Shape: Singleton or Factory](#part-shape-singleton-or-factory) |
| **Not part of the main module** | `[module].validators.js` is a separate file. Not inlined into `[module].js` or tucked into `_Auth`/`_Verify`. The main module's loader calls it and passes `Validators` in |
| **Never self-require companions or data** | Validators receive `ERRORS` and static data by injection from the main module's loader. Only `[module].js` requires `[module].errors.js` and `data/*.json` - see [Universal Companion Files](#universal-companion-files) |

### Standard Files Using This Pattern

| File | Subtype | Notes |
|---|---|---|
| `[module].errors.js` | Data-only | Pure `Object.freeze({...})`, no loader |
| `[module].config.js` | Data-only | Pure `Object.assign({}, defaults)` export, no loader |
| `[module].validators.js` | Lib-injected | Config + options validators; `Lib.Utils` for type checks; `ERRORS` and static data injected by the main module's loader |

### Singleton Reference Example

**`js-helper-utils`** serves as the reference implementation for the singleton pattern:

- **Zero external dependencies** - pure utility functions with no injected libs or config
- **No configuration needed** - same behavior for all callers in all scenarios  
- **Pure functions** - type checks, validation, and data manipulation utilities
- **No state** - each function operates only on its inputs and returns a result
- **Test-friendly** - as a singleton, it can be safely used across all tests without isolation issues

This module demonstrates the rare case where singleton pattern is appropriate: a foundational utility library with no external dependencies that provides identical behavior for all callers.

**All other modules should use the factory pattern** to maintain testability and configuration flexibility.

### Reference Implementations

- **Main module singleton (reference example):** `js-helper-utils` in `js-helper-modules` (`utils.js`)
- **Module-root singleton (validators, special case):** `js-server-helper-auth` in `js-helper-modules` (`auth.validators.js`)
- **Factory pattern (standard for most modules):** `js-helper-money` in `js-helper-modules` (`money.js`)

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

### Independent Adapter Modules

Each store adapter is a **fully independent module** that owns its own `Lib`, `CONFIG`, and `ERRORS`. The adapter receives dependency injection at load time and returns a **ready-to-use store object** that the parent consumes directly. There is no internal registry, no string-to-factory lookup, no `require()` of unused backends:

```javascript
// At the call site (loader.js or service wiring)
// 1. Load the adapter first - it builds its own Lib, CONFIG, and ERRORS
const Store = require('@superloomdev/[parent]-store-[backend]')(Lib, {
  // adapter-specific config keys
});

// 2. Pass the ready-to-use store object to the parent
const Parent = require('@superloomdev/[parent]')(Lib, {
  Store: Store,  // Ready-to-use store object, not a factory
  // ... other parent config
});
```

`CONFIG.Store` is a **ready-to-use store object** returned by the adapter. The parent uses it directly - no `Lib` or `ERRORS` forwarding, no factory call. The adapter owns its own configuration internally, like any standalone module. The **only coupling point** between parent and adapter is the **return contract** (method names + return shapes).

This pattern has four concrete benefits:

1. **No dead requires.** The application bundle includes only the adapter package(s) actually used.
2. **No string-keyed registries.** Adding a new backend is a new package; the parent module's source never changes.
3. **Validation at loader time.** The adapter validates its own config at construction, and the parent validates the store contract - misconfiguration fails at startup, never on first request.
4. **True decoupling.** Parent and adapter share only the return contract. The adapter can evolve its internals (error types, internal Lib structure) without affecting the parent.

### Adapter Architecture

The adapter is a standalone module that builds its own `Lib` from injected `shared_libs`, defines its own `CONFIG` with its own config keys, and owns its own `ERRORS` catalog. The parent receives the ready-to-use store object and never forwards `Lib` or `ERRORS` to the adapter.

```javascript
// Adapter loader - fully independent
module.exports = function loader (shared_libs, config) {

  // Build own Lib (not received from parent)
  const Lib = {
    Utils: shared_libs.Utils,
    Debug: shared_libs.Debug,
    [Driver]: shared_libs.[Driver]  // backend driver from the Lib container
  };

  // Merge own config with own defaults
  const CONFIG = Object.assign(
    {},
    require('./store.config'),  // Adapter's own config keys
    config || {}
  );

  // Load own error catalog (not from parent)
  const ERRORS = require('./store.errors');

  // Validate at construction (ERRORS injected - never self-required by validators)
  const Validators = require('./store.validators')(Lib, ERRORS);
  Validators.validateConfig(CONFIG);

  // Return ready-to-use store
  return createInterface(Lib, CONFIG, ERRORS, Validators);
};
```

**The Contract (only coupling point):**

| Return Shape | Meaning |
|---|---|
| `{ success: true, ... }` | Operation succeeded |
| `{ success: false, error: { type, message } }` | Operation failed |

Error types are adapter-defined; the parent forwards them transparently.

> **Adapter-internal structure is documented separately** (see [Storage Adapter Skeleton](#storage-adapter-skeleton)). This section covers only the parent-facing contract.

### Adapter Error Catalogs

Each adapter module **owns its own error catalog** (`store.errors.js`). The parent does not forward its ERRORS to the adapter; instead, the adapter defines its own operational error types that are specific to its backend.

```javascript
// store.errors.js - adapter's own error catalog
module.exports = Object.freeze({
  SERVICE_UNAVAILABLE: Object.freeze({
    type: '[PARENT]_[BACKEND]_SERVICE_UNAVAILABLE',
    message: '[Backend] storage unavailable'
  })
});
```

The parent forwards adapter errors transparently. Service-layer code can branch on the `error.type` field, which is prefixed with the adapter's module short-name so it is unambiguous in logs. Both parent and adapter follow the same envelope shape (`{ success: false, error: { type, message } }`), but the error types are adapter-defined.

This maintains wrapper purity (the catalog owns the envelope) while allowing true decoupling between parent and adapter. See [`error-handling.md`](../foundations/error-handling#wrapper-purity-the-catalog-owns-the-envelope).

### Adapter Contract: Documented Method Set

Each parent module that uses the Adapter pattern publishes its **adapter contract** - the set of methods every adapter must implement. The contract lives in two places:

1. **Top-of-file comment** in the adapter source (e.g. `store.js`) listing every method, its signature, and its return shape.
2. **Store Contract table** in the adapter's `README.md`, repeated verbatim across all adapters for the same parent module.

When the parent module evolves the contract (adds a method, changes a return shape), every adapter updates synchronously - this is enforced via the shared contract test suite (see [`testing-strategy.md`](../testing/testing-strategy.md)).

### Where Store Lives in the Parent

The store is received by the parent as a **ready-to-use object** via `CONFIG.Store`. The parent validates the store contract and uses it directly:

```javascript
// In the parent loader
// CONFIG.Store is a ready-to-use store object (already instantiated by adapter)
const store = CONFIG.Store;

// Validate contract (optional but recommended)
Validators.validateStoreContract(store);

// store is threaded into createInterface last - external dependency goes after
// all internally-assembled containers (Lib, CONFIG, ERRORS, Validators, Parts).
// See Parameter Ordering Convention above.
return createInterface(Lib, CONFIG, ERRORS, Validators, Parts, store);
```

The parent never instantiates the store; it receives it already configured from the adapter. This keeps parent and adapter decoupled.

### Storage Adapter Skeleton

Storage adapters (`-store-[backend]`) are **fully independent modules**. They own their own `Lib`, `CONFIG`, and `ERRORS`, and return a ready-to-use store object.

#### Adapter File Structure

```
[module-root]/
  store.js                 # Main loader + createInterface
  store.config.js          # Adapter-specific config keys
  store.errors.js          # Adapter's own frozen error catalog
  store.validators.js      # Singleton validators (Lib-injected)
  _test/
    loader.js              # Test loader - builds Lib, loads adapter
    test.js                # Contract + integration tests
  README.md, ROBOTS.md     # Documentation
```

#### Adapter Loader Pattern

```javascript
// Info: [Backend] store adapter for [parent-module].
// Implements the [N]-method store contract.
//
// The adapter owns its own Lib, CONFIG, and ERRORS. Returns a ready-to-use
// store object that the parent consumes via CONFIG.Store.
//
// Store contract:
//   - method1(instance, ...) -> { success, error }
//   - method2(instance, ...) -> { success, data, error }
//   ...
//
// Compatibility: Node.js 24+
'use strict';


/////////////////////////// Module-Loader START ////////////////////////////////

/********************************************************************
Thin loader. Builds own Lib and ERRORS from peer dependencies,
validates config via the Validators singleton, then delegates to
createInterface. Each call returns an independent Store instance.

@param {Object} config - { table_name, lib_dynamodb } (backend-specific)

@return {Object} - Store interface (contract methods + optional setupNewStore)
*********************************************************************/
module.exports = function loader (config) {

  // Build own Lib container from peer dependencies
  const Lib = {};
  Lib.Utils = require('helper-utils')(Lib, {});
  Lib.Debug = require('helper-debug')(Lib, {});

  // Own frozen error catalog
  const ERRORS = require('./store.errors');

  // Load the validators singleton and inject Lib + ERRORS
  const Validators = require('./store.validators')(Lib, ERRORS);

  // Validate config - throws on misconfiguration
  Validators.validateConfig(config);

  // Build the public Store interface
  return createInterface(Lib, config, ERRORS, Validators);

};/////////////////////////// Module-Loader END /////////////////////////////////



/////////////////////////// createInterface START //////////////////////////////

/********************************************************************
Builds the public Store interface. All functions close over
Lib, config, ERRORS, and Validators.

@param {Object} Lib    - Dependency container
@param {Object} config - Adapter configuration (validated)
@param {Object} ERRORS - Frozen error catalog
@param {Object} Validators - Validators singleton (Lib + ERRORS injected)

@return {Object} - Store interface
*********************************************************************/
const createInterface = function (Lib, config, ERRORS, Validators) {

  //////////////////////////// Public Functions START //////////////////////////
  const Store = {

    /********************************************************************
    Contract method.

    @param {Object} instance - Request instance
    @param {...}    ...     - Method-specific params

    @return {Promise<Object>} - { success, error } or { success, data, error }
    *********************************************************************/
    methodName: async function (instance) {
      // Implementation using Lib.[Driver]
      // Return ERRORS.SERVICE_UNAVAILABLE on driver failure
    }

  };/////////////////////////// Public Functions END ///////////////////////////



  //////////////////////////// Private Functions START ///////////////////////////
  const _Store = {

    logDriverFailure: function (method, driver_error) {
      Lib.Debug.debug('[' + CONFIG.[STORE_NAME] + '] ' + method + ' failed', {
        type: 'DRIVER_ERROR',
        driver_message: driver_error.message
      });
    }

  };/////////////////////////// Private Functions END //////////////////////////


  return Store;

};/////////////////////////// createInterface END //////////////////////////////
```

#### Adapter Config Pattern

```javascript
// store.config.js - adapter's own config keys
'use strict';

module.exports = {
  [STORE_NAME]: null,   // Required - backend storage target (table/collection name)
  // ... other backend-specific keys, with safe defaults where applicable
};
```

**Driver-injection key naming.** The config key that receives the loaded driver helper is named by the operation family, not the dialect, wherever the injected contract is family-generic: SQL-backed stores take `lib_sql` (any `helper-sql-*` dialect satisfies it - this is what makes the dialect hot-swappable). NoSQL and cloud backends take the backend-specific key (`lib_mongodb`, `lib_dynamodb`) because those driver APIs are not interchangeable. Never build the driver into the adapter's own `Lib` container - it arrives through config.

#### Adapter Rules

| Rule | Detail |
|---|---|
| **Own Lib** | Build from `shared_libs` in loader; narrow to required dependencies |
| **Own CONFIG** | Merge `config` over `require('./store.config')` defaults |
| **Own ERRORS** | Load from `store.errors.js`; never receive from parent |
| **Ready-to-use return** | Return store object directly, not a factory |
| **Parent receives via CONFIG.Store** | Parent passes store object in config, not a factory |
| **Implements store contract** | Same method set across all sibling adapters |
| **`Lib.Utils` for type checks** | No inline `typeof`; use `Lib.Utils.isString`, etc. |
| **Public before private** | `Store` declared before `_Store` |
| **Driver errors -> SERVICE_UNAVAILABLE** | Log via `Lib.Debug.debug`, return `ERRORS.SERVICE_UNAVAILABLE` |

#### Parent Usage Pattern

```javascript
// Application loader
const Store = require('@superloomdev/[parent]-store-[backend]')(Lib, {
  // adapter-specific config keys
});

Lib.[Parent] = require('@superloomdev/[parent]')(Lib, {
  Store: Store  // Ready-to-use object
});
```

**Reference implementations:** `js-server-helper-distinct-queue-store-dynamodb`, `js-server-helper-distinct-queue-store-mongodb`.

### Adapter Skeleton

This skeleton applies to any Class F adapter (`-adapter-[name]`) that is **stateless** - it has no per-instance configuration and all per-request state lives on `instance`, not inside the adapter. This covers transport adapters (HTTP runtimes), integration adapters (notification channels, queue consumers), and any future adapter type that does not need per-instance closures. Like store adapters, a singleton adapter is loaded by the application and passed to the parent as a ready-to-use object via `CONFIG.Adapter`.

**When to use singleton vs factory for adapters:**

```
Does the adapter need per-instance configuration (its own config slice, driver reference, connection)?
├─ Yes → Use the Storage Adapter Skeleton (factory/createInterface)
└─ No  → Use this skeleton (singleton)
         The adapter is stateless; one global instance serves all callers.
         All per-request state lives on `instance`.
```

Stores (`-store-`) are almost always factory because each instance closes over its own configuration. Adapters (`-adapter-`) are more commonly singleton, but can use factory if a future use case requires per-instance adapter config.

```javascript
// Info: [Runtime] adapter for js-server-helper-[parent].
// [Description of what this adapter normalizes.]
//
// Adapter contract:
//   - method1(instance, raw_request, raw_context, response_callback)
//   - method2(status, headers, body) -> Object
//   - method3(instance) -> String | null
//
// Compatibility: Node.js 24+
'use strict';


// Shared dependency container injected by loader
let Lib;


/////////////////////////// Module-Loader START ////////////////////////////////

/********************************************************************
Singleton loader. The application loads the adapter once and passes the
returned object to the parent via CONFIG.Adapter. The adapter receives
raw inputs and returns normalized data to the parent, which owns instance
writes.

@param {Object} shared_libs - Lib container (Utils, Debug)

@return {Object} - Adapter interface (ready to use)
*********************************************************************/
module.exports = function loader (shared_libs) {

  Lib = shared_libs;

  return Adapter;

};///////////////////////////// Module-Loader END ///////////////////////////////



///////////////////////////Public Functions START//////////////////////////////
const Adapter = {

  /********************************************************************
  [Contract method description]

  @param {Object} instance - Per-request instance to populate
  *********************************************************************/
  contractMethod: function (instance) {
    // Public functions use Lib.Utils for type checks
    // Call _Adapter helpers for internal logic
  }

};////////////////////////////Public Functions END//////////////////////////////



///////////////////////////Private Functions START/////////////////////////////
const _Adapter = {

  /********************************************************************
  [Private helper description]

  @param {String} input - Description
  @return {Object} - Description
  *********************************************************************/
  helperMethod: function (input) {
    // Private functions also use Lib.Utils
    if (!Lib.Utils.isString(input)) {
      return {};
    }
    // ...
  }

};///////////////////////////Private Functions END//////////////////////////////
```

**Key rules for singleton adapters:**

| Rule | Detail |
|---|---|
| **Module-scope singleton** | `let Lib;` at module scope, set once by loader. No `createInterface` needed |
| **Loader accepts `(shared_libs)`** | The application loads the adapter once and passes the ready-to-use object to the parent via `CONFIG.Adapter`. Accept a second `config` argument only if the adapter needs its own config |
| **Public before private** | `Adapter` is declared before `_Adapter` at module scope. Same rule as singletons and `createInterface` internals |
| **`Lib.Utils` for all type checks** | No inline `typeof`, no manual `.length` checks. Use `Lib.Utils.isString`, `Lib.Utils.isObject`, `Lib.Utils.isNullOrUndefined`, `Lib.Utils.isFunction` |
| **L1 section banners** | `Module-Loader START/END`, `Public Functions START/END`, `Private Functions START/END`. Standard 3/2/1 spacing between sections |
| **Error catalog usage** | Depends on the adapter's contract. Transport adapters typically do not return error envelopes (the parent handles errors). Other adapter types define their own `store.errors.js` / `[adapter].errors.js` catalog when the contract requires returning envelopes |
| **Adapter is a pure normalizer** | The adapter never holds per-request state and never writes to `instance`. It receives raw inputs and returns normalized data; the parent is the sole writer to `instance` |

**Reference implementation:** `js-server-helper-http-gateway-adapter-express` (`adapter.js`) in `js-helper-modules`.

**Note:** If an adapter needs per-instance config (e.g., a notification adapter connecting to different providers per tenant), use the Storage Adapter Skeleton structure (`createInterface` with closure over adapter-specific config) but with `-adapter-` naming. The factory vs singleton choice is about state, not about naming.

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
| `[name].config.js` | **Required** - module-specific constants and defaults; `module.exports = {};` when the module has no config keys yet (see [Universal Companion Files](#universal-companion-files)). Content rules: [Root and Config File Hygiene](#root-and-config-file-hygiene) |
| `[name].errors.js` | **Required** - frozen error catalog for operational errors; empty frozen object when the module has none yet (see [Module Error File Policy](#module-error-file-policy)) |
| `[name].validators.js` | **Required** - singleton validators module; no-op `validateConfig` when the module has nothing to validate yet (see [Universal Companion Files](#universal-companion-files) and [Singleton Module Pattern](#singleton-module-pattern)) |
| `data/` | (Optional) Static intrinsic reference data shipped with the module - see [Static Data Files](#static-data-files) |
| `package.json` | Module metadata and dependencies |
| `README.md` | Human documentation (badges, usage examples, testing guides) |
| `ROBOTS.md` | AI agent reference (compact, token-efficient) |
| `THOUGHTS.md` | Engineering decision journal. Records why the module is designed the way it is. Not published to the package registry. See [THOUGHTS.md convention](module-thoughts-file.md) |
| `eslint.config.js` | **Required** - ESLint flat config (ESLint v9+), **byte-identical across all modules**. Canonical copy: `js-helper-utils`. See [Linter Configuration](module-publishing.md#linter-configuration) |
| `.npmignore` | **Required** - controls what files are included in the published tarball. Canonical shape: refer to `js-helper-utils`. See [Registry Ignore File](module-publishing.md#registry-ignore-file-npmignore) |
| `_test/test.js` | Tests using `node --test` and `node:assert/strict` |
| `_test/loader.js` | Test loader (env reading, dep injection) - required for any module using DI |
| `_test/package.json` | Test-only dependencies, `private: true`, references module-under-test via alias `"helper-[name]": "file:../"`. Test code MUST `require()` the module by this alias, never by relative source path (`require('../adapter.js')` etc). The alias keeps loader code identical between local-source and published-package contexts. Internal `parts/*.js` files testing internals are exempt. Reference: HTTP Gateway trio. |
| `_test/mock-data/` | (Optional) JSON fixtures |
| `_test/docker-compose.yml` | (Service-dependent modules only) emulator definitions |
| `_test/ops/` | (Service-dependent modules only) testing setup runbook |
| `provider/` | (Optional) vendor-specific implementations |

### Root and Config File Hygiene

| Surface | Rule |
|---|---|
| **Root Markdown** | The root's published Markdown is exactly `README.md` and `ROBOTS.md`. `THOUGHTS.md` is an unpublished engineering journal (excluded from the tarball via `.npmignore`). Every other document lives under `docs/`. No `NOTES.md`, `USAGE.md`, or stray design memo at the root |
| **Config file content** | When a module ships `[name].config.js`, it holds only the keys the module reads, each with a one-line reason for its default. Worked wiring examples and multi-line recipes live in `docs/configuration.md`, not in the config file |
| **No dead keys** | A config key that no code reads is deleted, not annotated as "reserved". A key kept for parity states the real reason in one line |
| **Key kinds are obvious** | Each config key is either an overridable default (a value the project may replace) or a required injection with a `null` placeholder the loader must satisfy (for example `Store: null`) |

### Module Error File Policy

Every module **must** include a `[name].errors.js` file to maintain consistency across the framework. This file contains the frozen error catalog for operational errors returned via `{success: false, error}` envelopes.

**Rules:**

| Module Type | Error File Content |
|---|---|
| **Complex server modules** (DB, cloud SDKs, HTTP, auth, logger, verify) | Full error catalog with all operational error types |
| **Simple server modules** (crypto, instance) | Empty frozen object (consistency placeholder) |
| **Core modules** (utils, debug, time, money) | Catalog of domain validation errors where present (money); empty frozen object otherwise |
| **Client modules** | Catalog of operational errors where present; empty frozen object otherwise |

No module is exempt - see [Universal Companion Files](#universal-companion-files). An empty frozen object costs nothing and means the module's first error never requires loader refactoring.

Errors files follow the **same file-header rule as every other module file**: the `// Info:` banner comes first, then `'use strict';`. A `/** ... */` block opener is not used - one opening shape for every file in the repo.

**Template for modules with operational errors:**
```javascript
// Info: Error catalog for [module-name].
// Operational errors returned via { success: false, error }.
// Frozen to prevent accidental mutation.
'use strict';


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
// Info: Error catalog for [module-name].
// This module has no operational errors - programmer errors throw TypeError.
// Empty frozen object provided for consistency across all server modules.
// Frozen to prevent accidental mutation.
'use strict';


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
| **Required once, in the main module only** | `const DATA = require('./data/[name].json');` at module scope near the top of `[module].js` - and nowhere else. Validators and parts that need the data receive it by injection from the loader (see [Universal Companion Files](#universal-companion-files)). The data is not passed through the *public* loader signature (`(shared_libs, config)`) because it is part of the module's identity, not a per-instance dependency - but internally the main module owns the single require and distributes it |
| **One concern per file** | Split independent data sets into separate files (`data/currencies.json`, `data/regions.json`) rather than one mega-file. Each file should answer one question |
| **Lowercase keys, snake_case fields** | Match the JavaScript convention used elsewhere in the framework. Keys are normalized (lowercased) currency / country / locale codes; field names use snake_case |
| **No code in `data/`** | Pure JSON only. Any transformation logic belongs in the module body or validators, not in the data file |
| **Plain JSON, no comments** | JSON files are loaded verbatim. If a fact needs explaining, document it in the module README under "Data Sources" or "Reference Data" |

**When to use a static data file vs. a separate helper module:**

- **Static data file** when the data is *small, intrinsic, and changes only when the underlying standard changes* (e.g. ISO 4217 revisions every few years). Ships with the module, versioned with the module.
- **Separate helper module** when the data is *large, dynamic, or has its own update cadence* (e.g. timezone database, IP-to-country mapping). Lives in its own module so it can be updated independently.

**Reference Implementation**

The `js-helper-money` module in `js-helper-modules` ships `data/currencies.json` with ISO codes, English names, symbols, decimal precision, and transactional units for each supported currency. Required once at module scope in `money.js` and injected into the validators singleton by the loader.

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
- **Lib keys are alias-derived.** When a module optionally consumes a sibling helper through the shared `Lib` container, the key is the PascalCase form of the sibling's npm alias: `helper-http-gateway` -> `Lib.HttpGateway`, `helper-utils` -> `Lib.Utils`. A module never invents its own key for a sibling, and the optional dependency is documented in its `docs/configuration.md`
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
- `const CONFIG = require('./[module].config')` at module level
- Base config comment: `// Base configuration (overridden by loader-injected config)`
- Merge comment: `// Merge loader-injected config (overrides base values)`
- Always guard with `if (config && typeof config === 'object')` before `Object.assign`
- Public functions (`const [ModuleName] = { ... }`) declared at module level
- `module.exports` calls `loader(shared_libs, config)` once and returns the module-level public interface

When migrating a Pattern 1 module to Pattern 2, treat it as a breaking change for that module. See [Reference Implementations](#reference-implementations) above.
