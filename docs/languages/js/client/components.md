# Components

> **Language:** JavaScript

The component library ships atoms and molecules: themeable, accessible primitives built on React Native Web. The library is own code, following Superloom's loader pattern and Lib DI throughout. Design languages arrive as themer template packs, not as separate component libraries. This page defines the component vocabulary, the authoring contract, the three-bucket exception model, and the accessibility contract.

## On This Page

- [Component Vocabulary](#component-vocabulary)
- [Atom Set](#atom-set)
- [Molecule Set](#molecule-set)
- [Authoring Contract](#authoring-contract)
- [Utility-Class Mapping](#utility-class-mapping)
- [Three-Bucket Exception Model](#three-bucket-exception-model)
- [Interaction States](#interaction-states)
- [Accessibility Contract](#accessibility-contract)
- [Generic vs Custom](#generic-vs-custom)
- [Peer Dependencies](#peer-dependencies)
- [Further Reading](#further-reading)

---

## Component Vocabulary

The library uses two levels from Brad Frost's atomic design taxonomy. The upper hierarchy (organisms, templates, pages) is deliberately excluded.

| Level | Definition | Boundary |
|---|---|---|
| **Atom** | An irreducible primitive wrapping one RN element with token consumption and accessibility behavior | No composition of other library components. No domain knowledge |
| **Molecule** | A composition of atoms with interaction logic | No domain knowledge. Composes atoms only; never composes other molecules |

**Organisms and above are not library concepts.** Anything domain-aware (a product card, a cart summary, a checkout form) is an app-side screen component or an app-registered variant. It never ships in the component library. This bounds the library and answers the question: there is no `organism/` folder because organisms are app concerns.

The three-bucket exception model (below) replaces the upper hierarchy for handling components that deviate from the canonical set.

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
| `Switch` | `Switch` | Value, onValueChange, state |
| `Badge` | `View` | Count, color, position |
| `Separator` | `View` | Orientation, color |
| `ProgressIndicator` | `View` (animated) | Value, color, size |

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

## Three-Bucket Exception Model

Real apps need disciplined deviation and a clean way to abandon the token system entirely. The three-bucket model handles both.

| Bucket | Location | Token access | Registry | Re-themes |
|---|---|---|---|---|
| **Canonical** | `atom/` or `molecule/` | Full token access via `CommonStyle` | `Component.[name]` | Yes |
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
- A variant component must register in `Component.variant`
- A freeform component must not receive `CommonStyle` or `theme`
- A freeform component must not appear outside `Component.freeform`

---

## Interaction States

Every interactive component supports five states. The state names align with Carbon's interaction-state specifications.

| State | Meaning | Visual treatment |
|---|---|---|
| `enabled` | Default resting state | Base token values |
| `hovered` | Pointer over the component | `pseudoHover` color operation (lightens dark colors, darkens light ones) |
| `pressed` | Component is being pressed | `pseudoPress` color operation (stronger shift than hover) |
| `focused` | Component has keyboard or screen-reader focus | Focus ring or outline |
| `disabled` | Component is non-interactive | `disabled` color operation (45% original + 55% white) |

The themer engine derives pseudo-state colors from base colors through the template's color operations. Components resolve the active state from interaction events and select the corresponding utility class or token.

The `focused` state is the accessibility-visible state. It must render a visible focus indicator on every platform, including web (keyboard navigation) and native (VoiceOver/TalkBack focus).

---

## Accessibility Contract

Components meet the accessibility contract through React Native's built-in accessibility props, which React Native Web maps to DOM ARIA attributes.

| Requirement | Implementation |
|---|---|
| **Roles** | `accessibilityRole` prop on every interactive component. Maps to ARIA role on web |
| **Labels** | `accessibilityLabel` on every component lacking a visible text label |
| **State announcement** | `accessibilityState` for selected/expanded/disabled states |
| **Focus management** | Molecules that open/close (Modal, Dropdown) trap focus and restore on close |
| **Hit target** | Minimum 44x44 points on interactive components (iOS HIG), 48x48 dp (Android Material) |
| **Focus indicator** | Visible focus ring or outline in the `focused` state |

The accessibility patterns follow gluestack's headless component approach as a study reference: behavior and accessibility logic are separated from visual styling, so the same component works with any template pack. The library implements these patterns in its own code rather than wrapping gluestack.

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
