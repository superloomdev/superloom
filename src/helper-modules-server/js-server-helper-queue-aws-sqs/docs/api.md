# API Reference. `js-server-helper-queue-aws-sqs`

Every exported function on the public interface, with parameters, return shape, and worked examples. For configuration, environment variables, IAM permissions, and runtime patterns see [Configuration](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-queue-aws-sqs/docs/configuration.md).

## On This Page

- [Conventions](#conventions)
- [Queue Names vs Queue URLs](#queue-names-vs-queue-urls)
- [`send`](#sendinstance-queue_name-message-options)
- [`receive`](#receiveinstance-queue_name-options)
- [`delete`](#deleteinstance-queue_name-receipt_handle)
- [`sendDelayed`](#senddelayedinstance-queue_name-message-delay_seconds)
- [Worked Example. Producer and Consumer](#worked-example-producer-and-consumer)
- [Lifecycle](#lifecycle)

---

## Conventions

Every function is async and resolves with an object. None of them throw on operational failure. The shape is one of:

```javascript
// success
{ success: true, /* data fields per function */, error: null }

// failure
{ success: false, /* data fields null */, error: { type, message } }
```

Branch on `result.success`. On failure, `result.error.type` is a stable string you can branch on; `result.error.message` is human-readable. The error catalog has three types: `QUEUE_SEND_FAILED`, `QUEUE_RECEIVE_FAILED`, `QUEUE_DELETE_FAILED`.

The first argument to every function is **`instance`**, an object that carries request-level context (notably `instance.time_ms`, the start timestamp of the request). It is the value returned by `Lib.Instance.initialize()` from the [`@superloomdev/js-server-helper-instance`](https://github.com/superloomdev/superloom/tree/main/src/helper-modules-server/js-server-helper-instance) module. The SQS module reads `instance.time_ms` once per call and routes it into the per-operation performance log line.

Message bodies are **automatically JSON-stringified** on `send` and **automatically JSON-parsed** on `receive`. If the parse fails (the body is not JSON), the original string is returned. You almost never have to think about serialization.

## Queue Names vs Queue URLs

Every function takes a **queue name**, not a queue URL. The module resolves the name to a full URL on first use and caches the result for the lifetime of the loaded instance.

There are two resolution modes:

| Mode | When | Behaviour |
|---|---|---|
| API lookup | `QUEUE_URL_PREFIX` is unset | The module calls `GetQueueUrl` once per name and caches the URL |
| Prefix construction | `QUEUE_URL_PREFIX` is set in config | The URL is built directly: `<prefix><queue_name>` |

Prefix construction skips the `GetQueueUrl` round-trip. It also avoids the IAM action `sqs:GetQueueUrl`. Set `QUEUE_URL_PREFIX` to `https://sqs.<region>.amazonaws.com/<account-id>/` in production deployments where you know the URL pattern.

---

## `send(instance, queue_name, message, options?)`

Send a single message to a queue.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `instance` | `Object` | Yes | The current request lifecycle instance. Used for performance logging |
| `queue_name` | `String` | Yes | Queue name (not URL). Resolved and cached |
| `message` | `Object \| String` | Yes | Message body. Objects are JSON-stringified. Strings pass through |
| `options.delay_seconds` | `Number` | No | Delay before the message becomes visible to consumers. 0-900 seconds |
| `options.message_group_id` | `String` | No | Required for FIFO queues. Messages with the same `message_group_id` are processed in order |

**Returns:** `Promise<{ success, message_id, error }>`

| Field | Type | On success | On failure |
|---|---|---|---|
| `success` | `Boolean` | `true` | `false` |
| `message_id` | `String \| null` | The SQS-assigned message ID | `null` |
| `error` | `Object \| null` | `null` | `{ type: 'QUEUE_SEND_FAILED', message: 'Queue message send failed' }` |

**Example:**

```javascript
const result = await Lib.SQS.send(instance, 'order_processing', {
  order_id: 'ORD_123',
  customer_id: 'CUS_456',
  action: 'fulfill'
}, {
  delay_seconds: 60 // do not process for 60 seconds
});

if (!result.success) {
  return ServerError(req, res, result.error);
}

console.log('queued message', result.message_id);
```

---

## `receive(instance, queue_name, options?)`

Receive up to 10 messages from a queue. Supports long polling.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `instance` | `Object` | Yes | The current request lifecycle instance |
| `queue_name` | `String` | Yes | Queue name (not URL) |
| `options.max_messages` | `Number` | No | Maximum messages to fetch. 1-10. Default 10 |
| `options.visibility_timeout` | `Number` | No | Seconds the message stays invisible to other consumers after this `receive`. Default `CONFIG.DEFAULT_VISIBILITY_TIMEOUT` (30 seconds) |
| `options.wait_time_seconds` | `Number` | No | Long-polling wait time. 0-20 seconds. Default 0 (short polling) |

**Returns:** `Promise<{ success, messages, error }>`

| Field | Type | On success | On failure |
|---|---|---|---|
| `success` | `Boolean` | `true` | `false` |
| `messages` | `Array<Message>` | Array of message objects (may be empty) | `[]` |
| `error` | `Object \| null` | `null` | `{ type: 'QUEUE_RECEIVE_FAILED', message: 'Queue message receive failed' }` |

Each message in `messages` has the shape:

| Field | Type | Description |
|---|---|---|
| `message_id` | `String` | SQS-assigned message ID |
| `receipt_handle` | `String` | Opaque token. Pass to `delete` after processing |
| `body` | `Any` | The message body. JSON-parsed if possible, otherwise the original string |
| `attributes` | `Object` | SQS-provided attributes (timestamps, approximate receive count, etc.). Empty object if no attributes were returned |

**Example:**

```javascript
const result = await Lib.SQS.receive(instance, 'order_processing', {
  max_messages: 5,
  wait_time_seconds: 10 // long-poll for up to 10 seconds
});

if (!result.success) {
  return ServerError(req, res, result.error);
}

for (const msg of result.messages) {
  // msg.body is already a parsed object if it was sent as JSON
  await processOrder(msg.body);
  await Lib.SQS.delete(instance, 'order_processing', msg.receipt_handle);
}
```

> **Long polling note.** Setting `wait_time_seconds` greater than 0 reduces empty receive calls (and bills) on a low-traffic queue. The HTTP request stays open until either a message arrives or the wait time expires. The default `0` is short polling, which is rarely what you want for a long-lived consumer loop.

---

## `delete(instance, queue_name, receipt_handle)`

Delete a message after successful processing. SQS does not auto-delete; until you call this, the message will become visible again after the visibility timeout.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `instance` | `Object` | Yes | The current request lifecycle instance |
| `queue_name` | `String` | Yes | Queue name (not URL) |
| `receipt_handle` | `String` | Yes | The receipt handle from `receive` |

**Returns:** `Promise<{ success, error }>`

| Field | Type | On success | On failure |
|---|---|---|---|
| `success` | `Boolean` | `true` | `false` |
| `error` | `Object \| null` | `null` | `{ type: 'QUEUE_DELETE_FAILED', message: 'Queue message delete failed' }` |

**Example:**

```javascript
const del = await Lib.SQS.delete(instance, 'order_processing', msg.receipt_handle);
if (!del.success) {
  // Don't crash. Log it. The message will retry on the next visibility timeout.
  Lib.Debug.warn('SQS delete failed', { type: del.error.type });
}
```

> **Idempotency note.** Always call `delete` only after the message has been **fully processed** (database written, side effects committed). If `delete` is called too early and your worker then crashes, the message is gone but the work was not done. Process first, delete second.

---

## `sendDelayed(instance, queue_name, message, delay_seconds)`

A convenience wrapper around `send` for the common "schedule this for later" use case. Equivalent to `send(instance, queue_name, message, { delay_seconds })`.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `instance` | `Object` | Yes | The current request lifecycle instance |
| `queue_name` | `String` | Yes | Queue name (not URL) |
| `message` | `Object \| String` | Yes | Message body |
| `delay_seconds` | `Number` | Yes | Delay in seconds. 0-900 |

**Returns:** Same shape as `send` (`{ success, message_id, error }`).

**Example:**

```javascript
// Send a "session expiry" reminder 15 minutes from now.
await Lib.SQS.sendDelayed(instance, 'session_expiry', {
  session_id: session.id,
  user_id: session.user_id
}, 900);
```

> **15-minute cap.** SQS rejects `delay_seconds` above 900. For longer delays, schedule via a different mechanism (CloudWatch Events / EventBridge, a dedicated scheduler, or a self-revisiting message that requeues itself with a fresh 15-minute delay).

---

## Worked Example. Producer and Consumer

A minimal producer/consumer pair using the four functions:

```javascript
// Producer (HTTP request handler)
async function placeOrder(req, res) {
  const instance = Lib.Instance.initialize();

  // ... validate, persist order to DB ...

  const queued = await Lib.SQS.send(instance, 'order_processing', {
    order_id: order.id,
    customer_id: order.customer_id
  });

  if (!queued.success) {
    return ServerError(req, res, queued.error);
  }

  res.json({ order_id: order.id, queued_message_id: queued.message_id });
}


// Consumer (worker loop)
async function consumerLoop() {
  while (running) {
    const instance = Lib.Instance.initialize();

    const recv = await Lib.SQS.receive(instance, 'order_processing', {
      max_messages: 10,
      wait_time_seconds: 20 // maximum long-poll
    });

    if (!recv.success) {
      Lib.Debug.warn('SQS receive failed', { type: recv.error.type });
      await sleep(1000);
      continue;
    }

    for (const msg of recv.messages) {
      try {
        await processOrder(msg.body);
        await Lib.SQS.delete(instance, 'order_processing', msg.receipt_handle);
      }
      catch (err) {
        // Don't delete. Let the message reappear after visibility timeout.
        Lib.Debug.error('order processing failed', { order_id: msg.body.order_id, err });
      }
    }
  }
}
```

---

## Lifecycle

The module is a factory. Each loader call returns an independent public interface with its own SDK client, queue-URL cache, and config. The SDK adapter (`@aws-sdk/client-sqs`) is cached at module scope and shared across instances because it is stateless. Only the configured `SQSClient` and the per-instance queue-URL cache hold state.

There is no `close()` function. The SQS client manages its own HTTP connection pool internally and does not need explicit teardown at process exit.

For multi-region or multi-account use cases, load the module multiple times. See [Configuration → Multi-Region / Multi-Account Setup](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-server/js-server-helper-queue-aws-sqs/docs/configuration.md#multi-region--multi-account-setup).
