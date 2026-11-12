---
description: Pre-publish gate, CI registration, version bump, and release for JS helper modules
---

# JS Helper Module Publish Workflow

This is the publish workflow for a JavaScript helper module. Each run operates on ONE module, which the invocation names. Only CI publishes. A person does not run `npm publish`.

Invoke as: `/js-helper-module-publish [module-path]`
Example: `/js-helper-module-publish [module-path]`

## Operating Principle

> **Publishing is CI-only.** This workflow prepares the module for a release. It verifies the pre-publish gate, examines the package identity, bumps the version, registers CI jobs when necessary, and commits. The publish occurs when the commit is pushed to `main` and CI runs the unified pipeline.

## Execution Contract (binding)

1. **One module per run.** Do not touch the files of a second module.
2. **Phases run in order.** Do not skip, merge, reorder or parallelize them.
3. **No improvisation.** Use only the commands in this file, with `[module-path]`, `[module_root]` and `[name]` replaced. If no instruction matches a situation, STOP and ask.
4. **When you are not sure, STOP.** Report what you see and ask.
5. **No files outside the module.** Do not write scratch scripts or notes files in the repository.
6. **Manual edits only.** Read the whole file, then make each change by hand with the editor tool. FORBIDDEN: one-off scripts, bulk `sed -i`/`awk`/`perl -pi` rewrites, codemods, find-and-replace in a terminal.
7. **Mark a checklist line done only after you did it in this run.**

## Command Execution Rules

- **NEVER use `cd`** inside a command. Set the tool's `Cwd` parameter. `[module_root]` is a location, not literal text.
- Write one line for each command, or one `&&` chain. Add nothing after it.
- Pipe long output through `| tail -N`.
- `// turbo` marks a read-only or idempotent step that can run automatically. **A mutation step never runs automatically.** Registry operations, `git commit`, `git push` and publish always need explicit approval.

## Phase 1 - Pre-publish Gate

1. **Lint must exit 0:**
   // turbo
   ```bash
   # Cwd = [module_root]
   npm run lint 2>&1 | tail -20
   ```
2. **Clean-install tests must pass.** This is the fresh-install gate of the Pre-Commit Protocol (`codebase-superloom/docs/dev/testing-local-modules.md` - Pre-Commit Protocol). It is mandatory for each publish:
   // turbo
   ```bash
   # Cwd = [module_root]/_test
   rm -rf node_modules package-lock.json && npm install && npm test 2>&1 | tail -40
   ```
   An E409 from the registry is transient. Wait 30 to 60 seconds and run the command again. Do not use `--legacy-peer-deps`.
3. If one of the two steps fails, STOP and report. Do not go to Phase 2.

## Phase 2 - Package Identity

Verify each item in `[module_root]/package.json`:

1. **Name:** `@superloomdev/js-[server-|client-]helper-[name]` (scoped, the same as the directory name)
2. **`private: false`** (the package must be publishable)
3. **`license: MIT`**
4. **`engines.node >= 24`**
5. **`publishConfig.registry`** is exactly `https://npm.pkg.github.com` (no `/@superloomdev` scope suffix at the end)
6. **Version** bumped by SemVer (a new module starts at `1.0.0`). State the old version and the new version.

If a field is wrong, fix it by hand. Then verify it again.

## Phase 3 - Ship Check

// turbo
```bash
# Cwd = [module_root]
npm pack --dry-run 2>&1 | tail -30
```

Only the source, `README.md`, `ROBOTS.md`, `docs/` and `package.json` ship. There is no `.npmrc` in the module, in `_test/` or in the repository root. If unexpected files show, examine `.npmignore` (the reference is `js-helper-utils`).

## Phase 4 - CI Registration (first publish only)

If this module was never published:

1. Add the `test-*`/`publish-*` job pair to `.github/workflows/ci-publish-helper-modules.yml`. Put it after the publish job of the last dependency.
2. Both `if:` conditions use `contains(fromJSON(...))` with the full `src/` path.
3. The test job includes `always() && !cancelled()`.
4. The publish job includes `!cancelled()` and an explicit `needs['test-*'].result == 'success'`.
5. **The `_test/package.json` of this module can install another package of the repository from the registry** (extension modules, store adapters). If it does, its test job `needs` the `publish-*` job of that package, not its `test-*` job. A wrong chain fails only during a bootstrap or a registry re-baseline (pitfalls entry 23 in `codebase-superloom/docs/dev/pitfalls.md`).
6. Update the execution-order header comment. Chain the `needs:` of the next module again.

**Bootstrap window (main module and adapters both unpublished):** this case is historical, and the current catalog is fully published. A new module family can have no published member. If so, do these steps in this order. Publish the main module. Test the adapters against the registry artifact. Then publish the adapters. A temporary `file:` reference to an unpublished sibling is not acceptable final evidence. Pitfalls entry 12 in `codebase-superloom/docs/dev/pitfalls.md` gives the full sequence and the reason for the second test.

If the module is already registered, skip this phase.

## Phase 5 - Same-version Republish (only when the repo's policy allows it)

