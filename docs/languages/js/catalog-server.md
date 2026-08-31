# Server Helper Modules

`catalog-server` are reusable functions that depend on **server-side technologies** - database drivers, cloud SDKs, the filesystem. They run only in a Node.js or Python server runtime and they are wrappers around the third-party libraries the rest of the application code is forbidden from importing directly.

## On This Page

- [Purpose](#purpose)
- [Design Principles](#design-principles)
- [Naming Convention](#naming-convention)
- [Typical Files](#typical-files)
- [Example Modules](#example-modules)
- [Configuration Pattern](#configuration-pattern)
- [Relationships](#relationships)
- [Further Reading](#further-reading)

---
## Purpose

- Provide **reusable functions** that depend on server-side technologies
- Encapsulate interactions with external infrastructure: databases (SQL, NoSQL), cloud services (AWS, GCP), filesystems, message queues
- Wrap third-party libraries so application code never imports `pg`, `mongoose`, `aws-sdk`, etc. directly

Unlike [`catalog-core`](catalog-core.md), server helpers are **not** universal - they specifically run in a Node.js or Python server environment.

---

## Design Principles

| Principle | Detail |
|---|---|
| **Same shape as core helpers** | Stateless or factory-instantiated, explicit inputs, single responsibility, same `config.js` and `provider/` conventions |
| **Server-native dependencies allowed** | May import `aws-sdk`, `pg`, `mongoose`, etc. - this is the layer where wrapping happens |
| **Server-only runtime** | Node.js or Python only - never executed in browsers or React Native |
| **No client logic** | Must not contain UI rendering or browser-specific code |
| **No business logic** | Belongs in the service layer, not in helpers |

---

## Naming Convention

Module directory name: `[js|py]-server-helper-[module-name]`

In the JS implementation repository, these live at `src/helper-modules-server/`. The `server-helper` prefix in the package name and the `helper-modules-server` directory both signal the server-only constraint at every level (file path, package name, npm scope).

For category-based naming (`sql-`, `nosql-`, `nosql-aws-`, `storage-aws-`, `queue-aws-`, ...) see [`code-formatting.md`](code-formatting.md#module-naming).

---

## Typical Files

Same structure as [core helper modules](catalog-core.md#typical-files):

| File | Purpose |
|---|---|
| `[module-name].js` | Public export surface (factory loader) |
| `[module-name].config.js` | Module-specific constants and defaults (no `process.env`) |
| `provider/` | (Optional) vendor-specific implementations |
| `_test/` | Tests, including a `loader.js` and (for service-dependent modules) a `docker-compose.yml` |

---

## Example Modules

See individual module READMEs for function signatures and usage examples.

---

## Configuration Pattern

Server helper modules load base defaults from a config file and merge loader-injected overrides. Two patterns exist:

| Pattern | When to use |
|---|---|
| **Pattern 2 (Multi-Instance Factory)** | All helper modules. Stateful (connection pool, persistent client, authenticated session) or stateless |

See [`module-structure.md`](module-structure) for full templates and the rules each pattern follows.

---

## Relationships

| Relationship | Detail |
|---|---|
| **May use core helpers** | E.g., a database wrapper uses `js-helper-utils` to validate input shapes before saving |
| **May use other server helpers** | E.g., a service that uses S3 internally |
| **Used by server side only** | Never imported from `src/model/` or `src/model-client/` |
| **No circular dependencies** | Module A may depend on Module B, but B may not depend on A |

---

## Further Reading

- [Core Helper Modules](catalog-core.md) - the platform-agnostic foundation layer
- [Module Structure (JavaScript)](module-structure) - the Pattern 2 (Factory) template every server helper follows
- [Module Testing](module-testing.md) - emulator setup and integration testing for service-dependent modules
- [Module Publishing](publishing.md) - CI/CD pipeline for `@your-org/*` packages
- [Code Formatting](code-formatting.md#aws-and-cloud-sdk-modules) - cloud SDK conventions (lazy load, explicit credentials)
