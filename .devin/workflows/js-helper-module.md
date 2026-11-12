---
description: Full lifecycle for JS helper modules - create, fix (audit + apply + converge)
---

# JS Helper Module Workflow

This is the one workflow for the lifecycle of a JavaScript helper module. Each run operates on ONE module, which the invocation names.

Invoke as: `/js-helper-module [verb] [module-path]`
Example: `/js-helper-module fix [module-path]`

| Verb | What it does | Mutates files? |
|---|---|---|
| `create` | Build a new module from the archetype skeletons, then audit and fix | Yes (new module only) |
| `fix` | Audit against the embedded standard, apply every finding by hand, re-verify to convergence | Yes (this module only) |

If the verb is not clear or the module path is missing, ask. Do not guess.

**Standalone audit:** for a read-only audit that applies no changes, use `/js-helper-module-audit [module-path]` (a separate workflow). Its report can go into `fix`. Then `fix` skips the audit phase and starts with the findings.

**Publishing:** use `/js-helper-module-publish [module-path]` (a separate workflow).

`fix` is also the **retrofit verb**. When `codebase-superloom/docs/` changes a standard, run `fix` on an existing module. It audits the module again against the recompiled embedded Standard below and brings the module up to the standard. No other procedure is necessary.

## Operating Principle

> **Trust nothing in working memory.** Get each rule again from the files on disk in each run. Conversation summaries, earlier plans and memories are suspect until you confirm them against `codebase-superloom/docs/` and a real reference module. `AGENTS.md` is a derived index. `docs/` is the authority.

**Evidence rule (hard gate).** Each rule and each fix cites its source. A source is a `docs/` path and section, or a `file:line` in a reference module. A rule without a citation does not count. Read the source before you use the rule.

## Execution Contract (binding, every verb)

1. **One module per run.** Do not touch the files of a second module. The one exception is a rename sweep, and then only the exact renamed token.
2. **Phases run in order.** Do not skip, merge, reorder or parallelize them.
3. **No improvisation.** Use only the commands in this file, with `[module-path]`, `[module_root]` and `[old-token]` replaced. If no instruction matches a situation, STOP and ask.
4. **When you are not sure, STOP.** This includes a rule that is not clear, an undecided convention and an output that you cannot interpret. Report what you see and ask.
5. **No files outside the module.** Do not write scratch scripts or notes files in the repository. Plan-state updates go only to the active plan file in `__dev__/plans/`.
6. **Manual edits only.** Read the whole file, then make each change by hand with the editor tool. FORBIDDEN: one-off scripts, bulk `sed -i`/`awk`/`perl -pi` rewrites, codemods, find-and-replace in a terminal. Use terminal text tools only for read-only detection and verification. If an edit seems too repetitive to do by hand, read the file again. Do not write a script.
7. **Mark a checklist line done only after you did it in this run.**

## Command Execution Rules

- **NEVER use `cd`** inside a command. Set the tool's `Cwd` parameter. `[module_root]` is a location, not literal text.
- Write one line for each command, or one `&&` chain. Add nothing after it.
- Pipe long output through `| tail -N`.
- A sweep grep exits non-zero when it is clean. That is the pass condition. Do not chain sweep greps with `&&`. Chain them with `;` and put quotes around `echo` labels.
- `// turbo` marks a read-only or idempotent step that can run automatically. **A mutation step never runs automatically.** Registry operations, `git commit`, `git push` and publish always need explicit approval.

## The Standard (embedded; sources cited)

> Compiled from `codebase-superloom/docs/`. When these documents change, update this block in the same session (`docs/ai/workflow-authoring.md` - Embedded Content and the Compile Rule).

**Re-ground set** - the documents that Phase A reads again, in authority order:

