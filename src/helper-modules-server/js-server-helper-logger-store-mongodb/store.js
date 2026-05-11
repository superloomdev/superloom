// Info: MongoDB store adapter for js-server-helper-logger. Uses sort_key as
// the document `_id` (guaranteed unique per log event). Two compound indexes
// serve the two query paths:
//   - entity_idx: (scope, entity_type, entity_id, sort_key DESC)
//   - actor_idx:  (scope, actor_type, actor_id, sort_key DESC)
//
// TTL is implemented via a `_ttl` Date field + a sparse TTL index
// (expireAfterSeconds: 0). Persistent records (expires_at: null) omit `_ttl`
// entirely so the sparse index skips them.
//
// The application injects a ready-to-use MongoDB helper via
// STORE_CONFIG.lib_mongodb (typically Lib.MongoDB).
//
// Store contract (identical shape across all adapters):
//   - setupNewStore(instance)                      -> { success, error }
//   - addLog(instance, record)                     -> { success, error }
//   - getLogsByEntity(instance, query)             -> { success, records, next_cursor, error }
//   - getLogsByActor(instance, query)              -> { success, records, next_cursor, error }
//   - cleanupExpiredLogs(instance)                 -> { success, deleted_count, error }

'use strict';



/////////////////////////// Module-Loader START ////////////////////////////////

