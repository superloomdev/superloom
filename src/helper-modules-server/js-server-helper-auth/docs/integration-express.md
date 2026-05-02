# Integrating `js-server-helper-auth` with Express

This guide shows the complete wiring: bootstrap, middleware, login/refresh/logout endpoints, and a protected route. The same module powers both DB-mode (cookie / `Authorization: Bearer auth_id`) and JWT-mode (`Authorization: Bearer <jwt>` + refresh-token rotation).

The goal is a single `Lib.Auth.user` object you can drop into any controller. The auth module is fully transport-agnostic — it never touches `req` / `res` directly. The Express adapter is the **instance**: it carries `req.headers`, `res.setHeader`, and the request clock for the auth module to consume.

---

## 1. Bootstrap (one Auth instance per actor_type)

```js
// server/common/bootstrap.js
'use strict';

module.exports = function bootstrap () {

  const Lib = {};

  // Foundation + helpers
  Lib.Utils    = require('@superloomdev/js-helper-utils')(Lib, {});
  Lib.Debug    = require('@superloomdev/js-helper-debug')(Lib, { LOG_LEVEL: 'info' });
  Lib.Crypto   = require('@superloomdev/js-server-helper-crypto')(Lib, {});
  Lib.Instance = require('@superloomdev/js-server-helper-instance')(Lib, {});

  // Storage backend (one instance shared by every actor_type)
  Lib.Postgres = require('@superloomdev/js-server-helper-sql-postgres')(Lib, {
    HOST: process.env.PG_HOST,
    PORT: parseInt(process.env.PG_PORT, 10),
    DATABASE: process.env.PG_DATABASE,
    USER: process.env.PG_USER,
    PASSWORD: process.env.PG_PASSWORD,
    POOL_MAX: 10
  });

  // ONE Auth instance per actor_type. Different tables, different cookies,
  // different limits, different TTLs.
  Lib.Auth = {

    user: require('@superloomdev/js-server-helper-auth')(Lib, {
      STORE: 'postgres',
      STORE_CONFIG: { table_name: 'sessions_user', lib_sql: Lib.Postgres },
      ACTOR_TYPE: 'user',
      TTL_SECONDS: 30 * 24 * 3600,                    // 30 days for users
      LIMITS: { total_max: 20, evict_oldest_on_limit: true },
      ENABLE_JWT: true,
      JWT: {
        signing_key: process.env.JWT_SIGNING_KEY,
        algorithm: 'HS256',
        issuer: 'api.example.com',
        audience: 'web.example.com',
        access_token_ttl_seconds: 15 * 60,            // 15 min
        refresh_token_ttl_seconds: 30 * 24 * 3600,    // 30 days
        rotate_refresh_token: true
      },
      COOKIE_PREFIX: 'sl_user_',
      COOKIE_OPTIONS: { http_only: true, secure: true, same_site: 'lax', path: '/' },
      ERRORS: require('./errors')                     // your domain catalog
    }),

    admin: require('@superloomdev/js-server-helper-auth')(Lib, {
      STORE: 'postgres',
      STORE_CONFIG: { table_name: 'sessions_admin', lib_sql: Lib.Postgres },
      ACTOR_TYPE: 'admin',
      TTL_SECONDS: 60 * 60,                           // 1 hour for admins
      LIMITS: { total_max: 3, evict_oldest_on_limit: false },
      ENABLE_JWT: false,                              // db_only is fine for admin
      COOKIE_PREFIX: 'sl_admin_',
      ERRORS: require('./errors')
    })

  };

  return Lib;

};
```

`Lib.Auth.user.initializeSessionStore(instance)` should be called once at boot to create / migrate the underlying table.

---

## 2. Per-request instance + auth middleware

Express handlers get a fresh `instance` per request. The instance lives only for the lifetime of the request and exposes the request clock + headers + response object the auth module reads/writes.

```js
// server/middleware/instance.js
'use strict';

module.exports = function instanceMiddleware (Lib) {
  return function (req, res, next) {
    req.instance = Lib.Instance.initialize();
    req.instance.http_request  = req;       // for token-source (cookie / header reads)
    req.instance.http_response = res;       // for set-cookie writes on createSession / removeSession
    next();
  };
};
```

```js
// server/middleware/require-user.js
'use strict';

module.exports = function requireUser (Lib) {
  return async function (req, res, next) {

    // JWT-mode: stateless verify of Authorization: Bearer <jwt>
    const auth_header = req.headers['authorization'] || '';
    const bearer = auth_header.startsWith('Bearer ') ? auth_header.slice(7) : null;

    if (bearer) {
      const r = Lib.Auth.user.verifyJwt(req.instance, { jwt: bearer });
      if (r.success === true) {
        req.instance.session_claims = r.claims;
        return next();
      }
      // Fall through if the JWT was malformed - cookie may still authenticate
    }

    // DB-mode (or fallback): cookie or auth_id header
    const r = await Lib.Auth.user.verifySession(req.instance, {
      tenant_id: req.params.tenant_id || req.headers['x-tenant-id']
    });
    if (r.success === true) {
      req.instance.session = r.session;
      return next();
    }

    return res.status(r.error.status || 401).json({ error: r.error });

  };
};
```

