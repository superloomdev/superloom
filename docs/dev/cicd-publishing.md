# CI/CD - Testing and Publishing

How helper modules are tested on every push and published to GitHub Packages. The framework uses a single unified workflow at `.github/workflows/ci-helper-modules.yml`. This guide is the canonical reference for that pipeline. Every positive rule below exists because a real failure taught it; those failures are journaled in [`pitfalls.md`](pitfalls.md#cicd-publishing).

## On This Page

- [How It Works](#how-it-works)
- [Detect: What Triggers Test and Publish](#detect-what-triggers-test-and-publish)
- [Fresh-State Recovery](#fresh-state-recovery)
- [Why a Single Workflow](#why-a-single-workflow)
- [Workflow Location](#workflow-location)
- [Publishing a New Version](#publishing-a-new-version)
- [GITHUB_TOKEN Permissions](#github_token-permissions)
- [Known Failure Modes](#known-failure-modes)
- [Troubleshooting](#troubleshooting)
- [Why Not Fine-grained PAT for Publishing](#why-not-fine-grained-pat-for-publishing)
- [References](#references)

---

## How It Works

A single unified workflow (`.github/workflows/ci-helper-modules.yml`) handles everything:

1. **`detect`** -- inspects the commit and the registry to decide which modules need testing and which need publishing
2. **`test-*`** (per-module) -- runs lint and tests on every push and PR for any module the detect job marks
3. **`publish-*`** (per-module) -- runs only on `main` pushes for modules the detect job marks as needing publish; includes a registry safety-net that skips if the version is already published

No manual tokens are required. The `GITHUB_TOKEN` is created automatically by GitHub Actions for every workflow run and expires when the workflow finishes.

## Detect: What Triggers Test and Publish

The detect job answers two questions:

| Question | Used for | Source of truth |
|---|---|---|
| Which modules had any file changes since the previous commit? | `test_modules` (gates `test-*` jobs) | `git diff HEAD~1 HEAD` |
| Which modules have a current version that is **not yet on the registry**? | `publish_modules` (gates `publish-*` jobs) | `npm view <name>@<version>` against GitHub Packages |

**`test_modules`** is the union of:

- Modules with file changes in this commit
- Modules in `publish_modules` (so we always run tests before publishing, even if no file changed in this commit)

**`publish_modules`** is the set of modules whose `package.json` `version` is not currently published. This subsumes both:

- **Steady-state version bumps** -- the new version is by definition not yet on the registry, so it gets published
- **Fresh-state recovery** -- if the registry has been wiped (or never populated), every module's current version is "not published" and all of them get republished

The previous logic compared `HEAD~1:package.json` to `HEAD:package.json` and only published when the `version` field changed. That logic broke fresh-state recovery (no diff, no publish, even though nothing was on the registry).

The publish job retains a per-job safety-net that calls `npm view` again immediately before `npm publish`, so a redundant publish attempt (e.g., due to a transient registry error during detect) never overwrites a real version.

### What Gets Published When

| Scenario | `test_modules` | `publish_modules` | Tests run? | Publish runs? |
|---|---|---|---|---|
| PR opened / updated | Changed only | empty | Yes (changed only) | No |
| Push to main, no version bump, all already published | Changed only | empty | Yes (changed only) | No |
| Push to main, version bumped on module X | `[X]` (or wider if X also unpublished elsewhere) | `[X]` | Yes for X | Yes for X |
| Push to main, registry wiped, all 17 modules at 1.0.0 | All 17 | All 17 | Yes for all 17 | Yes for all 17 |
| Push to main, repo's first commit (orphan) | All 17 | All 17 | Yes for all 17 | Yes for all 17 |
| Push to main, force-pushed reset that retains same version on disk | Changed (via diff) plus all unpublished modules | All unpublished | Yes for all unpublished | Yes for all unpublished |

## Fresh-State Recovery

The pipeline must work the very first time, when nothing has been published yet, and after a registry reset. The detect job's registry-existence check is what makes this work.

### When you would use it

- Initial repo bootstrap, all modules at `1.0.0`
- After deleting all packages from GitHub Packages and pushing a recovery commit
- After importing the codebase into a new organization with a different `@scope`

### What you must do

1. Make sure each module's `package.json` declares the version you want published
2. Make sure each module's `publishConfig.registry` is `https://npm.pkg.github.com` and the package name uses the correct scope
3. Push to `main`

The detect job will list every module whose `<name>@<version>` is not yet on the registry, schedule its test job, and (on success) schedule its publish job. The safety-net inside each publish job protects against accidentally republishing.

### Important guidelines

- **Publishing is CI-only.** Always use the pipeline rather than `npm publish` directly — the pipeline ensures tests pass before publishing and keeps version-vs-source tracking consistent.
- **Version numbers move forward only.** Even when restoring an old build, bump the version forward. Downstream consumers rely on `^x.y.z` resolution working predictably.

## Why a Single Workflow

Earlier iterations had two separate workflows (`test.yml` and `publish-helper-module.yml`) running in parallel on the same commit. That caused:

- **Duplicate runs in the Actions tab.** Every commit showed at least 2 workflow runs
- **Race conditions on publish.** The publish workflow tried to `npm publish` on every main push, failing with `409 You cannot publish over the previously published versions` whenever the version had not been bumped

The unified workflow fixes both by:

- Running tests once per commit
- Triggering `npm publish` only when a module is missing from the registry
- Sequencing publish after its corresponding test job via `needs:`

This pattern (registry-existence check + version-bump-by-implication + per-job safety-net) is a lightweight alternative to Changesets / semantic-release. It suits quick-iteration monorepos where versions are bumped manually per Conventional Commits.

## Workflow Location

```
.github/workflows/ci-helper-modules.yml
```

> GitHub Actions only reads workflows from `.github/workflows/` at the repository root. Placing workflow files anywhere else (e.g., `src/.github/workflows/`) is silently ignored.

## Publishing a New Version

1. Bump the `version` in the module's `package.json`:
   ```json
   "version": "1.0.2" -> "version": "1.0.3"
   ```

2. Commit and push to `main`:
   ```bash
   git add src/helper-modules-core/js-helper-utils/package.json
   git commit -m "chore(release): bump js-helper-utils to v1.0.3"
   git push origin main
   ```

3. The workflow triggers automatically. Check progress at:
   ```
   https://github.com/superloomdev/superloom/actions
   ```

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

Every CI symptom, root cause, and durable fix this pipeline has ever uncovered is journaled in [`pitfalls.md` → CI/CD Publishing](pitfalls.md#cicd-publishing). Eleven entries as of the last sweep, covering port-allocation races, `PROTOCOL_CONNECTION_LOST`, detect-job version comparisons, `403 Forbidden`, `ETARGET`, `MODULE_NOT_FOUND` for `file:` deps, YAML block-scalar newlines, and the transitively-skipped `publish-*` chain.

When you hit a new CI failure: reproduce it, confirm the root cause, then add an entry to `pitfalls.md` under *CI/CD Publishing* (Symptom → Cause → Lesson). Do **not** add it here — this file is for positive rules only. Propagate a compact one-liner into `AGENTS.md` via `/propagate-changes` if the rule is small enough to live there.

---

## Troubleshooting

### Workflow Not Triggered

- **Workflow file in wrong directory.** Must be at `.github/workflows/`, not `src/.github/workflows/`
- **Branch mismatch.** Only triggers on pushes and PRs against `main`

### Publish Step Skipped

- **Already on registry.** The detect job's registry check found `<name>@<version>` already published, so the module was excluded from `publish_modules`. The safety-net log inside the publish job (when triggered through other paths) reads `<name>@<version> is already published - skipping`. This is normal
- **Version is the empty string or missing.** `package.json` must have a non-empty `version` field

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

GitHub fine-grained PATs do not currently include `read:packages` or `write:packages` permissions in the UI. This is a known GitHub limitation -- there is no package permission under any other category for fine-grained PATs.

For publishing, we use the CI/CD approach exclusively:

- **CI/CD publishing** uses the built-in `GITHUB_TOKEN` (automatic, secure, no token management)
- **Local package install** uses a Classic PAT with `read:packages` scope (stored in `__dev__/.env`)

## References

- [GitHub Actions - Automatic Token](https://docs.github.com/en/actions/security-for-github-actions/security-guides/automatic-token-authentication)
- [GitHub Packages - Permissions](https://docs.github.com/en/packages/learn-github-packages/about-permissions-for-github-packages)
- [Publishing npm Packages with GitHub Actions](https://docs.github.com/en/packages/managing-github-packages-using-github-actions-workflows/publishing-and-installing-a-package-with-github-actions)
