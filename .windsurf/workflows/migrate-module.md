---
description: Checklist for onboarding or migrating a helper module to project standards
---

# Module Migration / Onboarding Checklist

Run this checklist when adding a new helper module or migrating an existing one to current standards. Each section is a self-contained audit; work top to bottom.

## On This Page

- [1. Code Standards Audit](#1-code-standards-audit)
- [2. Package Identity](#2-package-identity)
- [2a. Required Files (Verify Physical Presence)](#2a-required-files-verify-physical-presence)
- [2b. Package Version Verification (Context7 MCP)](#2b-package-version-verification-context7-mcp)
- [2b. CI/CD Integration](#2b-cicd-integration)
- [3. Documentation Synchronization](#3-documentation-synchronization)
- [4. npmrc Audit](#4-npmrc-audit)
- [4. Testing](#4-testing)
- [5. README, ROBOTS, and Badges](#5-readme-brief-and-badges)
- [6. CI/CD Registration](#6-cicd-registration)
- [7. Documentation Sync](#7-documentation-sync)
- [7a. Migration Changelog Entry (Safe Patterns)](#7a-migration-changelog-entry-safe-patterns)
- [8. Commit Hygiene](#8-commit-hygiene-critical)
- [9. Version and Publish](#9-version-and-publish)

---

## 1. Code Standards Audit

- [ ] Module follows the standard structure: Loader → Exports → Public → Private (Singleton) or Loader → createInterface (Factory)
- [ ] Module picks the correct config pattern. Modules wrapping any per-instance state (pool, persistent client, session) use Pattern 2 (Multi-Instance Factory). Pure stateless wrappers use Pattern 1 (Singleton). Full rules: `docs/architecture/module-structure.md`
- [ ] `Lib.Utils` injected in loader and used for all type/null checks (no inline `typeof` except foundation modules)
- [ ] **Factory pattern (Pattern 2) specifics** (only if applicable):
  - [ ] Loader body only builds `Lib`, `CONFIG`, `state` and returns `createInterface(Lib, CONFIG, state)`
  - [ ] `module.exports = function loader (...)` is on the first executable line (no separate `module.exports = loader` at bottom)
  - [ ] All public and private functions live inside `createInterface`, **public first, private second** (NOT the reverse)
  - [ ] **CRITICAL**: Private functions come AFTER public functions in the code
  - [ ] Public functions are in `const ModuleName = { ... }` object
  - [ ] Private functions are in `const _ModuleName = { ... }` object (underscore prefix)
  - [ ] Public functions call private functions via `_ModuleName.functionName()`
  - [ ] Module-level adapter caches (`let AdapterRef = null`) are declared above the loader with a descriptive comment
  - [ ] `ensureAdapter()` used for vendor library lazy-load; `initIfNot()` used for per-instance resource build
  - [ ] Level 2 subsections (`// ~~~~~~~~ [Name] ~~~~~~~~` + purpose comment) used inside public/private objects when there are 5+ functions or 2+ responsibility groups
- [ ] **Singleton pattern (Pattern 1) specifics** (only if applicable):
  - [ ] Config loading comment: `// Base configuration (overridden by loader-injected config)`
  - [ ] Config override guard and comment: `// Merge loader-injected config (overrides base values)` with `if (config && typeof config === 'object')`
- [ ] JSDoc on every public function with `@param` and `@return`
- [ ] **Function Naming Decision Tree**:
  ```
  Do multiple functions achieve the same goal with different HTTP methods?
  ├─ Yes → Use HTTP method suffixes (generateUploadUrlPut/Post)
  └─ No  → Use standard naming (createUser, deleteFile)
  ```
- [ ] **Module Naming Strategy**: Use category-based naming for new modules:
  - `sql-` for relational databases (sql-mysql, sql-postgres, sql-sqlite)
  - `nosql-` for NoSQL databases (nosql-mongodb)
  - `nosql-aws-` for AWS NoSQL services (nosql-aws-dynamodb)
  - `storage-aws-` for AWS storage services (storage-aws-s3, storage-aws-s3-url-signer)
- [ ] **Vendor Pattern**: Use `-aws-` infix for AWS-specific services
- [ ] **Multi-HTTP-Method Pattern**: Apply only when 2+ functions do similar things with different HTTP methods
- [ ] **Standard Pattern**: Use descriptive verb-noun combinations for single-method operations
- [ ] **Avoid Generic Names**: Use specific names over convenience functions (no `generateUrls()`)
- [ ] Vertical spacing follows 3/2/1 rule
- [ ] American English spelling (`initialize`, `standardize` - not British `initialise`)
- [ ] **Return objects are multi-line** - never inline `return { key: val, key2: val2 }`
- [ ] **Every logical block has a single-line comment** explaining what the next 2-5 lines do
- [ ] **Human-tone comments** - no em-dashes, no migration/legacy references, no hosting-vendor-specific wording (AWS, Azure, GCP, RDS, Aurora) in framework docs. Database/protocol vendor names (MySQL, Postgres, DynamoDB, S3) are acceptable. Full rules: `docs/architecture/code-formatting-js.md` -> "Comment Authoring Style"
- [ ] **Standard Internal Comments**: Each function includes exactly 8 required comments:
  1. `// Initialize [service] SDK client (lazy loading)`
  2. `// Ensure options object exists`
  3. `// Create [service] [METHOD] command for [purpose]`
  4. `// Generate presigned URL with configurable expiry` (or equivalent)
  5. `// Log successful [operation]`
  6. `// Return successful response with [specifics]`
  7. `// Log error details for debugging`
  8. `// Return error response`
- [ ] **Performance logging** on every external service operation using `Lib.Debug.performanceAuditLog` with `instance['time_ms']`
- [ ] **Config file has no `process.env`** - pure defaults only, env values injected by loader
- [ ] **No `var` declarations** - use `const` (default) or `let` (when reassigned). Enforced by ESLint `no-var` + `prefer-const`
- [ ] **Multi-line JSON/YAML** - no `"devDependencies": { ... }` single-line; no `branches: [main]` YAML arrays

### For AWS / Cloud SDK Modules Only

- [ ] **3-layer DRY:** Builder (pure) -> Command Executor (I/O) -> Convenience (calls both)
- [ ] Explicit credentials via config (e.g., `CONFIG.KEY`, `CONFIG.SECRET`) - never rely on implicit credential chain
- [ ] Descriptive SDK variable names (named after the service - never `lib`, `sdk`)
- [ ] Two-helper lazy-load: `ensureAdapter()` loads the SDK, `initIfNot()` builds the per-instance client. Guard both with `Lib.Utils.isNullOrUndefined`
- [ ] Reserved keywords: use aliasing in query/expression languages to avoid conflicts with common field names
- [ ] Batch operations handle cloud API limits with recursive chunking

## 2. Package Identity

- [ ] `package.json` has correct `name` (`@superloomdev/js-*` or `@superloomdev/js-server-helper-*`)
- [ ] `publishConfig.registry` is exactly `https://npm.pkg.github.com` (no trailing slash, NO `/@superloomdev` suffix - that breaks auth)
- [ ] `private: false`, `license: MIT`
- [ ] `scripts` includes: `lint`, `lint:fix`, `test`
- [ ] No stale or unused dependencies
- [ ] `engines.node` is set (e.g., `">=20.19"`) - matches the minimum Node.js required by the newest dependency
- [ ] `package.json` uses multi-line JSON (not compressed single-line) - makes diffs readable
- [ ] **Version Management**: New modules start at version 1.0.0 (not 2.0.0)
- [ ] **Clean Migration**: For migrated modules, use `git reset --hard <base-commit>` to clean history

## 2b. CI/CD Integration

- [ ] **CI/CD Pattern**: Update `.github/workflows/ci-helper-modules.yml` with module detection pattern
- [ ] **Regex Pattern**: Use `src/helper-modules-[\w-]+/js-[\w-]+` (includes hyphens in directory names)
- [ ] **Add Module Section**: Include test-[module] and publish-[module] jobs in workflow
- [ ] **Environment Variables**: Add required env vars for service-dependent modules

### CI/CD Verification Commands (run these to verify)

Replace `<module-suffix>` with your actual module suffix (e.g., `nosql-mongodb`, `sql-mysql`, `storage-aws-s3`):

```bash
# 1. Check module header comment exists
grep "MODULE: js-server-helper-<module-suffix>" .github/workflows/ci-helper-modules.yml

# 2. Check for test job (required for all service-dependent modules)
grep "^  test-<module-suffix>:" .github/workflows/ci-helper-modules.yml

# 3. Check for publish job (required for all service-dependent modules)
grep "^  publish-<module-suffix>:" .github/workflows/ci-helper-modules.yml

# 4. Check all working-directory paths use NEW module name
grep "working-directory.*js-server-helper-<module-suffix>" .github/workflows/ci-helper-modules.yml

# 5. Verify no OLD module names remain (for renamed modules)
grep "js-server-helper-<old-suffix>[^-]" .github/workflows/ci-helper-modules.yml && echo "ERROR: Old names found!"
```

### Service-Dependent Module Checklist
- [ ] Service container configured with correct image and version pin
- [ ] Health check defined so the job waits for the service to be ready
- [ ] Environment variables match test loader expectations
- [ ] Test job has `services:` section matching what `_test/docker-compose.yml` provides locally

## 2a. Required Files (verify physical presence)

// turbo
- [ ] `eslint.config.js` exists at module root - without it, ESLint v9+ silently fails
// turbo
- [ ] `README.md` exists (human documentation)
// turbo
- [ ] `ROBOTS.md` exists (AI agent reference)
// turbo
- [ ] `_test/test.js` exists
// turbo
- [ ] `_test/loader.js` exists (unless module is a foundation with no DI - `utils`, `debug`)
// turbo
- [ ] `_test/package.json` exists

## 2b. Package Version Verification (Context7 MCP)

For every runtime and dev dependency, verify the latest stable version before locking it:

- [ ] Run `mcp0_resolve-library-id` with the package name to get the Context7 library ID
- [ ] Run `mcp0_query-docs` to fetch current version, Node.js requirement, and breaking changes
- [ ] Run `npm view <package> version` to cross-check exact latest release
- [ ] Update `dependencies` / `devDependencies` using caret ranges (`^<major>.<minor>.<patch>`)
- [ ] Update `engines.node` if a dependency raises the minimum Node.js version
- [ ] Run `npm install && npm test && npm run lint` - all must pass before committing

## 3. Documentation Synchronization

- [ ] **README.md**: Update API table, usage examples, and function names
- [ ] **ROBOTS.md**: Update module name, function descriptions, and loader pattern
- [ ] **JSDoc Comments**: Update function descriptions with HTTP method mentions
- [ ] **_test/test.js**: Update all function calls and test descriptions
- [ ] **Migration Log**: Add entry to `__dev__/migration-changelog.md` with before/after mapping
- [ ] **Cross-Reference Check**: Verify no old function names remain in any documentation

## 4. npmrc Audit

// turbo
- [ ] Verify no `.npmrc` file exists in the module directory
// turbo
- [ ] Verify no `.npmrc` file exists in `_test/` directory
// turbo
- [ ] Verify no `.npmrc` file exists in the project root
- [ ] Confirm global `~/.npmrc` has all 3 lines:
  - `@superloomdev:registry=https://npm.pkg.github.com`
  - `//npm.pkg.github.com/:_authToken=${GITHUB_READ_PACKAGES_TOKEN}`
  - `registry=https://registry.npmjs.org/` (safeguard against env var overrides)
- [ ] Verify `echo $npm_config_registry` is empty (not overriding npmrc)

## 4. Testing

- [ ] `_test/loader.js` exists - the ONLY file that reads `process.env`
- [ ] `_test/loader.js` returns `{ Lib, Config }` - `Lib` for deps, `Config` for resolved env values
- [ ] `_test/loader.js` has **no fallback defaults** (`||`) - module's own config.js handles defaults
- [ ] `_test/test.js` exists - imports `{ Lib, Config }` from loader
- [ ] `_test/test.js` does NOT contain `process.env` - uses `Config` from loader for everything
- [ ] Test infrastructure (AdminClient, etc.) in test.js uses `Config` values, not `process.env`
- [ ] `_test/package.json` has `"private": true` and references module as `"file:../"`
- [ ] Tests follow naming: `should [expected behavior] when [condition]`
- [ ] One `describe` per function, `strictEqual` for primitives
- [ ] Module's required env vars added to **all four** env files: `docs/dev/.env.dev.example`, `docs/dev/.env.integration.example`, `__dev__/.env.dev`, `__dev__/.env.integration`
- [ ] Every key present in `.env.dev` also exists in `.env.integration` (shapes must match)
- [ ] Dummy values in `.env.dev` match the credentials in `_test/docker-compose.yml` exactly
- [ ] `_test/ops/00-local-testing/` guide includes an explicit block listing all keys and their dummy values to add to `__dev__/.env.dev`
- [ ] Tests pass: `cd _test && npm install && npm test`

### For Service-Dependent Modules Only

- [ ] `_test/docker-compose.yml` exists with emulator service
- [ ] `_test/ops/00-local-testing/` has emulator setup guide
- [ ] `_test/ops/01-integration-testing/` has integration testing setup guide
- [ ] Dedicated test job exists in `.github/workflows/ci-helper-modules.yml` (not in matrix - e.g. `test-<module-suffix>`)
- [ ] Dedicated publish job exists in `.github/workflows/ci-helper-modules.yml` with the same service container (e.g. `publish-<module-suffix>`)
- [ ] Docker compose starts, tests pass, compose stops cleanly
- [ ] AWS dummy credentials work with emulator (no real credentials needed for emulated tier)

## 5. README, ROBOTS, and Badges

- [ ] Module has `README.md` at root (human documentation)
- [ ] Module has `ROBOTS.md` at root (compact AI agent reference - functions, deps, config, patterns)
- [ ] README includes: badges, description, API table, usage example, config table, Testing section
- [ ] **Every module has exactly 3 header badges**: Test (GitHub native badge, linked to `ci-helper-modules.yml`) + License + Node.js
- [ ] **Every module has a `## Testing` section** with a status table near the end of the README (template in `docs/architecture/module-testing.md`)
  - Offline modules: 1 row (Unit Tests)
  - Service-dependent modules: 2 rows (Emulated Tests + Integration Tests)
- [ ] Integration test badge set to correct status (`not_yet_tested`, `passing`, or `failing`) inside the Testing table - not in the header
- [ ] Badge and table templates are in `docs/architecture/module-testing.md` - copy from there

## 6. CI/CD Registration

There is a single unified workflow: `.github/workflows/ci-helper-modules.yml`. It runs tests on every push and PR, and publishes only modules whose `package.json` `version` field changed between `HEAD~1` and `HEAD`.

- [ ] Module added to the `test-offline` matrix in `.github/workflows/ci-helper-modules.yml` (offline modules) OR a dedicated `test-*` job (service-dependent modules with a Docker service container)
- [ ] Service-dependent modules also need a dedicated `publish-*` job with the same service container - offline modules are discovered automatically by the `detect` job
- [ ] CI runs successfully on push to `main`

## 7. Documentation Sync

- [ ] `docs/architecture/module-testing.md` updated with module entry
- [ ] `AGENTS.md` updated if architecture changed (run `/propagate-changes`)
- [ ] Any new patterns or learnings documented

### Module Name Cross-Reference Verification (for renamed modules)

When renaming modules, old names often remain in documentation. Replace `<old-name>` with the previous module name:

```bash
# Search all tracked files for the old module name (excludes gitignored __dev__/)
git grep "js-server-helper-<old-name>" -- \
  'docs/**' 'AGENTS.md' '.windsurf/**' 'demo-project/**' \
  'src/**/*.md' 'src/**/*.js' '*.yml'

# Broader search across ALL file types (excludes .git and gitignored)
git grep -l "js-server-helper-<old-name>"

# Common files that need updates:
# - docs/architecture/*.md (module examples, pattern references)
# - docs/dev/*.md (developer guides)
# - AGENTS.md (directory map)
# - demo-project/src/server/common/loader.js (example loader)
# - OTHER modules' README/ROBOTS (API comparison references - easy to miss!)
```

> **Note:** Use `git grep` instead of `grep -r` to automatically respect `.gitignore`. This avoids touching `__dev__/` personal workspace files.

**Common cross-reference locations to check:**
- [ ] API comparison statements ("compatible with X module")
- [ ] Import/require examples in documentation
- [ ] CI/CD workflow examples
- [ ] Architecture pattern examples
- [ ] Loader pattern examples
- [ ] Function reference implementations

### Reference Implementation Check
- [ ] For factory pattern modules: Compare structure with the canonical reference implementation (`dynamodb.js`)
- [ ] For SQL modules: Compare structure with the SQL reference implementation (`mysql.js`)
- [ ] Copy structure exactly, then adapt content

## 7a. Migration Changelog Entry (Safe Patterns)

Document all function renames, removals, or behavior changes in `__dev__/migration-changelog.md`.

**Direct file tools vs Terminal workaround:**

- **Normal files** (not gitignored): Use `read_file`, `edit`, `write_to_file` directly - the IDE has full access
- **Gitignored files** (e.g., `__dev__/migration-changelog.md`): IDE tools cannot access these - use the terminal workaround below

**CRITICAL - Avoid Heredoc Failures:**
When appending multi-line content via terminal to gitignored files, **do not use shell heredocs** (`cat <<'EOF' ... EOF`). Heredocs with complex content (backticks, code blocks, special characters) often hang or fail due to shell parsing issues.

**Use this safe terminal pattern for gitignored files:**

```bash
# Step 1: Create temp file with content (using write_to_file tool, not terminal heredoc)
# Step 2: Append via simple cat
cat /tmp/migration-entry.md >> /Users/sj/Projects/codebase-superloom/__dev__/migration-changelog.md
rm /tmp/migration-entry.md
```

**Entry template to include:**
- Module name and version bumped to
- Architecture changes (e.g., Axios -> native fetch)
- Public API changes (if any) - note if unchanged
- Config changes (removed/added keys with reasons)
- Dependency changes (dropped/added with reasons)
- engines.node changes
- Test updates (count, new regression tests)
- Files touched list
- Migration guide for callers (if breaking changes)

## 8. Commit Hygiene (CRITICAL)

- [ ] `git status` - nothing unexpected is uncommitted after the migration
- [ ] `git diff` - review every staged change, no secrets or accidental reformatting
- [ ] `ROBOTS.md` functions match the committed source exactly - never push docs that reference uncommitted code
- [ ] Final verification: on a fresh checkout of the committed branch, `npm install && npm test && npm run lint` must all pass
- [ ] **Single-line commit message via `-m`** - never embed newlines inside the quoted string. Multi-line `-m` strings hang the IDE terminal bridge. If a structured body is needed, use multiple `-m` flags or `git commit -F /tmp/commit-msg`. See `AGENTS.md` -> Safe Terminal Patterns.

## 9. Version and Publish

- [ ] Version **bumped** in `package.json` (patch/minor/major per semver) - without a version bump, the publish job does not run
- [ ] Commit follows conventional commits: `feat(module-name): description`
- [ ] Push to `main` -> `ci-helper-modules.yml` runs tests, detects the version bump, publishes the bumped module(s). If that exact version is somehow already on the registry, the safety-net step skips `npm publish` with a clear log - no failure
