# Push Notifications & the Auth Module

The auth module owns the source of truth for **which devices belong to which actor** because that information is already kept on every session record. A separate "devices" table would duplicate state and force the application to keep two writers in sync.

This document explains the contract the auth module exposes for push notifications, the rationale, and how a future `js-server-helper-push` module is expected to consume it.

---

## 1. Where push state lives

Every session record carries two nullable fields:

| Field | Type | Meaning |
|---|---|---|
| `push_provider` | string \| null | `'apns'`, `'fcm'`, `'web-push'`, `'expo'`, ... — opaque to auth |
| `push_token` | string \| null | The provider-specific device token returned by the OS / browser |

Sessions also carry context the push module needs to choose the right provider and message format:

| Field | Used for |
|---|---|
| `install_platform` | `'ios'`, `'android'`, `'web'`, ... — picks the provider client |
| `install_form_factor` | `'mobile'`, `'tablet'`, `'desktop'`, `'tv'`, ... — message size / sound choices |
| `client_name`, `client_version` | Diagnostics, A/B routing |
| `last_active_at` | Skip dormant devices in batch sends |

**Why on the session record (not a separate table):** every push target is by definition a session — push only happens to devices the user is logged into. Co-locating the push state with the session record means:

- Logging out automatically detaches the push target (no orphan rows).
- Session expiry / eviction automatically removes stale push targets.
- Multi-tenant isolation comes for free (sessions are already tenant-scoped).
- One write, one source of truth, one cap on rows per actor (`LIMITS.total_max`).

---

## 2. Public API

The auth module exposes **three** push-related functions. All three are storage-agnostic; every backend supports them.

### 2.1 `attachDeviceToSession(instance, options) -> { success, error }`

Bind a push token to an existing session. Called by the application after the client successfully registers with the OS / browser push provider.

```js
const result = await Auth.attachDeviceToSession(instance, {
  tenant_id:     'acme',
  actor_id:      'user_123',
  token_key:     session.token_key,
  push_provider: 'apns',
  push_token:    'a1b2c3d4...'
});
```

This is a partial update under the hood — `push_provider` and `push_token` are the only two columns touched. The session's identity, lifecycle, and other client metadata stay untouched.

### 2.2 `detachDeviceFromSession(instance, options) -> { success, error }`

Clear the push fields. Called when:

- The user disables notifications in the app.
- The OS revokes the token (the push provider returned a permanent failure).
- The application proactively rotates tokens.

```js
await Auth.detachDeviceFromSession(instance, {
  tenant_id: 'acme',
  actor_id:  'user_123',
  token_key: session.token_key
});
```

The session itself remains valid — only the push binding is removed.

### 2.3 `listPushTargetsByActor(instance, options) -> { success, targets, error }`

Return every active session for the actor that has both `push_provider` and `push_token` set. The push module calls this once per fan-out to learn where to send.

```js
const { targets } = await Auth.listPushTargetsByActor(instance, {
  tenant_id: 'acme',
  actor_id:  'user_123'
});

for (const target of targets) {
  await Push.send({
    provider: target.push_provider,
    token:    target.push_token,
    platform: target.install_platform,
    form_factor: target.install_form_factor,
    payload:  { title: 'Hello', body: 'World' }
  });
}
```

`targets` is a regular array of canonical session records — the same shape `listSessions` returns — so the push module can use any field it needs without translation.

Sessions with null push fields and expired sessions are filtered out automatically.

---

## 3. Recommended client-side flow

```
┌─────────────────┐   1) login            ┌─────────────────┐
│  Mobile / Web   │ ────────────────────> │  Your backend   │
│     client      │ <─── auth_id cookie ──┤                 │
└────────┬────────┘                       └────────┬────────┘
         │                                         │
         │  2) request push permission             │
         │     OS returns push_token               │
         │                                         │
         │  3) POST /me/push-token                 │
         │     { provider, token }                 │
         │ ──────────────────────────────────────> │
         │                                         │ 4) Auth.attachDeviceToSession()
         │                                         │
         │  5) later: user disables notifications  │
         │                                         │
         │  6) DELETE /me/push-token               │
         │ ──────────────────────────────────────> │
         │                                         │ 7) Auth.detachDeviceFromSession()
```

The client always sends the request authenticated via the existing session cookie or JWT — the server reads `token_key` from `instance.session` (set by `verifySession`) and never accepts it from the body.

---

## 4. Provider failure handling

When the push provider tells you a token is permanently invalid (APNs `BadDeviceToken`, FCM `UNREGISTERED`, etc.), call `detachDeviceFromSession` immediately so future fan-outs don't keep paying for a doomed send.

For transient failures, leave the row alone — a subsequent `attachDeviceToSession` from a successful client refresh will overwrite the token.

---

## 5. Capacity & cost

Sessions per actor are bounded by `CONFIG.LIMITS.total_max`. Push targets are a strict subset, so the same bound caps the fan-out per actor. There is no need to paginate `listPushTargetsByActor` — typical caps are 5 to 20 sessions per actor, a single index-supported read across every backend.

For tenant-wide broadcasts, the **push module** should iterate actors and call `listPushTargetsByActor` per actor; the auth module does not expose a "list every push target in the tenant" function on purpose, because doing so would create a Hot Path that bypasses the actor-level cap and the per-actor authorisation check.

---

## 6. Forward-compat: the `js-server-helper-push` module

A future helper module will:

- Inject auth via `Lib.Auth.user` (the existing actor_type instance).
- Consume the records returned by `listPushTargetsByActor`.
- Provide its own `Push.broadcast(actor_id, payload)` that:
  1. Calls `Auth.user.listPushTargetsByActor`.
  2. Maps each target to a per-provider client (`PushApns`, `PushFcm`, ...).
  3. On permanent provider failure, calls `Auth.user.detachDeviceFromSession` to keep state clean.

The auth module's contract above is sufficient for that module — no further auth-side changes will be required.
