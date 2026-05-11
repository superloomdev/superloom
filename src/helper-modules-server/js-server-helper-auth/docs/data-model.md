# Data Model

Every session is stored as a single flat record. This document explains what each field means, why it exists, and how to populate it correctly.

## Core Concepts

**Tenant** — the top-level isolation boundary. Every session record carries a `tenant_id` and all queries are scoped to `(tenant_id, actor_id, ...)`. Two tenants in the same table are completely invisible to each other.

```
tenant_id: 'tenant_42'        // SaaS tenant
tenant_id: 'org_acme'         // organisation slug
tenant_id: 'default'          // single-tenant deployment (one known value)
```

Tenant isolation is enforced at every store method — there is no cross-tenant query. Your application must ensure the tenant_id passed in is authoritative for the caller before passing it to auth.

**Actor** — the authenticated principal. An actor has a `type` (what kind of actor it is) and an `id` (which specific principal). The Auth module is instantiated once per `actor_type`; the instance only ever reads and writes sessions for that type.

```
actor_type: 'user'            actor_id: 'usr_9f2a'      // end user
actor_type: 'admin'           actor_id: 'adm_002'       // staff member
actor_type: 'merchant'        actor_id: 'mrch_10'       // B2B account
actor_type: 'service'         actor_id: 'billing-api'   // machine-to-machine
```

`actor_type` is validated on every `verifySession` call — a session stored under `actor_type: 'user'` will be rejected by an `admin` Auth instance even if the token is otherwise valid. This is a defense-in-depth guard against misconfigured table pointers.

**Token key and secret** — together these are the session identity:

- `token_key` — a random 16-char hex string. Forms part of the composite primary key. Safe to log.
- `token_secret` — a random 32-char hex string. **Never stored.** Only its SHA-256 hash (`token_secret_hash`) is persisted. A lookup with the wrong secret returns the same "not found" response as a missing row — no timing oracle.

**auth_id** — the wire-format token the client holds:

```
auth_id = "{actor_id}-{token_key}-{token_secret}"
```

Reserved characters are `-` (segment separator) and `#` (composite-key separator inside MongoDB `_id` and DynamoDB sort key). Both are forbidden in any user-supplied `actor_id`. Validation runs at `createSession` and `createAuthId`.

**install_id** — an optional client-supplied device or browser identifier. When provided and it matches an existing session's `install_id`, the prior session is **replaced atomically** regardless of session limits. This implements "log in again on the same device overrides the previous session" without requiring the client to remember the old `token_key`.

```
install_id: 'device-uuid-1234'   // generated once on first install, persisted client-side
install_id: null                  // omit when the platform has no stable device ID
```

---

## Record Fields

