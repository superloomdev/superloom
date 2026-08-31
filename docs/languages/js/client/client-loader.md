# Client Loader

> **Language:** JavaScript

The `loader.js` at `src/app-core/loader.js` is the bootstrap and dependency-injection root of the client. It builds the `Lib` container, wires helper modules, and provides the single point where cross-cutting dependencies enter the React tree. The pattern mirrors the server loader: every framework module is a factory, `Lib` is built fresh on each call, and nothing outside the loader reads environment configuration.

## On This Page

- [What the Loader Builds](#what-the-loader-builds)
- [The Lib Container](#the-lib-container)
- [Adapters](#adapters)
- [React Boundary Rule](#react-boundary-rule)
- [Folder Conventions](#folder-conventions)
- [Boot Chain](#boot-chain)
- [Further Reading](#further-reading)

---
## What the Loader Builds

The loader is a pure build function. It performs three tasks in order:

1. **Validate the adapter set** - the gate checks that every host-supplied slot is present and is a function, before anything is built
2. **Build `Lib`** - attach helper modules, theme engine, font manifest, SDK, React itself, and host adapters
3. **Return `Lib` and `Config`** to the React tree via a context provider

After the loader returns, the rest of the client treats `Lib` as a read-only registry. No other file instantiates helper modules or reads configuration directly.

The loader is not memoized. The React context provider holds the only cache, memoizing on the adapter set reference. This lets a test build a second independent container by calling the loader with a different adapter set. A memoized composition root would prevent that.

---

## The Lib Container

The `Lib` container holds every dependency the React tree needs. Each entry is either a helper module loaded via its factory or a plain data object.

| `Lib` key | What it holds | How it enters |
|---|---|---|
| `Lib.React` | The React module | `import React from 'react'` in the loader only |
| `Lib.Utils` | Core utility helper | `import utils from '@superloomdev/js-helper-utils'`; `utils(Lib)` |
| `Lib.Debug` | Debug logging helper | `import debug from '@superloomdev/js-helper-debug'`; `debug(Lib)` |
| `Lib.Themer` | Theme engine (buildTheme, resolve, emit, cacheStats, clearCache) | `import themer from '@superloomdev/js-client-helper-themer'`; `themer(Lib)` |
| `Lib.ThemerReact` | React extension for themer (ThemeProvider, hooks) | `import themerReact from '@superloomdev/js-client-helper-themer-ext-react'`; `themerReact({ React, Themer, Utils, Debug })` |
| `Lib.ThemeTemplate` | Default themer template (data) | `import themerTemplate from '../themes/themer-template.js'` |
| `Lib.Schemes` | Scheme values as frozen JS objects | Direct `import` of scheme data files |
| `Lib.Font` | Font core (family registry, role resolution) | `import font from '@superloomdev/js-client-helper-font'`; `font(Lib)` |
| `Lib.Fonts` | Font manifest and `useFontsReady` hook | `import fonts from '../fonts/fonts.js'`; `fonts(Lib)` |
| `Lib.FontAdapter` | Platform font loader adapter | Supplied by a host adapter |
| `Lib.FontManifest` | Host-owned font asset sources | Supplied by a host adapter |
| `Lib.Navigation` | Navigation surface (Link, Redirect) | Supplied by a host adapter |
| `Lib.Icons` | Icon glyph component | Supplied by a host adapter |
| `Lib.ThemeContext` | React theming hub (ThemeProvider + hooks) | `import themeContext from './contexts/theme-context.js'`; `themeContext(Lib)` |
| `Lib.Client` | Client utilities (os, device info) | `import client from './client.js'`; `client(Lib, Config)` |
| `Lib.SuperApp` | Super-app launcher utilities | `import superApp from './superApp.js'`; `superApp(Lib, Config)` |
| `Lib.Sdk` | Client SDK (entity APIs) | `import sdk from '../../sdk.js'`; `sdk(Lib)` or stub |
| `Lib.Config` | Application configuration object | Direct assignment in the loader |

Every framework module follows the loader pattern: `export default function (shared_libs, config) { ... }`. The loader calls each factory with `Lib`, and the factory returns its public interface. This is identical to how server-side helper modules work.

Schemes are plain frozen data objects, not loaders. They are imported directly in the loader and attached to `Lib.Schemes`. A scheme is a complete token set (see [Scheme Versus Variant](theming.md#scheme-versus-variant)); it has no behavior and no dependencies. The loader also holds the themer machinery (`assemble.js`, `themer-bridge.js`, `themer-template.js`) under `src/themes/`. This is distinct from `src/schemes/` (scheme data); the two directories are not a half-finished rename.

---

## Adapters

Three slots are supplied by host adapters, not by published packages:

| Slot | Port defines | Adapter returns |
|---|---|---|
| `Navigation` | `Link`, `Redirect` | `{ Link, Redirect }` |
| `Icons` | `Glyph` | `{ Glyph }` |
| `Fonts` | `adapter`, `manifest` | `{ adapter, manifest }` |

Each build target has its own adapter directory. The Expo host supplies adapters under `hosts/expo/adapters/`; the web host supplies adapters under `hosts/web/adapters/`. The loader calls each adapter factory with `Lib` and assigns the return value to the container slot.

The adapter set is validated at boot before the container is built. A missing slot throws a `TypeError` naming every missing adapter. See [Composition and Adapters](../composition-and-adapters.md) for the full adapter doctrine, including the standard signature, the gate, and the test-tier pattern.

---

## React Boundary Rule

Dependency injection applies at the package boundary, not inside the app's own React files. The rule:

- **Helper modules and framework packages** receive dependencies through `Lib`. They never import React directly. The loader injects `Lib.React` into the themer adapter, for example
- **The app's own React files** (screens, layouts, context providers) keep idiomatic `import` statements. JSX and hooks are import-time bindings; injecting React into every component adds ceremony without benefit

The boundary is the package edge. Inside the app, React is a peer dependency resolved normally. Outside the app (in published helper modules and the component library), React enters through `Lib`.

This keeps helper modules testable in isolation (inject a mock `Lib.React`) while keeping app code ergonomic.

---

## Folder Conventions

Two folders organize React context and theme data inside `src/app-core/`:

| Folder | Holds | Convention |
|---|---|---|
| `contexts/` | React context objects and hook definitions | `LibContext` (provides `Lib`), `ThemeContext` (provides theme + controller) |
| `providers/` | Provider components, if they grow complex enough to separate from the context file | Reserved. Simple providers stay in `contexts/` |

Both folders use plural names, matching React community convention. A generic `context/` folder is avoided because it could be confused with non-React context code.

Scheme data files live in `src/schemes/` as frozen JS objects. The loader is the single source of truth for which schemes are wired:

```js
import neutralScheme from '../schemes/neutral-scheme.js';
import tasksScheme from '../schemes/tasks-scheme.js';
import notesScheme from '../schemes/notes-scheme.js';

Lib.Schemes = {
  neutral:  neutralScheme,
  tasks:    tasksScheme,
  notes:    notesScheme
};
```

Font manifest lives in `src/fonts/` as a loader module receiving `Lib`. The separation of theme data (names font families) from font manifest (loads font files) is deliberate: bundler asset imports for `.ttf` files are bundler-bound, and a server-sent theme JSON cannot carry binaries. See [Fonts](fonts.md).

---

## Boot Chain

The entry chain from the host's entry file to first render:

```text
hosts/expo/app/_layout.js            ← host entry file, imports host adapters
  |
  v  declares adapter set at module scope, mounts LibProvider
src/app-core/contexts/lib-context.js ← provides Lib via React context (memoized on adapters)
  |
  v  calls loader(adapters) - pure build function, no cache
src/app-core/loader.js               ← validates adapters, builds Lib + Config
  |
  v  mounts ThemeProvider
src/app-core/contexts/theme-context.js ← calls Lib.Themer, provides theme + controller
  |
  v  calls assemble()
src/themes/assemble.js               ← builds themed component library (themer machinery)
  |
  v
src/components/index.js              ← re-exports screen from src/screens/
```

`_layout.js` is the boot file. The loader is the DI root. Everything else is wired through `Lib`. The chain is linear: each step depends only on what precedes it.

Every path in the diagram resolves on disk. The host entry file lives under `hosts/[target]/app/`; the shared source lives under `src/app-core/`.

---

## Further Reading

- [Client Architecture](client-architecture.md) - Stack decision, project layout, bundler-agnostic rule
- [Composition and Adapters](../composition-and-adapters.md) - The four tiers, host adapters, the adapter gate, the test-tier pattern
- [Theming](theming.md) - The themer and runtime re-theming
- [Fonts](fonts.md) - Font delivery mechanisms and the theme-names/host-loads contract
- [Server Loader](../server/server-loader.md) - The server-side counterpart (same pattern, different dependencies)
