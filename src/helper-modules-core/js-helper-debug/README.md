# @superloomdev/js-helper-debug

[![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-brightgreen.svg)](https://nodejs.org)

Zero-dependency structured logging library with log levels, dual output formats, and backward compatibility. Part of the [Superloom](https://github.com/superloomdev/superloom).

> **Foundation module** - zero runtime dependencies by design. This module and `js-helper-utils` form the self-contained base layer. All other helper modules may depend on them, but never the reverse.

## Features
- **Log Levels:** `debug`, `info`, `warn`, `error`, `none` (threshold-based filtering)
- **Text Format:** Human-readable for local dev and Docker stdout
- **JSON Format:** Structured JSON for AWS CloudWatch, log aggregators, and machine parsing
- **Error Logging:** Automatic stack trace capture, error codes, extra context
- **Timing Audit:** Performance timing with memory usage tracking
- **Backward Compatible:** `.log()` still works as `console.log` at info level

## Exported Functions

- **`debug(message, data?)`** - Debug-level log (verbose diagnostics)
- **`info(message, data?)`** - Info-level log (general operational info)
- **`warn(message, data?)`** - Warn-level log (recoverable issues)
- **`error(message, error?, extra_info?)`** - Error-level log (to stderr, with stack trace)
- **`log(...args)`** - `console.log` at info level
- **`performanceAuditLog(action, routine, reference_time?)`** - Performance audit with elapsed time and heap usage

## Configuration

| Key | Type | Default | Description |
|---|---|---|---|
| `LOG_LEVEL` | String | `'debug'` | Threshold: `debug` < `info` < `warn` < `error` < `none` |
| `LOG_FORMAT` | String | `'text'` | Output format: `'text'` or `'json'` |
| `INCLUDE_STACK_TRACE` | Boolean | `true` | Include stack traces in error logs |
| `INCLUDE_MEMORY_USAGE` | Boolean | `true` | Include heap usage in audit logs |
| `APP_NAME` | String | `'app'` | Application name in structured logs |
| `ENVIRONMENT` | String | `'development'` | Environment identifier in structured logs |

## Dependencies

None. This module is fully self-contained with zero runtime dependencies.

## Installation
```bash
npm install @superloomdev/js-helper-debug
```

## Usage
```javascript
// In loader (shared_libs accepted for interface uniformity, unused)
Lib.Debug = require('@superloomdev/js-helper-debug')(Lib, {
  LOG_LEVEL: 'info',
  LOG_FORMAT: 'json',       // Use 'json' for CloudWatch, 'text' for dev
  APP_NAME: 'my-service',
  ENVIRONMENT: 'production'
});

// Log at different levels
Lib.Debug.debug('Processing request', { request_id: '123' });
Lib.Debug.info('User created', { user_id: 'usr_abc' });
Lib.Debug.warn('Rate limit approaching', { current: 95, max: 100 });
Lib.Debug.error('Failed to save', new Error('DB timeout'), 'user-service');

// Performance audit
const start = Date.now();
// ... operation ...
Lib.Debug.performanceAuditLog('End', 'DB Query', start);
```

### JSON Output Example (CloudWatch)
```json
{"timestamp":"2026-03-31T00:00:00.000Z","level":"ERROR","message":"Failed to save","app":"my-service","env":"production","data":{"error":"DB timeout","code":null,"stack":"Error: DB timeout\n    at ..."}}
```

### Text Output Example (Docker/Dev)
```
[2026-03-31T00:00:00.000Z] [ERROR] Failed to save
  Error: DB timeout
  Stack: Error: DB timeout at ...
```

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

## License

MIT
