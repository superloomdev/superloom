# @superloomdev/js-server-helper-logger

[![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 20.19+](https://img.shields.io/badge/Node.js-20.19%2B-brightgreen.svg)](https://nodejs.org)

Compliance-friendly action log for Superloom applications. Records one immutable row per log-worthy event — _who_ acted (`actor_type`/`actor_id`), _on what_ (`entity_type`/`entity_id`), doing _which_ action (dot-notation string), with structured per-action `data` plus optional IP / user-agent capture for regulator-facing audit trails.

Built-in storage adapters for **memory** (tests), **sqlite**, **postgres**, **mysql**, **mongodb**, and **dynamodb** — pick one with a config string, no adapter code to maintain. Part of the [Superloom](https://github.com/superloomdev/superloom) framework.

**Further reading:**
- [`docs/data-model.md`](docs/data-model.md) — Record fields and design rationale
- [`docs/storage-adapters.md`](docs/storage-adapters.md) — Choosing and configuring backends

---

## What It Does

This module solves three problems that every audit logging system faces:

**1. Don't block the request.** `log()` returns immediately. The row commits asynchronously via `Lib.Instance.backgroundRoutine`. For compliance scenarios where you need confirmation, use `options.await: true`.

**2. Mix retention policies in one table.** Some events live forever (account creation), others expire in 90 days (login events). Set per-row retention at write time — no separate tables needed.

**3. Encrypt sensitive data at rest.** Set `CONFIG.IP_ENCRYPT_KEY` and IP addresses are AES-encrypted transparently. Audit reviewers still see the data; attackers with database access see only ciphertext.

Three properties make this safe to drop into any request handler:

- **Background-by-default writes.** `log()` returns immediately; the row is committed asynchronously via `Lib.Instance.backgroundRoutine`. Compliance callers opt in to durable writes with `options.await: true`.
- **Per-entry retention policy.** Every row is either `'persistent'` (never deleted) or `{ ttl_seconds: N }` (auto-deleted at `created_at + N`). One table can mix forever-rows ("user created") with short-retention rows ("read audit").
- **Optional IP encryption at rest.** Set `CONFIG.IP_ENCRYPT_KEY` and the IP column is AES-encrypted on the way in and decrypted on the way out — transparent to callers.

---

## Tested Backends

The shared store suite (`_test/shared-store-suite.js`) runs the same 14-case contract against every backend. Memory + SQLite need no Docker; the rest run via `_test/docker-compose.yml`.

| Backend | Schema | Native TTL | Cleanup |
|---|---|---|---|
| `memory` | In-memory array | n/a (process-scoped) | `cleanupExpiredLogs` (linear scan) |
| `sqlite` | `action_log` table, PK `(scope, entity_type, entity_id, sort_key)` | No | `cleanupExpiredLogs` |
| `postgres` | same SQL schema | No | `cleanupExpiredLogs` (or `pg_cron`) |
| `mysql` | same SQL schema | No | `cleanupExpiredLogs` (or `EVENT` scheduler) |
| `mongodb` | indexed `entity_pk` / `actor_pk` + TTL index on `_ttl` (Date) | Yes (~60 s sweep) | TTL is automatic; `cleanupExpiredLogs` is the explicit fallback |
| `dynamodb` | base table `(entity_pk, sort_key)` + GSI `(actor_pk, sort_key)`; AWS TTL on `expires_at` | Yes (~48 h sweep) | Enable AWS table-level TTL; `cleanupExpiredLogs` is the explicit fallback |

Run all backends end-to-end:

```bash
cd _test/
npm install
npm test     # spins up docker compose, runs every backend, tears it down
```

---

## Peer Dependencies (Injected via Loader)

- `js-helper-utils` — `Lib.Utils`
- `js-helper-debug` — `Lib.Debug`
- `js-server-helper-crypto` — `Lib.Crypto`
- `js-server-helper-instance` — `Lib.Instance`
- `js-server-helper-http` — `Lib.HttpHandler` (optional, only if you want auto-capture of IP / user-agent)

Plus **one** of the following depending on the chosen `STORE`:

| `STORE` | Required helper |
|---|---|
| `'sqlite'` | `Lib.SQLite` (`js-server-helper-sql-sqlite`) |
| `'postgres'` | `Lib.Postgres` (`js-server-helper-sql-postgres`) |
| `'mysql'` | `Lib.MySQL` (`js-server-helper-sql-mysql`) |
| `'mongodb'` | `Lib.MongoDB` (`js-server-helper-nosql-mongodb`) |
| `'dynamodb'` | `Lib.DynamoDB` (`js-server-helper-nosql-aws-dynamodb`) |
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
Lib.Logger = require('js-server-helper-logger')(Lib, {
  STORE: 'postgres',
  STORE_CONFIG: {
    table_name: 'action_log',
    lib_sql: Lib.Postgres
  },
  IP_ENCRYPT_KEY: process.env.IP_ENCRYPT_KEY  // optional
});

// Idempotent table + index creation
await Lib.Logger.setupNewStore(instance);

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
| `listByEntity(instance, options)` | `{ success, records, next_cursor, error }` | "What happened to this entity?" (calls store.getLogsByEntity) |
| `listByActor(instance, options)` | `{ success, records, next_cursor, error }` | "What did this actor do?" (calls store.getLogsByActor) |
| `cleanupExpiredLogs(instance)` | `{ success, deleted_count, error }` | Cron-driven sweep of TTL-expired rows |
| `setupNewStore(instance)` | `{ success, error }` | Idempotent backend setup (CREATE TABLE / createIndex / CreateTable) |

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
{ success: false, error: { type: 'STORE_WRITE_FAILED', ... } }   // only when await:true

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

// cleanupExpiredLogs
{ success: true, deleted_count: <Integer>, error: null }
```

---

## Configuration

| Key | Default | Notes |
|---|---|---|
| `STORE` | `null` (required) | One of `'memory' \| 'sqlite' \| 'postgres' \| 'mysql' \| 'mongodb' \| 'dynamodb'` |
| `STORE_CONFIG` | `null` (required) | Per-store config; shape varies (see below) |
| `IP_ENCRYPT_KEY` | `null` | When set, IPs are AES-encrypted at rest using `Lib.Crypto.aesEncrypt` |

### Error Catalog

All operational errors are defined in `logger.errors.js`:

| Error Type | When Returned |
|---|---|
| `STORE_READ_FAILED` | Adapter `listByEntity` / `listByActor` returned `success: false` |
| `STORE_WRITE_FAILED` | Adapter `addLog` / `cleanupExpiredLogs` returned `success: false` |

Shape: `{ type: string, message: string }` (frozen). Projects may pass through directly.

### `STORE_CONFIG` per backend

| Backend | Required `STORE_CONFIG` keys |
|---|---|
| `memory` | `{}` (no config) |
| `sqlite` | `{ table_name: 'action_log', lib_sql: Lib.SQLite }` |
| `postgres` | `{ table_name: 'action_log', lib_sql: Lib.Postgres }` |
| `mysql` | `{ table_name: 'action_log', lib_sql: Lib.MySQL }` |
| `mongodb` | `{ collection_name: 'action_log', lib_mongodb: Lib.MongoDB }` |
| `dynamodb` | `{ table_name: 'action_log', lib_dynamodb: Lib.DynamoDB }` |

---

## Retention Policies

Two-mode design keeps the per-row decision local to the call-site:

```javascript
// Always-keep: account creation, GDPR deletion markers, financial events
Lib.Logger.log(instance, { ..., retention: 'persistent' });

// Auto-clear after 90 days: read audits, login events
Lib.Logger.log(instance, { ..., retention: { ttl_seconds: 90 * 24 * 3600 } });
```

The TTL is stored on the row, not as a module-wide rule, so a single log table happily mixes forever-rows with short-retention rows. SQL backends rely on `cleanupExpiredLogs`; MongoDB and DynamoDB also have native TTL sweepers (the explicit cleanup function is exposed for deterministic test cleanup or environments without the native feature).

---

## Cleanup Cadence

| Backend | Recommended cleanup |
|---|---|
| `dynamodb` | Enable AWS native TTL on `expires_at` (Dynamo sweeps within ~48 h, free) |
| `mongodb` | The store's `setupNewStore` creates a TTL index on `_ttl` (~60 s sweep). `cleanupExpiredLogs` is the explicit fallback. |
| `postgres` | EventBridge / cron / `pg_cron` — call `Logger.cleanupExpiredLogs` once per day |
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

## Data Model

Every log event is stored as a single flat record. This section explains what each field means, why it exists, and how to populate it correctly.

### Core concepts

**Entity** — the _subject_ of the action: the thing that was changed, created, deleted, or read. An entity has a `type` (what kind of thing it is) and an `id` (which specific instance).

```
entity_type: 'user'       entity_id: 'usr_9f2a'
entity_type: 'project'    entity_id: 'proj_001'
entity_type: 'invoice'    entity_id: 'inv_20240315'
```

**Actor** — the _agent_ who triggered the action: the person, system, or automated process that caused the event. An actor has a `type` and an `id`.

```
actor_type: 'user'        actor_id: 'usr_9f2a'     // user acting on their own account
actor_type: 'admin'       actor_id: 'adm_002'      // staff member acting on behalf of someone
actor_type: 'system'      actor_id: 'billing-cron' // automated job, no human involved
actor_type: 'webhook'     actor_id: 'stripe'       // third-party integration
actor_type: 'api_key'     actor_id: 'key_abc123'   // machine-to-machine call
```

The entity and actor are often different — e.g. an admin (`actor`) deleting another user's account (`entity`). They can be the same — e.g. a user updating their own profile.

**Scope** — a multi-tenant namespace that isolates log rows between tenants. All queries must match a scope; there is no cross-scope query.

```
scope: 'tenant.42'        // SaaS tenant ID
scope: 'org.acme'         // organisation slug
scope: ''                 // single-tenant / no isolation needed (default)
```

Choose the grain that matches your tenancy model. For a SaaS product, use the tenant/organisation ID. For a single-tenant deployment, leave it empty. Scope is **not** a security boundary on its own — your application must ensure the caller's scope is authoritative before passing it in.

**Action** — a dot-notation string that names the event. The logger treats this as an opaque string; your application owns the namespace.

```
'auth.login'
'auth.password.changed'
'profile.name.changed'
'project.member.invited'
'invoice.paid'
'account.deleted'
```

Convention: `<domain>.<noun>.<verb>` or `<domain>.<verb>`. Use past tense or present continuous consistently across your codebase. Avoid generic names like `'update'` — the action should be self-describing in an audit report.

---

### Record fields

| Field | Type | Set by | Description |
|---|---|---|---|
| `scope` | String | caller | Multi-tenant namespace. Default `''`. All list queries are scoped to this value. |
| `entity_type` | String | caller | What kind of thing was affected (`'user'`, `'project'`, `'invoice'`). |
| `entity_id` | String | caller | The specific instance of that thing that was affected. |
| `actor_type` | String | caller | What kind of agent triggered this event (`'user'`, `'admin'`, `'system'`, `'webhook'`). |
| `actor_id` | String | caller | The specific agent. |
| `action` | String | caller | Dot-notation event name. Application-owned namespace. |
| `data` | Object\|null | caller | Free-form JSON payload. Opaque to the logger — use it to capture before/after values, amounts, reasons, etc. |
| `ip` | String\|null | auto or caller | IPv4/v6 of the request origin. Auto-captured from `instance.http_request` when `Lib.HttpHandler` is present. AES-encrypted at rest when `CONFIG.IP_ENCRYPT_KEY` is set. |
| `user_agent` | String\|null | auto or caller | HTTP `User-Agent` header. Same auto-capture. |
| `created_at` | Integer | logger | Unix timestamp of the event in **seconds**. Derived from `instance.time_ms`. |
| `created_at_ms` | Integer | logger | Unix timestamp in **milliseconds**. Used as the sort-key base. |
| `sort_key` | String | logger | Collision-resistant ordering key: `"<created_at_ms>-<3 random chars>"`. Format example: `"1715180412345-xqp"`. Used as `_id` in MongoDB, range key in DynamoDB. Returned as `next_cursor` for pagination. |
| `expires_at` | Integer\|null | logger | Unix timestamp in seconds at which this row should be deleted. `null` = persistent. Derived as `created_at + ttl_seconds` at write time. |
| `retention` | `'persistent'` \| `{ ttl_seconds: N }` | caller | **Write-only input** — not stored on the row. Controls whether `expires_at` is set. |

---

### `sort_key` design

The `sort_key` field serves two purposes:

1. **Ordering** — records are returned most-recent first. The millisecond timestamp prefix keeps ordering correct even across stores that don't have a native ordered index.
2. **Collision resistance** — two events in the same millisecond get different sort keys because of the 3-character random suffix (17 576 unique values per ms). This also serves as the document `_id` in MongoDB and the range key in DynamoDB, making `addLog` idempotent for duplicate-delivery scenarios.

It is **not** intended to be parsed by callers. Treat it as an opaque cursor token.

---

### `data` payload convention

`data` is the extension point for per-action context. Log just enough to answer "what changed and why?" in an audit review.

```javascript
// Profile change — capture before/after
data: { from: 'alice', to: 'alice_smith' }

// Permission grant — capture what was granted and by whom
data: { role: 'editor', granted_by_admin_id: 'adm_002' }

// Financial event — capture amounts and reference IDs
data: { amount_cents: 4999, currency: 'USD', invoice_id: 'inv_20240315' }

// System job — capture job metadata
data: { job: 'billing-renewal', affected_subscription_ids: ['sub_1', 'sub_2'] }

// Keep data null when there is nothing meaningful to add
data: null
```

Do **not** store secrets, full card numbers, raw passwords, or large blobs in `data`. The `data` column is stored as-is; it is not encrypted by this module.

---

### Retention quick reference

| Scenario | Recommended retention |
|---|---|
| Account created / deleted | `'persistent'` |
| GDPR deletion request | `'persistent'` |
| Financial transaction | `'persistent'` |
| Password or email changed | `'persistent'` |
| Login / logout event | `{ ttl_seconds: 90 * 24 * 3600 }` (90 days) |
| Read audit (viewed a document) | `{ ttl_seconds: 30 * 24 * 3600 }` (30 days) |
| Health-check / polling noise | Do not log — use metrics instead |

---

## Testing

| Tier | Runtime | Status |
|------|---------|--------|
| **Unit Tests** | Node.js `node --test` | [![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml) |

Run locally:

```bash
cd _test
npm install && npm test
```

Docker lifecycle is fully automatic. `pretest` starts the required containers; `posttest` stops and removes them (volumes only — images are cached). No manual `docker compose up` needed.

The test suite covers all six backends: memory, SQLite, PostgreSQL, MySQL, MongoDB, and DynamoDB. SQLite and memory need no Docker; the rest are orchestrated via `_test/docker-compose.yml`.

---

## Out of Scope

- **Application metrics** — Datadog / Prometheus / OpenTelemetry are the right tools for request rate, latency, and error counts. The logger captures **events that should appear in an audit trail**, not telemetry.
- **Structured request logs** — `Lib.Debug.info` already handles this. Don't audit-log every request.
- **Notification delivery** — this module records that an event happened; sending an email/push/Slack message is the caller's job.
- **Search by free text** — the `data` payload is opaque to the store. If you need to query by `data.from`, mirror that field into a dedicated index in your application schema.

---

## License

MIT
