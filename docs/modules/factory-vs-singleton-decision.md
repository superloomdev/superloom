# Factory vs Singleton Decision Guide

> **Language:** [JavaScript](module-structure-js)

A comprehensive guide for choosing between factory and singleton patterns in Superloom modules. The default is factory pattern for testability, with singleton pattern reserved for rare cases.

## Quick Decision Matrix

| Module Characteristic | Use Factory Pattern | Use Singleton Pattern |
|---|---|---|
| **Has external dependencies** (libs, config, adapters) | ✅ **Always** | ❌ Never |
| **Takes configuration parameters** | ✅ **Always** | ❌ Never |
| **Needs different behavior per caller** | ✅ **Always** | ❌ Never |
| **Pure functions with zero dependencies** | ✅ Preferred | ⚠️ Only if no test isolation needed |
| **Foundation utility library** | ✅ Preferred | ⚠️ Only if truly dependency-free |

**Rule of thumb:** If a module takes any external dependencies (libs, config, adapters), use factory pattern. Only consider singleton for pure utility modules with zero dependencies.

---

## Factory Pattern (Default Choice)

### When to Use

Use factory pattern when **any** of these apply:

- Module takes `shared_libs` parameter
- Module takes `config` parameter  
- Module wraps external dependencies (DB, SDK, filesystem)
- Different callers need different configurations
- Module holds per-instance state (connections, pools, clients)
- Test isolation is required

### Benefits

#### Testability
```javascript
// Each test gets isolated instance
const testInstance1 = createModule({ log_level: 'debug' });
const testInstance2 = createModule({ log_level: 'error' });

// Tests can run in parallel without conflicts
// Mock dependencies can be injected per test
```

#### Configuration Flexibility
```javascript
// Different behavior for different contexts
const devLogger = createDebugModule({ output_format: 'text' });
const prodLogger = createDebugModule({ output_format: 'json' });

// Multi-tenant setups
const tenantAAuth = createAuthModule({ store: tenantAStore });
const tenantBAuth = createAuthModule({ store: tenantBStore });
```

#### Future-Proofing
```javascript
// Easy to add state later without breaking changes
// Easy to add new dependencies without breaking changes
// Easy to evolve API without breaking existing callers
```

### Implementation Pattern

```javascript
module.exports = function loader (shared_libs, config) {
  const Lib = { Utils: shared_libs.Utils };
  const CONFIG = Object.assign({}, defaults, config);
  
  return createInterface(Lib, CONFIG);
};

const createInterface = function (Lib, CONFIG) {
  return {
    methodName: function (params) {
      // Functions close over Lib and CONFIG
    }
  };
};
```

---

## Singleton Pattern (Rare Exception)

### When to Use

Use singleton pattern only when **all** criteria are met:

- Zero external dependencies (no `shared_libs`, no `config`)
- Pure functions only (no I/O, no side effects)
- Identical behavior for all callers
- No configuration needed
- No test isolation concerns

### Valid Use Cases

#### Foundation Utilities
```javascript
// js-helper-utils - pure utility functions, loader initializes Validators
let Validators;

module.exports = function loader (shared_libs, config) {
  Validators = require('./utils.validators')(shared_libs);
  return Utils;
};

const Utils = {
  isNull: function (arg) { return arg === null; },
  isString: function (arg) { return typeof arg === 'string'; },
  // ... pure utility functions
};
```

#### Data-Only Modules
```javascript
// error catalogs, config defaults
module.exports = Object.freeze({
  INVALID_INPUT: 'Invalid input provided',
  MISSING_REQUIRED: 'Required field is missing'
});
```

### Implementation Pattern

```javascript
// No loader needed for pure singletons
module.exports = {
  methodName: function (params) {
    // Pure function, no external deps
  }
};
```

---

## Testability Implications

### Factory Pattern Testing

```javascript
describe('MyModule', () => {
  it('handles different configurations', () => {
    const instance1 = createModule({ timeout: 1000 });
    const instance2 = createModule({ timeout: 5000 });
    
    // Each instance has different behavior
    expect(instance1.getTimeout()).toBe(1000);
    expect(instance2.getTimeout()).toBe(5000);
  });
  
  it('accepts mock dependencies', () => {
    const mockLib = { Utils: { isNull: () => false } };
    const instance = createModule(mockLib, {});
    
    // Test with mocked dependencies
  });
});
```

