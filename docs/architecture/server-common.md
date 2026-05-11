# Server Common

`server-common` is the **server runtime foundation** shared by all server entry points (API, hook, job). It contains the bootstrap logic, configuration loading, dependency wiring, and shared infrastructure helpers. It defines *how the server starts and executes*, not *what the application does*.

## On This Page

- [Purpose](#purpose)
- [Design Principles](#design-principles)
- [File Organization](#file-organization)
- [Standard Files](#standard-files)
- [Boundary Rules](#boundary-rules)
- [Mental Model](#mental-model)
- [Further Reading](#further-reading)

---

## Purpose

- Provide the **server runtime foundation** for all server entry points (API, hook, job)
- Hold bootstrap logic, configuration loading, dependency wiring, shared infrastructure helpers, static fonts, and static data files
- Define **how the server starts, initializes, and executes** - not what the application does
- All server modules may depend on `server-common`, but `server-common` must never depend on domain or business logic

---

## Design Principles

| Principle | Detail |
|---|---|
| **No business or domain logic** | Belongs in `server-service` |
| **No entity-specific workflows** | Belongs in `server-service` |
| **Infrastructure-first** | Concerned with HOW the server runs |
| **Execution-context-aware** | Same code works in Docker and Lambda |
| **Deterministic and predictable initialization** | No surprises on cold start |
| **Explicit dependency loading and injection** | Everything goes through `Lib` |
| **One-time initialization where possible** | Heavy work happens once, not per request |
| **Reusable across APIs, hooks, jobs, workers** | Single foundation for every entry point |
| **Safe in multiple execution environments** | Docker, Lambda, cron, workers |

---

## File Organization

**Directory:** `src/server/common/`

File names are **role-based**, not feature-based. There is no `user.js` here - users live in `model/`, `controller/`, and `service/`.

---

## Standard Files

| File | Role | Detail |
|---|---|---|
| `handler.js` | Runtime Entry Handler | First executable entry point (e.g., Lambda handler). Standalone - no shared dependencies. Executed before the project loader |
| `config.js` | Configuration File | Static configuration defaults and constants. Default environment values. No `process.env` reads |
| `loader.js` | Loader / Bootstrap | Loads configuration (static + environment overrides), initializes shared dependencies (helpers, SDKs, clients), exposes the shared `Lib` and `Config` containers. Full detail in [`server-loader.md`](server-loader.md) |
| `functions.js` | Shared Execution Helpers | Standardizes execution patterns across APIs and services. Wraps request initialization and response formatting. Holds reusable constants, enums, and shared definitions. Example: `successResponse(data)`, `errorResponse(error)` |
| `auth.js` | Auth Module | Validates API authentication (API keys, secrets, cookies). Used by externally exposed endpoints (APIs, hooks). Decides API scope: `public`, `protected`, `admin` |
| `data/` | Static Data Files | Static JSON data files used by the application |
| `font/` | Static Font Files | Font files used by the application |

---

## Boundary Rules

### `server-common` must NOT

- Contain business or domain logic
- Reference entities (user, order, message, ...)
- Implement API endpoints
- Implement cron or job logic directly
- Call into `server-service`, `server-controller`, or `server-interfaces`

### Allowed dependencies

- `core-helper-modules`
- `server-helper-modules`
- External SDKs and libraries

### Disallowed dependencies

- Client code
- Client helper modules

---

## Mental Model

A simple test for whether a piece of code belongs in `server-common`:

| Question | Lives in |
|---|---|
| **"How does the server start and safely execute?"** | `server-common` |
| **"What does the application do?"** | `server-service` |
| **"How is this exposed?"** | `server-interfaces` |

If the answer touches the domain (users, orders, surveys, ...), it does not belong in `server-common`.

---

## Further Reading

- [Server Loader](server-loader.md) - the full bootstrap and dependency injection contract
- [Server Interfaces](server-interfaces.mdx) - how the standardized request/response shapes are wired
- [Server Service Modules](server-service-modules.md) - where the business logic actually lives
- [Architectural Philosophy](architectural-philosophy.md) - the high-level rules
