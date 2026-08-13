# Module Design

A Superloom system is assembled from helper modules: small, independently published packages, each owning one capability behind a stable contract. This document defines the anatomy every module shares, the taxonomy that classifies modules by their dependencies and role, and the composition patterns (drivers, adapters, extensions) that let modules combine without coupling. Language layers implement this contract with exact file names and loader signatures.

## On This Page

- [The Module Contract](#the-module-contract)
- [Universal Companion Files](#universal-companion-files)
- [Dependency Injection and the Container](#dependency-injection-and-the-container)
- [The Class Taxonomy](#the-class-taxonomy)
- [Composition Patterns](#composition-patterns)
- [Configuration Discipline](#configuration-discipline)
- [Module Documentation Set](#module-documentation-set)
- [Language Implementations](#language-implementations)

---

## The Module Contract

Every module, regardless of what it does, satisfies the same contract:

1. **One responsibility.** The module owns one capability. Its name states it.
2. **A loader entry point.** The module is initialized by calling its loader with two things: the shared dependency container and a plain configuration object. Nothing else initializes a module.
3. **A fixed public surface.** The loader returns the module's interface: a set of named functions with documented parameters and return shapes. Everything else is private.
4. **A uniform return envelope.** Public operations return a structured result carrying a success flag, the named data, and an error slot; see [Error Handling](error-handling.md). No public operation communicates by exception in the normal course of business.
5. **Self-contained tests.** The module carries its own test suite, runnable with one command, including any service emulators it needs; see [Testing](testing.md).

The contract is what makes modules interchangeable, mockable, and individually publishable. A consumer knows how to initialize, call, and test any module before reading a line of it.

## Universal Companion Files

A module is not one file. It is an entry file plus three companions, present even when nearly empty:

| Companion | Holds | Why it always exists |
|---|---|---|
| **Configuration** | Default values for every key the module reads, each with a one-line reason | Defaults are documentation; an empty config file states "this module takes no configuration" explicitly |
| **Error catalog** | The module's operational error definitions, frozen against mutation | Consumers match on catalog entries; the catalog is the error contract |
| **Validators** | Configuration and input validation for the module | Validation is part of the module's contract, co-located and hand-written; see [Validation](validation.md) |

Two rules govern the companions:

- **Single-require.** Only the entry file loads the companions. Validators and internal parts receive the error catalog and static data by injection, never by importing them again. One loading point means one initialization order and no hidden coupling.
- **Fixed interface slots.** The module's internal interface constructor receives the container, configuration, error catalog, and validators in fixed positions. Unused slots are kept, not removed; uniformity across modules outranks local minimalism.

## Dependency Injection and the Container

The rule: **a module receives every dependency through its loader, from a shared container assembled once at application start.**

The container holds initialized instances of the foundation modules (utilities, logging), drivers (database, storage, queue clients), and anything else a module declares it needs. A module picks its dependencies from the container by reference. It never constructs its own copies, never imports a sibling module directly, and never receives live objects through configuration keys.

The consequences:

- **Mockability.** A test replaces any dependency by handing the loader a container with a substitute in the right slot.
- **One instance per dependency.** Shared state (connection pools, log levels) lives in exactly one place.
- **Visible wiring.** The application's composition root is one readable file where every module's dependencies are explicit.

Drivers deserve emphasis because they are the recurring temptation: a database client is a dependency, so it arrives in the container like any other. Configuration carries the connection *values*; the container carries the connected *object*.

## The Class Taxonomy

Modules are classified by what they depend on and what depends on them. The taxonomy determines a module's allowed dependencies, its test strategy, and its documentation set:

| Class | Name | Character |
|---|---|---|
| **A** | Foundation | Zero dependencies; pure language; usable everywhere including clients |
| **B** | Extended utility | Depends only on foundation modules; adds a focused capability |
| **C** | Driver wrapper | Wraps one external service driver (database, cache) behind the module contract |
| **D** | Cloud SDK wrapper | Wraps one cloud vendor SDK; class C with credentials and vendor emulators |
| **E** | Feature module | A domain capability (auth, verification, logging) orchestrating drivers through adapters |
| **F** | Dependent adapter | Implements a class E module's storage or transport contract for one specific backend |
| **G** | Feature with extensions | A feature module designed to be bound to frameworks by class H extensions |
| **H** | Extension | Binds a class G module to one framework (React, Vue); imports the parent, never the reverse |
| **I** | Framework module | Standalone and framework-bound; receives its framework by injection; has no pure parent and no extensions |

The dependency direction is strict: higher classes depend on lower ones, never sideways within a class, never upward. Class A modules are the trust anchors; they are held to the highest bar because everything stands on them.

A parent that publishes extension points is Class G, the binding that consumes it is Class H, and a standalone framework-bound module with neither is Class I. The distinction is whether a pure parent exists: Class G plus H splits the framework-free logic from the framework binding so that a second consumer can reuse the pure core; Class I keeps them together because the framework is the only consumer.

## Composition Patterns

Five tiers cover every way modules and applications combine. The full doctrine, including the decision procedure for choosing a tier and the composition root's responsibilities, lives in [Composition and Adapters](composition-and-adapters.md).

**Driver wrapping (classes C and D).** One module wraps one external client and exposes the framework's calling shape. All wrappers for the same category (for example, SQL databases) expose the same surface, making backends hot-swappable at the container level.

**Store adapters (classes E and F).** A feature module defines a storage contract and works against it. Each store adapter implements that contract for one backend. The feature is built and tested first against an in-memory reference; adapters follow, each validated by a shared contract suite. The feature owns the error catalog; adapters receive it by injection.

**Transport adapters (classes E and F).** A feature module defines a runtime contract and works against it. Each transport adapter implements that contract for one server runtime. The pattern is identical to store adapters; the difference is what the port governs.

**Extensions (classes G and H).** When a capability needs framework-specific bindings, the framework-neutral core is one module and each binding is a separate extension. The extension consumes the core: it imports the parent and receives the framework at load time. The parent knows nothing about its extensions.

**Host adapters (application tier).** An application's shared source defines ports for platform capabilities (navigation, fonts, icons). Each build target supplies its own adapter set, one file per port. The composition root validates the set at boot before building anything.

In every tier, the more general unit never imports the more specific one. Specificity always sits at the edge.

## Configuration Discipline

- **Configuration is plain data.** Values only: strings, numbers, booleans, lists. Never functions, clients, or other live objects.
- **Only keys the code reads.** Every key in the defaults file is read somewhere in the module; every key carries a one-line reason. Dead keys are removed, not kept "for later".
- **No environment access inside modules.** Modules receive configuration; they never read the environment. Exactly one file per application (and one per test suite) reads the environment and builds configuration from it.
- **Validated at load.** The module's validators check the merged configuration at initialization and fail loudly on contract violations; see [Error Handling](error-handling.md) on programmer errors.

## Module Documentation Set

Every module ships documentation for two audiences: a human-facing README explaining what the module is and why, and a machine-facing compact reference (in this framework, `ROBOTS.md`) carrying exact signatures and return shapes for AI agents. Modules with substantial surfaces add a reference folder with per-topic documents. The structure, section orders, and per-class requirements are language-layer material; the principle is that **documentation is part of the module, versioned and published with it, and its accuracy is checked in review like code.**

---

## Language Implementations

| Language | Document |
|---|---|
| JavaScript | [`languages/js/module-structure.md`](../languages/js/module-structure.md), [`languages/js/module-classes.md`](../languages/js/module-classes.md), [`languages/js/dependencies.md`](../languages/js/dependencies.md), [`languages/js/module-docs.md`](../languages/js/module-docs.md) |
