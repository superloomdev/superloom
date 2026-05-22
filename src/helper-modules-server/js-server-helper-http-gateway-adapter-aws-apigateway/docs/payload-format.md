# Payload Format Reference

The adapter only consumes API Gateway **payload format v2.0**. This document is the schema reference plus the rationale for what is and is not supported.

**Related docs:**
- [`api.md`](api.md) for the 3-method adapter contract
- [`../ROBOTS.md`](../ROBOTS.md) for compact signature reference
- AWS reference: <https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html>

---

## Supported: Payload Format v2.0

Format v2.0 is emitted by:

- API Gateway **HTTP API** (default for new HTTP APIs)
- **Lambda Function URLs**

Key shape:

```json
{
  "version": "2.0",
  "routeKey": "POST /users/{user_id}",
  "rawPath": "/users/42",
  "rawQueryString": "page=3&sort=name",
  "cookies": ["session=abc", "theme=dark"],
  "headers": { "content-type": "application/json", "authorization": "Bearer ..." },
  "queryStringParameters": { "page": "3", "sort": "name" },
  "pathParameters": { "user_id": "42" },
  "requestContext": {
    "accountId": "123456789012",
    "apiId": "api-id",
    "domainName": "api.example.com",
    "http": {
      "method": "POST",
      "path": "/users/42",
      "protocol": "HTTP/1.1",
      "sourceIp": "203.0.113.10",
      "userAgent": "Mozilla/5.0 ..."
    },
    "authorizer": { "...": "if applicable" }
  },
  "body": "{\"email\":\"alice@example.com\"}",
  "isBase64Encoded": false
}
```

### How the adapter reads it

