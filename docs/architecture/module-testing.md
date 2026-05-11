# Module Testing

How to test helper modules. This document covers the **strategy** (testing tiers, when to run what, badges, env vars). For developer machine setup see [`docs/dev/`](../dev/). For how to actually write a unit test see [`unit-test-authoring-js.md`](unit-test-authoring-js.md).

## On This Page

- [Testing Tiers (Industry Standard)](#testing-tiers---industry-standard)
- [README Badges (Standard)](#readme-badges-standard)
- [Testing Section (Standard)](#testing-section-standard)
- [Environment Variable Registration](#environment-variable-registration)
- [Environments](#environments)
- [Running Tests](#running-tests)
- [Module Categories](#module-categories)
- [CI/CD for Service-Dependent Modules](#cicd-for-service-dependent-modules)
- [Integration Testing](#integration-testing)
- [Test Loader Pattern](#test-loader-pattern)
- [Adding Tests to a New Module](#adding-tests-to-a-new-module)

---

## Testing Tiers - Industry Standard

The project follows the standard 4-tier testing model. **This framework handles tiers 1 and 2.** Tiers 3 and 4 are the responsibility of the application project that consumes these modules.

| # | Tier | Scope | What It Tests | Where | CI/CD |
|---|---|---|---|---|---|
| 1 | **Emulated** | Module | Logic against local emulators (DynamoDB Local, MinIO, etc.) | Developer machine (Docker) | ✅ Automated |
| 2 | **Integration** | Module | Module against real cloud services (real DynamoDB, real S3, etc.) | AWS sandbox account (isolated resources) | ✅ Can be automated (needs credentials) |
| 3 | **Staging** (Sandbox) | Application | Full application end-to-end in a production-mirror environment | Dedicated AWS account | ✅ Automated (app CI/CD) |
| 4 | **Production** | Application | Live system | Production AWS account | N/A |

**Key principles:**
- **Emulated tests** run in CI/CD automatically - they gate publishing
- **Integration tests** can be automated in CI/CD once AWS credentials are provided via GitHub Secrets. Until then, they are developer-triggered locally
- **Staging** (also called **sandbox** at the application level) is a full application deployment in a separate AWS account that mirrors production. Handled by the application project (e.g., `demo-project/`), not by individual modules
- **Production** is never a testing environment - it is the live system

### Module-Level Testing (Tiers 1 and 2)

This is what this framework manages. Every service-dependent module should aim to have both tiers:

| Tier | Docker Required | AWS Credentials | Costs | Same Test Code |
|---|---|---|---|---|
| **Emulated** | Yes | No (dummy values) | Free | Yes - config switches endpoint |
| **Integration** | No | Yes (sandbox IAM) | Small | Yes - no endpoint override |

The same test file (`_test/test.js`) runs against both tiers. The only difference is the config: emulated sets `DYNAMODB_ENDPOINT=http://localhost:8000`, integration leaves it unset so the SDK hits real AWS.

### README Badges (Standard)

Every module README must include **exactly 3 badges** at the top: Test, License, Node.js. Integration test status lives in the Testing section table (see below), not in the header - this keeps headers uniform across offline and service-dependent modules.

**All modules (3 badges):**

```markdown
[![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-brightgreen.svg)](https://nodejs.org)
```

We use GitHub's **native badge endpoint** (served by GitHub, works with private repos). The label reads `Test` because the workflow is named `Test` in `ci-helper-modules.yml` (`name: Test`). The badge reflects the status of the unified `ci-helper-modules.yml` workflow on `main` - it turns red only if tests fail. Publish failures do not affect this badge because publish jobs are gated behind their test jobs and are no-ops when there is no version bump.

### Testing Section (Standard)

Every module README must include a `## Testing` section **near the end** (after all API, config, and dependency sections, typically just before `## Notes` or end of file). The `## Testing` section is intentionally last - it is only relevant to contributors and maintainers, not to most users of the module. Keep it lean: status table + minimal run commands + link to the full ops guide. Full setup steps (docker-compose start, env var blocks, teardown) live exclusively in `_test/ops/` - never duplicated in the README.

**Offline modules** (1 row):

```markdown
## Testing

| Tier | Runtime | Status |
|---|---|---|
| **Unit Tests** | Node.js `node --test` | [![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml) |

Run locally:

\`\`\`bash
cd _test
npm install && npm test
\`\`\`

See [Module Testing](https://github.com/superloomdev/superloom/blob/main/docs/architecture/module-testing.md) for the full testing architecture.
```

**Service-dependent modules** (2 rows - emulated + integration):

```markdown
## Testing

| Tier | Runtime | Status |
|---|---|---|
| **Emulated Tests** | [Emulator] (Docker) | [![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml) |
| **Integration Tests** | Real [Service] (sandbox) | ![Integration Tests](https://img.shields.io/badge/Integration_Tests-not_yet_tested-lightgrey) |

### Emulated (Docker)

```bash
cd _test && npm install && npm test
```

Docker lifecycle is automatic: `pretest` starts the [emulator] container, `posttest` stops and removes it (containers and volumes only — images are cached). No manual `docker compose up` needed.

Full guide: `_test/ops/00-local-testing/[module]-setup.md`

### Integration (Real Service)

```bash
source init-env.sh   # select 'integration'
cd _test && npm install && npm test
```

Full guide: `_test/ops/01-integration-testing/[module]-integration-setup.md`

See [Module Testing](https://github.com/superloomdev/superloom/blob/main/docs/architecture/module-testing.md) for the full testing architecture.
```

**Integration test badge values** (use whichever matches current reality):

| Status | Badge |
|---|---|
| Not yet tested | `![Integration Tests](https://img.shields.io/badge/Integration_Tests-not_yet_tested-lightgrey)` |
| Passing | `![Integration Tests](https://img.shields.io/badge/Integration_Tests-passing-brightgreen)` |
| Failing | `![Integration Tests](https://img.shields.io/badge/Integration_Tests-failing-red)` |

The integration test badge is a static shield (not linked to CI) because integration tests are manual. Update it manually in the Testing table after running integration tests against the sandbox environment.

## Environment Variable Registration

When a module reads any environment variable in `_test/loader.js`, that variable **must** be registered in all four places before the module is considered complete:

| File | Value type |
|---|---|
| `docs/dev/.env.dev.example` | Dummy value (matches docker-compose) |
| `docs/dev/.env.integration.example` | Placeholder (e.g. `your-db-host`) |
| `__dev__/.env.dev` | Dummy value (matches docker-compose) |
| `__dev__/.env.integration` | Placeholder |

**Rules:**
- Every key present in `.env.dev` must also be present in `.env.integration` - never skip a key in one file
- Dummy values for dev must match the credentials in `_test/docker-compose.yml` exactly
- Use `us-east-1` as the default region for all dummy/placeholder values
- Never hard-code env var values inside `_test/loader.js` - the module's own `config.js` handles defaults; the loader only reads `process.env`
- The `_test/ops/00-local-testing/` setup guide must include an explicit block showing exactly which keys to add to `__dev__/.env.dev` and their dummy values

## Environments

| Environment | Purpose | Config Source |
|---|---|---|
| **dev** | Local machine, Docker emulators | `__dev__/.env.dev` via `source init-env.sh` |
| **integration** | Real cloud services (sandbox account), isolated test data | `__dev__/.env.integration` via `source init-env.sh` |

Staging and production environments are managed by the application project, not by this framework.

## Running Tests

Every module follows the same pattern:

```bash
cd src/helper-modules-core/js-helper-utils/_test
npm install
npm test
```

For service-dependent modules, Docker lifecycle is automated via npm scripts:

```bash
cd src/helper-modules-server/js-server-helper-nosql-aws-dynamodb/_test
npm install && npm test
```

`npm test` runs: `pretest` (stop stale containers + start emulator) → `test` (run tests) → `posttest` (stop and remove containers and volumes only — images are cached). No manual `docker compose up/down` needed.

- **Runner:** Node.js built-in test runner (`node --test`)
- **Assertions:** `require('node:assert/strict')`
- **Location:** `_test/test.js` inside each module
- **Naming:** `should [expected behavior] when [condition]`
- **Coverage:** Every exported function must have at least one test

## Module Categories

Modules fall into two categories based on what they need to run tests:

### Offline Modules (no external services)

These run with just Node.js installed. No credentials, no Docker, no network.

| Module | Notes | CI Job |
|---|---|---|
| `js-helper-utils` | Pure functions | `test-offline-modules` |
| `js-helper-debug` | Console output | `test-offline-modules` |
| `js-helper-time` | Date/time math | `test-offline-modules` |
| `js-server-helper-crypto` | Node.js built-in `crypto` | `test-offline-modules` |
| `js-server-helper-instance` | In-memory lifecycle | `test-offline-modules` |
| `js-server-helper-http` | Real HTTP to `httpbin.org` (no credentials, no Docker) | `test-offline-modules` |
| `js-server-helper-verify` | In-memory adapter (storage injected per-call) | `test-verify` |
| `js-server-helper-logger` | In-memory store (multi-backend integration tests run via the module's `_test/docker-compose.yml`) | `test-logger` |
| `js-server-helper-auth` | In-memory adapter + JWT mode (multi-backend integration tests run via the module's `_test/docker-compose.yml`) | `test-auth` |

### Service-Dependent Modules (need Docker or cloud credentials)

These require external services. Each module has a `_test/docker-compose.yml` for local emulation and a dedicated CI job with `services:` container.

| Module | Emulator | Docker Image | CI Job |
|---|---|---|---|
| `js-server-helper-nosql-aws-dynamodb` | DynamoDB Local | `amazon/dynamodb-local` | `test-nosql-aws-dynamodb` |
| `js-server-helper-sql-postgres` | PostgreSQL | `postgres:17.9` | `test-sql-postgres` |
| `js-server-helper-sql-mysql` | MySQL | `mysql:8.0.44` | `test-sql-mysql` |
| `js-server-helper-nosql-mongodb` | MongoDB | `mongo:7` | `test-nosql-mongodb` |
| `js-server-helper-storage-aws-s3` | MinIO | `minio/minio` | `test-storage-aws-s3` |
| `js-server-helper-storage-aws-s3-url-signer` | MinIO | `minio/minio` | `test-storage-aws-s3-url-signer` |
| `js-server-helper-queue-aws-sqs` | ElasticMQ | `softwaremill/elasticmq:1.6.9` | `test-queue-aws-sqs` |

**Version pinning rule:** pin the emulator image to a specific patch version that matches the latest version of the target managed service. This keeps local testing aligned with production capabilities. Bump the pin when the managed service adds support for a newer version.

### CI/CD for Service-Dependent Modules

GitHub Actions supports `services:` which starts Docker containers alongside the job. Each service-dependent module gets its own CI job (not a matrix entry) because it needs a specific service container. In the unified `ci-helper-modules.yml`, this applies to **both** the test job (`test-*`) and the publish job (`publish-*`).

Example from `.github/workflows/ci-helper-modules.yml` (`test-nosql-aws-dynamodb`):
```yaml
test-nosql-aws-dynamodb:
  services:
    dynamodb:
      image: amazon/dynamodb-local:latest
      ports:
        - 8000:8000
  env:
    AWS_ACCESS_KEY_ID: local
    AWS_SECRET_ACCESS_KEY: local
    DYNAMODB_ENDPOINT: http://localhost:8000
```

**No Docker Compose needed in CI** - GitHub Actions `services:` replaces it. The same `docker-compose.yml` in `_test/` is for local developer use only.

## Integration Testing

Integration testing uses real cloud services with isolated test data. This validates behavior with features not available in emulators (e.g., DynamoDB Streams, TTL, IAM policies). Full guide: `docs/architecture/integration-testing.md`.

### When to Run

- Before a major version release
- After changing cloud-specific logic (e.g., IAM, encryption, streams)
- Optional for patch releases if emulated tests cover the change

### Setup Requirements

Each service-dependent module documents its integration testing setup in:
```
_test/ops/01-integration-testing/
```

Typical requirements:
1. An AWS sandbox account (see `demo-project/ops/01-cloud-provider/`)
2. An IAM unit-tester user with restricted permissions (only `test_` prefixed resources)
3. Credentials stored in `__dev__/secrets/sandbox.md` (never committed)
4. Environment loaded via `source init-env.sh` (select `integration`)

### Credentials

Integration test credentials are **never committed**. They are stored in `__dev__/secrets/` (gitignored) and loaded via environment variables. The CI/CD pipeline does **not** run integration tests - only emulated tests.

## Test Loader Pattern

Every module's `_test/` directory should use a **loader.js** that mirrors the main project loader.

**Loader rules (`_test/loader.js`):**
- **`process.env` is ONLY read here** - never in test.js or any other test file
- Reads all environment variables into a `Config` object
- Builds sub-configs from `Config` and passes them to module loaders
- Builds the `Lib` dependency container (Utils, Debug, module under test)
- Returns `{ Lib, Config }` - `Lib` for the dependency container, `Config` for resolved env values
- **No fallback defaults** (`||`) - the module's own `config.js` handles defaults
- **Inline export:** Use `module.exports = function loader () {` - no separate `const` declaration followed by `module.exports = loader`. This matches the factory pattern used in main module files

**Test file rules (`_test/test.js`):**
- Imports `{ Lib, Config }` from loader
- **NEVER accesses `process.env`** - uses `Config` from loader for everything
- Owns all test infrastructure (e.g., AdminClient for table setup/teardown)
- Test infrastructure uses `Config` values (region, credentials, endpoint)
- `DYNAMODB_ENDPOINT` is only present in `Config` for emulated testing; for integration testing it is `undefined` - SDK uses real AWS

This means the same test code runs against both emulated and real services - only the environment variables change.

```
_test/
  loader.js     ← ONLY file that reads process.env, returns { Lib, Config }
  test.js       ← imports { Lib, Config } from loader, owns test infrastructure
  package.json
  docker-compose.yml  (service-dependent only)
```

**README dependency documentation:**
- **Peer Dependencies (Injected via Loader):** `@your-org/*` modules injected through `shared_libs`
- **Direct Dependencies (Bundled):** Third-party packages in `package.json` `dependencies`

See `js-server-helper-aws-dynamodb/_test/loader.js` for the reference implementation.

## Adding Tests to a New Module

1. Create `_test/` directory in the module
2. Create `_test/loader.js` - reads env vars, builds `Lib` container
3. Create `_test/test.js` - imports from loader, uses `Lib.ModuleName`
4. Add `"test": "node --test _test/test.js"` to the module's `package.json` scripts
5. Document required environment variables in the module's `README.md`
6. Add env vars to `docs/dev/.env.dev.example` and `.env.integration.example`
7. For service-dependent modules: add `_test/docker-compose.yml` with emulator
8. For service-dependent modules: add `_test/ops/` with setup docs per testing tier
9. For service-dependent modules: add a dedicated `test-*` job in `.github/workflows/ci-helper-modules.yml` (not in the matrix) AND a matching `publish-*` job with the same service container
10. For offline modules: add the module path to the `test-offline` matrix in `.github/workflows/ci-helper-modules.yml` - the publish job auto-detects it from the `detect` job output
11. Verify: `npm test` from `_test/` directory
12. All exported functions must have at least one test
13. Update module `README.md` with badges and testing status
