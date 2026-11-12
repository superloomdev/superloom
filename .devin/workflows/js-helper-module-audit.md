---
description: Read-only deep audit of a JS helper module against the constitution - re-read docs, re-survey reference modules, audit line by line, creator-diff with three-bucket drift classification, report deviations
---

# JS Helper Module Audit Workflow

This is a read-only audit, and it is always deep. Run it when a module must be checked against the conventions of the framework. It does not fix code. It **rebuilds context** in these steps:

1. Read the source of truth again.
2. Get the conventions again from real modules.
3. Audit the target module line by line.
4. Put each deviation into one of three drift buckets.
5. Report the findings with citations.

The corrections go to `/js-helper-module fix`.

This workflow exists because conventions drift when an agent trusts its working memory and not the files. Each convention that this repository enforces is **already written down**. It is in `codebase-superloom/docs/`, and the modules in `src/` show it. An audit reads those sources again and gets the rules from them. It does not recall or restate them.

## Operating Principle (READ FIRST)

> **Trust nothing in working memory.** Get each convention again from the files on disk.
> Conversation summaries, earlier plans and retrieved memories are **suspect** until
> you confirm them against `codebase-superloom/docs/` and real module code. `AGENTS.md` is a
> *derived, compact* index. `docs/` is the authority (the Golden Rule).

**Evidence rule (hard gate).** Each convention that you state in this run must cite its source: a document path and section, or a `file:line` in a reference module. A rule without a citation is unverified. It does not count. Read the source before you use it. If the final report has a claim without a citation, the run is not complete.

This workflow is **read-only and idempotent**. Phases 0 through 4.5 change nothing, so you can always run it again. The only output is a report (Phase 5). Fixes are a separate step that the user confirms, through `/js-helper-module fix`.

## When To Run

- An agent lost the thread, or the user says so.
- After context compaction, or after a long conversation that touched many files.
- When helper-module work continues after a gap.
- Before a `fix` or a `publish`, when you are not sure that the work follows the conventions.
- As a periodic health check on an old module that nobody touched for a long time.

## Command Execution Rules

These rules prevent a known failure. An agent added filler lines to a command, the output budget overflowed, the call stopped, and the command did not run.

- **NEVER add `exit 0` (or other repeated filler) to a command.** Write one line, or one chain joined with `&&`. Nothing comes after it.
- **NEVER use `cd` inside the command.** Set the working directory with the tool's `Cwd` parameter. A `cd [module_root]` line below shows a *location*. It is not text to send.
- **Pipe long output through `| tail -N`** to keep the results small.
- **`// turbo`** marks a step that can run automatically (read-only or idempotent). A step without it needs normal judgment. A mutation step never runs automatically.

---

## Phase 0: Activate and Scope

1. **Declare the target.** State the modules in focus (the default is the active module). Phase 3 covers only these modules.

2. **Stop edits.** Make no source change until you present Phase 5 and the user confirms.

3. **Drop assumptions.** Write one line: "Re-grounding from files. Prior summaries are ignored until reconfirmed."

## Phase 1: Re-read the Constitution

Read the source of truth in authority order. Do not skim summaries. The details are in the full text.

1. **Read the `AGENTS.md` of this repository in full**, then `codebase-superloom/AGENTS.md`. Both are the *derived index*, not the authority.

2. **List each document**, so that you skip none:
   // turbo
   ```bash
   # Cwd = codebase-superloom
   find docs -name '*.md' | sort
   ```

3. **Read each file of the list in full.** Do not select some files. Do not skim. What a document states is the rule. The `principles/`, `languages/js/`, `ai/` and `dev/` subtrees hold the rules for code style, module structure, process and tests. Read them most carefully, but read the whole set.

4. **Read the sibling workflows of this repository again:** `.devin/workflows/js-helper-module.md` (with its embedded Standard block) and `.devin/workflows/js-helper-module-publish.md`.

5. **Output a binding-rules checklist.** It is a short list in which each rule *links back* to its document. Do not restate the rules in detail. The document is the authority.

## Phase 2: Survey Sibling Modules (derive the fingerprint from reality)

The convention is what the real, passing modules do. Get it again from them. Do not recall it.

1. **List each module:**
   // turbo
   ```bash
   # Cwd = [repo-root]
   find . -maxdepth 3 -name "package.json" -not -path "*/node_modules/*" -not -path "*/_test/*" -exec dirname {} \; | sort
   ```

