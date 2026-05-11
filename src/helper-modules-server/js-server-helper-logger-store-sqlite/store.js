// Info: SQLite store adapter for js-server-helper-logger. Fully self-contained -
// every DDL statement, INSERT template, query, value coercion, and
// identifier-quoting rule in this file is specific to SQLite.
// No cross-dialect parameterisation, no shared SQL helper module.
//
// The application injects a ready-to-use SQLite helper via
// STORE_CONFIG.lib_sql (typically Lib.SQLite). This adapter never
// requires `node:sqlite` directly - projects not using this store
// never load the driver.
//
// SQLite-specific quirks handled here:
//   - Identifiers are double-quoted ("col"), same as Postgres.
//   - SQLite has no BIGINT / VARCHAR length enforcement - every
//     text column is declared as TEXT and every integer column
//     as INTEGER. Schema documents intent, not constraints.
//   - NULL vs 0 for expires_at: NULL means persistent, INTEGER means TTL.
//   - data column: serialized as JSON TEXT on write, parsed on read.
//   - Cursor pagination uses sort_key (ms-xxx) ordered DESC.
//
// Store contract (identical shape across all adapters):
//   - setupNewStore(instance)           -> { success, error }
//   - addLog(instance, record)          -> { success, error }
//   - getLogsByEntity(instance, query)  -> { success, records, next_cursor, error }
//   - getLogsByActor(instance, query)   -> { success, records, next_cursor, error }
//   - cleanupExpiredLogs(instance)      -> { success, deleted_count, error }

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
ERRORS. _Store (private helpers) is defined after Store (public
methods) and is referenced by the public methods via the closure -
the same pattern used across all helper modules.

@param {Object} Lib          - Dependency container (Utils, Debug)
@param {Object} STORE_CONFIG - { table_name, lib_sql }
@param {Object} ERRORS       - Error catalog forwarded from logger.js

