# Configuration — js-server-helper-logger-store-postgres

## Loader Pattern

```js
Lib.Logger = require('@superloomdev/js-server-helper-logger')(Lib, {
  STORE: require('@superloomdev/js-server-helper-logger-store-postgres'),
  STORE_CONFIG: {
    table_name: 'action_log',
    lib_sql:    Lib.Postgres
  },
  IP_ENCRYPT_KEY: process.env.IP_ENCRYPT_KEY  // optional
});
```

## `STORE_CONFIG` Keys

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `table_name` | `String` | Yes | Name of the log table. Must not contain a double-quote. One table per Logger instance. |
| `lib_sql` | `Object` | Yes | An initialized `Lib.Postgres` instance (`@superloomdev/js-server-helper-sql-postgres`). |

## Peer Dependencies

| Package | Purpose |
|---------|---------|
| `@superloomdev/js-helper-utils` | Type checks (`getUnixTime`) |
| `@superloomdev/js-helper-debug` | Structured debug logging |
| `@superloomdev/js-server-helper-sql-postgres` | Postgres driver wrapper (`Lib.Postgres`) |

## Environment Variables

Consumed only by `_test/loader.js` — never read by the adapter itself.

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_HOST` | `127.0.0.1` | PostgreSQL host |
| `POSTGRES_PORT` | `5434` | Port (offset from default 5432 to avoid collisions) |
| `POSTGRES_DATABASE` | `test_db` | Database name |
| `POSTGRES_USER` | `test_user` | Username |
| `POSTGRES_PASSWORD` | `test_pw` | Password |

## Testing Tier

| Tier | Runtime | Notes |
|------|---------|-------|
| Contract + Integration | PostgreSQL via Docker Compose | `pretest`/`posttest` manage the Docker lifecycle |

```bash
cd _test && npm install && npm test
```

The `pretest` script runs `docker compose down -v` then `docker compose up -d --wait`. Never start Docker manually before running tests.
