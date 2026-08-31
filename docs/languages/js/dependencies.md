# Dependency Strategy

The layered dependency model that Superloom helper modules follow. Two foundation modules (`js-helper-utils` and `js-helper-debug`) have zero runtime dependencies; everything else depends on them via **peer dependencies** so applications get a single shared instance.

## On This Page

- [Self-Contained Foundation Modules](#self-contained-foundation-modules)
- [Why Peer Dependencies](#why-peer-dependencies)
  - [Problem with Regular Dependencies](#problem-with-regular-dependencies)
  - [Solution with Peer Dependencies](#solution-with-peer-dependencies)
- [Module Structure](#module-structure)
  - [Injected Dependencies Are Peer Dependencies](#injected-dependencies-are-peer-dependencies)
  - [Module Acquisition Rules](#module-acquisition-rules)
- [Consumer Installation](#consumer-installation)
- [Benefits](#benefits)
- [Per-Module Inventory](#per-module-inventory)
- [Development Guidelines](#development-guidelines)
  - [When Adding Dependencies to a Module](#when-adding-dependencies-to-a-module)
  - [Example: Adding a New Dependency](#example-adding-a-new-dependency)
- [Troubleshooting](#troubleshooting)
  - [Common Issues](#common-issues)
  - [Authentication Errors When Installing](#authentication-errors-when-installing)
- [Further Reading](#further-reading)

---
## Self-Contained Foundation Modules

**`js-helper-utils` and `js-helper-debug` are fully self-contained with zero runtime dependencies.**

These two modules form the foundation of the entire framework. They must never depend on each other or on any other helper module. This guarantees:

- **Logging never breaks** because a utility dependency has a bug
- **Utilities never break** because of a circular or transitive dependency
- **Any module can depend on them** without risk of dependency conflicts

All other helper modules may depend on utils and debug through peer dependencies.

---

## Why Peer Dependencies

### Problem with Regular Dependencies
When modules use regular dependencies, an application installing multiple modules gets duplicated packages:

```bash
npm install @your-org/js-helper-debug @your-org/js-helper-utils
# Results in:
# - node_modules/@your-org/js-helper-debug
# - node_modules/@your-org/js-helper-debug/node_modules/@your-org/js-helper-utils  # Duplicate!
# - node_modules/@your-org/js-helper-utils
```

### Solution with Peer Dependencies
Peer dependencies tell npm: "I expect the consumer to provide this dependency."

```bash
npm install @your-org/js-helper-debug @your-org/js-helper-utils
# Results in:
# - node_modules/@your-org/js-helper-debug
# - node_modules/@your-org/js-helper-utils  # Single instance shared by all
```

---

## Module Structure

Each module with dependencies follows this pattern:

```json
{
  "name": "@your-org/js-helper-debug",
  "peerDependencies": {
    "@your-org/js-helper-utils": "^1.0.5"
  },
  "devDependencies": {
    "@your-org/js-helper-utils": "^1.0.5"
  }
}
```

- **peerDependencies**: Declared for consumers, not installed by npm
- **devDependencies**: Required for development/testing

### Injected Dependencies Are Peer Dependencies

Every module MUST declare in `peerDependencies` every Superloom module it consumes at runtime, INCLUDING modules received only by injection through the `shared_libs` container and never imported directly.

**Why.** The manifest is the contract. Hosts must install these packages to inject them into `shared_libs`. If a module picks `Utils` or `Debug` from the injected `Lib` container, the host needs `js-helper-utils` and `js-helper-debug` installed - and the only signal the host has is `peerDependencies`. Omitting them produces a runtime `TypeError` on a missing injection with no manifest-level warning.

**Consequence.** `ROBOTS.md` and `docs/configuration.md` peer-dependency lists MUST match `package.json` exactly. A mismatch between what the docs list and what the manifest declares is a docs-vs-manifest drift finding in audit.

**Version ranges.** Superloom modules use caret style: `^1.0.0`. A framework peer such as `react` or `react-native` uses `>=`, because the module supports a span of major versions and the host owns the version. Not `>=` for Superloom peers; not `^` for framework peers.

### Module Acquisition Rules

1. A module acquires its dependencies with static `import`. `createRequire` is reserved for a genuinely CJS-only vendor package or a local JSON file, and is **never** used in client-tier code.

2. A required peer dependency is never wrapped in `try/catch`. Absence is a setup error and must fail loudly.

3. CJS named-export detection through `cjs-module-lexer` is heuristic and unreliable; only `default` is dependable.

4. A test double matches the module format **and** export shape of the package it replaces, verified against the real package rather than assumed.

5. `scripts/` files are part of the module and follow the package's module type.

6. A module's published documentation ships in the tarball, so a documentation-only change still requires a republish to reach consumers.

---

## Consumer Installation

Applications must install both the module and its peer dependencies:

```bash
# Required installation
npm install @your-org/js-helper-debug @your-org/js-helper-utils

# Will fail if peer dependencies missing
npm install @your-org/js-helper-debug  # Error: Missing peer dependency
```

---

## Benefits

1. **Single Instance**: Each dependency installed once at application level
2. **Version Control**: Application decides which version all modules use
3. **Smaller Bundles**: No duplicate packages
4. **Consistent Behavior**: All modules share the same dependency instances
5. **Faster Installs**: Fewer packages to download and install

---

## Per-Module Inventory

Which specific modules depend on which is tracked in [`module-classes.md`](module-classes.md). The rule is simple and lives in this file: foundation modules (`js-helper-utils`, `js-helper-debug`) are zero-dep; every other module depends on them via peer dependencies.

---

## Development Guidelines

### When Adding Dependencies to a Module

1. **Add to peerDependencies**: For consumers to install
2. **Add to devDependencies**: For development/testing
3. **Update tests**: Use published package versions
4. **Update documentation**: List all peer dependencies

### Example: Adding a New Dependency

```json
{
  "peerDependencies": {
    "@your-org/js-helper-utils": "^1.0.5",
    "@your-org/js-helper-new": "^1.0.0"
  },
  "devDependencies": {
    "@your-org/js-helper-utils": "^1.0.5",
    "@your-org/js-helper-new": "^1.0.0",
    "eslint": "^10.2.0",
    "@eslint/js": "^10.0.1",
    "@your-org/js-helper-eslint-config": "^1.0.0"
  }
}
```

---

## Troubleshooting

### Common Issues

1. **Missing peer dependency**: Install the required peer dependency
2. **Version conflicts**: Update to compatible versions
3. **Development errors**: Ensure devDependencies match peerDependencies
4. **Authentication errors**: GitHub Packages requires proper token setup

### Authentication Errors When Installing

If `npm install` fails with `401 Unauthorized` or cannot resolve `@your-org/*` packages, the GitHub Packages authentication is not configured. The full setup procedure is in [`../../dev/onboarding-github-packages.md`](../../dev/onboarding-github-packages.md) (token side) and [`../../dev/npmrc-setup.md`](../../dev/npmrc-setup.md) (npmrc side). This page does not duplicate those steps.

## Further Reading

- [Module Publishing](publishing.md) - how versions are bumped and published
- [Module Structure (JavaScript)](module-structure) - the factory pattern that `Lib` injection relies on
- [npmrc Setup](../../dev/npmrc-setup.md) - the global npmrc configuration that resolves `@your-org/*` packages
