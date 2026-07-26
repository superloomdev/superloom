# Client Modules

> **Language:** JavaScript

This page is the single source of truth for the client-side module naming taxonomy. Every other document that references client module names links here rather than restating the rules. Given any hypothetical module idea, the tables and flowchart on this page determine its name and tier deterministically.

## On This Page

- [Runtime-Tier Prefixes](#runtime-tier-prefixes)
- [Framework-Tier Prefixes](#framework-tier-prefixes)
- [Suffix Inventory](#suffix-inventory)
- [Placement Rules](#placement-rules)
- [Tier Placement Flowchart](#tier-placement-flowchart)
- [Promotion Rule](#promotion-rule)
- [Boundary Rules](#boundary-rules)
- [Planned Module Roster](#planned-module-roster)
- [Worked Examples](#worked-examples)
- [Worked Negative Examples](#worked-negative-examples)
- [Further Reading](#further-reading)

---

## Runtime-Tier Prefixes

The runtime tier describes what platform APIs a module depends on. A module takes the lowest tier whose dependency budget it fits.

| Prefix | Tier name | Dependency budget | Examples |
|---|---|---|---|
| `js-helper-*` | Core | Pure JavaScript. No browser APIs, no Node built-ins, no framework | `js-helper-utils`, `js-helper-debug`, `js-helper-money`, `js-helper-time` |
| `js-server-helper-*` | Server | Node.js built-ins or server-only packages | `js-server-helper-http`, `js-server-helper-auth`, `js-server-helper-nosql-mongodb` |
| `js-client-helper-*` | Client | Browser or Web APIs (`window`, `document`, `localStorage`, `IntersectionObserver`) | `js-client-helper-styler`, `js-client-helper-crypto` |

A module with no browser or framework dependency never carries `client`. It goes to the core tier (`js-helper-*`). A module that needs `window.localStorage` takes `js-client-helper-*`. A module that needs `fs` or `http` takes `js-server-helper-*`.

---

## Framework-Tier Prefixes

The framework tier describes which React variant a module targets. These prefixes sit on top of the runtime tier: a framework-tier module still has a runtime classification, but its prefix reflects the framework constraint.

| Prefix | Framework constraint | Pipeline |
|---|---|---|
| `js-rw-helper-*` | React DOM only | Web only |
| `js-rn-helper-*` | React Native only (iOS/Android) | Native only |
| `js-rnw-helper-*` | React Native Web stack (the Expo/Metro universal pipeline) | Web + iOS + Android |

`react` as a framework name appears in suffixes (e.g. `-ext-react`), never as a prefix tier. It means "works across React DOM + React Native + RNW".

A module that works across all three targets through the RNW pipeline takes `js-rnw-helper-*`. A module that only makes sense in a browser DOM context takes `js-rw-helper-*`. A module that only makes sense on native takes `js-rn-helper-*`.

---

## Suffix Inventory

Suffixes modify a module's role within its tier. A module carries at most one suffix.

| Suffix | Meaning | Class | Example |
|---|---|---|---|
| `-ext-[framework]` | Framework extension of a pure parent module | Class H | `js-client-helper-styler-ext-react` |
| `-store-[backend]` | Storage adapter for a parent module | Class F | `js-server-helper-auth-store-dynamodb` |
| `-adapter-[name]` | Runtime adapter for a parent module | Class F | `js-server-helper-http-gateway-adapter-express` |
| `-template-[name]` | Design-language data pack for the styler | Data module | `js-client-helper-styler-template-carbon` |

Framework-specific bindings never live in the parent module. They are `-ext-[framework]` packages that import the pure parent and add framework-specific code. The parent never imports a framework.

---

## Placement Rules

1. A module takes the lowest tier whose dependency budget it fits
2. Pure JS with no browser or framework dependency goes to core (`js-helper-*`)
3. A module needing Web APIs takes `js-client-helper-*`
4. A module needing React across targets takes `-ext-react` on a pure parent, not a framework-tier prefix
5. A module needing the RNW pipeline specifically takes `js-rnw-helper-*`
6. A module needing DOM only takes `js-rw-helper-*`
7. A module needing native only takes `js-rn-helper-*`
8. Framework-specific bindings are `-ext-[framework]` packages, never in the parent

---

## Tier Placement Flowchart

Given a module idea, answer these questions in order. The first match determines the tier.

```text
Does the module use Node.js built-ins or server-only packages?
  YES → js-server-helper-*
  NO  → continue

Does the module use browser/Web APIs (window, document, localStorage)?
  YES → Does it also use a React framework?
          YES → Is it a binding for a pure parent?
                   YES → [parent]-ext-[framework]
                   NO  → js-rnw-helper-* (if RNW pipeline)
                          js-rw-helper-* (if DOM only)
                          js-rn-helper-* (if native only)
          NO  → js-client-helper-*
  NO  → continue

Does the module use any React framework?
  YES → Is it a binding for a pure parent?
          YES → [parent]-ext-[framework]
          NO  → js-rnw-helper-* (if RNW pipeline)
                 js-rw-helper-* (if DOM only)
                 js-rn-helper-* (if native only)
  NO  → js-helper-* (core tier)
```

---

## Promotion Rule

When a module's platform dependencies drop out (through refactoring or API evolution), the module promotes toward the core tier.

Example: a module that initially used `window.requestAnimationFrame` for a timer takes `js-client-helper-*`. If the timer logic is refactored to use `setInterval` only (available in all JS runtimes), the module promotes to `js-helper-*`. The promotion is a rename: the package name changes, dependents update their imports, and the old name is deprecated.

The promotion direction is always toward core. A module never demotes to a higher tier.

---

## Boundary Rules

Client-tier helper modules follow boundary rules imported from the client-utility-modules definition:

| Rule | Enforcement |
|---|---|
| No domain logic | A helper module never contains business rules specific to an application entity |
| No server-only logic | A helper module never contains code that requires Node.js built-ins or server-side packages |
| No duplication of core utils | If a utility exists in `js-helper-utils`, the client module imports it rather than reimplementing |
| Explicit state documentation | Any module maintaining state (cache, timer, observer) documents the state lifecycle in its README |
| No hidden polling | Any polling or interval-based behavior is explicit in the module's API and documented |
| No direct global-store mutation | A helper module never writes to Redux, Zustand, or any app-level store. It returns data; the app decides what to do with it |

---

## Planned Module Roster

The following modules are planned for the client helper module wave. Each is listed with its determined tier and class assignment.

| Module name | Purpose | Tier | Class |
|---|---|---|---|
| `js-rnw-helper-idle` | Idle-state detection (user inactivity timer). Pure state machine, no platform APIs | Core (`js-helper-*`) | Class A |
| `js-rnw-helper-timer` | Timer utilities (debounce, throttle, countdown). Pure JS | Core (`js-helper-*`) | Class A |
| `js-rnw-helper-storage` | Persistent storage abstraction with adapter pattern | Client (`js-client-helper-*`) | Class A + Class F adapters |
| `js-rnw-helper-storage-adapter-localstorage` | Browser localStorage adapter | Client (`js-client-helper-*`) | Class F |
| `js-rnw-helper-storage-adapter-asyncstorage` | React Native AsyncStorage adapter | Client (`js-client-helper-*`) | Class F |
| `js-rnw-helper-font` | Font manifest loader. Binds `expo-font`, so it depends on the RNW pipeline | RNW (`js-rnw-helper-*`) | Class A |
| `js-rnw-helper-device` | Device information (platform, screen, safe area). Reads platform APIs | RNW (`js-rnw-helper-*`) | Class A |

The idle and timer modules promote to core because their logic is pure JavaScript. The state machine for idle detection and the timer functions do not depend on browser or native APIs. They run in any JavaScript runtime.

The font module takes the RNW tier because it binds `expo-font`, which is specific to the Expo/Metro pipeline. The storage module takes the client tier because it abstracts browser and native storage APIs. Its adapters are Class F packages with the `-adapter-[name]` suffix.

---

## Worked Examples

### Example 1: A module that detects network connectivity

- Uses `navigator.onLine` and `window.addEventListener('online', ...)` (browser APIs)
- No React dependency
- Determined tier: `js-client-helper-*`
- Name: `js-client-helper-network`

### Example 2: A module that provides accessible focus trap logic for React modals

- Uses React (across DOM and RN)
- Is a binding for a pure focus-trap utility
- Determined tier: extension of a pure parent
- Name: `js-helper-focus-trap` (parent) + `js-helper-focus-trap-ext-react` (extension)

### Example 3: A module that wraps the Clipboard API

- Uses `navigator.clipboard` (browser API)
- No React dependency
- Determined tier: `js-client-helper-*`
- Name: `js-client-helper-clipboard`

### Example 4: A Carbon design-language template for the styler

- Pure data module (no code, no framework)
- Ships an alternate template for the styler
- Determined tier: client (it is a data pack for a client-tier module)
- Name: `js-client-helper-styler-template-carbon`

---

## Worked Negative Examples

### "Idle detection is NOT `js-client-helper`"

The idle detection module tracks user inactivity through a state machine. The state machine itself is pure JavaScript: it receives timestamps and returns state transitions. It does not call `window.addEventListener` or any platform API. The platform wiring (attaching touch/mouse/keyboard listeners) is the host app's job. Therefore the module is `js-helper-idle`, not `js-client-helper-idle`.

### "Font is NOT `js-helper`"

The font manifest module calls `expo-font.useFonts()` and `require('font.ttf')`. These are bundler-bound and Expo-specific. The module cannot run in Node or a non-Expo browser environment. Therefore it is `js-rnw-helper-font`, not `js-helper-font`.

### "A React hook for theme access is NOT `js-rnw-helper`"

The styler React extension provides `useTheme()` and `useStyles()`. It works across React DOM, React Native, and RNW. It is a binding for the pure styler parent. Therefore it is `js-client-helper-styler-ext-react`, not `js-rnw-helper-styler`. The `-ext-react` suffix captures the framework binding; the `client` prefix captures the parent's tier.

---

## Further Reading

- [Module Classes](../module-classes.md) - The Class A-H taxonomy and where every module belongs
- [Client Catalog](../catalog-client.md) - Published client modules
- [Theming](theming.md) - Template packs as data-only modules
- [Components](components.md) - The component library package and its naming
- [Client Architecture](client-architecture.md) - The RNW pipeline that framework-tier modules target
