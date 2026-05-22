# @superloomdev/js-client-helper-crypto

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-brightgreen.svg)](https://nodejs.org)

A client-side cryptography helper for the browser, React Native, and edge runtimes that ships pre-tested and has zero runtime dependencies. Part of [Superloom](https://superloom.dev).

## What This Is

A flat collection of small functions covering UUID v4 generation, compact base-36 identifiers, charset-bounded random strings, and base64 encode / decode (including the URL-safe variant). Built on the runtime's native Web Crypto API with a graceful fallback so the surface works wherever the code happens to run. Synchronous, side-effect-free, and dependency-free.

## Hot-Swappable with the Server-Side Sibling

This module is the browser-side member of a runtime pair. The shared functions (`generateUUID`, `generateCompactUUID`, `generateRandomString`, and the four base64 helpers) have the same names and the same calling shape on both sides, so the same call site can run in a browser bundle and in a Node service without rewriting.

- [`@superloomdev/js-server-helper-crypto`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-crypto) - Server-side equivalent. Adds hashing, HMAC, encryption, and base conversion on top of the shared surface

## Why Use This Module

- **Zero runtime dependencies.** Adding this module to your project adds zero packages to your dependency tree. The supply chain you audit ends at this package itself.

- **Runs everywhere.** Pure JavaScript with no platform-specific globals. The same module works in a browser, in React Native, in an edge runtime, in a Cloudflare Worker, and in Node.js. The Web Crypto API is preferred when the runtime exposes it; a deterministic fallback covers older targets.

- **Pre-tested at every release.** A full test suite runs in CI on every push. Your project trusts the wrapper instead of re-verifying client-crypto plumbing on each release.

- **Designed for human review.** The code is laid out as clearly-marked visual sections (section banners, short functions, scoped comments) so a reviewer can read it top to bottom in order, use the section breaks as checkpoints to mark how far they have got, and finish without ever getting lost in dense logic. This matters most when an AI assistant is generating the change and a human still has to sign off on it. Open `crypto.js` to see the structure.

## Aligned with Superloom Philosophy

If your project is built on Superloom conventions (the same loader pattern, the same testing model), this module slots in without you needing to learn anything new.

If you are not yet using Superloom, the principles are documented at [superloom.dev](https://superloom.dev).

## Extended Documentation

- [API reference](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-client/js-client-helper-crypto/docs/api.md) - every exported function with its signature, parameters, return shape, and worked examples
- [Configuration](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-client/js-client-helper-crypto/docs/configuration.md) - loader pattern, dependency notes, testing tier
- [`js-server-helper-crypto`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-crypto) - the server-side sibling
- [Superloom](https://superloom.dev) - the framework

## Adding to Your Project

Install this module as a peer dependency in your project's `package.json` and load it through the standard Superloom loader. Do not vendor the source or use it as a local file dependency. The published package is the supported integration path.

The loader pattern, including the full `Lib` container shape, is documented in [Server Loader Architecture](https://github.com/superloomdev/superloom/blob/main/docs/server/server-loader.md). For one-time GitHub Packages registry setup, see the [npmrc setup guide](https://github.com/superloomdev/superloom/blob/main/docs/dev/npmrc-setup.md).

## Dependencies

This module has no external dependencies.

This module expects two peer modules in the `Lib` container (Utils, Debug). For the full dependency breakdown, see [`docs/configuration.md`](docs/configuration.md).

## Testing Status

| Tier | Runtime | Status |
|---|---|---|
| Unit | Node.js `node --test` | [![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml) |

Test runtime details (no Docker, no service required) live in [Configuration → Testing Tiers](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-client/js-client-helper-crypto/docs/configuration.md#testing-tiers).

## License

MIT
