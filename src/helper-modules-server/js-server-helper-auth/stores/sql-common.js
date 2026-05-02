// Info: Shared SQL store factory used by stores/postgres.js, mysql.js,
// and sqlite.js. The three SQL helper modules expose an identical
// public API (getRow / getRows / write / buildQuery), so a single
// implementation serves all three backends. Dialect differences are
// confined to:
//   - DDL generation (column types, upsert syntax)
//   - Boolean coercion (SQLite stores 0/1 integers)
//   - Upsert statement shape
//
// All other logic - serialization, key construction, query building -
// is identical across the three SQL stores.
//
// Contract with auth.js:
//   - initialize(instance)             -> { success, error }
//   - getSession(instance, t, a, k, h) -> { success, record, error }
//   - setSession(instance, record)     -> { success, error }
//   - deleteSession(instance, t, a, k) -> { success, error }
//   - deleteSessions(instance, t, keys)-> { success, error }
//   - listSessionsByActor(instance, t, a) -> { success, records, error }
//   - updateSessionActivity(instance, t, a, k, updates) -> { success, error }
//   - cleanupExpiredSessions(instance) -> { success, deleted_count, error }
'use strict';


// Canonical column list - order matters for parameterized INSERT
const COLUMNS = [
  'tenant_id', 'actor_id', 'actor_type', 'token_key', 'token_secret_hash',
  'refresh_token_hash', 'refresh_family_id',
  'created_at', 'expires_at', 'last_active_at',
  'install_id', 'install_platform', 'install_form_factor',
  'client_name', 'client_version', 'client_is_browser',
  'client_os_name', 'client_os_version',
  'client_screen_w', 'client_screen_h',
  'client_ip_address', 'client_user_agent',
  'push_provider', 'push_token',
  'custom_data'
];


