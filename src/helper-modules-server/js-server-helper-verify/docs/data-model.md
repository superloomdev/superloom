# Data Model

Every verification attempt is represented as a single flat record. This document explains what each field means, why it exists, and how to populate it correctly.

## Core Concepts

**Scope** — the logical owner of the verification code. It acts as a namespace that groups all codes belonging to the same context. All store queries are keyed on `(scope, key)` together.

```
scope: 'user.usr_9f2a'          // one user's verifications
scope: 'tenant.42'              // tenant-level namespace
scope: ''                       // single-tenant / no isolation needed (default)
```

Scope is **not** a security boundary on its own — your application must ensure the caller's scope is authoritative before passing it in. Two callers with different scopes cannot see each other's codes; two callers with the same scope can (assuming they also know the key).

**Key** — the specific purpose or channel within the scope. Together with `scope` it forms the composite primary key. One `(scope, key)` pair holds at most one active code at a time — a new `createPin` / `createCode` / `createToken` call replaces the previous record.

```
key: 'login-phone.+919999912345'    // phone OTP for a specific number
key: 'email-verify.user@example.com' // email confirmation link
key: 'password-reset'               // password reset token (one per user, under user scope)
key: 'totp-setup'                   // TOTP enrollment confirmation
```

Convention: `<purpose>.<channel-identifier>`. The key is opaque to the module — choose a naming scheme that lets your application reconstruct it at verify time without looking it up.

**Code types** — three generators covering the three common surfaces:

| Generator | Charset | Example | Typical use |
|-----------|---------|---------|-------------|
| `createPin` | `0-9` | `742856` | SMS OTP, phone-keypad entry |
| `createCode` | Crockford Base32 (`0-9 A-Z` minus `I L O U`) | `X7K3M9` | Codes read aloud or printed — avoids visually ambiguous characters |
| `createToken` | `a-zA-Z0-9` | `aB3kZ9qR...` | Magic-link query parameter, click-to-verify email link |

All three write the same record shape and are verified by the same `verify` function.

**Cooldown** — the minimum gap in seconds before another code can be issued for the same `(scope, key)`. Prevents an attacker from flooding the channel. The cooldown window is checked against `instance.time - record.created_at`.

```
cooldown_seconds: 60     // at most one SMS per minute
cooldown_seconds: 0      // no cooldown (e.g. for test environments)
```

**Fail counter** — each failed `verify` call increments `fail_count` in-place. Once `fail_count >= max_fail_count`, the record is locked out (`MAX_FAILS`) until a new code is created. The counter resets to `0` on every successful create.

---

## Record Fields

| Field | Type | Set by | Description |
|-------|------|--------|-------------|
| `scope` | String | caller | Logical owner namespace. Part of the composite primary key. Default `''`. |
| `key` | String | caller | Specific verification purpose within the scope. Part of the composite primary key. |
| `code` | String | verify module | The generated value the recipient must submit. Derived from `Lib.Crypto.generateRandomString`. |
| `fail_count` | Number | verify module | Number of consecutive failed `verify` attempts since this record was last created. Starts at `0`. Incremented atomically by the store. |
| `created_at` | Number | verify module | Unix epoch seconds when this record was written. Used to enforce `cooldown_seconds`. Derived from `instance.time`. |
| `expires_at` | Number | verify module | Unix epoch seconds at which the code becomes invalid. Computed as `created_at + ttl_seconds`. Checked at verify time regardless of whether `cleanupExpiredRecords` has run. |

---

## Scope and Key Design Guide

The two keys together answer "what is this code for and who owns it?" Design them so your application can reconstruct both values from the same information available at verify time.

```javascript
// Phone OTP — scope is the user, key identifies the phone number
scope: 'user.' + user.id
key:   'login-phone.' + normalized_phone

// Email confirmation — scope is the tenant, key identifies the email address
scope: 'tenant.' + tenant_id
key:   'email-confirm.' + email_address

// Password reset — scope is the user, key is the action (one per user at a time)
scope: 'user.' + user.id
key:   'password-reset'

// Two-factor setup — scope is the user, key includes the method
scope: 'user.' + user.id
key:   'totp-setup'
```

A new `create*` call for the same `(scope, key)` **replaces** the previous record — there is no accumulation. If your flow needs two simultaneous codes for the same user (e.g. phone + email), use distinct keys.

---

## Cleanup and Expiry

The `expires_at` field is the authoritative expiry check. `verify` rejects expired records even if `cleanupExpiredRecords` has never run. The cleanup function is a storage hygiene tool, not a correctness requirement.

| Backend | Recommended cleanup |
|---------|---------------------|
| `dynamodb` | Enable AWS native TTL on `expires_at` (~48 h sweep) |
| `mongodb` | `setupNewStore` creates a TTL index on `_ttl` (~60 s sweep). `cleanupExpiredRecords` is the explicit fallback. |
| `postgres` | `pg_cron` / EventBridge — call `Verify.cleanupExpiredRecords` once per day |
| `mysql` | MySQL `EVENT` scheduler / cron — same daily cadence |
| `sqlite` | `setInterval` inside the Node process or external cron |

---

## Design Decisions

### Why Single Record Per (scope, key)?

Only one active code per purpose. If a user requests a new OTP, the old one is immediately invalidated. This prevents confusion (which code works?) and limits the attack surface.

### Why Fail Counter Instead of Lockout?

The fail counter allows "forgiving" typos while still preventing brute force. Set `max_fail_count` based on your threat model (3-5 is typical for SMS, higher for less sensitive flows).

### Why Cooldown Instead of Global Rate Limit?

Per-record cooldown is simpler and more precise than global rate limits. It naturally handles multi-tenant scenarios without complex cross-user coordination.

### Why Not Store Verified State?

Once verified, the record is deleted immediately. A verified code cannot be reused because it no longer exists. This is a deliberate security property — verification is strictly one-time.
