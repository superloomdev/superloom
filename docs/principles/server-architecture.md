# Server Architecture

The server side of a Superloom application uses a layered architecture: thin transport interfaces at the edge, thin controllers behind them, all business logic in a service layer, and a pure model layer shared across the system. The structure is Model-View-Controller adapted for APIs, with a dedicated service layer so controllers stay genuinely thin. This document states the pattern and its reasoning; it is language-independent by design.

## On This Page

- [Why This Pattern](#why-this-pattern)
- [The Layers](#the-layers)
- [Request Flow](#request-flow)
- [The One-Shape Rule for Data Transfer](#the-one-shape-rule-for-data-transfer)
- [Layer Dependency Rules](#layer-dependency-rules)
- [Comparison with Alternatives](#comparison-with-alternatives)
- [Language Implementations](#language-implementations)

---

## Why This Pattern

**It is universally understood.** MVC with a service layer is the most widely recognized server structure in the industry. A developer joining a project orients immediately; an AI agent trained on decades of MVC code generates idiomatic contributions on the first attempt.

**It solves the fat-controller collapse.** Classic MVC gives business logic no home, so it accumulates in controllers until they are thousands of lines of tangled parsing and rules. The dedicated service layer is the home. Controllers translate and delegate; services think.

**It makes transport a detail.** Because business logic lives below the transport boundary, the same services run behind an HTTP server, a serverless function, a webhook handler, a cron job, or a CLI, with no branching inside them. This is what makes the framework's build-once-run-anywhere goal real rather than aspirational.

## The Layers

| Layer | Does | Does not do |
|---|---|---|
| **Interface** | Converts a transport-specific input (HTTP request, serverless event, webhook payload) into the standardized internal request, and the standardized response back out | Business logic, validation, data access |
| **Controller** | Extracts input, runs model validation, builds the data transfer object, delegates to the service, maps the result to a standard response | Business logic, data access, transport concerns |
| **Model** | Defines data shapes, builders, validation rules, and the domain error catalog; pure and free of input/output | Data access, transport, orchestration |
| **Service** | Executes business rules and orchestrates operations across helper modules (database, cache, queue) | Transport concerns, raw request parsing |

Each layer has exactly one job. Anything outside that job belongs in a different layer, and the question "where does this code go" always has one answer.

Controllers are held to a size discipline: an action is a short, uniform sequence (extract, validate, build, delegate, map) of a few dozen lines. A controller growing past that is business logic leaking upward.

## Request Flow

```
Client request
  -> Interface   (transport adapter: standardize the input)
  -> Controller  (extract, validate via model, build DTO, delegate)
  -> Service     (business rules; helper modules via the container)
  <- envelope    { success, data | error }
  <- Interface   (convert the envelope to the transport's response format)
```

The envelope in the middle is the same structured result every helper module returns; see [Error Handling](error-handling.md). One envelope shape from the deepest module to the interface boundary means no translation layers and no information loss on the way up.

## The One-Shape Rule for Data Transfer

Data crosses layer boundaries in **data transfer objects** (DTOs), and each entity has exactly **one** canonical DTO builder used for create, update, and read alike. The difference between operations is which fields are populated, not which builder is called.

Three rules carry the discipline:

- **Absent means absent.** A field that was not provided does not appear in the object at all: not as null, not as a placeholder. This preserves the distinction between "not sent" and "set to empty", which matters most on partial updates.
- **Public shapes derive from internal shapes.** The outward-facing version of an entity is produced by filtering the full internal object, never rebuilt from scratch. A subset cannot drift from its superset.
- **Explicit fields over passthrough.** The builder names every field it accepts. The signature is the documentation of the shape; a builder that accepts an opaque object hides the contract.

Server-only fields extend the shared base shape by composition: the base model defines the shape all platforms share, and the server model layer adds its fields on top without redefining the base.

## Layer Dependency Rules

Dependencies point strictly downward:

```
Interfaces  ->  Controllers  ->  Models + Services  ->  Helper modules  ->  Wrapped external libraries
```

- A controller never calls another entity's service directly; cross-entity orchestration is a service-layer concern.
- A model imports nothing from the server layers; it is pure and shareable with clients.
- No layer above the helper modules imports an external library; see [Third-Party Libraries](third-party-libraries.md).

The rules are mechanical enough to check in review: an import statement that points sideways or upward is wrong regardless of the justification.

## Comparison with Alternatives

| Approach | Strength | Why not chosen |
|---|---|---|
| **MVC + Service (this framework)** | Universal recognition, strict boundaries, AI-friendly | Slightly more files per entity, accepted deliberately |
| Hexagonal / ports-and-adapters | Very clean separation | Heavier ceremony than most applications need; far less training data for AI agents |
| Unstructured serverless functions | Fast start | Duplicated logic across handlers; unmanageable at scale |
| Fat controllers | Fewest files on day one | Business logic tangles with transport; untestable without mocking the transport |

## Language Implementations

| Language | Document |
|---|---|
| JavaScript | [`languages/js/server/`](../languages/js/server/server-loader.md) (loader, interfaces, controllers, services, models) and [`languages/js/dto-philosophy.md`](../languages/js/dto-philosophy.md) |
