# API Reference. `js-helper-debug`

Every exported function on the public interface, with parameters, return shape, and notes. For configuration keys and output formats see [Configuration](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-core/js-helper-debug/docs/configuration.md).

## On This Page

- [Conventions](#conventions)
- [Log Levels](#log-levels)
- [Backward-Compatible Logging](#backward-compatible-logging)
- [Performance Auditing](#performance-auditing)
- [Lifecycle](#lifecycle)

---

## Conventions

Every function in this module is **synchronous, side-effect-free with respect to module state, and never throws**. Each call writes (or skips) one line on stdout or stderr and returns `void`.

| Pattern | Behaviour |
|---|---|
| **Level threshold** | Calls below the configured `LOG_LEVEL` are suppressed. The order is `debug < info < warn < error < none`. The default is `debug` (everything writes) |
| **Output stream** | `error` writes to stderr; everything else writes to stdout. Lambda, Docker, and journald conventions for stream-based severity routing apply |
| **Output format** | `text` (human-readable, default) or `json` (one structured object per line). Format is per-instance, not per-call |
| **Return value** | Always `void`. The function is invoked for its side effect (a write or a no-op) |
| **`performanceAuditLog`** | Logs at the `debug` level; therefore suppressed in production by default unless `LOG_LEVEL` is `debug` |

Each loader call returns an independent interface with its own `CONFIG` captured in closure. Two interfaces with different `LOG_LEVEL` values can coexist in the same process; this is the recommended pattern for "noisy module under investigation, quiet everything else".

---

## Log Levels

Four single-purpose level functions plus one backward-compatibility shim. All accept a string `message` and an optional `data` object. Both arguments are forwarded to the formatter and rendered according to the instance's `LOG_FORMAT`.

### `debug(message, data?)`

Verbose development diagnostics. Use for "I want to see this only when actively debugging this module". Suppressed when `LOG_LEVEL` is anything other than `debug`.

| Param | Type | Required | Description |
|---|---|---|---|
| `message` | `string` | Yes | The log message |
| `data` | `object` | No | Additional structured data; merged into the JSON entry's `data` field, or appended in text mode |

### `info(message, data?)`

General operational information. Service-startup confirmations, configuration summaries, request-completion summaries. The default level for production logging.

| Param | Type | Required | Description |
|---|---|---|---|
| `message` | `string` | Yes | The log message |
| `data` | `object` | No | Additional structured data |

### `warn(message, data?)`

Recoverable issues, deprecation notices, retry-and-recover events. Anything a human should eventually look at but the system has handled.

| Param | Type | Required | Description |
|---|---|---|---|
| `message` | `string` | Yes | The log message |
| `data` | `object` | No | Additional structured data |

### `error(message, error?, extra_info?)`

Error conditions. The signature accepts an optional `Error` (or any object with `message` / `code` properties) and an optional context string. The formatter pulls `error.message`, `error.code`, and (when `INCLUDE_STACK_TRACE` is true) `error.stack` into structured fields.

| Param | Type | Required | Description |
|---|---|---|---|
| `message` | `string` | Yes | The log message |
| `error` | `Error` or `object` | No | The error to report. `error.message`, `error.code`, and `error.stack` are extracted into structured fields |
| `extra_info` | `string` | No | Free-form context attached as the `extra` field |

In `text` format, `error` calls expand into a multi-line block:

```text
[2026-05-17T01:25:00.000Z] [ERROR] Failed to read config
  Error: ENOENT: no such file or directory, open 'config.json'
  Code: ENOENT
  Extra: bootstrap
  Stack: [...]
```

In `json` format, the same call produces:

```json
{"timestamp":"2026-05-17T01:25:00.000Z","level":"ERROR","message":"Failed to read config","app":"app","env":"production","data":{"error":"ENOENT: no such file or directory, open 'config.json'","code":"ENOENT","extra":"bootstrap","stack":"[...]"}}
```

---

## Backward-Compatible Logging

### `log(...args)`

A drop-in replacement for `console.log`, kept for compatibility with code written before structured logging existed. Accepts any number of arguments and forwards them to `console.log` unchanged. Logs at the `info` level and is therefore suppressed when `LOG_LEVEL` is `warn`, `error`, or `none`.

> **For new code, use `info(message, data)` instead.** The backward-compatible `log` does not produce structured output and so its lines are invisible to log aggregators that key on the `level` and `message` fields.

---

## Performance Auditing

### `performanceAuditLog(action, routine, reference_time)`

Measures elapsed time (in milliseconds) and current heap usage, and writes one structured `[AUDIT]` line. The canonical use is at every external service boundary (database call, cloud-API call, HTTP request, queue operation) so a request's full timeline can be reconstructed from the logs.

| Param | Type | Required | Description |
|---|---|---|---|
| `action` | `string` | Yes | An action identifier. Conventions: `'Start'`, `'End'`, `'Error'`, `'Init-End'` |
| `routine` | `string` | Yes | Name of the routine being audited (e.g. `'Postgres Query - get_user_by_id'`) |
| `reference_time` | `number` | No | A unix-millisecond timestamp from which to compute elapsed time. When omitted, the line records `elapsed_ms: null` |

Logs at the `debug` level. Suppressed unless `LOG_LEVEL` is `debug`.

The structured payload always includes:

| Field | Type | Description |
|---|---|---|
| `action` | `string` | The first argument |
| `routine` | `string` | The second argument |
| `elapsed_ms` | `number` or `null` | `Date.now() - reference_time`, or `null` when `reference_time` was not provided |
| `timestamp_ms` | `number` | Current unix-millisecond timestamp |
| `heap_used_mb` | `number` | Current `process.memoryUsage().heapUsed` rounded to 3 decimal places. Only included when `INCLUDE_MEMORY_USAGE` is true and the runtime exposes `process.memoryUsage` |

### Canonical pattern. Use `instance.time_ms` as the reference

In a Superloom server, the request lifecycle module (`js-server-helper-instance`) sets `instance.time_ms` to the unix-millisecond timestamp at the start of the request. Pass that as the third argument to `performanceAuditLog` and every audit line for the rest of the request shows elapsed time **since the request started**, not since the function entered. This is what makes it possible to reconstruct a request timeline from the logs.

```javascript
Lib.Debug.performanceAuditLog('Start', 'Postgres Query - get_user_by_id', instance.time_ms);
const user = await Lib.Db.getRow(instance, sql, params);
Lib.Debug.performanceAuditLog('End',   'Postgres Query - get_user_by_id', instance.time_ms);
```

---

## Lifecycle

There is nothing to clean up. The module exposes only synchronous functions that write to standard streams. Each loader call captures its `CONFIG` in a closure; after that, no module-level state changes for the lifetime of the process.

For module-level setup details (loader signature, config-merge semantics, peer-dep notes) see [Configuration → Loader Pattern](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-core/js-helper-debug/docs/configuration.md#loader-pattern).
