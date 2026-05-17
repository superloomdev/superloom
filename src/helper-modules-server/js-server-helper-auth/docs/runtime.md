# Runtime. `js-server-helper-auth`

The auth module is runtime-agnostic at the call-site: every function takes `instance` as its first argument and reads from / writes to `instance.http_request` and `instance.http_response`. What differs between a **persistent server** (Express, Fastify, Koa, plain Node HTTP, ...) and a **serverless function** (AWS Lambda, Google Cloud Functions, Azure Functions, ...) is how those two objects are constructed from the runtime's native event shape and how the response gets back out.

For the function reference see [API Reference](api.md). For the loader call and configuration keys see [Configuration](configuration.md). For backend choice see the [Storage Adapters](../README.md#storage-adapters) section in the module README.

## On This Page

- [Persistent Server](#persistent-server)
- [Serverless Function](#serverless-function)
- [Scheduled Cleanup](#scheduled-cleanup)

---

## Persistent Server

A persistent-server framework hands the handler a live request and response pair on every invocation. Bind them directly to `instance`:

```js
req.instance = Lib.Instance.initialize();
req.instance.http_request  = req;       // cookie / Authorization reads
req.instance.http_response = res;       // Set-Cookie writes
```

The auth module reads cookies and the `Authorization` header from `instance.http_request`, and writes `Set-Cookie` to `instance.http_response`. The framework streams these out as part of the normal request/response cycle. Nothing else is required.

## Serverless Function

A serverless invocation hands the handler an **event** (not a request) and expects a **response object** back (not a stream). Two adaptations are required.

**Adapt the event into `instance.http_request`.** The auth module expects a lowercase header map and a cookies array:

```js
instance.http_request = {
  headers: lowercaseHeaders(event.headers),
  cookies: event.cookies || []
};
```

**Buffer response writes into `instance.http_response`.** The container has no streaming response, so collect what the auth module writes and include it in the returned response object:

```js
const set_cookies = [];
const set_headers = {};
instance.http_response = {
  setHeader: function (name, value) { set_headers[name] = value; },
  appendHeader: function (name, value) {
    if (name.toLowerCase() === 'set-cookie') {
      set_cookies.push(value);
      return;
    }
    set_headers[name] = value;
  }
};

// ... auth-module calls run here ...

return {
  statusCode: 200,
  headers:    set_headers,
  cookies:    set_cookies,    // HTTP API V2. For REST V1 use multiValueHeaders['Set-Cookie']
  body:       JSON.stringify(/* ... */)
};
```

Build the `Lib` container at **module scope** so it survives between warm invocations; only the per-invocation `instance` is constructed inside the handler.

> **Lost-cookie warning.** Any cookie the auth module writes via `instance.http_response` must end up in the returned response object's `cookies` array (or `multiValueHeaders['Set-Cookie']` for REST V1). The container exits the moment the handler returns; cookies not in the response are silently dropped.

## Scheduled Cleanup

Whether `cleanupExpiredSessions(instance)` needs to be scheduled depends on the chosen storage adapter (some adapters' native TTL makes the cron optional). See your adapter's README for whether scheduling is required.

When it is required, the call is identical in both runtimes:

```js
const instance = Lib.Instance.initialize();

await Promise.all([
  Lib.Auth.user.cleanupExpiredSessions(instance),
  Lib.Auth.admin.cleanupExpiredSessions(instance)
]);
```

The difference is only **how** that call is scheduled:

- **Persistent server.** Any cron mechanism inside or alongside the process: `node-cron`, `agenda`, a sidecar `systemd` timer, a Kubernetes `CronJob`.
- **Serverless function.** A separate scheduled function invocation: AWS EventBridge for Lambda, Cloud Scheduler for Google Cloud Functions, and so on. Do not put the sweep inside an HTTP-triggered handler.
