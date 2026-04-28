// Info: Verify storage adapter for SQL backends (Postgres / MySQL / SQLite).
// One adapter, three backends - works because js-server-helper-sql-postgres,
// js-server-helper-sql-mysql, and js-server-helper-sql-sqlite all expose the
// same getRow / write API (`?` value placeholders, `??` identifier placeholders).
// Pass any of those helpers in as Sql and you get a working store.
//
// Schema (one CREATE TABLE works on all three):
//
//   CREATE TABLE verification_codes (
//     scope        VARCHAR(255) NOT NULL,
//     id           VARCHAR(255) NOT NULL,
//     code         VARCHAR(255) NOT NULL,
//     fail_count   INTEGER      NOT NULL DEFAULT 0,
//     created_at   BIGINT       NOT NULL,
//     expires_at   BIGINT       NOT NULL,
//     PRIMARY KEY (scope, id)
//   );
//   CREATE INDEX verification_codes_expires_at_idx ON verification_codes (expires_at);
//
// Composite primary key keeps lookups O(log n).
// Index on `expires_at` makes the cleanup DELETE fast.
'use strict';



/********************************************************************
Build a Verify-compatible storage adapter that talks to a SQL helper.

@param {Object} Sql - Loaded SQL helper instance (Postgres, MySQL, or SQLite)
@param {Object} options - Adapter config
@param {String} options.table - Table name (e.g. 'verification_codes')
@param {String} options.dialect - 'postgres' | 'mysql' | 'sqlite' - selects the upsert syntax

@return {Object} - Store object with getRecord / setRecord / incrementFailCount / deleteRecord
*********************************************************************/
module.exports = function buildSqlAdapter (Sql, options) {

  const table = options.table;
  const dialect = options.dialect;


  // Pre-compute the upsert SQL once - dialects differ in syntax
  const upsertSql = _buildUpsertSql(table, dialect);


  return {

    getRecord: async function (instance, scope, key) {

      // Fetch the four record fields - never select the composite identifier (we have it)
      const result = await Sql.getRow(
        instance,
        'SELECT code, fail_count, created_at, expires_at FROM ?? WHERE scope = ? AND id = ?',
        [table, scope, key]
      );

      // Empty result -> record absent (NOT_FOUND on verify, fresh-create on createPin)
      if (result.success === false) {
        return { success: false, record: null, error: result.error };
      }

      return {
        success: true,
        record: result.row || null,
        error: null
      };

    },


    setRecord: async function (instance, scope, key, record) {

      // Upsert: insert if absent, replace fields if (scope, id) already exists
      const result = await Sql.write(
        instance,
        upsertSql,
        [scope, key, record.code, record.fail_count, record.created_at, record.expires_at]
      );

      return {
        success: result.success,
        error: result.error || null
      };

    },


    incrementFailCount: async function (instance, scope, key) {

      // Atomic increment - safe under concurrent verify attempts on the same record
      const result = await Sql.write(
        instance,
        'UPDATE ?? SET fail_count = fail_count + 1 WHERE scope = ? AND id = ?',
        [table, scope, key]
      );

      return {
        success: result.success,
        error: result.error || null
      };

    },


    deleteRecord: async function (instance, scope, key) {

      const result = await Sql.write(
        instance,
        'DELETE FROM ?? WHERE scope = ? AND id = ?',
        [table, scope, key]
      );

      return {
        success: result.success,
        error: result.error || null
      };

    }

  };

};



/********************************************************************
Compose the upsert SQL for the requested dialect. Each engine has a
different way of saying "insert or update on conflict".

@param {String} table - Table name (interpolated, not parameterised - safe because caller supplies)
@param {String} dialect - 'postgres' | 'mysql' | 'sqlite'

@return {String} - Parameterised SQL with six `?` placeholders (scope, id, code, fail_count, created_at, expires_at)
*********************************************************************/
function _buildUpsertSql (table, dialect) {

  const t = '"' + table + '"';

  if (dialect === 'postgres') {
    return (
      'INSERT INTO ' + t + ' (scope, id, code, fail_count, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?) ' +
      'ON CONFLICT (scope, id) DO UPDATE SET ' +
      'code = EXCLUDED.code, fail_count = EXCLUDED.fail_count, created_at = EXCLUDED.created_at, expires_at = EXCLUDED.expires_at'
    );
  }

  if (dialect === 'mysql') {
    return (
      'INSERT INTO `' + table + '` (scope, id, code, fail_count, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?) ' +
      'ON DUPLICATE KEY UPDATE ' +
      'code = VALUES(code), fail_count = VALUES(fail_count), created_at = VALUES(created_at), expires_at = VALUES(expires_at)'
    );
  }

  if (dialect === 'sqlite') {
    return (
      'INSERT INTO ' + t + ' (scope, id, code, fail_count, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?) ' +
      'ON CONFLICT (scope, id) DO UPDATE SET ' +
      'code = excluded.code, fail_count = excluded.fail_count, created_at = excluded.created_at, expires_at = excluded.expires_at'
    );
  }

  throw new Error('[verify-sql-adapter] Unknown dialect: ' + dialect);

}
