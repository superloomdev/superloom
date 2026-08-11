# Client Loader

> **Language:** JavaScript

The `loader.js` at `src/client/loader.js` is the bootstrap and dependency-injection root of the client. It builds the `Lib` container, wires helper modules, and provides the single point where cross-cutting dependencies enter the React tree. The pattern mirrors the server loader: every framework module is a factory, `Lib` is memoized, and nothing outside the loader reads environment configuration.

## On This Page

- [What the Loader Builds](#what-the-loader-builds)
- [The Lib Container](#the-lib-container)
- [React Boundary Rule](#react-boundary-rule)
- [Folder Conventions](#folder-conventions)
- [Boot Chain](#boot-chain)
- [Further Reading](#further-reading)

---

## What the Loader Builds

The loader runs once. It performs three tasks in order:

1. **Load static config** from `config.js` and merge environment overrides
2. **Build `Lib`** - attach helper modules, theme engine, font manifest, SDK, and React itself
3. **Return `Lib` and `Config`** to the React tree via a context provider

After the loader returns, the rest of the client treats `Lib` as a read-only registry. No other file instantiates helper modules or reads configuration directly.

---

## The Lib Container

The `Lib` container holds every dependency the React tree needs. Each entry is either a helper module loaded via its factory or a plain data object.

| `Lib` key | What it holds | How it enters |
|---|---|---|
| `Lib.React` | The React module | `require('react')` in the loader only |
| `Lib.Utils` | Core utility helper | `require('@superloomdev/js-helper-utils')(Lib)` |
| `Lib.Debug` | Debug logging helper | `require('@superloomdev/js-helper-debug')(Lib)` |
| `Lib.Themer` | Theme engine (assemble, derive, generateUtilities) | `require('@superloomdev/js-client-helper-themer')(Lib)` |
| `Lib.ThemeTemplate` | Default themer template (data) | `require('@superloomdev/js-client-helper-themer/themer.template.js')` |
| `Lib.Themes` | Theme values as frozen JS objects | Direct `require` of theme data files |
| `Lib.Fonts` | Font manifest and `useFontsReady` hook | `require('../fonts/fonts')(Lib)` |
| `Lib.Sdk` | Client SDK (entity APIs) | `require('../../sdk')(Lib)` |

Every framework module follows the loader pattern: `module.exports = function (shared_libs, config) { ... }`. The loader calls each factory with `Lib`, and the factory returns its public interface. This is identical to how server-side helper modules work.

Themes are plain frozen data objects, not loaders. They are `require`d directly in the loader and attached to `Lib.Themes`. A theme is a JSON-shaped value object (`base` + optional `variant`); it has no behavior and no dependencies.

---

## React Boundary Rule

Dependency injection applies at the package boundary, not inside the app's own React files. The rule:

- **Helper modules and framework packages** receive dependencies through `Lib`. They never call `require('react')` directly. The loader injects `Lib.React` into the themer adapter, for example
- **The app's own React files** (screens, layouts, context providers) keep idiomatic `require('react')` or `import` statements. JSX and hooks are import-time bindings; injecting React into every component adds ceremony without benefit

The boundary is the package edge. Inside the app, React is a peer dependency resolved normally. Outside the app (in published helper modules and the component library), React enters through `Lib`.

This keeps helper modules testable in isolation (inject a mock `Lib.React`) while keeping app code ergonomic.

---

## Folder Conventions

Two folders organize React context and theme data inside `src/client/`:

| Folder | Holds | Convention |
|---|---|---|
| `contexts/` | React context objects and hook definitions | `LibContext` (provides `Lib`), `ThemeContext` (provides theme + controller) |
| `providers/` | Provider components, if they grow complex enough to separate from the context file | Reserved. Simple providers stay in `contexts/` |

Both folders use plural names, matching React community convention. A generic `context/` folder is avoided because it could be confused with non-React context code.

Theme data files live in `themes/` as frozen JS objects. The loader is the single source of truth for which themes are wired:

```js
Lib.Themes = {
  base:  require('../themes/base-theme'),
  tasks: require('../themes/tasks-theme'),
  notes: require('../themes/notes-theme')
};
```

Font manifest lives in `fonts/` as a loader module receiving `Lib.FontLoader` (the injected font loader adapter). The separation of theme data (names font families) from font manifest (loads font files) is deliberate: `require('font.ttf')` is bundler-bound, and a server-sent theme JSON cannot carry binaries. See [Fonts](fonts.md).

---

## Boot Chain

The entry chain from `package.json` to first render:

```text
package.json "main": "expo-router/entry"
  |
  v  Expo Router scans app/ for routes
src/client/app/_layout.js          ← first app code to run (root layout)
  |
  v  mounts LibProvider
src/client/contexts/lib-context.js ← provides Lib via React context
  |
  v  calls loader() (memoized singleton)
src/client/loader.js               ← builds Lib + Config
  |
  v  mounts ThemeProvider
src/client/contexts/theme-context.js ← calls Lib.Themer.assemble(), provides theme
  |
  v  calls combineComponent()
src/components/index.js            ← builds themed component library
  |
  v
src/client/app/index.js            ← re-exports screen from src/screens/
```

`_layout.js` is the boot file. The loader is the DI root. Everything else is wired through `Lib`. The chain is linear: each step depends only on what precedes it.

The loader is memoized. Calling `loader()` a second time returns the same `Lib` instance. This lets context providers and test harnesses call `loader()` without rebuilding the container.

---

## Further Reading

- [Client Architecture](client-architecture.md) - Stack decision, project layout, bundler-agnostic rule
- [Theming](theming.md) - The themer and runtime re-theming
- [Fonts](fonts.md) - Font delivery mechanisms and the theme-names/host-loads contract
- [Server Loader](../server/server-loader.md) - The server-side counterpart (same pattern, different dependencies)
