# Autonomous Execution

How to let a lower-tier LLM execute plans unattended, with a self-correcting verification loop, without silently lowering the quality bar. This is standing doctrine, not scoped to any single plan.

## On This Page

- [Why This Exists](#why-this-exists)
- [Authorization Boundary](#authorization-boundary)
- [The Convergence Loop](#the-convergence-loop)
- [Escalation Log](#escalation-log)
- [Progress Journal](#progress-journal)
- [Publish Ordering](#publish-ordering)
- [Registry and Publish Ordering](#registry-and-publish-ordering)
- [What Counts as Done](#what-counts-as-done)
- [The Things Most Likely to Go Wrong](#the-things-most-likely-to-go-wrong)

---

## Why This Exists

The module workflows contain hard-stop gates that require a human. They are correct for interactive use and they make unattended execution impossible. This protocol names exactly which of those are pre-authorized and which remain hard stops. It does not remove the gates from the workflow files. The workflows stay correct for interactive use; this protocol is an explicit, bounded authorization that applies while executing a plan chain.

---

## Authorization Boundary

### Pre-authorized: proceed without asking

- Editing, creating, and deleting source files inside the plan's target packages
- Auto-fixing audit findings, then re-auditing
- Running lint, tests, and clean installs any number of times
- `git add`, `git commit`, `git push` to the working branch
- Creating a new GitHub repository when the plan calls for one
- `npm publish` of a **new** package name, or a **new version** of a package this plan authored
- Continuing to the next module or wave once the current one's gate passes
- Journaling findings and running `/finalize-docs`
- Adding a dependency the plan explicitly names

### Never authorized: hard stop, write to the escalation log, move to other work

These are not blocked by caution; they are blocked because they destroy work or are irreversible in a way that cannot be undone by a later commit.

- `git push --force`, any history rewrite, branch deletion
- `git checkout` or `git reset --hard` over uncommitted changes
- Deleting or unpublishing a published package version that the active plan does not name
  explicitly. Where the target repository's `AGENTS.md` declares delete-then-push as its release
  mechanism, a plan that names the package authorizes its deletion. Where it does not, the remedy
  is a version bump and deletion stays unauthorized. A blanket or bulk deletion is never
  authorized, regardless of what the plan says.
- `rm -rf` on any directory the run did not itself create
- Modifying `minimumReleaseAge`, `.npmrc` security settings, branch protection, or any CI security control
- Adding a dependency the plan does **not** name, when the purpose is to work around a failing test
- Editing another plan's target packages
- Any command whose failure mode the run cannot articulate

### The judgment rule

The boundary is: **forward progress is authorized; destroying or overwriting existing work is not.** When an action is not clearly on one side, treat it as unauthorized, log it, and continue with other work. Do not stall the whole run waiting on one blocked item.

---

## The Convergence Loop

This is the mechanism that makes unattended execution self-correcting: run the workflow, find gaps, fix them, run again, until it stops finding issues.

### The loop

For each module or wave, after the implementation work is written:

```
iteration = 0
loop:
  iteration = iteration + 1

  1. Run /js-helper-module-audit Phases 1 through 4.5 on the target.
     Phase 0.2 ("suspend edits") and Phase 5 ("do not auto-fix", "STOP and ask")
     are waived per the authorization boundary.

  2. Collect findings. Classify each with the audit's own Phase 4.5 buckets:
       Bucket 1  Docs Drift          -> docs changed after the code. Update the CODE.
       Bucket 2  Code Drift          -> code diverged from correct docs. Update the CODE.
       Bucket 3  Intentional         -> deliberate divergence. Requires a written
                                        justification in the module's THOUGHTS.md.
                                        With no justification it is Bucket 2, not Bucket 3.

  3. If findings is empty:
       clean_passes = clean_passes + 1
       if clean_passes == 2: BREAK, converged
       else: continue loop
     else:
       clean_passes = 0
       Fix every Bucket 1 and Bucket 2 finding.
       For Bucket 3, write the justification or fix it.

  4. Re-run the hard gates:
       npm run lint      (Cwd = module root)      must exit 0, zero warnings
       npm install && npm test  (Cwd = _test/)    must exit 0, zero failures

  5. if iteration >= 5: STOP this target, write to escalation log, move to the next
```

### Converged means two consecutive clean passes

One clean pass is not convergence. A fix frequently introduces a new finding, and a single pass cannot see it.

### The iteration cap is a real stop

Five iterations without convergence means the run is oscillating: fix A breaks B, fix B breaks A. Do not attempt a sixth. Write both findings and both attempted fixes to the escalation log and move on. An oscillating loop burns the whole run on one module.

### Never mark a gate green without evidence

For every gate, the run must be able to name the command it executed and quote the output. An assertion that lint passed, without having run lint in that iteration, is a protocol violation.

### Prove every check fires before trusting an empty result

An enforcement grep that has never produced a hit has not been shown capable of producing one. For each new grep: introduce a deliberate violation in a scratch file, confirm the grep matches it, delete the scratch file, then run the grep for real.

**A check must be able to see what it is checking.** When a rule depends on context - block nesting, enclosing indentation, scope, or multi-line structure - a line-oriented `grep` cannot enforce it, and neither can an `awk` with a hardcoded column. Choose a check that reads the enclosing context, and prove it fires on a planted violation before trusting an empty result.

Worked example. A JSDoc indentation rule was enforced three times before it held. First with `grep -nE "^    @param|^    @return"`, which cannot see description prose because prose does not start with `@`. Then with an `awk` matching exactly four leading spaces, which over-stripped blocks nested at column two, missed content at column eight, and silently corrupted a reference module. Only the third attempt, an `awk` that records the `/*` column for each block and compares every content line and the closer against it, was correct. The rule was always relative to the delimiter column; two implementations assumed it was absolute.

---

## Escalation Log

### The file

`__dev__/ESCALATIONS.md`, appended to, never rewritten. One entry per blocked item:

```markdown
## [ISO timestamp] [plan id] [target]

**Category:** unauthorized-action | oscillating-loop | undecided-convention | external-failure
**What I was doing:**
**What blocked me:**
**Evidence:** exact command and output, or file and line
**What I did instead:** the documented default I applied, or "skipped this target"
**What I need from you:** the specific decision required
```

### Escalate, then keep going

An escalation is not a halt. Log it, apply the documented default if the plan gives one, and continue with the next independent item. The run should end with as much done as possible plus a precise list of what needs a human.

**The one exception:** if a dependency of the remaining work is blocked, the dependent work is also blocked. Skip the whole dependent subtree and say so in the entry. Do not attempt to publish an adapter whose core failed to publish.

### Undecided conventions get a default, not a guess

If the run hits a convention the plan does not settle, it must not invent one silently. It:

1. Searches for precedent in the settled conventions registry
2. If precedent exists, follows it and records the occurrence count as evidence
3. If no precedent exists, applies the plan's stated default, or the most common form in the
   published catalog, and logs the choice as an escalation with `undecided-convention`

The difference between this and guessing is that the choice is recorded with its evidence and can be reversed in one place.

---

## Progress Journal

### Why

An unattended run can exceed one context window. Without a durable journal, a fresh context restarts from zero, re-does finished work, and may undo it.

### The file

`__dev__/PROGRESS.md`, updated after **every** gate, not at the end:

```markdown
# Progress Journal

## Current position
CURRENT:  <plan-file>
STEP:     <part and step>
CHAIN:    <plan -> plan -> plan>
UPDATED:  <date>

## Completed
- <plan> <step>: <result> (<date>)

## In flight
- <what is currently being worked on>

## Blocked
See ESCALATIONS.md.
```

### Resume rule

On starting any session, before any other action: read `RUNBOOK.md`, then `PROGRESS.md`, then `ESCALATIONS.md`, then the plan named as `CURRENT`. State the current position. Never begin work without doing this, and never trust a conversation summary over these files.

---

## Publish Ordering

### The rule

A package cannot be installed by a consumer until it is on the registry. So a core must publish before its adapter's `_test/` can install it, and the shared ESLint config must publish before anything that lints.

**Only the module under test uses `file:../` in `_test/package.json`.** Every sibling dependency uses a registry semver range. This is not a style preference: a `file:` link to a sibling means the test never exercises the published artifact, and a broken publish passes its own tests.

### Verify the publish actually landed

Publishing is not done when `npm publish` exits 0. It is done when a clean install from the registry succeeds:

```
# Cwd = a scratch directory outside every repo
npm view [scope]/[name]@[version] version        # must print the version
npm install [scope]/[name]@[version]             # must succeed from a clean cache
```

Only then is the next package unblocked.

### Registry transients are expected

`E409` and checksum mismatches from GitHub Packages are transient. Wait 30 to 60 seconds and clean install again. Retry up to 3 times. **Never pass `--legacy-peer-deps`** to make an install succeed; that hides a real peer conflict. After 3 failures, escalate with `external-failure`.

---

## Registry and Publish Ordering

Three rules from a real incident where 18 packages were stranded off the registry and two consumer repos went red:

1. **Delete before push, never after.** The CI `detect` job snapshots registry state at run start. Deleting after that snapshot leaves publish jobs already stamped skip and strands the packages.

2. **Never `gh run rerun --failed` to recover a publish.** `detect` succeeds, so a failed-only re-run skips it and reuses the stale publish list. Recovery requires a new run from a new push.

3. **A push to `main` publishes every module absent from the registry**, not only those the commit touched. `detect` iterates all modules independent of the diff. Multi-module work therefore stages on a branch, and per-module publishing requires an otherwise complete registry.

---

## What Counts as Done

A target is done when all of the following hold, each with named evidence:

- [ ] The convergence loop reached two consecutive clean audit passes
- [ ] `npm run lint` exits 0 with zero warnings, run in the final iteration
- [ ] `npm install && npm test` from `_test/` exits 0 with zero failures, run in the final iteration
- [ ] Every enforcement grep passes and each was proven to fire first
- [ ] The plan's own gate for that target passes, including any asserted count
- [ ] Documentation for the target is complete, including `ROBOTS.md`
- [ ] `PROGRESS.md` updated
- [ ] Committed

A target is **not** done because the code looks finished.

---

## The Things Most Likely to Go Wrong

1. **Skipping the second clean pass.** One clean pass is not convergence
2. **Asserting a gate without running it.** The exact failure that ships a defect behind green gates
3. **Trusting an empty grep that was never proven to fire**
4. **Publishing an adapter before its core is installable from the registry**
5. **Using `file:../` for a sibling dependency**, which makes the test pass while the package is broken
6. **Letting one oscillating module consume the whole run.** Cap at 5, escalate, move on
7. **Not updating `PROGRESS.md`**, so a context reset re-does or undoes finished work
8. **Adding a dependency to make a test pass.**
9. **`--legacy-peer-deps` to force an install through**
10. **Editing `AGENTS.md` directly** instead of `docs/` then `/finalize-docs`
11. **Treating an escalation as a halt.** Log it and continue with independent work
12. **Marking Bucket 3 "intentional" without writing the justification.** Undocumented deviation is Bucket 2
13. **Deleting a published package after pushing, not before.** The snapshot has already been taken
14. **Using `gh run rerun --failed` to recover a publish.** It skips `detect` and reuses a stale list
