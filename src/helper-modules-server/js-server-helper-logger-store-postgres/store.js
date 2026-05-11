// Info: Postgres store adapter for js-server-helper-logger. Fully self-contained -
// every DDL statement, INSERT template, query builder, value coercion,
// and identifier-quoting rule in this file is specific to Postgres.
//
// The application injects a ready-to-use Postgres helper via
// STORE_CONFIG.lib_sql (typically Lib.Postgres). This adapter never
// requires `pg` directly - projects not using this store never load
// the driver.
//
// Postgres-specific quirks handled here:
//   - Identifiers are double-quoted ("col").
//   - BIGINT columns (created_at_ms, expires_at, sort_key numeric prefix)
//     may be returned as strings by the pg driver - coerced back to numbers.
//   - Booleans are native BOOLEAN - no INTEGER 0/1 encoding needed.
//   - INSERT uses ON CONFLICT DO NOTHING (log entries are append-only).
//   - CREATE INDEX IF NOT EXISTS is fully supported for all indexes.
//   - json data column stored as TEXT; decoded on read.
//
// Store contract (identical shape across all adapters):
//   - setupNewStore(instance)                  -> { success, error }
//   - addLog(instance, record)                 -> { success, error }
//   - getLogsByEntity(instance, query)         -> { success, records, next_cursor, error }
//   - getLogsByActor(instance, query)          -> { success, records, next_cursor, error }
//   - cleanupExpiredLogs(instance)             -> { success, deleted_count, error }
//
// Postgres has no native TTL; cleanupExpiredLogs (a sweep over the
// expires_at index) is the garbage-collection path. Run on a cron.

'use strict';



/////////////////////////// Module-Loader START ////////////////////////////////

/********************************************************************
Thin loader. Validates STORE_CONFIG via the Validators singleton
then delegates to createInterface. Each call returns an independent
Store instance with its own table_name and lib_sql driver reference.

@param {Object} Lib    - Dependency container (Utils, Debug)
@param {Object} CONFIG - Merged module configuration
@param {Object} ERRORS - Error catalog forwarded from logger.js

@return {Object} - Store interface (5 methods)
*********************************************************************/
module.exports = function loader (Lib, CONFIG, ERRORS) {

  // Load the validators singleton and inject Lib
  const Validators = require('./store.validators')(Lib);

  // Validate STORE_CONFIG - throws on misconfiguration
  Validators.validateConfig(CONFIG.STORE_CONFIG);

  return createInterface(Lib, CONFIG.STORE_CONFIG, ERRORS);

};///////////////////////////// Module-Loader END ///////////////////////////////



/////////////////////////// createInterface START //////////////////////////////

