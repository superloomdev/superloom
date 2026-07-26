# Theming

> **Language:** JavaScript

The theming pipeline takes a template and a set of values, derives a complete theme, and generates atomic utility styles. The pipeline is pure JavaScript: no CSS variables, no build-time magic, no framework dependency. React bindings arrive through an extension module. This page documents the pipeline, the vocabulary, server-driven theming, and design-language template packs.

## On This Page

- [Pipeline Overview](#pipeline-overview)
- [Vocabulary](#vocabulary)
- [The Template](#the-template)
- [Theme Values: Base and Variant](#theme-values-base-and-variant)
- [Utility Styles](#utility-styles)
- [Runtime Re-Theming](#runtime-re-theming)
- [Server-Driven Theming](#server-driven-theming)
- [React Extension](#react-extension)
- [Design-Language Template Packs](#design-language-template-packs)
- [Further Reading](#further-reading)

---

## Pipeline Overview

The pipeline has four stages:

1. **Template** declares which tokens exist and how each is derived
2. **Values** (base + variant) fill the template with concrete data
3. **Assemble** merges base and variant, then runs the template's derivation rules to produce `{ Color, Dimension, Font }`
4. **Generate utilities** turns the theme into atomic style objects

```text
Template + Values (base + variant)
  |
  v  assemble()
{ Color, Dimension, Font }
  |
  v  generateUtilities()
{ font_size_md, background_app_primary, p_a_md, ... }
```

The engine is a pure producer. It takes data in and returns data out. It never imports a framework, never touches the DOM, and never holds state. This makes it testable in Node without a browser or React.

---

## Vocabulary

The vocabulary is locked. These terms appear in code, documentation, and error messages with one meaning.

| Term | Meaning |
|---|---|
| **Engine** | The label-agnostic operations: color math (mix, lighten, darken, contrast), scale builders (modular, linear), `derive`, `extend`, `assemble`, `generateUtilities`. Knows no `primary`, no `xs`. Zero dependencies |
| **Template** | The opinionated structure built on the engine. Declares named tokens and their derivation rules: color swatches, dimension scales, font roles. The package ships one default template; additional templates are data-only modules |
| **Theme** | The values that fill a template. A theme is `base` + optional `variant`. Pure data, portable, server-sendable |
| **Base** | The complete fallback theme. Every value the template needs is present |
| **Variant** | A partial override. Only the values that differ from base. The variant wins on conflict |
| **Swatches** | The color section's output declarations. Each swatch is a named output color with a derivation rule (`ref` or `operation`) |
| **Scales** | The dimension section's output declarations. Each scale is a named dimension system (fontSize, space, radius) with a type (modular or linear) |
| **Roles** | The font section's ordered list of font roles (primary, secondary). Each role resolves a family name with fallback to the previous role |
| **Presets** | Fixed values merged into a scale as-is, outside the formula (e.g. `pill: 999` for border radius) |
| **Constants** | Scalar values copied straight through to `Dimension` without scale derivation (e.g. `lineHeightRatio`) |

---

## The Template

A template is a data object with three sections. The engine reads each section through a dedicated deriver. The template is the only opinionated layer; the engine is generic.

```js
module.exports = {
  color:     { defaults: { ... }, swatches:  { ... } },
  dimension: { defaults: { ... }, scales:    { ... }, constants: [ ... ] },
  font:      { defaults: { ... }, roles:     [ ... ] }
};
```

Each section has a `defaults` block (the complete fallback values a theme overrides) and a derivation spec named in that section's vocabulary: color `swatches`, dimension `scales`, font `roles`.

The default template ships with the styler module. Authoring a new template is a data-only edit: add colors to `defaults` and rules to `swatches`, add scale steps, append font roles. The engine never changes. The full authoring reference, including every color operation, scale type, and validation rule, lives in the styler module's own documentation.

---

## Theme Values: Base and Variant

A theme is two objects: `base` and `variant`. The `assemble` function merges them (variant wins on conflict) and runs the merged values through the template.

```js
const base = {
  color: { primary: '#0D9488', backgroundPrimary: '#FFFFFF' },
  dimension: { fontBase: 16, fontRatio: 1.2, spaceUnit: 4 },
  font: { primaryFamily: 'Inter' }
};

const variant = { color: { primary: '#FF0000' } };

const theme = Styler.assemble(Styler.defaultTemplate, base, variant);
```

The variant is small. It carries only what changed. This is what makes server-driven theming practical: the server sends a partial JSON object, not a full theme.

---

## Utility Styles

`generateUtilities(theme)` turns a complete theme into a map of atomic style objects. Each utility is a single-purpose style keyed by a naming convention.

| Utility pattern | Example | Produces |
|---|---|---|
| `font_size_[step]` | `font_size_md` | `{ fontSize: 16, lineHeight: 23 }` |
| `font_[colorToken]` | `font_text_primary` | `{ color: '#111827' }` |
| `background_[token]` | `background_app_primary` | `{ backgroundColor: '#0D9488' }` |
| `p_[side]_[step]` | `p_a_md` | `{ padding: 12 }` (a = all sides) |
| `m_[side]_[step]` | `m_t_lg` | `{ marginTop: 16 }` (t = top) |
| `br_[step]` | `br_pill` | `{ borderRadius: 999 }` |

Spacing utilities use logical sides for RTL: `s` (start) and `e` (end) map to `paddingStart`/`paddingEnd` and `marginStart`/`marginEnd`, which mirror automatically under RTL. The side codes are: `a` (all), `h` (horizontal), `v` (vertical), `t` (top), `b` (bottom), `s` (start), `e` (end).

Components read utility styles by name, not by inline token lookup. Re-theming is regenerating the utility map; no component changes.

---

## Runtime Re-Theming

The React extension provides `useThemeController()`, which returns the current theme and an `updateTheme(newVariant)` function. Calling `updateTheme` re-derives the theme and utility styles live, triggering React re-renders throughout the tree.

Each app shape mounts its own `ThemeProvider` with its own base and variant. Switching shapes re-themes the entire subtree. This is the mechanism for per-tenant branding, dark mode, and live accent changes.

---

## Server-Driven Theming

A variant is pure JSON. It can be stored in a database, sent over HTTP, or pushed from a server at runtime. The server `interface`/`channel` record is the runtime override source: it delivers a variant object that the client merges with its base theme.

The contract is one-directional: the server sends data (color values, dimension seeds, font family names). The client owns the template (derivation rules) and the engine (math). The server never sends derivation rules or code.

This separation is what makes the system portable. A server can push `{ color: { primary: '#FF0000' } }` to a client running any template, and the client derives the full set of swatches, pseudo-states, and contrast pairs locally.

---

## React Extension

The core styler module is pure JavaScript. React bindings live in a separate extension module (`js-client-helper-styler-ext-react`) that imports the core and adds React-specific bindings: context, hooks, lifecycle.

| | Core Styler | Extension |
|---|---|---|
| What it is | Pure JavaScript theme engine | React bindings |
| Dependencies | None | React 18+ |
| Exports | Functions (assemble, derive, generateUtilities) | Hooks and provider (ThemeProvider, useTheme, useStyles, useThemeController) |
| Where to use | Anywhere (Node, browser, RN) | React apps only |

The extension is the consumer; the core is the producer. The core never imports a framework. The extension imports the core and wraps its output in React context.

The adapter direction is core to adapter, the opposite of the `http-gateway` pattern (where the core calls the adapter). This means the core's unit tests need no adapter and no stub: they test pure functions with fixture themes.

---

## Design-Language Template Packs

A template pack is a data-only module that ships an alternate template for a specific design language. The first planned pack is Carbon (IBM's design system): an 8px grid, a fixed type ramp, and state specifications mapped to the styler's template schema.

| Concept | What it is |
|---|---|
| Template pack | A data-only module exporting a template object shaped like the default template |
| Naming | `js-client-helper-styler-template-[name]` (e.g. `js-client-helper-styler-template-carbon`) |
| What changes | The template (swatches, scales, roles, defaults). The engine, the component library, and the utility style names stay the same |
| What does not change | Component code, utility style naming convention, the React extension |

Components never change when switching design languages. The template changes. A component reading `font_size_md` gets a Carbon-derived size under a Carbon template and a default-derived size under the default template. The component code is identical.

A host app selects a template by passing it to `assemble`:

```js
const CarbonTemplate = require('@superloomdev/js-client-helper-styler-template-carbon');
const theme = Styler.assemble(CarbonTemplate, base, variant);
```

The full template authoring reference (every key, every operation, every validation rule) lives in the styler module's own `docs/template.md`. This page cross-references it rather than duplicating the schema.

---

## Further Reading

- [Fonts](fonts.md) - The font contract: theme names families, host loads files
- [Components](components.md) - How components consume theme tokens and utility styles
- [Client Loader](client-loader.md) - How the styler enters the `Lib` container
- Styler module `README.md` - Installation and quick start
- Styler module `docs/api.md` - Full API reference
- Styler module `docs/template.md` - Template authoring reference
- Styler module `docs/philosophy.md` - Design philosophy
