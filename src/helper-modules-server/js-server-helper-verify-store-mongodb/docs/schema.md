# Schema — js-server-helper-verify-store-mongodb

## Collection Structure

MongoDB does not use DDL. `setupNewStore` creates one index; the schema is enforced by the adapter's read/write path.

## Document Shape

```js
{
  _id: { scope: "email_verify", id: "user:123" },  // compound primary key
  code:       "742856",                             // hashed or plain code
  fail_count: 0,                                    // integer, default 0
  created_at: 1715180412,                           // Unix epoch seconds
  expires_at: 1715184012,                           // Unix epoch seconds
  _ttl:       ISODate("2024-05-08T14:00:12Z")       // Date; absent for persistent records
}
```

## Field Details

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `_id` | Object `{ scope, id }` | No | Compound primary key. Unique index created automatically by MongoDB. |
| `code` | String | No | The verification code (hashed or plain depending on verify config). |
| `fail_count` | Number | No | Count of failed verify attempts. Incremented atomically by `$inc`. |
| `created_at` | Number | No | Unix epoch seconds. |
| `expires_at` | Number | No | Unix epoch seconds. Used by `cleanupExpiredRecords` and to derive `_ttl`. |
| `_ttl` | Date | No | Always set on write as `new Date(expires_at * 1000)`. Drives the TTL index. |

## Index

`setupNewStore` creates exactly one index:

```js
{ _ttl: 1 }, { name: 'verify_ttl_idx', expireAfterSeconds: 0 }
```

- **`expireAfterSeconds: 0`** — MongoDB deletes the document as soon as the `_ttl` Date passes (with up to ~60s sweeper lag).
- The index is non-sparse: every verify record has a `_ttl` (verify codes always expire), so there are no documents to skip.

The compound `_id` is the primary access path for all record operations. No secondary indexes are needed.

## MongoDB-Specific Details

### Compound `_id`

The `_id` field is a plain JavaScript object `{ scope, id }`. MongoDB stores it as a sub-document and builds a unique B-tree index on it automatically. The adapter constructs this object on every read and write.

### UPSERT via `replaceOne`

`setRecord` uses `replaceOne` with `upsert: true` rather than `updateOne` because all fields are replaced on every write. There are no partially-updated mutable fields.

### `_ttl` vs `expires_at`

- `expires_at` — canonical Unix epoch seconds stored for the verify module's expiry check.
- `_ttl` — Date field derived from `expires_at` used exclusively by the MongoDB TTL index. The adapter sets this on write and strips it on read. Application code never sees `_ttl`.

### Atomic `fail_count` Increment

`incrementFailCount` uses `$inc: { fail_count: 1 }` without a `replaceOne`. This preserves the current `_ttl` field and avoids a read-modify-write cycle.
