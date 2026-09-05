# Fonts

> **Language:** JavaScript

The font system separates font identity (family names and weights, which are data) from font loading (file acquisition and registration, which is a host concern). The theme names font families; the host loads them. The core module (`js-client-helper-font`) owns family and role identity, per-weight validation, and the registered-versus-loaded distinction. Platform adapters (`js-client-helper-font-ext-web`, `-expo`, `-rn`) own the actual file acquisition and registration. This page documents the contract, the mechanisms, and the production path.

## On This Page

- [The Contract](#the-contract)
  - [Manifest Style Entries](#manifest-style-entries)
  - [Registered Versus Loaded](#registered-versus-loaded)
- [Three Delivery Mechanisms](#three-delivery-mechanisms)
- [Font Manifest](#font-manifest)
- [Loading Flow](#loading-flow)
- [Production Native Builds](#production-native-builds)
- [Static Fonts Only](#static-fonts-only)
- [Further Reading](#further-reading)

---
## The Contract

The rule: the theme names font families; the host loads them.

The reason is architectural. A theme is pure JSON. It travels from a server, through a database, across a wire. It cannot carry binary font files. A bundler asset import for a `.ttf` file is bundler-bound: it resolves at build time through Metro or webpack, producing a binary asset reference. A server-sent JSON theme cannot perform that resolution.

The contract is:

- The theme declares `primaryFamily: 'Inter'` (a string)
- The host registers the `Inter` font family with the platform
- If the theme names a family the host has not registered, text renders in a fallback

The font core module provides family and role validation. The app's theme assembly calls the font core to check whether the families named in the theme are registered with the host. A family that is registered is not necessarily loaded; registration is a data declaration, loading is a platform I/O operation. Visual acceptance requires confirmed loaded font faces, not a family-name string or a registered-but-unloaded record.

### Manifest Style Entries

A manifest style entry must carry a real asset source. Registering an entry without one is an error: the platform attempts to load a font that does not exist, and text renders in a fallback with no signal to the developer that the registration was incomplete.

A platform whose adapter has no native loader keeps an **empty** manifest and relies on the platform's own font mechanism. The manifest exists in every host so the loading flow is uniform. An empty manifest is the correct state when the platform provides fonts through a different channel (system fonts, a build-time config plugin, or a CSS `@font-face` stack the host owns directly).

### Registered Versus Loaded

Registration is a data declaration: the font core records a family name and its per-weight face keys. Loading is a platform I/O operation: the adapter acquires the font file and registers it with the OS or browser. A family can be registered but not loaded, which means text renders in a fallback with no signal to the developer that the registration was incomplete.

The core module tracks both states independently. `isFamilyLoaded` reports whether the platform has confirmed the font face is available for rendering, not merely whether the family name was declared. A host that returns `isFamilyLoaded: true` unconditionally without checking actual platform state masks fallback rendering and is a defect in fidelity mode.

Theme derivation is synchronous and may precede font readiness. A host may gate its initial presentation until fonts are loaded. These are separate policies: the theme is valid before fonts load, but visual acceptance requires confirmed loaded faces.

---

## Three Delivery Mechanisms

React Native and Expo support three font delivery mechanisms. On Expo and React Native hosts, all three funnel through the same `expo-font.useFonts()` call. On web, the font extension adapter uses `@font-face` CSS or a platform font mechanism instead. The core module is platform-agnostic; it validates family and role identity and tracks readiness without performing I/O.

| Mechanism | Example family | How it loads | Where the module comes from |
|---|---|---|---|
| **System** | `System` | Native platform font, nothing to load | Built into the OS |
| **Google package** | `Poppins_400Regular` | `@expo-google-fonts/[name]` package export | `import { Poppins_400Regular } from '@expo-google-fonts/poppins'` |
| **Bundled TTF** | `Lora` | Raw `.ttf` file in `fonts/assets/` | `import LoraRegular from './Lora-Regular.ttf'` |

Mechanisms 2 and 3 are identical at the `expo-font` level. The only difference is where the font module originates: a published package or a local asset. Both produce a font map entry that `useFonts` registers with the OS (native) or injects as `@font-face` CSS (web).

---

## Font Manifest

The font manifest is a loader module at `src/client/fonts/fonts.js`. It receives `Lib` (specifically `Lib.FontLoader`, the injected font loader adapter) and returns a `useFontsReady` hook.

The manifest assembles a `FONT_MAP` from all configured sources:

```js
const FONT_MAP = Object.assign(
  {
    Poppins_400Regular: Poppins.Poppins_400Regular,
    Poppins_600SemiBold: Poppins.Poppins_600SemiBold
  },
  CustomFonts
);
```

`CustomFonts` is a spread of asset imports from `fonts/assets/index.js`. The assets index ships empty by default (`export default {}`), preventing Metro build errors from missing files. To enable a custom font, drop the `.ttf` into `fonts/assets/` and uncomment the entry in the index.

The manifest is a singleton loader. It does not import `expo-font` at the top level; it receives `Lib.FontLoader` through injection, matching the centralized dependency pattern used throughout the client.

---

## Loading Flow

1. `loader.js` builds `Lib.Fonts` by calling the font manifest loader with `Lib` (injecting `Lib.FontLoader`)
2. The root layout (`app/_layout.js`) calls `Lib.Fonts.useFontsReady()`
3. `useFontsReady()` wraps `expo-font.useFonts(FONT_MAP)`:
   - Native: registers font faces with the OS
   - Web: injects matching `@font-face` CSS
4. The layout returns `null` until fonts are ready, then renders the app

The splash-until-loaded rule prevents a flash of unstyled text. The app does not render until every family in the `FONT_MAP` is registered.

---

## Production Native Builds

In production native builds (EAS Build, prebuild), fonts embed through the `expo-font` config plugin. The config plugin copies font assets into the native project at build time, so the fonts are present in the app binary without a runtime download.

The `useFonts` call remains the web and dev path. On web, `useFonts` injects `@font-face` CSS at runtime. In dev (Expo Go or dev client), `useFonts` registers fonts with the runtime. In production native, the config plugin has already embedded the fonts; `useFonts` finds them already registered and returns immediately.

The config plugin path is the production optimization. The `useFonts` path is the universal interface. Both coexist without conflict.

---

## Static Fonts Only

The system uses static fonts only. Variable fonts (a single font file with multiple axes) are not supported.

The reason is platform compatibility. `expo-font` and the underlying native font registration APIs expect individual font files per weight. A variable font file requires axis-aware parsing that the current toolchain does not provide.

The guidance is 2 to 3 weights per family: regular (400), semibold (600), and optionally bold (700). The themer template's weight resolution chain falls back gracefully: `regular` defaults to `'400'`, `medium` falls back to `regular`, `semibold` defaults to `'600'`, `bold` defaults to `'700'`. A theme can supply `font.weight` to override any of these.

---

## Further Reading

- [Expo Guide](expo-guide.md) - Expo capabilities, adapter pattern, cloud account features
- [Theming](theming.md) - How font families enter the theme and reach components
- [Client Loader](client-loader.md) - How the font manifest enters the `Lib` container
- [Client Architecture](client-architecture.md) - The Expo + Metro pipeline that bundles font assets
