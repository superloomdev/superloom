# Core Helper Modules

`core-helper-modules` are the **platform-agnostic, server-safe** helper modules at the foundation of every project. They run unchanged in any JavaScript or Python runtime - browser, Node.js, React Native, Python interpreter - and are published under `@your-org/*`.

## On This Page

- [Purpose](#purpose)
- [Design Principles](#design-principles)
- [Naming Convention](#naming-convention)
- [Typical Files](#typical-files)
- [Example Modules](#example-modules)
- [Boundary Rules](#boundary-rules)
- [Configuration Isolation](#configuration-isolation)
- [Side-Effect Discipline](#side-effect-discipline)
- [Data Shape Independence](#data-shape-independence)
- [Testing and Reuse](#testing-and-reuse)
- [Further Reading](#further-reading)

---

## Purpose

- Provide **generic, reusable, stateless** functions that are universal and platform-agnostic
- Run in **any** environment: browser, React Native, Node.js, Python
- Never depend on server-only APIs (database drivers, AWS SDKs, filesystem writes)
- Never depend on client-only APIs (DOM, `window`, `navigator`, mobile-specific APIs)

This is the layer that everything else stands on. If a function would behave differently in Node.js vs the browser, it does not belong here.

---

## Design Principles

| Principle | Why |
|---|---|
| **Single responsibility per module** | Modules stay small and focused |
| **No business or domain logic** | Reusable across projects |
| **No application logic** | Belongs in the service layer, not in helpers |
| **Pure functions preferred** | Predictable, testable, parallel-safe |
| **Explicit inputs and outputs** | No magic, no hidden context |
| **No hidden state** | Functions return everything they produce |
| **Explicit dependencies only** | Injected via the loader, never reached for |
| **Language-specific implementations** | One module per `[js\|py]` runtime |

---

## Naming Convention

Module directory name: `[js|py]-helper-[module-name]`

The `core-helper-modules` location at `src/helper-modules-core/` makes the platform-agnostic intent visible at the path level.

---

## Typical Files

| File | Purpose |
|---|---|
| `[module-name].js` | Public export surface for the module - exposes only the intended public functions |
| `[module-name].config.js` | (Optional) module-specific constants and rules - defaults only, no `process.env` |
| `provider/` | (Optional) vendor-specific implementations when the helper has multiple backends |

### Provider Folder (Multi-Vendor)

If a helper needs multiple implementations (for example, AWS vs GCP, or Chrome vs Firefox), place them under a `provider/` folder. Provider selection happens via injected config; the helper delegates to the selected implementation.

Adding a new provider (e.g., `gcp`) should require only:

- adding `provider/gcp.js`
- registering it in the helper loader

No changes to application code.

### Configuration

Helpers may support configuration **optionally**, only via **explicit parameters** at construction time (loader arguments). Helpers must never read environment variables, config files, or secret stores directly. If configuration is required, the parent loader provides it.

---

## Example Modules

| Module | Example Functions |
|---|---|
| `[js\|py]-helper-utils` | `isNull`, `isBoolean`, `inArray`, `validateString`, `getUnixTime`, `safeParseJson` |
| `[js\|py]-helper-debug` | `info`, `error`, `performanceAuditLog` |
| `[js\|py]-helper-time` | Date/time math, timezone conversion, formatting |
| `[js\|py]-helper-money` | `sumMoney`, `formatMoney`, `roundMoney`, `compareMoney` |

---

## Boundary Rules

### Platform Neutrality (Hard Rule)

Core helper modules must be **platform-agnostic**. They must NOT:

- Reference any [platform identifier](architectural-philosophy.md#platform-identifiers) (`web`, `rw`, `rn`, `ios`, `and`)
- Import browser APIs (DOM, `window`, `document`)
- Import mobile-specific APIs (Android, iOS, React Native)
- Depend on client runtime assumptions (screen, touch, lifecycle, navigation)

If a helper behaves differently across platforms, it **does not belong** in `core-helper-modules`.

### Runtime Environment Constraints

Core helpers may assume **server or neutral runtime only**.

| Allowed | Disallowed |
|---|---|
| Node.js runtime (for `js` helpers) | UI state |
| Python runtime (for `py` helpers) | Event listeners |
| Standard language libraries | Client lifecycle hooks |
| Pure computation | Rendering logic |
| Network or filesystem access (only if generic and configurable) | User interaction assumptions |

### No Client-State Awareness

All context must be passed explicitly as function arguments. Core helpers must NOT:

- Access `cookies`, `localStorage`, `sessionStorage`
- Assume an authenticated user context
- Read client identity, device, or locale implicitly
- Cache data tied to a user or session

---

## Configuration Isolation

Core helpers must NOT directly read:

- Environment variables
- Config files
- Secret stores

Core helpers must NOT infer configuration from runtime. They may receive configuration only via **explicit parameters**.

The parent loader (in the consuming module) is responsible for:

- Loading configuration values
- Initializing the helper with the relevant config slice
- Holding the initialized state if the helper module is stateful

Configuration loading belongs to:

- Server core modules
- Client modules
- Dedicated config loaders

---

## Side-Effect Discipline

Core helpers must clearly declare side effects.

| Allowed | Disallowed |
|---|---|
| Logging (via `Lib.Debug`) | Implicit global state mutation |
| Database / network operations (via injected helper wrappers) | Silent retries |
| Deterministic file operations | Hidden caching |
| | Background execution |

---

## Data Shape Independence

Core helpers must operate on **generic data structures**. Avoid domain-specific schemas. Avoid UI-specific data shapes.

| Verdict | Example |
|---|---|
| ✅ Allowed | `formatMoney(amount, currency)` |
| ❌ Not allowed | `formatOrderTotal(orderData)` |

---

## Testing and Reuse

- Each helper module has its own unit tests and integration tests
- Each module can be extracted into a standalone open-source package
- A helper module may depend on another helper module, but **no circular dependencies**
- Foundation modules (`js-helper-utils`, `js-helper-debug`) must never depend on each other or on any other helper - see [`peer-dependencies.md`](peer-dependencies.md)

If something is not domain-specific, give it its own helper module instead of putting it in the application core.

---

## Further Reading

- [Server Helper Modules](server-helper-modules.md) - server-only helpers (DB drivers, cloud SDKs)
- [Module Structure](module-structure.md) - the factory pattern every helper module follows
- [Peer Dependencies](peer-dependencies.md) - how foundation modules stay self-contained
- [Module Testing](module-testing.md) - tiers, badges, and CI/CD for helper modules
