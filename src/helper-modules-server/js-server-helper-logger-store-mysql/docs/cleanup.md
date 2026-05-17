# Cleanup — js-server-helper-logger-store-mysql

## No Native TTL

MySQL has no background TTL sweeper. Log records with a non-null `expires_at` remain in the table until explicitly deleted. Schedule `cleanupExpiredLogs` on a regular cron.

## Application-Managed Cleanup

```js
setInterval(async function () {
  const result = await Lib.Logger.cleanupExpiredLogs(Lib.Instance.initialize());
  if (result.success) {
    Lib.Debug.info('Logger cleanup deleted ' + result.deleted_count + ' expired logs');
  }
}, 3600 * 1000);  // hourly
```

## The Cleanup SQL

```sql
DELETE FROM `action_log`
WHERE `expires_at` IS NOT NULL
  AND `expires_at` <= ?
```

The bound parameter is `Lib.Utils.getUnixTime()` — real wall-clock seconds.

## Cadence Guidance

| Deployment | Recommended cadence |
|------------|---------------------|
| Production | Every 1–6 hours |
| High-volume | Every 15–30 minutes |
| Development / test | Not critical; container restarts reset state |

## Operational Notes

### MySQL Event Scheduler

```sql
CREATE EVENT IF NOT EXISTS cleanup_expired_logs
ON SCHEDULE EVERY 1 HOUR
DO
  DELETE FROM `action_log` WHERE `expires_at` IS NOT NULL AND `expires_at` <= UNIX_TIMESTAMP();
```

Requires `event_scheduler = ON` in `my.cnf` or `SET GLOBAL event_scheduler = ON`.

### InnoDB Row Locking

`DELETE` on InnoDB uses row-level locking. Large cleanup batches under heavy concurrent write load may cause brief contention. If needed, batch with `LIMIT` across multiple calls.

### Persistent Records

Records with `expires_at = NULL` are never deleted by `cleanupExpiredLogs`. Implement a separate archival policy for long-term log management.
