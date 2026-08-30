# Super-App Shapes

> **Language:** JavaScript

A super-app project hosts multiple application shapes (POS, kiosk, ordering, dashboard) over a shared core. Each shape is a route tree. The project assembles in two modes: lean (one shape, build-time selection, tree-shaken) or super (multiple shapes, runtime selection, launcher). This page documents the shape registry, the assembly modes, and the tree-shaking boundary.

## On This Page

- [Shape Registry](#shape-registry)
- [Shape Determination](#shape-determination)
- [Route Wrappers](#route-wrappers)
- [Lean Assembly](#lean-assembly)
- [Super Assembly](#super-assembly)
- [Tree-Shaking Boundary](#tree-shaking-boundary)
- [Fleet Provisioning](#fleet-provisioning)
- [Further Reading](#further-reading)

---

## Shape Registry

A shape is a route tree with its own theme, screens, and navigation. The shape registry holds metadata for each shape: name, route entry, theme variant, and display information for the launcher.

The registry lives in `src/client/superApp.js`. Each entry maps a shape name to its metadata:

| Field | Purpose |
|---|---|
| `name` | Display name for the launcher |
| `route` | Entry route path (e.g. `/shape-a`, `/shape-b`) |
| `variant` | Theme variant for this shape |
| `icon` | Icon name for the launcher card |

Adding a shape requires three things: a registry entry, an `app/[shape]/` route folder, and a seed file. The shape's screens live in `src/screens/[shape]/`.

---

## Shape Determination

`determineApp()` reads the configured mode and returns the appropriate entry:

| Mode | Config | Returns |
|---|---|---|
| `lean` | `MODE: 'lean'` + `SHAPE: 'shape-a'` | The configured shape's route |
| `super` | `MODE: 'super'` | `{ mode: 'super' }` (launcher renders) |

The entry file (`app/index.js`) calls `determineApp()`. In lean mode, it redirects to the shape's route. In super mode, it renders the launcher: a card per shape, each a link into the shape's route.

---

## Route Wrappers

Every file in `app/` is a route. Routes are zero-logic wrappers that re-export screen components from `src/screens/`.

```js
// app/shape-a/index.js
export { default } from '../../../src/screens/shape-a/ShapeAScreen';
```

The wrapper exists for two reasons:

1. **File-based routing.** Expo Router's static analysis, deep links, and typed routes require files in `app/`
2. **Reusable screens.** The actual UI lives in `src/screens/`, shareable across shapes. A screen can appear in two apps by pointing two wrappers at the same source

The rule: `app/` wrappers contain one line. No logic, no UI, no hooks. All params and logic go inside the `src/screens/` component.

---

## Lean Assembly

Lean mode builds one shape. The build includes only that shape's routes, screens, and dependencies. The result is a single-purpose app with no launcher, no shape switching, and no code from other shapes.

Lean is the default for customer-facing apps. An ordering app shipped to customers contains only the ordering shape. No POS code, no kiosk code, no dashboard code enters the bundle.

---

## Super Assembly

Super mode builds all registered shapes into one app. The launcher screen presents a card per shape. Selecting a shape navigates to that shape's route tree, which mounts its own `ThemeProvider` with its theme variant.

Super is the default for venue devices. A kiosk in a restaurant runs the super build and selects the appropriate shape at runtime based on provisioning or device configuration.

The same core serves both modes. Lean and super are assembly choices, not architecture forks. The shared core (components, theme engine, SDK, utilities) is identical. Only the entry point and the set of included shapes differ.

---

## Tree-Shaking Boundary

The tree-shaking rule is a hard boundary: a shape's routes import only that shape's screens.

```text
app/shape-a/         → src/screens/shape-a/
app/shape-b/         → src/screens/shape-b/
app/shape-c/         → src/screens/shape-c/
```

Because `app/shape-a/` imports only from `src/screens/shape-a/`, building shape-a in lean mode produces a bundle with zero shape-b code. Clean dependency graph per shape produces tree-shaking as a natural outcome. No extra configuration is needed.

The boundary is enforced by the import graph. A screen in `src/screens/shape-a/` must not import from `src/screens/shape-b/`. Cross-shape sharing happens through the shared core (`src/components/`, `src/sdk/`, `src/schemes/`), never through direct screen-to-screen imports.

---

## Fleet Provisioning

| Device type | Assembly mode | Shape selection |
|---|---|---|
| Customer phone | Lean | Build-time: one shape baked into the app |
| Venue kiosk | Super | Runtime: launcher or provisioning config selects the shape |
| Venue tablet | Super | Runtime: launcher or provisioning config selects the shape |
| Dashboard workstation | Lean or super | Build-time or runtime, depending on deployment |

The fleet provisioning model: customer apps ship lean builds (small bundles, no launcher). Venue devices run super builds (one binary, runtime shape selection, fleet management).

---

## Further Reading

- [Client Architecture](client-architecture.md) - The project layout that enables shape isolation
- [Client Loader](client-loader.md) - How `determineApp` enters the boot chain
- [Theming](theming.md) - Per-shape theme variants
- [Components](components.md) - The shared component library used across all shapes
