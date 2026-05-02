// Info: Shared SQL store implementation for verify. Postgres, MySQL, and
// SQLite each get a thin wrapper that just sets the `dialect` flag and
// passes through to this factory. Identifier quoting and the upsert
// syntax are the only dialect-specific bits.
//
// Schema (logically identical across all three dialects):
//
//   verification_codes
//     scope        VARCHAR(255) NOT NULL
//     id           VARCHAR(255) NOT NULL
//     code         VARCHAR(255) NOT NULL
//     fail_count   INTEGER      NOT NULL DEFAULT 0
//     created_at   BIGINT       NOT NULL
//     expires_at   BIGINT       NOT NULL
//     PRIMARY KEY (scope, id)
//   INDEX verification_codes_expires_at_idx (expires_at)
//
// Composite primary key keeps lookups O(log n). Index on `expires_at`
// makes cleanup DELETE fast even on large tables.
//
// Zero native TTL on any of the three engines - the verify module's
// `cleanupExpiredRecords` (called from cron / setInterval / EventBridge)
// is the recommended sweep mechanism.
'use strict';


/********************************************************************
SQL store factory. Returns the canonical store interface.

@param {Object} Lib - Dependency container (Utils, Debug)
@param {String} dialect - 'postgres' | 'mysql' | 'sqlite'
@param {Object} store_config - { table_name, lib_sql }

@return {Object} - Store interface
*********************************************************************/
module.exports = function sqlStoreFactory (Lib, dialect, store_config) {

  if (
    Lib.Utils.isNullOrUndefined(store_config) ||
    !Lib.Utils.isObject(store_config)
  ) {
    throw new Error('[js-server-helper-verify] STORE_CONFIG must be an object for ' + dialect);
  }

  if (
    Lib.Utils.isNullOrUndefined(store_config.table_name) ||
    !Lib.Utils.isString(store_config.table_name) ||
    Lib.Utils.isEmptyString(store_config.table_name)
  ) {
    throw new Error('[js-server-helper-verify] STORE_CONFIG.table_name is required for ' + dialect);
  }

  if (Lib.Utils.isNullOrUndefined(store_config.lib_sql)) {
    throw new Error('[js-server-helper-verify] STORE_CONFIG.lib_sql is required for ' + dialect + ' (pass Lib.Postgres / Lib.MySQL / Lib.SQLite)');
  }

  const sql = store_config.lib_sql;
  const t = quoteIdentifier(dialect, store_config.table_name);
  const upsert_sql = buildUpsertSQL(dialect, store_config.table_name);
  const ddl = buildDDL(dialect, store_config.table_name);

  return {


    /********************************************************************
    Idempotent table + index creation. SQLite executes per-statement;
    Postgres and MySQL accept multi-statement batches via the helper.
    *********************************************************************/
    initialize: async function (instance) {

      for (const stmt of ddl) {
        const result = await sql.write(instance, stmt, []);
        if (result.success === false) {
          return { success: false, error: result.error };
        }
      }

      return { success: true, error: null };

    },


    /********************************************************************
    Read by composite primary key. Returns null when absent.
    *********************************************************************/
    getRecord: async function (instance, scope, key) {

      const result = await sql.getRow(
        instance,
        'SELECT code, fail_count, created_at, expires_at FROM ' + t +
        ' WHERE ' + quoteIdentifier(dialect, 'scope') + ' = ?' +
        '   AND ' + quoteIdentifier(dialect, 'id')    + ' = ?',
        [scope, key]
      );

      if (result.success === false) {
        return { success: false, record: null, error: result.error };
      }

      return {
        success: true,
        record: result.row || null,
        error: null
      };

    },


    /********************************************************************
    Upsert. Same six-parameter call across all three dialects; only the
    upsert clause differs.
    *********************************************************************/
    setRecord: async function (instance, scope, key, record) {

      const result = await sql.write(
        instance,
        upsert_sql,
        [scope, key, record.code, record.fail_count, record.created_at, record.expires_at]
      );

      return {
        success: result.success,
        error: result.error || null
      };

    },


    /********************************************************************
    Atomic increment. Safe under concurrent verify attempts.
    *********************************************************************/
    incrementFailCount: async function (instance, scope, key) {

      const result = await sql.write(
        instance,
        'UPDATE ' + t +
        ' SET ' + quoteIdentifier(dialect, 'fail_count') + ' = ' + quoteIdentifier(dialect, 'fail_count') + ' + 1' +
        ' WHERE ' + quoteIdentifier(dialect, 'scope') + ' = ? AND ' + quoteIdentifier(dialect, 'id') + ' = ?',
        [scope, key]
      );

      return {
        success: result.success,
        error: result.error || null
      };

    },


    /********************************************************************
    Idempotent delete (missing row reports success).
    *********************************************************************/
    deleteRecord: async function (instance, scope, key) {

      const result = await sql.write(
        instance,
        'DELETE FROM ' + t + ' WHERE ' +
        quoteIdentifier(dialect, 'scope') + ' = ? AND ' +
        quoteIdentifier(dialect, 'id') + ' = ?',
        [scope, key]
      );

      return {
        success: result.success,
        error: result.error || null
      };

    },


    /********************************************************************
    Bulk delete by `expires_at` predicate. Index-supported.
    *********************************************************************/
    cleanupExpiredRecords: async function (instance) {

      const now = instance.time;

      const result = await sql.write(
        instance,
        'DELETE FROM ' + t + ' WHERE ' + quoteIdentifier(dialect, 'expires_at') + ' < ?',
        [now]
      );

      if (result.success === false) {
        return { success: false, deleted_count: 0, error: result.error };
      }

      return {
        success: true,
        deleted_count: result.affected_rows || 0,
        error: null
      };

    }


  };

};


