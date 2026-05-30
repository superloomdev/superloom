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
- [Config Absorption Contract](#config-absorption-contract)

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

// Require the module under test by its `_test/package.json` alias
// (which resolves to `file:../`), not by relative source path. Aliases
// keep the loader identical between local-source and published-package
// contexts. Internal `parts/*.js` testing internals may stay relative.
const ModuleName = require('helper-[module-name]');



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

When a module under test depends on an external contract (a storage backend, a runtime adapter, a third-party driver), its own tests must not hit the real thing. Instead, a **test double** is placed in `_test/` that satisfies the contract interface with minimal in-process code. Two named patterns exist in this project. They are **not mutually exclusive** - a module can use both if it has two different kinds of dependency.

---

### Pattern 1: `memory-store` (a Fake)

**File name:** `_test/memory-store.js`

**What it is:** A full working implementation of a storage contract, backed by RAM (`Map`, `Array`, plain objects) instead of a real database. It has real logic: records are stored, read back, deleted, and expired. The only thing missing is persistence and a network round-trip.

**Industry term:** *Fake* - a test double with working logic, just a simpler or faster implementation of the real thing.

**When to use it:**

- The module under test depends on a **storage backend** (database, key-value store, cache).
- The contract being implemented is stateful - writes made in one call must be visible in a subsequent read call.
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

**What it is:** A minimal, stateless implementation of an adapter contract that returns valid-shaped dummy output for every call. It does not simulate any real system's internal behavior - it exists purely to satisfy the function signatures so the module under test can execute its own code paths.

**Industry term:** *Stub* - a test double that satisfies an interface with hardcoded or trivially computed responses, with no real logic.

**When to use it:**

- The module under test depends on a **runtime adapter** or **driver** (an HTTP runtime like API Gateway or Express, a queue client, a cloud SDK).
- The adapter contract is not stateful in the way a database is - there are no reads that must see prior writes.
- The module's own logic (request normalization, response building, header merging, cookie handling) is what is being tested, and the adapter is just the delivery channel underneath it.
- The real adapter cannot be replicated in memory without reimplementing the actual runtime (Lambda event parsing, Express middleware), which is out of scope.

**Real examples in this project:**

| Module | File | What it stubs |
|---|---|---|
| `js-server-helper-http-gateway` | `_test/stub-adapter.js` | 3-method adapter contract (extractRequest, buildResponseEnvelope, getCountryCode) |

**What a stub-adapter looks like:**

```js
// _test/stub-adapter.js
module.exports = function createStubAdapter () {
  const sent = [];
  return {
    adapter: {
      extractRequest: function (raw_request, _ctx, cb) {
        const req = raw_request || {};
        return {
          headers: req.headers || {},
          query: req.query || {},
          body: req.body || {},
          params: req.params || {},
          cookies: req.cookies || {},
          method: req.method || null,
          url: req.url || '',
          response_handler: cb
        };
      },
      buildResponseEnvelope: function (status, headers, body) {
        const r = { status, headers, body };
        sent.push(r);
        return r;
      },
      getCountryCode: function () { return null; }
    },
    sent: sent   // test assertions inspect this
  };
};
```

The key property: **no state persists across calls**. The stub just returns a valid-shaped value so the module's own code can run. Tests then inspect `sent[]` or the returned object to assert on the module's behavior - not the adapter's.

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

// Require the module under test by its `_test/package.json` alias.
const Module = require('helper-[module-name]')(Lib, {
  STORE:   store,
  ADAPTER: function () { return adapter; }
});
```

When adding a new module, identify each external dependency, classify it as "stateful storage" or "transport/runtime", and create the appropriate test double (or both).

---

## Config Absorption Contract

Every loader function takes a `config` argument that is merged with module defaults via `Object.assign({}, defaults, config)`. This merge is **public API surface** — it must be tested. Add a `config absorption contract` describe block to every non-exempt module's `test.js`.

### Why this matters

Plan 0032 mechanically replaced `Object.assign({}, defaults, config)` with `Lib.Utils.overrideObject(defaults, config)` in 18 files. These are **not equivalent**: `overrideObject` silently skips strictly-`null` values (keeps the base), while `Object.assign` honors them. Only `js-server-helper-auth` caught the regression because it was the only module that asserted on an explicit `null` override. This section codifies the four promises that every loader must pass, and the minimum test assertions that prove them.

### The four promises

1. **Override wins** — a provided non-default value takes effect.
2. **Omission keeps default** — a key not provided retains its default.
3. **Explicit `null` is honored** — a `null` override of a key with a non-null default actually clears/replaces it.
4. **Shallow merge is intentional** — a partial nested-object override replaces the nested object wholesale (no deep merge).

### The core challenge: CONFIG is private

Every loader captures `CONFIG` in a closure; the returned interface does not expose it. Tests must observe the merge **indirectly** through module behavior. Three strategies are available — choose based on what the module exposes. Strategy numbers mirror the exemption category numbers (Category 3 has no strategy because it uses a partial block, not a full contract):

| Strategy | When to use | How it works |
|---|---|---|
| **1 — Validation throws** | Module validates CONFIG at load time and throws on bad values (Archetype A: auth, verify, logger, http-gateway) | Override a key with an invalid value → assert it throws; override with a valid but distinct value → assert it does not. The throw proves the override reached the effective config. |
| **2 — Behavioral** | Module has a config key whose value changes observable output of a public function without a backend (Archetype B: money, time, crypto, http, instance) | Call the function with a known override → assert the output reflects the override (and the default produces the other behavior). |
| **4 — Integration tier** | Module keys only manifest against a live backend (Archetype C: DB, storage, queue) | Connection keys are already covered implicitly by Docker integration tests. The null-override assertion and any non-connection keys go in the integration suite if the key is observable there, otherwise they are documented as deferred. |

### Decision tree

```
For each module:
  Does the loader validate CONFIG at load time and throw on bad values?
    YES → Strategy 1 (validation throws) for override-wins + null-honored.
  Is there a config key with an observable, backend-free behavioral effect?
    YES → Strategy 2 (behavioral) for at least override-wins.
  Are the only config-driven effects backend-coupled (endpoint/creds/pool)?
    YES → Strategy 4; add null-override to integration suite or document as deferred.
  Always add: factory-independence assertion (cheap, universal).
```

### What to assert (keep it to 3–5 `it` blocks)

- **(a) override-wins** — pass an override that flips a validation outcome or observable behavior; prove it was absorbed.
- **(b) omission-keeps-default** — omit an optional key with a non-null default; prove the module still constructs without error.
- **(c) null-honored** (the 0032 canary) — explicitly pass `null` for a key whose default is a non-null object/value; prove `null` was seen as `null`, not silently replaced by the default. This is the single assertion that would have caught the 0032 regression in every module.
- **(d) shallow-merge** (optional, Archetype A) — pass a partial nested override; prove sibling keys in the nested default are dropped (not deep-merged).
- **(e) factory-independence** (optional, universal) — two loader calls with different configs produce independent instances.

Do **not** assert every key. Target the minimum set that catches a merge-semantics regression.

### Finding the null-meaningful key

`null` must be meaningful for the chosen key — i.e., the key has a **non-null default** and `null` is a distinct, observable state. Examples per module:

- `auth`: `JWT` (default is a plain object; `null` + `ENABLE_JWT: true` must throw)
- `auth`: `LIMITS.by_form_factor_max` (default `null`, not useful for this test), `COOKIE_PREFIX` (default `null`, not useful)
- `logger`: `IP_ENCRYPT_KEY` (default `null` in most configs — confirm the module's own default)
- `verify`: confirm with the module's `.config.js`

If no null-meaningful key exists in a module, document that explicitly in a comment inside the block and skip Promise 3 for that module.

### `validBaseConfig()` helper

Every `config absorption contract` block must use a `validBaseConfig()` factory helper that returns a **fresh, complete, valid config object on each call** (so tests do not share references). If the module's test file already has a base-config object, convert it to a function.

```javascript
function validBaseConfig () {
  return {
    STORE:        MemoryStoreFactory,
    STORE_CONFIG: {},
    ACTOR_TYPE:   'user',
    TTL_SECONDS:  3600,
    LIMITS:       { total_max: 5, evict_oldest_on_limit: true }
  };
}
```

### Template 1 — Validation-throw (Archetype A)

```javascript
describe('config absorption contract', function () {

  // Sanity anchor: valid baseline must construct cleanly.
  it('constructs with a valid baseline config', function () {
    assert.doesNotThrow(function () { Factory(Lib, validBaseConfig()); });
  });

  // OVERRIDE WINS: override flips a validation outcome → proves it reached CONFIG.
  it('absorbs an override that changes the validation outcome', function () {
    assert.throws(function () {
      Factory(Lib, Object.assign(validBaseConfig(), { TTL_SECONDS: -1 }));
    }, /TTL_SECONDS/);
  });

  // NULL HONORED (0032 canary): key has a non-null default; explicit null must
  // be seen as null. With Object.assign this throws; with the buggy
  // overrideObject it silently keeps the default and does NOT throw here.
  it('honors an explicit null override of a key with a non-null default', function () {
    assert.throws(function () {
      Factory(Lib, Object.assign(validBaseConfig(), { ENABLE_JWT: true, JWT: null }));
    }, /JWT must be a plain object/);
  });

  // SHALLOW MERGE (intentional): partial nested override drops sibling defaults.
  // Encodes the contract so nobody silently converts to deep merge later.
  it('replaces nested objects wholesale (shallow merge is intentional)', function () {
    assert.throws(function () {
      Factory(Lib, Object.assign(validBaseConfig(), {
        ENABLE_JWT: true,
        JWT: { signing_key: 'x'.repeat(32), issuer: 'i', audience: 'a' }
      }));
    }, /access_token_ttl_seconds/);
  });

  // OMISSION KEEPS DEFAULT: removing an optional key with a non-null default
  // must not throw (the default is used).
  it('retains the default when an optional key is omitted', function () {
    const cfg = validBaseConfig();
    delete cfg.LAST_ACTIVE_UPDATE_INTERVAL_SECONDS;
    assert.doesNotThrow(function () { Factory(Lib, cfg); });
  });

});
```

### Template 2 — Behavioral (Archetype B)

```javascript
describe('config absorption contract', function () {

  // OVERRIDE WINS: a non-default config value changes observable output.
  it('absorbs a config override that changes function output', function () {
    const mod = Factory(Lib, Object.assign(validBaseConfig(), { DECIMALS: 4 }));
    assert.equal(mod.format(1.23456), '1.2346');
  });

  // OMISSION KEEPS DEFAULT: omitting an optional key falls back to the default.
  it('retains the default when an optional key is omitted', function () {
    const cfg = validBaseConfig();
    delete cfg.DECIMALS;
    assert.doesNotThrow(function () { Factory(Lib, cfg); });
  });

  // NULL HONORED (0032 canary): if the module has a key with a non-null default,
  // an explicit null override must be observable. Document here if no such key
  // exists: "No null-meaningful key: all defaults are already null or the module
  // has no optional config with a non-null default."

});
```

### Exempt modules

A module is exempt from the `describe('config absorption contract', ...)` block when there is nothing to assert at the unit tier. There are four exemption categories:

**Category 1 — Config argument unused**
The loader accepts `config` for interface uniformity but the parameter is never read by `createInterface`. No public function observes CONFIG.

Examples: `js-helper-utils`, `js-server-helper-crypto`, `js-server-helper-instance`, `js-helper-time`

**Category 2 — Config is empty**
The `.config.js` file defines no keys (`module.exports = {}`). The merge succeeds but there is nothing to override.

Examples: `js-server-helper-instance` (empty config), any future module before its first configurable key is added.

**Category 3 — All defaults are null with no observable null-override**
Every CONFIG key defaults to `null`. Overriding with `null` is indistinguishable from the default, and the only non-null overrides require a backend to observe. Add the override-wins and omission-keeps-default assertions if a non-null override is observable without a backend; document the null-honored promise as deferred if not.

Examples: `js-server-helper-logger` (all defaults null — covered with behavioral IP override-wins only).

**Category 4 — Backend-coupled (Strategy 4 — integration tier)**
Every meaningful CONFIG key (connection strings, table names, bucket names, pool sizes) only manifests its effect through a live backend call (DynamoDB, MongoDB, MySQL, Postgres, SQLite, S3, SQS, etc.). Unit tests cannot observe whether the override reached CONFIG without the backend.

These modules are fully exempt at the unit tier. Do **not** add an exempt comment to the test file — the policy is documented here. Verification belongs in the module's Docker integration tests.

Exempt modules in this category:
- All DB/SQL helpers: `js-server-helper-sql-postgres`, `js-server-helper-sql-mysql`, `js-server-helper-sql-sqlite`
- All NoSQL helpers: `js-server-helper-nosql-aws-dynamodb`, `js-server-helper-nosql-mongodb`
- All storage helpers: `js-server-helper-storage-aws-s3`, `js-server-helper-storage-aws-s3-url-signer`
- All queue helpers: `js-server-helper-queue-aws-sqs`
- All store adapters: `js-server-helper-auth-store-*`, `js-server-helper-logger-store-*`, `js-server-helper-verify-store-*`
- HTTP client: `js-server-helper-http` (TIMEOUT and USER_AGENT require a live network call)
- HTTP gateway adapters: `js-server-helper-http-gateway-adapter-*`

**When to document exemption in the test file vs here**
Only add an in-file comment (`// config absorption contract: exempt — ...`) when the exemption is **non-obvious from the category** — for example when CONFIG is accepted but silently ignored (Category 1/2), so future developers don't add a test block before checking. For Category 4 (backend-coupled), the exemption is clear from the module's purpose; no in-file comment is needed.

### No version bump required

`_test/` is excluded from the published package. Adding these tests requires **no version bump and no republish**. Run lint + test + commit per module.

---

## Further Reading

- [Testing Strategy](testing-strategy.md) - directory layout and the simulating-loader pattern
- [Module Testing](module-testing.md) - testing tiers (emulated vs integration) and CI/CD
- [Integration Testing](integration-testing.md) - testing helpers against real cloud services
