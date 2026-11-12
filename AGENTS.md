# Superloom - AI Assistant Configuration

> ## GOLDEN RULE - READ FIRST
>
> **AGENTS.md is a derived, compact summary of `docs/`. Never edit AGENTS.md directly.**
>
> This is the only compiled `AGENTS.md`. A dependent repository has a small repo-local `AGENTS.md` for its own commands and for the policy that this constitution gives to it. It never has a copy or a symlink of this file.
>
> To change a rule:
> 1. Update the source-of-truth file in `docs/` (`principles/`, `languages/js/`, `ai/`, `dev/`, `ops/`).
> 2. Run `/finalize-docs` to validate the docs and propagate them into the canonical AGENTS.md.
>
> If you skip these steps, AGENTS.md states rules that `docs/` no longer states. There are no exceptions. A one-word fix also goes through `docs/` first.
>
> When you find a new failure mode, journal it in the correct pitfall file BEFORE the fix:
> - `docs/dev/pitfalls.md` - terminal, CI and testing failures
> - `docs/languages/js/pitfalls-migration.md` - module migration failures
>
> This file has a size budget: target 300 lines, hard ceiling 400 (`docs/ai/agent-configuration.md`). Content that would pass the ceiling moves to docs or workflows.

## Session Modes - choose before any rule below

| Code word | Mode | Do |
|---|---|---|
| `start` | **Use**: another project is the working project | Read `.devin/workflows/adopt.md` in this folder and follow it. The rules below describe the JavaScript reference of Superloom. Study them. Do not apply them to the code of the other project. Do not edit Superloom files. After the project has its own `AGENTS.md`, that file governs |
| `dev mode` | **Dev**: work on Superloom. A pasted Superloom plan prompt counts | Session ritual in AI Behavior Rules (`RUNBOOK.md` first) |

- No code word: infer the mode from the working project. If it is not clear, ask "Use mode or dev mode?". If the owner says `start` and there is no other project, offer to create one.
- Reply to a code word with 6 lines or fewer: a bold tag cloud, then the current plan or phase and the next step.
- Dev mode tags: `**AGENTS.md active** · **Dev mode** · **Golden Rule** · **Docs first** · **Two-pass check** · **No AI attribution** · **High / Low / Fusion / Lean Fusion understood**`
- If the owner says again the rules that you already have, reply "Already known.", the tags, and "Next time, say start." (or "dev mode").
- Owner vocabulary: **High** is the reasoning tier alone. **Low** is the execution tier alone. **Fusion**: the lead reads the code and writes each tracked file, and the sidekick only runs commands and reports. **Lean Fusion** applies only when the owner names it. Then the sidekick also reads the plan and edits. The lead reads only the prompt, the `PROGRESS.md` tail and the reports. `docs/ai/model-tiering.md`
- Final summary of a task: quick-glance bullets in four groups, in this order: Done, Changed, Overridden, Choices made. A group with nothing reads "none". `docs/ai/agent-configuration.md` - Owner Reports

## Persona

Help developers who work on **Superloom**. Superloom is a modular application framework and engineering reference that runs anywhere. It is implemented in JavaScript today. The backend runs on Docker (Express) and AWS Lambda. The frontend is documented (RNW/Expo stack). The architecture does not depend on a language. Other languages are future expansions.

## Tech Stack