/********************************************************************
Generate CREATE TABLE + CREATE INDEX statements for one dialect.
Called by initialize() - idempotent thanks to IF NOT EXISTS.

@param {String} dialect - 'postgres' | 'mysql' | 'sqlite'
@param {String} table_name - The configured table name

@return {String[]} - DDL statements in execution order
*********************************************************************/
const buildDDL = function (dialect, table_name) {

  let col_bool;
  let col_text;
  let col_big;
  let col_varchar;

  switch (dialect) {

  case 'postgres':
    col_bool = 'BOOLEAN NOT NULL DEFAULT FALSE';
    col_text = 'TEXT';
    col_big = 'BIGINT';
    col_varchar = function (n) { return 'VARCHAR(' + n + ')'; };
    break;

  case 'mysql':
    col_bool = 'TINYINT(1) NOT NULL DEFAULT 0';
    col_text = 'TEXT';
    col_big = 'BIGINT';
    col_varchar = function (n) { return 'VARCHAR(' + n + ')'; };
    break;

  case 'sqlite':
    col_bool = 'INTEGER NOT NULL DEFAULT 0';
    col_text = 'TEXT';
    col_big = 'INTEGER'; // SQLite uses INTEGER for all integer sizes
    col_varchar = function (n) { void n; return 'TEXT'; }; // SQLite ignores VARCHAR length
    break;

  default:
    throw new Error('[js-server-helper-auth] unknown SQL dialect: ' + dialect);

  }

  const idx_name = 'idx_' + table_name + '_expires_at';

  // MySQL does not support "CREATE INDEX IF NOT EXISTS" - inline the
  // index into CREATE TABLE instead. Postgres + SQLite support it, so
  // we emit a standalone CREATE INDEX statement for them.
  const mysql_inline_index = (dialect === 'mysql')
    ? ',  INDEX ' + quote_identifier(dialect, idx_name) +
      ' (' + quote_identifier(dialect, 'expires_at') + ')'
    : '';

  const create_table =
    'CREATE TABLE IF NOT EXISTS ' + quote_identifier(dialect, table_name) + ' (' +
      '  ' + quote_identifier(dialect, 'tenant_id')           + ' ' + col_varchar(64)  + ' NOT NULL,' +
      '  ' + quote_identifier(dialect, 'actor_id')            + ' ' + col_varchar(128) + ' NOT NULL,' +
      '  ' + quote_identifier(dialect, 'actor_type')          + ' ' + col_varchar(64)  + ' NOT NULL,' +
      '  ' + quote_identifier(dialect, 'token_key')           + ' ' + col_varchar(64)  + ' NOT NULL,' +
      '  ' + quote_identifier(dialect, 'token_secret_hash')   + ' ' + col_varchar(128) + ' NOT NULL,' +
      '  ' + quote_identifier(dialect, 'refresh_token_hash')  + ' ' + col_varchar(128) + ',' +
      '  ' + quote_identifier(dialect, 'refresh_family_id')   + ' ' + col_varchar(64)  + ',' +
      '  ' + quote_identifier(dialect, 'created_at')          + ' ' + col_big          + ' NOT NULL,' +
      '  ' + quote_identifier(dialect, 'expires_at')          + ' ' + col_big          + ' NOT NULL,' +
      '  ' + quote_identifier(dialect, 'last_active_at')      + ' ' + col_big          + ' NOT NULL,' +
      '  ' + quote_identifier(dialect, 'install_id')          + ' ' + col_varchar(64)  + ',' +
      '  ' + quote_identifier(dialect, 'install_platform')    + ' ' + col_varchar(32)  + ' NOT NULL,' +
      '  ' + quote_identifier(dialect, 'install_form_factor') + ' ' + col_varchar(32)  + ' NOT NULL,' +
      '  ' + quote_identifier(dialect, 'client_name')         + ' ' + col_varchar(128) + ',' +
      '  ' + quote_identifier(dialect, 'client_version')      + ' ' + col_varchar(64)  + ',' +
      '  ' + quote_identifier(dialect, 'client_is_browser')   + ' ' + col_bool         + ',' +
      '  ' + quote_identifier(dialect, 'client_os_name')      + ' ' + col_varchar(64)  + ',' +
      '  ' + quote_identifier(dialect, 'client_os_version')   + ' ' + col_varchar(64)  + ',' +
      '  ' + quote_identifier(dialect, 'client_screen_w')     + ' INTEGER,' +
      '  ' + quote_identifier(dialect, 'client_screen_h')     + ' INTEGER,' +
      '  ' + quote_identifier(dialect, 'client_ip_address')   + ' ' + col_varchar(64)  + ',' +
      '  ' + quote_identifier(dialect, 'client_user_agent')   + ' ' + col_text         + ',' +
      '  ' + quote_identifier(dialect, 'push_provider')       + ' ' + col_varchar(32)  + ',' +
      '  ' + quote_identifier(dialect, 'push_token')          + ' ' + col_varchar(1024) + ',' +
      '  ' + quote_identifier(dialect, 'custom_data')         + ' ' + col_text         + ',' +
      '  PRIMARY KEY (' +
            quote_identifier(dialect, 'tenant_id') + ', ' +
            quote_identifier(dialect, 'actor_id') + ', ' +
            quote_identifier(dialect, 'token_key') + ')' +
      mysql_inline_index +
      ')';

  // Postgres and SQLite get a separate CREATE INDEX IF NOT EXISTS;
  // MySQL already has the index embedded in CREATE TABLE above.
  if (dialect === 'mysql') {
    return [create_table];
  }

  const create_index =
    'CREATE INDEX IF NOT EXISTS ' + quote_identifier(dialect, idx_name) +
    ' ON ' + quote_identifier(dialect, table_name) +
    ' (' + quote_identifier(dialect, 'expires_at') + ')';

  return [create_table, create_index];

};


