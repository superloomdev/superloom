# Cleanup

MongoDB has built-in row-level TTL, but this adapter does not use it by default. The canonical `expires_at` field is a Number (Unix seconds), and MongoDB's TTL index requires a Date-typed field. The default cleanup path is `cleanupExpiredSessions` on a schedule. An alternative path that uses native TTL through a denormalized Date field is documented for operators who prefer it.

## On This Page

- [TTL Behavior](#ttl-behavior)
- [Recommended Cleanup Mechanism (default path)](#recommended-cleanup-mechanism-default-path)
- [Recommended Cadence](#recommended-cadence)
- [How `cleanupExpiredSessions` Is Implemented](#how-cleanupexpiredsessions-is-implemented)
- [Alternative: Date-field + Native TTL Index](#alternative-date-field--native-ttl-index)
- [Operational Notes](#operational-notes)

## TTL Behavior

| Aspect | MongoDB (this adapter) |
|---|---|
| Native row-level TTL on the canonical `expires_at` | None. MongoDB TTL indexes require a Date-typed field; `expires_at` is a Number |
| `expires_at` column | Stored as `Number` (Unix epoch seconds), indexed only if the operator provisions a secondary index |
| Effect of skipping cleanup | Expired documents remain on disk and in any backup. The Auth parent's runtime guards still reject expired rows, so there is no security exposure, but the collection grows unbounded |

The bare minimum for production is one scheduled run of `cleanupExpiredSessions` per hour. Lower cadence is acceptable for low-volume deployments; higher cadence offers diminishing returns because the `expires_at` index keeps the range scan efficient.

## Recommended Cleanup Mechanism (default path)

The scheduling shape depends on the runtime. The function call itself is identical in both shapes; only the scheduler differs.

**Persistent server (Express, Fastify, plain Node HTTP):** schedule with `setInterval` inside the same process, or with a dedicated cron library (`node-cron`, `cron`) for crontab-style expressions. The function call is one round-trip; no need for a separate worker process.

```js
const ONE_HOUR_MS = 60 * 60 * 1000;

setInterval(async function () {
  const instance = Lib.Instance.initialize();
  const result   = await Lib.AuthUser.cleanupExpiredSessions(instance);
  if (result.success) {
    Lib.Debug.info('auth.cleanup', { deleted_count: result.deleted_count });
  } else {
    Lib.Debug.warn('auth.cleanup.failed', { error: result.error });
  }
}, ONE_HOUR_MS);
```

**Serverless function (AWS Lambda, Cloud Functions, Azure Functions):** schedule via a platform-native event source (EventBridge rule, Cloud Scheduler job, Azure Timer Trigger) and bind it to a dedicated handler function. The handler reuses the same `Lib` container so it shares the MongoDB client connection pool with request handlers.

```js
exports.handler = async function () {
  const instance = Lib.Instance.initialize();
  const result   = await Lib.AuthUser.cleanupExpiredSessions(instance);
  return { deleted_count: result.success ? result.deleted_count : 0 };
};
```

Cross-link: the Auth parent's [`docs/runtime.md`](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-auth/docs/runtime.md) documents the per-runtime construction of `instance` in more detail. The cleanup call site itself does not differ.

## Recommended Cadence

| Deployment | Cadence | Rationale |
|---|---|---|
| Production, persistent server | Every 1 hour | Cheap with the `expires_at` index. Keeps the collection from growing unbounded |
| Production, serverless | Every 1 hour via platform scheduler | Same rationale. The cost of an extra invocation per hour is negligible |
| Staging or low-traffic | Every 6 hours | Same correctness, smaller log volume |
| Development | Manual or every 24 hours | Expired documents are not a problem on a dev database |

The cadence is upper-bounded by the operator's tolerance for stale documents in the collection. There is no lower bound enforced by the adapter; running the sweep every minute is safe but wasteful.

## How `cleanupExpiredSessions` Is Implemented

The function issues one driver call:

```js
db.<collection_name>.deleteMany({ expires_at: { $lt: <instance.time> } })
```

`instance.time` is Unix seconds at the start of the request. With the operator-provisioned `expires_at` secondary index (documented in [schema.md](schema.md)), this is an index-driven range scan; deletion cost scales with the number of expired documents, not with the total collection size. Without that index, the call is a collection scan, which is acceptable only for small collections.

The return shape includes `deleted_count`, taken from the driver's `deletedCount`. Applications that want to track sweep efficiency can log this value alongside the request duration; the Auth parent's slow-query timing (when enabled via `Lib.Debug`) covers the same round-trip.

There is no read-then-delete dance and no transaction; `deleteMany` is atomic per document. A concurrent reader sees either the pre-delete state or the post-delete state for any given document; partial deletion is not observable.

## Alternative: Date-field + Native TTL Index

Operators who prefer MongoDB-managed expiration can provision a Date-typed field and a TTL index on it, **in addition to** the application-level cleanup path. The TTL index is best-effort; MongoDB's background TTL monitor runs roughly every 60 seconds, so expired documents may remain readable for up to that long after expiry.

### Setup

```js
// One-time, out-of-band:
db.<collection_name>.createIndex(
  { expires_at_date: 1 },
  { expireAfterSeconds: 0 }
);
```

### Maintaining the Date field

The adapter does not maintain `expires_at_date`. The operator (or application code that wraps the adapter) is responsible for writing it alongside every `setSession`. The simplest pattern is to extend the adapter's `setSession` via a thin wrapper:

```js
const Store = Lib.AuthUser; // the Auth instance backed by this adapter

async function setSessionWithDate (instance, record) {
  // Inject the Date field for the TTL index
  const augmented = Object.assign({}, record, {
    expires_at_date: new Date(record.expires_at * 1000)
  });
  return await Store.setSession(instance, augmented);
}
```

Whether to do this is a deployment decision, not an application-code change. The session-record shape returned by `getSession` does not include `expires_at_date`; only the canonical `expires_at` (Number) is part of the contract.

### Trade-offs

| Concern | Default (scheduled cleanup) | Date-field + TTL index |
|---|---|---|
| Deletion latency | Bounded by the cleanup cadence (1 hour typical) | Bounded by MongoDB's TTL monitor (~60 seconds) |
| Operational complexity | One scheduled call. Same shape across all adapters | Extra Date field on every write. Wrapper code or out-of-band data maintenance |
| Storage overhead | Zero | One additional BSON Date per document (~8-12 bytes) |
| Index count | 0-1 secondary indexes (`expires_at`, optional) | 1-2 secondary indexes (`expires_at_date` TTL, optional `expires_at` for batch deletes) |
| Application coupling | None. The cleanup call is uniform across backends | Adapter-specific. Application code or wrapper needs to know about the Date field |

The default path is the recommended option for new deployments because it stays uniform across the `auth-store-*` family. Native TTL is a legitimate choice when sub-minute deletion latency is a hard requirement.

## Operational Notes

**Index health.** MongoDB's TTL monitor (if used) reclaims expired documents in the background; the storage engine handles the resulting space. A periodic `compact` is unnecessary unless the application has a very high session-rotation rate (more than one expiry per second), in which case schedule a low-traffic-window compaction.

**Index bloat from long-lived sessions.** If most sessions live for years (long-lived API keys, install-bound tokens), the `expires_at` index degenerates into a near-empty range scan because almost no documents match the predicate. This is not a correctness issue; performance stays acceptable because the index is small. No tuning required.

**Backups.** The adapter does not interact with backup tooling. Standard MongoDB backup (`mongodump`, replica-set snapshots, managed-service backups) captures the sessions collection identically to any other collection. Expired-but-not-yet-deleted documents are included in backups, which is the expected behavior for an auditable store.
