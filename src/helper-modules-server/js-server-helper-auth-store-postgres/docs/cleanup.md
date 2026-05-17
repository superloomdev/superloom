# Cleanup

PostgreSQL has no built-in row-level TTL. Expired session rows accumulate in the `sessions` table forever unless something deletes them. `cleanupExpiredSessions` is the deletion path; the application is responsible for scheduling it.

## On This Page

- [TTL Behavior](#ttl-behavior)
- [Recommended Cleanup Mechanism](#recommended-cleanup-mechanism)
- [Recommended Cadence](#recommended-cadence)
- [How `cleanupExpiredSessions` Is Implemented](#how-cleanupexpiredsessions-is-implemented)
- [Operational Notes](#operational-notes)

## TTL Behavior

| Aspect | PostgreSQL |
|---|---|
| Native row-level TTL | None |
| `expires_at` column | Stored, indexed, queried by `cleanupExpiredSessions` only |
| Effect of skipping cleanup | Expired sessions remain on disk and in any backup. The Auth parent's runtime guards (`expires_at < instance.time` in `getSession` semantics) still reject expired rows, so there is no security exposure, but the table grows unbounded |

The bare minimum for production is one scheduled run of `cleanupExpiredSessions` per hour. Lower cadence is acceptable for low-volume deployments; higher cadence offers diminishing returns because the index range scan is already efficient.

## Recommended Cleanup Mechanism

The scheduling shape depends on the runtime. The function call itself is identical in both shapes; only the scheduler differs.

**Persistent server (Express, Fastify, plain Node HTTP):** schedule with `setInterval` inside the same process, or with a dedicated cron library (`node-cron`, `cron`) for crontab-style expressions. The function call is one round-trip; no need for a separate worker process.

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

**Serverless function (AWS Lambda, Cloud Functions, Azure Functions):** schedule via a platform-native event source (EventBridge rule, Cloud Scheduler job, Azure Timer Trigger) and bind it to a dedicated handler function. The handler reuses the same `Lib` container so it shares the connection pool with request handlers.

```js
exports.handler = async function () {
  const instance = Lib.Instance.initialize();
  const result   = await Lib.AuthUser.cleanupExpiredSessions(instance);
  return { deleted_count: result.success ? result.deleted_count : 0 };
};
```

Cross-link: the Auth parent's [`docs/runtime.md`](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-auth/docs/runtime.md) documents the per-runtime construction of `instance` in more detail. The cleanup call site itself does not differ.

**`pg_cron` (database-side scheduling):** PostgreSQL offers the `pg_cron` extension on many managed Postgres services. It is a valid alternative when an operator prefers to keep cleanup inside the database. The DELETE statement that `pg_cron` runs must match the one the adapter issues, namely `DELETE FROM "<table_name>" WHERE "expires_at" < EXTRACT(EPOCH FROM NOW())`. Note that this bypasses the adapter's `instance.time_ms` timing instrumentation, so cleanup events do not show up in `Lib.Debug` logs.

## Recommended Cadence

| Deployment | Cadence | Rationale |
|---|---|---|
| Production, persistent server | Every 1 hour | Cheap. Keeps the `expires_at` index small and the table from growing unbounded |
| Production, serverless | Every 1 hour via platform scheduler | Same rationale. The cost of an extra invocation per hour is negligible |
| Staging or low-traffic | Every 6 hours | Same correctness, smaller log volume |
| Development | Manual or every 24 hours | Expired rows are not a problem on a dev database |

The cadence is upper-bounded by the operator's tolerance for stale rows in the table. There is no lower bound enforced by the adapter; running the sweep every minute is safe but wasteful.

## How `cleanupExpiredSessions` Is Implemented

The function issues one SQL statement:

```sql
DELETE FROM "<table_name>" WHERE "expires_at" < ?
```

The placeholder is bound to `instance.time` (UNIX seconds at the start of the request). The `expires_at` secondary index documented in [schema.md](schema.md) supports the range scan; deletion cost scales with the number of expired rows, not with the total row count.

The return shape includes `deleted_count`, set from the driver's `affected_rows` field. Applications that want to track sweep efficiency can log this value alongside the request duration; the Auth parent's slow-query timing (when enabled via `Lib.Debug`) covers the same round-trip.

The function does not commit in a transaction; the `DELETE` runs in the connection's default auto-commit context. There is no scenario where partial deletion is observable: PostgreSQL's MVCC means a concurrent reader sees either the pre-delete state or the post-delete state for any given row.

## Operational Notes

**Index health.** The `expires_at` index never accumulates dead tuples that would slow the range scan; PostgreSQL's autovacuum reclaims them during normal operation. A manually-triggered `VACUUM` is unnecessary unless the application has a very high session-rotation rate (more than one cleanup per minute), in which case schedule a daily `VACUUM ANALYZE` on the table.

**Index bloat from very long-lived sessions.** If most sessions live for years (long-lived API keys, install-bound tokens), the `expires_at` index degenerates into a near-empty range scan because almost no rows match the predicate. This is not a correctness issue; performance stays acceptable because the index is small. No tuning required.

**Backups.** The adapter does not interact with backup tooling. Standard PostgreSQL backup (logical with `pg_dump`, physical with WAL archiving) captures the sessions table identically to any other table. Expired-but-not-yet-deleted rows are included in backups, which is the expected behavior for an auditable store.
