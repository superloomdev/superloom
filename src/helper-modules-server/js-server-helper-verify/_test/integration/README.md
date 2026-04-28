# verify - Integration Tests (5 backends)

Same assertion suite, run against five real storage backends:

- **PostgreSQL 17**
- **MySQL 8.0.44**
- **SQLite** (built-in `node:sqlite`, in-memory)
- **MongoDB 8.2**
- **DynamoDB Local** (`amazon/dynamodb-local`)

The loader builds five separate `Verify` instances by calling the verify module loader five times, each with a different storage adapter (`./adapters/sql.adapter.js` for the three SQL engines, `./adapters/mongodb.adapter.js`, `./adapters/dynamodb.adapter.js`). The test file then iterates over all five and asserts the full lifecycle contract on each.

## Prerequisites

- Docker + Docker Compose v2
- Node 22.13+ (the SQLite adapter uses the built-in `node:sqlite` module)

## Run

```bash
# 1. Install integration test dependencies (mongodb driver, AWS SDK)
cd _test/integration
npm install

# 2. Run the suite (Docker lifecycle is automated via pretest/posttest)
npm test
```

Docker containers are started automatically by `pretest` and torn down by `posttest`. All environment variables have sensible defaults in `loader.js` that match `docker-compose.yml`.

## What gets exercised

The same `describe` block runs once per backend, asserting:

| Scenario | Verify call | Expected outcome |
|---|---|---|
| Happy path: create + verify with correct value | `createPin` -> `verify` | `success: true`, record deleted (replay returns `error: NOT_FOUND`) |
| Wrong value increments fail count | `createPin` -> `verify` (wrong value, twice) | `success: false, error: WRONG_VALUE`, `fail_count` grows but stays under `max_fail_count` |
| Lockout after `max_fail_count` exceeded | `createPin` -> 2 wrong attempts -> verify with correct code | `success: false, error: MAX_FAILS` |
| Expired record | `createPin` -> advance `verifyInstance.time` past `expires_at` -> `verify` | `success: false, error: EXPIRED` |
| Cooldown blocks repeat creation | `createPin` -> `createPin` immediately | second call returns `success: false, error: COOLDOWN_ACTIVE` |
| `cooldown_seconds: 0` allows immediate replacement | `createPin` -> `createPin` | both succeed, second overwrites first |
| Verify on absent record | `verify` on a never-created (scope, key) | `success: false, error: NOT_FOUND` |

If any backend fails any case, the adapter or schema setup for that backend is wrong - the verify module itself is exercised identically across all five.

## Notes

- **SQLite**: the loader uses `:memory:`. Each test process gets a fresh database; nothing persists between runs.
- **DynamoDB Local TTL**: AWS's local emulator accepts the `UpdateTimeToLive` API call but does not actually sweep expired items. The `EXPIRED` test case still passes because the verify module's own `instance.time > record.expires_at` check fires before any sweep would.
- **MongoDB TTL**: real MongoDB sweeps every ~60 seconds. Tests complete in under that interval, so the verify module's own check is what enforces expiry during the test - same as DynamoDB Local.
- **Network only**: this directory does not extend `_test/test.js`. The offline suite (in-memory adapter) still runs in CI on every push; integration tests run only when the user requests them or on a scheduled job.
