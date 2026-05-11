# Integrating `js-server-helper-auth` with AWS Lambda

The auth module is transport-agnostic, so the same `Lib.Auth.user` object you use in Express works inside a Lambda handler. The differences are entirely in **how** the per-request `instance` is built and how cookies / headers move on the wire.

This guide shows the pattern for both:

- **REST API Gateway (V1) / HTTP API (V2)** — the most common path for REST endpoints.
- **Lambda Function URL** — for low-cost direct invocations.

The same Auth instance can serve both; only the adapter layer changes.

---

## 1. Cold start: build `Lib` once

Lambda containers are reused, so any expensive setup goes **outside** the handler — it survives between invocations.

```js
// src/server/interfaces/api/lambda-aws/auth-login/handler.js
'use strict';

// One-time build per warm container
const Lib = require('../../../common/bootstrap')();

const Auth = Lib.Auth.user;
const Errors = require('../../../common/errors');


exports.handler = async function (event) {

  const instance = Lib.Instance.initialize();

  // Adapt the AWS event into the same shape the auth module's
  // token-source expects. Any V2 / V1 event becomes a flat header map.
  instance.http_request = {
    headers: lowercaseHeaders(event.headers),
    cookies: event.cookies || []
  };
  // Lambda has no streaming response object - we collect mutations and
  // emit them at the end. The auth module reads "set" calls via the
  // same interface as Express but here it just appends to a buffer.
  const set_cookies = [];
  const set_headers = {};
  instance.http_response = {
    setHeader: function (name, value) { set_headers[name] = value; },
    appendHeader: function (name, value) {
      // Cookies need multi-value semantics
      if (name.toLowerCase() === 'set-cookie') {
        set_cookies.push(value);
        return;
      }
      set_headers[name] = value;
    }
  };

  let body;
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch (err) {
    return jsonResponse(400, { error: { code: 'BAD_JSON', status: 400 } });
  }

  // ... your password / OTP check yields actor_id ...
  const actor_id = body.actor_id;

  const result = await Auth.createSession(instance, {
    tenant_id:           body.tenant_id,
    actor_id:            actor_id,
    install_id:          body.install_id,
    install_platform:    body.install_platform,
    install_form_factor: body.install_form_factor,
    client_user_agent:   instance.http_request.headers['user-agent'],
    client_ip_address:   sourceIp(event)
  });

  if (result.success === false) {
    return jsonResponse(result.error.status, { error: result.error });
  }

  return jsonResponse(200, {
    actor_id: actor_id,
    access_token: result.access_token,
    refresh_token: result.refresh_token
  }, set_cookies, set_headers);

};


// ----- helpers -----

function lowercaseHeaders (headers) {
  const out = {};
  for (const k of Object.keys(headers || {})) out[k.toLowerCase()] = headers[k];
  return out;
}

function sourceIp (event) {
  return (event.requestContext && event.requestContext.identity && event.requestContext.identity.sourceIp)
      || (event.requestContext && event.requestContext.http && event.requestContext.http.sourceIp)
      || null;
}

function jsonResponse (status, body, cookies, headers) {
  return {
    statusCode: status,
    headers: Object.assign({ 'content-type': 'application/json' }, headers || {}),
    cookies: cookies || [],
    body: JSON.stringify(body)
  };
}
```

The cookie / header writes the auth module makes during `createSession` (and `removeSession`) are buffered in `set_cookies` / `set_headers` and flushed at the end. **Never** lose this data — Lambda exits the moment the handler returns the response.

---

## 2. Per-entity Lambda design

Following the project's per-entity Lambda convention (`auth-login`, `auth-refresh`, `auth-logout`, etc.), each handler file is tiny because the `Lib` and the Auth instance live in `bootstrap.js` and are imported once. The handler is just an adapter that:

1. Wraps the AWS event into the canonical `instance`.
2. Calls one Auth function.
3. Translates the result into a JSON response.

```text
src/server/interfaces/api/lambda-aws/
  auth-login/handler.js          - createSession
  auth-refresh/handler.js        - refreshSessionJwt
  auth-logout/handler.js         - removeSession (current device)
  auth-logout-all/handler.js     - removeAllSessions
  auth-devices-list/handler.js   - listSessions
  auth-devices-attach/handler.js - attachDeviceToSession
  auth-devices-detach/handler.js - detachDeviceFromSession
```

Each handler gets its own `_deploy/auth-login/serverless.yml` per the project's per-entity deployment rule.

---

## 3. JWT-only authorizer

When you run JWT mode, the cleanest pattern is an HTTP API custom Lambda authorizer that calls `verifyJwt` once and short-circuits the protected handlers.

