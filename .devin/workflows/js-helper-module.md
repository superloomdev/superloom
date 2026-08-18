---
description: Full lifecycle for JS helper modules - create, fix (audit + apply + converge)
---

# JS Helper Module Workflow

The one workflow for the lifecycle of a JavaScript helper module. It operates on exactly ONE module per run, named in the invocation.

Invoke as: `/js-helper-module [verb] [module-path]`
Example: `/js-helper-module fix [module-path]`

| Verb | What it does | Mutates files? |
|---|---|---|
| `create` | Build a new module from the archetype skeletons, then audit and fix | Yes (new module only) |
| `fix` | Audit against the embedded standard, apply every finding by hand, re-verify to convergence | Yes (this module only) |

Ambiguous verb or missing module path: ask, never guess.

**Standalone audit:** for a read-only audit without applying changes, use `/js-helper-module-audit [module-path]` (separate workflow). Its report can be fed into `fix` to skip the audit phase and go straight to applying findings.

**Publishing:** use `/js-helper-module-publish [module-path]` (separate workflow).

`fix` is also the **retrofit verb**: when `codebase-superloom/docs/` changes a standard, running `fix` on an existing module re-audits it against the recompiled embedded Standard below and brings it up to spec. No separate procedure exists or is needed.

## Operating Principle

> **Trust nothing in working memory.** Re-derive every rule from files on disk, every run. Conversation summaries, prior plans, and memories are suspect until reconfirmed against `codebase-superloom/docs/` and a real reference module. `AGENTS.md` is a derived index; `docs/` is the authority.

**Evidence rule (hard gate).** Every rule asserted and every fix made cites its source: a `docs/` path plus section, or a reference-module `file:line`. An uncited rule does not count; read the source before relying on it.

## Execution Contract (binding, every verb)

1. **One module per run.** Never touch a second module's files, except during a rename sweep and then only the exact renamed token.
2. **Phases run in order.** Never skip, merge, reorder, or parallelize them.
3. **No improvisation.** Use only the commands written here (substituting `[module-path]` / `[module_root]` / `[old-token]`). A situation with no matching instruction means STOP and ask.
4. **When uncertain, STOP.** An ambiguous rule, an undecided convention, an uninterpretable output: report exactly what is seen and ask.
5. **No files outside the module** - no scratch scripts, no notes files anywhere in the repo. Plan-state updates go only to the active plan file in `__dev__/plans/`.
6. **Manual edits only.** Every content change is made by hand with the editor tool after reading the whole file. FORBIDDEN: one-off scripts, bulk `sed -i`/`awk`/`perl -pi` rewrites, codemods, any terminal find-and-replace. Terminal text tools are for read-only detection and verification only. If an edit feels too repetitive to do by hand, that is the signal to re-read the file, not to script it.
7. **Never mark a checklist line done without having performed it in this run.**

## Command Execution Rules

- **NEVER use `cd`** inside a command; set the tool's `Cwd` parameter. `[module_root]` denotes location, not literal text.
- One line per command, or a single `&&` chain. Nothing appended after it.
- Pipe long output through `| tail -N`.
- Sweep greps exit non-zero when clean (that is the pass condition). Never `&&`-chain sweep greps; chain with `;` and quote any `echo` labels.
- `// turbo` marks read-only or idempotent steps safe to auto-run. **No mutation step is ever auto-run**: registry operations, `git commit`, `git push`, and publish always require explicit approval.

## The Standard (embedded; sources cited)

> Compiled from `codebase-superloom/docs/`. When these documents change, this block is updated in the same session (`docs/ai/workflow-authoring.md` - Embedded Content and the Compile Rule).

**Re-ground set** - the documents re-read in Phase A, authority order:

1. `docs/principles/documentation-authoring.md` - voice, banned vocabulary, no em dashes
2. `docs/languages/js/code-formatting.md` - 3/2/1 spacing, banners, JSDoc, step comments, aliases, spelling, ESM formatting
3. `docs/languages/js/module-structure.md` + `factory-vs-singleton.md` - loader shapes, companions, archetype skeletons, ESM variant
4. `docs/languages/js/module-docs.md` + `module-docs-complex.md` - README/ROBOTS/docs structure
5. `docs/languages/js/error-handling.md` + `validation.md` - envelopes, catalogs, validators
6. `docs/dev/testing-local-modules.md` + `docs/dev/pitfalls.md` - test contract, terminal safety
7. `docs/languages/js/unit-test-authoring.md` + `docs/languages/js/module-testing.md` - test double patterns, testing tiers, framework module testing
8. `docs/languages/js/module-classes.md` - this module's class
9. `docs/languages/js/index.md` - the two-form naming rule

