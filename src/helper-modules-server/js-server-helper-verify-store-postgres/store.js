// Info: Postgres store adapter for js-server-helper-verify. Fully self-contained -
// every DDL statement, UPSERT template, and CRUD query in this file is
// specific to Postgres.
//
// The application injects a ready-to-use Postgres helper via
// STORE_CONFIG.lib_sql (typically Lib.Postgres). This adapter never
// requires `pg` directly - projects not using this store never load
// the driver.
//
// Postgres-specific details:
//   - Identifiers are double-quoted ("col").
//   - Columns use BIGINT for epoch timestamps and VARCHAR(255) for strings.
//   - UPSERT uses ON CONFLICT ("scope", "id") DO UPDATE SET.
//   - CREATE INDEX IF NOT EXISTS is issued alongside CREATE TABLE.
//
// Store contract (identical shape across all adapters):
//   - setupNewStore(instance)                      -> { success, error }
//   - getRecord(instance, scope, key)              -> { success, record, error }
//   - setRecord(instance, scope, key, record)      -> { success, error }
//   - incrementFailCount(instance, scope, key)     -> { success, error }
//   - deleteRecord(instance, scope, key)           -> { success, error }
//   - cleanupExpiredRecords(instance)              -> { success, deleted_count, error }

'use strict';



/////////////////////////// Module-Loader START ////////////////////////////////

