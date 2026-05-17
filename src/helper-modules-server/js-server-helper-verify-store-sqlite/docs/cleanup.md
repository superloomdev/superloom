# Cleanup — js-server-helper-verify-store-sqlite

## No Native TTL

SQLite has no background TTL sweeper. Expired verification records remain in the table until explicitly deleted. For file-backed deployments this means the table grows unboundedly if cleanup is not scheduled. For `:memory:` deployments the database is destroyed on process exit, so cleanup is moot.

## Application-Managed Cleanup

Call `cleanupExpiredRecords` on a regular schedule from your application:

```js
setInterval(async function () {
  const result = await Lib.Verify.cleanupExpiredRecords(Lib.Instance.initialize());
  if (result.success) {
    Lib.Debug.info('Verify cleanup deleted ' + result.deleted_count + ' expired codes');
  }
}, 3600 * 1000);  // hourly
```

For persistent servers, hourly is a reasonable default. Verification codes are short-lived (typically minutes), so a one-hour sweep window means at most one hour of expired rows accumulate.

## The Cleanup SQL

`cleanupExpiredRecords` executes:

```sql
DELETE FROM "verification_codes"
WHERE "expires_at" < ?
```

The bound parameter is `Lib.Utils.getUnixTime()` — the real wall-clock time in Unix epoch seconds. This is intentionally not `instance.time`; cleanup must use the real clock so rows expire on schedule regardless of when the request instance was initialized.

The `expires_at` index makes this a fast range scan even as the table grows.

## Cadence Guidance

| Deployment | Recommended cadence |
|------------|---------------------|
| File-backed (production) | Every 1–6 hours |
| `:memory:` (tests / dev) | Not needed — database resets on process exit |

## Operational Notes

### WAL Mode

If the SQLite database is opened in WAL (Write-Ahead Logging) mode (the default when `JOURNAL_MODE: 'WAL'` is set in the `js-server-helper-sql-sqlite` config), `cleanupExpiredRecords` deletes rows from the WAL before the next checkpoint. Rows are physically reclaimed at checkpoint time.

### File Size

After many cleanup cycles, the SQLite file may not shrink automatically. To reclaim disk space, run `VACUUM` on the database periodically. `VACUUM` rewrites the entire database file and is safe to run offline, but it locks the database for its duration.