/********************************************************************
Quote an identifier using the dialect's native style. We could use
`??` placeholders in buildQuery, but DDL is built here without a
driver round-trip so we quote inline. All three dialects accept
double-quotes for identifiers; MySQL also accepts backticks but
double-quotes work in ANSI mode (default in MySQL 8+).

@param {String} dialect
@param {String} name

@return {String}
*********************************************************************/
const quote_identifier = function (dialect, name) {

  // Reject any name containing a double-quote - prevents DDL injection
  // through table_name configuration.
  if (name.indexOf('"') !== -1) {
    throw new Error('[js-server-helper-auth] identifier contains double-quote: ' + name);
  }

  // Postgres / SQLite use double-quote; MySQL uses backtick for
  // identifiers. We use the dialect's native quoting.
  if (dialect === 'mysql') {
    if (name.indexOf('`') !== -1) {
      throw new Error('[js-server-helper-auth] MySQL identifier contains backtick: ' + name);
    }
    return '`' + name + '`';
  }

  return '"' + name + '"';

};


/********************************************************************
Convert a canonical record (from parts/record-shape.js) into a row
suitable for a parameterized INSERT. Handles dialect-specific
boolean coercion and JSON serialization for custom_data.

@param {String} dialect
@param {Object} record - Canonical session record

@return {Array} - Positional values aligned with COLUMNS order
*********************************************************************/
const recordToRow = function (dialect, record) {

  return COLUMNS.map(function (col) {
    return toColumnValue(dialect, col, record[col]);
  });

};


/********************************************************************
Convert a stored row (from getRow / getRows) back into a canonical
record. Handles dialect-specific boolean coercion and JSON parsing.

@param {String} dialect
@param {Object} row - Raw row object keyed by column name

@return {Object} - Canonical session record
*********************************************************************/
const rowToRecord = function (dialect, row) {

  const record = {};
  for (const col of COLUMNS) {
    record[col] = fromColumnValue(dialect, col, row[col]);
  }
  return record;

};


/********************************************************************
Field-by-field encoder for outgoing writes. Extracted so the value
set is explicit and testable.
*********************************************************************/
const toColumnValue = function (dialect, col, value) {

  // Undefined never reaches the DB
  if (value === undefined) {
    return null;
  }

  // Booleans: SQLite stores 0/1. Postgres + MySQL drivers handle native.
  if (col === 'client_is_browser') {
    if (dialect === 'sqlite') {
      return value ? 1 : 0;
    }
    return Boolean(value);
  }

  // JSON envelope
  if (col === 'custom_data') {
    if (value === null) {
      return null;
    }
    return JSON.stringify(value);
  }

  return value;

};


/********************************************************************
Field-by-field decoder for incoming reads. The pg + mysql2 drivers
decode natively; SQLite needs integer-to-boolean for client_is_browser
and JSON parsing for custom_data.
*********************************************************************/
const fromColumnValue = function (dialect, col, value) {

  if (value === undefined || value === null) {
    // Booleans should surface as false, not null, so the record shape
    // has a stable boolean everywhere.
    if (col === 'client_is_browser') {
      return false;
    }
    return null;
  }

  if (col === 'client_is_browser') {
    // SQLite / MySQL (with BOOLEAN-as-TINYINT) return 0/1 numerics;
    // Postgres returns true/false natively.
    if (typeof value === 'number') {
      return value === 1;
    }
    return Boolean(value);
  }

  if (col === 'custom_data') {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (err) {
        // Corrupt stored value - surface as null rather than throwing.
        // The application's integrity checks live above this layer.
        void err;
        return null;
      }
    }
    return value;
  }

  // Integer columns sometimes arrive as strings from the pg driver for
  // BIGINT. Coerce back to number so the in-memory record shape stays
  // consistent with the memory store.
  if (
    col === 'created_at' ||
    col === 'expires_at' ||
    col === 'last_active_at' ||
    col === 'client_screen_w' ||
    col === 'client_screen_h'
  ) {
    if (typeof value === 'string') {
      return parseInt(value, 10);
    }
  }

  return value;

};