2. **Put each module in a category** with `docs/languages/js/module-classes.md`. The categories are stateless singleton, stateful factory, adapter-backed factory, store adapter, vendor wrapper and client-side driver wrapper.

3. **Read one reference module of each category in full.** Read each file: `[name].js`, `[name].config.js`, `[name].errors.js`, `[name].validators.js`, `package.json`, `_test/loader.js`, `_test/package.json`, `_test/test.js`, `README.md`, `ROBOTS.md` and `docs/`.

4. **Record the convention fingerprint** that the target is compared with. It is the shape that the reference modules share: loader, file layout, package and test wiring, public surface, documentation set. Record what the modules do, as you see it in their source. Do not record what you remember.

## Phase 3: Line-by-line Self-audit of the Target Module

Read each source file from top to bottom. Then read it a second time, because formatting and structural issues often hide on a single pass. For each dimension of the audit map below, do these steps:

1. Get the concrete rule from its governing document and from the reference modules of Phase 2.
2. Audit the target against that rule.
3. Do not take a rule from memory. If you cannot show where it is written or shown, read it.
4. Record each deviation as `file:line -> rule it violates (with citation) -> corrective action`.

After the reads, run the gates (set `Cwd`, never `cd`):

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

**Step-comment conformance (manual gate).** JavaScript has no step-comment checker in lint yet, and tests and greps cannot see comments (`code-formatting.md` - Mechanical Check). Read each function body in each source `.js` file. Check ALL of these items. The source is `code-formatting.md` - Inline Step Comments Inside Functions, Mandatory Step-Comment Set for I/O Functions.

**a) Every block (each function, not only I/O):** the first logical block after the opening `{` has a step comment. Each block after a blank line has a step comment. There is no exception for short functions.

**b) Mandatory Step-Comment Set (I/O functions also):** each item of the set has a step comment. The items are the validate step, the init step, each driver or delegate call, and each success, error and early return.

**c) Every `return`:** each `return` has a step comment directly above it. This includes bare returns (`return value;`), final returns and `return null;`. A `return` inside an `if` body of one or two statements is covered by the comment of the `if`. Any other `return` without a comment is a gap.

**d) Loop and `if` bodies:** a body with more than two operations has a step comment for each operation, separated by blank lines. The comment above the loop states what the iteration does.

**e) Branch blocks:** each `if`, loop, `switch` and `try` starts its own block with its own comment. The statement after its closing brace starts a new block with its own comment.

**f) Guard after a call:** the call and the check of its result are two blocks, each with its own comment.

**g) Catch fallback:** the first comment in a `catch` states what happens instead.

The Mandatory Set is the audit floor, not the ceiling. A missing step comment is an S2 consistency finding. It becomes S1 when the block without a comment hides a correctness issue. Output the verdict line `Step-comment conformance: [clean | N gaps]`.

**Peer-dependency utilization review (manual gate, a grep cannot do it):**

- Read the `peerDependencies` of the module's `package.json`. For each peer dependency, read its `ROBOTS.md` to get the full list of function signatures.
- Read the source of the module again. Find each operation that writes again a function that a peer dependency has.
- This review finds gaps that pattern matching cannot find. Examples: a module that writes its own `Lib.Debug.performanceAuditLog`, raw `JSON.parse` with try/catch when `Lib.Utils.stringToJSON` exists, or a string reversal when `Lib.Utils.stringReverse` exists.
- Record each finding as `file:line -> peer dep function that should be used -> current inline implementation`. Output the verdict line `Peer-dep utilization: [clean | N gaps]`.