```js
// src/server/interfaces/api/lambda-aws/auth-jwt-authorizer/handler.js
'use strict';

const Lib = require('../../../common/bootstrap')();
const Auth = Lib.Auth.user;


exports.handler = async function (event) {

  const auth_header = (event.headers && event.headers.authorization) || '';
  const bearer = auth_header.startsWith('Bearer ') ? auth_header.slice(7) : null;

  if (bearer === null) {
    return { isAuthorized: false };
  }

  // verifyJwt is sync (no DB read) - cheap inside an authorizer.
  const instance = Lib.Instance.initialize();
  const r = Auth.verifyJwt(instance, { jwt: bearer });

  if (r.success === false) {
    return { isAuthorized: false };
  }

  return {
    isAuthorized: true,
    context: {
      // Pass the verified claims down to the protected handler in the
      // request context so the handler doesn't re-verify.
      actor_id: r.claims.sub,
      tenant_id: r.claims.tid,
      token_key: r.claims.tkk
    }
  };

};
```

Protected handlers then read `event.requestContext.authorizer.lambda` to get the actor identity already verified.

---

## 4. Cold-start cost

The auth module itself loads in well under 50 ms cold (no third-party dependencies in the JWT path). The dominant cost is the storage driver:

| Backend | Cold-start cost |
|---|---|
| `dynamodb` | ~50 ms (AWS SDK is shared with most Lambdas anyway) |
| `mongodb` | ~150 ms (MongoClient handshake; reuse across invocations is critical) |
| `postgres`, `mysql` | ~100-300 ms first connection (RDS Proxy reduces this materially) |
| `sqlite` | < 5 ms (in-process; rarely used with Lambda) |

For SQL backends in Lambda, **always** route through RDS Proxy or a connection-pooling layer — opening a fresh Postgres / MySQL TCP socket per invocation is the dominant cost. The auth module's storage driver supports this transparently because it reuses the underlying `Lib.Postgres` / `Lib.MySQL` instance for the lifetime of the Lambda container.

---

## 5. Cleanup outside Lambda

Every backend needs `cleanupExpiredSessions` on a cron unless native DynamoDB TTL was enabled out-of-band. Don't put the sweep inside an HTTP-triggered Lambda - use a separate scheduled Lambda triggered once per day by EventBridge:

```yaml
# _deploy/auth-cleanup/serverless.yml
service: auth-cleanup

provider:
  name: aws
  runtime: nodejs20.x
  region: ${env:AWS_REGION}

functions:
  run:
    handler: handler.handler
    timeout: 60
    events:
      - schedule: rate(1 day)
```

```js
// _deploy/auth-cleanup/handler.js
'use strict';

const Lib = require('../../src/server/common/bootstrap')();

exports.handler = async function () {

  const instance = Lib.Instance.initialize();

  const results = await Promise.all([
    Lib.Auth.user.cleanupExpiredSessions(instance),
    Lib.Auth.admin.cleanupExpiredSessions(instance)
  ]);

  return { deleted: results.map(function (r) { return r.deleted_count; }) };

};
```

---

## 6. End-to-end checklist

When deploying an Auth-backed Lambda for the first time, walk through:

- [ ] `bootstrap.js` initialises `Lib.Auth.user` (and `admin` etc.) at module scope.
- [ ] On SQL backends, a one-time call to `setupNewStore(instance)` is performed by a separate migration Lambda or in `serverless deploy --stage` post-hook. On NoSQL backends (DynamoDB / MongoDB), the table / collection / native TTL must be provisioned out-of-band via IaC instead.
- [ ] `JWT_SIGNING_KEY` (≥ 32 chars) is in SSM / Secrets Manager and injected as an env var.
- [ ] All handlers return cookies via the response object's `cookies` array (V2) or `multiValueHeaders['Set-Cookie']` array (V1).
- [ ] Authorizer Lambda is wired in front of every protected route in `serverless.yml`.
- [ ] EventBridge schedule triggers the cleanup Lambda for SQL backends AND for MongoDB (which has no native TTL because the auth module stores integer seconds, not `Date`). DynamoDB deployments may skip the cron when native TTL on `expires_at` is enabled.
- [ ] For MongoDB, operator-provisioned indexes exist: `createIndex({ prefix: 1 })` (serves `listSessionsByActor`) and `createIndex({ expires_at: 1 })` (serves the cron). The auth module does not create these.
- [ ] For DynamoDB, the table has `tenant_id` (S, PK) and `session_key` (S, SK) - no GSI is required because every query pattern rides the composite primary key.
