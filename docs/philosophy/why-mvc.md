# Why MVC Architecture

Superloom uses a **Model-View-Controller (MVC)** structure adapted for server applications. We add a dedicated **Service** layer for business logic so controllers can stay genuinely thin. This document explains why MVC over the alternatives, what each layer does, and how a request flows from the wire to the response.

## On This Page

- [Why MVC](#why-mvc)
- [Layer Responsibilities](#layer-responsibilities)
- [Why a Separate Service Layer](#why-a-separate-service-layer)
- [Request Flow](#request-flow)
- [Comparison with Alternatives](#comparison-with-alternatives)

---

## Why MVC

### Community Acceptance

MVC is the most widely understood server architecture pattern. Developers joining a Superloom project immediately recognize the separation of concerns. AI coding assistants have been extensively trained on MVC patterns and can generate correct, idiomatic code within this structure on the first try.

### AI-Friendly

Because boundaries are strict and predictable, AI assistants can:

- Generate new entities by following the established pattern
- Modify business logic in the service layer without touching controllers
- Add new transport adapters (GraphQL, gRPC, message queue) without changing any business code
- Reason about a single layer at a time without holding the entire codebase in context

### Clear Boundaries

Every layer has exactly one job. Anything outside that job belongs in a different layer.

## Layer Responsibilities

| Layer | Does | Does NOT do |
|---|---|---|
| **Interface** | Convert transport format (Express request, Lambda event, webhook payload) to and from a standardized internal format | Business logic, validation, database calls |
| **Controller** | Extract input, run model validation, build DTO, delegate to service, map service result to a standard response | Business logic, database calls, transport-specific concerns |
| **Model** | Define data shapes, validation rules, DTO builders, domain error catalog | Database calls, HTTP handling, business orchestration |
| **Service** | Execute business rules, orchestrate operations across helpers (DB, cache, queue, ...) | HTTP handling, transport concerns, raw request parsing |

---

## Why a Separate Service Layer

Classic MVC has only Model, View, and Controller. In server applications this leaves no obvious home for business logic - so it ends up in "fat controllers," which is where most server codebases collapse over time.

**The fat-controller problem:**

- Controllers grow into thousands of lines
- Business logic tangles with request parsing
- Testing business rules requires mocking HTTP objects
- Reusing logic across transports (Express vs Lambda vs CLI vs cron) becomes impossible

**Superloom's adaptation:**

```
Interface (the "View" - but for APIs, not UIs)
  -> Controller (thin adapter, 10-30 lines per action)
    -> Model (validate, build DTO)
      -> Service (the business brain - all orchestration lives here)
```

The service layer is what `Core` is in DDD-style codebases - we just call it Service to match the JavaScript/TypeScript ecosystem convention. Pick one name, use it consistently. We picked `Service` (and the directory is `src/server/service/`).

**Service layer benefits:**

- Controllers stay thin - they only translate, validate, and delegate
- Services receive clean DTOs and return structured `{ success, data }` or `{ success, error }` envelopes
- Testing services requires no HTTP mocking - pass a DTO, check the result
- The same service runs unchanged behind Express, Lambda, a webhook handler, a cron job, or a CLI

---

## Request Flow

```
Client request
  -> Interface (Express route OR AWS Lambda handler)
     1. Convert transport-specific input to a standardized request object
  -> Controller
     2. Extract input from request
     3. Validate using model
     4. Build DTO using model
     5. Delegate to service
     6. Map service result to standard response
  -> Service
     7. Execute business rules
     8. Use helpers (DB, cache, queue, ...) via Lib
     9. Return { success, data } OR { success, error }
  <- Interface converts standard response back into transport-specific format
```

The standardized request and response shapes are documented in [`server-interfaces.mdx`](../architecture/server-interfaces.mdx).

---

## Comparison with Alternatives

| Approach | Pros | Cons |
|---|---|---|
| **MVC + Service (this framework)** | Universal understanding, clear boundaries, AI-friendly | Slightly more files per entity |
| **Hexagonal / Ports & Adapters** | Very clean separation, testable | Heavier ceremony than most projects need; less AI training data |
| **Serverless Functions (no structure)** | Quick to start | Unmanageable at scale; duplicated logic across handlers |
| **Fat Controllers** | Fewer files at first | Untestable, unmaintainable, business logic scattered across HTTP handlers |

## Further Reading

- [DTO Philosophy (JavaScript)](dto-philosophy-js.md) - the one-shape rule for data transfer objects
- [Architectural Philosophy](../architecture/architectural-philosophy.md) - the high-level rules and directory layout
- [Server Interfaces](../architecture/server-interfaces.mdx) - how Express and Lambda adapters share the same controllers
- [Server Loader](../architecture/server-loader.md) - how the `Lib` container wires everything together
