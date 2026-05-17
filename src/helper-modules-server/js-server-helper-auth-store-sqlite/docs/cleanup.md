# Cleanup

SQLite has no built-in row-level TTL. Expired session rows accumulate in the `sessions` table forever unless something deletes them. `cleanupExpiredSessions` is the deletion path; for file-backed deployments the application is responsible for scheduling it. `:memory:` deployments do not need scheduled cleanup because the database disappears when the Node process exits.

## On This Page

- [TTL Behavior](#ttl-behavior)
- [Recommended Cleanup Mechanism](#recommended-cleanup-mechanism)
- [Recommended Cadence](#recommended-cadence)
- [How `cleanupExpiredSessions` Is Implemented](#how-cleanupexpiredsessions-is-implemented)
- [Operational Notes](#operational-notes)

## TTL Behavior

| Aspect | SQLite (this adapter) |
|---|---|
| Native row-level TTL | None |
| `expires_at` column | Stored as `INTEGER`, indexed, queried by `cleanupExpiredSessions` only |
| Effect of skipping cleanup, file-backed | Expired rows remain on disk and in any backup. The Auth parent's runtime guards still reject expired rows, so there is no security exposure, but the database file grows unbounded |
| Effect of skipping cleanup, `:memory:` | None. The whole database disappears when the process exits |

The bare minimum for file-backed production is one scheduled run of `cleanupExpiredSessions` per hour. Lower cadence is acceptable for low-volume deployments; higher cadence offers diminishing returns because the `expires_at` index range scan is already efficient.

## Recommended Cleanup Mechanism

Because SQLite is embedded (in-process), the cleanup scheduler runs inside the same Node process as the application itself. There is no equivalent to `pg_cron` or a database-side scheduler; SQLite is a library, not a service.

**Persistent server (Express, Fastify, plain Node HTTP).** Schedule with `setInterval` inside the same process, or with a dedicated cron library (`node-cron`, `cron`) for crontab-style expressions. The function call is one local-file write; no network round-trip.

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

**Desktop / CLI applications.** Same shape as a persistent server. Use `setInterval` at app boot.

**Serverless function.** SQLite-backed serverless deployments are unusual because the file does not persist across invocations unless a network filesystem (EFS for AWS Lambda, similar elsewhere) is mounted. If you do run SQLite from serverless with a persistent filesystem, schedule cleanup via a platform-native event source (EventBridge rule, Cloud Scheduler job) and a dedicated handler that calls `cleanupExpiredSessions`:

```js
exports.handler = async function () {
  const instance = Lib.Instance.initialize();
  const result   = await Lib.AuthUser.cleanupExpiredSessions(instance);
  return { deleted_count: result.success ? result.deleted_count : 0 };
};
```

For the great majority of SQLite deployments (single-node servers, desktop apps, edge runtimes), the persistent-server pattern is the natural fit. Cross-link: the Auth parent's [`docs/runtime.md`](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-auth/docs/runtime.md) documents the per-runtime construction of `instance` in more detail. The cleanup call site itself does not differ between runtimes.

## Recommended Cadence

| Deployment | Cadence | Rationale |
|---|---|---|
| Production, file-backed | Every 1 hour | Cheap with the `expires_at` index. Keeps the database file from growing unbounded |
| Production, `:memory:` | None | The database disappears on process exit. Cleanup is moot |
| Staging or low-traffic | Every 6 hours | Same correctness, smaller log volume |
| Development | Manual or every 24 hours | Expired rows are not a problem on a dev database |

The cadence is upper-bounded by the operator's tolerance for stale rows in the file. There is no lower bound enforced by the adapter; running the sweep every minute is safe but wasteful.

## How `cleanupExpiredSessions` Is Implemented

The function issues one SQL statement:

```sql
DELETE FROM "<table_name>" WHERE "expires_at" < ?
```

The placeholder is bound to `instance.time` (UNIX seconds at the start of the request). The `expires_at` secondary index documented in [schema.md](schema.md) supports the range scan; deletion cost scales with the number of expired rows, not with the total row count.

The return shape includes `deleted_count`, set from the driver's reported affected-row count. Applications that want to track sweep efficiency can log this value alongside the request duration; the Auth parent's slow-query timing (when enabled via `Lib.Debug`) covers the same call.

The function does not commit in an explicit transaction; the `DELETE` runs in SQLite's default auto-commit mode. The driver helper may have WAL mode enabled (read its configuration to confirm), in which case readers continue to see consistent snapshots throughout the delete; partial deletion is not observable.

## Operational Notes

**WAL mode and concurrency.** SQLite's default journal mode is `DELETE`, but the `sql-sqlite` driver helper typically enables WAL (Write-Ahead Logging) for better concurrency. In WAL mode, the cleanup `DELETE` does not block readers and readers do not block the cleanup. Check the driver helper's configuration to confirm WAL is on; if it is not, expect brief reader-writer contention during the sweep.

**Database file growth.** `DELETE` marks pages as free but does not shrink the file. If the application has very high session-rotation rate (many `setSession` + `cleanupExpiredSessions` cycles), the file can stay larger than the logical row count would suggest. Run `VACUUM` periodically during low-traffic windows to reclaim the space; the driver helper does not do this automatically.

**Backups.** The adapter does not interact with backup tooling. Standard SQLite backup (online `VACUUM INTO`, file copy with WAL checkpointed) captures the sessions table identically to any other table. Expired-but-not-yet-deleted rows are included in backups, which is the expected behavior for an auditable store.

**Multiple Auth instances on the same file.** If multiple Auth instances (different `actor_type` values, different tables) share one SQLite file, they share one writer lock under SQLite's `journal_mode`. With WAL enabled this is usually fine; without WAL, concurrent writes serialize. The shared cleanup pattern is to schedule each instance's `cleanupExpiredSessions` at different minutes within the hour so the writes do not coincide.
