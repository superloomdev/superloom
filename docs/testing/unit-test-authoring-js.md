# Unit Test Authoring Guide

> **Language:** [JavaScript](unit-test-authoring-js.md)

The complete rule set for writing unit tests. Follow it exactly and any reviewer (or AI agent) will recognize the result as a test on sight. For testing strategy across modules see [`testing-strategy.md`](testing-strategy.md). For testing tiers and CI/CD see [`module-testing.md`](module-testing.md).

## On This Page

- [Tools](#tools)
- [File Structure](#file-structure)
- [Test File Template](#test-file-template)
- [Mandatory Rules](#mandatory-rules)
- [How to Write Tests for a New Module](#how-to-write-tests-for-a-new-module-step-by-step)
- [Reference - Assertion Methods](#reference-assertion-methods)
- [Reference - Test Output](#reference-test-output)
- [Test Double Patterns: memory-store vs stub-adapter](#test-double-patterns-memory-store-vs-stub-adapter)

---

## Tools

- **Runner:** Node.js built-in test runner (`node --test`)
- **Assertions:** `require('node:assert/strict')`
- **Test API:** `describe` and `it` from `require('node:test')`
- **No external dependencies.** No Mocha, Jest, Chai, or Sinon. Only Node.js built-ins.

---

## File Structure

```
[module-name]/
  _test/
    test.js           # All tests for this module
    mock-data/        # (Optional) JSON fixtures
```

Tests run from the module root:
```bash
npm test
```

The module's `package.json` must have:
```json
"scripts": {
  "test": "node --test _test/test.js"
}
```

---

## Test File Template

```javascript
// Tests for [module-name]
// Covers all exported functions with automated assertions
'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const ModuleName = require('../module-file.js');



// ============================================================================
// 1. [CATEGORY NAME]
// ============================================================================

describe('[functionName]', function () {

  it('should [expected result] when [input condition]', function () {
    assert.strictEqual(ModuleName.functionName(input), expectedOutput);
  });

});
```

---

## Mandatory Rules

### 1. One `describe` block per exported function

Each exported function gets its own `describe` block. The describe label must match the function name exactly.

```javascript
describe('isNull', function () { ... });
```

### 2. Test naming convention

Every `it()` must follow this pattern:

```
should [expected result] when [input condition]
```

Examples:
```javascript
it('should return true when value is null', ...)
it('should return false when value is empty string', ...)
it('should return 11.02 when rounding 11.01999999 to 2 decimals', ...)
```

### 3. One assertion per test where possible

Each `it()` block should ideally test one specific input → output pair. Multiple assertions in one `it()` are allowed only when testing a single logical concept (e.g., checking multiple fields of a returned object).

### 4. Group by category with numbered section headers

Use comment separators to group related functions:

```javascript
// ============================================================================
// 1. TYPE CHECKS
// ============================================================================

// ============================================================================
// 2. STRING OPERATIONS
// ============================================================================
```

Categories should follow the logical grouping of the module's API.

### 5. Test every exported function

Every public function in the module must have at least one `describe` block with tests. No exceptions.

### 6. Include edge cases from the source code

Read the function implementation. Look for:
- **Null/undefined handling** - does the function check for null? Test it.
- **Type coercion** - does the function convert types? Test boundary cases.
- **Empty inputs** - empty string, empty array, empty object.
- **Boundary values** - min/max of ranges, zero, negative numbers.
- **Return types** - does it return `false` vs `null` vs `undefined`? Test each.

### 7. Use `strictEqual` for primitives, `deepStrictEqual` for objects

```javascript
// Primitives (string, number, boolean, null, undefined)
assert.strictEqual(result, expected);

// Objects, arrays
assert.deepStrictEqual(result, expected);
```

### 8. No console.log in tests

All verification is via assertions. Tests must pass or fail automatically - no manual inspection of output.

### 9. Test inputs and expected outputs must be explicit

Do not use variables that obscure what is being tested:

```javascript
// Input and expected output are visible in the test
it('should return 11.02 when rounding 11.01999999 to 2 decimals', function () {
  assert.strictEqual(Utils.round(11.01999999, 2), 11.02);
});

// Wrong - hidden behind variable names
it('should round correctly', function () {
  assert.strictEqual(Utils.round(testInput, decimals), expectedResult);
});
```

### 10. No mutation side effects between tests

Each `it()` must be independent. Do not rely on state from a previous test. If setup is needed, declare it inside the `describe` block.

---

## How to Write Tests for a New Module (Step by Step)

1. **Read the module source file.** List every exported function.
2. **Group functions by category** (type checks, string operations, validation, etc.).
3. **For each function:**
   a. Read the implementation and JSDoc comments
   b. Identify all code paths (if/else branches, try/catch, loops)
   c. Write one `it()` for each code path
   d. Add edge cases: null, undefined, empty string, empty object, empty array, NaN, zero, negative
4. **Check for existing handwritten tests** in `_cleanup/_old/` - convert any `console.log` tests to assertions.
5. **Run the tests:** `npm test`
6. **Verify all pass with zero failures.** Fix any assertion mismatches by checking the actual function behavior - do not change the function to match the test.

---

## Reference - Assertion Methods

| Method | Use for |
|---|---|
| `assert.strictEqual(actual, expected)` | Primitives: string, number, boolean, null, undefined |
| `assert.deepStrictEqual(actual, expected)` | Objects, arrays (deep comparison) |
| `assert.ok(value)` | Truthy check |
| `assert.throws(fn)` | Function should throw an error |

---

## Reference - Test Output

Running `npm test` produces output like:

```
▶ isNull
  ✔ should return true when value is null (0.5ms)
  ✔ should return false when value is undefined (0.03ms)
✔ isNull (1.2ms)

ℹ tests 211
ℹ suites 48
ℹ pass 211
ℹ fail 0
```

Each function is a suite. Each `it()` is a test. All results are visible in the terminal.

---

## Test Double Patterns: memory-store vs stub-adapter

When a module under test depends on an external contract (a storage backend, a runtime adapter, a third-party driver), its own tests must not hit the real thing. Instead, a **test double** is placed in `_test/` that satisfies the contract interface with minimal in-process code. Two named patterns exist in this project. They are **not mutually exclusive** — a module can use both if it has two different kinds of dependency.

---

### Pattern 1: `memory-store` (a Fake)

**File name:** `_test/memory-store.js`

**What it is:** A full working implementation of a storage contract, backed by RAM (`Map`, `Array`, plain objects) instead of a real database. It has real logic: records are stored, read back, deleted, and expired. The only thing missing is persistence and a network round-trip.

**Industry term:** *Fake* — a test double with working logic, just a simpler or faster implementation of the real thing.

**When to use it:**

- The module under test depends on a **storage backend** (database, key-value store, cache).
- The contract being implemented is stateful — writes made in one call must be visible in a subsequent read call.
- The module's own logic (session policy, token rotation, eviction, TTL) is what is being tested, and the store is just the persistence layer underneath it.
- The real backend can be swapped for an in-process `Map` without changing the observable behavior of the module.

**Real examples in this project:**

| Module | File | What it fakes |
|---|---|---|
| `js-server-helper-auth` | `_test/memory-store.js` | Full 8-method session store contract (get, set, list, delete, cleanup) |
| `js-server-helper-verify` | `_test/memory-store.js` | Verification code store contract |
| `js-server-helper-logger` | `_test/memory-store.js` | Log record store contract |

**What a memory-store looks like:**

```js
// _test/memory-store.js
module.exports = function createMemoryStore () {
  const _map = new Map();
  return {
    getSession: async function (instance, t, a, k) { ... },
    setSession: async function (instance, record) { ... },
    deleteSession: async function (instance, t, a, k) { ... },
    // ... all 8 methods, all with real Map-backed logic
  };
};
```

The key property: **state persists across calls within the same test**. A `setSession` followed by a `getSession` in the same test returns the record that was set.

---

### Pattern 2: `stub-adapter` (a Stub)

**File name:** `_test/stub-adapter.js`

**What it is:** A minimal, stateless implementation of an adapter contract that returns valid-shaped dummy output for every call. It does not simulate any real system's internal behavior — it exists purely to satisfy the function signatures so the module under test can execute its own code paths.

**Industry term:** *Stub* — a test double that satisfies an interface with hardcoded or trivially computed responses, with no real logic.

**When to use it:**

- The module under test depends on a **runtime adapter** or **driver** (an HTTP runtime like API Gateway or Express, a queue client, a cloud SDK).
- The adapter contract is not stateful in the way a database is — there are no reads that must see prior writes.
- The module's own logic (request normalization, response building, header merging, cookie handling) is what is being tested, and the adapter is just the delivery channel underneath it.
- The real adapter cannot be replicated in memory without reimplementing the actual runtime (Lambda event parsing, Express middleware), which is out of scope.

**Real examples in this project:**

| Module | File | What it stubs |
|---|---|---|
| `js-server-helper-http-gateway` | `_test/stub-adapter.js` | 3-method adapter contract (loadHttpDataToInstance, buildHttpResponseObject, getHttpRequestCountryCode) |

**What a stub-adapter looks like:**

```js
// _test/stub-adapter.js
module.exports = function createStubAdapter () {
  const sent = [];
  return {
    adapter: {
      loadHttpDataToInstance: function (instance, raw_request, _ctx, cb) {
        instance.http_request = raw_request || {};
        instance.gateway_response_callback = cb;
      },
      buildHttpResponseObject: function (status, headers, body) {
        const r = { status, headers, body };
        sent.push(r);
        return r;
      },
      getHttpRequestCountryCode: function () { return null; }
    },
    sent: sent   // test assertions inspect this
  };
};
```

The key property: **no state persists across calls**. The stub just returns a valid-shaped value so the module's own code can run. Tests then inspect `sent[]` or the returned object to assert on the module's behavior — not the adapter's.

---

### Decision Table

| Question | Answer → use |
|---|---|
| Does the contract involve stored state (write then read)? | `memory-store` |
| Is the contract a storage backend (SQL, NoSQL, cache)? | `memory-store` |
| Is the contract a runtime/transport adapter (HTTP, queue, cloud SDK)? | `stub-adapter` |
| Can the real thing be replicated in RAM with working logic? | `memory-store` |
| Is the real thing a runtime environment that cannot be replicated without reimplementing it? | `stub-adapter` |
| Does the test need to assert on what was stored and read back? | `memory-store` |
| Does the test need to assert on what was sent out (response, message, event shape)? | `stub-adapter` |

---

### Using Both in the Same Module

These patterns are **not exclusive**. A module can require both if it has two different kinds of dependency. For example, a hypothetical `js-server-helper-notifications` module might:

- Depend on a **storage backend** (to persist notification records) → `_test/memory-store.js`
- Depend on a **runtime adapter** (to dispatch notifications via email, SMS, push) → `_test/stub-adapter.js`

The tests then build both, pass the memory-store where a store is expected, and pass the stub-adapter where a dispatch adapter is expected. The module's own logic runs fully in-process with no external dependencies.

```js
// _test/test.js - module with both patterns
const { Lib }    = require('./loader')();
const MemStore   = require('./memory-store');
const StubAdapt  = require('./stub-adapter');

const { adapter, sent } = StubAdapt();
const store = MemStore();

const Module = require('../module.js')(Lib, {
  STORE:   store,
  ADAPTER: function () { return adapter; }
});
```

When adding a new module, identify each external dependency, classify it as "stateful storage" or "transport/runtime", and create the appropriate test double (or both).

---

## Further Reading

- [Testing Strategy](testing-strategy.md) - directory layout and the simulating-loader pattern
- [Module Testing](module-testing.md) - testing tiers (emulated vs integration) and CI/CD
- [Integration Testing](integration-testing.md) - testing helpers against real cloud services
