# Unit Test Authoring Guide

The complete rule set for writing unit tests. Follow it exactly and any reviewer (or AI agent) will recognize the result as a test on sight. For testing strategy across modules see [`testing-strategy.md`](testing-strategy.md). For testing tiers and CI/CD see [`module-testing.md`](module-testing.md).

## On This Page

- [Tools](#tools)
- [File Structure](#file-structure)
- [Test File Template](#test-file-template)
- [Mandatory Rules](#mandatory-rules)
- [How to Write Tests for a New Module](#how-to-write-tests-for-a-new-module-step-by-step)
- [Reference - Assertion Methods](#reference-assertion-methods)
- [Reference - Test Output](#reference-test-output)

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
// Correct
describe('isNull', function () { ... });

// Wrong - do not group multiple functions
describe('type checks', function () { ... });
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
// Correct - input and output are visible
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

## Further Reading

- [Testing Strategy](testing-strategy.md) - directory layout and the simulating-loader pattern
- [Module Testing](module-testing.md) - testing tiers (emulated vs integration) and CI/CD
- [Integration Testing](integration-testing.md) - testing helpers against real cloud services
