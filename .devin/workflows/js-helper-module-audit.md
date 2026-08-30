---
description: Read-only deep audit of a JS helper module against the constitution - re-read docs, re-survey reference modules, audit line by line, creator-diff with three-bucket drift classification, report deviations
---

# JS Helper Module Audit Workflow

A read-only, always-deep audit. Run this when a module needs to be checked against the framework's conventions. It does not fix code. It **rebuilds context** by re-reading the source of truth, re-deriving the conventions from real modules, auditing the target module line by line, classifying every deviation into one of three drift buckets, and reporting findings with citations. Corrections are handed to `/js-helper-module fix`.

It exists because conventions drift when an agent trusts its working memory instead of the files. Every convention this repo enforces is **already written down** - in `codebase-superloom/docs/` and demonstrated by the modules already in `src/`. Auditing means reading those sources again and re-deriving the rules from them, never recalling or restating them.

## Operating Principle (READ FIRST)

> **Trust nothing in working memory.** Re-derive every convention from files on disk.
> Treat conversation summaries, prior plans, and retrieved memories as **suspect** until
> reconfirmed against `codebase-superloom/docs/` and real module code. `AGENTS.md` is a
> *derived, compact* index - `docs/` is the authority (the Golden Rule).

**Evidence rule (hard gate).** Every convention you assert anywhere in this run must cite where it comes from - a document path and section, or a reference-module `file:line`. A rule stated without a citation is treated as unverified: it does not count, and you must read the source before relying on it. If the final report contains any uncited claim, the run is incomplete.

This workflow is **read-only and idempotent**. Phases 0 through 4.5 mutate nothing, so it is always safe to re-run. The only output is a report (Phase 5). Fixes are a separate, user-confirmed step via `/js-helper-module fix`.

## When To Run

- An agent has lost the thread, or the user says so.
- After context compaction / a long conversation that touched many files.
- Resuming helper-module work after a gap.
- Before a `fix` or `publish` when you are unsure the work matches conventions.
- Periodic health check on a historical module that has not been touched in a while.

## Command Execution Rules

These prevent a known failure mode where an agent bloats a command with trailing filler
lines, blowing the output budget so the call aborts and the command never runs.

- **NEVER append `exit 0` (or any repeated filler) to a command.** One line, or a single `&&`-joined chain. Nothing follows it.
- **NEVER use `cd` inside the command.** Set the working directory via the tool's `Cwd` parameter. `cd [module_root]` lines below are illustrative of *location*, not literal text to send.
- **Pipe long output through `| tail -N`** to keep results small.
- **`// turbo`** marks a step as safe to auto-run (read-only or idempotent). Steps without it require normal judgement. No mutation step is ever auto-run.

---

## Phase 0: Activate and Scope

1. **Declare the target.** State which module(s) are in focus (default: the currently active module). Everything in Phase 3 is scoped to these.

2. **Suspend edits.** Make no source changes until Phase 5 is presented and the user confirms.

3. **Drop assumptions.** Write one line: "Re-grounding from files; ignoring prior summaries until reconfirmed."

## Phase 1: Re-read the Constitution

Read the source of truth in authority order. Do not skim summaries - the nuance lives in the full text.

1. **Read this repo's `AGENTS.md` fully**, then `codebase-superloom/AGENTS.md`. Treat both as the *derived index*, not the authority.

2. **Enumerate every doc**, so none is skipped:
   // turbo
   ```bash
   # Cwd = codebase-superloom
   find docs -name '*.md' | sort
   ```

3. **Read every file the enumeration returns - all of them, in full.** Do not cherry-pick and do not skim. Whatever a document states is the rule. The `principles/`, `languages/js/`, `ai/`, and `dev/` subtrees carry the rules for code style, module structure, process, and tests - give those the closest reading, but read the whole set so nothing is missed.

4. **Re-read the sibling workflows** in this repo: `.devin/workflows/js-helper-module.md` (including its embedded Standard block) and `.devin/workflows/js-helper-module-publish.md`.

5. **Output a binding-rules checklist** - a short list that *links back* to the doc each rule comes from. Do not restate the rules in detail; the doc is the authority.

