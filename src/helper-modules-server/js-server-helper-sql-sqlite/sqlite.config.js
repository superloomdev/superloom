// Info: Default configuration for js-server-helper-sqlite.
// Pure defaults — the loader merges overrides on top of this. No process.env access here.
'use strict';


module.exports = {

  // ---- Database location ----
  // Path to the SQLite database file, or ':memory:' for an in-memory DB.
  // In-memory databases live only for the lifetime of the loader instance.
  FILE: ':memory:',

  // ---- Access mode ----
  // When true, the database is opened read-only. Writes will fail.
  READONLY: false,

  // When true, foreign key constraints are enforced (recommended).
  ENABLE_FOREIGN_KEYS: true,

  // ---- Busy handling ----
  // How long SQLite will wait, in milliseconds, when a lock cannot be
  // acquired before returning SQLITE_BUSY. 0 disables the busy handler.
  TIMEOUT_MS: 5000,

  // ---- PRAGMAs applied at open time ----
  // 'DELETE' (default) | 'TRUNCATE' | 'PERSIST' | 'MEMORY' | 'WAL' | 'OFF'
  // WAL is recommended for on-disk databases with concurrent readers.
  // Ignored when FILE is ':memory:' (in-memory DBs force MEMORY).
  JOURNAL_MODE: 'WAL',

  // 'OFF' | 'NORMAL' | 'FULL' | 'EXTRA'
  // 'NORMAL' is a good default for WAL. Use 'FULL' for extra durability
  // at the cost of throughput.
  SYNCHRONOUS: 'NORMAL',

  // ---- Shutdown ----
  // Present for API parity with MySQL / Postgres. SQLite's close() is
  // synchronous, so close() resolves immediately; this value is kept for
  // consistency across SQL backends.
  CLOSE_TIMEOUT_MS: 5000

};
