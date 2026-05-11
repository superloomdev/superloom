# @superloomdev/js-server-helper-logger-store-mongodb

[![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-brightgreen.svg)](https://nodejs.org)

MongoDB store adapter for [`@superloomdev/js-server-helper-logger`](../js-server-helper-logger). Implements the 5-method store contract backed by MongoDB via `@superloomdev/js-server-helper-nosql-mongodb`.

> **Service-dependent.** Tests require a running MongoDB instance. The Docker lifecycle is managed automatically by `npm test` via `pretest`/`posttest` scripts — no manual `docker compose` needed.

## How This Adapter Fits In

The logger module calls this adapter as a factory:

```js
const store = require('@superloomdev/js-server-helper-logger-store-mongodb')(Lib, CONFIG, ERRORS);
```

The adapter receives the full narrowed `Lib` (Utils, Debug, Crypto, Instance), the merged `CONFIG` (from which it extracts `CONFIG.STORE_CONFIG` internally), and the frozen logger `ERRORS` catalog (used verbatim in error envelopes). It returns the 5-method store interface consumed by `logger.js`. The caller never needs to know which backend is active.

This is the standard **adapter factory protocol** shared by all `logger-store-*` packages.

## Install

```bash
npm install @superloomdev/js-server-helper-logger \
            @superloomdev/js-server-helper-logger-store-mongodb \
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
  URI: process.env.MONGODB_URI,
  DATABASE: 'audit'
});

Lib.Logger = require('@superloomdev/js-server-helper-logger')(Lib, {
  STORE: require('@superloomdev/js-server-helper-logger-store-mongodb'),
  STORE_CONFIG: {
    collection_name: 'action_log',
    lib_mongodb:     Lib.MongoDB
  },
  IP_ENCRYPT_KEY: process.env.IP_ENCRYPT_KEY  // optional
});

// Create indexes at boot (idempotent)
await Lib.Logger.setupNewStore(Lib.Instance.initialize());
```

## STORE_CONFIG

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `collection_name` | `String` | Yes | Name of the log collection. One collection per logger instance. |
| `lib_mongodb` | `Object` | Yes | An initialized `Lib.MongoDB` instance (`@superloomdev/js-server-helper-nosql-mongodb`). |

## Schema

`setupNewStore` creates three indexes:

```javascript
// Primary query index: getLogsByEntity
db.action_log.createIndex(
  { entity_pk: 1, sort_key: -1 },
  { name: 'idx_entity_sort' }
);

// Secondary query index: getLogsByActor
db.action_log.createIndex(
  { actor_pk: 1, sort_key: -1 },
  { name: 'idx_actor_sort' }
);

// TTL index: automatic expiration of temporary logs
db.action_log.createIndex(
  { _ttl: 1 },
  { name: 'idx_ttl', expireAfterSeconds: 0 }
);
```

### Document Structure

MongoDB stores the same fields as SQL backends, with computed keys added:

```javascript
{
  _id: "<sort_key>",                    // document ID = sort_key
  entity_pk: "<scope>#<type>#<id>",    // computed compound key
  actor_pk: "<scope>#<type>#<id>",       // computed compound key
  scope: "...",
  entity_type: "...",
  entity_id: "...",
  actor_type: "...",
  actor_id: "...",
  action: "...",
  data: { ... },
  ip: "...",
  user_agent: "...",
  created_at: 1715180412,
  created_at_ms: 1715180412345,
  sort_key: "1715180412345-xqp",
  expires_at: 1722956412,                 // null for persistent rows
  _ttl: ISODate("2024-08-06T12:00:12Z") // Date-typed for TTL index (derived from expires_at)
}
```

### MongoDB-Specific Notes

- **Compound keys** (`entity_pk`, `actor_pk`) enable efficient range queries on the two main access patterns.
- **TTL index** on `_ttl` field — MongoDB automatically deletes documents ~60 seconds after the TTL date passes. Requires `Date` type (not epoch seconds).
- **`_id`** is set to `sort_key` for deterministic document identity across insertions.
- **Indexes** are created idempotently — `createIndex` is a no-op if the index already exists.

## Store Contract

This adapter implements the 5-method contract consumed by `logger.js`:

| Method | Signature | Returns |
|--------|-----------|---------|
| `setupNewStore` | `(instance)` | `{ success, error }` — idempotent index creation |
| `addLog` | `(instance, record)` | `{ success, error }` — persist one log record |
| `getLogsByEntity` | `(instance, query)` | `{ success, records, next_cursor, error }` — "what happened to this entity?" |
| `getLogsByActor` | `(instance, query)` | `{ success, records, next_cursor, error }` — "what did this actor do?" |
| `cleanupExpiredLogs` | `(instance)` | `{ success, deleted_count, error }` — explicit sweep (fallback) |

`getLogsByEntity` and `getLogsByActor` support:
- Cursor-based pagination via `next_cursor`
- Optional action glob filtering (`'auth.*'`)
- Time range filtering (`start_time_ms`, `end_time_ms`)

## Expired Log Cleanup

MongoDB has native TTL via the `_ttl` index. Documents are automatically removed ~60 seconds after the TTL date.

The explicit `cleanupExpiredLogs` function is provided for:
- Deterministic test cleanup
- Environments where TTL is disabled
- Immediate removal needs

```js
// Optional: explicit cleanup (native TTL handles most cases)
const result = await Lib.Logger.cleanupExpiredLogs(Lib.Instance.initialize());
```

## Environment Variables

Consumed by `_test/loader.js` — never read anywhere else.

| Variable | Default (Docker) | Description |
|----------|------------------|-------------|
| `MONGODB_URI` | `mongodb://localhost:27017` | MongoDB connection URI |
| `MONGODB_DATABASE` | `test` | Database name |

## Peer Dependencies

| Package | Purpose |
|---------|---------|
| `@superloomdev/js-helper-utils` | Type checks |
| `@superloomdev/js-helper-debug` | Structured debug logging |
| `@superloomdev/js-server-helper-nosql-mongodb` | MongoDB driver wrapper (`Lib.MongoDB`) |

## Testing

```bash
cd _test && npm install && npm test
```

Docker lifecycle is fully automatic. `pretest` starts a MongoDB 7 container; `posttest` stops and removes it (containers and volumes only — images are cached). No manual `docker compose up` needed.

`_test/store-contract-suite.js` is a local copy of the shared integration suite maintained by the logger module. It is not fetched from the logger package at test time — this keeps the adapter's test harness self-contained and records which contract version it was built against.

The suite covers:
- Adapter unit tests (Tier 1): store loader config validation, compound key generation, TTL index behavior
- Full logger lifecycle integration (Tier 3): every public Logger API path driven against the real MongoDB backend via the store contract suite

## License

MIT
