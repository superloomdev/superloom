# Version Bump Checklist

> Step-by-step procedure for releasing new module versions.

## Quick Start

```bash
# 1. Classify changes
# 2. Update version in package.json
# 3. Commit with Conventional Commit format
# 4. Push - CI handles the rest
```

## Pre-Bump Analysis

Before changing any versions, answer these questions:

### 1. What Changed?

Review all commits since last release:

```bash
git log v1.0.0..HEAD --oneline
```

Categorize each change:

| Change | Category | Version Impact |
|--------|----------|----------------|
| New function added | Feature | Minor |
| Function signature changed | Breaking | Major |
| Bug fixed | Fix | Patch |
| Documentation updated | Docs | Patch |
| Internal refactor | Refactor | Patch |
| Performance improved | Perf | Patch |
| Tests added | Test | Patch |

### 2. Determine New Version

```
Highest impact change determines version:
├── Any breaking change → MAJOR bump
├── Any new feature → MINOR bump
└── Only fixes/docs → PATCH bump
```

**Examples**:

| Changes | Current | New | Reason |
|---------|---------|-----|--------|
| 3 bug fixes | `1.0.1` | `1.0.2` | Only patches |
| 1 bug fix + 1 new feature | `1.0.1` | `1.1.0` | New feature = minor |
| 1 breaking change | `1.0.1` | `2.0.0` | Breaking = major |
| Breaking + feature + fix | `1.0.1` | `2.0.0` | Major dominates |

## Bump Procedure

### Step 1: Verify Clean State

```bash
# Ensure no uncommitted changes
git status

# Run tests locally
npm test

# Run linter
npm run lint
```

### Step 2: Update Module Version

Edit `src/helper-modules-{category}/{module-name}/package.json`:

```json
{
  "name": "@superloomdev/js-helper-utils",
  "version": "1.0.2",  // ← Update this line
  "main": "utils.js"
}
```

### Step 3: No Test Dependency Changes Needed

Test `package.json` files use wildcards:

```json
{
  "dependencies": {
    "@superloomdev/js-helper-utils": "^1.0.0"
  }
}
```

`^1.0.0` automatically resolves to `1.0.2` after publish. **No manual updates required.**

### Step 4: Update Changelog

Edit `src/helper-modules-{category}/{module-name}/CHANGELOG.md`:

```markdown
# Changelog

## [1.0.2] - 2024-01-15

### Fixed
- `isEmpty()` now handles null prototype objects correctly
- Edge case in `deepClone()` for circular references

## [1.0.1] - 2024-01-10

### Fixed
- Documentation typos in README

## [1.0.0] - 2024-01-01

### Added
- Initial stable release
- All utility functions documented in ROBOTS.md
```

### Step 5: Commit with Conventional Commits

```bash
# Patch release (bug fixes)
git commit -m "fix(utils): resolve edge cases in isEmpty and deepClone"

# Minor release (new features)
git commit -m "feat(utils): add isValidEmail and isValidURL helpers"

# Major release (breaking changes)
git commit -m "BREAKING CHANGE: refactor validate() to return object instead of boolean

BREAKING CHANGE: validate() now returns {valid, errors} instead of boolean.
Migration: Change `if (validate(x))` to `if (validate(x).valid)`"
```

**Commit Types**:

| Type | Use When | Version |
|------|----------|---------|
| `fix` | Bug fix | Patch |
| `feat` | New feature | Minor |
| `docs` | Documentation | Patch |
| `style` | Code style | Patch |
| `refactor` | Internal change | Patch |
| `perf` | Performance | Patch |
| `test` | Tests | Patch |
| `chore` | Maintenance | Patch |
| `BREAKING CHANGE` | API change | Major |

### Step 6: Push to Main

```bash
git push origin main
```

### Step 7: Monitor CI

Watch the pipeline at: https://github.com/superloomdev/superloom/actions

Expected flow:
1. `detect` job identifies changed modules
2. Lint runs
3. Test runs (uses published deps from registry)
4. Publish job runs (publishes to GitHub Packages)

### Step 8: Verify Publish

Check the package registry:

```bash
# View package on GitHub
open https://github.com/superloomdev/superloom/packages

# Or query via npm
npm view @superloomdev/js-helper-utils versions
```

## Multi-Module Bumps

When bumping multiple modules:

### Sequential Bumps (Recommended)

1. Bump foundational modules first (utils, debug)
2. Wait for CI to publish
3. Bump dependent modules (time, crypto, etc.)
4. Wait for CI to publish
5. Continue up the dependency chain

This ensures dependent tests use the newly published versions.

### Batch Bumps (Advanced)

If all modules need the same version bump:

```bash
# Update all package.json versions
git add -A
git commit -m "chore: bump all modules to 1.0.2

- Patch release: Documentation updates and internal cleanup
- No API changes"
git push origin main
```

**Risk**: If CI fails mid-batch, some modules publish, others don't. May need manual intervention.

## Post-Bump Verification

### Check Dependent Modules

After publishing `utils@1.0.2`, verify dependent tests still pass:

```bash
# In test directory for a dependent module
cd src/helper-modules-core/js-helper-time/_test
rm -rf node_modules package-lock.json
npm install
npm test
```

### Check Wildcard Resolution

Verify npm resolves to latest:

```bash
npm ls @superloomdev/js-helper-utils
# Should show: 1.0.2 (or latest published)
```

## Rollback Procedure

If a bad version is published:

### 1. Do Not Unpublish

GitHub Packages does not support unpublishing. Published versions are permanent.

### 2. Publish Fix Immediately

```bash
# Fix the bug
git add .
git commit -m "fix(utils): revert breaking change in 1.0.2"

# Bump version again
# Edit package.json: 1.0.2 → 1.0.3

git add package.json
git commit -m "chore: bump to 1.0.3"
git push origin main
```

### 3. Document in Changelog

```markdown
## [1.0.3] - 2024-01-16

### Fixed
- Reverted breaking change accidentally released in 1.0.2

## [1.0.2] - 2024-01-15

### ⚠️ BROKEN - DO NOT USE
- Accidentally included breaking change
```

## FAQ

**Q: Do I need to update all dependent modules when I bump?**
A: No. Caret ranges (`^1.0.0`) automatically pick up compatible versions.

**Q: What if CI fails during publish?**
A: The workflow has a safety-net that skips already-published versions. Fix the issue, commit again, push again.

**Q: Can I test before publishing?**
A: Yes. Use `file:../` references locally, then switch to version numbers before push.

**Q: How do I handle security vulnerabilities?**
A: Publish a patch release immediately with the fix. Security fixes take priority.

**Q: What version should initial development use?**
A: `0.1.0`, `0.2.0`, etc. until API stabilizes, then `1.0.0`.

## Checklist Summary

- [ ] Changes classified (breaking/feature/fix)
- [ ] Version determined (major/minor/patch)
- [ ] Tests passing locally
- [ ] Linter passing
- [ ] `package.json` version updated
- [ ] `CHANGELOG.md` updated
- [ ] Conventional Commit message written
- [ ] Changes pushed to main
- [ ] CI pipeline monitored
- [ ] Package verified on registry
