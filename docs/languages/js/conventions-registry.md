# Conventions Registry

> **Language:** JavaScript

A lookup table of settled micro-conventions. One row per settled question, with the answer, evidence, and date settled. A module author scans it in under a minute before inventing a new answer to a solved problem.

## Component Tiers

| # | Question | Settled answer | Evidence |
|---|---|---|---|
| 1 | What tiers does the component library use? | Four tiers: `atom/`, `molecule/`, `composite/`, `provider/`. Atoms compose nothing. Molecules compose atoms only. Composites compose atoms, molecules, and other composites. Providers are context-only, render no visual output | `docs/languages/js/client/components.md` - Component Vocabulary |
| 2 | Where do providers register? | `Component.provider.[name]`, matching `Component.variant` and `Component.freeform` namespacing. Providers do not count toward the flat top-level key count | `docs/languages/js/client/components.md` - Provider Set |
| 3 | What is the exception model? | Four buckets: canonical (atom/molecule/composite), provider, structured variant, unstructured freeform | `docs/languages/js/client/components.md` - Four-Bucket Exception Model |

## Accessibility

| # | Question | Settled answer | Evidence |
|---|---|---|---|
| 4 | How are state and value semantics expressed? | Through `aria-*` props, never `accessibilityState` or `accessibilityValue`, which React Native Web does not forward to the DOM. `accessibilityRole` and `accessibilityLabel` remain correct and are used directly | `docs/languages/js/client/components.md` - Accessibility Contract |
| 5 | Where are aria-* props emitted? | Through the `a11y` translator module (`a11y.state()`, `a11y.value()`, `a11y.relation()`, `a11y.position()`). It is the only module in the package allowed to emit accessibility state/value/relation/position props | `component/a11y.js` |
| 6 | What about the deprecated no-op props on web? | `accessibilityHint`, `accessibilityElementsHidden`, `importantForAccessibility`, `accessibilityViewIsModal`, `AccessibilityInfo.announceForAccessibility`, `LayoutAnimation` are all no-ops on web. Use the `aria-*` equivalent instead | `docs/languages/js/client/components.md` - No-op props on web |

## Naming

| # | Question | Settled answer | Evidence |
|---|---|---|---|
| 7 | Carbon `Switch` vs React Native `Switch` | Carbon's becomes `ContentSwitcherItem`. React Native's on/off toggle concept becomes `Toggle` | `docs/languages/js/client/components.md` - Divergences from Carbon |
| 8 | Carbon `ProgressIndicator` vs `ProgressBar` | Carbon's multi-step stepper becomes `ProgressSteps`. The determinate bar becomes `ProgressBar` | `docs/languages/js/client/components.md` - Divergences from Carbon |
