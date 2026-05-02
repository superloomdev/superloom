# AI / Terminal Pitfalls

Canonical journal of every shell, terminal, and tool-bridge failure mode that AI assistants (Cascade, Copilot, etc.) have hit while working on this codebase. Each entry maps a **symptom** to its **root cause** and the **durable fix**. New entries are added the same day a new failure mode is discovered.

This file is the source of truth. The compact rules in `AGENTS.md` "Safe Terminal Patterns (AI-Specific)" are derived from it via `/propagate-changes`.

## On This Page

- [Why AI agents fail differently from humans](#why-ai-agents-fail-differently-from-humans)
- [Shell-bridge pitfalls](#shell-bridge-pitfalls)
- [Process and pager pitfalls](#process-and-pager-pitfalls)
- [Working-directory pitfalls](#working-directory-pitfalls)
- [Docker lifecycle pitfalls](#docker-lifecycle-pitfalls)
- [Test-environment pitfalls](#test-environment-pitfalls)
- [File-tool vs terminal pitfalls](#file-tool-vs-terminal-pitfalls)
- [Auto-run / safety pitfalls](#auto-run--safety-pitfalls)
- [Adding a new entry](#adding-a-new-entry)

---

## Why AI agents fail differently from humans

A human at a real terminal sees the prompt change to `dquote>` and fixes the quoting. An AI tool-bridge sees nothing, hits the proposed-command timeout, and the entire turn appears to "hang". The same root cause produces different symptoms depending on who is at the keyboard.

Three structural differences matter:

1. **No PTY interactivity.** The bridge cannot type into a sub-prompt. Once the shell enters `dquote>`, `heredoc>`, `quote>`, `cmdsubst>`, or `bracket>` continuation mode, there is no way out except killing the process.
2. **Output is captured asynchronously.** Anything that paginates (`less`, `more`, `git log` without `--no-pager`, `man`) blocks forever waiting for keyboard input that will never arrive.
3. **The current working directory is per-call.** Every `run_command` resets to whatever `Cwd` the tool-call specifies. There is no persistent session between calls, so `cd` in one call has no effect on the next call.

Every pitfall below is a specific consequence of one of these three. The mitigation is always the same: **avoid asking the shell to do anything interactive.**

---

## Shell-bridge pitfalls

### S1. Heredocs hang the bridge

**Symptom.** A `cat <<'EOF' ... EOF` command never returns. The user sees "no progress" until the tool-call times out.

**Cause.** Heredoc content with backticks, `$`, `!`, parentheses, or unterminated quotes can confuse zsh's parser. The shell enters a continuation prompt waiting for more input. There is no way to send the closing token through the bridge.

**Fix.** Never use heredocs through the bridge.

- For file content: use `write_to_file` (or `edit`) directly.
- For terminal-only sinks (e.g., appending to a gitignored file): write the content to a temp file with `write_to_file`, then `cat /tmp/file >> /path/to/target`.

### S2. Multi-line `git commit -m "…"`

**Symptom.** The command appears in the approval popup with the closing `"` on a different line. After the user approves, nothing happens - shell sits in `dquote>` mode.

**Cause.** zsh treats every newline inside an open `"…"` string as part of the string. With special characters in the body (`` ` ``, `$`, `!`, `(...)`), the parser also opens nested continuation states. None of them can be closed through the bridge.

**Fix.** Always pass commit messages on a single logical line.

| Need | Pattern |
|---|---|
| Single-line summary | `git commit -m "feat(module): one-line summary"` |
| Summary + body paragraphs | `git commit -m "feat(module): summary" -m "Paragraph one." -m "Paragraph two."` |
| Long structured body | `write_to_file` to `/tmp/commit-msg` then `git commit -F /tmp/commit-msg && rm /tmp/commit-msg` |

The same rule applies to `gh pr create`, `aws ssm put-parameter`, and any other tool that takes a quoted message.

### S3. Multi-line content embedded inside any quoted shell argument

**Symptom.** Same as S2 but for non-`git` commands. The approval popup renders the multi-line argument unreadably; after approval, the shell hangs.

**Cause.** Any time a `run_command` payload spans multiple lines because of an embedded quoted string, the shell-bridge sees the same `dquote>` failure mode.

**Fix.** Route the multi-line content through `write_to_file` to a temp file first, then have the shell read from the file with a single-line command. This pattern is also documented in `.windsurf/workflows/migrate-module.md` Section 7a.

### S4. Backticks inside a double-quoted argument

**Symptom.** `git commit -m "feat: closes issue \`#123\`"` either runs the contents of the backticks as a command substitution, or hangs in `cmdsubst>` mode.

**Cause.** Inside `"…"`, backticks always start command substitution. Escaping them with `\`` only sometimes works depending on shell version.

**Fix.** Use single quotes around the message, or replace the backticks with single quotes.

### S5. Tilde expansion inside quotes

**Symptom.** `cp ~/.npmrc "…"` works; `cp "~/.npmrc" "…"` silently fails with "no such file".

**Cause.** Tilde is a shell metacharacter that only expands outside quotes (and not in all positions even there).

**Fix.** Use `$HOME` (which is a regular variable and expands inside double quotes) or omit the surrounding quotes for the path.

---

## Process and pager pitfalls

### P1. Output paginators (`less`, `more`, `man`, `vi`)

**Symptom.** A command runs forever with no visible progress.

**Cause.** Paginators wait for keyboard input. There is no keyboard.

**Fix.** Never invoke an interactive viewer. The environment runs commands with `PAGER=cat` so most pager-aware tools (`git`, `systemctl`, `journalctl`) cooperate, but commands that ignore `PAGER` need explicit flags:

| Command | Flag |
|---|---|
| `git log` | `git log -n 20` (or `--no-pager`) |
| `git diff` | `git --no-pager diff` |
| `journalctl` | `journalctl --no-pager` |
| `systemctl status` | `systemctl --no-pager status …` |

### P2. Long-running foreground processes

**Symptom.** `npm run dev`, `node server.js`, `tail -f`, `docker compose logs -f` block the bridge until they exit, which they never will.

**Cause.** A `Blocking: true` `run_command` waits for process exit. A foreground server never exits.

**Fix.** Use `Blocking: false` with a small `WaitMsBeforeAsync` (e.g., 2-3 seconds) so the tool returns after the startup output is captured. Then later, use `command_status` with the returned `CommandId` to fetch more output. Always remember to stop the background process at the end of the task.

### P3. `npm install` of a watch-script package adding a postinstall daemon

**Symptom.** `npm install` completes, but a hidden `postinstall` script forks `node …watcher.js &` that keeps file descriptors open.

**Cause.** Some packages (rare, but they exist) start a background watcher in `postinstall`. The bridge sees the install command return but the descriptor lingers.

**Fix.** This is unusual in this codebase. If it ever happens, kill the dangling process via `pkill -f <package>` or restart the IDE.

### P4. Command output exceeding the bridge buffer

**Symptom.** `npm test` finishes but the captured output is truncated mid-line.

**Cause.** Very long stdout streams can exceed the IDE's capture buffer, especially when test runners print verbose output for hundreds of tests.

**Fix.** Pipe to `tail -N` or `grep` to keep only what matters: `npm test 2>&1 | tail -30`, `npm test 2>&1 | grep -E "^(ℹ|✖|✔)"`. The full log is still in `npm-debug.log` if needed.

---

## Working-directory pitfalls

### W1. Missing `Cwd` runs from the repo root

**Symptom.** `npm install` reports `ETARGET No matching version found for @superloomdev/...` even though the package version is correct.

**Cause.** The bridge resets to the repo root for every `run_command` unless `Cwd` is explicitly passed. The repo-root `package.json` has a different dependency tree from each module's `_test/package.json`.

**Fix.** Every module-scoped command (`npm install`, `npm test`, `docker compose …`) must pass `Cwd` set to the module's `_test/` directory.

```bash
# Wrong - silently runs from repo root
# run_command: { CommandLine: "npm install" }

# Right
# run_command: { CommandLine: "npm install", Cwd: ".../js-server-helper-foo/_test" }
```

### W2. `cd <path> && <command>` does not persist between calls

**Symptom.** A first call does `cd src/foo && npm install`; a second call assumes the cwd is `src/foo` and does `npm test`, but it runs from the repo root.

**Cause.** Each `run_command` is a fresh shell. There is no session.

**Fix.** Always pass `Cwd` to every call. Never rely on a previous `cd`. The user's AGENTS.md explicitly says **never propose a `cd` command** for the same reason.

### W3. Relative paths in tool calls

**Symptom.** `read_file({ file_path: "src/foo.js" })` fails or reads from the wrong directory.

**Cause.** Most tools require absolute paths. Relative paths are undefined behaviour.

**Fix.** Always pass absolute paths to file tools (`read_file`, `edit`, `write_to_file`, `find_by_name`, `grep_search`).

---

## Docker lifecycle pitfalls

### D1. Manually starting Docker before `npm test`

**Symptom.** `Bind for 127.0.0.1:NNNN failed: port is already allocated`, or tests fail immediately with `ECONNRESET`.

**Cause.** `pretest` runs `docker compose down -v --remove-orphans` for its own compose project name; it does not touch a manually started container. Then `pretest` tries to bind the same port and fails.

**Fix.** Pick one owner of the Docker lifecycle: `pretest` already owns it. Locally and in CI, never run a separate `docker run` or `docker compose up` for the same service before `npm test`.

### D2. Stale containers from a crashed prior run

**Symptom.** First test in a fresh session fails because a container from yesterday is still up but has stale state.

**Fix.** `pretest` already runs `docker compose down -v --remove-orphans`. If `pretest` itself fails on the start step, run that command manually from the same `_test/` directory.

### D3. `docker compose up -d` without `--wait`

**Symptom.** Tests start before the database accepts connections; intermittent `ECONNREFUSED` on the first request.

**Fix.** Always use `docker compose up -d --wait`. The healthcheck must be a real readiness probe (see `docs/dev/testing-local-modules.md` "Healthcheck Philosophy").

### D4. `docker compose --wait` returns immediately for a service with no healthcheck

**Symptom.** `--wait` reports the container as `Healthy` 0.5 s after start, even though the application inside is still initializing.

**Cause.** When a service has no `healthcheck:` block, Docker treats "container is running" as healthy. `--wait` honours that.

**Fix.** Either define a real healthcheck, or have the test code retry the first connection a few times. DynamoDB Local is the typical case here - the image has no curl/wget/nc to probe with, so the test setup absorbs a brief retry instead.

---

## Test-environment pitfalls

### T1. AWS SDK calls without dummy credentials

**Symptom.** A test that exercises the AWS SDK takes 1-2 seconds and fails with no clear error.

**Cause.** With no credentials in the env, the SDK walks the default credential provider chain. The last step of that chain is the EC2/ECS instance metadata service at `http://169.254.169.254`. There is no metadata service on a developer machine or a GitHub Actions runner, so the chain times out.

**Fix.** Every AWS test must inject dummy credentials via the `_test/package.json` `test` script:

```json
"test": "AWS_ACCESS_KEY_ID=local AWS_SECRET_ACCESS_KEY=local AWS_REGION=us-east-1 node --test test.js"
```

The dummies do not need to be valid - they just need to exist so the SDK skips the metadata lookup.

### T2. `node --test test.js` directly, without `pretest`

**Symptom.** Tests fail immediately with connection errors against the database or queue.

**Cause.** `pretest` did not run, so the container is not up.

**Fix.** Always use `npm test`. The lifecycle scripts exist for a reason.

### T3. Concurrent top-level `describe` blocks

**Symptom.** "test did not finish before its parent and was cancelled".

**Cause.** Node's built-in test runner runs top-level `describe` blocks concurrently. Suites that share lazy-init state (DB pool, AWS SDK client) race each other on the first call.

**Fix.** Wrap stateful suites in a single outer `describe('Module', { concurrency: false }, …)`. See `docs/dev/testing-local-modules.md` "Test Concurrency".

### T4. Healthcheck passes during a transient-ready window

**Symptom.** Tests pass locally, fail in CI with `Connection lost: The server closed the connection`.

**Cause.** A healthcheck that returns "ready" too early. MySQL's two-phase init is the classic case: `mysqladmin ping -u root` passes during phase 1, then the server restarts in phase 3 and drops every live connection.

**Fix.** Probe with the credentials, database, and transport the tests will use. See `docs/dev/testing-local-modules.md` "Healthcheck Philosophy".

---

## File-tool vs terminal pitfalls

### F1. Using `cat` to read large files

**Symptom.** Output is truncated at the bridge buffer limit, or the call times out.

**Fix.** Use `read_file` with `offset` + `limit`. Never `cat` files larger than ~200 lines.

### F2. Using `sed` / `awk` / `tr` to edit files

**Symptom.** The replacement either misses the target line, mangles whitespace, or partially succeeds.

**Cause.** Stream editors are powerful but error-prone for surgical edits, especially when the target string contains regex metacharacters or quotes.

**Fix.** Use the `edit` or `multi_edit` tool with `old_string` set to the exact unique substring. The tool guarantees an exact match or a clear error.

### F3. Editing a file with a heredoc through `cat > file <<EOF`

Same root cause as S1. Always use `write_to_file` or `edit` instead.

### F4. Reading gitignored files via `read_file`

**Symptom.** `read_file` returns "file is gitignored" for `__dev__/.env.dev`.

**Cause.** The IDE's file tools intentionally refuse gitignored paths to prevent accidentally exposing secrets in chat output.

**Fix.** For gitignored files, use `cat /path/to/file` via `run_command` (which is allowed but visible in the approval popup). For writes, write to a temp file via `write_to_file` and then `mv` or `cat >>` it into place.

---

## Auto-run / safety pitfalls

### A1. Auto-running a destructive command

**Symptom.** The agent flips `SafeToAutoRun: true` on `rm -rf`, `git push --force`, `docker volume rm`, or `npm publish` and the user has no chance to review.

**Cause.** The agent over-trusts a previous successful execution and decides the next call is "obviously fine".

**Fix.** Auto-run is reserved for read-only operations and idempotent reads (`git status`, `git log -n 20`, `npm test`, `docker ps`). Anything that mutates state on disk, in a remote registry, or in a long-running service must always require user approval, even if the user has previously approved similar commands. The user's `AGENTS.md` explicitly forbids `npm publish` regardless.

### A2. Running `npm publish` directly

**Symptom.** A package is published from the developer's laptop instead of from CI, with the wrong author or unsigned provenance.

**Cause.** The agent saw a successful test run and decided to publish.

**Fix.** Publishing in this codebase is CI-only via `.github/workflows/ci-helper-modules.yml`. Bumping the `version` in `package.json` and pushing to `main` is the only trigger. The CI workflow has a safety net that skips already-published versions.

### A3. Force-pushing to a shared branch

**Symptom.** A `git push --force` rewrites `main`'s history, losing other contributors' commits.

**Fix.** Never force-push without explicit user approval. The user's `AGENTS.md` lists this as **Never** in the boundaries section. Use `--force-with-lease` if the user explicitly asks to amend.

### A4. Modifying `.env` files

**Symptom.** A pre-existing `.env` file gets overwritten and the developer loses their local credentials.

**Fix.** The agent's allowed write locations are spelled out in `AGENTS.md` "Boundaries". `.env` is in the **Never** category (except `__dev__/.env`, which is the user's personal workspace). For new env keys, update `.env.example` files only.

---

## Adding a new entry

Whenever a new failure mode is discovered:

1. Reproduce it once - confirm the root cause is what you think it is.
2. Add an entry to the right section above with `Symptom`, `Cause`, `Fix`.
3. If the rule is brief enough to live in the `AGENTS.md` "Safe Terminal Patterns (AI-Specific)" section, run `/propagate-changes` to update the compact summary.
4. Commit both files together so the journal and the summary never drift.

Doc drift is the slowest bug to find. **No exceptions** - every new lesson goes here first, then propagates.
