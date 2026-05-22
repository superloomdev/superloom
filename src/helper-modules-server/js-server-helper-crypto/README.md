# @superloomdev/js-server-helper-crypto

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-brightgreen.svg)](https://nodejs.org)

A server-side cryptography helper for Node.js that ships pre-tested and is built on Node's audited `crypto` module. Part of [Superloom](https://superloom.dev).

## What This Is

A flat collection of small functions covering UUID v4 and base-36 compact identifiers, charset-bounded random strings, MD5 and HMAC-SHA256 hashing, AES-128-CBC encryption / decryption, integer-to-base-36 conversion, and base64 encode / decode (including the URL-safe variant). Synchronous, side-effect-free. Every operation delegates to Node's built-in `crypto` module; the wrapper adds no novel cryptography.

## Hot-Swappable with the Browser-Side Sibling

This module is the server-side member of a runtime pair. The seven shared functions (`generateRandomString`, `generateUUID`, `generateCompactUUID`, `stringToBase64`, `base64ToString`, `urlEncodeBase64`, `urlDecodeBase64`) have the same names and the same calling shape on both sides. Switch the loader line to move between runtimes without rewriting your code.

- [`@superloomdev/js-client-helper-crypto`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-client/js-client-helper-crypto) - Browser-side equivalent. Implements the shared seven functions on the Web Crypto API, omitting the server-only operations (hashing, HMAC, AES, base conversion, time-prefixed random, buffer-to-base64)

## Why Use This Module

- **Zero npm dependencies.** Built on Node's audited `crypto` module, which ships with the runtime. Adding this module to your project adds zero packages to your dependency tree.

- **Backed by Node's built-in crypto.** Hashing, HMAC, AES-128-CBC, and UUID v4 all delegate to OpenSSL via Node's standard library. The wrapper adds no novel cryptography; it standardises calling shape and names so they line up with the browser-side sibling.

- **Pre-tested at every release.** A full test suite runs in CI on every push. Your project trusts the wrapper instead of re-verifying server-crypto plumbing on each release.

- **Designed for human review.** The code is laid out as clearly-marked visual sections (section banners, short functions, scoped comments) so a reviewer can read it top to bottom in order, use the section breaks as checkpoints to mark how far they have got, and finish without ever getting lost in dense logic. This matters most when an AI assistant is generating the change and a human still has to sign off on it. Open `crypto.js` to see the structure.

## Aligned with Superloom Philosophy

If your project is built on Superloom conventions (the same loader pattern, the same testing model), this module slots in without you needing to learn anything new.

If you are not yet using Superloom, the principles are documented at [superloom.dev](https://superloom.dev).

## Extended Documentation

- [API reference](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-crypto/docs/api.md) - every exported function with its signature, parameters, return shape, and worked examples
- [Configuration](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-crypto/docs/configuration.md) - loader pattern, three configuration keys, dependency notes, testing tier
- [`js-client-helper-crypto`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-client/js-client-helper-crypto) - the browser-side sibling
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

Test runtime details (no Docker, no service required) live in [Configuration → Testing Tiers](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-crypto/docs/configuration.md#testing-tiers).

## License

MIT
