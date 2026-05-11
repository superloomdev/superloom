---
auto_execution_mode: 0
description: Create a new helper module (core, server, or client)
---

# New Helper Module Workflow

When creating a new helper module, follow these steps exactly. This workflow supports **core**, **server**, and **client** helper types.

## On This Page

- [Quick Steps](#quick-steps)
- [Detailed Instructions](#detailed-instructions)
- [2. Create Module Directory](#2-create-module-directory)
- [3. Create Main Implementation File](#3-create-main-implementation-file)
- [4. Module Type-Specific Considerations](#4-module-type-specific-considerations)
- [5. Create Config File](#5-create-config-file-if-applicable)
- [6. Create Package JSON](#6-create-package-json)
- [7. Create ESLint Config](#7-create-eslint-config)
- [8. Create Test Directory and Files](#8-create-test-directory-and-files)
- [9. Create README.md](#9-create-readmemd)
- [10. Register Environment Variables](#10-register-environment-variables)
- [11. Verify](#11-verify)

---

## Quick Steps

1. **Determine Module Type** - Core / Server / Client
2. **Create Module Directory** - Based on type (see paths below)
3. **Create Files** - Main implementation, config, package.json, tests, README
4. **Verify** - Run tests

## Detailed Instructions

Choose the appropriate module type based on purpose:

- **Core** (`src/helper-modules-core/`): Platform-agnostic utilities (validation, logging, data manipulation)
- **Server** (`src/helper-modules-server/`): Server-only helpers (DB wrappers, Cloud SDKs, AWS services)
- **Client** (`src/helper-modules-client/`): Client-side helpers (browser, React Native, mobile utilities)

## 2. Create Module Directory

Create the module directory based on type:

```
src/helper-modules-core/js-helper-[module-name]/        # Core
src/helper-modules-server/js-helper-[module-name]/     # Server
src/helper-modules-client/js-helper-[module-name]/    # Client
```

For server-only modules that won't be shared with client, you may also use:
```
src/helper-modules-server/js-server-helper-[module-name]/  # Alternative naming for server
```

## 3. Create Main Implementation File

First, pick the config pattern that matches the module's needs. Full rules: `docs/architecture/module-structure.md` -> "Helper Module Configuration Patterns".

| Pattern | Use when |
|---|---|
| **Pattern 1 (Singleton Config)** | Pure stateless wrapper; same config applies process-wide (utility libs, crypto, logging, time) |
| **Pattern 2 (Multi-Instance Factory)** | Wraps any per-instance state - connection pool, persistent client, authenticated session |

Create `[module-name].js` using the template that matches the chosen pattern. Full templates with comments live in `docs/architecture/module-structure.md`. Reference implementations:

- **Pattern 1** example: `src/helper-modules-core/js-helper-utils/`
- **Pattern 2** example: `src/helper-modules-server/js-server-helper-mysql/mysql.js`

Follow all coding standards from `docs/architecture/code-formatting-js.md`:
- Single quotes, 2-space indent, no trailing commas
- JSDoc for every function with `@param` and `@returns`
- Space before function parens and blocks
- TWO empty lines between function definitions
- Section header hierarchy: Level 1 (`//////// [Name] START ////////`), Level 2 (`// ~~~~~ [Name] ~~~~~`), Level 3 (inline `// [comment]`)
- Human-tone comments: prescriptive voice, no em-dashes, no migration/legacy references
- First logical block in every function starts with a one-line step comment (`// Build pool on first call`, `// Start performance timeline`, etc.)
- For modules wrapping a vendor library, use the `ensureAdapter()` + `initIfNot()` pair
- `createInterface(Lib, CONFIG)` - add `// eslint-disable-line no-unused-vars` only when `CONFIG` is unused by the function body. Omit the directive when both params are used

## 4. Module Type-Specific Considerations

### Core Modules (`src/helper-modules-core/`)
- Must be platform-agnostic (no Node.js-specific APIs)
- Safe to use in both server and client code
- Focus on pure functions and data manipulation

### Server Modules (`src/helper-modules-server/`)
- Can use Node.js-specific APIs (fs, http, etc.)
- Can use cloud SDKs (AWS, database drivers)
- May need environment-specific config injection

### Client Modules (`src/helper-modules-client/`)
- Must be browser-compatible or platform-specific (React Native, etc.)
- Minimize bundle size
- Handle platform differences gracefully

## 5. Create Config File (if applicable)

Create `config.js` only if module needs configuration:

```javascript
// Info: Configuration file
'use strict';

module.exports = {
  // Module-specific constants
};
```

## 6. Create Package JSON

Create `package.json`:

```json
{
  "name": "@superloomdev/js-helper-[module-name]",
  "description": "[Module description]",
  "version": "1.0.0",
  "main": "[module-name].js",
  "private": false,
  "license": "MIT",
  "author": {
    "name": "sj00"
  },
  "contributors": [],
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  },
  "bundleDependencies": false,
  "engines": {
    "node": ">=20.19"
  },
  "dependencies": {},
  "devDependencies": {
    "eslint": "^10.2.0",
    "@eslint/js": "^10.0.1"
  },
  "scripts": {
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "test": "node --test _test/test.js"
  }
}
```

## 7. Create ESLint Config

Copy `eslint.config.js` from `src/helper-modules-core/js-helper-utils/eslint.config.js`

## 8. Create Test Directory and Files

Create `_test/` directory with:

### `_test/package.json`
```json
{
  "name": "js-helper-[module-name]-test",
  "description": "Test Cases for js-helper-[module-name]",
  "version": "1.0.0",
  "main": "test.js",
  "private": true,
  "license": "MIT",
  "author": {
    "name": "sj00"
  },
  "dependencies": {
    "@superloomdev/js-helper-utils": "^1.1.0",
    "@superloomdev/js-helper-debug": "^1.5.0",
    "@superloomdev/js-helper-[module-name]": "file:../"
  },
  "scripts": {
    "test": "node --test test.js"
  }
}
```

### `_test/loader.js`

Return `{ Lib }` for stateless modules. Return `{ Lib, Config }` for modules that read `process.env` values needed by tests (e.g. database host, file paths) - `Config` exposes those values to `test.js` without reading `process.env` again.

```javascript
// Info: Test loader for js-helper-[module-name]
// Mirrors the main project loader pattern: loads dependencies from environment
// process.env is ONLY read here - never in test.js
'use strict';

module.exports = function loader () {

  // Test-wide environment config (omit if module has no env-dependent values)
  // const Config = { db_host: process.env.DB_HOST || 'localhost' };

  // Sub-configs: each helper module receives ONLY its relevant config slice
  const config_debug = { LOG_LEVEL: 'error' };

  // const config_module = { KEY: process.env.ENV_VAR_NAME };

  const Lib = {};

  Lib.Utils = require('@superloomdev/js-helper-utils')();
  Lib.Debug = require('@superloomdev/js-helper-debug')(Lib, config_debug);

  // Lib.ModuleName = require('@superloomdev/js-helper-[module-name]')(Lib, config_module);

  return { Lib };
  // For modules with env config: return { Lib, Config };

};
```

### `_test/test.js`
```javascript
// Info: Test Cases for js-helper-[module-name]
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Load all dependencies via test loader
const { Lib } = require('./loader')();

describe('functionName', function () {

  it('should [expected behavior] when [condition]', function () {

    // Arrange
    // Act
    // Assert

  });

});
```

## 9. Create README.md

Create `README.md` with sections in this order:
- **Badges** - exactly 3 header badges for every module (Test + License + Node.js). Test badge uses GitHub's native endpoint pointing at `ci-helper-modules.yml`. Service-dependent modules add an Integration Tests badge inside the `## Testing` table, not the header. Templates in `docs/architecture/module-testing.md`
- **Description** - module name and purpose (1-2 sentences). No hosting vendor names (AWS, Azure, GCP, RDS, Aurora) - use the service/protocol name instead (MySQL, DynamoDB, S3, Postgres)
- **API table** - all exported functions with signatures
- **Usage** - example code snippet. Use generic hostnames (`db.example.com`) and `us-east-1` as the example region. Never use hosting-vendor-specific hostnames
- **Configuration** - config keys, env vars, defaults
- **Environment Variables** - required env vars with values per testing tier (emulated vs integration). Column headers: `Emulated (Dev)` and `Integration (Real)`
- **Peer Dependencies** - `@superloomdev/*` modules injected via loader
- **Direct Dependencies** - third-party packages bundled in `package.json`
- **Testing** - lean section near the end (status table + 3-line run command + link to ops guide). Full setup steps live in `_test/ops/` only. See template in `docs/architecture/module-testing.md`

This README serves as the **compact AI context document** for this module.

## 10. Register Environment Variables

For every variable read from `process.env` in `_test/loader.js`, add it (with appropriate value) to all four files:

| File | Value |
|---|---|
| `docs/dev/.env.dev.example` | Dummy value matching `_test/docker-compose.yml` |
| `docs/dev/.env.integration.example` | Placeholder (e.g. `your-db-host`) |
| `__dev__/.env.dev` | Dummy value matching `_test/docker-compose.yml` |
| `__dev__/.env.integration` | Placeholder |

Every key in `.env.dev` must also exist in `.env.integration`. Never skip a key in one file. Full rules in `docs/architecture/module-testing.md` → "Environment Variable Registration".

## 11. Verify

// turbo
Run `npm install` in the `_test/` directory, then `npm test` to verify the module works.

**Local dev note:** If the root project has a `node_modules/@superloomdev/` directory with stale published versions, Node's module resolution may pick those up instead of local `file:` references. When this happens, manually set up symlinks in `_test/node_modules/@superloomdev/` pointing to the source directories, or run `npm install --install-strategy nested`.
