# Cleanup — js-server-helper-verify-store-postgres

## No Native TTL

PostgreSQL has no background TTL sweeper. Expired verification records remain in the table until explicitly deleted. Schedule `cleanupExpiredRecords` on a regular cron to prevent unbounded table growth.

## Application-Managed Cleanup

```js
setInterval(async function () {
  const result = await Lib.Verify.cleanupExpiredRecords(Lib.Instance.initialize());
  if (result.success) {
    Lib.Debug.info('Verify cleanup deleted ' + result.deleted_count + ' expired codes');
  }
}, 3600 * 1000);  // hourly
```

Hourly is a reasonable default for short-lived verification codes (typically minutes to hours TTL).

## The Cleanup SQL

```sql
DELETE FROM "verification_codes"
WHERE "expires_at" < ?
```

The bound parameter is `Lib.Utils.getUnixTime()` — real wall-clock seconds, not `instance.time`. The `expires_at` index makes this a fast range scan.

## Cadence Guidance

| Deployment | Recommended cadence |
|------------|---------------------|
| Production | Every 1–6 hours |
| Development / test | Not critical; container restarts reset state |

## Operational Notes

### Table Bloat

PostgreSQL uses MVCC, so deleted rows are not immediately reclaimed. `VACUUM` (or `autovacuum`) reclaims dead tuples from deleted rows. If the verification table receives high write and cleanup volume, ensure `autovacuum` is not suppressed for that table.

### Alternatives

The PostgreSQL Event Scheduler equivalent is `pg_cron`. If your deployment uses `pg_cron`, you can register a cleanup job directly in the database to sweep expired rows without needing application-side scheduling.
