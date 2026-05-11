// Info: DynamoDB store adapter for js-server-helper-logger.
//
// Uses a single-table design with composite keys:
//   - pk: "{scope}#{entity_type}#{entity_id}" for entity lookups
//   - sk: sort_key (timestamp-based, descending)
//   - actor_pk: "{scope}#{actor_type}#{actor_id}" for actor lookups (GSI)
//
// Query patterns:
//   - listByEntity: Query on base table (pk prefix)
//   - listByActor: Query on GSI (actor_pk prefix)
//
// The application injects a ready-to-use DynamoDB helper via
// STORE_CONFIG.lib_dynamodb (typically Lib.DynamoDB).
//
// TTL is handled via DynamoDB's native TTL feature on expires_at.
// Enable TTL out-of-band via IaC or AWS Console.
//
// Store contract (identical shape across all adapters):
//   - setupNewStore(instance)                      -> { success, error }
//   - addLog(instance, record)                     -> { success, error }
//   - getLogsByEntity(instance, query)             -> { success, records, next_cursor, error }
//   - getLogsByActor(instance, query)              -> { success, records, next_cursor, error }
//   - cleanupExpiredLogs(instance)                 -> { success, deleted_count, error }

'use strict';



/////////////////////////// Module-Loader START //////////////////////////////

