# Server Interfaces

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
router.post('/user/create', function (req, res) {

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
  const result = Lib.User.controller.create(standard_request);

  // Convert standard response to Express response
  res.status(result.status).json(result);

});
```

---

## Lambda Adapter Pattern

```javascript
// src/server/interfaces/api/lambda-aws/user/create.js
module.exports.handler = async function (event, context) {

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
  const result = await Lib.User.controller.create(standard_request);

  // Convert standard response to Lambda response
  return {
    statusCode: result.status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(result)
  };

};
```

Each entity gets its own per-endpoint handler files under `src/server/interfaces/api/lambda-aws/[entity]/` and a corresponding `serverless.yml` under `src/server/_deploy/serverless-aws/[entity]/`. Different endpoints can have different memory, timeout, and IAM settings.

---

## Boundary Rules

### Server interfaces must NOT

- Contain business or domain logic
- Access database or repositories directly
- Perform domain validation (that belongs in the model layer, called by the controller)
- Be aware of other interface types (the Express adapter must not know about Lambda, and vice versa)

### Server interfaces may

- Perform auth extraction (API key, JWT parsing)
- Perform rate limiting
- Log request and response metadata
- Handle CORS and transport-level concerns

---

## Further Reading

- [Server Controller Modules](server-controller-modules.md) - what every adapter calls into
- [Server Service Modules](server-service-modules.md) - where business logic actually lives
- [Server Loader](server-loader.md) - how `Lib` is built and how interfaces reach controllers via it
- [Module Publishing](module-publishing.md) - the per-entity Serverless deployment story