**Structural invariants** (each verifiable; source in parentheses):

- Loader signature `(shared_libs, config)`; `Lib` picked **by reference** from the injected container; no self-built Lib, no module-scope singleton state in factories (`module-structure.md`)
- Companions `[name].config.js`, `[name].errors.js`, `[name].validators.js` exist even when minimal; inline ERRORS or inline config validation in the loader is a violation (`module-structure.md` - Universal Companion Files)
- **Single-require rule:** only `[name].js` requires the companions and `data/*.json`; validators and parts receive `ERRORS` and static data by injection (`module-structure.md`)
- `createInterface(Lib, CONFIG, ERRORS, Validators, [Parts,] [store|adapter|state])` - fixed slots, canonical names, unused slots KEPT with an eslint-disable line, never removed or underscore-prefixed (`module-structure.md`)
- Loader calls `Validators.validateConfig(CONFIG)`; violations throw (programmer error) (`validation.md`, `error-handling.md`)
- Type guards call `Lib.Utils` primitives, never raw `typeof`: `isNumber` (rejects `NaN`), `isFunction`, `isString`, `isBoolean`, `isObject` (rejects `null`), `isNullOrUndefined`; binds `[name].validators.js` and inline guards in `[name].js` equally, and mixed forms inside one module are a violation. Argument-shape dispatch (`typeof key === 'object'` overload normalization) and capability duck-typing (`typeof source.subscribe === 'function'`) stay raw `typeof` (`validation.md` - Use Utils Type-Check Primitives)
- **Peer-dependency primitive utilization:** when a module declares a peer dependency (Utils, Debug, Time, Money, Crypto, etc.), every operation in the module that can be done by a function in that peer dep MUST use the peer dep function instead of reimplementing it inline. This binds equally to type guards (`typeof` -> `Lib.Utils.isX`), string operations (`.split('').reverse().join('')` -> `Lib.Utils.stringReverse`), empty checks (`.length === 0` on strings -> `Lib.Utils.isEmptyString`, on arrays -> `Lib.Utils.isEmptyArray`, `Object.keys(x).length === 0` -> `Lib.Utils.isEmptyObject`), array membership (`.indexOf(x) > -1` -> `Lib.Utils.inArray` or native `.includes()`), and any other reimplemented logic. The auditor reads the module's `package.json` peerDependencies, reads each peer dep's `ROBOTS.md` for its function signatures, and cross-references every operation in the source. Native ES2015+ methods (`.includes()` on arrays, `Array.isArray()`, `Object.keys()`) are permitted when the peer dep does not offer a wrapper for that specific operation (`validation.md` - Use Utils Type-Check Primitives; `dependencies.md` - Peer Dependency Contract)
- A module whose public surface includes a React hook (`use*` calling `Lib.React.useState`, `useRef`, or `useEffect`) is a factory with `state`, never a singleton; hook-free pure computation modules stay eligible for the singleton pattern (`module-structure.md` - React Hook Modules Are Factories; `factory-vs-singleton.md`)
- **ESM variant:** a module consumed via bundler (Vite, Metro, webpack) may use `import`/`export default` with `"type": "module"` in `package.json` instead of `require`/`module.exports`; omit `'use strict'` (implicit in ESM); include `.js` extensions in import paths. The factory skeleton, companions, banners, spacing, JSDoc, and step comments are unchanged. Choose ESM when tree-shaking matters or a peer requires it; CommonJS for Node.js-direct consumers. The choice is per-module (`module-structure.md` - ESM Variant; `code-formatting.md` - ESM Formatting; `factory-vs-singleton.md` - ESM Syntax Variant)
- Config carries plain data only - no live objects, no `lib_*` keys, no `LOG_LEVEL`; drivers arrive via the container (`Lib.SQL`, `Lib.MongoDB`, `Lib.DynamoDB`) (`module-structure.md` - Driver injection)
- Return envelope: all keys on every path, data fields null on failure; errors from the frozen catalog; error prefixes use the alias form `[helper-name]` (`error-handling.md`)
- `performanceAuditLog`: each interval logged once by the layer that owns the work; drivers instrument their own roundtrips; non-drivers never re-log delegated I/O; every call passes a local `start_ms` captured at operation entry, never `instance['time_ms']` (`code-formatting.md` - Performance Logging; `pitfalls-migration.md`)
- Formatting: 3/2/1 vertical spacing; step comment above every logical block; the first logical block after the opening `{` always gets a step comment, no exceptions for short functions; every `return` statement gets a preceding step comment (bare returns, envelope returns, `return null`, final returns - all included); every public I/O function carries the Mandatory Step-Comment Set - validate step, init step, each driver or delegate call, every success return, every error return, every early-return branch (`code-formatting.md` - Comment Style); the Mandatory Set is the audit floor, not the ceiling - blocks outside the set still follow the universal every-logical-block rule; a loop body is not one block - once it carries more than two operations, each gets its own step comment separated by a blank line; JSDoc indentation matches the declaration it documents; standard banner widths; `};` combined with END banners (`code-formatting.md`)
- Naming: scope form (`@superloomdev/...`) and bare form (`js-...helper-...`) only in `package.json` and real repo-path URLs; alias form everywhere else including H1s, banners, error messages (`languages/js/index.md` - Two-Form Rule)
- `package.json`: peer deps as caret ranges; every Superloom module consumed at runtime (including modules received only by injection through `shared_libs`) appears in `peerDependencies` with caret ranges; `engines.node >= 24`; `publishConfig.registry` exactly `https://npm.pkg.github.com` (`dependencies.md`, `publishing.md`)
- `_test/package.json`: `"private": true`; the ONLY `file:` dependency is this module (`file:../`); shared helpers use registry semver ranges pinned to the version the code calls (`docs/dev/pitfalls.md` entries 8, 11)
- `_test/loader.js` is the only file reading `process.env`; tests named `should [behavior] when [condition]`; one `describe` per function (`unit-test-authoring.md`); assertions pin exact values - never a range or disjunction multiple behaviors could satisfy; fix nondeterministic setup, not the assertion (`principles/testing.md` - Test Structure and Naming); three test double patterns - `memory-store` (Fake: full working storage contract backed by RAM), `stub-adapter` (Stub: minimal stateless adapter contract), `engine-stub` (Engine Fake: minimal in-process implementation of a platform engine's native interface, e.g. Web Storage or MMKV) - not mutually exclusive, a module may use several (`unit-test-authoring.md` - Test Double Patterns)
- Docs set per class from `module-docs-complex.md`; README carries no signatures, config tables, or install commands; `ROBOTS.md` compiled LAST and matching `docs/api.md` signatures exactly (`module-docs.md`)
- Root Markdown = `README.md` + `ROBOTS.md` (+ unpublished `THOUGHTS.md`) only (`module-docs.md`)

---

## Verb: create

1. **Class first.** Determine the module's class from `docs/languages/js/module-classes.md` and its directory from the repo's module directory structure. State both. If the class is ambiguous, STOP and ask.
2. **Re-ground** (Phase A below) scoped to the class.
3. **Generate from the skeleton.** Open the class skeleton in `docs/languages/js/module-structure.md` and build every file from it: entry, three companions, `package.json`, `eslint.config.js` and `.npmignore` (copy from `js-helper-utils`), `_test/` set, docs set per class. Never generate from memory or by copying a sibling.
4. **Adapter-backed, extension, and driver-wrapper lifecycles.** Feature module first with an in-memory store (`_test/memory-store.js`), published before adapters; adapters one at a time against the shared contract suite. Extensions after the parent, importing the parent, entry file `extension.js`. Class C driver wrappers (client-side or RN-tier modules wrapping a platform engine) ship with an engine stub in `_test/` implementing the engine's native interface (e.g. `_test/web-storage-stub.js`, `_test/mmkv-stub.js`); the engine is injected through `shared_libs` in the test loader, never imported directly in the module (`module-testing.md` - Framework Module Testing)
5. **Register environment variables** (if any) in `docs/dev/.env.dev.example`, `.env.integration.example`, and the workspace `__dev__/.env.*` files.
6. **Run the `fix` verb Phases A-E** on the new module (a new module gets the same audit as an old one), then STOP and present. Publishing is a separate workflow: `/js-helper-module-publish`.

## Verb: fix

`fix` runs Phases A through E. If an audit report from `/js-helper-module-audit` is available in the conversation, Phase A and B may be skipped (the report provides the re-grounding and gap list); start at Phase C with the report's findings.

### Phase A - Re-ground

1. Declare the target module and its class. Write one line: "Re-grounding from files; ignoring prior summaries until reconfirmed."
2. Re-read the **Re-ground set** (embedded Standard above) for this module's class.
   **Proof-of-read (hard gate):** for each document, quote ONE rule verbatim with its section, read from disk THIS run. No quotes, no Phase A.
3. Re-derive the fingerprint: read this module's class skeleton in `module-structure.md` verbatim, then one clean same-class reference module in full (`s3`, `dynamodb`, `verify`, `verify-store-*`, `styler` - never `utils`). If skeleton and reference disagree, STOP and report; do not pick one silently.
4. Output a binding-rules checklist, every line citing its source.

### Phase B - Audit

1. Enumerate every file; keep the listing as a per-file checklist:
   // turbo
   ```bash
   # Cwd = [repo-root]
   find [module-path] -type f -not -path '*/node_modules/*' -not -name 'package-lock.json' | sort
   ```
2. **Read every file in full, twice.** Formatting and structural issues hide on pass 1. Never rely on offsets, summaries, or search hits as a substitute.
   **Read-evidence table (hard gate):** output `file | lines | pass 1 | pass 2 | one pass-2-only observation` per file. The observation must be something a grep cannot find. No table, no Phase C.
3. **Skeleton conformance diff:** compare the entry file element by element against the class skeleton - info banner, loader statement groups AND their step comments, companion wiring, validators loader signature `(Lib, ERRORS)`, `createInterface` slots, section banners, and function bodies (the skeleton's worked body is normative for comment density). Record every mismatch.
4. Assemble the gap list as `file:line -> rule (citation) -> action`, grouped: S1 correctness -> S2 consistency -> S3 cosmetic -> mechanical sweeps -> docs -> naming. Mark anything uncitable as `VERIFY` and read the source before acting.
5. **Audit report output.** Output the report: binding rules, read-evidence table, gap list with citations, and the verdict line `Audit verdict: [clean | N findings]`. A report in this shape (whether produced here or by `/js-helper-module-audit`) is what allows a subsequent `fix` run to skip Phases A-B.

### Phase C - Apply (order is binding)

1. S1 correctness, then S2 consistency, then S3 cosmetic - code first.
2. Mechanical sweeps: em-dashes to ` - `; `.js` Unicode arrows to `->`; British to American spelling; banned vocabulary out; `void identifier;` and `_param` patterns out (eslint-disable-line on the signature instead); `docs/` paths out of code comments.
3. Naming (two-form rule): every scope or bare-name reference outside `package.json` converted to the alias. Before editing `_test` strings, confirm tests do not assert on the old token.
4. Documentation in compile order: `README.md` -> `docs/api.md` -> `docs/configuration.md` -> `docs/schemas.md` (if validators) -> class extras -> **`ROBOTS.md` LAST**.
5. Config and root hygiene: only keys the code reads, each with a one-line reason; root Markdown set exact.
6. **Rename discipline:** on any public identifier rename, sweep all internal callers across the repo in the same pass:
   // turbo
   ```bash
   # Cwd = [repo-root]
   git grep -n "[old-token]" -- 'src/**' '*.md' '*.yml'
   ```

### Phase D - Verify to Convergence

Run everything. Any finding returns to Phase C, then the ENTIRE phase re-runs. Exit only after **two consecutive full passes with zero new findings**.

1. Lint (must exit 0):
   // turbo
   ```bash
   # Cwd = [module_root]
   npm run lint 2>&1 | tail -20
   ```
2. Tests via clean install (all green; E409 from the registry is transient - wait 30-60s and re-run; never `--legacy-peer-deps`). This is the Pre-Commit Protocol fresh-install gate (`codebase-superloom/docs/dev/testing-local-modules.md` - Pre-Commit Protocol). It is mandatory every run, not just during refactoring:
   // turbo
   ```bash
   # Cwd = [module_root]/_test
   rm -rf node_modules package-lock.json && npm install && npm test 2>&1 | tail -40
   ```
3. Sweep battery (each must return nothing for this module; `Cwd = [repo-root]`):
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
   The last two enforce the two-form rule; sole permitted bare-name hits are URLs addressing a real repo path - judge each manually.
   **Sweep result reporting (hard gate):** For each sweep, state one of:
   - `[sweep name]: clean` (zero hits)
   - `[sweep name]: N hits -> [file:line for each]` (with judgment per hit)

   A sweep that returned hits but is reported as "clean" is a convergence failure. Paste the raw grep output into the conversation, then classify each hit. Sweeps may not be silently skipped.
4. JSDoc content indentation (must print nothing; `eslint --fix` does NOT fix comment indentation). JSDoc content (description text, `@param`, `@return`, notes) must be flush-left: 0 spaces from the `/*` column. No leading spaces on any line between `/*` and `*/`. A simple grep for `^    @param` is insufficient because it misses description prose lines that do not start with `@`. The awk below tracks `/*...*/` block context and catches ANY line indented 4 spaces inside a JSDoc block.
   // turbo
   ```bash
   # JSDoc content indentation - ALL lines inside /*...*/ blocks must be flush-left
   # The awk tracks JSDoc block context: enters on /****, exits on ****/, flags any line starting with exactly 4 spaces inside
   find [module-path] -name "*.js" -not -path "*/node_modules/*" -exec awk '
   /\/\*{8,}/ { in_jsdoc=1 }
   in_jsdoc && /^    [^ ]/ && !/\/\*{8,}/ && !/\*{8,}\// { print FILENAME":"NR": "$0 }
   /\*{8,}\// { in_jsdoc=0 }
   ' {} +
   ```
   On any hit: remove the 4-space prefix from every indented line inside the ENTIRE JSDoc block, re-run until silent.
5. Performance-audit checks (must print nothing, then judge remaining calls per the Standard):
   // turbo
   ```bash
   git grep -nE "performanceAuditLog\([^)]*instance\[|performanceAuditLog\('(Start|Init-Start)'" -- ':(glob)[module-path]/**/*.js' ':!*/node_modules/*'
   ```
   // turbo
   ```bash
   git grep -n "performanceAuditLog" -- ':(glob)[module-path]/**/*.js' ':!*/node_modules/*' ':!*/_test/*'
   ```
   Drivers: every I/O method and client init emits exactly one `'End'` call. Non-drivers: delete calls timing delegated helper calls; keep only calls timing the module's own substantial in-process work. Expected for store adapters and thin wrappers: zero calls.
6. Companion and injection checks:
   // turbo
   ```bash
   # All three companions must exist (Cwd = [repo-root])
   ls [module-path] | grep -E "\.(config|errors|validators)\.js$"
   ```
   // turbo
   ```bash
   # Must return NOTHING - validators/parts never self-require errors or data
   git grep -nE "require\('\./[a-z-]+\.errors'\)|require\('\./data/" -- ':(glob)[module-path]/**/*.validators.js' '[module-path]/parts/*.js' ':!*/node_modules/*'
   ```
   // turbo
   ```bash
   # Must return NOTHING - Class F violations: self-built Lib, scope requires, LOG_LEVEL, underscore slots
   git grep -nE "require\('helper-(utils|debug)'\)\(|require\('@superloomdev/|LOG_LEVEL|createInterface = function \(.*_(CONFIG|ERRORS|Validators)" -- '[module-path]/*.js' ':!*/node_modules/*' ':!*/_test/*'
   ```
7. Type-guard primitives (every hit is judged, not auto-cleared):
   // turbo
   ```bash
   # Cwd = [repo-root]
   git grep -nE "typeof [^ ]+ (!==|===) '(number|function|string|boolean|object)'" -- '[module-path]/*.js' ':!*/node_modules/*'
   ```
   Each hit is either a violation to convert to the `Lib.Utils` primitive (`isNumber`, `isFunction`, `isString`, `isBoolean`, `isObject`), or one of the two permitted forms: argument-shape dispatch in an overload normalizer, or capability duck-typing on a host-supplied collaborator. Record the verdict per hit; a module mixing primitive calls and raw guards for the same kind of check is a violation even when each hit looks locally defensible. Do not add character classes with escaped brackets to this pattern - inside a POSIX bracket expression a backslash is literal, so `[A-Za-z_.\[\]']` terminates early and silently matches nothing.
8. Peer-dependency primitive utilization (each sweep judges every hit):
   // turbo
   ```bash
   # .split('').reverse().join('') should use Lib.Utils.stringReverse
   git grep -n "\.split('').reverse().join('')" -- ':(glob)[module-path]/**/*.js' ':!*/node_modules/*' ':!*/_data/*'
   ```
   // turbo
   ```bash
   # .length === 0 on strings -> Lib.Utils.isEmptyString; on arrays -> Lib.Utils.isEmptyArray
   # Judge each hit by the variable type: string -> isEmptyString, array -> isEmptyArray
   git grep -n "\.length === 0" -- ':(glob)[module-path]/**/*.js' ':!*/node_modules/*' ':!*/_data/*' ':!*/_test/*'
   ```
   // turbo
   ```bash
   # Object.keys(x).length === 0 should use Lib.Utils.isEmptyObject
   git grep -nE "Object\.keys\([^)]+\)\.length === 0" -- ':(glob)[module-path]/**/*.js' ':!*/node_modules/*' ':!*/_data/*'
   ```
   // turbo
   ```bash
   # .indexOf(x) > -1 or .indexOf(x) !== -1 should use Lib.Utils.inArray or native .includes()
   git grep -nE "\.indexOf\([^)]+\) (>|<)=? -1" -- ':(glob)[module-path]/**/*.js' ':!*/node_modules/*' ':!*/_data/*' ':!*/_test/*'
   ```
   Each hit is either a violation to convert to the peer dep primitive, or a permitted form (e.g. `.includes()` on strings is `String.prototype.includes`, not array membership). Record the verdict per hit.
9. **Peer-dependency utilization review (manual gate - not greppable):** Read the module's `package.json` peerDependencies. For each peer dep, read its `ROBOTS.md` to get the full function signature list. Then re-read the module's source code and check: is any operation reimplementing a function that's available in a peer dep? Record findings as `file:line -> peer dep function that should be used -> current inline implementation`. This catches gaps that pattern-matching cannot (e.g. a module reimplementing `Lib.Debug.performanceAuditLog` manually, or using raw `JSON.parse` with try/catch when `Lib.Utils.stringToJSON` exists). The reply MUST contain `Peer-dep utilization: [clean | N gaps -> fixed]`.
10. `file:` rule:
    // turbo
    ```bash
    # Cwd = [module_root]/_test
    grep -n "file:" package.json
    ```
11. **No `_data/` directory (hard gate).** The `_data/` directory is not a recognized archetype. Generated data lives in `data/` as pure JSON; dev scripts live in `scripts/`. See `module-structure.md` - Dev Scripts.
    // turbo
    ```bash
    # Cwd = [repo-root]
    find '[module-path]' -type d -name "_data" -not -path "*/node_modules/*"
    ```
    Must return nothing. If it returns a result, the module must be migrated: generated data to `data/*.json`, scripts to `scripts/*.js`.
12. **Step-comment conformance (hard gate).** Read every function body in every source `.js` file and check ALL of the following:

   **a) Universal rule (every function, not just I/O):** The first logical block after the opening `{` has a step comment. Every subsequent logical block separated by a blank line also has a step comment. No exceptions for short functions - even a single-block function gets its opening step comment. (`code-formatting.md` - Inline Step Comments Inside Functions, lines 546-551)

   **b) Mandatory Step-Comment Set (I/O functions additionally):** validate step, init step, each driver or delegate call, every success return, every error return, every early-return branch - each preceded by a step comment. (`code-formatting.md` - Mandatory Step-Comment Set for I/O Functions, lines 606-613)

   **c) Every `return` statement:** Every `return` in the function has a preceding step comment - including bare returns (`return value;`), final returns (the last `return { success: true, ... }` in a function), and `return null;` at the end of a function. A return without a preceding comment is a gap regardless of whether it looks like a "success" or "error" return.

   **d) Loop bodies:** A loop body carrying more than two operations gets a step comment per operation, separated by blank lines. The comment above the loop states what the iteration accomplishes; the comments inside cover each operation. (`code-formatting.md` - Inline Step Comments Inside Functions, line 553)

   The Mandatory Set is the audit floor, not the ceiling: blocks outside the set still follow the universal rule. Lint, tests, and sweeps cannot see comments; this check is manual. The reply MUST contain `Step-comment conformance: [clean | N gaps -> fixed]`.
