# @superloomdev/<PACKAGE_NAME>

[![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js <VERSION>+](https://img.shields.io/badge/Node.js-<VERSION>%2B-brightgreen.svg)](https://nodejs.org)

<BACKEND> <feature> adapter for [`@superloomdev/<PARENT_MODULE>`](../<PARENT_FOLDER>). Implements the <N>-method store contract backed by <BACKEND> via `@superloomdev/<DRIVER_MODULE>`.

> **Service-dependent.** Tests require a running <BACKEND> instance. The Docker lifecycle is managed automatically by `npm test` via `pretest`/`posttest` scripts — no manual `docker compose` needed.

## How This Adapter Fits In

The <parent> module calls this adapter as a factory:

```js
const store = require('@superloomdev/<PACKAGE_NAME>')(Lib, CONFIG, ERRORS);
```

The adapter receives the full narrowed `Lib` (<list deps>), the merged `CONFIG` (from which it extracts `CONFIG.STORE_CONFIG` internally), and the frozen <parent> `ERRORS` catalog (used verbatim in error envelopes). It returns the <N>-method store interface consumed by `<parent>.js`. The caller never needs to know which backend is active.

This is the standard **adapter factory protocol** shared by all `<parent-store>-*` packages.

## Install

```bash
npm install @superloomdev/<PARENT_MODULE> \
            @superloomdev/<PACKAGE_NAME> \
            @superloomdev/<DRIVER_MODULE>
```

## Usage

Pass the adapter factory to `STORE`. Pass the `Lib.<Driver>` instance in `STORE_CONFIG`.

```js
const Lib = {};
Lib.Utils    = require('@superloomdev/js-helper-utils')(Lib, {});
Lib.Debug    = require('@superloomdev/js-helper-debug')(Lib, {});
Lib.Crypto   = require('@superloomdev/js-server-helper-crypto')(Lib, {});
Lib.Instance = require('@superloomdev/js-server-helper-instance')(Lib, {});

Lib.<Driver> = require('@superloomdev/<DRIVER_MODULE>')(Lib, {
  HOST:     process.env.DB_HOST,
  DATABASE: process.env.DB_NAME,
  USER:     process.env.DB_USER,
  PASSWORD: process.env.DB_PASSWORD
});

Lib.<Parent> = require('@superloomdev/<PARENT_MODULE>')(Lib, {
  STORE: require('@superloomdev/<PACKAGE_NAME>'),
  STORE_CONFIG: {
    <table_name>: '<table_name>',
    lib_<driver>: Lib.<Driver>
  }
  // ... other config
});

// Create table + index at boot (idempotent)
await Lib.<Parent>.setupNewStore(Lib.Instance.initialize());
```

## STORE_CONFIG

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `<table/collection>_name` | `String` | Yes | Name of the <table/collection>. Use one <table/collection> per use case. |
| `lib_<driver>` | `Object` | Yes | An initialized `Lib.<Driver>` instance (`@superloomdev/<DRIVER_MODULE>`). |

## Schema

`setupNewStore` issues idempotent DDL statements:

```<language>
<SCHEMA DDL>
```

### <Backend>-Specific Notes

- <Specific detail 1>
- <Specific detail 2>

## Store Contract

This adapter implements the <N>-method contract consumed by `<parent>.js`:

| Method | Signature | Returns |
|--------|-----------|---------|
| `setupNewStore` | `(instance)` | `{ success, error }` |
| `<method1>` | `(instance, ...args)` | `{ success, <data>, error }` |
| `<method2>` | `(instance, ...args)` | `{ success, error }` |
| ... | ... | ... |

## Peer Dependencies

| Package | Purpose |
|---------|---------|
| `@superloomdev/js-helper-utils` | Type checks |
| `@superloomdev/js-helper-debug` | Structured debug logging |
| `@superloomdev/<DRIVER_MODULE>` | <Backend> driver wrapper (`Lib.<Driver>`) |

## Testing

```bash
cd _test && npm install && npm test
```

Docker lifecycle is fully automatic. `pretest` starts a <BACKEND> <VERSION> container; `posttest` stops and removes it (containers and volumes only — images are cached). No manual `docker compose up` needed.

`_test/store-contract-suite.js` is a local copy of the shared integration suite maintained by the <parent> module. It is not fetched from the <parent> package at test time — this keeps the adapter's test harness self-contained and records which contract version it was built against.

The suite covers:
- Adapter unit tests (Tier 1): store loader config validation, <specific tests>
- Full <parent> lifecycle integration (Tier 3): every public <Parent> API path driven against the real <BACKEND> backend via the store contract suite

## License

MIT
