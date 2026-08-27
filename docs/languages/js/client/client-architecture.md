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

React Native Web is a library, not a framework or a bundler. The layers are distinct:

| Layer | What it is | Examples |
|---|---|---|
| Component API | The interface app code is written against | React Native (`View`, `Text`, `StyleSheet`) |
| Web adapter | Maps that API onto the DOM via React DOM | React Native Web |
| Bundler | Produces the deliverable bundle | Metro, Vite, Rspack, webpack |
| App framework | Wraps bundler, native build, and dev workflow | Expo |

Both web paths, Expo's web output and the portability harness, use React Native Web. They differ only in bundler and tooling. React Native Web was started in 2015 by Nicolas Gallagher during the development of Twitter's Progressive Web App, and is used in production by companies including Meta, Twitter, and Flipkart ([source](https://necolas.github.io/react-native-web/docs/about-project/)).

Plain React web (React DOM with `div` and `span`) is a genuinely different component API and is out of scope for this project. React Native Web already produces web, so a plain React web target would add an incompatible component API with zero reuse.

---

## One Pipeline, Not Two

The reference application maintained two build pipelines: webpack for web output and React Native CLI (Metro) for native output. Every shared dependency, babel plugin, and asset pipeline had to be configured twice. Divergence between the pipelines caused bugs that appeared on one target but not the other.

Expo bundles web through Metro (`expo.web.bundler: "metro"` in `app.json`) after installing `react-native-web` and `react-dom`. The same bundler, the same module resolution, and the same babel preset serve all three targets. One pipeline means one configuration, one asset pipeline, and one set of build-time assumptions.

Prebuild and a custom dev client preserve access to native modules beyond the Expo SDK. Adopting Expo does not force giving up custom native code; it wraps the native build with a managed workflow.

### Portability Harness Exception

The one-pipeline rule binds **shipping pipelines**. One application ships its web, iOS, and Android artifacts through Metro. This does not change.

A second bundler is permitted only for a **portability harness**: a host that exists to prove shared source carries no app-framework coupling, and whose output is not the shipped artifact. The harness host must consume the same shared source as the primary host. A harness with its own copy of screens or components proves nothing and is forbidden. The harness is web-only. Native targets are covered by prebuild, which needs no second bundler.

The original pain was two pipelines producing the *same* deliverable and silently diverging. A harness produces a *different* deliverable, a pass or fail signal, and its divergence from the shipping pipeline is the very thing being measured.

React Native Web's own documentation states: "If you are interested in making a multi-platform app it is strongly recommended that you use Expo... Expo includes web support and takes care of all the configuration work required" ([source](https://necolas.github.io/react-native-web/docs/multi-platform/)). The harness host exists to prove portability, not because it is a better way to ship web. Without this distinction, a reader could conclude the second host is the recommended production path, which it is not.

### Portability Fence

The harness enforces two rules on shared source:

1. Shared source imports no `expo*` package
2. Shared source never imports upward from a host directory

Both are also checked statically, so a leak fails fast even before a bundle is attempted.

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

The project layout separates shared application source from host-specific configuration. Two directories with distinct, non-overlapping responsibilities:

```text
src/                    ← shared application source, consumed by every host
  components/           ← component library written against the React Native API
  screens/              ← screen components
  app-core/             ← dependency-injection root, config, context providers
  themes/               ← theme data
  fonts/                ← font manifest and assets
hosts/
  expo/                 ← Metro and Expo Router, ships web, iOS, and Android
  web/                  ← portability harness, web only
```

Two binding rules govern the layout:

- **Hosts own what must differ:** bundler configuration, routing, entry file, and platform adapter injection
- **`src/` never imports from `hosts/`.** The dependency direction is one way. A host imports shared source; shared source never reaches upward

Hosts map a path alias to `src/` in their own bundler configuration. Shared source is plain source with no `package.json`, is never published, and is not an npm workspace. The alias forms:

```js
// Metro (hosts/expo): resolver.extraNodeModules
resolver: { extraNodeModules: { '@app': path.resolve(import.meta.dirname, '../../src') } }

// Vite (hosts/web): resolve.alias
resolve: { alias: { '@app': path.resolve(import.meta.dirname, '../../src') } }
```

Screens live in `src/screens/`. Each host's router maps a route to a screen from `src/`. The route file is a thin wrapper: one line re-exporting the screen component. All params, hooks, and logic go inside the `src/screens/` component. This lets a screen be reused across two hosts by pointing both routers at the same source.

---

## Industry Validation

Bluesky's `social-app` is the largest open-source React Native Web application in production. It validates the architectural choices on this page:

- **Single codebase, three targets.** The app ships to web, iOS, and Android from one React Native codebase through Metro
- **Platform-file convention.** The codebase groups platform files per component directory (`index.js`, `index.web.js`, `index.native.js`), the same convention documented above
- **Own design system.** Bluesky built ALF (Atmosphere Layout Framework) on top of RNW rather than adopting a third-party component library. This mirrors the Superloom approach: a custom component library built on RNW primitives, with design languages shipped as themer template packs

The reference is evidence that the stack scales to a production social application with millions of users.

---

## Further Reading

- [React Native Environment Setup](rn-environment-setup.md) - System prerequisites, local development, Metro bundler
- [Expo Guide](expo-guide.md) - Expo capabilities, adapter pattern, cloud account features
- [React Native Testing](rn-testing.md) - Testing conventions for RN and Expo modules
- [Client Loader](client-loader.md) - The `Lib` DI container, boot chain, and React boundary rule
- [Theming](theming.md) - The themer, template packs, and server-driven theming
- [Super-App Shapes](super-app.md) - Lean vs super assembly, shape registry, tree-shaking
- [Client Modules](client-modules.md) - The naming taxonomy for client-tier helper modules
