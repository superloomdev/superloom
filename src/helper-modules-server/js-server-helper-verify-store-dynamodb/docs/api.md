# API Reference — js-server-helper-verify-store-dynamodb

This adapter implements the 6-method store contract consumed by `js-server-helper-verify`. This document focuses on the DynamoDB-specific semantics.

## Adapter Factory

```js
const store = require('@superloomdev/js-server-helper-verify-store-dynamodb')(Lib, CONFIG, ERRORS);
```

## Store Contract

### `setupNewStore(instance)`

Provisions the DynamoDB table via `createTable` with the following key schema:

```
Partition key (PK): scope  (String)
Sort key (SK):      id     (String)
Billing:            PAY_PER_REQUEST
```

`ResourceInUseException` (table already exists) is treated as success, making repeated calls idempotent. The adapter does not call `UpdateTimeToLive` — enable TTL on `expires_at` out-of-band after the first `setupNewStore`.

**Return:** `{ success, error }`

---

### `getRecord(instance, scope, key)`

`GetItem` by composite key `{ scope, id: key }`. Returns `record: null` when the item does not exist.

**Return:** `{ success, record, error }`

`record` shape when found:
```js
{
  code:       String,
  fail_count: Number,
  created_at: Number,  // Unix epoch seconds
  expires_at: Number   // Unix epoch seconds (also the TTL attribute)
}
```

---

### `setRecord(instance, scope, key, record)`

Full `PutItem`. Replaces all attributes for the given key in one operation. There are no partial updates.

Item written:
```js
{
  scope:      scope,
  id:         key,
  code:       record.code,
  fail_count: record.fail_count,
  created_at: record.created_at,
  expires_at: record.expires_at   // also serves as DynamoDB TTL attribute
}
```

**Return:** `{ success, error }`

---

### `incrementFailCount(instance, scope, key)`

Atomic `UpdateItem`:

```
UpdateExpression: SET #fail_count = #fail_count + :one
```

Does not read the current value. Safe under concurrent verify attempts.

**Return:** `{ success, error }`

---

### `deleteRecord(instance, scope, key)`

`DeleteItem` by composite key. DynamoDB `DeleteItem` on a missing key is a no-op — this is inherently idempotent.

**Return:** `{ success, error }`

---

### `cleanupExpiredRecords(instance)`

Full table `Scan` then `BatchDelete` on expired items:

1. `Scan` — returns all items in the table.
2. Client-side filter: `typeof item.expires_at === 'number' && item.expires_at > 0 && item.expires_at <= Lib.Utils.getUnixTime()`.
3. `batchDeleteRecords` — deletes the expired items.

Returns `deleted_count` equal to the number of items deleted. DynamoDB native TTL handles automatic expiry asynchronously with ~48h lag; this method provides explicit, deterministic cleanup.

**Return:** `{ success, deleted_count, error }`

---

## Error Handling

All methods return `{ success: false, error: ERRORS.SERVICE_UNAVAILABLE }` on driver failure. The underlying error is logged via `Lib.Debug.debug`. `getRecord` on a missing item returns `{ success: true, record: null, error: null }`.