/********************************************************************
Thin loader. Validates STORE_CONFIG via the Validators singleton
then delegates to createInterface. Each call returns an independent
Store instance with its own collection_name and lib_mongodb reference.

@param {Object} Lib    - Dependency container (Utils, Debug)
@param {Object} CONFIG - Merged module configuration
@param {Object} ERRORS - Error catalog forwarded from logger.js

@return {Object} - Store interface (5 methods: setupNewStore, addLog, getLogsByEntity, getLogsByActor, cleanupExpiredLogs)
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
@param {Object} STORE_CONFIG - { collection_name, lib_mongodb }
@param {Object} ERRORS       - Error catalog forwarded from logger.js

@return {Object} - Store interface (5 methods: setupNewStore, addLog, getLogsByEntity, getLogsByActor, cleanupExpiredLogs)
*********************************************************************/
const createInterface = function (Lib, STORE_CONFIG, ERRORS) {

  ////////////////////////////// Public Functions START ////////////////////////
  const Store = {


    // ~~~~~~~~~~~~~~~~~~~~ Schema Setup ~~~~~~~~~~~~~~~~~~~~

    /********************************************************************
    Idempotent index setup. Creates two compound query indexes and one
    sparse TTL index. Safe to call on every boot - createIndex is
    idempotent in MongoDB.

    @param {Object} instance - Request instance

    @return {Promise<Object>} - { success, error }
    *********************************************************************/
    setupNewStore: async function (instance) {

      // Entity query index: (scope, entity_type, entity_id, sort_key DESC)
      const entity_result = await STORE_CONFIG.lib_mongodb.createIndex(
        instance,
        STORE_CONFIG.collection_name,
        { scope: 1, entity_type: 1, entity_id: 1, sort_key: -1 },
        { name: 'logger_entity_idx' }
      );

      if (entity_result && entity_result.success === false) {
        Lib.Debug.debug('Logger mongodb setupNewStore (entity index) failed', {
          type: ERRORS.SERVICE_UNAVAILABLE.type,
          driver_type: entity_result.error && entity_result.error.type,
          driver_message: entity_result.error && entity_result.error.message
        });
        return {
          success: false,
          error: ERRORS.SERVICE_UNAVAILABLE
        };
      }

      // Actor query index: (scope, actor_type, actor_id, sort_key DESC)
      const actor_result = await STORE_CONFIG.lib_mongodb.createIndex(
        instance,
        STORE_CONFIG.collection_name,
        { scope: 1, actor_type: 1, actor_id: 1, sort_key: -1 },
        { name: 'logger_actor_idx' }
      );

      if (actor_result && actor_result.success === false) {
        Lib.Debug.debug('Logger mongodb setupNewStore (actor index) failed', {
          type: ERRORS.SERVICE_UNAVAILABLE.type,
          driver_type: actor_result.error && actor_result.error.type,
          driver_message: actor_result.error && actor_result.error.message
        });
        return {
          success: false,
          error: ERRORS.SERVICE_UNAVAILABLE
        };
      }

      // Sparse TTL index: _ttl Date field, expireAfterSeconds: 0
      // Sparse so persistent records (no _ttl field) are never touched by the sweeper
      const ttl_result = await STORE_CONFIG.lib_mongodb.createIndex(
        instance,
        STORE_CONFIG.collection_name,
        { _ttl: 1 },
        { name: 'logger_ttl_idx', expireAfterSeconds: 0, sparse: true }
      );

      if (ttl_result && ttl_result.success === false) {
        Lib.Debug.debug('Logger mongodb setupNewStore (ttl index) failed', {
          type: ERRORS.SERVICE_UNAVAILABLE.type,
          driver_type: ttl_result.error && ttl_result.error.type,
          driver_message: ttl_result.error && ttl_result.error.message
        });
        return {
          success: false,
          error: ERRORS.SERVICE_UNAVAILABLE
        };
      }

      // Report success - all indexes are ready
      return {
        success: true,
        error: null
      };

    },


    // ~~~~~~~~~~~~~~~~~~~~ Write ~~~~~~~~~~~~~~~~~~~~

    /********************************************************************
    Insert one log record. sort_key is used as `_id` so duplicate
    writes on the same sort_key are idempotent (upsert by _id).

    @param {Object} instance - Request instance
    @param {Object} record   - Canonical log record from logger.js

    @return {Promise<Object>} - { success, error }
    *********************************************************************/
    addLog: async function (instance, record) {

      // Build the MongoDB document from the canonical record
      const document = _Store.recordToDocument(record);

      // Upsert by _id (sort_key) - idempotent for duplicate writes
      const result = await STORE_CONFIG.lib_mongodb.writeRecord(
        instance,
        STORE_CONFIG.collection_name,
        { _id: record.sort_key },
        document
      );

      // Return a service error if the driver call failed
      if (result.success === false) {
        Lib.Debug.debug('Logger mongodb addLog failed', {
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

      return await _Store.listByIndex(instance, query, 'entity');

    },


    /********************************************************************
    List log records for a (scope, actor_type, actor_id) triple.
    Same pagination contract as getLogsByEntity.

    @param {Object} instance - Request instance
    @param {Object} query    - Built by logger.js#buildQuery

    @return {Promise<Object>} - { success, records, next_cursor, error }
    *********************************************************************/
    getLogsByActor: async function (instance, query) {

      return await _Store.listByIndex(instance, query, 'actor');

    },


    // ~~~~~~~~~~~~~~~~~~~~ Cleanup ~~~~~~~~~~~~~~~~~~~~

    /********************************************************************
    Delete all documents whose expires_at is not null and <= now (seconds).
    The native TTL index handles automatic sweeping, but this method
    provides explicit lifecycle control matching the SQL adapters.

    @param {Object} instance - Request instance

    @return {Promise<Object>} - { success, deleted_count, error }
    *********************************************************************/
    cleanupExpiredLogs: async function (instance) {

      // Wall-clock time is correct for expiry checks. instance.time drives record
      // ordering but cleanup must use the real clock so TTL rows expire on schedule.
      const now = Lib.Utils.getUnixTime();
      const result = await STORE_CONFIG.lib_mongodb.deleteRecordsByFilter(
        instance,
        STORE_CONFIG.collection_name,
        { expires_at: { $ne: null, $lte: now } }
      );

      // Return a service error if the driver call failed
      if (result.success === false) {
        Lib.Debug.debug('Logger mongodb cleanupExpiredLogs failed', {
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

      // Report success with the count of expired documents removed
      return {
        success: true,
        deleted_count: result.deletedCount,
        error: null
      };

    }


  };////////////////////////////// Public Functions END ////////////////////////



  ///////////////////////////// Private Functions START ////////////////////////
  const _Store = {


    /********************************************************************
    Core list implementation for both entity and actor queries.
    Builds the MongoDB filter, sort, and limit from query parameters.

    @param {Object} instance - Request instance
    @param {Object} query    - Logger query object
    @param {String} type     - 'entity' or 'actor'

    @return {Promise<Object>} - { success, records, next_cursor, error }
    *********************************************************************/
    listByIndex: async function (instance, query, type) {

      // Build the base filter from the index key
      const filter = { scope: query.scope || '' };

      if (type === 'entity') {
        filter.entity_type = query.entity_type;
        filter.entity_id = query.entity_id;
      } else {
        filter.actor_type = query.actor_type;
        filter.actor_id = query.actor_id;
      }

      // Optional action filter
      if (query.actions && query.actions.length > 0) {
        filter.action = query.actions.length === 1
          ? query.actions[0]
          : { $in: query.actions };
      }

      // Optional time range on created_at_ms
      if (
        (query.start_time_ms !== null && query.start_time_ms !== undefined) ||
        (query.end_time_ms !== null && query.end_time_ms !== undefined)
      ) {
        filter.created_at_ms = {};
        if (query.start_time_ms !== null && query.start_time_ms !== undefined) {
          filter.created_at_ms.$gte = query.start_time_ms;
        }
        if (query.end_time_ms !== null && query.end_time_ms !== undefined) {
          filter.created_at_ms.$lte = query.end_time_ms;
        }
      }

      // Cursor filter: sort_key < cursor means "older than this page"
      if (query.cursor) {
        filter.sort_key = { $lt: query.cursor };
      }

      // Fetch limit+1 rows to detect if there is a next page
      const limit = (query.limit || 50) + 1;

      const result = await STORE_CONFIG.lib_mongodb.query(
        instance,
        STORE_CONFIG.collection_name,
        filter,
        { sort: { sort_key: -1 }, limit: limit }
      );

      // Return a service error if the driver call failed
      if (result.success === false) {
        Lib.Debug.debug('Logger mongodb listByIndex failed', {
          type: ERRORS.SERVICE_UNAVAILABLE.type,
          driver_type: result.error && result.error.type,
          driver_message: result.error && result.error.message,
          query_type: type
        });
        return {
          success: false,
          records: [],
          next_cursor: null,
          error: ERRORS.SERVICE_UNAVAILABLE
        };
      }

      // Detect next page and slice to requested limit
      const items = result.documents || [];
      const page_size = limit - 1;
      const has_more = items.length > page_size;
      const page = has_more ? items.slice(0, page_size) : items;
      const next_cursor = has_more ? page[page.length - 1].sort_key : null;

      // Report success
      return {
        success: true,
        records: page.map(function (doc) { return _Store.documentToRecord(doc); }),
        next_cursor: next_cursor,
        error: null
      };

    },


    /********************************************************************
    Convert a canonical log record to a MongoDB document.
    Adds _id (sort_key) and optional _ttl Date for the TTL sweeper.

    @param {Object} record - Canonical log record from logger.js

    @return {Object} - MongoDB document
    *********************************************************************/
    recordToDocument: function (record) {

      const doc = {
        _id: record.sort_key,
        scope: record.scope,
        entity_type: record.entity_type,
        entity_id: record.entity_id,
        actor_type: record.actor_type,
        actor_id: record.actor_id,
        action: record.action,
        data: record.data !== undefined ? record.data : null,
        ip: record.ip !== undefined ? record.ip : null,
        user_agent: record.user_agent !== undefined ? record.user_agent : null,
        created_at: record.created_at,
        created_at_ms: record.created_at_ms,
        sort_key: record.sort_key,
        expires_at: record.expires_at !== undefined ? record.expires_at : null
      };

      // Only set _ttl when the record actually expires (sparse index skips nulls)
      if (record.expires_at !== null && record.expires_at !== undefined) {
        doc._ttl = new Date(record.expires_at * 1000);
      }

      return doc;

    },


    /********************************************************************
    Convert a MongoDB document back to the canonical record shape.
    Strips internal MongoDB fields (_id, _ttl).

    @param {Object} doc - Raw MongoDB document

    @return {Object} - Canonical log record
    *********************************************************************/
    documentToRecord: function (doc) {

      // Return only the canonical fields, omitting _id and _ttl
      return {
        scope: doc.scope,
        entity_type: doc.entity_type,
        entity_id: doc.entity_id,
        actor_type: doc.actor_type,
        actor_id: doc.actor_id,
        action: doc.action,
        data: doc.data !== undefined ? doc.data : null,
        ip: doc.ip !== undefined ? doc.ip : null,
        user_agent: doc.user_agent !== undefined ? doc.user_agent : null,
        created_at: doc.created_at,
        created_at_ms: doc.created_at_ms,
        sort_key: doc.sort_key,
        expires_at: doc.expires_at !== undefined ? doc.expires_at : null
      };

    }


  };///////////////////////////// Private Functions END //////////////////////////


  return Store;

};///////////////////////////// createInterface END /////////////////////////////