## Phase 2: Survey Sibling Modules (derive the fingerprint from reality)

Convention is whatever the real, passing modules do. Re-derive it; do not recall it.

1. **Enumerate every module:**
   // turbo
   ```bash
   # Cwd = [repo-root]
   find . -maxdepth 3 -name "package.json" -not -path "*/node_modules/*" -not -path "*/_test/*" -exec dirname {} \; | sort
   ```

2. **Categorize each using `docs/languages/js/module-classes.md` (stateless singleton, stateful factory, adapter-backed factory, store adapter, vendor wrapper, client-side driver wrapper).

3. **Read one reference module per category in full** - every file: `[name].js`, `[name].config.js`, `[name].errors.js`, `[name].validators.js`, `package.json`, `_test/loader.js`, `_test/package.json`, `_test/test.js`, `README.md`, `ROBOTS.md`, and `docs/`.

4. **Record the convention fingerprint** the target will be diffed against: the shape that recurs across the reference modules - loader, file layout, package and test wiring, public surface, documentation set. Capture what the modules actually do, observed from their source, not what you remember they do.

## Phase 3: Line-by-line Self-audit of the Target Module

Read each source file top to bottom - then read it a second time, because formatting and structural issues routinely hide on a single pass. For every dimension in the audit map below, first derive the concrete rule from its governing document and from the reference modules read in Phase 2, then audit the target against that rule. Do not assume a rule from memory - if you cannot point to where it is written or demonstrated, go read it. Record each deviation as `file:line -> rule it violates (with citation) -> corrective action`.

After reading, run the gates (set `Cwd`, never `cd`):

// turbo
```bash
# Lint  (Cwd = [module_root])
npm run lint 2>&1 | tail -20
```

// turbo
```bash
# Tests (Cwd = [module_root]/_test) - clean install avoids stale file: swaps
rm -rf node_modules package-lock.json && npm install && npm test 2>&1 | tail -40
```

Step-comment conformance (manual gate - lint, tests, and greps cannot see comments): read every function body in every source `.js` file and check ALL of the following:

**a) Universal rule (every function, not just I/O):** The first logical block after the opening `{` has a step comment. Every subsequent logical block separated by a blank line also has a step comment. No exceptions for short functions - even a single-block function gets its opening step comment. (`code-formatting.md` - Inline Step Comments Inside Functions, lines 546-551)

**b) Mandatory Step-Comment Set (I/O functions additionally):** validate step, init step, each driver or delegate call, every success return, every error return, every early-return branch - each preceded by a step comment. (`code-formatting.md` - Mandatory Step-Comment Set for I/O Functions, lines 606-613)

**c) Every `return` statement:** Every `return` in the function has a preceding step comment - including bare returns (`return value;`), final returns (the last `return { success: true, ... }` in a function), and `return null;` at the end of a function. A return without a preceding comment is a gap regardless of whether it looks like a "success" or "error" return.

**d) Loop bodies:** A loop body carrying more than two operations gets a step comment per operation, separated by blank lines. The comment above the loop states what the iteration accomplishes; the comments inside cover each operation. (`code-formatting.md` - Inline Step Comments Inside Functions, line 553)

The Mandatory Set is the audit floor, not the ceiling: blocks outside the set still follow the universal rule. A missing step comment is an S2 consistency finding, escalated to S1 when the uncommented block hides a correctness issue. Output the verdict line `Step-comment conformance: [clean | N gaps]`.

**Peer-dependency utilization review (manual gate - not greppable):** Read the module's `package.json` peerDependencies. For each peer dep, read its `ROBOTS.md` to get the full function signature list. Then re-read the module's source code and check: is any operation reimplementing a function that's available in a peer dep? This catches gaps that pattern-matching cannot (e.g. a module reimplementing `Lib.Debug.performanceAuditLog` manually, or using raw `JSON.parse` with try/catch when `Lib.Utils.stringToJSON` exists, or reimplementing string reversal when `Lib.Utils.stringReverse` exists). Record findings as `file:line -> peer dep function that should be used -> current inline implementation`. Output the verdict line `Peer-dep utilization: [clean | N gaps]`.

