# Superloom - AI Assistant Configuration

> ## GOLDEN RULE - READ FIRST
>
> **AGENTS.md is a derived, compact summary of `docs/`. Never edit AGENTS.md directly.**
>
> This is the workspace's only `AGENTS.md`. Dependent repositories do not copy or symlink it.
>
> To change a rule:
> 1. Update the source-of-truth file in `docs/` (`principles/`, `languages/js/`, `ai/`, `dev/`, `ops/`)
> 2. Run `/finalize-docs` to validate and propagate into the canonical AGENTS.md
>
> Bypassing this causes drift: AGENTS.md asserts things `docs/` no longer says. No exceptions; even one-word fixes go through `docs/` first.
>
> When discovering a new failure mode, journal it in the correct pitfall file BEFORE fixing:
> - `docs/dev/pitfalls.md` - terminal, CI, and testing failures
> - `docs/languages/js/pitfalls-migration.md` - module migration failures
>
> This file has a size budget: target 300 lines, hard ceiling 400 (`docs/ai/agent-configuration.md`). Content that would breach it moves to docs or workflows.

## Persona

Assist developers working on **Superloom**, a modular application framework and engineering reference built to run anywhere. Currently implemented in JavaScript. Backend runs on Docker (Express) and AWS Lambda; frontend documented (RNW/Expo stack). The architecture is language-independent; other languages are future expansions.

## Tech Stack