/********************************************************************
Thin loader. Validates STORE_CONFIG via the Validators singleton
then delegates to createInterface. Each call returns an independent
Store instance with its own table_name and lib_sql driver reference.

@param {Object} Lib    - Dependency container (Utils, Debug)
@param {Object} CONFIG - Merged module configuration
@param {Object} ERRORS - Error catalog forwarded from verify.js

@return {Object} - Store interface (6 methods: setupNewStore, getRecord, setRecord, incrementFailCount, deleteRecord, cleanupExpiredRecords)
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
@param {Object} ERRORS       - Error catalog forwarded from verify.js

@return {Object} - Store interface (6 methods: setupNewStore, getRecord, setRecord, incrementFailCount, deleteRecord, cleanupExpiredRecords)
*********************************************************************/
const createInterface = function (Lib, STORE_CONFIG, ERRORS) {

  ////////////////////////////// Public Functions START ////////////////////////
  const Store = {


    // ~~~~~~~~~~~~~~~~~~~~ Schema Setup ~~~~~~~~~~~~~~~~~~~~
    // One-shot idempotent DDL executed at application boot before any
    // CRUD call. Creates the table and the expires_at index. Both
    // statements use IF NOT EXISTS so repeated calls are no-ops.

    /********************************************************************
    Idempotent table + index creation. Both statements use
    IF NOT EXISTS so the method is safe to call on every boot.

    @param {Object} instance - Request instance

    @return {Promise<Object>} - { success, error }
    *********************************************************************/
    setupNewStore: async function (instance) {

      // Execute each DDL statement in order (CREATE TABLE, CREATE INDEX)
      for (const stmt of _Store.ddl) {
        const result = await STORE_CONFIG.lib_sql.write(instance, stmt, []);

        // Return a service error if any DDL statement failed
        if (result.success === false) {
          Lib.Debug.debug('Verify postgres setupNewStore failed', {
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
      }

      // Report success - table and index are ready
      return {
        success: true,
        error: null
      };

    },


    // ~~~~~~~~~~~~~~~~~~~~ CRUD ~~~~~~~~~~~~~~~~~~~~
    // Read and write operations against the composite primary key
    // (scope, id). setRecord is an upsert; getRecord returns null
    // on a miss; incrementFailCount is an atomic in-place UPDATE.

    /********************************************************************
    Read by composite primary key (scope, id). Returns null when absent.

    @param {Object} instance - Request instance
    @param {String} scope    - Logical owner namespace
    @param {String} key      - Specific verification purpose

    @return {Promise<Object>} - { success, record, error }
    *********************************************************************/
    getRecord: async function (instance, scope, key) {

      // Fetch the record row by composite primary key
      const result = await STORE_CONFIG.lib_sql.getRow(
        instance,
        'SELECT "code", "fail_count", "created_at", "expires_at"' +
        ' FROM ' + _Store.Q(STORE_CONFIG.table_name) +
        ' WHERE "scope" = ? AND "id" = ?',
        [scope, key]
      );

      // Return a service error if the driver call failed
      if (result.success === false) {
        Lib.Debug.debug('Verify postgres getRecord failed', {
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
      return {
        success: true,
        record: result.row || null,
        error: null
      };

    },


    /********************************************************************
    Upsert via INSERT ... ON CONFLICT DO UPDATE SET. A second call
    with the same (scope, id) key replaces the mutable columns in
    a single round-trip.

    @param {Object} instance - Request instance
    @param {String} scope    - Logical owner namespace
    @param {String} key      - Specific verification purpose
    @param {Object} record   - { code, fail_count, created_at, expires_at }

    @return {Promise<Object>} - { success, error }
    *********************************************************************/
    setRecord: async function (instance, scope, key, record) {

      // Run the UPSERT with the precomputed template
      const result = await STORE_CONFIG.lib_sql.write(
        instance,
        _Store.upsert_sql,
        [scope, key, record.code, record.fail_count, record.created_at, record.expires_at]
      );

      // Return a service error if the driver call failed
      if (result.success === false) {
        Lib.Debug.debug('Verify postgres setRecord failed', {
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
    Atomic fail-counter increment via in-place UPDATE. Safe under
    concurrent verify attempts - each call adds exactly 1.

    @param {Object} instance - Request instance
    @param {String} scope    - Logical owner namespace
    @param {String} key      - Specific verification purpose

    @return {Promise<Object>} - { success, error }
    *********************************************************************/
    incrementFailCount: async function (instance, scope, key) {

      // Atomically increment the fail_count column for this record
      const result = await STORE_CONFIG.lib_sql.write(
        instance,
        'UPDATE ' + _Store.Q(STORE_CONFIG.table_name) +
        ' SET "fail_count" = "fail_count" + 1' +
        ' WHERE "scope" = ? AND "id" = ?',
        [scope, key]
      );

      // Return a service error if the driver call failed
      if (result.success === false) {
        Lib.Debug.debug('Verify postgres incrementFailCount failed', {
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
    Idempotent delete by composite key. A missing row is treated as
    success so callers do not need to check existence first.

    @param {Object} instance - Request instance
    @param {String} scope    - Logical owner namespace
    @param {String} key      - Specific verification purpose

    @return {Promise<Object>} - { success, error }
    *********************************************************************/
    deleteRecord: async function (instance, scope, key) {

      // Remove the record row by composite primary key
      const result = await STORE_CONFIG.lib_sql.write(
        instance,
        'DELETE FROM ' + _Store.Q(STORE_CONFIG.table_name) +
        ' WHERE "scope" = ? AND "id" = ?',
        [scope, key]
      );

      // Return a service error if the driver call failed
      if (result.success === false) {
        Lib.Debug.debug('Verify postgres deleteRecord failed', {
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


    // ~~~~~~~~~~~~~~~~~~~~ Lifecycle ~~~~~~~~~~~~~~~~~~~~
    // Background sweep for expired rows. Postgres has no auto-TTL,
    // so cleanupExpiredRecords (run on a cron) is the garbage-
    // collection path. The expires_at index keeps this an efficient
    // range scan even as the table grows.

    /********************************************************************
    Sweep expired records. Uses the expires_at index for an efficient
    range scan. Run on a cron for garbage collection.

    @param {Object} instance - Request instance

    @return {Promise<Object>} - { success, deleted_count, error }
    *********************************************************************/
    cleanupExpiredRecords: async function (instance) {

      // Sweep all rows whose expires_at is in the past
      const now = instance.time;
      const result = await STORE_CONFIG.lib_sql.write(
        instance,
        'DELETE FROM ' + _Store.Q(STORE_CONFIG.table_name) +
        ' WHERE "expires_at" < ?',
        [now]
      );

      // Return a service error if the driver call failed
      if (result.success === false) {
        Lib.Debug.debug('Verify postgres cleanupExpiredRecords failed', {
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
        deleted_count: result.affected_rows || 0,
        error: null
      };

    }

  };////////////////////////////// Public Functions END ////////////////////////



  ///////////////////////////// Private Functions START ////////////////////////
  const _Store = {


    /********************************************************************
    Quote an identifier using Postgres double-quote style. The
    table_name arrives from STORE_CONFIG, so this guard makes
    identifier injection impossible even if the caller passes a
    crafted table name.

    @param {String} name - Identifier (table or column)

    @return {String} - Quoted identifier
    *********************************************************************/
    Q: function (name) {

      // Reject identifiers that would break the double-quote escaping
      if (name.indexOf('"') !== -1) {
        throw new Error('[js-server-helper-verify-store-postgres] identifier contains double-quote: ' + name);
      }

      // Wrap in Postgres double-quote style
      return '"' + name + '"';

    },


    /********************************************************************
    Build the CREATE TABLE + CREATE INDEX DDL array. Idempotent via
    IF NOT EXISTS. Called once at createInterface time.
    Closes over STORE_CONFIG from createInterface.

    @return {Array<String>} - [CREATE TABLE stmt, CREATE INDEX stmt]
    *********************************************************************/
    buildDDL: function () {

      // Build the quoted table name and deterministic index name
      const Q = _Store.Q;
      const t = Q(STORE_CONFIG.table_name);
      const idx = Q(STORE_CONFIG.table_name + '_expires_at_idx');

      return [
        'CREATE TABLE IF NOT EXISTS ' + t + ' (' +
        '  "scope"      VARCHAR(255) NOT NULL,' +
        '  "id"         VARCHAR(255) NOT NULL,' +
        '  "code"       VARCHAR(255) NOT NULL,' +
        '  "fail_count" INTEGER      NOT NULL DEFAULT 0,' +
        '  "created_at" BIGINT       NOT NULL,' +
        '  "expires_at" BIGINT       NOT NULL,' +
        '  PRIMARY KEY ("scope", "id")' +
        ')',
        'CREATE INDEX IF NOT EXISTS ' + idx + ' ON ' + t + ' ("expires_at")'
      ];

    },


    /********************************************************************
    Build the Postgres UPSERT statement. Uses
      INSERT ... ON CONFLICT (scope, id) DO UPDATE SET col = excluded.col
    Called once at createInterface time.
    Closes over STORE_CONFIG from createInterface.

    @return {String} - SQL template using `?` placeholders
    *********************************************************************/
    buildUpsertSQL: function () {

      // Build the quoted table name then emit the full UPSERT template
      const t = _Store.Q(STORE_CONFIG.table_name);
      return (
        'INSERT INTO ' + t +
        ' ("scope", "id", "code", "fail_count", "created_at", "expires_at")' +
        ' VALUES (?, ?, ?, ?, ?, ?)' +
        ' ON CONFLICT ("scope", "id") DO UPDATE SET' +
        ' "code" = excluded."code",' +
        ' "fail_count" = excluded."fail_count",' +
        ' "created_at" = excluded."created_at",' +
        ' "expires_at" = excluded."expires_at"'
      );

    }

  };///////////////////////////// Private Functions END ////////////////////////


  // Precompute the DDL array and UPSERT template once per instance.
  // Non-trivial string builds called on every setupNewStore / setRecord.
  _Store.ddl = _Store.buildDDL();
  _Store.upsert_sql = _Store.buildUpsertSQL();

  return Store;

};///////////////////////////// createInterface END /////////////////////////////
