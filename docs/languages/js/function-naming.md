# Function Naming

> **Language:** JavaScript

Every exported function in a Superloom module begins with a verb from the catalog below. The verb determines what the function does and what it returns. A function whose name does not begin with a cataloged verb is a defect, unless an Exceptions row in [`conventions-registry.md`](conventions-registry.md) names it and records why.

This document is the single source of truth for function naming. The registry carries the settled rows; this page carries the reasoning and the full verb catalog. Module naming, parameter naming, and public field naming live in [`code-formatting.md`](code-formatting.md); this page covers function verbs and return shapes only.

## On This Page

- [The Rule](#the-rule)
- [Verb Catalog](#verb-catalog)
  - [The `Sync` suffix](#the-sync-suffix)
- [Return Shape by Verb Class](#return-shape-by-verb-class)
  - [Predicates: `is` and `has`](#predicates-is-and-has)
  - [Getters: `get`, `list`, `load`](#getters-get-list-load)
  - [Mutators: `set`, `update`, `write`, `delete`, `remove`, `clear`, `cleanup`](#mutators-set-update-write-delete-remove-clear-cleanup)
  - [Constructors: `build`, `create`, `generate`](#constructors-build-create-generate)
  - [Validators: `validate`, `assert`, `check`](#validators-validate-assert-check)
- [Confusable Pairs](#confusable-pairs)
  - [`build` versus `format`](#build-versus-format)
  - [`create` versus `generate` versus `build`](#create-versus-generate-versus-build)
  - [`is` versus `has` versus `validate`](#is-versus-has-versus-validate)
  - [`get` versus `list` versus `load`](#get-versus-list-versus-load)
  - [`delete` versus `remove` versus `clear` versus `cleanup`](#delete-versus-remove-versus-clear-versus-cleanup)
  - [`set` versus `update` versus `write`](#set-versus-update-versus-write)
- [Banned Verbs](#banned-verbs)
  - [Banned naming shape: `xToY` conversion names](#banned-naming-shape-xtoy-conversion-names)
- [Naming Shape Rules](#naming-shape-rules)
  - [Verb first, always](#verb-first-always)
  - [No verb in the middle](#no-verb-in-the-middle)
  - [No noun first](#no-noun-first)
  - [Multi-HTTP-method suffix](#multi-http-method-suffix)
- [Config Key Casing](#config-key-casing)

---
## The Rule

Every exported function begins with a verb from the catalog. The verb is chosen by what the function does, not by what it returns. Two functions that do the same thing begin with the same verb, even if one returns a String and the other returns an Object. Two functions that do different things begin with different verbs, even if both return an Object.

**Exception: React component factories.** A React component factory is PascalCase and noun-named, because the framework's own contract requires it (JSX requires a capitalized identifier to distinguish a component from an HTML tag). The verb rule applies to non-component exported functions. A component library's PascalCase exports are exempt by design, not by registry row.

When naming a new function, search the catalog for the verb that matches the operation. If no cataloged verb fits, the operation may be two operations in one function, and the fix is to split the function, not to invent a verb. If the operation is genuinely new, add it to the catalog here and to the registry, with evidence, before using it.

---

## Verb Catalog

Each row names the verb, what it does, what it returns, one real example from a shipped module, and the verb it is most often confused with.

| Verb | Does | Returns | Example | Confused with |
|---|---|---|---|---|
| `build` | Composes several independent parts into a new artifact | The artifact, in whatever shape it naturally takes: String for text (`buildQuery`), Object for structured (`buildResponseEnvelope`) | `sqlite.buildQuery(sql, params)` | `format` (input shape differs), `create` (no persistence) |
| `create` | Produces a resource or a durable identity that did not exist before | The created resource or identity | `auth.createAuthId()` returns a String id | `generate` (no persistence), `build` (parts versus identity) |
| `generate` | Produces a fresh derived value with no persistence and no identity | The derived value | `s3.generateUploadUrlPut(options)` returns a signed URL String | `create` (resource or identity), `build` (parts composed) |
| `format` | Renders one logical value into a different notation of that same value | Always a String, carrying the same information as the input | `money.formatCurrency(amount, code)` | `build` (one value versus many parts), `parse` (reverse direction) |
| `parse` | Reads a notation back into its structured form | The structured form, or `null`/envelope on failure | `auth.parseAuthId(id)` returns an Object | `format` (reverse direction), `disjoin` (no build direction) |
| `disjoin` | Decomposes an external format that has no build direction | The decomposed parts | `utils.disjoinUrl(url)` | `parse` (has a build direction) |
| `get` | Reads a value from a source that can fail (I/O, engine, external state) | Envelope `{ success, data, error }` when I/O can fail; bare value when it cannot | `mongodb.getRecord(instance, collection, filter)` returns an envelope | `list` (plural), `load` (bulk into memory) |
| `list` | Reads a collection of values from a source that can fail | Envelope with a plural payload (`records`, `keys`, `values`, `results`) | `mongodb.query(instance, collection, filter, options)` | `get` (singular) |
| `load` | Reads a bulk resource into memory for later use | Envelope, or bare value when the load cannot fail | `font.loadManifest(manifest)` | `get` (single value) |
| `set` | Writes a value to a slot, overwriting whatever was there | Envelope | `mongodb.setRecord(instance, collection, record, options)` | `update` (partial mutation), `write` (synonym in some domains) |
| `update` | Mutates part of an existing record without replacing the whole | Envelope | `mongodb.updateRecord(instance, collection, filter, patch, options)` | `set` (full replace), `write` (synonym in some domains) |
| `write` | Persist a record to a store, the domain-neutral verb for "put a record" | Envelope | `sqlite.write(instance, table, row)` | `set` (slot overwrite), `update` (partial mutation) |
| `delete` | Removes a record or resource from a store permanently | Envelope with a `deleted_count` field | `mongodb.deleteRecord(instance, collection, filter, options)` | `remove` (in-memory), `clear` (wipe all), `cleanup` (expired only) |
| `remove` | Takes an item out of an in-memory collection, not a persistent store | Envelope with a `removed_count` field, or bare when in-memory only | `idle.removeIdleHandlers()` | `delete` (persistent), `clear` (all items) |
| `clear` | Wipes an entire collection or registry, leaving the container intact | Envelope with a `cleared_count` field | `localstorage.clear()` | `delete` (one record), `cleanup` (selective) |
| `cleanup` | Removes expired or stale items from a collection | Envelope with a `cleaned_count` or `deleted_count` field | `auth.cleanupExpiredSessions(instance)` | `clear` (all items), `delete` (specific record) |
| `is` | Answers a yes-or-no question about a value or state | Bare Boolean. Bad input throws `TypeError`; an operation that can fail at runtime is `get`, not `is` | `utils.isNumber(arg)` returns `true` or `false` | `has` (existence), `validate` (returns errors) |
| `has` | Answers whether a key or slot exists, as a pure in-memory check that cannot fail | Bare Boolean. Same throw rule as `is` | `registry.hasToken(token)` returns `true` or `false` | `is` (state of a value), `get` (existence check that can fail) |
| `validate` | Checks config or an adapter contract at load time, throwing on failure | `false` on success, `Error[]` on failure (the model-layer convention), or throws at load time for config | `font.validators.validateConfig(config)` | `assert` (throws on programmer error), `check` (domain logic) |
| `assert` | Throws `TypeError` on a programmer error, synchronously, never returns an envelope | Never returns; throws or falls through | `auth.validators.assertOptionsObject(options)` | `validate` (returns errors), `check` (domain logic) |
| `check` | Runs a domain-specific check that returns a Boolean or a result object, not an error array | Boolean or a domain result object | `policy.checkTotal(instance, options)` | `validate` (error array), `assert` (throws) |
| `run` | Executes a command or a prepared operation against an engine | Envelope | `dynamodb.runQueryCommand(command)` | `build` (constructs the command) |

### The `Sync` suffix

A function that has both an asynchronous and a synchronous variant carries the `Sync` suffix on the synchronous one. The asynchronous variant has no suffix. The suffix is used only when both variants exist for the same operation; a synchronous-only function never carries it.

| Variant | Name | When used |
|---|---|---|
| Async | `getRecord(key)` | Default; returns a Promise |
| Sync | `getRecordSync(key)` | First-render reads where awaiting is not possible |

---

## Return Shape by Verb Class

### Predicates: `is` and `has`

A predicate answers yes or no. It returns a bare Boolean. It never carries an error slot.

- Bad input is a **programmer error**: throw `TypeError` synchronously, the same as every other validation
- An operation that can fail at runtime is **not** a predicate. It is `get` and returns an envelope

```javascript
// Correct: pure predicate, bare Boolean
isRegistered: function (familyName) {
  Validators.assertFamilyName(familyName);
  return Object.prototype.hasOwnProperty.call(registry.families, familyName);
},

// Wrong: predicate returning an envelope
isRegistered: function (familyName) {
  if (badInput) { return { success: false, registered: false, error: ... }; }
  return { success: true, registered: ..., error: null };
},
```

A `has` that checks existence against an engine that can be unavailable is not a predicate either. It is a `get` operation that checks existence, and it keeps its envelope under the name `getRecordExists`:

```javascript
// Correct: existence check that can fail, envelope, get verb
getRecordExists(key) -> { success, exists, error }

// Wrong: same operation named as a predicate
hasRecord(key) -> { success, exists, error }
```

### Getters: `get`, `list`, `load`

A `get` returns a bare value when the call cannot fail for any reason other than "not found", and an envelope when it can fail for an operational reason (I/O, driver, engine):

| Situation | Return shape | Example |
|---|---|---|
| Pure computation or a read of data already in hand | Bare value or `null` | `getAge(instance)` returns a Number |
| I/O against a driver, engine, or external state | Envelope `{ success, data, error }` | `getRecord(instance, collection, filter)` |

The "not found" case is not an operational error. A `get` that returns `null` for not-found and an envelope for I/O failure is correct. A `get` that wraps a not-found in `{ success: false, error }` is treating a normal outcome as an error, which is the failure the envelope exists to prevent.

`list` and `load` follow the same rule: envelope when I/O can fail, bare when it cannot.

### Mutators: `set`, `update`, `write`, `delete`, `remove`, `clear`, `cleanup`

Every mutator that touches a persistent store or an external engine returns an envelope. A mutator that operates on in-memory state only, and cannot fail, may return a bare value or a count.

The count field in a mutator envelope is the **past participle of that operation's own verb**: `clear` returns `cleared_count`, `remove` returns `removed_count`, `delete` returns `deleted_count`. See registry rows 18 and 19.

### Constructors: `build`, `create`, `generate`

These return the constructed artifact directly, never an envelope. They are pure functions of their inputs; they have no operational error to report. Bad input throws `TypeError`.

### Validators: `validate`, `assert`, `check`

| Verb | Returns | Throws |
|---|---|---|
| `validate` | `false` on success, `Error[]` on failure (model layer); or throws at load time (config and adapter contracts) | Only on internal misuse |
| `assert` | Nothing; throws `TypeError` on programmer error | Yes, always, on bad input |
| `check` | A Boolean or a domain result object | No |

The split is semantic and already consistent across the catalog. `validate` is for config and contract validation at load time. `assert` is for programmer-error guards at call time. `check` is for domain-specific logic that does not fit either mold.

---

## Confusable Pairs

### `build` versus `format`

Both can return a String. The test is the input shape, not the return type.

- `format` takes **one logical value** plus render modifiers, and the output carries the same information as the input, only in a different notation. `formatCurrency(amount, code)` takes one amount and renders it.
- `build` takes **several independent parts** and composes them into a new artifact. `buildQuery(sql, params)` takes a SQL template and bind values and composes a query.

If removing one input argument still leaves a meaningful operation, it is `build`. If removing one input argument makes the operation meaningless, it is `format`.

### `create` versus `generate` versus `build`

- `create` produces a **resource or a durable identity**. The output persists or is meant to persist. `createAuthId` produces an id that is stored.
- `generate` produces a **fresh derived value** with no persistence and no identity. `generateUploadUrlPut` produces a signed URL that is consumed, not stored.
- `build` composes **several independent parts** into a new artifact. `buildAddress` composes fields into a normalized address object.

`createAddress` returns a plain object with no persistence and no identity. It composes fields, so it is `buildAddress`, not `createAddress`.

### `is` versus `has` versus `validate`

- `is` answers a yes-or-no question about the **state of a value**. `isReady()` asks "is the loader ready?"
- `has` answers whether a **key or slot exists**, as a pure in-memory check. `hasToken(token)` asks "is this token in the registry?"
- `validate` returns an **array of errors**, not a Boolean. It is not a predicate; it is a check that collects everything wrong with an input.

Both `is` and `has` return a bare Boolean. An existence check that can fail at runtime is `getRecordExists`, not `has`.

### `get` versus `list` versus `load`

- `get` reads **one value**. `getRecord(instance, collection, filter)` returns one record or null.
- `list` reads **a collection of values**. `query(instance, collection, filter, options)` returns an array of records.
- `load` reads **a bulk resource into memory** for later use. `loadManifest(manifest)` reads a font manifest into the registry.

### `delete` versus `remove` versus `clear` versus `cleanup`

- `delete` removes a **record or resource from a persistent store**. `deleteRecord(instance, collection, filter)` deletes from the database.
- `remove` takes an **item out of an in-memory collection**. `removeIdleHandlers()` removes handlers from an in-memory set.
- `clear` **wipes an entire collection or registry**, leaving the container intact. `clear()` wipes the key-value store.
- `cleanup` **removes expired or stale items** from a collection. `cleanupExpiredSessions(instance)` removes sessions past their TTL.

The same operation against two backends uses the same verb. `dropCollection` and `deleteTable` are the same operation against two backends, so both are `deleteCollection`.

### `set` versus `update` versus `write`

- `set` writes a value to a slot, **overwriting** whatever was there. `setRecord(instance, collection, record, options)` writes the full record.
- `update` **mutates part** of an existing record without replacing the whole. `updateRecord(instance, collection, filter, patch, options)` applies a partial patch.
- `write` is the **domain-neutral verb for "put a record"** when the store's native verb reads awkwardly. `write(instance, table, row)` writes a row to SQLite.

Domain-specific verbs that carry a semantic `write` does not are kept. `addLog` appends, and `writeLog` loses the append semantic. The split is recorded as an intentional exception in the registry, not unified away.

---

## Banned Verbs

These verbs are banned from new code and enforced by the shared ESLint config. Each has a settled alternative.

| Banned verb | Why | Use instead |
|---|---|---|
| `construct` | Invents a synonym for `build` with no semantic gain | `build` |
| `deconstruct` | Invents a synonym for `disjoin` with no semantic gain | `disjoin` |
| `read` | Ambiguous between `get` (one value) and `load` (bulk); the catalog has both, so `read` adds nothing | `get` or `load` |
| `ensure` | Hides whether the function creates or checks; `create` and `assert` are both more specific | `create` or `assert` |
| `transform` | Hides the direction; `format` and `parse` are both more specific | `format` or `parse` |

### Banned naming shape: `xToY` conversion names

A function named `secondsToTimeString` or `dateStringToDataSet` uses a `xToY` shape that does not begin with a verb. These are banned. The direction determines the verb: rendering to a notation is `format`, reading a notation back is `parse`.

| Banned | Use instead |
|---|---|
| `secondsToTimeString` | `formatSeconds` |
| `dateStringToDataSet` | `parseDateString` |

The `xToY` pattern cannot be enforced by a regex lint rule without false positives, so it is enforced by the module audit workflow's verb doctrine check, not by ESLint.

---

## Naming Shape Rules

### Verb first, always

Every exported function begins with a verb from the catalog. The noun follows the verb. `buildQuery`, not `queryBuild`. `deleteRecord`, not `recordDelete`.

### No verb in the middle

A function name with a verb in the middle, such as `absenteeKeysCheckObject`, is banned. The verb goes first: `checkAbsenteeKeys`. The object the check runs against is the parameter, not part of the name.

### No noun first

A function name that begins with a noun, such as `commandAddRecord`, is banned. The verb goes first. If the function builds a command, it is `buildAddRecordCommand`. If it runs a command, it is `runAddRecordCommand`.

### Multi-HTTP-method suffix

When two or more functions do the same thing with different HTTP methods, the method is a suffix on the verb-noun name: `generateUploadUrlPut`, `generateUploadUrlPost`. A single-method function never carries the suffix. See [`pitfalls-migration.md`](pitfalls-migration.md) for the failure modes this prevents.

---

## Config Key Casing

Config keys are `SCREAMING_SNAKE_CASE`, including keys nested inside a SCREAMING parent. The one exception is injected live objects, which stay `PascalCase` because they name a capability, not a data value.

| Key type | Casing | Example |
|---|---|---|
| Data key (string, number, boolean) | `SCREAMING_SNAKE_CASE` | `TABLE_NAME`, `TOTAL_MAX`, `EVICT_OLDEST_ON_LIMIT` |
| Nested data key inside a SCREAMING parent | `SCREAMING_SNAKE_CASE` | `LIMITS: { TOTAL_MAX: 20 }` |
| Injected live object | `PascalCase` | `Store`, `Adapter`, `Lib.SQL` |

The defence of lowercase nested keys was that lowercase marks per-instance data from the composition root. But a key like `total_max` is a module constant one level down, so the split does not track the distinction it claims to. PascalCase stays for live objects, where the capability-naming rule in [`composition-and-adapters.md`](../../principles/composition-and-adapters.md) already governs the name.

This rule governs **config keys only**. Public return fields stay `snake_case` per [`code-formatting.md`](code-formatting.md) - Public Data Field Naming. A return field is never SCREAMING-cased.