Skip this phase on a normal version bump. That is the default path.

Enter this phase only when the `AGENTS.md` of the target repository documents same-version republishing as its release method. If it does not, fix a shasum mismatch with a version bump. Do not delete a published version. A consumer can have resolved that version, and the delete breaks its lockfile (`codebase-superloom/docs/dev/cicd-publishing.md` - The Remedy Depends on the Release Policy).

1. **Record the shasum before the delete.** It is the evidence that the republish shipped new content (`codebase-superloom/docs/dev/cicd-publishing.md` - The Publish Guard Compares Content, Not Version Presence):
   // turbo
   ```bash
   npm view @superloomdev/[PACKAGE_NAME]@[VERSION] dist.shasum
   ```
   Write down the value. If the republish ends with the same shasum, it shipped nothing.
2. **Identify the exact version ID to delete.** Query the registry for that one version. Do not delete all versions:
   ```bash
   gh api "orgs/superloomdev/packages/npm/[PACKAGE_NAME]/versions?per_page=100" --jq '.[] | select(.name == "[VERSION]") | .id'
   ```
   Exactly one ID must match. If no ID or more than one ID returns, stop and diagnose. The autonomous execution protocol forbids a bulk delete of all versions.
3. **Delete only the identified version:**
   ```bash
   gh api --method DELETE "orgs/superloomdev/packages/npm/[PACKAGE_NAME]/versions/[VERSION_ID]"
   ```
4. Verify that the version is gone:
   ```bash
   gh api "orgs/superloomdev/packages/npm/[PACKAGE_NAME]/versions?per_page=100" --jq '.[] | select(.name == "[VERSION]") | .id'
   ```
   An empty result means that the delete was successful. If the response still lists the version, the delete failed. Do NOT continue. Diagnose the delete.
5. Go to Phase 6.

## Phase 6 - Commit

Commit only this module. Use a single-line message. Do not use `git add .`:
```bash
git add [module-path]/
git commit -m "feat([name]): [one-line summary]"
```

If you added or changed the CI registration, also stage the workflow file:
```bash
git add .github/workflows/ci-publish-helper-modules.yml
```

**STOP.** Ask: "Ready to push and trigger CI publish. Approve?" After the approval:
```bash
git push
```

## Phase 7 - Verify CI Published

Watch the workflow until it is green. Then make sure that the version is live:
// turbo
```bash
gh api "/orgs/superloomdev/packages/npm/[PACKAGE_NAME]/versions" --jq '.[] | {id, name}'
```

**Content verification (hard gate).** A listed version does NOT prove that the new content shipped. A publish job with a version-existence guard skips without a message when the version exists. The job reports green, and the registry still serves the old tarball. Sources: `codebase-superloom/docs/dev/cicd-publishing.md` - The Publish Guard Compares Content, Not Version Presence. CI/CD Publishing entry 26 in `codebase-superloom/docs/dev/pitfalls.md`. Read the published shasum:
// turbo
```bash
npm view @superloomdev/[PACKAGE_NAME]@[VERSION] dist.shasum
```
Compare it with the shasum of this commit:
// turbo
```bash
# Cwd = [module_root]
npm pack --dry-run --json 2>/dev/null | jq -r '.[0].shasum'
```
The two values MUST be equal. A mismatch means that CI published other content, or skipped and kept the old tarball. Diagnose it before you report success.

On a same-version republish (Phase 5 only), the published shasum must also be different from the value that you recorded in Phase 5. An unchanged value means that the delete was skipped or that the publish job did nothing.

If CI fails, run `/js-helper-module fix [module-path]` to diagnose and fix. Then run this workflow again from Phase 1.

## Loop-backs

- The pre-publish gate fails: run `/js-helper-module fix [module-path]`, then run again from Phase 1.
- CI fails after the push: run `/js-helper-module fix [module-path]`, then run again from Phase 1.
- The user asks for changes: apply them by hand, verify the gate again, and present again.

## Self-Improvement (every run, last step)

This run can show a failure mode or a gap in the standard or in this workflow. If it does, do these steps in this order:

1. Journal it with `/learn` in the correct pitfall file BEFORE you continue.
2. Run `/finalize-docs` in `codebase-superloom`.
3. Change this workflow so that the next run benefits.
4. Update the active plan in `__dev__/plans/` and STOP.

## Per-run Verification Checklist

- [ ] Pre-publish gate: lint exit 0, clean-install tests pass (fresh install for each publish)
- [ ] Package identity verified: name, private, license, engines, registry, version
- [ ] Ship check: only source, docs, README, ROBOTS and package.json in the tarball
- [ ] CI registration added (first publish) or found (later publishes)
- [ ] Same-version republish: skipped (normal bump), or documented in the repo's `AGENTS.md`
- [ ] Same-version republish only: shasum recorded before the delete, version deleted, 404 verified
- [ ] Commit has only this module, and the CI workflow file is staged if the registration changed
- [ ] Explicit user approval before the push
- [ ] CI published version is live, and its shasum is equal to `npm pack` for this commit
- [ ] New failure modes journaled, plan updated, STOPPED
