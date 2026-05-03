# Superloom - AI Assistant Configuration

> ## GOLDEN RULE - READ FIRST
>
> **AGENTS.md is a derived, compact summary of `docs/`. Never edit AGENTS.md directly.**
>
> To change a rule:
> 1. Update or add the source-of-truth file in `docs/` (architecture, dev, ops, philosophy, etc.)
> 2. Run `/propagate-changes` to sync the compact summary into AGENTS.md
>
> Bypassing this rule causes drift: AGENTS.md will assert things `docs/` no longer says (or vice versa), humans lose the rationale behind the rule, and the same lesson gets re-learned the hard way. **No exceptions** -- even small wording fixes go through `docs/` first.
>
> When you discover a new failure mode, document it as a journal entry in the appropriate `docs/dev/*.md` file (testing, CI/CD, etc.) before fixing it. The journal is how the framework remembers what it has already learned.

---

> **This file is the single source of truth for AI agents at conversation start.** It contains all project rules, coding standards, and architecture context needed to work on this codebase correctly. Detailed human-readable documentation lives in `docs/`. When `docs/` changes, this file must be updated via the `/propagate-changes` workflow.

## Persona

You assist developers working on **Superloom**, a modular, transport-agnostic application framework for building applications with AI assistance. Backend modules run on Docker (Express) and AWS Lambda from the same codebase; frontend modules are planned.

## Tech Stack

