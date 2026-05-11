# Storage Adapters

The logger module works with multiple storage backends. This guide helps you choose and configure the right one for your needs.

---

## Quick Comparison

| Backend | Best For | Native TTL | Docker Required | Complexity |
|---------|----------|------------|-----------------|------------|
| **Memory** | Unit tests only | n/a | No | Lowest |
| **SQLite** | Local dev, embedded, single-node | No | No | Low |
| **PostgreSQL** | Production SQL workloads | No | Yes | Medium |
| **MySQL** | Existing MySQL infrastructure | No | Yes | Medium |
| **MongoDB** | Document-centric patterns | Yes (~60s) | Yes | Medium |
| **DynamoDB** | AWS-native, serverless | Yes (~48h) | Yes | Higher |

---

## Selection Guide

### I want zero setup for testing

Use **Memory** or **SQLite**:

```javascript
// Memory — fastest, data lost on process exit
Lib.Logger = require('@superloomdev/js-server-helper-logger')(Lib, {
  STORE: 'memory',
  STORE_CONFIG: {}
});

// SQLite — file-based, persists across restarts
Lib.Logger = require('@superloomdev/js-server-helper-logger')(Lib, {
  STORE: 'sqlite',
  STORE_CONFIG: {
    table_name: 'action_log',
    lib_sql: Lib.SQLite
  }
});
```

### I have a PostgreSQL database

Use **PostgreSQL**:

```javascript
Lib.Logger = require('@superloomdev/js-server-helper-logger')(Lib, {
  STORE: 'postgres',
  STORE_CONFIG: {
    table_name: 'action_log',
    lib_sql: Lib.Postgres
  }
});
```

Recommended cleanup: EventBridge / cron / `pg_cron` — call `Logger.cleanupExpiredLogs` once per day.

### I am on AWS

Use **DynamoDB** for fully managed, serverless operation:

```javascript
Lib.Logger = require('@superloomdev/js-server-helper-logger')(Lib, {
  STORE: 'dynamodb',
  STORE_CONFIG: {
    table_name: 'action_log',
    lib_dynamodb: Lib.DynamoDB
  },
  IP_ENCRYPT_KEY: process.env.IP_ENCRYPT_KEY  // recommended for compliance
});
```

**Required:** Enable AWS native TTL on `expires_at` column. DynamoDB sweeps within ~48 hours for free.

**IAM permissions needed:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:Query",
        "dynamodb:DeleteItem",
        "dynamodb:BatchWriteItem"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/action_log"
    }
  ]
}
```

---

## Backend-Specific Notes

### SQLite

**Best for:** Local development, embedded systems, single-node deployments.

**Connection setup:**

```javascript
Lib.SQLite = require('@superloomdev/js-server-helper-sql-sqlite')(Lib, {
  FILE: '/var/data/audit.db',  // or ':memory:' for tests
  JOURNAL_MODE: 'WAL'
});
```

**Notes:**
- WAL mode recommended for concurrent read performance
- No native TTL — run `cleanupExpiredLogs` via cron or `setInterval`
- Single-file portability — easy to back up

### PostgreSQL

**Best for:** Production SQL workloads, existing Postgres infrastructure.

**Connection setup:**

```javascript
Lib.Postgres = require('@superloomdev/js-server-helper-sql-postgres')(Lib, {
  HOST: process.env.DB_HOST,
  DATABASE: process.env.DB_NAME,
  USER: process.env.DB_USER,
  PASSWORD: process.env.DB_PASSWORD,
  POOL_MAX: 10
});
```

**Cleanup options:**
- Application cron calling `cleanupExpiredLogs`
- `pg_cron` extension for database-native scheduling
- EventBridge scheduled Lambda (AWS)

### MySQL

**Best for:** Existing MySQL/MariaDB infrastructure.

**Connection setup:** Similar to PostgreSQL, using `js-server-helper-sql-mysql`.

**Cleanup options:**
- Application cron
- MySQL `EVENT` scheduler

### MongoDB

**Best for:** Document-centric patterns, existing MongoDB clusters.

**Connection setup:**

```javascript
Lib.MongoDB = require('@superloomdev/js-server-helper-nosql-mongodb')(Lib, {
  URI: process.env.MONGODB_URI,
  DATABASE: 'audit'
});
```

**TTL:** `setupNewStore` creates a TTL index on `_ttl` (~60 second sweep). Explicit `cleanupExpiredLogs` is the fallback for environments without native TTL enabled.

### DynamoDB

**Best for:** AWS-native, serverless, pay-per-use scaling.

**Connection setup:**

```javascript
Lib.DynamoDB = require('@superloomdev/js-server-helper-nosql-aws-dynamodb')(Lib, {
  REGION: process.env.AWS_REGION || 'us-east-1',
  KEY: process.env.AWS_ACCESS_KEY_ID,
  SECRET: process.env.AWS_SECRET_ACCESS_KEY
});
```

**Schema:** Base table `(entity_pk, sort_key)` with GSI `(actor_pk, sort_key)`. AWS TTL on `expires_at`.

**Key design:**
- `entity_pk`: `"{scope}#{entity_type}#{entity_id}"`
- `actor_pk`: `"{scope}#{actor_type}#{actor_id}"`
- `sort_key`: `"{created_at_ms}-{random}"`

---

## Migration Between Backends

If you need to switch backends:

1. **Dual-write phase:** Write to both old and new backends
2. **Backfill:** Export from old, import to new (respecting `sort_key`)
3. **Switch reads:** Point `listByEntity` / `listByActor` to new backend
4. **Retire old:** Stop writing to old backend after verification period

The `sort_key` field makes this safe — it is deterministic and portable across backends.

---

## Performance Considerations

| Backend | Write Latency | Query Latency | Scalability |
|---------|---------------|---------------|-------------|
| SQLite | < 1ms (local) | < 1ms (local) | Single node |
| PostgreSQL | ~2-5ms | ~2-5ms | Vertical + read replicas |
| MySQL | ~2-5ms | ~2-5ms | Vertical + read replicas |
| MongoDB | ~2-5ms | ~2-5ms | Horizontal (sharding) |
| DynamoDB | ~10-50ms | ~10-50ms | Unlimited (serverless) |

All backends support the same pagination model via `next_cursor`.

---

## Related

- [Data Model](data-model.md) — Record fields explained
- [Integration guides](../README.md) — Express, Lambda patterns
