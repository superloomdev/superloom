---
description: Pre-publish gate, CI registration, version bump, and release for JS helper modules
---

# JS Helper Module Publish Workflow

The publish workflow for a JavaScript helper module. It operates on exactly ONE module per run, named in the invocation. Publishing is CI-only; no human runs `npm publish`.

Invoke as: `/js-helper-module-publish [module-path]`
Example: `/js-helper-module-publish [module-path]`

## Operating Principle

> **Publishing is CI-only.** This workflow prepares the module for release: verifies the pre-publish gate, checks package identity, bumps the version, registers CI jobs if needed, and commits. The actual publish happens when the commit is pushed to `main` and CI runs the unified pipeline.

## Execution Contract (binding)

1. **One module per run.** Never touch a second module's files.
2. **Phases run in order.** Never skip, merge, reorder, or parallelize them.
3. **No improvisation.** Use only the commands written here (substituting `[module-path]` / `[module_root]` / `[name]`). A situation with no matching instruction means STOP and ask.
4. **When uncertain, STOP.** Report exactly what is seen and ask.
5. **No files outside the module** - no scratch scripts, no notes files anywhere in the repo.
6. **Manual edits only.** Every content change is made by hand with the editor tool after reading the whole file. FORBIDDEN: one-off scripts, bulk `sed -i`/`awk`/`perl -pi` rewrites, codemods, any terminal find-and-replace.
7. **Never mark a checklist line done without having performed it in this run.**

## Command Execution Rules

- **NEVER use `cd`** inside a command; set the tool's `Cwd` parameter. `[module_root]` denotes location, not literal text.
- One line per command, or a single `&&` chain. Nothing appended after it.
- Pipe long output through `| tail -N`.
- `// turbo` marks read-only or idempotent steps safe to auto-run. **No mutation step is ever auto-run**: registry operations, `git commit`, `git push`, and publish always require explicit approval.

## Phase 1 - Pre-publish Gate

1. **Lint must exit 0:**
   // turbo
   ```bash
   # Cwd = [module_root]
   npm run lint 2>&1 | tail -20
   ```
2. **Clean-install tests must be green** (Pre-Commit Protocol fresh-install gate - `codebase-superloom/docs/dev/testing-local-modules.md` - Pre-Commit Protocol; mandatory every publish, not just during refactoring):
   // turbo
   ```bash
   # Cwd = [module_root]/_test
   rm -rf node_modules package-lock.json && npm install && npm test 2>&1 | tail -40
   ```
   E409 from the registry is transient - wait 30-60s and re-run; never `--legacy-peer-deps`.
3. If either fails, STOP and report. Do not proceed to Phase 2.

## Phase 2 - Package Identity

Verify all of the following in `[module_root]/package.json`:

1. **Name:** `@superloomdev/js-[server-|client-]helper-[name]` (scoped, matches directory name)
2. **`private: false`** (must be publishable)
3. **`license: MIT`**
4. **`engines.node >= 24`**
5. **`publishConfig.registry`** exactly `https://npm.pkg.github.com` (no trailing `/@superloomdev` scope suffix)
6. **Version** bumped per SemVer (new modules start at `1.0.0`). State the old and new version.

If any field is wrong, fix it by hand, then re-verify.

## Phase 3 - Ship Check

// turbo
```bash
# Cwd = [module_root]
npm pack --dry-run 2>&1 | tail -30
```

Only source, `README.md`, `ROBOTS.md`, `docs/`, `package.json` ship. No `.npmrc` in the module, `_test/`, or repo root. If unexpected files appear, check `.npmignore` (canonical reference: `js-helper-utils`).

## Phase 4 - CI Registration (first publish only)

If this module has never been published before:

1. Add the `test-*`/`publish-*` job pair to `.github/workflows/ci-publish-helper-modules.yml`, positioned after the last dependency's publish job.
2. Both `if:` conditions use `contains(fromJSON(...))` with the full `src/` path.
3. The test job includes `always() && !cancelled()`.
4. The publish job includes `!cancelled()` plus explicit `needs['test-*'].result == 'success'`.
5. **If this module's `_test/package.json` installs another in-repo package from the registry** (extension modules, store adapters): its test job must `needs` that package's `publish-*` job, never its `test-*` job - wrong chaining only fails during bootstrap or a registry re-baseline (pitfalls entry 23 in `codebase-superloom/docs/dev/pitfalls.md`).
6. Update the execution-order header comment and re-chain the next module's `needs:`.

**Bootstrap window (main module + adapters both unpublished):** test adapters locally against a temporary `file:` reference to the main module, publish the main module first, swap the `file:` back to a registry pin, re-test against the live registry, then publish the adapters. The full sequence and the reasoning for the step-3 re-test is pitfalls entry 12 in `codebase-superloom/docs/dev/pitfalls.md`.

If the module is already registered, skip this phase.

## Phase 5 - Same-version Republish (only when replacing an existing release)

Only when deliberately replacing an existing release at the same version:

1. Delete all registry versions via `gh api`:
   ```bash
   gh api /orgs/superloomdev/packages/npm/[PACKAGE_NAME]/versions --jq '.[].id' | xargs -I {} gh api --method DELETE /orgs/superloomdev/packages/npm/[PACKAGE_NAME]/versions/{}
   ```
2. Verify `404`:
   ```bash
   gh api /orgs/superloomdev/packages/npm/[PACKAGE_NAME]/versions
   ```
3. Then proceed to Phase 6.

If this is a normal version bump, skip this phase entirely.

## Phase 6 - Commit

Commit only this module (single-line message, never `git add .`):
```bash
git add [module-path]/
git commit -m "feat([name]): [one-line summary]"
```

If CI registration was added or modified, also stage the workflow file:
```bash
git add .github/workflows/ci-publish-helper-modules.yml
```

**STOP.** Ask: "Ready to push and trigger CI publish. Approve?" On approval:
```bash
git push
```

## Phase 7 - Verify CI Published

Watch the workflow green, then confirm the version is live:
// turbo
```bash
gh api "/orgs/superloomdev/packages/npm/[PACKAGE_NAME]/versions" --jq '.[] | {id, name}'
```

On CI failure: run `/js-helper-module fix [module-path]` to diagnose and fix, then re-run this workflow from Phase 1.

## Loop-backs

- Pre-publish gate fails -> run `/js-helper-module fix [module-path]`, then re-run from Phase 1.
- CI fails after push -> run `/js-helper-module fix [module-path]`, re-run from Phase 1.
- User requests changes -> apply by hand, re-verify gate, re-present.

## Self-Improvement (every run, last step)

If this run exposed a failure mode or a gap in the standard or in this workflow: journal it (`/learn` into the correct pitfall file) BEFORE moving on, run `/finalize-docs` in `codebase-superloom`, and amend this workflow so the next run benefits. Then update the active plan in `__dev__/plans/` and STOP.

## Per-run Verification Checklist

- [ ] Pre-publish gate: lint exit 0, clean-install tests green (Pre-Commit Protocol: fresh install mandatory every publish)
- [ ] Package identity verified: name, private, license, engines, registry, version
- [ ] Ship check: only source + docs + README + ROBOTS + package.json in tarball
- [ ] CI registration added (first publish) or confirmed present (subsequent)
- [ ] Same-version republish handled (if applicable): old versions deleted, 404 verified
- [ ] Module-only commit; CI workflow file staged if registration changed
- [ ] Explicit user approval before push
- [ ] CI published version verified live
- [ ] New failure modes journaled; plan updated; STOPPED
