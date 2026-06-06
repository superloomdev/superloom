# Superloom - AI Assistant Configuration

> ## GOLDEN RULE - READ FIRST
>
> **AGENTS.md is a derived, compact summary of `docs/`. Never edit AGENTS.md directly.**
>
> To change a rule:
> 1. Update the source-of-truth file in `docs/` (foundations, modules, dev, testing, versioning, ops)
> 2. Run `/compile-agents-md sync` to propagate into AGENTS.md
>
> Bypassing this rule causes drift: AGENTS.md asserts things `docs/` no longer says. Humans lose rationale. The same lesson gets re-learned the hard way. **No exceptions.** Even small wording fixes go through `docs/` first.
>
> When discovering a new failure mode, document it in the correct pitfall file BEFORE fixing:
> - `docs/dev/pitfalls.md` - terminal, CI, and testing failures
> - `docs/testing/migration-pitfalls.md` - module migration failures

---

> **This file is the single source of truth for AI agents at conversation start.**
> Detailed docs live in `docs/`. Update via `/compile-agents-md` when docs change.

## Persona

Assist developers working on **Superloom**, a modular application framework built to run anywhere. Currently implemented in JavaScript. Backend runs on Docker (Express) and AWS Lambda; frontend planned. The architecture is language-agnostic; Python and other runtimes are a future expansion.

## Tech Stack