Mechanical sweep battery (each must return nothing for this module; `Cwd = [repo-root]`):

// turbo
```bash
git grep -n "—" -- '[module-path]' ':!*/node_modules/*'
```
// turbo
```bash
git grep -nE "→|–" -- ':(glob)[module-path]/**/*.js' ':!*/node_modules/*'
```
// turbo
```bash
git grep -niE "behaviour|colour|favour|licence|optimis|organis|initialis|standardis|serialis|authoris|analyse|centralis|normalis|recognis|synchronis|customis|specialis|catalogu" -- '[module-path]' ':!*/node_modules/*'
```
// turbo
```bash
git grep -niE "comprehensive|seamless|robust|powerful|blazing|effortless|leverage|battle-tested|cutting-edge|world-class|in order to|feel free to|please note|out of the box|a wide range of" -- '[module-path]' ':!*/node_modules/*'
```
// turbo
```bash
git grep -nE "\bvoid [a-zA-Z_]+;|\(_[a-zA-Z]" -- '[module-path]' ':!*/node_modules/*' ':!*/_data/*'
```
// turbo
```bash
git grep -n "docs/" -- ':(glob)[module-path]/**/*.js' ':!*/node_modules/*'
```
// turbo
```bash
# Plan references in code comments - plans are ephemeral, code comments must be self-contained
git grep -nE "Plan [0-9]|plan [0-9][0-9][0-9]" -- ':(glob)[module-path]/**/*.js' ':!*/node_modules/*'
```
// turbo
```bash
git grep -n "@superloomdev/" -- ':(glob)[module-path]/**/*.md' ':(glob)[module-path]/**/*.js' ':!*/node_modules/*'
```
// turbo
```bash
git grep -nE "js-(server-|client-)?helper-[a-z][a-z-]*" -- ':(glob)[module-path]/**/*.md' ':(glob)[module-path]/**/*.js' ':!*/node_modules/*'
```
// turbo
```bash
git grep -nE "typeof [^ ]+ (!==|===) '(number|function|string|boolean|object)'" -- '[module-path]/*.js' ':!*/node_modules/*'
```
// turbo
```bash
# .split('').reverse().join('') should use Lib.Utils.stringReverse
git grep -n "\.split('').reverse().join('')" -- ':(glob)[module-path]/**/*.js' ':!*/node_modules/*' ':!*/_data/*'
```
// turbo
```bash
# .length === 0 / > 0 / !== 0 on strings -> Lib.Utils.isEmptyString; on arrays -> Lib.Utils.isEmptyArray
git grep -nE "\.length (===|!==|>) 0" -- ':(glob)[module-path]/**/*.js' ':!*/node_modules/*' ':!*/_data/*' ':!*/_test/*'
```
// turbo
```bash
# === '' / !== '' should use Lib.Utils.isEmptyString
git grep -nE "=== ''|!== ''" -- ':(glob)[module-path]/**/*.js' ':!*/node_modules/*' ':!*/_data/*' ':!*/_test/*'
```
// turbo
```bash
# Object.keys(x).length against zero should use Lib.Utils.isEmptyObject
git grep -nE "Object\.keys\([^)]+\)\.length (===|!==|>) 0" -- ':(glob)[module-path]/**/*.js' ':!*/node_modules/*' ':!*/_data/*'
```
// turbo
```bash
# .indexOf(x) > -1 should use Lib.Utils.inArray or native .includes()
git grep -nE "\.indexOf\([^)]+\) (>|<)=? -1" -- ':(glob)[module-path]/**/*.js' ':!*/node_modules/*' ':!*/_data/*' ':!*/_test/*'
```
// turbo
```bash
# JSDoc content indentation - ALL lines inside /*...*/ blocks must be at the same column as /*
# The awk detects the /* column per block, then flags any content or closer not at that column
# Continuation lines (indented more than /* col + 4 for readability alignment) are excluded
find [module-path] -name "*.js" -not -path "*/node_modules/*" -exec awk '
/\/\*{8,}/ { match($0,/^ */); jsdoc_col=RLENGTH; in_jsdoc=1; next }
in_jsdoc && /\*{8,}\// { match($0,/^ */); c=RLENGTH; if(c!=jsdoc_col) print FILENAME":"NR": CLOSER col "c" (should be "jsdoc_col")"; in_jsdoc=0; next }
in_jsdoc && /[^ ]/ { match($0,/^ */); c=RLENGTH; if(c!=jsdoc_col && c<=jsdoc_col+4) print FILENAME":"NR": CONTENT col "c" (should be "jsdoc_col")" }
' {} +
```
// turbo
```bash
# CJS remnants - module.exports, 'use strict', require() (excluding createRequire); catches CJS in code, comments, and error messages
git grep -nE "module\.exports|'use strict'|\brequire\(" -- '[module-path]' ':!*/node_modules/*' | grep -v createRequire
```
// turbo
```bash
# Relative imports must include a .js extension; each hit is a missing extension
git grep -nE "from '\./" -- ':(glob)[module-path]/**/*.js' ':!*/node_modules/*' | grep -v "\.js'"
```
// turbo
```bash
# "main" present without "exports" in package.json (CJS signature); must return nothing when clean
grep -q '"main"' [module-path]/package.json && ! grep -q '"exports"' [module-path]/package.json && echo 'FAIL: "main" present without "exports"'
```
// turbo
```bash
# scripts/ files must match the package's module type; CJS syntax in an ESM package is a violation
git grep -nE "require\(|module\.exports|'use strict'" -- '[module-path]/scripts/' ':!*/node_modules/*' | grep -v createRequire
```

