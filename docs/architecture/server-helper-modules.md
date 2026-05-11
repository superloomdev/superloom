# Server Helper Modules

`server-helper-modules` are reusable functions that depend on **server-side technologies** - database drivers, cloud SDKs, the filesystem. They run only in a Node.js or Python server runtime and they are wrappers around the third-party libraries the rest of the application code is forbidden from importing directly.

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

Unlike [`core-helper-modules`](core-helper-modules.md), server helpers are **not** universal - they specifically run in a Node.js or Python server environment.

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

Modules live at `src/helper-modules-server/`. The `server-helper` prefix in the package name and the `helper-modules-server` directory both signal the server-only constraint at every level (file path, package name, npm scope).

For category-based naming (`sql-`, `nosql-`, `nosql-aws-`, `storage-aws-`, `queue-aws-`, ...) see [`code-formatting-js.md`](code-formatting-js.md#module-naming).

---

## Typical Files

Same structure as [core helper modules](core-helper-modules.md#typical-files):

| File | Purpose |
|---|---|
| `[module-name].js` | Public export surface (factory loader) |
| `[module-name].config.js` | Module-specific constants and defaults (no `process.env`) |
| `provider/` | (Optional) vendor-specific implementations |
| `_test/` | Tests, including a `loader.js` and (for service-dependent modules) a `docker-compose.yml` |

---

## Example Modules

| Module | Example Functions |
|---|---|
| `js-server-helper-sql-postgres` | `addRecord`, `updateRecord`, `queryRecords`, `deleteRecord` |
| `js-server-helper-sql-mysql` | Same shape as Postgres helper |
| `js-server-helper-nosql-aws-dynamodb` | `addRecord`, `updateRecord`, `queryRecords`, `deleteRecord`, batch operations |
| `js-server-helper-storage-aws-s3` | `putFile`, `getFile`, `deleteFile`, signed URLs |
| `js-server-helper-queue-aws-sqs` | `sendMessage`, `receiveMessages`, `deleteMessage` |
| `js-server-helper-http` | Outgoing HTTP client (native `fetch` wrapper, multipart support) |
| `js-server-helper-instance` | Per-request instance lifecycle, cleanup hooks, background tasks |
| `js-server-helper-verify` | One-time verification codes (pin, code, token) with a storage-agnostic adapter |
| `js-server-helper-logger` | Compliance-friendly action log with per-row retention (persistent or TTL) and optional IP encryption |
| `js-server-helper-auth` | Session lifecycle and authentication: create, verify, list, remove. Multi-instance per actor_type. Store adapters are separate packages (`auth-store-{postgres,mysql,sqlite,mongodb,dynamodb}`). Optional JWT mode with refresh-token rotation |

---

## Configuration Pattern

Server helper modules load base defaults from a config file and merge loader-injected overrides. Two patterns exist:

| Pattern | When to use |
|---|---|
| **Pattern 2 (Multi-Instance Factory)** | All helper modules. Stateful (connection pool, persistent client, authenticated session) or stateless |
| **Pattern 1 (Singleton Config)** | **Legacy.** Preserved for historical reference only - not used in new modules |

See [`module-structure-js.mdx`](module-structure-js.mdx) for full templates and the rules each pattern follows.

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

- [Core Helper Modules](core-helper-modules.md) - the platform-agnostic foundation layer
- [Module Structure (JavaScript)](module-structure-js.mdx) - the Pattern 2 (Factory) template every server helper follows
- [Module Testing](module-testing.md) - emulator setup and integration testing for service-dependent modules
- [Module Publishing](module-publishing.md) - CI/CD pipeline for `@your-org/*` packages
- [Code Formatting](code-formatting-js.md#aws-and-cloud-sdk-modules) - cloud SDK conventions (lazy load, explicit credentials)
