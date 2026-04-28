# Testing Strategy

How tests are organized across modules. This document covers the **layout** (where tests live, how they're loaded, what runs them). For the rules of writing a single unit test see [`unit-test-authoring.md`](unit-test-authoring.md). For the testing tiers and CI/CD setup see [`module-testing.md`](module-testing.md).

## On This Page

- [Philosophy](#philosophy)
- [Test Directory Structure](#test-directory-structure)
- [Test File Pattern](#test-file-pattern)
- [Test `package.json` Pattern](#test-packagejson-pattern)
- [Testing Levels](#testing-levels)
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

- [Unit Test Authoring](unit-test-authoring.md) - how to write a single unit test
- [Module Testing](module-testing.md) - testing tiers, badges, and CI/CD
- [Integration Testing](integration-testing.md) - testing against real cloud services
- [Module Structure](module-structure.md) - the factory pattern that test loaders mirror
