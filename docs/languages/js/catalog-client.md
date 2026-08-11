# Client Helper Modules

Modules designed for client-side use. These live in `src/helper-modules-client/` and ship code that runs in browsers, React Native, or any JavaScript client environment.

---

## The Four Types

Client helper modules come in four flavors:

| Type | Pattern | Example | Dependencies |
|---|---|---|---|
| **Universal core** | Pure JavaScript, no framework | `js-client-helper-crypto` | None |
| **Framework extension** | Binds parent to React/Vue/Angular | `js-client-helper-font-ext-web` | Parent module + React |
| **Standalone framework module** | Framework-bound, no pure parent | `js-react-helper-idle` | React (injected) |
| **Driver wrapper** | Wraps a storage engine, unified API | `js-client-helper-kv-localstorage` | Engine (injected) |

---

## Universal Core Modules

Pure JavaScript that runs anywhere. These are technically Class A modules with a browser-side tagline. These serve as **parent modules** for Class G extensions.

**Characteristics:**
- No runtime dependencies
- Uses only Web APIs available in all environments (Web Crypto, fetch, etc.)
- Runs in Node.js, browsers, React Native, edge runtimes

**Examples:**
- `js-client-helper-crypto` - UUID, random strings, base64 using Web Crypto API
- `js-client-helper-styler` - Theme engine with template-driven token generation (retired; superseded by `js-client-helper-themer`)
- `js-client-helper-font` - Font family registry, manifest schema, role-to-family resolution
- `js-client-helper-themer` - Carbon-vocabulary token engine with three-tier cascade, resolve-then-emit pipeline

**Documentation:** Standard Class A pattern: `README.md` + `docs/api.md` + `docs/configuration.md` + `ROBOTS.md`.

---

## Standalone Framework Modules

