# Configuration. `js-server-helper-crypto`

Loader pattern, configuration keys, dependency notes, and testing tier. For the function reference see [API Reference](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-crypto/docs/api.md).

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
Lib.Crypto = require('@superloomdev/js-server-helper-crypto')(Lib, {});
```

Loader call semantics:

- **First argument: `Lib`.** A container exposing peer modules. Server-crypto reads `Lib.Utils` for input validation (`isEmpty`, `isNullOrUndefined`).
- **Second argument: config overrides.** Merged on top of the built-in defaults. Pass `{}` to use defaults unchanged.
- **Multiple loader calls return independent interfaces.** Functions are stateless, so two interfaces are functionally identical. Loading the module multiple times is harmless but wasteful. The Node `crypto` module is cached once at module load and shared across all interfaces.

> **Why accept arguments the loader does not always use?** Every Superloom helper accepts the same `(Lib, config)` shape so that consumers can swap modules without changing the loader call. The uniformity is the point.

---

## Configuration Keys

Three keys, used internally by the base-conversion helpers. Override only when you need a custom display alphabet.

| Key | Type | Default | Description |
|---|---|---|---|
| `BASE36_CHARSET` | `string` | `'0123456789abcdefghijklmnopqrstuvwxyz'` | Alphabet used by `generateCompactUUID` and the random-padding inside `generateTimeRandomString`. Must be exactly 36 unique characters in ascending base-36 order if you replace it |
| `HEX_CHARSET` | `string` | `'0123456789abcdef'` | Reserved. Hex alphabet used by future helpers |
| `INT_CHARSET` | `string` | `'0123456789'` | Reserved. Decimal alphabet used by future helpers |

> **When to override `BASE36_CHARSET`.** Only when the application needs a custom display alphabet (for example, to avoid visually-confusable characters in a public-facing identifier). The default is the canonical base-36 alphabet.

---

## Environment Variables

None. The module never reads `process.env`. All configuration flows through the loader call.

---

## Peer Dependencies

| Peer | Why |
|---|---|
| `@superloomdev/js-helper-utils` | Used for input validation (`isEmpty`, `isNullOrUndefined`) |

The peer is consumed through the standard `Lib.Utils` injection in the loader's first argument. The module does not `require()` the peer directly.

---

## Direct Dependencies

| Dependency | Why |
|---|---|
| Node.js built-in `crypto` | All cryptographic primitives. Loaded once at module initialisation via `require('crypto')`. Not a third-party package; ships with the runtime |

The module's `package.json` declares no `dependencies`. The supply chain you audit ends at this package, its single peer, and the Node runtime itself.

---

## Testing Tiers

The module ships a single test tier:

| Tier | Runtime | When to run | CI Status |
|---|---|---|---|
| **Unit** | Node.js `node --test` | Every commit, every CI run | [![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml) |

Tests verify both the deterministic behaviour (AES round-trip, hash output length, base-conversion identity) and the random-output shape (length, character set membership) using Node's built-in `crypto` for the secure paths.

```bash
cd _test && npm install && npm test
```

The test runner uses Node's built-in test framework (`node --test` plus `node:assert/strict`). Test runtime is sub-second.

For the framework-wide testing architecture see [Module Testing](https://github.com/superloomdev/superloom/blob/main/docs/architecture/module-testing.md).
