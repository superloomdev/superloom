# Validation

Validation in this framework is hand-written, co-located with the code it protects, and expressed in plain language constructs rather than schema libraries. This is a deliberate rejection of the industry default, and this document carries the reasoning as well as the rules.

## On This Page

- [The Position](#the-position)
- [Why Not Schema Libraries](#why-not-schema-libraries)
- [Where Validation Lives](#where-validation-lives)
- [The Two Validation Moments](#the-two-validation-moments)
- [Validator Design Rules](#validator-design-rules)
- [Language Implementations](#language-implementations)

---

## The Position

The rule: **every module and every entity validates its own inputs with hand-written validator functions, kept in a companion file beside the code they protect.**

Hand-written validation is a few lines of readable conditionals per field. It has no dependency, no schema language to learn, no version churn, and no gap between what the validator says and what the code does: the validator IS code, reviewed and tested like everything else. In a framework whose foundation modules already provide the type-checking primitives, the cost of writing validators by hand is minutes, and the return is total ownership of the contract.

## Why Not Schema Libraries

Schema validation libraries are the standard answer, and the framework declines them with specific reasons:

- **They are a dependency in the hottest path.** Every request crosses validation. Under the [third-party library policy](third-party-libraries.md), a dependency this central needs an overwhelming case, and "saves writing conditionals" is not one.
- **The schema language becomes a second source of truth.** The contract lives partly in the schema definition and partly in the code, in two different idioms. Drift between them is invisible until it fails.
- **Error output needs translation.** Library-generated errors arrive in the library's shape and must be mapped into the framework's [error envelope](error-handling.md) anyway. The translation layer usually exceeds the validators it replaced.
- **Opacity under debugging.** A failing hand-written validator is a readable function a developer steps through. A failing schema is a data structure interpreted by someone else's engine.

The trade is acknowledged: schema libraries offer declarative brevity and shared vocabulary. The framework values ownership, uniform errors, and zero dependencies more.

## Where Validation Lives

Validation is co-located at two levels, and only these two:

| Level | Companion | Protects |
|---|---|---|
| **Module** | The module's validators file | The module's configuration at load, and operation inputs at call time |
| **Entity model** | The entity's validation file | Domain rules for the entity's data, used by controllers before anything else runs |

Nothing validates on behalf of someone else. A controller does not re-check what the model validates; a service does not re-check what the module validates. Each contract has one owner and one checkpoint, and everything behind the checkpoint trusts it.

## The Two Validation Moments

**Load-time validation** checks configuration when a module initializes. A violation here is a programmer error and throws immediately; see [Error Handling](error-handling.md). The system refuses to start misconfigured, which converts an entire class of production incidents into development-time failures.

**Call-time validation** checks operation inputs at the public surface. A violation here is an operational error and returns in the envelope, listing every failed field in one pass rather than stopping at the first. The caller gets the complete correction list in a single round trip.

## Validator Design Rules

- **One validator per public operation** that takes caller input. The validator's name states what it validates.
- **Validators are pure.** They read their input and return a verdict; they touch no state, perform no input/output, and never mutate what they check.
- **Validators receive their tools by injection.** The foundation utilities and the error catalog arrive as parameters from the module's loader; a validator file imports nothing on its own. This keeps validators testable in isolation and preserves the single-require rule of [Module Design](module-design.md).
- **Collect, then report.** Input validators accumulate all failures and return the full list. Fail-fast is for programmer errors, not user input.
- **Every check maps to a catalog entry.** A validator produces errors from the frozen catalog, never ad hoc objects.

---

## Language Implementations

| Language | Document |
|---|---|
| JavaScript | [`languages/js/validation.md`](../languages/js/validation.md) |
