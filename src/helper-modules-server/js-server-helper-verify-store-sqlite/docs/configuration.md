# Configuration — js-server-helper-verify-store-sqlite

## Loader Pattern

The adapter is passed to the Verify parent as a factory reference, not a constructed instance:

```js
Lib.Verify = require('@superloomdev/js-server-helper-verify')(Lib, {
  STORE: require('@superloomdev/js-server-helper-verify-store-sqlite'),
  STORE_CONFIG: {
    table_name: 'verification_codes',
    lib_sql:    Lib.SQLite
  }
});
```

The Verify parent calls the factory with `(Lib, CONFIG, ERRORS)` at initialization time. The adapter reads `CONFIG.STORE_CONFIG` and throws an `Error` on misconfiguration before any database call is made.

## `STORE_CONFIG` Keys

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `table_name` | `String` | Yes | Name of the verification table. Must not contain a double-quote. One table per Verify instance. |
| `lib_sql` | `Object` | Yes | An initialized `Lib.SQLite` instance (`@superloomdev/js-server-helper-sql-sqlite`). |

The validator rejects missing, null, or empty-string values for both keys. The `table_name` double-quote guard fires at quoting time (first DDL or query call), not at validation time.

## Peer Dependencies

| Package | Purpose |
|---------|---------|
| `@superloomdev/js-helper-utils` | Type checks (`getUnixTime`) |
| `@superloomdev/js-helper-debug` | Structured debug logging |
| `@superloomdev/js-server-helper-sql-sqlite` | SQLite driver wrapper (`Lib.SQLite`) |

These are loaded into `Lib` by the application before the Verify parent is initialized. The adapter accesses them through `Lib`; it does not `require` them directly.

## Environment Variables

Consumed only by `_test/loader.js` — never read by the adapter itself.

| Variable | Default | Description |
|----------|---------|-------------|
| `SQLITE_FILE` | `':memory:'` | SQLite database file path, or `:memory:` for an ephemeral in-process database |

## Testing Tier

| Tier | Runtime | Notes |
|------|---------|-------|
| Contract + Integration | SQLite (`:memory:`, in-process via `node:sqlite`) | No Docker, no credentials, no network required |

Run tests from `_test/`:

```bash
cd _test && npm install && npm test
```

The test script does not use `pretest`/`posttest` Docker lifecycle hooks because SQLite runs in-process. The entire suite completes with no external dependencies.