- **Language:** JavaScript (Node.js 24+) | **Server:** Express (Docker), AWS Lambda (Serverless Framework, per-entity)
- **Testing:** `node --test` + `node:assert/strict` | **Linting:** ESLint 10+ flat config via shared `@superloomdev/js-helper-eslint-config`
- **Registry:** GitHub Packages (`@superloomdev` scope) | **Commits:** Conventional Commits | **Versioning:** SemVer
- **GitHub:** [github.com/superloomdev/superloom](https://github.com/superloomdev/superloom) | MIT License

## Documentation Map

Three layers under `docs/` (superloom repo). Full index: `docs/README.md`.

| Layer | Holds | Key files |
|---|---|---|
| `docs/principles/` | Universal rules + reasoning | `engineering-philosophy`, `code-readability`, `file-archetypes`, `module-design`, `composition-and-adapters`, `error-handling`, `validation`, `testing`, `documentation-authoring`, `project-management`, `extending-to-a-language` |
| `docs/languages/js/` | The JavaScript way (complete, self-sufficient) | `index` (reading path + two-form naming), `code-formatting`, `module-structure` (all skeletons), `function-naming` (verb catalog + return shapes), `module-classes`, `composition-and-adapters`, `error-handling`, `validation`, `module-docs`, `dependencies`, `publishing`, `conventions-registry`, `server/`, `client/` (architecture, loader, theming, fonts, components, super-app, modules, RN environment setup, Expo guide, RN testing), `versioning/` |
| `docs/ai/` | AI-assisted development standards | `agent-configuration`, `workflow-authoring`, `workflow-archetypes`, `model-tiering` |

## AI Behavior Rules

- **At session start:** read `__dev__/RUNBOOK.md` first (if it exists), then `PROGRESS.md`, then `ESCALATIONS.md`, then the plan named `CURRENT`. Never select a plan by mtime when a `RUNBOOK.md` exists. Use `/plan` for transitions. Full rules: `docs/dev/planning.md`
- Read a module's `README.md` before modifying it; **read `ROBOTS.md` before calling any module's functions** (compact signature reference)
- Always run tests before returning: `npm install && npm test` from the module's `_test/` directory
- **Two-pass check after any refactor touching 3+ functions:** Pass 1 logic + lint; Pass 2 re-read the full file (step comments, 3/2/1 spacing, banner widths, multi-line return objects, `};` combined with END banners, JSDoc indentation matching declarations), lint again. See `docs/languages/js/pitfalls-migration.md`
- **Skeleton conformance diff after any structural pass:** compare the module entry file element by element against its class skeleton in `docs/languages/js/module-structure.md`, including function bodies - the skeleton's worked body is normative for comment density. Fix lists, lint, and grep sweeps do not catch a missing step comment
- **Step-comment conformance on every function body:** each public I/O function carries the Mandatory Step-Comment Set (validate, init, driver calls, success returns, error returns, early-return branches); enforced at check time by the build/audit verify gates, never assumed from generation. A loop body is not one block - once it carries more than two operations, each gets its own step comment separated by a blank line. See `docs/languages/js/code-formatting.md` - Comment Style
- **Type guards call `Lib.Utils` primitives, never raw `typeof`:** `isNumber` (rejects `NaN`), `isFunction`, `isString`, `isBoolean`, `isObject` (rejects `null`), `isNullOrUndefined`; the rule binds `[module].validators.js` and inline guards in `[module].js` equally, and mixed forms inside one module are a violation. Argument-shape dispatch and capability duck-typing stay raw `typeof`. See `docs/languages/js/validation.md` - Use Utils Type-Check Primitives
- **Identifier wire format:** prefer a parse that cannot be ambiguous over a constraint on the caller's data. Fixed-width right-anchored parsing allows any character in the leading segment. For composite internal keys, use `\u001F` (ASCII Unit Separator), a non-printable control character that cannot appear in any human-readable identifier, instead of a printable character that requires a caller-facing constraint. See `docs/languages/js/validation.md` - Identifier Format and Wire Parsing
- **Three error categories, three disposals:** programmer error (bad arguments, misconfiguration) throws `TypeError` synchronously; operational error from a helper returns `{ success: false, error: { type, message } }`; domain error returns `{ success: false, error: { code, message, status } }` from `[entity].errors.js`. The heuristic: could perfectly-written calling code still hit this at runtime - no means throw, yes means envelope. **Wrapper purity:** the module's own catalog owns the envelope; driver/SDK codes and wording never leak through `type` or `message` (log them at debug instead), and catalogs stay coarse (`DATABASE_QUERY_FAILED`, not `23505`). Services must translate a helper envelope into their own domain error before returning to a controller. See `docs/languages/js/error-handling.md`
- **Assertions pin exact values:** never a range or disjunction multiple behaviors could satisfy; nondeterministic setup gets fixed, not the assertion. See `docs/principles/testing.md` - Test Structure and Naming
- **Test double patterns:** four named patterns cover every injected dependency: `memory-store` (storage contract fake), `stub-adapter` (outbound call recorder), `engine-stub` (native engine fake), `emitter-stub` (subscription surface with test-side `_emit` and `_listenerCount`). Use `emitter-stub` when the injected API exposes `addEventListener` or change subscriptions; static stubs cannot exercise subscription lifecycle. See `docs/languages/js/unit-test-authoring.md` - Test Double Patterns
- **Application-tier repos must have an offline test suite:** every application repo ships a `_test/` directory that builds `Lib` through the real loader with stub adapters and renders shared components with `react-test-renderer`. The test tier is a host, never rebuilds the container. See `docs/languages/js/testing-strategy.md` - Rules
- **`performanceAuditLog`:** every call passes a local `start_ms` captured at operation entry (never `instance['time_ms']`, never a same-line timestamp); each interval logged once by the layer that owns the work - drivers (`nosql-*`, `sql-*`, `queue-*`, `storage-*`, `http`) instrument their own roundtrips; non-drivers never re-log delegated I/O
- **Two-form naming:** scope (`@superloomdev/...`) and bare (`js-...helper-...`) forms only in `package.json` and real repo-path URLs; the alias (`helper-...`) everywhere else. See `docs/languages/js/index.md`
- **Function naming doctrine:** every exported function begins with a verb from the catalog in `docs/languages/js/function-naming.md`. The verb determines the return shape: `is`/`has` return bare Boolean (bad input throws `TypeError`); `get` returns bare when it cannot fail, envelope when it can; `build`/`create`/`generate` return the artifact directly; mutators return an envelope when they touch a persistent store. Banned verbs: `construct`, `deconstruct`, `read`, `ensure`, `transform`, and `xToY` conversion names. Config keys are `SCREAMING_SNAKE_CASE` (data) or `PascalCase` (injected live objects only). Exception: React component factories are PascalCase and noun-named by framework contract; the verb rule applies to non-component exported functions
- **Before inventing, search the settled conventions registry:** when a module needs a name, config key, return shape, or testing approach that another module has already solved, it adopts that answer. A module never ships a second answer to a settled question; "the old one is wrong" is a reason to run a migration, not a license to diverge. See `docs/principles/engineering-philosophy.md` - Before Inventing, Search
- **Reserved vocabulary:** when a widely-standardized term exists for a concept, the framework does not reuse that term for a different concept. `scope` is reserved for OAuth permission sets (RFC 6749); use `tenant_id` for the isolation boundary and `namespace` for a composite-key segment with no domain meaning. See `docs/principles/engineering-philosophy.md` - Reserved Vocabulary
- **Peer dependencies declare the full runtime contract:** every Superloom module consumed at runtime, including modules received only by injection through `shared_libs`, appears in `peerDependencies` with caret ranges (`^1.0.0`); a framework peer such as `react` or `react-native` uses `>=` because the host owns the version; the module's own `ROBOTS.md` and `[module]/docs/configuration.md` peer lists must match `package.json` exactly. See `docs/languages/js/dependencies.md`
- Module lifecycle operations (create, fix, audit, publish) go through the workflow family (`/js-helper-module`, `/js-helper-module-audit`, `/js-helper-module-publish`) - do not improvise the procedure
- Use `/learn` to capture new knowledge; run `/finalize-docs` after any docs change (validates to convergence, then propagates to the canonical AGENTS.md and embedded workflow blocks)
- **Documentation never references plans or workflows.** Plans are ephemeral; plan numbers go stale. Documents never cite plan numbers, keep planned-module rosters, or defer to workflows - catalogs list shipped modules as reference examples only. See `docs/principles/documentation-authoring.md`
- Use Plan Mode for complex, multi-step, or risky changes; when stuck, attempt workarounds before asking; reuse existing terminals
- **Client module naming taxonomy:** runtime-tier prefixes (`js-helper-*`, `js-server-helper-*`, `js-client-helper-*`), framework-tier prefixes (`js-react-helper-*`, `js-rw-helper-*`, `js-rn-helper-*`, `js-rnw-helper-*`), suffixes (`-ext-[framework]`, `-store-[backend]`, `-adapter-[name]`, `-template-[name]`); a module takes the lowest tier whose dependency budget it fits. `js-rn-helper-*` and `js-rnw-helper-*` do not require React when the module wraps a platform native module or SDK (e.g. `react-native-mmkv`, `expo-sqlite`); the tier is earned by the platform dependency, not the framework dependency. Dev-tooling packages (`js-helper-eslint-config`) carry the `js-helper-*` prefix but are devDependency-only, excluded from peer dependency contracts. Class I (standalone framework module) versus Class G+H (pure core plus extension) decided by the [decision test](docs/languages/js/client/client-modules.md#pure-core-with-extensions-or-a-single-framework-module). See `docs/languages/js/client/client-modules.md`
- **RNW component libraries always consume the `native` theme projection:** `buildTheme(template, layers, 'native')` on every platform including web. RNW is itself the web projection; requesting `web` applies two projections and yields unit strings that React Native cannot consume on iOS or Android. See `docs/languages/js/client/theming.md` - Theme Projection for RNW
- **Scheme versus variant:** a scheme is a complete token set that replaces the base outright; a variant is a partial overlay merged on top. The two have different runtime operations, replace versus overlay. A partial overlay cannot express "use a different design language"; a complete set applied as an overlay silently inherits whatever the base held. Switch schemes for a different visual system, apply a variant for a small adjustment. See `docs/languages/js/client/theming.md` - Scheme Versus Variant
- **Font manifest style entries carry a real asset source:** registering an entry without one is an error - the platform loads a font that does not exist and text falls back with no signal. A platform whose adapter has no native loader keeps an empty manifest and relies on the platform's own font mechanism. See `docs/languages/js/client/fonts.md` - Manifest Style Entries
- **Component accessibility uses `aria-*` props, never `accessibilityState`:** state and value semantics go through the `a11y` translator (`a11y.state()`, `a11y.value()`, `a11y.relation()`, `a11y.position()`); `accessibilityState`, `accessibilityValue`, `accessibilityViewIsModal`, `importantForAccessibility`, and `AccessibilityInfo.announceForAccessibility` are silent no-ops on web. `accessibilityRole` and `accessibilityLabel` remain correct and are passed directly. See `docs/languages/js/client/components.md` - Accessibility Contract
- **Theme token contract:** a themed component library requires its full semantic token set at build time; the build function validates the set and fails fast, naming every absent token in one error. No component source contains a color literal; a hardcoded fallback makes an incomplete theme look complete while silently substituting the library's own design decisions. See `docs/languages/js/client/components.md` - Theme Token Contract
- **Named barrel exports:** a public barrel exposes named exports and no default export, so a bundler can tree-shake unused components and consumers import an explicit surface. The package root and any registration barrel export named bindings only. See `docs/languages/js/client/components.md` - Named Barrel
- **React hook modules are factories, never singletons:** any `use*` function calling `Lib.React.useState`, `useRef`, or `useEffect` forces the factory pattern with `state`, because the per-consumer state a hook binds into rendering cannot be shared; hook-free pure computation modules (`js-client-helper-crypto`) stay eligible for the singleton pattern. See `docs/languages/js/module-structure.md` - React Hook Modules Are Factories
- **Injected slots are named for the capability, never the vendor:** `shared_libs.Fonts` and `shared_libs.KeyValueStore` are correct; `shared_libs.ExpoFont` and `shared_libs.MMKV` are not. A vendor-named slot re-couples the module to that vendor through its own source text even though no import exists, which defeats the reason the dependency was injected. The rule binds module code, test loaders, host manifests, and doc examples equally. See `docs/languages/js/module-structure.md` - Class I Framework Module Deltas, `docs/principles/composition-and-adapters.md` - Naming
- **Repository independence:** the constitution repo (superloom) never references dependent repos' workflows or internals; dependent repos reference superloom docs freely. See `docs/ai/agent-configuration.md` - Repository Independence
- **Docs prose mechanics:** no em dashes (use comma, period, or ` - `); American English (`initialize`, `behavior`, `license`); table cells are fragments with no trailing periods; one term per concept, no synonym rotation; banned vocabulary list in `docs/principles/documentation-authoring.md` - Banned Vocabulary. See `docs/principles/documentation-authoring.md` - Prose Mechanics
- **`docs/data-model.md` states key field meanings:** every module's data-model page states what its key fields mean in terms that do not conflict with another module's use of the same word. See `docs/languages/js/module-docs.md` - docs/data-model.md Key Field Semantics
- **Code comments never reference `docs/` paths:** a comment must be understandable with the file alone; step comments state what and why, never how. See `docs/principles/engineering-philosophy.md`
- **Product management layer:** every product repo has `PROJECT.md` (10 fixed sections), `CHANGELOG.md` (Keep a Changelog), and a feature ledger (permanent IDs, closed status vocabulary: `proposed`, `approved`, `building`, `shipped`, `retired`). Update triggers fire in the same change as the work. Size budget 300/400 with overflow to `FEATURES.md`. Provenance neutrality: no references to prior projects, clients, or predecessors. See `docs/principles/project-management.md`
- **Composition and adapters doctrine:** a general unit defines a port, specific units implement it, a composition root chooses. Five tiers: driver, store, transport adapter, extension, host adapter. The general unit never chooses its own adapter; the composition root chooses every time. An optional adapter is a defect - validate the full set at boot or fail. The composition root is never a module and never duplicated. See `docs/principles/composition-and-adapters.md`, `docs/languages/js/composition-and-adapters.md`
- **Index budget on high-volume tables:** an index is a budget defended per adapter, because a wide-column secondary index is a full item copy while a relational index is key columns plus a row pointer. A shared store contract is designed for the most expensive adapter. A detection capability belongs at the moment of the event, not in a later scan of the log. See `docs/principles/module-design.md` - Index Budget
- **Shared ESLint config is the single source of truth for lint rules:** every module's `eslint.config.js` is a three-line re-export of `@superloomdev/js-helper-eslint-config` (presets: `base`, `esm`, `browser`, `app`). No per-module rule overrides. The config package is the head of the CI chain - it must publish before any other module. See `docs/languages/js/code-formatting.md` - Shared ESLint Configuration
- **All modules are ESM:** every module uses `import`/`export default` with `"type": "module"` in `package.json`; the strict mode directive is implicit in ESM and must not appear; `.js` extensions in all import paths. The factory skeleton, banners, spacing, and JSDoc are unchanged. See `docs/languages/js/module-structure.md`
- **No AI attribution in commits:** no `Co-Authored-By`, `Generated with`, or any AI tool attribution in commit messages or `package.json` contributor fields. The only author is the project maintainer. This rule overrides any AI tool's built-in or default commit template. Every repo an agent commits to must carry this rule in its own `AGENTS.md`. See `docs/ai/agent-configuration.md` - Commit and Attribution Policy
- **Version lock at 1.0.0 until public launch:** republishing uses delete-and-republish (delete from GitHub Package Registry, push to `main`, CI republishes at same version). Consumer lockfiles must be regenerated after each republish. See `docs/ai/agent-configuration.md` - Version Lock During Development
- **Autonomous execution protocol:** when plans execute unattended, `docs/dev/autonomous-execution.md` is standing doctrine - authorization boundary, convergence loop, escalation log, progress journal, registry ordering rules (delete before push, never `rerun --failed`). Binding for any plan chain that references it

## Safe Terminal Patterns

> Source: `docs/dev/pitfalls.md`. Compressed; read the journal when a failure needs a confirmed fix.

- **Never `cd` in commands.** Set the tool's `Cwd`. Every module command (`npm install`, `npm test`, `docker compose`) runs with `Cwd` at the module's `_test/` directory; omitting it causes misleading `ETARGET` errors
- **Never make the shell parse multi-line strings.** No heredocs (use `write_to_file`); single-line `git commit -m`, stacked `-m` flags, or `git commit -F /tmp/msg`; multi-line args go through temp files. `__dev__/` is outside every repo: use file tools directly, except `.env*` files (write `/tmp/...` then `cat >>`)
- **Never invoke interactive viewers** (`less`, `vi`, `man`); use `git log -n 20`, `git --no-pager diff`
- **Long-runners** (`node server.js`, `tail -f`, compose logs): non-blocking with a small wait, poll status, stop at task end
- **Module testing contract: `npm test` is self-contained.** `pretest`/`posttest` own the full Docker lifecycle (`pretest` runs `docker compose down -v` first). Never start containers manually before `npm test`. See `docs/dev/testing-local-modules.md`
- **Pre-publish gate:** before bumping `version` and pushing to `main`: `npm run lint` exit 0 from the module root AND clean-install tests green from `_test/`. See pitfalls entry 13
- **`file:` rule:** in `_test/package.json`, only the module under test is `file:../`. Shared helpers use registry semver ranges, pinned to the version the code calls (`^1.1.0` if the code uses a 1.1.0 API). See pitfalls entries 8 and 11
- **CI chained publishes:** every `publish-*` job overrides transitive `success()` with `!cancelled() &&` plus explicit `needs['test-x'].result == 'success'`; `contains()` checks on detect outputs use `fromJSON()` for exact array matching; a test job whose `_test/` installs another in-repo package from the registry chains after that package's `publish-*` job, never its `test-*` job. Shapes and reasoning: pitfalls entries 11, 18, and 23, `docs/dev/cicd-publishing.md`
- **Publish guards compare content, not version presence.** Both the detect gate and each `publish-*` job compare the `npm pack` shasum against the registry's `dist.shasum`: match skips, differ fails with "delete the version first", absent publishes. A version-presence skip turns a forgotten delete into a green run that ships nothing. A version appearing in the registry listing is not proof the new content shipped, so post-publish verification compares shasums too; never bump the version to clear a mismatch. See `docs/dev/cicd-publishing.md` - The Publish Guard Compares Content, Not Version Presence, pitfalls entry 26
- **AWS SDK in tests needs dummy credentials** (`AWS_ACCESS_KEY_ID=local AWS_SECRET_ACCESS_KEY=local AWS_REGION=us-east-1` in the test script) or the SDK walks the EC2 metadata chain at 1-2s per call
- **Prove a new sweep grep fires before trusting it.** Empty output means pass only after the pattern has been shown to produce a hit on a known violation; a backslash is literal inside a POSIX bracket expression, so a class like `[A-Za-z\[\]']` closes early and silently matches nothing. Prefer negated classes (`[^ ]+`). Pitfalls entry S6
- **Auto-run only read-only or idempotent commands.** Never auto-run `rm -rf`, force pushes, volume removals, publishes, or any state mutation, regardless of prior approvals
- **VitePress crashes on bare angle-bracket placeholders** in `docs/` prose (parsed as Vue elements; the reported line is far from the culprit). Use `[name]` in prose; ` ```text ` fences for copy-paste templates; build the site locally after touching rendered files. Pitfalls entry 15
- **E409 / checksum mismatch from GitHub Packages** is transient: wait 30-60s, clean install again; never `--legacy-peer-deps` (entry 21). After deleting and republishing a package at the same version, every consuming lock file must be regenerated: `rm -rf node_modules package-lock.json && npm install` (entry 24). A shared devDependency like `js-helper-eslint-config` must be the head of the CI chain so downstream `npm ci` does not race its republish (entry 25)
- **Never report a gate as passed without running it.** A validation workflow is complete only when its steps individually ran and each produced its required evidence; name the commands and file reads behind every count. A green website build is not evidence for link, terminology, or rule-mirroring passes. Pitfalls entries V1 and V3
- **Never invent a mapping to close a finding.** Read the destination and confirm the content is present before asserting a derived-artifact mapping (section maps, coverage tables); when nothing represents it, write "not represented" - an explicit gap feeds the next gate, a fabricated one suppresses it. Pitfalls entry V2
- **Verify anchors by slug comparison**, including a file's own `On This Page` list; renaming a heading invalidates same-file anchors and VitePress will not fail on them. Pitfalls entry V3
- **Never decorate a gate report with uncounted numbers.** Any total in a gate report is a claim requiring the same evidence as a pass/fail verdict; a total that is not the sum of counted parts must not be emitted. The P3 output block enforces this with `A + B + C + D = N`. Pitfalls entry V4

## Boundaries

### Always (do without asking)
- Read any file in the project; modify files in `docs/`
- Run test and lint commands; create test files; fix lint findings
- Write to `__dev__/` freely (workspace root, outside any repo, never committed)

### Ask First
- Add dependencies to any `package.json`
- Create new helper modules or entity modules
- Modify deployment configs in `_deploy/`; restructure directory layout

### Never
- Modify `.env` files or secrets (except `__dev__/.env*` at the workspace root)
- Force push; expose sensitive information in logs or code
- **Run `npm publish` manually.** Publishing is CI-only via the unified pipeline; bumping `version` and pushing to `main` triggers it. See `docs/languages/js/publishing.md`

## Directory Map

Full layout: `docs/dev/org-structure.md`.

```
project-superloom/                 (workspace root)
  codebase-superloom/              - framework constitution: docs/, website/, AGENTS.md
  codebase-js-helper-modules/      - all JS helper modules + publish pipeline
    src/helper-modules-core/       -   Class A/B (js-helper-*)
    src/helper-modules-server/     -   Classes B-F (js-server-helper-*)
    src/helper-modules-client/     -   client modules (js-client-helper-*, js-react-helper-*, js-rn-helper-*, js-rnw-helper-*)
  codebase-js-demo-project/        - reference application (model, server, ops runbook)
  __dev__/                         - personal workspace (plans/, secrets/; never committed)
  superloom.code-workspace         - multi-root workspace file
```

Every module: entry file + `[name].config.js` + `[name].errors.js` + `[name].validators.js` + `_test/` (loader.js is the only env reader) + `README.md` + `ROBOTS.md` (+ unpublished `THOUGHTS.md`). Skeletons: `docs/languages/js/module-structure.md`.

**Modules-repo root carries no `package.json`, lockfile, or `node_modules/`** - modules are self-contained; repo-wide tooling lives in CI job definitions. Allowed root content list: `docs/dev/org-structure.md` - Repository Root Content.

## Workflow Inventory

| Command | Repo | Use when |
|---|---|---|
| `/js-helper-module [create\|fix] [path]` | js-helper-modules | Build new modules and fix existing ones; one module per run. `fix` is also the retrofit verb after docs change |
| `/js-helper-module-audit [path]` | js-helper-modules | Read-only deep audit with creator-diff and three-bucket drift classification; hands findings to `/js-helper-module fix` |
| `/js-helper-module-publish [path]` | js-helper-modules | Pre-publish gate, CI registration, version bump, and release |
| `/new-entity` | js-demo-project | Adding a domain entity to the demo application |
| `/demo-client-rnw` | demo-client-rnw | Pre-commit protocol and code quality for the demo RNW client |
| `/rnw-components-carbon` | rnw-components-carbon | Pre-commit protocol and code quality for the Carbon RNW component library |
| `/project-docs [create\|update\|audit]` | any product repo | Create, update, or audit the management layer (PROJECT.md, feature ledger, CHANGELOG.md) per `docs/principles/project-management.md` |
| `/learn` | superloom | Capturing conversation knowledge into its canonical doc; hands off to `/finalize-docs` |
| `/finalize-docs [check]` | superloom | After any docs or workflow change: validate to convergence, then propagate to the canonical AGENTS.md and embedded blocks. `check` = report-only |
| `/compile-workflows-from-docs [repo] [lang]` | superloom | Recompile concrete workflow families for an implementation repository from archetypes + language docs; self-verifies via headless workshop |
| `/plan` | workspace root | Plan transitions (`new`, `next`, `done`, `revive`, `supersede`, `status`); mandatory sections, no-questions authoring contract |

Workflow authoring standard (seven mandatory properties, embedded-block compile rule): `docs/ai/workflow-authoring.md`. Workflow archetypes (family pattern, compile rule): `docs/ai/workflow-archetypes.md`. Model-tier split and token discipline: `docs/ai/model-tiering.md`.
