# Configuration

The MySQL store adapter is configured through the Auth parent's `STORE` and `STORE_CONFIG` keys. The adapter itself is a factory function; the parent calls it once at load time and retains the returned Store interface.

## On This Page

- [Loader Pattern](#loader-pattern)
- [`STORE_CONFIG` Keys](#store_config-keys)
- [Peer Dependencies](#peer-dependencies)
- [Environment Variables](#environment-variables)
- [Testing Tier](#testing-tier)

## Loader Pattern

```js
Lib.MySQL = require('@superloomdev/js-server-helper-sql-mysql')(Lib, {
  HOST:     'localhost',
  PORT:     3306,
  DATABASE: 'app_db',
  USER:     'app_user',
  PASSWORD: process.env.DB_PASSWORD,
  POOL_MAX: 10
});

Lib.AuthUser = require('@superloomdev/js-server-helper-auth')(Lib, {
  STORE:        require('@superloomdev/js-server-helper-auth-store-mysql'),
  STORE_CONFIG: { table_name: 'sessions_user', lib_sql: Lib.MySQL },
  ACTOR_TYPE:   'user',
  TTL_SECONDS:  2592000
});
```

The adapter is passed to the parent as a **factory function reference**, not as the result of a call. The parent invokes the factory internally with the right arguments (`Lib`, the full `CONFIG`, and the frozen `ERRORS` catalog). Treat `STORE` as a function value; do not call it yourself.

The connection pool is **not** created at loader time. `Lib.MySQL` lazy-initializes on the first query. The adapter does not open any connection during construction either; the first round-trip happens on `setupNewStore` or the first runtime call.

**MariaDB compatibility.** The adapter uses standard MySQL 8 SQL syntax (backtick identifiers, `INSERT ... ON DUPLICATE KEY UPDATE`, inlined `INDEX` in `CREATE TABLE`). MariaDB 10.3 and later are wire-compatible with this surface. The `Lib.MySQL` driver helper's `mysql2` connection works against both engines without changes.

## `STORE_CONFIG` Keys

| Key | Type | Required | Description |
|---|---|---|---|
| `table_name` | String | Yes | Name of the sessions table. Use one table per `actor_type` (`sessions_user`, `sessions_admin`, `sessions_device`, etc.) so multiple Auth instances can share one database without collision |
| `lib_sql` | Object | Yes | Initialized `Lib.MySQL` instance. The adapter delegates all SQL execution to this helper |

The validator throws an `Error` at loader time if either key is missing, null, undefined, or (for `table_name`) the empty string. The throw is intentional. Misconfiguration must fail at boot, never silently at first request.

`table_name` cannot contain a backtick character. The check happens lazily on first SQL build, not at config-validation time. Use lowercase, underscored identifiers (`sessions_user`, not `` `Sessions` ``).

## Peer Dependencies

The adapter does not require these packages directly. It accesses them through `Lib`, which the application populates before constructing the Auth parent.

| Package | Reads via `Lib` |
|---|---|
| `@superloomdev/js-helper-utils` | `Lib.Utils` for type checks in `store.validators.js` |
| `@superloomdev/js-helper-debug` | `Lib.Debug` for driver-error logging |
| `@superloomdev/js-server-helper-sql-mysql` | `Lib.MySQL` via `STORE_CONFIG.lib_sql` |

The driver helper (`Lib.MySQL`) carries its own peer dependency on `mysql2`. The adapter never `require`s `mysql2` directly; applications that never use this store never load the driver.

## Environment Variables

The adapter reads no environment variables at runtime. The variables below are consumed by `_test/loader.js` and never anywhere else; production deployments pass connection details directly through the `Lib.MySQL` loader.

| Variable | Default (Docker) | Purpose |
|---|---|---|
| `MYSQL_HOST` | `127.0.0.1` | MySQL host |
| `MYSQL_PORT` | `3307` | MySQL port (3307 to avoid collision with a host-local MySQL on 3306) |
| `MYSQL_DATABASE` | `test_db` | Database name |
| `MYSQL_USER` | `test_user` | MySQL user |
| `MYSQL_PASSWORD` | `test_pw` | MySQL password |

## Testing Tier

Service-dependent. The contract test suite runs against a real MySQL 8 container. The Docker lifecycle is fully automated by `npm test`:

```bash
cd _test && npm install && npm test
```

`pretest` runs `docker compose down -v --remove-orphans` (defensive cleanup) then `docker compose up -d --wait` to start the MySQL 8 container on port 3307. `posttest` removes containers and volumes (the image stays cached for next time). No manual `docker compose up` step is required.

The test entry point is `_test/test.js`. It loads `_test/store-contract-suite.js`, which contains a local copy of the shared contract suite maintained by the Auth parent module. Keeping the suite local (rather than fetching from the parent at test time) means the adapter's test harness is self-contained and records which contract version it was built against.

The suite covers two tiers:

- **Tier 1. Adapter unit tests.** Store loader config validation; identifier quoting rejection; TINYINT 0/1 boolean handling; `custom_data` JSON round-trip; BIGINT defensive coercion; hash-mismatch returns `record: null`; `updateSessionActivity` identity blocklist; UPSERT immutability for primary-key and per-install fields; `cleanupExpiredSessions` `deleted_count` accuracy
- **Tier 3. Full Auth lifecycle integration.** Every public Auth API path driven against the real MySQL backend through the store contract suite. Catches integration bugs that the unit tests cannot see (parent-side ordering, error envelope propagation, scheduled-cleanup interaction with active sessions)

Tier 2 (an in-process emulated backend) is not applicable to MySQL. There is no embedded variant; emulation would require a separate test surface that would diverge from the real driver over time.