@return {Object} - Store interface
*********************************************************************/
const createInterface = function (Lib, STORE_CONFIG, ERRORS) {

  ////////////////////////////// Public Functions START ////////////////////////
  const Store = {


    // ~~~~~~~~~~~~~~~~~~~~ Schema Setup ~~~~~~~~~~~~~~~~~~~~

    /********************************************************************
    Idempotent table + index setup. Creates the logs table and two
    covering indexes if they do not exist. Safe to call on every boot.

    @param {Object} instance - Request instance

    @return {Promise<Object>} - { success, error }
    *********************************************************************/
    setupNewStore: async function (instance) {

      // Create table
      const table_stmt = _Store.buildCreateTableSQL();
      const table_result = await STORE_CONFIG.lib_sql.write(instance, table_stmt);

      // Return a service error if the table creation failed
      if (table_result.success === false) {
        Lib.Debug.debug('Logger sqlite setupNewStore (CREATE TABLE) failed', {
          type: ERRORS.SERVICE_UNAVAILABLE.type,
          driver_type: table_result.error && table_result.error.type,
          driver_message: table_result.error && table_result.error.message
        });
        return {
          success: false,
          error: ERRORS.SERVICE_UNAVAILABLE
        };
      }

      // Create entity index (scope + entity_type + entity_id + sort_key)
      const entity_idx = _Store.buildCreateEntityIndexSQL();
      const entity_result = await STORE_CONFIG.lib_sql.write(instance, entity_idx);

      if (entity_result.success === false) {
        Lib.Debug.debug('Logger sqlite setupNewStore (entity index) failed', {
          type: ERRORS.SERVICE_UNAVAILABLE.type,
          driver_type: entity_result.error && entity_result.error.type,
          driver_message: entity_result.error && entity_result.error.message
        });
        return {
          success: false,
          error: ERRORS.SERVICE_UNAVAILABLE
        };
      }

      // Create actor index (scope + actor_type + actor_id + sort_key)
      const actor_idx = _Store.buildCreateActorIndexSQL();
      const actor_result = await STORE_CONFIG.lib_sql.write(instance, actor_idx);

      if (actor_result.success === false) {
        Lib.Debug.debug('Logger sqlite setupNewStore (actor index) failed', {
          type: ERRORS.SERVICE_UNAVAILABLE.type,
          driver_type: actor_result.error && actor_result.error.type,
          driver_message: actor_result.error && actor_result.error.message
        });
        return {
          success: false,
          error: ERRORS.SERVICE_UNAVAILABLE
        };
      }

      // Create expires_at index for cleanup scans
      const ttl_idx = _Store.buildCreateTTLIndexSQL();
      const ttl_result = await STORE_CONFIG.lib_sql.write(instance, ttl_idx);

      if (ttl_result.success === false) {
        Lib.Debug.debug('Logger sqlite setupNewStore (ttl index) failed', {
          type: ERRORS.SERVICE_UNAVAILABLE.type,
          driver_type: ttl_result.error && ttl_result.error.type,
          driver_message: ttl_result.error && ttl_result.error.message
        });
        return {
          success: false,
          error: ERRORS.SERVICE_UNAVAILABLE
        };
      }

      // Report success - table and indexes are ready
      return {
        success: true,
        error: null
      };

    },


    // ~~~~~~~~~~~~~~~~~~~~ Write ~~~~~~~~~~~~~~~~~~~~

    /********************************************************************
    Insert one log record. Uses a simple INSERT (no UPSERT needed -
    sort_key is unique per event).

    @param {Object} instance - Request instance
    @param {Object} record   - Canonical log record from logger.js

    @return {Promise<Object>} - { success, error }
    *********************************************************************/
    addLog: async function (instance, record) {

      const params = _Store.recordToRow(record);
      const result = await STORE_CONFIG.lib_sql.write(instance, insert_sql, params);

      // Return a service error if the insert failed
      if (result.success === false) {
        Lib.Debug.debug('Logger sqlite addLog failed', {
          type: ERRORS.SERVICE_UNAVAILABLE.type,
          driver_type: result.error && result.error.type,
          driver_message: result.error && result.error.message
        });
        return {
          success: false,
          error: ERRORS.SERVICE_UNAVAILABLE
        };
      }

      return {
        success: true,
        error: null
      };

    },


    // ~~~~~~~~~~~~~~~~~~~~ Read ~~~~~~~~~~~~~~~~~~~~

    /********************************************************************
    List log records for a (scope, entity_type, entity_id) triple.
    Results are ordered most-recent first by sort_key DESC.
    Supports cursor pagination, action filter, and time range.

    @param {Object} instance - Request instance
    @param {Object} query    - Built by logger.js#buildQuery

    @return {Promise<Object>} - { success, records, next_cursor, error }
    *********************************************************************/
    getLogsByEntity: async function (instance, query) {

      const { sql, params } = _Store.buildListSQL('entity', query);
      const result = await STORE_CONFIG.lib_sql.getRows(instance, sql, params);

      // Return a service error if the query failed
      if (result.success === false) {
        Lib.Debug.debug('Logger sqlite getLogsByEntity failed', {
          type: ERRORS.SERVICE_UNAVAILABLE.type,
          driver_type: result.error && result.error.type,
          driver_message: result.error && result.error.message
        });
        return {
          success: false,
          records: [],
          next_cursor: null,
          error: ERRORS.SERVICE_UNAVAILABLE
        };
      }

      // Decode rows and resolve the next cursor
      const limit = query.limit || 50;
      const rows = result.rows;
      const has_more = rows.length > limit;
      const page = has_more ? rows.slice(0, limit) : rows;
      const next_cursor = has_more ? page[page.length - 1].sort_key : null;

      return {
        success: true,
        records: page.map(function (row) { return _Store.rowToRecord(row); }),
        next_cursor: next_cursor,
        error: null
      };

    },


    /********************************************************************
    List log records for a (scope, actor_type, actor_id) triple.
    Same pagination contract as getLogsByEntity.

    @param {Object} instance - Request instance
    @param {Object} query    - Built by logger.js#buildQuery

    @return {Promise<Object>} - { success, records, next_cursor, error }
    *********************************************************************/
    getLogsByActor: async function (instance, query) {

      const { sql, params } = _Store.buildListSQL('actor', query);
      const result = await STORE_CONFIG.lib_sql.getRows(instance, sql, params);

      // Return a service error if the query failed
      if (result.success === false) {
        Lib.Debug.debug('Logger sqlite getLogsByActor failed', {
          type: ERRORS.SERVICE_UNAVAILABLE.type,
          driver_type: result.error && result.error.type,
          driver_message: result.error && result.error.message
        });
        return {
          success: false,
          records: [],
          next_cursor: null,
          error: ERRORS.SERVICE_UNAVAILABLE
        };
      }

      // Decode rows and resolve the next cursor
      const limit = query.limit || 50;
      const rows = result.rows;
      const has_more = rows.length > limit;
      const page = has_more ? rows.slice(0, limit) : rows;
      const next_cursor = has_more ? page[page.length - 1].sort_key : null;

      return {
        success: true,
        records: page.map(function (row) { return _Store.rowToRecord(row); }),
        next_cursor: next_cursor,
        error: null
      };

    },


    // ~~~~~~~~~~~~~~~~~~~~ Cleanup ~~~~~~~~~~~~~~~~~~~~

    /********************************************************************
    Delete all rows whose expires_at is not NULL and <= now (seconds).
    The expires_at index makes this a fast range scan.

    @param {Object} instance - Request instance

    @return {Promise<Object>} - { success, deleted_count, error }
    *********************************************************************/
    cleanupExpiredLogs: async function (instance) {

      // Wall-clock time is correct for expiry checks. instance.time drives record
      // ordering but cleanup must use the real clock so TTL rows expire on schedule.
      // Tier 1 tests that need deterministic cleanup pass a fixed expires_at value
      // and then call this method after the real clock has advanced past it.
      const now_sec = Lib.Utils.getUnixTime();
      const sql = (
        'DELETE FROM ' + _Store.Q(STORE_CONFIG.table_name) +
        ' WHERE ' + _Store.Q('expires_at') + ' IS NOT NULL' +
        '   AND ' + _Store.Q('expires_at') + ' <= ?'
      );

      const result = await STORE_CONFIG.lib_sql.write(instance, sql, [now_sec]);

      // Return a service error if the delete failed
      if (result.success === false) {
        Lib.Debug.debug('Logger sqlite cleanupExpiredLogs failed', {
          type: ERRORS.SERVICE_UNAVAILABLE.type,
          driver_type: result.error && result.error.type,
          driver_message: result.error && result.error.message
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



  ////////////////////////////// Private Helpers START ///////////////////////
  const _Store = {


    /********************************************************************
    The ordered list of columns for INSERT statements. Must match the
    CREATE TABLE column order.
    *********************************************************************/
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


    /********************************************************************
    Quote an identifier using SQLite double-quote style. Rejects any
    identifier containing a double-quote to prevent DDL injection.

    @param {String} name - Identifier (table or column)

    @return {String} - Quoted identifier
    *********************************************************************/
    Q: function (name) {

      // Reject identifiers that would break the double-quote escaping
      if (name.indexOf('"') !== -1) {
        throw new Error('[js-server-helper-logger-store-sqlite] identifier contains double-quote: ' + name);
      }

      // Wrap in SQLite double-quote style
      return '"' + name + '"';

    },


    /********************************************************************
    Build the CREATE TABLE statement. Idempotent via IF NOT EXISTS.

    @return {String} - DDL statement
    *********************************************************************/
    buildCreateTableSQL: function () {

      const Q = _Store.Q;
      const t = Q(STORE_CONFIG.table_name);

      return (
        'CREATE TABLE IF NOT EXISTS ' + t + ' (' +
          '  ' + Q('scope')         + ' TEXT NOT NULL DEFAULT \'\',' +
          '  ' + Q('entity_type')   + ' TEXT NOT NULL,' +
          '  ' + Q('entity_id')     + ' TEXT NOT NULL,' +
          '  ' + Q('actor_type')    + ' TEXT NOT NULL,' +
          '  ' + Q('actor_id')      + ' TEXT NOT NULL,' +
          '  ' + Q('action')        + ' TEXT NOT NULL,' +
          '  ' + Q('data')          + ' TEXT,' +
          '  ' + Q('ip')            + ' TEXT,' +
          '  ' + Q('user_agent')    + ' TEXT,' +
          '  ' + Q('created_at')    + ' INTEGER NOT NULL,' +
          '  ' + Q('created_at_ms') + ' INTEGER NOT NULL,' +
          '  ' + Q('sort_key')      + ' TEXT NOT NULL,' +
          '  ' + Q('expires_at')    + ' INTEGER,' +
          '  PRIMARY KEY (' + Q('sort_key') + ')' +
          ')'
      );

    },


    /********************************************************************
    Build the entity covering index for getLogsByEntity queries.
    Columns: scope + entity_type + entity_id + sort_key DESC.

    @return {String} - DDL statement
    *********************************************************************/
    buildCreateEntityIndexSQL: function () {

      const Q = _Store.Q;
      const t = STORE_CONFIG.table_name;
      const idx = Q('idx_' + t + '_entity');

      return (
        'CREATE INDEX IF NOT EXISTS ' + idx +
        ' ON ' + Q(t) + ' (' +
          Q('scope') + ', ' +
          Q('entity_type') + ', ' +
          Q('entity_id') + ', ' +
          Q('sort_key') + ' DESC' +
        ')'
      );

    },


    /********************************************************************
    Build the actor covering index for getLogsByActor queries.
    Columns: scope + actor_type + actor_id + sort_key DESC.

    @return {String} - DDL statement
    *********************************************************************/
    buildCreateActorIndexSQL: function () {

      const Q = _Store.Q;
      const t = STORE_CONFIG.table_name;
      const idx = Q('idx_' + t + '_actor');

      return (
        'CREATE INDEX IF NOT EXISTS ' + idx +
        ' ON ' + Q(t) + ' (' +
          Q('scope') + ', ' +
          Q('actor_type') + ', ' +
          Q('actor_id') + ', ' +
          Q('sort_key') + ' DESC' +
        ')'
      );

    },


    /********************************************************************
    Build the TTL index for cleanupExpiredLogs range scans.

    @return {String} - DDL statement
    *********************************************************************/
    buildCreateTTLIndexSQL: function () {

      const Q = _Store.Q;
      const t = STORE_CONFIG.table_name;
      const idx = Q('idx_' + t + '_expires_at');

      return (
        'CREATE INDEX IF NOT EXISTS ' + idx +
        ' ON ' + Q(t) + ' (' + Q('expires_at') + ')'
      );

    },


    /********************************************************************
    Build the INSERT statement.

    @return {String} - SQL with positional ? placeholders
    *********************************************************************/
    buildInsertSQL: function () {

      const Q = _Store.Q;
      const t = Q(STORE_CONFIG.table_name);
      const cols = _Store.COLUMNS.map(Q).join(', ');
      const placeholders = _Store.COLUMNS.map(function () { return '?'; }).join(', ');

      return 'INSERT INTO ' + t + ' (' + cols + ') VALUES (' + placeholders + ')';

    },


    /********************************************************************
    Build a SELECT statement for getLogsByEntity or getLogsByActor.
    Returns { sql, params } ready to pass to lib_sql.getRows.
    Fetches limit+1 rows so the caller can detect the next page.

    @param {String} mode  - 'entity' | 'actor'
    @param {Object} query - Logger query object

    @return {Object} - { sql, params }
    *********************************************************************/
    buildListSQL: function (mode, query) {

      const Q = _Store.Q;
      const t = Q(STORE_CONFIG.table_name);
      const parts = [];
      const params = [];

      // Always filter by scope
      parts.push(Q('scope') + ' = ?');
      params.push(query.scope || '');

      // Key filter depends on mode
      if (mode === 'entity') {
        parts.push(Q('entity_type') + ' = ?');
        params.push(query.entity_type);
        parts.push(Q('entity_id') + ' = ?');
        params.push(query.entity_id);
      } else {
        parts.push(Q('actor_type') + ' = ?');
        params.push(query.actor_type);
        parts.push(Q('actor_id') + ' = ?');
        params.push(query.actor_id);
      }

      // Optional action filter (IN list)
      if (query.actions && query.actions.length > 0) {
        const placeholders = query.actions.map(function () { return '?'; }).join(', ');
        parts.push(Q('action') + ' IN (' + placeholders + ')');
        for (let i = 0; i < query.actions.length; i++) {
          params.push(query.actions[i]);
        }
      }

      // Optional time range on created_at_ms
      if (query.start_time_ms !== null && query.start_time_ms !== undefined) {
        parts.push(Q('created_at_ms') + ' >= ?');
        params.push(query.start_time_ms);
      }
      if (query.end_time_ms !== null && query.end_time_ms !== undefined) {
        parts.push(Q('created_at_ms') + ' <= ?');
        params.push(query.end_time_ms);
      }

      // Cursor: sort_key < cursor means "older than this page"
      if (query.cursor) {
        parts.push(Q('sort_key') + ' < ?');
        params.push(query.cursor);
      }

      // Fetch one extra row to detect if there is a next page
      const limit = (query.limit || 50) + 1;

      const sql = (
        'SELECT * FROM ' + t +
        ' WHERE ' + parts.join(' AND ') +
        ' ORDER BY ' + Q('sort_key') + ' DESC' +
        ' LIMIT ' + limit
      );

      return {
        sql: sql,
        params: params
      };

    },


    /********************************************************************
    Encode a canonical record value for a parameterized INSERT.

    @param {String} col   - Column name
    @param {*}      value - Canonical record value

    @return {*} - DB-safe value
    *********************************************************************/
    toColumnValue: function (col, value) {

      // Map undefined to null so it is never sent to the driver
      if (value === undefined) {
        return null;
      }

      // Serialize structured data as a JSON string
      if (col === 'data') {
        if (value === null) {
          return null;
        }
        return JSON.stringify(value);
      }

      return value;

    },


    /********************************************************************
    Decode a raw row value into its canonical record shape.

    @param {String} col   - Column name
    @param {*}      value - Raw DB value

    @return {*} - Canonical value
    *********************************************************************/
    fromColumnValue: function (col, value) {

      // Return null for missing columns
      if (value === undefined || value === null) {
        return null;
      }

      // Parse the JSON envelope back to a structured object
      if (col === 'data') {
        if (typeof value === 'string') {
          try {
            return JSON.parse(value);
          } catch (err) { // eslint-disable-line no-unused-vars
            return null;
          }
        }
        return value;
      }

      return value;

    },


    /********************************************************************
    Canonical record -> positional values array, aligned with COLUMNS.

    @param {Object} record - Canonical log record

    @return {Array} - Positional values for parameterized INSERT
    *********************************************************************/
    recordToRow: function (record) {

      // Map each column name to its encoded DB value in declaration order
      return _Store.COLUMNS.map(function (col) {
        return _Store.toColumnValue(col, record[col]);
      });

    },


    /********************************************************************
    Raw row object -> canonical record.

    @param {Object} row - Raw row from SQLite driver

    @return {Object} - Canonical log record
    *********************************************************************/
    rowToRecord: function (row) {

      // Decode each raw column value into its canonical type
      const record = {};
      for (let i = 0; i < _Store.COLUMNS.length; i++) {
        const col = _Store.COLUMNS[i];
        record[col] = _Store.fromColumnValue(col, row[col]);
      }
      return record;

    }

  };////////////////////////////// Private Helpers END ///////////////////////


  // Precompute the INSERT statement once per instance
  const insert_sql = _Store.buildInsertSQL();

  return Store;

};///////////////////////////// createInterface END /////////////////////////////
