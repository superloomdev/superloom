# Connection Lifecycle

> **Language:** JavaScript

A connection-holding driver manages a resource whose lifetime outlives a single request. The doctrine here governs when that resource opens, when it closes, and who decides. It applies to every driver that holds a pool or long-lived client: SQL (`sql-postgres`, `sql-sqlite`, `sql-mysql`), NoSQL (`nosql-mongodb`, `nosql-mongodb-admin`, `nosql-aws-dynamodb-admin`), and KV (`kv-valkey`, `kv-aws-elasticache`).

## On This Page

- [Three Lifetimes](#three-lifetimes)
- [The Deployment Rule](#the-deployment-rule)
- [The Background-Routine Gate](#the-background-routine-gate)
- [Upstream Landmines](#upstream-landmines)
- [Further Reading](#further-reading)

---

## Three Lifetimes

Every connection resource belongs to exactly one of three lifetimes. Each has its own registry and its own closure trigger.

| Lifetime | Covers | Registry | Closed by |
|---|---|---|---|
| Process or container | The pool or long-lived client itself | `addProcessCleanupRoutine` | `runProcessCleanup` on SIGTERM, or per request when `CLOSE_ON_CLEANUP` is true |
| Request | A connection borrowed via `getClient` | `addInstanceCleanupRoutine` | `runInstanceCleanup`, every request |
| Test | The pool, so the process can exit | The suite's `after()` hook | The test author |

A pool belongs to the process lifetime. A borrowed connection belongs to the request lifetime. A test fixture belongs to the test lifetime. No resource appears in two registries at once.

### Process lifetime

The driver creates its pool or client lazily in `initIfNot(instance)`. On first creation, it registers `close` as a process-scoped cleanup routine via `Lib.Instance.addProcessCleanupRoutine(instance, Module.close)`. The registration happens exactly once, guarded by the early return that checks whether the client already exists.

The driver never calls `close` itself. It never decides when the pool shuts down. That decision belongs to the entry point.

### Request lifetime

SQL drivers expose `getClient(instance)` and `releaseClient(instance, client)` for manual transactions. `getClient` borrows a connection from the pool and registers its release into the instance cleanup queue via `addInstanceCleanupRoutine`. `releaseClient` releases the connection back to the pool and removes the routine so it does not fire twice.

If the caller forgets `releaseClient`, the instance cleanup queue releases it at the end of the request. This is a safety net, not a license to skip the explicit release.

### Test lifetime

A test that opens a real pool must close it in an `after()` hook. If the pool stays open, the Node process hangs: the event loop never empties because the pool holds a socket reference. A test whose assertions all pass but whose process never exits is a **failing** test. The `node --test` summary line is the signal; the checkmarks are not.

---

## The Deployment Rule

The single config key `CLOSE_ON_CLEANUP` on `helper-instance` decides when process-scoped teardown runs. The entry point supplies it. The driver never reads it.

| Deployment | `CLOSE_ON_CLEANUP` | When `close` runs |
|---|---|---|
| Persistent (Express, Docker) | `false` | On SIGTERM, via `runProcessCleanup` |
| Serverless (Lambda) | `true` | After every request, via `runInstanceCleanup` |

Five rules follow from this:

- A driver declares **what kind of resource** it holds and never decides when it closes
- The single config key `CLOSE_ON_CLEANUP` on `helper-instance` decides, and the entry point supplies it
- A module **never reads the environment** to detect its platform. The boundary is already structural: a deployment has a Lambda entry point or a server entry point
- Closing a pool per request on a persistent server is an anti-pattern: it pays a TCP, TLS, and authentication handshake on every request
- Leaving a handle open on a serverless runtime keeps the worker alive and billable until the function times out, and marks it busy so it refuses new requests meanwhile

---

## The Background-Routine Gate

Background routines are a **gate** on teardown, not a member of it. `runInstanceCleanup` waits for them before draining the instance cleanup queue. It does not check a count and skip.

There is deliberately **no timeout** on that wait. Abandoning a routine would silently drop an audit row, or leave a consumed one-time verification code reusable. A routine that never signals is a defect and must surface as a platform timeout.

The order is fixed:

1. Wait for background routines to signal completion
2. Drain the instance cleanup queue (request-scoped resources)
3. Run process cleanup routines if `CLOSE_ON_CLEANUP` is true

A driver registers a background routine when it starts work that must complete before teardown: a log flush, a verification code consumption, a cache invalidation. The routine signals completion via the callback returned by `addBackgroundRoutine(instance)`.

---

## Upstream Landmines

Two driver defects were verified against upstream source during the doctrine's development. Both are the kind of thing a future author repeats if the mechanism is not recorded.

### mysql2: silent idle-eviction disablement

The idle reaper in `mysql2` starts only when `maxIdle < connectionLimit`, and `maxIdle` defaults to `connectionLimit`. Leaving `maxIdle` unset silently disables eviction. An `idleTimeout` setting becomes dead configuration: the reaper never runs, so idle connections are never closed.

The fix is to pass `maxIdle` explicitly from a config key (`POOL_MAX_IDLE`) and validate that it is less than `POOL_MAX`. A module that omits `maxIdle` is not "using the default" - it is silently disabling a feature.

### node-postgres: pool holds the event loop

The `node-postgres` pool holds a socket reference that keeps the Node event loop alive until every client is closed. A test runner that opens a pool and never closes it will hang: the process never exits because the pool's idle clients keep the loop non-empty.

The fix is `allowExitOnIdle: true`, which releases the socket reference when all clients are idle. This is what a test runner needs. A persistent server may also set it, since the pool reopens on the next request.

---

## Further Reading

- [Server Interfaces](server-interfaces.md) - the Express and Lambda entry points where cleanup is called
- [Server Common](server-common.md) - the composition root where `helper-instance` is loaded
- [Module Docs](../module-docs.md) - the required `docs/api.md` section for connection-holding modules
