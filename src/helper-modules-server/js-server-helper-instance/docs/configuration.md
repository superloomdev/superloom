# Configuration. `js-server-helper-instance`

Loader pattern, dependency notes, and testing tier. For the function reference see [API Reference](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-instance/docs/api.md).

This page is intentionally short. Instance has no current configuration keys and reads no environment variables. The page exists for shape consistency: every Superloom module ships a `docs/configuration.md` so contributors and AI tooling can find the loader pattern and runtime details in the same place across the framework. The canonical reasoning is in [`module-categorization.md` → Universal Documentation Footprint](https://github.com/superloomdev/superloom/blob/main/docs/modules/module-categorization.md#universal-documentation-footprint).

## On This Page

- [Loader Pattern](#loader-pattern)
- [Configuration Keys](#configuration-keys)
- [Environment Variables](#environment-variables)
- [Peer Dependencies](#peer-dependencies)
- [Direct Dependencies](#direct-dependencies)
- [Testing Tiers](#testing-tiers)

---

## Loader Pattern

The module is a factory. Each loader call returns an independent public interface with its own `Lib` and `CONFIG` captured in a closure. Per-request state lives on the instance object returned by `initialize()`, not inside the loaded interface.

```javascript
Lib.Instance = require('@superloomdev/js-server-helper-instance')(Lib, {});
```

Loader call semantics:

- **First argument: `Lib`.** A container exposing peer modules. Instance reads `Lib.Utils.getUnixTime` and `Lib.Utils.getUnixTimeInMilliSeconds` to capture timestamps in `initialize`.
- **Second argument: config overrides.** Reserved. Pass `{}` today; future config (currently noted as `MODE: 'lambda' | 'express'`) will be merged here.
- **Multiple loader calls return independent interfaces.** Functions are stateless, so two interfaces are functionally identical. Loading the module multiple times is harmless but wasteful.

> **Why accept arguments the loader does not read?** Every Superloom helper accepts the same `(Lib, config)` shape so that consumers can swap modules without changing the loader call. The uniformity is the point.

---

## Configuration Keys

None at this time.

| Key | Type | Default | Description |
|---|---|---|---|
| (none) | - | - | Reserved for future use. A planned `MODE: 'lambda' \| 'express'` would let the module specialise lifecycle behaviour per runtime; the current implementation works the same way in both |

---

## Environment Variables

None. The module never reads `process.env`.

---

## Peer Dependencies

| Peer | Why |
|---|---|
| `@superloomdev/js-helper-utils` | Used by `initialize` for `getUnixTime` and `getUnixTimeInMilliSeconds`, and by `getAge` for `getUnixTimeInMilliSeconds` |
| `@superloomdev/js-helper-debug` | Declared in `package.json` for cross-module consistency. Not currently consumed at runtime; reserved for future audit-logging hooks |

The peers are consumed through the standard `Lib` injection in the loader's first argument. The module does not `require()` either peer directly.

---

## Direct Dependencies

None. The module's `package.json` declares no `dependencies`. The supply chain you audit ends at this package and its two peers.

---

## Testing Tiers

The module ships a single test tier:

| Tier | Runtime | When to run | CI Status |
|---|---|---|---|
| **Unit** | Node.js `node --test` | Every commit, every CI run | [![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml) |

There is no Docker container and no service emulator. Tests exercise the lifecycle ordering (initialise → register cleanup → register background → complete background → cleanup runs) directly against the module's public interface.

```bash
cd _test && npm install && npm test
```

The test runner uses Node's built-in test framework (`node --test` plus `node:assert/strict`). Test runtime is sub-second.

For the framework-wide testing architecture see [Module Testing](https://github.com/superloomdev/superloom/blob/main/docs/testing/module-testing.md).
