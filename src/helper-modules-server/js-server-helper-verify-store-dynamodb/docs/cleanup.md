# Cleanup — js-server-helper-verify-store-dynamodb

## Native TTL (Automatic)

DynamoDB's native TTL feature automatically deletes items whose `expires_at` Unix epoch timestamp has passed. The sweeper runs asynchronously with up to ~48 hours of lag — items may remain readable for up to 48 hours after expiry. For most verification use cases (email codes, SMS pins) this lag is acceptable because the verify module checks `expires_at` at verify time regardless.

Enable TTL after `setupNewStore` (one-time operation per table):

```bash
aws dynamodb update-time-to-live \
  --table-name verification_codes \
  --time-to-live-specification "Enabled=true, AttributeName=expires_at"
```

## `cleanupExpiredRecords` (Explicit Sweep)

The adapter provides an explicit sweep for environments needing deterministic `deleted_count` reporting or immediate physical deletion:

```js
setInterval(async function () {
  const result = await Lib.Verify.cleanupExpiredRecords(Lib.Instance.initialize());
  if (result.success) {
    Lib.Debug.info('Verify cleanup deleted ' + result.deleted_count + ' expired codes');
  }
}, 3600 * 1000);
```

The implementation does a full table `Scan`, filters client-side for `expires_at <= now`, then calls `batchDeleteRecords`. At high table sizes, a full scan is expensive. Use this judiciously — for most deployments, relying on native TTL is preferable.

## Cadence Guidance

| Use case | Approach |
|----------|----------|
| Standard deployment | Enable native TTL; no application scheduling needed |
| Compliance / exact deletion audit | Schedule `cleanupExpiredRecords` hourly |
| Sub-48h physical deletion guarantee | Schedule `cleanupExpiredRecords` at desired cadence |

## Operational Notes

### Cost of Full Scan

`cleanupExpiredRecords` reads every item in the table (full `Scan`). At DynamoDB on-demand pricing, scan reads consume RCUs proportional to table size. For very large verify tables with infrequent cleanup needs, the native TTL approach is more cost-efficient.

### Items During TTL Window

Items whose `expires_at` has passed but have not yet been physically deleted by the TTL sweeper are still readable via `GetItem`. The verify module always checks `expires_at` at verify time, so these items are rejected without adapter changes. The ~48h window only affects storage size, not security.
