# Cleanup — js-server-helper-logger-store-dynamodb

## Native TTL (Automatic)

DynamoDB's native TTL feature automatically deletes log items whose `expires_at` Unix epoch timestamp has passed. The sweeper runs asynchronously with up to ~48 hours of lag. For most audit-log use cases, this lag is acceptable because read paths check `expires_at` at query time.

Enable TTL after `setupNewStore` (one-time operation per table):

```bash
aws dynamodb update-time-to-live \
  --table-name action_log \
  --time-to-live-specification "Enabled=true, AttributeName=expires_at"
```

## `cleanupExpiredLogs` (Explicit Sweep)

For environments needing deterministic `deleted_count` reporting or immediate physical deletion:

```js
setInterval(async function () {
  const result = await Lib.Logger.cleanupExpiredLogs(Lib.Instance.initialize());
  if (result.success) {
    Lib.Debug.info('Logger cleanup deleted ' + result.deleted_count + ' expired logs');
  }
}, 3600 * 1000);
```

The implementation does a full table `Scan`, filters client-side for `expires_at <= now`, then calls `batchDeleteRecords`. At high table sizes, a full scan is expensive. Use native TTL as the primary mechanism and schedule `cleanupExpiredLogs` only when exact deletion timing is required.

## Cadence Guidance

| Use case | Approach |
|----------|----------|
| Standard deployment | Enable native TTL; no application scheduling needed |
| Compliance / exact deletion audit | Schedule `cleanupExpiredLogs` hourly |
| Sub-48h physical deletion guarantee | Schedule `cleanupExpiredLogs` at desired cadence |

## Operational Notes

### Cost of Full Scan

`cleanupExpiredLogs` reads every item in the table (full `Scan`). At DynamoDB on-demand pricing, scan reads consume RCUs proportional to table size. For large log tables, the native TTL approach is more cost-efficient.

### Items During TTL Window

Items whose `expires_at` has passed but have not yet been physically deleted remain readable via `Query`. Read paths that must strictly enforce expiry should filter client-side using `expires_at`. The ~48h window only affects storage size.

### Persistent Records

Records with `expires_at = null` (or absent) are never deleted by native TTL or `cleanupExpiredLogs`. Implement a separate archival or manual pruning policy for long-term log management.