1. `docs/principles/documentation-authoring.md` - voice, banned vocabulary, no em dashes
2. `docs/languages/js/code-formatting.md` - 3/2/1 spacing, banners, JSDoc, step comments, aliases, spelling, ESM formatting
3. `docs/languages/js/module-structure.md` + `factory-vs-singleton.md` - loader shapes, companions, archetype skeletons, ESM syntax
4. `docs/languages/js/function-naming.md` - verb catalog, return shapes, confusable pairs, banned verbs, config key casing
5. `docs/languages/js/module-docs.md` + `module-docs-complex.md` - README/ROBOTS/docs structure
6. `docs/languages/js/error-handling.md` + `validation.md` - envelopes, catalogs, validators
7. `docs/dev/testing-local-modules.md` + `docs/dev/pitfalls.md` - test contract, terminal safety
8. `docs/languages/js/unit-test-authoring.md` + `docs/languages/js/module-testing.md` - test double patterns, testing tiers, framework module testing
9. `docs/languages/js/module-classes.md` - this module's class
10. `docs/languages/js/index.md` - the two-form naming rule
11. `docs/languages/js/dependencies.md` + `publishing.md` - peer dependency contract, version ranges, registry

**Structural invariants** (each can be verified, and the source is in parentheses):

- **Loader:** the signature is `(shared_libs, config)`. `Lib` is picked **by reference** from the injected container. There is no self-built `Lib` and no module-scope singleton state in a factory (`module-structure.md`).
- **Companions:** `[name].config.js`, `[name].errors.js` and `[name].validators.js` exist, also when they are minimal. Inline ERRORS or inline config validation in the loader is a violation (`module-structure.md` - Universal Companion Files).
- **Single-import rule:** only `[name].js` imports the companions and `data/*.json`. Validators and parts get `ERRORS` and static data by injection (`module-structure.md`).
- **Interface slots:** `createInterface(Lib, CONFIG, ERRORS, Validators, [Parts,] [store|adapter|state])` has fixed slots and canonical names. An unused slot is KEPT with an eslint-disable line. It is never removed or prefixed with an underscore (`module-structure.md`).
- **Config validation:** the loader calls `Validators.validateConfig(CONFIG)`. A violation throws, because it is a programmer error (`validation.md`, `error-handling.md`).
- **Type guards** call `Lib.Utils` primitives, not raw `typeof`: `isNumber` (rejects `NaN`), `isFunction`, `isString`, `isBoolean`, `isObject` (rejects `null`), `isNullOrUndefined`. The rule applies to `[name].validators.js` and to inline guards in `[name].js`. Mixed forms in one module are a violation. Two forms stay raw `typeof`: argument-shape dispatch (`typeof key === 'object'` overload normalization) and capability duck-typing (`typeof source.subscribe === 'function'`) (`validation.md` - Use Utils Type-Check Primitives).
- **Peer-dependency primitive utilization:** a module can declare a peer dependency (Utils, Debug, Time, Money, Crypto and others). If a function of that peer dependency can do an operation, the module MUST use that function. It must not write the operation again inline. Sources: `validation.md` - Use Utils Type-Check Primitives, and `dependencies.md` - Peer Dependency Contract.
  - Type guards: `typeof` -> `Lib.Utils.isX`.
  - String operations: `.split('').reverse().join('')` -> `Lib.Utils.stringReverse`.
  - Empty checks: `.length === 0` on strings -> `Lib.Utils.isEmptyString`, on arrays -> `Lib.Utils.isEmptyArray`, `Object.keys(x).length === 0` -> `Lib.Utils.isEmptyObject`.
  - Array membership: `.indexOf(x) > -1` -> `Lib.Utils.inArray` or native `.includes()`.
  - The auditor reads the `peerDependencies` of `package.json` and the `ROBOTS.md` of each peer dependency. Then it compares each operation in the source with those functions.
  - Native ES2015+ methods (`.includes()` on arrays, `Array.isArray()`, `Object.keys()`) are permitted when the peer dependency has no wrapper for that operation.
