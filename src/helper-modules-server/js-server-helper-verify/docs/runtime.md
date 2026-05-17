# Runtime. `js-server-helper-verify`

The verify module is runtime-agnostic at the call-site: every function takes `instance` as its first argument and is identical in shape across persistent-server and serverless-function runtimes. There are no cookies to write, no request headers to read on the request path.

Two runtime-shape concerns nevertheless deserve documentation: the **post-verify background delete** (which can be deferred in a serverless freeze) and the **scheduling mechanism for `cleanupExpiredRecords`**.

For the function reference see [API Reference](api.md). For configuration keys see [Configuration](configuration.md).

## On This Page

- [Post-Verify Background Delete in Serverless](#post-verify-background-delete-in-serverless)
- [Scheduled Cleanup](#scheduled-cleanup)

---

## Post-Verify Background Delete in Serverless

On a successful `verify(...)` call, the module schedules a background `deleteRecord(scope, key)` via `Lib.Instance.backgroundRoutine` and returns `{ success: true }` immediately. The background delete is what enforces the strict one-time guarantee for the code: a second submission of the same value finds no record and returns `VERIFY_NOT_FOUND`.

**Persistent server.** The Node process keeps running between requests. A backgrounded delete that has not completed before the response is sent continues on the same event loop. The window between "verify success" and "record deleted" is typically a few milliseconds. No special care is required; this is the normal case.

**Serverless function.** The container may be frozen the instant the handler returns the response. If the background delete has not completed by then, the record is still in the store. A second submission of the same code, arriving on a different cold or warm container, would find the record and could succeed again.

The expiry and `max_fail_count` guards still apply (the record is not invisible; it is just not yet deleted), so the practical exposure is bounded by:

- **`ttl_seconds`**, which removes the record at the next `verify` attempt or at the next `cleanupExpiredRecords` sweep, whichever comes first.
- **`max_fail_count`**, which locks the record out after the configured number of failed attempts.

**Mitigations for high-security flows in serverless:**

1. **Short TTLs.** A 60-second TTL bounds the replay window to a minute regardless of when the delete actually runs.
2. **Frequent cleanup.** Running `cleanupExpiredRecords` on a high-frequency schedule (every few minutes via EventBridge) keeps the table sweep close to real-time.
3. **Native TTL on the adapter.** Both MongoDB and DynamoDB adapters expose native TTL; the record disappears without requiring an explicit delete call. SQL adapters do not.

The verify module does not currently expose an `await: true` option on `verify(...)` to force a synchronous delete. If your security model demands a synchronous one-time guarantee in serverless, the architectural choice is to use a native-TTL adapter and short TTLs rather than relying on the post-verify background delete.

## Scheduled Cleanup

Whether `cleanupExpiredRecords(instance)` needs to be scheduled depends on the chosen storage adapter (the MongoDB and DynamoDB adapters' native TTL makes the cron optional; SQL adapters require it). See your adapter's README for whether scheduling is required and the recommended cadence.

When it is required, the call is identical in both runtimes:

```js
const instance = Lib.Instance.initialize();

await Lib.Verify.cleanupExpiredRecords(instance);
```

The difference is only **how** that call is scheduled:

- **Persistent server.** Any cron mechanism inside or alongside the process: `node-cron`, `agenda`, a sidecar `systemd` timer, a Kubernetes `CronJob`.
- **Serverless function.** A separate scheduled function invocation: AWS EventBridge for Lambda, Cloud Scheduler for Google Cloud Functions, and so on. Do not put the sweep inside an HTTP-triggered handler.

The verify module never depends on cleanup running for correctness. The consume-time `instance.time > record.expires_at` check guarantees expired codes are rejected even when the sweep is delayed; cleanup is a storage-hygiene mechanism, not a correctness mechanism.
