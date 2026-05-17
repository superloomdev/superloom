# API Reference. `js-server-helper-instance`

Every exported function on the public interface, with parameters, return shape, and notes. For loader and dependency notes see [Configuration](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-instance/docs/configuration.md).

## On This Page

- [Conventions](#conventions)
- [The Instance Object](#the-instance-object)
- [Lifecycle Functions](#lifecycle-functions)
- [Background Routines](#background-routines)
- [Inspection](#inspection)
- [Worked Examples](#worked-examples)
- [Lifecycle Notes](#lifecycle-notes)

---

## Conventions

Every function in this module is **synchronous, side-effect-free with respect to module state, and never throws**. The only mutable state is on the `instance` object, which is owned by the caller. The module itself holds nothing between calls.

| Pattern | Behaviour |
|---|---|
| **Instance is owned by the caller.** | The object returned by `initialize()` is a plain JavaScript object. Pass it through your call chain by reference. The module has no internal map of "active instances" |
| **Cleanup is opt-in.** | An instance with no registered cleanup routines is fine. `cleanup(instance)` then becomes a cheap no-op |
| **Background completion is signalled by the caller.** | `backgroundRoutine(instance)` returns a function. Call it when the background routine finishes. Failing to call it leaves the cleanup queue waiting forever (the request never "completes" from this module's view) |
| **Cleanup execution order is FIFO.** | The first routine registered is the first to run during cleanup |
| **Cleanup runs at most once per `cleanup()` call.** | After the queue drains, it is reset to empty. Calling `cleanup()` again is a no-op until new routines are registered |

---

## The Instance Object

`initialize()` returns a plain object with the following fields:

| Field | Type | Purpose |
|---|---|---|
| `time` | `number` | Unix time (seconds) at which `initialize()` was called. Treat as read-only |
| `time_ms` | `number` | Unix time (milliseconds) at which `initialize()` was called. Pass to `performanceAuditLog` for request-level timing. Treat as read-only |
| `logger_counter` | `number` | Reserved for use by `js-server-helper-logger`. Initialised to 0 |
| `background_queue` | `number` | Count of in-flight background routines. Managed by `backgroundRoutine` and its returned completion callback. **Do not mutate directly** |
| `cleanup_queue` | `Array<Function>` | Registered cleanup callbacks. Managed by `addCleanupRoutine` and `cleanup`. **Do not mutate directly** |

> **Direct mutation discouraged.** Reading `instance.time_ms` is fine and is the canonical pattern. Mutating `background_queue` or `cleanup_queue` from caller code defeats the lifecycle guarantees.

> **Adding application-specific fields is fine.** Many Superloom applications attach `instance.user_id`, `instance.request_id`, `instance.input` etc. on top of the lifecycle fields above. The module only ever reads its own fields.

---

## Lifecycle Functions

### `initialize()`

Returns a fresh instance object. Captures the current unixtime in seconds and milliseconds. No side effects.

| Returns | Description |
|---|---|
| `object` | A new instance object as described in [The Instance Object](#the-instance-object) |

### `addCleanupRoutine(instance, cleanup_function)`

Registers a callback to run when the request completes. Cleanup callbacks receive the same `instance` they were registered against. Use this to release database connections, flush logs, close files, or any other deferred work.

| Param | Type | Required | Description |
|---|---|---|---|
| `instance` | `object` | Yes | The request's instance object |
| `cleanup_function` | `Function` | Yes | Signature `fn(instance) -> void`. Receives the same instance for context |

The function is appended to `instance.cleanup_queue`. The queue is FIFO: routines run in registration order during the next `cleanup` call.

### `cleanup(instance)`

Drains `instance.cleanup_queue` if (and only if) `instance.background_queue` is zero.

| Param | Type | Required | Description |
|---|---|---|---|
| `instance` | `object` | Yes | The request's instance object |

Behaviour matrix:

| `background_queue` | `cleanup_queue` | Effect |
|---|---|---|
| 0 | non-empty | All cleanup callbacks run in registration order. Queue is reset to empty |
| 0 | empty | No-op |
| > 0 | any | No-op. The last `done()` call from the in-flight background routines will trigger `cleanup` automatically |

> **Why not error when called too early.** The asymmetric "no-op when not ready" behaviour is intentional. It lets the request entry-point unconditionally call `cleanup()` at the natural end of the request flow, regardless of how many background routines are still running. The module sorts out the ordering.

---

## Background Routines

### `backgroundRoutine(instance)`

Registers a new in-flight background routine. Returns a completion callback. **The caller must call the returned function exactly once when the routine finishes** (success or failure - see error handling below).

| Param | Type | Required | Description |
|---|---|---|---|
| `instance` | `object` | Yes | The request's instance object |

| Returns | Description |
|---|---|
| `Function` | A `done()` callback. Calling it decrements `background_queue` and triggers `cleanup(instance)` if the queue is now empty |

```javascript
function send_email_async (instance, payload) {
  const done = Lib.Instance.backgroundRoutine(instance);

  emailProvider.send(payload)
    .then(function () {
      done();
    })
    .catch(function (err) {
      Lib.Debug.error('Email send failed', err);
      done();
    });
}
```

> **Always call `done()` in both success and failure paths.** A `done()` that never fires keeps the cleanup queue parked. The request's database connections, log handles, and other cleanup-managed resources stay open indefinitely. In Lambda this manifests as the function timing out instead of returning.

---

## Inspection

The three inspection functions read instance state. They never mutate.

### `getBackgroundQueueCount(instance)`

| Returns | Description |
|---|---|
| `number` | Current value of `instance.background_queue`. Useful in monitoring and load-shedding decisions |

### `getCleanupQueueCount(instance)`

| Returns | Description |
|---|---|
| `number` | Length of `instance.cleanup_queue`. Useful when verifying that all expected cleanup callbacks have been registered |

### `getAge(instance)`

| Returns | Description |
|---|---|
| `number` | Milliseconds elapsed since `initialize()` was called. Equivalent to `Date.now() - instance.time_ms` |

> **Use `instance.time_ms` directly when you need the start timestamp**, and `getAge(instance)` when you need elapsed time. Both are inexpensive; pick the one that reads more naturally at the call site.

---

## Worked Examples

### Express middleware. One instance per request

```javascript
app.use(function (req, res, next) {
  req.instance = Lib.Instance.initialize();
  res.on('finish', function () {
    Lib.Instance.cleanup(req.instance);
  });
  next();
});

app.get('/users/:id', async function (req, res) {
  const user = await Lib.Db.getRow(
    req.instance,
    'SELECT * FROM users WHERE id = $1',
    [req.params.id]
  );
  res.json(user);
});
```

The framework `js-server-helper-sql-postgres` registers a per-request connection-release cleanup via `addCleanupRoutine` from inside `Lib.Db.getRow`; calling `cleanup(req.instance)` on `res.on('finish')` releases the connection.

### Lambda handler. One instance per invocation

```javascript
exports.handler = async function (event, context) {
  const instance = Lib.Instance.initialize();

  try {
    const result = await businessLogic(instance, event);
    return result;
  }
  finally {
    Lib.Instance.cleanup(instance);
  }
};
```

`finally` ensures `cleanup` runs whether the handler succeeded or threw. If business logic registered any background routines whose `done()` callback has not yet fired, `cleanup` defers and runs automatically when the last `done()` is called.

### Background work after the response is sent

```javascript
app.post('/orders', async function (req, res) {
  const instance = req.instance;
  const order = await Lib.Db.write(instance, sql, params);

  res.json(order);

  const done = Lib.Instance.backgroundRoutine(instance);
  send_confirmation_email(order)
    .catch(function (err) {
      Lib.Debug.error('Confirmation email failed', err);
    })
    .finally(function () {
      done();
    });
});
```

The response goes out immediately. The email send runs in the background. When `done()` fires, the cleanup queue (which includes the database connection release) drains.

---

## Lifecycle Notes

There is nothing for the module to clean up at process exit. State lives on caller-owned instance objects; once the caller stops referencing them they are garbage-collected like any other JavaScript object.

For module-level setup details (loader signature, peer-dep notes) see [Configuration → Loader Pattern](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-instance/docs/configuration.md#loader-pattern).
