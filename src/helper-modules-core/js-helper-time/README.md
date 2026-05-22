# @superloomdev/js-helper-time

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-brightgreen.svg)](https://nodejs.org)

A date and time helper for Node.js and the browser that ships pre-tested and has zero runtime dependencies. Part of [Superloom](https://superloom.dev).

## What This Is

A flat collection of small, pure functions covering day-and-time math, unixtime and ISO-8601 conversions, structured "data set" decompositions of a date, time formatting, IANA timezone offset and wall-clock conversions, and calendar helpers. Synchronous, side-effect-free, built on the native `Date` and `Intl` APIs.

## Why Use This Module

- **Zero runtime dependencies.** Adding this module to your project adds zero packages to your dependency tree. The supply chain you audit ends at this package itself. No moment, no luxon, no date-fns to track for security advisories.

- **Runs everywhere.** Pure JavaScript with no platform-specific globals. The same module works under Node.js, in a browser bundle, in an edge runtime, in a Lambda, in a Cloudflare Worker. Timezone math uses the runtime's built-in `Intl.DateTimeFormat`, which every modern JavaScript runtime ships.

- **Pre-tested at every release.** A full test suite runs in CI on every push. Your project trusts the wrapper instead of re-verifying date plumbing on each release.

- **Designed for human review.** The code is laid out as clearly-marked visual sections (section banners, short functions, scoped comments) so a reviewer can read it top to bottom in order, use the section breaks as checkpoints to mark how far they have got, and finish without ever getting lost in dense logic. This matters most when an AI assistant is generating the change and a human still has to sign off on it. Open `time.js` to see the structure.

## Aligned with Superloom Philosophy

If your project is built on Superloom conventions (the same loader pattern, the same testing model), this module slots in without you needing to learn anything new.

If you are not yet using Superloom, the principles are documented at [superloom.dev](https://superloom.dev).

## Extended Documentation

- [API reference](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-core/js-helper-time/docs/api.md) - every exported function with its signature, parameters, return shape, and worked examples
- [Configuration](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-core/js-helper-time/docs/configuration.md) - loader pattern, dependency notes, testing tier
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

Test runtime details (no Docker, no service required) live in [Configuration → Testing Tiers](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-core/js-helper-time/docs/configuration.md#testing-tiers).

## License

MIT