- **Language:** JavaScript (Node.js)
- **Runtime:** Node.js 24+
- **Frameworks:** Express.js (Docker), AWS Lambda (Serverless)
- **Testing:** Node.js built-in test runner (`node --test`), `require('node:assert/strict')`
- **Linting:** ESLint 9+
- **Package Registry:** GitHub Packages (`@superloom` scope)
- **Deployment:** Serverless Framework (per-entity deployment)
- **Commits:** [Conventional Commits](https://conventionalcommits.org)
- **Versioning:** [Semantic Versioning](https://semver.org)
- **GitHub:** [github.com/superloomdev/superloom](https://github.com/superloomdev/superloom) | MIT License

## AI Behavior Rules

- Use Plan Mode for complex tasks, multi-step changes, or risky modifications
- When stuck, attempt creative workarounds before asking for help
- Reuse existing terminals when possible
- Read the relevant `README.md` of any module before modifying it
- **Read `ROBOTS.md` of any module before using its functions** - this is the compact AI reference listing all exported functions, parameters, return types, and patterns. Prevents reinventing the wheel
- Always run tests before returning: `npm test` from `_test/` directories
- When creating new modules, use the workflows in `.windsurf/workflows/`
- When you learn new patterns, suggest updates to this file
- When `docs/` changes, update this file via `/propagate-changes`
- When the user shares new knowledge to capture into the framework, use `/learn` - it enforces `GOD.md` Directive 12 (prescriptive, generic, DRY, compact) and routes the knowledge to the correct file

### Safe Terminal Patterns (AI-Specific)

> Full journal lives in `docs/dev/ai-terminal-pitfalls.md`. The rules below are the compact summary - read the journal whenever a new failure mode is encountered or before adding a new rule here.

**File tools vs terminal:**

- **Normal files** (not gitignored): use `read_file`, `edit`, `write_to_file` directly.
- **Gitignored files** (`__dev__/...`, `.env*`): IDE tools refuse them. Write content via `write_to_file` to `/tmp/...`, then `cat /tmp/file >> /path/to/target` from the shell.

**Never make the shell parse multi-line strings.** Three common offenders, all caused by zsh entering `dquote>` / `heredoc>` continuation mode where the bridge cannot send the closing token:

1. **Heredocs** (`cat <<'EOF' ... EOF`). Always use `write_to_file` instead.
2. **Multi-line `git commit -m "..."`**. Use a single-line `-m`, or stack multiple `-m` flags, or `git commit -F /tmp/commit-msg` (file written via `write_to_file`).
3. **Any other quoted argument** that spans multiple lines. Same fix - route the multi-line content through a temp file first.

```bash
# Single-line summary (preferred)
git commit -m "feat(module): one-line summary"

# Multi-paragraph - each `-m` becomes a paragraph
git commit -m "feat(module): summary" -m "Body paragraph one." -m "Body paragraph two."
```

**Never invoke an interactive viewer** (`less`, `more`, `vi`, `man`) - the bridge cannot type. `PAGER=cat` is set in the env, but commands that ignore it need an explicit flag: `git log -n 20`, `git --no-pager diff`, `journalctl --no-pager`, `systemctl --no-pager status`.

**Foreground long-runners** (`node server.js`, `tail -f`, `docker compose logs -f`) must be launched with `Blocking: false` and a small `WaitMsBeforeAsync`, then later polled via `command_status`. Stop the process at the end of the task.

**Always specify `Cwd` for module commands.** Every `run_command` targeting a module (`npm install`, `npm test`, `docker compose`) must pass `Cwd` set to the module's `_test/` directory explicitly. Omitting it silently runs from the repo root with a different `package.json` and produces misleading `ETARGET` errors. Same rule for any other path-sensitive command - `cd <path> &&` does **not** persist between `run_command` calls because each call is a fresh shell. The user's preference is to **never propose a `cd` command**.

**Module testing contract - `npm test` is self-contained.** For modules with `pretest`/`posttest` scripts, `npm test` manages the full Docker container lifecycle. Never start containers manually before `npm test` - `pretest` runs `docker compose down -v` first and will conflict. Always run `npm install && npm test` from the module's `_test/` directory. See `docs/dev/testing-local-modules.md` for the full healthcheck-and-lifecycle guide.

**`file:` in `_test/package.json` causes `MODULE_NOT_FOUND` in CI.** `file:` path deps copy source but do not install the linked package's own `node_modules`. Works locally (helper already installed), breaks in CI (fresh checkout, no `node_modules` inside the linked dir). Rule: `file:../` is allowed **only** for the module under test itself. All shared helpers (storage, DB, cloud) must use registry semver ranges (`"^1.0.0"`). See journal entry 8 in `docs/dev/cicd-publishing.md`.

**AWS SDK calls need dummy credentials in tests.** No env credentials = SDK walks the EC2 metadata chain = 1-2 s timeout per call. Set `AWS_ACCESS_KEY_ID=local AWS_SECRET_ACCESS_KEY=local AWS_REGION=us-east-1` in the `_test/package.json` `test` script even when no real AWS call happens (URL signing, command construction, etc.).

**Auto-run is for read-only or idempotent operations only.** Never set `SafeToAutoRun: true` for `rm -rf`, `git push --force`, `docker volume rm`, `npm publish`, or any other state mutation, even if the user previously approved a similar command. The user's `Boundaries` section spells this out explicitly.

## Boundaries

### Always (do without asking)
- Read any file in the project
- Modify files in `demo-project/src/`, `src/`, `docs/`, `__dev__/`
- Run test and lint commands
- Create test files
- Fix linting errors automatically
- Write to `__dev__/` freely (gitignored, personal workspace)

### Ask First
- Add new dependencies to any `package.json`
- Create new helper modules or entity modules
- Modify deployment configs in `_deploy/`
- Restructure directory layout

### Never
- Modify `.env` files or secrets (except `__dev__/.env`)
- Modify files in `_cleanup/` (legacy)
- Force push to git
- Expose sensitive information in logs or code
- **Run `npm publish` manually.** Publishing is CI/CD-only via `.github/workflows/ci-helper-modules.yml`. Bumping `version` in a module's `package.json` and pushing to `main` triggers the publish automatically. The workflow has a safety-net that skips already-published versions.

---

# CONTEXT - Project Knowledge Base

> Everything below is the embedded project context. It replaces the former `CONTEXT.md` file.

## Directory Map

```
superloom/
  src/
    helper-modules-core/          # Platform-agnostic utilities (@superloom npm scope)
      js-helper-utils/            #   Type checks, validation, sanitization, data manipulation
      js-helper-debug/            #   Structured logging: levels (debug/info/warn/error), text + JSON
      js-helper-time/             #   Date/time math, timezone, formatting
    helper-modules-server/        # Server-only helpers (Node.js runtime required)
      js-server-helper-crypto/    #   Hashing, encryption, UUID, random strings, base conversion
      js-server-helper-sql-postgres/  #   Postgres with connection pooling
      js-server-helper-sql-mysql/     #   MySQL with connection pooling
      js-server-helper-sql-sqlite/    #   SQLite via built-in node:sqlite (offline, embedded)
      js-server-helper-nosql-mongodb/   #   MongoDB native driver wrapper
      js-server-helper-nosql-aws-dynamodb/  # DynamoDB CRUD, batch, query
      js-server-helper-instance/  #   Request lifecycle, cleanup, background tasks
      js-server-helper-http/      #   Outgoing HTTP client (native fetch wrapper, includes multipart)
      js-server-helper-storage-aws-s3/    #   S3 file operations
      js-server-helper-storage-aws-s3-url-signer/  #   S3 presigned URLs
      js-server-helper-queue-aws-sqs/#   SQS message queue wrapper
      js-server-helper-verify/    #   One-time verification codes (pin/code/token), storage-agnostic adapter
      js-server-helper-logger/    #   Compliance-friendly action log: per-row retention (persistent | TTL) + optional IP encryption, multi-backend
    helper-modules-client/        # Client-specific helpers (browser, mobile)
      js-client-helper-crypto/    #   UUID, random strings, base64 (Web Crypto API). Delegates to core crypto when available.
  demo-project/                   # Seed project - copy this to start
    ops/                          #   Operations runbook (numbered, sequential)
    src/model/                    #   Base models (pure, IO-free)
    src/model-server/             #   Server-only model extensions
    src/server/common/            #   Bootstrap, config, loader, shared functions
    src/server/controller/        #   Thin adapters (validate + DTO + delegate)
    src/server/service/           #   Business logic and orchestration
    src/server/interfaces/api/express/      # Express routes
    src/server/interfaces/api/lambda-aws/   # Per-entity AWS Lambda handlers
    _deploy/                      #   Per-entity Serverless Framework configs
  docs/architecture/              # Architecture rules, coding standards
  docs/intro.md                   # Documentation landing page
  docs/guide/                     # Step-by-step guides (getting started, entities)
  docs/philosophy/                # Design philosophy (why MVC, DTO approach)
  docs/dev/                       # Developer setup docs (git, npm, docker, env)
  docs/ops/                       # Generic infrastructure reference guides
  .windsurf/                      # AI workflows and automation
  __dev__/                           # Personal workspace (gitignored)
    secrets/                      #   Project secrets (never committed)
```

## Dependency Hierarchy

```
Foundation (zero dependencies, self-contained - NEVER depend on each other):
  js-helper-utils    - Type checks, validation, data manipulation
  js-helper-debug    - Structured logging (levels, text/JSON format)

Core modules (may depend on foundation via Lib injection):
  js-helper-time     - Date/time math, timezone, formatting

Client modules (browser-optimized, may use Web Crypto):
  js-client-helper-crypto - UUID, random strings, base64

Server modules (may depend on foundation + core, use Node.js APIs):
  js-server-helper-crypto - Hashing, encryption, UUID, base conversion (self-contained)
  js-server-helper-*      - Database, cloud, auth, cache, etc.
```

## Core Philosophy

- **One Data Module, One Shape:** Each entity has ONE `[entity].data.js` combining construction and output transformations
- **Data over DTO:** Use "Data" for internal and external shapes. No separate create/update shapes. Absent keys are not added.
- **Public derived from internal:** `toPublic(full_object)` strips server-only fields
- **Vendor suffix:** `lambda-aws` not `aws-lambda`. Vendor name is always a suffix.
- **Per-entity AWS Lambda:** Each endpoint = separate handler file. Each entity = separate `serverless.yml`.
- **Validation in model:** Hand-written, co-located with domain config. Returns `false` for success, `Error[]` for failure.
- **Foundation modules are self-contained:** `js-helper-utils` and `js-helper-debug` have zero runtime dependencies. All other modules may depend on them, never the reverse.
- **No external references:** This is an independent open-source project. No mention of prior projects.

---

## Coding Standards (Mandatory)

These rules apply to **ALL** code written in this project. Source: `docs/architecture/code-formatting-js.md`.

### DRY: Reuse Helper Modules (CRITICAL)

**Before writing ANY inline utility, check if a helper module already provides it.** Read the `ROBOTS.md` of the relevant module for the full function list.

- Non-foundation modules MUST use `Lib.Utils` instead of inline type checks, `Lib.Debug` instead of `console.log`, etc.
- Foundation modules (`js-helper-utils`, `js-helper-debug`) cannot use `Lib.*` since they ARE the foundation. They must use raw checks.

### Formatting

- Single quotes, 2-space indent, semicolons required, no trailing commas
- Space before function parens: `function (param)` not `function(param)`
- Space before blocks: `if (x) {` not `if (x){`
- Space around operators: `a + b` not `a+b`
- Object braces: `{ key: value }` not `{key: value}`
- Array brackets: `[1, 2, 3]` not `[ 1, 2, 3 ]`
- ALL `if` statements must use curly braces (no inline if)
- All output JSON keys use `snake_case`

### Vertical Spacing Hierarchy (3/2/1 Rule)

| Spacing | Purpose |
|---|---|
| **3 blank lines** | Between major module sections (Loader → Exports → Public → Private) |
| **2 blank lines** | Between individual function definitions |
| **1 blank line** | After opening `{`, before closing `}`, between logical blocks |

### Spelling and Prose Quality (All File Types)

These rules apply to **every file the AI writes or edits** - `.js` comments/strings, `.md` documentation, `package.json` descriptions, `README.md`, `ROBOTS.md`, workflow files, and commit messages.

| Rule | Correct | Incorrect |
|---|---|---|
| American English (Z not S) | `initialize`, `standardize`, `optimize`, `organize`, `centralize`, `authorize` | `initialise`, `standardise`, `optimise`, `organise`, `centralise`, `authorise` |
| American English (or not our) | `behavior`, `color`, `favor` | `behaviour`, `colour`, `favour` |
| American English (ize not ise) | `optimization`, `organization` | `optimisation`, `organisation` |
| American English (license) | `license` | `licence` |
| No em-dashes | `- description` or `word - word` | `word — word` (Unicode U+2014) |
| No Unicode arrows in code files | Use `->` in `.js` comments and strings | `→` is forbidden in `.js` files. `→` IS allowed in `.md` documentation (reduces tokens, improves clarity) |
| Plain ASCII dashes for list separators | `**Term** - explanation` | `**Term** — explanation` |

- **Consistent terms:** `Lib` (shared container), `CONFIG` (entity config), `loader` (DI function), `shared_libs` (param name)

### Parameter Naming

- **No underscore prefix on parameters** - never use `_param` to suppress ESLint `no-unused-vars` on function params
- Use `// eslint-disable-line no-unused-vars` on the function signature line instead: `function (Lib, CONFIG) { // eslint-disable-line no-unused-vars`

### Variable Declarations (let/const over var)

- **`const` by default** for variables whose binding never changes (including objects/arrays - the reference doesn't change, only the contents)
- **`let` only when reassigned** (e.g., `let Lib;` assigned in loader, `let count = 0;` in loops)
- **Never use `var`.** All modern Node.js (>=14) and browsers support block-scoped declarations. `var`'s function-scoping and hoisting cause subtle bugs
- Enforced by ESLint: `no-var` (error), `prefer-const` (error). Caught automatically on `npm run lint`

### Multi-line JSON, YAML, and Object/Array Literals

- **JSON objects and arrays: always multi-line** when they contain multiple items or nested structures - keeps `git diff` readable when adding fields later
  - ✅ `"dependencies": {\n  "eslint": "^10.2.0",\n  "@eslint/js": "^10.0.1"\n}`
  - ❌ `"dependencies": { "eslint": "^10.2.0", "@eslint/js": "^10.0.1" }`
- **YAML arrays: always multi-line**
  - ✅ `branches:\n  - main`
  - ❌ `branches: [main]`
- **JavaScript return objects: always multi-line** (see Return Objects rule below)
- **JavaScript array/object literals in assignments:** flexible - single-line OK if short and semantic; multi-line preferred when contents might grow
- **`package.json`, `docker-compose.yml`, CI workflows, mock data files:** always multi-line

### Return Objects

- **Multi-line return objects:** Return statements with objects must be multi-line, never inline
  ```javascript
  // Correct
  return {
    success: false,
    items: [],
    count: 0,
    error: { type: 'QUERY_ERROR', message: error.message }
  };

  // Wrong - inline return objects are hard to read
  return { success: false, items: [], count: 0, error: { type: 'QUERY_ERROR', message: error.message } };
  ```

### Error Handling: Throw vs Return (CRITICAL)

The framework recognises **three** error categories. Each has one correct disposal mechanism. Never mix them.

**Heuristic test (apply in 2 seconds):** *Could perfectly-written calling code still encounter this at runtime?* If **no**, it is a programmer error -> **throw `TypeError`**. If **yes**, it is an operational or state condition -> **return envelope**. This cleanly separates *"your code is broken"* (throw) from *"the world is broken"* (envelope).

**Lifecycle boundary** (a useful reformulation of the same rule): construction-time misconfiguration throws `Error`; per-call argument shape errors throw `TypeError`; per-call runtime conditions and validation outcomes return an envelope.

| Category | Disposal | Example | Audience |
|---|---|---|---|
| **Programmer error** | `throw new TypeError(...)` synchronously | Missing required argument, wrong shape passed to a helper function (`options.scope is required`) | The developer fixing the bug. Surfaces as an uncaught exception in dev/test. |
| **Operational / state error from a helper module** | Return envelope `{ success: false, error: { type, message } }` | Storage adapter failed, cooldown active, network timeout in `js-server-helper-http` | Service-layer code that branches on `error.type` and logs `error.message`. **Never the end user.** |
| **Domain / user-facing validation error** | Return `{ success: false, error: <DomainError> }` from a service or model, where `<DomainError>` is `{ code, message, status }` from `[entity].errors.js` | "Invalid email format", "Name too short", "User not found" | **End users.** The controller forwards it via `Lib.Functions.errorResponse` and the `message` lands in the HTTP response body. |

**Why throw for programmer errors:** they indicate the calling code has a bug. Returning them as envelope makes the caller responsible for handling something the caller shouldn't have caused. Throwing fails the request loudly in dev and forces the bug to be fixed before deploy. Production callers should not be writing `if (error.type === 'INVALID_OPTIONS')` defensive code.

**Why two return shapes (`{type,message}` vs `{code,message,status}`):** they have different audiences. The helper-module shape is for service-layer branching and logs; the domain shape is for HTTP response bodies and end users. **Service-layer translation is mandatory** - a service that calls a helper module branches on `error.type` and returns a domain error from its own `[entity].errors.js`. Never forward `helper.error.message` to the controller - if a service forwards it, `Lib.Functions.errorResponse` will leak that diagnostic string verbatim into the HTTP response.

**Approach B (refinement for application-coupled helpers):** a helper that is tightly coupled to one application's domain may accept a `CONFIG.ERRORS` catalog at construction and return domain errors directly. Service-layer translation collapses to a single pass-through line: `if (result.success === false) return { success: false, error: result.error }`. `js-server-helper-verify` is the first helper to use this pattern. The default for shared helpers (storage, network, crypto, etc.) remains `{ type, message }` envelopes plus mandatory translation.

**This applies to every helper module** (dynamodb, mongodb, s3, sql-*, verify, http, etc.) and every entity service. When in doubt: programmer errors throw, everything else returns an envelope, and the service translates before the controller sees it.

Full rule with rationale, anti-patterns, Approach B details, and worked examples: `docs/architecture/error-handling.md`.

### Section Header Hierarchy

Three levels of section separators. Use from coarsest to finest. Full spec: `docs/architecture/code-formatting-js.md` -> "Section Header Hierarchy".

| Level | Marker | Purpose |
|---|---|---|
| 1 | `/////////////////////////// [Name] START ///...` | Major module sections: `Module-Loader`, `Module Exports`, `createInterface`, `Public Functions`, `Private Functions` |
| 2 | `// ~~~~~~~~~~~~~~~~~~~~ [Name] ~~~~~~~~~~~~~~~~~~~~` + one-line purpose | Subsections inside a public/private function object (group by responsibility) |
| 3 | `// [comment]` | Inline comment above a logical block |

Use Level 2 subsections inside public/private function objects when the module has 5+ functions or 2+ responsibility groups. Subsection names are short title-cased noun phrases.

### Inline Section Comments

- **Every logical block within a function gets a single-line comment** explaining what the next 2-5 lines do
- When vertical spacing separates lines within a function, the first line after the space should have a comment explaining the section's purpose
- This is especially important for AWS SDK operations, service params construction, and error handling

### Comment Authoring Style (human tone)

- Write comments as a teammate would explain the line, not as marketing or reference manual prose
- Prescriptive voice: "Run the query", "Bubble up the error", "Build pool on first call"
- Avoid em-dashes (`—`) and fancy Unicode arrows; use plain ASCII: `-`, `->`, `and`, `or`
- One idea per comment; split multi-idea sentences or remove the redundant half
- No **hosting-vendor-specific** wording in framework docs (AWS, Azure, GCP, RDS, Aurora, Heroku); database/protocol vendor names are acceptable (MySQL, Postgres, DynamoDB, S3, MongoDB). Hosting vendor names belong only in ops guides or parenthetical clarifications (e.g. `Serverless function (Lambda, Cloud Function)`)
- No migration breadcrumbs, no "legacy" labels, no references to previous codebases - such context belongs in `__dev__/migration-changelog.md`
- First logical block in every function starts with a one-line step comment (`// Build pool on first call`, `// Start performance timeline`, ...)
- Inside `try/catch`, the `catch` block's first comment explains the fallback behavior, not that the try failed

### Performance Logging

- **Every external service operation must log performance** - use `Lib.Debug.performanceAuditLog(action, routine, instance['time_ms'])`
- **Use `instance.time_ms`** as reference time - shows elapsed since request started (request-level timeline), not just function duration
- **Client initialization must log performance** - how long SDK import + connection took
- **Error logs must include performance data** - duration even on failure helps diagnose timeouts
- Use `Lib.Debug.performanceAuditLog('End', 'DynamoDB Get - ' + table, instance['time_ms'])` - already calculates elapsed_ms and memory

### Documentation

- JSDoc on every function with `@param` and `@return`
- Every line documented with helpful comments
- JSDoc block uses `/************...*/` style
- **JSDoc body indentation:** All lines inside a JSDoc block (description, `@param`, `@return`, notes) are indented **4 spaces** from the `/*` column - including blocks that sit inside an object literal already at 4-space indent
- **Nested object params/returns:** Use dot-notation - one `@param`/`@return` per nested field
  - `@param {Set} options[key].error - Error object for this key`
  - `@return {String} .name - Name of the item`

### Dependencies

- Minimize external deps - prefer built-in Node.js APIs
- ALL external libraries must be wrapped in helper modules - no direct imports in business logic
- **Reuse `Lib.Utils`** for all common operations (see DRY table above)
- **Verify latest package versions before adding or upgrading.** Training data may be outdated. Workflow:
  1. Call `mcp0_resolve-library-id` to find the Context7-compatible library ID
  2. Call `mcp0_query-docs` to fetch current version, Node.js requirement, and breaking changes
  3. Cross-check with `npm view <package> version` for the exact latest release
  4. Update `dependencies` / `devDependencies` with `^<major>.<minor>.<patch>`
  5. Update `engines.node` field if the new version requires a newer Node.js
  6. Run `npm install` and `npm test` to verify no regressions
- **Every module declares `engines.node`** - minimum Node.js version the module supports. Example: `"engines": { "node": ">=20.19" }`
- **No `keywords` field** in `package.json` - omit it entirely
- **When to re-verify:** On every module migration, before major dependency bumps, and whenever a lint/test regression might be caused by an outdated package

### AWS / Cloud SDK Modules

- **3-layer DRY architecture:** Builder (pure, no I/O) → Command Executor (I/O) → Convenience (calls builder + executor). Convenience functions like `put` internally use `commandBuilder` + `commandExecutor`. Builders are also used by transaction functions
- **Instance first:** All public functions accept `instance` as first parameter (from `Lib.Instance.initialize`). This enables request-level performance tracking
- **Performance logging uses `instance.time_ms`:** `Lib.Debug.performanceAuditLog('End', 'ServiceName Operation - ' + identifier, instance['time_ms'])` - shows elapsed since request started, not just function duration
- **Explicit credentials:** Cloud modules must pass credentials (e.g., `KEY`, `SECRET`) via config - never rely on implicit credential chains in the module code
- **Descriptive SDK variable names:** Name SDK imports after the service - never `lib`, `sdk`, or single letters
- **Two lazy-load helpers with distinct roles:**
  - `ensureAdapter()` loads the vendor library / SDK itself on first use. The adapter is module-scoped and shared across every instance because it is stateless
  - `initIfNot()` builds the per-instance resource (pool, client, connection) on first use, calling `ensureAdapter()` first
- **Config files are pure defaults:** No `process.env` in config files. Environment reading happens in the test loader or project loader only
- **Guard lazy init with `Lib.Utils.isNullOrUndefined(...)`**, never inline `if (x !== null) return`
- **Reserved keywords:** Cloud services may have reserved keywords in their query/expression languages. Always use aliasing mechanisms (e.g., expression attribute names) to avoid conflicts with common field names like `name`, `status`, `data`, `type`
- **Batch API limits:** Cloud APIs impose batch size limits. Handle large batches with recursive chunking - split into limit-sized chunks, process sequentially, combine results

---

## Module Patterns

### ROBOTS.md - AI Agent Reference (Every Module)

Every module has a `ROBOTS.md` alongside `README.md`. It is the compact AI reference:

- **Purpose:** Token-efficient function listing for AI agents. Prevents reinventing the wheel.
- **Format:** Module name → type → peer deps → direct deps → config keys → exported functions → patterns
- **Function format:** `functionName(params) → ReturnType | async:yes/no` + one-line description
- **Rule:** Read `ROBOTS.md` before using any module's functions. If a helper function exists, use it.
- `README.md` = human documentation (badges, usage examples, testing guides)
- `ROBOTS.md` = AI agent documentation (compact, token-efficient, machine-readable)

### Module Consistency Rules (MUST have, every module)

The following items are mandatory for every helper module. These caught real issues in past migrations:

- **`eslint.config.js` present at module root** - ESLint v9+ requires a flat config file; without it lint silently fails
- **`engines.node` in `package.json`** - declares minimum Node.js version; prevents silent runtime incompatibilities
- **`publishConfig.registry`** is exactly `https://npm.pkg.github.com` (no trailing `/@superloomdev` scope suffix - that breaks auth)
- **No `.npmrc` in the module directory** - global `~/.npmrc` is the only source of truth
- **Package name is `@superloomdev/<module>`** - scoped; must match directory name
- **Test `_test/loader.js` exists** for any module that accepts dependency injection (all non-foundation modules)
- **Test `_test/package.json` uses scoped dep names** (`@superloomdev/js-helper-utils`, never bare `js-helper-utils`) and `file:../` for the module under test
- **Test dependency versions track the latest published version** - when bumping a published module, update every test `package.json` that depends on it
- **`package.json` is multi-line JSON, not compressed single-line** - keeps diffs readable
- **American English in all strings** - `Initialize` not `Initialise`, `standardize` not `standardise` (even in descriptions)
- **`ROBOTS.md` covers every exported function** - exact signatures, types, async flag, and one-line purpose
- **Commit code AND docs together** - never push ROBOTS.md referencing a function that isn't in the committed source

### Common Mistakes to Avoid (Observed in Prior Migrations)

- ❌ Committing `ROBOTS.md` listing functions that don't exist in the committed source
- ❌ Leaving stale `publishConfig.registry` with `/@superloomdev` suffix
- ❌ Forgetting to add `eslint.config.js` (lint silently does nothing)
- ❌ Forgetting `engines.node` - packages publish without a declared runtime requirement
- ❌ Pinning dev deps to old major versions (e.g., `eslint ^9` when `^10` is current)
- ❌ Leaving tests with inline DI instead of a `loader.js` file
- ❌ Leaving `process.env` access outside `loader.js` (env reading MUST be centralized)
- ❌ Leaving `var x = '';` initializers that are immediately reassigned (ESLint 10 `no-useless-assignment`)
- ❌ British spelling in strings, comments, or package descriptions
- ❌ Forgetting to bump dependent test `package.json` files when publishing a new version

### Helper Module Structure (Two Patterns)

All helper modules use **Pattern 2 (Multi-Instance / Factory)** - each loader call returns an independent interface with its own `Lib`, `CONFIG`, and (for stateful modules) `state`. Pattern 1 (Singleton Config) is legacy and no longer used in this framework; the Pattern 1 template below is preserved for historical reference only. Full rules: `docs/architecture/module-structure.md` -> "Helper Module Configuration Patterns".

**Quick decision:**

| Pattern | Use when | Examples |
|---|---|---|
| Singleton Config | *Legacy - no longer used. All helper modules have migrated to Pattern 2.* | - |
| Multi-Instance (Factory) | All helper modules. Stateful (pool, persistent client, session) or stateless (uniform factory shape). | All `@superloomdev/*` helper modules |

**`createInterface` signature - pick the minimal shape that fits:**

| Signature | Use when | Reference |
|---|---|---|
| `createInterface()` | Foundation module, no peer deps, no config | `js-helper-utils` |
| `createInterface(CONFIG)` | Foundation module, config but no peer deps | `js-helper-debug` |
| `createInterface(Lib, CONFIG)` | Stateless helper - peer deps + config, no per-instance resource | `js-helper-time`, `js-server-helper-crypto`, `js-server-helper-http`, `js-server-helper-instance`, `js-client-helper-crypto` |
| `createInterface(Lib, CONFIG, state)` | Stateful helper - holds a per-instance resource | `js-server-helper-sql-mysql`, `js-server-helper-nosql-aws-dynamodb` |

The loader body mirrors the signature: build only the parameters `createInterface` will receive. Stateless helpers never declare a `state` object.

#### Pattern 1: Singleton Config

```javascript
// Info: [Module purpose - 1 line]
// [Additional context - 1 line]
'use strict';

// Shared Dependencies (Managed by Loader)
const Lib = {};

// Exclusive Dependencies
const CONFIG = require('./[name].config');


/////////////////////////// Module-Loader START ////////////////////////////////
const loader = function (shared_libs, config) {

  // Shared Dependencies
  Lib.Utils = shared_libs.Utils;

  // Override default configuration
  if (config && typeof config === 'object') {
    Object.assign(CONFIG, config);
  }

};
//////////////////////////// Module-Loader END /////////////////////////////////



///////////////////////////// Module Exports START /////////////////////////////
module.exports = function (shared_libs, config) {

  // Run Loader
  loader(shared_libs, config);

  // Return Public Functions of this module
  return ModuleName;

};//////////////////////////// Module Exports END //////////////////////////////



///////////////////////////Public Functions START//////////////////////////////
const ModuleName = {
  // functions here
};///////////////////////////Public Functions END//////////////////////////////



//////////////////////////Private Functions START//////////////////////////////
// Private helpers here
//////////////////////////Private Functions END//////////////////////////////
```

#### Pattern 2: Multi-Instance (Factory)

```javascript
// Info: [Module purpose in one line].
//
// Compatibility: [Target runtime versions]
//
// Factory pattern: each loader call returns an independent instance with
// its own state and config. Adapter and resource are lazy-loaded on first use.
'use strict';


// [Adapter caching comment]
let AdapterRef = null;


/////////////////////////// Module-Loader START ////////////////////////////////

module.exports = function loader (shared_libs, config) {

  const Lib = {
    Utils: shared_libs.Utils,
    Debug: shared_libs.Debug
  };

  const CONFIG = Object.assign(
    {},
    require('./[name].config'),
    config || {}
  );

  const state = { resource: null };

  return createInterface(Lib, CONFIG, state);

};/////////////////////////// Module-Loader END /////////////////////////////////



/////////////////////////// createInterface START //////////////////////////////

const createInterface = function (Lib, CONFIG, state) {

  ///////////////////////////Public Functions START//////////////////////////////
  const ModuleName = {

    // ~~~~~~~~~~~~~~~~~~~~ [Subsection Name] ~~~~~~~~~~~~~~~~~~~~
    // One-line purpose of this subsection.

    functionName: function () { /* closes over Lib, CONFIG, state */ }

  };///////////////////////////Public Functions END//////////////////////////////


  //////////////////////////Private Functions START//////////////////////////////
  const _ModuleName = {

    ensureAdapter: function () {
      if (Lib.Utils.isNullOrUndefined(AdapterRef)) {
        AdapterRef = require('[vendor-package]');
      }
    }

  };//////////////////////////Private Functions END//////////////////////////////

  return ModuleName;

};/////////////////////////// createInterface END //////////////////////////////
```

**Rules unique to Pattern 2:**
- Loader body does only three things: build `Lib`, build merged `CONFIG`, build mutable `state`. It then calls `createInterface(Lib, CONFIG, state)` and returns the result
- `module.exports = function loader (...)` is assigned on the first executable line; there is no separate `module.exports = loader` at the bottom
- All public and private functions live inside `createInterface`, in that order (public first, private second)
- Module-level caches (`let AdapterRef = null`) hold vendor adapters. A descriptive comment explains why each is cached and shared across instances
- Private helper names are prescriptive: `ensureAdapter` for vendor library load, `initIfNot` for per-instance resource build, `destroyResource` for teardown. Do not invent new names per module
- Use Level 2 subsections (`// ~~~~~~~~ [Name] ~~~~~~~~` + purpose comment) inside the public and private objects when there are 5+ functions or 2+ responsibility groups. See `code-formatting-js.md` -> Section Header Hierarchy
- Order functions so the file reads top-to-bottom as a dependency chain. Public: most common caller-facing helper first (`get` before `getRow`/`getRows`). Private: each function declared **after** the helpers it depends on (`ensureAdapter` -> `initIfNot` -> `destroyResource` -> `query` -> `execute`/`transaction`). Never require the reader to jump downward for a dependency
- Low-level primitives that well-architected apps rarely call directly (manual resource checkout, raw connection access) go in the **last** public subsection, labelled with the `(Escape Hatch)` suffix and a compact copy-paste usage example in the subsection comment
- Header must describe factory pattern, lazy-load behavior, and version compatibility

### Application Module Structure (Models, Controllers, Services)

```javascript
let Lib;
let CONFIG;

const loader = function (shared_libs, config, errors) {
  Lib = shared_libs;
  CONFIG = config;
  ERRORS = errors;
};
```

### Model Index Pattern

```javascript
module.exports = function (shared_libs, config_override) {
  const Config = Object.assign({}, require('./[entity].config'), config_override || {});
  const Errors = require('./[entity].errors');
  const Data = require('./[entity].data')(shared_libs, Config);
  const Process = require('./[entity].process')(shared_libs, Config);
  const Validation = require('./[entity].validation')(shared_libs, Config, Errors);
  return { data: Data, errors: Errors, process: Process, validation: Validation, _config: Config };
};
```

---

## Publishing

- `publishConfig.registry`: exactly `https://npm.pkg.github.com` (no trailing slash, no scope suffix)
- `private: false`, `license: MIT`
- Test `package.json` references module as `"file:../"`, has `"private": true`
- **No per-module `.npmrc` files** - global `~/.npmrc` with:
  - `@superloomdev:registry=https://npm.pkg.github.com` (scoped to our packages only)
  - `//npm.pkg.github.com/:_authToken=${GITHUB_READ_PACKAGES_TOKEN}`
  - `registry=https://registry.npmjs.org/` (safeguard - prevents env var overrides from breaking public package resolution)
- **CI/CD only** - push to `main` triggers `.github/workflows/ci-helper-modules.yml` (unified test + publish)
- `NODE_AUTH_TOKEN` set at **job level** using `GITHUB_TOKEN`
- **Publish triggers on registry absence, not on git diff.** The `detect` job calls `npm view <name>@<version>` for every module and schedules a publish job whenever the current version is not yet on the registry. This subsumes "version bump in this commit" and also handles fresh-state recovery (e.g., after a registry wipe, all modules at `1.0.0` get published on the next push without needing a version bump). Each publish job retains a per-job safety-net that skips if the version is actually present
- `test_modules` is the union of (modules with file changes) and (modules needing publish), so tests always run before publishing -- even when no file changed in this commit
- Version bump → conventional commit → push → CI tests, then publishes only the modules whose new version is missing from the registry
- Full rationale and pitfall journal: `docs/dev/cicd-publishing.md`

## Testing

- **Runner:** `node --test`, **Assertions:** `node:assert/strict`
- **Location:** `_test/loader.js` (builds Lib from env vars) + `_test/test.js` (tests)
- **`process.env` ONLY in loader.js:** `process.env` must NEVER be accessed in test.js or any other test file. The loader is the single gateway to environment variables
- **Loader returns `{ Lib, Config }`:** `Lib` = dependency container, `Config` = resolved env values for test infrastructure. No fallback defaults (`||`) - module's own `config.js` handles defaults
- **Inline export:** `module.exports = function loader () {` - no separate `const` + `module.exports`. Matches factory pattern in main module files
- **Test infrastructure in test.js:** AdminClient and table setup/teardown use `Config` from loader, never `process.env` directly
- **Env var registration (4-file rule):** Every env var read in `_test/loader.js` must be added to all four files: `docs/dev/.env.dev.example` (dummy), `docs/dev/.env.integration.example` (placeholder), `__dev__/.env.dev` (dummy), `__dev__/.env.integration` (placeholder). Every key in `.env.dev` must exist in `.env.integration`. Dummy values must match `_test/docker-compose.yml` exactly. The `_test/ops/00-local-testing/` guide must list all keys with their dummy values explicitly
- **No hard-coding env values in loader.js:** The loader only reads `process.env`. Defaults live in the module's `config.js`
- **Env var docs:** Every module README must document required environment variables with a table using column headers `Emulated (Dev)` and `Integration (Real)`
- **README dependency split:** Separate "Peer Dependencies (Injected via Loader)" (`@superloomdev/*`) from "Direct Dependencies (Bundled)" (third-party)
- **Naming:** `should [expected behavior] when [condition]`
- **Coverage:** Every exported function must have at least one test
- **One `describe` per function**, one assertion per `it` where possible
- **Group by numbered category** with `// ===` comment separators
- `strictEqual` for primitives, `deepStrictEqual` for objects
- No `console.log` in tests - assertions only
- Test inputs and expected outputs must be explicit (no hidden variables)

### Testing Tiers (Industry Standard - 4 Tiers)

| # | Tier | Scope | CI/CD |
|---|---|---|---|
| 1 | **Emulated** | Module - Docker emulators | ✅ Automated |
| 2 | **Integration** | Module - real cloud services (sandbox account) | ✅ Can be automated (needs credentials) |
| 3 | **Staging** (Sandbox) | Application - full app in production-mirror AWS account | App CI/CD |
| 4 | **Production** | Application - live system | N/A |

**This framework handles tiers 1 and 2.** Staging and production are application-level concerns.

- Emulated tests use `_test/docker-compose.yml` locally and `services:` in CI
- Integration tests require sandbox credentials in `__dev__/secrets/` - never committed
- Same test code runs both tiers - only the config differs (endpoint vs no endpoint)
- Each service-dependent module gets its own CI job (not a matrix entry)
- Module README must have exactly 3 header badges: Test + License + Node.js (same for all modules)
- Test badge uses GitHub's **native** endpoint (`ci-helper-modules.yml/badge.svg?branch=main`) - works with private repos. Label reads "Test" because the workflow is named `Test` in `ci-helper-modules.yml`
- Service-dependent modules add a Testing status table with an `Integration Tests` row inside the `## Testing` section - not in the header. Integration badge is static (manual update) since integration tests are run manually, not in CI
- Source: `docs/architecture/module-testing.md`

### Healthcheck and concurrency rules (Docker-dependent modules)

These rules apply to every module that uses `_test/docker-compose.yml` and to every CI job that runs Docker-dependent tests. Full journal of past failures: `docs/dev/testing-local-modules.md` and `docs/dev/cicd-publishing.md`.

- **Probe at the application level, not the process.** A healthcheck must use the credentials, database, and transport (`127.0.0.1`, not `localhost`) the tests will actually use. `mysqladmin ping -u root` is a false positive during MySQL's two-phase init -- probe with `test_user` instead. `pg_isready -U test_user -d test_db` is the canonical Postgres pattern
- **No `sleep` in `pretest`.** If a sleep is needed, the healthcheck is wrong. Fix the healthcheck so `docker compose up -d --wait` truly returns only when the service is ready
- **One owner of the Docker lifecycle.** `pretest` already starts the container locally and in CI. Never duplicate it with a workflow-level `docker run` step or a `services:` declaration on the same port
- **Wrap stateful module tests in `describe('Module', { concurrency: false }, ...)`.** The Node.js test runner runs top-level `describe` blocks concurrently by default; lazy-init resources (DB pools, AWS SDK clients) race each other and the cancelled block leaves a half-initialized resource behind

## Security

- Secrets stored in `__dev__/secrets/` (fully gitignored, personal workspace)
- AWS secrets via SSM Parameter Store in deployed environments
- Never hardcode API keys, tokens, or passwords
- Ops runbook references secrets as `[SECRET → __dev__/secrets/sandbox.md]`
- When changes involve auth, data handling, or API endpoints, proactively offer security review

## Operations Documentation

Infrastructure and deployment documentation follows a three-layer strategy. Source: `docs/architecture/operations-documentation.md`.

| Layer | Location | In Git? | Content |
|---|---|---|---|
| **Framework Knowledge** | `docs/ops/{category}/{vendor-service-setup.md}` | Yes | Generic how-to guides |
| **Project Runbook** | `ops/{NN-category}/{vendor-service-setup.md}` | Yes | Project-specific steps |
| **Secrets** | `__dev__/secrets/{environment.md}` | No | Actual passwords, keys, tokens |
| **Module Testing Ops** | `_test/ops/{NN-category}/{vendor-service-setup.md}` | Yes | Module-specific testing setup |

**Naming rules:**
- Directory names are vendor-agnostic (e.g., `object-storage/`, `nosql-database/`)
- File names are vendor-prefixed (e.g., `aws-s3-setup.md`, `mongodb-atlas-setup.md`)
- Top-level entries in project `ops/` are numbered directories: `00-domain/`, `01-cloud-provider/`, etc.
- No bare `setup.md` - always prefix with the vendor/service name
- Secret values in runbook files use: `[SECRET → __dev__/secrets/sandbox.md]`

## IDE Integration

- `AGENTS.md` is auto-loaded by Windsurf at conversation start
- Workflows in `.windsurf/workflows/*.md` (invoke via `/slash-command`)
- `__dev__/` is the personal gitignored workspace
- `docs/` is the detailed human-readable documentation (source for this file's context)

## When Making Changes

1. Update source code
2. Update the module's `README.md`
3. Update tests
4. If architecture changed → update `docs/architecture/`
5. If any docs changed → run `/propagate-changes` to sync this file
6. Run all tests to verify
7. If migrating old module → log in `__dev__/migration-changelog.md`