The last three enforce the two-form rule and the type-guard primitive rule; sole permitted bare-name hits are URLs addressing a real repo path, and sole permitted `@superloomdev/` hits are real `import` calls in `eslint.config.js` - judge each manually. Each `typeof` hit is either a violation to convert to a `Lib.Utils` primitive, or one of two permitted forms: argument-shape dispatch or capability duck-typing. The peer-dep utilization sweeps catch inline reimplementations of functions available in peer dependencies; judge each hit by the variable type (string -> `isEmptyString`, array -> `isEmptyArray`) and by whether the peer dep offers a wrapper for that operation. The JSDoc content indentation sweep uses awk to detect the `/*` column for each block, then flags any content line or closer not at that column. The indentation is relative to the `/*` column, not absolute: a JSDoc block at column 0 has all content at column 0; a JSDoc block nested at column 4 has all content at column 4. Continuation lines (indented more than `/*` col + 4 for readability alignment) are excluded. A hardcoded grep or awk that assumes a fixed column misses nested blocks.

**Sweep result reporting (hard gate):** For each sweep, state one of:
- `[sweep name]: clean` (zero hits)
- `[sweep name]: N hits -> [file:line for each]` (with judgment per hit)

A sweep that returned hits but is reported as "clean" is a convergence failure. Paste the raw grep output into the conversation, then classify each hit. Sweeps may not be silently skipped.

Before trusting any sweep that returned zero hits, prove the sweep can fire: plant a deliberate violation in a scratch file, confirm the sweep matches it, delete the scratch file, then run for real. A zero-hit sweep that has never been shown to match anything is not evidence. Sweeps whose rule depends on enclosing context must read that context; a line-oriented grep cannot enforce a block-scoped rule.

Stale-name and cross-reference scrub. Renamed symbols and leftover legacy or branding tokens are a classic drift signature; hunt them across code, tests, and docs:

// turbo
```bash
# Cwd = [repo-root] - replace [old-name] with any suspected stale token
git grep -n "[old-name]" -- 'src/**' '*.md' '*.yml'
```

### Audit Map

These are the *dimensions* to audit, each paired with where its rules actually live. For each one: open the source, extract the rules it states, confirm them against the reference modules, then audit the target. This workflow deliberately does not repeat the rules - that is what the documents are for, and copying them here would itself become a source of drift.

