# Logger Module - AI Reference

## Module Overview
Compliance-friendly action log: one immutable row per log-worthy event,
recording who acted (actor_type/actor_id), on what (entity_type/entity_id),
doing which action (dot-notation string), with structured per-action `data`
plus optional IP / user-agent. Multi-backend - one Logger instance per
loader call, backed by one of: memory (tests), sqlite, postgres, mysql,
mongodb, dynamodb. Background-by-default writes; per-row retention policy
(`'persistent'` | `{ ttl_seconds: N }`); optional AES IP encryption at rest.

## Factory Pattern

```javascript
module.exports = function loader (shared_libs, config) {
  // Returns independent instance with isolated Lib + CONFIG.
  // Validates CONFIG at construction (STORE name, STORE_CONFIG, ERRORS) -
  // throws on any missing required key.
  return { log, listByEntity, listByActor, cleanupExpiredRecords, initializeStore };
};
```

## Public Functions

### log(instance, options) - async
Record one event. Background by default; pass `options.await: true` for
compliance writes that must not return until the row is durable.

- **options.scope**: String, optional, default `''` - multi-tenant namespace.
- **options.entity_type**: String - type of the affected entity.
- **options.entity_id**: String - ID of the affected entity.
- **options.actor_type**: String - type of the actor.
- **options.actor_id**: String - ID of the actor.
- **options.action**: String - dot-notation action key (e.g. `'auth.login'`).
- **options.data**: Object, optional - free-form JSON-serialisable payload.
- **options.ip**: String, optional - IP. Auto-captured from
  `instance.http_request` via `Lib.HttpHandler.getHttpRequestIPAddress` when
  that helper is present.
- **options.user_agent**: String, optional - UA. Same auto-capture.
- **options.retention**: `'persistent'` | `{ ttl_seconds: positive_int }`.
- **options.await**: Boolean, optional, default `false` - synchronous write.
- **Returns**: `{ success, error }`. `error` is `CONFIG.ERRORS.STORE_WRITE_FAILED`
  on adapter failure (only visible when `options.await === true`).

Programmer errors (missing required field, wrong type) throw `TypeError`
synchronously - they are never envelope errors.

### listByEntity(instance, options) - async
List actions recorded against one entity, most-recent first.

- **options.scope**, **options.entity_type**, **options.entity_id** - required.
- **options.actions**: String[], optional - literal action names or `'auth.*'`
  glob prefix.
- **options.start_time_ms**: Integer, optional - inclusive lower bound on
  `created_at_ms`.
- **options.end_time_ms**: Integer, optional - exclusive upper bound on
  `created_at_ms`.
- **options.cursor**: String, optional - resume token from previous page's
  `next_cursor`.
- **options.limit**: Integer, optional, default 50 - page size.
- **Returns**: `{ success, records, next_cursor, error }`.

### listByActor(instance, options) - async
List actions performed by one actor, most-recent first. Same return shape
as `listByEntity`. `actor_type` / `actor_id` replace `entity_*` on this side.

### cleanupExpiredRecords(instance) - async
Bulk-delete records whose `expires_at` is in the past. Persistent rows are
skipped. Native TTL on MongoDB and DynamoDB already handles expiry; this
function is the explicit fallback for SQL backends and any environment
without the native TTL feature.
- **Returns**: `{ success, deleted_count, error }`.

### initializeStore(instance) - async
Idempotent backend setup. Memory: no-op. SQL: `CREATE TABLE IF NOT EXISTS`
+ indexes on the actor PK + `expires_at`. MongoDB: TTL index on `_ttl` +
compound indexes on the two query paths. DynamoDB: `CreateTable` with the
GSI for actor queries.
- **Returns**: `{ success, error }`.

## Configuration

| Key | Default | Notes |
|---|---|---|
| `STORE` | `null` (required) | One of `memory|sqlite|postgres|mysql|mongodb|dynamodb` |
| `STORE_CONFIG` | `null` (required) | Per-store config; shape varies |
| `ERRORS` | `null` (required) | Domain error catalog (2 keys) |
| `IP_ENCRYPT_KEY` | `null` | Optional AES key (256-bit hex) for IP encryption |

### STORE_CONFIG per backend

| `STORE` | Required keys |
|---|---|
| `memory` | `{}` |
| `sqlite` | `{ table_name, lib_sql: Lib.SQLite }` |
| `postgres` | `{ table_name, lib_sql: Lib.Postgres }` |
| `mysql` | `{ table_name, lib_sql: Lib.MySQL }` |
| `mongodb` | `{ collection_name, lib_mongodb: Lib.MongoDB }` |
| `dynamodb` | `{ table_name, lib_dynamodb: Lib.DynamoDB }` |

### CONFIG.ERRORS - required keys

Every key must be present at construction or the loader throws. Values are
whatever shape your application uses (typically `{ code, message, status }`):
- `STORE_READ_FAILED` - listByEntity / listByActor failure, status 503
- `STORE_WRITE_FAILED` - addRecord / cleanupExpiredRecords failure, status 503

## Storage Internals

