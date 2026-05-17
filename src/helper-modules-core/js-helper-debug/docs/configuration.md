# Configuration. `js-helper-debug`

Loader pattern, configuration keys, output formats, dependency notes, and testing tier. For the function reference see [API Reference](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-core/js-helper-debug/docs/api.md).

## On This Page

- [Loader Pattern](#loader-pattern)
- [Configuration Keys](#configuration-keys)
- [Output Formats](#output-formats)
- [Environment Variables](#environment-variables)
- [Peer Dependencies](#peer-dependencies)
- [Direct Dependencies](#direct-dependencies)
- [Testing Tiers](#testing-tiers)

---

## Loader Pattern

The module is a factory. Each loader call returns an independent public interface with its own merged configuration captured in a closure.

```javascript
Lib.Debug = require('@superloomdev/js-helper-debug')(Lib, {
  LOG_LEVEL:  'info',
  LOG_FORMAT: 'json',
  APP_NAME:   'orders-api',
  ENVIRONMENT: 'production'
});
```

Loader call semantics:

- **First argument: `Lib`.** Accepted for interface uniformity with other Superloom modules. Debug does not read it. Pass whatever your project uses (commonly `Lib`, `null`, or `{}`).
- **Second argument: config overrides.** Merged on top of the built-in defaults. Pass `{}` to use defaults unchanged.
- **Multiple loader calls return independent interfaces.** A noisy module under investigation can be loaded with `LOG_LEVEL: 'debug'` while the rest of the application uses `LOG_LEVEL: 'info'`. The two interfaces share no state.

> **Why accept arguments the loader does not read?** Every Superloom helper accepts the same `(Lib, config)` shape so that consumers can swap modules without changing the loader call. Foundation modules accept the `Lib` argument and discard it. The uniformity is the point.

---

## Configuration Keys

Six keys, all optional. Defaults preserve verbose, human-readable output suitable for local development.

| Key | Type | Default | Description |
|---|---|---|---|
| `LOG_LEVEL` | `string` | `'debug'` | Threshold. One of `'debug'`, `'info'`, `'warn'`, `'error'`, `'none'`. Messages below the threshold are suppressed |
| `LOG_FORMAT` | `string` | `'text'` | `'text'` for human-readable lines, `'json'` for one structured object per line. See [Output Formats](#output-formats) |
| `INCLUDE_STACK_TRACE` | `boolean` | `true` | When false, `error()` suppresses the `stack` field |
| `INCLUDE_MEMORY_USAGE` | `boolean` | `true` | When false, `performanceAuditLog()` omits the `heap_used_mb` field. Has no effect in runtimes without `process.memoryUsage` |
| `APP_NAME` | `string` | `'app'` | Application identifier. Included as the `app` field in JSON output. Useful for filtering when multiple services share a log stream |
| `ENVIRONMENT` | `string` | `'development'` | Environment identifier. Included as the `env` field in JSON output |

> **Recommended production overrides.** `LOG_LEVEL: 'info'`, `LOG_FORMAT: 'json'`, `APP_NAME: '<service>'`, `ENVIRONMENT: 'production'`. The other two keys can stay at their defaults.

> **Suppressing `performanceAuditLog`.** Audit lines log at the `debug` level, so any `LOG_LEVEL` other than `'debug'` silences them automatically. There is no separate "audit on/off" flag because the level threshold already serves that purpose.

---

## Output Formats

### Text format (`LOG_FORMAT: 'text'`)

Human-readable. One line per call. Errors render as a multi-line block. Use this in local development and Docker stdout where a developer is reading the lines directly.

```text
[2026-05-17T01:25:00.000Z] [INFO] Service started
[2026-05-17T01:25:00.342Z] [DEBUG] [AUDIT] End - Postgres Connect [12 ms] [Heap: 18.453 mb]
[2026-05-17T01:25:00.512Z] [ERROR] Failed to read config
  Error: ENOENT: no such file or directory, open 'config.json'
  Code: ENOENT
```

### JSON format (`LOG_FORMAT: 'json'`)

One structured object per line. Use this in any environment where logs flow into an aggregator (CloudWatch, Datadog, Loki, Splunk, Stackdriver). The aggregator can index on `level`, `app`, `env`, and the contents of `data` without having to parse a free-form prefix.

```json
{"timestamp":"2026-05-17T01:25:00.000Z","level":"INFO","message":"Service started","app":"orders-api","env":"production"}
{"timestamp":"2026-05-17T01:25:00.342Z","level":"DEBUG","message":"[AUDIT] End - Postgres Connect","app":"orders-api","env":"production","data":{"action":"End","routine":"Postgres Connect","elapsed_ms":12,"timestamp_ms":1763341500342,"heap_used_mb":18.453}}
```

Both formats route `level: 'error'` to stderr and everything else to stdout. This matches Lambda, Docker, and journald conventions for stream-based severity routing.

---

## Environment Variables

None. The module never reads `process.env`. All configuration flows through the loader call.

> **Recommended pattern.** If you want to drive configuration from the environment, read `process.env` in your application's bootstrap code and pass the result into the loader. This keeps the module testable without polluting the environment in tests.

---

## Peer Dependencies

None. Foundation modules cannot have peer dependencies. They ARE the foundation. Every other Superloom helper may consume `js-helper-debug`; this module imports nothing.

The wider rationale (foundation invariants, the "no upward import" rule) is documented in [Server Loader Architecture](https://github.com/superloomdev/superloom/blob/main/docs/architecture/server/server-loader.md).

---

## Direct Dependencies

None. The module's `package.json` declares no `dependencies`. The supply chain you audit ends at this package.

---

## Testing Tiers

The module ships a single test tier:

| Tier | Runtime | When to run | CI Status |
|---|---|---|---|
| **Unit** | Node.js `node --test` | Every commit, every CI run | [![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml) |

There is no Docker container and no service emulator. Tests inspect the module's stdout / stderr behaviour directly.

```bash
cd _test && npm install && npm test
```

The test runner uses Node's built-in test framework (`node --test` plus `node:assert/strict`). Test runtime is sub-second.

For the framework-wide testing architecture see [Module Testing](https://github.com/superloomdev/superloom/blob/main/docs/architecture/testing/module-testing.md).
