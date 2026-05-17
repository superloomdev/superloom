# Configuration. `js-client-helper-crypto`

Loader pattern, configuration keys, dependency notes, and testing tier. For the function reference see [API Reference](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-client/js-client-helper-crypto/docs/api.md).

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
Lib.Crypto = require('@superloomdev/js-client-helper-crypto')(Lib, {});
```

Loader call semantics:

- **First argument: `Lib`.** A container exposing peer modules. Client-crypto reads `Lib.Utils` for input validation (`isEmpty`, `isFunction`).
- **Second argument: config overrides.** Merged on top of the built-in defaults. Pass `{}` to use defaults unchanged.
- **Multiple loader calls return independent interfaces.** Functions are pure, so two interfaces are functionally identical. Loading the module multiple times is harmless but wasteful.

> **Why accept arguments the loader does not read?** Every Superloom helper accepts the same `(Lib, config)` shape so that consumers can swap modules without changing the loader call. Foundation modules accept the arguments and use what they need. The uniformity is the point.

---

## Configuration Keys

One key. Used internally by the compact-UUID generator to control the base-36 alphabet.

| Key | Type | Default | Description |
|---|---|---|---|
| `BASE36_CHARSET` | `string` | `'0123456789abcdefghijklmnopqrstuvwxyz'` | Alphabet used by `generateCompactUUID`. Must be exactly 36 unique characters in ascending base-36 order if you replace it |

> **When to override.** Only when the application needs a custom display alphabet (for example, to avoid visually-confusable characters in a public-facing identifier). The default is the canonical base-36 alphabet.

---

## Environment Variables

None. The module never reads `process.env`. Browsers do not expose `process.env` at all; the module is symmetric across Node and browser runtimes.

---

## Peer Dependencies

| Peer | Why |
|---|---|
| `@superloomdev/js-helper-utils` | Used for input validation (`isEmpty`, `isFunction`) |

The peer is consumed through the standard `Lib.Utils` injection in the loader's first argument. The module does not `require()` the peer directly.

---

## Direct Dependencies

None. The module's `package.json` declares no `dependencies`. Random bytes come from the runtime's Web Crypto API; base64 comes from `Buffer` (Node) or `btoa` / `atob` (browser).

---

## Testing Tiers

The module ships a single test tier:

| Tier | Runtime | When to run | CI Status |
|---|---|---|---|
| **Unit** | Node.js `node --test` | Every commit, every CI run | [![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml) |

Tests run under Node and exercise both Web Crypto paths (where `globalThis.crypto` is available) and the polyfill paths (by stubbing the global). There is no separate browser tier; the surface is identical because both runtimes implement the same Web Crypto API.

```bash
cd _test && npm install && npm test
```

The test runner uses Node's built-in test framework (`node --test` plus `node:assert/strict`). Test runtime is sub-second.

For the framework-wide testing architecture see [Module Testing](https://github.com/superloomdev/superloom/blob/main/docs/architecture/module-testing.md).