### Singleton Pattern Testing

```javascript
describe('UtilsModule', () => {
  it('works consistently across tests', () => {
    // No configuration needed
    expect(Utils.isNull(null)).toBe(true);
    expect(Utils.isNull('')).toBe(false);
  });
  
  // Note: Cannot test with different configurations
  // Note: Cannot inject mock dependencies
});
```

---

## Migration Guidance

### From Singleton to Factory

**When to migrate:**
- Adding external dependencies
- Adding configuration parameters
- Needing test isolation
- Multiple instance requirements

**Migration steps:**
1. Add loader function with `shared_libs` and `config` parameters
2. Move module logic into `createInterface` function
3. Update all callers to use factory pattern
4. Update tests to create instances per test
5. Version bump (breaking change)

### From Factory to Singleton

**When to consider:**
- Module has zero dependencies
- Module is pure utility functions
- No configuration needed
- Test isolation not required

**Migration steps:**
1. Remove loader function
2. Export functions directly
3. Update all callers to use direct require
4. Update tests accordingly
5. Version bump (breaking change)

---

## Performance Considerations

### Factory Pattern Overhead
- **Memory:** Each instance holds its own closure (minimal overhead)
- **CPU:** Instance creation is fast (microseconds)
- **Benefits:** Far outweighs minimal overhead in most cases

### Singleton Pattern Benefits
- **Memory:** Single instance shared across process
- **CPU:** No instance creation overhead
- **Trade-offs:** Lost testability and flexibility

### Recommendation
Performance differences are negligible compared to testability benefits. Use factory pattern unless module is truly dependency-free.

---

## Real-World Examples

### Correct Factory Usage

```javascript
// js-helper-debug - takes config, needs test isolation
const Debug = require('@superloomdev/js-helper-debug')(Lib, {
  log_level: 'info',
  output_format: 'json'
});

// js-helper-time - takes Utils dependency and config
const Time = require('@superloomdev/js-helper-time')(Lib, {
  default_timezone: 'UTC'
});

// js-server-helper-auth - takes store dependency
const Auth = require('@superloomdev/js-server-helper-auth')(Lib, {
  STORE: postgresStore,
  ACTOR_TYPE: 'user'
});
```

### Correct Singleton Usage

```javascript
// js-helper-utils - singleton loader, returns same Utils object
const Utils = require('@superloomdev/js-helper-utils')({}, {});

// error catalog - data only
const Errors = require('./module.errors');
```

---

## Decision Checklist

Before choosing singleton pattern, verify:

- [ ] Module has zero external dependencies
- [ ] Module takes no configuration parameters
- [ ] All functions are pure (no I/O, no side effects)
- [ ] No caller needs different behavior
- [ ] Test isolation is not required
- [ ] Module is truly dependency-free

If any answer is "no", use factory pattern.

---

## Common Pitfalls

### Incorrect Singleton Usage

```javascript
// WRONG: Takes config but uses singleton pattern
let CONFIG;
module.exports = function loader (config) {
  CONFIG = config;  // Last caller wins!
  return singletonInstance;
};

// PROBLEM: Tests interfere with each other
// PROBLEM: Cannot have different configurations
// SOLUTION: Use factory pattern
```

### Missing Test Isolation

```javascript
// WRONG: Global state in singleton
let globalCache = {};
module.exports = {
  get: function(key) { return globalCache[key]; },
  set: function(key, value) { globalCache[key] = value; }
};

// PROBLEM: Tests share cache state
// PROBLEM: Cannot reset state between tests
// SOLUTION: Use factory pattern with per-instance state
```

---

## Further Reading

- [Module Structure (JavaScript)](module-structure-js) - Implementation patterns
- [Core Helper Modules](core-helper-modules) - Factory pattern guidance
- [Module Testing](../testing/module-testing) - Testing strategies and isolation
