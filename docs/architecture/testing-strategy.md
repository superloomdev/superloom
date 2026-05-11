# Testing Strategy

How tests are organized across modules. This document covers the **layout** (where tests live, how they're loaded, what runs them). For the rules of writing a single unit test see [`unit-test-authoring-js.md`](unit-test-authoring-js.md). For the testing tiers and CI/CD setup see [`module-testing.md`](module-testing.md).

## On This Page

- [Philosophy](#philosophy)
- [Test Directory Structure](#test-directory-structure)
- [Test File Pattern](#test-file-pattern)
- [Test `package.json` Pattern](#test-packagejson-pattern)
- [Testing Levels](#testing-levels)
- [Testing Adapter-Based Modules (Three-Tier Pattern)](#testing-adapter-based-modules-three-tier-pattern)
- [Testing Modules with Dependencies](#testing-modules-with-dependencies-simulating-loader)
- [Global Test Runner Pattern](#global-test-runner-pattern)
- [Rules](#rules)
- [Module README as Context](#module-readme-as-context)

---

## Philosophy

- Every module must be **independently testable**
- Tests live inside each module in a `_test/` directory
- Tests must be runnable with `npm test` from the module root
- We use the Node.js built-in test runner (`node --test`) - no external test framework required
- Each test file is self-contained: load dependencies, set up data, run tests, report results

---

## Test Directory Structure

Every module (helper, model, controller, core) follows this test layout:

```
[module-name]/
  _test/
    package.json        # Test-specific dependencies (references parent module + helpers)
    test.js             # Main test file
    mock-data/          # (Optional) Test fixtures and mock data
      sample-input.json
      sample-output.json
    README.md           # (Optional) Notes on test setup requirements
```

---

## Test File Pattern

**Standard pattern for modules with dependencies (Models, Core, Controllers):**

```javascript
// _test/test.js
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Load via simulating loader for proper dependency injection
const loadLib = require('./loader');
const Lib = loadLib();
const UserModel = Lib.UserModel;

describe('User Model', function () {

  it('should create user with valid data', function () {

    const user = UserModel.data.create({ name: 'John', email: 'john@example.com' });
    assert.strictEqual(user.name, 'John');

  });

});
```

**Pattern for pure modules without dependencies (Config, Errors):**

```javascript
// _test/test.js
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Direct require for pure modules
const CONFIG = require('../user.config');

describe('Config', function () {

  it('should have valid status values', function () {

    assert.ok(Array.isArray(CONFIG.STATUS_VALUES));

  });

});
```

---

## Test `package.json` Pattern

```json
{
  "name": "[module-name]-test",
  "description": "Test Cases for [module-name]",
  "version": "1.0.0",
  "main": "test.js",
  "private": true,
  "license": "MIT",
  "dependencies": {
    "@your-org/js-helper-utils": "^1.0.0",
    "[module-name]": "file:../"
  },
  "scripts": {
    "test": "node --test test.js"
  }
}
```

---

## Testing Levels

| Level | What | Where | Runner |
|---|---|---|---|
| Unit Tests | Individual functions in isolation | `[module]/_test/test.js` | `node --test` |
| Integration Tests | Module interactions (e.g., controller + model) | `src/server/_test/` | `node --test` |
| End-to-End Tests | Full request flow through interface | `src/server/interfaces/_test/` | `node --test` |

---

## Testing Adapter-Based Modules (Three-Tier Pattern)

Modules that use the [Adapter Pattern](module-structure-js.mdx#adapter-pattern-multi-backend-helper-modules) - a parent module plus N standalone backend packages - test in three tiers. Each tier runs at a different layer and answers a different question.

### The Three Tiers

| Tier | Where it lives | Loads | Docker | What it answers |
|---|---|---|---|---|
| **Tier 1 - Adapter unit** | `[adapter]/_test/test.js` | The adapter only (no parent module) | Optional - only the adapter's backend | Does the adapter's translation layer work? Identifier quoting, type coercions, hash-mismatch behavior, batch chunking |
| **Tier 2 - Parent logic** | `[parent]/_test/test.js` | The parent module + an in-memory adapter fixture | None | Does the parent's pure logic work? Loader validation, policy decisions, cookie handling, JWT rotation |
| **Tier 3 - Contract integration** | `[adapter]/_test/test.js` | The parent module + the real adapter | Yes - the adapter's backend | Does this adapter satisfy the parent's contract end-to-end? Every public parent API path against a real backend |

The split lets each tier run at maximum speed: Tier 2 has zero Docker latency and exercises every code path of the parent; Tier 1 isolates adapter-specific concerns; Tier 3 catches the integration seams that the other two cannot.

### In-Memory Fixture Pattern (Tier 2 Enabler)

The parent module's `_test/` directory contains a `createInMemory<Adapter>()` helper that implements the **full adapter contract** using a plain in-process Map or array. This is what makes Tier 2 possible:

```
src/helper-modules-server/js-server-helper-[parent]/
  _test/
    memory-store.js     createInMemory<Adapter>() - full contract, in-process
    test.js             Tier 2 tests - load parent with memory store
    loader.js           Test-time DI helper
```

Required properties of the in-memory fixture:

- Implements **every** method of the adapter contract, with the **same return shapes** as a real adapter (success/error envelopes, `record` vs `records`, etc.)
- Holds state in module-private structures (Map, array). One fixture instance = one isolated dataset
- No external dependencies beyond Node built-ins
- Lives **only** in `_test/`. Never published, never required from outside the test directory, never used in production code

The fixture is a **structural duck-typed substitute** for any real adapter. The parent's loader cannot tell it apart from the published packages - that is the whole point.

### Shared Contract Suite Copy Pattern (Tier 3 Enabler)

When N adapters all implement the same contract, the integration tests for that contract are written **once** and run against each adapter. The suite lives in the parent module's `_test/` directory and is **copied** (not exported, not deep-required) into each adapter's `_test/` directory:

```
js-server-helper-[parent]/_test/store-contract-suite.js          ← canonical source
js-server-helper-[parent]-store-sqlite/_test/store-contract-suite.js   ← copy
js-server-helper-[parent]-store-postgres/_test/store-contract-suite.js ← copy
js-server-helper-[parent]-store-mysql/_test/store-contract-suite.js    ← copy
js-server-helper-[parent]-store-mongodb/_test/store-contract-suite.js  ← copy
```

Why copy instead of export and require:

| Concern | Outcome with copy | Outcome with export-and-require |
|---|---|---|
| Test code in published runtime package | Never - suite stays in `_test/` | Test code leaks into runtime exports |
| Cross-package version coupling | None - each adapter has its own pinned snapshot | Adapter must follow parent's package version exactly |
| `npm install` graph in `_test/` | One `file:../` for the adapter under test, registry pins for siblings | Deep require pulls test source from another package - fragile in CI |
| Audit which contract version an adapter was built against | Trivial - the file is right there | Requires inspecting parent's published source |

The suite is **not exported** through the parent module's `package.json` `exports`. It is a test-only artifact whose canonical home is the parent's `_test/` directory; the per-adapter copies are working snapshots.

### Reference Implementations

**Auth (canonical):**
- **Parent + in-memory fixture:** `src/helper-modules-server/js-server-helper-auth/_test/memory-store.js` + `_test/store-contract-suite.js`
- **Five adapter copies:** each `js-server-helper-auth-store-*/_test/store-contract-suite.js`
- **Tier wiring:** each adapter's `_test/test.js` imports the local copy (`require('./store-contract-suite')`) and runs it against the real backend

**Verify (second example, same pattern):**
- **Parent + in-memory fixture:** `src/helper-modules-server/js-server-helper-verify/_test/memory-store.js` + `_test/shared-store-suite.js`
- **Five adapter copies:** each `js-server-helper-verify-store-*/_test/shared-store-suite.js`
- **Tier wiring:** same — each adapter's `_test/test.js` imports the local copy and runs it against the real backend

> **Note:** The in-memory fixture for verify is currently defined inline in `_test/test.js`. It must be extracted to `_test/memory-store.js` before the adapter `_test/` directories can be created (they need to import it). This extraction is tracked in the verify adapter work plan.

---

## Testing Modules with Dependencies (Simulating Loader)

When a module (like a Model or Core module) depends on other modules via `Lib`, we use a **simulating loader** (`_test/loader.js`) to inject dependencies during testing. This mimics the production `loader.js` behavior in an isolated environment.

**When to use the simulating loader:**
- Tests that access cross-module dependencies (e.g., User tests that need `Lib.ContactModel`)
- Tests for modules that use `Lib.Utils` or other helpers
- Tests for process functions that receive `Lib` injection

**When direct require() is sufficient:**
- Tests for pure modules with no external dependencies (e.g., simple config or errors modules)
- Tests that only test the module's internal logic without calling other models/helpers

#### Simulating Loader Pattern:
```javascript
// _test/loader.js
module.exports = function() {
  const Lib = {};
  
  // Load helpers
  Lib.Utils = require('../../src/helper-modules-core/js-helper-utils');
  
  // Load models with dependency injection
  const UserConfig = require('../user/user.config');
  Lib.UserModel = require('../user')(Lib, UserConfig);
  
  // Inject Lib into process functions
  Lib.UserProcess = Lib.UserModel.process(Lib);
  
  return Lib;
};
```

#### Test Usage:
```javascript
// _test/test.js
const loadLib = require('./loader');
const Lib = loadLib();

describe('UserProcess', function() {
  it('should format display name using Lib.Utils', function() {
    const user = Lib.UserModel.data.create({ name: 'Shiv' });
    const result = Lib.UserProcess.formatDisplayName(user);
    assert.strictEqual(result, 'Shiv');
  });
});
```

---

## Global Test Runner Pattern

For complex layers like Models, we use a single global test runner that executes entity-specific test suites. This ensures that all model-layer cross-references are tested together.

**Location:** `src/model/_test/test.js`  
**Execution:** `node --test test.js [sub-test-paths]`

---

## Rules

- **Every exported function** must have at least one test case.
- **Tests must not depend on external services** (DB, network) unless explicitly marked as integration tests.
- **Mock external dependencies** by injecting fake `Lib` objects or using the simulating loader.
- **Test naming convention:** `should [expected behavior] when [condition]`
- **No test should modify files** or have side effects outside its scope.
- **Run all module tests** before committing: `npm test` from module root or using the global runner.

---

## Module README as Context

Each module's `README.md` serves as both documentation and **human reading material**. It must contain:

1. **Module name and purpose** (1-2 sentences)
2. **All exported functions** with signatures:
   - Function name
   - Parameters (name, type, description)
   - Return value (type, description)
3. **Dependencies** (what this module requires from `Lib`)
4. **Configuration** (what config keys this module accepts, if any)
5. **Example usage** (minimal code snippet)

The AI-facing companion is `ROBOTS.md` - a compact, machine-readable function listing that every module ships alongside `README.md`.

## Further Reading

- [Unit Test Authoring (JavaScript)](unit-test-authoring-js.md) - how to write a single unit test
- [Module Testing](module-testing.md) - testing tiers, badges, and CI/CD
- [Integration Testing](integration-testing.md) - testing against real cloud services
- [Module Structure (JavaScript)](module-structure-js.mdx) - the factory pattern that test loaders mirror
