# @superloomdev/<PACKAGE_NAME>

[![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js <VERSION>+](https://img.shields.io/badge/Node.js-<VERSION>%2B-brightgreen.svg)](https://nodejs.org)

<ONE_SENTENCE_DESCRIPTION>. Built-in storage adapters for **<list backends>** — pick one with a config string, no adapter code to maintain. Part of the [Superloom](https://github.com/superloomdev/superloom) framework.

<KEY_PROPERTIES_BULLETS>

---

## Tested Backends

The shared store suite (`_test/shared-store-suite.js`) runs the same <N>-case contract against every backend. <List which need Docker>.

| Backend | Schema | Native TTL | Cleanup |
|---------|--------|------------|---------|
| `<backend1>` | <schema desc> | <Yes/No> | `<cleanupFunction>` |
| `<backend2>` | <schema desc> | <Yes/No> | `<cleanupFunction>` |

Run all backends end-to-end:

```bash
cd _test/
npm install
npm test     # spins up docker compose, runs every backend, tears it down
```

---

## Peer Dependencies (Injected via Loader)

| Package | Injected as |
|---|---|
| `@superloomdev/js-helper-utils` | `Lib.Utils` |
| `@superloomdev/js-helper-debug` | `Lib.Debug` |
| `@superloomdev/js-server-helper-crypto` | `Lib.Crypto` |
| `@superloomdev/js-server-helper-instance` | `Lib.Instance` |

Plus **one** of the following depending on the chosen `STORE`:

| `STORE` factory | Required helper |
|-----------------|-----------------|
| `stores/<backend1>` | `Lib.<Driver1>` (`@superloomdev/<DRIVER1>`) |
| `stores/<backend2>` | `Lib.<Driver2>` (`@superloomdev/<DRIVER2>`) |

The <module> module **never** imports these helpers directly.

---

## Installation

```bash
npm install @superloomdev/<PACKAGE_NAME>
```

---

## Quick Start

```javascript
// One-time setup at boot
Lib.<Module> = require('@superloomdev/<PACKAGE_NAME>')(Lib, {
  STORE: require('@superloomdev/<PACKAGE_NAME>/stores/<default_backend>'),
  STORE_CONFIG: {
    <table/collection>_name: '<table_name>',
    lib_<driver>: Lib.<Driver>
  }
});

// Idempotent <table/collection> + index creation
await Lib.<Module>.setupNewStore(instance);

// Usage
const created = await Lib.<Module>.<createFunction>(instance, {
  <example_params>
});
```

---

## Public API

| Function | Returns | Use |
|----------|---------|-----|
| `<function1>(instance, options)` | `{ success, <data>, error }` | <Description> |
| `<function2>(instance, options)` | `{ success, error }` | <Description> |
| `<cleanupFunction>(instance)` | `{ success, deleted_count, error }` | Cron-driven sweep of TTL-expired rows |
| `setupNewStore(instance)` | `{ success, error }` | Idempotent backend setup |

### `options` for `<function1>`

| Field | Type | Description |
|-------|------|-------------|
| `<field1>` | `<Type>` | <Description> |
| `<field2>` | `<Type>` | <Description> |

### Return shapes

```javascript
// <function1>
{ success: true,  <data>, error: null }
{ success: false, <data>: null, error: { type, message } }
```

---

## Configuration

| Key | Default | Notes |
|-----|---------|-------|
| `STORE` | `null` (required) | Store factory function (e.g. `require('./stores/<backend>')`) |
| `STORE_CONFIG` | `null` (required) | Per-store config; shape varies (see below) |
| `<OPTION1>` | `<default1>` | <Description> |

### `STORE_CONFIG` per backend

| Backend | Required `STORE_CONFIG` keys |
|---------|------------------------------|
| `<backend1>` | `{ <key1>, <key2> }` |
| `<backend2>` | `{ <key1>, <key2> }` |

## Error Catalog

All operational errors are defined in [`<module>.errors.js`](./<module>.errors.js):

| Error Type | Trigger |
|------------|---------|
| `<ERROR1>` | <Trigger description> |
| `<ERROR2>` | <Trigger description> |

Errors are frozen objects with shape `{ type: string, message: string }`. Projects may pass them through directly, or map `error.type` to domain-specific errors in the service layer.

---

## Lifecycle Flow

### <Action>

1. <Step 1>
2. <Step 2>
3. <Step 3>

---

## Cleanup cadence

| Backend | Recommended cleanup |
|---------|---------------------|
| `<backend1>` | <Recommendation> |
| `<backend2>` | <Recommendation> |

The <module> module **never depends on cleanup running**. The <correctness check> guarantees correctness regardless.

---

## Out of Scope

- **<Feature not included>.** See <Where to find it instead>.
- **<Feature not included>.** See <Where to find it instead>.

---

## Data Model

Every <event/record> is stored as a single flat record. This section explains what each field means, why it exists, and how to populate it correctly.

### Core concepts

**<Concept1>.** <Explanation>

```
<concept1>: '<example1>'     // <what this means>
<concept1>: '<example2>'    // <what this means>
```

**<Concept2>.** <Explanation>

### Record fields

| Field | Type | Set by | Description |
|-------|------|--------|-------------|
| `<field1>` | `<Type>` | <caller/module> | <Description> |
| `<field2>` | `<Type>` | <caller/module> | <Description> |

---

## License

MIT
