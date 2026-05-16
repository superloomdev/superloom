# Publishing Helper Modules

> **Language:** JavaScript

How to prepare and publish helper modules to GitHub Packages under the `@your-org` scope. Publishing is **CI/CD only** - bumping the `version` field in a module's `package.json` and pushing to `main` triggers the publish automatically. There is no manual `npm publish`.

## On This Page

- [Package Identity](#package-identity)
- [Dependency Rules](#dependency-rules)
- [npmrc Configuration](#npmrc-configuration)
- [Required Scripts](#required-scripts)
- [Test Directory Structure](#test-directory-structure)
- [README Requirements](#readme-requirements)
- [CI/CD Publishing](#cicd-publishing)
- [Version Bumping](#version-bumping)
- [Troubleshooting](#troubleshooting)

---

## Package Identity

| Field | Required Value |
|---|---|
| `name` | `@your-org/js-helper-*` or `@your-org/js-server-helper-*` |
| `license` | `MIT` |
| `private` | `false` |
| `publishConfig.registry` | `https://npm.pkg.github.com` (no trailing slash, no scope suffix) |

## Dependency Rules

### Foundation Modules (Zero Dependencies)
`js-helper-utils` and `js-helper-debug` are fully self-contained. They must never depend on each other or on any other helper module.

### Other Modules
All other modules may depend on the foundation modules via peer dependencies. This avoids duplicate installations and ensures a single shared instance.

## npmrc Configuration

Use machine-level `~/.npmrc` with environment variable support. **Do not create per-module `.npmrc` files.**

```bash
# One-time setup
npm config set @your-org:registry https://npm.pkg.github.com
npm config set //npm.pkg.github.com/:_authToken '${GITHUB_READ_PACKAGES_TOKEN}'
npm config set registry https://registry.npmjs.org/
```

Load the token via the project environment script:
```bash
source init-env.sh
# Select: 1) dev
```

See `docs/dev/npmrc-setup.md` for the complete setup guide.

## Required Scripts

Every module `package.json` must include:
```json
{
  "scripts": {
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "test": "node --test _test/test.js"
  }
}
```

## Test Directory Structure

```
module-name/
  _test/
    test.js           # Tests using node:test and node:assert/strict
    package.json       # private: true, references module as "file:../"
    mock-data/         # (optional) JSON fixtures
```

- `_test/package.json` must have `"private": true`
- Reference the module under test as `"file:../"` in dependencies
- Reference published `@your-org` packages by version for peer dependencies
- **No `.npmrc` in `_test/`** - use global npmrc

## README Requirements

Every module README should include:
- Badges: Test status, License, Node.js version
- One-line description
- Foundation module note (if applicable)
- Exported functions list with signatures
- Configuration table with defaults
- Installation instructions
- Usage example with code

## CI/CD Publishing

A single unified workflow `.github/workflows/ci-helper-modules.yml` handles both testing and publishing. Tests always run; publishing runs only when a module's `package.json` `version` field actually changed.

**How it works:**
1. Push to `main` (or open a PR)
2. `detect` job compares `HEAD~1:package.json` to `HEAD:package.json` for every changed module
   - Any file change → module queued for **testing**
   - Version bump → module queued for **publishing** (in addition to testing)
3. `test-offline` and `test-dynamodb` jobs run the full test suite for every queued module
4. `publish-*` jobs run only on main pushes, only for modules with a version bump, and only after their matching test job succeeds (`needs: [detect, test-*]`)
5. Before `npm publish`, a safety-net step runs `npm view <pkg>@<version>` - if the version is already on the registry it logs a clear message and skips publish (no failure)

**Why this design:**
- No race conditions (tests run before publish in the same workflow)
- No duplicate workflow runs per commit
- Non-version commits don't attempt to publish, eliminating the `409 You cannot publish over the previously published versions` failure mode
- Revert or force-push scenarios are handled gracefully by the registry safety-net

**CI authentication:**
- `NODE_AUTH_TOKEN` is set at **job level** (not step level) so all steps can access private packages
- `registry-url: 'https://npm.pkg.github.com'` in `setup-node` creates proper `.npmrc`
- `permissions: packages: write` grants publish access

**No manual `.npmrc` files needed in CI** - GitHub Actions handles authentication automatically.

## Version Bumping

Follow semantic versioning:
- **Patch** (1.0.x): Bug fixes, documentation updates
- **Minor** (1.x.0): New features, non-breaking changes
- **Major** (x.0.0): Breaking API changes

**Version bumping is what triggers publishing.** The `detect` job in `ci-helper-modules.yml` only schedules a publish when `package.json`'s `version` field differs between `HEAD~1` and `HEAD`. A commit without a version bump will run tests but not publish.

Bump the version in `package.json`, commit with a conventional commit message, and push to `main`:
```bash
# Example
git commit -m "feat(js-helper-debug): v1.3.0 - zero dependencies, improved text output"
git push origin main
```

You can also bundle multiple bumps in a single commit - CI will publish each one in parallel.

---

## Troubleshooting

### 401 Unauthorized during npm install
- Environment variable `GITHUB_READ_PACKAGES_TOKEN` not set
- Run `source init-env.sh` to load environment
- Verify: `echo $GITHUB_READ_PACKAGES_TOKEN`

### 403 Forbidden during npm publish
- `NODE_AUTH_TOKEN` not available in the CI step
- Ensure it is set at job-level `env`, not step-level
- Check `permissions: packages: write` in workflow

### Registry URL issues
- `publishConfig.registry` must be exactly `https://npm.pkg.github.com`
- No trailing slash (`/`)
- No scope suffix (`/@your-org`)

## Further Reading

- [CI/CD Publishing](../dev/cicd-publishing.md) - operational details of the unified `ci-helper-modules.yml` workflow
- [Peer Dependencies](peer-dependencies.md) - the dependency strategy that publishing relies on
- [Module Testing](module-testing.md) - badges and the testing tiers gating publish
