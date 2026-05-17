# Schema

Unlike the SQL-backed sibling adapters, this adapter does **not** manage its own schema. `setupNewStore` returns `NOT_IMPLEMENTED`. MongoDB auto-creates the collection on the first write, and the operator provisions secondary indexes out-of-band.

The canonical data model lives in the Auth parent. This page documents only what is specific to the MongoDB implementation: document shape, the two adapter-managed fields (`_id` and `prefix`), the BSON type mapping, the required and recommended indexes, and the optional native-TTL setup.

## On This Page

- [Document Shape](#document-shape)
- [`_id` Composition](#_id-composition)
- [The `prefix` Field](#the-prefix-field)
- [BSON Type Mapping](#bson-type-mapping)
- [Why No `setupNewStore`](#why-no-setupnewstore)
- [Index Strategy](#index-strategy)
- [Native TTL](#native-ttl)

## Document Shape

Each session is a single MongoDB document. The shape is the canonical record plus two adapter-managed fields:

```js
{
  _id:    '<tenant_id>#<actor_id>#<token_key>#<token_secret_hash>',
  prefix: '<tenant_id>#<actor_id>#',

  tenant_id:           '<string>',
  actor_id:            '<string>',
  actor_type:          '<string>',
  token_key:           '<string>',
  token_secret_hash:   '<string>',
  refresh_token_hash:  '<string>' | null,
  refresh_family_id:   '<string>' | null,
  created_at:          <Number>,
  expires_at:          <Number>,
  last_active_at:      <Number>,
  install_id:          '<string>' | null,
  install_platform:    '<string>',
  install_form_factor: '<string>',
  client_name:         '<string>' | null,
  client_version:      '<string>' | null,
  client_is_browser:   <Boolean>,
  client_os_name:      '<string>' | null,
  client_os_version:   '<string>' | null,
  client_screen_w:     <Number> | null,
  client_screen_h:     <Number> | null,
  client_ip_address:   '<string>' | null,
  client_user_agent:   '<string>' | null,
  push_provider:       '<string>' | null,
  push_token:          '<string>' | null,
  custom_data:         <Object> | null
}
```

The two adapter-managed fields (`_id` and `prefix`) are computed by the adapter from the record's identity fields on every write. They are stripped from the document before it is returned to the caller; the canonical record shape coming out of the store matches every sibling adapter's exactly.

## `_id` Composition

```
<tenant_id>#<actor_id>#<token_key>#<token_secret_hash>
```

The `_id` is a deterministic string concatenation of four identity components, separated by `#`. The token-secret hash is part of the key.

**Why include the hash in `_id`.** The default `_id` index gives O(1) lookup. By baking the hash into the key, `getSession` becomes a single index probe: a correct secret produces the right `_id` and returns the document; a wrong secret produces a different `_id` and returns null naturally. There is no second read, no hash compare path on the document, and no timing variance from secret comparison. The wrong-secret response is indistinguishable from a missing-session response, which prevents timing-based enumeration of valid `token_key` values.

**Why `#` as the separator.** A character that is rare in `tenant_id` and `actor_id` values and that callers are unlikely to use unintentionally. The Auth parent's input validation rejects `actor_id` values containing `-` or `#`, so the separator stays unambiguous.

For methods that operate by `(tenant_id, actor_id, token_key)` without the hash (the partial-update and delete paths), the adapter constructs an anchored prefix regex (`new RegExp('^' + escapeRegExp(<tenant_id> + '#' + <actor_id> + '#' + <token_key> + '#'))`) and matches against `_id`. At most one document matches because the triple is unique within a `(tenant_id, actor_id)` namespace. Regex metacharacters in the identifier values are escaped via the adapter's private `escapeRegExp` helper.

## The `prefix` Field

```
<tenant_id>#<actor_id>#
```

A denormalized string written to every document. It exists so `listSessionsByActor` can use an indexed equality query instead of an anchored regex scan on `_id`.

**Why denormalize.** MongoDB indexes regex queries only for left-anchored patterns and only with measurable overhead vs equality. Equality on a dedicated field is the cheapest possible plan for the access pattern. The cost is one extra string per document (typically 30-100 bytes); the benefit is that the most frequent multi-document read path stays O(log n + k) instead of degrading on regex evaluation.

The `prefix` field is regenerated on every `setSession`, so it cannot drift from the identity-field values. The `updateSessionActivity` identity blocklist explicitly includes `prefix` (alongside `_id`) so partial updates cannot break the invariant.

## BSON Type Mapping

| Canonical record field | BSON type | Notes |
|---|---|---|
| Identity strings (`tenant_id`, `actor_id`, `actor_type`, `token_key`, `token_secret_hash`, `refresh_token_hash`, `refresh_family_id`, `install_id`, `install_platform`, `install_form_factor`, `client_*` strings, `push_provider`, `push_token`) | String | Native UTF-8 |
| Timestamps (`created_at`, `expires_at`, `last_active_at`) | Number (Int64 in BSON) | Unix epoch **seconds**, not BSON Date. Identical to every other adapter's encoding. Operators who want native TTL provision a separate Date field; see [Native TTL](#native-ttl) |
| `client_screen_w`, `client_screen_h` | Number (Int32 in BSON) | Pixel counts |
| `client_is_browser` | Boolean | Native BSON boolean |
| `custom_data` | Embedded sub-document, or null | Stored as a native object; no JSON serialization. Any BSON-encodable value is accepted |

The native-object handling of `custom_data` is a deliberate divergence from the SQL adapters (which JSON-encode it into a TEXT column). For MongoDB the natural representation is a sub-document; cross-adapter portability stays intact because the caller-visible value is the same object either way.

## Why No `setupNewStore`

`setupNewStore` returns `{ success: false, error: ERRORS.NOT_IMPLEMENTED }` unconditionally for this backend. Two reasons:

1. **MongoDB does not need explicit collection creation.** The first `setSession` write creates the collection. Calling `createCollection` ahead of time is purely cosmetic.

2. **Index provisioning is a database-administrative concern**, not part of the application code path. The decision of whether to add the `expires_at` secondary index, whether to add a Date-typed TTL field, and the index-build strategy (background vs foreground, on a primary vs a replica) is the operator's call. The adapter does not try to make those decisions.

Application code that runs against multiple `auth-store-*` backends must handle the `NOT_IMPLEMENTED` envelope on this backend. The Auth parent treats it as a soft failure (logs and continues) on the assumption that the operator has provisioned the required indexes.

## Index Strategy

The schema has **one index by default** (the implicit `_id` index that MongoDB always creates) plus up to three operator-provisioned indexes.

| Index | Source | Columns / Spec | Required? |
|---|---|---|---|
| `_id` index | Implicit. MongoDB always indexes `_id` | `_id` ascending | Always present |
| `prefix` index | Operator-provisioned | `{ prefix: 1 }` | **Required** for production. `listSessionsByActor` degenerates to a collection scan without it |
| `expires_at` index | Operator-provisioned | `{ expires_at: 1 }` | **Recommended.** `cleanupExpiredSessions` scales with the number of expired documents instead of the total collection size |
| TTL index on a Date-typed field | Operator-provisioned | `{ <date_field>: 1 }, { expireAfterSeconds: 0 }` | **Optional.** Adds MongoDB-managed expiration; see [Native TTL](#native-ttl) for the trade-offs |

### Default `_id` Index

Created automatically by MongoDB. Cannot be dropped. Serves every adapter access pattern that knows the full `(tenant_id, actor_id, token_key, token_secret_hash)` quadruple or that operates by a left-anchored prefix on `_id`.

| Adapter method | How the `_id` index serves it |
|---|---|
| `getSession` | Full-`_id` equality. Single-document lookup, no timing oracle |
| `setSession` | `replaceOne` filter on `_id` for the upsert |
| `updateSessionActivity` | Anchored prefix regex on `_id` matches the unique target document |
| `deleteSession` | Anchored prefix regex on `_id` |
| `deleteSessions` | `$or` of anchored prefix regexes, all served by the same `_id` index |

### `prefix` Secondary Index

```js
db.<collection_name>.createIndex({ prefix: 1 });
```

Required in production. Serves the only multi-document read path:

| Adapter method | How the `prefix` index serves it |
|---|---|
| `listSessionsByActor` | Equality on the `prefix` field returns all documents for one `(tenant_id, actor_id)` pair |

Without this index the call is a collection scan, which is unacceptable beyond toy data volumes.

### `expires_at` Secondary Index (recommended)

```js
db.<collection_name>.createIndex({ expires_at: 1 });
```

Recommended whenever `cleanupExpiredSessions` is run on a schedule. Serves the cleanup sweep:

| Adapter method | How the index serves it |
|---|---|
| `cleanupExpiredSessions` | Range scan on `{ expires_at: { $lt: <now> } }`. Sweep cost is proportional to the number of expired documents, not the total document count |

Without this index, `cleanupExpiredSessions` is a collection scan. For low-volume deployments the scan is acceptable; for production the index pays for itself on the first non-trivial cleanup.

### No Other Indexes

The adapter does not require, and does not benefit from, indexes on `actor_type`, `install_id`, `install_platform`, `install_form_factor`, `last_active_at`, `refresh_token_hash`, `refresh_family_id`, `push_token`, `client_ip_address`, or any other field. The Auth parent never queries on these fields. Adding such indexes would cost write throughput and storage with no payoff on any read path.

## Native TTL

MongoDB's native TTL index requires a **Date-typed** field. The canonical `expires_at` in this schema is a Number (Unix epoch seconds), not a BSON Date, so it cannot drive a TTL index directly.

Two operator paths exist:

**Default. No native TTL.** Run `cleanupExpiredSessions` on a schedule. The full mechanism and recommended cadence live in [cleanup.md](cleanup.md).

**Alternative. Date-field + TTL index.** Provision a separate Date-typed field (e.g. `expires_at_date`) that mirrors `expires_at` and add a TTL index on it:

```js
db.<collection_name>.createIndex(
  { expires_at_date: 1 },
  { expireAfterSeconds: 0 }
);
```

The adapter does not maintain the Date field. The operator (or application code that wraps the adapter) is responsible for writing `expires_at_date: new Date(expires_at * 1000)` alongside every `setSession`. This path is more involved and is documented for completeness; the default scheduled-cleanup path is the recommended option for new deployments. See [cleanup.md](cleanup.md) for the trade-off discussion.
