# Configuration

The MongoDB store adapter is configured through the Auth parent's `STORE` and `STORE_CONFIG` keys. The adapter itself is a factory function; the parent calls it once at load time and retains the returned Store interface.

## On This Page

- [Loader Pattern](#loader-pattern)
- [`STORE_CONFIG` Keys](#store_config-keys)
- [Peer Dependencies](#peer-dependencies)
- [Environment Variables](#environment-variables)
- [Testing Tier](#testing-tier)

## Loader Pattern

```js
Lib.MongoDB = require('@superloomdev/js-server-helper-nosql-mongodb')(Lib, {
  CONNECTION_STRING:        'mongodb://localhost:27017/?directConnection=true',
  DATABASE_NAME:            'app_db',
  MAX_POOL_SIZE:            10,
  SERVER_SELECTION_TIMEOUT: 5000
});

Lib.AuthUser = require('@superloomdev/js-server-helper-auth')(Lib, {
  STORE:        require('@superloomdev/js-server-helper-auth-store-mongodb'),
  STORE_CONFIG: { collection_name: 'sessions_user', lib_mongodb: Lib.MongoDB },
  ACTOR_TYPE:   'user',
  TTL_SECONDS:  2592000
});
```

The adapter is passed to the parent as a **factory function reference**, not as the result of a call. The parent invokes the factory internally with the right arguments (`Lib`, the full `CONFIG`, and the frozen `ERRORS` catalog). Treat `STORE` as a function value; do not call it yourself.

The MongoDB client is **not** created at loader time. `Lib.MongoDB` lazy-initializes on the first query. The adapter does not open any connection during construction either; the first round-trip happens on the first `getSession`, `setSession`, or `cleanupExpiredSessions` call.

**No `setupNewStore` call needed.** Unlike SQL-backed siblings, this adapter's `setupNewStore` returns `NOT_IMPLEMENTED`. MongoDB auto-creates the collection on the first write. The operator-provisioned indexes (`prefix` required, `expires_at` recommended) are documented in [schema.md](schema.md).

## `STORE_CONFIG` Keys

| Key | Type | Required | Description |
|---|---|---|---|
| `collection_name` | String | Yes | Name of the sessions collection. Use one collection per `actor_type` (`sessions_user`, `sessions_admin`, `sessions_device`, etc.) so multiple Auth instances can share one database without collision |
| `lib_mongodb` | Object | Yes | Initialized `Lib.MongoDB` instance. The adapter delegates all driver execution to this helper |

The validator throws an `Error` at loader time if either key is missing, null, undefined, or (for `collection_name`) the empty string. The throw is intentional. Misconfiguration must fail at boot, never silently at first request.

## Peer Dependencies

The adapter does not require these packages directly. It accesses them through `Lib`, which the application populates before constructing the Auth parent.

| Package | Reads via `Lib` |
|---|---|
| `@superloomdev/js-helper-utils` | `Lib.Utils` for type checks in `store.validators.js` |
| `@superloomdev/js-helper-debug` | `Lib.Debug` for driver-error logging |
| `@superloomdev/js-server-helper-nosql-mongodb` | `Lib.MongoDB` via `STORE_CONFIG.lib_mongodb` |

The driver helper (`Lib.MongoDB`) carries its own peer dependency on the native `mongodb` driver. The adapter never `require`s `mongodb` directly; applications that never use this store never load the driver.

## Environment Variables

The adapter reads no environment variables at runtime. The variables below are consumed by `_test/loader.js` and never anywhere else; production deployments pass connection details directly through the `Lib.MongoDB` loader.

| Variable | Default (Docker) | Purpose |
|---|---|---|
| `MONGO_URL` | `mongodb://127.0.0.1:27018/?directConnection=true` | MongoDB connection string. Port 27018 (not the default 27017) avoids collisions with a host-local MongoDB. `directConnection=true` is required because the test container is a single-node instance, not a replica set |
| `MONGO_DATABASE` | `test_db` | Database name |

## Testing Tier

Service-dependent. The contract test suite runs against a real MongoDB container. The Docker lifecycle is fully automated by `npm test`:

```bash
cd _test && npm install && npm test
```

`pretest` runs `docker compose down -v --remove-orphans` (defensive cleanup) then `docker compose up -d --wait` to start the MongoDB container on port 27018. `posttest` removes containers and volumes (the image stays cached for next time). No manual `docker compose up` step is required.

The test entry point is `_test/test.js`. It loads `_test/store-contract-suite.js`, which contains a local copy of the shared contract suite maintained by the Auth parent module. Keeping the suite local (rather than fetching from the parent at test time) means the adapter's test harness is self-contained and records which contract version it was built against.

The suite covers two tiers:

- **Tier 1. Adapter unit tests.** Store loader config validation; composite `_id` construction; `prefix` field denormalization; `custom_data` native BSON storage; hash-mismatch returns `record: null`; `updateSessionActivity` identity blocklist (including `_id` and `prefix`); `setSession` upsert behavior; `cleanupExpiredSessions` `deleted_count` accuracy; `deleteSessions` zero-length no-op
- **Tier 3. Full Auth lifecycle integration.** Every public Auth API path driven against the real MongoDB backend through the store contract suite. Catches integration bugs that the unit tests cannot see (parent-side ordering, error envelope propagation, scheduled-cleanup interaction with active sessions)

Tier 2 (an in-process emulated backend) is not applicable to MongoDB. There is no embedded variant; emulation would require a separate test surface that would diverge from the real driver over time.

The single-node test container does not configure replica-set mode. If the application uses MongoDB transactions in its own code paths, the application's test environment needs to run a replica set; the Auth adapter itself does not require transactions.
