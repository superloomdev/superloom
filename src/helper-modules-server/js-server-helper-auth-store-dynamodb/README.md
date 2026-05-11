# @superloomdev/js-server-helper-auth-store-dynamodb

[![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-brightgreen.svg)](https://nodejs.org)

AWS DynamoDB session store adapter for [`@superloomdev/js-server-helper-auth`](../js-server-helper-auth). Implements the 8-method store contract backed by DynamoDB via `@superloomdev/js-server-helper-nosql-aws-dynamodb`.

> **Service-dependent.** Tests run against a local DynamoDB emulator (via Docker). The Docker lifecycle is managed automatically by `npm test` via `pretest`/`posttest` scripts — no manual `docker compose` needed.

> **Table must be provisioned out-of-band.** `setupNewStore` is not implemented — the DynamoDB table must be created via IaC, AWS Console, or a one-shot script before the auth module is used.

## How This Adapter Fits In

The auth module calls this adapter as a factory:

```js
const store = require('@superloomdev/js-server-helper-auth-store-dynamodb')(Lib, CONFIG, ERRORS);
```

The adapter receives the full narrowed `Lib` (Utils, Debug, Crypto, Instance), the merged `CONFIG` (from which it extracts `CONFIG.STORE_CONFIG` internally), and the frozen auth `ERRORS` catalog (used verbatim in error envelopes). It returns the 8-method store interface consumed by `auth.js`. The caller — `auth.js` — never needs to know which backend is active.

This is the standard **adapter factory protocol** shared by all `auth-store-*` packages.

## Install

```bash
npm install @superloomdev/js-server-helper-auth \
            @superloomdev/js-server-helper-auth-store-dynamodb \
            @superloomdev/js-server-helper-nosql-aws-dynamodb
```

## Usage

Pass the adapter factory to `STORE`. Pass the `Lib.DynamoDB` instance in `STORE_CONFIG`.

```js
const Lib = {};
Lib.Utils    = require('@superloomdev/js-helper-utils')(Lib, {});
Lib.Debug    = require('@superloomdev/js-helper-debug')(Lib, {});
Lib.Crypto   = require('@superloomdev/js-server-helper-crypto')(Lib, {});
Lib.Instance = require('@superloomdev/js-server-helper-instance')(Lib, {});

Lib.DynamoDB = require('@superloomdev/js-server-helper-nosql-aws-dynamodb')(Lib, {
  REGION: process.env.AWS_REGION
});

Lib.AuthUser = require('@superloomdev/js-server-helper-auth')(Lib, {
  STORE: require('@superloomdev/js-server-helper-auth-store-dynamodb'),
  STORE_CONFIG: {
    table_name:   'sessions_user',
    lib_dynamodb: Lib.DynamoDB
  },
  ACTOR_TYPE:  'user',
  TTL_SECONDS: 2592000
});
```

> **No `setupNewStore` call needed.** Provision the table out-of-band (see [Table Provisioning](#table-provisioning) below).

## STORE_CONFIG

| Key | Type | Required | Description |
|---|---|---|---|
| `table_name` | `String` | Yes | Name of the DynamoDB table. Use one table per `actor_type` (e.g. `sessions_user`, `sessions_admin`), or use a single shared table with `actor_type` as a key discriminator if your workload requires it. |
| `lib_dynamodb` | `Object` | Yes | An initialized `Lib.DynamoDB` instance (`@superloomdev/js-server-helper-nosql-aws-dynamodb`). |

## Table Design

This adapter uses a **single-table design** tuned for the auth query patterns:

| Key | Type | Value |
|---|---|---|
| Partition Key (`PK`) | `String` | `tenant_id` |
| Sort Key (`SK`) | `String` | `"{actor_id}#{token_key}"` |

This layout ensures every hot-path query is a direct index hit — no GSI required:

| Operation | DynamoDB call | Access pattern |
|---|---|---|
| `getSession(t, a, k, h)` | `GetItem` | PK=`t`, SK=`a#k` |
| `listSessionsByActor(t, a)` | `Query` | PK=`t`, SK begins_with `"a#"` |
| `setSession(record)` | `PutItem` | PK=`t`, SK=`a#k` |
| `deleteSession(t, a, k)` | `DeleteItem` | PK=`t`, SK=`a#k` |
| `deleteSessions(t, keys)` | `BatchWriteItem` | PK=`t`, SK per key |
| `cleanupExpiredSessions` | `Scan` with `FilterExpression` | `expires_at < now` |

The `token_secret_hash` is stored as a regular attribute (not part of the Sort Key), so the `(tenant_id, actor_id, token_key)` triple remains unique regardless of secret rotation.

### DynamoDB-Specific Notes

- **`setupNewStore` is not implemented** — returns `{ success: false, error: { type: 'NOT_IMPLEMENTED' } }`. Provision the table via IaC before use.
- **Timestamps** (`created_at`, `expires_at`, `last_active_at`) are stored as `Number` (Unix epoch seconds), not as ISO strings. All adapters use the same epoch seconds convention.
- **`client_is_browser`** is stored as a DynamoDB `BOOL` attribute.
- **`custom_data`** is stored as a DynamoDB `M` (Map) attribute — no JSON serialization needed. `null` custom_data is omitted from the item entirely and returns as `null` on read.
- **LRU eviction and install-id replacement** both use `listSessionsByActor` + client-side filtering, matching the pattern of the SQL and MongoDB adapters.
- **`cleanupExpiredSessions`** performs a table Scan with a `FilterExpression` on `expires_at`. This is an O(table-size) operation. For large tables, enable DynamoDB native TTL instead (see below).

## Table Provisioning

Provision before using the auth module. Example CloudFormation / CDK skeleton:

```yaml
# CloudFormation snippet
SessionsUserTable:
  Type: AWS::DynamoDB::Table
  Properties:
    TableName: sessions_user
    BillingMode: PAY_PER_REQUEST
    AttributeDefinitions:
      - AttributeName: tenant_id
        AttributeType: S
      - AttributeName: actor_id_token_key
        AttributeType: S
    KeySchema:
      - AttributeName: tenant_id
        KeyType: HASH
      - AttributeName: actor_id_token_key
        KeyType: RANGE
    # Optional: enable native TTL (see below)
    TimeToLiveSpecification:
      AttributeName: expires_at
      Enabled: true
```

> **Important:** The Sort Key attribute name in the CloudFormation definition must match the key name used by the adapter (`actor_id_token_key` or the equivalent that concatenates `actor_id#token_key`). Check the adapter source (`store.js`) for the exact SK attribute name used.

## Native TTL (Optional)

DynamoDB supports automatic item expiry via TTL. When enabled, DynamoDB deletes items whose `expires_at` epoch value is in the past — typically within 48 hours of expiry.

To enable: set `TimeToLiveSpecification.AttributeName` to `expires_at` on the table (out-of-band, via IaC or AWS Console). Once enabled, there is no need to run `cleanupExpiredSessions` for garbage collection. You may still run it for immediate consistency if needed.

**Caveats:**
- Native TTL deletion is **eventually consistent** — expired items can remain visible for up to 48 hours.
- `cleanupExpiredSessions` performs an immediate hard delete and respects the exact epoch boundary; native TTL does not.
- `verifySession` always checks `expires_at` at the application layer regardless of TTL configuration, so expired-but-not-yet-deleted items are correctly rejected.

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

`getSession` performs a `GetItem` then compares `token_secret_hash`. A wrong secret returns `{ record: null }` — identical to a missing item — to prevent timing-based enumeration.

`updateSessionActivity` throws `TypeError` if `updates` contains any identity field. It issues an `UpdateItem` with an `UpdateExpression` covering only the supplied mutable fields.

`deleteSessions` uses `BatchWriteItem` to delete all keys in one request (DynamoDB batch limit of 25 items per call; the adapter handles chunking automatically if needed).

## Expired Session Cleanup

If not using native DynamoDB TTL, run `cleanupExpiredSessions` on a cron:

```js
setInterval(async function () {
  const result = await Lib.AuthUser.cleanupExpiredSessions(Lib.Instance.initialize());
  if (result.success) {
    Lib.Debug.info('Cleanup deleted ' + result.deleted_count + ' expired sessions');
  }
}, 3600 * 1000);
```

## Environment Variables

Consumed by `_test/loader.js` — never read anywhere else.

| Variable | Default (Docker emulator) | Description |
|---|---|---|
| `AWS_REGION` | `us-east-1` | AWS region |
| `AWS_ACCESS_KEY_ID` | `local` | Dummy credential for local emulator |
| `AWS_SECRET_ACCESS_KEY` | `local` | Dummy credential for local emulator |
| `DYNAMODB_ENDPOINT` | `http://localhost:8000` | Override endpoint for local emulator |

## Peer Dependencies

| Package | Purpose |
|---|---|
| `@superloomdev/js-helper-utils` | Type checks |
| `@superloomdev/js-helper-debug` | Structured debug logging |
| `@superloomdev/js-server-helper-nosql-aws-dynamodb` | DynamoDB driver wrapper (`Lib.DynamoDB`) |

## Testing

```bash
cd _test && npm install && npm test
```

Docker lifecycle is fully automatic. `pretest` starts a `amazon/dynamodb-local` emulator container; `posttest` stops and removes it. No manual `docker compose up` needed. Dummy AWS credentials (`local`/`local`) are set in the `npm test` script — no real AWS account required.

`_test/store-contract-suite.js` is a local copy of the shared integration suite maintained by the auth module. It is not fetched from the auth package at test time — this keeps the adapter's test harness self-contained and records which contract version it was built against.

The suite covers:
- Adapter unit tests (Tier 1): store loader config validation, PK/SK construction, `custom_data` native Map storage, hash-mismatch "not found" behavior, `updateSessionActivity` identity blocklist, upsert immutability, `cleanupExpiredSessions` deleted count
- Full auth lifecycle integration (Tier 3): every public Auth API path driven against the real DynamoDB emulator via the store contract suite

## License

MIT
