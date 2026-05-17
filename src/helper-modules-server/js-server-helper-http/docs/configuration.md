# Configuration. `js-server-helper-http`

Loader pattern, configuration keys, dependency notes, and testing tier. For the function reference see [API Reference](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-http/docs/api.md).

This page is intentionally short. HTTP has two configuration keys, no environment variables, and one testing tier. The page exists for shape consistency: every Superloom module ships a `docs/configuration.md` so contributors and AI tooling can find the loader pattern and runtime details in the same place across the framework. The canonical reasoning is in [`module-categorization.md` → Universal Documentation Footprint](https://github.com/superloomdev/superloom/blob/main/docs/modules/module-categorization.md#universal-documentation-footprint).

## On This Page

- [Loader Pattern](#loader-pattern)
- [Configuration Keys](#configuration-keys)
- [Environment Variables](#environment-variables)
- [Peer Dependencies](#peer-dependencies)
- [Direct Dependencies](#direct-dependencies)
- [Testing Tiers](#testing-tiers)

---

## Loader Pattern

The module is a factory. Each loader call returns an independent public interface with its own `Lib` and `CONFIG` captured in a closure. The module is stateless: there are no per-instance resources, no connection pools, no caches. Two loader calls return functionally identical interfaces.

```javascript
Lib.Http = require('@superloomdev/js-server-helper-http')(Lib, {});
```

Loader call semantics:

- **First argument: `Lib`.** A container exposing peer modules. Http reads `Lib.Utils.isEmpty` and `Lib.Utils.isNullOrUndefined` for input checks, and routes performance logs through `Lib.Debug.performanceAuditLog`.
- **Second argument: config overrides.** Merged on top of `http.config.js` defaults. Pass `{}` to use defaults. See [Configuration Keys](#configuration-keys) for the two available knobs.
- **Multiple loader calls return independent interfaces.** Functions are stateless, so two interfaces are functionally identical. Loading the module multiple times with different `CONFIG` (for example one with a 5-second timeout for health checks and one with the default 30-second timeout for normal calls) is a supported pattern.

> **Why accept arguments the loader does not appear to use heavily?** Every Superloom helper accepts the same `(Lib, config)` shape so that consumers can swap modules without changing the loader call. The uniformity is the point.

---

## Configuration Keys

Two keys. Both have working defaults; override only when the defaults do not fit.

| Key | Type | Default | Required | Description |
|---|---|---|---|---|
| `TIMEOUT` | `number` | `30` | No | Default timeout for every request in seconds. Used to construct `AbortSignal.timeout(TIMEOUT * 1000)` when no per-call `options.timeout` is passed |
| `USER_AGENT` | `string` | `'Open-Framework-HTTP/2.0'` | No | Value of the `User-Agent` header on every outbound request. A caller-supplied `options.headers['User-Agent']` overrides this value for that call |

> **Per-call timeout overrides.** The `options.timeout` argument on every public function overrides `CONFIG.TIMEOUT` for that single call without affecting the default. This is the recommended pattern when one specific endpoint needs a non-default budget.

> **Legacy User-Agent default.** The `Open-Framework-HTTP/2.0` default predates the Superloom rename. New deployments should override `USER_AGENT` to a project-identifying value (e.g. `'YourApp/1.0 (+https://example.com)'`).

---

## Environment Variables

None. The module never reads `process.env`. All configuration flows through the loader's second argument.

---

## Peer Dependencies

| Peer | Why |
|---|---|
| `@superloomdev/js-helper-utils` | Used internally for `Lib.Utils.isEmpty` (auth header validation) and `Lib.Utils.isNullOrUndefined` (query-string parameter filtering) |
| `@superloomdev/js-helper-debug` | Used for outbound request logging (`Lib.Debug.log`) and per-request performance audit (`Lib.Debug.performanceAuditLog`) on both success and failure paths |

The peers are consumed through the standard `Lib` injection in the loader's first argument. The module does not `require()` either peer directly.

---

## Direct Dependencies

None. The module's `package.json` declares no `dependencies`. Every runtime capability comes from Node.js built-ins:

| Node built-in | Used for |
|---|---|
| `fetch` global | HTTP request execution |
| `AbortSignal.timeout` | Per-request timeout enforcement |
| `URL` and `URLSearchParams` | Query-string parameter handling and `urlencoded` body encoding |
| `Buffer` | Base64 encoding of Basic-auth credentials |
| `FormData` | Caller-side multipart construction (the module passes the instance straight through to `fetch`) |
| `Headers` (returned by `fetch`) | Response header iteration with lowercase-key normalization |

The supply chain you audit ends at this package and its two peers.

---

## Testing Tiers

The module ships a single test tier:

| Tier | Runtime | When to run | CI Status |
|---|---|---|---|
| **Unit (real-network integration)** | Node.js `node --test` against `httpbin.org` | Every commit, every CI run. Requires outbound network access | [![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml) |

There is no Docker container and no service emulator. The tests issue real HTTP requests to [`httpbin.org`](https://httpbin.org), which echoes the request back and lets the test assert on what was actually sent (headers, body, query string). This catches end-to-end issues that a mocked test would not see: malformed multipart boundaries, incorrect content-type encoding, broken auth-header construction.

```bash
cd _test && npm install && npm test
```

The test runner uses Node's built-in test framework (`node --test` plus `node:assert/strict`). Total runtime is a few seconds, dominated by the network round-trips. The test for `NETWORK_TIMEOUT` deliberately uses `httpbin.org/delay/5` with a 1-second timeout to exercise the `AbortSignal.timeout` path.

> **CI requires network egress.** Self-hosted runners or air-gapped environments need an HTTP proxy or a local `httpbin` mirror. The GitHub-hosted runners that the project's CI workflow uses have unrestricted egress.

For the framework-wide testing architecture see [Module Testing](https://github.com/superloomdev/superloom/blob/main/docs/testing/module-testing.md).
