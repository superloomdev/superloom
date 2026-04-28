# Dependency Strategy

The layered dependency model that Superloom helper modules follow. Two foundation modules (`js-helper-utils` and `js-helper-debug`) have zero runtime dependencies; everything else depends on them via **peer dependencies** so applications get a single shared instance.

## On This Page

- [Self-Contained Foundation Modules](#self-contained-foundation-modules)
- [Why Peer Dependencies](#why-peer-dependencies)
- [Module Structure](#module-structure)
- [Consumer Installation](#consumer-installation)
- [Benefits](#benefits)
- [Module Dependencies](#module-dependencies)
- [Development Guidelines](#development-guidelines)
- [Migration Strategy](#migration-strategy)
- [CI/CD Impact](#cicd-impact)
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

## Module Dependencies

### Foundation Modules (zero dependencies, self-contained)
- `@your-org/js-helper-utils` - Base utilities, no dependencies
- `@your-org/js-helper-debug` - Structured logging, no dependencies

### Core Modules (depend on foundation)
- `@your-org/js-helper-time` → peer: `@your-org/js-helper-utils`

### Client Modules (browser-optimized, no dependencies)
- `@your-org/js-client-helper-crypto` - UUID, random strings, base64 (self-contained)

### Server Modules (self-contained, use Node.js APIs)
- `@your-org/js-server-helper-crypto` - Hashing, encryption, UUID, base conversion (self-contained)

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

## Migration Strategy

1. **Convert devDependencies to peerDependencies** for inter-module dependencies
2. **Keep devDependencies** for development tools (eslint, etc.)
3. **Update tests** to use published packages
4. **Bump versions** for breaking changes
5. **Publish** modules in dependency order (utils → debug → others)

---

## CI/CD Impact

- **Test matrix**: Each module tested with published peer dependencies
- **Publish order**: Dependencies must be published first
- **Version coordination**: Careful version management required

---

## Troubleshooting

### Common Issues

1. **Missing peer dependency**: Install the required peer dependency
2. **Version conflicts**: Update to compatible versions
3. **Development errors**: Ensure devDependencies match peerDependencies
4. **Authentication errors**: GitHub Packages requires proper token setup

### GitHub Packages Authentication

Local development requires authentication to access published packages:

**Recommended Setup (Global npmrc):**
```bash
# One-time setup
npm config set @your-org:registry https://npm.pkg.github.com
npm config set //npm.pkg.github.com/:_authToken '${GITHUB_READ_PACKAGES_TOKEN}'

# Initialize development environment (each terminal session)
source init-env.sh
# Select: 1) dev

# Verify authentication
npm view @your-org/js-helper-utils --registry=https://npm.pkg.github.com
```

**Complete setup guide:** See `docs/dev/npmrc-setup.md`

**Common authentication issues:**
- Token expired or lacks `read:packages` scope
- Environment variable not set (`echo $GITHUB_READ_PACKAGES_TOKEN`)
- Global npmrc not configured (`npm config get @your-org:registry`)

### Debug Commands

```bash
# Check installed peer dependencies
npm ls @your-org/js-helper-utils

# Install missing peer dependencies
npm install @your-org/js-helper-utils

# Check for peer dependency conflicts
npm install --dry-run @your-org/js-helper-debug

# Test package availability
npm view @your-org/js-helper-utils --registry=https://npm.pkg.github.com
```

### Development vs Production

**Development**: Tests may use local file references until packages are published
**Production**: Always use published versions from GitHub Packages

## Further Reading

- [Module Publishing](module-publishing.md) - how versions are bumped and published
- [Module Structure](module-structure.md) - the factory pattern that `Lib` injection relies on
- [npmrc Setup](../dev/npmrc-setup.md) - the global npmrc configuration that resolves `@your-org/*` packages
