# Configuration. `js-helper-money`

Loader pattern, dependency notes, and testing tier. For the function reference see [API Reference](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-core/js-helper-money/docs/api.md).

This page is intentionally short. Money accepts a small reserved configuration block but reads no environment variables and exposes no service-specific tuning. The page exists for shape consistency: every Superloom module ships a `docs/configuration.md` so contributors and AI tooling can find the loader pattern and runtime details in the same place across the framework. The canonical reasoning is in [`module-categorization.md` → Universal Documentation Footprint](https://github.com/superloomdev/superloom/blob/main/docs/modules/module-categorization.md#universal-documentation-footprint).

## On This Page

- [Loader Pattern](#loader-pattern)
- [Configuration Keys](#configuration-keys)
- [Environment Variables](#environment-variables)
- [Peer Dependencies](#peer-dependencies)
- [Direct Dependencies](#direct-dependencies)
- [Testing Tiers](#testing-tiers)

---

## Loader Pattern

The module is a factory. Each loader call returns an independent public interface with its own merged configuration captured in a closure.

```javascript
Lib.Money = require('@superloomdev/js-helper-money')(Lib, {});
```

Loader call semantics:

- **First argument: `Lib`.** A container exposing peer modules. Money uses `Lib.Utils` for rounding, null-checks, and integer conversion.
- **Second argument: config overrides.** Merged on top of the built-in defaults. Pass `{}` to use defaults unchanged.
- **Multiple loader calls return independent interfaces.** Functions are pure, so two interfaces are functionally identical. Loading the module multiple times is harmless but wasteful.

> **Why accept arguments the loader does not read?** Every Superloom helper accepts the same `(Lib, config)` shape so that consumers can swap modules without changing the loader call. Foundation modules accept the arguments and use what they need. The uniformity is the point.

---

## Configuration Keys

Four keys, all reserved. The keys are merged into the instance's `CONFIG` object so callers can set them today and have them honoured by future validation helpers, but no current public function reads any of them.

| Key | Type | Default | Description |
|---|---|---|---|
| `DEFAULT_CURRENCY_CODE` | `String` | `'usd'` | Reserved. Default currency code for operations |
| `CURRENCY_CODE_MIN_LENGTH` | `Number` | `3` | Reserved. Minimum valid length of a currency code |
| `CURRENCY_CODE_MAX_LENGTH` | `Number` | `3` | Reserved. Maximum valid length of a currency code |
| `CURRENCY_CODE_SANITIZE_REGEX` | `RegExp` | `/[^a-zA-Z]/g` | Reserved. Characters stripped from sanitized input |

> **Why ship reserved keys.** They define the module's external surface for upcoming validation helpers. Setting them now means application configuration does not change when validation lands.

---

## Environment Variables

None. The module never reads `process.env`.

---

## Peer Dependencies

| Peer | Why |
|---|---|
| `@superloomdev/js-helper-utils` | Used by `roundAmount` for rounding, `formatAmount` for integer checks, and `sum`/`calculateTotalFromDenominations` for integer conversion. The rest of the surface is self-contained |
| `@superloomdev/js-helper-debug` | Reserved for future logging. Injected but not currently used by any public function |

The peers are consumed through the standard `Lib.Utils` and `Lib.Debug` injection in the loader's first argument. The module does not `require()` the peers directly.

---

## Direct Dependencies

None. The module's `package.json` declares no `dependencies`. The supply chain you audit ends at this package and its two peers.

---

## Testing Tiers

The module ships a single test tier:

| Tier | Runtime | When to run | CI Status |
|---|---|---|---|
| **Unit** | Node.js `node --test` | Every commit, every CI run | [![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml) |

There is no Docker container and no service emulator. Every function is pure JavaScript with no I/O.

```bash
cd _test && npm install && npm test
```

The test runner uses Node's built-in test framework (`node --test` plus `node:assert/strict`). Test runtime is sub-second.

For the framework-wide testing architecture see [Module Testing](https://github.com/superloomdev/superloom/blob/main/docs/testing/module-testing.md).
