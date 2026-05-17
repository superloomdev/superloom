# Schema — js-server-helper-verify-store-postgres

## DDL

`setupNewStore` issues two idempotent DDL statements built by `_Store.buildDDL()` at `createInterface` time:

```sql
CREATE TABLE IF NOT EXISTS "verification_codes" (
  "scope"      VARCHAR(255) NOT NULL,
  "id"         VARCHAR(255) NOT NULL,
  "code"       VARCHAR(255) NOT NULL,
  "fail_count" INTEGER      NOT NULL DEFAULT 0,
  "created_at" BIGINT       NOT NULL,
  "expires_at" BIGINT       NOT NULL,
  PRIMARY KEY ("scope", "id")
);

CREATE INDEX IF NOT EXISTS "verification_codes_expires_at_idx"
  ON "verification_codes" ("expires_at");
```

The table name and index name are derived from `STORE_CONFIG.table_name` at runtime.

## Column Mapping

| Column | Postgres Type | Nullable | Notes |
|--------|---------------|----------|-------|
| `scope` | `VARCHAR(255)` | No | Logical namespace. Part of composite PK. |
| `id` | `VARCHAR(255)` | No | Verification key. Part of composite PK. Called `key` in contract; stored as `id`. |
| `code` | `VARCHAR(255)` | No | Hashed or plain verification code. |
| `fail_count` | `INTEGER` | No | Failed attempt count. Default `0`. |
| `created_at` | `BIGINT` | No | Unix epoch seconds. |
| `expires_at` | `BIGINT` | No | Unix epoch seconds. Used by verify-time check and cleanup. |

## PostgreSQL-Specific Details

### Identifier Quoting

All identifiers are double-quoted (`"col"`). The adapter rejects any `table_name` containing a double-quote at quoting time.

### BIGINT Coercion

The `pg` driver may return `BIGINT` columns as JavaScript strings. The verify module performs the necessary coercion when comparing against `instance.time`.

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

`excluded.` is the PostgreSQL pseudo-table holding the proposed values. The primary key columns (`scope`, `id`) are never modified.

### Index Strategy

A single index on `expires_at` supports the `cleanupExpiredRecords` range scan. The composite primary key index covers all single-record access paths (`getRecord`, `setRecord`, `incrementFailCount`, `deleteRecord`).

## Index Name

The index name is `{table_name}_expires_at_idx`, computed deterministically from `STORE_CONFIG.table_name` at `createInterface` time.
