# Testing

Tests in this framework are part of the module contract: every module carries its own suite, runnable with one command, self-contained down to the service emulators it needs. The suite is what makes the framework's central promise (pre-tested modules that the next project can trust) true rather than asserted. This document states the testing doctrine; the language layers fix runners, naming syntax, and emulator wiring.

## On This Page

- [Doctrine](#doctrine)
- [The Test Tiers](#the-test-tiers)
- [Self-Contained Suites](#self-contained-suites)
- [Test Structure and Naming](#test-structure-and-naming)
- [The Environment Boundary](#the-environment-boundary)
- [What Gets Tested](#what-gets-tested)
- [Language Implementations](#language-implementations)

---

## Doctrine

- **Native tooling over frameworks.** Tests use the language's built-in test runner and assertion library. A test framework is a dependency in every module at once; the built-in runner is a dependency in none.
- **Tests ship with the module.** The suite lives inside the module directory and travels with it. There is no central test tree that can drift from the code it covers.
- **One command, from zero.** Installing dependencies and running the suite from a clean checkout is the whole procedure. Suites that need manual service startup, seeded state, or tribal knowledge are defects.
- **Tests are code.** The formatting, naming, and readability rules of [Code Readability](code-readability.md) apply to test files without discount.

## The Test Tiers

| Tier | Runs against | When |
|---|---|---|
| **1 - Unit** | Pure logic, in process, no services | Every run, every module |
| **2 - Emulated service** | Local emulators (containers) for the module's backing services | Every run, for service-dependent modules |
| **3 - Integration** | Real cloud services in an isolated sandbox account | On demand, before releases that touch vendor behavior |

Tier 2 is the framework's center of gravity: it gives service-dependent modules real protocol behavior at zero cloud cost, in CI and on developer machines alike. Tier 3 exists because emulators approximate; vendor quirks (throttling, consistency, auth edge cases) only surface against the real service.

Adapter families add a **contract suite**: one shared set of tests expressing the feature module's storage contract, executed against every adapter and against the in-memory reference implementation. The reference implementation defines correct behavior; every backend must match it.

## Self-Contained Suites

A service-dependent module's suite owns its service lifecycle end to end: the test command starts the emulators fresh, waits for readiness, runs, and tears down completely. Two rules protect this:

- **Fresh state per run.** The suite begins by destroying any leftover service state from previous runs. Tests that pass only on warm state are broken tests.
- **Never pre-start services manually.** The suite's lifecycle management assumes it owns the services; a manually started container fights the teardown and produces confusing failures.

## Test Structure and Naming

- **One description block per public function.** The suite's table of contents is the module's API surface; a missing block is a visible coverage gap.
- **Behavioral names.** Every test reads as `should [expected behavior] when [condition]`. The name states the contract being verified, so a failure report is meaningful without opening the file.
- **Arrange, act, assert.** Each test body has the three phases in order, visually separated. One behavior per test; a test asserting two behaviors is two tests.
- **One example domain per module.** All tests, documentation examples, and fixtures within a module use the same domain example. Mixed example domains are noise.

## The Environment Boundary

Exactly one file in a test suite reads the environment: the test loader. It builds the dependency container and configuration for the suite, exactly as an application's composition root does; see [Module Design](module-design.md). Test files receive everything from the loader and contain no environment access. This mirrors production wiring, keeps secrets handling in one place, and makes the suite's requirements auditable by reading one file.

## What Gets Tested

- **Every public function**, on its success path and every catalog error path it can return. The [error catalog](error-handling.md) doubles as a coverage checklist: an entry no test produces is either untested or unreachable, and both are findings.
- **Every validator**, with passing input, each failing field, and the collected multi-failure case; see [Validation](validation.md).
- **The envelope shape itself.** Failure-path tests assert that all envelope keys are present with data fields null, not merely that success is false.
- **Not the dependencies.** A module's suite tests the module. The behavior of an injected driver belongs to that driver's own suite; here it is mocked or emulated.

---

## Language Implementations

| Language | Document |
|---|---|
| JavaScript | [`languages/js/testing-strategy.md`](../languages/js/testing-strategy.md), [`languages/js/unit-test-authoring.md`](../languages/js/unit-test-authoring.md), [`languages/js/module-testing.md`](../languages/js/module-testing.md), [`languages/js/integration-testing.md`](../languages/js/integration-testing.md) |
