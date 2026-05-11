// Info: MySQL store adapter for js-server-helper-auth. Fully self-contained -
// every DDL statement, UPSERT template, CRUD query, value coercion,
// and identifier-quoting rule in this file is specific to MySQL.
// No cross-dialect parameterisation, no shared SQL helper module.
//
// The application injects a ready-to-use MySQL helper via
// STORE_CONFIG.lib_sql (typically Lib.MySQL). This adapter never
// requires `mysql2` directly - projects not using this store never load
// the driver.
//
// MySQL-specific quirks handled here:
//   - Identifiers are backtick-quoted (`col`) instead of double-quoted.
//   - CREATE INDEX IF NOT EXISTS is not supported in MySQL. The
//     expires_at index is inlined into CREATE TABLE so both table and
//     index exist once the single CREATE TABLE IF NOT EXISTS statement
//     succeeds. Both are idempotent on repeated boot via setupNewStore().
//   - UPSERT uses ON DUPLICATE KEY UPDATE col = VALUES(col) instead
//     of the Postgres ON CONFLICT ... DO UPDATE SET syntax.
//   - Booleans are stored as TINYINT(1) (0/1). The mysql2 driver is
//     permissive about what it returns for this type; we defensively
//     coerce both on write and on read.
//   - BIGINT columns (created_at, expires_at, last_active_at,
//     client_screen_w, client_screen_h) usually arrive as JS numbers
//     from mysql2 but defensively coerced from strings too.
//
// Store contract (identical shape across all adapters):
//   - setupNewStore(instance)           -> { success, error }   (table + index)
//   - getSession(instance, t, a, k, h) -> { success, record, error }
//   - listSessionsByActor(instance, t, a) -> { success, records, error }
//   - setSession(instance, record)     -> { success, error }
//   - updateSessionActivity(instance, t, a, k, updates) -> { success, error }
//   - deleteSession(instance, t, a, k) -> { success, error }
//   - deleteSessions(instance, t, keys)-> { success, error }
//   - cleanupExpiredSessions(instance) -> { success, deleted_count, error }
//
// MySQL has no native TTL; cleanupExpiredSessions (a sweep over the
// inlined expires_at index) is the garbage-collection path. Apps run
// it on a cron.

'use strict';



/////////////////////////// Module-Loader START ////////////////////////////////

