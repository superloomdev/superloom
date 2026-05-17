# Configuration. `js-helper-utils`

Loader pattern, dependency notes, and testing tier. For the function reference see [API Reference](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-core/js-helper-utils/docs/api.md).

This page is intentionally short. Foundation utility modules accept no config keys, read no environment variables, and inject no peer dependencies. The page exists for shape consistency: every Superloom module ships a `docs/configuration.md` so contributors and AI tooling can find the loader pattern and runtime details in the same place across the framework. The canonical reasoning is in [`module-categorization.md` → Universal Documentation Footprint](https://github.com/superloomdev/superloom/blob/main/docs/modules/module-categorization.md#universal-documentation-footprint).

## On This Page

- [Loader Pattern](#loader-pattern)
- [Configuration Keys](#configuration-keys)
- [Environment Variables](#environment-variables)
- [Peer Dependencies](#peer-dependencies)
- [Direct Dependencies](#direct-dependencies)
- [Testing Tiers](#testing-tiers)

---

## Loader Pattern

The module is a factory. Each loader call returns an independent public interface. Every function on the interface is captured in a closure at loader time; the interface itself is otherwise stateless.

```javascript
Lib.Utils = require('@superloomdev/js-helper-utils')(Lib, {});
```

Loader call semantics:

- **First argument: `Lib`.** Accepted for interface uniformity with other Superloom modules. Foundation utility does not read it. Pass whatever your project uses (commonly `Lib`, `null`, or `{}`).
- **Second argument: config.** Accepted for interface uniformity. There are no configuration keys. Pass `{}`.
- **Multiple loader calls return independent interfaces.** Functions are pure, so two interfaces are functionally identical. Loading the module multiple times is harmless but wasteful.

> **Why accept arguments the loader does not read?** Every Superloom helper accepts the same `(Lib, config)` shape so that consumers can swap modules without changing the loader call. Class C and D modules use both arguments; Class A modules accept them and discard them. The uniformity is the point.

---

## Configuration Keys

None. The module has no configuration. The second argument to the loader is accepted but ignored.

---

## Environment Variables

None. The module never reads `process.env`.

---

## Peer Dependencies

None. Foundation modules cannot have peer dependencies. They ARE the foundation. Every other Superloom helper may consume `js-helper-utils`; this module imports nothing.

The wider rationale (foundation invariants, the "no upward import" rule) is documented in [Server Loader Architecture](https://github.com/superloomdev/superloom/blob/main/docs/server/server-loader.md).

---

## Direct Dependencies

None. The module's `package.json` declares no `dependencies`. The supply chain you audit ends at this package.

---

## Testing Tiers

The module ships a single test tier:

| Tier | Runtime | When to run | CI Status |
|---|---|---|---|
| **Unit** | Node.js `node --test` | Every commit, every CI run | [![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml) |

There is no Docker container, no service emulator, and no integration tier. Every function is pure JavaScript with no I/O.

```bash
cd _test && npm install && npm test
```

The test runner uses Node's built-in test framework (`node --test` plus `node:assert/strict`). Test runtime is sub-second. No `pretest` or `posttest` hook is required.

For the framework-wide testing architecture see [Module Testing](https://github.com/superloomdev/superloom/blob/main/docs/testing/module-testing.md).