/********************************************************************
Thin loader. Validates STORE_CONFIG via the Validators singleton
then delegates to createInterface. Each call returns an independent
Store instance with its own table_name and lib_dynamodb reference.

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
Builds the public Store interface for one instance. Public and
private functions all close over the same Lib, STORE_CONFIG, and
ERRORS.

@param {Object} Lib          - Dependency container (Utils, Debug)
@param {Object} STORE_CONFIG - { table_name, lib_dynamodb }
@param {Object} ERRORS       - Error catalog forwarded from logger.js

@return {Object} - Store interface (5 methods: setupNewStore, addLog, getLogsByEntity, getLogsByActor, cleanupExpiredLogs)
*********************************************************************/
const createInterface = function (Lib, STORE_CONFIG, ERRORS) {

  ////////////////////////////// Public Functions START ////////////////////////
  const Store = {


    // ~~~~~~~~~~~~~~~~~~~~ Schema Setup ~~~~~~~~~~~~~~~~~~~~
    // DynamoDB tables are typically provisioned via IaC. The adapter
    // assumes the table and GSI exist. setupNewStore() is a no-op that
    // reports success so the logger module's idempotent setup contract
    // is satisfied.

    /********************************************************************
    Idempotent schema setup. DynamoDB tables and GSIs should be
    provisioned out-of-band (IaC, AWS Console, or CloudFormation).
    This method returns success to satisfy the logger module contract.

    @param {Object} instance - Request instance (unused)

    @return {Promise<Object>} - { success, error }
    *********************************************************************/
    setupNewStore: async function (instance) { // eslint-disable-line no-unused-vars

      // Table provisioning is out-of-band for DynamoDB
      // Return success to satisfy the contract
      return {
        success: true,
        error: null
      };

    },


    // ~~~~~~~~~~~~~~~~~~~~ Write ~~~~~~~~~~~~~~~~~~~~
    // Direct PutItem. sort_key contains a random suffix so collisions
    // are effectively impossible - no UPSERT logic needed.

    /********************************************************************
    Append one log record via PutItem. The sort_key contains a random
    suffix making collisions effectively impossible.

    @param {Object} instance - Request instance
    @param {Object} record   - Log record to persist

    @return {Promise<Object>} - { success, error }
    *********************************************************************/
    addLog: async function (instance, record) {

      // Inject DynamoDB composite keys that logger.js does not build.
      // pk is the entity partition key; actor_pk drives the actor GSI.
      const item = Object.assign({}, record, {
        pk:       (record.scope || '') + '#' + record.entity_type + '#' + record.entity_id,
        actor_pk: (record.scope || '') + '#' + record.actor_type  + '#' + record.actor_id
      });

      // Write the record via writeRecord (PutItem wrapper)
      const result = await STORE_CONFIG.lib_dynamodb.writeRecord(
        instance,
        STORE_CONFIG.table_name,
        item
      );

      // Return a service error if the driver call failed
      if (result.success === false) {
        Lib.Debug.debug('Logger dynamodb addLog failed', {
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
    // Entity and actor lookups via Query on base table and GSI.

    /********************************************************************
    Get log records by entity. Queries the base table on pk prefix.
    Supports action filtering, time range, and cursor pagination.

    @param {Object} instance - Request instance
    @param {Object} query    - Query parameters (scope, entity_type, entity_id, etc.)

    @return {Promise<Object>} - { success, records, next_cursor, error }
    *********************************************************************/
    getLogsByEntity: async function (instance, query) {

      return await _Store.listByIndex(instance, query, 'entity');

    },


    /********************************************************************
    Get log records by actor. Queries the GSI on actor_pk prefix.
    Supports action filtering, time range, and cursor pagination.

    @param {Object} instance - Request instance
    @param {Object} query    - Query parameters (scope, actor_type, actor_id, etc.)

    @return {Promise<Object>} - { success, records, next_cursor, error }
    *********************************************************************/
    getLogsByActor: async function (instance, query) {

      return await _Store.listByIndex(instance, query, 'actor');

    },


    // ~~~~~~~~~~~~~~~~~~~~ Lifecycle ~~~~~~~~~~~~~~~~~~~~
    // DynamoDB TTL handles expiration asynchronously (~48h sweep).
    // This method also performs an explicit synchronous scan+delete so
    // the store contract (deleted_count reflects actual deletions) holds.

    /********************************************************************
    Cleanup expired logs. Scans the table for records whose expires_at
    is set and already passed, then batch-deletes them.

    @param {Object} instance - Request instance

    @return {Promise<Object>} - { success, deleted_count, error }
    *********************************************************************/
    cleanupExpiredLogs: async function (instance) {

      // Wall-clock time is correct for expiry checks. instance.time drives record
      // ordering but cleanup must use the real clock so TTL rows expire on schedule.
      const now = Lib.Utils.getUnixTime();

      // Full scan - DynamoDB has no server-side filter on scan without
      // FilterExpression support in this helper, so filter client-side.
      const scan = await STORE_CONFIG.lib_dynamodb.scan(instance, STORE_CONFIG.table_name);
      if (scan.success === false) {
        Lib.Debug.debug('Logger dynamodb cleanupExpiredLogs scan failed', {
          type: ERRORS.SERVICE_UNAVAILABLE.type,
          driver_message: scan.error && scan.error.message
        });
        return { success: false, deleted_count: 0, error: ERRORS.SERVICE_UNAVAILABLE };
      }

      const expired = (scan.items || []).filter(function (item) {
        return typeof item.expires_at === 'number' && item.expires_at > 0 && item.expires_at <= now;
      });

      if (expired.length === 0) {
        return { success: true, deleted_count: 0, error: null };
      }

      const keysByTable = {};
      keysByTable[STORE_CONFIG.table_name] = expired.map(function (item) {
        return { pk: item.pk, sort_key: item.sort_key };
      });

      const del = await STORE_CONFIG.lib_dynamodb.batchDeleteRecords(instance, keysByTable);
      if (del.success === false) {
        Lib.Debug.debug('Logger dynamodb cleanupExpiredLogs delete failed', {
          type: ERRORS.SERVICE_UNAVAILABLE.type,
          driver_message: del.error && del.error.message
        });
        return { success: false, deleted_count: 0, error: ERRORS.SERVICE_UNAVAILABLE };
      }

      return { success: true, deleted_count: expired.length, error: null };

    }


  };////////////////////////////// Public Functions END ////////////////////////



  ///////////////////////////// Private Functions START ////////////////////////
  const _Store = {


    /********************************************************************
    Core list implementation for both entity and actor queries.
    Builds the query dynamically based on query parameters.

    @param {Object} instance - Request instance
    @param {Object} query    - Query parameters
    @param {String} type     - 'entity' or 'actor'

    @return {Promise<Object>} - { success, records, next_cursor, error }
    *********************************************************************/
    listByIndex: async function (instance, query, type) {

      // Build the key prefix based on type
      const prefix = type === 'entity'
        ? query.scope + '#' + query.entity_type + '#' + query.entity_id
        : query.scope + '#' + query.actor_type + '#' + query.actor_id;

      // Determine which index to query
      const useGsi = type === 'actor';

      // Cursor maps to a sort key condition so DynamoDB applies it at the
      // key-condition level (efficient). Use the attribute name directly -
      // the query helper only pre-defines #pk in ExpressionAttributeNames.
      const skCondition = query.cursor ? 'sort_key < :cursor' : null;
      const skValues   = query.cursor ? { ':cursor': query.cursor } : {};

      // Fetch more rows than needed so client-side filters (action, time range)
      // don't starve the page. Cap at 200 per DynamoDB best-practice.
      const page_size = query.limit || 50;
      const fetch_limit = Math.min(page_size * 4 + 1, 200);

      const queryParams = {
        pk: prefix,
        pkName: type === 'entity' ? 'pk' : 'actor_pk',
        skCondition: skCondition,
        skValues: skValues,
        limit: fetch_limit,
        indexName: useGsi ? 'actor_pk-sort_key-index' : null,
        scanForward: false
      };

      // Execute query via the unified query method (supports indexName for GSI)
      const result = await STORE_CONFIG.lib_dynamodb.query(
        instance,
        STORE_CONFIG.table_name,
        queryParams
      );

      // Return a service error if the driver call failed
      if (result.success === false) {
        Lib.Debug.debug('Logger dynamodb listByIndex failed', {
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

      // Apply client-side filters (action list, time range) then paginate
      let items = result.items || [];

      if (query.actions && query.actions.length > 0) {
        const actionSet = {};
        for (let i = 0; i < query.actions.length; i++) {
          actionSet[query.actions[i]] = true;
        }
        items = items.filter(function (item) { return actionSet[item.action]; });
      }

      if (query.start_time_ms !== null && query.start_time_ms !== undefined) {
        items = items.filter(function (item) { return item.created_at_ms >= query.start_time_ms; });
      }

      if (query.end_time_ms !== null && query.end_time_ms !== undefined) {
        items = items.filter(function (item) { return item.created_at_ms <= query.end_time_ms; });
      }

      // Detect next page and slice to requested page size
      const has_more = items.length > page_size;
      const page = has_more ? items.slice(0, page_size) : items;

      // Report success
      return {
        success: true,
        records: page,
        next_cursor: has_more ? page[page.length - 1].sort_key : null,
        error: null
      };

    }


  };///////////////////////////// Private Functions END //////////////////////////


  return Store;

};///////////////////////////// createInterface END /////////////////////////////