| Field | Type | Set by | Description |
|-------|------|--------|-------------|
| `tenant_id` | String | caller | Top-level isolation boundary. All store queries are scoped to this value. Immutable after creation. |
| `actor_id` | String | caller | The authenticated principal. Forbidden characters: `-` and `#`. Immutable after creation. |
| `actor_type` | String | auth module | Copied from `CONFIG.ACTOR_TYPE`. Validated on every `verifySession`. Immutable. |
| `token_key` | String | auth module | Random 16-char hex. Part of the composite primary key. Returned inside `auth_id`. |
| `token_secret_hash` | String | auth module | SHA-256 of the client's secret. Never returned to callers. Wrong-secret lookups return null, not an error. |
| `refresh_token_hash` | String\|null | auth module | JWT mode only. SHA-256 of the current refresh token secret. Rotated on each `refreshSessionJwt` call. |
| `refresh_family_id` | String\|null | auth module | JWT mode only. Stable across rotations within one session; used to detect refresh-token replay. |
| `created_at` | Number | auth module | Unix epoch seconds. Immutable. Derived from `instance.time`. |
| `expires_at` | Number | auth module | Unix epoch seconds. Set to `created_at + TTL_SECONDS` and rolled forward by `TTL_SECONDS` on each throttled activity refresh. |
| `last_active_at` | Number | auth module | Unix epoch seconds. Updated by `verifySession` at most once per `LAST_ACTIVE_UPDATE_INTERVAL_SECONDS` to avoid a DB write on every request. |
| `install_id` | String\|null | caller | Client-assigned device identifier. Enables same-device replacement. **Immutable** after creation — not updated by activity refresh. |
| `install_platform` | String | caller | e.g. `'web'`, `'ios'`, `'android'`, `'macos'`, `'windows'`, `'linux'`, `'other'`. Used by `by_platform_max` limits. Immutable. |
| `install_form_factor` | String | caller | e.g. `'desktop'`, `'mobile'`, `'tablet'`, `'tv'`, `'watch'`, `'other'`. Used by `by_form_factor_max` limits. Immutable. |
| `client_name` | String\|null | caller | Browser or app name (e.g. `'Chrome'`, `'Safari'`, `'MyApp'`). |
| `client_version` | String\|null | caller | Browser or app version string. |
| `client_is_browser` | Boolean | caller | `true` for browser-based sessions; used to separate browser from native app in the "active devices" UI. |
| `client_os_name` | String\|null | caller | OS name (e.g. `'iOS'`, `'Windows'`). |
| `client_os_version` | String\|null | caller | OS version string. |
| `client_screen_w` | Number\|null | caller | Screen width in logical pixels. |
| `client_screen_h` | Number\|null | caller | Screen height in logical pixels. |
| `client_ip_address` | String\|null | caller | IPv4 or IPv6 of the request origin at login time. Not updated on activity refresh. |
| `client_user_agent` | String\|null | caller | HTTP `User-Agent` string at login time. |
| `push_provider` | String\|null | caller | Push notification provider (e.g. `'fcm'`, `'apns'`, `'webpush'`, `'expo'`). Set via `attachDeviceToSession`. |
| `push_token` | String\|null | caller | Provider-specific push registration token. Set via `attachDeviceToSession`. Used by `listPushTargetsByActor` to fan out notifications. |
| `custom_data` | Object\|null | caller | Project-owned arbitrary JSON. Opaque to auth — returned as-is on every read. |

---

## install_platform / install_form_factor Quick Reference

| Scenario | `install_platform` | `install_form_factor` |
|----------|---------------------|----------------------|
| Chrome on a laptop | `'web'` | `'desktop'` |
| Safari on an iPhone | `'ios'` | `'mobile'` |
| Android app on a phone | `'android'` | `'mobile'` |
| Android app on a tablet | `'android'` | `'tablet'` |
| macOS desktop app | `'macos'` | `'desktop'` |
| Windows desktop app | `'windows'` | `'desktop'` |
| CLI / server tool | `'other'` | `'other'` |

These values feed directly into `LIMITS.by_platform_max` and `LIMITS.by_form_factor_max`. Use consistent values across your codebase; a typo silently creates a new bucket that never hits any cap.

---

## custom_data Convention

`custom_data` is the extension point for any per-session state your application needs to carry without adding a join. It is stored verbatim and returned on every successful `verifySession`.

```javascript
// Store the user's role at login time so the request handler doesn't need a DB call
custom_data: { role: 'editor', org_id: 'org_42' }

// Carry the OAuth provider and upstream user-id for federated accounts
custom_data: { oauth_provider: 'google', oauth_sub: '1047283904' }

// Keep it null when there is nothing extra to carry
custom_data: null
```

Do **not** store secrets, session tokens from other systems, or large blobs in `custom_data`. The column is stored as-is and returned to any code that calls `verifySession`.

---

## Design Decisions

### Why Flat Records?

Every session is one row. No joins, no foreign keys. This makes the "list all sessions for this actor" query fast and simple — a single indexed lookup.

### Why Composite Primary Key?

The primary key is `(tenant_id, actor_id, token_key)`. This enables:
- Fast lookup by `verifySession` (token_key is known)
- Fast list by actor (prefix scan on tenant_id + actor_id)
- Natural tenant isolation at the database level

### Why Immutable install_id?

The `install_id` never changes after creation. If a user reinstalls your app (new install_id), they get a new session slot rather than replacing the old one. This is intentional — a reinstall is a "new device" from a security perspective.

### Why Throttled last_active_at?

Updating `last_active_at` on every request would create a database write for every API call. The `LAST_ACTIVE_UPDATE_INTERVAL_SECONDS` throttle (default 10 minutes) reduces this to at most one write per 10 minutes per active session.

### Why Token Secret Hash?

The actual `token_secret` is never stored. If your database is compromised, attackers cannot impersonate users even with full table access — they only have hashes, not the tokens clients hold.
