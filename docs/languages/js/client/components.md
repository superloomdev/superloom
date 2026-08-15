# Components

> **Language:** JavaScript

The component library ships atoms, molecules, composites, and providers: themeable, accessible primitives built on React Native Web. The library is own code, following Superloom's loader pattern and Lib DI throughout. Design languages arrive as themer template packs, not as separate component libraries. This page defines the component vocabulary, the authoring contract, the four-bucket exception model, and the accessibility contract.

## On This Page

- [Component Vocabulary](#component-vocabulary)
- [Atom Set](#atom-set)
- [Molecule Set](#molecule-set)
- [Composite Set](#composite-set)
- [Provider Set](#provider-set)
- [Authoring Contract](#authoring-contract)
- [Utility-Class Mapping](#utility-class-mapping)
- [Four-Bucket Exception Model](#four-bucket-exception-model)
- [Interaction States](#interaction-states)
- [Accessibility Contract](#accessibility-contract)
- [Divergences from Carbon](#divergences-from-carbon)
- [Generic vs Custom](#generic-vs-custom)
- [Peer Dependencies](#peer-dependencies)
- [Further Reading](#further-reading)

---

## Component Vocabulary

The library uses four tiers. Atoms and molecules follow Brad Frost's atomic design taxonomy. Composites extend the hierarchy for components that compose other molecules (MenuButton composes Menu which composes MenuItem). Providers are context-only components that render no visual output.

| Tier | Directory | Definition | Boundary |
|---|---|---|---|
| **Atom** | `atom/` | An irreducible primitive wrapping one RN element with token consumption and accessibility behavior | No composition of other library components. No domain knowledge |
| **Molecule** | `molecule/` | A composition of atoms with interaction logic | No domain knowledge. Composes atoms only; never composes other molecules |
| **Composite** | `composite/` | A composition of atoms, molecules, and other composites with coordination logic | No domain knowledge. May compose atoms, molecules, and other composites |
| **Provider** | `provider/` | A context-only component that renders no visual output and consumes no tokens | No visual output. Registered at `Component.provider.[name]` |

**Organisms and above are not library concepts.** Anything domain-aware (a product card, a cart summary, a checkout form) is an app-side screen component or an app-registered variant. It never ships in the component library. This bounds the library and answers the question: there is no `organism/` folder because organisms are app concerns.

The composite tier exists because real design systems have deeper composition chains than atom-molecule can express. A `DataTable` composes `Table` which composes `TableRow` which composes `TableCell`. The boundary that matters is unchanged: **no domain knowledge**. A composite is still generic. A product card and a checkout form remain app concerns.

The four-bucket exception model (below) handles components that deviate from the canonical set.

---

## Atom Set

The canonical atom set wraps primitive React Native elements. Each atom maps props to utility classes and applies accessibility behavior.

| Atom | RN element | Key props |
|---|---|---|
| `View` | `View` | Layout, background, padding, margin |
| `Text` | `Text` | Size, color, weight, family |
| `Button` | `Pressable` | Variant, size, state, onPress, accessibilityLabel |
| `Icon` | `Text` (vector icon) | Name, size, color |
| `Image` | `Image` | Source, resize, aspect |
| `TextInput` | `TextInput` | Value, placeholder, state, accessibilityLabel |
| `Toggle` | `Switch` | Value, onValueChange, state |
| `Badge` | `View` | Count, color, position |
| `Separator` | `View` | Orientation, color |
| `ProgressBar` | `View` (animated) | Value, color, size |

Adding an atom is a library change. The atom must follow the authoring contract, consume tokens through utility classes, and include accessibility behavior.

---

## Molecule Set

Molecules compose atoms with interaction logic. A molecule coordinates state across its child atoms but carries no domain knowledge.

| Molecule | Composes | Interaction |
|---|---|---|
| `ButtonPrimary` | Icon + Text + Button | Hover/press/disabled state resolution, icon + label layout |
| `Dropdown` | Button + View + Text | Open/close state, selection, accessibility focus management |
| `Modal` | View + Text + Button | Visibility state, backdrop, focus trap |
| `Card` | View + Text + Image | Layout, optional press state |
| `ListItem` | View + Text + Icon + Separator | Selection, swipe actions, accessibility role |

Adding a molecule is a library change. The molecule must compose atoms only, consume tokens through utility classes, and include accessibility behavior for its interaction pattern.

---

## Composite Set

Composites compose atoms, molecules, and other composites with coordination logic. A composite coordinates state across its children through React Context, not through prop drilling or `React.Children.map`. Examples include `Tabs`, `Accordion`, `Menu`, `DataTable`, `RadioButtonGroup`.

| Composite | Composes | Coordination |
|---|---|---|
| `Menu` | MenuItem, View | Context for active item, roving tab index |
| `Tabs` | Tab, TabList, TabPanel | Context for active tab, aria-controls wiring |
| `Accordion` | AccordionItem | Context for expanded state |
| `DataTable` | Table, TableRow, TableCell | Headless render-prop API for sort/select/expand |

Adding a composite is a library change. The composite must use Context for parent-child coordination (never `React.Children.map` plus `cloneElement`, which breaks when children are wrapped in `React.memo` or `forwardRef`). Contexts are created once per loader instance, not inside `build`, so a `rebuild` does not orphan mounted Consumers.

---

## Provider Set

Providers are context-only components that render no visual output and consume no tokens. They are registered at `Component.provider.[name]`, matching the existing `Component.variant` and `Component.freeform` namespacing. They do not count toward the flat top-level key count.

| Provider | Purpose |
|---|---|
| `OverlayHost` | Overlay stacking and z-index management |
| `LiveRegionProvider` | Screen reader announcements through aria-live regions |
| `Layer` | Elevation level context for nested surfaces |
| `Theme` | Theme override context for subtrees |
| `FeatureFlags` | Feature flag context for conditional rendering |
| `IdPrefix` | ID prefix context for scoped id generation |
| `FluidForm` | Form-level context for fluid label positioning |
| `ErrorBoundary` | Error boundary for component subtrees |

Adding a provider is a library change. The provider must be a Context provider, not a visual component. `ErrorBoundary` is the one component in the package that must be a class, because `componentDidCatch` has no hook equivalent.

---

## Authoring Contract

Every component is a loader module. The library entry point is `combineComponent(Lib, theme)`, which builds the themed component set.

The contract:

1. `combineComponent(Lib, theme)` generates `CommonStyle` (the utility style map for the current theme), builds the HOC, and wires every component via `make(factory)`
2. Each component factory is `function (Component, CommonStyle, theme, Lib)` returning a React component
3. The component maps props to utility classes: `size` to `font_size_[step]`, `color` to `font_[token]`, `weight` to `font_weight_[name]`
4. Molecules compose atoms through the shared `Component` object, not through direct `require`
5. Atoms strip `isRtlActive` so it never leaks to the DOM on web

The HOC (`componentHoc.js`) injects `isRtlActive` into every component. Atoms consume it for directional logic and strip it from props before rendering. Molecules consume it and pass it to child atoms.

`updateComponentTheme(newTheme)` re-derives `CommonStyle` and re-wires every component without unmounting the tree. This is the runtime re-theming mechanism.

---

## Utility-Class Mapping

Components read named utility classes rather than inline token lookups. The mapping is deterministic:

| Prop | Utility class | Example |
|---|---|---|
| `size` | `font_size_[step]` | `size="md"` to `font_size_md` |
| `color` | `font_[token]` | `color="text_primary"` to `font_text_primary` |
| `weight` | `font_weight_[name]` | `weight="semibold"` to `font_weight_semibold` |
| `background` | `background_[token]` | `background="app_primary"` to `background_app_primary` |
| `padding` | `p_[side]_[step]` | `padding="a_md"` to `p_a_md` |
| `margin` | `m_[side]_[step]` | `margin="t_lg"` to `m_t_lg` |
| `radius` | `br_[step]` | `radius="pill"` to `br_pill` |

Spacing utilities use logical sides (`s`/`e`) for RTL. See [Theming](theming.md) for the full utility style reference.

---

## Four-Bucket Exception Model

Real apps need disciplined deviation and a clean way to abandon the token system entirely. The four-bucket model handles both.

| Bucket | Location | Token access | Registry | Re-themes |
|---|---|---|---|---|
| **Canonical** | `atom/`, `molecule/`, or `composite/` | Full token access via `CommonStyle` | `Component.[name]` | Yes |
| **Provider** | `provider/` | No token access. Context only | `Component.provider.[name]` | No |
| **Structured variant** | `variant/` | Full token access via `CommonStyle` | `Component.variant.[name]` | Yes |
| **Unstructured freeform** | `freeform/` | No token access. No `CommonStyle`. Raw styles only | `Component.freeform.[name]` | No |

### Canonical

The default. Atoms and molecules reading tokens through utility classes. This is the normal case.

### Structured variant

A different composition of the same atoms with the same tokens. Example: an outlined button variant shares `Button` + `Text` atoms but changes the background and border resolution. The variant is registered in `Component.variant` so it is discoverable. It re-themes when the theme changes because it reads the same `CommonStyle`.

### Unstructured freeform

A component that opts out of the token system entirely. It receives no `CommonStyle`, no theme, no tokens. It takes raw styles only. It lives in `Component.freeform`, a fenced namespace. It does not re-theme.

The freeform bucket exists for components that cannot conform: a marketing hero, a chat bubble, a one-off animation. A future lint rule flags imports from `freeform/` so its use is a conscious decision.

The rules are testable constraints:

- A canonical component must not import from `variant/` or `freeform/`
- A provider component must register in `Component.provider` and render no visual output
- A variant component must register in `Component.variant`
- A freeform component must not receive `CommonStyle` or `theme`
- A freeform component must not appear outside `Component.freeform`

---

## Interaction States

Every interactive component supports six states. The state names align with Carbon's interaction-state specifications.

| State | Meaning | Visual treatment |
|---|---|---|
| `enabled` | Default resting state | Base token values |
| `hovered` | Pointer over the component | `pseudoHover` color operation (lightens dark colors, darkens light ones) |
| `pressed` | Component is being pressed | `pseudoPress` color operation (stronger shift than hover) |
| `focused` | Component has keyboard or screen-reader focus | Focus ring or outline |
| `disabled` | Component is non-interactive | `disabled` color operation (45% original + 55% white) |
| `loading` | Component is performing an async action | Non-interactive, announces `aria-busy`, renders a `Loading` or `Skeleton` |

The themer engine derives pseudo-state colors from base colors through the template's color operations. Components resolve the active state from interaction events and select the corresponding utility class or token.

The `focused` state is the accessibility-visible state. It must render a visible focus indicator on every platform, including web (keyboard navigation) and native (VoiceOver/TalkBack focus).

---

## Accessibility Contract

Components meet the accessibility contract through `aria-*` props, which React Native 0.71+ accepts as first-class aliases and React Native Web forwards to the DOM. State and value semantics are expressed through `aria-*` props, never through the deprecated `accessibilityState` or `accessibilityValue` props, which React Native Web does not forward to the DOM. `accessibilityRole` and `accessibilityLabel` remain correct and are used directly.

| Requirement | Implementation |
|---|---|
| **Roles** | `accessibilityRole` prop on every interactive component. Maps to ARIA role on web |
| **Labels** | `accessibilityLabel` on every component lacking a visible text label |
| **State announcement** | `aria-checked`, `aria-expanded`, `aria-disabled`, `aria-selected`, `aria-invalid`, `aria-pressed`, `aria-current` through the `a11y` translator |
| **Value semantics** | `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-valuetext` through the `a11y` translator |
| **Relationships** | `aria-controls`, `aria-labelledby`, `aria-describedby`, `aria-owns`, `aria-activedescendant` through the `a11y` translator |
| **Focus management** | Overlays that open/close (Modal, Dropdown, Popover) trap focus and restore on close |
| **Hit target** | Minimum 44x44 points on interactive components (iOS HIG), 48x48 dp (Android Material) |
| **Focus indicator** | Visible focus ring or outline in the `focused` state |

### No-op props on web

The following React Native accessibility props are silent no-ops on web and must not be used. Use the `aria-*` equivalent instead.

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

`aria-*` is the one form that works on web, iOS, and Android. However, native platforms have gaps: `aria-live` is Android-only on native, `aria-modal` is iOS-only, and native has no table, tabpanel, or landmark roles. The library routes every gap through a mechanism (such as `useAnnounce` for live regions) rather than leaving it to individual component judgment.

---

## Divergences from Carbon

The library follows Carbon's component vocabulary but not its export shape. Four deliberate divergences:

1. **Skeletons collapse to one atom plus a `loading` prop.** Carbon ships approximately 20 `<X>Skeleton` components. The library ships one `Skeleton` atom with a `variant` prop (`'text' | 'icon' | 'placeholder'`) plus `lines`, `width`, `height`. Components that need a loading state take a `loading` boolean and render `Skeleton` internally. This replaces 20 components with 1 atom and 1 prop.

2. **`Fluid*` variants collapse to a `fluid` prop.** Carbon's 10 `Fluid*` components are behaviorally identical to their non-fluid counterparts; the only difference is that the label sits inside the field. Ship one `fluid` boolean prop on `TextInput`, `TextArea`, `NumberInput`, `Search`, `Select`, `Dropdown`, `ComboBox`, `MultiSelect`, `DatePicker`, `TimePicker`.

3. **Deprecated button aliases collapse to a `kind` prop.** Carbon's `PrimaryButton`, `SecondaryButton`, `DangerButton` are aliases. The library ships one `Button` atom with a `kind` prop.

4. **Six renames to avoid collisions with React Native concepts.** Carbon's `Switch` (a segment inside `ContentSwitcher`) becomes `ContentSwitcherItem`. React Native's on/off toggle concept becomes `Toggle`. Carbon's `ProgressIndicator` (a multi-step stepper) becomes `ProgressSteps`. The determinate bar becomes `ProgressBar`. These renames are breaking but the library is unpublished, so no deprecation window is required.

---

## Generic vs Custom

The library ships generic atoms and molecules. Apps register their own variants and freeform components alongside the generic set.

Example: a restaurant suite has a POS application and a customer ordering application. Both share the same atom set (Text, Button, Icon, Image). The POS uses large-touch variant buttons (a structured variant with bigger hit targets and higher contrast). The ordering app uses the canonical button. Both variants read the same tokens; they differ at the molecule and variant layer.

App-registered variants live in the app's source, not in the library. The library provides the generic set and the extension points (`Component.variant`, `Component.freeform`). The app populates them.

---

## Peer Dependencies

The component library declares its runtime dependencies as peer dependencies. The host app (the Expo project at `src/client/`) provides them.

| Dependency | Why it is a peer |
|---|---|
| `react` | The host owns the React version |
| `react-native` | The host owns the RN version (via Expo SDK) |
| `@expo/vector-icons` | The host owns the icon set |

The library never bundles these. Test apps inside the library pin real versions as dev dependencies for isolation.

---

## Further Reading

- [Theming](theming.md) - The themer that produces the tokens components consume
- [Client Loader](client-loader.md) - How `combineComponent` enters the boot chain
- [Client Architecture](client-architecture.md) - Why the library targets React Native Web
- [Client Modules](client-modules.md) - The naming taxonomy for the component library package
