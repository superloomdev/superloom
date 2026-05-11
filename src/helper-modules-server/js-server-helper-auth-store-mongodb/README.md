# @superloomdev/js-server-helper-auth-store-mongodb

[![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-brightgreen.svg)](https://nodejs.org)

MongoDB session store adapter for [`@superloomdev/js-server-helper-auth`](../js-server-helper-auth). Implements the 8-method store contract backed by MongoDB via `@superloomdev/js-server-helper-nosql-mongodb`.

> **Service-dependent.** Tests require a running MongoDB instance. The Docker lifecycle is managed automatically by `npm test` via `pretest`/`posttest` scripts — no manual `docker compose` needed.

## How This Adapter Fits In

The auth module calls this adapter as a factory:

```js
const store = require('@superloomdev/js-server-helper-auth-store-mongodb')(Lib, CONFIG, ERRORS);
```

The adapter receives the full narrowed `Lib` (Utils, Debug, Crypto, Instance), the merged `CONFIG` (from which it extracts `CONFIG.STORE_CONFIG` internally), and the frozen auth `ERRORS` catalog (used verbatim in error envelopes). It returns the 8-method store interface consumed by `auth.js`. The caller — `auth.js` — never needs to know which backend is active.

This is the standard **adapter factory protocol** shared by all `auth-store-*` packages.

## Install

```bash
npm install @superloomdev/js-server-helper-auth \
            @superloomdev/js-server-helper-auth-store-mongodb \
            @superloomdev/js-server-helper-nosql-mongodb
```

## Usage

Pass the adapter factory to `STORE`. Pass the `Lib.MongoDB` instance in `STORE_CONFIG`.

```js
const Lib = {};
Lib.Utils    = require('@superloomdev/js-helper-utils')(Lib, {});
Lib.Debug    = require('@superloomdev/js-helper-debug')(Lib, {});
Lib.Crypto   = require('@superloomdev/js-server-helper-crypto')(Lib, {});
Lib.Instance = require('@superloomdev/js-server-helper-instance')(Lib, {});

Lib.MongoDB = require('@superloomdev/js-server-helper-nosql-mongodb')(Lib, {
  URI:      process.env.MONGODB_URI,
  DATABASE: process.env.MONGODB_DATABASE
});

Lib.AuthUser = require('@superloomdev/js-server-helper-auth')(Lib, {
  STORE: require('@superloomdev/js-server-helper-auth-store-mongodb'),
  STORE_CONFIG: {
    collection_name: 'sessions_user',
    lib_mongodb:     Lib.MongoDB
  },
  ACTOR_TYPE:  'user',
  TTL_SECONDS: 2592000
});
```

> **No `setupNewStore` call needed.** MongoDB auto-creates the collection on the first write. Indexes must be provisioned out-of-band (see [Indexes](#indexes) below).

## STORE_CONFIG

| Key | Type | Required | Description |
|---|---|---|---|
| `collection_name` | `String` | Yes | Name of the sessions collection. Use one collection per `actor_type` (e.g. `sessions_user`, `sessions_admin`). |
| `lib_mongodb` | `Object` | Yes | An initialized `Lib.MongoDB` instance (`@superloomdev/js-server-helper-nosql-mongodb`). |

## Document Structure

Each session is stored as a single MongoDB document. The `_id` field is a composite key:

```
_id:    "{tenant_id}#{actor_id}#{token_key}#{token_secret_hash}"
prefix: "{tenant_id}#{actor_id}"
```

This layout provides:
- **O(1) reads for `getSession`** — direct lookup by `_id`, the default MongoDB index.
- **Wrong-secret probes return "not found" with no extra read** — the hash is baked into `_id`; a mismatch never matches a document.
- **Efficient `listSessionsByActor`** — equality query on the indexed `prefix` field; no regex or collection scan required.

All other session fields are stored as document attributes using the same canonical names as the SQL adapters.

### MongoDB-Specific Notes

- **`setupNewStore` is not implemented** — returns `{ success: false, error: { type: 'NOT_IMPLEMENTED' } }`. MongoDB auto-creates collections. Provision indexes out-of-band.
- **Timestamps** (`created_at`, `expires_at`, `last_active_at`) are stored as `Number` (Unix epoch seconds), not as BSON `Date`. This keeps the record shape identical across all adapters. If you use a native TTL index, provision it on a separate `Date`-typed field updated alongside `expires_at`.
- **`custom_data`** is stored as a native BSON sub-document — no JSON serialization needed.
- **`client_is_browser`** is stored as a native BSON boolean.
- **Upsert** uses `replaceOne` with `upsert: true`, replacing the whole document. Immutable fields (`created_at`, `install_id`, `install_platform`, `install_form_factor`) are preserved by reading the existing document first on conflict. This matches the upsert immutability contract of the SQL adapters.
- **`deleteSessions`** issues a single `deleteMany` with an `$or` filter — one round-trip regardless of how many sessions are evicted.

## Indexes

`setupNewStore` is not implemented. Provision these indexes out-of-band before the collection is first used:

```js
// Required: prefix index for listSessionsByActor
db.sessions_user.createIndex({ prefix: 1 });

// Optional: TTL index for automatic expiry (note: must be a Date field)
// If you want native TTL, add a separate 'expires_at_date' Date field
// and provision the TTL index on it. The integer 'expires_at' field
// cannot be used directly for MongoDB TTL indexes.
db.sessions_user.createIndex(
  { expires_at_date: 1 },
  { expireAfterSeconds: 0 }
);
```

If you do not provision a TTL index, run `cleanupExpiredSessions` on a cron instead (see below).

## Store Contract

This adapter implements the 8-method contract consumed by `auth.js`:

| Method | Signature | Returns |
|---|---|---|
| `setupNewStore` | `(instance)` | `{ success: false, error: { type: 'NOT_IMPLEMENTED' } }` |
| `getSession` | `(instance, tenant_id, actor_id, token_key, token_secret_hash)` | `{ success, record, error }` |
| `listSessionsByActor` | `(instance, tenant_id, actor_id)` | `{ success, records, error }` |
| `setSession` | `(instance, record)` | `{ success, error }` |
| `updateSessionActivity` | `(instance, tenant_id, actor_id, token_key, updates)` | `{ success, error }` |
| `deleteSession` | `(instance, tenant_id, actor_id, token_key)` | `{ success, error }` |
| `deleteSessions` | `(instance, tenant_id, keys)` | `{ success, error }` |
| `cleanupExpiredSessions` | `(instance)` | `{ success, deleted_count, error }` |

`getSession` computes the `_id` from the four arguments and does a direct document lookup. A wrong `token_secret_hash` means the `_id` will not match any document — returning `{ record: null }` — identical to a missing document. No timing oracle.

`updateSessionActivity` throws `TypeError` if `updates` contains any identity field. It uses `updateOne` with a `$set` update to apply only the supplied mutable fields.

`cleanupExpiredSessions` uses `deleteMany` with `{ expires_at: { $lt: instance.time } }` — a collection scan unless a secondary index on `expires_at` is provisioned.

## Expired Session Cleanup

If you are not using a native MongoDB TTL index, run `cleanupExpiredSessions` on a cron:

```js
setInterval(async function () {
  const result = await Lib.AuthUser.cleanupExpiredSessions(Lib.Instance.initialize());
  if (result.success) {
    Lib.Debug.info('Cleanup deleted ' + result.deleted_count + ' expired sessions');
  }
}, 3600 * 1000);
```

To make `cleanupExpiredSessions` efficient, add a secondary index on `expires_at`:

```js
db.sessions_user.createIndex({ expires_at: 1 });
```

## Environment Variables

Consumed by `_test/loader.js` — never read anywhere else.

| Variable | Default (Docker) | Description |
|---|---|---|
| `MONGODB_URI` | `mongodb://localhost:27017` | MongoDB connection URI |
| `MONGODB_DATABASE` | `test_db` | Database name |

## Peer Dependencies

| Package | Purpose |
|---|---|
| `@superloomdev/js-helper-utils` | Type checks |
| `@superloomdev/js-helper-debug` | Structured debug logging |
| `@superloomdev/js-server-helper-nosql-mongodb` | MongoDB driver wrapper (`Lib.MongoDB`) |

## Testing

```bash
cd _test && npm install && npm test
```

Docker lifecycle is fully automatic. `pretest` starts a MongoDB container; `posttest` stops and removes it (containers and volumes only — images are cached). No manual `docker compose up` needed.

`_test/store-contract-suite.js` is a local copy of the shared integration suite maintained by the auth module. It is not fetched from the auth package at test time — this keeps the adapter's test harness self-contained and records which contract version it was built against.

The suite covers:
- Adapter unit tests (Tier 1): store loader config validation, `_id` composite key construction, `prefix` field, `custom_data` native storage, hash-mismatch "not found" behavior, `updateSessionActivity` identity blocklist, upsert immutability, `cleanupExpiredSessions` deleted count
- Full auth lifecycle integration (Tier 3): every public Auth API path driven against the real MongoDB backend via the store contract suite

## License

MIT
