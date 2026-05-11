# js-helper-debug - AI Agent Reference

## Module Type
Foundation module. Zero runtime dependencies. Self-contained logging - no dependency on `js-helper-utils`.

## Peer Dependencies
None (foundation).

## Direct Dependencies
None.

## Loader Pattern (Factory)

```javascript
Lib.Debug = require('@superloomdev/js-helper-debug')(Lib, { /* config overrides */ });
```

`shared_libs` is accepted for interface uniformity but unused - Debug has no external lib dependencies. Config overrides are merged over defaults to create an independent instance.

## Config Keys
| Key | Type | Default | Description |
|---|---|---|---|
| LOG_LEVEL | String | 'debug' | Threshold: 'debug'\|'info'\|'warn'\|'error'\|'none' |
| LOG_FORMAT | String | 'text' | 'text' (human-readable) or 'json' (CloudWatch/aggregator friendly) |
| INCLUDE_STACK_TRACE | Boolean | true | Include stack traces in error logs |
| INCLUDE_MEMORY_USAGE | Boolean | true | Include memory heap size in audit logs |
| APP_NAME | String | 'app' | App identifier in structured logs |
| ENVIRONMENT | String | 'development' | Environment identifier in structured logs |

## Exported Functions

### Log Levels
debug(message, data?) → void | async:no - verbose development diagnostics
info(message, data?) → void | async:no - general operational information
warn(message, data?) → void | async:no - warning conditions
error(message, error?, extra_info?) → void | async:no - error conditions with stack trace

### Legacy / Compatibility
log(...args) → void | async:no - backward-compatible console.log, logs at 'info' level

### Performance
performanceAuditLog(action, routine, reference_time) → void | async:no
  Measures elapsed time (ms) and heap memory since reference_time.
  Use `instance.time_ms` as reference_time for request-level performance tracking.
  action examples: 'Start', 'End', 'Error', 'Init-End'

## Patterns
- **Foundation:** Zero runtime dependencies. All other modules may depend on this; this module depends on nothing
- **Log level suppression:** Messages below LOG_LEVEL threshold are suppressed (not written)
- **JSON format:** When LOG_FORMAT='json', logs are structured objects compatible with CloudWatch and log aggregators
- **Text format:** When LOG_FORMAT='text', logs are human-readable with timestamp + level prefix
- **Performance tracking:** Always call `performanceAuditLog` at every external service boundary (DB, cloud API, HTTP, queue). Use `instance.time_ms` for request-level timeline
- **Raw type checks allowed:** As a foundation module, this uses raw type checks (`typeof`, `!== null`). All OTHER modules must use `Lib.Utils` instead