/********************************************************************
Build the UPSERT (INSERT-or-replace) statement for a dialect. We use
the natural primary key (tenant_id, actor_id, token_key) as conflict
target so same-install replacement is a single round-trip.

@param {String} dialect
@param {String} table_name

@return {String} - SQL template using `?` placeholders
*********************************************************************/
const buildUpsertSQL = function (dialect, table_name) {

  const t = quote_identifier(dialect, table_name);
  const cols_quoted = COLUMNS.map(function (c) {
    return quote_identifier(dialect, c);
  }).join(', ');
  const placeholders = COLUMNS.map(function () { return '?'; }).join(', ');

  let upsert_tail;

  switch (dialect) {

  case 'postgres': {
    // ON CONFLICT (pk) DO UPDATE SET col=EXCLUDED.col, ...
    const update_parts = COLUMNS
      .filter(function (c) {
        // Skip primary-key cols and immutable cols in the update clause
        return (
          c !== 'tenant_id' &&
            c !== 'actor_id' &&
            c !== 'token_key' &&
            c !== 'created_at' &&
            c !== 'install_id' &&
            c !== 'install_platform' &&
            c !== 'install_form_factor'
        );
      })
      .map(function (c) {
        const q = quote_identifier(dialect, c);
        return q + ' = EXCLUDED.' + q;
      });
    upsert_tail =
        ' ON CONFLICT (' +
        quote_identifier(dialect, 'tenant_id') + ', ' +
        quote_identifier(dialect, 'actor_id') + ', ' +
        quote_identifier(dialect, 'token_key') +
        ') DO UPDATE SET ' + update_parts.join(', ');
    break;
  }

  case 'mysql': {
    // ON DUPLICATE KEY UPDATE col = VALUES(col), ...
    const update_parts = COLUMNS
      .filter(function (c) {
        return (
          c !== 'tenant_id' &&
            c !== 'actor_id' &&
            c !== 'token_key' &&
            c !== 'created_at' &&
            c !== 'install_id' &&
            c !== 'install_platform' &&
            c !== 'install_form_factor'
        );
      })
      .map(function (c) {
        const q = quote_identifier(dialect, c);
        return q + ' = VALUES(' + q + ')';
      });
    upsert_tail = ' ON DUPLICATE KEY UPDATE ' + update_parts.join(', ');
    break;
  }

  case 'sqlite': {
    // INSERT ... ON CONFLICT (pk) DO UPDATE SET ... (same syntax as
    // Postgres since SQLite 3.24).
    const update_parts = COLUMNS
      .filter(function (c) {
        return (
          c !== 'tenant_id' &&
            c !== 'actor_id' &&
            c !== 'token_key' &&
            c !== 'created_at' &&
            c !== 'install_id' &&
            c !== 'install_platform' &&
            c !== 'install_form_factor'
        );
      })
      .map(function (c) {
        const q = quote_identifier(dialect, c);
        return q + ' = excluded.' + q;
      });
    upsert_tail =
        ' ON CONFLICT (' +
        quote_identifier(dialect, 'tenant_id') + ', ' +
        quote_identifier(dialect, 'actor_id') + ', ' +
        quote_identifier(dialect, 'token_key') +
        ') DO UPDATE SET ' + update_parts.join(', ');
    break;
  }

  default:
    throw new Error('[js-server-helper-auth] unknown SQL dialect: ' + dialect);

  }

  return 'INSERT INTO ' + t + ' (' + cols_quoted + ') VALUES (' + placeholders + ')' + upsert_tail;

};


