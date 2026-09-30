# Components

> **Language:** JavaScript

The component library is one generic React Native Web library. A component owns its **anatomy** (which parts exist and how they nest) and its **behavior** (state, keyboard, focus, accessibility) and nothing else. Every value it draws is a token read from the theme; every discrete shape choice is an enum token the theme picks and the component implements every value of; every glyph is an icon token whose value the theme carries. The library ships no colors, no font files and no icon files. A design system is a template package, and a new design system is a new template and zero component changes - a property proven continuously by rendering the whole roster under three templates. This page defines the vocabulary, the roster, the authoring contract, the platform model, the gates, and the accessibility contract.

## On This Page

- [Component Vocabulary](#component-vocabulary)
- [The Roster](#the-roster)
  - [Where vendor knowledge lives](#where-vendor-knowledge-lives)
- [Anatomy, Behavior, Theme](#anatomy-behavior-theme)
  - [Behaviors](#behaviors)
  - [The context seam](#the-context-seam)
- [Theme Token Contract](#theme-token-contract)
  - [Enum tokens](#enum-tokens)
  - [Icon tokens](#icon-tokens)
  - [Contract requests](#contract-requests)
- [Platforms](#platforms)
- [Component Folder](#component-folder)
- [Interaction States](#interaction-states)
- [Geometry and Fidelity](#geometry-and-fidelity)
  - [Spec as token names](#spec-as-token-names)
  - [Measurement against the upstream reference](#measurement-against-the-upstream-reference)
  - [The five gate layers](#the-five-gate-layers)
  - [Frame Ownership](#frame-ownership)
  - [Status Surface Triad](#status-surface-triad)
  - [Centered Targets](#centered-targets)
- [Verification Speeds](#verification-speeds)
- [Native Evidence](#native-evidence)
- [Generated Documentation](#generated-documentation)
- [Accessibility Contract](#accessibility-contract)
  - [No-op props on web](#no-op-props-on-web)
  - [Platform gaps](#platform-gaps)
- [Generic vs App](#generic-vs-app)
- [Peer Dependencies](#peer-dependencies)
- [Further Reading](#further-reading)

---
## Component Vocabulary

The library uses four tiers. Atoms and molecules follow Brad Frost's atomic design taxonomy. Composites extend the hierarchy for components that compose other molecules. Providers are context-only components that render no visual output.

| Tier | Definition | Boundary |
|---|---|---|
| **Atom** | An irreducible primitive wrapping one RN element with token consumption and accessibility behavior | No composition of other library components. No domain knowledge |
| **Molecule** | A composition of atoms with interaction logic | No domain knowledge. Composes atoms only |
| **Composite** | A composition of atoms, molecules and other composites with coordination logic through React Context | No domain knowledge |
| **Provider** | A context-only component that renders no visual output and consumes no tokens | No visual output |

**Organisms and above are not library concepts.** Anything domain-aware (a product card, a cart summary, a checkout form) is an app-side component. There is no `organism/` folder because organisms are app concerns.

A **family** is the unit of specification, showcase entry, screenshot and documentation page: `Tabs`, `Tab`, `TabList`, `TabPanel` and `TabPanels` are five components in one family. A component that only makes sense inside its parent (`TabPanel` inside `Tabs`) is flagged `requires_parent` in the roster and is shown, tested and documented through its family.

A composite coordinates its children through React Context, never through `React.Children.map` plus `cloneElement`, which breaks when children are wrapped in `React.memo` or `forwardRef`. Contexts are created once per system instance, not inside a factory body, so re-theming does not orphan mounted consumers. `ErrorBoundary` is the one class component in the library, because `componentDidCatch` has no hook equivalent.

---

## The Roster

`data/roster.json` is the library's single list of components: one row per upstream export of the reference design systems plus the library's own additions, in build order. The roster is generated as a candidate from the pinned upstream packages' real export lists, then completed by hand. A row is never deleted; an export that will not be built is marked `not_applicable` with its reason. Every column is mandatory and `scripts/roster-check.js` rejects an empty one:

| Column | Holds |
|---|---|
| `name`, `family`, `tier` | The component, its family and its tier |
| `source` | `{ package, version, export }` - the upstream export this row accounts for, or `local` |
| `description` | One sentence, written when the row is built; a placeholder on a built row fails the check |
| `platform` | `{ support, fallback }` - see [Platforms](#platforms) |
| `enums`, `behaviors` | The enum tokens the component switches on and the behaviors it composes |
| `parent` | The family root a `requires_parent` component is composed inside |
| `reference` | `{ kind: render-web / parse-rn / none, package }` - how the component is measured |
| `carbon_twin`, `material_twin` | The upstream component the measurement compares against, or `none` |
| `diff_budget` | Perceptual-diff allowance in percent |
| `flags` | `deferred_gap`, `no_reference`, `web_only`, `requires_parent`, `superloom_decision`, `not_applicable` - each demands an explanation in `description` |
| `status` | `pending`, `built`, `measured`, `frozen` |

The registry, the showcase, the test harness and the documentation generator all iterate the roster. A component that is not a row does not exist.

### Where vendor knowledge lives

The library is generic. The names of the design systems it was built against appear in exactly four places: `data/` (the roster, the icon table and their candidate inputs), `scripts/` (the roster and icon tooling that reads the pinned upstream packages), `DECISIONS.md` (the settled decisions and the library idea, in prose) and `_test/` (the measurement oracles import the upstream packages). The purity gate fails on any occurrence of a vendor name in the shipped source, which is everything the package's `files` allowlist ships other than `data/roster.json`. Exceptions - a shape one system has that the other does not, a deferred anatomy, a component with no upstream reference - are written once, as roster flags with a note, and reach the documentation mechanically. A component's `notes.md` is vendor-free.

---

## Anatomy, Behavior, Theme

A component is three things kept apart:

| Concern | Lives in | Changes when |
|---|---|---|
| **Behavior** | `behaviors/` - headless hooks with no rendering | An interaction pattern is added or fixed |
| **Anatomy** | the component file - which parts exist, how they nest, which behaviors they compose, which tokens each part reads | A part is added or the nesting changes (a library release) |
| **Appearance** | the theme - every value, every enum choice, every glyph | Never in the library |

### Behaviors

A behavior is a reusable, headless hook: controllable state, press, keyboard, roving tab index, overlay, focus trap, anchored position, disclosure, compound context. A hook that owns state returns its prop getters plus one flat `state` object and publishes the state's keys as data (`useButton.stateKeys`); the tests assert the rendered state equals the published keys, and a hook that owns no state is declared as such by name. Behaviors import no framework: one composer builds them all from the injected React, React Native, helpers and platform answer. A component composes behaviors by name from its context; it never re-implements one inline. `behaviors/ROBOTS.md` is the compact signature reference an author reads before composing.

### The context seam

The library entry point is `createSystem(shared_libs, config, built, breakpoint, factories)`. `shared_libs` carries the frameworks the host loader imported once (`React`, `ReactNative`, `Svg` for `react-native-svg`) and the helpers (`Utils`, `Debug`, `Themer`); nothing in the library imports a framework, so it shares the host's single instance of each and a test hands in the web builds without a module-resolution hook. `built` is the native projection of a template and its layers. `createSystem` validates the theme against the library's declared requirements, rejects a theme built for the web projection, builds one component context, calls every factory in `factories` with it and returns a frozen registry. A factory is `export default function Name (ctx) { return function Name (props) { ... } }` with its spec sheet attached as `Name.spec`. The context is the only way a component reads the theme: `token`, `color`, `typeStyle`, `metric` (through the spec sheet), `enum` (checked against the contract's value list), `icon`, and the presentations `focusPresentation`, `pressPresentation` and `fieldPresentation`, each throwing on a token the theme lacks. A presentation implements every value of one enum (`feedback.focus`, `feedback.press`, `feedback.field` with `anatomy.label`) once, as style fragments, so every component that shows focus, press or a field frame draws the theme's choice the same way, and a part a presentation may hide (a state layer, a floating label) stays in the element tree under every value; it also carries the frameworks, the behaviors, the platform answer and the registry. Platform capabilities (navigation, file access, fonts) arrive through host-injected adapters in `shared_libs`. Re-theming calls `createSystem` with a new theme and swaps the registry reference; the previous registry is never mutated.

Consumers that use a bundler (Vite, Metro) import `createSystem` directly. The public barrel exposes named exports and no default export, so a bundler can tree-shake unused components and consumers import an explicit surface.

---

## Theme Token Contract

The Themer package owns the token contract (`Themer.getContract()`). The component library requires its tokens from that contract and declares the subset it requires and the subset it supports as exported data. `createSystem` calls `Themer.validateContract` with both lists: missing required tokens are one `TypeError` naming them all; unsupported provided tokens are one warning naming them all. No component source contains a color literal, a numeric size literal, a token name outside the contract, or a fallback from one token to another. A hardcoded fallback would make an incomplete theme look complete while substituting the library's own design decisions; the correct behavior is to refuse to build so the theme author sees the gap.

Components read tokens through the context and nothing else. A read of a token the theme lacks throws at render, which makes a headless roster walk a proof that every component's every token exists.

### Enum tokens

Where design systems answer a discrete question differently, the answer is an enum token and the component implements every listed value. The theme picks the value; the component never infers it from any other token. The enum groups are `feedback` (how a press, a field frame and a focus ring are drawn) and `anatomy` (where a field label sits, whether a switch handle grows, how a status marker is drawn, whether dialog actions stretch, whether a select shows a caret, how a slider handle is shaped). Enum values are named by what they do (`ripple`, `underline`, `floating`), never by a system. The roster's `enums` column records which enums a component switches on, and the test harness renders every value of each. See [Theming - Anatomy enums](theming.md#anatomy-enums) for the values.

### Icon tokens

Components draw icons by meaning: `close`, `chevron_down`, `warning`. Each semantic name is a token in the contract's `icon` group and its value - SVG path data with a viewBox and optional size variants - comes from the theme. The `Icon` atom is the only icon knowledge in the library: it reads the token, picks the exact size variant when the theme carries one and scales the default otherwise, passes the color token as `fill`, and renders through `react-native-svg` on every platform (a real DOM `<svg>` on web through its web build, native drawing on iOS and Android). The library exports `REQUIRED_ICONS`, validated at build time exactly like `REQUIRED_TOKENS`: a theme missing an icon the roster's components use fails to build, naming every missing icon. **No icon is ever substituted from another set.** A silent fallback passes every zero-console-error gate while the theme draws the wrong glyphs; it is how one design system's icons shipped under another's theme unnoticed. A brand overrides an icon with a layer, like any other token. Semantic names are added to `data/icons.json` when a component needs them, with every template's counterpart at once.

### Contract requests

A component that needs a token the contract lacks does not invent one and does not stop the batch. The request (token, requesting row, reason) is queued and applied at the next milestone as one contract version bump, followed by regeneration and republication of every template in dependency order and revalidation of every consumer. Never mid-batch, never one token at a time.

---

## Platforms

One file per component by default: React Native Web is itself the web projection, and a component that reads only tokens and behaviors renders identically everywhere. The roster records a platform answer for every row:

| `platform.support` | Meaning |
|---|---|
| `both` | One implementation renders on web, iOS and Android |
| `touch_degraded` | Renders everywhere; a pointer-only affordance (hover) degrades to press on touch, as the `fallback` says |
| `adapter` | Needs a host capability (file access) through an injected adapter; without it the component draws nothing and reports |
| `web` / `native` | Exists on one platform class only; the other draws nothing, silently, and the roster says so |
| `split` | The component genuinely forks - see below |

A component that genuinely forks uses the **three-unit split**: `XWeb`, `XNative`, and a public `X` that is a dispatcher only. Each half declares its platforms as data; a missing half draws nothing. No component other than a dispatcher may read the platform - a gate fails a `Platform.OS` read anywhere else. Platform APIs never arrive through direct imports; they arrive through host-injected adapters, so the library has no platform-specific dependency of its own.

---

## Component Folder

Every component lives in its own folder, `component/[tier]/[family]/`, with a fixed set of files. Each file is data the tests and the documentation generator read; none is decoration.

| File | Holds | Read by |
|---|---|---|
| `[name].js` (and `[name].web.js`, `[name].native.js` for a split) | Anatomy: parts, nesting, behaviors composed, tokens read per part | the system |
| `api.js` | Props with types, defaults and one-line descriptions, as data | unit tests, docs |
| `spec.js` | Geometry as token names per part (height, padding, radius, icon size, target size) and the enums the component switches on | purity gate, measurement, docs |
| `sample.js` | The states row: every state, size and enum value the showcase renders | showcase, screenshots, gates |
| `reference.js` | How to render or parse the upstream twin for measurement; present when `reference.kind` is not `none` | measurement |
| `notes.md` | Vendor-free prose: composition rules, gotchas, why a part exists | docs (merged into the generated page) |
| `_test/[name].test.js` | Unit and accessibility tests for the component, beside the library's shared gates; each new assertion gets a row in the fire manifest (`_test/fixtures/assertion-integrity.json`) | `check`, `batch`, fire |

The purity gate runs on every `check`: no literal where a token exists, no vendor name in the shipped source, no platform read outside a dispatcher, no banned accessibility prop, every token name in `spec.js` present in the contract, `REQUIRED_TOKENS` and `REQUIRED_ICONS` equal to the union of what the components read.

---

## Interaction States

Every interactive component supports the standard interaction-state vocabulary. Some states are persistent (selected, checked, current, expanded, invalid), others transient (hovered, pressed, focused). A component can be in several states at once; the precedence rules are per family and appear in its documentation.

| State | Meaning | Visual treatment |
|---|---|---|
| `enabled` | Default resting state | Base token values |
| `hovered` | Pointer over the component | Hover color tokens (derived by the theme, never by the component) |
| `pressed` | Component is being pressed | `feedback.press` - the theme picks `highlight`, `opacity` or `ripple` |
| `focused` | Keyboard or screen-reader focus | `feedback.focus` - `outline`, `inset` or `underline` |
| `disabled` | Non-interactive | Disabled color tokens |
| `loading` | Performing an async action | Non-interactive, `aria-busy`, renders a loading indicator or skeleton |
| `selected` | The active choice in a group | Authored selected token, not a pseudo-state derivation |
| `checked` | Toggle or checkbox is on | Authored checked token |
| `current` | Marks the current page or step | Authored current token |
| `expanded` | Reveals additional content | `aria-expanded` plus a visual indicator |
| `invalid` | Has a validation error | Authored invalid token |

**Selected is not pressed.** A selected tab retains its selected treatment at rest; pressed is a transient pointer-down visual, and both can hold at once. A border indicator is not a background fill and is not substituted for one unless the template's design system calls for an indicator border. The `focused` state renders a visible indicator on every platform.

Every state of every component appears in its `sample.js`, so the showcase, the screenshots and the gates see all of them under every template.

---

## Geometry and Fidelity

### Spec as token names

A component's geometry is declared data, not an emergent result of padding and line height. `spec.js` names every geometry value as a token reference; the template supplies the number. A raw number in a component library is one design system's opinion hardcoded, and the purity gate rejects it. Where a design system never specifies a value, the component uses a token from that system's own scale and the roster marks the row `superloom_decision`.

### Measurement against the upstream reference

Fidelity to a reference design system is measured, not transcribed. For a row whose `reference.kind` is `render-web`, the test harness renders the pinned upstream web component in the same browser and reads its computed geometry (height, paddings, border sides, radius, font size, icon size); for `parse-rn`, it parses the pinned upstream React Native component's style objects. The library's rendering under the matching template must agree within one point, and the perceptual diff of the two screenshots must stay within the row's `diff_budget`. A value read from the upstream's source stylesheet by eye is a transcription: it cannot detect upstream drift and it ratifies whatever the reader believed. Every reference is a pinned published package version recorded in the roster's `source`, and regenerating the measurement is deterministic.

A row flagged `no_reference` (a library addition with no upstream twin) is not measured against anything. It is held to contract validity, the structural and accessibility layers, and its own regression baseline, and its documentation says so. A row flagged `deferred_gap` draws the primary system's shape with the second system's tokens, and the gap is stated in its documentation until the anatomy is added.

### The five gate layers

No human decides whether a render is right. Five machine layers do, in this order, each with a recorded proof that it fires:

| Layer | Asserts |
|---|---|
| 1. Structure | The rendered DOM has the parts `spec.js` declares, with the roles and states the behaviors declare, for every sample under every template |
| 2. Measurement | Geometry agrees with the upstream reference within one point (rows with a reference) |
| 3. Perceptual diff | The screenshot differs from the reference render within `diff_budget` |
| 4. Accessibility tree | The accessibility tree is identical across templates for the same sample - a theme changes appearance, never semantics |
| 5. Regression baseline | Pixel-exact against the frozen baseline in the pinned container, once layers 1-4 have passed and the contact sheet was reviewed |

A baseline is recorded only after layers 1 to 4 pass and the batch's contact sheet has been reviewed. A baseline taken from the first render ratifies whatever that render was, including its defects, and every later comparison confirms the defect. A human report of a wrong render becomes a new automatic check, never a one-off fix.

### Frame Ownership

A field composite (password, search, number, date, combo box, select) has exactly one frame owner. The wrapper owns the border, the focus ring, the invalid state and the disabled state; the inner text input renders unframed. Nested borders and a user-agent focus outline are defects: when the wrapper owns focus it renders the contract's focus treatment and suppresses the browser default.

The frame shape is `feedback.field`, with values `underline` (bottom border only) and `outline` (four sides). Every square corner reads the contract's zero-radius token, so one brand-layer override rounds fields, buttons, tiles, notifications and menus together while pill shapes stay on the maximum-radius token. If a component needs a code change to look right under a brand layer, the component hard-coded structure; fix the component, never widen the layer.

React Native Web renders a text input as an `<input>` with an intrinsic minimum width. The atom sets `minWidth: 0` so a field can shrink to its wrapper; composites do not patch this individually.

### Status Surface Triad

Every status surface (inline, toast, actionable, static notification, callout, error state) uses the notification triad for a `kind`: the fill from `color.notification_background_[kind]`, the accent (leading border, icon) from `color.support_[kind]`, text from `color.text_primary` and `color.text_secondary`, and the inverse set for high contrast. `support_[kind]` is an accent color, never a fill; a `support_*` fill with dark text fails the contrast floor. Whether the marker is a bar plus icon or a plain icon is `anatomy.status_marker`.

### Centered Targets

Every pressable meets a minimum target from the contract's target tokens and centres its glyph (`alignItems`, `justifyContent` on the pressable, never on the SVG, which rejects flex properties) so the glyph sits inside the hit region. Every pressable has an accessible name; a component that takes `title` and a caller that passes `children` (or the reverse) produces a nameless button, and the structure layer rejects it.

---

## Verification Speeds

Verification is affordable because it runs at three speeds, and no speed does another's work:

| Speed | When | Runs |
|---|---|---|
| `check <Name>` | After every edit to one component | Lint on the changed files, the purity gate, this component's unit and accessibility tests |
| `batch` | After every 8-12 components | The whole unit suite, the showcase bundle, browser gate layers 1-3 for the batch's families under every template, measurement, screenshots and a contact sheet, documentation regeneration with a diff, and a machine-generated defects list |
| `verify` | At milestones and before anything reaches `main` | Clean installs, the entire suite, the fire runner (every assertion shown to fail when its behavior is disabled), container baselines, the demo's own verification, and the native gate |

Running the whole roster's browser suite after every component edit is the failure mode this table prevents: it made each fix cost the price of the library, and the loop stalled. Numeric evidence is written by scripts, never typed; a defects list is generated from machine output (component, check, expected, actual, location, screenshot) and never hand-extended.

---

## Native Evidence

iOS and Android are observed on simulators in continuous integration at every milestone. An in-app walker screen in the demo host, reached by deep link, renders the whole roster under every template inside an error boundary, measures every component's layout, records which fonts actually loaded and reports as JSON; the job screenshots every family and uploads everything as artifacts. The gate asserts zero render errors, zero console errors, every theme-named font loaded, and measured geometry equal to the web run's within one point - the same tokens produce the same numbers on every platform. Simulator evidence is stated as simulator evidence; real-device fidelity is a separate, later claim. Until the first simulator run has passed, the library makes no native rendering claim.

---

## Generated Documentation

Every family's documentation page is generated at every batch close from data the components already carry: props from `api.js`, tokens and enums from `spec.js`, behavior and accessibility from the behaviors' declared data, platforms, provenance and exceptions from the roster, and states from `sample.js` - merged with the family's `notes.md`, written by the component's author in the same pass. Nobody edits a generated page; regeneration is deterministic and the batch diff shows exactly what a component change did to its documentation. A roster flag that demands an explanation must be explained, or the batch does not close. The library's authoring guide, `docs/authoring.md`, plus `DECISIONS.md`, `behaviors/ROBOTS.md`, one exemplar folder, the current defects list and the contact sheet form the fixed briefing pack an author reads; never raw logs, never history.

---

## Accessibility Contract

Components meet the accessibility contract through `aria-*` props, which React Native 0.71+ accepts as first-class aliases and React Native Web forwards to the DOM. State and value semantics are expressed through `aria-*` props, never through the deprecated `accessibilityState` or `accessibilityValue` props, which React Native Web does not forward to the DOM. `accessibilityRole` and `accessibilityLabel` remain correct and are used directly. Behaviors emit these attributes; components do not hand-write them.

| Requirement | Implementation |
|---|---|
| **Roles** | `accessibilityRole` prop on every interactive component. Maps to ARIA role on web |
| **Labels** | `accessibilityLabel` on every component lacking a visible text label |
| **State announcement** | `aria-checked`, `aria-expanded`, `aria-disabled`, `aria-selected`, `aria-invalid`, `aria-pressed`, `aria-current` through the `a11y` translator |
| **Value semantics** | `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-valuetext` through the `a11y` translator |
| **Relationships** | `aria-controls`, `aria-labelledby`, `aria-describedby`, `aria-owns`, `aria-activedescendant` through the `a11y` translator |
| **Focus management** | Overlays that open and close (Modal, Dropdown, Popover) trap focus and restore on close |
| **Hit target** | Minimum 44x44 points on interactive components (iOS HIG), 48x48 dp (Android Material) |
| **Focus indicator** | Visible focus ring or outline in the `focused` state |

Gate layer 4 asserts the accessibility tree of every sample is identical under every template.

### No-op props on web

The following React Native accessibility props are silent no-ops on web and must not be used. Use the `aria-*` equivalent instead; the purity gate rejects the banned form.

| Prop or API | Web behavior | Use instead |
|---|---|---|
| `accessibilityState` | Not forwarded to the DOM | `aria-checked`, `aria-expanded`, `aria-disabled`, etc. through `a11y.state()` |
| `accessibilityValue` | Not forwarded to the DOM | `aria-valuenow`, `aria-valuemin`, `aria-valuemax` through `a11y.value()` |
| `accessibilityHint` | Emits nothing | `aria-describedby`, pass both |
| `accessibilityElementsHidden`, `importantForAccessibility` | Emit nothing | `aria-hidden` |
| `accessibilityViewIsModal` | Emits nothing | `aria-modal` |
| `AccessibilityInfo.announceForAccessibility` | Literal empty function | `useAnnounce` from `LiveRegionProvider` |
| `AccessibilityInfo.setAccessibilityFocus` | No-op | DOM `ref.focus()` |
| `accessibilityActions` / `onAccessibilityAction` | Unimplemented | `onKeyDown` on web |
| `LayoutAnimation` | No-op | `Animated` with measured height |

### Platform gaps

`aria-*` is the one form that works on web, iOS and Android. Native platforms have gaps: `aria-live` is Android-only on native, `aria-modal` is iOS-only, and native has no table, tabpanel or landmark roles. The library routes every gap through a behavior (such as `useAnnounce` for live regions) rather than leaving it to individual component judgment.

---

## Generic vs App

The library ships the generic roster. An application registers its own components alongside the registry - a large-touch point-of-sale button, a marketing hero - in the app's source, never in the library. An app component that reads tokens reads them through the same contract and re-themes with the system; one that opts out of tokens takes raw styles and does not re-theme, and the app names it as such. A shape no token can carry (a trapezoid call to action, a cloud-shaped field, a particle effect) is a different component system with its own declared token subset, not an exception inside this one.

---

## Peer Dependencies

The component library declares its runtime dependencies as peer dependencies. The host app provides them.

| Dependency | Why it is a peer |
|---|---|
| `react` | The host owns the React version |
| `react-native` | The host owns the RN version (via Expo SDK) |
| `react-native-svg` | The icon renderer on every platform; the host owns the version alongside `react-native` |
| Superloom modules received through `shared_libs` (the Themer engine and its React extension) | Declared with caret ranges so the runtime contract is complete |

The library never bundles these. The test harness inside the library pins real versions as dev dependencies for isolation, and pins the upstream design system packages it measures against.

---

## Further Reading

- [Theming](theming.md) - The themer that produces the tokens, enums and icons components consume
- [Fonts](fonts.md) - The font contract: theme names families, host loads files
- [Client Loader](client-loader.md) - How the component loader enters the boot chain
- [Client Architecture](client-architecture.md) - Why the library targets React Native Web
- [Client Modules](client-modules.md) - The naming taxonomy for the component library package
- [RN Testing](rn-testing.md) - Application UI acceptance gates
