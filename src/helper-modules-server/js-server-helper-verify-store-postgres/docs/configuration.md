# Configuration — js-server-helper-verify-store-postgres

## Loader Pattern

```js
Lib.Verify = require('@superloomdev/js-server-helper-verify')(Lib, {
  STORE: require('@superloomdev/js-server-helper-verify-store-postgres'),
  STORE_CONFIG: {
    table_name: 'verification_codes',
    lib_sql:    Lib.Postgres
  }
});
```

## `STORE_CONFIG` Keys

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `table_name` | `String` | Yes | Name of the verification table. Must not contain a double-quote. |
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
| `POSTGRES_HOST` | (required) | PostgreSQL host |
| `POSTGRES_PORT` | `5434` | Port (offset from default 5432 to avoid collisions) |
| `POSTGRES_DATABASE` | `test_db` | Database name |
| `POSTGRES_USER` | `test_user` | Username |
| `POSTGRES_PASSWORD` | `test_pw` | Password |

## Testing Tier

| Tier | Runtime | Notes |
|------|---------|-------|
| Contract + Integration | PostgreSQL via Docker | `pretest`/`posttest` manage the Docker lifecycle |

```bash
cd _test && npm install && npm test
```

The `pretest` script runs `docker compose down -v` then `docker compose up -d --wait`. Never start Docker manually before running tests.
