# Schema — js-server-helper-logger-store-postgres

## DDL

`setupNewStore` issues four idempotent DDL statements:

```sql
CREATE TABLE IF NOT EXISTS "action_log" (
  "scope"         VARCHAR(128) NOT NULL DEFAULT '',
  "entity_type"   VARCHAR(64)  NOT NULL,
  "entity_id"     VARCHAR(128) NOT NULL,
  "actor_type"    VARCHAR(64)  NOT NULL,
  "actor_id"      VARCHAR(128) NOT NULL,
  "action"        VARCHAR(128) NOT NULL,
  "data"          TEXT,
  "ip"            VARCHAR(64),
  "user_agent"    TEXT,
  "created_at"    BIGINT       NOT NULL,
  "created_at_ms" BIGINT       NOT NULL,
  "sort_key"      VARCHAR(64)  NOT NULL,
  "expires_at"    BIGINT,
  PRIMARY KEY ("sort_key")
);

CREATE INDEX IF NOT EXISTS "idx_action_log_entity_sort"
  ON "action_log" ("scope", "entity_type", "entity_id", "sort_key");

CREATE INDEX IF NOT EXISTS "idx_action_log_actor_sort"
  ON "action_log" ("scope", "actor_type", "actor_id", "sort_key");

CREATE INDEX IF NOT EXISTS "idx_action_log_expires_at"
  ON "action_log" ("expires_at");
```

The table name and index names are derived from `STORE_CONFIG.table_name` at runtime.

## Column Mapping

| Column | Postgres Type | Nullable | Notes |
|--------|---------------|----------|-------|
| `scope` | `VARCHAR(128)` | No | Namespace. Default `''`. |
| `entity_type` | `VARCHAR(64)` | No | Entity type. |
| `entity_id` | `VARCHAR(128)` | No | Entity identifier. |
| `actor_type` | `VARCHAR(64)` | No | Actor type. |
| `actor_id` | `VARCHAR(128)` | No | Actor identifier. |
| `action` | `VARCHAR(128)` | No | Action name. |
| `data` | `TEXT` | Yes | JSON-serialized payload. |
| `ip` | `VARCHAR(64)` | Yes | IP address (may be encrypted). |
| `user_agent` | `TEXT` | Yes | User-agent string. |
| `created_at` | `BIGINT` | No | Unix epoch seconds. |
| `created_at_ms` | `BIGINT` | No | Unix epoch milliseconds. |
| `sort_key` | `VARCHAR(64)` | No | Primary key. Timestamp-based unique string. |
| `expires_at` | `BIGINT` | Yes | Unix epoch seconds. `NULL` for persistent records. |

## PostgreSQL-Specific Details

### Identifier Quoting

All identifiers are double-quoted (`"col"`). The adapter rejects any `table_name` containing a double-quote.

### BIGINT Coercion

The `pg` driver may return `BIGINT` columns (`created_at`, `created_at_ms`, `expires_at`) as JavaScript strings. The adapter coerces these back to `Number` via `Number(row.col)` in `rowToRecord`.

### `addLog` Idempotency

Uses `INSERT ... ON CONFLICT ("sort_key") DO NOTHING`. Duplicate `sort_key` is silently ignored.

### `data` Column

JSON-serialized TEXT. Parsed back on read. `null` for no payload.

### Index Strategy

- **`idx_<table>_entity_sort`** — compound `(scope, entity_type, entity_id, sort_key)` covering `getLogsByEntity` queries including cursor pagination. Cursor pagination uses `sort_key < ?` with `ORDER BY sort_key DESC`; the planner walks the B-tree backward.
- **`idx_<table>_actor_sort`** — compound `(scope, actor_type, actor_id, sort_key)` covering `getLogsByActor` queries.
- **`idx_<table>_expires_at`** — single column covering `cleanupExpiredLogs` range scan. Not partial (unlike SQLite) — PostgreSQL handles NULL comparisons efficiently via the planner.

## Index Names

Index names follow the pattern `idx_{table_name}_{suffix}`, computed deterministically by `buildCreateIndexSQL(suffix, columns)` from `STORE_CONFIG.table_name`. Suffixes are `entity_sort`, `actor_sort`, `expires_at`.
