# Logger Module Future TODOs

> **Status:** Not yet started. This document tracks all work needed when Logger store adapters are created.
> **Based on:** Patterns established in Auth and Verify modules.

---

## 1. Store Adapter Structure (Priority: High)

Create 5 separate packages following the `verify-store-*` pattern:

```
js-server-helper-logger-store-sqlite/
js-server-helper-logger-store-postgres/
js-server-helper-logger-store-mysql/
js-server-helper-logger-store-mongodb/
js-server-helper-logger-store-dynamodb/
```

Each package needs:
- `store.js` - Adapter implementation
- `store.validators.js` - Config validation
- `package.json` with proper `peerDependencies`
- `_test/` folder with full test suite
- `_deploy/` folder for CI/CD

---

## 2. Logger Package.json Updates (Priority: High)

Add to `js-server-helper-logger/package.json`:

```json
{
  "peerDependencies": {
    "@superloomdev/js-helper-utils": ">=1.0.0",
    "@superloomdev/js-helper-debug": ">=1.0.0"
  },
  "optionalPeerDependencies": {
    "@superloomdev/js-server-helper-logger-store-sqlite": "^1.0.0",
    "@superloomdev/js-server-helper-logger-store-postgres": "^1.0.0",
    "@superloomdev/js-server-helper-logger-store-mysql": "^1.0.0",
    "@superloomdev/js-server-helper-logger-store-mongodb": "^1.0.0",
    "@superloomdev/js-server-helper-logger-store-dynamodb": "^1.0.0"
  }
}
```

---

## 3. Clean Up Logger _test/ (Priority: High)

**Current Problem:** `logger/_test/` has centralized store adapter tests like Verify had.

### Files to Remove:
- `test-sqlite.js`
- `test-postgres.js`
- `test-mysql.js`
- `test-mongodb.js`
- `test-dynamodb.js`
- `shared-store-suite.js` (move to adapters)
- `loader-backend.js`
- `docker-compose.yml`

### Update `logger/_test/package.json`:

**Remove these dependencies:**
- `@superloomdev/js-server-helper-sql-sqlite`
- `@superloomdev/js-server-helper-sql-postgres`
- `@superloomdev/js-server-helper-sql-mysql`
- `@superloomdev/js-server-helper-nosql-mongodb`
- `@superloomdev/js-server-helper-nosql-aws-dynamodb`
- `mongodb`
- `pg`
- `mysql2`

**Simplify test script:**
```json
"scripts": {
  "test": "node --test test.js"
}
```

**Keep only unit test deps:**
- `js-helper-utils`
- `js-helper-debug`
- `js-server-helper-crypto`
- `js-server-helper-instance`
- `js-server-helper-logger` (file:../)

---

## 4. Logger Store Adapter Test Structure (Priority: High)

Each adapter `_test/` needs:

```
_test/
  ├── package.json          # Dependencies: verify ^x.x.x, adapter file:../
  ├── loader.js             # Test runtime setup
  ├── test.js               # Adapter unit tests + contract suite
  └── store-contract-suite.js # Copied from main module
```

### Adapter _test/package.json template:

```json
{
  "name": "js-server-helper-logger-store-sqlite-test",
  "dependencies": {
    "@superloomdev/js-helper-utils": "^1.0.0",
    "@superloomdev/js-helper-debug": "^1.0.0",
    "@superloomdev/js-server-helper-crypto": "^1.0.0",
    "@superloomdev/js-server-helper-instance": "^1.0.0",
    "@superloomdev/js-server-helper-sql-sqlite": "^1.0.0",
    "@superloomdev/js-server-helper-logger": "^1.x.x",
    "@superloomdev/js-server-helper-logger-store-sqlite": "file:../"
  }
}
```

---

## 5. CI/CD Updates (Priority: Medium)

Add to `.github/workflows/ci-helper-modules.yml`:

```yaml
# Logger store adapter jobs (follow verify-store-* pattern)
test-logger-store-sqlite:
  # ...
test-logger-store-postgres:
  # ...
test-logger-store-mysql:
  # ...
test-logger-store-mongodb:
  # ...
test-logger-store-dynamodb:
  # ...

# Logger main module
test-logger:
  needs: [detect, test-logger-store-sqlite, ...]
  # Only unit tests, no adapter integration tests
```

---

## 6. Version Bump (Priority: Medium)

When store adapters are ready:
- Bump `js-server-helper-logger` to next minor version
- Publish store adapters as v1.0.0
- CI will handle sequential publishing

---

## Reference: Verify Pattern (Completed)

Use `js-server-helper-verify-store-*` as the reference implementation:

```
verify-store-sqlite/_test/
  ├── package.json          # Has verify as npm dep, adapter as file:../
  ├── loader.js             # Sets up Lib with SQLite
  ├── test.js               # Unit tests + runs contract suite
  └── store-contract-suite.js # Copied from verify/_test/
```

---

## Checklist Summary

- [ ] Create 5 logger store adapter packages
- [ ] Add peerDependencies to logger/package.json
- [ ] Add optionalPeerDependencies to logger/package.json
- [ ] Remove store adapter test files from logger/_test/
- [ ] Clean up logger/_test/package.json dependencies
- [ ] Create proper test structure in each adapter
- [ ] Add CI jobs for all logger store adapters
- [ ] Bump logger version and publish

---

**Notes:**
- Follow the exact pattern from `verify-store-*` packages
- Keep logger/_test/ for unit tests only (like auth/_test/)
- Store adapters own their integration tests (like verify-store-*/_test/)
- Avoid cyclic dependencies: adapters depend on logger, not vice versa
