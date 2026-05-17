# Schema — js-server-helper-verify-store-sqlite

## DDL

`setupNewStore` issues two idempotent DDL statements. The exact SQL is built by `_Store.buildDDL()` at `createInterface` time:

```sql
CREATE TABLE IF NOT EXISTS "verification_codes" (
  "scope"      TEXT    NOT NULL,
  "id"         TEXT    NOT NULL,
  "code"       TEXT    NOT NULL,
  "fail_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" INTEGER NOT NULL,
  "expires_at" INTEGER NOT NULL,
  PRIMARY KEY ("scope", "id")
);

CREATE INDEX IF NOT EXISTS "verification_codes_expires_at_idx"
  ON "verification_codes" ("expires_at");
```

The table name and index name are derived from `STORE_CONFIG.table_name` at runtime. The example above uses the default `'verification_codes'`.

## Column Mapping

| Column | SQLite Type | Nullable | Notes |
|--------|-------------|----------|-------|
| `scope` | `TEXT` | No | Logical namespace (e.g. tenant or app). Part of composite PK. |
| `id` | `TEXT` | No | Specific verification key (e.g. `user:123:email`). Part of composite PK. Called `key` in the store contract; stored as `id`. |
| `code` | `TEXT` | No | The hashed or plain verification code set by the verify module. |
| `fail_count` | `INTEGER` | No | Count of failed attempts. Default `0`. Incremented atomically. |
| `created_at` | `INTEGER` | No | Unix epoch seconds. Set by the verify module on creation. |
| `expires_at` | `INTEGER` | No | Unix epoch seconds. Used by both the verify-time check and `cleanupExpiredRecords`. |

## SQLite-Specific Details

### Identifier Quoting

All identifiers (table name and column names) are double-quoted (`"col"`), which is the SQL-standard quoting style and is shared with PostgreSQL. The adapter rejects any `table_name` containing a double-quote at quoting time to prevent DDL injection.

### Type Affinity

SQLite has no separate `BIGINT` or `VARCHAR` type enforcement. Columns declared as `TEXT` store any text string; columns declared as `INTEGER` store any integer. The schema expresses intent; SQLite does not enforce length constraints.

`expires_at` and `created_at` are stored as Unix epoch seconds (INTEGER). No coercion is needed on read — `node:sqlite` returns INTEGER values as native JavaScript Numbers.

### Primary Key

The composite primary key is `("scope", "id")`. Both columns are part of the table-level `PRIMARY KEY` declaration. SQLite creates a unique B-tree index on this pair automatically.

### UPSERT Semantics

`setRecord` uses:

```sql
INSERT INTO "verification_codes"
  ("scope", "id", "code", "fail_count", "created_at", "expires_at")
VALUES (?, ?, ?, ?, ?, ?)
ON CONFLICT ("scope", "id") DO UPDATE SET
  "code"       = excluded."code",
  "fail_count" = excluded."fail_count",
  "created_at" = excluded."created_at",
  "expires_at" = excluded."expires_at"
```

`excluded.` refers to the pseudo-table holding the values that would have been inserted. All mutable columns are updated; the primary key columns (`scope`, `id`) are never modified by the `DO UPDATE` clause.

This syntax requires SQLite 3.24+ (2018), which is available everywhere `node:sqlite` ships.

### Index Strategy

A single index on `expires_at` supports the `cleanupExpiredRecords` range scan. There is no partial index (unlike the existing README description — the actual `buildDDL()` in `store.js` does not emit a `WHERE` clause on the index).

The entity access path (`getRecord`, `setRecord`, `incrementFailCount`, `deleteRecord`) uses the composite primary key index — no secondary index needed.

## Index Name

The index name is `{table_name}_expires_at_idx`. It is computed deterministically from `STORE_CONFIG.table_name` at `createInterface` time. Changing `table_name` after the initial setup creates a new table and a new index name; it does not rename the existing index.
