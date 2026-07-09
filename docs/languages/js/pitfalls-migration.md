# Migration Pitfalls

> **Language:** JavaScript

Common issues encountered when **migrating an existing helper module** to current standards, with the fix for each. Use this as a checklist when bringing a legacy module up to spec, or when a CI run fails on a freshly-migrated module.

For lifecycle procedures (create, review, fix, publish) see the `/module` workflow in the `js-helper-modules` repository.

## On This Page

- [Function Naming Issues](#function-naming-issues)
- [Module Naming Issues](#module-naming-issues)
- [Module Structure Issues](#module-structure-issues)
- [Version Management Issues](#version-management-issues)
- [CI/CD Detection Issues](#cicd-detection-issues)
- [Documentation Synchronization Issues](#documentation-synchronization-issues)
- [Testing Issues](#testing-issues)
- [Cross-Reference Issues](#cross-reference-issues)
- [Performance Logging Issues](#performance-logging-issues)
- [Prevention Checklist](#prevention-checklist)

---

## Function Naming Issues

### Generic name doesn't distinguish multiple HTTP methods

**Symptom:** `generateUploadUrl()` exists but the API has both PUT and POST upload variants.

**Fix:** Apply the Multi-HTTP-Method Pattern. Use HTTP method suffixes when 2+ functions share a goal but use different methods:

| Functions | Naming |
|---|---|
| Multiple HTTP methods for same goal | `generateUploadUrlPut()`, `generateUploadUrlPost()` |
| Single method | `createUser()`, `deleteFile()` (no suffix) |

### Convenience function combines multiple operations

**Symptom:** `generateUrls()` returns both upload and download URLs.

**Fix:** Split into separate functions. Call `generateUploadUrlPut()` and `generateDownloadUrlGet()` separately. Two specific functions beat one generic wrapper.

### HTTP method suffix used when only one method exists

**Symptom:** `createUserPost()` even though only POST is supported.

**Fix:** Apply the suffix pattern only when multiple HTTP methods exist for the same goal. Single-method functions stay plain.

---

## Module Naming Issues

### Inconsistent naming across similar services

**Symptom:** `js-server-helper-mysql` and `js-server-helper-aws-dynamodb` don't follow the same pattern.

**Fix:** Use category-based naming. See [`code-formatting.md`](code-formatting.md#module-naming) for the full table:

| Category | Prefix | Example |
|---|---|---|
| Relational databases | `sql-` | `js-server-helper-sql-mysql` |
| NoSQL databases | `nosql-` | `js-server-helper-nosql-mongodb` |
| AWS NoSQL | `nosql-aws-` | `js-server-helper-nosql-aws-dynamodb` |
| AWS object storage | `storage-aws-` | `js-server-helper-storage-aws-s3` |

### Vendor placement wrong

**Symptom:** `aws-sql-mysql` instead of `sql-mysql`.

**Fix:** Vendor name is an **infix** for cloud-specific services, not a prefix.

| Module type | Pattern | Example |
|---|---|---|
| Generic services | `[category]-[service]` | `sql-mysql`, `nosql-mongodb` |
| Cloud-specific services | `[category]-[vendor]-[service]` | `nosql-aws-dynamodb`, `storage-aws-s3` |

---

## Module Structure Issues

### Private functions defined before public functions

**Symptom:** Helper module follows factory pattern but `_ModuleName` (private) appears before `ModuleName` (public) inside `createInterface`.

**Root cause:** Misunderstanding the createInterface pattern.

**Fix:** Public functions come **first**, private functions come **after** within `createInterface`. Public functions reference private via `_ModuleName.functionName()`. Both share the same closure scope (`Lib`, `CONFIG`, `state`).

See [`module-structure.md`](module-structure#helper-module-pattern-factory) for the canonical structure.

### Formatting drift after a refactor pass

**Symptom:** After renaming variables, restructuring blocks, or moving functions, the file has correct logic but: missing or stale inline step comments, incorrect vertical spacing around modified blocks, and comment text still referencing old names.

**Root cause:** The edit tools apply changes surgically, one block at a time. Each edit focuses on the structural change. Comment coverage of new/moved blocks, spacing around modified sections, and stale wording in nearby comments are not re-evaluated during the logic pass. They only surface on a dedicated formatting read.

**Fix:** Any refactor that touches 3+ functions or renames variables/parameters requires a mandatory two-pass check before the task is complete:

- **Pass 1 (Logic):** Make all structural changes. Run `npm run lint`.
- **Pass 2 (Formatting):** Re-read the full file top-to-bottom. Verify for every function and section:
  - (a) Step comment on every logical block
  - (b) Correct 3/2/1 vertical spacing
  - (c) No stale comment text referencing old names
  - (d) Consistent banner widths
  - (e) **No single-line `return { ... }` objects.** All object returns must be multi-line (see [Return Objects](code-formatting.md#return-objects))
  - (f) **Private helpers in `_Name` enclosure.** No bare `Name.method = function(...)` assignments; all private helpers live inside `const _Name = { ... }` (see [Private Functions Enclosure](code-formatting.md#private-functions-enclosure))
  - (g) **`};` combined with END banner.** No standalone `};` line before `///...END...///` banners (see [Section Closing Banners](code-formatting.md#section-closing-banners))
  - Run `npm run lint` again.

### Verification scoped to the fix list instead of the class skeleton

**Symptom:** A module passes its unification pass (fix list applied, lint green, tests green, sweep battery clean) but still deviates structurally from the standard - for example a loader with no step comments, a validators loader taking `(Lib)` instead of `(Lib, ERRORS)`, or an adapter with inline `ERRORS` and inline config validation instead of companion files. The `http-gateway` loader shipped without step comments this way: every check verified the enumerated fix list, and the fix list never contained "add step comments" because the audit that produced it predated the check.

**Cause:** The verification pass answered "did I do everything on my list?" instead of "does this file match the canonical skeleton?". Fix lists are derived from point-in-time audits; the skeleton in [`module-structure.md`](module-structure) is the living standard. Anything the audit missed stays invisible to a list-scoped verification, no matter how many passes run.

**Fix:** The final verification pass must include a **skeleton conformance diff**: open the class's skeleton section in `module-structure.md` (factory skeleton for Class A/B, Storage Adapter Skeleton or Adapter Skeleton for Class F, and so on) side by side with the module's entry file and compare structure element by element - info banner shape, loader statement groups and their step comments, companion-file wiring, `createInterface` slots, section banners. Structural conformance is a distinct checklist item from the fix list, the lint gate, and the sweep battery; none of those three catch a missing step comment.

### Patching when complete rewrite is needed

**Symptom:** Trying to use targeted edits to transform a singleton-pattern module into a factory-pattern module.

**Root cause:** The structural changes are too extensive for incremental edits.

**Fix:** When module architecture changes completely:

- Delete the old file and write a new one from scratch
- Use the [reference implementations](module-structure#reference-implementations) as a template
- Copy the structure exactly, then adapt the content
- Don't try to preserve old code structure when the pattern changes

### Module not added to CI/CD workflow

**Symptom:** New or renamed module completely missing from `ci-helper-modules.yml`.

**Root cause:** Forgetting to add test and publish jobs after module creation.

**Fix:** Verify CI/CD coverage on every migration:

```bash
# Replace <module-suffix> with your suffix (e.g., nosql-mongodb)
grep "MODULE: js-server-helper-<module-suffix>" .github/workflows/ci-helper-modules.yml
grep "test-<module-suffix>:" .github/workflows/ci-helper-modules.yml
grep "publish-<module-suffix>:" .github/workflows/ci-helper-modules.yml
```

Each new service-dependent module needs **both** a `test-*` and a `publish-*` job. Copy the structure from a similar existing module and update all paths, job names, service containers, and conditions.

### Missing test loader file

**Symptom:** Tests have no `loader.js` and require manual `Lib` setup in every test file.

**Root cause:** Forgetting that all service-dependent and DI-using modules need a test loader.

**Fix:** Every helper module that uses dependency injection needs `_test/loader.js`. The loader is the **only** file allowed to read `process.env`.

```javascript
module.exports = function loader () {
  // Step 1: Load config from environment (process.env ONLY here)
  const Config = { /* ... */ };
  const config_module = { /* ... */ };

  // Step 2: Load peer dependencies
  const Utils = require('@your-org/js-helper-utils')();
  const Debug = require('@your-org/js-helper-debug')(Lib, config_debug);
  const Instance = require('@your-org/js-server-helper-instance');

  // Step 3: Create module instance - require by `_test/package.json` alias,
  // not relative source path. Aliases keep loader code identical between
  // local-source and published-package contexts.
  const Module = require('helper-[module-name]')({ Utils, Debug, Instance }, config_module);

  // Step 4: Return Lib container and Config
  return { Lib: { Utils, Debug, Instance, Module }, Config };
};
```

---

## Version Management Issues

### Wrong version for migrated modules

**Symptom:** Publishing a migrated module as `2.0.0` instead of `1.0.0`.

**Fix:** Start all migrated modules at `1.0.0`. Use `git reset --hard <base-commit>` for clean migration history if needed. Only **existing already-published** modules use semantic versioning for breaking changes.

---

## CI/CD Detection Issues

### Regex pattern doesn't match module directory

**Symptom:** Pattern `src/helper-modules-\w+/js-[\w-]+` misses `helper-modules-server`.

**Root cause:** `\w+` only matches word characters - not hyphens.

**Fix:** Use a hyphen-inclusive pattern:

```bash
# Correct pattern - includes hyphens in directory names
src/helper-modules-[\w-]+/js-[\w-]+

# Test it
echo "path" | grep -oP 'src/helper-modules-[\w-]+/js-[\w-]+'
```

---

## Documentation Synchronization Issues

### Function rename not propagated everywhere

**Symptom:** Function name updated in main file but not in tests, docs, or CI workflow.

**Fix:** Update **all** affected files in the same change (atomic update):

| File | What to update |
|---|---|
| Main module file | Function definitions |
| JSDoc comments | Function descriptions |
| `README.md` | API table and usage examples |
| `ROBOTS.md` | Function list |
| `_test/test.js` | All function calls |
| Migration log (`__dev__/migration-changelog.md`) | Before/after mapping |
| `.github/workflows/ci-helper-modules.yml` | Module references |

---

## Testing Issues

### Service-dependent tests fail without credentials

**Symptom:** Tests expect AWS credentials but the CI environment has none.

**Fix:** Design tests for both local Docker emulators and real cloud services. The same test code runs both - only the configuration differs:

- **Emulated:** dummy credentials, `[SERVICE]_ENDPOINT` set to `http://localhost:NNNN`
- **Integration:** real credentials, no endpoint override

Mock `Utils` and `Debug` only when truly needed. Prefer the test loader with real injected dependencies for fidelity. Test error handling alongside successful operations.

---

## Cross-Reference Issues

### Old terminology remains after migration

**Symptom:** Old function names still referenced in documentation after a rename.

**Fix:** Verify cross-reference integrity using `git grep` (which respects `.gitignore` and skips `__dev__/`):

```bash
# Search tracked files for old terminology
git grep "[old-term]"

# Target specific paths
git grep "[old-term]" -- 'docs/**' 'AGENTS.md' '.devin/**' 'src/**/*.md'

# Fix all matches in the same change (atomic update)
```

When renaming an entire module, also check **other modules' README and ROBOTS** files for API comparison statements (`compatible with X module`) - those are the easiest to miss.

**Common cross-reference locations:**

- API comparison statements ("compatible with X module")
- Import / require examples in documentation
- CI/CD workflow examples
- Architecture pattern examples
- Loader pattern examples
- Function reference implementations

---

## Signature Drift Issues

### Underscore-prefixed createInterface slots instead of canonical names

**Symptom:** After a unification pass, `createInterface` reads `function (Lib, _CONFIG, _ERRORS, _Validators)` - the underscore prefix silences ESLint's `no-unused-vars` (via `argsIgnorePattern: '^_'`) but breaks the grep-identical fixed-slots signature that [Module Structure](module-structure) mandates.

**Cause:** The module's `createInterface` does not consume every fixed slot, ESLint flags the unused trailing params, and the agent reaches for the underscore escape hatch the lint config appears to bless - without checking the skeleton. The rule was already written ("Unused fixed slots are kept, not removed" in Module Structure): keep canonical names and suppress with `// eslint-disable-line no-unused-vars` on the `createInterface` line. The gap was enforcement, not documentation - the skeleton conformance greps checked step comments and companion wiring but not parameter names.

**Fix:** Restore canonical names `(Lib, CONFIG, ERRORS, Validators)`, add `// eslint-disable-line no-unused-vars` on the signature line, and fix the JSDoc `@param` names to match. The `/unify-module` workflow now greps for `createInterface = function \(.*_(CONFIG|ERRORS|Validators)` as a hard-gate violation.

**Lesson:** A lint suppression mechanism that is *permitted* by the ESLint config is not automatically *permitted* by the skeleton. When lint and skeleton appear to conflict, the skeleton doc decides - and it usually already has (search it before inventing a workaround).

### JSDoc blocks left at old indentation after nesting-depth change

**Symptom:** After a singleton-to-factory restructure, JSDoc `/***` blocks inside `createInterface` sit at 2 spaces while the function declarations they document sit at 4 spaces (e.g. `js-server-helper-storage-aws-s3-url-signer` post-unification). Lint passes; the misalignment survives every gate.

**Cause:** Restructuring moves code one level deeper, then `eslint --fix` is used to correct indentation. ESLint's `indent` rule auto-fixes **code only - it never touches comment indentation**. Comments keep their pre-restructure column. Neither the sweep battery (pattern greps), the skeleton conformance diff (element presence, not whitespace), nor the two-pass checklist (which did not name this checkpoint) caught it.

**Fix:** Re-indent every comment block (JSDoc and single-line) to the exact column of the next non-comment line. Detect with: for each `/***` line, compare its leading-space count against the following declaration line - any mismatch is a violation.

**Lesson:** `eslint --fix` is not a full indentation authority - comments are outside its jurisdiction. Any pass that changes nesting depth (singleton-to-factory especially) must be followed by an explicit comment-indentation check. Never treat "lint 0" as proof the file is correctly indented.

---

## Performance Logging Issues

### `performanceAuditLog` reference_time is a constant, not the operation start

**Symptom:** `elapsed_ms` in audit logs grows monotonically across a request instead of reporting each operation's duration. A 5 ms queue send that runs 200 ms into the request logs `elapsed_ms: 200`. In the worst variant, `Init-Start`/`Init-End` calls pass a *freshly created* timestamp as `reference_time`, so `elapsed_ms` is always ~0 and the line carries no signal at all.

**Cause:** A self-contradiction inside the [Performance Logging](code-formatting.md#performance-logging) rules. The Phase 0 standards freeze added "one call per operation, `action: 'End'`, the reference time carries the start" - a rule that implicitly requires a local `start_ms` captured at operation entry - while a pre-existing bullet in the same section said "prefer `instance['time_ms']` over `time_start`". `instance['time_ms']` is the request-start timestamp set once by `helper-instance` and never updated, so it cannot "carry the start" of any individual operation. The debug module's own `docs/api.md` compounded the contradiction with a canonical example showing a `'Start'`/`'End'` *pair* both passing `instance.time_ms`. Six modules were unified against the contradictory rule and every pass faithfully preserved the wrong reference time - no sweep, lint, or skeleton check examines `performanceAuditLog` arguments.

**Fix:** In every operation, capture `const start_ms = Lib.Utils.getUnixTimeInMilliSeconds();` at entry and pass it as the third argument to the single `performanceAuditLog('End', routine, start_ms)` call. For client/SDK initialization, capture `init_start_ms` before the import/connect work and emit one `'End'` call after it. Never pass `instance['time_ms']` and never pass a timestamp created on the same line as the call.

**Lesson:** When a standards freeze adds a rule to an existing section, every pre-existing bullet in that section must be re-validated against the new rule - a frozen standard that contradicts itself propagates the wrong half to every module unified against it. And semantic argument errors (a plausible-looking but wrong variable) are invisible to lint, tests, and structural sweeps: rules about *which value* to pass need their own grep in the verification battery.

### Duplicate audit lines from layered performance logging

**Symptom:** One logical operation emits stacked, near-identical `[AUDIT]` lines. A `DistinctQueue.enqueue()` on MongoDB logged three: `DistinctQueue enqueue` (composite module), `DistinctQueue mongodb writeRecord - [collection]` (store adapter), and `MongoDB writeRecord` (driver). The adapter and driver intervals differ by ~1 ms of in-process mapping - the middle line carries no information the other two do not.

**Cause:** The [Performance Logging](code-formatting.md#performance-logging) rule said "every external service operation must log performance" without saying *which layer* owns the call. Unification passes read a store adapter's `writeRecord` as an "external service operation" and added `performanceAuditLog` to every adapter method (and to the composite module's public functions), even though the driver beneath already logs every roundtrip and its client/connection initialization. The result diverged from the rest of the codebase: all other store adapters (`logger-store-*`, `verify-store-*`, `auth-store-*`) and their parents have no perf logging at all - the distinct-queue family became a triple-logging outlier.

**Fix:** Timing instrumentation follows ownership: each interval is logged exactly once, by the layer that performs the work. Built-in instrumentation is part of every driver's contract (`nosql-*`, `sql-*`, `queue-*`, `storage-*`, `http`) - roundtrips plus client/connection init - and callers assume it. Remove `performanceAuditLog` from any non-driver call site that wraps delegated I/O; delete the now-unused local `start_ms` captures with it. A non-driver module keeps a call only where it measures its **own** substantial in-process work (batch analysis, heavy transformation), with a routine name describing that work. A multi-roundtrip composite operation appears in the logs as its sequence of driver lines - that sequence IS the timeline; no wrapper summary line is added.

**Lesson:** A rule that names an action ("log performance") without naming its owner gets applied at every layer that plausibly matches, multiplying the action. The correct framing is ownership, not a location ban - `performanceAuditLog` is a general timing instrument (legitimate for in-process work too), so the rule must distinguish "your own work" from "delegated work" rather than whitelist module classes. Ownership rules need a placement grep in the verification battery - structural sweeps only check *how* a call is written, never *whether the measured interval belongs to this module at all*.

---

## Prevention Checklist

Before completing any migration:

- [ ] Function names use the [Multi-HTTP-Method Pattern](#function-naming-issues) when applicable
- [ ] Every logical block within a function has a single-line comment explaining intent
- [ ] Module name follows the category-based strategy (`sql-`, `nosql-`, `nosql-aws-`, `storage-aws-`, `queue-aws-`)
- [ ] Vendor name is an infix for cloud-specific services (not a prefix)
- [ ] Version is `1.0.0` for new and migrated modules
- [ ] CI/CD detection regex includes hyphens (`[\w-]+`)
- [ ] All documentation files updated consistently
- [ ] Tests work in both emulated and integration tiers
- [ ] No old terminology remains in any tracked file (`git grep` is empty)
- [ ] Migration log entry added with complete before/after mapping (`__dev__/migration-changelog.md`)
- [ ] **Module structure follows the createInterface pattern** (private AFTER public)
- [ ] **`_test/loader.js` exists** for all server helper modules and any DI-using module
- [ ] **Module added to CI/CD workflow** (both `test-*` and `publish-*` jobs for service-dependent modules)
- [ ] **CI/CD paths use the new module directory name**
- [ ] **Documentation cross-references use new module names**
- [ ] **No `exports` field in single-entrypoint packages** - if `main` already points to the only entry file, `exports` is redundant and should be omitted. Only add `exports` when the package exposes multiple entry points or needs explicit subpath exports
- [ ] **Two-pass check done after any refactor** touching 3+ functions or renaming variables: logic pass first, then a dedicated formatting read (step comments, 3/2/1 spacing, stale comment text, banner widths, return objects multi-line, private helpers in `_Name` enclosure, `};` combined with END banners, JSDoc-block indentation matches declaration indentation)
- [ ] **Comment indentation matches code** after any nesting-depth change - every JSDoc `/***` block and single-line comment sits at the exact column of the next non-comment line. `eslint --fix` does NOT fix comment indentation; check manually or via the leading-space comparison in [JSDoc blocks left at old indentation](#jsdoc-blocks-left-at-old-indentation-after-nesting-depth-change)
- [ ] **Every `performanceAuditLog` interval is logged once, by the owner of the work** - drivers (`nosql-*`, `sql-*`, `queue-*`, `storage-*`, `http`) instrument their own roundtrips and client init as part of their contract; non-driver modules never re-log delegated I/O and carry a call only for their own substantial in-process work. See [Duplicate audit lines from layered performance logging](#duplicate-audit-lines-from-layered-performance-logging)
- [ ] **Skeleton conformance diff done** - the module's entry file compared element by element against its class's skeleton section in `module-structure.md` (loader statement groups + step comments, companion-file wiring, `createInterface` slots, banners). A fix list, lint, and the sweep battery do not substitute for this
- [ ] **Every `performanceAuditLog` call passes a local `start_ms`** captured at operation entry as `reference_time` - never `instance['time_ms']` (request-start constant) and never a timestamp created on the same line as the call (see [Performance Logging Issues](#performance-logging-issues))

## Further Reading

- [Module Structure (JavaScript)](module-structure) - the factory pattern every helper module follows
- [Module Testing](module-testing.md) - testing tiers, badges, and CI/CD setup
- [Code Formatting](code-formatting.md) - naming, comments, and the conventions enforced by ESLint
- `/module` workflow (`js-helper-modules` repository) - the lifecycle procedure that replaced the migration checklist
