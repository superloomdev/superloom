# Connection Lifecycle

> **Language:** JavaScript

This page implements [Server Architecture](../../../principles/server-architecture.md) for resources that outlive one operation. It defines ownership and cleanup for shared resources, request-scoped resources, and resources opened by a test suite.

## On This Page

- [Three Lifetimes](#three-lifetimes)
- [Shared Resources](#shared-resources)
- [Request-Scoped Resources](#request-scoped-resources)
- [Deployment Policy](#deployment-policy)
- [Cleanup Order](#cleanup-order)
- [Entry-Point Contract](#entry-point-contract)
- [Test Contract](#test-contract)
- [Further Reading](#further-reading)

---
## Three Lifetimes

The host assigns every open resource to one lifetime. The lifetime determines the registration API and the code that triggers cleanup.

| Lifetime | Covers | Registration | Cleanup trigger |
|---|---|---|---|
| Process or container | A pool, long-lived client, or shared handle | `addProcessCleanupRoutine(instance, cleanup)` | Persistent shutdown, or the owning request when `CLOSE_ON_CLEANUP` is `true` |
| Request | A borrowed connection, temporary file, or request-owned handle | `addInstanceCleanupRoutine(instance, cleanup)` | `runInstanceCleanup(instance)` |
| Test | A real resource opened by a test suite | The suite's teardown hook | The suite's `after()` hook |

The resource owner declares the lifetime. The entry point supplies deployment policy and triggers cleanup.

---

## Shared Resources

A module registers shared-resource cleanup immediately after it opens the resource successfully. Registration occurs once per open cycle, after the guard that returns when the resource already exists.

The cleanup routine closes the resource and clears the module's stored reference. A later operation can then open a new resource and register a new cleanup routine.

Runtime code reaches shared-resource cleanup through `addProcessCleanupRoutine`. Tests may call the public cleanup function directly from suite teardown.

---

## Request-Scoped Resources

A function that lends a resource registers a fallback cleanup routine before returning it. For example, `getClient(instance)` registers `releaseClient(instance, client)` through `addInstanceCleanupRoutine`.

The caller still releases the resource explicitly in `finally`. The fallback remains queued, so release must be idempotent. If explicit release is omitted, `runInstanceCleanup` returns the resource at request completion.

---

## Deployment Policy

`CLOSE_ON_CLEANUP` belongs to `helper-instance`. The composition root supplies it when it builds `Lib.Instance`; connection-holding modules receive the resulting lifecycle API and do not inspect the environment.

| Runtime profile | `CLOSE_ON_CLEANUP` | Shared-resource behavior |
|---|---|---|
| Persistent process | `false` | `addProcessCleanupRoutine` stores cleanup in the process queue; requests reuse the resource |
| Request-isolated process | `true` | `addProcessCleanupRoutine` stores cleanup in the current instance queue; request cleanup closes the resource |

The persistent profile favors connection reuse and closes shared resources during graceful shutdown. The request-isolated profile favors deterministic teardown after each request and accepts the cost of reopening resources later.

The module declares what it owns. The composition root decides how long that ownership lasts.

---

## Cleanup Order

`runInstanceCleanup(instance)` executes a fixed sequence:

1. Wait until every registered background routine signals completion
2. Drain the instance cleanup queue in registration order
3. Run the process cleanup queue when `CLOSE_ON_CLEANUP` is `true`

Under the request-isolated profile, shared-resource routines are filed in the instance queue when they register. They normally run during step 2. Step 3 remains the final process-queue sweep performed by the lifecycle API.

Background routines gate cleanup; they are not cleanup routines. A module that starts deferred work registers it with `addBackgroundRoutine(instance)` and calls the returned signal from `finally`.

The wait has no timeout. Abandoning in-flight work can lose durable state or leave a state transition incomplete. A routine that never signals is a defect and remains visible as a host timeout.

Each cleanup routine is awaited. One cleanup failure is logged and does not prevent later routines from running.

---

## Entry-Point Contract

Every server entry point follows the same contract:

1. Build `Lib.Instance` once in the composition root with the runtime profile
2. Create one instance for each request
3. Pass the instance as the first argument through controllers, services, and helper calls
4. Call `runInstanceCleanup(instance)` from `finally`
5. On persistent shutdown, stop accepting work, wait for active requests, then call `runProcessCleanup()`

A request instance is execution context, not transport data. It stays separate from the standardized request object.

A request-isolated entry point does not depend on a shutdown signal. The host may freeze or terminate the runtime without an application shutdown phase, so request completion owns teardown.

---

## Test Contract

A suite that opens a real resource closes it in `after()`, even when the runtime profile could let the process exit with an idle handle. Teardown proves the public cleanup path and keeps the suite independent of driver-specific event-loop behavior.

A test run is complete only when `node --test` prints its summary and exits. Passing assertions without process exit indicates an open handle and is a failing run.

---

## Further Reading

- [Server Interfaces](server-interfaces.md) - request completion and persistent shutdown patterns
- [Server Common](server-common.md) - composition-root lifecycle configuration
- [Server Loader](server-loader.md) - one-time construction of `Lib.Instance`
- [Module Docs](../module-docs.md) - lifecycle documentation required for connection-holding modules