/********************************************************************
Quote an identifier per the dialect. Postgres/SQLite use double
quotes; MySQL uses backticks.
*********************************************************************/
function quoteIdentifier (dialect, name) {
  if (dialect === 'mysql') {
    return '`' + name + '`';
  }
  return '"' + name + '"';
}


/********************************************************************
Build the dialect-specific upsert. Six placeholders in order:
scope, id, code, fail_count, created_at, expires_at.
*********************************************************************/
function buildUpsertSQL (dialect, table_name) {

  const t = quoteIdentifier(dialect, table_name);
  const cols = [
    quoteIdentifier(dialect, 'scope'),
    quoteIdentifier(dialect, 'id'),
    quoteIdentifier(dialect, 'code'),
    quoteIdentifier(dialect, 'fail_count'),
    quoteIdentifier(dialect, 'created_at'),
    quoteIdentifier(dialect, 'expires_at')
  ].join(', ');

  if (dialect === 'mysql') {
    return (
      'INSERT INTO ' + t + ' (' + cols + ') VALUES (?, ?, ?, ?, ?, ?) ' +
      'ON DUPLICATE KEY UPDATE ' +
      '`code` = VALUES(`code`), `fail_count` = VALUES(`fail_count`), ' +
      '`created_at` = VALUES(`created_at`), `expires_at` = VALUES(`expires_at`)'
    );
  }

  // Postgres + SQLite both speak ON CONFLICT. SQLite calls the row alias
  // `excluded`; Postgres calls it `EXCLUDED` - both lower-case `excluded`
  // works on Postgres too.
  return (
    'INSERT INTO ' + t + ' (' + cols + ') VALUES (?, ?, ?, ?, ?, ?) ' +
    'ON CONFLICT (' + quoteIdentifier(dialect, 'scope') + ', ' + quoteIdentifier(dialect, 'id') + ') DO UPDATE SET ' +
    '"code" = excluded."code", "fail_count" = excluded."fail_count", ' +
    '"created_at" = excluded."created_at", "expires_at" = excluded."expires_at"'
  );

}


/********************************************************************
Build the table + index DDL. Returned as an array of statements so
each store's initialize() can execute them sequentially. CREATE TABLE
IF NOT EXISTS keeps it idempotent on every dialect.

MySQL: index is inlined in CREATE TABLE because MySQL has no
"CREATE INDEX IF NOT EXISTS" prior to 8.0.20 and the inlined form is
universally supported.
*********************************************************************/
function buildDDL (dialect, table_name) {

  const t = quoteIdentifier(dialect, table_name);
  const idx_name = table_name + '_expires_at_idx';

  // Type names: BIGINT exists on all three; VARCHAR(255) is universal.
  const big = (dialect === 'sqlite') ? 'INTEGER' : 'BIGINT';
  const varchar = 'VARCHAR(255)';

  const create_table_columns = [
    '  ' + quoteIdentifier(dialect, 'scope')      + ' ' + varchar + ' NOT NULL',
    '  ' + quoteIdentifier(dialect, 'id')         + ' ' + varchar + ' NOT NULL',
    '  ' + quoteIdentifier(dialect, 'code')       + ' ' + varchar + ' NOT NULL',
    '  ' + quoteIdentifier(dialect, 'fail_count') + ' INTEGER NOT NULL DEFAULT 0',
    '  ' + quoteIdentifier(dialect, 'created_at') + ' ' + big + ' NOT NULL',
    '  ' + quoteIdentifier(dialect, 'expires_at') + ' ' + big + ' NOT NULL',
    '  PRIMARY KEY (' + quoteIdentifier(dialect, 'scope') + ', ' + quoteIdentifier(dialect, 'id') + ')'
  ];

  if (dialect === 'mysql') {
    // Inline the index in CREATE TABLE (the safest cross-version syntax)
    create_table_columns.push(
      '  INDEX ' + quoteIdentifier(dialect, idx_name) +
      ' (' + quoteIdentifier(dialect, 'expires_at') + ')'
    );
    return [
      'CREATE TABLE IF NOT EXISTS ' + t + ' (\n' +
      create_table_columns.join(',\n') + '\n)'
    ];
  }

  // Postgres + SQLite: CREATE TABLE then CREATE INDEX IF NOT EXISTS
  return [
    'CREATE TABLE IF NOT EXISTS ' + t + ' (\n' +
    create_table_columns.join(',\n') + '\n)',
    'CREATE INDEX IF NOT EXISTS ' + quoteIdentifier(dialect, idx_name) +
    ' ON ' + t + ' (' + quoteIdentifier(dialect, 'expires_at') + ')'
  ];

}


// White-box hooks for tests
module.exports._buildDDL = buildDDL;
module.exports._buildUpsertSQL = buildUpsertSQL;
