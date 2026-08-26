# Server Interfaces

> **Language:** JavaScript

`server-interfaces` are the **entry points** into the server application. They handle protocol translation - converting transport-specific requests (HTTP, Lambda event, webhook payload) into a **standardized internal format** before passing to `server-controller`, then converting controller responses back into transport-specific responses.

The key design goal: **the entire application logic is transport-agnostic**. Only the interface layer knows whether the request came from Express, AWS Lambda, or any other gateway. Add a new transport (Fastify, Hapi, message queue) by writing a new adapter - the controller, service, and model layers do not change.

## On This Page

- [Purpose](#purpose)
- [Design Principles](#design-principles)
- [Sub-Categories](#sub-categories)
- [The Dual Entry Point Pattern](#the-dual-entry-point-pattern)
- [Standardized Request Object](#standardized-request-object)
- [Standardized Response Object](#standardized-response-object)
- [Express Adapter Pattern](#express-adapter-pattern)
- [Lambda Adapter Pattern](#lambda-adapter-pattern)
- [Boundary Rules](#boundary-rules)
- [Further Reading](#further-reading)

---

## Purpose

- Act as **entry points** into the server application
- Handle **protocol translation** - transport-specific in, standardized out
- Convert controller responses back into transport-specific responses
- Keep the entire application logic transport-agnostic

---

## Design Principles

| Principle | Detail |
|---|---|
| **Thin adapters only** | No business logic |
| **One sub-directory per transport type** | API, hook, job |
| **Same standardized arguments to controllers** | Every interface passes the same shape |
| **Same standardized response from controllers** | Every interface receives the same shape |
| **Adding a new transport requires only a new adapter** | Controllers, services, and models do not change |

**Location:** `src/server/interfaces/`

---

## Sub-Categories

### API Modules (`server-api`)

- Public API endpoint interfaces used by client applications
- Located at `src/server/interfaces/api/`
- Contains transport adapters:
  - `express/` - Express.js routes (Docker / self-hosted deployment)
  - `lambda-aws/[entity]/` - per-entity AWS Lambda handlers (Serverless deployment)
- Each adapter converts its transport format to the standard controller input

### Hook Modules (`server-hook`)

- Entry points for third-party systems (Slack, Stripe webhooks, n8n, ...)
- Located at `src/server/interfaces/hook/`
- Each hook may follow a structure dictated by the third-party provider

### Job Modules (`server-job`)

- Internal job endpoints for cron jobs, background workers, internal tasks
- Not exposed to external client applications
- Located at `src/server/interfaces/job/`

---

## The Dual Entry Point Pattern

The central problem this architecture solves: **run the same application as a Docker container (Express) AND as AWS Lambda functions, without duplicating validation or controller logic.**

### Solution: Shared Controller, Separate Adapters

```
+-------------------------------------------------------+
|                  Client request                        |
+----------------+--------------+-----------------------+
                 |              |
        +--------v--------+  +-v---------------+
        |  Express        |  |  Lambda          |
        |  Adapter        |  |  Adapter         |
        |  (api/express)  |  |  (api/lambda-aws)|
        +--------+--------+  +-+---------------+
                 |              |
                 |  Standardized |
                 |  request      |
                 v              v
        +---------------------------------+
        |        Server Controller        |
        | (validate + DTO + delegate)     |
        +----------------+----------------+
                         |
                         v
        +---------------------------------+
        |          Server Service         |
        |  (business logic + orchestration)|
        +---------------------------------+
```

---

## Standardized Request Object

Every adapter must produce the same shape:

```javascript
{
  method: 'POST',              // HTTP method
  path: '/user/create',        // Route path
  params: {},                  // URL parameters
  query: {},                   // Query string parameters
  body: {},                    // Request body (parsed JSON)
  headers: {},                 // HTTP headers (lowercased keys)
  auth: {},                    // Extracted auth context (after auth middleware)
  meta: {                      // Request metadata
    request_id: 'uuid',        // Unique request identifier
    request_time: 1234567890,  // Unix timestamp in milliseconds
    source: 'express'          // Which adapter originated this request
  }
}
```

---

## Standardized Response Object

Every controller returns the same shape:

```javascript
{
  success: true,               // Whether the operation succeeded
  status: 200,                 // HTTP status code
  data: {},                    // Response payload (on success)
  error: null                  // Error object (on failure)
}
```

Each adapter then converts this into its transport-specific response format.

---

## Express Adapter Pattern

```javascript
// src/server/interfaces/api/express/routes.js
const express = require('express');
const router = express.Router();

// POST /user/create
router.post('/user/create', async function (req, res) {

  // Build a per-request instance. The loader was configured with
  // CLOSE_ON_CLEANUP: false, so pools stay open across requests.
  const instance = Lib.Instance.initialize();

  // Convert Express request to standard format
  const standard_request = {
    method: req.method,
    path: req.path,
    params: req.params,
    query: req.query,
    body: req.body,
    headers: req.headers,
    auth: req.auth || {},
    meta: {
      request_id: req.headers['x-request-id'] || generateId(),
      request_time: Date.now(),
      source: 'express'
    }
  };

  // Call shared controller
  const result = await Lib.User.controller.create(standard_request, instance);

  // Convert standard response to Express response
  res.status(result.status).json(result);

  // Release request-scoped resources (borrowed connections, background
  // routines). The pool itself stays open.
  await Lib.Instance.runInstanceCleanup(instance);

});
```

The Express entry point is a persistent server. Its composition root sets `CLOSE_ON_CLEANUP: false`, so `runInstanceCleanup` releases borrowed connections and waits for background routines, but does not close the pool. The pool closes on shutdown:

```javascript
// src/server/interfaces/api/express/server.js
const server = app.listen(CONFIG.PORT);

// SIGTERM closes the server and drains all pools. This handler
// belongs to the persistent entry point only.
process.on('SIGTERM', async function () {
  server.close();
  await Lib.Instance.runProcessCleanup();
  process.exit(0);
});
```

---

## Lambda Adapter Pattern

```javascript
// src/server/interfaces/api/lambda-aws/user/create.js
module.exports.handler = async function (event, context) {

  // Build a per-request instance. The loader was configured with
  // CLOSE_ON_CLEANUP: true, so pools close after every request.
  const instance = Lib.Instance.initialize();

  // Convert Lambda event to standard format
  const standard_request = {
    method: event.httpMethod || event.requestContext?.http?.method,
    path: event.path || event.rawPath,
    params: event.pathParameters || {},
    query: event.queryStringParameters || {},
    body: JSON.parse(event.body || '{}'),
    headers: lowerCaseKeys(event.headers || {}),
    auth: {},
    meta: {
      request_id: context.awsRequestId,
      request_time: Date.now(),
      source: 'lambda'
    }
  };

  // Call the entity's controller
  const result = await Lib.User.controller.create(standard_request, instance);

  // Convert standard response to Lambda response
  const response = {
    statusCode: result.status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(result)
  };

  // Background work lands, then every connection closes. Leaving a
  // handle open holds the worker alive and billable until the
  // function times out.
  await Lib.Instance.runInstanceCleanup(instance);

  return response;

};
```

The Lambda entry point has **no SIGTERM handler**. The container freezes rather than shutting down, so there is no signal to catch. Cleanup happens per request via `runInstanceCleanup`, which drains background routines, releases borrowed connections, and closes the pool because `CLOSE_ON_CLEANUP` is `true`.

**Warning:** an `async` handler must not also accept a `callback` argument. Mixing the two reintroduces callback semantics, under which the response is withheld until the event loop drains and an open pool holds the invocation to its timeout. If a handler is `async`, return the response. If it needs `callback`, it is not `async`.

Each entity gets its own per-endpoint handler files under `src/server/interfaces/api/lambda-aws/[entity]/` and a corresponding `serverless.yml` under `src/server/_deploy/serverless-aws/[entity]/`. Different endpoints can have different memory, timeout, and IAM settings.

---

## Boundary Rules

### Server interface responsibilities

- **Protocol translation only.** Convert transport-specific requests to the standardized format, and convert controller responses back
- **Auth extraction.** API key, JWT parsing
- **Rate limiting.** Transport-level throttling
- **Request/response logging.** Metadata and performance
- **CORS and transport-level concerns**

Business logic, database access, and domain validation belong in the controller, service, and model layers respectively. Each adapter is self-contained and unaware of other transport types.

---

## Further Reading

- [Server Controller Modules](server-controller-modules.md) - what every adapter calls into
- [Server Service Modules](server-service-modules.md) - where business logic actually lives
- [Server Loader](server-loader.md) - how `Lib` is built and how interfaces reach controllers via it
- [Module Publishing](../publishing.md) - the per-entity Serverless deployment story
