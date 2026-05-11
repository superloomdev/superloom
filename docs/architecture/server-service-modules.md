# Server Service Modules

`server-service` modules contain **all server-side business logic and orchestration**. They are where use cases are implemented - what happens when a controller invokes an action. Services are the brain of the application.

## On This Page

- [Purpose](#purpose)
- [Design Principles](#design-principles)
- [Naming Convention](#naming-convention)
- [Typical Files](#typical-files)
- [Module Initialization Pattern](#module-initialization-pattern)
- [Boundary Rules](#boundary-rules)
- [Further Reading](#further-reading)

---

## Purpose

- Contain **all server-side application and business logic**
- Orchestrate use cases by coordinating between models, server helpers, and other services
- Receive validated DTOs from controllers and return structured envelopes (`{ success, data }` or `{ success, error }`)
- Act as the **brain** of the application - they decide *what happens* when a controller invokes an action

In Domain-Driven Design terminology, this is the layer often called "Application Service" or "Use Case." We use the simpler name `Service` and the directory is `src/server/service/`.

---

## Design Principles

| Principle | Detail |
|---|---|
| **All business rules and orchestration here** | Nowhere else |
| **Receives validated DTOs from controllers** | Never raw request data |
| **Interacts with infrastructure only through `Lib`** | DBs, queues, cloud APIs are reached via injected helper modules |
| **Stateless per request** | No hidden global state |
| **Returns structured envelopes** | `{ success, data }` on success, `{ success, error }` on failure |
| **Transport-agnostic** | Must not know about HTTP, Lambda, Express, or any specific transport |

---

## Naming Convention

| Element | Convention |
|---|---|
| Module directory name | `[entity-name]` (singular) |
| Main file name | `[entity-name].service.js` |
| Location | `src/server/service/` |

For example, the user service lives at `src/server/service/user.service.js`.

---

## Typical Files

| File | Purpose |
|---|---|
| `[entity].service.js` | All service functions for the entity. Each function represents a complete use case or workflow |
| `index.js` | (Optional) public export surface if the service is split into multiple files |

### Typical Function Names

- `createUser(data)` - create a new user
- `getUserById(id)` - fetch user by ID
- `updateUserProfile(data)` - update profile data
- `deleteUser(id)` - soft-delete a user

### Per-Function Responsibilities

| Step | Detail |
|---|---|
| **Execute business rules and policies** | The decisions that make this entity what it is |
| **Coordinate between multiple helpers and models** | DB writes, cache updates, downstream calls |
| **Handle transactional logic** | Multi-step operations that must succeed or fail together |
| **Translate helper-module errors into domain errors** | Mandatory - see [Error Handling](error-handling.mdx) |
| **Return a structured result** | `{ success: true, data: ... }` or `{ success: false, error: ... }` |

---

## Module Initialization Pattern

Services receive `Lib` and `Config` via the loader. They use `Lib` to access helpers and other loaded modules; they use `Config` for environment-specific behavior.

```javascript
// src/server/service/user.service.js
'use strict';

let Lib;
let Config;

const loader = function (shared_libs, config) {

  Lib = shared_libs;
  Config = config;

};

const UserService = {

  createUser: async function (data) {

    // Business rule: check if email already exists
    const existing = await Lib.DB.queryRecords('users', { email: data.email });
    if (existing.length > 0) {
      return { success: false, error: Lib.User.errors.EMAIL_ALREADY_EXISTS };
    }

    // Create record
    const record = await Lib.DB.addRecord('users', data);

    // Return structured result
    return { success: true, data: record };

  }

};

module.exports = function (shared_libs, config) {

  loader(shared_libs, config);
  return UserService;

};
```

---

## Boundary Rules

### Services may be used by

- `server-controller` only

### Services must NOT

- Be called directly by interfaces (must go through controller)
- Access raw request/response objects
- Know about HTTP status codes or transport concerns
- Import client-side code or client helpers

### Services may

- Use `core-helper-modules` (via `Lib`)
- Use `server-helper-modules` (via `Lib`)
- Use `base-model` and `server-model` (via `Lib`)
- Call other services (via `Lib`)

---

## Further Reading

- [Server Controller Modules](server-controller-modules.md) - the layer that calls services
- [Server Common](server-common.md) - bootstrap, config, and the `Lib` container
- [Server Loader](server-loader.md) - how `Lib` is built and entities are registered
- [Error Handling](error-handling.mdx) - the mandatory translation rule (helper envelope -> domain error)
- [Model Modules](model-modules.md) - the model APIs services consume