/********************************************************************
Builds the public Store interface for one instance. Public and
private functions all close over the same Lib, STORE_CONFIG, and
ERRORS.

@param {Object} Lib          - Dependency container (Utils, Debug)
@param {Object} STORE_CONFIG - { table_name, lib_sql }
@param {Object} ERRORS       - Error catalog forwarded from logger.js

@return {Object} - Store interface (5 methods)
*********************************************************************/
function createInterface (Lib, STORE_CONFIG, ERRORS) {


  ////////////////////////////// Public Functions START ////////////////////////
  const Store = {


    /********************************************************************
    Create the action_log table and supporting indexes if they do not
    yet exist. Safe to call on every boot (CREATE ... IF NOT EXISTS).

    @param {Object} instance - Request instance

    @return {Promise<Object>} - { success, error }
    *********************************************************************/
    setupNewStore: async function (instance) {

      const create_table_sql = _Store.buildCreateTableSQL();
      const create_idx_entity_sql = _Store.buildCreateIndexSQL('entity_sort', ['scope', 'entity_type', 'entity_id', 'sort_key']);
      const create_idx_actor_sql  = _Store.buildCreateIndexSQL('actor_sort',  ['scope', 'actor_type', 'actor_id', 'sort_key']);
      const create_idx_expires_sql = _Store.buildCreateIndexSQL('expires_at', ['expires_at']);

      const r1 = await STORE_CONFIG.lib_sql.write(instance, create_table_sql, []);
      if (r1.success === false) {
        Lib.Debug.error('logger-store-postgres setupNewStore: create table failed', {
          error: r1.error
        });
        return { success: false, error: ERRORS.SERVICE_UNAVAILABLE };
      }

      const r2 = await STORE_CONFIG.lib_sql.write(instance, create_idx_entity_sql, []);
      if (r2.success === false) {
        Lib.Debug.error('logger-store-postgres setupNewStore: create entity index failed', {
          error: r2.error
        });
        return { success: false, error: ERRORS.SERVICE_UNAVAILABLE };
      }

      const r3 = await STORE_CONFIG.lib_sql.write(instance, create_idx_actor_sql, []);
      if (r3.success === false) {
        Lib.Debug.error('logger-store-postgres setupNewStore: create actor index failed', {
          error: r3.error
        });
        return { success: false, error: ERRORS.SERVICE_UNAVAILABLE };
      }

      const r4 = await STORE_CONFIG.lib_sql.write(instance, create_idx_expires_sql, []);
      if (r4.success === false) {
        Lib.Debug.error('logger-store-postgres setupNewStore: create expires index failed', {
          error: r4.error
        });
        return { success: false, error: ERRORS.SERVICE_UNAVAILABLE };
      }

      return { success: true, error: null };

    },


    /********************************************************************
    Append a single log record. Log entries are immutable - conflicts
    (same sort_key) are silently ignored via ON CONFLICT DO NOTHING.

    @param {Object} instance - Request instance
    @param {Object} record   - Canonical log record from logger.js

    @return {Promise<Object>} - { success, error }
    *********************************************************************/
    addLog: async function (instance, record) {

      const sql = _Store.buildInsertSQL();
      const values = _Store.recordToRow(record);

      const result = await STORE_CONFIG.lib_sql.write(instance, sql, values);

      if (result.success === false) {
        Lib.Debug.error('logger-store-postgres addLog: write failed', {
          error: result.error
        });
        return { success: false, error: ERRORS.SERVICE_UNAVAILABLE };
      }

      return { success: true, error: null };

    },


    /********************************************************************
    List log records for a specific entity, most-recent first.
    Supports optional action filter and cursor-based pagination.

    @param {Object} instance - Request instance
    @param {Object} query    - { scope, entity_type, entity_id, actions?, limit?, cursor? }

    @return {Promise<Object>} - { success, records, next_cursor, error }
    *********************************************************************/
    getLogsByEntity: async function (instance, query) {

      const { sql, values } = _Store.buildEntityQuery(query);

      const result = await STORE_CONFIG.lib_sql.getRows(instance, sql, values);

      if (result.success === false) {
        Lib.Debug.error('logger-store-postgres getLogsByEntity: read failed', {
          error: result.error
        });
        return {
          success: false,
          records: [],
          next_cursor: null,
          error: ERRORS.SERVICE_UNAVAILABLE
        };
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
    Supports cursor-based pagination.

    @param {Object} instance - Request instance
    @param {Object} query    - { scope, actor_type, actor_id, limit?, cursor? }

    @return {Promise<Object>} - { success, records, next_cursor, error }
    *********************************************************************/
    getLogsByActor: async function (instance, query) {

      const { sql, values } = _Store.buildActorQuery(query);

      const result = await STORE_CONFIG.lib_sql.getRows(instance, sql, values);

      if (result.success === false) {
        Lib.Debug.error('logger-store-postgres getLogsByActor: read failed', {
          error: result.error
        });
        return {
          success: false,
          records: [],
          next_cursor: null,
          error: ERRORS.SERVICE_UNAVAILABLE
        };
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
    Delete all rows whose expires_at is not NULL and <= now (seconds).
    The expires_at index makes this a fast range scan.

    @param {Object} instance - Request instance

    @return {Promise<Object>} - { success, deleted_count, error }
    *********************************************************************/
    cleanupExpiredLogs: async function (instance) {

      // Wall-clock time is correct for expiry checks. instance.time drives record
      // ordering but cleanup must use the real clock so TTL rows expire on schedule.
      const now_sec = Lib.Utils.getUnixTime();
      const sql = (
        'DELETE FROM ' + _Store.Q(STORE_CONFIG.table_name) +
        ' WHERE ' + _Store.Q('expires_at') + ' IS NOT NULL' +
        '   AND ' + _Store.Q('expires_at') + ' <= ?'
      );

      const result = await STORE_CONFIG.lib_sql.write(instance, sql, [now_sec]);

      if (result.success === false) {
        Lib.Debug.error('logger-store-postgres cleanupExpiredLogs: delete failed', {
          error: result.error
        });
        return {
          success: false,
          deleted_count: 0,
          error: ERRORS.SERVICE_UNAVAILABLE
        };
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


    // Ordered list of every persisted column (matches INSERT order)
    COLUMNS: [
      'scope',
      'entity_type',
      'entity_id',
      'actor_type',
      'actor_id',
      'action',
      'data',
      'ip',
      'user_agent',
      'created_at',
      'created_at_ms',
      'sort_key',
      'expires_at'
    ],


    // BIGINT columns the pg driver may return as strings
    BIGINT_COLUMNS: ['created_at', 'created_at_ms', 'expires_at'],


    /********************************************************************
    Quote an identifier using Postgres double-quote style. Rejects any
    identifier containing a double-quote.

    @param {String} name - Identifier (table or column)

    @return {String} - Quoted identifier
    *********************************************************************/
    Q: function (name) {

      if (name.indexOf('"') !== -1) {
        throw new Error('[js-server-helper-logger-store-postgres] identifier contains double-quote: ' + name);
      }

      return '"' + name + '"';

    },


    /********************************************************************
    Build the CREATE TABLE DDL.

    @return {String} - DDL statement
    *********************************************************************/
    buildCreateTableSQL: function () {

      const Q = _Store.Q;
      const t = Q(STORE_CONFIG.table_name);

      return (
        'CREATE TABLE IF NOT EXISTS ' + t + ' (' +
          '  ' + Q('scope')        + ' VARCHAR(128) NOT NULL DEFAULT \'\',' +
          '  ' + Q('entity_type')  + ' VARCHAR(64)  NOT NULL,' +
          '  ' + Q('entity_id')    + ' VARCHAR(128) NOT NULL,' +
          '  ' + Q('actor_type')   + ' VARCHAR(64)  NOT NULL,' +
          '  ' + Q('actor_id')     + ' VARCHAR(128) NOT NULL,' +
          '  ' + Q('action')       + ' VARCHAR(128) NOT NULL,' +
          '  ' + Q('data')         + ' TEXT,' +
          '  ' + Q('ip')           + ' VARCHAR(64),' +
          '  ' + Q('user_agent')   + ' TEXT,' +
          '  ' + Q('created_at')   + ' BIGINT       NOT NULL,' +
          '  ' + Q('created_at_ms') + ' BIGINT       NOT NULL,' +
          '  ' + Q('sort_key')     + ' VARCHAR(64)  NOT NULL,' +
          '  ' + Q('expires_at')   + ' BIGINT,' +
          '  PRIMARY KEY (' + Q('sort_key') + ')' +
          ')'
      );

    },


    /********************************************************************
    Build a CREATE INDEX IF NOT EXISTS statement.

    @param {String}   suffix  - Short suffix for the index name
    @param {String[]} columns - Columns to index (ordered)

    @return {String} - DDL statement
    *********************************************************************/
    buildCreateIndexSQL: function (suffix, columns) {

      const Q = _Store.Q;
      const idx_name = 'idx_' + STORE_CONFIG.table_name + '_' + suffix;
      const cols = columns.map(Q).join(', ');

      return (
        'CREATE INDEX IF NOT EXISTS ' + Q(idx_name) +
        ' ON ' + Q(STORE_CONFIG.table_name) + ' (' + cols + ')'
      );

    },


    /********************************************************************
    Build the INSERT SQL. Conflicts on sort_key (PK) are silently
    ignored - log entries are immutable.

    @return {String} - SQL template using ? placeholders
    *********************************************************************/
    buildInsertSQL: function () {

      const Q = _Store.Q;
      const COLUMNS = _Store.COLUMNS;
      const t = Q(STORE_CONFIG.table_name);
      const cols = COLUMNS.map(Q).join(', ');
      const placeholders = COLUMNS.map(function () { return '?'; }).join(', ');

      return (
        'INSERT INTO ' + t + ' (' + cols + ')' +
        ' VALUES (' + placeholders + ')' +
        ' ON CONFLICT (' + Q('sort_key') + ') DO NOTHING'
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
    Convert a canonical record to an ordered array of column values
    ready for the INSERT template.

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
        record.data   !== null && record.data   !== undefined ? JSON.stringify(record.data)   : null,
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
    Coerces BIGINT columns from string to number (pg driver quirk).

    @param {Object} row - Raw database row

    @return {Object} - Canonical log record
    *********************************************************************/
    rowToRecord: function (row) {

      return {
        scope:        row.scope        || '',
        entity_type:  row.entity_type,
        entity_id:    row.entity_id,
        actor_type:   row.actor_type,
        actor_id:     row.actor_id,
        action:       row.action,
        data:         row.data !== null && row.data !== undefined ? JSON.parse(row.data) : null,
        ip:           row.ip           || null,
        user_agent:   row.user_agent   || null,
        created_at:   Number(row.created_at),
        created_at_ms: Number(row.created_at_ms),
        sort_key:     row.sort_key,
        expires_at:   row.expires_at !== null && row.expires_at !== undefined ? Number(row.expires_at) : null
      };

    }


  };////////////////////////////// Private Helpers END /////////////////////////


  return Store;

}////////////////////////////// createInterface END ////////////////////////////