13. **Skeleton conformance re-diff (hard gate).** Re-open the class skeleton beside the entry file; re-verify element by element, including function bodies against the skeleton's worked body. The reply MUST contain `Skeleton conformance: [clean | N mismatches -> fixed]`.
14. **Manual checks** (not greppable): table cells without trailing periods; README free of signatures/config tables/install commands; three `ROBOTS.md` signatures spot-checked against `docs/api.md`.
15. State convergence explicitly: "Pass N found zero new findings; previous pass also clean - converged." Valid ONLY with the Phase B read-evidence table and the conformance verdict present in this conversation.

### Phase E - Present (approval gate, never skip)

1. Open with the **Per-run Verification Checklist** (bottom of this file), every line ticked or marked `SKIPPED: [reason]`, each tick pointing at its evidence in this conversation.
2. Overview:
   // turbo
   ```bash
   # Cwd = [repo-root]
   git status --short -- [module-path]; git diff --stat -- [module-path]
   ```
3. Grouped change report in the reply: `file -> what changed -> why (citation)`, grouped S1 -> S2 -> S3 -> sweeps -> docs -> naming. Note anything intentionally NOT changed and why.
4. **STOP.** Ask: "These are all changes for [name]. Approve to proceed?" On requested changes: apply by hand, re-run ALL of Phase D, re-present.

