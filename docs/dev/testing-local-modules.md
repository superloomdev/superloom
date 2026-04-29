# Testing Helper Modules Locally

This guide is the canonical reference for running module tests on a developer machine. It is **journalized**: every rule below corresponds to a real failure that cost time to diagnose. Read the *Pitfalls* section before assuming a "weird" failure is unique.

## Prerequisites

- Docker Desktop running
- `~/.npmrc` configured for GitHub Packages (see `npmrc-setup.md`)
- `GITHUB_READ_PACKAGES_TOKEN` set in your shell environment

```bash
export GITHUB_READ_PACKAGES_TOKEN=<your token>
```

---

## Running Tests

All module tests live in `_test/` inside the module directory. Always run commands from `_test/` -- never from the module root or the repo root.

### Step 1: Install dependencies

```bash
cd src/helper-modules-server/<module-name>/_test
npm install
```

Run this every time before testing. The module itself is linked via `file:../` so source changes are picked up automatically, but published peer dependencies may have been updated and `npm install` is the only safe way to refresh them. Skipping `npm install` is never worth the few seconds saved.

### Step 2: Run tests

```bash
npm test
```

That is all. For modules with Docker dependencies, `npm test` manages the full container lifecycle automatically via `pretest` and `posttest`:

1. `pretest` -- tears down any leftover container and starts a fresh one, waiting for the healthcheck to pass before proceeding
2. `test` -- runs the Node.js test suite
3. `posttest` -- tears down the container and removes its volumes

**Never start Docker containers manually before running `npm test`.** `pretest` runs `docker compose down` first; a manually started container will conflict on port allocation or be deleted mid-run.

---

## Module Reference

| Module | Docker dependency | Healthcheck probes |
|---|---|---|
| `js-server-helper-sql-sqlite` | None (uses `node:sqlite`) | N/A |
| `js-server-helper-sql-postgres` | Postgres | `pg_isready -U test_user -d test_db` |
| `js-server-helper-sql-mysql` | MySQL | `mysqladmin ping -u test_user -ptest_pw` |
| `js-server-helper-nosql-mongodb` | MongoDB (replica set) | `mongosh rs.status()` |
| `js-server-helper-nosql-aws-dynamodb` | DynamoDB Local | HTTP probe on the API port |
| `js-server-helper-queue-aws-sqs` | ElasticMQ | HTTP probe on the API port |
| `js-server-helper-storage-aws-s3` | MinIO | HTTP probe on `/minio/health/live` |
| `js-server-helper-storage-aws-s3-url-signer` | None (URL signing only) | N/A |

Each module's `_test/docker-compose.yml` uses a healthcheck designed around the principles in the next section. `docker compose up --wait` only returns once the healthcheck passes, which guarantees the service is ready for real traffic before any test code runs.

---

## Healthcheck Philosophy (Mandatory)

A healthcheck must verify the same level of readiness that the test code requires. Probing the process is not enough. Probing a public port is rarely enough. The probe must exercise the application path the test will use.

### Principles

1. **Probe the application protocol, not the process.** `java -version`, `process exists`, or `port open` only confirm the binary started -- not that it can serve requests. Use `pg_isready`, `mongosh rs.status()`, an HTTP request that returns a body, or a query against the test schema.

2. **Probe with the credentials and database the tests will use.** A healthcheck that authenticates as `root` against a server that is still creating `test_user` is a false positive. Probe as `test_user` against `test_db`. The check then implicitly confirms init has completed.

3. **Use TCP (`127.0.0.1`), not the local socket (`localhost`).** Tests connect from outside the container over TCP. A healthcheck that succeeds via Unix socket can pass while TCP listening is still being set up. Match the transport the tests use.

4. **The healthcheck must work on the slowest CI runner you target.** Set `interval`, `timeout`, `retries`, and `start_period` so the total budget covers a cold-pull, cold-start initialization on a constrained runner -- not just a warm Docker Desktop on the developer's laptop. A healthcheck that passes locally and times out in CI is the same as no healthcheck.

