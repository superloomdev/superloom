# Client Modules

> **Language:** JavaScript

This page is the single source of truth for the client-side module naming taxonomy. Every other document that references client module names links here rather than restating the rules. Given any hypothetical module idea, the tables and flowchart on this page determine its name and tier deterministically.

## On This Page

- [Runtime-Tier Prefixes](#runtime-tier-prefixes)
- [Framework-Tier Prefixes](#framework-tier-prefixes)
- [Suffix Inventory](#suffix-inventory)
- [Pure Core With Extensions, or a Single Framework Module?](#pure-core-with-extensions-or-a-single-framework-module)
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

The axis that separates these four prefixes is **what the module depends on**, not where it happens to run. Two modules can both run on web and native while sitting in different tiers, because one needs only `react` and the other needs the Expo SDK.

| Prefix | Dependency budget | Runs on |
|---|---|---|
| `js-react-helper-*` | `react` only: hooks, context, component APIs. No platform APIs, no Expo, no `react-dom`, no `react-native` imports | Every React renderer: React DOM, React Native, React Native Web |
| `js-rw-helper-*` | `react` plus `react-dom` plus DOM APIs | Web only |
| `js-rn-helper-*` | `react` plus `react-native` native modules | Native only |
| `js-rnw-helper-*` | `react` plus `react-native-web` plus the **Expo SDK** (for example `expo-font`) | The Expo/Metro pipeline: web, iOS, Android |

`js-react-helper-*` is the tier for a **standalone** module that works on every React renderer because it touches nothing but React itself. Any platform input it needs (event sources, storage handles, native modules) arrives by injection through the `Lib` container, which is what keeps it out of the three narrower tiers.

`js-rnw-helper-*` means the module is bound to the Expo/Metro pipeline specifically. It does not mean "universal". A module that runs on web and native without needing Expo belongs in `js-react-helper-*`.

`react` also appears as a **suffix** in `-ext-react`, where it means something different: a framework binding for a pure parent module that holds the logic. A standalone React module takes the `js-react-helper-*` prefix; a binding for a pure parent takes the `-ext-react` suffix. The next section decides which of the two applies.

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

## Pure Core With Extensions, or a Single Framework Module?

Once a module is known to need framework code, exactly two shapes are available. This section decides between them. Apply it before creating any module whose surface includes hooks, context, or components.

| | Shape 1: pure core plus extensions | Shape 2: single framework module |
|---|---|---|
| Packages | A pure parent (Class G) plus one `-ext-[framework]` package per framework (Class H) | One package (Class I) |
| Names | `js-helper-[name]` or `js-client-helper-[name]`, plus `js-helper-[name]-ext-react` | `js-react-helper-[name]`, or `js-rw`/`js-rn`/`js-rnw` when platform-bound |
| Example | `js-client-helper-styler` plus `js-client-helper-styler-ext-react` | `js-rnw-helper-font` |
| Use when | The framework-free logic has a second consumer | The framework is the only consumer |

### The Test

Answer in order. The first conclusive answer wins.

1. **Is there a second consumer for the framework-free logic, today?** A second consumer is a non-framework caller that is real and named (a server module, a CLI, a data-export path) **or** a second framework extension that is actually planned and scheduled. A framework someone might adopt one day is not a second consumer.
   - **NO** -> Shape 2. Stop here.
   - **YES** -> continue to question 2.

2. **Strip every framework call and every platform API from the design, assuming platform inputs arrive by injection. Is what remains a self-contained algorithm, engine, or state machine?** It does not qualify if it is a thin wrapper over a runtime built-in (`setTimeout`, `fetch`, `JSON`) or if it duplicates a function another helper already ships.
   - **NO** -> Shape 2.
   - **YES** -> Shape 1.

### Size Is Not the Test

**The amount of framework-free logic never justifies a split on its own.** A 300-line state machine with only one React consumer is still Shape 2. Splitting it produces a second package whose sole caller is its own extension, which buys nothing and costs a full module footprint: roughly ten files, a CI job pair, a publish cycle, and a version range to keep pinned between the two.

If a second consumer appears later, the [Promotion Rule](#promotion-rule) extracts the core at that point. Deferring the split costs one rename when the evidence arrives. Making the split early costs double maintenance for every release until then, and is unrecoverable if the second consumer never materializes.

### Dependency Direction

Dependencies point from framework-bound toward pure, never the reverse.

A pure module (`js-helper-*`, `js-client-helper-*`) must **never** depend on a framework module (`js-react-helper-*`, `js-rw-helper-*`, `js-rn-helper-*`, `js-rnw-helper-*`) or on a Class H extension. A pure module that needs scheduling calls the runtime's `setTimeout` directly rather than importing a framework-bound timer module. Inverting this direction makes the pure module unusable in the very environments its tier promises to support.

### Worked Verdicts

| Module | Question 1: second consumer today? | Question 2: substantial framework-free core? | Shape |
|---|---|---|---|
| `styler` | Yes. Theme output is consumed as data outside React (token export, server-rendered output) | Yes. A derivation engine over template plus values | 1: `js-client-helper-styler` plus `-ext-react` |
| `timer` | No. Every planned caller is a React view. Node would call `setTimeout` directly | Not reached. Would fail anyway: a bookkeeping layer over `setTimeout`, with date math belonging to `js-helper-time` | 2: `js-react-helper-timer` |
| `idle` | No. Every planned caller is a React view | Not reached. The state machine is substantial, which does **not** override question 1 | 2: `js-react-helper-idle` |
| `font` | No | Not reached. Bound to `expo-font`, so no framework-free core exists | 2: `js-rnw-helper-font` |

The `idle` row is the one most likely to be re-litigated. It is settled: a substantial core with a single framework consumer is Shape 2. Do not split it without first naming a second consumer.

---

## Placement Rules

1. A module takes the lowest tier whose dependency budget it fits
2. Pure JS with no browser or framework dependency goes to core (`js-helper-*`)
3. A module needing Web APIs but no framework takes `js-client-helper-*`
4. A module needing React resolves its shape with the [decision test](#pure-core-with-extensions-or-a-single-framework-module) **before** picking a name: a binding for a pure parent takes the `-ext-react` suffix, a standalone module takes a framework-tier prefix
5. A standalone React module needing nothing beyond `react` takes `js-react-helper-*`
6. A module needing the Expo/Metro pipeline specifically takes `js-rnw-helper-*`
7. A module needing DOM only takes `js-rw-helper-*`
8. A module needing native only takes `js-rn-helper-*`
9. When a pure parent exists, its framework bindings are `-ext-[framework]` packages, never code inside the parent
10. Dependencies point from framework-bound toward pure, never the reverse

---

## Tier Placement Flowchart

Given a module idea, answer these questions in order. The first match determines the tier.

```text
Does the module use Node.js built-ins or server-only packages?
  YES -> js-server-helper-*
  NO  -> continue

Does the module use a React framework (hooks, context, components)?
  NO  -> Does it use browser/Web APIs (window, document, localStorage)?
           YES -> js-client-helper-*
           NO  -> js-helper-*                      (core tier)

  YES -> Run the decision test. Is it Shape 1, a binding for a pure
         parent that holds the logic?

           YES -> pure parent keeps its own tier, and the binding is
                  [parent]-ext-react                (Class H)

           NO  -> Shape 2, standalone. What does it need beyond react?
                    Nothing; platform inputs injected
                                    -> js-react-helper-*   (Class I)
                    Expo SDK / Metro pipeline
                                    -> js-rnw-helper-*     (Class I)
                    DOM only        -> js-rw-helper-*      (Class I)
                    RN native modules
                                    -> js-rn-helper-*      (Class I)
```

---

## Promotion Rule

When a module's platform dependencies drop out (through refactoring or API evolution), the module promotes toward the core tier.

Example: a module that initially used `window.requestAnimationFrame` for a timer takes `js-client-helper-*`. If the timer logic is refactored to use `setInterval` only (available in all JS runtimes), the module promotes to `js-helper-*`. The promotion is a rename: the package name changes, dependents update their imports, and the old name is deprecated.

The promotion direction is always toward core. A module never demotes to a higher tier.

The same rule covers **core extraction**. When a framework module built as Shape 2 acquires a genuine second consumer, its framework-free logic is extracted into a pure parent and the original becomes an `-ext-[framework]` binding. This is the sanctioned path from Shape 2 to Shape 1, and it is why the decision test is allowed to prefer the simpler shape when no second consumer exists yet.

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
| `js-react-helper-idle` | Idle-state detection. State machine plus `useIdle`; activity sources injected by the host | React (`js-react-helper-*`) | Class I |
| `js-react-helper-timer` | Countdown and interval hooks. Tick bookkeeping plus the render bridge; date math delegated to `js-helper-time` | React (`js-react-helper-*`) | Class I |
| `js-client-helper-storage` | Key-value contract (get, set, remove, clear, namespacing) with the adapter pattern | Client (`js-client-helper-*`) | Class E |
| `js-client-helper-storage-adapter-web` | localStorage, sessionStorage, and cookie strategies | Client (`js-client-helper-*`) | Class F |
| `js-client-helper-storage-adapter-rn` | AsyncStorage plus SecureStore, through injected drivers | Client (`js-client-helper-*`) | Class F |
| `js-rnw-helper-font` | Font manifest loader. Binds `expo-font`, so it depends on the Expo pipeline | RNW (`js-rnw-helper-*`) | Class I |
| `js-rnw-helper-device` | Platform, viewport, safe area, network state, app state | RNW (`js-rnw-helper-*`) | Class I |

Idle and timer are Class I framework modules rather than pure cores with extensions. Both fail question 1 of the [decision test](#pure-core-with-extensions-or-a-single-framework-module): every planned caller is a React view, so neither has a second consumer today. Idle keeps its activity sources injected, which is what holds it in the `js-react-helper-*` tier instead of pushing it to `js-rnw-helper-*`.

The font module takes the RNW tier because it binds `expo-font`, which is specific to the Expo/Metro pipeline. Storage takes the client tier because it abstracts browser and native storage APIs; it is Class E because it owns an adapter contract, and its adapters are Class F packages carrying the `-adapter-[name]` suffix.

---

## Worked Examples

### Example 1: A module that detects network connectivity

- Uses `navigator.onLine` and `window.addEventListener('online', ...)` (browser APIs)
- No React dependency
- Determined tier: `js-client-helper-*`
- Name: `js-client-helper-network`

### Example 2: A module that provides accessible focus trap logic for React modals

- Uses React across DOM and RN; the focusable-node list is injected by the host, so no DOM API is imported
- Decision test question 1: the only named consumer is the React component library, so there is no second consumer today
- Determined shape: Shape 2, a single framework module
- Determined tier: `js-react-helper-*`
- Name: `js-react-helper-focus-trap`

If the component library later ships a Vue variant, the Promotion Rule extracts `js-helper-focus-trap` and this package becomes `js-helper-focus-trap-ext-react`.

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

### "Idle detection is NOT `js-client-helper`, and NOT a pure core plus an extension"

The idle module tracks user inactivity through a state machine that receives timestamps and returns state transitions. It never calls `window.addEventListener` or any platform API: attaching touch, mouse, and keyboard listeners is the host's job, and the host passes those sources in. That rules out `js-client-helper-idle`, because the module holds no Web API dependency of its own.

It is also not `js-helper-idle` plus `js-helper-idle-ext-react`. The module ships `useIdle`, so it depends on `react`, which disqualifies the pure core tier for the package as a whole. Splitting it would require a second consumer for the state machine, and there is none today: every planned caller is a React view. The state machine being substantial does not change the answer, because [size is not the test](#size-is-not-the-test).

Therefore the module is `js-react-helper-idle`, a single Class I package.

### "A React-only module is NOT `js-rnw-helper`"

A countdown hook runs on React DOM, React Native, and React Native Web. The temptation is to call it `js-rnw-helper-timer` because it works everywhere the RNW pipeline reaches. That is wrong: `js-rnw-helper-*` means the module **requires** the Expo SDK or the Metro pipeline, and a countdown hook requires neither. It needs `react` and nothing else, so it takes the wider tier: `js-react-helper-timer`.

The question is never "where can this run". It is "what must be installed for this to work".

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
