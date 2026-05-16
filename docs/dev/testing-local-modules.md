# Testing Helper Modules Locally

> **Language:** JavaScript

This guide is the canonical reference for running module tests on a developer machine. It focuses on the *why* behind healthcheck and lifecycle rules. The journal of real failures that produced these rules lives in [`pitfalls.md` → Local Module Testing](pitfalls.md#local-module-testing) — read that before assuming a "weird" failure is unique.

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

## Pre-Publish Checklist

Before bumping the version in `package.json` and pushing to `main`, **both gates must pass locally**. CI always runs lint before tests — skipping lint locally means a broken push, a second fix commit, and wasted pipeline time.

### Gate 1 — Lint (run from module root)

```bash
# From the module root, e.g. src/helper-modules-server/js-server-helper-auth/
npm run lint
```

Must exit `0` with no errors and no warnings. Common failures that only show up here and not in `npm test`:

- Trailing spaces or blank lines with whitespace (`no-trailing-spaces`)
- Stale `// eslint-disable-line` directives on lines where ESLint no longer reports the suppressed rule (`--report-unused-disable-directives`)
- Unused variables introduced during a refactor

Fix all lint issues before proceeding.

### Gate 2 — Tests (run from `_test/`)

```bash
# From the module's _test/ directory
npm install && npm test
```

Must exit `0` with `fail 0`. See [Running Tests](#running-tests) above for the full contract.

### Then commit

Only after both gates pass:

1. Bump `version` in the module root `package.json` (patch / minor / major as appropriate)
2. `git add` only the files belonging to the module being published
3. Commit and push — CI will detect the version change and publish

**Never push a version bump with a lint failure** — it wastes pipeline time and pollutes the git log with a follow-up fix commit.

The failure mode that produced this rule is journaled in [`pitfalls.md` → CI/CD Publishing entry 13](pitfalls.md#13-ci-fails-on-lint-after-local-tests-pass--pre-publish-checklist-not-followed).

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

## Known Failure Modes

Every symptom, root cause, and durable fix this testing setup has ever produced is journaled in [`pitfalls.md` → Local Module Testing](pitfalls.md#local-module-testing). Thirteen entries as of the last sweep, covering `ETARGET` from wrong `Cwd`, `MODULE_NOT_FOUND` from wrong scoped names, manually-started-Docker conflicts, the MySQL two-phase-init false positive, transient-ready windows, concurrent-describe race, `sleep` anti-pattern, AWS SDK metadata-chain timeouts, MongoDB replica-set PRIMARY-election race, and the `verify.generateAndStore` cooldown-zero concurrency bug.

When you hit a new testing failure: reproduce it, confirm the root cause, then add an entry to `pitfalls.md` under *Local Module Testing* (Symptom → Cause → Lesson). Do **not** add it here — this file is for positive rules only. Propagate a compact one-liner into `AGENTS.md` via `/propagate-changes` if the rule is small enough to live there.

---

## When something does not match this guide

Doc drift is the slowest bug to find. If you encounter a failure mode that this guide does not cover, do not "just fix it once". Add the entry to [`pitfalls.md` → Local Module Testing](pitfalls.md#local-module-testing) in the same change that fixes the underlying problem, then run `/propagate-changes` so `AGENTS.md` reflects the new state.
