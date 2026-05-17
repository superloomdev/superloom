# Schema — js-server-helper-logger-store-sqlite

## DDL

`setupNewStore` issues four idempotent DDL statements (built by `_Store.buildDDL()` at `createInterface` time):

```sql
CREATE TABLE IF NOT EXISTS "action_log" (
  "scope"         TEXT    NOT NULL DEFAULT '',
  "entity_type"   TEXT    NOT NULL,
  "entity_id"     TEXT    NOT NULL,
  "actor_type"    TEXT    NOT NULL,
  "actor_id"      TEXT    NOT NULL,
  "action"        TEXT    NOT NULL,
  "data"          TEXT,
  "ip"            TEXT,
  "user_agent"    TEXT,
  "created_at"    INTEGER NOT NULL,
  "created_at_ms" INTEGER NOT NULL,
  "sort_key"      TEXT    NOT NULL,
  "expires_at"    INTEGER,
  PRIMARY KEY ("sort_key")
);

CREATE INDEX IF NOT EXISTS "idx_action_log_entity"
  ON "action_log" ("scope", "entity_type", "entity_id", "sort_key" DESC);

CREATE INDEX IF NOT EXISTS "idx_action_log_actor"
  ON "action_log" ("scope", "actor_type", "actor_id", "sort_key" DESC);

CREATE INDEX IF NOT EXISTS "idx_action_log_expires_at"
  ON "action_log" ("expires_at");
```

The table name and index names are derived from `STORE_CONFIG.table_name` at runtime.

## Column Mapping

| Column | SQLite Type | Nullable | Notes |
|--------|-------------|----------|-------|
| `scope` | `TEXT` | No | Logical namespace. Default `''`. |
| `entity_type` | `TEXT` | No | Entity type (e.g. `'user'`). |
| `entity_id` | `TEXT` | No | Entity identifier. |
| `actor_type` | `TEXT` | No | Actor type (e.g. `'user'`, `'system'`). |
| `actor_id` | `TEXT` | No | Actor identifier. |
| `action` | `TEXT` | No | Action name (e.g. `'auth.login'`). |
| `data` | `TEXT` | Yes | JSON-serialized payload. `null` for no payload. |
| `ip` | `TEXT` | Yes | IP address (may be encrypted if `IP_ENCRYPT_KEY` is set). |
| `user_agent` | `TEXT` | Yes | User-agent string. |
| `created_at` | `INTEGER` | No | Unix epoch seconds. |
| `created_at_ms` | `INTEGER` | No | Unix epoch milliseconds. Used for cursor ordering. |
| `sort_key` | `TEXT` | No | Primary key. Timestamp-based unique string; lexicographic = chronological descending. |
| `expires_at` | `INTEGER` | Yes | Unix epoch seconds. `NULL` for persistent (never-expiring) records. |

## SQLite-Specific Details

### Identifier Quoting

All identifiers are double-quoted (`"col"`). The adapter rejects any `table_name` containing a double-quote at quoting time.

### Primary Key

The sole primary key is `"sort_key"`. Unlike the SQL adapters in the `auth-store-*` family, the logger does not use a composite primary key — `sort_key` alone provides global uniqueness.

### `addLog` Idempotency

`addLog` uses `INSERT ... ON CONFLICT ("sort_key") DO NOTHING`. A duplicate `sort_key` is silently ignored, not an error. This makes log ingestion idempotent — retrying a failed write is always safe.

### `data` Column

`record.data` is serialized to JSON TEXT on write and parsed back on read. Corrupt stored values surface as `null`, not as throws.

### Persistent vs. TTL Records

`expires_at = NULL` marks a persistent record. SQLite indexes `NULL` values; the cleanup query relies on the planner skipping `NULL` rows via the `IS NOT NULL` filter in the `DELETE` WHERE clause.

### Index Strategy

- **`idx_<table>_entity`** — covers `getLogsByEntity` (scope + entity_type + entity_id + sort_key DESC).
- **`idx_<table>_actor`** — covers `getLogsByActor` (scope + actor_type + actor_id + sort_key DESC).
- **`idx_<table>_expires_at`** — single-column index covering the `cleanupExpiredLogs` range scan.

## Index Names

Index names follow the pattern `idx_{table_name}_{suffix}`, computed deterministically from `STORE_CONFIG.table_name` at `createInterface` time. Suffixes are `entity`, `actor`, `expires_at`.