Mechanical sweep battery. Each sweep must return nothing for this module (`Cwd = [repo-root]`):

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
git grep -niE "behaviour|colour|favour|licence|optimise|optimisation|organise|organisation|initialis|standardis|serialis|authoris|analyse|centralis|normalis|recognis|synchronis|customis|specialis|catalogu" -- '[module-path]' ':!*/node_modules/*'
```
// turbo
```bash
git grep -niE "comprehensive|seamless|robust|powerful|blazing|effortless|leverage|battle-tested|cutting-edge|world-class|in order to|feel free to|please note|out of the box|a wide range of" -- '[module-path]' ':!*/node_modules/*'
```
// turbo
```bash
git grep -nE "(^|[^A-Za-z0-9_$])void [a-zA-Z_]+;|\(_[a-zA-Z]" -- '[module-path]' ':!*/node_modules/*' ':!*/_data/*'
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
git grep -nE "module\.exports|'use strict'|(^|[^A-Za-z0-9_$])require\(" -- '[module-path]' ':!*/node_modules/*' | grep -v createRequire
```
// turbo
```bash
# Relative imports must include a .js extension; each hit is a missing extension
# JSON imports (`./data/x.json' with { type: 'json' }`) correctly carry .json, so they are excluded
git grep -nE "from '\./" -- ':(glob)[module-path]/**/*.js' ':!*/node_modules/*' | grep -vE "\.js'|\.json'"
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
// turbo
```bash
# Single-import rule - must return NOTHING; validators/parts never self-import errors or data
git grep -nE "import .+ from '\./[a-z-]+\.errors(\.js)?'|import .+ from '\./data/" -- ':(glob)[module-path]/**/*.validators.js' '[module-path]/parts/*.js' ':!*/node_modules/*'
```
// turbo
```bash
# Must return NOTHING - Class F violations: self-built Lib, scope imports, LOG_LEVEL, underscore slots
git grep -nE "import .+ from 'helper-(utils|debug)'|import .+ from '@superloomdev/|LOG_LEVEL|createInterface = function \(.*_(CONFIG|ERRORS|Validators)" -- '[module-path]/*.js' ':!*/node_modules/*' ':!*/_test/*'
```
// turbo
```bash
# performanceAuditLog must never read instance['time_ms'] and never log a same-line Start
git grep -nE "performanceAuditLog\([^)]*instance\[|performanceAuditLog\('(Start|Init-Start)'" -- ':(glob)[module-path]/**/*.js' ':!*/node_modules/*'
```
// turbo
```bash
# Every remaining performanceAuditLog call is judged for ownership per the Standard
git grep -n "performanceAuditLog" -- ':(glob)[module-path]/**/*.js' ':!*/node_modules/*' ':!*/_test/*'
```

Judge the sweep hits with these rules:

- **Performance audit.** Drivers: each I/O method and the client init emit exactly one `'End'` call. Non-drivers: flag calls that time delegated helper calls. Only calls that time substantial in-process work of the module are correct. Store adapters and thin wrappers usually have zero calls.
- **Two-form rule.** The only permitted bare-name hits are URLs to a real repository path. The only permitted `@superloomdev/` hits are real `import` calls in `eslint.config.js`. Judge each hit by hand.
- **Type guards.** A `typeof` hit is a violation to change to a `Lib.Utils` primitive, or one of two permitted forms: argument-shape dispatch, or capability duck-typing.
- **Peer-dependency sweeps.** These find inline code that writes again a function of a peer dependency. Judge each hit by the type of the variable (string -> `isEmptyString`, array -> `isEmptyArray`). Also judge if the peer dependency has a wrapper for that operation.
- **JSDoc indentation.** The awk finds the `/*` column of each block, then flags each content line or closer at a different column. The column is relative to `/*`. A block at column 0 has all its content at column 0. A block at column 4 has all its content at column 4. Continuation lines (more than the `/*` column plus 4) are excluded. A grep or awk with a fixed column misses nested blocks.

**Sweep result reporting (hard gate):** for each sweep, state one of these lines:
- `[sweep name]: clean` (zero hits)
- `[sweep name]: N hits -> [file:line for each]` (with a judgment for each hit)

If a sweep returned hits and the report says "clean", the convergence failed. Paste the raw grep output into the conversation, then classify each hit. Do not skip a sweep without a word.

Before you trust a sweep with zero hits, prove that the sweep can find a violation:

1. Plant a violation in a scratch file.
2. Make sure that the sweep finds it.
3. Delete the scratch file, then run the sweep for real.

A zero-hit sweep that never found anything is not evidence. A rule that depends on the enclosing context needs a sweep that reads that context. A grep that reads one line at a time cannot enforce a rule for a block.

Stale-name and cross-reference scrub. Renamed symbols and old legacy or branding tokens are a usual sign of drift. Search for them in code, tests and docs:

// turbo
```bash
# Cwd = [repo-root] - replace [old-token] with any suspected stale token
git grep -n "[old-token]" -- 'src/**' '*.md' '*.yml'
```

