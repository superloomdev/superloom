# Middleware Setup

The Express adapter reads `req.body`, `req.cookies`, and `req.query` directly. It does **not** install any middleware itself. The application is responsible for wiring the appropriate parsers before the gateway is invoked.

**Related docs:**
- [`api.md`](api.md) for the 3-method adapter contract
- [`../ROBOTS.md`](../ROBOTS.md) for compact signature reference

---

## Required Middleware

### JSON bodies

```javascript
app.use(express.json());
```

Without this, `instance.http_request.post` is `{}` for `application/json` requests. Note that `express.json()` rejects malformed JSON with a **400 response before the route handler runs** — your application code never sees the broken payload. To translate that into a Superloom-style response envelope, mount an error handler:

```javascript
app.use(function (err, req, res, next) {
  if (err && err.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'malformed_json' });
    return;
  }
  next(err);
});
```

### URL-encoded form bodies

```javascript
app.use(express.urlencoded({ extended: true }));
```

Without this, `application/x-www-form-urlencoded` requests produce empty `post`.

---

## Optional Middleware

### cookie-parser

```javascript
const cookieParser = require('cookie-parser');
app.use(cookieParser());
```

When present, the adapter uses `req.cookies`. When absent, the adapter parses the raw `Cookie` header itself. Both paths produce identical `instance.http_request.cookies` output, so `cookie-parser` is optional. It is recommended only if other middleware in your stack also expects `req.cookies`.

### text/plain bodies

Express does **not** parse `text/plain` by default. If your application accepts plain-text payloads, install `express.text()`:

```javascript
app.use(express.text());
```

The adapter will still expose `req.body` as a string in `instance.http_request.post` — note that `setArgsFromRequest` expects an object, so plain-text bodies do not fit the standard `POST` extraction pattern. Read the body directly from `req.body` in this case.

---

## Unsupported Content Types

### multipart/form-data

The adapter does **not** support `multipart/form-data`. To accept file uploads, install application-level middleware (e.g. `multer`) that populates `req.body` and `req.files` before the route handler:

```javascript
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

app.post('/upload', upload.single('file'), function (req, res) {
  const instance = Lib.Instance.initialize();
  Gateway.initHttpRequestData(instance, req, null, res);
  // req.file is available alongside instance.http_request.post
});
```

Reading the uploaded file requires reading `req.file` directly. The gateway's `setArgsFromRequest` does not know about uploaded files.

---

## Express 5 Migration Notes

The adapter is tested against Express 5.x. If you are migrating from Express 4:

| Change | Impact on adapter usage |
|--------|------------------------|
| `app.all('/path/:id?', handler)` removed | Register two routes: `app.all('/path', handler); app.all('/path/:id', handler);` |
| Default query parser changed to `'simple'` (documented) | The adapter test suite confirms arrays for repeated query keys still work in Express 5.x |
| `express.json()` and `express.urlencoded()` API-compatible with v4 | No code changes |
| `cookie-parser@^1.4.7` API-compatible with v4 | No code changes |

The adapter test suite explicitly covers each of these compatibility points against a real Express server.

---

## Recommended Application Setup

A minimal, idiomatic Express + gateway setup:

```javascript
const express        = require('express');
const cookieParser   = require('cookie-parser');
const GatewayLoader  = require('@superloomdev/js-server-helper-http-gateway');
const ExpressAdapter = require('@superloomdev/js-server-helper-http-gateway-adapter-express');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const Gateway = GatewayLoader(Lib, { ADAPTER: ExpressAdapter });

app.post('/api/users/:user_id', function (req, res) {
  const instance = Lib.Instance.initialize();
  Gateway.initHttpRequestData(instance, req, null, res);

  const [err, args] = Gateway.setArgsFromRequest(instance, [
    { method: 'PATH',   name: 'user_id', rename: 'user_id', required: true, is_number: true },
    { method: 'HEADER', name: 'authorization', rename: 'auth', required: true },
    { method: 'POST',   name: 'email', rename: 'email', required: true }
  ]);

  if (err) {
    Gateway.returnHttpStatus(instance, 'bad_request');
    return;
  }
  if (args === false) {
    Gateway.returnHttpStatus(instance, 'unauthorized');
    return;
  }

  // ... application logic ...
  Gateway.returnHttpResponse(instance, 200, null, { ok: true });
});

// Express 5 JSON-parse error handler
app.use(function (err, req, res, next) {
  if (err && err.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'malformed_json' });
    return;
  }
  next(err);
});

app.listen(3000);
```
