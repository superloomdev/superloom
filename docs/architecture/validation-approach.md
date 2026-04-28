# Validation Approach

Validation is the rule that keeps bad data out of the system. In this framework, every entity validates its own input in its own `[entity].validation.js` module - no third-party library, no decorators, no schema definitions in YAML. This document explains why, how the validation function is shaped, and where it sits in the request flow.

## On This Page

- [Philosophy](#philosophy)
- [How Validation Works](#how-validation-works)
- [Return Convention](#return-convention)
- [Validation Patterns](#validation-patterns)
- [When to Consider a Third-Party Library](#when-to-consider-a-third-party-library)
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

Domain validation errors are **user-facing**: the `message` field is intended to be shown to the end user (e.g. `"Email address format is invalid"`). This is distinct from helper-module errors and from programmer errors. See [`error-handling.md`](error-handling.md) for the full three-category model and how the controller forwards these errors via `Lib.Functions.errorResponse`.

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

## When to Consider a Third-Party Library

The built-in approach works well for:
- Small to medium projects
- Projects where you want zero dependencies
- Projects where validation rules are tightly coupled to domain config

Consider **Joi** or **Zod** if:
- You have very complex conditional schemas that are hard to express procedurally
- You want automatic TypeScript type inference from schemas (Zod)
- You need schema serialization (sending validation rules to the client)

**Recommendation:** Stick with the built-in approach for this framework. It is simpler, has no dependencies, and keeps validation visible and debuggable. If a specific project needs schema-based validation, wrap Joi or Zod in a helper module (`js-helper-validation`) so it can be swapped without touching model code.

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

- [Error Handling](error-handling.md) - the three error categories and how validation errors fit
- [Model Modules](model-modules.md) - where `[entity].validation.js` lives and how it loads
- [Entity Creation Guide](entity-creation-guide.md) - end-to-end example including a validation module
