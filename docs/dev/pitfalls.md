# Developer-Environment Pitfalls (AI Journal)

> **Audience.** AI coding agents (Cascade, Copilot, Cursor) and humans debugging a specific CI, test, or terminal failure. **Not first-read material.** Start with the sibling philosophy docs; come here only when a concrete failure mode needs a confirmed fix.
>
> **Shape.** Every entry is **Symptom → Cause → Lesson/Fix**. When a new failure mode is discovered, add the entry here first (per the Golden Rule in `AGENTS.md`), then propagate a compact rule into `AGENTS.md` via `/propagate-changes`.
>
> **Scope.** This file covers the `docs/dev/` domain: AI tool-bridge, CI/CD publishing, local module testing. Architecture-level pitfalls (module migration, refactors) live in [`docs/architecture/migration-pitfalls.md`](../architecture/migration-pitfalls.md).

## On This Page

- [AI Terminal & Shell Bridge](#ai-terminal--shell-bridge)
  - [Why AI agents fail differently from humans](#why-ai-agents-fail-differently-from-humans)
  - [Shell-bridge pitfalls](#shell-bridge-pitfalls)
  - [Process and pager pitfalls](#process-and-pager-pitfalls)
  - [Working-directory pitfalls](#working-directory-pitfalls)
  - [Docker lifecycle pitfalls](#docker-lifecycle-pitfalls)
  - [Test-environment pitfalls](#test-environment-pitfalls)
  - [File-tool vs terminal pitfalls](#file-tool-vs-terminal-pitfalls)
  - [Auto-run / safety pitfalls](#auto-run--safety-pitfalls)
- [CI/CD Publishing](#cicd-publishing)
- [Local Module Testing](#local-module-testing)
- [Adding a New Entry](#adding-a-new-entry)

---

## AI Terminal & Shell Bridge

Canonical journal of every shell, terminal, and tool-bridge failure mode that AI assistants (Cascade, Copilot, etc.) have hit while working on this codebase.

### Why AI agents fail differently from humans

A human at a real terminal sees the prompt change to `dquote>` and fixes the quoting. An AI tool-bridge sees nothing, hits the proposed-command timeout, and the entire turn appears to "hang". The same root cause produces different symptoms depending on who is at the keyboard.

Three structural differences matter:

1. **No PTY interactivity.** The bridge cannot type into a sub-prompt. Once the shell enters `dquote>`, `heredoc>`, `quote>`, `cmdsubst>`, or `bracket>` continuation mode, there is no way out except killing the process.
2. **Output is captured asynchronously.** Anything that paginates (`less`, `more`, `git log` without `--no-pager`, `man`) blocks forever waiting for keyboard input that will never arrive.
3. **The current working directory is per-call.** Every `run_command` resets to whatever `Cwd` the tool-call specifies. There is no persistent session between calls, so `cd` in one call has no effect on the next call.

Every pitfall below is a specific consequence of one of these three. The mitigation is always the same: **avoid asking the shell to do anything interactive.**

### Shell-bridge pitfalls

#### S1. Heredocs hang the bridge

**Symptom.** A `cat <<'EOF' ... EOF` command never returns. The user sees "no progress" until the tool-call times out.

**Cause.** Heredoc content with backticks, `$`, `!`, parentheses, or unterminated quotes can confuse zsh's parser. The shell enters a continuation prompt waiting for more input. There is no way to send the closing token through the bridge.

**Fix.** Never use heredocs through the bridge.

- For file content: use `write_to_file` (or `edit`) directly.
- For terminal-only sinks (e.g., appending to a gitignored file): write the content to a temp file with `write_to_file`, then `cat /tmp/file >> /path/to/target`.

#### S2. Multi-line `git commit -m "…"`

**Symptom.** The command appears in the approval popup with the closing `"` on a different line. After the user approves, nothing happens - shell sits in `dquote>` mode.

**Cause.** zsh treats every newline inside an open `"…"` string as part of the string. With special characters in the body (`` ` ``, `$`, `!`, `(...)`), the parser also opens nested continuation states. None of them can be closed through the bridge.

**Fix.** Always pass commit messages on a single logical line.

| Need | Pattern |
|---|---|
| Single-line summary | `git commit -m "feat(module): one-line summary"` |
| Summary + body paragraphs | `git commit -m "feat(module): summary" -m "Paragraph one." -m "Paragraph two."` |
| Long structured body | `write_to_file` to `/tmp/commit-msg` then `git commit -F /tmp/commit-msg && rm /tmp/commit-msg` |

The same rule applies to `gh pr create`, `aws ssm put-parameter`, and any other tool that takes a quoted message.

#### S3. Multi-line content embedded inside any quoted shell argument

**Symptom.** Same as S2 but for non-`git` commands. The approval popup renders the multi-line argument unreadably; after approval, the shell hangs.

**Cause.** Any time a `run_command` payload spans multiple lines because of an embedded quoted string, the shell-bridge sees the same `dquote>` failure mode.

**Fix.** Route the multi-line content through `write_to_file` to a temp file first, then have the shell read from the file with a single-line command. This pattern is also documented in `.windsurf/workflows/migrate-module.md` Section 7a.

#### S4. Backticks inside a double-quoted argument

**Symptom.** `git commit -m "feat: closes issue \`#123\`"` either runs the contents of the backticks as a command substitution, or hangs in `cmdsubst>` mode.

**Cause.** Inside `"…"`, backticks always start command substitution. Escaping them with `` \` `` only sometimes works depending on shell version.

**Fix.** Use single quotes around the message, or replace the backticks with single quotes.

#### S5. Tilde expansion inside quotes

**Symptom.** `cp ~/.npmrc "…"` works; `cp "~/.npmrc" "…"` silently fails with "no such file".

**Cause.** Tilde is a shell metacharacter that only expands outside quotes (and not in all positions even there).

**Fix.** Use `$HOME` (which is a regular variable and expands inside double quotes) or omit the surrounding quotes for the path.

### Process and pager pitfalls

#### P1. Output paginators (`less`, `more`, `man`, `vi`)

**Symptom.** A command runs forever with no visible progress.

**Cause.** Paginators wait for keyboard input. There is no keyboard.

**Fix.** Never invoke an interactive viewer. The environment runs commands with `PAGER=cat` so most pager-aware tools (`git`, `systemctl`, `journalctl`) cooperate, but commands that ignore `PAGER` need explicit flags:

| Command | Flag |
|---|---|
| `git log` | `git log -n 20` (or `--no-pager`) |
| `git diff` | `git --no-pager diff` |
| `journalctl` | `journalctl --no-pager` |
| `systemctl status` | `systemctl --no-pager status …` |

#### P2. Long-running foreground processes

**Symptom.** `npm run dev`, `node server.js`, `tail -f`, `docker compose logs -f` block the bridge until they exit, which they never will.

**Cause.** A `Blocking: true` `run_command` waits for process exit. A foreground server never exits.

**Fix.** Use `Blocking: false` with a small `WaitMsBeforeAsync` (e.g., 2-3 seconds) so the tool returns after the startup output is captured. Then later, use `command_status` with the returned `CommandId` to fetch more output. Always remember to stop the background process at the end of the task.

#### P3. `npm install` of a watch-script package adding a postinstall daemon

**Symptom.** `npm install` completes, but a hidden `postinstall` script forks `node …watcher.js &` that keeps file descriptors open.

**Cause.** Some packages (rare, but they exist) start a background watcher in `postinstall`. The bridge sees the install command return but the descriptor lingers.

**Fix.** This is unusual in this codebase. If it ever happens, kill the dangling process via `pkill -f <package>` or restart the IDE.

#### P4. Command output exceeding the bridge buffer

**Symptom.** `npm test` finishes but the captured output is truncated mid-line.

**Cause.** Very long stdout streams can exceed the IDE's capture buffer, especially when test runners print verbose output for hundreds of tests.

**Fix.** Pipe to `tail -N` or `grep` to keep only what matters: `npm test 2>&1 | tail -30`, `npm test 2>&1 | grep -E "^(ℹ|✖|✔)"`. The full log is still in `npm-debug.log` if needed.

### Working-directory pitfalls

#### W1. Missing `Cwd` runs from the repo root

**Symptom.** `npm install` reports `ETARGET No matching version found for @superloomdev/...` even though the package version is correct.

**Cause.** The bridge resets to the repo root for every `run_command` unless `Cwd` is explicitly passed. The repo-root `package.json` has a different dependency tree from each module's `_test/package.json`.

**Fix.** Every module-scoped command (`npm install`, `npm test`, `docker compose …`) must pass `Cwd` set to the module's `_test/` directory.

```bash
# Wrong - silently runs from repo root
# run_command: { CommandLine: "npm install" }

# Right
# run_command: { CommandLine: "npm install", Cwd: ".../js-server-helper-foo/_test" }
```

#### W2. `cd <path> && <command>` does not persist between calls

**Symptom.** A first call does `cd src/foo && npm install`; a second call assumes the cwd is `src/foo` and does `npm test`, but it runs from the repo root.

**Cause.** Each `run_command` is a fresh shell. There is no session.

**Fix.** Always pass `Cwd` to every call. Never rely on a previous `cd`. The user's `AGENTS.md` explicitly says **never propose a `cd` command** for the same reason.

#### W3. Relative paths in tool calls

**Symptom.** `read_file({ file_path: "src/foo.js" })` fails or reads from the wrong directory.

**Cause.** Most tools require absolute paths. Relative paths are undefined behaviour.

**Fix.** Always pass absolute paths to file tools (`read_file`, `edit`, `write_to_file`, `find_by_name`, `grep_search`).

### Docker lifecycle pitfalls

#### D1. Manually starting Docker before `npm test`

**Symptom.** `Bind for 127.0.0.1:NNNN failed: port is already allocated`, or tests fail immediately with `ECONNRESET`.

**Cause.** `pretest` runs `docker compose down -v --remove-orphans` for its own compose project name; it does not touch a manually started container. Then `pretest` tries to bind the same port and fails.

**Fix.** Pick one owner of the Docker lifecycle: `pretest` already owns it. Locally and in CI, never run a separate `docker run` or `docker compose up` for the same service before `npm test`.

#### D2. Stale containers from a crashed prior run

**Symptom.** First test in a fresh session fails because a container from yesterday is still up but has stale state.

**Fix.** `pretest` already runs `docker compose down -v --remove-orphans`. If `pretest` itself fails on the start step, run that command manually from the same `_test/` directory.

#### D3. `docker compose up -d` without `--wait`

**Symptom.** Tests start before the database accepts connections; intermittent `ECONNREFUSED` on the first request.

**Fix.** Always use `docker compose up -d --wait`. The healthcheck must be a real readiness probe (see `docs/dev/testing-local-modules.md` "Healthcheck Philosophy").

#### D4. `docker compose --wait` returns immediately for a service with no healthcheck

**Symptom.** `--wait` reports the container as `Healthy` 0.5 s after start, even though the application inside is still initializing.

**Cause.** When a service has no `healthcheck:` block, Docker treats "container is running" as healthy. `--wait` honours that.

**Fix.** Either define a real healthcheck, or have the test code retry the first connection a few times. DynamoDB Local is the typical case here - the image has no curl/wget/nc to probe with, so the test setup absorbs a brief retry instead.

### Test-environment pitfalls

#### T1. AWS SDK calls without dummy credentials

**Symptom.** A test that exercises the AWS SDK takes 1-2 seconds and fails with no clear error.

**Cause.** With no credentials in the env, the SDK walks the default credential provider chain. The last step of that chain is the EC2/ECS instance metadata service at `http://169.254.169.254`. There is no metadata service on a developer machine or a GitHub Actions runner, so the chain times out.

**Fix.** Every AWS test must inject dummy credentials via the `_test/package.json` `test` script:

```json
"test": "AWS_ACCESS_KEY_ID=local AWS_SECRET_ACCESS_KEY=local AWS_REGION=us-east-1 node --test test.js"
```

The dummies do not need to be valid - they just need to exist so the SDK skips the metadata lookup.

#### T2. `node --test test.js` directly, without `pretest`

**Symptom.** Tests fail immediately with connection errors against the database or queue.

**Cause.** `pretest` did not run, so the container is not up.

**Fix.** Always use `npm test`. The lifecycle scripts exist for a reason.

#### T3. Concurrent top-level `describe` blocks

**Symptom.** "test did not finish before its parent and was cancelled".

**Cause.** Node's built-in test runner runs top-level `describe` blocks concurrently. Suites that share lazy-init state (DB pool, AWS SDK client) race each other on the first call.

**Fix.** Wrap stateful suites in a single outer `describe('Module', { concurrency: false }, …)`. See `docs/dev/testing-local-modules.md` "Test Concurrency".

#### T4. Healthcheck passes during a transient-ready window

**Symptom.** Tests pass locally, fail in CI with `Connection lost: The server closed the connection`.

**Cause.** A healthcheck that returns "ready" too early. MySQL's two-phase init is the classic case: `mysqladmin ping -u root` passes during phase 1, then the server restarts in phase 3 and drops every live connection.

**Fix.** Probe with the credentials, database, and transport the tests will use. See `docs/dev/testing-local-modules.md` "Healthcheck Philosophy".

### File-tool vs terminal pitfalls

#### F1. Using `cat` to read large files

**Symptom.** Output is truncated at the bridge buffer limit, or the call times out.

**Fix.** Use `read_file` with `offset` + `limit`. Never `cat` files larger than ~200 lines.

#### F2. Using `sed` / `awk` / `tr` to edit files

**Symptom.** The replacement either misses the target line, mangles whitespace, or partially succeeds.

**Cause.** Stream editors are powerful but error-prone for surgical edits, especially when the target string contains regex metacharacters or quotes.

**Fix.** Use the `edit` or `multi_edit` tool with `old_string` set to the exact unique substring. The tool guarantees an exact match or a clear error.

#### F3. Editing a file with a heredoc through `cat > file <<EOF`

Same root cause as S1. Always use `write_to_file` or `edit` instead.

#### F4. Reading gitignored files via `read_file`

**Symptom.** `read_file` returns "file is gitignored" for `__dev__/.env.dev`.

**Cause.** The IDE's file tools intentionally refuse gitignored paths to prevent accidentally exposing secrets in chat output.

**Fix.** For gitignored files, use `cat /path/to/file` via `run_command` (which is allowed but visible in the approval popup). For writes, write to a temp file via `write_to_file` and then `mv` or `cat >>` it into place.

### Auto-run / safety pitfalls

#### A1. Auto-running a destructive command

**Symptom.** The agent flips `SafeToAutoRun: true` on `rm -rf`, `git push --force`, `docker volume rm`, or `npm publish` and the user has no chance to review.

**Cause.** The agent over-trusts a previous successful execution and decides the next call is "obviously fine".

**Fix.** Auto-run is reserved for read-only operations and idempotent reads (`git status`, `git log -n 20`, `npm test`, `docker ps`). Anything that mutates state on disk, in a remote registry, or in a long-running service must always require user approval, even if the user has previously approved similar commands. The user's `AGENTS.md` explicitly forbids `npm publish` regardless.

#### A2. Running `npm publish` directly

**Symptom.** A package is published from the developer's laptop instead of from CI, with the wrong author or unsigned provenance.

**Cause.** The agent saw a successful test run and decided to publish.

**Fix.** Publishing in this codebase is CI-only via `.github/workflows/ci-helper-modules.yml`. Bumping the `version` in `package.json` and pushing to `main` is the only trigger. The CI workflow has a safety net that skips already-published versions.

#### A3. Force-pushing to a shared branch

**Symptom.** A `git push --force` rewrites `main`'s history, losing other contributors' commits.

**Fix.** Never force-push without explicit user approval. The user's `AGENTS.md` lists this as **Never** in the boundaries section. Use `--force-with-lease` if the user explicitly asks to amend.

#### A4. Modifying `.env` files

**Symptom.** A pre-existing `.env` file gets overwritten and the developer loses their local credentials.

**Fix.** The agent's allowed write locations are spelled out in `AGENTS.md` "Boundaries". `.env` is in the **Never** category (except `__dev__/.env`, which is the user's personal workspace). For new env keys, update `.env.example` files only.

---

## CI/CD Publishing

Each entry below maps a CI symptom to its root cause and the durable fix. The sibling philosophy doc is [`cicd-publishing.md`](cicd-publishing.md); this section is the journal of real failures that shaped those rules.

### 1. `Bind for 127.0.0.1:NNNN failed: port is already allocated` in CI

**Cause.** A workflow step started a container with `docker run -d --name foo -p 127.0.0.1:NNNN:NNNN ...` before the test step ran `npm test`. `pretest` then runs `docker compose down -v` (which does not touch the standalone container) followed by `docker compose up -d --wait`, which collides on the same port.

**Lesson.** Pick one owner of the Docker lifecycle. `pretest` already owns it both locally and in CI. Do not duplicate it with a workflow-level `docker run` step or a `services:` declaration that targets the same port -- pick one and remove the other.

### 2. `PROTOCOL_CONNECTION_LOST` only in CI

**Cause.** The healthcheck passed too early. On the developer's laptop the service finished init fast enough to be truly ready when the healthcheck passed; on a slower CI runner, the false-positive moment was wide enough that the test connected before init was complete, and the service then dropped the connection during a real init step.

**Lesson.** See `testing-local-modules.md` -> *Healthcheck Philosophy*. The healthcheck must probe at the same level the test will use (credentials, database, transport). Add `start_period` and enough `retries` that the total budget covers a cold-pull, cold-start initialization.

### 3. Push triggers tests but not publish, even though `version` was bumped

**Cause (historical).** The previous detect logic compared `HEAD~1:package.json` to `HEAD:package.json`. After a force-push or a reset that left the version the same on both sides, the diff was empty and publish was skipped -- even when the registry did not have the package.

**Fix.** The detect job now uses `npm view <name>@<version>` to ask the registry directly. If the version is missing, publish is scheduled regardless of git history.

### 4. CI runs tests for every module on every commit

**Cause.** `test_modules` was incorrectly populated -- typically because the regex used `\w+` instead of `[\w-]+` and matched module paths greedily, or because someone pushed a single commit that touched every module's `package.json`.

**Lesson.** Keep the path regex hyphen-aware: `src/helper-modules-[\w-]+/js-[\w-]+`. If a single commit truly does touch every module (e.g., a sweep), wide test coverage is the correct outcome.

### 5. `npm publish` runs but `409 You cannot publish over the previously published versions`

**Cause.** A workflow that publishes on every main push, without checking version bump or registry state.

**Lesson.** Use the unified `detect` -> `publish-*` pipeline. The detect job's registry-existence check, plus the per-publish-job safety-net, is the canonical way to avoid this error. Do not rebuild a separate publish workflow.

### 6. `403 Forbidden` on `npm publish`

**Cause.** Missing `permissions: packages: write` on the publish job, or repository-level workflow permission set to "Read repository contents permission".

**Lesson.** Both must be set:
1. Job-level `permissions: { contents: read, packages: write }`
2. Repo-level **Read and write permissions** in Settings -> Actions -> General

### 7. CI test fails with `npm error notarget No matching version found for @superloomdev/...`

**Cause.** The CI step ran `npm install` from the wrong directory (typically the module root instead of `_test/`). Each `_test/` directory has its own `package.json` with its own dependency tree. The repo-root `package.json` does not declare the test deps.

**Lesson.** In CI, set `working-directory:` to the module root and use `cd _test && npm install && npm test` for the test step. The same rule applies locally -- always pass `Cwd` to `_test/` for AI agents and scripts.

### 8. CI test fails with `MODULE_NOT_FOUND` for a helper that exists in the repo

**Symptom.** A `test-*` CI job fails with a Node.js `MODULE_NOT_FOUND` stack trace pointing to a file inside another helper module (e.g. `js-server-helper-nosql-mongodb/mongodb.js`), despite that module being present in `src/`. The error occurs even though `file:../../js-server-helper-nosql-mongodb` is listed in the `_test/package.json` dependencies.

**Cause.** `file:` path dependencies copy the directory contents at `npm install` time but **do not run `npm install` inside the linked package**. In CI, the runner checks out a fresh clone — the linked helper's own `node_modules/` are absent, so any `require()` inside it that needs its own npm deps (e.g. the `mongodb` driver) fails immediately with `MODULE_NOT_FOUND`.

This works locally only because the helper was previously installed in its own directory during development. CI never does that.

**Affected files (as of discovery).** `js-server-helper-verify/_test/package.json`, `js-server-helper-logger/_test/package.json`, `js-server-helper-auth/_test/package.json` — all used `file:` for `js-server-helper-nosql-mongodb` and `js-server-helper-nosql-aws-dynamodb`.

**Lesson.** Never use `file:` paths in `_test/package.json` for helper modules that have their own npm dependencies. Use registry version ranges (`"^1.0.0"`) instead. The `file:../` self-reference (pointing to the module under test) is the one legitimate exception — npm installs it as a directory link and the module itself has no transitive runtime deps outside what the test loader provides. For every other shared helper (storage, database, cloud), always pin to the published registry version.

Quick rule: `file:` is allowed **only** for `"[module-under-test]": "file:../"`. Everything else must be a registry semver range.

### 9. Tests Fail in CI

The publish job has `needs: [detect, test-*]`, so it never runs if tests fail. Fix the tests and push again. The detect job will pick the same set of unpublished modules and try again.

### 10. `Invalid workflow file: ... You have an error in your yaml syntax on line N`

**Cause.** A bash assignment inside a `run: |` block scalar contained an embedded literal newline:

```yaml
run: |
  PUBLISH_MODULES="$PUBLISH_MODULES$MODULE
"
```

YAML block scalars (`|`) require every non-empty line to be indented at least to the block's indent level. The closing `"` on its own line had zero leading spaces -- less than the block's indent -- which terminates the block scalar early and fails YAML parsing.

**Lesson.** Never embed a literal newline inside a bash string assignment within a YAML `run: |` block. Use bash's `$'\n'` escape (or `printf '%s\n'`, or a bash array) so every line of YAML respects the block's indentation:

```yaml
run: |
  PUBLISH_MODULES="${PUBLISH_MODULES}${MODULE}"$'\n'
```

This applies anywhere YAML uses block scalars: GitHub Actions `run:`, Docker Compose `command:`, Helm chart values, CI configs, etc.

### 11. `publish-*` jobs silently skip when an upstream `publish-*` is also skipped, breaking the test→publish chain

**Symptom.** A `test-*` job runs and succeeds. The next `publish-*` job in the chain is reported as `skipped` (zero steps, zero seconds). Multiple downstream `test-*` jobs then run against a stale registry version and fail with cryptic runtime errors like `TypeError: mongo.createIndex is not a function` — because the bumped helper version that supplied the new API was never actually published.

**Cause.** GitHub Actions evaluates an **implicit `success()`** check on every job that does not start its `if:` with a status-check function (`always()`, `failure()`, `cancelled()`, `!cancelled()`). And `success()` is **transitive** — it returns `false` if **any** job in the upstream `needs` graph (not just the direct needs) has the result `skipped`, `failure`, or `cancelled`. Quote from GitHub's docs: *"If a job fails or is skipped, all jobs that need it are skipped unless they use a conditional expression that causes the job to continue."*

A strictly-sequential test→publish pipeline like `ci-helper-modules.yml` mixes:

- `test-*` jobs that use `if: always() && !cancelled() && ...` → run regardless of upstream skips
- `publish-*` jobs that previously used `if: >- needs.detect.outputs.publish_modules != '[]' && contains(...)` → no override, so the implicit `success()` applied

In **fresh-state recovery** runs (every module needs publishing), nothing in the chain is skipped, so this never fires. In **steady-state** runs where some modules are already on the registry, those modules' `publish-*` jobs legitimately skip — and that skip silently propagates downstream, disabling every subsequent `publish-*` even though their direct `needs` (`detect` + the matching `test-*`) all succeeded.

**Concrete failure that surfaced this.** A run with `publish_modules = [auth, logger, nosql-aws-dynamodb, nosql-mongodb, verify]`:

- `publish-storage-aws-s3` correctly skipped (s3 already on registry, not in `publish_modules`)
- `test-nosql-aws-dynamodb` ran and succeeded (uses `always()`)
- `publish-nosql-aws-dynamodb` SKIPPED — even though it was in `publish_modules` and its direct `needs` succeeded — because `success()` walked the transitive chain back to `publish-storage-aws-s3` and saw `skipped`
- All downstream `publish-*` skipped for the same reason
- `mongodb@1.1.0` and `dynamodb@1.1.0` never reached the registry
- Then `test-verify`, `test-logger`, `test-auth` ran with `npm install` resolving `^1.0.0` to the stale registry `1.0.0`, which lacked the `createIndex` / `createTable` / `deleteRecordsByFilter` APIs the `1.1.0` source code calls — `TypeError` at first use

**Lesson.** Every `publish-*` job in a chained pipeline must override the implicit `success()` check and assert its own dependencies explicitly:

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

Two parts that both matter:

1. `!cancelled() &&` — disables the implicit transitive `success()` check (GitHub's recommended alternative to `always()` for normal jobs, per the official docs).
2. `needs.detect.result == 'success' && needs['test-foo'].result == 'success'` — restores the safety the implicit check used to give us, but scoped to the **direct** needs only. Hyphenated job IDs require bracket notation (`needs['test-foo']`, not `needs.test-foo` — the latter is parsed as subtraction).

**Defence in depth: pin `_test/package.json` to the version your code actually requires.** When a helper bumps its own version (e.g. `mongodb@1.1.0` adds `createIndex`) and downstream modules start calling the new API, every consuming `_test/package.json` must pin **that same `^1.1.0`**, not the older `^1.0.0`. Two reasons:

- If the upstream publish ever fails, `^1.1.0` causes `npm install` to fail with a clean `E404 No matching version` instead of installing the stale `1.0.0` and surfacing as a `TypeError` deep inside a test.
- The version pin documents the hard floor required by the source — anyone reading the test deps sees exactly what the module needs.

Quick rules:

- `_test/package.json` registry pins must match the **API surface the source code uses**, not the lowest published version.
- Every `publish-*` job in a chained workflow must start its `if:` with `!cancelled()` (or `always()`, `failure()`, `cancelled()`) and re-assert its direct `needs.<job>.result == 'success'` — otherwise a single skipped sibling silently disables the rest of the publish chain.

### 12. Main module and its adapters are both unpublished — bootstrap order

**Situation.** Any module that ships a main package plus separate adapter packages (e.g. `js-server-helper-auth` + `js-server-helper-auth-store-sqlite`) can reach a state where **both** the main module and one or more adapters have unpublished breaking changes. Neither side can reference the other via a registry semver range because the version does not exist yet.

**The correct sequence:**

1. **Test adapters locally against a `file:` path of the main module.** In each adapter's `_test/package.json`, temporarily point the main module dependency at the local checkout (`file:../../js-server-helper-<name>`). Run the full adapter test suite. This validates the new API contract end-to-end without touching the registry.

2. **Publish the main module** (bump version in `package.json`, push to main — CI publishes it).

3. **Switch adapter `_test/package.json` deps from `file:` to the newly published registry version** (e.g. `"^2.0.0"`). Re-run the adapter test suite against the live registry version. This confirms the package round-trips correctly through npm pack/publish and resolves correctly for real consumers.

4. **Publish the adapters** (bump versions, push to main — CI publishes them).

**Why the re-test in step 3?** `file:` deps are copied at `npm install` time — they bypass npm's pack/unpack pipeline entirely. A module that works locally via `file:` can silently fail after publishing if the `files` field in `package.json` is wrong, a required file is gitignored, or a `main` entry resolves differently after packing. Step 3 catches this class of error before any consumer is affected.

**Lesson.** The temporary `file:` reference is the one legitimate exception to the rule that `_test/package.json` only uses `file:` for the module under test itself — but it is only valid during the bootstrap window and must be replaced with a registry pin before the adapters are published. Add a comment so the intent is clear:

```json
"@superloomdev/js-server-helper-<name>": "file:../../js-server-helper-<name>"
```

Replace with `"^<version>"` after the main module is published (step 3).

### 14. `test-verify` CI fails with `Cannot find module '../stores/sqlite'` after stores/ was deleted

**Symptom.** `test-verify` in CI fails with `MODULE_NOT_FOUND` pointing to `../stores/sqlite` inside the verify module's own `_test/test-sqlite.js`. The `stores/` directory was intentionally deleted as dead code in the same commit that introduced standalone `js-server-helper-verify-store-*` packages.

**Cause.** Two related problems compounded:

1. The internal test file `_test/test-sqlite.js` still referenced the deleted `../stores/sqlite` path. It was not updated to use the npm package `@superloomdev/js-server-helper-verify-store-sqlite`.

2. The five `js-server-helper-verify-store-*` adapter packages had no CI jobs at all — `ci-helper-modules.yml` skipped directly from `publish-sql-postgres` to `test-verify`. This meant the adapters were never published to the registry, so `_test/package.json` could not resolve them even after the test file was fixed.

Additionally, the adapter `package.json` files had been (incorrectly) set to `private: true`, which would have prevented `npm publish` even if CI jobs existed.

**Fix.**
1. In `_test/test-sqlite.js`: replace `require('../stores/sqlite')` with `require('@superloomdev/js-server-helper-verify-store-sqlite')`.
2. In `_test/package.json`: add `"@superloomdev/js-server-helper-verify-store-sqlite": "^1.2.0"` to dependencies.
3. In all five adapter `package.json` files: set `"private": false` so `npm publish` works.
4. In `ci-helper-modules.yml`: insert ten new jobs (modules 17–21) — one `test-verify-store-*` + `publish-verify-store-*` pair per adapter — in the sequential chain before `test-verify`. Update `test-verify`'s `needs` to `[detect, publish-verify-store-dynamodb]`.

**Lesson.** Deleting an internal directory (`stores/`) that is still referenced by the module's own test suite, while simultaneously introducing replacement standalone packages, requires two coordinated changes: (a) update every `require()` that pointed at the old path, and (b) ensure the new packages exist in the CI pipeline and are published before any consumer runs `npm install`. A quick grep for the deleted path before committing prevents the first problem; checking whether each new adapter has CI jobs prevents the second.

### 13. CI fails on lint after local tests pass — pre-publish checklist not followed

**Symptom.** `npm test` in `_test/` passes locally (all green). The version is bumped and pushed to `main`. CI runs `npm run lint` from the module root as a separate step before tests and fails with `no-trailing-spaces` or a stale `eslint-disable-line` directive. The publish job never runs even though all functional tests would have passed.

**Cause.** The local test command (`node --test test.js` from `_test/`) never invokes ESLint. Lint is a separate `npm run lint` script defined in the module root's `package.json`, not in `_test/package.json`. CI always runs lint before tests; local workflow often only runs tests. Any whitespace issue or stale disable comment that was present (or introduced) before the push goes undetected locally.

**Lesson.** Before bumping the version in `package.json` and pushing to `main`, always run the **full pre-publish sequence** from the module root, not just from `_test/`:

```bash
# From the module root (e.g. src/helper-modules-server/js-server-helper-auth/)
npm run lint          # must exit 0
# From _test/
npm install && npm test  # must exit 0
```

Both must be green before the version bump commit. If lint fails, fix it first — do not push a lint-broken version and rely on CI to catch it. The lint fix will require a second commit and re-trigger the entire CI pipeline, wasting pipeline time and adding noise to the git log.

**Quick rule.** Treat `npm run lint` (module root) + `npm test` (`_test/`) as a single inseparable gate. Never bump a version without both passing locally.

---

## Local Module Testing

Each entry below maps a symptom to its root cause and the durable fix. The sibling philosophy doc is [`testing-local-modules.md`](testing-local-modules.md) (healthcheck philosophy, test concurrency rules, module reference table); this section is the journal of real failures that shaped those rules.

### 1. `npm error notarget No matching version found for @superloomdev/...`

**Cause.** `npm install` ran from the repo root or the module root instead of `_test/`. Each `_test/` directory has its own `package.json` with a different dependency tree.

**Lesson.** Always `cd` into `_test/` first. Tools that automate this (AI agents, scripts) must always pass `Cwd` explicitly to the `_test/` directory -- omitting it silently runs from the repo root.

```bash
# Wrong
cd src/helper-modules-server/js-server-helper-sql-postgres
npm test

# Correct
cd src/helper-modules-server/js-server-helper-sql-postgres/_test
npm install && npm test
```

### 2. `MODULE_NOT_FOUND` for a package that should be installed

**Cause.** A `require()` in the test uses the wrong scoped package name -- typically missing the category prefix (`@superloomdev/js-server-helper-postgres` instead of `@superloomdev/js-server-helper-sql-postgres`).

**Lesson.** The npm package name must match the full directory name, including every category prefix. Grep for the bare name (`grep -r "js-server-helper-postgres" _test/`) before assuming the install is broken.

### 3. Manually starting Docker before `npm test`

**Symptom.** `Bind for 127.0.0.1:NNNN failed: port is already allocated`, or tests fail immediately with `ECONNRESET` / `socket hang up`, many tests cancelled.

**Cause.** `pretest` runs `docker compose down -v --remove-orphans` first. That command only manages containers from its own compose project name -- it does not touch a manually started container. Then `docker compose up` tries to bind the same port and fails. (The same conflict exists in CI when a workflow step runs `docker run` ahead of `npm test`.)

**Lesson.** Pick one owner of the Docker lifecycle. `pretest` already owns it. Locally and in CI, never run a separate `docker run` or `docker compose up` for the same service before `npm test`.

### 4. `node --test test.js` directly without `pretest`

**Cause.** `pretest` did not run; no container is up. Tests fail immediately with connection errors.

**Lesson.** Use `npm test`, not `node --test test.js`. The lifecycle scripts exist for a reason.

### 5. Stale container from a previous failed run

**Cause.** A prior run died before its `posttest` could clean up.

**Fix.** `pretest` already handles this with `docker compose down -v --remove-orphans`. If `pretest` itself fails because of a deeper conflict, clean up manually from the same `_test/` directory:

```bash
docker compose down -v --remove-orphans
```

### 6. Tests pass locally, fail in CI with `Connection lost: The server closed the connection`

**Cause.** A healthcheck that returns "ready" too early. On Docker Desktop the service finishes init fast enough that the false-positive moment never overlaps with the test run; on a constrained CI runner, init takes longer, the healthcheck passes during a transient-ready window, and the server then drops connections during a real init step (e.g., MySQL's restart in normal mode).

**Lesson.** See [`testing-local-modules.md` *Healthcheck Philosophy*](testing-local-modules.md#healthcheck-philosophy-mandatory). Probe with the credentials, database, and transport the tests will use. Add `start_period` and enough `retries` that the total budget covers a cold-pull, cold-start initialization.

### 7. `test did not finish before its parent and was cancelled`

**Cause.** Concurrent execution of top-level `describe()` blocks. A lazy-init resource was created mid-test by a parallel block, leaving the cancelled block in a half-initialized state.

**Lesson.** Wrap the suite in `describe('Module', { concurrency: false }, ...)`. See [`testing-local-modules.md` *Test Concurrency*](testing-local-modules.md#test-concurrency-mandatory-for-stateful-modules).

### 8. `&& sleep 2` (or 5) in `pretest`

**Cause.** A previous developer added a sleep to mask an unreliable healthcheck.

**Lesson.** Sleeps are never the right fix. They paper over bad healthchecks, slow every developer's iteration, and still fail under load. Remove the sleep, then fix the healthcheck so `docker compose up -d --wait` truly waits until the service is ready.

### 9. AI agents or scripts hanging on a multi-line shell command

**Cause.** Heredocs (`cat <<'EOF' ... EOF`) and multi-line `-m` arguments to `git commit` cause zsh to enter `dquote>` continuation mode when the closing quote falls on a different line. Special characters (backticks, `$`, `!`, `(...)`) make this worse.

**Lesson.** For commit messages: prefer a single-line `-m`, or stack multiple `-m` flags, or use `-F /tmp/file` after writing the file via a non-shell tool. For file content: never use heredocs through a shell bridge; write to a file with the editor tool and `cat` it from there. Full journal: [*AI Terminal & Shell Bridge* -> S1/S2](#s1-heredocs-hang-the-bridge).

### 10. AWS SDK test hangs ~1-2s, then `success: false` with no clear error

**Symptom.** A test that exercises an AWS SDK function (`getSignedUrl`, `S3Client.send`, `DynamoDBClient.send`, etc.) takes 1-2 seconds and fails with `success === true` assertion failing. Stack trace points to your module's catch block but the underlying error is silent or absorbed.

**Cause.** No AWS credentials are passed to the SDK. The SDK walks the default credential provider chain: env vars -> shared config file -> EC2/ECS instance metadata (`http://169.254.169.254`). On a developer machine and on a GitHub Actions runner there is no instance metadata service, so the chain times out. The 1-2 second test duration is the metadata-service connection timeout.

**Lesson.** Every test that uses an AWS SDK client must inject dummy credentials, even when no real network call is made (URL signing, command construction, etc.). The dummies do not need to be valid -- they just need to exist so the SDK does not enter the default-chain code path.

The canonical pattern is to set them in the `test` script of `_test/package.json`:

```json
"test": "AWS_ACCESS_KEY_ID=local AWS_SECRET_ACCESS_KEY=local AWS_REGION=us-east-1 ... node --test test.js"
```

For service-specific env vars (`S3_ACCESS_KEY`, `DYNAMODB_ENDPOINT`, etc.), use the names the module's loader reads. The same env vars must also exist in `__dev__/.env.dev` and `docs/dev/.env.dev.example` per the four-file rule.

### 11. MongoDB replica-set healthcheck reports healthy before the node is PRIMARY

**Symptom.** Tests pass on a developer's macOS machine and fail in CI with the first few `writeRecord` / `getRecord` (after writing) calls returning `success: false` or `result.document === null`. Later writes in the same suite succeed. The mongodb helper's own `_test` and any downstream consumer's `_test:mongodb` are both vulnerable.

**Cause.** A naive replica-set healthcheck:

```yaml
test: ["CMD", "mongosh", "--eval", "try { rs.status().ok } catch(e) { rs.initiate({...}).ok }"]
```

returns truthy as soon as `rs.initiate()` returns. But on a single-node replica set the node still spends another **1-2 s in `SECONDARY` → `STARTUP2` → `PRIMARY`** before it accepts writes. `docker compose up --wait` returns "healthy" mid-election; the test process opens its driver and fires writes immediately. On Docker Desktop / macOS the local stack happens to be fast enough that the test loop hits PRIMARY by chance; on the slower hosted GitHub Actions runner the first writes land mid-election and fail with `not master`-style errors that the helper catches and surfaces as `success: false`.

**Lesson.** The healthcheck must verify the same readiness the tests require — *write-ready primary*, not just *replica-set initialized*. Use `db.hello().isWritablePrimary` and `quit(1)` so docker keeps retrying until the node is actually primary:

```yaml
test:
  - CMD
  - mongosh
  - --quiet
  - --eval
  - "try { rs.status() } catch(e) { rs.initiate({ _id: 'rs0', members: [{ _id: 0, host: 'localhost:27017' }] }) }; if (!db.hello().isWritablePrimary) quit(1)"
```

This is the same *probe-the-application-protocol* principle as MySQL's two-phase init (entry 6) — `rs.status().ok` is the equivalent of `mysqladmin ping -u root` (server alive but not yet ready for the test workload).

The general rule for any service that has an init phase distinct from "process up": the healthcheck must succeed only after the test-relevant phase has completed (PRIMARY for replica sets, `test_user` reachable for MySQL, `test_db` schema applied for Postgres, etc.).

### 12. `verify.generateAndStore` returns `COOLDOWN_ACTIVE` with `cooldown_seconds: 0` under concurrent calls

**Symptom.** `js-server-helper-verify` tests fail intermittently in CI (rarely locally) with `COOLDOWN_ACTIVE` errors even though the test explicitly sets `cooldown_seconds: 0`. The concurrency test in `_test/shared-store-suite.js` ("concurrent createPin calls with cooldown:0 all land") is the most reliable reproducer; downstream consumers of `verify` see the same flake on CI.

**Cause.** The cooldown gate in `generateAndStore` computed `now - existing.created_at` without short-circuiting when `cooldown_seconds === 0`. Under concurrency, two requests can share a microsecond-close `instance.time` while the store's `created_at` (captured a few milliseconds earlier by the first winning write) is *ahead* of the second caller's `now`. The signed diff is negative, `diff < cooldown_seconds` is trivially true for any positive threshold — and even for `0`, the strictly-less-than check fires when the diff is negative. The caller sees a cooldown error that has no real cooldown semantically.

The bug was dormant until the MongoDB PRIMARY-election fix (entry 11) stabilised CI enough that the race became reproducible; before that, the flake was attributed to the mongodb healthcheck and the true cause went unseen.

**Lesson.** A "cooldown disabled" configuration must short-circuit **before** any arithmetic on timestamps. The canonical fix is a single explicit check at the top of the gate:

```js
// verify.js generateAndStore
if (options.cooldown_seconds === 0) {
  // cooldown disabled — do not consult existing.created_at
} else if (existing && existing.created_at) {
  const diff = now - existing.created_at;
  if (diff < options.cooldown_seconds) {
    return { success: false, error: CONFIG.ERRORS.COOLDOWN_ACTIVE };
  }
}
```

Generalised rule: any time a helper has a "feature disabled when N === 0" semantics, the disabled branch must bypass every downstream computation that uses N or any state N would have produced. Never rely on `0 < diff < N` to be false when `N === 0`, because `diff` can be negative under concurrent non-monotonic time sources.

Applies anywhere a rate-limit, throttle, TTL, or cooldown is configurable with a "zero = off" value: `verify.cooldown_seconds`, `auth.LAST_ACTIVE_UPDATE_INTERVAL_SECONDS`, `logger` retention, and any future equivalent. Audit the gate when introducing any such option.

---

### 15. Repo-wide `MODULE_NOT_FOUND` after a "remove scope prefix" style commit

**Symptom.** All `_test/` suites fail immediately at `require('js-helper-utils')` with `MODULE_NOT_FOUND`. No code logic has changed; only `require('@superloomdev/...')` calls were rewritten to `require('...')` in a mass search-and-replace commit. `node_modules/` still contains only scoped packages (`@superloomdev/js-helper-utils`, etc.); the unscoped names simply don't exist.

**Cause.** npm installs packages under their full published name (the `"name"` field in `package.json`, which includes the `@superloomdev/` scope). A `require()` call must use that exact name. Removing the scope prefix from `require()` calls without simultaneously adding npm aliases (or renaming the packages on the registry) breaks every module that was changed.

**Lesson.** Never strip scope prefixes from `require()` calls unless the packages are also republished without the scope (or aliased via `package.json` `imports` map). The safe rule: **`require()` strings must always match `"name"` in the target package's `package.json` exactly.** Fix is a single `sed` to restore the `@superloomdev/` prefix across all `.js` files under `src/`, excluding `node_modules/`.

```bash
find src/ -name "*.js" -not -path "*/node_modules/*" | \
  xargs sed -i '' \
    "s/require('js-helper-/require('@superloomdev\/js-helper-/g; \
     s/require('js-server-helper-/require('@superloomdev\/js-server-helper-/g; \
     s/require('js-client-helper-/require('@superloomdev\/js-client-helper-/g"
```

---

### 16. Store contract method name drift between `logger.js` and test fixtures

**Symptom.** Logger unit tests fail with `TypeError: store.addLog is not a function` even though the memory store is correctly imported. Grep shows zero matches for `addRecord` in the source, yet the error points at `logger.js:147`.

**Cause.** When `logger.js` store contract method names were renamed (`addRecord`→`addLog`, `listByEntity`→`getLogsByEntity`, `listByActor`→`getLogsByActor`, `initializeStore`→`setupNewStore`, `cleanupExpiredRecords`→`cleanupExpiredLogs`), the rename was applied partially: `logger.js` and the adapter packages were updated but the inline `captureStore` and `minimalStore` stubs scattered throughout `_test/test.js` and the `memory-store.js` fixture were not. `node_modules` held a correct symlinked copy, but the directly-`require`d `../logger.js` used the new names — so the inline stubs were invisible mismatches.

**Lesson.** When renaming store-contract methods in the core module, search for **every store stub** in `_test/test.js` — not just the shared fixtures — because inline anonymous objects appear throughout the test file and are missed by a module-level rename. Grep pattern: `require('../logger.js')` → `addRecord|listByEntity|listByActor|initializeStore|cleanupExpiredRecords`. The same applies to any module that has inline store stubs in its test file (auth, verify).

### 17. Store contract method renames not propagated to adapter `_test/test.js` files — all adapter CI jobs fail

**Symptom.** All `test-verify-store-*` CI jobs fail with `TypeError: store.initialize is not a function`. All `test-auth-store-{sqlite,postgres,mysql}` fail with `TypeError: auth.createSchema is not a function`. Tests pass locally only if stale `node_modules` from a prior install are present.

**Cause.** Two separate renames were applied to the core module source and adapter `store.js` files but not propagated to the `_test/test.js` files:
1. `verify.js` + all `verify-store-*/store.js`: `store.initialize()` → `store.setupNewStore()` (v2.1.x → v2.2.0). The `_test/test.js` stubs in all 5 verify-store adapters were not updated. Because `verify` v2.2.0 was never published (CI was failing at the time), `^2.1.0` in `_test/package.json` resolved to v2.1.x on the registry — which uses the old name. This masked the problem locally but was exposed as soon as CI installed fresh.
2. `auth.js`: `auth.createSchema()` → `auth.setupNewStore()`. The 3 SQL auth-store adapter `_test/test.js` files still called `auth.createSchema()`.

**Lesson.** When renaming any store-contract or module-public method, **grep all `_test/test.js` files across every adapter** before committing — not just the module source and its own tests. Pattern: `grep -rn "old_method_name" src/`. Adapter test files are not auto-updated by renaming the source. Also: a new major-bump on a core module will not reach adapters until it is both published and the adapter `_test/package.json` pin is bumped.

---

## Adding a New Entry

Whenever a new failure mode is discovered:

1. **Reproduce it once** — confirm the root cause is what you think it is.
2. **Add an entry to the right section above** with `Symptom`, `Cause`, `Fix/Lesson`. Keep the numbering continuous within a section.
3. **If the rule is brief enough** to live in the `AGENTS.md` compact summaries (Safe Terminal Patterns, healthcheck rules, etc.), run `/propagate-changes` to update the compact mirror.
4. **Commit the journal entry and the summary together** so they never drift.

Doc drift is the slowest bug to find. **No exceptions** — every new lesson goes here first, then propagates.

Cross-reference rules:

- Pitfalls that belong to the `docs/architecture/` domain (module migration, refactors) go in [`../architecture/migration-pitfalls.md`](../architecture/migration-pitfalls.md), not here.
- The philosophy docs [`cicd-publishing.md`](cicd-publishing.md) and [`testing-local-modules.md`](testing-local-modules.md) keep only the **positive** rules (what to do). Symptoms and root causes always live here.
- Anchors in this file are stable — `AGENTS.md` and other cross-references rely on them. Never rename an H2 or H3 after it is published.
