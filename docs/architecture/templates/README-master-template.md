# @superloomdev/<PACKAGE_NAME>

[![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js <VERSION>+](https://img.shields.io/badge/Node.js-<VERSION>%2B-brightgreen.svg)](https://nodejs.org)

<ONE_SENTENCE_DESCRIPTION>. Part of the [Superloom](https://github.com/superloomdev/superloom) framework.

> **<MODULE_TYPE_TAG>** - <MODULE_TYPE_DESCRIPTION>.

## What It Does

{2-3 PARAGRAPHS explaining what problem this module solves and why someone would use it. Focus on the outcome, not the implementation.}

{For complex modules:}
**Further reading:**
- [`docs/topic-a.md`](docs/topic-a.md) — <Brief description>
- [`docs/topic-b.md`](docs/topic-b.md) — <Brief description>

## Installation

```bash
npm install @superloomdev/<PACKAGE_NAME>
```

{For modules with peer dependencies:}
```bash
npm install @superloomdev/<PACKAGE_NAME> \
            @superloomdev/<PEER_DEPENDENCY>
```

## Quick Start

```javascript
// Setup in your loader
Lib.<ModuleName> = require('@superloomdev/<PACKAGE_NAME>')(Lib, {
  // minimal working configuration
});

// Usage
const result = await Lib.<ModuleName>.<mainFunction>(instance, {
  // example parameters
});
```

## API

| Function | Params | Returns | Description |
|----------|--------|---------|-------------|
| `<functionName>` | `(instance, options)` | `{ success, data, error }` | <Description> |

## Configuration

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `<CONFIG_KEY>` | `<Type>` | — | **Required.** <Description>. |
| `<OPTIONAL_KEY>` | `<Type>` | `<default>` | <Description>. |

{For store adapters:}
### STORE_CONFIG

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `<store_config_key>` | `<Type>` | Yes | <Description>. |

## Peer Dependencies

| Package | Purpose |
|---------|---------|
| `@superloomdev/js-helper-utils` | Type checks, validation |
| `@superloomdev/js-helper-debug` | Structured logging |

## Testing

| Tier | Runtime | Status |
|------|---------|--------|
| **Unit Tests** | Node.js `node --test` | [![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml) |

Run locally:

```bash
cd _test
npm install && npm test
```

{For service-dependent modules:}
Docker lifecycle is fully automatic. `pretest` starts the container; `posttest` stops it. No manual `docker compose` needed.

## License

MIT
