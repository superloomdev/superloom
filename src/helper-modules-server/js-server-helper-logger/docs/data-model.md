# Data Model

Every log event is stored as a single flat record. This document explains what each field means, why it exists, and how to populate it correctly.

## Core Concepts

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

## Record Fields

| Field | Type | Set by | Description |
|-------|------|--------|-------------|
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

## The sort_key Field

The `sort_key` field serves two purposes:

1. **Ordering** — records are returned most-recent first. The millisecond timestamp prefix keeps ordering correct even across stores that don't have a native ordered index.
2. **Collision resistance** — two events in the same millisecond get different sort keys because of the 3-character random suffix (17 576 unique values per ms). This also serves as the document `_id` in MongoDB and the range key in DynamoDB, making `addLog` idempotent for duplicate-delivery scenarios.

It is **not** intended to be parsed by callers. Treat it as an opaque cursor token.

---

## Data Payload Convention

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

## Retention Quick Reference

| Scenario | Recommended retention |
|----------|----------------------|
| Account created / deleted | `'persistent'` |
| GDPR deletion request | `'persistent'` |
| Financial transaction | `'persistent'` |
| Password or email changed | `'persistent'` |
| Login / logout event | `{ ttl_seconds: 90 * 24 * 3600 }` (90 days) |
| Read audit (viewed a document) | `{ ttl_seconds: 30 * 24 * 3600 }` (30 days) |
| Health-check / polling noise | Do not log — use metrics instead |

---

## Design Decisions

### Why Flat Records?

Every log event is one row. No joins, no foreign keys, no normalization. This makes queries fast and simple: "show me everything that happened to this user" is a single indexed lookup.

### Why Per-Row Retention?

Some events must live forever (account creation). Others can be cleaned up (read audits). The caller decides at write time, not in a global config. One table happily mixes both.

### Why IP Encryption is Optional?

Some environments need IPs for fraud detection. Others must encrypt them for privacy compliance. The module supports both — just set or omit `IP_ENCRYPT_KEY`.

### Why Separate entity and actor?

An admin deleting a user account has different entity (`user`) and actor (`admin`). A user updating their own profile has the same value for both. Keeping them separate handles both cases cleanly.