- **React hooks:** a public React hook is a `use*` function that calls `Lib.React.useState`, `useRef` or `useEffect`. A module with a public hook is a factory with `state`, never a singleton. A pure computation module without hooks can be a singleton (`module-structure.md` - React Hook Modules Are Factories, `factory-vs-singleton.md`).
- **All modules are ESM:** each module uses `import`/`export default` with `"type": "module"` in `package.json`. The strict mode directive is implicit in ESM and must not appear. Each import path has its `.js` extension. The factory skeleton, companions, banners, spacing, JSDoc and step comments do not change (`module-structure.md`, `code-formatting.md`, `factory-vs-singleton.md`).
- **Config** holds plain data only: no live objects, no `lib_*` keys, no `LOG_LEVEL`. Drivers come through the container (`Lib.SQL`, `Lib.MongoDB`, `Lib.DynamoDB`) (`module-structure.md` - Driver injection).
- **Return envelope:** all keys on each path, data fields null on failure. Errors come from the frozen catalog. Error prefixes use the alias form `[helper-name]` (`error-handling.md`).
- **`performanceAuditLog`:** the layer that owns the work logs each interval one time. Drivers instrument their own roundtrips. Non-drivers do not log delegated I/O again. Each call passes a local `start_ms` captured at the start of the operation, never `instance['time_ms']` (`code-formatting.md` - Performance Logging, `pitfalls-migration.md`).
- **Formatting:** 3/2/1 vertical spacing. JSDoc indentation is the same as the declaration that it documents. Standard banner widths. `};` combined with END banners (`code-formatting.md`).
- **Step comments.** Sources: `code-formatting.md` - Inline Step Comments Inside Functions, Mandatory Step-Comment Set for I/O Functions. `principles/code-readability.md` - Step Comments.
  - Each logical block has a step comment. The first block after the opening `{` always has one. There is no exception for short functions.
  - Each `if`, loop, `switch` and `try` starts its own block with its own comment. The statement after its closing brace starts a new block with its own comment.
  - The guard after a call is its own block: the call under one comment, a blank line, then the `if` under its own comment.
  - Each `return` has a step comment directly above it: bare returns, envelope returns, `return null;` and final returns. A `return` inside an `if` body of one or two statements is covered by the comment of the `if`.
  - A loop or `if` body with more than two operations has a step comment for each operation, separated by blank lines.
  - The first comment in a `catch` states the fallback, not the failure.
  - Each statement that opens a block after a blank line has a comment. This includes `const start_ms = ...`, `performanceAuditLog` calls and the first `Lib.Debug.debug` call in a `catch`.
  - Each public I/O function carries the Mandatory Step-Comment Set. The set is the validate step, the init step, each driver or delegate call, and each success, error and early return. The set is the audit floor, not the ceiling.
  - JavaScript has no step-comment checker in lint yet. Step 13 of Phase D is the manual gate until the rule ships (`code-formatting.md` - Mechanical Check).
- **Naming:** the scope form (`@superloomdev/...`) and the bare form (`js-...helper-...`) appear only in `package.json` and in real repo-path URLs. The alias form is used in all other places, including H1s, banners and error messages (`languages/js/index.md` - Two-Form Rule).
- **`package.json`:** peer dependencies use caret ranges. Each Superloom module consumed at runtime is in `peerDependencies` with a caret range (`^1.0.0`), also a module received only by injection through `shared_libs`. A framework peer such as `react` or `react-native` uses `>=`, because the host owns the version. `engines.node >= 24`. `publishConfig.registry` is exactly `https://npm.pkg.github.com` (`dependencies.md`, `publishing.md`).
- **`_test/package.json`:** `"private": true`. The ONLY `file:` dependency is this module (`file:../`). Shared helpers use registry semver ranges pinned to the version that the code calls (`docs/dev/pitfalls.md` entries 8, 11).
- **Tests:** `_test/loader.js` is the only file that reads `process.env`. Test names are `should [behavior] when [condition]`, with one `describe` for each function (`unit-test-authoring.md`). An assertion pins an exact value, never a range or a disjunction that more than one behavior can satisfy. Fix a nondeterministic setup, not the assertion (`principles/testing.md` - Test Structure and Naming).
- **Four test double patterns:**
  - `memory-store`: a working storage contract in RAM.
  - `stub-adapter`: a stateless recorder of outbound calls.
  - `engine-stub`: an in-process platform engine.
  - `emitter-stub`: a fake that you can subscribe to, with test-side emit and listener-count hooks.
  - A module can use more than one. Use `emitter-stub` for change subscriptions, so the tests exercise the listener lifecycle (`unit-test-authoring.md` - Test Double Patterns).