## Loop-backs

- Any Phase D check fails -> Phase C, then ALL of Phase D again (convergence resets).
- User requests changes at Phase E -> apply by hand, all of Phase D, Phase E again.
- A genuinely undecided convention -> STOP and ask; once resolved, record it in `docs/` and update this file's embedded Standard in the same session.

## Self-Improvement (every run, last step)

If this run exposed a failure mode or a gap in the standard or in this workflow: journal it (`/learn` into the correct pitfall file) BEFORE moving on, run `/finalize-docs` in `codebase-superloom`, and amend this file's embedded Standard or checks so the next run benefits. Then update the active plan in `__dev__/plans/` and STOP - never auto-continue to another module.

## Per-run Verification Checklist

- [ ] Verb + target module + class declared; assumptions dropped
- [ ] Re-ground set re-read with verbatim proof-of-read quotes; fingerprint from skeleton + clean sibling
- [ ] Every file enumerated and read in full twice; read-evidence table output
- [ ] Gap list built, every line cited (audit verdict line output)
- [ ] All edits by hand - zero scripts, zero bulk rewrites
- [ ] Fixes applied S1 -> S2 -> S3 -> sweeps -> docs (ROBOTS last) -> naming; renames swept repo-wide
- [ ] Lint exit 0; clean-install tests green (Pre-Commit Protocol: fresh install mandatory every run)
- [ ] Sweep battery clean (each sweep result reported explicitly: clean or hits with judgment); plan-reference sweep run; JSDoc awk silent; performance-audit ownership judged
- [ ] Companions exist; single-require holds; fixed interface slots kept
- [ ] Type-guard sweep run; every `typeof` hit judged as violation or permitted form
- [ ] Peer-dep primitive utilization sweeps run (stringReverse, isEmptyString/Array, isEmptyObject, inArray); every hit judged
- [ ] Peer-dep utilization review done (read peerDeps + ROBOTS.md, cross-reference source); verdict line output
- [ ] Skeleton conformance verdict line output
- [ ] Step-comment conformance verdict line output (all 4 sub-checks: universal rule, mandatory set, every return, loop bodies)
- [ ] `file:` rule holds
- [ ] No `_data/` directory (generated data in `data/*.json`, scripts in `scripts/`)
- [ ] Converged: two consecutive clean passes, stated with evidence
- [ ] Phase E report presented; explicit user approval before any mutation
- [ ] New failure modes journaled; embedded Standard amended if needed; plan updated; STOPPED