### Audit Map

These are the *dimensions* to audit, each with the place where its rules live. For each dimension, do these steps. Open the source and extract its rules. Confirm them against the reference modules. Then audit the target. This workflow does not repeat the rules on purpose, because a copy here would also drift.

| Dimension | Where its rules live |
|---|---|
| Code formatting, comments, spacing | `languages/js/code-formatting.md` |
| Module structure, loader, public/private surface, exports | `languages/js/module-structure.md`, `languages/js/factory-vs-singleton.md` |
| Dependency and peer-dependency wiring | `languages/js/dependencies.md` |
| Test layout, loader, and dependency wiring | `dev/testing-local-modules.md`, `languages/js/unit-test-authoring.md`, `languages/js/module-testing.md` |
| Error handling and catalogs | `languages/js/error-handling.md` |
| Validation | `languages/js/validation.md` |
| Documentation files and their content | `principles/documentation-authoring.md`, `languages/js/module-docs.md` |
| Naming consistency (no stale or legacy tokens anywhere) | The cross-reference scrub above, and the reference modules |
| Function naming doctrine (verb catalog, return shapes, banned verbs, config key casing) | `languages/js/function-naming.md`. List each exported function, name its doctrine verb and return shape, and compare with the real return. If there is no output line, the check did not run. Exception: a React component factory is PascalCase and noun-named by framework contract |

This table is a start set, not a closed list. If the target needs a dimension that is not in the table, find its governing document and audit against it.

### Converge

Do not go to the report after a single pass. Run this phase again until **two passes in a row find zero new deviations**. If the most recent pass found issues, the run did not converge. Audit again. Convergence, not effort, is the exit condition.

## Phase 4: Diagnose Drift Root Cause

1. **Diagnose the drift.** Before the re-anchor, answer these questions briefly and honestly. The answers are the root cause. Use them in the self-improve step.
   - Did I start from a scratch, demo or experimental area with different conventions?
   - Did I bring a pattern from another codebase?
   - Which governing document did I act on without a read?
   - Did I use a summary, plan or memory in place of the source?
   - Did a rename leave stale tokens?

2. **Re-anchor the plan.** Read `__dev__/RUNBOOK.md` if it exists, then the plan that it names `CURRENT`. If there is no `RUNBOOK.md`, read the most recent plan by modification time. State the plan and the step in progress. Make sure that they still match the work in focus.
   // turbo
   ```bash
   # Cwd = project-superloom (workspace root, outside any repo)
   ls -t __dev__/plans/*.md | head -5
   ```

3. **Self-improve hook.** Give the drift diagnosis of step 1 back to the framework. The diagnosis can show a rule or failure mode that is **not yet in `docs/`**. If it does, capture it with `/learn` in the correct pitfall file **before** any fix. Then run `/finalize-docs` in `codebase-superloom`. This follows the Golden Rule, and the framework does not have to learn the lesson again.

## Phase 4.5: Creator-Diff (three-bucket drift classification)

Put each deviation of Phase 3 into exactly one of three buckets. The bucket decides the corrective action, and it shows if the deviation is a bug or an intentional choice.

### Bucket 1: Docs Drift (docs evolved, code is stale)

The code of the module matched the docs when it was written, but the docs changed after that. The code is not wrong against its original specification. It is out of date.

**How to detect:** use the git history. Find if the governing document changed after the last significant change of the module:
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

If the document changed after the module, and the deviation matches what the document said before, the deviation is Bucket 1.

**Action:** update the module to match the current docs. This is a retrofit, not a bug fix. The `/js-helper-module fix` verb does it.

### Bucket 2: Code Drift (code diverged, docs are correct)

The code of the module does not match the docs, and the code was never correct against the current or past docs. This is a real bug or a convention violation from development.

**How to detect:** the deviation matches no earlier version of the governing document, or the document did not change after the module was written. The code was wrong from the start, or a change made it wrong.

**Action:** fix the code. The `/js-helper-module fix` verb applies the correction.

### Bucket 3: Intentional Deviation (code deliberately diverges)

The module diverges from the docs on purpose, for a documented and valid reason. The deviation is a design decision, not an error.

**How to detect:** the module's `THOUGHTS.md`, a code comment or a doc section gives the reason for the deviation. The reason must be specific and current. A stale comment about a document that changed after it does not count.