- **Docs:** the docs set for each class comes from `module-docs-complex.md`. The README has no signatures, config tables or install commands. `ROBOTS.md` is compiled LAST, and its signatures are the same as in `docs/api.md` (`module-docs.md`).
- **Root Markdown** is `README.md` and `ROBOTS.md` only, plus an unpublished `THOUGHTS.md` (`module-docs.md`).

---

## Verb: create

1. **Class first.** Find the class of the module in `docs/languages/js/module-classes.md`, and its directory in the module directory structure of the repository. State both. If the class is not clear, STOP and ask.
2. **Re-ground** (Phase A below) for the class.
3. **Generate from the skeleton.** Open the class skeleton in `docs/languages/js/module-structure.md` and build each file from it. The files are the entry, the three companions, `package.json`, the `_test/` set and the docs set for the class. Copy `eslint.config.js` and `.npmignore` from `js-helper-utils`. Do not generate from memory. Do not copy a sibling.
4. **Adapter-backed, extension, and driver-wrapper lifecycles:**
   - A feature module comes first, with an in-memory store (`_test/memory-store.js`). Publish it before the adapters. Add the adapters one at a time against the shared contract suite.
   - An extension comes after its parent. It imports the parent. Its entry file is `extension.js`.
   - A Class C driver wrapper is a client-side or RN-tier module that wraps a platform engine. It ships with an engine stub in `_test/` that implements the native interface of the engine. Examples: `_test/web-storage-stub.js`, `_test/mmkv-stub.js`. The test loader injects the engine through `shared_libs`. The module never imports it directly (`module-testing.md` - Framework Module Testing).
5. **Register environment variables** (if there are any) in `docs/dev/.env.dev.example`, `.env.integration.example` and the workspace `__dev__/.env.*` files.
6. **Run Phases A-E of the `fix` verb** on the new module. A new module gets the same audit as an old one. Then STOP and present. Publishing is a separate workflow: `/js-helper-module-publish`.

## Verb: fix

`fix` runs Phases A through E. If the conversation has an audit report from `/js-helper-module-audit`, you can skip Phases A and B. The report gives the re-grounding and the gap list. Start at Phase C with the findings of the report.

### Phase A - Re-ground

1. Declare the target module and its class. Write one line: "Re-grounding from files. Prior summaries are ignored until reconfirmed."
2. Read the **Re-ground set** (embedded Standard above) again for the class of this module.
   **Proof-of-read (hard gate):** for each document, quote ONE rule verbatim with its section, read from disk in THIS run. If there are no quotes, Phase A is not done.
   **Registry search:** search `docs/languages/js/conventions-registry.md` for each name, config key and return field that this module introduces. Record the row numbers that you examined. If the author cannot name these rows, the step is not done.
3. Get the fingerprint again. Read the class skeleton of this module in `module-structure.md` verbatim. Then read one clean reference module of the same class in full (`s3`, `dynamodb`, `verify`, `verify-store-*`, `styler`, never `utils`). If the skeleton and the reference disagree, STOP and report. Do not select one without a word.
4. Output a binding-rules checklist. Each line cites its source.

### Phase B - Audit

1. List each file, and keep the listing as a checklist for each file:
   // turbo
   ```bash
   # Cwd = [repo-root]
   find [module-path] -type f -not -path '*/node_modules/*' -not -name 'package-lock.json' | sort
   ```
2. **Read each file in full, two times.** Formatting and structural issues hide on the first pass. Do not use offsets, summaries or search hits in place of a full read.
   **Read-evidence table (hard gate):** output `file | lines | pass 1 | pass 2 | one pass-2-only observation` for each file. The observation must be one that a grep cannot find. If there is no table, Phase C cannot start.
3. **Skeleton conformance diff:** compare the entry file element by element with the class skeleton. Compare these elements:
   - the info banner, the loader statement groups AND their step comments, the companion wiring
   - the validators loader signature `(Lib, ERRORS)`, the `createInterface` slots, the section banners
   - the function bodies The worked body of the skeleton is normative for comment density. Record each mismatch.
