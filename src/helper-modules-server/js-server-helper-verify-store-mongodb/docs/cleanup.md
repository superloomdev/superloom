# Cleanup — js-server-helper-verify-store-mongodb

## Native TTL (Automatic)

MongoDB automatically deletes verification documents whose `_ttl` Date field has passed. The background TTL sweeper runs approximately every 60 seconds. No application-side scheduling is required for expiration to work.

Every verify document has a `_ttl` field (verify codes always expire), so the sweeper covers every record. The index is non-sparse.

## `cleanupExpiredRecords` (Explicit Sweep)

The adapter also provides `cleanupExpiredRecords` for environments where deterministic `deleted_count` reporting is needed, or where the ~60-second TTL sweeper lag is unacceptable:

```js
setInterval(async function () {
  const result = await Lib.Verify.cleanupExpiredRecords(Lib.Instance.initialize());
  if (result.success) {
    Lib.Debug.info('Verify cleanup deleted ' + result.deleted_count + ' expired codes');
  }
}, 3600 * 1000);
```

The filter used:
```js
{ expires_at: { $ne: null, $lte: Lib.Utils.getUnixTime() } }
```

This is a collection scan unless a secondary index on `expires_at` is added manually. For high-volume collections, consider adding `{ expires_at: 1 }` as a regular ascending index out-of-band.

## Cadence Guidance

| Use case | Approach |
|----------|----------|
| Standard deployment | Rely on native TTL; no application scheduling needed |
| Exact deletion audit / compliance | Schedule `cleanupExpiredRecords` hourly |
| Sub-60s expiry enforcement | Schedule `cleanupExpiredRecords` at the desired granularity |

## Operational Notes

### TTL Index and Replica Sets

On replica sets, the TTL sweeper runs only on the primary. Secondaries receive the deletes through replication. TTL-expired documents may be briefly visible on secondaries with a stale read concern.

### Rebuilding the TTL Index

If the `_ttl` index is dropped manually, run `setupNewStore` again to recreate it. `createIndex` is idempotent in MongoDB — calling it on an already-existing index with identical options is a no-op.
