# Composition and Adapters

A general unit defines a port, specific units implement it, and a composition root chooses. This pattern appears at every layer of a Superloom system: a feature module defines a storage contract and a store adapter implements it for one backend; a pure module defines a font-loading contract and an extension implements it for one framework; an application defines navigation and a host adapter implements it for one build target. The industry lineage is Ports and Adapters, the Strategy pattern, and the Dependency Inversion Principle, which are three views of the same idea.

## On This Page

- [The Shape](#the-shape)
- [The Test That Decides](#the-test-that-decides)
- [The Four Tiers](#the-four-tiers)
- [Choosing a Tier](#choosing-a-tier)
- [When a Port Deserves a Parent Module](#when-a-port-deserves-a-parent-module)
- [The Composition Root](#the-composition-root)
- [Validating the Adapter Set](#validating-the-adapter-set)
- [Naming](#naming)
- [Contract Tests](#contract-tests)
- [The Test Tier Is a Host](#the-test-tier-is-a-host)
- [Anti-Patterns](#anti-patterns)
- [In Other Languages](#in-other-languages)
- [Language Implementations](#language-implementations)

---

## The Shape

Three participants form every composition:

| Participant | Owns | May depend on | Must never |
|---|---|---|---|
| **Port** | The contract: function signatures, return shapes, error semantics | Nothing specific to any adapter | Import or reference any adapter |
| **Adapter** | One implementation of the port for one backend, runtime, framework, or host | The port (if a parent module exists), its own driver or SDK | Import another adapter for the same port |
| **Composition root** | The choice: which adapters to wire, in what order | Configuration, the port, every adapter it chooses | Be a module itself, or be duplicated |

The port is the abstraction. The adapter is the concrete. The composition root is the wire. No participant plays two roles.

The port may be an explicit interface in a typed language, a documented protocol in a dynamic one, or a set of function signatures enforced by a contract test suite. The form varies by language; the role does not. A port is always the thing that says "here is what I need" without saying who provides it.

An adapter is complete when it satisfies every function in the port's contract. An adapter that implements a subset is not a partial adapter; it is a defect. The contract is binary: an adapter either fulfills it or does not.

The composition root is the only participant that knows the full set of choices. The port knows the contract. The adapter knows one backend. The composition root knows which backend was selected, which framework is in use, and which build target is running. This is why the choice belongs to the composition root and to nothing else.

---

## The Test That Decides

One question separates an ordinary dependency from a port:

> Can the general unit obtain this itself, or must something above it choose?

A port exists only where more than one implementation is genuinely needed. One correct implementation means an ordinary dependency, not a port. A utility library has one correct implementation everywhere, so it is a dependency. Session storage has one per deployment, so it is a port.

The test is not "could there be a second implementation?" but "is a second implementation genuinely needed?" A second implementation that is theoretically possible but never built is not a justification for a port. The question is practical, not philosophical: if only one implementation will ever ship, the port adds indirection without benefit.

The corollary that makes the test checkable: if a second implementation is neither planned nor plausible, the port is premature. Delete it and use a direct dependency until the second implementation arrives. The cost of extracting a port later is lower than the cost of maintaining an unused abstraction.

---

## The Four Tiers

Every composition in the framework falls into one of five tiers. The first four appear in published modules; the fifth appears in applications.

| Tier | Port defined by | Adapter supplied by | Adapter references the parent | Example shape |
|---|---|---|---|---|
| Driver | A category convention | A published package per external service | No | One wrapper per database engine |
| Store | A feature module | A published package per backend | No | One store per database engine under one feature |
| Transport adapter | A feature module | A published package per runtime | No | One adapter per server runtime under one gateway |
| Extension | A pure parent module | A published package per framework | Yes | One extension per UI framework under one pure core |
| Host adapter | An application's shared source | A file inside each build target | No | One adapter set per build target |

The reference direction (whether the adapter imports the parent or the parent receives the adapter) is an implementation detail, not the classifier. What makes all five the same pattern is that **the general unit never chooses its own adapter.** The composition root chooses, every time.

The extension tier is the only one where the adapter declares the parent as a peer dependency and imports it. Every other tier passes the adapter to the parent at load time, so the parent never knows which adapter is wired. This distinction is structural, not stylistic: an extension consumes its parent's API, so it needs the parent at load time. A store is consumed by its parent, so the parent receives it at load time.

The host adapter tier is the only one where the adapter is not a published package. It lives inside the application's source tree, one set per build target. A mobile build target has its own navigation adapter, its own fonts adapter, and its own icons adapter. A web build target has a different set for the same three ports. The port is defined by the application's shared source, not by a module in a registry.

---

## Choosing a Tier

Five questions, each with one outcome. Answer in order and stop at the first match.

1. **Is the adapter a file inside an application's build target?** If yes, it is a host adapter. Stop.
2. **Does the adapter consume its parent module at load time?** If yes, it is an extension. Stop.
3. **Is the port a data persistence contract owned by a feature module?** If yes, it is a store. Stop.
4. **Is the port a transport or runtime contract owned by a feature module?** If yes, it is a transport adapter. Stop.
5. **Is the port a category convention shared across independent wrappers?** If yes, it is a driver. Stop.

The procedure terminates for every input. No input matches two answers, because each question isolates one property that the others do not share.

The order matters. Host adapter is tested first because it is the broadest: any adapter that lives inside an application's build target is a host adapter, regardless of what it adapts. Extension is tested second because the back-reference (the adapter imports the parent) is a unique structural signal. Store and transport adapter are tested third and fourth because they are distinguished by what the port governs: data persistence versus runtime transport. Driver is the fallback: an adapter that matches none of the above is a driver, wrapping one external service behind a category convention.

---

## When a Port Deserves a Parent Module

A parent module is justified only by logic that is identical across every adapter and worth centralizing. Session lifecycle management, token rotation, and expiry checks are identical regardless of whether sessions are stored in Postgres or DynamoDB, so they live in a parent. Font family resolution and `@font-face` string construction are identical regardless of whether fonts load through a browser, React Native, or Expo, so they live in a parent.

The positive case: a feature module that manages session lifecycle calls a store adapter for persistence. The lifecycle logic, the token format, and the expiry rules are the same regardless of backend. Centralizing them in the parent means each store adapter implements only the eight storage methods the parent calls, not the full session semantics.

The negative case: a set of database wrappers that share a calling convention (`getRow`, `write`, `getValue`) but no business logic. There is nothing to centralize. Each wrapper is a driver, and the application wires the one it needs. A parent module here would be an empty shell whose only function is to exist.

With no such logic, the adapters stand alone and the port is enforced by its consumers and by the composition root. A logging wrapper around different output sinks has no shared logic worth a parent; each sink is a driver, and the application wires the one it needs.

The consequence: extracting a parent module is a decision about shared logic, not about organizing packages. A parent created for organizational reasons, with no shared logic to hold, adds a package, a publish cycle, and a version dependency for nothing. The adapters under it are no easier to use, and the parent's `README.md` has nothing to document.

---

## The Composition Root

The composition root has three responsibilities:

1. **Read configuration.** It is the single place environment values enter the system. No module reads the environment; the composition root reads it once and passes the results as plain data.
2. **Choose adapters.** It selects one adapter per port based on configuration. The selection is deterministic: given the same configuration, the same adapters are wired.
3. **Wire in dependency order.** Foundation modules first, then adapters, then adapter-dependent modules, then the rest. A module that depends on an adapter is never wired before the adapter it depends on.

It has two prohibitions:

- **It is never a module.** A composition root is application code, not a publishable package. A module that chooses adapters for its callers has inverted the dependency direction.
- **It is never duplicated.** One root per application. A second root produces two containers with independent state, which surfaces as a bug that looks like a stale read.

The composition root is the application's boot file. In a server application, it is the loader that builds the dependency container at startup. In a client application, it is the loader that builds the container before the first render. The shape is the same; the timing differs.

---

## Validating the Adapter Set

A composition root validates its adapter set before building anything. A missing or malformed adapter is a programmer error, so it fails immediately rather than surfacing later during use. See [Error Handling](error-handling.md) for the programmer-error category.

An optional adapter is a defect. The reasoning: an optional adapter converts a boot-time failure into a runtime failure at an arbitrary later moment. The first call that touches the missing slot crashes in production with a less helpful message than the boot-time validation would have produced. Making the slot mandatory and failing at boot is always cheaper.

The validation checks two things: presence (is the slot filled?) and shape (does the adapter expose every function the port requires?). A missing slot is a presence failure. An adapter that lacks a function the port calls is a shape failure. Both are programmer errors, both throw at boot, and neither is recoverable at runtime.

The error message names every missing slot in one pass. A host that is missing two adapters gets one error listing both, not two errors on successive boots. One pass, one fix, one restart.

---

## Naming

Three rules bind every tier:

1. **Ports and slots are named for what they do, never for a vendor.** A slot that loads fonts is `Fonts`, not `ExpoFont`. A vendor-named slot re-couples the general unit to that vendor through its own source text even though no import exists, which defeats the reason the dependency was injected.
2. **An adapter package is named for the specific thing it adapts to.** A Postgres store adapter is `auth-store-postgres`, not `auth-store-default`. The name carries the choice the operator is making.
3. **A vendor name appears in exactly one place: the adapter that wraps that vendor.** The vendor appears in the adapter's package name, its direct dependencies, and nowhere else. The port, the composition root, and every other adapter are vendor-free.

The three rules work together. The first rule keeps the port clean. The second rule makes the adapter's name informative. The third rule confines the vendor to the adapter. A violation of any one rule leaks the vendor into a place it does not belong, and the leak spreads: a vendor-named slot in the port forces every adapter to reference the vendor, and a generic adapter name forces every consumer to read the source to learn what it wraps.

The JavaScript layer's function verb catalog, including the `build` / `create` / `generate` distinction that governs adapter factory naming, lives in [`languages/js/function-naming.md`](../languages/js/function-naming.md).

---

## Contract Tests

Every adapter for one port is validated by one shared suite owned by the port. The suite tests the contract, not the backend. A store adapter's contract test verifies that `createSession` stores and `verifySession` retrieves, not that Postgres handles transactions correctly.

The suite runs against every adapter. An adapter that passes its own tests but fails the contract suite has a contract violation, not a test failure. The contract suite is the port's enforcement mechanism; it is how the port asserts its requirements without importing the adapter.

The suite belongs to the port, not to the adapter. A store adapter does not write its own contract test; the feature module that defines the store contract does. The adapter's own test suite covers backend-specific behavior: connection handling, error mapping, schema setup. The contract suite covers the intersection: does this adapter satisfy the port?

See [Testing](testing.md) for the test-tier structure.

---

## The Test Tier Is a Host

A test suite exercising an application supplies its own adapter set and calls the real composition root. It never re-implements the wiring. The test's adapters are stubs: a navigation adapter that renders text, a fonts adapter that resolves immediately, an icons adapter that returns a placeholder.

The reason from experience: a hand-written test fixture that duplicates a composition root drifts from it. The drift surfaces as a test failure that looks like a product bug, and the investigation costs hours before the real cause is found. Using the real composition root with stub adapters eliminates the entire class.

A stub adapter is minimal. It satisfies the port's shape with the simplest possible behavior: a navigation stub that returns a text element, a fonts stub that resolves immediately, an icons stub that returns a placeholder glyph. The stub does not exercise the real backend; it exercises the composition root's wiring, the adapter gate, and the dependency order. If the composition root is correct with stubs, it is correct with real adapters, because the real adapters satisfy the same port.

---

## Anti-Patterns

| Pattern | Symptom | Correction |
|---|---|---|
| Vendor-named slot | `Lib.ExpoFont` in the container | Rename to `Lib.Fonts` or the capability it provides |
| Optional adapter | `if (shared_libs && shared_libs.X)` guard | Make the slot mandatory; fail at boot if absent |
| General unit imports a specific one | A feature module imports a store adapter | The composition root passes the adapter; the feature receives it |
| Duplicated composition root | Two files that each build a container | Delete one; the root is singular |
| Port with one implementation and no prospect of a second | An interface with one implementor and no planned second | Use a direct dependency; extract the port when the second implementation arrives |

---

## In Other Languages

The pattern is language-independent. The mechanism each language family uses to express a port varies:

- A nominally typed language expresses a port as an explicit interface or abstract class
- A dynamically typed language expresses a port as a protocol or structural convention documented in prose and validated by a contract test suite
- A language with traits or typeclasses expresses a port as a trait or typeclass that adapters implement

The injection mechanism varies: a container object in some languages, constructor parameters in others, a service locator in others. The mechanism does not change the doctrine. The composition root chooses, the port defines, the adapter implements, regardless of how the language wires them together.

A language layer that implements this doctrine provides the concrete syntax: the function signatures, the container shape, the validation call, the test fixture pattern. The principles here are the contract the language layer answers. See the Language Implementations table below for the JavaScript implementation.

---

## Language Implementations

| Language | Document |
|---|---|
| JavaScript | [`languages/js/composition-and-adapters.md`](../languages/js/composition-and-adapters.md) |
