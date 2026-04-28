# js-server-helper-queue-aws-sqs

AWS SQS message queue. Send, receive, delete, schedule. Lazy-loaded SDK v3. Explicit credentials.

## Type
Server helper. Service-dependent (needs Docker for emulated, AWS for integration).

## Peer Dependencies
- `@superloomdev/js-helper-utils` - injected as `Lib.Utils`
- `@superloomdev/js-helper-debug` - injected as `Lib.Debug`
- `@superloomdev/js-server-helper-instance` - injected as `Lib.Instance`

## Direct Dependencies
- `@aws-sdk/client-sqs` - SQS client and commands

## Loader Pattern (Factory)

```javascript
Lib.SQS = require('@superloomdev/js-server-helper-queue-aws-sqs')(Lib, { /* config overrides */ });
```

Each loader call returns an independent SQS interface with its own `Lib`, `CONFIG`, SQS client, and queue URL cache.

## Config Keys
| Key | Type | Default | Required |
|---|---|---|---|
| REGION | String | 'us-east-1' | yes |
| KEY | String | undefined | yes (AWS access key) |
| SECRET | String | undefined | yes (AWS secret key) |
| ENDPOINT | String | undefined | no (set for ElasticMQ) |
| QUEUE_URL_PREFIX | String | undefined | no (construct URLs instead of API lookup) |
| DEFAULT_VISIBILITY_TIMEOUT | Number | 30 | no |
| MAX_RETRIES | Number | 3 | no |

## Exported Functions (4 total)

All functions with `instance` param use instance.time_ms for request-level performance timeline.

send(instance, queue_name, message, options?) -> { success, message_id, error } | async:yes
  Send a JSON message to a named queue. Options: delay_seconds, message_group_id (FIFO).

receive(instance, queue_name, options?) -> { success, messages, error } | async:yes
  Receive messages via polling. Options: max_messages (1-10), visibility_timeout, wait_time_seconds.
  Each message: { message_id, receipt_handle, body, attributes }

delete(instance, queue_name, receipt_handle) -> { success, error } | async:yes
  Delete a message after successful processing using its receipt handle.

sendDelayed(instance, queue_name, message, delay_seconds) -> { success, message_id, error } | async:yes
  Convenience wrapper for send() with delay (0-900 seconds).

## Patterns
- Instance first: every function receives instance for request-level performance tracking
- Lazy loading: SDK loaded on first function call via ensureAdapter + initIfNot
- Performance: Lib.Debug.performanceAuditLog with instance.time_ms
- Credentials: explicit KEY + SECRET via config, not implicit env chain
- Queue URL caching: resolved URLs cached in per-instance state
- JSON serialization: message bodies auto-stringified on send, auto-parsed on receive
