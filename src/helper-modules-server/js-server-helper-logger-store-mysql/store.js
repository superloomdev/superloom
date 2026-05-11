// Info: MySQL store adapter for js-server-helper-logger. Fully self-contained -
// every DDL statement, INSERT template, query builder, value coercion,
// and identifier-quoting rule in this file is specific to MySQL.
//
// The application injects a ready-to-use MySQL helper via
// STORE_CONFIG.lib_sql (typically Lib.MySQL). This adapter never
// requires `mysql2` directly.
//
// MySQL-specific quirks handled here:
//   - Identifiers are backtick-quoted (`col`).
//   - BIGINT columns may be returned as strings by mysql2 driver - coerced back.
//   - MySQL CREATE INDEX IF NOT EXISTS requires: CREATE INDEX IF NOT EXISTS name ON table (col)
//   - INSERT uses ON DUPLICATE KEY UPDATE id=id (no-op) for idempotency on PK.
//   - json data column stored as TEXT; decoded on read.
//
// Store contract (identical shape across all adapters):
//   - setupNewStore(instance)                  -> { success, error }
//   - addLog(instance, record)                 -> { success, error }
//   - getLogsByEntity(instance, query)         -> { success, records, next_cursor, error }
//   - getLogsByActor(instance, query)          -> { success, records, next_cursor, error }
//   - cleanupExpiredLogs(instance)             -> { success, deleted_count, error }

'use strict';



/////////////////////////// Module-Loader START ////////////////////////////////

/********************************************************************
@param {Object} Lib    - Dependency container (Utils, Debug)
@param {Object} CONFIG - Merged module configuration
@param {Object} ERRORS - Error catalog forwarded from logger.js

@return {Object} - Store interface (5 methods)
*********************************************************************/
module.exports = function loader (Lib, CONFIG, ERRORS) {

  const Validators = require('./store.validators')(Lib);
  Validators.validateConfig(CONFIG.STORE_CONFIG);
  return createInterface(Lib, CONFIG.STORE_CONFIG, ERRORS);

};///////////////////////////// Module-Loader END ///////////////////////////////



/////////////////////////// createInterface START //////////////////////////////

