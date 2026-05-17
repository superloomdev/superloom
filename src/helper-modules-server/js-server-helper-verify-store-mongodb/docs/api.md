# API Reference — js-server-helper-verify-store-mongodb

This adapter implements the 6-method store contract consumed by `js-server-helper-verify`. This document focuses on the MongoDB-specific semantics.

## Adapter Factory

```js
const store = require('@superloomdev/js-server-helper-verify-store-mongodb')(Lib, CONFIG, ERRORS);
```

## Store Contract

### `setupNewStore(instance)`

Creates one index (idempotent via MongoDB's `createIndex`):

```js
// TTL index: automatically deletes documents ~60s after _ttl Date passes
createIndex({ _ttl: 1 }, { name: 'verify_ttl_idx', expireAfterSeconds: 0 })
```

Every verify record always has a `_ttl` field (verify codes always expire), so the index is non-sparse — there are no persistent records to skip.

The compound `_id` (`{ scope, id }`) is the primary key; MongoDB creates a unique index on `_id` automatically — no separate call needed.

**Return:** `{ success, error }`

---

### `getRecord(instance, scope, key)`

Fetches one document by compound `_id`:

```js
filter: { _id: { scope: scope, id: key } }
```

Returns `record: null` when the document does not exist. The returned record omits `_id` and `_ttl`.

**Return:** `{ success, record, error }`

`record` shape when found:
```js
{
  code:       String,
  fail_count: Number,
  created_at: Number,
  expires_at: Number
}
```

---

### `setRecord(instance, scope, key, record)`

Full document replacement via `replaceOne` with `upsert: true`:

```js
filter:      { _id: { scope: scope, id: key } }
replacement: { _id: ..., code, fail_count, created_at, expires_at, _ttl }
options:     { upsert: true }
```

The `_ttl` field is set to `new Date(record.expires_at * 1000)` on every write. Verify codes always carry an `expires_at`, so every document has `_ttl` — the TTL index is non-sparse and covers every record.

**Return:** `{ success, error }`

---

### `incrementFailCount(instance, scope, key)`

Atomic in-place increment via `$inc`:

```js
filter: { _id: { scope: scope, id: key } }
update: { $inc: { fail_count: 1 } }
```

Does not read the current value before writing. Safe under concurrent verify attempts.

**Return:** `{ success, error }`

---

### `deleteRecord(instance, scope, key)`

Idempotent delete by compound `_id`. A missing document is treated as success.

**Return:** `{ success, error }`

---

### `cleanupExpiredRecords(instance)`

Explicit sweep complementing the native TTL index:

```js
filter: { expires_at: { $ne: null, $lte: Lib.Utils.getUnixTime() } }
```

Returns `deleted_count` from the driver's `deletedCount`. Use this when you need deterministic `deleted_count` reporting independent of the ~60-second TTL sweeper lag.

**Return:** `{ success, deleted_count, error }`

---

## Error Handling

All methods return `{ success: false, error: ERRORS.SERVICE_UNAVAILABLE }` on driver failure. The underlying error is logged via `Lib.Debug.debug`. `getRecord` on a missing document returns `{ success: true, record: null, error: null }`.
