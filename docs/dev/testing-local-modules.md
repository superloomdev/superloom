# Testing Helper Modules Locally

> **Language:** JavaScript

This guide is the canonical reference for running module tests on a developer machine. It focuses on the **operational how-to** plus the *why* behind healthcheck and lifecycle rules. The journal of real failures that produced these rules lives in [`pitfalls.md` → Local Module Testing](pitfalls.md#local-module-testing) - read that before assuming a "weird" failure is unique.

**Companion docs.**

- [`../testing/module-testing.md`](../testing/module-testing.md) - the **strategy** (testing tiers, badges, env vars, when to run what, module categories).
- [`../testing/unit-test-authoring-js.md`](../testing/unit-test-authoring-js.md) - how to author a single unit test (rules, naming, assertions).
- [`../testing/integration-testing.md`](../testing/integration-testing.md) - integration testing against real cloud services.

Use this file for **how to run the tests on your machine**; use the strategy doc for **which tier to run and why**.

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

Navigate to the module's `_test/` directory and run:

```bash
npm install   # from <module>/_test
```

Run this every time before testing. The module itself is linked via `file:../` so source changes are picked up automatically, but published peer dependencies may have been updated and `npm install` is the only safe way to refresh them. Skipping `npm install` is never worth the few seconds saved.

> **During module refactoring only:** use `rm -rf node_modules package-lock.json && npm install` instead. Stale lock files from temporary `file:` swaps and version resets to `1.0.0` can cause silent wrong-version installs. See `docs/dev/pitfalls.md` entry 21 and the `/js-helper-module-refactor` workflow Step 6.

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

Before bumping the version in `package.json` and pushing to `main`, **both gates must pass locally**. CI always runs lint before tests; skipping lint locally means a broken push, a second fix commit, and wasted pipeline time.

### Gate 1: Lint (run from module root)

```bash
# From the module root
npm run lint
```

Must exit `0` with no errors and no warnings. Common failures that only show up here and not in `npm test`:

- Trailing spaces or blank lines with whitespace (`no-trailing-spaces`)
- Stale `// eslint-disable-line` directives on lines where ESLint no longer reports the suppressed rule (`--report-unused-disable-directives`)
- Unused variables introduced during a refactor

Fix all lint issues before proceeding.

### Gate 2: Tests (run from `_test/`)

```bash
# From the module's _test/ directory
npm install && npm test
```

Must exit `0` with `fail 0`. See [Running Tests](#running-tests) above for the full contract.

### Then commit

Only after both gates pass:

1. Bump `version` in the module root `package.json` (patch / minor / major as appropriate)
2. `git add` only the files belonging to the module being published
3. Commit and push - CI will detect the version change and publish

**Never push a version bump with a lint failure.** It wastes pipeline time and pollutes the git log with a follow-up fix commit.

The failure mode that produced this rule is journaled in [`pitfalls.md` → CI/CD Publishing entry 13](pitfalls.md#13-ci-fails-on-lint-after-local-tests-pass--pre-publish-checklist-not-followed).

## Test Patterns You'll Encounter

Most modules follow the Docker-backed pattern above. A few use other patterns that are equally valid -- knowing which is which prevents wasted debugging time.

### Pattern: Real in-process server (Express adapter)

`js-server-helper-http-gateway-adapter-express` boots a real Express 5 server on a random free port (`app.listen(0)`) inside each `describe` block's `before` hook, exercises it with native `fetch`, and shuts it down in `after`. No Docker, no mocked `req`/`res` objects.

Why this matters: it caught **Express 5 dropping the `?` optional-parameter route syntax** that would never surface against a mocked Express. When you see `server-helper.js` with `startTestServer` / `makeRequest` in an `_test/` directory, this is the pattern.

### Pattern: JSON event fixtures (AWS adapter)

`js-server-helper-http-gateway-adapter-aws-apigateway` runs against 23 real API Gateway v2.0 event JSONs stored in `_test/fixtures/`. Six are copied verbatim from `aws/aws-lambda-go events/testdata` (the AWS SDK's own test inputs); 17 are hand-written for scenarios AWS does not publish.

No Docker, no AWS SDK, no SAM, no LocalStack. Each fixture is loaded via `fs.readFileSync` and piped through the adapter. When you see `_test/fixtures/*.json`, this is the pattern. Adding a new scenario means adding a new JSON file -- no extra test boilerplate.

### Pattern: In-process stub adapter (gateway module itself)

`js-server-helper-http-gateway` ships with an in-process stub adapter (`_test/stub-adapter.js`) that satisfies the 3-method adapter contract with fixed outputs. The stub is not a simulation of any real runtime -- it exists only to let the gateway exercise its own logic in isolation. Real-runtime coverage lives in the two adapter packages above.

---

## Test Infrastructure Dependencies

Some modules require direct access to underlying SDK classes for test setup/teardown, even though the main module wraps these dependencies internally. This creates a dependency duplication pattern that must be documented to prevent accidental removal.

### When Test Infrastructure Dependencies Are Needed

**Pattern:** Test needs direct access to SDK classes that the main module doesn't export

Common scenarios:
- **Database table management** - `CreateTableCommand`, `DeleteTableCommand` for test lifecycle
- **Cloud resource setup** - Bucket creation, queue setup, or other infrastructure commands
- **Service client mocking** - Direct client instances for test doubles

### Nomenclature Convention

Use descriptive `devDependency` names that make purpose obvious:

```json
{
  "devDependencies": {
    "test-infra-aws-sdk": "npm:@aws-sdk/client-dynamodb@^1.2.3",
    "test-infra-aws-sdk-s3": "npm:@aws-sdk/client-s3@^1.2.3",
    "test-infra-aws-sdk-sqs": "npm:@aws-sdk/client-sqs@^1.2.3"
  }
}
```

**Why this naming:**
- `test-infra-` prefix clearly indicates test infrastructure purpose
- Prevents accidental removal during cleanup
- Makes version-matching requirements obvious

### Version Matching Discipline

The test infrastructure dependency **must stay version-matched** with the main module's dependencies:

```javascript
// In test.js - document the contract
// NOTE: This devDependency must stay version-matched with ../package.json
const { SomeCommand } = require('@aws-sdk/client-dynamodb');
```

When upgrading the main module's SDK version, update the corresponding test infrastructure dependency simultaneously.

### Extensible Pattern

The `test-infra-` prefix and naming convention apply to any SDK or service client, not only AWS. Add new entries using the same shape: `test-infra-[provider]-[service]`.

---

## Healthcheck Philosophy (Mandatory)

A healthcheck must verify the same level of readiness that the test code requires. Probing the process is not enough. Probing a public port is rarely enough. The probe must exercise the application path the test will use.

Each module's `_test/docker-compose.yml` defines its own healthcheck. `docker compose up --wait` only returns once the healthcheck passes, which guarantees the service is ready for real traffic before any test code runs.

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

Every symptom, root cause, and durable fix this testing setup has ever produced is journaled in [`pitfalls.md` → Local Module Testing](pitfalls.md#local-module-testing). Twenty-one entries as of the last sweep, covering `ETARGET` from wrong `Cwd`, `MODULE_NOT_FOUND` from wrong scoped names, manually-started-Docker conflicts, the MySQL two-phase-init false positive, transient-ready windows, concurrent-describe race, `sleep` anti-pattern, AWS SDK metadata-chain timeouts, MongoDB replica-set PRIMARY-election race, the `verify.generateAndStore` cooldown-zero concurrency bug, stale `file:` resolved paths in lock files, and version-reset 1.0.0 tarball cache collisions.

When you hit a new testing failure: reproduce it, confirm the root cause, then add an entry to `pitfalls.md` under *Local Module Testing* (Symptom → Cause → Lesson). Do **not** add it here. This file is for positive rules only. Propagate a compact one-liner into `AGENTS.md` via `/compile-agents-md` if the rule is small enough to live there.

---

## When something does not match this guide

Doc drift is the slowest bug to find. If you encounter a failure mode that this guide does not cover, do not "just fix it once". Add the entry to [`pitfalls.md` → Local Module Testing](pitfalls.md#local-module-testing) in the same change that fixes the underlying problem, then run `/compile-agents-md` so `AGENTS.md` reflects the new state.
