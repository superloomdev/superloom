# Client Architecture

> **Language:** JavaScript

The client architecture produces web, iOS, and Android from one JavaScript codebase through a single Metro pipeline. React Native Web maps the React Native component API to the DOM; Expo wraps the native build and dev workflow. Electron wraps the web build for desktop. This page records the stack decision, the bundler-agnostic rule, and the project layout that keeps app code portable.

## On This Page

- [Stack Decision Record](#stack-decision-record)
- [Why React Native Web](#why-react-native-web)
- [One Pipeline, Not Two](#one-pipeline-not-two)
- [Bundler-Agnostic Rule](#bundler-agnostic-rule)
- [Platform-File Convention](#platform-file-convention)
- [Project Layout](#project-layout)
- [Industry Validation](#industry-validation)
- [Further Reading](#further-reading)

---

## Stack Decision Record

The stack is frozen. These decisions were validated against Expo documentation and a working demo before adoption.

| Decision | Choice | Reason |
|---|---|---|
| UI component API | React Native Web | The only library that maps the RN component API to the DOM. Styling layers (Tamagui, NativeWind) sit on top of RNW; they do not replace it |
| Build pipeline | Metro (via Expo) | One bundler for all three targets. The reference app used webpack for web and RN-CLI for native, two pipelines to keep in sync |
| App framework | Expo | Collapses native dev into one workflow: dev client, OTA updates, prebuild for custom native modules |
| Navigation | Expo Router | Universal file-based router across web and native. Deep links and typed routes work on every platform |
| Desktop | Electron wrapping the web build | No app-code change. The web build is a single-page app, ideal for the Electron shell |
| State management | App-level wiring | Stores, providers, and query hooks live in the app, never in helper modules. The app shrinks until it is only wiring and screens |

---

## Why React Native Web

React Native Web is the only production-grade library that maps the React Native component API (`View`, `Text`, `StyleSheet`, layout primitives) to DOM elements. A component written against the RN API renders on web, iOS, and Android without branching.

Styling and layout abstractions (Tamagui, NativeWind, styled-components) layer on top of RNW. They consume the same RN primitives and produce the same DOM output. Adopting one does not replace RNW; it sits above it. This is why the stack locks RNW as the foundation and treats styling layers as optional.

---

## One Pipeline, Not Two

The reference application maintained two build pipelines: webpack for web output and React Native CLI (Metro) for native output. Every shared dependency, babel plugin, and asset pipeline had to be configured twice. Divergence between the pipelines caused bugs that appeared on one target but not the other.

Expo bundles web through Metro (`expo.web.bundler: "metro"` in `app.json`) after installing `react-native-web` and `react-dom`. The same bundler, the same module resolution, and the same babel preset serve all three targets. One pipeline means one configuration, one asset pipeline, and one set of build-time assumptions.

Prebuild and a custom dev client preserve access to native modules beyond the Expo SDK. Adopting Expo does not force giving up custom native code; it wraps the native build with a managed workflow.

---

## Bundler-Agnostic Rule

App code (screens, components, business logic) never references the bundler. The rule:

- No `__DEV__`-style bundler globals in app code
- No webpack-specific or Metro-specific loader syntax in imports
- No conditional imports keyed on the bundler name

The bundler is infrastructure. A future bundler swap touches configuration files only, never screens or components.

The one permitted platform-awareness area is style props. React Native style properties differ across platforms: `boxShadow` on web, `shadowColor`/`shadowOpacity`/`shadowRadius` on iOS, `elevation` on Android. Components resolve these through `Platform.select`, never through bundler globals.

```js
const cardShadow = Platform.select({
  web: { boxShadow: '0 2px 8px rgba(0,0,0,0.12)' },
  ios: { shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8 },
  android: { elevation: 4 }
});
```

This is a platform concern, not a bundler concern. The same code runs through Metro on every target; `Platform.select` resolves at runtime.

---

## Platform-File Convention

When a component or module needs different implementations per platform, use React Native's platform-file extensions, not bundler conditionals.

The convention groups platform files inside the component's own directory:

```text
component/
  card/
    index.js          ← shared logic + default export
    index.web.js      ← web-only overrides (boxShadow, cursor)
    index.native.js   ← native-only overrides (shadowColor, elevation)
```

The bundler resolves the correct file automatically. `index.js` is the fallback; `index.web.js` overrides on web; `index.native.js` overrides on iOS and Android. This keeps platform-specific code co-located with the component it belongs to, not scattered across a `platforms/` folder.

The `.native.js` extension covers both iOS and Android. For per-platform native code, `.ios.js` and `.android.js` are available. Use the coarsest split that works; prefer `.native.js` over separate iOS and Android files when the implementations are identical.

---

## Project Layout

The project layout separates routing from everything else. Two folders with distinct, non-overlapping responsibilities:

| Folder | Responsibility | Rule |
|---|---|---|
| `app/` | Expo Router's routing layer. Every file maps to a URL or screen | Contains layouts and screen wrappers only. No business logic, no UI |
| `src/` | Everything that is not a route. Business logic, shared config, DI container, theme engine, component library, SDK, context providers | Never imports from `app/` |

The Expo project root lives at `src/client/`. Expo Router requires `app/` relative to its project root (where `package.json` lives). Making `src/client/` the project root satisfies Expo Router while keeping all source under `src/`.

```text
src/
  client/                 ← Expo project root (package.json, app.json, babel.config.js)
    app/                  ← Expo Router routes (zero-logic wrappers)
    contexts/             ← React context objects and hooks
    themes/               ← Theme data (frozen JS objects)
    fonts/                ← Font manifest and assets
    loader.js             ← DI root: builds Lib + Config
    config.js             ← Static configuration
  components/             ← Component library (own package.json, peerDeps)
  screens/                ← Screen components (own package.json, peerDeps)
  sdk/                    ← Client SDK layer (own package.json)
```

Screens live in `src/screens/[app-name]/`. Each `app/[app-name]/[screen].js` file is a thin wrapper that re-exports the screen from `src/`. The wrapper is zero-logic: one line re-exporting the screen component. All params, hooks, and logic go inside the `src/screens/` component. This lets a screen be reused across two apps by pointing two wrappers at the same source.

---

## Industry Validation

Bluesky's `social-app` is the largest open-source React Native Web application in production. It validates the architectural choices on this page:

- **Single codebase, three targets.** The app ships to web, iOS, and Android from one React Native codebase through Metro
- **Platform-file convention.** The codebase groups platform files per component directory (`index.js`, `index.web.js`, `index.native.js`), the same convention documented above
- **Own design system.** Bluesky built ALF (Atmosphere Layout Framework) on top of RNW rather than adopting a third-party component library. This mirrors the Superloom approach: a custom component library built on RNW primitives, with design languages shipped as styler template packs

The reference is evidence that the stack scales to a production social application with millions of users.

---

## Further Reading

- [Client Loader](client-loader.md) - The `Lib` DI container, boot chain, and React boundary rule
- [Theming](theming.md) - The styler pipeline, template packs, and server-driven theming
- [Super-App Shapes](super-app.md) - Lean vs super assembly, shape registry, tree-shaking
- [Client Modules](client-modules.md) - The naming taxonomy for client-tier helper modules
