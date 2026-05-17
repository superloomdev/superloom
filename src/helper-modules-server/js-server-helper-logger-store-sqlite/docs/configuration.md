# Configuration — js-server-helper-logger-store-sqlite

## Loader Pattern

```js
Lib.Logger = require('@superloomdev/js-server-helper-logger')(Lib, {
  STORE: require('@superloomdev/js-server-helper-logger-store-sqlite'),
  STORE_CONFIG: {
    table_name: 'action_log',
    lib_sql:    Lib.SQLite
  },
  IP_ENCRYPT_KEY: process.env.IP_ENCRYPT_KEY  // optional
});
```

## `STORE_CONFIG` Keys

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `table_name` | `String` | Yes | Name of the log table. Must not contain a double-quote. One table per Logger instance. |
| `lib_sql` | `Object` | Yes | An initialized `Lib.SQLite` instance (`@superloomdev/js-server-helper-sql-sqlite`). |

## Peer Dependencies

| Package | Purpose |
|---------|---------|
| `@superloomdev/js-helper-utils` | Type checks (`getUnixTime`) |
| `@superloomdev/js-helper-debug` | Structured debug logging |
| `@superloomdev/js-server-helper-sql-sqlite` | SQLite driver wrapper (`Lib.SQLite`) |

## Environment Variables

Consumed only by `_test/loader.js` — never read by the adapter itself.

| Variable | Default | Description |
|----------|---------|-------------|
| `SQLITE_FILE` | `':memory:'` | SQLite database file path, or `:memory:` for an ephemeral in-process database |

## Testing Tier

| Tier | Runtime | Notes |
|------|---------|-------|
| Contract + Integration | SQLite (`:memory:`, in-process via `node:sqlite`) | No Docker, no credentials, no network required |

```bash
cd _test && npm install && npm test
```

The test script does not use `pretest`/`posttest` Docker lifecycle hooks because SQLite runs in-process. The entire suite completes with no external dependencies.