**Action:** verify that the reason is still valid against the current docs. If the reason is stale, because the docs now handle the case, put the deviation in Bucket 1. If the reason is still valid, document the deviation in the module's `THOUGHTS.md` if it is not there. Mark it as acknowledged in the audit report. No code change is necessary.

### Classification Table

For each deviation, output:

| Deviation | Bucket | Evidence | Action |
|---|---|---|---|
| `file:line -> rule (citation)` | 1 / 2 / 3 | git log or comment proving the classification | retrofit / fix / acknowledge |

If you cannot classify a deviation with confidence, mark it `UNCLASSIFIED`. Examine it more before you continue.

## Phase 5: Report and Hand Off (gated)

1. **Present the audit report in the chat.** Do not write a file. Each convention that the report names carries its citation (the evidence rule). The report has these parts:
   - **Conventions re-derived:** the binding-rules checklist of Phase 1. Each line cites its document.
   - **Drift diagnosis:** the root cause of Phase 4.
   - **Deviations found:** a table of `file:line -> rule violated (with citation) -> corrective action`, grouped by audit dimension.
   - **Sweep results:** each sweep of the mechanical sweep battery with its result. The result is `clean`, or `N hits -> [file:line for each]` with a judgment for each hit.
   - **Workflow coverage classification:** for each deviation, state how the workflow caught it:
     - **workflow-caught:** the sweep battery or the step-comment gate of the workflow would catch this finding.
     - **workflow-missed:** the checks of the workflow do not cover this kind of finding. Report it as a design gap of the workflow.
     - **execution-missed:** the checks of the workflow DO cover this finding, but the agent did not report it. This is an execution error, not a design gap.
   - **Creator-diff classification:** the three-bucket table of Phase 4.5, with the bucket counts: `Bucket 1 (docs drift): N | Bucket 2 (code drift): N | Bucket 3 (intentional): N | Unclassified: N`.
   - **Gate results:** the lint and test status, and the confirmation that the audit converged (two clean passes in a row).
   - **Plan state:** the active plan and the step in progress.

2. **Do not fix automatically.** Give the corrective actions to the module workflow:
   ```
   /js-helper-module fix [module-path]
   ```
   The audit report, with the creator-diff classification, is the input to `fix`. Then `fix` can skip Phases A-B and start with the findings.

3. **STOP and ask.** Wait for explicit confirmation from the user before any source change.

---

## Verification Checklist (this run)

- [ ] Target modules declared, edits stopped
- [ ] `AGENTS.md` (both repos) read and treated as the derived index
- [ ] Each `docs/*.md` listed and read in full
- [ ] Sibling workflows read again (js-helper-module.md and js-helper-module-publish.md)
- [ ] Each module listed and categorized, one reference of each category read in full
- [ ] Fingerprint recorded
- [ ] Each target file read at least two times and audited line by line against the audit map
- [ ] Audit converged: two passes in a row with zero new deviations
- [ ] Each stated convention has a citation (doc path and section, or reference-module `file:line`)
- [ ] Lint run, tests run through a clean install
- [ ] Step-comment conformance verdict line output (all 7 sub-checks: every block, mandatory set, every return, bodies, branch blocks, guard after a call, catch fallback)
- [ ] Mechanical sweep battery run, each result reported (clean, or hits with a judgment)
- [ ] Peer-dep primitive sweeps run (stringReverse, isEmptyString/Array, isEmptyObject, inArray), each hit judged
- [ ] Peer-dep utilization review done (peerDeps and ROBOTS.md read, source compared), verdict line output
- [ ] Plan-reference sweep run (code comments must not refer to plan numbers)
- [ ] JSDoc content indentation sweep run
- [ ] Stale-name and cross-reference scrub run
- [ ] Drift root cause diagnosed, plan re-anchored, new failure modes captured with `/learn` if any
- [ ] Creator-diff: each deviation in Bucket 1, 2 or 3 (or UNCLASSIFIED with a reason)
- [ ] Bucket counts stated, evidence recorded for each classification
- [ ] Workflow coverage classification stated for each deviation (workflow-caught, workflow-missed, execution-missed)
- [ ] Report presented in the chat, fixes given to `/js-helper-module fix`, stopped for user confirmation
