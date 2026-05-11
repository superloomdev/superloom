# @superloomdev/js-server-helper-auth-store-sqlite

[![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-brightgreen.svg)](https://nodejs.org)

SQLite session store adapter for [`@superloomdev/js-server-helper-auth`](../js-server-helper-auth). Implements the 8-method store contract backed by SQLite via the built-in Node.js `node:sqlite` module (no native add-ons, no Docker).

> **Offline / embedded.** Suitable for development, testing, embedded single-process applications, and CLI tools. For production deployments under concurrent load, use the Postgres, MySQL, or MongoDB adapter.

## How This Adapter Fits In

The auth module calls this adapter as a factory:

```js
const store = require('@superloomdev/js-server-helper-auth-store-sqlite')(Lib, CONFIG, ERRORS);
```

The adapter receives the full narrowed `Lib` (Utils, Debug, Crypto, Instance), the merged `CONFIG` (from which it extracts `CONFIG.STORE_CONFIG` internally), and the frozen auth `ERRORS` catalog (used verbatim in error envelopes). It returns the 8-method store interface consumed by `auth.js`. The caller — `auth.js` — never needs to know which backend is active.

This is the standard **adapter factory protocol** shared by all `auth-store-*` packages.

## Install

```bash
npm install @superloomdev/js-server-helper-auth \
            @superloomdev/js-server-helper-auth-store-sqlite \
            @superloomdev/js-server-helper-sql-sqlite
```

## Usage

Pass the adapter factory directly to `STORE`. Pass the `Lib.SQLite` instance in `STORE_CONFIG`.

```js
const Lib = {};
Lib.Utils    = require('@superloomdev/js-helper-utils')(Lib, {});
Lib.Debug    = require('@superloomdev/js-helper-debug')(Lib, {});
Lib.Crypto   = require('@superloomdev/js-server-helper-crypto')(Lib, {});
Lib.Instance = require('@superloomdev/js-server-helper-instance')(Lib, {});

Lib.SQLite = require('@superloomdev/js-server-helper-sql-sqlite')(Lib, {
  FILE: '/var/data/sessions.db'    // or ':memory:' for tests
});

Lib.AuthUser = require('@superloomdev/js-server-helper-auth')(Lib, {
  STORE: require('@superloomdev/js-server-helper-auth-store-sqlite'),
  STORE_CONFIG: {
    table_name: 'sessions_user',
    lib_sql:    Lib.SQLite
  },
  ACTOR_TYPE:  'user',
  TTL_SECONDS: 2592000
});

// Create table + index at boot (idempotent)
await Lib.AuthUser.setupNewStore(Lib.Instance.initialize());
```

## STORE_CONFIG

| Key | Type | Required | Description |
|---|---|---|---|
| `table_name` | `String` | Yes | Name of the sessions table. Use one table per `actor_type` (e.g. `sessions_user`, `sessions_admin`). |
| `lib_sql` | `Object` | Yes | An initialized `Lib.SQLite` instance (`@superloomdev/js-server-helper-sql-sqlite`). |

## Schema

`setupNewStore` issues two idempotent DDL statements:

```sql
CREATE TABLE IF NOT EXISTS "sessions_user" (
  "tenant_id"           TEXT NOT NULL,
  "actor_id"            TEXT NOT NULL,
  "actor_type"          TEXT NOT NULL,
  "token_key"           TEXT NOT NULL,
  "token_secret_hash"   TEXT NOT NULL,
  "refresh_token_hash"  TEXT,
  "refresh_family_id"   TEXT,
  "created_at"          INTEGER NOT NULL,
  "expires_at"          INTEGER NOT NULL,
  "last_active_at"      INTEGER NOT NULL,
  "install_id"          TEXT,
  "install_platform"    TEXT NOT NULL,
  "install_form_factor" TEXT NOT NULL,
  "client_name"         TEXT,
  "client_version"      TEXT,
  "client_is_browser"   INTEGER NOT NULL DEFAULT 0,
  "client_os_name"      TEXT,
  "client_os_version"   TEXT,
  "client_screen_w"     INTEGER,
  "client_screen_h"     INTEGER,
  "client_ip_address"   TEXT,
  "client_user_agent"   TEXT,
  "push_provider"       TEXT,
  "push_token"          TEXT,
  "custom_data"         TEXT,
  PRIMARY KEY ("tenant_id", "actor_id", "token_key")
);

CREATE INDEX IF NOT EXISTS "idx_sessions_user_expires_at"
  ON "sessions_user" ("expires_at");
```

### SQLite-Specific Notes

- **Booleans** (`client_is_browser`) are stored as `INTEGER 0/1`. Coerced on both write and read.
- **Timestamps** (`created_at`, `expires_at`, `last_active_at`) are `INTEGER` Unix epoch seconds.
- **`custom_data`** is serialized as a JSON string in the `TEXT` column and parsed back on read.
- **`node:sqlite`** (Node.js 22.5+) is used — no external `better-sqlite3` or `sqlite3` dependency.
- There are no column length constraints; `TEXT` columns accept any length. The column declarations document intent, not enforcement.
- `UPSERT` uses `ON CONFLICT ... DO UPDATE SET col = excluded.col` (SQLite 3.24+, available in every Node.js version that ships `node:sqlite`).
- `CREATE INDEX IF NOT EXISTS` is fully supported and idempotent.

## Store Contract

This adapter implements the 8-method contract consumed by `auth.js`:

| Method | Signature | Returns |
|---|---|---|
| `setupNewStore` | `(instance)` | `{ success, error }` |
| `getSession` | `(instance, tenant_id, actor_id, token_key, token_secret_hash)` | `{ success, record, error }` |
| `listSessionsByActor` | `(instance, tenant_id, actor_id)` | `{ success, records, error }` |
| `setSession` | `(instance, record)` | `{ success, error }` |
| `updateSessionActivity` | `(instance, tenant_id, actor_id, token_key, updates)` | `{ success, error }` |
| `deleteSession` | `(instance, tenant_id, actor_id, token_key)` | `{ success, error }` |
| `deleteSessions` | `(instance, tenant_id, keys)` | `{ success, error }` |
| `cleanupExpiredSessions` | `(instance)` | `{ success, deleted_count, error }` |

`getSession` checks `token_secret_hash` after the primary key read. A wrong secret returns `{ record: null }` — identical to a missing row — to prevent timing-based enumeration.

`updateSessionActivity` throws `TypeError` if `updates` contains any identity or primary-key field (`tenant_id`, `actor_id`, `actor_type`, `token_key`, `token_secret_hash`, `created_at`, `install_id`, `install_platform`, `install_form_factor`). This is a programmer-error guard; `auth.js` never passes those fields.

`cleanupExpiredSessions` deletes all rows where `expires_at < instance.time`. Uses the `expires_at` index for an efficient range scan.

## Expired Session Cleanup

SQLite has no native TTL. Run `cleanupExpiredSessions` on a cron:

```js
// Example: run cleanup every hour
setInterval(async function () {
  const result = await Lib.AuthUser.cleanupExpiredSessions(Lib.Instance.initialize());
  if (result.success) {
    Lib.Debug.info('Cleanup deleted ' + result.deleted_count + ' expired sessions');
  }
}, 3600 * 1000);
```

## Peer Dependencies

| Package | Purpose |
|---|---|
| `@superloomdev/js-helper-utils` | Type checks |
| `@superloomdev/js-helper-debug` | Structured debug logging |
| `@superloomdev/js-server-helper-sql-sqlite` | SQLite driver wrapper (`Lib.SQLite`) |

## Testing

No Docker required — tests run fully in-process using a `:memory:` SQLite database.

```bash
cd _test && npm install && npm test
```

`_test/store-contract-suite.js` is a local copy of the shared integration suite maintained by the auth module. It is not fetched from the auth package at test time — this keeps the adapter's test harness self-contained and records which contract version it was built against.

The suite covers:
- Adapter unit tests (Tier 1): store loader config validation, identifier quoting, boolean and `custom_data` coercions, hash-mismatch "not found" behavior, `updateSessionActivity` identity blocklist, upsert immutability, `cleanupExpiredSessions` deleted count
- Full auth lifecycle integration (Tier 3): every public Auth API path driven against the real SQLite backend via the store contract suite

## License

MIT
