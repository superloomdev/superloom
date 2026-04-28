# CI/CD - Testing and Publishing

How helper modules are tested on every push and published to GitHub Packages only when their `package.json` `version` field is bumped. The framework uses a single unified workflow at `.github/workflows/ci-helper-modules.yml`.

## On This Page

- [How It Works](#how-it-works)
- [Why a Single Workflow](#why-a-single-workflow)
- [Workflow Location](#workflow-location)
- [Publishing a New Version](#publishing-a-new-version)
- [GITHUB_TOKEN Permissions](#github_token-permissions)
- [Troubleshooting](#troubleshooting)
- [Why Not Fine-grained PAT for Publishing](#why-not-fine-grained-pat-for-publishing)
- [References](#references)

---

## How It Works

A **single unified workflow** (`.github/workflows/ci-helper-modules.yml`) handles everything:

1. **`detect`** - Compares `HEAD~1` to `HEAD` to find:
   - **Test modules:** any module with file changes
   - **Publish modules:** modules whose `package.json` `version` field changed
2. **`test-offline` / `test-dynamodb`** - Runs lint + tests on every push and PR
3. **`publish-offline` / `publish-dynamodb`** - Runs ONLY on main pushes where a version bump was detected; includes a registry check as a safety net that skips if the version is already published

**No manual tokens required.** The `GITHUB_TOKEN` is created automatically by GitHub Actions for every workflow run. It expires when the workflow finishes.

## Why a Single Workflow?

Previously two separate workflows (`test.yml` and `publish-helper-module.yml`) ran in parallel on the same commit. That caused two problems:

- **Duplicate runs in the Actions tab:** Every commit showed ≥ 2 workflow runs
- **Race condition on publish:** The publish workflow tried to `npm publish` on every main push, failing with `409 You cannot publish over the previously published versions` whenever the version hadn't been bumped

The unified workflow fixes both by:

- Running tests once per commit
- Triggering `npm publish` only when `package.json` version actually changed
- Sequencing publish after its corresponding test job via `needs:`

This pattern (version-bump detection + registry check) is a lightweight alternative to Changesets / semantic-release - it suits quick-iteration monorepos where you already bump versions manually per Conventional Commits.

## Workflow Location

```
.github/workflows/ci-helper-modules.yml
```

> **Important:** GitHub Actions only reads workflows from `.github/workflows/` at the repository root. Placing workflow files anywhere else (e.g. `src/.github/workflows/`) will be silently ignored.

## Publishing a New Version

1. Bump the `version` in the module's `package.json`:
   ```json
   "version": "1.0.2"  →  "version": "1.0.3"
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

### What Gets Published When

| Scenario | Tests run? | Publish runs? |
|---|---|---|
| PR opened / updated | Yes | No |
| Push to main, no version bump | Yes | No (detect outputs empty `publish_modules`) |
| Push to main, version bumped | Yes | Yes, only for modules with version change |
| Push to main, version bumped but same version already on registry | Yes | Job runs, safety check skips `npm publish` |

## GITHUB_TOKEN Permissions

The publish jobs require explicit permissions to write packages:

```yaml
publish-offline:
  runs-on: ubuntu-latest
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

1. Go to **Repository → Settings → Actions → General**
2. Under **Workflow permissions**, select **Read and write permissions**
3. Save

This allows `GITHUB_TOKEN` to be granted write permissions by individual jobs.

## Troubleshooting

### Workflow Not Triggered

- **Workflow file in wrong directory:** Must be at `.github/workflows/`, not `src/.github/workflows/`
- **Branch mismatch:** Only triggers on pushes and PRs against `main`

### Publish Step Skipped

- **No version bump:** The `detect` job compares `HEAD~1:package.json` to `HEAD:package.json`. If the `version` field is unchanged, the publish job is never scheduled.
- **Already on registry:** The safety-net step logs `⚠  @superloomdev/<module>@<version> is already published - skipping`. This is normal if you ran the workflow twice for the same version (e.g. after a force-push).

### 403 Forbidden on Publish

1. Add `permissions: packages: write` to the publish job
2. Enable "Read and write permissions" in Repository → Settings → Actions → General
3. Check that `publishConfig.registry` in `package.json` is correct:
   ```json
   "publishConfig": {
     "registry": "https://npm.pkg.github.com"
   }
   ```

### Tests Fail in CI

The publish job has `needs: [detect, test-*]`, so it won't run if tests fail. Fix the tests and push again.

## Why Not Fine-grained PAT for Publishing

GitHub fine-grained PATs do not currently include `read:packages` or `write:packages` permissions in the UI. This is a known GitHub limitation - there is no package permission under any other category for fine-grained PATs.

For publishing, we use the CI/CD approach exclusively:

- **CI/CD publishing** uses the built-in `GITHUB_TOKEN` (automatic, secure, no token management)
- **Local package install** uses a Classic PAT with `read:packages` scope (stored in `__dev__/.env`)

## References

- [GitHub Actions - Automatic Token](https://docs.github.com/en/actions/security-for-github-actions/security-guides/automatic-token-authentication)
- [GitHub Packages - Permissions](https://docs.github.com/en/packages/learn-github-packages/about-permissions-for-github-packages)
- [Publishing npm Packages with GitHub Actions](https://docs.github.com/en/packages/managing-github-packages-using-github-actions-workflows/publishing-and-installing-a-package-with-github-actions)