4. **Verb doctrine check:**
   - List each exported function name. For each name, give the doctrine verb that it uses and the return shape that the doctrine gives that verb (`function-naming.md`). Then compare it with the real return.
   - Output one line for each function: `functionName | verb | doctrine return shape | actual return shape | verdict`. If there is no output line, the check did not run.
   - Also check these items. No banned verbs (`construct`, `deconstruct`, `read`, `ensure`, `transform`). No `xToY` conversion names. No verb in the middle of a name. No noun-first names.
   - Config keys are `SCREAMING_SNAKE_CASE` (data) or `PascalCase` (injected live objects only).
   - Exception: a React component factory is PascalCase and noun-named by framework contract, because JSX needs a capitalized identifier. The verb rule applies to exported functions that are not components (`function-naming.md` - The Rule).
5. Assemble the gap list as `file:line -> rule (citation) -> action`. Group it in this order: S1 correctness, S2 consistency, S3 cosmetic, mechanical sweeps, docs, naming. Mark an item without a citation as `VERIFY`, and read the source before you act.
6. **Audit report output.** Output the report: binding rules, read-evidence table, gap list with citations, and the verdict line `Audit verdict: [clean | N findings]`. A later `fix` run can skip Phases A-B only with a report in this shape, from this workflow or from `/js-helper-module-audit`.

### Phase C - Apply (order is binding)

1. Fix S1 correctness, then S2 consistency, then S3 cosmetic. Code comes first.
2. Mechanical sweeps: em dashes to ` - `. Unicode arrows in `.js` files to `->`. British to American spelling. Remove banned vocabulary. Remove `void identifier;` and `_param` patterns (put an eslint-disable-line on the signature instead). Remove `docs/` paths from code comments.
3. Naming (two-form rule): change each scope or bare-name reference outside `package.json` to the alias. Before you edit `_test` strings, make sure that no test asserts on the old token.
4. Documentation in compile order: `README.md` -> `docs/api.md` -> `docs/configuration.md` -> `docs/schemas.md` (if the module has validators) -> class extras -> **`ROBOTS.md` LAST**.
5. Config and root hygiene: keep only the keys that the code reads, each with a one-line reason. The root Markdown set is exact.
6. **Rename discipline:** when you rename a public identifier, sweep all internal callers across the repository in the same pass:
   // turbo
   ```bash
   # Cwd = [repo-root]
   git grep -n "[old-token]" -- 'src/**' '*.md' '*.yml'
   ```

### Phase D - Verify to Convergence

Run all checks. A finding returns to Phase C. Then the ENTIRE phase runs again. Exit only after **two full passes in a row with zero new findings**.

1. Lint (must exit 0):
   // turbo
   ```bash
   # Cwd = [module_root]
   npm run lint 2>&1 | tail -20
   ```
2. Tests through a clean install (all must pass). This is the fresh-install gate of the Pre-Commit Protocol (`codebase-superloom/docs/dev/testing-local-modules.md` - Pre-Commit Protocol). It is mandatory in each run. An E409 from the registry is transient. Wait 30 to 60 seconds and run it again. Do not use `--legacy-peer-deps`:
   // turbo
   ```bash
   # Cwd = [module_root]/_test
   rm -rf node_modules package-lock.json && npm install && npm test 2>&1 | tail -40
   ```
3. Sweep battery. Each sweep must return nothing for this module (`Cwd = [repo-root]`):
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
   The last two sweeps enforce the two-form rule. The only permitted bare-name hits are URLs to a real repository path. Judge each hit by hand.
   **Sweep result reporting (hard gate):** for each sweep, state one of these lines:
   - `[sweep name]: clean` (zero hits)
   - `[sweep name]: N hits -> [file:line for each]` (with a judgment for each hit)

   If a sweep returned hits and the report says "clean", the convergence failed. Paste the raw grep output into the conversation, then classify each hit. Do not skip a sweep without a word.