| Adapter output | v2.0 source |
|---|---|
| `http_request.method` | `event.requestContext.http.method` (uppercased) |
| `http_request.path` | `event.pathParameters` |
| `http_request.get` | `event.queryStringParameters` |
| `http_request.headers` | `event.headers` (keys lowercased) |
| `http_request.cookies` | parsed from `event.cookies` array |
| `http_request.post` | parsed from `event.body` (see [Body Parsing](#body-parsing)) |

---

## Multi-Value Query Strings

API Gateway v2.0 collapses repeated query keys into a **single comma-separated string** before delivery:

| Wire (`rawQueryString`) | `event.queryStringParameters` |
|---|---|
| `tag=red&tag=green&tag=blue` | `{ "tag": "red,green,blue" }` |

This differs from Express, which returns `['red','green','blue']` as a JavaScript array. Application code that needs the individual values must `split(',')` itself. Be aware of legitimate commas inside a single value — if your domain has comma-containing tags, switch to a different delimiter at the producer.

---

## Cookies

v2.0 delivers cookies as a **JSON array** of `name=value` strings, separate from `headers`:

```json
"cookies": ["session=abc-123", "theme=dark"]
```

The adapter URL-decodes each value and produces:

```javascript
instance.http_request.cookies === { session: 'abc-123', theme: 'dark' };
```

When `event.cookies` is missing, empty, or not an array, `cookies` is `{}`.

For setting cookies in the response, use `Gateway.setCookie(...)`. The adapter places the rendered `Set-Cookie` string in the response envelope's `headers['Set-Cookie']`.

---

## Body Parsing

| `content-type` header | Behavior |
|---|---|
| `application/json` | `JSON.parse(body)` — accepts only plain objects |
| `application/x-www-form-urlencoded` | `URLSearchParams` parse |
| Anything else (including `multipart/form-data`, `text/plain`, `application/xml`) | `{}` |
| Missing or empty body | `{}` |

If `event.isBase64Encoded === true`, the body is base64-decoded **before** content-type parsing. This handles binary uploads on routes API Gateway has configured for base64 encoding.

### Plain-object rule for JSON

The adapter rejects JSON arrays and primitive root values at the body level:

| Root JSON | `instance.http_request.post` |
|---|---|
| `{"k":"v","n":7}` | `{ k: 'v', n: 7 }` |
| `[1,2,3]` | `{}` (array rejected) |
| `42`, `"hello"`, `true`, `null` | `{}` (primitive rejected) |

This rule applies **only to the root**. Array and primitive values **inside** a JSON object are preserved normally:

```json
{ "tags": ["a", "b"], "count": 7, "enabled": true }
```

→ `post.tags === ['a','b']`, `post.count === 7`, `post.enabled === true`. The constraint exists so `instance.http_request.post` is always a flat key/value map that `setArgsFromRequest` can index by name. To submit an array as the entire request payload, wrap it in an object (`{"items":[...]}`).

### Multipart

The adapter does **not** parse `multipart/form-data` even though API Gateway v2.0 supports it as a base64-encoded binary payload. To accept multipart uploads, either:

1. Decode and parse the multipart payload yourself from `event.body` after the gateway populates `instance` (the raw body is still on the event).
2. Use a different integration path (S3 presigned upload, direct Lambda invocation with binary support).

---

## Authorizer Context

When an API Gateway route has an authorizer attached, the authorizer's output appears at `event.requestContext.authorizer`:

- **JWT authorizer:** `event.requestContext.authorizer.jwt.claims` and `.scopes`
- **Lambda authorizer:** `event.requestContext.authorizer.lambda` (arbitrary shape returned by the authorizer Lambda)
- **IAM authorizer:** `event.requestContext.authorizer.iam`

The adapter does **not** promote any of this into `instance.http_request`. Read it from the raw event when needed. See [`api.md`](api.md#authorizer-context) for an example.

---

## Not Supported: Payload Format v1.0

API Gateway **REST API** uses payload format v1.0 with a completely different shape:

- `httpMethod` at the root (not `requestContext.http.method`)
- `headers` may contain values as comma-separated strings instead of arrays
- `multiValueHeaders` and `multiValueQueryStringParameters` deliver repeated keys
- No `event.cookies` array — cookies arrive in `headers.cookie`

If a v1.0 event is passed to this adapter:

- `instance.http_request.method` will be `null` (no `requestContext.http`)
- `headers`, `get`, `path`, `body` may still populate from the v1.0 fields if shapes happen to match, but **the behavior is undefined and untested**
- The adapter does **not** throw

The test suite includes an `apigw-v2-custom-authorizer-v1-request.json` fixture (actually a v1.0 REST API authorizer payload) specifically to verify that a v1.0 event degrades gracefully rather than crashing. Group A in `_test/test.js` documents this boundary.

For projects on REST API, use a separate v1.0 adapter package or implement a custom adapter that reads from the v1.0 fields.

---

## Why v2.0 only?

The adapter is deliberately scoped to v2.0 because:

1. **HTTP API is the default** for new API Gateway deployments and Lambda Function URLs.
2. **v2.0 has a cleaner shape** — `requestContext.http.method`, dedicated `cookies` array, consistent `headers` map. No multi-value parallel structures.
3. **v1.0 is largely legacy** — REST API is still supported by AWS but new projects rarely choose it for plain HTTP Lambda integrations.

Supporting both formats in one adapter would mean every read path has to branch on `event.version`. Splitting them into two adapter packages keeps each implementation small, focused, and individually testable.

---

## Fixture Source

The test suite uses 23 event fixtures stored in `_test/fixtures/`:

- 6 fixtures copied verbatim from `aws/aws-lambda-go/events/testdata` — these are the exact shapes the AWS Go SDK uses to test its own event handling, the closest available "real Lambda input" without provisioning AWS infrastructure.
- 17 hand-written v2.0 variations covering scenarios AWS does not publish (cookies, bearer/basic auth, API key, malformed body, multipart, unicode, base64 decoding, minimal event, X-Forwarded-For chains).

Loading any fixture:

```javascript
const fs = require('node:fs');
const event = JSON.parse(fs.readFileSync('_test/fixtures/v2-post-json.json', 'utf8'));
```

Run the test suite to see every fixture exercised:

```bash
cd _test && npm install && npm test
```
