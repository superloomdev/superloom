# API Reference — js-server-helper-logger-store-dynamodb

This adapter implements the 5-method store contract consumed by `js-server-helper-logger`. This document focuses on the DynamoDB-specific semantics.

## Adapter Factory

```js
const store = require('@superloomdev/js-server-helper-logger-store-dynamodb')(Lib, CONFIG, ERRORS);
```

## Store Contract

### `setupNewStore(instance)`

**No-op.** Returns `{ success: true, error: null }` without calling DynamoDB.

DynamoDB tables are typically provisioned via IaC (CloudFormation, CDK, Terraform) or the AWS Console, not by the application at runtime. The adapter assumes the table and GSI already exist. The method exists to satisfy the Logger module's idempotent setup contract — calling it on every boot is safe and free.

The expected layout (provision out-of-band):
```
Base table:
  PK:  pk        (String) — written as "{scope}#{entity_type}#{entity_id}"
  SK:  sort_key  (String)

GSI (actor_pk-sort_key-index):
  PK:  actor_pk  (String) — written as "{scope}#{actor_type}#{actor_id}"
  SK:  sort_key  (String)
  Projection: ALL

TTL attribute: expires_at
Billing:       PAY_PER_REQUEST recommended
```

Enable TTL on `expires_at` out-of-band; the adapter does not call `UpdateTimeToLive`.

**Return:** `{ success, error }`

---

### `addLog(instance, record)`

`PutItem` of the canonical record with two extra computed key attributes injected. The `sort_key` carries a random suffix making collisions effectively impossible — no UPSERT logic is needed.

Item written:
```js
Object.assign({}, record, {
  pk:       (record.scope || '') + '#' + record.entity_type + '#' + record.entity_id,
  actor_pk: (record.scope || '') + '#' + record.actor_type  + '#' + record.actor_id
});
```

`data`, `ip`, `user_agent`, `created_at`, `created_at_ms`, `sort_key`, and `expires_at` come straight off the canonical record. The DynamoDB driver marshals nested values natively — `data` is **not** JSON-stringified.

**Return:** `{ success, error }`

---

### `getLogsByEntity(instance, query)`

`Query` on the base table with `pkName: 'pk'`, `pk = "{scope}#{entity_type}#{entity_id}"`, sort key descending. Cursor pagination is implemented via `skCondition: 'sort_key < :cursor'` on the previous page's last `sort_key`.

| Field | Required | Description |
|-------|----------|-------------|
| `scope` | Yes | Used to compute the partition key |
| `entity_type` | Yes | Used to compute the partition key |
| `entity_id` | Yes | Used to compute the partition key |
| `actions` | No | Client-side filter by action |
| `start_time_ms` / `end_time_ms` | No | Client-side filter on `created_at_ms` |
| `limit` | No | Page size (default 50). The adapter fetches `min(limit * 4 + 1, 200)` rows so client-side filters do not starve the page |
| `cursor` | No | `sort_key` value from previous page's `next_cursor` |

**Return:** `{ success, records, next_cursor, error }`

---

### `getLogsByActor(instance, query)`

`Query` on the `actor_pk-sort_key-index` GSI with `pkName: 'actor_pk'`, `pk = "{scope}#{actor_type}#{actor_id}"`, sort key descending.

| Field | Required | Description |
|-------|----------|-------------|
| `scope` | Yes | Used to compute the partition key |
| `actor_type` | Yes | Used to compute the partition key |
| `actor_id` | Yes | Used to compute the partition key |
| `actions` | No | Client-side filter by action |
| `start_time_ms` / `end_time_ms` | No | Client-side filter on `created_at_ms` |
| `limit` | No | Page size (default 50) |
| `cursor` | No | `sort_key` from previous page's `next_cursor` |

**Return:** `{ success, records, next_cursor, error }`

---

### `cleanupExpiredLogs(instance)`

Full table `Scan` (no `FilterExpression` — the driver does not currently expose one), client-side filter for `typeof item.expires_at === 'number' && item.expires_at > 0 && item.expires_at <= Lib.Utils.getUnixTime()`, then `BatchWriteItem` deletes by `{ pk, sort_key }`.

Returns `deleted_count` equal to the number of items deleted. DynamoDB native TTL handles automatic expiry asynchronously (~48h lag); this method provides explicit, deterministic cleanup at the cost of a full-table scan.

**Return:** `{ success, deleted_count, error }`

---

## Error Handling

All methods return `{ success: false, error: ERRORS.SERVICE_UNAVAILABLE }` on driver failure. The driver error is logged via `Lib.Debug.error`.