/********************************************************************
@param {Object} Lib          - Dependency container (Utils, Debug)
@param {Object} STORE_CONFIG - { table_name, lib_sql }
@param {Object} ERRORS       - Error catalog forwarded from logger.js

@return {Object} - Store interface (5 methods)
*********************************************************************/
function createInterface (Lib, STORE_CONFIG, ERRORS) {


  ////////////////////////////// Public Functions START ////////////////////////
  const Store = {


    /********************************************************************
    Create table and indexes. Safe to call on every boot (IF NOT EXISTS).

    @param {Object} instance - Request instance

    @return {Promise<Object>} - { success, error }
    *********************************************************************/
    setupNewStore: async function (instance) {

      // MySQL has no CREATE INDEX IF NOT EXISTS, so all indexes are inlined
      // into CREATE TABLE. A single idempotent statement handles both.
      const result = await STORE_CONFIG.lib_sql.write(instance, _Store.buildCreateTableSQL(), []);
      if (result.success === false) {
        Lib.Debug.error('logger-store-mysql setupNewStore: CREATE TABLE failed', { error: result.error });
        return { success: false, error: ERRORS.SERVICE_UNAVAILABLE };
      }

      return { success: true, error: null };

    },


    /********************************************************************
    Append a single log record. PK conflict silently ignored.

    @param {Object} instance - Request instance
    @param {Object} record   - Canonical log record from logger.js

    @return {Promise<Object>} - { success, error }
    *********************************************************************/
    addLog: async function (instance, record) {

      const sql = _Store.buildInsertSQL();
      const values = _Store.recordToRow(record);

      const result = await STORE_CONFIG.lib_sql.write(instance, sql, values);

      if (result.success === false) {
        Lib.Debug.error('logger-store-mysql addLog: write failed', { error: result.error });
        return { success: false, error: ERRORS.SERVICE_UNAVAILABLE };
      }

      return { success: true, error: null };

    },


    /********************************************************************
    List log records for a specific entity, most-recent first.

    @param {Object} instance - Request instance
    @param {Object} query    - { scope, entity_type, entity_id, actions?, limit?, cursor? }

    @return {Promise<Object>} - { success, records, next_cursor, error }
    *********************************************************************/
    getLogsByEntity: async function (instance, query) {

      const { sql, values } = _Store.buildEntityQuery(query);
      const result = await STORE_CONFIG.lib_sql.getRows(instance, sql, values);

      if (result.success === false) {
        Lib.Debug.error('logger-store-mysql getLogsByEntity: read failed', { error: result.error });
        return { success: false, records: [], next_cursor: null, error: ERRORS.SERVICE_UNAVAILABLE };
      }

      const limit = query.limit || _Store.DEFAULT_LIMIT;
      const rows = result.rows || [];
      const has_more = rows.length > limit;
      const page = has_more ? rows.slice(0, limit) : rows;

      return {
        success: true,
        records: page.map(_Store.rowToRecord),
        next_cursor: has_more ? page[page.length - 1].sort_key : null,
        error: null
      };

    },


    /********************************************************************
    List log records for a specific actor, most-recent first.

    @param {Object} instance - Request instance
    @param {Object} query    - { scope, actor_type, actor_id, limit?, cursor? }

    @return {Promise<Object>} - { success, records, next_cursor, error }
    *********************************************************************/
    getLogsByActor: async function (instance, query) {

      const { sql, values } = _Store.buildActorQuery(query);
      const result = await STORE_CONFIG.lib_sql.getRows(instance, sql, values);

      if (result.success === false) {
        Lib.Debug.error('logger-store-mysql getLogsByActor: read failed', { error: result.error });
        return { success: false, records: [], next_cursor: null, error: ERRORS.SERVICE_UNAVAILABLE };
      }

      const limit = query.limit || _Store.DEFAULT_LIMIT;
      const rows = result.rows || [];
      const has_more = rows.length > limit;
      const page = has_more ? rows.slice(0, limit) : rows;

      return {
        success: true,
        records: page.map(_Store.rowToRecord),
        next_cursor: has_more ? page[page.length - 1].sort_key : null,
        error: null
      };

    },


    /********************************************************************
    Delete all rows with expires_at <= now (seconds).

    @param {Object} instance - Request instance

    @return {Promise<Object>} - { success, deleted_count, error }
    *********************************************************************/
    cleanupExpiredLogs: async function (instance) {

      const now_sec = Lib.Utils.getUnixTime();
      const sql = (
        'DELETE FROM ' + _Store.Q(STORE_CONFIG.table_name) +
        ' WHERE ' + _Store.Q('expires_at') + ' IS NOT NULL' +
        '   AND ' + _Store.Q('expires_at') + ' <= ?'
      );

      const result = await STORE_CONFIG.lib_sql.write(instance, sql, [now_sec]);

      if (result.success === false) {
        Lib.Debug.error('logger-store-mysql cleanupExpiredLogs: delete failed', { error: result.error });
        return { success: false, deleted_count: 0, error: ERRORS.SERVICE_UNAVAILABLE };
      }

      return {
        success: true,
        deleted_count: result.affected_rows || 0,
        error: null
      };

    }


  };////////////////////////////// Public Functions END ////////////////////////



  ////////////////////////////// Private Helpers START /////////////////////////
  const _Store = {


    DEFAULT_LIMIT: 50,


    COLUMNS: [
      'scope', 'entity_type', 'entity_id',
      'actor_type', 'actor_id', 'action',
      'data', 'ip', 'user_agent',
      'created_at', 'created_at_ms', 'sort_key', 'expires_at'
    ],


    /********************************************************************
    Quote an identifier using MySQL backtick style.

    @param {String} name - Identifier (table or column)

    @return {String} - Quoted identifier
    *********************************************************************/
    Q: function (name) {

      if (name.indexOf('`') !== -1) {
        throw new Error('[js-server-helper-logger-store-mysql] identifier contains backtick: ' + name);
      }

      return '`' + name + '`';

    },


    /********************************************************************
    Build the CREATE TABLE DDL.

    @return {String} - DDL statement
    *********************************************************************/
    buildCreateTableSQL: function () {

      const Q = _Store.Q;
      const t = Q(STORE_CONFIG.table_name);
      const tn = STORE_CONFIG.table_name;

      // All indexes are inlined because MySQL does not support CREATE INDEX IF NOT EXISTS.
      // Inlining makes the single CREATE TABLE IF NOT EXISTS statement fully idempotent.
      return (
        'CREATE TABLE IF NOT EXISTS ' + t + ' (' +
          '  ' + Q('scope')         + ' VARCHAR(128) NOT NULL DEFAULT \'\',' +
          '  ' + Q('entity_type')   + ' VARCHAR(64)  NOT NULL,' +
          '  ' + Q('entity_id')     + ' VARCHAR(128) NOT NULL,' +
          '  ' + Q('actor_type')    + ' VARCHAR(64)  NOT NULL,' +
          '  ' + Q('actor_id')      + ' VARCHAR(128) NOT NULL,' +
          '  ' + Q('action')        + ' VARCHAR(128) NOT NULL,' +
          '  ' + Q('data')          + ' TEXT,' +
          '  ' + Q('ip')            + ' VARCHAR(64),' +
          '  ' + Q('user_agent')    + ' TEXT,' +
          '  ' + Q('created_at')    + ' BIGINT       NOT NULL,' +
          '  ' + Q('created_at_ms') + ' BIGINT       NOT NULL,' +
          '  ' + Q('sort_key')      + ' VARCHAR(64)  NOT NULL,' +
          '  ' + Q('expires_at')    + ' BIGINT,' +
          '  PRIMARY KEY (' + Q('sort_key') + '),' +
          '  INDEX ' + Q('idx_' + tn + '_entity_sort') + ' (' + Q('scope') + ', ' + Q('entity_type') + ', ' + Q('entity_id') + ', ' + Q('sort_key') + '),' +
          '  INDEX ' + Q('idx_' + tn + '_actor_sort')  + ' (' + Q('scope') + ', ' + Q('actor_type')  + ', ' + Q('actor_id')  + ', ' + Q('sort_key') + '),' +
          '  INDEX ' + Q('idx_' + tn + '_expires_at')  + ' (' + Q('expires_at') + ')' +
          ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
      );

    },


    /********************************************************************
    Build the INSERT SQL. Conflicts on sort_key (PK) are silently
    ignored via ON DUPLICATE KEY UPDATE.

    @return {String} - SQL template using ? placeholders
    *********************************************************************/
    buildInsertSQL: function () {

      const Q = _Store.Q;
      const COLUMNS = _Store.COLUMNS;
      const t = Q(STORE_CONFIG.table_name);
      const cols = COLUMNS.map(Q).join(', ');
      const placeholders = COLUMNS.map(function () { return '?'; }).join(', ');

      // MySQL idempotent insert: ON DUPLICATE KEY UPDATE sort_key = sort_key is a no-op
      return (
        'INSERT INTO ' + t + ' (' + cols + ')' +
        ' VALUES (' + placeholders + ')' +
        ' ON DUPLICATE KEY UPDATE ' + Q('sort_key') + ' = ' + Q('sort_key')
      );

    },


    /********************************************************************
    Build the SELECT SQL for entity-scoped log queries.

    @param {Object} query - { scope, entity_type, entity_id, actions?, limit?, cursor? }

    @return {Object} - { sql, values }
    *********************************************************************/
    buildEntityQuery: function (query) {

      const Q = _Store.Q;
      const t = Q(STORE_CONFIG.table_name);
      const limit = (query.limit || _Store.DEFAULT_LIMIT) + 1;
      const values = [];

      let sql = 'SELECT * FROM ' + t + ' WHERE ';
      sql += Q('scope') + ' = ?'; values.push(query.scope || '');
      sql += ' AND ' + Q('entity_type') + ' = ?'; values.push(query.entity_type);
      sql += ' AND ' + Q('entity_id') + ' = ?'; values.push(query.entity_id);

      if (query.actions && query.actions.length > 0) {
        const placeholders = query.actions.map(function () { return '?'; }).join(', ');
        sql += ' AND ' + Q('action') + ' IN (' + placeholders + ')';
        query.actions.forEach(function (a) { values.push(a); });
      }

      if (query.cursor) {
        sql += ' AND ' + Q('sort_key') + ' < ?'; values.push(query.cursor);
      }

      sql += ' ORDER BY ' + Q('sort_key') + ' DESC';
      sql += ' LIMIT ?'; values.push(limit);

      return { sql: sql, values: values };

    },


    /********************************************************************
    Build the SELECT SQL for actor-scoped log queries.

    @param {Object} query - { scope, actor_type, actor_id, limit?, cursor? }

    @return {Object} - { sql, values }
    *********************************************************************/
    buildActorQuery: function (query) {

      const Q = _Store.Q;
      const t = Q(STORE_CONFIG.table_name);
      const limit = (query.limit || _Store.DEFAULT_LIMIT) + 1;
      const values = [];

      let sql = 'SELECT * FROM ' + t + ' WHERE ';
      sql += Q('scope') + ' = ?'; values.push(query.scope || '');
      sql += ' AND ' + Q('actor_type') + ' = ?'; values.push(query.actor_type);
      sql += ' AND ' + Q('actor_id') + ' = ?'; values.push(query.actor_id);

      if (query.cursor) {
        sql += ' AND ' + Q('sort_key') + ' < ?'; values.push(query.cursor);
      }

      sql += ' ORDER BY ' + Q('sort_key') + ' DESC';
      sql += ' LIMIT ?'; values.push(limit);

      return { sql: sql, values: values };

    },


    /********************************************************************
    Convert a canonical record to an ordered array of column values.

    @param {Object} record - Canonical log record

    @return {Array} - Ordered values array
    *********************************************************************/
    recordToRow: function (record) {

      return [
        record.scope        || '',
        record.entity_type,
        record.entity_id,
        record.actor_type,
        record.actor_id,
        record.action,
        record.data !== null && record.data !== undefined ? JSON.stringify(record.data) : null,
        record.ip,
        record.user_agent,
        record.created_at,
        record.created_at_ms,
        record.sort_key,
        record.expires_at !== undefined ? record.expires_at : null
      ];

    },


    /********************************************************************
    Convert a database row back to a canonical record object.
    Coerces BIGINT columns from string to number (mysql2 driver quirk).

    @param {Object} row - Raw database row

    @return {Object} - Canonical log record
    *********************************************************************/
    rowToRecord: function (row) {

      return {
        scope:         row.scope        || '',
        entity_type:   row.entity_type,
        entity_id:     row.entity_id,
        actor_type:    row.actor_type,
        actor_id:      row.actor_id,
        action:        row.action,
        data:          row.data !== null && row.data !== undefined ? JSON.parse(row.data) : null,
        ip:            row.ip           || null,
        user_agent:    row.user_agent   || null,
        created_at:    Number(row.created_at),
        created_at_ms: Number(row.created_at_ms),
        sort_key:      row.sort_key,
        expires_at:    row.expires_at !== null && row.expires_at !== undefined ? Number(row.expires_at) : null
      };

    }


  };////////////////////////////// Private Helpers END /////////////////////////


  return Store;

}////////////////////////////// createInterface END ////////////////////////////
