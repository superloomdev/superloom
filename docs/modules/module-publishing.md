# Publishing Helper Modules

> **Language:** JavaScript

How a module's `package.json`, npmrc, test directory, and dependencies must be configured for the unified CI/CD pipeline to test and publish it. Publishing is **CI-only** - bumping the `version` field in a module's `package.json` and pushing to `main` triggers the publish automatically. There is no manual `npm publish`.

**Companion docs.**

- [`../dev/cicd-publishing.md`](../dev/cicd-publishing.md) - operational walkthrough of the unified `ci-helper-modules.yml` workflow, GITHUB_TOKEN permissions, fresh-state recovery, failure modes, and CI-side troubleshooting (401 / 403 / registry URL).
- [`../versioning/bump-checklist.md`](../versioning/bump-checklist.md) - the step-by-step version-bump procedure including SemVer classification, commit format, multi-module bumps, and post-publish verification.
- [`module-readme-structure.md`](module-readme-structure.md) - what every module README must contain (badges, sections, ordering). This file scopes only the `package.json` and `_test/` layout.

This page scopes **package-configuration rules**; the companion docs scope **how to run the pipeline** and **how to bump a version**.

## On This Page

- [Package Identity](#package-identity)
- [Dependency Rules](#dependency-rules)
- [npmrc Configuration](#npmrc-configuration)
- [Registry Ignore File](#registry-ignore-file-npmignore)
- [Linter Configuration](#linter-configuration)
- [Required Scripts](#required-scripts)
- [Test Directory Structure](#test-directory-structure)

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

All other modules may depend on the foundation modules via peer dependencies. This avoids duplicate installations and ensures a single shared instance. The full strategy is in [`peer-dependencies.md`](peer-dependencies.md).

## npmrc Configuration

Use machine-level `~/.npmrc` with environment variable support. **Do not create per-module `.npmrc` files.**

```bash
npm config set @your-org:registry https://npm.pkg.github.com
npm config set //npm.pkg.github.com/:_authToken '${GITHUB_READ_PACKAGES_TOKEN}'
npm config set registry https://registry.npmjs.org/
```

Load the token via the project environment script:

```bash
source init-env.sh
# Select: 1) dev
```

See [`../dev/npmrc-setup.md`](../dev/npmrc-setup.md) for the complete setup guide and [`../dev/onboarding-github-packages.md`](../dev/onboarding-github-packages.md) for the GitHub token side.

## Registry Ignore File (`.npmignore`)

Every published JS module **must** have a `.npmignore` file at its root.

Without it, `npm pack` includes everything that is not in `.gitignore` - meaning `_test/`, `eslint.config.js`, `.github/`, and other dev-only files all land in the published tarball. This bloats the package and exposes internal structure that consumers have no use for.

**Rules:**

- Place `.npmignore` at the module root (alongside `package.json`).
- It must exclude at minimum: `_test/`, `eslint.config.js`, `.github/`, `THOUGHTS.md`.
- It must include (i.e. not accidentally exclude): the main entry file, `README.md`, `ROBOTS.md`, `docs/`, `package.json`, and any `parts/` or `src/` subdirectories that contain production code.
- `README.md`, `ROBOTS.md`, and `docs/` ship intentionally - `README.md` links to both, and those links must resolve for anyone reading the package page or consuming the package.
- `THOUGHTS.md` is an internal engineering decision journal for contributors. It must never ship in the published tarball. See [THOUGHTS.md convention](module-thoughts-file.md).
- Verify with `npm pack --dry-run` from the module root before publishing. The output lists every file that would be included.

**Canonical reference:** For the exact file contents and the complete exclusion list, refer to `js-helper-utils` - it is the simplest base module and serves as the reference implementation for all JS helper modules. Copy its `.npmignore` as your starting point and adjust only for module-specific additions (e.g. `parts/` subdirectory modules need no adjustment; adapter modules with a `schema/` folder may need to verify it is included).

Note: other languages have their own equivalent mechanisms (Python: `MANIFEST.in` or `pyproject.toml` exclude patterns; Java: Maven/Gradle publish configuration). Each language's publishing documentation covers its own convention. The principle is the same: every published package must explicitly control what ships.

## Linter Configuration

Every JS module **must** have an `eslint.config.js` file at its root (ESLint flat config, required for ESLint v9+).

Linter config is per-module because each module is published and lintable independently - there is no shared workspace-level config that consumers can rely on. The config must be present for `npm run lint` to work as part of the pre-publish gate.

**Canonical reference:** the config is **byte-identical across every module** - copy `eslint.config.js` from `js-helper-utils` verbatim. There are no module-type variants (store adapters, clients, and core modules all carry the same file); a divergent copy is drift, not customization. Do not reproduce or embed the config contents in documentation - the module is the living reference and will stay current as ESLint evolves.

Three properties of the canonical config are policy, not preference:

- **`ecmaVersion: 2022`** - matches the Node.js 24+ engine floor.
- **No `argsIgnorePattern` / `caughtErrorsIgnorePattern`.** Underscore-prefixed parameters (`_param`, `catch (_err)`) are forbidden; lint must flag them. Parity parameters keep their real name with `// eslint-disable-line no-unused-vars`; unused catch bindings use `catch {`. See [`code-formatting-js.md` → Parameter Naming](../foundations/code-formatting-js.md#parameter-naming).
- **Full rule comments retained** - the config is read by humans deciding whether a rule applies; stripped copies caused the variant drift this rule exists to prevent.

Note: other languages have their own linter conventions (Python: `ruff` or `pylint` config; etc.). Each language's module structure documentation covers its own convention.

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

The pre-publish gate requires both `npm run lint` (from the module root) and `npm test` (from `_test/`) to exit `0` locally before the version bump is pushed. See [`../dev/testing-local-modules.md` → Pre-Publish Checklist](../dev/testing-local-modules.md#pre-publish-checklist).

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
- Reference published `@your-org` packages by version for peer dependencies (never `file:` for siblings - that breaks in CI; see [`pitfalls.md` entry 8](../dev/pitfalls.md))
- **No `.npmrc` in `_test/`** - use global npmrc

## Further Reading

- [CI/CD Publishing](../dev/cicd-publishing.md) - operational details of the unified `ci-helper-modules.yml` workflow + CI troubleshooting (401 / 403 / registry URL).
- [Version Bump Checklist](../versioning/bump-checklist.md) - SemVer classification + step-by-step bump procedure.
- [Peer Dependencies](peer-dependencies.md) - the dependency strategy that publishing relies on.
- [Module Testing](../testing/module-testing.md) - badges and the testing tiers gating publish.
- [Module README Structure](module-readme-structure.md) - badges, Universal README Sections, and the structural-pass checklist.
