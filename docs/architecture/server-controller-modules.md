# Server Controller Modules

`server-controller` modules are the **thin adapters** between [`server-interfaces`](server-interfaces.mdx) and [`server-service`](server-service-modules.md). Their job is to translate a standardized internal request into validated DTOs, delegate the work to the service layer, and translate the service's structured result back into a standardized response. Controllers contain **no business logic**.

## On This Page

- [Purpose](#purpose)
- [Design Principles](#design-principles)
- [Naming Convention](#naming-convention)
- [Typical Files](#typical-files)
- [Per-Function Responsibilities](#per-function-responsibilities)
- [Central Entry Rule](#central-entry-rule)
- [Request Flow](#request-flow)
- [Boundary Rules](#boundary-rules)
- [Further Reading](#further-reading)

---

## Purpose

- Act as thin adapters between `server-interfaces` and `server-service`
- Translate **interface-specific input/output** into **service-friendly DTOs** and back
- Validate input, build DTOs, delegate, map results - nothing more
- Convert the interface-specific request format into a standardized internal format and the service result back into a transport-neutral response

---

## Design Principles

| Principle | Detail |
|---|---|
| **Minimal and predictable** | Controllers are 10-30 lines per action |
| **No business or domain logic** | Belongs in the service layer |
| **No database access** | Belongs in the helper modules used by services |
| **No direct calls to external providers** | Wrappers live in helper modules |
| **Explicit inputs and outputs** | Standard request format in, standard response out |
| **Stateless and request-scoped** | No long-lived state inside the controller |
| **Consistent shape across controllers** | Every controller takes and returns the same standardized format |

The interface layer converts the protocol-specific request (Express request, Lambda event, webhook payload) into the standard format. The interface layer also converts the standard response back into the protocol-specific format. Controllers see only the standard shapes.

---

## Naming Convention

| Element | Convention |
|---|---|
| Module directory name | `[entity-name]` (singular) |
| Main file name | `[entity-name].controller.js` |
| Location | `src/server/controller/` |

For example, the user controller lives at `src/server/controller/user.controller.js`.

---

## Typical Files

| File | Purpose |
|---|---|
| `[entity].controller.js` | Contains all controller functions for the entity. Each function represents a single action or use case |
| `index.js` | (Optional) public export surface if the controller is split into multiple files |

### Typical Function Names

- `getDataByID(request)` - fetch a single record
- `create(request)` - create a new record
- `update(request)` - partial update
- `sendOtp(request)` - trigger a one-time-pin flow

---

## Per-Function Responsibilities

Each controller function does exactly six things, in this order:

1. **Required parameter checks** - shape-level checks (is the request body present)
2. **Basic typecasting and trimming** - normalize before validation
3. **Construct input DTOs for the service** - using model-provided DTO builders
4. **Run domain validation** - via `Lib.[Entity].validation.validate*`
5. **Invoke the corresponding service function** - with validated DTOs
6. **Map service results and errors to the standard response format** - attach request metadata (request time, correlation ID)

If a function does anything beyond these six steps, that work belongs in the service layer.

---

## Central Entry Rule

**All server-side entry points** (API, Hooks, Jobs, future Express routes) **must pass through a controller.** Controllers are the single, consistent entry layer into server logic.

The controller uses the [base model and server model](model-modules.md) to:

- Perform **domain sanitization** (canonical formatting)
- Perform **domain validation** (rules, invariants)

It then creates **input DTOs** using model-provided DTO builders, invokes the corresponding **service** functions with the validated DTOs, and maps service outputs and errors to a **transport-neutral response** envelope.

---

## Request Flow

```
Interfaces (API / Hook / Job)
  -> Server Controller
     -> Model / Model-Server (sanitize + validate)
       -> Data creation (DTO builders)
       -> Server Service (orchestration, business logic)
     <- Service result envelope
  <- Standard response envelope
```

Both the request and response shapes are documented in [`server-interfaces.mdx`](server-interfaces.mdx).

---

## Boundary Rules

### Controllers may be used by

- `server-interfaces` only

### Controllers must NOT

- Access database or repositories
- Contain orchestration or workflow logic (belongs to `server-service`)
- Call external providers directly
- Be reused by client applications

### Controllers may

- Read input from the standardized request object
- Run validation via the model layer
- Build DTOs via the model layer
- Delegate to the service layer
- Format the service's structured result into the standard response

---

## Further Reading

- [Server Service Modules](server-service-modules.md) - where business logic lives
- [Server Interfaces](server-interfaces.mdx) - the standardized request and response formats
- [Model Modules](model-modules.md) - DTO builders and validation
- [Validation Approach](validation-approach.md) - how validation runs inside the controller
- [Error Handling](error-handling.mdx) - how the controller forwards domain errors via `Lib.Functions.errorResponse`