4. JSDoc content indentation. The sweep must print nothing. `eslint --fix` does NOT fix comment indentation.
   - The JSDoc content (description text, `@param`, `@return`, notes and the closing `*****/`) must be at the same column as the `/*` delimiter.
   - The column is relative to the `/*` column. A JSDoc block at column 0 has all its content at column 0. A block nested at column 4 has all its content at column 4.
   - Leave continuation lines as they are. These are lines indented more than the `/*` column plus 4, for alignment.
   - A grep or awk with a fixed column misses nested blocks. The awk below finds the `/*` column of each block, then flags content or a closer at a different column.
   // turbo
   ```bash
   # JSDoc content indentation - ALL lines inside /*...*/ blocks must be at the same column as /*
   find [module-path] -name "*.js" -not -path "*/node_modules/*" -exec awk '
   /\/\*{8,}/ { match($0,/^ */); jsdoc_col=RLENGTH; in_jsdoc=1; next }
   in_jsdoc && /\*{8,}\// { match($0,/^ */); c=RLENGTH; if(c!=jsdoc_col) print FILENAME":"NR": CLOSER col "c" (should be "jsdoc_col")"; in_jsdoc=0; next }
   in_jsdoc && /[^ ]/ { match($0,/^ */); c=RLENGTH; if(c!=jsdoc_col && c<=jsdoc_col+4) print FILENAME":"NR": CONTENT col "c" (should be "jsdoc_col")" }
   ' {} +
   ```
   For each hit, move the content line or the closer to the `/*` column. The fix awk moves all content and closers to the `/*` column:
   ```bash
   awk '
   /\/\*{8,}/ { match($0,/^ */); jsdoc_col=RLENGTH; in_jsdoc=1; print; next }
   in_jsdoc && /\*{8,}\// { match($0,/^ */); c=RLENGTH; if(c!=jsdoc_col){sub(/^ */,"");i="";for(j=0;j<jsdoc_col;j++)i=i" ";print i$0}else{print}; in_jsdoc=0; next }
   in_jsdoc && /[^ ]/ { match($0,/^ */); c=RLENGTH; if(c!=jsdoc_col&&c<=jsdoc_col+4){sub(/^ */,"");i="";for(j=0;j<jsdoc_col;j++)i=i" ";print i$0}else{print}; next }
   { print }
   ' [file] > [file].tmp && mv [file].tmp [file]
   ```
   Run the sweep again until it prints nothing.
5. Performance-audit checks. The first sweep must print nothing. Then judge the remaining calls against the Standard:
   // turbo
   ```bash
   git grep -nE "performanceAuditLog\([^)]*instance\[|performanceAuditLog\('(Start|Init-Start)'" -- ':(glob)[module-path]/**/*.js' ':!*/node_modules/*'
   ```
   // turbo
   ```bash
   git grep -n "performanceAuditLog" -- ':(glob)[module-path]/**/*.js' ':!*/node_modules/*' ':!*/_test/*'
   ```
   Drivers: each I/O method and the client init emit exactly one `'End'` call. Non-drivers: delete calls that time delegated helper calls. Keep only calls that time substantial in-process work of the module itself. Store adapters and thin wrappers usually have zero calls.
6. Companion and injection checks:
   // turbo
   ```bash
   # All three companions must exist (Cwd = [repo-root])
   ls [module-path] | grep -E "\.(config|errors|validators)\.js$"
   ```
   // turbo
   ```bash
   # Must return NOTHING - validators/parts never self-import errors or data
   git grep -nE "import .+ from '\./[a-z-]+\.errors(\.js)?'|import .+ from '\./data/" -- ':(glob)[module-path]/**/*.validators.js' '[module-path]/parts/*.js' ':!*/node_modules/*'
   ```
   // turbo
   ```bash
   # Must return NOTHING - Class F violations: self-built Lib, scope imports, LOG_LEVEL, underscore slots
   git grep -nE "import .+ from 'helper-(utils|debug)'|import .+ from '@superloomdev/|LOG_LEVEL|createInterface = function \(.*_(CONFIG|ERRORS|Validators)" -- '[module-path]/*.js' ':!*/node_modules/*' ':!*/_test/*'
   ```
7. Type-guard primitives. Judge each hit. Do not clear a hit automatically:
   // turbo
   ```bash
   # Cwd = [repo-root]
   git grep -nE "typeof [^ ]+ (!==|===) '(number|function|string|boolean|object)'" -- '[module-path]/*.js' ':!*/node_modules/*'
   ```
   - A hit is a violation to change to the `Lib.Utils` primitive (`isNumber`, `isFunction`, `isString`, `isBoolean`, `isObject`), or one of two permitted forms.
   - The permitted forms are argument-shape dispatch in an overload normalizer, and capability duck-typing on a collaborator that the host supplies.
   - Record the verdict for each hit. A module that mixes primitive calls and raw guards for the same kind of check is a violation, also when each hit looks correct alone.
   - Do not add character classes with escaped brackets to this pattern. In a POSIX bracket expression, a backslash is literal. So `[A-Za-z_.\[\]']` ends early and matches nothing, without an error.
