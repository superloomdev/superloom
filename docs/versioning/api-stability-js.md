# API Stability

> **Language:** [JavaScript](api-stability-js.md)

> What constitutes the public API in Superloom and how to maintain backward compatibility.

## Public API Definition

The public API is **every function and configuration option documented in `ROBOTS.md`**.

```markdown
# js-helper-utils

## Public API

### Functions

#### isEmpty(value)
Check if a value is empty.

- **Parameters**: `value` (any) - Value to check
- **Returns**: `boolean` - True if empty

#### toSlug(str, options)
Convert string to URL-friendly slug.

- **Parameters**:
  - `str` (string) - Input string
  - `options` (Object) - Optional configuration
    - `separator` (string) - Character to use (default: '-')
- **Returns**: `string` - Slugified string
```

**Everything in this document is a public API contract.**

## What Constitutes Breaking Change

### 1. Function Removal

**Breaking**: Deleting a documented function.

```javascript
// Before: 1.0.0
module.exports = {
  isEmpty,
  toSlug
};

// After: 2.0.0 (MAJOR - isEmpty removed)
module.exports = {
  toSlug
};
```

### 2. Parameter Type Change

**Breaking**: Changing expected parameter type.

```javascript
// Before: 1.0.0
function toSlug(str) { }  // Expects string

// After: 2.0.0 (MAJOR - expects object now)
function toSlug(config) { }  // Expects {str, separator}
```

### 3. Return Structure Change

**Breaking**: Changing return value structure.

```javascript
// Before: 1.0.0
return {id: 1, name: 'John'};

// After: 2.0.0 (MAJOR - property names changed)
return {userId: 1, userName: 'John'};
```

### 4. Default Behavior Change

**Breaking**: Changing default values.

```javascript
// Before: 1.0.0
function parse(str, options = {strict: false}) { }

// After: 2.0.0 (MAJOR - strict parsing by default)
function parse(str, options = {strict: true}) { }
```

### 5. New Thrown Errors

**Breaking**: Throwing where code didn't throw before.

```javascript
// Before: 1.0.0
function process(data) {
  return data.map(x => x * 2);  // Silent if data not array
}

// After: 2.0.0 (MAJOR - now throws)
function process(data) {
  if (!Array.isArray(data)) {
    throw new Error('Expected array');  // NEW THROW
  }
  return data.map(x => x * 2);
}
```

## What is NOT Breaking

### 1. Adding New Functions

**Safe**: Adding new documented functions.

```javascript
// Before: 1.0.0
module.exports = {
  isEmpty
};

// After: 1.1.0 (MINOR - new function added)
module.exports = {
  isEmpty,
  isValidEmail  // NEW
};
```

### 2. Adding Optional Parameters

**Safe**: Adding new optional parameters.

```javascript
// Before: 1.0.0
function toSlug(str) { }

// After: 1.1.0 (MINOR - new optional param)
function toSlug(str, options = {}) { }  // Safe - backward compatible
```

### 3. Adding Return Properties

**Safe**: Adding properties to returned objects.

```javascript
// Before: 1.0.0
return {id: 1, name: 'John'};

// After: 1.1.0 (MINOR - new property)
return {id: 1, name: 'John', email: 'john@example.com'};  // Safe - additive
```

### 4. Bug Fixes

**Safe**: Fixing incorrect behavior.

```javascript
// Before: 1.0.0 (BUG)
isEmpty(null);  // Returns false (incorrect)

// After: 1.0.1 (PATCH - bug fix)
isEmpty(null);  // Returns true (correct)
```

**Rationale**: Code relying on buggy behavior was already broken.

### 5. Internal Refactoring

**Safe**: Changing implementation without changing behavior.

```javascript
// Before: 1.0.0
function isEmpty(value) {
  return value === null || value === undefined || value === '';
}

// After: 1.0.1 (PATCH - internal change)
function isEmpty(value) {
  // Completely different algorithm, same output
  return [null, undefined, ''].includes(value);
}
```

## Configuration API Stability

Configuration options in `*.config.js` files are also public API:

```javascript
// config.js - PUBLIC API
module.exports = {
  timezone: 'UTC',        // Changing default = MAJOR
  timeout: 30000,         // Changing default = MAJOR
  retries: 3              // Changing default = MAJOR
};
```

**Adding new options**: MINOR (safe)
**Removing options**: MAJOR (breaking)
**Changing defaults**: MAJOR (breaking)

## Undocumented Internals

Anything NOT in `ROBOTS.md` is internal and can change anytime:

- Private helper functions
- Internal data structures
- Non-exported utilities
- Comments and documentation

```javascript
// Internal - not in ROBOTS.md
function _internalHelper() { }  // Can change anytime

// Public - documented in ROBOTS.md
function isEmpty() { }  // Breaking change if modified
```

## Deprecation Strategy

When removing functionality:

### Step 1: Deprecate (Minor Release)

```javascript
function oldFunction() {
  console.warn('oldFunction() is deprecated. Use newFunction() instead.');
  return newFunction();
}

module.exports = {
  oldFunction,  // Still works, but warns
  newFunction
};
```

Document in ROBOTS.md:

```markdown
### oldFunction() ⚠️ DEPRECATED
Use `newFunction()` instead. Will be removed in 2.0.0.
```

### Step 2: Remove (Major Release)

```javascript
// 2.0.0 - oldFunction removed
module.exports = {
  newFunction
};
```

Document in CHANGELOG.md:

```markdown
### Removed
- `oldFunction()` (was deprecated in 1.2.0)
```

## Maintaining API Compatibility

### Test Your Public API

Tests should verify documented behavior:

```javascript
// test.js - Tests public API contract
describe('isEmpty', () => {
  it('returns true for null', () => {
    assert.strictEqual(Utils.isEmpty(null), true);
  });
  
  it('returns true for undefined', () => {
    assert.strictEqual(Utils.isEmpty(undefined), true);
  });
  
  // These tests ensure API stability
});
```

### Document Edge Cases

Document behavior for edge cases in ROBOTS.md:

```markdown
#### isEmpty(value)

| Input | Output |
|-------|--------|
| `null` | `true` |
| `undefined` | `true` |
| `''` | `true` |
| `[]` | `true` |
| `{}` | `true` |
| `'text'` | `false` |
| `[1,2,3]` | `false` |
| `{a:1}` | `false` |
```

Changing any of these = **breaking change**.

## API Versioning Decision Matrix

| Change | Impact | Example |
|--------|--------|---------|
| New function | MINOR | Add `isValidEmail()` |
| New optional param | MINOR | Add `options` to existing function |
| New return property | MINOR | Add `email` to user object |
| Bug fix | PATCH | Fix `isEmpty(null)` returning `false` |
| Refactor internals | PATCH | Change algorithm, same output |
| Remove function | MAJOR | Delete `toSlug()` |
| Change param type | MAJOR | `string` → `object` |
| Change return type | MAJOR | `boolean` → `object` |
| Change default | MAJOR | `strict: false` → `strict: true` |
| Add required param | MAJOR | New mandatory parameter |

## References

- [Semantic Versioning](https://semver.org/)
- [ROBOTS.md](./ROBOTS.md) in each module
- [CHANGELOG.md](./CHANGELOG.md) for change history