Framework-bound modules with no pure parent. These are Class I modules: they depend on a UI framework (received by injection) and hold their framework-free logic in-package because that logic has no second consumer. The decision test in [`client/client-modules.md`](./client/client-modules.md#pure-core-with-extensions-or-a-single-framework-module) determines when a module is Class I versus Class G plus H.

**Characteristics:**
- Depends on a framework (`react`, `react-dom`, `react-native`, or Expo) received through the `Lib` container
- No pure parent module above it, no extensions below it
- Platform inputs (event sources, storage handles) arrive by injection, keeping the module framework-tier rather than runtime-tier
- Entry point is `[name].js` (not `extension.js`, which is reserved for Class H)

**Examples:**
- `js-react-helper-idle` - Idle-state detection with `useIdle` hook
- `js-react-helper-timer` - Countdown and interval hooks
- `js-rnw-helper-device` - RN platform APIs (device info, screen metrics, accessibility) injected via `shared_libs`

**Documentation:** Standard factory pattern: `README.md` + `docs/api.md` + `docs/configuration.md` + `ROBOTS.md`. See [`module-classes.md`](./module-classes.md#class-i-framework-module) for the full Class I definition.

---

## Driver Wrapper Modules

Client-side Class C modules that wrap a third-party storage engine and present a unified API across backends. The engine is injected via `shared_libs`; the module is constructed per loader call (factory pattern). See [`module-classes.md`](./module-classes.md#class-c-driver-wrapper) for the full Class C definition.

**Characteristics:**
- Wraps a platform-native or browser storage engine (Web Storage, MMKV, SQLite)
- Engine arrives by injection (`shared_libs.WebStorage`, `shared_libs.MMKV`) or is resolved from the global environment
- Same-signature modules over different engines are swapped at the loader by platform, not by adapter
- Takes the lowest tier whose dependency budget it fits: `js-client-helper-*` for browser APIs, `js-rn-helper-*` for RN runtime modules

**Examples:**
- `js-client-helper-kv-localstorage` - Key-value store over browser Web Storage (localStorage/sessionStorage)
- `js-rn-helper-kv-mmkv` - Key-value store over `react-native-mmkv` (JSI, mmap-backed)

Both KV modules export the same 18-function API surface (9 sync + 9 async) so an application can swap between them at the loader level based on platform.

**Documentation:** Standard driver pattern: `README.md` + `docs/api.md` + `docs/configuration.md` + `ROBOTS.md`.

---

## Framework Extension Modules

Framework-specific bindings for universal parent modules. These are Class H modules.

> **Note:** Extension modules are **Class H** modules that extend **Class G** parent modules only. Class G (feature module with extensions) is specifically designed for framework integration. The extension pattern pairs Class G + H, just as Class E + F pair for adapters.

**The extension pattern:**

```
Parent module (pure JS) → Extension module (React hooks)
     ↑                        ↑
   no deps                 React 18+
   runs anywhere           React apps only
```

**Key principles:**

1. **Extension consumes parent.** The extension imports the parent module. The parent never knows about React.

2. **Extension is boss.** The extension decides:
   - When to call the parent
   - How to cache results
   - When to trigger React re-renders

3. **Parent stays pure.** The theme engine, crypto utilities, or other parent functionality remains framework-agnostic.

**Naming convention:** `[parent-name]-ext-[framework]`

**Examples:**
- `js-client-helper-styler-ext-react` - React hooks and ThemeProvider for Styler (retired alongside Styler)
- `js-client-helper-themer-ext-react` - React ThemeProvider, hooks, and transform seam for `js-client-helper-themer`
- `js-client-helper-font-ext-web` - Web `@font-face` injection for `js-client-helper-font`
- `js-client-helper-font-ext-rn` - Bare React Native font loading for `js-client-helper-font`
- `js-client-helper-font-ext-expo` - Expo Font (`expo-font`) adapter for `js-client-helper-font` (local only, not in CI)

**Entry point:** `extension.js` (not `index.js`)

This naming makes the module type discoverable by filename and keeps the convention consistent with store adapters (`store.js`) and HTTP adapters (`adapter.js`).

---

## Extension Module Structure

```
js-client-helper-[name]-ext-[framework]/
  extension.js              # Main entry point
  package.json              # Peer deps: parent module + framework
  README.md                 # ~70-90 lines, "Extension vs Parent" table
  ROBOTS.md                 # AI reference
  docs/
    api.md                  # Hooks/components reference
    philosophy.md           # Extension pattern explained
  _test/
    test.js                 # React test renderer tests
    loader.js               # Test loader
    package.json            # Test deps
```

---

## Peer Dependencies

Extension modules use peer dependencies, not direct dependencies:

```json
{
  "peerDependencies": {
    "react": "^18.0.0",
    "@superloomdev/js-client-helper-font": "^1.0.0"
  }
}
```

This lets the application control the React version and prevents duplicate parent module copies.

---

## Documentation Responsibilities

| Document | Parent module | Extension module |
|---|---|---|
| `README.md` | Full overview, mentions extension | Short README with "Extension vs Parent" table |
| `docs/api.md` | Parent functions (derive, assemble) | Hooks/components (useTheme, ThemeProvider) |
| `docs/configuration.md` | Config keys, templates | **Not present** - points to parent |
| `docs/philosophy.md` | Derivation concepts | Extension pattern explanation |
| `ROBOTS.md` | Parent function signatures | Hook signatures |

---

## Loader Pattern for Extensions

Extensions are loaded through the same loader pattern as other modules:

```js
// loader.js
const FontParent = require('helper-font')({
  // parent config
});

const FontExt = require('helper-font-ext-web')({
  React: require('react'),
  Parent: FontParent  // optional: pass pre-configured parent
});

module.exports = { FontParent, FontExt };
```

Or the extension can import the parent directly:

```js
// extension.js
const Parent = require('helper-font');

function createExtension({ React }) {
  // Use Parent internally
  return { useFont, FontProvider };
}
```

---

## Cross-Referencing

The extension's `docs/api.md` opens with a cross-link to the parent:

```markdown
# API Reference

This document covers the React hooks and components. For the parent font engine API, see the [parent module's docs/api.md](../js-client-helper-font/docs/api.md).
```

The parent's README mentions the extension:

```markdown
> **Want React integration?** Check out the extension module: `js-client-helper-font-ext-web`.
```

---

## Naming Taxonomy

The full naming taxonomy for client-tier modules (runtime prefixes, framework-tier prefixes, suffixes, placement rules, promotion rule) lives in [`client/client-modules.md`](./client/client-modules.md). That page is the single source of truth. This catalog names shipped modules as reference examples of each pattern; it is not a module registry.

---

## See Also

- [`client/client-modules.md`](./client/client-modules.md) - The naming taxonomy (single source of truth)
- [`client/`](./client/client-architecture.md) - The client documentation section
- [`module-classes.md`](./module-classes.md) - Class G (feature modules with extensions), Class H (extension modules), and Class I (standalone framework modules) definitions
- [`module-docs.md`](./module-docs.md) - README templates including extension modules
- [`module-docs-complex.md`](./module-docs-complex.md) - Parent vs extension documentation boundaries
