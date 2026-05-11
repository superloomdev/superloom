# @superloomdev/<PACKAGE_NAME>

[![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js <VERSION>+](https://img.shields.io/badge/Node.js-<VERSION>%2B-brightgreen.svg)](https://nodejs.org)

<ONE_SENTENCE_DESCRIPTION>. Part of the [Superloom](https://github.com/superloomdev/superloom).

> **Foundation module** - zero runtime dependencies by design. This module and `<OTHER_FOUNDATION>` form the self-contained base layer. All other helper modules may depend on them, but never the reverse.

## Installation

Configure your project to use the GitHub Packages registry for the `@superloomdev` scope:

```bash
# .npmrc (project root)
@superloomdev:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=$<GITHUB_READ_PACKAGES_TOKEN>
```

Then install:

```bash
npm install @superloomdev/<PACKAGE_NAME>
```

## Usage

```javascript
// In loader (shared_libs unused - <Module> has no peer deps)
Lib.<Module> = require('@superloomdev/<PACKAGE_NAME>')(Lib, { /* config overrides */ });

// <Specific usage example>
Lib.<Module>.<function>(<args>);
```

## API Reference

### <Category Name>

#### <Subcategory>

- `<functionName>(<params>)` - <Brief description>

{Repeat for all functions, organized by category}

## Testing

| Tier | Runtime | Status |
|------|---------|--------|
| **Unit Tests** | Node.js `node --test` | [![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml) |

Run locally:

```bash
cd _test
npm install && npm test
```

See [Module Testing](https://github.com/superloomdev/superloom/blob/main/docs/architecture/module-testing.md) for the full testing architecture.
