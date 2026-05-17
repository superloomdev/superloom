# Cleanup — js-server-helper-logger-store-postgres

## No Native TTL

PostgreSQL has no background TTL sweeper. Log records with a non-null `expires_at` remain in the table until explicitly deleted. Schedule `cleanupExpiredLogs` on a regular cron.

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
DELETE FROM "action_log"
WHERE "expires_at" IS NOT NULL
  AND "expires_at" <= ?
```

The bound parameter is `Lib.Utils.getUnixTime()` — real wall-clock seconds, not `instance.time`. The `expires_at` index makes this a fast range scan.

## Cadence Guidance

| Deployment | Recommended cadence |
|------------|---------------------|
| Production | Every 1–6 hours |
| High-volume | Every 15–30 minutes |
| Development / test | Not critical; container restarts reset state |

## Operational Notes

### Table Bloat

PostgreSQL uses MVCC. Deleted rows are not immediately reclaimed; `VACUUM` (or `autovacuum`) handles dead tuple reclamation. Ensure `autovacuum` is not suppressed for the log table if you run high-volume cleanup cycles.

### `pg_cron` Alternative

Use `pg_cron` to schedule cleanup directly in the database:

```sql
SELECT cron.schedule('cleanup-expired-logs', '0 * * * *',
  $$DELETE FROM action_log WHERE expires_at IS NOT NULL AND expires_at <= EXTRACT(EPOCH FROM NOW())$$
);
```

### Persistent Records

Records with `expires_at = NULL` are never deleted by `cleanupExpiredLogs`. Implement a separate archival or manual pruning policy for long-term audit log management.
