# Configuration — js-server-helper-verify-store-mysql

## Loader Pattern

```js
Lib.Verify = require('@superloomdev/js-server-helper-verify')(Lib, {
  STORE: require('@superloomdev/js-server-helper-verify-store-mysql'),
  STORE_CONFIG: {
    table_name: 'verification_codes',
    lib_sql:    Lib.MySQL
  }
});
```

## `STORE_CONFIG` Keys

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `table_name` | `String` | Yes | Name of the verification table. Must not contain a backtick. |
| `lib_sql` | `Object` | Yes | An initialized `Lib.MySQL` instance (`@superloomdev/js-server-helper-sql-mysql`). |

## Peer Dependencies

| Package | Purpose |
|---------|---------|
| `@superloomdev/js-helper-utils` | Type checks (`getUnixTime`) |
| `@superloomdev/js-helper-debug` | Structured debug logging |
| `@superloomdev/js-server-helper-sql-mysql` | MySQL driver wrapper (`Lib.MySQL`) |

## Environment Variables

Consumed only by `_test/loader.js` — never read by the adapter itself.

| Variable | Default | Description |
|----------|---------|-------------|
| `MYSQL_HOST` | `127.0.0.1` | MySQL host |
| `MYSQL_PORT` | `3308` | Port (offset from default 3306 to avoid collisions) |
| `MYSQL_DATABASE` | `test_db` | Database name |
| `MYSQL_USER` | `test_user` | Username |
| `MYSQL_PASSWORD` | `test_pw` | Password |

## Testing Tier

| Tier | Runtime | Notes |
|------|---------|-------|
| Contract + Integration | MySQL via Docker Compose | `pretest`/`posttest` manage the Docker lifecycle |

```bash
cd _test && npm install && npm test
```

The `pretest` script runs `docker compose down -v` then `docker compose up -d --wait`. Never start Docker manually before running tests.
