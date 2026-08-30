# Theming

> **Language:** JavaScript

The theming system takes a template and a stack of layered values, derives a complete theme through a three-tier cascade, and emits platform-ready tokens. The pipeline is pure JavaScript: no CSS variables, no build-time magic, no framework dependency. React bindings arrive through an extension module with a transform seam that keeps app-specific logic in the app. This page documents the architecture, the module and extension split, runtime re-theming, and server-driven theming.

## On This Page

- [Architecture: Three Tiers](#architecture-three-tiers)
- [The Cascade: Layers, Not Modes](#the-cascade-layers-not-modes)
- [Scheme Versus Variant](#scheme-versus-variant)
- [Resolve Then Emit](#resolve-then-emit)
- [The Template](#the-template)
- [Module, Extension, App](#module-extension-app)
- [Runtime Re-Theming](#runtime-re-theming)
- [Server-Driven Theming](#server-driven-theming)
- [Theme Projection for RNW](#theme-projection-for-rnw)
- [Further Reading](#further-reading)

---

## Architecture: Three Tiers

The theming system is split into three tiers, each with a distinct responsibility:

| Tier | Module | Class | Responsibility |
|---|---|---|---|
| **Engine** | `js-client-helper-themer` | G | Pure JavaScript token engine. Takes a template and layered values, resolves canonical values, emits platform-specific tokens. No framework dependency, no React, no state |
| **Extension** | `js-client-helper-themer-ext-react` | H | React bindings for the engine. Provides `ThemeProvider`, `useTheme`, `useTokens`, `useThemeController`, and `ThemeContext`. Holds layers in React state, derives through the engine on change, exposes the result via context. Factory pattern: each loader call returns an independent instance |
| **App** | Host code | n/a | App-specific logic inside the extension's transform seam: token vocabulary bridging, font validation, component building. The app owns everything the engine and extension do not |

The engine never imports a framework. The extension never imports the engine directly; it receives a built instance through dependency injection. The app never calls the engine directly; it passes through the extension's transform seam.

---

## The Cascade: Layers, Not Modes

The engine resolves a theme from a stack of layers, not from a base-and-variant pair. Each layer is a sparse object with a name, a polarity (`light` or `dark`), a set of token overrides, and optional scale overrides.

```text
Layer 0 (base)     - complete fallback, every seed present
Layer 1 (variant)  - partial override, only what differs
Layer 2 (accent)   - partial override, only the accent color
  |
  v  buildTheme(template, [layer0, layer1, layer2], platform)
{ color, dimension, font, ... }  (flat emitted token map)
```

Layers merge in order: later layers win on conflict. This replaces the older base-plus-variant merge with a general cascade that handles any number of overlays. A dark mode is a layer, a tenant brand is a layer, an accent swap is a layer.

The engine caches derived results by reference identity of the layers array. Passing a fresh array with equal content is a cache hit. The extension holds layers in `useState` and calls `update_layers` with a new array to trigger a re-derive.

---

## Scheme Versus Variant

A **scheme** is a complete token set that replaces the base outright. A **variant** is a partial overlay merged on top of an existing scheme. The two have different runtime operations: replace versus overlay.

The controller exposes both operations. Switching schemes replaces the entire layer stack with a new base, so every token derives from the new scheme's seeds. Applying a variant adds a layer on top of the current stack, so only the tokens the variant declares change; everything else retains the value the current scheme produced.

The distinction matters because the two operations express different intents. A partial overlay cannot express "use a different design language", because the tokens it does not name are inherited from the base. Those inherited tokens may belong to a different visual system. A complete set applied as an overlay silently inherits whatever the base held, which is correct only when the base and the new set share the same design language.

The rule: when the intent is a different visual system, switch schemes. When the intent is a small adjustment to the current system, apply a variant.

---

## Resolve Then Emit

The engine splits the work into two stages:

1. **Resolve** produces canonical, unit-free values. A spacing token is the number `16`, not `'1rem'` and not `16`-with-an-implied-unit. Color ramps are computed, contrast pairs are selected, type sets are resolved to objects with absolute line heights.

2. **Emit** projects those values onto one platform. Web wants `'1rem'` and a `box-shadow` string; React Native wants `16` and a style object.

One derivation, two projections. There is no second theme to keep in step, and the difference between the platforms lives in one table rather than scattered through the token values.

---

## The Template

A template is a data object that declares which tokens exist and how each is derived. The engine reads the template through its parts system. The template is the only opinionated layer; the engine is generic.

```js
export default {
  color:   { ramps: { ... }, palettes: { ... } },
  scales:  { geometric: { ... }, miniUnit: { ... } },
  meta:    { type_sets: { ... }, shadows: { ... } },
  emit:    { web: { ... }, native: { ... } }
};
```

The full authoring reference, including every token type (literal, rule, alias, generator, type set, shadow), every scale type, and every validation rule, lives in the themer module's own documentation. This page cross-references it rather than duplicating the schema.

---

## Module, Extension, App

The extension module owns the generic React plumbing. The app owns everything that is specific to its vocabulary, fonts, or component library. The seam between them is the `transform` prop on `ThemeProvider`.

| | Engine | Extension | App |
|---|---|---|---|
| What it is | Pure JS token engine | React bindings | Host code |
| Knows about | Templates, layers, tokens | React context, hooks, state | Token bridging, fonts, components |
| Does not know about | React, any vocabulary | Any specific vocabulary, fonts, components | The engine internals |
| Exports | `buildTheme`, `cacheStats`, `clearCache` | `ThemeProvider`, `useTheme`, `useTokens`, `useThemeController`, `ThemeContext` | App-shaped hooks and provider |

The `transform` function runs inside the extension's `useMemo`, so it recomputes only when inputs change. It receives the engine's built result and the current layers, and returns an object whose fields are merged into the context value. This is where the app bridges the engine's flat token map to its own vocabulary (`{ Color, Dimension, Font }`), validates font families against the font core registry, and builds the themed component library.

The extension's `useThemeController()` returns the full context value, including everything the transform added. The app wraps this with its own hook that shapes the API for consumers.

---

## Runtime Re-Theming

The extension's `ThemeProvider` holds the layer stack in React state. Calling `update_layers` with a new array triggers a re-derive through the engine and a re-render of the entire subtree. The app's `useThemeController()` wraps this with an `updateTheme(nextVariant)` function that converts the variant to layers and calls `update_layers` under the hood.

Each app shape mounts its own `ThemeProvider` with its own base and variant layers. Switching shapes re-themes the entire subtree. This is the mechanism for per-tenant branding, dark mode, and live accent changes.

---

## Server-Driven Theming

A layer is pure JSON. It can be stored in a database, sent over HTTP, or pushed from a server at runtime. The server delivers a layer object that the client adds to its layer stack before calling `buildTheme`.

The contract is one-directional: the server sends data (color seeds, dimension seeds, font family names). The client owns the template (derivation rules) and the engine (math). The server never sends derivation rules or code.

This separation is what makes the system portable. A server can push a layer with one accent color override to a client running any template, and the client derives the full set of tokens, contrast pairs, and platform-specific projections locally.

---

## Theme Projection for RNW

A React Native Web component library always consumes the **`native`** projection, on every platform including web. RNW is itself the web projection: it accepts unit-free numbers and emits CSS. Requesting the themer's `web` projection and then rendering through RNW applies two projections and yields unit strings that React Native cannot consume on iOS or Android.

The correct call is always `buildTheme(template, layers, 'native')` from an RNW consumer, regardless of whether the app is running in a browser. The themer's `web` projection exists for raw-DOM consumers that write CSS directly.

---

## Further Reading

- [Fonts](fonts.md) - The font contract: theme names families, host loads files
- [Components](components.md) - How components consume theme tokens
- [Client Loader](client-loader.md) - How the themer and extension enter the `Lib` container
- Themer module `README.md` - Installation and quick start
- Themer module `docs/api.md` - Full API reference
- Themer module `docs/template.md` - Template authoring reference
- Themer module `docs/schemas.md` - Layer and template schema validation
- Themer module `docs/philosophy.md` - Design philosophy
- Themer extension `README.md` - Extension quick start and transform seam
- Themer extension `docs/api.md` - ThemeProvider, hooks, context reference
- Themer extension `docs/philosophy.md` - Extension pattern rationale
