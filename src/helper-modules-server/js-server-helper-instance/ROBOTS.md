# js-server-helper-instance

Request lifecycle manager. Creates per-request state, tracks background routines, runs cleanup.

## Type
Server helper. Offline (no external services needed).

## Peer Dependencies
- `@superloomdev/js-helper-utils` - injected as `Lib.Utils`

## Direct Dependencies
None.

## Loader Pattern (Factory)

```javascript
Lib.Instance = require('@superloomdev/js-server-helper-instance')(Lib, { /* config overrides */ });
```

Each loader call returns an independent Instance interface with its own `Lib` and `CONFIG`. Stateless - the per-request instance object returned by `initialize()` is held by the caller, never inside this module.

## Config Keys
None currently. Future: MODE ('lambda' | 'express').

## Exported Functions

initialize() → Object | async:no
  Create new request instance with timestamps and empty queues.
  Returns: { time, time_ms, logger_counter, background_queue, cleanup_queue }
  time = unix seconds. time_ms = unix milliseconds (use for perf logging).

addCleanupRoutine(instance, cleanup_function) → void | async:no
  Register a function to run when request completes and all background routines finish.
  cleanup_function signature: fn(instance)

cleanup(instance) → void | async:no
  Execute all cleanup functions if background_queue is 0.
  Resets cleanup_queue after execution.

backgroundRoutine(instance) → Function | async:no
  Register a new parallel background routine.
  Returns completion callback - call it when the routine finishes.
  Cleanup auto-triggers when all background routines complete.

getBackgroundQueueCount(instance) → Number | async:no
  Number of pending background routines.

getCleanupQueueCount(instance) → Number | async:no
  Number of registered cleanup functions.

getAge(instance) → Number | async:no
  Milliseconds since instance was initialized. Uses instance.time_ms.

## Patterns
- instance.time_ms is the request start timestamp - pass to performanceAuditLog for request-level timeline
- Background routines: increment on register, decrement on complete, cleanup when 0
- Cleanup queue is FIFO - functions execute in registration order
- Instance object is a plain object passed by reference to all functions in a request
