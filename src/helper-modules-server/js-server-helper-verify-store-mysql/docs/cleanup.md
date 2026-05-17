# Cleanup — js-server-helper-verify-store-mysql

## No Native TTL

MySQL has no background TTL sweeper on individual columns. Expired verification records remain in the table until explicitly deleted. Schedule `cleanupExpiredRecords` on a regular cadence to prevent unbounded table growth.

## Application-Managed Cleanup

```js
setInterval(async function () {
  const result = await Lib.Verify.cleanupExpiredRecords(Lib.Instance.initialize());
  if (result.success) {
    Lib.Debug.info('Verify cleanup deleted ' + result.deleted_count + ' expired codes');
  }
}, 3600 * 1000);  // hourly
```

## The Cleanup SQL

```sql
DELETE FROM `verification_codes`
WHERE `expires_at` < ?
```

The bound parameter is `Lib.Utils.getUnixTime()` — real wall-clock seconds, not `instance.time`. The `expires_at` index makes this a fast range scan.

## Cadence Guidance

| Deployment | Recommended cadence |
|------------|---------------------|
| Production | Every 1–6 hours |
| Development / test | Not critical; container restarts reset state |

## Operational Notes

### MySQL Event Scheduler

As an alternative to application-side scheduling, MySQL's built-in Event Scheduler can run a cleanup job directly in the database:

```sql
CREATE EVENT IF NOT EXISTS cleanup_verification_codes
ON SCHEDULE EVERY 1 HOUR
DO
  DELETE FROM `verification_codes` WHERE `expires_at` < UNIX_TIMESTAMP();
```

Requires `event_scheduler = ON` in `my.cnf` or set at runtime with `SET GLOBAL event_scheduler = ON`.

### InnoDB and Row Locking

`DELETE` on InnoDB uses row-level locking. A large cleanup batch may cause brief lock contention if there is high concurrent write activity. If this is a concern, batch the deletes with a `LIMIT` clause across multiple calls.