/********************************************************************
SQL store factory. Returns the same interface shape as stores/memory.js
so auth.js treats all stores identically.

@param {Object} Lib - Dependency container (Utils, Debug)
@param {Object} store_config - { table_name, lib_sql }
@param {String} dialect - 'postgres' | 'mysql' | 'sqlite'

@return {Object} - Store interface
*********************************************************************/
module.exports = function sqlStoreFactory (Lib, store_config, dialect) {

  // Validate store_config
  if (
    Lib.Utils.isNullOrUndefined(store_config) ||
    !Lib.Utils.isObject(store_config)
  ) {
    throw new Error('[js-server-helper-auth] STORE_CONFIG must be an object for SQL stores');
  }

  if (
    Lib.Utils.isNullOrUndefined(store_config.table_name) ||
    !Lib.Utils.isString(store_config.table_name) ||
    Lib.Utils.isEmptyString(store_config.table_name)
  ) {
    throw new Error('[js-server-helper-auth] STORE_CONFIG.table_name is required for SQL stores');
  }

  if (Lib.Utils.isNullOrUndefined(store_config.lib_sql)) {
    throw new Error('[js-server-helper-auth] STORE_CONFIG.lib_sql is required for SQL stores (pass Lib.Postgres / Lib.MySQL / Lib.SQLite)');
  }

  const table_name = store_config.table_name;
  const sql = store_config.lib_sql;

  // Pre-compute the quoted table identifier - used everywhere
  const t = quote_identifier(dialect, table_name);


  return {


    /********************************************************************
    Idempotent backend setup. Creates the table and the expires_at
    index. Safe to call on every boot.
    *********************************************************************/
    initialize: async function (instance) {

      const statements = buildDDL(dialect, table_name);

      for (const stmt of statements) {
        const result = await sql.write(instance, stmt);
        if (result.success === false) {
          return { success: false, error: result.error };
        }
      }

      return { success: true, error: null };

    },


    /********************************************************************
    Read a single session by (tenant_id, actor_id, token_key). Applies
    the token_secret_hash check after the read so a wrong secret looks
    identical to "record not found" (no timing leak).
    *********************************************************************/
    getSession: async function (instance, tenant_id, actor_id, token_key, token_secret_hash) {

      const result = await sql.getRow(
        instance,
        'SELECT * FROM ' + t +
        ' WHERE ' + quote_identifier(dialect, 'tenant_id')  + ' = ?' +
        '   AND ' + quote_identifier(dialect, 'actor_id')   + ' = ?' +
        '   AND ' + quote_identifier(dialect, 'token_key')  + ' = ?',
        [tenant_id, actor_id, token_key]
      );

      if (result.success === false) {
        return { success: false, record: null, error: result.error };
      }

      if (result.row === null) {
        return { success: true, record: null, error: null };
      }

      const record = rowToRecord(dialect, result.row);

      // Compare hashes - mismatch returns "not found"
      if (record.token_secret_hash !== token_secret_hash) {
        return { success: true, record: null, error: null };
      }

      return { success: true, record: record, error: null };

    },


    /********************************************************************
    Insert or upsert a session. Uses dialect-specific ON CONFLICT/ON
    DUPLICATE KEY so a second call with the same primary key replaces
    the existing row - supports re-use of the same (tenant, actor,
    token_key) triple.
    *********************************************************************/
    setSession: async function (instance, record) {

      const params = recordToRow(dialect, record);
      const stmt = buildUpsertSQL(dialect, table_name);

      const result = await sql.write(instance, stmt, params);
      if (result.success === false) {
        return { success: false, error: result.error };
      }

      return { success: true, error: null };

    },


    /********************************************************************
    Delete one session by composite key.
    *********************************************************************/
    deleteSession: async function (instance, tenant_id, actor_id, token_key) {

      const result = await sql.write(
        instance,
        'DELETE FROM ' + t +
        ' WHERE ' + quote_identifier(dialect, 'tenant_id')  + ' = ?' +
        '   AND ' + quote_identifier(dialect, 'actor_id')   + ' = ?' +
        '   AND ' + quote_identifier(dialect, 'token_key')  + ' = ?',
        [tenant_id, actor_id, token_key]
      );

      if (result.success === false) {
        return { success: false, error: result.error };
      }

      return { success: true, error: null };

    },


    /********************************************************************
    Delete many sessions in a single atomic transaction. Each entry
    must supply { actor_id, token_key }. tenant_id is passed in bulk
    so all deletes stay scoped to one tenant.
    *********************************************************************/
    deleteSessions: async function (instance, tenant_id, keys) {

      if (keys.length === 0) {
        return { success: true, error: null };
      }

      // Build an array of parameterized statements for the transaction
      const statements = keys.map(function (k) {
        return {
          sql:
            'DELETE FROM ' + t +
            ' WHERE ' + quote_identifier(dialect, 'tenant_id') + ' = ?' +
            '   AND ' + quote_identifier(dialect, 'actor_id')  + ' = ?' +
            '   AND ' + quote_identifier(dialect, 'token_key') + ' = ?',
          params: [tenant_id, k.actor_id, k.token_key]
        };
      });

      const result = await sql.write(instance, statements);
      if (result.success === false) {
        return { success: false, error: result.error };
      }

      return { success: true, error: null };

    },


    /********************************************************************
    List all sessions for (tenant_id, actor_id). Uses the primary-key
    prefix scan - no table scan, no secondary index needed.
    *********************************************************************/
    listSessionsByActor: async function (instance, tenant_id, actor_id) {

      const result = await sql.getRows(
        instance,
        'SELECT * FROM ' + t +
        ' WHERE ' + quote_identifier(dialect, 'tenant_id') + ' = ?' +
        '   AND ' + quote_identifier(dialect, 'actor_id')  + ' = ?',
        [tenant_id, actor_id]
      );

      if (result.success === false) {
        return { success: false, records: null, error: result.error };
      }

      const records = result.rows.map(function (row) {
        return rowToRecord(dialect, row);
      });

      return { success: true, records: records, error: null };

    },


    /********************************************************************
    Partial update of mutable fields. Accepts any subset of:
      last_active_at, expires_at, push_provider, push_token,
      client_*, custom_data
    *********************************************************************/
    updateSessionActivity: async function (instance, tenant_id, actor_id, token_key, updates) {

      const update_keys = Object.keys(updates);
      if (update_keys.length === 0) {
        return { success: true, error: null };
      }

      // Block updates to identity / primary key columns - defense in depth
      for (const k of update_keys) {
        if (
          k === 'tenant_id' || k === 'actor_id' || k === 'actor_type' ||
          k === 'token_key' || k === 'token_secret_hash' ||
          k === 'created_at' || k === 'install_id' ||
          k === 'install_platform' || k === 'install_form_factor'
        ) {
          return {
            success: false,
            error: {
              type: 'UPDATE_FORBIDDEN_FIELD',
              message: 'updateSessionActivity cannot modify field ' + k
            }
          };
        }
      }

      const set_parts = update_keys.map(function (k) {
        return quote_identifier(dialect, k) + ' = ?';
      });
      const set_values = update_keys.map(function (k) {
        return toColumnValue(dialect, k, updates[k]);
      });

      const stmt =
        'UPDATE ' + t +
        ' SET ' + set_parts.join(', ') +
        ' WHERE ' + quote_identifier(dialect, 'tenant_id') + ' = ?' +
        '   AND ' + quote_identifier(dialect, 'actor_id')  + ' = ?' +
        '   AND ' + quote_identifier(dialect, 'token_key') + ' = ?';

      const params = set_values.concat([tenant_id, actor_id, token_key]);

      const result = await sql.write(instance, stmt, params);
      if (result.success === false) {
        return { success: false, error: result.error };
      }

      return { success: true, error: null };

    },


    /********************************************************************
    Sweep expired sessions in one DELETE. Uses the expires_at index.
    *********************************************************************/
    cleanupExpiredSessions: async function (instance) {

      const now = instance.time;

      const result = await sql.write(
        instance,
        'DELETE FROM ' + t +
        ' WHERE ' + quote_identifier(dialect, 'expires_at') + ' < ?',
        [now]
      );

      if (result.success === false) {
        return { success: false, deleted_count: 0, error: result.error };
      }

      return { success: true, deleted_count: result.affected_rows, error: null };

    }


  };

};


// White-box hooks for tests - intentionally not part of the standard store
// contract. Only the registry loads this file.
module.exports._buildDDL = buildDDL;
module.exports._buildUpsertSQL = buildUpsertSQL;
module.exports._recordToRow = recordToRow;
module.exports._rowToRecord = rowToRecord;
module.exports._COLUMNS = COLUMNS;
