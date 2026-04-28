# Error Handling

The framework recognizes **three** error categories. Each has exactly one correct disposal mechanism. Mixing them is the most common cause of confusing bugs and leaked diagnostic strings - so this document spells out which is which, why each exists, and how the service layer is responsible for translating between them.

## On This Page

- [Three Categories, Three Disposals](#three-categories-three-disposals)
- [Why Throw Programmer Errors](#why-throw-programmer-errors)
- [Why Two Return Shapes](#why-two-return-shapes)
- [Service-Layer Translation Is Mandatory](#service-layer-translation-is-mandatory)
- [Domain Validation (Model Layer)](#domain-validation-model-layer)
- [Return Object Shapes (Quick Reference)](#return-object-shapes-quick-reference)
- [Scope](#scope)

---

## Three Categories, Three Disposals

Never mix them.

| Category | Disposal | Example | Audience |
|---|---|---|---|
| **Programmer error** | `throw new TypeError(...)` synchronously | Missing required argument, wrong shape passed to a helper function (e.g. `options.scope is required`) | The developer fixing the bug. Surfaces as an uncaught exception in dev/test. |
| **Operational / state error from a helper module** | Return envelope `{ success: false, error: { type, message } }` | Storage adapter failed, cooldown active, network timeout, S3 PUT failed | Service-layer code that branches on `error.type` and logs `error.message`. **Never the end user.** |
| **Domain / user-facing validation error** | Return `{ success: false, error: <DomainError> }` from a service or model, where `<DomainError>` is `{ code, message, status }` from `[entity].errors.js` | "Invalid email format", "Name too short", "User not found", "Email already in use" | **End users.** The controller forwards via `Lib.Functions.errorResponse`; the `message` lands in the HTTP response body. |

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
| `COOLDOWN_ACTIVE` | User submitted another OTP request 30s after the last one | **Yes** - this is the cooldown rule working as designed; correct code calls `createPin`, the system correctly says "wait" | Envelope |
| `STORE_READ_FAILED` | DynamoDB is down, IAM token expired, network blip | **Yes** - your code is fine, the world is broken | Envelope |
| `STORE_WRITE_FAILED` | Same - infrastructure | **Yes** | Envelope |

The test draws a sharp line: **arg-shape mistakes and one-time misconfiguration throw; rate limits, validation outcomes, and infrastructure failures return envelope.**

---

## Why Throw Programmer Errors

Programmer errors mean the calling code has a bug. Returning them as an envelope shifts responsibility to a caller who shouldn't have caused the problem in the first place. Throwing fails the request loudly in dev and in CI tests, forcing the bug to be fixed before deploy.

Production callers should never write defensive code like:

```javascript
// Anti-pattern - hides bugs
if (result.error.type === 'INVALID_OPTIONS') {
  // ...what now? The service is broken.
}
```

Instead, services should call helpers with validated arguments and trust the helper. If a helper throws `TypeError`, the service has a bug to fix.

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

### Approach B - When the Helper Knows the Domain

For helpers tightly coupled to a single application's domain, where every caller would translate the same set of failure modes to the same domain errors, the helper can accept the domain error catalog at construction and return domain errors directly. This collapses service-layer translation to one pass-through line.

`js-server-helper-verify` is the first helper to use this pattern. Its loader requires a `CONFIG.ERRORS` map - seven keys (`COOLDOWN_ACTIVE`, `NOT_FOUND`, `EXPIRED`, `MAX_FAILS`, `WRONG_VALUE`, `STORE_READ_FAILED`, `STORE_WRITE_FAILED`) to whatever shape your application uses for client-facing errors. The helper returns the matching catalog entry verbatim on every failure path:

```javascript
// auth.loader.js - inject the catalog at construction
Lib.Verify = require('@superloomdev/js-server-helper-verify')(Lib, {
  STORE: buildStoreAdapter(Lib),
  ERRORS: {
    COOLDOWN_ACTIVE:    Lib.Auth.errors.OTP_COOLDOWN_ACTIVE,
    NOT_FOUND:          Lib.Auth.errors.OTP_NOT_FOUND,
    EXPIRED:            Lib.Auth.errors.OTP_EXPIRED,
    MAX_FAILS:          Lib.Auth.errors.OTP_LOCKED,
    WRONG_VALUE:        Lib.Auth.errors.OTP_WRONG_VALUE,
    STORE_READ_FAILED:  Lib.Auth.errors.SERVICE_UNAVAILABLE,
    STORE_WRITE_FAILED: Lib.Auth.errors.SERVICE_UNAVAILABLE
  }
});

// auth.service.js - one-line pass-through, no per-error if/switch
const result = await Lib.Verify.verify(instance, options);
if (result.success === false) {
  return { success: false, error: result.error };
}
return { success: true, data: { verified: true } };
```

**When to choose Approach B:**

- Helper is application-coupled (one consumer or a tight cluster of consumers, all mapping failures the same way)
- Set of failure modes is small, stable, and exhaustively enumerable
- Translation table is identical for every caller

**When to stick with the default `{ type, message }` envelope:**

- Helper is shared across many applications with different domain vocabularies (most storage, network, and crypto helpers)
- Caller might want to handle some failure modes specially (retry on storage failure, surface rate-limits with a custom message, etc.)
- Failure modes are open-ended (e.g. `Lib.HTTP.fetch` can fail in dozens of vendor-specific ways)

Approach B is a refinement, not a replacement. The framework's default for helper modules remains `{ type, message }` envelopes plus mandatory service-layer translation. Helpers adopt Approach B only when the coupling is strong enough to justify accepting the domain catalog at construction.

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
// Helper module - operational/state error envelope
return {
  success: false,
  error: { type: 'STORE_READ_FAILED', message: 'Adapter getRecord returned success=false' }
};

// Helper module - programmer error
throw new TypeError('[js-server-helper-verify] options.scope is required');

// Service - domain error from entity catalog
return { success: false, error: Lib.User.errors.EMAIL_ALREADY_EXISTS };

// Controller - forward to interface layer
return Lib.Functions.errorResponse(result.error, result.error.status);
```

---

## Scope

This rule applies to:

- **Every helper module** in `src/helper-modules-core/`, `src/helper-modules-server/`, `src/helper-modules-client/` (utils, debug, time, crypto, sql-*, nosql-*, storage-*, queue-*, http, instance, verify, etc.)
- **Every entity service and controller** in `demo-project/src/server/` and any project derived from it
- **Every entity validation module** in `demo-project/src/model/[entity]/[entity].validation.js`

When in doubt: programmer errors throw, everything else returns an envelope, and the service translates before the controller sees it.

## Further Reading

- [Validation Approach](validation-approach.md) - how `[entity].validation.js` produces the user-facing errors
- [Server Service Modules](server-service-modules.md) - where the translation rule is enforced
- [Server Controller Modules](server-controller-modules.md) - how `Lib.Functions.errorResponse` consumes domain errors
