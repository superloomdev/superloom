# Dependency Strategy

The layered dependency model that Superloom helper modules follow. Two foundation modules (`js-helper-utils` and `js-helper-debug`) have zero runtime dependencies; everything else depends on them via **peer dependencies** so applications get a single shared instance.

## On This Page

- [Self-Contained Foundation Modules](#self-contained-foundation-modules)
- [Why Peer Dependencies](#why-peer-dependencies)
- [Module Structure](#module-structure)
- [Consumer Installation](#consumer-installation)
- [Benefits](#benefits)
- [Development Guidelines](#development-guidelines)
- [Troubleshooting](#troubleshooting)

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
    "eslint": "^9.0.0",
    "@eslint/js": "^9.0.0"
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