| Backend | Schema | Native TTL | Recommended cleanup |
|---|---|---|---|
| memory | append-only Array | n/a | `cleanupExpiredRecords` (linear scan) |
| sqlite | `action_log` table, PK `(scope, entity_type, entity_id, sort_key)` + actor index `(scope, actor_type, actor_id, sort_key)` + `expires_at` index | No | `cleanupExpiredRecords` |
| postgres | same SQL schema | No | EventBridge / cron / `pg_cron` |
| mysql | same SQL schema | No | EventBridge / cron / `EVENT` scheduler |
| mongodb | precomputed `entity_pk` + `actor_pk` (NUL-separated composite strings) with compound indexes against `sort_key DESC`; TTL index on `_ttl` Date field | Yes (~60 s) | TTL index is automatic; explicit fallback exists |
| dynamodb | base table `(entity_pk, sort_key)` + GSI `actor_pk_sort_key_index`; AWS table-level TTL on `expires_at` | Yes (~48 h) | Enable AWS TTL; explicit fallback exists |

VARCHAR sizes in the SQL schema are tuned so the composite PK and actor
index fit under MySQL InnoDB's 3072-byte key limit at utf8mb4. SQLite's
type-affinity rules ignore the lengths.

## Retention Policy

Two modes encoded per-row:
- `retention: 'persistent'` -> `expires_at = null`, never deleted.
- `retention: { ttl_seconds: N }` -> `expires_at = created_at + N`,
  cleared by native TTL sweeper or `cleanupExpiredRecords`.

The TTL is on the row, not on the module, so a single table mixes forever
rows ("user created") with short-retention rows ("login event") freely.

## Sort Key

Each record carries `sort_key = "${created_at_ms}-${rand3}"` where `rand3`
is three lowercase-alpha characters. Two simultaneous events in the same
millisecond stay deterministically ordered. Cursor-based pagination uses
`sort_key < cursor` to walk pages from most-recent to oldest.

## IP Encryption

When `CONFIG.IP_ENCRYPT_KEY` is set:
- `log()` runs each non-empty IP through `Lib.Crypto.aesEncrypt(ip, key)`
  before handing the record to the store.
- `listByEntity` / `listByActor` decrypt on the way out.
- A decrypt failure (e.g. key rotation, mismatched key) returns the
  ciphertext as-is rather than throwing - audit reviewers see the opaque
  blob.

If unset, IPs are stored verbatim. Some deployments need plaintext for
fraud detection / geo-IP lookups - leave the config null in those cases.

## Tested Backends

Memory + SQLite run on every push (no Docker). Postgres / MySQL / MongoDB /
DynamoDB-Local run via the module's `_test/docker-compose.yml`. The shared
store suite (`_test/shared-store-suite.js`) runs identical end-to-end
coverage against every backend - 14 tests per backend × 5 backends + 36
unit tests = 106 total.

## Dependencies (peer)
- **Lib.Utils**: type checks (`isNullOrUndefined`, `isFunction`, `isString`, `isInteger`, `isObject`, `isEmptyString`)
- **Lib.Debug**: `debug` for adapter-failure diagnostic logs
- **Lib.Crypto**: `generateRandomString` for sort-key randomisation, `aesEncrypt` / `aesDecrypt` for optional IP encryption
- **Lib.Instance**: `backgroundRoutine(instance)` for non-blocking writes
- **Lib.HttpHandler** (optional): `getHttpRequestIPAddress`, `getHttpRequestUserAgent` for auto-capture from `instance.http_request`

Plus one of: Lib.SQLite / Lib.Postgres / Lib.MySQL / Lib.MongoDB / Lib.DynamoDB
- depending on which `STORE` is selected. The logger module never imports
any of these directly; it consumes them through `STORE_CONFIG`.

## Caller Pattern - Pass-Through

```javascript
const result = await Lib.Logger.listByEntity(instance, options);
if (result.success === false) {
  return { success: false, error: result.error };  // pass-through
}
// success path
```

For `log`, the common pattern is fire-and-forget:

```javascript
Lib.Logger.log(instance, { ..., retention: 'persistent' });
// No await - the row commits in the background, the request continues.
```

For compliance writes:

```javascript
const audit = await Lib.Logger.log(instance, { ..., retention: 'persistent', await: true });
if (audit.success === false) { return audit; }
```

## Out of Scope
- **Application metrics** - Datadog / Prometheus / OpenTelemetry handle
  request rate / latency / error counts. The logger captures **events
  that should appear in an audit trail**, not telemetry.
- **Structured request logs** - `Lib.Debug.info` already handles this.
- **Notification delivery** - the module records the event; emailing or
  pushing about it is the caller's job.
- **Search by free text** - `data` is opaque to the store. Mirror any
  field you need to query into a dedicated application schema.

## Wire Format

This module has no wire format. `data` is stored as JSON in SQL backends
and as a native nested document in MongoDB / DynamoDB; readers receive it
as a plain JavaScript object. The application owns the action-namespace
(`'auth.login'`, `'profile.username.changed'`) and the per-action `data`
schema; the logger is opaque to both.

## Lifecycle (log flow)

1. Validate options shape (throws `TypeError` on bad input - programmer error).
2. Build the canonical record:
   - `created_at` / `created_at_ms` from `instance.time` / `instance.time_ms`.
   - `sort_key = ${created_at_ms}-${rand3}`.
   - `expires_at = (retention === 'persistent') ? null : created_at + ttl_seconds`.
   - Auto-capture `ip` / `user_agent` from `instance.http_request` when
     `Lib.HttpHandler` is present and the option was not provided.
   - Encrypt `ip` under `CONFIG.IP_ENCRYPT_KEY` if configured.
3. If `options.await === true`: await `store.addRecord` and return its
   envelope (mapping store failure to `CONFIG.ERRORS.STORE_WRITE_FAILED`).
4. Otherwise: register a background routine on the instance, fire
   `store.addRecord` without awaiting, return `{ success: true }`
   immediately. Adapter failures are logged via `Lib.Debug.debug` but
   never surface to the caller.