5. **`--wait` plus a real healthcheck is sufficient. Sleeps are not.** If you find yourself adding `&& sleep 5` after `docker compose up -d --wait`, the healthcheck is wrong. Fix the healthcheck.

### Why this matters: MySQL's two-phase init

The official `mysql:8` image runs init in two phases:

1. Start `mysqld` in temporary mode -- only `root` exists.
2. Apply config, create `test_user`, create `test_db`.
3. **Stop and restart `mysqld`** in normal mode.

A healthcheck of `mysqladmin ping -u root` passes during step 1. `--wait` returns. Tests start connecting as `test_user`. Step 3 then drops every live connection with `PROTOCOL_CONNECTION_LOST`. The fix is to probe with `test_user`, which is created at the end of step 2 -- the check then succeeds only after init is genuinely complete.

This pattern (an artifact created late in init that the test relies on) generalizes. Every database image has a similar sequence somewhere; design the healthcheck around it.

---

## Test Concurrency (Mandatory for Stateful Modules)

The Node.js built-in test runner runs top-level `describe()` blocks **concurrently** by default. Within a single test file, this means setup hooks (`before`/`after`) and tests from different `describe` blocks interleave -- including their first calls into the module under test.

For a module that uses lazy initialization (a connection pool, an AWS SDK client, a singleton adapter), concurrent first-calls race each other. The first parallel `before` may create a half-initialized resource that the second `before` then reuses incorrectly. Symptoms range from "test did not finish before its parent and was cancelled" to spurious connection errors.

### Rule

For every module test file that exercises a module with **any per-instance lazy state** (DB pool, persistent client, reused SDK), wrap the entire test in a single outer `describe` with `concurrency: false`:

```javascript
describe('ModuleName', { concurrency: false }, function () {

  before(async function () {
    // Setup that the lazy-init relies on
  });

  describe('feature one', function () {
    it('...', function () { ... });
  });

  describe('feature two', function () {
    it('...', function () { ... });
  });

  after(async function () {
    // Teardown
  });

});
```

Stateless modules (pure functions, no shared resources) do not need this wrapper, but adding it is harmless and makes the file pattern uniform.

---

## Common Pitfalls (Journal)

Each entry below maps a symptom to its root cause and the durable fix. Update this list whenever a new failure mode is discovered and resolved.

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

**Lesson.** See the *Healthcheck Philosophy* section above. Probe with the credentials, database, and transport the tests will use. Add `start_period` and enough `retries` that the total budget covers a cold-pull, cold-start initialization.

### 7. `test did not finish before its parent and was cancelled`

**Cause.** Concurrent execution of top-level `describe()` blocks. A lazy-init resource was created mid-test by a parallel block, leaving the cancelled block in a half-initialized state.

**Lesson.** Wrap the suite in `describe('Module', { concurrency: false }, ...)`. See *Test Concurrency* above.

### 8. `&& sleep 2` (or 5) in `pretest`

**Cause.** A previous developer added a sleep to mask an unreliable healthcheck.

**Lesson.** Sleeps are never the right fix. They paper over bad healthchecks, slow every developer's iteration, and still fail under load. Remove the sleep, then fix the healthcheck so `docker compose up -d --wait` truly waits until the service is ready.

### 9. AI agents or scripts hanging on a multi-line shell command

**Cause.** Heredocs (`cat <<'EOF' ... EOF`) and multi-line `-m` arguments to `git commit` cause zsh to enter `dquote>` continuation mode when the closing quote falls on a different line. Special characters (backticks, `$`, `!`, `(...)`) make this worse.

**Lesson.** For commit messages: prefer a single-line `-m`, or stack multiple `-m` flags, or use `-F /tmp/file` after writing the file via a non-shell tool. For file content: never use heredocs through a shell bridge; write to a file with the editor tool and `cat` it from there.

---

## When something does not match this guide

Doc drift is the slowest bug to find. If you encounter a failure mode that this guide does not cover, do not "just fix it once". Add the entry to the *Common Pitfalls (Journal)* section in the same change that fixes the underlying problem, then run `/propagate-changes` so `AGENTS.md` reflects the new state.
