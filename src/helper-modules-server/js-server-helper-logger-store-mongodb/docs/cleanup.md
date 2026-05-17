# Cleanup — js-server-helper-logger-store-mongodb

## Native TTL (Automatic)

MongoDB automatically deletes log documents whose `_ttl` Date field has passed. The background TTL sweeper runs approximately every 60 seconds. No application-side scheduling is needed for TTL-bearing logs.

The TTL index is sparse — documents without a `_ttl` field (persistent records where `expires_at` is null) are never touched.

## `cleanupExpiredLogs` (Explicit Sweep)

For deterministic `deleted_count` reporting or when the ~60-second sweeper lag is unacceptable:

```js
setInterval(async function () {
  const result = await Lib.Logger.cleanupExpiredLogs(Lib.Instance.initialize());
  if (result.success) {
    Lib.Debug.info('Logger cleanup deleted ' + result.deleted_count + ' expired logs');
  }
}, 3600 * 1000);
```

Filter used:
```js
{ expires_at: { $ne: null, $lte: Lib.Utils.getUnixTime() } }
```

This is a collection scan unless a secondary index on `expires_at` is added manually. For high-volume collections, consider adding `{ expires_at: 1 }` as a sparse index out-of-band.

## Cadence Guidance

| Use case | Approach |
|----------|----------|
| Standard deployment | Rely on native TTL; no application scheduling needed |
| Exact deletion audit / compliance | Schedule `cleanupExpiredLogs` hourly |
| Sub-60s expiry enforcement | Schedule `cleanupExpiredLogs` at desired granularity |

## Operational Notes

### Persistent Records

Records with `expires_at = null` have no `_ttl` field and are never auto-deleted. Implement a manual archival policy if permanent log pruning is required.

### TTL Index on Replica Sets

The TTL sweeper runs only on the primary. Secondaries receive deletes via replication. TTL-expired documents may be briefly visible on secondaries with a stale read concern.

### Rebuilding Indexes

If any index is dropped, run `setupNewStore` again to recreate it. MongoDB's `createIndex` is idempotent.
