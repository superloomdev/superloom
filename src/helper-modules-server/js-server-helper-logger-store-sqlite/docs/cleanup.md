# Cleanup — js-server-helper-logger-store-sqlite

## No Native TTL

SQLite has no background TTL sweeper. Log records with a non-null `expires_at` remain in the table until explicitly deleted by `cleanupExpiredLogs`. Persistent records (where `expires_at IS NULL`) are never swept — they accumulate until manually deleted.

For file-backed deployments, schedule `cleanupExpiredLogs` on a regular cron. For `:memory:` deployments, cleanup is moot because the database disappears on process exit.

## Application-Managed Cleanup

```js
setInterval(async function () {
  const result = await Lib.Logger.cleanupExpiredLogs(Lib.Instance.initialize());
  if (result.success) {
    Lib.Debug.info('Logger cleanup deleted ' + result.deleted_count + ' expired logs');
  }
}, 3600 * 1000);  // hourly
```

Hourly is a reasonable default. Adjust based on your log volume and retention requirements.

## The Cleanup SQL

```sql
DELETE FROM "action_log"
WHERE "expires_at" IS NOT NULL
  AND "expires_at" <= ?
```

The bound parameter is `Lib.Utils.getUnixTime()` — real wall-clock seconds, not `instance.time`. The `expires_at` single-column index serves the range scan; SQLite's planner uses the index for the `IS NOT NULL` + range comparison.

## Cadence Guidance

| Deployment | Recommended cadence |
|------------|---------------------|
| File-backed (production) | Every 1–6 hours |
| High-volume (many TTL rows) | Every 15–30 minutes |
| `:memory:` (tests / dev) | Not needed — database resets on process exit |

## Operational Notes

### Persistent Records

Records with `expires_at = NULL` are never deleted by `cleanupExpiredLogs`. If you need to prune old persistent records, issue a manual `DELETE` with a `created_at` range condition or implement a separate archival policy.

### WAL Mode and Vacuum

In WAL mode, `cleanupExpiredLogs` marks rows as deleted in the WAL; they are physically removed at checkpoint time. To reclaim disk space from large cleanup cycles, run `VACUUM` periodically (locks the database for its duration).

### Index Efficiency

The single-column `expires_at` index covers the `cleanupExpiredLogs` range scan. Persistent records (`expires_at = NULL`) are still indexed but are skipped efficiently by the planner via the `IS NOT NULL` filter in the WHERE clause.
