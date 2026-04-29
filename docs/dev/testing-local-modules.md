# Testing Helper Modules Locally

This guide covers how to run tests for any server helper module locally. Follow
this exactly — common mistakes are documented at the bottom.

## Prerequisites

- Docker Desktop running
- `~/.npmrc` configured for GitHub Packages (see `npmrc-setup.md`)
- `GITHUB_READ_PACKAGES_TOKEN` set in your shell environment

```bash
export GITHUB_READ_PACKAGES_TOKEN=<your token>
```

---

## Running Tests

All module tests live in `_test/` inside the module directory. Always run
commands from `_test/` — never from the module root or the repo root.

### Step 1: Install dependencies

```bash
cd src/helper-modules-server/<module-name>/_test
npm install
```

Run this every time before testing. The module itself is linked via `file:../`
so any source changes are picked up automatically, but published peer
dependencies may have been updated.

### Step 2: Run tests

```bash
npm test
```

That is all. For modules with Docker dependencies, `npm test` manages the full
container lifecycle automatically via `pretest` and `posttest` scripts:

1. `pretest` — tears down any leftover container, starts a fresh one, and waits
   for the healthcheck to pass before proceeding
2. `test` — runs the Node.js test suite
3. `posttest` — tears down the container and removes its volumes

**Never start Docker containers manually before running `npm test`.** The
`pretest` script runs `docker compose down` first, which will conflict with a
manually started container and cause port or volume conflicts.

---

## Module Reference

| Module | Docker dependency | Healthcheck type |
|---|---|---|
| `js-server-helper-sql-sqlite` | None | N/A |
| `js-server-helper-sql-postgres` | Postgres 17 | `pg_isready` |
| `js-server-helper-sql-mysql` | MySQL 8 | `mysqladmin ping` |
| `js-server-helper-nosql-mongodb` | MongoDB 8 (replica set) | `mongosh rs.status()` |
| `js-server-helper-nosql-aws-dynamodb` | DynamoDB Local | HTTP probe on port 8000 |
| `js-server-helper-queue-aws-sqs` | ElasticMQ | HTTP probe on port 9324 |
| `js-server-helper-storage-aws-s3` | MinIO | HTTP health endpoint |

Each module's `_test/docker-compose.yml` uses a healthcheck that probes the
service at the application level, not just checks whether the process is running.
`docker compose up --wait` only returns after the healthcheck passes, which
guarantees the service is genuinely ready before any test code runs.

---

## Common Mistakes and Pitfalls

### Wrong working directory

**Symptom:** `npm error notarget No matching version found for @superloomdev/...`
or `MODULE_NOT_FOUND` for a package that should be installed.

**Cause:** Running `npm install` or `npm test` from the module root or the repo
root instead of `_test/`. Each `_test/` directory has its own `package.json`
with its own dependency tree.

**Fix:** Always `cd` into `_test/` before running any npm command.

```bash
# Wrong
cd src/helper-modules-server/js-server-helper-sql-postgres
npm test

# Correct
cd src/helper-modules-server/js-server-helper-sql-postgres/_test
npm install && npm test
```

### Manually starting Docker before npm test

**Symptom:** Container starts, tests fail immediately with `ECONNRESET` or
`socket hang up`, many tests cancelled.

**Cause:** `pretest` runs `docker compose down -v` first. If you started the
container manually, `down -v` removes it, then `docker compose up --wait`
starts a new one — but the healthcheck may not pass in time, or the container
may be in a conflicted state.

**Fix:** Never pre-start containers for modules that have `pretest` scripts.
Run `npm test` directly from `_test/`.

### Using `node --test test.js` directly without pretest

**Symptom:** Tests fail with connection errors because no Docker container is running.

**Fix:** Use `npm test`, not `node --test test.js` directly, unless you have
already started and verified the Docker container is healthy yourself.

### Stale container from a previous failed run

**Symptom:** `docker compose up` fails with a port conflict or volume error.

**Fix:** `pretest` already handles this with `docker compose down -v --remove-orphans`.
If you still have a conflict, manually clean up:

```bash
docker compose down -v --remove-orphans
```

Run from the module's `_test/` directory.
