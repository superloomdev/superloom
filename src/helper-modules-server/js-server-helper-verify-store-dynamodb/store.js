// Info: DynamoDB store adapter for js-server-helper-verify.
// Schema:
//   PK: scope (S)
//   SK: id    (S)
//   Attributes: code (S), fail_count (N), created_at (N), expires_at (N)
//
// `expires_at` doubles as the DynamoDB TTL attribute - if the deployer
// enables the table-level TTL on `expires_at`, AWS will sweep records
// within ~48 hours of expiry. The verify module's consume-time
// `instance.time > record.expires_at` check guarantees correctness even
// if cleanup runs late.
//
// The application injects a ready-to-use DynamoDB helper via
// STORE_CONFIG.lib_dynamodb (typically Lib.DynamoDB).
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
Store instance with its own table_name and lib_dynamodb reference.

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
Builds the public Store interface for one instance. All functions
close over the same Lib, STORE_CONFIG, and ERRORS.

@param {Object} Lib          - Dependency container (Utils, Debug)
@param {Object} STORE_CONFIG - { table_name, lib_dynamodb }
@param {Object} ERRORS       - Error catalog forwarded from verify.js

@return {Object} - Store interface (6 methods: setupNewStore, getRecord, setRecord, incrementFailCount, deleteRecord, cleanupExpiredRecords)
*********************************************************************/
const createInterface = function (Lib, STORE_CONFIG, ERRORS) {

  ////////////////////////////// Public Functions START ////////////////////////
  const Store = {


    // ~~~~~~~~~~~~~~~~~~~~ Schema Setup ~~~~~~~~~~~~~~~~~~~~

    /********************************************************************
    Idempotent table provisioning. Pay-per-request billing is the
    correct default for a bursty verification workload.

    @param {Object} instance - Request instance

    @return {Promise<Object>} - { success, error }
    *********************************************************************/
    setupNewStore: async function (instance) {

      // Provision the table idempotently with composite key {scope, id}
      const result = await STORE_CONFIG.lib_dynamodb.createTable(instance, STORE_CONFIG.table_name, {
        attribute_definitions: [
          { name: 'scope', type: 'S' },
          { name: 'id',    type: 'S' }
        ],
        key_schema: [
          { name: 'scope', type: 'HASH' },
          { name: 'id',    type: 'RANGE' }
        ],
        billing_mode: 'PAY_PER_REQUEST'
      });

      // Return a service error if the driver call failed
      if (result.success === false) {
        Lib.Debug.debug('Verify dynamodb setupNewStore failed', {
          type: ERRORS.SERVICE_UNAVAILABLE.type,
          driver_type: result.error && result.error.type,
          driver_message: result.error && result.error.message
        });
        return {
          success: false,
          error: ERRORS.SERVICE_UNAVAILABLE
        };
      }

      // Report success - table is ready
      return {
        success: true,
        error: null
      };

    },


    // ~~~~~~~~~~~~~~~~~~~~ CRUD ~~~~~~~~~~~~~~~~~~~~

    /********************************************************************
    Direct GetItem on the composite key. Returns null when absent.

    @param {Object} instance - Request instance
    @param {String} scope    - Logical owner namespace
    @param {String} key      - Specific verification purpose

    @return {Promise<Object>} - { success, record, error }
    *********************************************************************/
    getRecord: async function (instance, scope, key) {

      // Direct GetItem on the composite key
      const result = await STORE_CONFIG.lib_dynamodb.getRecord(
        instance,
        STORE_CONFIG.table_name,
        { scope: scope, id: key }
      );

      // Return a service error if the driver call failed
      if (result.success === false) {
        Lib.Debug.debug('Verify dynamodb getRecord failed', {
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

      // Return early when the item does not exist
      if (result.item === null || result.item === undefined) {
        return {
          success: true,
          record: null,
          error: null
        };
      }

      // Map the DynamoDB item to the canonical record shape
      return {
        success: true,
        record: {
          code: result.item.code,
          fail_count: result.item.fail_count,
          created_at: result.item.created_at,
          expires_at: result.item.expires_at
        },
        error: null
      };

    },


    /********************************************************************
    Upsert via PutItem. DynamoDB always overwrites by composite key.

    @param {Object} instance - Request instance
    @param {String} scope    - Logical owner namespace
    @param {String} key      - Specific verification purpose
    @param {Object} record   - { code, fail_count, created_at, expires_at }

    @return {Promise<Object>} - { success, error }
    *********************************************************************/
    setRecord: async function (instance, scope, key, record) {

      // Build the full DynamoDB item with composite key included
      const item = {
        scope: scope,
        id: key,
        code: record.code,
        fail_count: record.fail_count,
        created_at: record.created_at,
        expires_at: record.expires_at
      };

      // PutItem - DynamoDB always overwrites by composite key
      const result = await STORE_CONFIG.lib_dynamodb.writeRecord(
        instance,
        STORE_CONFIG.table_name,
        item
      );

      // Return a service error if the driver call failed
      if (result.success === false) {
        Lib.Debug.debug('Verify dynamodb setRecord failed', {
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
    Atomic ADD via the helper's increment parameter.

    @param {Object} instance - Request instance
    @param {String} scope    - Logical owner namespace
    @param {String} key      - Specific verification purpose

    @return {Promise<Object>} - { success, error }
    *********************************************************************/
    incrementFailCount: async function (instance, scope, key) {

      // Atomic ADD via the helper's increment parameter
      const result = await STORE_CONFIG.lib_dynamodb.updateRecord(
        instance,
        STORE_CONFIG.table_name,
        { scope: scope, id: key },
        null,
        null,
        { fail_count: 1 }
      );

      // Return a service error if the driver call failed
      if (result.success === false) {
        Lib.Debug.debug('Verify dynamodb incrementFailCount failed', {
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
    Idempotent delete.

    @param {Object} instance - Request instance
    @param {String} scope    - Logical owner namespace
    @param {String} key      - Specific verification purpose

    @return {Promise<Object>} - { success, error }
    *********************************************************************/
    deleteRecord: async function (instance, scope, key) {

      // DeleteItem by composite key - idempotent (missing item is success)
      const result = await STORE_CONFIG.lib_dynamodb.deleteRecord(
        instance,
        STORE_CONFIG.table_name,
        { scope: scope, id: key }
      );

      // Return a service error if the driver call failed
      if (result.success === false) {
        Lib.Debug.debug('Verify dynamodb deleteRecord failed', {
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

    /********************************************************************
    Explicit sweep. Scan with a FilterExpression then batch-delete the
    matching keys. The native TTL on `expires_at` is the primary
    mechanism; this method supports explicit lifecycle control.

    @param {Object} instance - Request instance

    @return {Promise<Object>} - { success, deleted_count, error }
    *********************************************************************/
    cleanupExpiredRecords: async function (instance) {

      // Scan for all items whose expires_at is in the past
      const now = instance.time;
      const scan_result = await STORE_CONFIG.lib_dynamodb.scan(
        instance,
        STORE_CONFIG.table_name,
        {
          expression: '#ea < :now',
          names: { '#ea': 'expires_at' },
          values: { ':now': now }
        }
      );

      // Return a service error if the scan failed
      if (scan_result.success === false) {
        Lib.Debug.debug('Verify dynamodb cleanupExpiredRecords scan failed', {
          type: ERRORS.SERVICE_UNAVAILABLE.type,
          driver_type: scan_result.error && scan_result.error.type,
          driver_message: scan_result.error && scan_result.error.message
        });
        return {
          success: false,
          deleted_count: 0,
          error: ERRORS.SERVICE_UNAVAILABLE
        };
      }

      // Short-circuit when no expired items were found
      if (scan_result.items.length === 0) {
        return {
          success: true,
          deleted_count: 0,
          error: null
        };
      }

      // Batch-delete the expired keys in one round-trip
      const keysByTable = {};
      keysByTable[STORE_CONFIG.table_name] = scan_result.items.map(function (item) {
        return { scope: item.scope, id: item.id };
      });

      const delete_result = await STORE_CONFIG.lib_dynamodb.batchDeleteRecords(
        instance,
        keysByTable
      );

      // Return a service error if the batch delete failed
      if (delete_result.success === false) {
        Lib.Debug.debug('Verify dynamodb cleanupExpiredRecords batchDelete failed', {
          type: ERRORS.SERVICE_UNAVAILABLE.type,
          driver_type: delete_result.error && delete_result.error.type,
          driver_message: delete_result.error && delete_result.error.message
        });
        return {
          success: false,
          deleted_count: 0,
          error: ERRORS.SERVICE_UNAVAILABLE
        };
      }

      // Report success with the count of expired items removed
      return {
        success: true,
        deleted_count: scan_result.items.length,
        error: null
      };

    }

  };////////////////////////////// Public Functions END ////////////////////////

  return Store;

};///////////////////////////// createInterface END /////////////////////////////
