# @superloomdev/js-server-helper-instance

[![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-brightgreen.svg)](https://nodejs.org)

Request instance lifecycle manager. Initialize per-request state, register cleanup routines, and track background tasks. Part of the [Superloom](https://github.com/superloomdev/superloom).

> **Server helper module** - manages per-request lifecycle. The `instance` object is passed to all functions during a request, enabling request-level performance tracking and cleanup coordination.

## API

| Function | Params | Return | Description |
|---|---|---|---|
| `initialize` | `()` | `Object` | Create new instance with timestamps, counters, cleanup queue |
| `addCleanupRoutine` | `(instance, fn)` | `void` | Register cleanup function (called with instance) |
| `cleanup` | `(instance)` | `void` | Run all cleanup functions (only if no pending background tasks) |
| `backgroundRoutine` | `(instance)` | `Function` | Register background task, returns completion callback |
| `getBackgroundQueueCount` | `(instance)` | `Integer` | Number of pending background routines |
| `getCleanupQueueCount` | `(instance)` | `Integer` | Number of registered cleanup functions |
| `getAge` | `(instance)` | `Integer` | Milliseconds since instance was initialized |

## Usage

```javascript
// In loader (Lib must contain Utils)
Lib.Instance = require('@superloomdev/js-server-helper-instance')(Lib, { /* config overrides */ });

// Create instance per request
const instance = Lib.Instance.initialize();

// Pass instance to all service module calls (enables request-level performance tracking)
const result = await Lib.DynamoDB.get(instance, 'my_table', { pk: 'user_001' });

// Register cleanup (e.g., close connections)
Lib.Instance.addCleanupRoutine(instance, function (inst) {
  // cleanup logic here
});

// Background task (runs after response is sent)
const done = Lib.Instance.backgroundRoutine(instance);
someAsyncTask(function () {
  done(); // Signal completion - triggers cleanup when all background tasks finish
});
```

## Instance Object Shape

```javascript
{
  time: 1600000000,       // Unix timestamp (seconds) - from Lib.Utils.getUnixTime()
  time_ms: 1600000000000, // Unix timestamp (ms) - passed to performanceAuditLog for timeline
  logger_counter: 0,      // Activity log counter
  background_queue: 0,    // Pending background routine count
  cleanup_queue: []       // Array of cleanup functions (FIFO)
}
```

## Peer Dependencies (Injected via Loader)

| Package | Purpose |
|---|---|
| `@superloomdev/js-helper-utils` | `getUnixTime()`, `getUnixTimeInMilliSeconds()` for timestamps |

## Direct Dependencies

None.

## Key Behavior

- **Cleanup waits for background routines**: `cleanup()` only executes when `background_queue === 0`
- **Auto-cleanup**: When the last background routine calls its completion callback, cleanup runs automatically
- **Idempotent**: Multiple `cleanup()` calls are safe - queue is reset after first execution
- **`instance.time_ms`**: Used by all service modules for `performanceAuditLog` - shows elapsed since request started

## Testing

| Tier | Runtime | Status |
|---|---|---|
| **Unit Tests** | Node.js `node --test` | [![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml) |

Run locally:

```bash
cd _test
npm install && npm test
```

See [Module Testing](https://github.com/superloomdev/superloom/blob/main/docs/architecture/module-testing.md) for the full testing architecture.
