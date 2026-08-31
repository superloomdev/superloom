# Validation Approach

> **Language:** JavaScript

Validation is the rule that keeps bad data out of the system. In this framework, every entity validates its own input in its own `[entity].validation.js` module - no third-party library, no decorators, no schema definitions in YAML. This document explains why, how the validation function is shaped, and where it sits in the request flow.

Every validation function follows the same shape:

```javascript
// src/model/[entity]/[entity].validation.js
import CONFIG from './[entity].config.js';
import ERRORS from './[entity].errors.js';

export default {
  validateCreate: function (name, email) {
    const errors = [];
    if (!name || typeof name !== 'string') errors.push(ERRORS.NAME_REQUIRED);
    if (name && name.length > CONFIG.NAME_MAX_LENGTH) errors.push(ERRORS.NAME_TOO_LONG);
    if (!email || typeof email !== 'string') errors.push(ERRORS.EMAIL_REQUIRED);
    return errors.length > 0 ? errors : false;
  }
};
```

- Returns `false` on success (no errors)
- Returns an array of error objects on failure. Each shaped `{ code, message, status }` from `[entity].errors.js`
- The caller checks `if (validation_errors)`; truthy means errors exist

## On This Page

- [Philosophy](#philosophy)
- [How Validation Works](#how-validation-works)
- [Return Convention](#return-convention)
- [Validation Patterns](#validation-patterns)
  - [Simple Entity (e.g., User)](#simple-entity-e-g-user)
  - [Nested Entity (e.g., Survey → Questions → Options)](#nested-entity-e-g-survey-→-questions-→-options)
  - [Type-Dependent Validation](#type-dependent-validation)
  - [Cross-Reference Validation](#cross-reference-validation)
- [Use Utils Type-Check Primitives](#use-utils-type-check-primitives)
  - [Scope](#scope)
  - [Not a Type Guard: Argument-Shape Dispatch](#not-a-type-guard-argument-shape-dispatch)
  - [Identifier Format and Wire Parsing](#identifier-format-and-wire-parsing)
- [Validation in the Request Flow](#validation-in-the-request-flow)
- [Further Reading](#further-reading)

---
## Philosophy

- All validation lives in the **model layer** (`[entity].validation.js`)
- Validation is **pure** and **IO-free** - it runs unchanged on server and client
- No third-party validation library is used - validation is hand-written against config rules
- This keeps the framework dependency-free and the validation co-located with domain rules

---

## How Validation Works

1. **`[entity].config.js`** defines constraints: lengths, regex, enums, limits
2. **`[entity].validation.js`** checks input against config, returns errors from `[entity].errors.js`
3. **`[entity].errors.js`** provides a stable error catalog: `{ code, message, status }`

---

## Return Convention

- **Success:** `false` (no errors)
- **Failure:** `Error[]` (array of error objects from `[entity].errors.js`, each shaped `{ code, message, status }`)

This convention is consistent across all validation functions. Always check with `if (result)` - truthy means errors exist.

Domain validation errors are **user-facing**: the `message` field is intended to be shown to the end user (e.g. `"Email address format is invalid"`). This is distinct from helper-module errors and from programmer errors. See [`error-handling.md`](error-handling) for the full three-category model and how the controller forwards these errors via `Lib.Functions.errorResponse`.

---

## Validation Patterns

### Simple Entity (e.g., User)
```javascript
// Validate flat fields
SurveyValidation.validateCreate(title, description, questions, rules);
```

### Nested Entity (e.g., Survey → Questions → Options)
```javascript
// Top-level validates survey fields
// Then iterates and validates each question
// Then iterates and validates each option within choice questions
// Then validates cross-reference rules against collected question IDs
```

### Type-Dependent Validation
- Choice questions (`single_choice`, `multi_choice`) MUST have options
- Non-choice questions (`text`, `number`, `scale`, `date`) must NOT have options
- Scale questions validate `constraints.min` and `constraints.max`

### Cross-Reference Validation
- Rules reference `source_question_id` and `target_question_id`
- Both must exist in the survey's question list
- Self-reference (source === target) is not allowed
- Operator and action must be from the allowed enum

---

## Use Utils Type-Check Primitives

Hand-written validation does not mean hand-written type checks. `helper-utils` is the foundation module every other module already injects, and it owns the type-check primitives. **Type guards call those primitives; they never re-derive the check with a raw `typeof`.**

The reason is correctness before consistency. Two of the primitives are strictly stronger than the `typeof` expression they replace, and the raw form silently admits a value the validator was written to reject:

| Raw check | Utils primitive | Why the primitive is not merely shorter |
|---|---|---|
| `typeof arg !== 'number'` | `!Lib.Utils.isNumber(arg)` | `typeof NaN` is `'number'`, so the raw form accepts `NaN`. `isNumber` rejects it |
| `typeof arg === 'object' && arg !== null` | `Lib.Utils.isObject(arg)` | `typeof null` is `'object'`, so the raw form needs a second clause that is easy to omit |
| `typeof arg !== 'function'` | `!Lib.Utils.isFunction(arg)` | Same predicate; called for uniformity so every type guard in the file reads alike |
| `typeof arg !== 'string'` | `!Lib.Utils.isString(arg)` | Same predicate; called for uniformity |
| `typeof arg !== 'boolean'` | `!Lib.Utils.isBoolean(arg)` | Same predicate; called for uniformity |
| `arg == null` | `Lib.Utils.isNullOrUndefined(arg)` | Same predicate; names the intent instead of relying on loose equality |

Range and sign checks stay inline next to the primitive, because they are domain rules rather than type questions: `if (!Lib.Utils.isNumber(ms) || ms <= 0)`.

### Scope

The rule covers **both** validation surfaces of a module, not just the companion file:

- `[module].validators.js` - load-time config assertions and per-call options assertions
- `[module].js` - inline guards inside public functions that return an error envelope rather than throwing

A module that reaches for `Lib.Utils.isNullOrUndefined` in one guard and a raw `typeof` in the next guard of the same function is the failure this rule exists to prevent. Mixed forms inside one module are a consistency violation, and the stronger primitives make them a correctness one.

### Not a Type Guard: Argument-Shape Dispatch

Raw `typeof` stays correct where the question is which overload the caller used, not whether a value is valid:

```javascript
start: function (key, options) {

  // Normalize arguments: key is optional
  if (typeof key === 'object' && key !== null) {
    options = key;
    key = 'default';
  }
```

This is dispatch on argument shape. It rejects nothing and produces no error, so no primitive applies. The same holds for duck-typing a host-supplied collaborator (`typeof source.subscribe === 'function'`), where the test is whether a capability is present rather than whether an input is well formed.

### Identifier Format and Wire Parsing

When an identifier reaches a wire format that is parsed back into parts, prefer a parse that cannot be ambiguous over a constraint on the caller's data. A reserved character is justified only when relaxing it would break a correctness property, never merely to make parsing easier.

The technique is **fixed-width right-anchored parsing**. If the trailing segments have known lengths and character sets, the parser reads from the right: the last `N` characters are the final segment, the `M` characters before that are the middle segment, and everything remaining is the leading segment. No delimiter-based `split` is needed, and the leading segment may contain any character, including ones a naive split would treat as delimiters.

`auth.parseAuthId` uses this technique. `token_key` is exactly 16 characters from an alphanumeric charset, `token_secret` is exactly 48 from the same charset, and `actor_id` is everything before them. A standard UUID containing hyphens parses correctly because the parser never splits on `-`.

For composite internal keys (DynamoDB sort keys, MongoDB `_id` composites), the separator is `\u001F` (ASCII Unit Separator), a non-printable control character that cannot appear in any human-readable identifier. This eliminates the need for a caller-facing constraint on `actor_id` or `tenant_id`: `begins_with` queries on `actor_id + '\u001F'` are inherently safe because `\u001F` cannot appear in `actor_id`. This follows the precedent set by `helper-distinct-queue-store-dynamodb`, which uses `\u001F` as its sort key delimiter for the same reason. A belt-and-braces validation remains: callers must not include `\u001F` in any identifier, even though the character is not typeable through normal input methods.

---

## Validation in the Request Flow

```
Interface (Express/Lambda)
  → Controller extracts raw input from request
  → Controller calls Model.validation.validateCreate(explicit, params)
  → If errors: Controller returns errorResponse(errors[0])
  → If valid: Controller builds Data object with Model.data.create(explicit, params)
  → Controller delegates to Service with validated Data object
```

- **Controller** is responsible for calling validation
- **Model** owns the validation logic
- **Service** trusts that input is already validated (receives Data objects only)

## Further Reading

- [Error Handling](error-handling) - the three error categories and how validation errors fit
- [Function Naming](function-naming.md) - the `validate` / `assert` / `check` verb split
- [Model Modules](server/model-modules.md) - where `[entity].validation.js` lives and how it loads
- [Entity Creation Guide (JavaScript)](server/entity-creation-guide-js) - end-to-end example including a validation module
