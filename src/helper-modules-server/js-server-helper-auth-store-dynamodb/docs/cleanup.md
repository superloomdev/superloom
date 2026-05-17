# Cleanup

DynamoDB offers two paths for expired session cleanup: native table-level TTL (recommended for production), and application-managed cleanup via `cleanupExpiredSessions` (fallback for immediate consistency or when TTL is not enabled).

## On This Page

- [TTL Behavior](#ttl-behavior)
- [Native TTL (Recommended)](#native-ttl-recommended)
- [Application-Managed Cleanup (Fallback)](#application-managed-cleanup-fallback)
- [Recommended Cadence](#recommended-cadence)
- [How `cleanupExpiredSessions` Is Implemented](#how-cleanupexpiredsessions-is-implemented)
- [Operational Notes](#operational-notes)

## TTL Behavior

| Aspect | DynamoDB (this adapter) |
|---|---|
| Native row/item-level TTL | Yes — table-level configuration on `expires_at` |
| `expires_at` format | Number (Unix epoch seconds). ISO strings will not work |
| TTL deletion timing | Eventually consistent — up to 48 hours after expiry |
| Application-managed cleanup | Available via `cleanupExpiredSessions` for immediate hard-delete |
| Effect of skipping both | Expired items remain visible (up to 48h with TTL, indefinitely without). The Auth parent's runtime guards still reject expired items, so there is no security exposure, but storage costs continue |

For production, enable native TTL and optionally run `cleanupExpiredSessions` on a long cadence (e.g., daily) for immediate hard-delete when needed. For small tables or strict compliance requirements, rely solely on `cleanupExpiredSessions` and do not enable TTL.

## Native TTL (Recommended)

Enable during table provisioning:

```yaml
# CloudFormation
TimeToLiveSpecification:
  AttributeName: expires_at
  Enabled: true
```

```ts
// CDK
timeToLiveAttribute: 'expires_at'
```

Once enabled:
- DynamoDB scans items in the background and deletes those with `expires_at` in the past
- No application code required
- No read/write capacity consumed for TTL-driven deletions
- Items may remain visible for up to 48 hours after expiry

**Caveats:**
- TTL deletion is **not instantaneous**. Do not rely on it for immediate session revocation; use `deleteSession` or `deleteSessions` for that.
- The application layer (`verifySession`) always checks `expires_at` regardless of TTL, so expired-but-not-yet-deleted items are correctly rejected.
- TTL only works with Number-type epoch seconds. The adapter stores `expires_at` as Number, so this is satisfied.

## Application-Managed Cleanup (Fallback)

If native TTL is not enabled (or for immediate hard-delete), run `cleanupExpiredSessions`:

**Persistent server:**

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

**Serverless function:**

```js
exports.handler = async function () {
  const instance = Lib.Instance.initialize();
  const result   = await Lib.AuthUser.cleanupExpiredSessions(instance);
  return { deleted_count: result.success ? result.deleted_count : 0 };
};
```

Cross-link: the Auth parent's [`docs/runtime.md`](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-auth/docs/runtime.md) documents the per-runtime construction of `instance` in more detail.

## Recommended Cadence

| Deployment | TTL Enabled | `cleanupExpiredSessions` Cadence | Rationale |
|---|---|---|---|
| Production | Yes | Daily or weekly | Catch the edge cases TTL missed; provide immediate hard-delete capability |
| Production | No | Every 1 hour | O(table-size) scan is expensive; more frequent runs keep the expired set small |
| Staging | Yes | Weekly | Same correctness, smaller bill |
| Development | Either | Manual | Expired items are not a problem on a dev table |

If both TTL and scheduled cleanup are enabled, they do not conflict. An item deleted by TTL will simply be absent when `cleanupExpiredSessions` scans; the scan-then-delete pattern is idempotent.

## How `cleanupExpiredSessions` Is Implemented

Because DynamoDB does not support DELETE by predicate, the adapter implements cleanup in two steps:

1. **Scan with FilterExpression:**
   ```js
   Scan({
     TableName: 'sessions_user',
     FilterExpression: '#ea < :now',
     ExpressionAttributeNames: { '#ea': 'expires_at' },
     ExpressionAttributeValues: { ':now': now }
   })
   ```

2. **Batch delete the returned items:**
   ```js
   BatchWriteItem({
     RequestItems: {
       'sessions_user': items.map(item => ({
         DeleteRequest: {
           Key: { tenant_id: item.tenant_id, session_key: item.session_key }
         }
       }))
     }
   })
   ```

The driver helper handles AWS's 25-item-per-batch limit via automatic chunking. The adapter builds the key map and delegates.

**Cost implications:** Scan reads every item in the table (full table scan) but the filter is applied before returning data to the client, so only matching items consume read capacity beyond the base scan cost. For large tables, this is expensive; native TTL is strongly preferred.

## Operational Notes

**On-Demand vs Provisioned capacity.** The adapter works with both `BillingMode: PAY_PER_REQUEST` (on-demand) and `PROVISIONED`. If using provisioned capacity, ensure your read and write capacity units can accommodate:
- Normal traffic: `GetItem`, `Query`, `PutItem`, `UpdateItem`, `DeleteItem`, `BatchWriteItem`
- Cleanup traffic (if not using TTL): `Scan` (reads entire table) + `BatchWriteItem` (deletes expired items)

Consider a separate scheduled cleanup Lambda/function with burst capacity if your base provisioned capacity is tight.

**Large tables and pagination.** The `Scan` API paginates at 1 MB of data per response. The driver helper handles pagination automatically. A very large table with many expired items could result in a long-running `cleanupExpiredSessions` call. The function is async and non-blocking, but monitor duration if your runtime has execution limits (e.g., AWS Lambda's 15-minute timeout).

**Eventual consistency of TTL.** Items deleted by TTL do not trigger DynamoDB Streams (if enabled) with the same immediacy as explicit deletes. If you rely on Streams for audit logging or downstream processing, note that TTL-driven deletions may appear with delay and without the exact deletion timestamp.

**Backups.** DynamoDB Point-in-Time Recovery (PITR) and on-demand backups capture items as they exist at the backup time, including expired-but-not-yet-deleted items. This is expected behavior for an auditable store. Restoring from backup may re-introduce expired items; the Auth parent's runtime guards will reject them on first access.

**Multiple Auth instances.** If multiple Auth instances (different `actor_type` values) use different tables, each table needs its own TTL configuration (if using native TTL). `cleanupExpiredSessions` only affects its own table; there is no cross-table sweep. Schedule each instance's cleanup at different minutes to spread load.
