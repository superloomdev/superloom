# CI Dependency Graph

> How GitHub Actions job dependencies are determined and configured.

## Core Concept

CI jobs execute in dependency order, not sequentially or by "tiers". Each job declares what it needs:

```yaml
test-sql-sqlite:
  needs: [detect, publish-utils, publish-debug, publish-instance]
```

`test-sql-sqlite` waits for ALL listed jobs to succeed before starting.

## Determining Job Dependencies

### Step 1: Identify Module Dependencies

Read the module's `loader.js`:

```javascript
module.exports = function loader (shared_libs, config) {
  const Lib = {
    Utils: shared_libs.Utils,
    Debug: shared_libs.Debug,
    InstanceManager: shared_libs.InstanceManager
  };
  // ...
};
```

Dependencies: `Utils`, `Debug`, `InstanceManager`

### Step 2: Map to Package Names

| Lib.* | npm Package | CI Publish Job |
|-------|-------------|----------------|
| `Utils` | `@superloomdev/js-helper-utils` | `publish-utils` |
| `Debug` | `@superloomdev/js-helper-debug` | `publish-debug` |
| `InstanceManager` | `@superloomdev/js-server-helper-instance` | `publish-instance` |

### Step 3: Configure Test Job

```yaml
test-sql-sqlite:
  needs: [detect, publish-utils, publish-debug, publish-instance]
  if: |
    always() &&
    !cancelled() &&
    needs.detect.result == 'success' &&
    contains(needs.detect.outputs.test_modules, 'js-server-helper-sql-sqlite')
```

## Dependency Depth

Dependencies can be arbitrarily deep:

```
Module 1 (no deps)
  ↓
Module 2 (needs Module 1)
  ↓
Module 3 (needs Module 2)
  ↓
...
  ↓
Module 50 (needs Modules 1-49)
```

**CI handles this naturally**:
- `publish-module1` runs first
- `publish-module2` waits for `publish-module1`
- `publish-module3` waits for `publish-module2`
- ...
- `test-module50` waits for ALL 49 publish jobs

No "tier 49" needed - just list the dependencies.

## Current Superloom Dependency Map

| Module | Dependencies | Test Job Needs |
|--------|--------------|----------------|
| `utils` | None | `detect` |
| `debug` | None | `detect` |
| `time` | `utils`, `debug` | `publish-utils`, `publish-debug` |
| `client-crypto` | `utils`, `debug` | `publish-utils`, `publish-debug` |
| `server-crypto` | `utils`, `debug` | `publish-utils`, `publish-debug` |
| `http` | `utils`, `debug` | `publish-utils`, `publish-debug` |
| `s3-url-signer` | `utils`, `debug` | `publish-utils`, `publish-debug` |
| `instance` | `utils`, `debug` | `publish-utils`, `publish-debug` |
| `sqlite` | `utils`, `debug`, `instance` | `publish-utils`, `publish-debug`, `publish-instance` |
| `s3` | `utils`, `debug`, `instance` | `publish-utils`, `publish-debug`, `publish-instance` |
| `dynamodb` | `utils`, `debug`, `instance` | `publish-utils`, `publish-debug`, `publish-instance` |
| `mongodb` | `utils`, `debug`, `instance` | `publish-utils`, `publish-debug`, `publish-instance` |
| `sqs` | `utils`, `debug`, `instance` | `publish-utils`, `publish-debug`, `publish-instance` |
| `mysql` | `utils`, `debug`, `instance` | `publish-utils`, `publish-debug`, `publish-instance` |
| `postgres` | `utils`, `debug`, `instance` | `publish-utils`, `publish-debug`, `publish-instance` |
| `verify` | `utils`, `debug`, `instance`, `server-crypto` | `publish-utils`, `publish-debug`, `publish-instance`, `publish-server-crypto` |

## Adding a New Module

### 1. Identify Dependencies

```javascript
// In new-module.js
const Lib = {
  Utils: shared_libs.Utils,
  Postgres: shared_libs.Postgres  // New dependency
};
```

### 2. Update CI Workflow

```yaml
test-new-module:
  needs: [detect, publish-utils, publish-debug, publish-postgres]
  if: |
    always() &&
    !cancelled() &&
    needs.detect.result == 'success' &&
    contains(needs.detect.outputs.test_modules, 'js-server-helper-new-module')
```

### 3. Update Test package.json

```json
{
  "dependencies": {
    "@superloomdev/js-helper-utils": "^1.0.0",
    "@superloomdev/js-helper-debug": "^1.0.0",
    "@superloomdev/js-server-helper-sql-postgres": "^1.0.0",
    "@superloomdev/js-server-helper-new-module": "file:../"
  }
}
```

## Common Patterns

### Foundation Modules (No Dependencies)

```yaml
test-utils:
  needs: [detect]
  # No publish dependencies
```

### Standard Modules (Foundation Dependencies)

```yaml
test-time:
  needs: [detect, publish-utils, publish-debug]
```

### Storage Modules (Instance Required)

```yaml
test-sqlite:
  needs: [detect, publish-utils, publish-debug, publish-instance]
```

### Complex Modules (Multiple Dependencies)

```yaml
test-verify:
  needs: [detect, publish-utils, publish-debug, publish-instance, publish-server-crypto]
```

## The `always()` Function

```yaml
needs: [detect, publish-utils, publish-debug]
if: |
  always() &&
  !cancelled() &&
  needs.detect.result == 'success'
```

**Why `always()`?**

Without it, if a dependency like `publish-debug` fails, `test-time` would be skipped entirely.

With `always()`, the job evaluates its `if` condition even if dependencies failed. The subsequent checks (`!cancelled()`, `needs.detect.result == 'success'`) control actual execution.

## Job Status Checks

| Status | Meaning | Test Job Runs? |
|--------|---------|----------------|
| `success` | Job completed successfully | Yes |
| `failure` | Job failed | No (unless `always()`) |
| `cancelled` | Job was cancelled | No (blocked by `!cancelled()`) |
| `skipped` | Job was skipped | Depends on `if` condition |

## Parallel Execution

Jobs with the same dependencies run in parallel:

```yaml
# These all need utils and debug - they run simultaneously
test-time:
  needs: [detect, publish-utils, publish-debug]

test-client-crypto:
  needs: [detect, publish-utils, publish-debug]

test-server-crypto:
  needs: [detect, publish-utils, publish-debug]
```

GitHub Actions automatically parallelizes independent jobs.

## Troubleshooting

### "Package not found" Error

**Symptom**: `npm ERR! 404 Not Found - GET https://npm.pkg.github.com/...`

**Cause**: Test job ran before publish job completed.

**Fix**: Add missing `publish-*` to `needs:` array.

### "Cannot find module" in Test

**Symptom**: `Error: Cannot find module '@superloomdev/js-helper-utils'`

**Cause**: `package.json` dependency missing or wrong version.

**Fix**: Verify `package.json` has correct package names and version ranges.

### Circular Dependencies

**Symptom**: CI deadlocks or GitHub rejects workflow.

**Cause**: Module A needs Module B, Module B needs Module A.

**Fix**: Refactor to eliminate circular dependency. One module must be foundational.

## References

- [GitHub Actions - Using jobs in a workflow](https://docs.github.com/actions/using-jobs/using-jobs-in-a-workflow)
- [GitHub Actions - Workflow syntax](https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions)
