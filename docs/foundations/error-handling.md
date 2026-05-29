# Error Handling

The framework recognizes **three** error categories. Each has exactly one correct disposal mechanism. Mixing them is the most common cause of confusing bugs and leaked diagnostic strings - so this document spells out which is which, why each exists, and how the service layer is responsible for translating between them.

## On This Page

- [Three Categories, Three Disposals](#three-categories-three-disposals)
- [Where Each Category Appears](#where-each-category-appears)
- [Why Throw Programmer Errors](#why-throw-programmer-errors)
- [Why Two Return Shapes](#why-two-return-shapes)
- [Wrapper Purity: The Catalog Owns the Envelope](#wrapper-purity-the-catalog-owns-the-envelope)
- [Service-Layer Translation Is Mandatory](#service-layer-translation-is-mandatory)
- [Domain Validation (Model Layer)](#domain-validation-model-layer)
- [Return Object Shapes (Quick Reference)](#return-object-shapes-quick-reference)
- [Type String Naming](#type-string-naming)
- [Programmer Error Message Format](#programmer-error-message-format)
- [Scope](#scope)

---

## Three Categories, Three Disposals

Each category has exactly one correct disposal mechanism.

| Category | Disposal | Example | Audience |
|---|---|---|---|
| **Programmer error** | `throw new TypeError(...)` synchronously | Missing required argument, wrong shape passed to a helper function (e.g. `options.scope is required`) | The developer fixing the bug. Surfaces as an uncaught exception in dev/test. |
| **Operational / state error from a helper module** | Return envelope `{ success: false, error: { type, message } }` | Storage adapter failed, cooldown active, network timeout, S3 PUT failed | Service-layer code that branches on `error.type` and logs `error.message`. **Never the end user.** |
| **Domain / user-facing validation error** | Return `{ success: false, error: <DomainError> }` from a service or model, where `<DomainError>` is `{ code, message, status }` from `[entity].errors.js` | "Invalid email format", "Name too short", "User not found", "Email already in use" | **End users.** The controller forwards via `Lib.Functions.errorResponse`; the `message` lands in the HTTP response body. |

### Where Each Category Appears

| Layer | Throws programmer errors | Returns operational errors | Returns domain errors |
|---|---|---|---|
| **Helper module** | Yes (bad arguments, misconfiguration) | Yes (I/O failures, SDK errors) | No (helpers have no domain knowledge) |
| **Service** | Yes (bad arguments to the service) | No (wraps operational errors into domain errors) | Yes (the primary source of domain errors) |
| **Controller** | Yes (bad arguments) | No | Yes (passes through from service) |
| **Interface** | No | No | Maps domain error `status` to HTTP status code |

---

### The Heuristic Test

The simplest test for whether something is a programmer error:

> **Could perfectly-written calling code still encounter this at runtime?**
>
> - **No** - it only happens because the caller's code is wrong -> programmer error -> **throw**
> - **Yes** - even bug-free callers will see this -> not a programmer error -> **return envelope**

The test cleanly separates *"your code is broken"* (throw) from *"the world is broken"* (envelope). They need different handling, so they get different channels.

---

### Worked Example: Walking Through `verify`'s Errors

Applying the heuristic to every error the `js-server-helper-verify` module can produce:

| Error | Cause | Could correct caller still hit this? | Disposal |
|---|---|---|---|
| `options.scope is required` | Caller forgot to pass `scope` | **No** - if your code is correct, you always pass it | Throw `TypeError` |
| `options.length must be a positive integer` | Caller passed `0` or `null` | **No** - your code wouldn't pass invalid values | Throw `TypeError` |
| `CONFIG.STORE is required` | Loader called without storage adapter | **No** - one-time misconfiguration at module construction | Throw at loader time, before any per-call work |
| `COOLDOWN_ACTIVE` | User submitted another OTP request 30s after the last one | **Yes** - this is the cooldown rule working as designed; correct code calls `createPin`, the system correctly says "wait" | Envelope - from `verify.errors.js` |
| `STORE_READ_FAILED` | DynamoDB is down, IAM token expired, network blip | **Yes** - your code is fine, the world is broken | Envelope - from `verify.errors.js` |
| `STORE_WRITE_FAILED` | Same - infrastructure | **Yes** | Envelope - from `verify.errors.js` |

The test draws a sharp line: **arg-shape mistakes and one-time misconfiguration throw; rate limits, validation outcomes, and infrastructure failures return envelope from the module's internal error catalog.**

---

## Why Throw Programmer Errors

Programmer errors mean the calling code has a bug. Returning them as an envelope shifts responsibility to a caller who shouldn't have caused the problem in the first place. Throwing fails the request loudly in dev and in CI tests, forcing the bug to be fixed before deploy.

Services should call helpers with validated arguments and trust the helper. If a helper throws `TypeError`, the service has a bug to fix at the call site.

---

### Why Operational Errors Are *Not* Thrown

A natural follow-up question: if missing arguments throw, why don't `STORE_READ_FAILED` and `COOLDOWN_ACTIVE` throw? They are also the helper telling the caller "something went wrong."

The answer is the heuristic above (operational errors happen even with bug-free code), but it's worth being concrete about what would break if we threw them anyway:

```javascript
// Today (envelope) - reads naturally, follows framework convention
const result = await Lib.DynamoDB.put(instance, 'users', user_record);
if (result.success === false && result.error.type === 'CONDITIONAL_CHECK_FAILED') {
  return { success: false, error: Lib.User.errors.EMAIL_ALREADY_EXISTS };
}
if (result.success === false) {
  Lib.Debug.error('user.put storage failure', result.error);
  return { success: false, error: Lib.User.errors.SERVICE_UNAVAILABLE };
}

// If operational errors threw - every helper call wraps in try/catch,
// control flow runs through exceptions instead of return values
try {
  const result = await Lib.DynamoDB.put(instance, 'users', user_record);
  // ... use result
} catch (err) {
  if (err.type === 'CONDITIONAL_CHECK_FAILED') {
    return { success: false, error: Lib.User.errors.EMAIL_ALREADY_EXISTS };
  }
  Lib.Debug.error('user.put storage failure', err);
  return { success: false, error: Lib.User.errors.SERVICE_UNAVAILABLE };
}
```

Three concrete losses if we threw operational errors:

1. **Verbosity.** Every helper call wraps in `try/catch`. The framework's idiomatic `if (result.success === false)` branching disappears, replaced by control flow via exceptions.

2. **Conflation.** A `try/catch` block would catch **both** programmer bugs (`TypeError` from bad args) **and** runtime conditions (cooldown hit, DynamoDB transient failure). Today these are separate channels - exceptions mean *bug*, envelope means *runtime condition*. Mixing them means a typo in argument shape gets handled by the same code as a transient infra outage, which makes both harder to diagnose.

3. **Async ergonomics.** `Promise.all([...])` becomes painful. One storage hiccup in a batch rejects the whole thing. With envelopes you can collect mixed results and decide per-item what to do (retry the storage failures, surface the cooldowns, succeed on the rest).

Throwing also removes the helper's ability to return useful auxiliary data alongside the failure (e.g., a rate-limit response could one day include `retry_after_seconds`). An exception is just a value; an envelope is a shape that can grow.

---

## Why Two Return Shapes

The `{ type, message }` shape (from helper modules) and the `{ code, message, status }` shape (from domain error catalogs) **are not interchangeable**. They have different audiences:

- **Helper module shape `{ type, message }`** - audience is service-layer code. The `type` is a stable identifier for branching. The `message` is a developer diagnostic for logs and stack traces.
- **Domain shape `{ code, message, status }`** - audience is end users. The `message` is user-facing copy. The `code` is what an API client branches on. The `status` is the HTTP status the controller will use.

If a service forwards a helper-module error directly to the controller, `Lib.Functions.errorResponse` will leak the diagnostic `message` verbatim into the HTTP response body.

---

### Why Helper Modules Catch SDK Errors at All

A related design question worth answering: when the underlying SDK (DynamoDB, MongoDB, S3) **itself** throws an exception, the helper module catches it and converts it into a `{ type: 'STORE_READ_FAILED', message }` envelope. Why catch a thrown error just to re-package it?

Two reasons:

1. **Normalization.** DynamoDB, MongoDB, MySQL, Postgres, and S3 all throw different exception shapes (`ResourceNotFoundException`, `MongoServerError`, `pg.DatabaseError`, `AWS.S3.ServiceException`, etc.). The envelope is the framework's lingua franca for storage failures, so services don't need vendor-specific `catch` blocks. Branching on `error.type === 'STORE_READ_FAILED'` is the same code regardless of which backend is plugged in.

2. **Caller ergonomics under the adapter pattern.** Swapping DynamoDB for MongoDB should not ripple through every service that consumes `verify`. Without the catch-and-normalize step, vendor-specific exception types would leak upward; with it, service code is portable across backends.

This is also why programmer errors throw `TypeError` rather than returning an envelope - they belong in a different channel than vendor-originated exceptions, which always get normalized into the envelope.

---

## Wrapper Purity: The Catalog Owns the Envelope

Helper modules wrap third-party drivers (`pg`, `mysql2`, `node:sqlite`, MongoDB, AWS SDK, native `fetch`, etc.). The wrapper's job is to keep the public surface **stable across driver changes** and **consistent across modules**. That goal collapses the moment driver-specific text or codes leak through the envelope.

### The Rule

When a helper module catches a driver / SDK exception:

- **Public envelope** carries the frozen catalog object **and nothing else**.
- **Debug log** carries everything needed for diagnostics - driver message, driver code, stack, plus the catalog `type` for log↔envelope correlation.

```javascript
// Inside the catch block
catch (error) {

  Lib.Debug.debug('Postgres query failed', {
    type: ERRORS.DATABASE_QUERY_FAILED.type,
    message: error.message,    // driver wording - internal only
    code: error.code || null,  // driver code - internal only
    stack: error.stack
  });

  return {
    success: false,
    rows: [],
    fields: [],
    affected_rows: 0,
    insert_id: null,
    error: ERRORS.DATABASE_QUERY_FAILED   // bare catalog object
  };

}
```

The same shape applies to every backend in the SQL / NoSQL family, every storage adapter, every HTTP wrapper, and every queue helper. The driver and the wrapper change; the public contract does not.

Keeping driver-specific wording out of the public envelope ensures that swapping backends (e.g. moving from `pg` to another Postgres client, or from Postgres to MySQL) changes zero bytes in the public contract.

### Why the Rule Is Strict

1. **Driver swaps stay invisible.** Replacing `pg` with another Postgres client, or migrating between SQL backends covered by sibling helpers, must not change a single byte of the public envelope. The catalog is the contract.
2. **Consumer code stays portable.** Service-layer code branches on `error.type` only. If we expose `error.code === '23505'` for Postgres, a service eventually hard-codes it and breaks when the same logical condition surfaces from MySQL as `'ER_DUP_ENTRY'`.
3. **Defense in depth against leakage.** End users see whatever the service forwards. If a service forwards the helper envelope verbatim, only the catalog message is exposed - driver wording cannot leak even when translation is forgotten.
4. **Diagnostic information is preserved.** Debug logs retain everything the driver told us. Production debugging is unaffected; the wrapper purity rule does not cost any visibility.

### Catalog Design Implication

Operational error catalogs intentionally use coarse, generic types - `DATABASE_CONNECTION_FAILED`, `DATABASE_QUERY_FAILED`, `DATABASE_TRANSACTION_FAILED`. They describe what the **wrapper** experienced, not what the driver said. Granular distinctions (duplicate key, constraint violation, deadlock) belong in service-layer translation: the service maps the helper envelope to a domain error using whatever combination of `type` and surrounding context it needs.

If a finer-grained distinction is genuinely needed at the helper boundary (e.g., the helper itself runs a deduplication check before calling the driver), it earns a new catalog entry - never a driver-specific code attached to an existing entry.

---

## Service-Layer Translation Is Mandatory

Any service that calls a helper module **must** translate the helper's error envelope into a domain error from its own `[entity].errors.js` before returning to the controller.

```javascript
// user.service.js (illustrative)
const result = await Lib.MongoDB.findOne(instance, 'users', { email: email });

// Helper-layer storage failure - log raw, return generic domain error
if (result.success === false) {
  Lib.Debug.error('user.findOne storage failure', result.error);
  return { success: false, error: Lib.User.errors.SERVICE_UNAVAILABLE };
}

// Helper returned an outcome the caller must translate
if (result.document === null) {
  return { success: false, error: Lib.User.errors.NOT_FOUND };
}

return { success: true, data: result.document };
```

The bad-argument case (`TypeError` from the helper) is intentionally not handled - it bubbles up as an uncaught exception so the bug is visible.

---

### Pattern A - Module Error Catalog (Preferred)

Every helper module maintains its own frozen error catalog in `[module].errors.js`. This is the standard pattern for all framework modules. The catalog contains operational errors that can be returned via `{success: false, error}` envelopes. Errors are frozen to prevent accidental mutation.

```javascript
// verify.errors.js - the module's internal error catalog
module.exports = Object.freeze({
  COOLDOWN_ACTIVE: Object.freeze({
    type: 'COOLDOWN_ACTIVE',
    message: 'Rate limit active - wait before requesting another code'
  }),
  STORE_READ_FAILED: Object.freeze({
    type: 'STORE_READ_FAILED',
    message: 'Storage read operation failed'
  })
  // ... more errors
});
```

The service layer translates these errors to domain errors:

```javascript
// auth.service.js - translate to domain errors
const result = await Lib.Verify.verify(instance, options);
if (result.success === false) {
  // Translate based on error.type
  if (result.error.type === 'COOLDOWN_ACTIVE') {
    return { success: false, error: Lib.Auth.errors.OTP_COOLDOWN_ACTIVE };
  }
  if (result.error.type === 'STORE_READ_FAILED') {
    return { success: false, error: Lib.Auth.errors.SERVICE_UNAVAILABLE };
  }
  return { success: false, error: result.error }; // pass-through if no mapping needed
}
return { success: true, data: { verified: true } };
```

**Benefits of Pattern A:**

- Each module owns its operational error definitions
- No CONFIG.ERRORS injection complexity
- Service layer controls domain error mapping
- Consistent across all framework modules

**Note on legacy Approach B:** Previous versions used an injected CONFIG.ERRORS pattern where the module was pre-configured with domain error objects. This has been deprecated in favor of Pattern A for consistency across the framework.

---

### The Boundary, Stated Cleanly

The throw-vs-return decision maps to **when** in the request lifecycle the error occurs:

| When | Disposal | Examples |
|---|---|---|
| **Construction time** (module loader, one-shot per process) | Throw `Error` | Missing `STORE` adapter, peer dependency not loaded, required `CONFIG.*` absent |
| **Per-call argument shape** | Throw `TypeError` | Missing `options.scope`, non-integer `length`, wrong type for `value` |
| **Per-call runtime condition** | Return envelope `{ success: false, error: { type, message } }` | Rate limit hit (`COOLDOWN_ACTIVE`), storage failed (`STORE_READ_FAILED`), business-rule rejection |
| **Per-call validation outcome** | Return envelope with the same `{ type, message }` shape (or, under Approach B, the injected domain error directly) | `Lib.MongoDB.findOne` returning `{ success: false, error: { type: 'STORE_READ_FAILED' } }`; service translating to `Lib.User.errors.SERVICE_UNAVAILABLE`. Verify under Approach B skips the translation: `result.error` is already `Lib.Auth.errors.OTP_WRONG_VALUE`. |

Construction-time and per-call-argument errors are bugs that can be eliminated by writing correct code, so they fail loudly. Per-call runtime conditions are inherent to the operation and exist no matter how careful the caller is, so they return data the caller can branch on.

---

## Domain Validation (Model Layer)

Validation in `[entity].validation.js` returns user-facing errors directly from `[entity].errors.js`:

- **Success:** returns `false` (no errors)
- **Failure:** returns `Error[]` (array of `{ code, message, status }` objects from the catalog)

The controller forwards `validation_errors[0]` to `Lib.Functions.errorResponse`. The `message` is intended to be shown to the user.

See [`validation-approach.md`](validation-approach.md) for the validation patterns themselves.

---

## Return Object Shapes (Quick Reference)

```javascript
// Helper module - operational/state error envelope (bare catalog object)
return {
  success: false,
  error: ERRORS.STORE_READ_FAILED   // = { type: 'STORE_READ_FAILED', message: 'Storage read operation failed' }
};

// Helper module - programmer error
throw new TypeError('[js-server-helper-verify] options.scope is required');

// Service - domain error from entity catalog
return { success: false, error: Lib.User.errors.EMAIL_ALREADY_EXISTS };

// Controller - forward to interface layer
return Lib.Functions.errorResponse(result.error, result.error.status);
```

The envelope pattern is deliberate: every function that can fail returns `{ success: true, data }` or `{ success: false, error }`. The caller checks `result.success` before accessing data. This is more verbose than throwing, but it makes the error path explicit. You cannot accidentally ignore a failure because you forgot a `try/catch`.

---

## Type String Naming

The `type` field of a catalog error is the stable identifier that service-layer code and logs branch on. Naming it correctly has two goals that sometimes pull in opposite directions: **clarity in logs** (which module produced this?) and **semantic honesty** (does the name accurately describe what happened?). Getting it wrong in either direction causes real harm.

---

### Why Not Always Use the Module Name as a Prefix

A mechanical rule like "always prefix with the module name" produces types that look authoritative but are often misleading:

- `POSTGRES_DATABASE_QUERY_FAILED`. The module is `js-server-helper-sql-postgres`, but what does "Postgres" mean to a service receiving this? The service doesn't care which vendor threw the error; it cares that a **database query failed**. The vendor is irrelevant to the service and will change when you swap backends.
- `VERIFY_COOLDOWN_ACTIVE`. `VERIFY_` tells you the module, but `COOLDOWN_ACTIVE` already has zero ambiguity. There is no other module that would emit a `COOLDOWN_ACTIVE` type. The prefix adds noise without adding signal.

The real question to ask before naming a type is: **what piece of information is genuinely missing from the name without a prefix?**

---

### Three Classes of Error Types

#### Class 1: Functional namespace (infrastructure drivers)

Used by: SQL and NoSQL driver wrappers (`js-server-helper-sql-*`, `js-server-helper-nosql-*`), storage helpers, queue helpers, and any future infrastructure wrapper.

These modules describe **what kind of operation failed**, not which module. The prefix is the operation family (`DATABASE_`, `STORAGE_`, `QUEUE_`), not the vendor name. This is correct because:

1. Services branch on the operation kind, not the vendor. `DATABASE_QUERY_FAILED` means the same thing regardless of whether Postgres or MySQL is underneath.
2. Vendor names in type strings create coupling. A service that sees `POSTGRES_QUERY_FAILED` has implicitly learned which backend is running. That defeats the point of the adapter pattern.
3. The operation family is the stable identity. It survives backend swaps.

```javascript
// Correct: functional namespace
DATABASE_QUERY_FAILED     // what happened: a query failed
DATABASE_CONNECTION_FAILED
DATABASE_TRANSACTION_FAILED
STORAGE_PUT_FAILED
QUEUE_SEND_FAILED
```

#### Class 2: Module prefix (domain/behavioral helpers)

Used by: `js-server-helper-verify`, `js-server-helper-auth`, and any future domain helper that manages application-level state (verification codes, auth sessions).

These modules return errors that describe **outcomes of business logic**, not infrastructure failures. `SERVICE_UNAVAILABLE` and `NOT_FOUND` are examples where the name alone is dangerously generic. Multiple domain helpers could emit them, and a log line showing only `type: 'SERVICE_UNAVAILABLE'` tells you nothing about origin.

The decision process for each error in a domain helper:

1. **Is the name self-evidently unique to this module?** `COOLDOWN_ACTIVE` only makes sense in the context of verify. `ACTOR_TYPE_MISMATCH` only makes sense in auth. These have low collision risk. However, mixing prefixed and bare names in the same catalog is confusing; it implies some errors matter more than others. So the rule that follows applies to the whole catalog.

2. **Could any other helper ever emit the same name?** `SERVICE_UNAVAILABLE`, `NOT_FOUND`, `EXPIRED` are common English words. Any module could plausibly produce them. Without a prefix, `error.type === 'NOT_FOUND'` in a log is unattributable.

3. **Consistency within a catalog wins.** Once the prefix is needed for even one entry in a catalog, apply it to all entries. A catalog with mixed prefixed and bare names (`VERIFY_SERVICE_UNAVAILABLE` alongside `COOLDOWN_ACTIVE`) is harder to reason about than one that is uniformly prefixed. A reader of the catalog should be able to predict the naming convention without reading every entry.

**Decision: domain helpers prefix every entry with their module short-name.**

```javascript
// js-server-helper-verify  ->  VERIFY_
VERIFY_SERVICE_UNAVAILABLE
VERIFY_COOLDOWN_ACTIVE
VERIFY_NOT_FOUND
VERIFY_EXPIRED
VERIFY_MAX_FAILS
VERIFY_WRONG_VALUE

// js-server-helper-auth  ->  AUTH_
AUTH_SERVICE_UNAVAILABLE
AUTH_LIMIT_REACHED
AUTH_INVALID_TOKEN
AUTH_SESSION_EXPIRED
AUTH_ACTOR_TYPE_MISMATCH
```

#### Class 3: Future modules

Apply the same decision process. Ask: is this module an infrastructure adapter (use functional namespace), or a domain/behavioral helper (use module short-name prefix)? When genuinely uncertain, lean toward the module prefix. It is always safe to add attribution, but removing it later is a breaking change for any code that branches on the type string.

---

### The Short-Name Rule

The prefix is derived from the module's **short logical name**, not its package name. `js-server-helper-verify` → `VERIFY_`. `js-server-helper-auth` → `AUTH_`. The prefix is always uppercase with a trailing underscore.

Use the short logical name (`VERIFY_`, `AUTH_`), not the full package name (`JS_SERVER_HELPER_VERIFY_`). The short form is easier to read in logs and code.

---

### Intentionally Shared Semantics

`SERVICE_UNAVAILABLE` means the same thing in every module: "storage is down, try again." That semantic sameness is real and should be preserved at the **service-layer translation step**, not in the type string. A service receiving both `VERIFY_SERVICE_UNAVAILABLE` and `AUTH_SERVICE_UNAVAILABLE` maps both to the same domain error (`Lib.User.errors.SERVICE_UNAVAILABLE`). The prefixed type strings communicate origin in logs; the domain error communicates the outcome to the caller.

```javascript
// service.js - both prefixed types map to the same domain error
if (result.error.type === 'VERIFY_SERVICE_UNAVAILABLE') {
  return { success: false, error: Lib.User.errors.SERVICE_UNAVAILABLE };
}
if (result.error.type === 'AUTH_SERVICE_UNAVAILABLE') {
  return { success: false, error: Lib.User.errors.SERVICE_UNAVAILABLE };
}
```

---

## Programmer Error Message Format

The previous section (`Type String Naming`) governs the `type` field of catalog errors returned in envelopes. This section governs the **string passed to `throw new Error(...)` and `throw new TypeError(...)`** - the programmer-error channel.

Programmer-error messages have exactly one audience: **a developer reading a stack trace.** They are not parsed by any runtime code, not seen by end users, not forwarded to monitoring as structured data. The only job of the string is to tell the developer two things in the fewest possible characters: *which module raised this* and *what their code did wrong*.

### The Rule

A programmer-error message MUST follow this shape:

```text
[<module-short-name>] <field-path> <expected-shape>[. (e.g. <bare-example>)]
```

| Slot | Required | Format | Example |
|---|---|---|---|
| **Module prefix** | Yes | `[js-server-helper-<name>]` in square brackets, lowercase, exactly the module's package short-name without any scope | `[js-server-helper-auth]`, `[js-server-helper-http-gateway]` |
| **Field path** | Yes | Dotted path that names the exact CONFIG key, options key, or argument that is wrong | `CONFIG.STORE`, `options.scope`, `createSession options.tenant_id` |
| **Expected shape** | Yes | Declarative statement of the constraint the value failed to meet. Phrased as "must be …" or "is required …" | `must be a store factory function`, `is required (non-empty string)`, `must be a positive integer` |
| **Concrete example** | Optional | One bare example inside `(e.g. …)`. Used only when the expected shape needs disambiguation (e.g., showing which package satisfies a factory contract) | `(e.g. require("js-server-helper-auth-store-sqlite"))` |

### Hard Prohibitions

The following MUST NOT appear in any programmer-error message string:

1. **No URLs of any kind.** No `https://`, no GitHub links, no npm registry URLs, no documentation links. The stack trace shows the file and line - the developer can read the source. URLs in error strings become stale, leak deployment details, and clutter logs.

2. **No scoped package names.** Use the bare short-name (`js-server-helper-auth-store-sqlite`), not the scoped publish name (`@superloomdev/js-server-helper-auth-store-sqlite`). The scope is a registry concern, not a contract concern, and it changes when the project is forked or re-scoped. The bare name is stable.

3. **No multi-line concatenation for prose.** Long messages stitched together with `+ ' ... ' +` across multiple lines are a smell. If the message is too long for a single line, the message is too long. Trim it.

4. **No marketing or apologetic language.** No "Please", no "Sorry", no exclamation marks, no emoji. The developer is debugging - they want the fact, not a tone.

5. **No "click here" or "see docs" pointers.** If a constraint genuinely needs documentation context, the right answer is a tighter `expected-shape` slot, not a URL. Documentation lives in `docs/` and `README.md` - not in stack traces.

6. **No driver wording or vendor names.** A `TypeError` raised by `js-server-helper-sql-postgres` says `[js-server-helper-sql-postgres]`, not `[Postgres]` or `[pg]`. (Note: this overlaps with the wrapper-purity rule for envelope errors - both channels keep vendor wording out of consumer-visible strings.)

### Correct Examples

```javascript
throw new Error('[js-server-helper-auth] CONFIG.STORE must be a store factory function (e.g. require("js-server-helper-auth-store-sqlite"))');
throw new Error('[js-server-helper-auth] CONFIG.STORE_CONFIG is required (object)');
throw new Error('[js-server-helper-auth] CONFIG.JWT.signing_key must be a string of at least 32 chars when ENABLE_JWT is true');
throw new TypeError('[js-server-helper-auth] createSession options.tenant_id must be a non-empty string');

throw new Error('[js-server-helper-http-gateway] CONFIG.ADAPTER must be an adapter factory function (e.g. require("js-server-helper-http-gateway-adapter-aws-apigateway"))');
```

### Incorrect Examples

```javascript
// WRONG: scoped package names + URL-shaped example + multi-line concatenation
throw new Error(
  'js-server-helper-http-gateway: CONFIG.ADAPTER must be an adapter factory function. ' +
  'Pass require("@superloomdev/js-server-helper-http-gateway-adapter-aws-apigateway") ' +
  'or require("@superloomdev/js-server-helper-http-gateway-adapter-express").'
);

// WRONG: no module prefix, vague field path
throw new TypeError('options is invalid');

// WRONG: "Please" + URL
throw new Error('Please configure CONFIG.STORE. See https://example.com/docs/auth');

// WRONG: vendor wording in the prefix
throw new Error('[Postgres] connection_string is required');
```

### Why These Rules Exist

1. **The module prefix lets a developer grep logs.** A stack trace shows the file path, but a Sentry/CloudWatch search box wants a substring. `[js-server-helper-auth]` is unambiguous and grep-friendly across the whole codebase.

2. **The field path is the entire fix.** Almost every programmer error is "you didn't pass X correctly". Naming X precisely (`CONFIG.JWT.signing_key`, not "the JWT config") points the developer directly at the line they need to change.

3. **The expected shape closes the loop.** "Is required" alone doesn't tell the developer what to type; "is required (non-empty string)" does. The parenthetical is part of the value, not a footnote.

4. **No URLs because URLs lie.** Today the URL works. Six months from now it 404s, the docs site moved, the project was re-scoped, or the deployment doesn't have internet access. The stack trace is the only thing guaranteed to still be true.

5. **No scoped names because the scope is mutable.** Bare names are how the framework refers to itself in code, in commits, and in directory layout. The publish scope (`@superloomdev`) is one concern of one CI pipeline.

### Scope of This Rule

Applies to every `throw new Error(...)` and `throw new TypeError(...)` in:

- Every helper module (core, server, and client).
- Every entity service, controller, and validator in any project built on this framework.

Does NOT apply to:

- The `message` field of catalog errors returned via envelopes - that goes through the [Wrapper Purity](#wrapper-purity-the-catalog-owns-the-envelope) rule.
- The `message` field of domain errors in `[entity].errors.js` - that is user-facing copy and follows the [validation approach](validation-approach.md).
- Inline source-code comments showing usage examples (these can use any format that aids the human reader).

---

## Scope

This rule applies to:

- **Every helper module** (core, server, and client: utils, debug, time, crypto, sql-*, nosql-*, storage-*, queue-*, http, instance, verify, etc.)
- **Every entity service and controller** in `[project]/src/server/`
- **Every entity validation module** in `[project]/src/model/[entity]/[entity].validation.js`

When in doubt: programmer errors throw, everything else returns an envelope, and the service translates before the controller sees it.

## Further Reading

- [Validation Approach](validation-approach.md) - how `[entity].validation.js` produces the user-facing errors
- [Server Service Modules](../server/server-service-modules.md) - where the translation rule is enforced
- [Server Controller Modules](../server/server-controller-modules.md) - how `Lib.Functions.errorResponse` consumes domain errors
