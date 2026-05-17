# Runtime. `js-server-helper-logger`

The logger module is runtime-agnostic at the call-site: every function takes `instance` as its first argument and is identical in shape across persistent-server and serverless-function runtimes. There are no cookies to write, no request headers to read on the request path (IP / user-agent auto-capture is optional and goes through `Lib.HttpHandler`).

Two runtime-shape concerns nevertheless deserve documentation: the **background-write lifecycle** (which behaves differently when the runtime can freeze the container) and the **scheduling mechanism for `cleanupExpiredLogs`**.

For the function reference see [API Reference](api.md). For configuration keys see [Configuration](configuration.md).

## On This Page

- [Background Writes Across Runtime Shapes](#background-writes-across-runtime-shapes)
- [Scheduled Cleanup](#scheduled-cleanup)

---

## Background Writes Across Runtime Shapes

By default, `log()` returns immediately and the store write runs in a `Lib.Instance.backgroundRoutine` attached to the per-request `instance`. The request handler can return its HTTP response while the row is still in flight.

**Persistent server.** The Node process keeps running between requests. A backgrounded write that has not completed before the response is sent simply continues on the same event loop. No special care is required; this is the normal case.

**Serverless function.** The container may be frozen the instant the handler returns its response. A background routine that has not finished by then is paused; it may resume on the next warm invocation, or the container may be reclaimed before that ever happens. In practice, short writes (`addLog` against a low-latency backend) usually complete before the freeze; longer writes are at risk.

**The rule.** For compliance-critical writes in a serverless runtime, pass `options.await: true`. The handler then blocks on `addLog` and returns only after the row is durable.

```js
// Compliance-critical write (password change, GDPR deletion, financial event)
const audit = await Lib.Logger.log(instance, {
  /* ... */,
  retention: 'persistent',
  await:     true              // block until durable
});
if (audit.success === false) {
  return /* surface the error */;
}
```

For best-effort writes (read audits, low-stakes user actions), the default fire-and-forget call is fine in both runtimes. The framework's `instance` lifecycle already drains pending background routines before resolving in the persistent server, and the serverless freeze is usually short enough.

## Scheduled Cleanup

Whether `cleanupExpiredLogs(instance)` needs to be scheduled depends on the chosen storage adapter (some adapters' native TTL makes the cron optional). See your adapter's README for whether scheduling is required and the recommended cadence.

When it is required, the call is identical in both runtimes:

```js
const instance = Lib.Instance.initialize();

await Lib.Logger.cleanupExpiredLogs(instance);
```

The difference is only **how** that call is scheduled:

- **Persistent server.** Any cron mechanism inside or alongside the process: `node-cron`, `agenda`, a sidecar `systemd` timer, a Kubernetes `CronJob`.
- **Serverless function.** A separate scheduled function invocation: AWS EventBridge for Lambda, Cloud Scheduler for Google Cloud Functions, and so on. Do not put the sweep inside an HTTP-triggered handler.