8. Peer-dependency primitive utilization. Judge each hit of each sweep:
   // turbo
   ```bash
   # .split('').reverse().join('') should use Lib.Utils.stringReverse
   git grep -n "\.split('').reverse().join('')" -- ':(glob)[module-path]/**/*.js' ':!*/node_modules/*' ':!*/_data/*'
   ```
   // turbo
   ```bash
   # .length === 0 / > 0 / !== 0 on strings -> Lib.Utils.isEmptyString; on arrays -> Lib.Utils.isEmptyArray
   # Judge each hit by the variable type: string -> isEmptyString, array -> isEmptyArray
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
   # .indexOf(x) > -1 or .indexOf(x) !== -1 should use Lib.Utils.inArray or native .includes()
   git grep -nE "\.indexOf\([^)]+\) (>|<)=? -1" -- ':(glob)[module-path]/**/*.js' ':!*/node_modules/*' ':!*/_data/*' ':!*/_test/*'
   ```
   A hit is a violation to change to the primitive of the peer dependency, or a permitted form. For example, `.includes()` on a string is `String.prototype.includes`, not array membership. Record the verdict for each hit.
9. **Peer-dependency utilization review (manual gate, a grep cannot do it):**
   - Read the `peerDependencies` of the module's `package.json`. For each peer dependency, read its `ROBOTS.md` to get the full list of function signatures.
   - Read the source of the module again. Find each operation that writes again a function that a peer dependency has.
   - Record each finding as `file:line -> peer dep function that should be used -> current inline implementation`.
   - This review finds gaps that pattern matching cannot find. Examples: a module that writes its own `Lib.Debug.performanceAuditLog`, or raw `JSON.parse` with try/catch when `Lib.Utils.stringToJSON` exists.
   - The reply MUST contain `Peer-dep utilization: [clean | N gaps -> fixed]`.
10. `file:` rule:
    // turbo
    ```bash
    # Cwd = [module_root]/_test
    grep -n "file:" package.json
    ```
11. ESM conformance. Each check must return nothing (`Cwd = [repo-root]`):
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
12. **No `_data/` directory (hard gate).** The `_data/` directory is not a recognized archetype. Generated data lives in `data/` as pure JSON. Dev scripts live in `scripts/` (`module-structure.md` - Dev Scripts).
    // turbo
    ```bash
    # Cwd = [repo-root]
    find '[module-path]' -type d -name "_data" -not -path "*/node_modules/*"
    ```
    The command must return nothing. If it returns a result, migrate the module: generated data to `data/*.json`, scripts to `scripts/*.js`.
13. **Step-comment conformance (hard gate).** Read each function body in each source `.js` file. Check ALL of these items against the Standard. The source is `code-formatting.md` - Inline Step Comments Inside Functions, Mandatory Step-Comment Set for I/O Functions.

    **a) Every block (each function, not only I/O):** the first logical block after the opening `{` has a step comment. Each block after a blank line has a step comment. There is no exception for short functions.

    **b) Mandatory Step-Comment Set (I/O functions also):** each item of the set has a step comment. The items are the validate step, the init step, each driver or delegate call, and each success, error and early return.

    **c) Every `return`:** each `return` has a step comment directly above it. This includes bare returns (`return value;`), final returns and `return null;`. A `return` inside an `if` body of one or two statements is covered by the comment of the `if`. Any other `return` without a comment is a gap.

    **d) Loop and `if` bodies:** a body with more than two operations has a step comment for each operation, separated by blank lines. The comment above the loop states what the iteration does.

    **e) Branch blocks:** each `if`, loop, `switch` and `try` starts its own block with its own comment. The statement after its closing brace starts a new block with its own comment.

    **f) Guard after a call:** the call and the check of its result are two blocks, each with its own comment.

    **g) Catch fallback:** the first comment in a `catch` states what happens instead.

    The Mandatory Set is the audit floor, not the ceiling. JavaScript has no step-comment checker in lint yet, so this check is manual. The reply MUST contain `Step-comment conformance: [clean | N gaps -> fixed]`.
