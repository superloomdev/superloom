# Theming

> **Language:** JavaScript

The theming system takes a template and a stack of layered values, derives a complete theme through the token contract, and emits platform-ready tokens. The pipeline is pure JavaScript: no CSS variables, no build-time magic, no framework dependency. React bindings arrive through an extension module with a transform seam that keeps app-specific logic in the app. This page documents the architecture, the module and extension split, runtime re-theming, and server-driven theming.

## On This Page

- [The token contract](#the-token-contract)
- [Two tiers](#two-tiers)
- [Themes, templates, layers, profiles](#themes-templates-layers-profiles)
- [Component systems consume the contract](#component-systems-consume-the-contract)
- [Units and platforms](#units-and-platforms)
- [Font role tokens](#font-role-tokens)
- [Themes from a server](#themes-from-a-server)
- [The base template and the subset rule](#the-base-template-and-the-subset-rule)
  - [Generated artifact provenance](#generated-artifact-provenance)
- [Motion](#motion)
- [What is not a token, and why](#what-is-not-a-token-and-why)
- [The Cascade: Layers, Not Modes](#the-cascade-layers-not-modes)
- [Resolve Then Emit](#resolve-then-emit)
- [Module, Extension, App](#module-extension-app)
- [Runtime Re-Theming](#runtime-re-theming)
- [Emission Options](#emission-options)
- [Contextual UI Layers](#contextual-ui-layers)
- [Further Reading](#further-reading)

---
## The token contract

A theme in Superloom is a set of named values. The names come from one place: the **token contract**, published by the Themer package and read through `Themer.getContract()`. The contract lists every token Superloom knows, its group, its tier, and its value type. It contains no values.

Nothing else defines a token name. A component system imports the contract and declares which tokens it requires. A theme supplies values for contract tokens. A server that sends a theme sends values for contract tokens. Because the names are fixed above every component system, the same theme works with any Superloom component system, and a new component system needs no new names.

The contract's vocabulary is derived from the IBM Carbon Design System v11 token set, converted to snake_case, with Carbon's web-only concepts removed and two additions: font role tokens and structure knobs. Superloom invents no token name. When a design system needs a token the contract lacks, the contract is extended through a governed change and its version increments; a component-library-local name is a violation.

---

## Two tiers

| Tier | What | Examples | If missing from a theme |
|---|---|---|---|
| value | colors, spacing, sizes, type sets, font roles | `color.interactive`, `spacing.spacing_05`, `type.body01`, `font.family.sans` | an error at component system build time when the library requires it |
| structure | things design systems normally hardcode: corner radius, border width, focus ring, motion, press feedback, shadow recipes, breakpoints | `shape.radius_04`, `border.width_01`, `focus.width`, `motion.duration_fast_01`, `feedback.press`, `shadow.level_01`, `breakpoint.md` | falls back to the base template's value |

A reference theme sets structure knobs to its design system's canonical values (Carbon: radius 0, highlight press feedback). A brand layer may override any knob. "Carbon anatomy with soft corners" is one structure token in a layer, and it is not pure Carbon, which is allowed and explicit.

Geometry that cannot be a number (a trapezoid call to action, a cloud-shaped field) is not a token. It is a different component system.

Geometry tokens (sizes, spacing, radius, border widths) are supplied by the template. Switching the template changes geometry with no component edit: a component reads `size.size_medium` and the template decides whether that is 40 (Carbon) or another value. A geometry oracle is per-design-system and never a cross-system authority: the Carbon oracle validates Carbon defaults, the Material oracle validates Material defaults, and a custom template needs no oracle - contract validity (the token exists and resolves) is the only check.

---

## Themes, templates, layers, profiles

- A **theme** is a file of values for the contract: `{ polarity, scales, tokens, meta }`. Values are canonical and unit-free (see Units and platforms).
- A **template** is a complete theme used as the base of a derivation. Every reference theme is a template.
- A **layer** is a sparse theme: only the tokens that differ. A brand is a layer. A dark mode is a layer or a different template.
- A **profile** is a named, versioned set of reference templates with identity: `{ id, contract_version, reference, schemes }`. `js-client-helper-themer-template-carbon` is a profile with four schemes; `js-client-helper-themer-template-material` is a profile with Material's schemes.
- The **base template** is Superloom's own complete, neutral theme, shipped as `js-client-helper-themer-template-base`. Every contract key has a value in it, derived through the engine's rules and generators wherever possible. A reference theme package completes each scheme from it at generation time and lists the keys it took in `from_base`, so every published scheme is complete and the source of every value is visible.

The engine derives with `buildTheme(template, layers, 'native')`. A token absent from every layer takes the template's value; that is the only runtime fallback. Completion from the base template happens in data, before publication, never inside a component.

Replacing the template changes the visual system. Adding a layer adjusts it. An application exposes both operations and never rebuilds the template when a layer changes.

---

## Component systems consume the contract

A component system is a library whose components read tokens through generated style utilities and nothing else. It never contains a color literal, never reads a token by a name outside the contract, and never falls back from one token to another.

At build time the system calls `Themer.validateContract(built, { required, supported })`:

- a required token missing from the theme is a `TypeError` naming every missing token in one message; the system refuses to build;
- a token present in the theme but not supported by this system is a warning listing every such token; the build continues.

Both lists are data the library exports, so a theme can be checked against a component system without rendering. Under strict mode (`STRICT_TOKENS`) an unknown utility name throws at render, which makes a headless roster walk a proof that every component's every token exists.

A component system fixes anatomy and behavior: which parts a component has, how they nest, how they respond to input and to assistive technology, and how surfaces nest. Everything else is a token.

---

## Units and platforms

Resolve produces canonical, unit-free values: numbers are pixels at `scales.base_font_size`, milliseconds for durations, and plain integers for weights; colors are lowercase hex or `rgba()` strings; curves are one of three data shapes (a bezier as four numbers, a spring as stiffness, damping, and mass, or segments as an ordered list of beziers with split points); a viewport-relative length is `{ viewport: true, vw }`. Emit projects them per platform: web writes `rem`, `vw`, and `cubic-bezier()`; native writes numbers and objects, and the component system turns `vw` into pixels from the window width. A React Native Web component system always requests the `native` projection, on every platform including the browser; React Native Web turns numbers into CSS itself.

A theme therefore never contains a unit string. `'0.875rem'`, `'2vw'`, `'70ms'`, and a CSS font stack are all invalid values; `validateContract` reports them as `CONTRACT_INVALID_VALUE`, and repositories gate them in CI. No token has two hand-authored values for two platforms; every platform difference is a projection the engine or the component system performs from one canonical value.

Shadows are lists of layers, each `{ x, y, blur, spread, color, inset? }`. Both platforms receive the whole list: web as a CSS `box-shadow` value, native as React Native's `boxShadow` style prop (New Architecture, React Native 0.76 or later). Nothing is dropped and nothing is approximated.

---

## Font role tokens

A type set names a font **role** (`sans`, `serif`, `mono`), not a family. `font.family.<role>` maps the role to a family name the host has registered with the font module. The engine passes the role through untranslated; the component system resolves role to family through `font.family.*`; the font module resolves family to the platform's registered name. A theme sent as JSON can therefore switch a brand's typeface by changing one string.

---

## Themes from a server

A theme or a layer is plain JSON in the contract vocabulary. A server stores it, validates it with the same `validateContract` (the Themer package has no React or DOM dependency), and sends it. The client adds it to its layer stack. The server never sends derivation rules, code, or font files; it sends values for names both sides already agree on.

---

## The base template and the subset rule

Superloom is its own token system. Its vocabulary was seeded from Carbon's names and is extended with generic keys of its own. A design system is a **subset**: a reference theme defines the keys its design system has a concept for and nothing else.

Completeness comes from the base template. `js-client-helper-themer-template-base` is one neutral theme in which every contract key has a value: colors are `rampStep` rules over a neutral gray ramp, type sets come from `stepPairIncrement`, spacing from `miniUnit`, and every structure knob has an identity default (radius named by its value, state-layer opacities 0, tint 0, one shadow level). A reference theme package's generator completes each scheme from the base and records the keys it took in `from_base`. Two assertions prove a reference theme complete: every value its design system defines is reproduced exactly at the Superloom key (the parity oracle), and every key it does not define is in `from_base`.

This is not a fallback. A fallback is a value a component substitutes at render time when the theme is silent, which hides an incomplete theme. The base template is a published theme, the substitution happens in data before publication, and `from_base` and `stats.source.default` say exactly where it happened. A component system still requires its `REQUIRED_TOKENS` and still refuses to build a hand-written theme that lacks one; it may report keys it reads from `from_base` at debug level so an author sees what the design system left to Superloom.

### Generated artifact provenance

A generated reference theme package (e.g., Material, Carbon) completes its schemes from the base template at generation time. When the base template is republished at the same version with corrected values, a generated package that is not regenerated retains stale values for every key it completed from the old base. A consumer clean install fetches the corrected base and the stale generated package side by side; nothing detects the mismatch.

Generated packages prevent this by recording source provenance in their metadata: the base package version, the base distribution shasum, and the generator schema revision. A generator check compares the installed base shasum against the registry shasum and refuses to write on mismatch. A generated-artifact test regenerates into a temporary directory and byte-compares every committed data file against the regeneration output. After a same-version base republish, every downstream generated package is regenerated and republished at the same version, and every consumer lockfile is refreshed.

---

## Motion

Motion has two halves. Curves and timings are data tokens: durations in milliseconds, and curves of three kinds, a **bezier** (`[x1, y1, x2, y2]`), a **spring** (`{ spring: true, stiffness, damping, mass }`), and **segments** (`{ segments: true, curves: [[t, [x1, y1, x2, y2]], ...] }`, an ordered list of beziers with split points). Every curve in Carbon and Material is one of the three, and both platforms render all three: React Native through `Easing.bezier`, `Animated.spring`, and a sequenced bezier list; the web through `cubic-bezier()` and `linear()`.

Choreography is the component system: what animates, in which order, and which part moves. The component library implements the three curve interpreters once, in `parts/motion.js`, and every component animates through them. A new curve value is a theme edit. A new curve kind is a new interpreter, which is a component release plus a contract version.

The core Themer defines and validates motion token shapes (durations, bezier arrays, spring objects, segments). It does not interpret them into platform API calls. That interpretation lives in the component system: `parts/motion.js` converts tokens to `Easing.bezier`, `Animated.spring` parameters, and sequenced bezier lists. Even when a platform provides a native animation (e.g., React Native's `Modal` `animationType`), the component system should drive the animation through motion tokens rather than relying on a platform default. This keeps the animation theme-driven and consistent across design systems.

Discrete behaviors that design systems answer differently are enum tokens, and the component system implements every listed value: `feedback.press` selects `highlight` (swap to hover and active colors), `opacity` (paint a state layer at `state.*` opacities), or `ripple` (radial spread from the touch point); `feedback.focus` (contract version 2) selects `outline`, `inset`, or `underline`. Stacking order (which surface sits above which) is the same in every design system and is one table inside the component library, not a token.

---

## What is not a token, and why

A concept that is not a plain data token has exactly one of three causes. **Platform:** React Native cannot render it on iOS or Android at the supported floor (variable-font axes, backdrop blur); these are the only exceptions, each recorded in the plan's exception register with owner approval and revisited at every floor change. **Web-only form:** the concept exists everywhere but arrives in a web-shaped unit (`rem`, `vw`, media queries, font stacks); the engine or the component system projects it and it is never an exception. **Anatomy:** structural behavior a number cannot carry (choreography, stacking, ripple spread, grid layout, focus movement); it lives in the component system, selected by a generic enum where design systems differ.

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

The engine caches derived results by a composite key: the per-instance state identity, the template identity, the serialized layers array, and the normalized emission options. Passing a fresh array with equal content is a cache hit only when the template identity and emission options also match. Templates are immutable inputs; changing template metadata creates a new template identity and invalidates the cache. The extension is prop-driven: it re-derives when the `template` or `layers` prop reference changes. An `update_layers` override API remains available for imperative use, but the primary flow is props in, derived theme out.

---

## Resolve Then Emit

The engine splits the work into two stages:

1. **Resolve** produces canonical, unit-free values. A spacing token is the number `16`, not `'1rem'` and not `16`-with-an-implied-unit. Color ramps are computed, contrast pairs are selected, type sets are resolved to objects with absolute line heights.

2. **Emit** projects those values onto one platform. Web wants `'1rem'` and a `box-shadow` string; React Native wants `16` and a style object.

One derivation, two projections. There is no second theme to keep in step, and the difference between the platforms lives in one table rather than scattered through the token values.

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

The extension's `ThemeProvider` is prop-driven: it re-derives when the `template` or `layers` prop reference changes, producing a new theme through the engine and re-rendering the entire subtree. The app wrapper owns profile, scheme, and brand selection state, derives the template and layers from that state, and passes them as props. An `update_layers` override API remains available in the extension context for imperative use, but the primary flow is prop-driven.

Each app shape mounts its own `ThemeProvider` with its own base and variant layers. Switching shapes re-themes the entire subtree. This is the mechanism for per-tenant branding, dark mode, and live accent changes.

---

## Emission Options

The engine's `emit` stage accepts an optional fourth argument: a normalized options object that selects platform-specific behavior without coupling the engine to any platform's API. Omitted options normalize to legacy defaults and produce output identical to the existing three-argument call.

Options that affect output join the cache key alongside the resolved-object identity, template identity, and platform string. Two calls with semantically equivalent options (one omitted, one explicitly defaulted) share a cache entry. Changing template metadata creates a new template identity and a new cache entry.

The host selects a supported mode; the pure engine does not inspect React Native or the OS. Unsupported capabilities are reported through loss metadata, not silently dropped.

---

## Contextual UI Layers

A **contextual UI layer** is distinct from a cascade layer. Cascade layers are theme overrides merged during resolution. Contextual UI layers are surface selection: background, field, border, and interaction tokens chosen based on nesting depth.

Carbon uses a base layer plus layer-01, layer-02, and layer-03. A component library maps its provider numbering to these surface levels. The provider is a context carrier, not a visual wrapper: it stores a level and descendants read it to select the correct surface token set.

Contextual layers, cast shadows, and overlay stacking are separate concepts. A contextual layer selects a background color. A cast shadow is a visual effect. Overlay stacking and backdrop are z-order and dimming. None implies the others.

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
