# Superloom - AI Assistant Configuration

> ## GOLDEN RULE - READ FIRST
>
> **AGENTS.md is a derived, compact summary of `docs/`. Never edit AGENTS.md directly.**
>
> To change a rule:
> 1. Update the source-of-truth file in `docs/` (`principles/`, `languages/js/`, `ai/`, `dev/`, `ops/`)
> 2. Run `/finalize-docs` to validate and propagate into AGENTS.md
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
- **Testing:** `node --test` + `node:assert/strict` | **Linting:** ESLint 9+ flat config
- **Registry:** GitHub Packages (`@superloomdev` scope) | **Commits:** Conventional Commits | **Versioning:** SemVer
- **GitHub:** [github.com/superloomdev/superloom](https://github.com/superloomdev/superloom) | MIT License

## Documentation Map

Three layers under `docs/` (superloom repo). Full index: `docs/README.md`.

| Layer | Holds | Key files |
|---|---|---|
| `docs/principles/` | Universal rules + reasoning | `engineering-philosophy`, `code-readability`, `file-archetypes`, `module-design`, `error-handling`, `validation`, `testing`, `documentation-authoring`, `extending-to-a-language` |
| `docs/languages/js/` | The JavaScript way (complete, self-sufficient) | `index` (reading path + two-form naming), `code-formatting`, `module-structure` (all skeletons), `module-classes`, `error-handling`, `validation`, `module-docs`, `dependencies`, `publishing`, `server/`, `client/` (architecture, loader, theming, fonts, components, super-app, modules), `versioning/` |
| `docs/ai/` | AI-assisted development standards | `agent-configuration`, `workflow-authoring`, `workflow-archetypes`, `model-tiering` |

## AI Behavior Rules

- **At session start:** list `__dev__/plans/` by mtime at the workspace root, read the most recent plan, state plan + in-progress step, confirm with user. Use `/plan` for transitions. Full rules: `docs/dev/planning.md`
- Read a module's `README.md` before modifying it; **read `ROBOTS.md` before calling any module's functions** (compact signature reference)
- Always run tests before returning: `npm install && npm test` from the module's `_test/` directory
- **Two-pass check after any refactor touching 3+ functions:** Pass 1 logic + lint; Pass 2 re-read the full file (step comments, 3/2/1 spacing, banner widths, multi-line return objects, `};` combined with END banners, JSDoc indentation matching declarations), lint again. See `docs/languages/js/pitfalls-migration.md`
- **Skeleton conformance diff after any structural pass:** compare the module entry file element by element against its class skeleton in `docs/languages/js/module-structure.md`, including function bodies - the skeleton's worked body is normative for comment density. Fix lists, lint, and grep sweeps do not catch a missing step comment
- **Step-comment conformance on every function body:** each public I/O function carries the Mandatory Step-Comment Set (validate, init, driver calls, success returns, error returns, early-return branches); enforced at check time by the build/audit verify gates, never assumed from generation. See `docs/languages/js/code-formatting.md` - Comment Style
- **Assertions pin exact values:** never a range or disjunction multiple behaviors could satisfy; nondeterministic setup gets fixed, not the assertion. See `docs/principles/testing.md` - Test Structure and Naming
- **`performanceAuditLog`:** every call passes a local `start_ms` captured at operation entry (never `instance['time_ms']`, never a same-line timestamp); each interval logged once by the layer that owns the work - drivers (`nosql-*`, `sql-*`, `queue-*`, `storage-*`, `http`) instrument their own roundtrips; non-drivers never re-log delegated I/O
- **Two-form naming:** scope (`@superloomdev/...`) and bare (`js-...helper-...`) forms only in `package.json` and real repo-path URLs; the alias (`helper-...`) everywhere else. See `docs/languages/js/index.md`
- **Peer dependencies declare the full runtime contract:** every Superloom module consumed at runtime, including modules received only by injection through `shared_libs`, appears in `peerDependencies` with caret ranges (`^1.0.0`, never `>=`); `ROBOTS.md` and `docs/configuration.md` peer lists must match `package.json` exactly. See `docs/languages/js/dependencies.md`
- Module lifecycle operations (create, fix, audit, publish) go through the workflow family (`/js-helper-module`, `/js-helper-module-audit`, `/js-helper-module-publish`) - do not improvise the procedure
- Use `/learn` to capture new knowledge; run `/finalize-docs` after any docs change (validates to convergence, then propagates to AGENTS.md and embedded workflow blocks)
- Use Plan Mode for complex, multi-step, or risky changes; when stuck, attempt workarounds before asking; reuse existing terminals
- **Client module naming taxonomy:** runtime-tier prefixes (`js-helper-*`, `js-server-helper-*`, `js-client-helper-*`), framework-tier prefixes (`js-rw-helper-*`, `js-rn-helper-*`, `js-rnw-helper-*`), suffixes (`-ext-[framework]`, `-store-[backend]`, `-adapter-[name]`, `-template-[name]`); a module takes the lowest tier whose dependency budget it fits. See `docs/languages/js/client/client-modules.md`
- **Repository independence:** the constitution repo (superloom) never references dependent repos' workflows or internals; dependent repos reference superloom docs freely. See `docs/ai/agent-configuration.md` - Repository Independence

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
- **AWS SDK in tests needs dummy credentials** (`AWS_ACCESS_KEY_ID=local AWS_SECRET_ACCESS_KEY=local AWS_REGION=us-east-1` in the test script) or the SDK walks the EC2 metadata chain at 1-2s per call
- **Auto-run only read-only or idempotent commands.** Never auto-run `rm -rf`, force pushes, volume removals, publishes, or any state mutation, regardless of prior approvals
- **VitePress crashes on bare angle-bracket placeholders** in `docs/` prose (parsed as Vue elements; the reported line is far from the culprit). Use `[name]` in prose; ` ```text ` fences for copy-paste templates; build the site locally after touching rendered files. Pitfalls entry 15
- **E409 / checksum mismatch from GitHub Packages** is transient: wait 30-60s, clean install again; never `--legacy-peer-deps` (entry 21)

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
    src/helper-modules-client/     -   client modules (js-client-helper-*)
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
| `/learn` | superloom | Capturing conversation knowledge into its canonical doc; hands off to `/finalize-docs` |
| `/finalize-docs [check]` | superloom | After any docs or workflow change: validate to convergence, then propagate to AGENTS.md and embedded blocks. `check` = report-only |
| `/compile-workflows-from-docs [repo] [lang]` | superloom | Recompile concrete workflow families for an implementation repository from archetypes + language docs; self-verifies via headless workshop |
| `/plan` | workspace root | Long-horizon plan transitions (`show`, `new`, `step`, `done`, `backlog`, `next`) |

Workflow authoring standard (seven mandatory properties, embedded-block compile rule): `docs/ai/workflow-authoring.md`. Workflow archetypes (family pattern, compile rule): `docs/ai/workflow-archetypes.md`. Model-tier split and token discipline: `docs/ai/model-tiering.md`.
