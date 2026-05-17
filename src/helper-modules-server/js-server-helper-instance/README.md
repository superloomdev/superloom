# @superloomdev/js-server-helper-instance

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-brightgreen.svg)](https://nodejs.org)

A request-lifecycle helper for Node.js servers and serverless handlers that ships pre-tested and has zero runtime dependencies. Part of [Superloom](https://superloom.dev).

## What This Is

A small lifecycle module. One call to `initialize()` returns a plain object that travels with a single request: it carries the start timestamps, a counter for in-flight background routines, and a queue of cleanup callbacks. Register cleanup work with `addCleanupRoutine`, fire-and-forget background work with `backgroundRoutine`, and call `cleanup` at the end of the request. The cleanup queue runs only when the background queue reaches zero.

## Why Use This Module

- **Zero runtime dependencies.** Adding this module to your project adds zero packages to your dependency tree. The supply chain you audit ends at this package itself.

- **Same code in Express and Lambda.** The lifecycle abstraction is identical in both runtimes. Express attaches the instance to the request object so downstream middleware can use it; Lambda creates one per invocation. Business logic never has to ask which runtime it is in.

- **Pre-tested at every release.** A full test suite runs in CI on every push. Your project trusts the wrapper instead of re-verifying request-lifecycle plumbing on each release.

- **Designed for human review.** The code is laid out as clearly-marked visual sections (section banners, short functions, scoped comments) so a reviewer can read it top to bottom in order, use the section breaks as checkpoints to mark how far they have got, and finish without ever getting lost in dense logic. This matters most when an AI assistant is generating the change and a human still has to sign off on it. Open `instance.js` to see the structure.

## Behavior

The module is the contract between a request entry-point (Express middleware, Lambda handler) and the rest of the application. Three concerns:

- **Per-request scope.** `initialize()` returns a fresh object on every call. Two simultaneous requests get two independent objects. Background and cleanup state lives on the object, not on the module.

- **Background routines and cleanup ordering.** Calling `backgroundRoutine(instance)` increments an in-flight counter and returns a completion callback. Calling `cleanup(instance)` only drains the cleanup queue if the in-flight counter is zero; otherwise cleanup is deferred. When the last background completion callback runs, it triggers `cleanup` automatically. The result: registered cleanup callbacks always run after every background routine has finished, regardless of which finishes last.

- **Performance audit reference.** `instance.time_ms` is the unix-millisecond timestamp at the start of the request. Pass it to [`Lib.Debug.performanceAuditLog`](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-core/js-helper-debug/docs/api.md#performanceauditlogaction-routine-reference_time) on every external service boundary, and the resulting log lines reconstruct the full request timeline; not just the duration of the function that emitted the line.

The lifecycle is summarised in the diagram below; full mechanics with worked Express and Lambda examples are in [`docs/api.md`](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-instance/docs/api.md).

```text
   initialize()
      |
      |-- addCleanupRoutine(fn)         (queue grows)
      |-- backgroundRoutine() -> done() (counter ++ then --)
      |-- addCleanupRoutine(fn)
      |
      v
   cleanup()
      |
      |-- if background_queue == 0: drain cleanup_queue (FIFO)
      |-- else: no-op; cleanup runs when last background done() fires
```

## Aligned with Superloom Philosophy

If your project is built on Superloom conventions (the same loader pattern, the same testing model), this module slots in without you needing to learn anything new. Every Superloom helper that does I/O accepts an `instance` as its first argument; that argument is what this module produces.

If you are not yet using Superloom, the principles are documented at [superloom.dev](https://superloom.dev).

## Extended Documentation

- [API reference](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-instance/docs/api.md) - every exported function with its signature, parameters, return shape, and worked Express + Lambda examples
- [Configuration](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-instance/docs/configuration.md) - loader pattern, instance object shape, dependency notes, testing tier
- [`js-helper-debug` performance auditing](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-core/js-helper-debug/docs/api.md#performance-auditing) - the canonical use of `instance.time_ms`
- [Superloom](https://superloom.dev) - the framework

## Adding to Your Project

Install this module as a peer dependency in your project's `package.json` and load it through the standard Superloom loader. Do not vendor the source or use it as a local file dependency. The published package is the supported integration path.

The loader pattern, including the full `Lib` container shape, is documented in [Server Loader Architecture](https://github.com/superloomdev/superloom/blob/main/docs/architecture/server/server-loader.md). For one-time GitHub Packages registry setup, see the [npmrc setup guide](https://github.com/superloomdev/superloom/blob/main/docs/dev/npmrc-setup.md).

## Testing Status

| Tier | Runtime | Status |
|---|---|---|
| Unit | Node.js `node --test` | [![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml) |

Test runtime details (no Docker, no service required) live in [Configuration → Testing Tiers](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-instance/docs/configuration.md#testing-tiers).

## License

MIT