| Dimension | Where its rules live |
|---|---|
| Code formatting, comments, spacing | `languages/js/code-formatting.md` |
| Module structure, loader, public/private surface, exports | `languages/js/module-structure.md`, `languages/js/factory-vs-singleton.md` |
| Dependency and peer-dependency wiring | `languages/js/dependencies.md` |
| Test layout, loader, and dependency wiring | `dev/testing-local-modules.md`, `languages/js/unit-test-authoring.md`, `languages/js/module-testing.md` |
| Error handling and catalogs | `languages/js/error-handling.md` |
| Validation | `languages/js/validation.md` |
| Documentation files and their content | `principles/documentation-authoring.md`, `languages/js/module-docs.md` |
| Naming consistency (no stale or legacy tokens anywhere) | the cross-reference scrub above + the reference modules |
| Function naming doctrine (verb catalog, return shapes, banned verbs, config key casing) | `languages/js/function-naming.md` - list every exported function, name its doctrine verb and return shape, compare to actual. A module with zero lines of output has not run this check. Exception: React component factories are PascalCase and noun-named by framework contract; the verb rule applies to non-component exported functions |

This table is a starting set, not a closed list. If the target needs a dimension not shown, find its governing document yourself and audit against that.

### Converge

Do not proceed to the report after a single pass. Re-run this phase until **two consecutive passes surface zero new deviations**. A run whose most recent pass still found issues has not converged - audit again. Convergence, not effort, is the exit condition.

## Phase 4: Diagnose Drift Root Cause

1. **Diagnose the drift.** Before re-anchoring, answer briefly and honestly: Did I start from a scratch, demo, or experimental area whose conventions differ? Did I carry a pattern in from another codebase? Which governing document did I act without reading? Did I rely on a summary, plan, or memory instead of source? Did a rename leave stale tokens behind? The answers are the root cause - carry them into the self-improve step.

2. **Re-anchor the plan.** List `__dev__/plans/` by mtime, read the most recent plan, and state the plan + in-progress step (the planning protocol). Confirm it still matches the work in focus.
   // turbo
   ```bash
   # Cwd = project-superloom (workspace root, outside any repo)
   ls -t __dev__/plans/*.md | head -5
   ```

3. **Self-improve hook.** Feed the drift diagnosis from step 1 back into the framework: if it exposed a rule or failure mode **not yet in `docs/`**, capture it via `/learn` into the correct pitfall file **before** any fix, then run `/finalize-docs` in `codebase-superloom`. This honors the Golden Rule and teaches the framework so the lesson is not re-learned.

## Phase 4.5: Creator-Diff (three-bucket drift classification)

For every deviation found in Phase 3, classify it into exactly one of three buckets. The classification determines the corrective action and whether the deviation is a bug or an intentional choice.

### Bucket 1: Docs Drift (docs evolved, code is stale)

The module's code matched the docs at the time it was written, but the docs have since changed. The code is not wrong relative to its original spec; it is simply out of date.

**How to detect:** Use git history to check whether the governing doc was modified after the module's last significant change:
// turbo
```bash
# Cwd = codebase-superloom - check if the governing doc changed after the module's last commit
git log --oneline --since="[module-last-commit-date]" -- docs/languages/js/[governing-doc].md
```
// turbo
```bash
# Cwd = [repo-root] - find the module's last commit date
git log -1 --format="%ci" -- [module-path]
```

If the doc changed after the module, and the deviation matches what the doc used to say, this is Bucket 1.

**Action:** Update the module to match the current docs. This is a retrofit, not a bug fix. The `/js-helper-module fix` verb handles this case.

### Bucket 2: Code Drift (code diverged, docs are correct)

The module's code does not match what the docs say, and the code was never correct relative to the current (or past) docs. This is a genuine bug or convention violation introduced during development.

**How to detect:** The deviation does not match any prior version of the governing doc, or the doc has not changed since the module was written. The code was wrong from the start or was modified incorrectly.

**Action:** Fix the code. The `/js-helper-module fix` verb applies the correction.

### Bucket 3: Intentional Deviation (code deliberately diverges)

The module deliberately diverges from the docs for a documented, valid reason. The deviation is a design decision, not an error.

**How to detect:** The module's `THOUGHTS.md`, a code comment, or a doc section explicitly justifies the deviation. The reason must be specific and current - not a stale comment referencing a doc that has since been updated.

**Action:** Verify the reason is still valid against current docs. If the reason is stale (the docs have evolved to handle the case the deviation was working around), reclassify as Bucket 1. If the reason is still valid, document the deviation in the module's `THOUGHTS.md` if not already there, and mark it as acknowledged in the audit report. No code change needed.