- **Primary Language:** JavaScript (Node.js 24+)
- **Frameworks:** Express.js (Docker), AWS Lambda (Serverless)
- **Testing:** Node.js built-in test runner (`node --test`), `require('node:assert/strict')`
- **Linting:** ESLint 9+ (flat config required)
- **Package Registry:** GitHub Packages (`@superloomdev` scope)
- **Deployment:** Serverless Framework (per-entity)
- **Commits:** [Conventional Commits](https://conventionalcommits.org)
- **Versioning:** [Semantic Versioning](https://semver.org)
- **GitHub:** [github.com/superloomdev/superloom](https://github.com/superloomdev/superloom) | MIT License

## AI Behavior Rules

- Use Plan Mode for complex tasks, multi-step changes, or risky modifications
- When stuck, attempt creative workarounds before asking for help
- Reuse existing terminals when possible
- Read `README.md` before modifying any module
- **Read `ROBOTS.md` before using any module's functions.** Compact AI reference with signatures, types, patterns
- Always run tests before returning: `npm test` from `_test/` directories
- **Two-pass check after refactor** touching 3+ functions: Pass 1 (logic + lint), Pass 2 (re-read full file. Step comments, 3/2/1 spacing, banner widths, return objects multi-line, `};` combined with END banners, lint again). See `docs/testing/migration-pitfalls.md`
- Use workflows in `.windsurf/workflows/` for new modules
- Use `/learn` to capture new knowledge (enforces `docs/dev/documentation-authoring.md`)
- When docs change, run `/compile-agents-md`
- **At session start:** list `__dev__/plans/` by mtime at the workspace root (e.g. `project-superloom/__dev__/plans/`), read most recent plan, state plan + in-progress step, confirm with user. Use `/plan` for transitions. Full rules: `docs/dev/planning.md`

### Safe Terminal Patterns (AI-Specific)

> Source: `docs/dev/pitfalls.md`. Read before adding new rules.

**File tools vs terminal:**
- Normal files: use `read_file`, `edit`, `write_to_file` directly
- `__dev__/` is at the workspace root (outside any repo) - use file tools directly. `.env*` files: write to `/tmp/...`, then `cat /tmp/file >> /path/to/target`

**Never make shell parse multi-line strings.** zsh enters `dquote>` / `heredoc>` mode; bridge cannot send closing token:
- **Heredocs** (`cat <<'EOF'`): use `write_to_file` instead
- **Multi-line `git commit -m`**: use single-line `-m` or stack `-m` flags, or `git commit -F /tmp/commit-msg`
- **Multi-line quoted args**: route through temp file

```bash
# Preferred
git commit -m "feat(module): one-line summary"

# Multi-paragraph - each `-m` becomes a paragraph
git commit -m "feat(module): summary" -m "Body paragraph one." -m "Body paragraph two."
```

**Never invoke interactive viewers** (`less`, `more`, `vi`, `man`). `PAGER=cat` is set, but commands ignoring it need flags: `git log -n 20`, `git --no-pager diff`, `journalctl --no-pager`.

**Foreground long-runners** (`node server.js`, `tail -f`, `docker compose logs -f`): launch with `Blocking: false` and small `WaitMsBeforeAsync`, poll via `command_status`. Stop process at end of task.

**Always specify `Cwd` for module commands.** Every `run_command` targeting a module (`npm install`, `npm test`, `docker compose`) must pass `Cwd` set to the module's `_test/` directory. Omitting it runs from repo root, causing misleading `ETARGET` errors. The user's preference is to **never propose a `cd` command.** Each `run_command` is a fresh shell.

**Module testing contract. `npm test` is self-contained.** Modules with `pretest`/`posttest` manage full Docker lifecycle. Never start containers manually before `npm test`. `pretest` runs `docker compose down -v` first and will conflict. Always run `npm install && npm test` from the module's `_test/` directory. See `docs/dev/testing-local-modules.md` and `docs/dev/pitfalls.md`.

**Pre-publish gate. Lint + test must pass locally before bumping version.** Before changing `version` and pushing to `main`: (1) `npm run lint` from module root. Exit 0; (2) `npm install && npm test` from `_test/`. All pass. CI runs lint before tests; skipping locally means broken push and wasted pipeline time. See `docs/dev/testing-local-modules.md` and `docs/dev/pitfalls.md` entry 13.

**`file:` in `_test/package.json` causes `MODULE_NOT_FOUND` in CI.** `file:` copies source but doesn't install the linked package's own `node_modules`. Works locally, breaks in CI. Rule: `file:../` allowed **only** for module under test. Shared helpers (storage, DB, cloud) must use registry semver ranges (`"^1.0.0"`). See `docs/dev/pitfalls.md` entry 8.

**Pin `_test/package.json` to version your code calls, not just `^1.0.0`.** When source bumps to `1.1.0` for new API (e.g. `mongo.createIndex`), every consuming `_test/package.json` must bump to `^1.1.0`. Otherwise `npm install` resolves older `1.0.0` and new API surfaces as `TypeError`. See `docs/dev/pitfalls.md` entry 11.

**Every chained `publish-*` CI job must override implicit `success()` check.** GitHub Actions evaluates `success()` transitively across whole upstream `needs` graph. In test→publish pipeline, one skipped `publish-*` (already on registry) silently disables downstream jobs. Required shape:

```yaml
publish-foo:
  needs: [detect, test-foo]
  if: |
    !cancelled() &&
    needs.detect.result == 'success' &&
    needs['test-foo'].result == 'success' &&
    needs.detect.outputs.publish_modules != '[]' &&
    needs.detect.outputs.publish_modules != '' &&
    contains(needs.detect.outputs.publish_modules, 'js-server-helper-foo')
```

`!cancelled() &&` disables implicit transitive `success()`; explicit `needs.<job>.result == 'success'` restores safety scoped to direct needs. Hyphenated job ids use bracket notation (`needs['test-foo']`). See `docs/dev/pitfalls.md` entry 11.

**`contains()` in CI workflow conditions must use `fromJSON()` for exact matching.** GitHub Actions `contains()` does substring matching on strings. When checking if a module is in detect outputs (JSON arrays), parse them first:

```yaml
# WRONG: Substring matching (verify matches verify-store-sqlite)
contains(needs.detect.outputs.test_modules, 'js-server-helper-verify')

# CORRECT: Exact array element matching
contains(fromJSON(needs.detect.outputs.test_modules), 'src/helper-modules-server/js-server-helper-verify')
```

See `docs/dev/pitfalls.md` entry 18.

**AWS SDK calls need dummy credentials in tests.** No credentials = SDK walks EC2 metadata chain = 1-2s timeout per call. Set `AWS_ACCESS_KEY_ID=local AWS_SECRET_ACCESS_KEY=local AWS_REGION=us-east-1` in `_test/package.json` `test` script even when no real AWS call happens.

**Auto-run is for read-only or idempotent operations only.** Never set `SafeToAutoRun: true` for `rm -rf`, `git push --force`, `docker volume rm`, `npm publish`, or state mutation, even if user previously approved similar command.

**VitePress / Vue parser crashes on bare angle-bracket placeholders in `docs/` markdown.** Any `<lowercase-or-PascalCase-name>` outside backticks is parsed as an HTML/Vue element open tag and hangs `vitepress build` with `Element is missing end tag` (the reported line number is often far below the real culprit). Rules: (1) never use `<...>` placeholders in prose. Use `[name]`, `{name}`, or plain capitalized phrases instead. (2) For verbatim copy-paste templates inside fenced blocks, use ` ```text ` instead of ` ```markdown ` to disable Vue's secondary scan. (3) When changes touch any VitePress-rendered file in `docs/`, run `npm run build` from `website/` locally before pushing. The single-digit-second build catches the failure before CI does. See `docs/dev/pitfalls.md` entry 15.

## Boundaries

### Always (do without asking)
- Read any file in the project
- Modify files in `docs/`
- Run test and lint commands
- Create test files
- Fix linting errors automatically
- Write to `__dev__/` freely (at workspace root, outside any repo, never committed)

### Ask First
- Add new dependencies to any `package.json`
- Create new helper modules or entity modules
- Modify deployment configs in `_deploy/`
- Restructure directory layout

### Never
- Modify `.env` files or secrets (except `__dev__/.env` at workspace root)
- Modify files in `_cleanup/` (legacy)
- Force push to git
- Expose sensitive information in logs or code
- **Run `npm publish` manually.** Publishing is CI/CD-only via `.github/workflows/ci-helper-modules.yml`. Bumping `version` and pushing to `main` triggers publish automatically. Workflow skips already-published versions.

---

# CONTEXT - Project Knowledge Base

## Directory Map

The project spans multiple repositories under `superloomdev`. See `docs/dev/org-structure.md` for the full workspace and org layout.

### Local workspace layout

```
project-superloom/
  codebase-superloom/          - clone of superloomdev/superloom
  codebase-js-helper-modules/  - clone of superloomdev/js-helper-modules
  codebase-js-demo-project/    - clone of superloomdev/js-demo-project
  __dev__/                     - personal workspace (never committed)
    plans/                     -   Long-horizon plans and backlog
    secrets/                   -   Real credentials, API keys (never copied anywhere committed)
  superloom.code-workspace     - multi-root workspace file
```

### superloom (this repo - framework constitution)

```
superloom/
  docs/                        # Framework docs, conventions, architecture
  website/                     # VitePress documentation website
  public/                      # Static assets
  AGENTS.md                    # AI assistant configuration (this file)
  .windsurf/                   # AI workflows and automation
```

### js-helper-modules (superloomdev/js-helper-modules)

All JS helper modules live in this separate repo under `src/`.

```
js-helper-modules/
  src/
    helper-modules-core/          # Platform-agnostic utilities (@superloomdev npm scope)
      js-helper-utils/            #   Type checks, validation, sanitization, data manipulation
      js-helper-debug/            #   Structured logging: levels (debug/info/warn/error), text + JSON
      js-helper-time/             #   Date/time math, timezone, formatting
      js-helper-money/            #   Currency metadata, float-safe rounding, formatting, aggregation
    helper-modules-server/        # Server-only helpers (Node.js runtime required)
      js-server-helper-crypto/    #   Hashing, encryption, UUID, random strings, base conversion
      js-server-helper-sql-postgres/  #   Postgres with connection pooling
      js-server-helper-sql-mysql/     #   MySQL with connection pooling
      js-server-helper-sql-sqlite/    #   SQLite via built-in node:sqlite (offline, embedded)
      js-server-helper-nosql-mongodb/   #   MongoDB native driver wrapper
      js-server-helper-nosql-aws-dynamodb/  # DynamoDB CRUD, batch, query
      js-server-helper-instance/  #   Request lifecycle, cleanup, background tasks
      js-server-helper-http/      #   Outgoing HTTP client (native fetch wrapper, includes multipart)
      js-server-helper-storage-aws-s3/         #   S3 file operations
      js-server-helper-storage-aws-s3-url-signer/  #   S3 presigned URLs
      js-server-helper-queue-aws-sqs/          #   SQS message queue wrapper
      js-server-helper-auth/       #   Session lifecycle + JWT auth with refresh-token rotation; storage-agnostic adapter
        js-server-helper-auth-store-sqlite/    #     Auth store: SQLite (embedded, zero-network, dev/test)
        js-server-helper-auth-store-postgres/  #     Auth store: PostgreSQL (production SQL)
        js-server-helper-auth-store-mysql/     #     Auth store: MySQL / MariaDB (production SQL)
        js-server-helper-auth-store-mongodb/   #     Auth store: MongoDB (document store)
        js-server-helper-auth-store-dynamodb/  #     Auth store: DynamoDB (single-table, native TTL)
      js-server-helper-verify/    #   One-time verification codes (pin/code/token), storage-agnostic adapter
        js-server-helper-verify-store-sqlite/    #   Verify store: SQLite (embedded, zero-network, dev/test)
        js-server-helper-verify-store-postgres/  #   Verify store: PostgreSQL (production SQL)
        js-server-helper-verify-store-mysql/     #   Verify store: MySQL / MariaDB (production SQL)
        js-server-helper-verify-store-mongodb/   #   Verify store: MongoDB (native TTL via sparse _ttl index)
        js-server-helper-verify-store-dynamodb/  #   Verify store: DynamoDB (single-table, native TTL on expires_at)
      js-server-helper-logger/    #   Compliance-friendly action log: per-row retention (persistent | TTL) + optional IP encryption
        js-server-helper-logger-store-sqlite/    #   Logger store: SQLite
        js-server-helper-logger-store-postgres/  #   Logger store: PostgreSQL
        js-server-helper-logger-store-mysql/     #   Logger store: MySQL / MariaDB
        js-server-helper-logger-store-mongodb/   #   Logger store: MongoDB (native TTL, compound pk/actor keys)
        js-server-helper-logger-store-dynamodb/  #   Logger store: DynamoDB (entity_pk + actor_gsi, native TTL)
      js-server-helper-http-gateway/  #   Runtime-agnostic HTTP gateway; normalizes Lambda/Express requests via adapter pattern
        js-server-helper-http-gateway-adapter-aws-apigateway/  #   API Gateway adapter (payload v1 + v2)
        js-server-helper-http-gateway-adapter-express/         #   Express adapter
    helper-modules-client/        # Client-specific helpers (browser, mobile)
      js-client-helper-crypto/    #   UUID, random strings, base64 (Web Crypto API)
```

### js-demo-project (superloomdev/js-demo-project)

Full JavaScript reference application. Source: `docs/dev/org-structure.md`.

```
js-demo-project/
  ops/                             # Operations runbook (numbered, sequential)
  src/model/                       # Base models (pure, IO-free)
  src/model-server/                # Server-only model extensions
  src/server/common/               # Bootstrap, config, loader, shared infrastructure
  src/server/controller/           # Thin adapters (validate + DTO + delegate)
  src/server/service/              # Business logic and orchestration
  src/server/interfaces/api/       # Express routes + per-entity Lambda handlers
  src/server/_deploy/              # Per-entity Serverless Framework configs
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

These rules apply to **ALL** code written in this project. Source: `docs/foundations/code-formatting-js.md`.

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

### Code Comment Standards

Source files must never reference internal `docs/` paths in comments. Explain the *what* and *why* inline.

| Pattern | Status | Example |
|---|---|---|
| `// See docs/...` | **Prohibited** | Never link to internal documentation |
| `// See: docs/dev/...` | **Prohibited** | No doc path references |
| External API URLs | **Allowed** | `// Reference: https://docs.aws.amazon.com/...` |
| RFC/spec references | **Allowed** | `// RFC 6749 section 4.1` |
| Self-contained explanations | **Required** | `// SQLite has no native boolean; stored as INTEGER 0/1` |

Full rule: `docs/dev/documentation-standards.md` -> "Code Comment Standards".

### Parameter Naming

- **No underscore prefix on parameters** - never use `_param` to suppress ESLint `no-unused-vars` on function params
- **No `void param;` statements** - `void` is a runtime no-op expression, not a lint annotation. Non-standard and misleading
- Use `// eslint-disable-line no-unused-vars` on the function signature line instead: `function (Lib, CONFIG, ERRORS) { // eslint-disable-line no-unused-vars`

### Uniform Factory Signatures

When a `parts/` family uses a **uniform factory signature** `(Lib, CONFIG, ERRORS)` so the parent can call all parts identically, some parts will not consume every param. This is expected. Do not narrow the signature. Suppress unused params with `// eslint-disable-line no-unused-vars` on the signature line. Never use `void CONFIG;` or `void ERRORS;` as a workaround. Full spec: `docs/foundations/code-formatting-js.md` -> "Uniform Factory Signatures".

### Function Parameter Conventions

| Situation | Pattern | Name |
|---|---|---|
| 4+ params, any optional, or likely to grow | Single options object | `options` |
| 3 or fewer params, all required, stable | Positional params | descriptive names |

- **Never use `args`** as a parameter name - use `options` for named-property bundles
- **Closed-over deps are never in the options object** - if `Lib`, `CONFIG`, or `store` are already in the closure, do not re-pass them as options fields; pass only the per-call data the function cannot otherwise reach

```javascript
// Correct - many fields or optional: options object
applyLimits: function (options) { options.existing; options.limits.total_max; }

// Correct - few required: positional
composeCookieName: function (cookie_prefix, tenant_id) { }

// Wrong - closed-over deps bundled into options
_Auth.scheduleBackgroundRefresh({ Lib, store, instance, record, ttl_seconds });

// Correct - only per-call data that isn't closed over
_Auth.scheduleBackgroundRefresh(instance, record, ttl_seconds, tenant_id);
```

Full spec: `docs/foundations/code-formatting-js.md` -> "Function Parameter Conventions".

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

**This applies to every helper module** (dynamodb, mongodb, s3, sql-*, verify, http, etc.) and every entity service. When in doubt: programmer errors throw, everything else returns an envelope, and the service translates before the controller sees it.

**Programmer error message format:** `[module-short-name] field-path expected-shape[(e.g. bare-example)]`. Example: `[js-server-helper-auth] CONFIG.Store is required (a store object implementing the store contract)`. No URLs, no scoped package names (`@superloomdev/...`), no multi-line concatenation, no apologetic language, no "see docs" pointers, no vendor/driver names in the prefix. Source: `docs/foundations/error-handling.md` -> "Programmer Error Message Format".

Full rule with rationale, anti-patterns, type-string naming, and worked examples: `docs/foundations/error-handling.md`.

### Section Header Hierarchy

Three levels of section separators. Use from coarsest to finest. Full spec: `docs/foundations/code-formatting-js.md` -> "Section Header Hierarchy".

| Level | Marker | Purpose |
|---|---|---|
| 1 | `/////////////////////////// [Name] START ///...` | Major module sections: `Module-Loader`, `Module Exports`, `createInterface`, `Public Functions`, `Private Functions` |
| 2 | `// ~~~~~~~~~~~~~~~~~~~~ [Name] ~~~~~~~~~~~~~~~~~~~~` + short purpose comment (1-4 lines) | Subsections inside a public/private function object (group by responsibility) |
| 3 | `// [comment]` | Inline comment above a logical block |

Use Level 2 subsections inside public/private function objects when the module has 5+ functions or 2+ responsibility groups. Subsection names are short title-cased noun phrases.

### Private Functions Enclosure

Private helpers inside `createInterface` must always be declared as a `const _Name = { ... }` object literal - never as bare `Name.method = function(...)` property assignments on the public object.

- Name the enclosure `_Name` where `Name` matches the public object (`_Auth`, `_Validators`, `_Cookie`, `_RecordShape`, etc.)
- All call sites inside the public object use `_Name.method(...)`, not `Name.method(...)`
- The enclosure follows immediately after the `///Private Functions START///` banner
- Private helpers that call other private helpers also use `_Name.otherHelper(...)`

```javascript
// Correct
const _Validators = {
  assertNonEmptyString: function (value, field, fn_name) { /* ... */ },
  assertEnum: function (value, field, fn_name, allowed) { /* ... */ }
};///////////////////////////Private Functions END//////////////////////////////

// Wrong - private helpers attached directly to the public object
Validators.assertNonEmptyString = function (value, field, fn_name) { /* ... */ };
```

Full spec: `docs/foundations/code-formatting-js.md` -> "Private Functions Enclosure".

### Section Closing Banners

The closing `};` of every named section must be **combined on the same line** as the `///...END...///` banner - never on a separate line.

```javascript
// Correct
  };///////////////////////////Public Functions END////////////////////////////////
  };///////////////////////////Private Functions END//////////////////////////////
};/////////////////////////// createInterface END ////////////////////////////////

// Wrong
  };
  ///////////////////////////Public Functions END////////////////////////////////
```

Applies to every section closer: `Public Functions END`, `Private Functions END`, `createInterface END`, `Module-Loader END`, `Module Exports END`. Full spec: `docs/foundations/code-formatting-js.md` -> "Section Closing Banners".

### Inline Section Comments

- **Every logical block within a function gets a single-line comment** explaining what the next 2-5 lines do
- **No exceptions for short functions** - even a single-block function with one `await` and one `if` still gets its opening step comment
- The first logical block after `{` opens with a step comment; every subsequent block separated by a blank line also gets one
- Comments describe intent, not syntax: `// Delete the row by primary key` not `// Call sql.write`
- Use plain, direct language: `// Return a service error if the driver call failed` not `// Bubble up the error`
- Worked example (correct vs wrong) in `docs/foundations/code-formatting-js.md` → "Inline Step Comments Inside Functions"

### Comment Authoring Style (human tone)

- Write comments as a teammate would explain the line, not as marketing or reference manual prose
- Prescriptive voice: "Run the query", "Return a service error if the driver call failed", "Build pool on first call"
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

### Third-Party Library Policy

Default position: **self-contained code**. Every npm dependency is a long-term supply-chain liability. Source: `docs/foundations/third-party-libraries.md`.

- A new helper module ships with **zero `dependencies`** unless ALL eight criteria are met: specialized domain knowledge, zero transitive deps, de-facto standard (top-1% weekly downloads, 1000+ reverse-deps), recognized org with multiple maintainers, MIT/ISC/BSD/Apache-2.0 license, <10 KB bundle, cannot be reasonably re-implemented in-house, narrow and stable surface wrapped behind one helper
- **Third-party `require()` is confined to `parts/*.js` inside a helper module** (or an adapter package's own runtime SDK). Never in loaders, validators, config, errors, or application layers
- **Every module with a runtime `dependency` must document it** in a `## Third-Party Dependencies` section in its README (after config reference, before Testing). Cover: what it does, why not in-house, which criteria it satisfied
- Accepted dependencies are re-evaluated when a new module adds a dep (required in the PR) and annually (CVE checks, newer Node.js native alternatives)

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
- **Every module declares `engines.node`** - minimum Node.js version the module supports. Example: `"engines": { "node": ">=24" }`
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

### Module Documentation Layers (README / docs/ / ROBOTS.md)

Every module documents itself across three files, each with one audience. Full rubric: `docs/modules/module-readme-structure.md`. Module-to-class enumeration: `docs/modules/module-categorization.md`.

| File | Audience | Tone | Length budget |
|---|---|---|---|
| `README.md` | Non-technical evaluator, developer evaluating, developer integrating (first read) | Plain language, value-first | ~150 lines |
| `docs/*.md` | Developer integrating (deep), maintainer, code reviewer | Reference-grade, exhaustive | No fixed limit |
| `ROBOTS.md` | AI assistant generating or reviewing code | Compact, dense, machine-friendly | ~100-150 lines |

**Five personas guide README authoring:** Manager (identity/value), Developer evaluating (what it does/doesn't do), Developer integrating (install/API), Code reviewer (confidence), AI assistant (signatures). **Single most important rule:** persona 1 must understand what the module is and why it exists from README alone.

**Universal README section order** (every class):

1. **Title + Identity Badges** - Visual identity. License + runtime version only. Test status badges at bottom, not here.
2. **Tagline** - One sentence; plain English; ends with "Part of [Superloom](https://superloom.dev)". No sibling backends or competitors in tagline.
3. **What this is** - 1-2 short paragraphs plain English. May include tiny response-shape illustration. Never full code example.
4. **Why use this module** - Value bullets (5-7 points). Jargon-free, vendor-neutral. Each bullet: one sentence + at most one supporting sentence.
5. **Hot-Swappable with Other Backends** *(class-conditional)* - Bullet list of sibling modules with same API. Present when module has at least one sibling.
6. **Class-Specific Section** *(class-conditional)* - One section per class (e.g. "Architecture overview" for Class E, "Credentials & Permissions" for Class D).
7. **Aligned with Superloom Philosophy** - One short paragraph. Frames as consistency for projects already using Superloom, NOT as a Why bullet.
8. **Extended Documentation** - Links to `docs/api.md`, `docs/configuration.md`, Superloom. NEVER link `ROBOTS.md` here (AI-only).
9. **Adding to Your Project** - Peer dependency through loader pattern. NO `npm install` snippet. Links to loader-pattern doc.
10. **Dependencies** - Every bundled npm package with one-sentence rationale. Explicitly states external service dependencies or none.
11. **Testing Status** - Status table (Emulated/Integration tiers). Test runtime details live in `docs/configuration.md`.
12. **License** - MIT

**Critical README rules:**

- **All README links use full `https://github.com/superloomdev/superloom/blob/main/...` URLs.** npm renders without resolving relative paths.
- **No em dashes (`—`) anywhere** - use hyphens, parentheses, or split sentences. Tell-tale AI-generated prose sign.
- **No jargon** (no *metaprogramming*, *idempotent*, *cargo cult*) - frame reviewability around what reviewer can SEE.
- **No vendor product names as headline categories** - use industry-neutral terms (*serverless*, *persistent infrastructure*) with vendor names only as illustrative examples.
- **No function names in marketing prose** - they belong in `docs/api.md` and `ROBOTS.md`.
- **No Quick Start, "What this module is NOT", or `npm install` snippet** - pilot proved they don't serve any persona.
- **Table cells do not end with periods** - cells are not sentences.
- **Sentences 30 words or fewer** - split at conjunctions when longer.

**Six module classes** (determines class-specific extras + `docs/` footprint):

| Class | Trait | Class-specific README section | `docs/` files |
|---|---|---|---|
| **A. Foundation utility** | Zero deps, pure functions, platform-agnostic | "API Categories" (grouped function overview) | `api.md`, `configuration.md` |
| **B. Extended utility** | Node.js runtime only, no third-party packages | "Behavior" (lifecycle semantics, cleanup) | `api.md`, `configuration.md` |
| **C. Driver wrapper** | Wraps third-party DB driver (Postgres, MySQL, MongoDB, SQLite) | (none - Hot-Swappable section serves this) | `api.md`, `configuration.md` |
| **D. Cloud service wrapper** | Wraps cloud/network SDK (AWS S3, DynamoDB, SQS) | "Credentials & Permissions" | `api.md`, `configuration.md`, optional `iam.md` |
| **E. Feature module with adapters** | Business logic + pluggable storage or transport (auth, verify, logger, http-gateway) | "Architecture Overview" + "Storage Adapters" or "Transport Adapters" | `api.md`, `configuration.md`, `data-model.md`, optional `runtime.md` |
| **F. Dependent adapter** | Implements parent's adapter contract. Two subtypes: **store** (`-store-[backend]`, data/persistence) and **adapter** (`-adapter-[name]`, everything else: transport, integration, future). Either can be factory or singleton depending on per-instance state needs | (none) | Store: `api.md`, `configuration.md`, `schema.md`, `cleanup.md`. Adapter: `api.md`, `configuration.md` |

**Universal value bullets 1-4** copy-pasteable across classes (insulation, pre-tested, human review, observability). Only bullet 5 is class-specific. See full templates in `docs/modules/module-readme-structure.md`.

**Cross-cutting patterns:**
- **AWS Family:** Shared "Explicit credentials" bullet, "Credentials and IAM Permissions" section with minimum-IAM table, local emulator vs real service, multi-region setup
- **Hot-Swap Families:** SQL drivers, NoSQL drivers, auth storage adapters, http-gateway transport adapters, crypto (server↔client). Adding sibling requires updating every existing sibling's README
- **"Required (override)"** in config tables for defaults that must be changed (HOST, DATABASE, KEY, SECRET)
- **Response envelope illustration** in "What this is" section
- **Lazy initialization** note in `docs/configuration.md`

### ROBOTS.md - AI Agent Reference (Every Module)

Every module has a `ROBOTS.md` alongside `README.md`. It is the compact AI reference:

- **Purpose:** Token-efficient function listing for AI agents. Prevents reinventing the wheel.
- **Format:** Module name → type → peer deps → direct deps → config keys → exported functions → patterns
- **Function format:** `functionName(params) → ReturnType | async:yes/no` + one-line description
- **Rule:** Read `ROBOTS.md` before using any module's functions. If a helper function exists, use it.
- `README.md` = human-facing identity + value + quick start; full reference lives in `docs/*.md`
- `ROBOTS.md` = AI agent documentation (compact, token-efficient, machine-readable)

### Module Consistency Rules (MUST have, every module)

The following items are mandatory for every helper module. These caught real issues in past migrations:

| File/Rule | Requirement |
|---|---|
| `eslint.config.js` | ESLint v9+ requires a flat config file; without it lint silently fails |
| `engines.node` in `package.json` | Declares minimum Node.js version; prevents silent runtime incompatibilities |
| `.npmignore` at module root | **Required** - without it `npm pack` includes `_test/`, `.github/`, `eslint.config.js`. Must exclude dev files (including `THOUGHTS.md`) and include `README.md`, `ROBOTS.md`, `docs/`, `parts/` (if present). Use `js-helper-utils` as canonical reference. Verify with `npm pack --dry-run` before publishing |
| `publishConfig.registry` | Exactly `https://npm.pkg.github.com` (no trailing `/@superloomdev` scope suffix) |
| No `.npmrc` in module dir | Global `~/.npmrc` is the only source of truth |
| Package name | `@superloomdev/<module>` - scoped; must match directory name |
| `[module].errors.js` | **Required** - frozen error catalog for operational errors |
| `[module].validators.js` | (Optional) Singleton validators module if module has validation logic. Loader takes only `(shared_libs)`; static data is `require`d internally per Singleton Module Pattern |
| `data/` | (Optional) Static intrinsic reference data. `require`d at module top-level, never injected. Intrinsic facts only (ISO standards, character sets); no locale-specific or project-specific data |
| Test `_test/loader.js` | Required for any module using dependency injection |
| Test `_test/package.json` | Uses scoped dep names (`@superloomdev/js-helper-utils`, never bare) and `file:../` for module under test |
| Test dependency versions | Track latest published version; bump all consuming `_test/package.json` files when publishing |
| `package.json` format | Multi-line JSON, not compressed single-line |
| No `exports` field | Omit when `main` covers the only entry file; only add for multi-entrypoint packages |
| American English | `Initialize` not `Initialise`, `standardize` not `standardise` |
| `ROBOTS.md` | Covers every exported function with exact signatures, types, async flag, one-line purpose |
| `THOUGHTS.md` | Optional engineering decision journal. Include when significant design decisions were made. Never published to npm. See `docs/modules/module-thoughts-file.md` |
| Commit discipline | Code AND docs together; never push ROBOTS.md referencing non-existent functions |

### Common Mistakes to Avoid (Observed in Prior Migrations)

- ❌ Committing `ROBOTS.md` listing functions that don't exist in the committed source
- ❌ Leaving stale `publishConfig.registry` with `/@superloomdev` suffix
- ❌ Forgetting to add `eslint.config.js` (lint silently does nothing)
- ❌ Forgetting `engines.node` - packages publish without a declared runtime requirement
- ❌ Pinning dev deps to old major versions (e.g., `eslint ^9` when `^10` is current)
- ❌ Leaving tests with inline DI instead of a `loader.js` file
- ❌ Leaving `process.env` access outside `loader.js` (env reading MUST be centralized)
- ❌ Injecting static data (`currencies.json`, config, errors) into validators loader - singleton validators `require` their static dependencies directly; only `shared_libs` is injected
- ❌ Putting locale-specific or project-specific data in `data/` folder - `data/` is for intrinsic, framework-neutral facts only
- ❌ Leaving `var x = '';` initializers that are immediately reassigned (ESLint 10 `no-useless-assignment`)
- ❌ British spelling in strings, comments, or package descriptions
- ❌ Forgetting to bump dependent test `package.json` files when publishing a new version
- ❌ Adding a redundant `exports` field to single-entrypoint packages that already have `main`
- ❌ Missing `.npmignore` - causes `_test/`, dev files, and CI configs to ship in the published tarball

### Helper Module Structure (Three Patterns)

Helper modules use one of three patterns. **Singleton** for stateless, pure, shared-identity modules with no per-caller CONFIG variation. **Factory (Pattern 2)** for everything else (stateful or needing per-instance closure). **Pattern 1 (Singleton Config)** is legacy and preserved for historical reference only. Full rules: `docs/modules/module-structure-js.md`.

**Quick decision:**

| Pattern | Use when | Examples |
|---|---|---|
| Singleton | Stateless, pure, shared identity, no per-caller CONFIG. Module-scope objects, loader sets them once | `js-helper-utils` (loader-initialized), `js-helper-money`, `js-server-helper-http-gateway` |
| Multi-Instance (Factory) | Stateful (pool, persistent client, session) or per-caller CONFIG variation | DB modules, cloud SDK modules, auth, verify, logger |
| Singleton Config | *Legacy - no longer used.* | - |

**`createInterface` signature - pick the minimal shape that fits:**

| Signature | Use when | Reference |
|---|---|---|
| `createInterface()` | Foundation module, no peer deps, no config | `js-helper-utils` |
| `createInterface(CONFIG)` | Foundation module, config but no peer deps | `js-helper-debug` |
| `createInterface(Lib, CONFIG)` | Stateless helper - peer deps + config, no per-instance resource | `js-helper-time`, `js-server-helper-crypto`, `js-server-helper-http`, `js-server-helper-instance`, `js-client-helper-crypto` |
| `createInterface(Lib, CONFIG, state)` | Stateful helper - holds a per-instance resource | `js-server-helper-sql-mysql`, `js-server-helper-nosql-aws-dynamodb` |
| `createInterface(Lib, CONFIG, ERRORS)` | Standalone store adapter - owns its own Lib, CONFIG, ERRORS; returns a ready-to-use store object | `[parent]-store-[backend]` |
| `createInterface(Lib, CONFIG, ERRORS, Validators, store)` | Domain helper with adapter pattern. Validators + store injected from loader | `js-server-helper-verify` |
| `createInterface(Lib, CONFIG, ERRORS, Parts, adapter)` | Domain helper with parts + externally-supplied runtime adapter, no Validators | _(no current reference - use `js-server-helper-auth` as the closest shape)_ |
| `createInterface(Lib, CONFIG, ERRORS, Validators, Parts, store)` | Domain helper with adapter pattern + Validators + decomposed parts (fullest shape) | `js-server-helper-auth` |

The loader body mirrors the signature: build only the parameters `createInterface` will receive. Stateless helpers never declare a `state` object.

**Parameter ordering (internal-before-external):** `createInterface(Lib, CONFIG, ERRORS, [Validators,] [Parts,] [store | adapter | state])`. Everything the module built for itself (Lib, CONFIG, ERRORS, Validators, Parts) comes before the one thing handed to it from outside (store/adapter/state). **Parameter casing:** PascalCase for internally-assembled namespaced containers (`Lib`, `CONFIG`, `ERRORS`, `Parts`, `Validators`); camelCase for externally-supplied resolved dependencies (`store`, `adapter`, `state`). Source: `docs/modules/module-structure-js.md` -> "Parameter Ordering Convention" and "Parameter Casing Convention".

#### Pattern 1: Singleton Config (Legacy)

This pattern is **preserved for historical reference only** and is no longer used in new modules. Old modules using it are migration candidates. See appendix in `docs/modules/module-structure-js.md` -> "Appendix: Pattern 1 (Singleton, Legacy)" for full shape. The key structural difference from the current singleton pattern is that Pattern 1 mutated shared `const Lib = {}` and `const CONFIG` on every loader call - meaning the last caller's config won.

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
    // Short purpose of this subsection (1-4 lines when the grouping needs
    // real motivation - dialect quirks, hot-path notes, security invariants).

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

### Singleton Module Pattern

Modules that are stateless, pure, globally shared, and have no per-caller CONFIG variation use the singleton pattern: no `createInterface`, all variables at module scope, loader sets them once and returns the public object directly. Node.js `require` cache guarantees the same object on every subsequent `require`. Source: `docs/modules/module-structure-js.md` -> "Singleton Module Pattern".

**When to use (all four must be true):** stateless (no pool/client/connection), pure (no I/O), shared identity (one instance always correct), no per-caller CONFIG.

**When NOT to use:** DB modules, cloud SDK modules, auth, verify, logger, any `*-store-*` adapter.

**Module-scope declaration ordering (fixed sequence):**

| Position | Declaration | Mutability | Present in |
|---|---|---|---|
| 1 | `let Lib` | Set once by loader | All except loader-initialized singletons (e.g. `js-helper-utils`) |
| 2 | `let CONFIG` | Set once by loader | Main modules with config |
| 3 | `const ERRORS` | Loaded at require time | Main modules with error catalogs |
| 4 | `let Validators` | Initialized by loader (needs Lib) | Main modules with validators |
| 5 | Module-specific data (`const [DATA]`) | Loaded at require time | Only modules with static reference data |

Omit positions that do not apply. Preserve relative order of those that remain. Common infrastructure (1-4) before module-specific data (5).

**Module-root singletons (`[module].validators.js`) are a special case:** accept only `Lib`, no CONFIG/ERRORS/Validators. They run before config is validated. Stripped-down shape - do not conflate with the main-module singleton.

**Store/adapter contract validation:** Modules with externally-supplied stores or adapters add `validateStoreContract(store)` or `validateAdapterContract(adapter)` to their validators singleton. The parent receives a ready-to-use object via `CONFIG.Store` / `CONFIG.Adapter`; the loader calls the contract validator once right after receiving it. Throws `Error` (setup error, not programmer error) with format `[module-name] Invalid store contract: missing method [name]`. Only required methods belong in the contract; optional maintenance methods keep call-time `isFunction` guards. Reference: `js-server-helper-http-gateway` (adapter), `js-server-helper-auth`/`verify`/`logger` (store).

**Reference implementations:** `js-helper-money/money.js` (main module singleton), `js-server-helper-http-gateway/http-gateway.js` (main module singleton with adapter + parts), `js-server-helper-auth/auth.validators.js` (module-root singleton, special case).

**Current singleton:** `js-helper-utils` (loader-initialized subtype - `let Validators;` at module scope, loader initializes internal singletons and returns the module-scope Utils object. No external Lib or CONFIG dependencies).

**All other modules remain factories** (Debug, Time, Money, Crypto, Instance, HTTP, and all server modules). Factory pattern is essential for test isolation and configuration flexibility. See `docs/modules/factory-vs-singleton-decision.md`.

**Do not convert:** all DB modules (`sql-*`, `nosql-*`), all cloud SDK modules, `js-server-helper-auth`, `js-server-helper-verify`, `js-server-helper-logger`, and all `*-store-*` adapters.

### Parts Pattern (Complex Helper Modules)

When a helper module's `createInterface` body grows beyond ~500 lines and decomposes into bounded **stateless** responsibilities, split each responsibility into a co-located factory under `parts/`. Source: `docs/modules/module-structure-js.md` -> "Parts Pattern".

- **Folder:** `[module]/parts/[name].js` - one factory per part
- **Uniform loader signature `(shared_libs, config, errors)`:** every part always accepts all three parameters regardless of which it uses. Hard rule - no exceptions. Ensures the parent can instantiate all parts with identical call sites. Unused params suppressed with `// eslint-disable-line no-unused-vars` on the signature line
- **Part shape - singleton or factory:** the loader signature is identical; what differs is the body. **Singleton:** assigns to module-scope `let` vars and returns the module-scope public object directly (no `createInterface`). **Factory:** calls `createInterface(Lib, CONFIG, ERRORS)` and returns the result. Use singleton when the part needs no per-instance closure; use factory when it does. Source: `docs/modules/module-structure-js.md` -> "Part Shape: Singleton or Factory"
- **Module-root vs parts singleton shape differ:** module-root singletons (`[module].validators.js`) inject only `Lib` (run before config is validated, so `CONFIG`/`ERRORS` not accepted). Parts singletons always accept all three for call-site uniformity. Do not conflate the two shapes
- **Parent loader builds `Parts` once:** `const Parts = { Foo: require('./parts/foo')(Lib, CONFIG, ERRORS), Bar: ... };` - no part-ordering knowledge in the parent
- **Inter-part deps self-resolve:** if part A needs part B, A `require`s B with the same `(Lib, CONFIG, ERRORS)` signature. No registry, no dispatch
- **Never exported:** parts are an internal organization technique. `package.json` `exports` lists only the parent module's main entry. External consumers see only the parent's public interface
- **Stateless rule:** if a candidate part needs its own pool / persistent client / lifecycle state, it does not belong in `parts/` - lift it into a sibling helper module
- **Reference:** `js-server-helper-auth` in `js-helper-modules`: six parts (auth-id, cookie, jwt, policy, record-shape, token-source) consumed by `auth.js`. Validators live in `auth.validators.js`, not in `parts/`

### Adapter Pattern (Multi-Backend Helper Modules)

When a helper module needs interchangeable backends (databases, transports, key/value stores), each backend is a **standalone npm package** that owns its own `Lib`, `CONFIG`, and `ERRORS`. Source: `docs/modules/module-structure-js.md` -> "Adapter Pattern".

- **Adapter owns its own Lib:** built from injected `shared_libs`, not received from parent
- **Adapter owns its own Config:** own `store.config.js` with adapter-specific keys
- **Adapter owns its own ERRORS:** frozen `store.errors.js` with adapter-specific error types, prefixed with the module short-name
- **Returns a ready-to-use store object:** not a factory. Parent receives via `CONFIG.Store` and uses it directly
- **Only coupling is the return contract:** method names + return shapes (`{ success, error }`)
- The parent never calls into the adapter after receiving the ready-to-use object. No `Lib` or `ERRORS` forwarding

```javascript
// Application loader
const Store = require('@superloomdev/[parent]-store-[backend]')(Lib, { /* adapter config */ });
Lib.[Parent] = require('@superloomdev/[parent]')(Lib, { Store: Store });
```

**Naming conventions:**

| Concept | Naming |
|---|---|
| Database-backed adapters | `[parent]-store-[backend]` |
| Non-database adapters | `[parent]-adapter-[name]` |
| General concept | "adapter" - "store" reserved for database backings |

**Adapter subtypes:**

| Subtype | Naming | What it adapts | Typical shape |
|---|---|---|---|
| **Store** | `[parent]-store-[backend]` | Data persistence | Independent factory - builds own Lib, takes only config, returns ready-to-use store |
| **Adapter** | `[parent]-adapter-[name]` | Runtimes, transports, integrations | Singleton (stateless) or factory (if per-instance config) |

**Adapter files:**

```
[adapter]/
  store.js              # Main loader + createInterface
  store.config.js       # Adapter config keys
  store.errors.js       # Adapter error catalog
  store.validators.js   # Lib-injected singleton
  _test/
    loader.js           # Builds Lib, loads adapter
    test.js             # Contract + integration tests
```

**Independent adapter pattern:**
- Store adapters build their own Lib from peer dependencies (`helper-utils`, `helper-debug`)
- Loader takes only `config` (not `shared_libs`) - e.g., `{ table_name, lib_dynamodb }`
- Returns ready-to-use store object; parent consumes via `CONFIG.Store`
- See `docs/modules/module-structure-js.md` -> "Storage Adapter Skeleton"

**Key rules:**

- Store adapters use `Lib.Utils` for type checks - no inline `typeof`
- Driver errors → `ERRORS.SERVICE_UNAVAILABLE` from adapter's own catalog
- Log via `Lib.Debug.debug` with driver details; never leak driver wording in public envelopes
- Skeletons: `docs/modules/module-structure-js.md` -> "Storage Adapter Skeleton" and "Adapter Skeleton"

**Reference implementations:**

| Type | Parent | Adapters |
|---|---|---|
| Store | `js-server-helper-distinct-queue` | `js-server-helper-distinct-queue-store-dynamodb`, `js-server-helper-distinct-queue-store-mongodb` |
| Transport | `js-server-helper-http-gateway` | `js-server-helper-http-gateway-adapter-aws-apigateway`, `js-server-helper-http-gateway-adapter-express` (singleton) |

### Application Module Structure (Models, Controllers, Services)

All application modules (models, services, controllers) use the same strict DI pattern. Source: `docs/modules/module-structure-js.md` -> "Application Module Pattern".

```javascript
// [Module purpose - 1 line]
'use strict';

let Lib;
let CONFIG;

module.exports = function loader (shared_libs, config) {

  Lib = shared_libs;
  CONFIG = config;

  return ModuleName;

};
```

Layer dependency flows top-to-bottom only: Interfaces → Controller → Service + Model → Helper Modules. A controller never reaches into another entity's service. A model never imports from `server/`.

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
- **`.npmignore` required** at module root - excludes `_test/`, `.github/`, `eslint.config.js`; includes `README.md`, `ROBOTS.md`, `docs/`. Reference: `js-helper-utils`. Verify with `npm pack --dry-run` before first publish
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
- **Test infrastructure devDependencies use `test-infra-` prefix:** When tests need direct SDK classes the main module wraps but doesn't export (e.g. `CreateTableCommand`), add an aliased devDependency: `"test-infra-aws-sdk": "npm:@aws-sdk/client-dynamodb@^x.y.z"`. Prefix prevents accidental removal. Version must stay matched with the main module's dependency. Pattern extends to any provider: `test-infra-[provider]-[service]`. See `docs/dev/testing-local-modules.md`
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

### Test Double Patterns (memory-store vs stub-adapter)

When a module under test depends on an external contract, use a named test double in `_test/`. Source: `docs/testing/unit-test-authoring-js.md` -> "Test Double Patterns".

| Pattern | File | Industry term | Use when | State |
|---|---|---|---|---|
| `memory-store` | `_test/memory-store.js` | Fake | Storage backend (SQL, NoSQL, cache); stateful - writes must be visible to subsequent reads | Persists within test |
| `stub-adapter` | `_test/stub-adapter.js` | Stub | Runtime/transport adapter (HTTP gateway, queue, cloud SDK); stateless delivery channel | No cross-call state |

The two patterns are not exclusive - a module with both a storage backend and a runtime adapter uses both. Identify each external dependency, classify as "stateful storage" or "transport/runtime", and create the appropriate double. Reference: `js-server-helper-auth/_test/memory-store.js` (memory-store); `js-server-helper-http-gateway/_test/stub-adapter.js` (stub-adapter).

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
- Source: `docs/testing/module-testing.md`

### Three-Tier Testing for Adapter-Based Modules

Modules using the [Adapter Pattern](#adapter-pattern-multi-backend-helper-modules) test in three tiers, each at a different layer. Source: `docs/testing/testing-strategy.md` -> "Testing Adapter-Based Modules".

| Tier | Where | Loads | Docker | Question |
|---|---|---|---|---|
| **1 - Adapter unit** | `[adapter]/_test/test.js` | adapter only | optional | Does the translation layer work? (quoting, type coercion, batch chunking) |
| **2 - Parent logic** | `[parent]/_test/test.js` | parent + in-memory fixture | none | Does the pure parent logic work? (loader validation, policy, JWT) |
| **3 - Contract integration** | `[adapter]/_test/test.js` | parent + real adapter | yes | Does this adapter satisfy the contract end-to-end? |

- **Standalone adapter test (Tier 1 enabler):** the adapter's `_test/loader.js` builds its own Lib and loads the adapter as a standalone module (it owns its own Lib/CONFIG/ERRORS). The adapter's `_test/` uses `file:../` only for the module under test
- **In-memory fixture (Tier 2 enabler):** `[parent]/_test/memory-store.js` exports a `createInMemory<Adapter>()` that implements the **full** adapter contract using Node-built-in structures. Same return shapes as a real adapter. Lives only in `_test/`, never published, never required from outside test code
- **Shared contract suite copy pattern (Tier 3 enabler):** the integration suite is written **once** in `[parent]/_test/store-contract-suite.js` and **copied** into each adapter's `_test/store-contract-suite.js`. Never exported through the parent's `package.json`, never deep-required across packages
- **Why copy:** keeps test code out of runtime exports; each adapter has its own version-pinned snapshot; `npm install` graph in `_test/` stays clean (one `file:../` for the adapter under test, registry pins for siblings)

### Healthcheck and concurrency rules (Docker-dependent modules)

These rules apply to every module that uses `_test/docker-compose.yml` and to every CI job that runs Docker-dependent tests. Full journal of past failures: [`docs/dev/pitfalls.md`](docs/dev/pitfalls.md#local-module-testing) (Local Module Testing + CI/CD Publishing sections).

- **Probe at the application level, not the process.** A healthcheck must use the credentials, database, and transport (`127.0.0.1`, not `localhost`) the tests will actually use. `mysqladmin ping -u root` is a false positive during MySQL's two-phase init -- probe with `test_user` instead. `pg_isready -U test_user -d test_db` is the canonical Postgres pattern. For MongoDB replica sets, `rs.status().ok` and `rs.initiate()` both report ready before primary election finishes -- probe with `db.hello().isWritablePrimary` and `quit(1)` so the check only passes once the node accepts writes ([`docs/dev/pitfalls.md` entry 11](docs/dev/pitfalls.md#local-module-testing))
- **No `sleep` in `pretest`.** If a sleep is needed, the healthcheck is wrong. Fix the healthcheck so `docker compose up -d --wait` truly returns only when the service is ready
- **One owner of the Docker lifecycle.** `pretest` already starts the container locally and in CI. Never duplicate it with a workflow-level `docker run` step or a `services:` declaration on the same port
- **Wrap stateful module tests in `describe('Module', { concurrency: false }, ...)`.** The Node.js test runner runs top-level `describe` blocks concurrently by default; lazy-init resources (DB pools, AWS SDK clients) race each other and the cancelled block leaves a half-initialized resource behind

### Config Absorption Contract

Every loader merges caller config over module defaults via `Object.assign({}, defaults, config)`. This merge is **public API surface** - add a `describe('config absorption contract', ...)` block to every non-exempt module's `test.js`. Source: `docs/testing/unit-test-authoring-js.md` → "Config Absorption Contract".

**Strategy selection:**

| Strategy | When to use |
|---|---|
| **1 - Validation throws** | Module validates CONFIG at load time; override bad value → assert throws |
| **2 - Behavioral** | Config key changes observable output of a public function without a backend |
| **4 - Integration tier** | Keys only manifest against a live backend; exempt at unit tier |

**Assertions (3–5 `it` blocks):** override-wins, omission-keeps-default, null-honored (0032 canary - explicit `null` for a key with a non-null default must be seen as `null` not silently replaced), shallow-merge (optional), factory-independence (optional).

**`validBaseConfig()` helper required:** returns a fresh, complete, valid config object on each call - prevents test reference sharing.

**Exemption categories (no contract block needed):**

| Category | Condition | In-file comment? |
|---|---|---|
| 1 - Config unused | Loader accepts `config` but `createInterface` never reads CONFIG | Yes - document why |
| 2 - Config empty | `.config.js` exports `{}` | Yes - document why |
| 3 - All defaults null | No null-meaningful key; null override indistinguishable from default | Partial block - add override-wins if observable; document null-honored as deferred |
| 4 - Backend-coupled | All keys only observable through live backend (DB, storage, queue, network) | No - exempt by module purpose; policy documented here |

**Category 4 exempt modules:** all DB/SQL/NoSQL helpers, all storage helpers, all queue helpers, all store adapters (`auth-store-*`, `logger-store-*`, `verify-store-*`), `js-server-helper-http`, `js-server-helper-http-gateway-adapter-*`.

## Security

- Secrets stored in `__dev__/secrets/` (fully gitignored, personal workspace)
- AWS secrets via SSM Parameter Store in deployed environments
- Never hardcode API keys, tokens, or passwords
- Ops runbook references secrets as `[SECRET → __dev__/secrets/sandbox.md]`
- When changes involve auth, data handling, or API endpoints, proactively offer security review

## Operations Documentation

Infrastructure and deployment documentation follows a three-layer strategy. Source: `docs/foundations/operations-documentation.md`.

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
4. If architecture changed → update the relevant file in `docs/foundations/`, `docs/modules/`, `docs/server/`, or `docs/testing/`
5. If any docs changed → run `/compile-agents-md` to sync this file
6. Run all tests to verify
7. If migrating old module → log in `__dev__/migration-changelog.md`
