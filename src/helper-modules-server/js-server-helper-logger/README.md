# @superloomdev/js-server-helper-logger

[![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 20.19+](https://img.shields.io/badge/Node.js-20.19%2B-brightgreen.svg)](https://nodejs.org)

Compliance-friendly action log for Superloom applications. Records one immutable row per log-worthy event — _who_ acted (`actor_type`/`actor_id`), _on what_ (`entity_type`/`entity_id`), doing _which_ action (dot-notation string), with structured per-action `data` plus optional IP / user-agent capture for regulator-facing audit trails.

Built-in storage adapters for **memory** (tests), **sqlite**, **postgres**, **mysql**, **mongodb**, and **dynamodb** — pick one with a config string, no adapter code to maintain. Part of the [Superloom](https://github.com/superloomdev/superloom) framework.

Three properties make this safe to drop into any request handler:

- **Background-by-default writes.** `log()` returns immediately; the row is committed asynchronously via `Lib.Instance.backgroundRoutine`. Compliance callers opt in to durable writes with `options.await: true`.
- **Per-entry retention policy.** Every row is either `'persistent'` (never deleted) or `{ ttl_seconds: N }` (auto-deleted at `created_at + N`). One table can mix forever-rows ("user created") with short-retention rows ("read audit").
- **Optional IP encryption at rest.** Set `CONFIG.IP_ENCRYPT_KEY` and the IP column is AES-encrypted on the way in and decrypted on the way out — transparent to callers.

---

## Tested Backends

The shared store suite (`_test/shared-store-suite.js`) runs the same 14-case contract against every backend. Memory + SQLite need no Docker; the rest run via `_test/docker-compose.yml`.

| Backend | Schema | Native TTL | Cleanup |
|---|---|---|---|
| `memory` | In-memory array | n/a (process-scoped) | `cleanupExpiredRecords` (linear scan) |
| `sqlite` | `action_log` table, PK `(scope, entity_type, entity_id, sort_key)` | No | `cleanupExpiredRecords` |
| `postgres` | same SQL schema | No | `cleanupExpiredRecords` (or `pg_cron`) |
| `mysql` | same SQL schema | No | `cleanupExpiredRecords` (or `EVENT` scheduler) |
| `mongodb` | indexed `entity_pk` / `actor_pk` + TTL index on `_ttl` (Date) | Yes (~60 s sweep) | TTL is automatic; `cleanupExpiredRecords` is the explicit fallback |
| `dynamodb` | base table `(entity_pk, sort_key)` + GSI `(actor_pk, sort_key)`; AWS TTL on `expires_at` | Yes (~48 h sweep) | Enable AWS table-level TTL; `cleanupExpiredRecords` is the explicit fallback |

Run all backends end-to-end:

```bash
cd _test/
npm install
npm test     # spins up docker compose, runs every backend, tears it down
```

---

## Peer Dependencies (Injected via Loader)

- `@superloomdev/js-helper-utils` — `Lib.Utils`
- `@superloomdev/js-helper-debug` — `Lib.Debug`
- `@superloomdev/js-server-helper-crypto` — `Lib.Crypto`
- `@superloomdev/js-server-helper-instance` — `Lib.Instance`
- `@superloomdev/js-server-helper-http` — `Lib.HttpHandler` (optional, only if you want auto-capture of IP / user-agent)

Plus **one** of the following depending on the chosen `STORE`:

| `STORE` | Required helper |
|---|---|
| `'sqlite'` | `Lib.SQLite` (`@superloomdev/js-server-helper-sql-sqlite`) |
| `'postgres'` | `Lib.Postgres` (`@superloomdev/js-server-helper-sql-postgres`) |
| `'mysql'` | `Lib.MySQL` (`@superloomdev/js-server-helper-sql-mysql`) |
| `'mongodb'` | `Lib.MongoDB` (`@superloomdev/js-server-helper-nosql-mongodb`) |
| `'dynamodb'` | `Lib.DynamoDB` (`@superloomdev/js-server-helper-nosql-aws-dynamodb`) |
| `'memory'` | (none — for tests) |

The logger module **never** imports these helpers directly. Only the chosen store's source file is loaded, so unused backends never pull in their npm dependencies.

---

## Installation

```bash
npm install @superloomdev/js-server-helper-logger
```

---

## Quick Start

```javascript
// One-time setup at boot
Lib.Logger = require('@superloomdev/js-server-helper-logger')(Lib, {
  STORE: 'postgres',
  STORE_CONFIG: {
    table_name: 'action_log',
    lib_sql: Lib.Postgres
  },
  ERRORS: Lib.User.errors,         // your domain error catalog
  IP_ENCRYPT_KEY: process.env.IP_ENCRYPT_KEY  // optional
});

// Idempotent table + index creation
await Lib.Logger.initializeStore(instance);

// In a request handler - fire-and-forget audit row
Lib.Logger.log(instance, {
  scope:       'tenant.42',
  entity_type: 'user',
  entity_id:   user.id,
  actor_type:  'user',
  actor_id:    user.id,
  action:      'profile.username.changed',
  data:        { from: old_username, to: new_username },
  retention:   'persistent'
});
// Returns immediately. The row commits in the background.

// Compliance scenario - do not return 200 OK until the audit row is durable
const audit = await Lib.Logger.log(instance, {
  scope:       'tenant.42',
  entity_type: 'user',
  entity_id:   user.id,
  actor_type:  'user',
  actor_id:    user.id,
  action:      'auth.password.changed',
  retention:   'persistent',
  await:       true
});
if (audit.success === false) { return audit; }

// Read - "show me everything that happened to this user"
const history = await Lib.Logger.listByEntity(instance, {
  scope:       'tenant.42',
  entity_type: 'user',
  entity_id:   user.id,
  actions:     ['auth.*', 'profile.*'],   // optional glob filter
  limit:       50
});
// { success: true, records: [...], next_cursor: '...', error: null }
```

---

## Public API

| Function | Returns | Use |
|---|---|---|
| `log(instance, options)` | `{ success, error }` | Record one event. Background by default; `options.await: true` for compliance writes |
| `listByEntity(instance, options)` | `{ success, records, next_cursor, error }` | "What happened to this entity?" |
| `listByActor(instance, options)` | `{ success, records, next_cursor, error }` | "What did this actor do?" |
| `cleanupExpiredRecords(instance)` | `{ success, deleted_count, error }` | Cron-driven sweep of TTL-expired rows |
| `initializeStore(instance)` | `{ success, error }` | Idempotent backend setup (CREATE TABLE / createIndex / CreateTable) |

### `options` for `log`

| Field | Type | Required | Description |
|---|---|---|---|
| `scope` | String | optional (default `''`) | Multi-tenant namespace |
| `entity_type` | String | yes | Type of the affected entity (`'user'`, `'project'`, `'invoice'`) |
| `entity_id` | String | yes | ID of the affected entity |
| `actor_type` | String | yes | Type of the actor (`'user'`, `'admin'`, `'system'`, `'webhook'`) |
| `actor_id` | String | yes | ID of the actor |
| `action` | String | yes | Dot-notation action type — `'auth.login'`, `'profile.name.changed'` |
| `data` | Object | optional | Free-form, JSON-serializable per-action payload |
| `ip` | String | optional | Auto-captured from `instance.http_request` when `Lib.HttpHandler` is present |
| `user_agent` | String | optional | Same auto-capture |
| `retention` | `'persistent'` \| `{ ttl_seconds: N }` | yes | Per-row retention policy |
| `await` | Boolean | optional (default `false`) | If `true`, await the store write before returning |

### `options` for `listByEntity` / `listByActor`

| Field | Type | Required | Description |
|---|---|---|---|
| `scope` | String | optional | Same default as `log()` |
| `entity_type`, `entity_id` | String | yes (for `listByEntity`) | |
| `actor_type`, `actor_id` | String | yes (for `listByActor`) | |
| `actions` | String[] | optional | Filter to literal actions or `'auth.*'`-style globs |
| `start_time_ms` | Integer | optional | Inclusive lower bound on `created_at_ms` |
| `end_time_ms` | Integer | optional | Exclusive upper bound on `created_at_ms` |
| `cursor` | String | optional | Resume token from previous page's `next_cursor` |
| `limit` | Integer | optional (default 50) | Page size |

### Return shape

```javascript
// log
{ success: true,  error: null }
{ success: false, error: <CONFIG.ERRORS.STORE_WRITE_FAILED> }   // only when await:true

// listByEntity / listByActor
{
  success: true,
  records: [
    {
      scope, entity_type, entity_id, actor_type, actor_id, action,
      data, ip, user_agent,
      created_at, created_at_ms, sort_key, expires_at
    },
    ...
  ],
  next_cursor: '<sort_key of last record, or null on final page>',
  error: null
}

// cleanupExpiredRecords
{ success: true, deleted_count: <Integer>, error: null }
```

---

## Configuration

| Key | Default | Notes |
|---|---|---|
| `STORE` | `null` (required) | One of `'memory' \| 'sqlite' \| 'postgres' \| 'mysql' \| 'mongodb' \| 'dynamodb'` |
| `STORE_CONFIG` | `null` (required) | Per-store config; shape varies (see below) |
| `ERRORS` | `null` (required) | Map of two failure keys to your domain error objects |
| `IP_ENCRYPT_KEY` | `null` | When set, IPs are AES-encrypted at rest using `Lib.Crypto.aesEncrypt` |

### `STORE_CONFIG` per backend

| Backend | Required `STORE_CONFIG` keys |
|---|---|
| `memory` | `{}` (no config) |
| `sqlite` | `{ table_name: 'action_log', lib_sql: Lib.SQLite }` |
| `postgres` | `{ table_name: 'action_log', lib_sql: Lib.Postgres }` |
| `mysql` | `{ table_name: 'action_log', lib_sql: Lib.MySQL }` |
| `mongodb` | `{ collection_name: 'action_log', lib_mongodb: Lib.MongoDB }` |
| `dynamodb` | `{ table_name: 'action_log', lib_dynamodb: Lib.DynamoDB }` |

### `ERRORS` — required keys

Every key must be present at construction or the loader throws. Each value is whatever shape your application uses for client-facing errors (typically `{ code, message, status }` from your `[entity].errors.js`).

| Key | Status | Surfaced when |
|---|---|---|
| `STORE_READ_FAILED` | 503 | `listByEntity` / `listByActor` adapter call returned `success: false` |
| `STORE_WRITE_FAILED` | 503 | `addRecord` / `cleanupExpiredRecords` returned `success: false` (only seen by callers when `options.await: true` for `log`) |

The logger module returns these objects **verbatim** on every failure path so your controllers can pass-through:

```javascript
const result = await Lib.Logger.listByEntity(instance, options);
if (result.success === false) {
  return { success: false, error: result.error };  // pass-through
}
```

---

## Retention Policies

Two-mode design keeps the per-row decision local to the call-site:

```javascript
// Always-keep: account creation, GDPR deletion markers, financial events
Lib.Logger.log(instance, { ..., retention: 'persistent' });

// Auto-clear after 90 days: read audits, login events
Lib.Logger.log(instance, { ..., retention: { ttl_seconds: 90 * 24 * 3600 } });
```

The TTL is stored on the row, not as a module-wide rule, so a single log table happily mixes forever-rows with short-retention rows. SQL backends rely on `cleanupExpiredRecords`; MongoDB and DynamoDB also have native TTL sweepers (the explicit cleanup function is exposed for deterministic test cleanup or environments without the native feature).

---

## Cleanup Cadence

| Backend | Recommended cleanup |
|---|---|
| `dynamodb` | Enable AWS native TTL on `expires_at` (Dynamo sweeps within ~48 h, free) |
| `mongodb` | The store's `initializeStore` creates a TTL index on `_ttl` (~60 s sweep). `cleanupExpiredRecords` is the explicit fallback. |
| `postgres` | EventBridge / cron / `pg_cron` — call `Logger.cleanupExpiredRecords` once per day |
| `mysql` | EventBridge / cron / MySQL `EVENT` scheduler — same daily cadence |
| `sqlite` | `setInterval` inside the Node process or external cron |
| `memory` | Test-only - no cleanup needed |

The logger module never depends on cleanup running for correctness — list queries return whatever rows exist.

---

## IP Encryption

When `CONFIG.IP_ENCRYPT_KEY` is set, every non-empty IP is run through `Lib.Crypto.aesEncrypt(ip, key)` before storage. Reads transparently decrypt with `Lib.Crypto.aesDecrypt`. If the configured key cannot decrypt a stored value (key rotation, environment misconfiguration), the store returns the ciphertext rather than throwing — audit reviewers at least see the opaque blob and can investigate.

Key requirements:

- A 256-bit hex key (64 hex characters) is recommended.
- Store the key in your secret manager (AWS Secrets Manager, GCP Secret Manager, sealed Kubernetes secret) — **never** in source.
- Rotate by deploying a reader that knows the new key while data written under the old key is still being read; once the cutover window passes, retire the old key.

If your environment does fraud detection or geo-IP lookups, leave `IP_ENCRYPT_KEY` unset and rely on transport-level controls instead.

---

## Out of Scope

- **Application metrics** — Datadog / Prometheus / OpenTelemetry are the right tools for request rate, latency, and error counts. The logger captures **events that should appear in an audit trail**, not telemetry.
- **Structured request logs** — `Lib.Debug.info` already handles this. Don't audit-log every request.
- **Notification delivery** — this module records that an event happened; sending an email/push/Slack message is the caller's job.
- **Search by free text** — the `data` payload is opaque to the store. If you need to query by `data.from`, mirror that field into a dedicated index in your application schema.
