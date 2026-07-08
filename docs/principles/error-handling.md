# Error Handling

Error handling in this framework is a design contract, not a defensive habit. Every error belongs to one of three categories, each category has exactly one delivery mechanism, and every public operation reports failure in the same envelope shape. A consumer who has handled one module's errors has handled them all. This document states the contract; the language layers fix the exact shapes and syntax.

## On This Page

- [The Three Categories](#the-three-categories)
- [The Throw versus Return Boundary](#the-throw-versus-return-boundary)
- [The Response Envelope](#the-response-envelope)
- [Frozen Error Catalogs](#frozen-error-catalogs)
- [Error Messages](#error-messages)
- [Errors at the Wrapper Boundary](#errors-at-the-wrapper-boundary)
- [Language Implementations](#language-implementations)

---

## The Three Categories

| Category | What it is | Example | Delivery |
|---|---|---|---|
| **Operational error** | An expected failure of the outside world or the input, in a running system behaving correctly | Record not found, code expired, connection refused, invalid user input | **Returned** in the response envelope |
| **Programmer error** | A contract violation by the developer wiring the system | Missing required config key, dependency absent from the container, wrong argument type from a caller inside the codebase | **Thrown** at load or call time, loudly |
| **Unexpected exception** | A defect surfacing at runtime, in the module's own code or an unwrapped path | An undefined property access deep in a handler | **Caught at the boundary**, logged with context, converted to a generic operational error |

The category decides everything downstream: how the error travels, who handles it, and what the message says. Classifying the error is therefore the first design step whenever a failure mode is added.

## The Throw versus Return Boundary

The rule: **operational errors are returned; programmer errors are thrown.** The line between them is bright:

- If a correctly built system could hit the failure in production, it is operational. The caller must be able to handle it in normal control flow, so it arrives as data.
- If the failure means the system was assembled wrong, it is a programmer error. There is nothing meaningful a caller can do at runtime; the right outcome is an immediate, loud stop during development, ideally at initialization before any traffic flows.

This split is why module loaders validate configuration eagerly and throw on violations: a misconfigured module must fail the deploy, not limp into production and return errors on every call. And it is why business operations never throw for foreseeable conditions: exceptions as control flow scatter the handling logic and break the uniform envelope.

## The Response Envelope

Every public operation in every module returns the same structured shape: a success flag, the operation's named data fields, and an error slot.

```
{ success: true,  [data fields populated],  error: null }
{ success: false, [data fields as null],    error: { catalog entry } }
```

Rules that keep the envelope trustworthy:

- **All keys, always.** The failure path carries the same keys as the success path, with data fields explicitly null. A consumer destructures the result without guarding against missing keys.
- **One envelope end to end.** The same shape flows from the deepest helper module through services and controllers to the interface boundary. No layer re-wraps or translates it.
- **The error slot carries a catalog entry**, never a bare string and never a raw exception object.

## Frozen Error Catalogs

Every module that can fail operationally ships an error catalog: the complete, enumerable set of its operational errors, defined in one companion file and frozen against mutation at load time.

- **Each entry has a stable type identifier**, namespaced by the module, that consumers match on. Matching on message text is never supported.
- **Every entry is reachable.** An error defined but never returned by any code path is removed. The catalog documents reality, not intention.
- **Feature modules own the catalog for their adapter family.** An adapter implementing a feature's storage contract receives the parent's catalog by injection and returns the parent's error types, plus only the adapter-specific entries it genuinely adds. Consumers of the feature see one coherent error surface regardless of the backend.
- **Freezing is enforced**, not conventional: the catalog object is made immutable so no code path can alter an error definition at runtime.

## Error Messages

Two audiences, two message disciplines:

- **Operational error messages** are written for the consuming developer handling the failure: plain, specific, stating what happened. They contain no internal file paths and no stack details.
- **Programmer error messages** are written for the developer who made the wiring mistake: they name the module (by its alias, in a fixed prefix format), the exact violated expectation, and what to provide instead. A good programmer error message is a one-line fix instruction.

Both follow the writing contract in [Documentation Authoring](documentation-authoring.md): American English, plain sentences, no filler.

## Errors at the Wrapper Boundary

Third-party libraries throw their own exception types with their own shapes. That behavior stops at the wrapper module: the wrapper catches the library's exceptions, logs the technical detail with context, and returns the framework envelope with an entry from its own catalog. No library exception type ever crosses a module boundary. This is a load-bearing part of the wrap-everything rule in [Third-Party Libraries](third-party-libraries.md): consumers depend on the wrapper's error contract, so replacing the library later cannot change what consumers see.

---

## Language Implementations

| Language | Document |
|---|---|
| JavaScript | [`languages/js/error-handling.md`](../languages/js/error-handling.md) |
