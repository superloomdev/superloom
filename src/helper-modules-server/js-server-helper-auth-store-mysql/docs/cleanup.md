# Cleanup

MySQL has no built-in row-level TTL. Expired session rows accumulate in the `sessions` table forever unless something deletes them. `cleanupExpiredSessions` is the deletion path; application code is responsible for scheduling it. There is no equivalent to Postgres's `pg_cron` extension in MySQL, but the **MySQL Event Scheduler** can serve the same purpose if enabled.

## On This Page

- [TTL Behavior](#ttl-behavior)
- [Recommended Cleanup Mechanism](#recommended-cleanup-mechanism)
- [Recommended Cadence](#recommended-cadence)
- [How `cleanupExpiredSessions` Is Implemented](#how-cleanupexpiredsessions-is-implemented)
- [MySQL Event Scheduler Alternative](#mysql-event-scheduler-alternative)
- [Operational Notes](#operational-notes)

## TTL Behavior

| Aspect | MySQL (this adapter) |
|---|---|
| Native row-level TTL | None |
| `expires_at` column | Stored as `BIGINT`, indexed, queried by `cleanupExpiredSessions` only |
| Effect of skipping cleanup | Expired rows remain in the table and in any backup. The Auth parent's runtime guards still reject expired rows, so there is no security exposure, but the table grows unbounded and `SELECT` scans slow down |

The bare minimum for production is one scheduled run of `cleanupExpiredSessions` per hour. Lower cadence is acceptable for low-volume deployments; higher cadence offers diminishing returns because the `expires_at` index range scan is already efficient.

## Recommended Cleanup Mechanism

Because MySQL has no `pg_cron` equivalent, the standard pattern is an application-side cron job (in-process `setInterval` or a system cron invoking a CLI) that calls `cleanupExpiredSessions`.

**Persistent server (Express, Fastify, plain Node HTTP).** Schedule with `setInterval` inside the same process:

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

**Serverless function.** Use a platform-native event source (EventBridge rule, Cloud Scheduler job, similar) and a dedicated handler:

```js
exports.handler = async function () {
  const instance = Lib.Instance.initialize();
  const result   = await Lib.AuthUser.cleanupExpiredSessions(instance);
  return { deleted_count: result.success ? result.deleted_count : 0 };
};
```

Cross-link: the Auth parent's [`docs/runtime.md`](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-auth/docs/runtime.md) documents the per-runtime construction of `instance` in more detail.

## Recommended Cadence

| Deployment | Cadence | Rationale |
|---|---|---|
| Production | Every 1 hour | Cheap with the `expires_at` index. Keeps the table from growing unbounded |
| Staging or low-traffic | Every 6 hours | Same correctness, smaller log volume |
| Development | Manual or every 24 hours | Expired rows are not a problem on a dev database |

The cadence is upper-bounded by the operator's tolerance for stale rows in the table. There is no lower bound enforced by the adapter; running the sweep every minute is safe but wasteful.

## How `cleanupExpiredSessions` Is Implemented

The function issues one SQL statement:

```sql
DELETE FROM `sessions_user` WHERE `expires_at` < ?
```

The placeholder is bound to `instance.time` (UNIX seconds at the start of the request). The `expires_at` secondary index documented in [schema.md](schema.md) supports the range scan; deletion cost scales with the number of expired rows, not with the total row count.

The return shape includes `deleted_count`, set from the driver's reported affected-row count (`result.affectedRows`). Applications that want to track sweep efficiency can log this value alongside the request duration; the Auth parent's slow-query timing (when enabled via `Lib.Debug`) covers the same call.

The function does not open an explicit transaction; the `DELETE` runs in MySQL's default auto-commit mode. InnoDB's MVCC ensures readers see consistent snapshots throughout the delete; partial deletion is not observable to concurrent `getSession` or `listSessionsByActor` calls.

## MySQL Event Scheduler Alternative

If the MySQL server has the Event Scheduler enabled (`event_scheduler = ON`), a server-side scheduled event can replace the application-side cron:

```sql
-- Create an event that runs every hour
CREATE EVENT IF NOT EXISTS ev_cleanup_expired_sessions
  ON SCHEDULE EVERY 1 HOUR
  DO
    DELETE FROM sessions_user WHERE expires_at < UNIX_TIMESTAMP();
```

**Pros:** No application code to write; works even when the Node process is not running.  
**Cons:** Event Scheduler must be enabled at the server level; events are not replicated in all MySQL versions/configurations; harder to observe and debug than application logs.

The adapter does not create or manage the event. If you choose this path, provision it via your schema-management tooling (migrations, IaC, DBA scripts) alongside the table creation. `setupNewStore` does not touch the Event Scheduler.

## Operational Notes

**Table growth and `OPTIMIZE TABLE`.** `DELETE` marks rows as free space within the InnoDB file, but does not shrink the tablespace file on disk. If the application has very high session-rotation rate (many `setSession` + `cleanupExpiredSessions` cycles), the table can stay larger than the logical row count would suggest. Run `OPTIMIZE TABLE sessions_user` periodically during low-traffic windows to reclaim space and rebuild the indexes; this briefly locks the table, so schedule it outside peak hours.

**Binlog and replication.** `cleanupExpiredSessions` issues a `DELETE` without a `WHERE` clause on the primary key, which is logged as a single statement in statement-based replication (SBR) or as multiple row events in row-based replication (RBR). If you run a high-volume cleanup against a replication slave, prefer RBR to avoid slave lag from a large single-statement binlog entry. The adapter has no opinion on SBR vs RBR; this is a database-administration concern.

**Backups.** The adapter does not interact with backup tooling. Standard MySQL backup (logical `mysqldump`, physical `xtrabackup`, snapshot-based) captures the sessions table identically to any other table. Expired-but-not-yet-deleted rows are included in backups, which is the expected behavior for an auditable store.

**Multiple Auth instances on the same database.** If multiple Auth instances (different `actor_type` values, different tables) share one MySQL database, they share the same connection pool if they use the same `Lib.MySQL` instance. The `cleanupExpiredSessions` call on one Auth instance only touches its own table; there is no cross-table sweep. Schedule each instance's cleanup at different minutes within the hour so the `DELETE` statements do not coincide and contend for the connection pool.
