# CI/CD - Testing and Publishing

> **Language:** JavaScript

How helper modules are tested on every push and published to GitHub Packages. The framework uses a single unified workflow at `.github/workflows/ci-publish-helper-modules.yml`. This guide is the canonical reference for that pipeline. Every positive rule below exists because a real failure taught it; those failures are journaled in [`pitfalls.md`](pitfalls.md#ci-cd-publishing).

## On This Page

- [How It Works](#how-it-works)
- [Detect: What Triggers Test and Publish](#detect-what-triggers-test-and-publish)
  - [What Gets Published When](#what-gets-published-when)
- [Fresh-State Recovery](#fresh-state-recovery)
  - [When you would use it](#when-you-would-use-it)
  - [What you must do](#what-you-must-do)
  - [Important guidelines](#important-guidelines)
- [The Publish Guard Compares Content, Not Version Presence](#the-publish-guard-compares-content-not-version-presence)
  - [The Remedy Depends on the Release Policy](#the-remedy-depends-on-the-release-policy)
- [Why a Single Workflow](#why-a-single-workflow)
- [Module Execution Sequence](#module-execution-sequence)
  - [Why This Order Matters](#why-this-order-matters)
  - [Adding a New Module](#adding-a-new-module)
- [Workflow Location](#workflow-location)
- [Publishing a New Version](#publishing-a-new-version)
- [GITHUB_TOKEN Permissions](#github-token-permissions)
  - [Enabling Write Permissions (Repository Setting)](#enabling-write-permissions-repository-setting)
- [Known Failure Modes](#known-failure-modes)
- [Troubleshooting](#troubleshooting)
  - [Workflow Not Triggered](#workflow-not-triggered)
  - [Publish Step Skipped](#publish-step-skipped)
  - [403 Forbidden on Publish](#_403-forbidden-on-publish)
- [Why Not Fine-grained PAT for Publishing](#why-not-fine-grained-pat-for-publishing)
- [References](#references)

---
## How It Works

A single unified workflow (`.github/workflows/ci-publish-helper-modules.yml`) handles everything:

1. **`detect`** - inspects the commit and the registry to decide which modules need testing and which need publishing
2. **`test-eslint-config`** and **`publish-eslint-config`** - run first, ahead of all other test/publish jobs, because every module's `eslint.config.js` resolves `@superloomdev/js-helper-eslint-config` at install time. If the config package is missing from the registry, every downstream `npm ci` fails with a checksum mismatch
3. **`test-*`** (per-module) - runs lint and tests on every push and PR for any module the detect job marks
4. **`publish-*`** (per-module) - runs only on `main` pushes for modules the detect job marks as needing publish; includes a content guard that skips when the packed shasum matches the published one and fails when they differ ([The Publish Guard Compares Content, Not Version Presence](#the-publish-guard-compares-content-not-version-presence))

No manual tokens are required. The `GITHUB_TOKEN` is created automatically by GitHub Actions for every workflow run and expires when the workflow finishes.

## Detect: What Triggers Test and Publish

The detect job answers two questions:

| Question | Used for | Source of truth |
|---|---|---|
| Which modules had any file changes since the previous commit? | `test_modules` (gates `test-*` jobs) | `git diff HEAD~1 HEAD` |
| Which modules have content that is **not yet on the registry** at their current version? | `publish_modules` (gates `publish-*` jobs) | `npm pack` shasum against `npm view <name>@<version> dist.shasum` on GitHub Packages |

**`test_modules`** is the union of:

- Modules with file changes in this commit
- Modules in `publish_modules` (so we always run tests before publishing, even if no file changed in this commit)

**`publish_modules`** is the set of modules whose packed content is not currently on the registry at their `package.json` `version`. This subsumes three cases:

- **Steady-state version bumps** - the new version is by definition not yet on the registry, so it gets published
- **Fresh-state recovery** - if the registry has been wiped (or never populated), every module's current version is "not published" and all of them get republished
- **Source changed at an existing version** - the shasums differ, so the module is marked and its publish job fails, naming both shasums and the remedy for the repository's release policy

The publish job re-runs the content guard immediately before `npm publish`, so a redundant publish attempt (for example after a transient registry error during detect) never overwrites a real version. Both gates compare shasums rather than version names; the reasoning is in [The Publish Guard Compares Content, Not Version Presence](#the-publish-guard-compares-content-not-version-presence).

### What Gets Published When

| Scenario | `test_modules` | `publish_modules` | Tests run? | Publish runs? |
|---|---|---|---|---|
| PR opened / updated | Changed only | empty | Yes (changed only) | No |
| Push to main, no version bump, published content identical | Changed only | empty | Yes (changed only) | No |
| Push to main, no version bump, source changed at a published version | Changed only | `[X]` | Yes for X | No - the guard fails the job |
| Push to main, version bumped on module X | `[X]` (or wider if X also unpublished elsewhere) | `[X]` | Yes for X | Yes for X |
| Push to main, registry wiped, all 17 modules at 1.0.0 | All 17 | All 17 | Yes for all 17 | Yes for all 17 |
| Push to main, repo's first commit (orphan) | All 17 | All 17 | Yes for all 17 | Yes for all 17 |
| Push to main, force-pushed reset that retains same version on disk | Changed (via diff) plus all unpublished modules | All unpublished | Yes for all unpublished | Yes for all unpublished |

## Fresh-State Recovery

The pipeline must work the very first time, when nothing has been published yet, and after a registry reset. The detect job's content guard is what makes this work: an absent version has no shasum to compare against, so the module is published.

### When you would use it

- Initial repo bootstrap, all modules at `1.0.0`
- After deleting all packages from GitHub Packages and pushing a recovery commit
- After importing the codebase into a new organization with a different `@scope`

### What you must do

1. Make sure each module's `package.json` declares the version you want published
2. Make sure each module's `publishConfig.registry` is `https://npm.pkg.github.com` and the package name uses the correct scope
3. Push to `main`

The detect job will list every module whose `<name>@<version>` is not yet on the registry, schedule its test job, and (on success) schedule its publish job. The content guard inside each publish job protects against accidentally republishing identical content and fails loudly when the source changed at an existing version.

### Important guidelines

- **Publishing is CI-only.** Always use the pipeline rather than `npm publish` directly. The pipeline ensures tests pass before publishing and keeps version-vs-source tracking consistent.
- **Version numbers move forward only** in normal operation. Even when restoring an old build, bump the version forward. Downstream consumers rely on `^x.y.z` resolution working predictably.
- **Same-version republish after a registry wipe is the one sanctioned exception.** GitHub Packages accepts a previously-used version name once the version is deleted, so a deliberate re-baseline (wipe all packages, push to `main`, let detect republish everything at unchanged versions) works end to end. Deletion mechanics and the confirmed behavior: [pitfalls entry 16](pitfalls.md#ci-cd-publishing).

## The Publish Guard Compares Content, Not Version Presence

A publish path guarded only by a registry-existence check has no failure signal when the source changed but the version did not. The guard reads "does `<name>@<version>` exist" and skips on yes, so the run produces a **green** result that publishes nothing. The job reports success, the commit looks shipped, and the registry still serves the old tarball.

The guard must prove content equality rather than assume it. Pack the working tree with `npm pack`, read the registry's published `dist.shasum` for the same coordinates, and branch on the comparison:

| Comparison | Outcome |
|---|---|
| Shasums match | Skip, and say so - the registry already serves this exact content |
| Shasums differ | **Fail**, naming both shasums and the remedy below |
| Version absent | Publish |

The distinction the existence check cannot make is between "nothing to do" and "the source moved without the version moving". Those need opposite outcomes, so the guard needs an input the version name does not carry.

### The Remedy Depends on the Release Policy

A shasum mismatch always fails the run. What fixes it depends on which release policy the repository follows, and the repository's own `AGENTS.md` declares which applies:

| Policy | Remedy on mismatch |
|---|---|
| **Normal SemVer (the default)** | **Bump the version.** The source changed, so it is a new release. The mismatch is the pipeline catching a forgotten bump |
| Deliberate same-version republish (explicitly flagged) | Delete the registry version, then push. Only valid where the repository documents same-version republishing as its release mechanism |

Under normal SemVer the guard earns its cost by catching a forgotten bump, which is the far more common mistake. Never resolve a mismatch by deleting a version in a repository that bumps normally: a consumer may already have resolved that version, and deleting it breaks their lockfile.

**The rule binds both gates.** The detect job decides which modules get a `publish-*` job, and each publish job re-checks immediately before `npm publish`. A content comparison in the publish job alone never runs in the failure case it targets. A detect job filtering on version presence drops the module before its publish job is ever scheduled, so both layers compare shasums.

The same comparison is the only honest post-publish verification. A version appearing in the registry listing does not prove the new content shipped; the published shasum must match what was packed. A consumer-side `E409 ... Package file checksum mismatch` during `npm ci` is a different failure with a different remedy ([pitfalls entry 24](pitfalls.md#ci-cd-publishing)).

## Why a Single Workflow

Earlier iterations had two separate workflows (`test.yml` and `publish-helper-module.yml`) running in parallel on the same commit. That caused:

- **Duplicate runs in the Actions tab.** Every commit showed at least 2 workflow runs
- **Race conditions on publish.** The publish workflow tried to `npm publish` on every main push, failing with `409 You cannot publish over the previously published versions` whenever the version had not been bumped

The unified workflow fixes both by:

- Running tests once per commit
- Triggering `npm publish` only when the module's packed content is not already on the registry at that version
- Sequencing publish after its corresponding test job via `needs:`

This pattern (content-comparison guard + version-bump-by-implication + the same guard repeated per job) is a lightweight alternative to Changesets / semantic-release. It suits quick-iteration monorepos where versions are bumped manually per Conventional Commits.

## Module Execution Sequence

The pipeline processes modules in three groups, organized by dependency boundaries and runtime environment:

```
┌─────────────────────────────────────────────────────────────────┐
│  GROUP 1: Core Modules (Foundation Utilities)                  │
│  Location: src/helper-modules-core/                            │
│  Pattern: Class A - Zero dependencies, pure JavaScript         │
├─────────────────────────────────────────────────────────────────┤
│  js-helper-utils → js-helper-debug → js-helper-time            │
│  → js-helper-money → js-client-helper-crypto                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  GROUP 2: Server Modules (Node.js Runtime Required)            │
│  Location: src/helper-modules-server/                          │
│  Pattern: Classes B-F - Node built-ins, drivers, services    │
├─────────────────────────────────────────────────────────────────┤
│  Crypto → Instance → HTTP → Gateway → Storage/Database         │
│  → Verification → Logging → Auth → Queueing                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  GROUP 3: Client Modules (Browser/Universal Runtime)         │
│  Location: src/helper-modules-client/                          │
│  Pattern: Class A - Universal, often UI-adjacent               │
├─────────────────────────────────────────────────────────────────┤
│  js-client-helper-themer → (future client modules)             │
└─────────────────────────────────────────────────────────────────┘
```

### Why This Order Matters

**Dependency Direction**
- Core modules have zero external dependencies - they must publish first
- Server modules can depend on Core modules
- Client modules can depend on Core modules (and sometimes Server modules via extension pattern)

**Runtime Boundaries**
- **Core**: Pure JavaScript, runs anywhere (Node, browser, edge, mobile)
- **Server**: Requires Node.js runtime (built-in modules like `crypto`, `fs`, networking)
- **Client**: Universal runtime (browser-focused but still pure JS)

**Testing Requirements**
- Core modules: No Docker, no external services - fast unit tests
- Server modules: Often need databases, emulators, or Docker - integration tests
- Client modules: No framework dependencies - pure JS tests (React/Vue/etc. bindings live in extension modules)

### Adding a New Module

When adding a module to the pipeline:

1. **Determine its class** using [`module-classes.md`](../languages/js/module-classes.md)
2. **Place it in the correct group** based on its directory (`helper-modules-core/`, `helper-modules-server/`, or `helper-modules-client/`)
3. **Position within group** based on its dependencies - if Module B imports Module A, Module A must come first
4. **Add both `test-*` and `publish-*` jobs** - they run sequentially per module
5. **Chain a dependent module's test job after its dependency's `publish-*` job, never its `test-*` job.** If the new module's `_test/package.json` installs another in-repo package from the registry (extension modules, store adapters), its test job must `needs` that package's publish job so the package exists on the registry before `npm install` runs. Wrong chaining passes in steady state and only fails during bootstrap or a registry re-baseline ([pitfalls entry 23](pitfalls.md#ci-cd-publishing))

The workflow file groups jobs visually with comment banners showing the group boundaries. Maintain this structure when adding new modules.

## Workflow Location

```
.github/workflows/ci-publish-helper-modules.yml
```

> GitHub Actions only reads workflows from `.github/workflows/` at the repository root. Placing workflow files anywhere else (e.g., `src/.github/workflows/`) is silently ignored.

## Publishing a New Version

The step-by-step bump procedure (SemVer classification, commit format, multi-module bumps, post-publish verification) lives in [`../languages/js/versioning/bump-checklist.md`](../languages/js/versioning/bump-checklist.md). This page covers the **pipeline mechanics**; the checklist covers **the contributor's procedure**.

**Before pushing:** the [Pre-Commit Protocol](testing-local-modules.md#pre-commit-protocol-all-repos) must pass locally (fresh install, lint, tests). CI is the second line of defense, not the first. A CI run that fails on something testable locally is wasted pipeline time and a polluted git log.

## GITHUB_TOKEN Permissions

The `detect` job needs `packages: read` so it can call `npm view` to check the registry. The `publish-*` jobs need `packages: write`:

```yaml
detect:
  permissions:
    contents: read
    packages: read

publish-utils:
  permissions:
    contents: read
    packages: write
```

Without `packages: write`, `npm publish` fails with:

```
npm ERR! 403 Forbidden - PUT https://npm.pkg.github.com/@superloomdev%2fjs-helper-utils
```

### Enabling Write Permissions (Repository Setting)

If your workflow still fails after adding `permissions:`, check the repository-level setting:

1. Go to **Repository -> Settings -> Actions -> General**
2. Under **Workflow permissions**, select **Read and write permissions**
3. Save

This allows `GITHUB_TOKEN` to be granted write permissions by individual jobs.

---

## Known Failure Modes

Every CI symptom, root cause, and durable fix this pipeline has ever uncovered is journaled in [`pitfalls.md` → CI/CD Publishing](pitfalls.md#ci-cd-publishing).

When you hit a new CI failure: reproduce it, confirm the root cause, then add an entry to `pitfalls.md` under *CI/CD Publishing* (Symptom → Cause → Lesson). Do **not** add it here. This file is for positive rules only. If the rule is small enough to live in `AGENTS.md`, recompile the compact one-liner into it (`AGENTS.md` is a derived artifact, never edited directly).

---

## Troubleshooting

### Workflow Not Triggered

- **Workflow file in wrong directory.** Must be at `.github/workflows/`, not `src/.github/workflows/`
- **Branch mismatch.** Only triggers on pushes and PRs against `main`

### Publish Step Skipped

- **Identical content already on registry.** The detect job's content guard found the packed shasum equal to the published `dist.shasum`, so the module was excluded from `publish_modules`. The guard log inside the publish job (when triggered through other paths) reads `<name>@<version> already serves this exact content - skipping`. This is normal
- **Version is the empty string or missing.** `package.json` must have a non-empty `version` field

A skip is only correct when the shasums match. A skip on version presence alone is the failure mode described in [The Publish Guard Compares Content, Not Version Presence](#the-publish-guard-compares-content-not-version-presence): the run goes green and ships nothing.

### 403 Forbidden on Publish

1. Add `permissions: { contents: read, packages: write }` to the publish job
2. Enable "Read and write permissions" in Repository -> Settings -> Actions -> General
3. Check that `publishConfig.registry` in `package.json` is correct:
   ```json
   "publishConfig": {
     "registry": "https://npm.pkg.github.com"
   }
   ```

## Why Not Fine-grained PAT for Publishing

GitHub fine-grained PATs do not currently include `read:packages` or `write:packages` permissions in the UI. This is a known GitHub limitation - there is no package permission under any other category for fine-grained PATs.

For publishing, we use the CI/CD approach exclusively:

- **CI/CD publishing** uses the built-in `GITHUB_TOKEN` (automatic, secure, no token management)
- **Local package install** uses a Classic PAT with `read:packages` scope (stored in `__dev__/.env`)

## References

- [GitHub Actions - Automatic Token](https://docs.github.com/en/actions/security-for-github-actions/security-guides/automatic-token-authentication)
- [GitHub Packages - Permissions](https://docs.github.com/en/packages/learn-github-packages/about-permissions-for-github-packages)
- [Publishing npm Packages with GitHub Actions](https://docs.github.com/en/packages/managing-github-packages-using-github-actions-workflows/publishing-and-installing-a-package-with-github-actions)