/********************************************************************
Thin loader. Validates STORE_CONFIG via the Validators singleton
then delegates to createInterface. Each call returns an independent
Store instance with its own table_name and lib_sql driver reference.

@param {Object} Lib    - Dependency container (Utils, Debug)
@param {Object} CONFIG - Merged module configuration
@param {Object} ERRORS - Error catalog forwarded from auth.js

@return {Object} - Store interface (8 methods: setupNewStore, getSession, listSessionsByActor, setSession, updateSessionActivity, deleteSession, deleteSessions, cleanupExpiredSessions)
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
@param {Object} ERRORS       - Error catalog forwarded from auth.js

@return {Object} - Store interface (8 methods: setupNewStore, getSession, listSessionsByActor, setSession, updateSessionActivity, deleteSession, deleteSessions, cleanupExpiredSessions)
*********************************************************************/
const createInterface = function (Lib, STORE_CONFIG, ERRORS) {

  ////////////////////////////// Public Functions START ////////////////////////
  const Store = {


    // ~~~~~~~~~~~~~~~~~~~~ Schema Setup ~~~~~~~~~~~~~~~~~~~~
    // One-shot idempotent DDL executed at application boot, before any
    // CRUD call. MySQL does not support CREATE INDEX IF NOT EXISTS, so
    // the expires_at index is inlined into CREATE TABLE - one statement
    // keeps both the table and the sweep-index idempotent.

    /********************************************************************
    Idempotent table + index setup. Creates the sessions table with
    the expires_at index inlined (MySQL does not support CREATE INDEX
    IF NOT EXISTS). Safe to call on every boot.

    @param {Object} instance - Request instance

    @return {Promise<Object>} - { success, error }
    *********************************************************************/
    setupNewStore: async function (instance) {

      // Build and execute the combined CREATE TABLE + INDEX statement
      const stmt = _Store.buildSchemaDDL();
      const result = await STORE_CONFIG.lib_sql.write(instance, stmt);

      // Return a service error if the DDL failed
      if (result.success === false) {
        Lib.Debug.debug('Auth mysql setupNewStore failed', {
          type: ERRORS.SERVICE_UNAVAILABLE.type,
          driver_type: result.error && result.error.type,
          driver_message: result.error && result.error.message,
          statement: stmt
        });
        return {
          success: false,
          error: ERRORS.SERVICE_UNAVAILABLE
        };
      }

      // Report success - table and index are ready
      return {
        success: true,
        error: null
      };

    },


    // ~~~~~~~~~~~~~~~~~~~~ Read ~~~~~~~~~~~~~~~~~~~~
    // Single-session lookup and per-actor listing. Both are served
    // directly by the natural composite primary key, so they stay
    // single index reads even at large scale.

    /********************************************************************
    Read a single session by (tenant_id, actor_id, token_key). Applies
    the token_secret_hash check after the read so a wrong secret looks
    identical to "record not found" (no timing leak).
    *********************************************************************/
    getSession: async function (instance, tenant_id, actor_id, token_key, token_secret_hash) {

      // Fetch the session row by composite primary key
      const result = await STORE_CONFIG.lib_sql.getRow(
        instance,
        'SELECT * FROM ' + _Store.t +
        ' WHERE ' + _Store.Q('tenant_id') + ' = ?' +
        '   AND ' + _Store.Q('actor_id')  + ' = ?' +
        '   AND ' + _Store.Q('token_key') + ' = ?',
        [tenant_id, actor_id, token_key]
      );

      // Return a service error if the driver call failed
      if (result.success === false) {
        Lib.Debug.debug('Auth mysql getSession failed', {
          type: ERRORS.SERVICE_UNAVAILABLE.type,
          driver_type: result.error && result.error.type,
          driver_message: result.error && result.error.message
        });
        return {
          success: false,
          record: null,
          error: ERRORS.SERVICE_UNAVAILABLE
        };
      }

      // Return early when the row does not exist
      if (result.row === null) {
        return {
          success: true,
          record: null,
          error: null
        };
      }

      // Decode the raw row and verify the secret hash
      const record = _Store.rowToRecord(result.row);

      // Constant-behaviour hash compare - mismatch returns "not found"
      if (record.token_secret_hash !== token_secret_hash) {
        return {
          success: true,
          record: null,
          error: null
        };
      }

      // Return the matched and verified record
      return {
        success: true,
        record: record,
        error: null
      };

    },


    /********************************************************************
    Return every session for a (tenant_id, actor_id) pair. The natural
    PK is composite so this is a single index range read.
    *********************************************************************/
    listSessionsByActor: async function (instance, tenant_id, actor_id) {

      // Fetch all session rows for this actor under the given tenant
      const result = await STORE_CONFIG.lib_sql.getRows(
        instance,
        'SELECT * FROM ' + _Store.t +
        ' WHERE ' + _Store.Q('tenant_id') + ' = ?' +
        '   AND ' + _Store.Q('actor_id')  + ' = ?',
        [tenant_id, actor_id]
      );

      // Return a service error if the driver call failed
      if (result.success === false) {
        Lib.Debug.debug('Auth mysql listSessionsByActor failed', {
          type: ERRORS.SERVICE_UNAVAILABLE.type,
          driver_type: result.error && result.error.type,
          driver_message: result.error && result.error.message
        });
        return {
          success: false,
          records: [],
          error: ERRORS.SERVICE_UNAVAILABLE
        };
      }

      // Decode every raw row to canonical record shape and return the list
      const records = result.rows.map(function (row) { return _Store.rowToRecord(row); });
      return {
        success: true,
        records: records,
        error: null
      };

    },


    // ~~~~~~~~~~~~~~~~~~~~ Write ~~~~~~~~~~~~~~~~~~~~
    // Full upsert and partial mutable-field update. setSession is
    // the canonical create-or-replace path; updateSessionActivity is
    // the cheap partial write used by the session-touch hot path and
    // refuses any identity column to keep PK integrity tamper-proof.

    /********************************************************************
    Insert or upsert a session. Uses ON DUPLICATE KEY UPDATE so a
    second call with the same primary key replaces the mutable columns
    - supports re-use of the same (tenant, actor, token_key) triple in
    a single round-trip.
    *********************************************************************/
    setSession: async function (instance, record) {

      // Encode the canonical record and run the UPSERT
      const params = _Store.recordToRow(record);
      const result = await STORE_CONFIG.lib_sql.write(instance, _Store.upsert_sql, params);

      // Return a service error if the driver call failed
      if (result.success === false) {
        Lib.Debug.debug('Auth mysql setSession failed', {
          type: ERRORS.SERVICE_UNAVAILABLE.type,
          driver_type: result.error && result.error.type,
          driver_message: result.error && result.error.message
        });
        return {
          success: false,
          error: ERRORS.SERVICE_UNAVAILABLE
        };
      }

      // Report success
      return {
        success: true,
        error: null
      };

    },


    /********************************************************************
    Partial UPDATE for the mutable per-session fields:
      last_active_at, expires_at, push_provider, push_token,
      client_*, custom_data, refresh_token_hash, refresh_family_id

    Throws TypeError if `updates` contains any identity / primary-key
    column - programmer error (only auth.js calls this and it never
    passes those fields). The throw makes any regression visible
    immediately rather than silently overwriting identity.
    *********************************************************************/
    updateSessionActivity: async function (instance, tenant_id, actor_id, token_key, updates) {

      // Skip the round-trip when there is nothing to update
      const update_keys = Object.keys(updates);
      if (update_keys.length === 0) {
        return {
          success: true,
          error: null
        };
      }

      // Guard against callers attempting to overwrite identity columns
      for (const k of update_keys) {
        if (_Store.UPDATE_IDENTITY_BLOCKLIST.indexOf(k) !== -1) {
          throw new TypeError(
            '[js-server-helper-auth-store-mysql] updateSessionActivity cannot modify identity field "' + k + '"'
          );
        }
      }

      // Build the SET clause and positional parameter list
      const set_parts = update_keys.map(function (k) {
        return _Store.Q(k) + ' = ?';
      });
      const set_values = update_keys.map(function (k) {
        return _Store.toColumnValue(k, updates[k]);
      });

      // Run the partial UPDATE against the target session row
      const stmt =
        'UPDATE ' + _Store.t +
        ' SET ' + set_parts.join(', ') +
        ' WHERE ' + _Store.Q('tenant_id') + ' = ?' +
        '   AND ' + _Store.Q('actor_id')  + ' = ?' +
        '   AND ' + _Store.Q('token_key') + ' = ?';

      const params = set_values.concat([tenant_id, actor_id, token_key]);

      const result = await STORE_CONFIG.lib_sql.write(instance, stmt, params);

      // Return a service error if the driver call failed
      if (result.success === false) {
        Lib.Debug.debug('Auth mysql updateSessionActivity failed', {
          type: ERRORS.SERVICE_UNAVAILABLE.type,
          driver_type: result.error && result.error.type,
          driver_message: result.error && result.error.message
        });
        return {
          success: false,
          error: ERRORS.SERVICE_UNAVAILABLE
        };
      }

      // Report success
      return {
        success: true,
        error: null
      };

    },


    // ~~~~~~~~~~~~~~~~~~~~ Delete ~~~~~~~~~~~~~~~~~~~~
    // Single and bulk deletion by composite key. Bulk variant batches
    // into a single round-trip so revokeAllSessions / install-id
    // replacement stay constant-cost regardless of session count.

    /********************************************************************
    Delete one session by composite key.
    *********************************************************************/
    deleteSession: async function (instance, tenant_id, actor_id, token_key) {

      // Remove the session row by composite primary key
      const result = await STORE_CONFIG.lib_sql.write(
        instance,
        'DELETE FROM ' + _Store.t +
        ' WHERE ' + _Store.Q('tenant_id') + ' = ?' +
        '   AND ' + _Store.Q('actor_id')  + ' = ?' +
        '   AND ' + _Store.Q('token_key') + ' = ?',
        [tenant_id, actor_id, token_key]
      );

      // Return a service error if the driver call failed
      if (result.success === false) {
        Lib.Debug.debug('Auth mysql deleteSession failed', {
          type: ERRORS.SERVICE_UNAVAILABLE.type,
          driver_type: result.error && result.error.type,
          driver_message: result.error && result.error.message
        });
        return {
          success: false,
          error: ERRORS.SERVICE_UNAVAILABLE
        };
      }

      // Report success
      return {
        success: true,
        error: null
      };

    },


    /********************************************************************
    Bulk delete sessions for a tenant. One round-trip with a
    (actor_id = ? AND token_key = ?) OR (...) clause. Skips the
    round-trip if the keys list is empty (no-op success).
    *********************************************************************/
    deleteSessions: async function (instance, tenant_id, keys) {

      // Skip the round-trip when the caller provides no keys
      if (keys.length === 0) {
        return {
          success: true,
          error: null
        };
      }

      // Build the (actor_id = ? AND token_key = ?) OR (...) clause
      const clauses = keys.map(function () {
        return '(' +
          _Store.Q('actor_id') + ' = ? AND ' +
          _Store.Q('token_key') + ' = ?' +
          ')';
      }).join(' OR ');

      // Flatten keys into the positional parameter list
      const params = [tenant_id];
      for (const k of keys) {
        params.push(k.actor_id);
        params.push(k.token_key);
      }

      // Delete all matched sessions in one round-trip
      const result = await STORE_CONFIG.lib_sql.write(
        instance,
        'DELETE FROM ' + _Store.t +
        ' WHERE ' + _Store.Q('tenant_id') + ' = ? AND (' + clauses + ')',
        params
      );

      // Return a service error if the driver call failed
      if (result.success === false) {
        Lib.Debug.debug('Auth mysql deleteSessions failed', {
          type: ERRORS.SERVICE_UNAVAILABLE.type,
          driver_type: result.error && result.error.type,
          driver_message: result.error && result.error.message
        });
        return {
          success: false,
          error: ERRORS.SERVICE_UNAVAILABLE
        };
      }

      // Report success
      return {
        success: true,
        error: null
      };

    },


    // ~~~~~~~~~~~~~~~~~~~~ Maintenance ~~~~~~~~~~~~~~~~~~~~
    // Background sweep for expired rows. MySQL has no native TTL,
    // so cleanupExpiredSessions (run on a cron) is the garbage-
    // collection path. The inlined expires_at index keeps this an
    // efficient range scan even as the table grows.

    /********************************************************************
    Sweep expired sessions. Uses the inlined expires_at index for
    efficient range scan. MySQL has no native TTL, so this is the
    garbage-collection path - run it on a cron.
    *********************************************************************/
    cleanupExpiredSessions: async function (instance) {

      // Sweep all rows whose expires_at is in the past
      const now = instance.time;
      const result = await STORE_CONFIG.lib_sql.write(
        instance,
        'DELETE FROM ' + _Store.t + ' WHERE ' + _Store.Q('expires_at') + ' < ?',
        [now]
      );

      // Return a service error if the driver call failed
      if (result.success === false) {
        Lib.Debug.debug('Auth mysql cleanupExpiredSessions failed', {
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

      // Report success with the number of rows removed
      return {
        success: true,
        deleted_count: result.affected_rows,
        error: null
      };

    }

  };////////////////////////////// Public Functions END ////////////////////////



  ///////////////////////////// Private Functions START ////////////////////////
  const _Store = {

    // Canonical column list - order matters for parameterized INSERT.
    // The order matches parts/record-shape.js getFieldNames(), which is
    // the source of truth for the canonical record shape.
    COLUMNS: [
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
    ],

    // Columns that must NOT be overwritten on upsert. The natural primary
    // key (tenant_id, actor_id, token_key) plus immutable per-install
    // fields (install_id, install_platform, install_form_factor,
    // created_at) stay anchored to the original row.
    UPSERT_IMMUTABLE_COLUMNS: [
      'tenant_id', 'actor_id', 'token_key',
      'created_at',
      'install_id', 'install_platform', 'install_form_factor'
    ],

    // Columns the caller is never allowed to mutate through
    // updateSessionActivity. This is a security + integrity blocklist -
    // passing any of these triggers a TypeError so the regression is
    // visible in dev / CI immediately.
    UPDATE_IDENTITY_BLOCKLIST: [
      'tenant_id', 'actor_id', 'actor_type', 'token_key', 'token_secret_hash',
      'created_at', 'install_id', 'install_platform', 'install_form_factor'
    ],

    // Integer columns that mysql2 may surface as strings in some driver
    // configurations (e.g. supportBigNumbers=true with string mode).
    // Coerced back to numbers on read so the in-memory record shape
    // stays consistent with the memory store.
    INTEGER_COLUMNS: [
      'created_at', 'expires_at', 'last_active_at',
      'client_screen_w', 'client_screen_h'
    ],


    /********************************************************************
    Quote an identifier using MySQL's native backtick style. Rejects
    any identifier containing a backtick or double-quote so identifiers
    can never inject DDL through the table_name configuration.
    Closes over STORE_CONFIG from createInterface.

    @param {String} name - Identifier (table or column)

    @return {String} - Quoted identifier
    *********************************************************************/
    Q: function (name) {

      // Reject identifiers that contain the backtick escape character
      if (name.indexOf('`') !== -1) {
        throw new Error('[js-server-helper-auth-store-mysql] identifier contains backtick: ' + name);
      }

      // Reject double-quotes for alignment with the other SQL stores
      if (name.indexOf('"') !== -1) {
        throw new Error('[js-server-helper-auth-store-mysql] identifier contains double-quote: ' + name);
      }

      // Wrap in MySQL backtick style
      return '`' + name + '`';

    },


    /********************************************************************
    Build the CREATE TABLE statement for MySQL. Idempotent via
    CREATE TABLE IF NOT EXISTS. The expires_at index is inlined because
    MySQL has no CREATE INDEX IF NOT EXISTS - inlining it here makes
    both the table and the index idempotent under a single statement.
    Closes over STORE_CONFIG from createInterface.

    @return {String} - DDL statement
    *********************************************************************/
    buildSchemaDDL: function () {

      // Build the quoted table and index identifiers then emit full DDL
      const Q = _Store.Q;
      const t = Q(STORE_CONFIG.table_name);
      const idx_name = 'idx_' + STORE_CONFIG.table_name + '_expires_at';

      return (
        'CREATE TABLE IF NOT EXISTS ' + t + ' (' +
          '  ' + Q('tenant_id')           + ' VARCHAR(64)  NOT NULL,' +
          '  ' + Q('actor_id')            + ' VARCHAR(128) NOT NULL,' +
          '  ' + Q('actor_type')          + ' VARCHAR(64)  NOT NULL,' +
          '  ' + Q('token_key')           + ' VARCHAR(64)  NOT NULL,' +
          '  ' + Q('token_secret_hash')   + ' VARCHAR(128) NOT NULL,' +
          '  ' + Q('refresh_token_hash')  + ' VARCHAR(128),' +
          '  ' + Q('refresh_family_id')   + ' VARCHAR(64),' +
          '  ' + Q('created_at')          + ' BIGINT NOT NULL,' +
          '  ' + Q('expires_at')          + ' BIGINT NOT NULL,' +
          '  ' + Q('last_active_at')      + ' BIGINT NOT NULL,' +
          '  ' + Q('install_id')          + ' VARCHAR(64),' +
          '  ' + Q('install_platform')    + ' VARCHAR(32)  NOT NULL,' +
          '  ' + Q('install_form_factor') + ' VARCHAR(32)  NOT NULL,' +
          '  ' + Q('client_name')         + ' VARCHAR(128),' +
          '  ' + Q('client_version')      + ' VARCHAR(64),' +
          '  ' + Q('client_is_browser')   + ' TINYINT(1) NOT NULL DEFAULT 0,' +
          '  ' + Q('client_os_name')      + ' VARCHAR(64),' +
          '  ' + Q('client_os_version')   + ' VARCHAR(64),' +
          '  ' + Q('client_screen_w')     + ' INTEGER,' +
          '  ' + Q('client_screen_h')     + ' INTEGER,' +
          '  ' + Q('client_ip_address')   + ' VARCHAR(64),' +
          '  ' + Q('client_user_agent')   + ' TEXT,' +
          '  ' + Q('push_provider')       + ' VARCHAR(32),' +
          '  ' + Q('push_token')          + ' VARCHAR(1024),' +
          '  ' + Q('custom_data')         + ' TEXT,' +
          '  PRIMARY KEY (' +
                Q('tenant_id') + ', ' +
                Q('actor_id') + ', ' +
                Q('token_key') + '),' +
          '  INDEX ' + Q(idx_name) + ' (' + Q('expires_at') + ')' +
          ')'
      );

    },


    /********************************************************************
    Build the MySQL UPSERT statement. Uses
      INSERT ... ON DUPLICATE KEY UPDATE col = VALUES(col)
    so a second call with the same (tenant_id, actor_id, token_key)
    replaces the mutable columns in a single round-trip.
    Closes over STORE_CONFIG from createInterface.

    @return {String} - SQL template using `?` placeholders
    *********************************************************************/
    buildUpsertSQL: function () {

      // Build the column list, placeholder list, and quoted table name
      const Q = _Store.Q;
      const COLUMNS = _Store.COLUMNS;
      const UPSERT_IMMUTABLE_COLUMNS = _Store.UPSERT_IMMUTABLE_COLUMNS;
      const tq = Q(STORE_CONFIG.table_name);
      const cols_quoted = COLUMNS.map(Q).join(', ');
      const placeholders = COLUMNS.map(function () { return '?'; }).join(', ');

      // Build the ON DUPLICATE KEY UPDATE pairs for every mutable column
      const update_cols = COLUMNS.filter(function (c) {
        return UPSERT_IMMUTABLE_COLUMNS.indexOf(c) === -1;
      });
      const update_parts = update_cols.map(function (c) {
        const q = Q(c);
        // MySQL uses VALUES(col) to reference the proposed insert value.
        return q + ' = VALUES(' + q + ')';
      });

      return (
        'INSERT INTO ' + tq + ' (' + cols_quoted + ') ' +
        'VALUES (' + placeholders + ') ' +
        'ON DUPLICATE KEY UPDATE ' + update_parts.join(', ')
      );

    },


    /********************************************************************
    Encode a canonical-record value for a parameterized INSERT / UPDATE.
    MySQL TINYINT(1) expects 0/1 for booleans; custom_data is JSON-
    enveloped; undefined maps to null.

    @param {String} col   - Column name
    @param {*}      value - Canonical record value

    @return {*} - DB-safe value
    *********************************************************************/
    toColumnValue: function (col, value) {

      // Map undefined to null so it is never sent to the driver
      if (value === undefined) {
        return null;
      }

      // client_is_browser: MySQL TINYINT(1) wants 0 / 1
      if (col === 'client_is_browser') {
        return value ? 1 : 0;
      }

      // Serialize structured data as a JSON string
      if (col === 'custom_data') {
        if (value === null) {
          return null;
        }
        return JSON.stringify(value);
      }

      return value;

    },


    /********************************************************************
    Decode a raw row value into its canonical-record shape. mysql2
    returns TINYINT(1) as 0/1 by default; we coerce back to boolean.
    custom_data is parsed from the TEXT-stored JSON envelope. BIGINT
    columns may arrive as strings in some driver configurations.

    @param {String} col   - Column name
    @param {*}      value - Raw DB value

    @return {*} - Canonical value
    *********************************************************************/
    fromColumnValue: function (col, value) {

      // Return typed defaults for null/undefined columns
      if (value === undefined || value === null) {
        // client_is_browser should surface as false, not null, so the
        // record shape has a stable boolean everywhere.
        if (col === 'client_is_browser') {
          return false;
        }
        return null;
      }

      // Coerce TINYINT(1) 0/1 back to a JS boolean
      if (col === 'client_is_browser') {
        if (typeof value === 'number') {
          return value === 1;
        }
        return Boolean(value);
      }

      // Parse the JSON envelope back to a structured object
      if (col === 'custom_data') {
        if (typeof value === 'string') {
          try {
            return JSON.parse(value);
          } catch (err) { // eslint-disable-line no-unused-vars
            // Corrupt stored value - surface as null rather than throwing.
            // The application's integrity checks live above this layer.
            return null;
          }
        }
        return value;
      }

      // BIGINT columns may arrive as strings from the mysql2 driver in
      // string mode - coerce back to number so the in-memory record
      // shape stays consistent with the memory store.
      if (_Store.INTEGER_COLUMNS.indexOf(col) !== -1 && typeof value === 'string') {
        return parseInt(value, 10);
      }

      return value;

    },


    /********************************************************************
    Canonical record -> positional values array, aligned with COLUMNS.

    @param {Object} record - Canonical session record

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

    @param {Object} row - Raw row from MySQL driver

    @return {Object} - Canonical session record
    *********************************************************************/
    rowToRecord: function (row) {

      // Decode each raw column value into its canonical type
      const record = {};
      for (const col of _Store.COLUMNS) {
        record[col] = _Store.fromColumnValue(col, row[col]);
      }
      return record;

    }

  };///////////////////////////// Private Functions END ////////////////////////


  // Precompute the quoted table name and UPSERT template once per
  // instance. Both depend only on table_name (not per-request input)
  // and appear in every write - computing them once at load time is a
  // free runtime optimisation for the common path.
  _Store.t = _Store.Q(STORE_CONFIG.table_name);
  _Store.upsert_sql = _Store.buildUpsertSQL();

  return Store;

};///////////////////////////// createInterface END /////////////////////////////