14. **Skeleton conformance re-diff (hard gate).** Open the class skeleton again next to the entry file. Verify again element by element, including the function bodies against the worked body of the skeleton. The reply MUST contain `Skeleton conformance: [clean | N mismatches -> fixed]`.
15. **Manual checks** (a grep cannot do them): table cells have no period at the end. The README has no signatures, config tables or install commands. Compare three `ROBOTS.md` signatures with `docs/api.md`.
16. State the convergence explicitly: "Pass N found zero new findings. The previous pass was also clean. Converged." This statement is valid ONLY with the Phase B read-evidence table and the conformance verdicts in this conversation.

### Phase E - Present (approval gate, never skip)

1. Start with the **Per-run Verification Checklist** (at the end of this file). Tick each line or mark it `SKIPPED: [reason]`. Each tick points at its evidence in this conversation.
2. Overview:
   // turbo
   ```bash
   # Cwd = [repo-root]
   git status --short -- [module-path]; git diff --stat -- [module-path]
   ```
3. Write a grouped change report in the reply: `file -> what changed -> why (citation)`. The groups are S1, S2, S3, sweeps, docs, naming. Write each item that you did NOT change on purpose, and why.
4. **STOP.** Ask: "These are all changes for [name]. Approve to proceed?" If the user asks for changes, apply them by hand, run ALL of Phase D again, and present again.

## Loop-backs

- A Phase D check fails: go to Phase C, then run ALL of Phase D again. The convergence count resets.
- The user asks for changes at Phase E: apply them by hand, run all of Phase D, then Phase E again.
- A convention is undecided: STOP and ask. After the decision, record it in `docs/` and update the embedded Standard of this file in the same session.

## Self-Improvement (every run, last step)

This run can show a failure mode or a gap in the standard or in this workflow. If it does, do these steps in this order:

1. Journal it with `/learn` in the correct pitfall file BEFORE you continue.
2. Run `/finalize-docs` in `codebase-superloom`.
3. Change the embedded Standard or the checks of this file, so that the next run benefits.
4. Update the active plan in `__dev__/plans/` and STOP. Do not continue to another module automatically.

## Per-run Verification Checklist

- [ ] Verb, target module and class declared, assumptions dropped
- [ ] Re-ground set read again with verbatim proof-of-read quotes, fingerprint from skeleton and clean sibling
- [ ] Each file listed and read in full two times, read-evidence table output
- [ ] Gap list built, each line cited (audit verdict line output)
- [ ] All edits by hand: zero scripts, zero bulk rewrites
- [ ] Fixes applied S1 -> S2 -> S3 -> sweeps -> docs (ROBOTS last) -> naming, renames swept across the repository
- [ ] Lint exit 0, clean-install tests pass (fresh install in each run)
- [ ] Sweep battery clean, each result reported (clean, or hits with a judgment), plan-reference sweep run
- [ ] JSDoc awk silent, performance-audit ownership judged
- [ ] Companions exist, single-import holds, fixed interface slots kept
- [ ] Type-guard sweep run, each `typeof` hit judged as a violation or a permitted form
- [ ] Peer-dep primitive sweeps run (stringReverse, isEmptyString/Array, `=== ''` / `!== ''`, isEmptyObject, inArray), each hit judged
- [ ] Peer-dep utilization review done (peerDeps and ROBOTS.md read, source compared), verdict line output
- [ ] ESM conformance sweeps clean (CJS remnants, `.js` extensions, `main` without `exports`, `scripts/` module type)
- [ ] Skeleton conformance verdict line output
- [ ] Step-comment conformance verdict line output (all 7 sub-checks: every block, mandatory set, every return, bodies, branch blocks, guard after a call, catch fallback)
- [ ] `file:` rule holds
- [ ] No `_data/` directory (generated data in `data/*.json`, scripts in `scripts/`)
- [ ] Converged: two clean passes in a row, stated with evidence
- [ ] Phase E report presented, explicit user approval before any mutation
- [ ] New failure modes journaled, embedded Standard changed if needed, plan updated, STOPPED