The middleware is wired once per actor_type: `app.use('/me', requireUser(Lib))`, `app.use('/admin', requireAdmin(Lib))`, etc.

---

## 3. The three core endpoints

### 3.1 Login

```js
app.post('/login', async function (req, res) {
  // ... your password / OTP / OAuth check yields actor_id ...

  const result = await Lib.Auth.user.createSession(req.instance, {
    tenant_id:           req.body.tenant_id,
    actor_id:            actor_id,
    install_id:          req.body.install_id,           // optional
    install_platform:    req.body.install_platform,     // 'ios' | 'android' | 'web' | ...
    install_form_factor: req.body.install_form_factor,  // 'mobile' | 'desktop' | ...
    client_name:         req.body.client_name,
    client_version:      req.body.client_version,
    client_is_browser:   req.body.client_is_browser,
    client_user_agent:   req.headers['user-agent'],
    client_ip_address:   req.ip
  });

  if (result.success === false) {
    return res.status(result.error.status).json({ error: result.error });
  }

  // The cookie is already set on res by the auth module.
  // For JWT mode, also return the access + refresh tokens to the client.
  return res.json({
    actor_id: actor_id,
    access_token: result.access_token,
    refresh_token: result.refresh_token
  });
});
```

### 3.2 Refresh (JWT mode only)

```js
app.post('/refresh', async function (req, res) {

  const result = await Lib.Auth.user.refreshSessionJwt(req.instance, {
    tenant_id: req.body.tenant_id,
    refresh_token: req.body.refresh_token
  });

  if (result.success === false) {
    return res.status(result.error.status).json({ error: result.error });
  }

  return res.json({
    access_token:  result.access_token,
    refresh_token: result.refresh_token
  });
});
```

### 3.3 Logout

```js
app.post('/logout', requireUser(Lib), async function (req, res) {

  const session = req.instance.session;        // set by requireUser
  const result = await Lib.Auth.user.removeSession(req.instance, {
    tenant_id: session.tenant_id,
    actor_id:  session.actor_id,
    token_key: session.token_key
  });

  return res.json({ success: result.success });
});

app.post('/logout-everywhere', requireUser(Lib), async function (req, res) {

  const session = req.instance.session;
  const result = await Lib.Auth.user.removeAllSessions(req.instance, {
    tenant_id: session.tenant_id,
    actor_id:  session.actor_id
  });

  return res.json({ removed: result.removed_count });
});
```

---

## 4. Active-devices UI

```js
app.get('/me/devices', requireUser(Lib), async function (req, res) {

  const session = req.instance.session;
  const list = await Lib.Auth.user.listSessions(req.instance, {
    tenant_id: session.tenant_id,
    actor_id:  session.actor_id
  });

  // Strip server-only fields before returning
  const public_list = list.sessions.map(function (s) {
    return {
      token_key: s.token_key,                      // used as the "device id" the UI sends back
      install_platform: s.install_platform,
      install_form_factor: s.install_form_factor,
      client_name: s.client_name,
      created_at: s.created_at,
      last_active_at: s.last_active_at,
      is_current: s.token_key === session.token_key
    };
  });

  res.json({ devices: public_list });
});
```

---

## 5. Cron task: cleanup

For SQL backends without native TTL (Postgres, MySQL), schedule one daily job:

```js
// server/cron/auth-cleanup.js
'use strict';

module.exports = function cleanup (Lib) {
  const instance = Lib.Instance.initialize();

  return Promise.all([
    Lib.Auth.user.cleanupExpiredSessions(instance),
    Lib.Auth.admin.cleanupExpiredSessions(instance)
  ]);
};
```

For DynamoDB, use the `expires_at` column as a TTL attribute — AWS deletes rows automatically; the explicit cleanup is a fallback for edge cases.

For MongoDB, the `expires_at` index handles cleanup explicitly via `cleanupExpiredSessions`. There is no native TTL because we store integer epoch seconds, not `Date` values.

---

## 6. Error handling

The auth module returns your domain `ERRORS.*` object verbatim on every failure path. Your error middleware just inspects `error.status` and `error.code`:

```js
app.use(function (err, req, res, next) {
  if (err && err.code && err.status) {
    return res.status(err.status).json({ error: err });
  }
  Lib.Debug.error('unhandled', { err: err.stack });
  res.status(500).json({ error: { code: 'INTERNAL', status: 500 } });
});
```

The auth module never throws on operational failures — it only throws `TypeError` on **programmer** errors (missing required option, reserved characters, etc.). Operational failures always come back as `{ success: false, error }`.
