# DTO Philosophy

This document explains why every entity has exactly **one** canonical data builder, why absent keys are not added to the result, and why public DTOs are derived from internal ones rather than rebuilt from scratch. Read this before adding a new entity, and especially before suggesting a `createUserUpdate` or `createUserResponse` builder - we do not have those, and this page explains why.

## On This Page

- [What is a DTO](#what-is-a-dto)
- [The One-Shape Rule](#the-one-shape-rule)
- [Absent Keys Are Not Added](#absent-keys-are-not-added)
- [Public DTOs Derive From Internal](#public-dtos-derive-from-internal)
- [Explicit Parameters, Not Object Passthrough](#why-explicit-parameters-not-object-passthrough)
- [Nested DTOs](#nested-dtos)
- [Server-Extended DTOs](#server-extended-dtos)

---

## What is a DTO

A **Data Transfer Object (DTO)** is a data structure that defines the exact shape of data at a boundary. In this framework, DTOs are the contract between layers - controllers build them, services receive them, and interfaces produce them on the way out.

---

## The One-Shape Rule

Each entity has **one** canonical data builder. The same shape is used for create, update, and read operations. The difference is which keys are populated.

```javascript
// ONE builder for the User entity
buildUserData(id, name, email, phone, role, status, created_at, updated_at)

// For CREATE: id is undefined (not yet assigned)
buildUserData(undefined, 'John', 'john@example.com', '+1-555-0100', 'user')

// For UPDATE: only id and changed fields are provided
buildUserData('usr_123', 'Jane', undefined, undefined, undefined, 'inactive')

// For FULL RECORD: all fields populated
buildUserData('usr_123', 'John', 'john@example.com', '+1-555-0100', 'user', 'active', 1711843200, 1711929600)
```

---

## Absent Keys Are Not Added

Keys whose values are `undefined` are simply **not added** to the resulting object. This is deliberate:

```javascript
// Input: buildUserData('usr_123', 'Jane', undefined, undefined, undefined, 'inactive')
// Output: { id: 'usr_123', name: 'Jane', status: 'inactive' }
// Note: email, phone, role are NOT in the object (not set to null or undefined)
```

**Why?** This makes it trivial to distinguish "field not provided" from "field set to null." When updating a database record, you only want to update fields that were explicitly sent - not overwrite everything with null.

---

## Public DTOs Derive From Internal

The public version of a DTO strips server-only fields. It always takes the **full internal object** as input - it never rebuilds from individual parameters:

```javascript
// Internal: { id, name, email, phone, role, status, created_at, updated_at, created_by, version }
// Public:   { id, name, email, phone, role, status, created_at }

// The public builder takes the full object and filters
buildUserDataPublic(full_user_data_object)
```

**Why?** The public shape is always a subset of the internal shape. Rebuilding it from individual parameters:
1. Duplicates the parameter list (maintenance burden)
2. Can drift from the internal shape (bugs)
3. Makes the relationship between internal and public unclear

---

## Why Explicit Parameters, Not Object Passthrough

DTO builders use **explicit parameters**, not a generic object:

```javascript
// ✅ Correct: explicit parameters define the contract
buildUserData(id, name, email, phone, role, status, created_at, updated_at)

// ❌ Wrong: object passthrough hides the shape
buildUserData(data)
```

**Why?** The function signature IS the documentation. Any developer or AI assistant can see exactly what fields exist by reading the function definition. With object passthrough, you have to read the implementation to know the shape.

---

## Nested DTOs

For entities with nested structures (e.g., Survey → Questions → Options):

```javascript
// Each level has its own builder
buildSurveyData(id, title, description, status, questions, rules, created_at, updated_at)
buildQuestionData(question_id, text, type, order, is_required, options, constraints)
buildOptionData(option_id, label, order, value)
buildRuleData(source_question_id, operator, value, action, target_question_id)
```

The controller assembles nested DTOs bottom-up:
1. Build option DTOs
2. Build question DTOs (with option DTOs inside)
3. Build rule DTOs
4. Build survey DTO (with question and rule DTOs inside)

---

## Server-Extended DTOs

The base model defines the shared shape. The server model extension adds server-only fields:

```javascript
// Base (shared with client):
buildSurveyData(id, title, description, status, questions, rules, created_at, updated_at)

// Server extension adds:
addServerFields(survey_data, created_by, organization_id)
// Result: { ...survey_data, created_by, organization_id, response_count, is_published, version, ... }
```

The server extension **composes** on top of the base - it does not redefine the base shape.

## Further Reading

- [Why MVC](why-mvc.md) - how DTOs fit into the layered architecture
- [Model Modules](../architecture/model-modules.md) - the file layout for `[entity].data.js`
- [Validation Approach](../architecture/validation-approach.md) - how validation runs against DTO inputs
- [Entity Creation Guide](../architecture/entity-creation-guide.md) - end-to-end example of building DTOs for a new entity