- **Language:** JavaScript (Node.js 24+) | **Server:** Express (Docker), AWS Lambda (Serverless Framework, per-entity)
- **Testing:** `node --test` + `node:assert/strict` | **Linting:** ESLint 10+ flat config through the shared `@superloomdev/js-helper-eslint-config`
- **Registry:** GitHub Packages (`@superloomdev` scope) | **Commits:** Conventional Commits | **Versioning:** SemVer
- **GitHub:** [github.com/superloomdev/superloom](https://github.com/superloomdev/superloom) | MIT License

## Documentation Map

Three layers under `docs/` (superloom repo). Full index: `docs/README.md`.

| Layer | Holds | Key files |
|---|---|---|
| `docs/principles/` | Universal rules and their reasons | `engineering-philosophy`, `code-readability`, `file-archetypes`, `module-design`, `composition-and-adapters`, `error-handling`, `validation`, `testing`, `documentation-authoring`, `project-management`, `extending-to-a-language` |
| `docs/languages/js/` | The JavaScript way (complete, self-sufficient) | `index` (reading path, two-form naming), `code-formatting`, `module-structure` (all skeletons), `function-naming` (verb catalog, return shapes), `module-classes`, `composition-and-adapters`, `error-handling`, `validation`, `module-docs`, `dependencies`, `publishing`, `conventions-registry`, `server/`, `client/`, `versioning/` |
| `docs/ai/` | Standards for AI-assisted development | `agent-configuration`, `workflow-authoring`, `workflow-archetypes`, `model-tiering` |

## AI Behavior Rules

- **In dev mode, at session start:** read `__dev__/RUNBOOK.md` first (if it exists), then `PROGRESS.md`, then `ESCALATIONS.md`, then the plan named `CURRENT`. If a `RUNBOOK.md` exists, do not select a plan by modification time. Use `/plan` for transitions. Full rules: `docs/dev/planning.md`
- Read the `README.md` of a module before you change it. **Read `ROBOTS.md` before you call a function of a module** (compact signature reference).
- Run the tests before you return: `npm install && npm test` from the `_test/` directory of the module.
- **Two-pass check after a refactor that touches 3 or more functions:** Pass 1 is logic and lint. Pass 2 reads the full file again: step comments, 3/2/1 spacing, banner widths, multi-line return objects, `};` combined with END banners, JSDoc indentation. Then lint again. See `docs/languages/js/pitfalls-migration.md`
- **Skeleton conformance diff after a structural pass:** compare the entry file element by element with its class skeleton in `docs/languages/js/module-structure.md`, function bodies included. The worked body of the skeleton is normative for comment density. Fix lists, lint and grep sweeps do not find a missing step comment.
- **Step comments, in every language:** each block has a one-line step comment, with no exception for short functions. Each `if`, loop and `try` starts its own commented block, and so does the statement after it. The guard after a call is its own block. Each return has a comment directly above it. A return inside a branch body of one or two statements is covered by the branch comment. A loop or branch body with more than two statements has a comment for each step. A `catch` comment states the fallback. One blank line follows the documentation header. See `docs/principles/code-readability.md` - Step Comments
- **A step-comment checker runs in the lint command of each language layer.** Lint fails on a finding. Prove that the checker finds a planted block before you trust a clean run. JavaScript has no checker yet. Its build and audit workflows enforce the rules by a manual gate. Each public I/O function carries the Mandatory Step-Comment Set: validate, init, driver calls, success, error and early returns. See `docs/principles/code-readability.md` - Mechanical Enforcement, `docs/languages/js/code-formatting.md` - Comment Style
- **The formatter wins on spacing.** The blank-line hierarchy is strict: sections, then functions, then blocks. JavaScript uses 3/2/1. If a formatter caps blank lines, the hierarchy compresses (2/2/1 under a cap of 2), and section banners carry the largest break. See `docs/principles/code-readability.md` - Vertical Rhythm
- **Type guards call `Lib.Utils` primitives, never raw `typeof`:** `isNumber` (rejects `NaN`), `isFunction`, `isString`, `isBoolean`, `isObject` (rejects `null`), `isNullOrUndefined`. The rule applies to `[module].validators.js` and to inline guards in `[module].js`. Mixed forms in one module are a violation. Argument-shape dispatch and capability duck-typing stay raw `typeof`. See `docs/languages/js/validation.md` - Use Utils Type-Check Primitives
- **Identifier wire format:** use a parse that cannot be ambiguous, not a constraint on the data of the caller. A fixed-width, right-anchored parse permits any character in the leading segment. For composite internal keys, use `\u001F` (ASCII Unit Separator). It cannot occur in a human-readable identifier, so the caller needs no constraint. See `docs/languages/js/validation.md` - Identifier Format and Wire Parsing
- **Three error categories, three disposals:** a programmer error (bad arguments, misconfiguration) throws `TypeError` synchronously. An operational error from a helper returns `{ success: false, error: { type, message } }`. A domain error returns `{ success: false, error: { code, message, status } }` from `[entity].errors.js`. The test: can perfectly-written calling code still hit this at runtime? No means throw. Yes means envelope. See `docs/languages/js/error-handling.md`
- **Wrapper purity:** the catalog of the module owns the envelope. Driver and SDK codes and wording never leak through `type` or `message`. Log them at debug. Catalogs stay coarse (`DATABASE_QUERY_FAILED`, not `23505`). A service translates a helper envelope into its own domain error before it returns to a controller. See `docs/languages/js/error-handling.md`
- **Assertions pin exact values:** never assert a range or a disjunction that more than one behavior can satisfy. Fix a nondeterministic setup, not the assertion. See `docs/principles/testing.md` - Test Structure and Naming
- **Test double patterns:** four named patterns cover each injected dependency. `memory-store` is a storage contract fake. `stub-adapter` records outbound calls. `engine-stub` is a native engine fake. `emitter-stub` is a subscription surface with test-side `_emit` and `_listenerCount`. Use `emitter-stub` when the injected API exposes `addEventListener` or change subscriptions. See `docs/languages/js/unit-test-authoring.md` - Test Double Patterns
- **Application-tier repos must have an offline test suite:** each application repo ships a `_test/` directory. It builds `Lib` through the real loader with stub adapters and renders shared components with `react-test-renderer`. The test tier is a host. It never builds the container again. See `docs/languages/js/testing-strategy.md` - Rules
- **Application UI acceptance uses four gates.** Contract: exact generated token values and provenance. Functional readiness: response, mount, console and request errors, interaction. Geometric layout: exact typography, spacing, overflow, overlap and reflow at fixed viewports. Visual regression: `toHaveScreenshot` baselines. Presence and interaction alone do not prove a correct UI. See `docs/languages/js/client/rn-testing.md` - Application UI Acceptance
- **Strict roster smoke tests run in the strictest contract mode of the library:** an undeclared utility or token read throws during the roster walk. Lenient rendering proves only that a component can be reached. If no strict mode exists, a static contract audit compares each literal reference with the generated registry. See `docs/languages/js/testing-strategy.md` - Rules
- **Generated reference theme packages record their source provenance, and tests verify it:** the record holds the default package version, its distribution shasum and the generator schema revision. Tests fail on stale or missing provenance, on a shasum mismatch, or when a new generation into a temp directory is not byte-identical. After a same-version default republish, regenerate and republish each downstream package and refresh each consumer lockfile. See `docs/languages/js/client/theming.md` - Generated artifact provenance
- **`performanceAuditLog`:** each call passes a local `start_ms` captured at the start of the operation (never `instance['time_ms']`, never a same-line timestamp). The layer that owns the work logs each interval one time. Drivers (`nosql-*`, `sql-*`, `queue-*`, `storage-*`, `http`) instrument their own roundtrips. Non-drivers never log delegated I/O again.
- **Two-form naming:** the scope form (`@superloomdev/...`) and the bare form (`js-...helper-...`) occur only in `package.json` and in real repo-path URLs. Use the alias (`helper-...`) in all other places. See `docs/languages/js/index.md`
- **Function naming doctrine:** each exported function starts with a verb from the catalog in `docs/languages/js/function-naming.md`. The verb decides the return shape. `is`/`has` return a bare Boolean, and bad input throws `TypeError`. `get` returns bare when it cannot fail and an envelope when it can. `build`/`create`/`generate` return the artifact directly. A mutator returns an envelope when it touches a persistent store.
- **Banned verbs and key casing:** do not use `construct`, `deconstruct`, `read`, `ensure`, `transform` or `xToY` conversion names. Config keys are `SCREAMING_SNAKE_CASE` (data) or `PascalCase` (injected live objects only). A React component factory is PascalCase and noun-named by framework contract.
- **Before you invent, search the settled conventions registry:** if another module solved a name, config key, return shape or testing approach, use that answer. Do not ship a second answer to a settled question. "The old one is wrong" is a reason for a migration, not for a divergence. See `docs/principles/engineering-philosophy.md` - Before Inventing, Search
- **Reserved vocabulary:** do not reuse a widely standardized term for a different concept. `scope` is reserved for OAuth permission sets (RFC 6749). Use `tenant_id` for the isolation boundary and `namespace` for a composite-key segment with no domain meaning. See `docs/principles/engineering-philosophy.md` - Reserved Vocabulary
- **Peer dependencies declare the full runtime contract:** each Superloom module consumed at runtime is in `peerDependencies` with a caret range (`^1.0.0`). This includes a module received only by injection through `shared_libs`. A framework peer such as `react` uses `>=`, because the host owns the version. The peer lists in `ROBOTS.md` and `[module]/docs/configuration.md` must equal `package.json`. See `docs/languages/js/dependencies.md`
- Module lifecycle operations (create, fix, audit, publish) go through the workflow family (`/js-helper-module`, `/js-helper-module-audit`, `/js-helper-module-publish`). Do not improvise the procedure.
- Use `/learn` to capture new knowledge. Run `/finalize-docs` after each docs change. It validates to convergence, then propagates to the canonical AGENTS.md and the embedded workflow blocks.
- **Documentation never refers to plans or workflows.** Plans are ephemeral, and plan numbers go stale. A document never cites a plan number, keeps a roster of planned modules, or gives its authority to a workflow. Catalogs list shipped modules as reference examples only. See `docs/principles/documentation-authoring.md`
- Use Plan Mode for complex, multi-step or risky changes. When you are stuck, try workarounds before you ask. Use the existing terminals again.
- **Two registers:** each file has one audience, and the audience sets the register. The agent register is ASD-STE100 Simplified Technical English: `AGENTS.md`, workflows, skill wrappers, plans. The human register is plain English: `docs/` (the public site), READMEs above their closing "For AI agents" section, code comments. See `docs/principles/documentation-authoring.md` - Two Registers
- **STE rules:** an instruction has 20 words or fewer, and a description 25 or fewer. One instruction per sentence. The condition comes before the command. Use the imperative and the active voice. Keep the subject, the verb and the articles. No contractions, no semicolons. One word has one meaning. Superloom uses the STE writing rules, not the STE dictionary.
- **Docs prose mechanics (human register):** no em dashes (use a comma, a period or ` - `). American English (`initialize`, `behavior`, `license`). Table cells are fragments with no period at the end. One term per concept. The banned vocabulary list is in `docs/principles/documentation-authoring.md` - Banned Vocabulary. See `docs/principles/documentation-authoring.md` - Prose Mechanics
- **Client module naming taxonomy:** runtime-tier prefixes are `js-helper-*`, `js-server-helper-*` and `js-client-helper-*`. Framework-tier prefixes are `js-react-helper-*`, `js-rw-helper-*`, `js-rn-helper-*` and `js-rnw-helper-*`. Suffixes are `-ext-[framework]`, `-store-[backend]`, `-adapter-[name]` and `-template-[name]`. A module takes the lowest tier whose dependency budget it fits. See `docs/languages/js/client/client-modules.md`
- **Tier exceptions:** `js-rn-helper-*` and `js-rnw-helper-*` do not need React when the module wraps a platform native module or SDK (for example `react-native-mmkv`, `expo-sqlite`). The platform dependency earns the tier. Dev-tooling packages (`js-helper-eslint-config`) are devDependency-only and are not in peer contracts. The [decision test](docs/languages/js/client/client-modules.md#pure-core-with-extensions-or-a-single-framework-module) decides Class I versus Class G+H.
- **RNW component libraries always consume the `native` theme projection:** call `buildTheme(template, layers, 'native')` on each platform, web included. RNW is the web projection. A `web` request applies two projections and gives unit strings that React Native cannot use on iOS or Android. See `docs/languages/js/client/theming.md` - Units and platforms
- **Token contract:** the Themer package owns the token contract (`Themer.getContract()`). A component system declares the tokens that it requires and supports as exported data. `createSystem` calls `Themer.validateContract`. A missing required token throws `TypeError`. No component has a color literal or falls back from one token to another. See `docs/languages/js/client/theming.md` - The token contract
- **Scheme versus brand layer:** a scheme is a complete token set inside a template. Light and dark are in the same package. A brand layer is a sparse overlay. A new template changes the visual system, and a layer adjusts it. An application never builds the template again when a layer changes. See `docs/languages/js/client/theming.md` - Themes, templates, layers, profiles
- **A template is theme plus icons:** there is exactly one template package for each design system. Each value, enum choice and glyph that a component system needs is in the data of the template. Fonts are the one exception: the theme names the family, and the host installs the font package. See `docs/languages/js/client/theming.md` - Themes, templates, layers, profiles
- **Two templates ship, `carbon` and `default`:** a behavior value such as a floating label or a ripple is an enum value that a template or a brand layer can pin. See `docs/languages/js/client/theming.md` - Themes, templates, layers, profiles
- **Enum and structure groups beyond `feedback`:** the `anatomy` group holds shape choices, and the component implements each listed value. `stacking.*` magnitudes are structure tokens. A layout choice for only some sizes or kinds is an anatomy choice. Which drawing a part shows is an icon role, never an enum. See `docs/languages/js/client/theming.md` - Anatomy enums
- **Role grid:** for each part in each state, there is one role token for each property (color, width, space, type set, elevation), published as `getContract().grid`. A component reads only its cells for its current state. Each template answers each cell. `feedback.focus_trigger` (`any` | `keyboard`) decides when a focus ring shows. See `docs/languages/js/client/theming.md` - The role grid
- **Contract requests queue, never invent:** queue a token that the contract does not have as a contract request. Apply the requests at a milestone as one contract version bump. Then regenerate and republish the templates in dependency order (engine, default, each shipped reference template). See `docs/languages/js/client/components.md` - Contract requests
- **Font manifest style entries carry a real asset source:** an entry without a source is an error, because text falls back with no signal. A platform whose adapter has no native loader keeps an empty manifest and uses its own font mechanism. See `docs/languages/js/client/fonts.md` - Manifest Style Entries
- **Component presentations live in the context seam:** `ctx.focusRing` (role-grid cells, gated by `feedback.focus_trigger`), `ctx.pressPresentation` (`feedback.press`) and `ctx.fieldPresentation` (`feedback.field` x `anatomy.label`) each implement the choice of the theme one time, as style fragments. A component that shows focus, press or a field frame uses the presentation. It always mounts the parts that it can hide, so the element tree does not depend on the template. See `docs/languages/js/client/components.md` - The context seam
- **Component accessibility uses `aria-*` props, never `accessibilityState`:** state and value semantics go through the `a11y` translator (`a11y.state()`, `a11y.value()`, `a11y.relation()`, `a11y.position()`). `accessibilityState`, `accessibilityValue`, `accessibilityViewIsModal`, `importantForAccessibility` and `announceForAccessibility` do nothing on web. Pass `accessibilityRole` and `accessibilityLabel` directly. See `docs/languages/js/client/components.md` - Accessibility Contract
- **Theme token contract:** `createSystem` calls `Themer.validateContract` with the required and the supported lists. Missing required tokens are one `TypeError` that names them all. Unsupported provided tokens are one warning that names them all. No component reads a token by a name outside the contract. See `docs/languages/js/client/components.md` - Theme Token Contract
- **Motion interpretation lives in the component system:** the core Themer defines and validates motion token shapes (durations, bezier arrays, spring objects, segments). The component system turns them into platform API calls through `parts/motion.js`. It never relies on a platform default animation. See `docs/languages/js/client/theming.md` - Motion
- **Named barrel exports:** a public barrel has named exports and no default export, so a bundler can remove unused components. See `docs/languages/js/client/components.md` - The context seam
- **Host-safe component rendering:** a measurement that decides what renders is state, never only a ref. A known cap applies before the measurement. An unflexed root keeps `auto` flex basis. A hosted layer measures its host's box and does not paint until it is measured. A surface that opens focused takes focus in the commit that mounts its items. A decorative layer (scroll fade, measuring seat) is hidden from assistive technology. A pointer-only seat stays out of the tab order but draws the focus treatment of the contract. A part has the same element shape across form classes and templates. See `docs/languages/js/client/components.md` - Host-Safe Rendering
- **An upstream export that the library does not build is an `excluded` entry, not a roster row:** each exclusion names one rule from the roster's `rules`. The roster check asserts that each upstream export is a row or an exclusion, never both. See `docs/languages/js/client/components.md` - The Roster
- **Component geometry is declared data, measured against the upstream reference:** geometry is in each component's `spec.js` as token names for each part. The roster's `reference` column (`render-web`, `parse-rn`, `none`) says how to measure it. A transcribed stylesheet never earns the `parsed` label. Pitfalls entry 49. See `docs/languages/js/client/components.md` - Geometry and Fidelity
- **Native evidence compares per platform:** measured geometry is within one point of the web run in height. In width it is within two points on iOS and four on Android. The text wrapper neutralizes host defaults one time (`includeFontPadding: false`, `textBreakStrategy: 'simple'`, single-line `textAlignVertical: 'center'`, zero vertical input padding). A host missing a template adapter fails. See `docs/languages/js/client/components.md` - Native Evidence
- **Component verification runs at three speeds:** `check` after each edit (lint, purity gate, the tests of the component). `batch` every 8-12 components (browser gates, measurement, screenshots, docs regeneration). Full `verify` only at milestones. No speed does the work of another. Pitfalls entry 48. See `docs/languages/js/client/components.md` - Verification Speeds
- **One frame owner for each field composite:** the wrapper owns the border, focus ring, invalid state and disabled state. The inner `TextInput` renders `unframed`. The frame shape is the `feedback.field` token (`underline` or `outline`). Each square corner reads `shape.radius_00`. The `TextInput` atom sets `minWidth: 0`. See `docs/languages/js/client/components.md` - Frame Ownership
- **Icons are theme tokens, never host adapters:** semantic names (`icon.*`) map to SVG path data inside the template. The `Icon` atom renders them through `react-native-svg` on each platform. The library exports `REQUIRED_ICONS`, validated like `REQUIRED_TOKENS`. Never substitute an icon from another set. Pitfalls entry 50. See `docs/languages/js/client/components.md` - Icon tokens
- **Status surface triad:** each status surface uses `color.notification_background_[kind]` for the fill, `color.support_[kind]` for the accent (leading border, icon), and `color.text_primary`/`text_secondary` for text. `support_[kind]` is an accent, never a fill. See `docs/languages/js/client/components.md` - Status Surface Triad
- **Centered targets:** each pressable meets a minimum target (`controlSize`, `dismissTargetSize` or `target.minSize`). It centers its glyph with `alignItems`/`justifyContent` on a `View` or `Pressable`, never on the SVG. Each pressable has an accessible name. See `docs/languages/js/client/components.md` - Centered Targets
- **React hook modules are factories, never singletons:** a `use*` function that calls `Lib.React.useState`, `useRef` or `useEffect` forces the factory pattern with `state`. Pure computation modules without hooks (`js-client-helper-crypto`) can stay singletons. See `docs/languages/js/module-structure.md` - React Hook Modules Are Factories
- **Name an injected slot for the capability, never the vendor:** `shared_libs.Fonts` and `shared_libs.KeyValueStore` are correct. `shared_libs.ExpoFont` and `shared_libs.MMKV` are not. The rule applies to module code, test loaders, host manifests and doc examples. See `docs/principles/composition-and-adapters.md` - Naming
- **Repository independence:** the constitution repo (superloom) never refers to the workflows or internals of a dependent repo. Dependent repos refer to superloom docs freely. A dependent repo's own `AGENTS.md` holds only what is true of that repo alone, never a copy of a compiled rule. See `docs/ai/agent-configuration.md` - Repository Independence
- **Working memory in an adopted project:** a tracked `MEMORY.md` at the root holds Current state (with an `Updated` line), Notes, Log (newest first: Changed, Why, Verified, Pitfalls) and Pitfalls. The author is `[git-user] ([harness])`. Update it in the same commit as the work. No private data. AI product names occur only in its headings. See `docs/ai/agent-configuration.md` - Working Memory
- **Memory files do not overlap:** in an adopted project, the Pitfalls section of `MEMORY.md` is the only pitfall journal. An admin compacts the file past about 400 lines, in its own commit. Superloom repos have no `MEMORY.md`: knowledge goes to `docs/`, and plan state stays in `__dev__/`.
- **`docs/data-model.md` states key field meanings:** the data-model page of each module states what its key fields mean. The meaning must not conflict with the use of the same word in another module. See `docs/languages/js/module-docs.md` - docs/data-model.md Key Field Semantics
- **Code comments never refer to `docs/` paths:** a comment must be clear with the file alone. Step comments state what and why, never how. See `docs/principles/engineering-philosophy.md`
- **Product management layer:** each product repo has `PROJECT.md` (10 fixed sections), `CHANGELOG.md` (Keep a Changelog) and a feature ledger (permanent IDs, statuses `proposed`, `approved`, `building`, `shipped`, `retired`). Update triggers fire in the same change as the work. The size budget is 300/400. No references to earlier projects, clients or predecessors. See `docs/principles/project-management.md`
- **Composition and adapters doctrine:** a general unit defines a port, specific units implement it, and a composition root chooses. Five tiers: driver, store, transport adapter, extension, host adapter. An optional adapter is a defect: validate the full set at boot or fail. The composition root is never a module and never duplicated. See `docs/principles/composition-and-adapters.md`
- **Index budget on high-volume tables:** defend an index as a budget for each adapter. A wide-column secondary index is a full item copy. A shared store contract is designed for the most expensive adapter. A detection capability belongs at the moment of the event. See `docs/principles/module-design.md` - Index Budget
- **The shared ESLint config is the single source of lint rules:** the `eslint.config.js` of each module is a three-line re-export of `@superloomdev/js-helper-eslint-config` (presets `base`, `esm`, `browser`, `app`). No per-module rule overrides. The config package publishes first in the CI chain. See `docs/languages/js/code-formatting.md` - Shared ESLint Configuration
- **All modules are ESM:** each module uses `import`/`export default` with `"type": "module"` in `package.json`. Do not write the strict mode directive. Each import path has its `.js` extension. The factory skeleton, banners, spacing and JSDoc do not change. See `docs/languages/js/module-structure.md`
- **No AI attribution in commits:** no `Co-Authored-By`, no `Generated with`, and no AI tool attribution in commit messages or `package.json` contributor fields. The only author is the project maintainer. This rule overrides the built-in commit template of each AI tool. Each repo that an agent commits to carries this rule in its own `AGENTS.md`. See `docs/ai/agent-configuration.md` - Commit and Attribution Policy
- **Release policy is repository-local, and normal SemVer is the default:** a source change gets a new version number, unless the published repo declares otherwise in its own `AGENTS.md`. A repo that pins a version and republishes by delete-then-push declares it there as a transitional convenience. It then refreshes each consumer lockfile. See `docs/ai/agent-configuration.md` - Release Policy Is Repository-Local
- **Idempotency guards compare fingerprints, not names:** a guard that detects "already done" takes a fingerprint of the work as its input. A name cannot tell "nothing to do" from "the name was reused". The rule applies to package publish, cache reads, migration ledgers, webhook replay and build caches. See `docs/principles/engineering-philosophy.md` - Idempotency Guards Compare Fingerprints
- **Autonomous execution protocol:** when plans run unattended, `docs/dev/autonomous-execution.md` is standing doctrine. It defines the authorization boundary, the convergence loop, the escalation log, the progress journal and the registry order (delete before push, never `rerun --failed`). It binds each plan chain that refers to it.

## Safe Terminal Patterns

> Source: `docs/dev/pitfalls.md`. Compressed. Read the journal when a failure needs a confirmed fix.

- **Never `cd` in commands.** Set the tool's `Cwd`. Each module command (`npm install`, `npm test`, `docker compose`) runs with `Cwd` at the `_test/` directory of the module. Without it you get misleading `ETARGET` errors.
- **Never make the shell parse multi-line strings.** Do not use heredocs. Use a file tool. Use a single-line `git commit -m`, stacked `-m` flags or `git commit -F /tmp/msg`. `__dev__/` is outside each repo: use file tools directly, except for `.env*` files (write `/tmp/...`, then `cat >>`).
- **Never start interactive viewers** (`less`, `vi`, `man`). Use `git log -n 20` and `git --no-pager diff`.
- **Long-runners** (`node server.js`, `tail -f`, compose logs): run them non-blocking with a small wait, poll the status, and stop them at the end of the task.
- **Module testing contract: `npm test` is self-contained.** `pretest`/`posttest` own the full Docker lifecycle (`pretest` runs `docker compose down -v` first). Never start containers by hand before `npm test`. See `docs/dev/testing-local-modules.md`
- **Pre-publish gate:** before you bump `version` and push to `main`, `npm run lint` exits 0 from the module root, and clean-install tests pass from `_test/`. See pitfalls entry 13
- **`file:` rule:** in `_test/package.json`, only the module under test is `file:../`. Shared helpers use registry semver ranges, pinned to the version that the code calls. See pitfalls entries 8 and 11
- **CI chained publishes:** each `publish-*` job replaces the transitive `success()` with `!cancelled() &&` and an explicit `needs['test-x'].result == 'success'`. A `contains()` check on detect outputs uses `fromJSON()`. A test job whose `_test/` installs another in-repo package chains after that package's `publish-*` job. See pitfalls entries 11, 18 and 23, `docs/dev/cicd-publishing.md`
- **Publish guards compare content, not version presence.** The detect gate and each `publish-*` job compare the `npm pack` shasum with the registry's `dist.shasum`. Equal skips, different fails with both shasums, absent publishes. The remedy for a mismatch follows the release policy of the repo, normally a version bump. Delete-then-push is valid only where the `AGENTS.md` of the repo documents it. A listed version does not prove that the new content shipped. After a publish, compare the published shasum with `npm pack` for the commit. See `docs/dev/cicd-publishing.md`, pitfalls entry 26
- **AWS SDK in tests needs dummy credentials** (`AWS_ACCESS_KEY_ID=local AWS_SECRET_ACCESS_KEY=local AWS_REGION=us-east-1` in the test script). Without them the SDK walks the EC2 metadata chain at 1-2 s per call.
- **Prove a new sweep grep fires before you trust it.** Empty output is a pass only after the pattern found a planted violation on the machine that runs it. A backslash is literal inside a POSIX bracket expression. `git grep -E` has no portable `\b`: write `(^|[^A-Za-z0-9_$])word`. Pitfalls entries S6 and V10
- **Auto-run only read-only or idempotent commands.** Never auto-run `rm -rf`, force pushes, volume removals, publishes or other state mutations, whatever the earlier approvals.
- **VitePress crashes on bare angle-bracket placeholders** in `docs/` prose, because it parses them as Vue elements. Use `[name]` in prose and ` ```text ` fences for templates. Build the site locally after you touch rendered files. Pitfalls entry 15
- **E409 or a checksum mismatch from GitHub Packages** is transient: wait 30-60 s and install again. Never use `--legacy-peer-deps` (entry 21). After a same-version republish, regenerate each consuming lockfile (entry 24). A shared devDependency such as `js-helper-eslint-config` is the head of the CI chain (entry 25).
- **Never report a gate as passed without a run.** A validation workflow is complete only when each step ran and produced its evidence. Name the commands and file reads behind each count. A green website build is not evidence for link, terminology or rule-mirroring passes. Pitfalls entries V1 and V3
- **Never invent a mapping to close a finding.** Read the destination and confirm the content before you state a mapping. If nothing represents it, write "not represented". Pitfalls entry V2
- **Anchor targets use the generated form of the site**, not the form of GitHub. VitePress does not validate heading fragments. The anchor audit (`website/scripts/anchor-audit.py`) is the gate. `website/scripts/toc-generate.py` generates the `On This Page` blocks. Never edit them by hand. Pitfalls entry V3
- **Never add uncounted numbers to a gate report.** A total is a claim that needs evidence like a verdict. A total that is not the sum of counted parts must not appear. The P3 output enforces `A + B + C + D = N`. Pitfalls entry V4
- **Never state a policy-dependent rule as permanent doctrine.** A constitution rule states the mechanism. A remedy that varies by repo goes to the `AGENTS.md` of that repo, with the unsurprising default when nothing is declared. For each "never X", name the repo where it is false. Pitfalls entry V5
- **Local CI parity:** a policy gate of a workflow has a local entry point that extracts the current gate body from the workflow file. `git grep` does not see untracked files, so run `git add -N` before you trust a clean result. Run full local verification after the last edit and just before the push. Map each CI step, isolate the install scope, and match the CI tool settings. A pre-push gate blocks a stale content stamp. See `docs/dev/local-ci-parity.md`, pitfalls entries 27, 28 and 29
- **Active workflows use the current stable major of each external action**, verified from the official release API of the action. Align each active workflow in one pass. See `docs/dev/cicd-publishing.md` - Workflow Maintenance
- **RNW list windowing needs a bounded height:** an unbounded `FlatList` or `VirtualizedList` mounts the full roster. A row-count difference between local and CI is a layout precondition, not permission to relax the threshold. Pitfalls entry 30
- **A stale dev server serves output from an earlier dependency state.** Production Playwright uses a fresh server (`reuseExistingServer: false`). A build identity endpoint lets a freshness check compare the served and computed identity. `dev:fresh` fails on a port conflict. Pitfalls entry V7
- **Presence-only E2E tests pass while the rendered UI is geometrically broken.** Text presence and interaction success are not sufficient. Use the four UI gates with exact assertions for deterministic values. Pitfalls entry V8
- **A warm npm cache hides a deleted tarball:** after a same-version republish, refresh each consumer lockfile by path. Use `npm ci --cache "$(mktemp -d)"` in verify. A lockfile freshness gate compares each pinned shasum with the registry before each `npm ci`. Pitfalls entry 41
- **`npm unpublish` returns E405 on GitHub Packages:** remove a version through the GitHub Packages API (`gh api DELETE /orgs/.../versions/[id]`). Never use `npm unpublish` or a local `npm publish`. Pitfalls entry 42
- **The RNW `<input>` intrinsic minimum width overflows its wrapper:** the `TextInput` atom sets `minWidth: 0`, so each composite can shrink. Pitfalls entry 43
- **An SVG icon adapter that rewrites root fill and stroke turns stroke glyphs into filled shapes:** set color through the one attribute that the icon set documents. An unmapped name is a `console.error`, not a placeholder. Pitfalls entry 44
- **A unit test that reads the `node_modules` of a sibling host fails in CI:** a test directory reads packages from its own `node_modules` and declares them in its own `package.json`. Pitfalls entry 45
- **Never overlap suites that share a generated output path:** a fire suite never runs at the same time as bundle generation, Playwright, snapshot generation or another fire suite on the same artifact. Pitfalls entry V9
- **A visual baseline is the last gate, never the first:** record it only after the structural, measurement, perceptual and accessibility layers pass and the contact sheet is reviewed. A baseline update is a reviewed event with the diff attached. Pitfalls entry 51
- **A local replay reproduces the filesystem of the CI job:** before you replay the steps of a job, set aside each `node_modules` that the job does not install, and restore them after. Pitfalls entries 45 and 52
- **A custom-scheme deep link from `simctl openurl` stops at the iOS "Open in" prompt:** no `simctl` command taps it. Drive an automated iOS walk with `simctl launch` and commands pulled from the test server. Read the timeout screenshot before the log. Pitfalls entry 53
- **A render-comparison gate normalizes per-mount identifiers first:** `useId` changes on each render. Serialize an id reference as the position of its element (`@3`, `@missing`), then prove that the gate still fires on a planted defect. Pitfalls entry 54
- **Pixel-compare only pages that are the same except for the component:** serve the pinned fonts and set no harness body font. Give each layout box a whole-pixel size. Apply the same text smoothing to both, and wait for `document.fonts.ready`. Pitfalls entry 55
- **A test never reads state that another test or hook produced:** after a failure the runner re-evaluates the module, so a shared module-level map empties. Collect what a test compares inside the test. Pitfalls entry 56
- **A focus ring drawn off the focusable element leaves the browser ring on:** the focused element then sets `outlineStyle: 'none'`. A browser gate counts the drawn outlines after `Tab`. Pitfalls entry 57
- **Measure a shadow-DOM reference after it settles, through the shadow tree:** `document.getAnimations()` misses animations in shadow roots. Two runs in a row must give the same numbers. Pitfalls entry 58
- **A test host supplies only the globals that a dependency reads unguarded:** supply a frozen minimal `document`, not a DOM. Memoize an expensive subtree on its real inputs. Pitfalls entry 59
- **A cross-platform comparison is only as good as its baseline:** prove that the baseline drew the faces that it names. Load each declared face before the first render. Grow a container-filling component from `flexBasis: 'auto'`, never `flex: 1`. Pitfalls entry 60
- **Android resolves fonts only by registered family name, and CI browsers hint text:** embed each theme family at build time, and run cross-platform text measurement unhinted (`--font-render-hinting=none`). Pitfalls entry 61
- **Each clause in a gate definition names the test that enforces it:** a census fixture maps each clause to a test title, and a test asserts each title exists. Pitfalls entry 62
- **Which drawing a part shows is an icon role, and a compared part is compared against each reference:** a part left out of one comparison carries a reason and a probe that proves that the reference draws nothing there. Pitfalls entry 63
- **Take a census before a fix round:** compare each built row with each reference in each sample state, light and dark. Resolve the whole list in one amendment. A per-system difference is a role-grid cell, never a component branch. Pitfalls entry 64
- **Theme a reference page with the full recorded scheme and read it through the rendering tree:** when a measurement and a screenshot disagree, the pixels are the truth. Pitfalls entry 65
- **Declare an exemption one time, and each comparison applies it:** an omitted part carries `mask`, and the pixel comparison leaves its box out. Diagnose from saved screenshots before you raise a budget. Pitfalls entry 66
- **A reach check compares the same parts with and without the layer:** a value that the layer overrides must become the layer's value. Prove the check with a planted defect before the commit. Pitfalls entry 67
- **One tracked file pins the sibling dependency that CI checks out:** local verify refuses to run unless the sibling is exactly that ref as pushed, with a clean tree. Pitfalls entry 68
- **Check evidence before you take it:** the Android driver turns error prompts off, closes system dialogs and requires the app's own activity to hold focus before each screenshot. Pitfalls entry 69
- **A layout choice for only some sizes or kinds is an anatomy enum that the template answers** (for example `anatomy.button_label` = `top` or `center`). A vendor rule in a generic component draws under each template. Pitfalls entry 70
- **A pixel gate fixes the text rasterization:** launch the browser with `--disable-lcd-text` and `--font-render-hinting=none`. Run a new pixel gate one time in the Linux image of CI before you trust a local pass. Pitfalls entry 71
- **Semantic names go through `role`, never an `accessibilityRole` outside the TalkBack set:** React Native throws on a value that the TalkBack enum does not have. A native walk that produces no report is a crash until logcat proves otherwise. Pitfalls entry 72
- **Each text run renders through the `Text` atom of the theme (or an explicit `typeStyle`), never a bare platform `Text`.** A bare `Text` draws in the system font. Find the run that skipped the theme before you turn off a platform default. Pitfalls entry 73
- **Overlays render through one `OverlayHost` at the app root:** React Native has no `position: fixed`. An anchored layer converts the window rect of its anchor into host space. Prove that the host is mounted before you trust an overlay screenshot. Pitfalls entry 74
- **Before you commit an inherited tree, grep the added lines for disabled checks:** `false &&`, `true ||`, `.only(` and `.skip(`. Publish or link an unpublished dependency. Never disable the check that would notice it. Pitfalls entry 75
- **Each reference renders on a page that loads only its own styles:** a shared global reset skews the measurements of another reference. Pitfalls entry 76
- **Each distinct visual run gets its own contract cell. Never remove a comparison to wait for one:** put the gap into `expected-gaps.json`, where it expires. Pitfalls entry 77
- **Web-only styles do not port to native:** hide with `opacity` or a transparent fill (`visibility` is ignored). Center an absolute part with a full-span absolute row. Pitfalls entry 78
- **On native, the viewport comes from `Dimensions` and the measured size of the host, never `window.innerWidth`.** A layer that the host mounts later measures from its own `onLayout`. Pitfalls entry 79
- **A measurement cell keeps its border width but paints no border:** an edge of the cell in the shot counts as pixel mismatch. Look for pixels that the harness paints before you tune the component or the budget. Pitfalls entry 80
- **A test of a measured layout waits for the measure explicitly:** react-native-web answers `measureInWindow` from a `setTimeout`. Wait inside `act` for a resolved timer and assert the measured result. Pitfalls entry 81
- **A measured position is where the harness found the part, not where it was drawn.** Check how the harness locates the part before you change the component. Pitfalls entry 82
- **The glyph and the box it is drawn in are two sizes:** the icon atom takes `glyphSize` apart from `size`. Compare the painted path, not the box. Pitfalls entry 83
- **A press target larger than its face must not sit inside an ancestor with `overflow: hidden`.** A pointer move or `focus()` scrolls it. Clip the text (`numberOfLines` with `flexShrink`), not the box. Pitfalls entry 84
- **A dimension that holds template-sized content is a template cell, never a shared spec sum.** A structural check asserts that text stays inside the box painted behind it. Pitfalls entry 85
- **Cross-platform comparisons walk the web reference at the grid width of each native platform.** The assert refuses reports of different widths. Pitfalls entry 86
- **The rendered component is the reference, not its token file:** read the computed style of what paints, pseudo-elements included. Correct the template to the rendered value and cite the measurement. Pitfalls entry 87
- **A ported flex layout states the shrink that the CSS default implied:** CSS defaults to `flex-shrink: 1`, React Native to `flexShrink: 0`. Pitfalls entry 88
- **A deterministic perceptual percentage near the budget is a difference until its diff image says otherwise.** Look at ours, upstream and the diff. Pitfalls entry 89
- **Runner cleanup owns a child results directory, not the evidence of each phase.** Keep durable TAP and summary files outside it. Pitfalls entry 90
- **Capture keeps the measured interaction:** position before the phase, then keep the viewport and the active descendant unchanged through measurement and screenshot. Pitfalls entry 91
- **Each additional target carries its own phase contract:** a pointer-transparent painted target gives a measured point to its governing control. Pitfalls entry 92
- **Equal colors do not prove a semantic alias:** compare normal and inverse focus against the built palette in the painted surface context. Pitfalls entry 93
- **Native text resolves line height on the injected physical pixel grid:** keep raw theme values, test several densities, and never hide per-line rounding by a token or tolerance change. Pitfalls entry 94
- **A successful native install does not prove SDK peer compatibility:** declare host-owned versions from the compatibility manifest of the installed SDK. Pitfalls entry 95
- **A native scene owns its background, foreground, safe area and route-local overlay lifetime:** geometry does not prove them. Review simulator images. Pitfalls entry 96
- **Stop the process tree of a verifier, not one PID:** verify that the mutating children exited and that the bytes were restored before the next gate. Pitfalls entry 97
- **Roster growth does not share one screenshot deadline:** parameterize pixel proofs by component. Do not increase timeouts or pixel thresholds. Pitfalls entry 98
- **An assertion over DOM nodes passes identity, never the nodes:** use `assert.equal(node === other, true, msg)`. A mutation-checker child that dies without a normal test failure is not proof. Cap children with `--max-old-space-size`. Pitfalls entry 99
- **Node test files keep each result inside a `describe`:** a top-level `test()` prints an unindented result line, and the runner then reports a correct test as unmatched. Pitfalls entry 100
- **A zero-area painted rectangle paints nothing:** a bounds gate skips a clipped part when the painted width or the height is zero. Pitfalls entry 101
- **Coverage asserts inside the test of each family:** module-level accumulators read only the counts after a restart. Aggregate nothing across tests through module state. Pitfalls entry 102
- **Neutralize the text and input defaults of a platform one time, in the wrapper of each text run and field, never per component.** Size the width allowance per platform from the whole-point rounding rule. Pitfalls entry 103
- **A native host is settled only after the layout of a confirming-commit marker lands.** A fixed timer after the last layout is never proof. Pitfalls entry 104
- **Seat an operating-system control in the geometry of the drawn component. Never exempt it from comparison.** A host without the adapter that the template asks for fails. Pitfalls entry 105
- **A context usage counter is not a budget when the tool summarizes a full context automatically.** A sidekick never ends a handoff to save context. Answer a report that names context with "continue". Pitfalls, Rule Delivery entry 2
- **A universal rule lives in the principles layer, and a tool checks it.** A rule only in one language document is a suggestion to other languages. Pitfalls, Rule Delivery entry 3
- **A snapshot, not the sidekick's judgment, decides ownership.** A sidekick deleted untracked files that it believed were stale, and a check of tracked files missed it. Pitfalls, Rule Delivery entry 4
- **Read the plan state file again before you write it.** If it changed since the session start, another session is active. Stop and tell the owner. Pitfalls, Rule Delivery entry 5
- **Copy each identifier in a report from the command that proved it.** Confirm that a CI run's commit is the pushed commit. Pitfalls, Rule Delivery entry 6

## Boundaries

### Always (do without asking)
- Read each file in the project. Change files in `docs/`.
- Run test and lint commands. Create test files. Fix lint findings.
- Write to `__dev__/` freely (workspace root, outside each repo, never committed).

### Ask First
- Add dependencies to a `package.json`.
- Create new helper modules or entity modules.
- Change deployment configs in `_deploy/`. Restructure the directory layout.

### Never
- Change `.env` files or secrets (except `__dev__/.env*` at the workspace root).
- Force push. Expose sensitive information in logs or code.
- **Run `npm publish` by hand.** Only CI publishes, through the unified pipeline. A `version` bump pushed to `main` triggers it. See `docs/languages/js/publishing.md`

## Directory Map

Full layout: `docs/dev/org-structure.md`.

```
project-superloom/                 (workspace root)
  codebase-superloom/              - framework constitution: docs/, website/, AGENTS.md
  codebase-js-helper-modules/      - all JS helper modules + publish pipeline
    src/helper-modules-core/       -   Class A/B (js-helper-*)
    src/helper-modules-server/     -   Classes B-F (js-server-helper-*)
    src/helper-modules-client/     -   client modules (js-client-helper-*, js-react-helper-*, js-rn-helper-*, js-rnw-helper-*)
  codebase-rnw-components/         - RNW component library (published as @superloomdev/rnw-components)
  codebase-demo-client-rnw/        - demo client app (React Native Web)
  codebase-demo-server-js/         - demo server app (Express, entity modules, model, ops)
  __dev__/                         - personal workspace (plans/, secrets/; never committed)
  superloom.code-workspace         - multi-root workspace file
```

Each module has an entry file, `[name].config.js`, `[name].errors.js`, `[name].validators.js`, `_test/` (`loader.js` is the only env reader), `README.md` and `ROBOTS.md` (and an unpublished `THOUGHTS.md`). Skeletons: `docs/languages/js/module-structure.md`.

**The modules-repo root has no `package.json`, lockfile or `node_modules/`.** Modules are self-contained. Repo-wide tooling lives in CI job definitions. Permitted root content: `docs/dev/org-structure.md` - Repository Root Content.

## Workflow Inventory

| Command | Repo | Use when |
|---|---|---|
| `start or /adopt [create\|refresh\|new]` | superloom (use mode) | Adopt Superloom's principles into another project in its own idiom, verify that it stands alone, detach. Also refresh an adopted project or start a new one |
| `/js-helper-module [create\|fix] [path]` | js-helper-modules | Build new modules and fix existing ones, one module per run. `fix` is also the retrofit verb after a docs change |
| `/js-helper-module-audit [path]` | js-helper-modules | Read-only deep audit with creator-diff and three-bucket drift classification. Gives the findings to `/js-helper-module fix` |
| `/js-helper-module-publish [path]` | js-helper-modules | Pre-publish gate, CI registration, version bump and release |
| `/new-entity` | demo-server-js | Add a domain entity to the demo server application |
| `/demo-client-rnw` | demo-client-rnw | Pre-commit protocol and code quality for the demo RNW client |
| `/rnw-components` | rnw-components | Pre-commit protocol and code quality for the RNW component library |
| `/rnw-component [verb] [Name]` | superloom | Build one component of the generic RNW component library from its roster row (add or fix). Then give the batch gates to the execution tier |
| `/project-docs [create\|update\|audit]` | any product repo | Create, update or audit the management layer (PROJECT.md, feature ledger, CHANGELOG.md) per `docs/principles/project-management.md` |
| `/learn` | superloom | Capture conversation knowledge into its canonical doc. Gives the result to `/finalize-docs` |
| `/finalize-docs [check]` | superloom | After a docs or workflow change: validate to convergence, then propagate to the canonical AGENTS.md and embedded blocks. `check` reports only |
| `/compile-workflows-from-docs [repo] [lang]` | superloom | Compile the workflow families of an implementation repository again from archetypes and language docs. Verifies itself with a headless workshop |
| `/plan` | workspace root | Plan transitions (`new`, `next`, `done`, `revive`, `supersede`, `status`), mandatory sections, no-questions authoring contract |

- Workflow authoring standard (seven mandatory properties, embedded-block compile rule): `docs/ai/workflow-authoring.md`. Workflow archetypes (family pattern, compile rule): `docs/ai/workflow-archetypes.md`.
- Each workflow is written in the agent register (STE). When you reword a workflow, keep its headings, step numbers, gate names, commands and output templates.
- Model tiers: one lead and sidekick session is the default under the Fusion rules. `docs/ai/model-tiering.md`
- The lead writes each character of source, tests, specs, data and docs. It does the authoring and mutation steps of a workflow.
- The sidekick runs installs, builds, gates, probes, recipe publication steps and waits. It reports exit codes, counts, failing tests with expected and actual values, and artifact paths. It edits no file outside its scratch folder and deletes only files it created in the handoff. The lead reviews script output that the sidekick generates.
- The lead commits, because a commit message is authored content. The sidekick pushes, publishes, dispatches and watches CI.
- Fusion handoff checks: the lead stages its work and takes a snapshot of the repositories and the workspace folder before each handoff. The brief names the scratch folder and the declared script outputs. After the handoff, each change outside them is a sidekick write. Restore it. `docs/ai/model-tiering.md` - Fusion Handoff Checks
- Sidekick stop rules: run each step once. The same error twice stops that step, and the sidekick reports the exact error lines. It never edits a file or changes a command to make a step pass. It copies each identifier from command output.
- Bulk mechanical editing runs as a Low session or under named Lean Fusion. A run of an hour or more starts a fresh session. It never ends a long one. The `TIER`-tagged two-session hand-off applies only when no sidekick is available.