### Classification Table

For each deviation, output:

| Deviation | Bucket | Evidence | Action |
|---|---|---|---|
| `file:line -> rule (citation)` | 1 / 2 / 3 | git log or comment proving the classification | retrofit / fix / acknowledge |

If a deviation cannot be classified confidently, mark it `UNCLASSIFIED` and investigate further before proceeding.

## Phase 5: Report and Hand Off (gated)

1. **Present the audit report in chat** (do not persist a file). Every convention named must carry its citation (the evidence rule). Structure:
   - **Conventions re-derived** - the binding-rules checklist from Phase 1, each line citing its doc.
   - **Drift diagnosis** - the root cause from Phase 4.
   - **Deviations found** - a table of `file:line -> rule violated (with citation) -> corrective action`, grouped by audit dimension.
   - **Sweep results** - each sweep from the mechanical sweep battery with its result: `clean` or `N hits -> [file:line for each]` with judgment per hit.
   - **Workflow coverage classification** - for each deviation, classify how the workflow caught it:
     - **workflow-caught:** The workflow's sweep battery or step-comment gate would have caught this finding.
     - **workflow-missed:** The workflow's checks do not cover this class of finding. This is a workflow design gap to report to Plan 0111.
     - **execution-missed:** The workflow's checks DO cover this finding, but the agent failed to report it. This is an execution error, not a workflow design gap.
   - **Creator-diff classification** - the three-bucket table from Phase 4.5, with bucket counts: `Bucket 1 (docs drift): N | Bucket 2 (code drift): N | Bucket 3 (intentional): N | Unclassified: N`.
   - **Gate results** - lint and test status, and confirmation the audit converged (two clean consecutive passes).
   - **Plan state** - active plan + in-progress step.

2. **Do not auto-fix.** Hand the corrective actions to the module workflow:
   ```
   /js-helper-module fix [module-path]
   ```
   The audit report (including the creator-diff classification) serves as input to `fix`, allowing it to skip Phases A-B and go straight to applying findings.

3. **STOP and ask.** Wait for explicit user confirmation before any source change.

---

## Verification Checklist (this run)

- [ ] Target module(s) declared; edits suspended
- [ ] `AGENTS.md` (both repos) read; treated as derived index
- [ ] Every `docs/*.md` enumerated and read in full
- [ ] Sibling workflows re-read (js-helper-module.md + js-helper-module-publish.md)
- [ ] Every module enumerated and categorized; one reference per category read in full
- [ ] Fingerprint recorded
- [ ] Each target file read at least twice; audited line by line against the audit map (rules derived from docs + reference modules)
- [ ] Audit converged: two consecutive passes with zero new deviations
- [ ] Every asserted convention carries a citation (doc path/section or reference-module `file:line`)
- [ ] Lint run; tests run via clean install
- [ ] Step-comment conformance verdict line output (all 4 sub-checks: universal rule, mandatory set, every return, loop bodies)
- [ ] Mechanical sweep battery run; each sweep result reported explicitly (clean or hits with judgment)
- [ ] Peer-dep primitive utilization sweeps run (stringReverse, isEmptyString/Array, isEmptyObject, inArray); every hit judged
- [ ] Peer-dep utilization review done (read peerDeps + ROBOTS.md, cross-reference source); verdict line output
- [ ] Plan-reference sweep run (code comments must not reference plan numbers)
- [ ] JSDoc content indentation sweep run (flush-left @param/@return lines, no 4-space indent inside /*...*/)
- [ ] Stale-name / cross-reference scrub run
- [ ] Drift root cause diagnosed; plan re-anchored; new failure modes captured via `/learn` if any
- [ ] Creator-diff: every deviation classified into Bucket 1, 2, or 3 (or UNCLASSIFIED with reason)
- [ ] Bucket counts stated; evidence for each classification recorded
- [ ] Workflow coverage classification stated for each deviation (workflow-caught / workflow-missed / execution-missed)
- [ ] Report presented in chat; fixes handed to `/js-helper-module fix`; stopped for user confirmation
