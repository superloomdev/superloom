# SQLite Local Setup (Offline Testing)

Run the module tests against an in-memory SQLite database. No Docker, no
credentials, no network - the `node:sqlite` built-in driver ships with
Node.js itself.

## Requirements

- Node.js 22.13+ (stable `node:sqlite`) or 24+

## 1. Install and Run

```bash
cd src/helper-modules-server/js-server-helper-sqlite/_test
npm install
npm test
```

By default the tests open an in-memory database. Nothing is persisted.

## 2. (Optional) Test Against a File

Export a file path to exercise on-disk behavior (journal_mode=WAL,
synchronous=NORMAL, etc.):

```bash
export SQLITE_FILE=/tmp/sqlite-test.db
npm test
# Clean up
rm -f /tmp/sqlite-test.db /tmp/sqlite-test.db-wal /tmp/sqlite-test.db-shm
```

Leave `SQLITE_FILE` unset (or set to `:memory:`) for the default in-memory
flow.

## Notes

- The admin/schema setup (`DROP TABLE`, `CREATE TABLE`) is performed via
  the module's own `getClient()` - there's no separate admin server for
  SQLite the way there is for MySQL / Postgres.
- WAL mode is only meaningful for on-disk databases. For `:memory:` the
  loader falls back to `MEMORY` journal mode automatically.
