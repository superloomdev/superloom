// Info: AWS DynamoDB wrapper with CRUD, batch, and query operations. Lazy-loaded SDK v3.
// Server-only: uses AWS SDK v3 DynamoDB client with explicit credential injection.
//
// Compatibility: Node.js 20.19+.
//
// Factory pattern: each loader call returns an independent DynamoDB interface
// with its own Lib, CONFIG, and per-instance DocumentClient.
//
// Lazy-loaded AWS SDK v3 adapters (stateless, shared across instances):
//   - '@aws-sdk/client-dynamodb' -> DynamoDBClient class, used to build the base client
//   - '@aws-sdk/lib-dynamodb'    -> DynamoDBDocumentClient + Commands, used throughout
'use strict';

// Shared stateless SDK adapters (module-level - require() is cached anyway).
let DynamoDBBaseClient = null;
let DynamoDBLib = null;



/////////////////////////// Module-Loader START ////////////////////////////////

/********************************************************************
Factory loader. One call = one independent instance with its own
Lib, CONFIG, and DynamoDB client.

@param {Object} shared_libs - Lib container with Utils, Debug, Instance
@param {Object} config - Overrides merged over module config defaults

@return {Object} - Public interface for this module
*********************************************************************/
module.exports = function loader (shared_libs, config) {

  // Dependencies for this instance
  const Lib = {
    Utils: shared_libs.Utils,
    Debug: shared_libs.Debug,
    Instance: shared_libs.Instance
  };

  // Merge overrides over defaults
  const CONFIG = Object.assign(
    {},
    require('./dynamodb.config'),
    config || {}
  );

  // Mutable per-instance state (DocumentClient lives here)
  const state = {
    client: null
  };

  // Create and return the public interface
  return createInterface(Lib, CONFIG, state);

};///////////////////////////// Module-Loader END ///////////////////////////////



/////////////////////////// createInterface START //////////////////////////////

/********************************************************************
Builds the public interface for one instance. Public and private
functions close over the provided Lib, CONFIG, and state.

@param {Object} Lib - Dependency container (Utils, Debug, Instance)
@param {Object} CONFIG - Merged configuration for this instance
@param {Object} state - Mutable state holder (e.g. DocumentClient reference)

@return {Object} - Public interface for this module
*********************************************************************/
const createInterface = function (Lib, CONFIG, state) {

  ///////////////////////////Public Functions START//////////////////////////////
  const DynamoDB = {

    // ~~~~~~~~~~~~~~~~~~~~ Builders ~~~~~~~~~~~~~~~~~~~~
    // Pure functions that build service params without I/O.

    /********************************************************************
    Build service params for a Put command.

    @param {String} table - Table name
    @param {Object} data - Item data to store

    @return {Object} - Service params for PutCommand or transactWrite Put
    *********************************************************************/
    commandBuilderForAddRecord: function (table, data) {

      return {
        TableName: table,
        Item: data
      };

    },


    /********************************************************************
    Build service params for a Delete command.

    @param {String} table - Table name
    @param {Object} key - Primary key of record to delete

    @return {Object} - Service params for DeleteCommand or transactWrite Delete
    *********************************************************************/
    commandBuilderForDeleteRecord: function (table, key) {

      return {
        TableName: table,
        Key: key
      };

    },


    /********************************************************************
    Build service params for an Update command. Supports SET, REMOVE, INCREMENT, DECREMENT.

    @param {String} table - Table name
    @param {Object} key - Primary key of record to update
    @param {Object} [update_data] - Key-value pairs to SET
    @param {String[]} [remove_keys] - Keys to REMOVE
    @param {Object} [increment] - Keys to increment { key: amount }
    @param {Object} [decrement] - Keys to decrement { key: amount }
    @param {String} [return_state] - ReturnValues enum: 'ALL_NEW' | 'ALL_OLD' | 'UPDATED_NEW' | 'UPDATED_OLD' | 'NONE'

    Note: The builder currently supports SET, REMOVE, INCREMENT, and DECREMENT.
    Additional DynamoDB operations (list_append, if_not_exists, ADD/DELETE on
    sets, ConditionExpression) will be added to this builder as needed.

    @return {Object} - Service params for UpdateCommand or transactWrite Update
    *********************************************************************/
    commandBuilderForUpdateRecord: function (table, key, update_data, remove_keys, increment, decrement, return_state) {

      // Build update expression, attribute names, and attribute values
      let update_expression = '';
      const update_expression_items = [];
      const names = {};
      const values = {};
      let count = 0;

      // Iterate all keys to be SET (updated with new values)
      // Uses #n1, #n2 for names and :v1, :v2 for values to avoid reserved word conflicts
      for (const set_key in update_data) {
        count++;
        names['#n' + count] = set_key;
        values[':v' + count] = update_data[set_key];
        update_expression_items.push('#n' + count + ' = :v' + count);
      }

      // Iterate all keys to be INCREMENTED
      for (const inc_key in increment) {
        count++;
        names['#n' + count] = inc_key;
        values[':v' + count] = increment[inc_key];
        update_expression_items.push('#n' + count + ' = #n' + count + ' + :v' + count);
      }

      // Iterate all keys to be DECREMENTED
      for (const dec_key in decrement) {
        count++;
        names['#n' + count] = dec_key;
        values[':v' + count] = decrement[dec_key];
        update_expression_items.push('#n' + count + ' = #n' + count + ' - :v' + count);
      }

      // Build SET clause from update expression items
      if (!Lib.Utils.isEmpty(update_expression_items)) {
        update_expression += 'SET ' + update_expression_items.toString();
      }

      // Build REMOVE clause from remove_keys (also use name aliases for safety)
      if (!Lib.Utils.isEmpty(remove_keys)) {
        const remove_aliases = [];
        remove_keys.forEach(function (rk) {
          count++;
          names['#n' + count] = rk;
          remove_aliases.push('#n' + count);
        });
        update_expression += ' REMOVE ' + remove_aliases.toString();
      }

      // Trim leading/trailing whitespace from expression
      update_expression = update_expression.trim();

      // Build service params
      const service_params = {
        TableName: table,
        Key: key,
        UpdateExpression: update_expression,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ReturnValues: 'NONE'
      };

      // Override ReturnValues if specified
      if (!Lib.Utils.isNullOrUndefined(return_state)) {
        service_params.ReturnValues = return_state;
      }

      return service_params;

    },


    // ~~~~~~~~~~~~~~~~~~~~ Command Executors ~~~~~~~~~~~~~~~~~~~~
    // Execute pre-built service params against DynamoDB.

    /********************************************************************
    Execute a pre-built Put command (from commandBuilderForAddRecord).

    @param {Object} instance - Request instance object reference
    @param {Object} service_params - Pre-built service params

    @return {Promise<Object>} - { success, error }
    *********************************************************************/
    commandAddRecord: async function (instance, service_params) {

      // Ensure DynamoDB client is initialized
      _DynamoDB.initIfNot();

      try {

        // Send pre-built Put command
        const command = new DynamoDBLib.PutCommand(service_params);
        await state.client.send(command);

        // Log operation performance
        Lib.Debug.performanceAuditLog('End', 'DynamoDB Put - ' + service_params.TableName, instance['time_ms']);

        return {
          success: true,
          error: null
        };

      }
      catch (error) {

        Lib.Debug.debug('DynamoDB writeRecord failed', { table: service_params.TableName, error: error.message });

        return {
          success: false,
          error: { type: 'PUT_ERROR', message: error.message }
        };

      }

    },


    /********************************************************************
    Execute a pre-built Delete command (from commandBuilderForDeleteRecord).

    @param {Object} instance - Request instance object reference
    @param {Object} service_params - Pre-built service params

    @return {Promise<Object>} - { success, error }
    *********************************************************************/
    commandDeleteRecord: async function (instance, service_params) {

      // Ensure DynamoDB client is initialized
      _DynamoDB.initIfNot();

      try {

        // Send pre-built Delete command
        const command = new DynamoDBLib.DeleteCommand(service_params);
        await state.client.send(command);

        // Log operation performance
        Lib.Debug.performanceAuditLog('End', 'DynamoDB Delete - ' + service_params.TableName, instance['time_ms']);

        return {
          success: true,
          error: null
        };

      }
      catch (error) {

        Lib.Debug.debug('DynamoDB deleteRecord failed', { table: service_params.TableName, error: error.message });

        return {
          success: false,
          error: { type: 'DELETE_ERROR', message: error.message }
        };

      }

    },


    /********************************************************************
    Execute a pre-built Update command (from commandBuilderForUpdateRecord).

    @param {Object} instance - Request instance object reference
    @param {Object} service_params - Pre-built service params

    @return {Promise<Object>} - { success, attributes, error }
    *********************************************************************/
    commandUpdateRecord: async function (instance, service_params) {

      // Ensure DynamoDB client is initialized
      _DynamoDB.initIfNot();

      try {

        // Send pre-built Update command
        const command = new DynamoDBLib.UpdateCommand(service_params);
        const response = await state.client.send(command);

        // Log operation performance
        Lib.Debug.performanceAuditLog('End', 'DynamoDB Update - ' + service_params.TableName, instance['time_ms']);

        // Return updated attributes
        return {
          success: true,
          attributes: response.Attributes || {},
          error: null
        };

      }
      catch (error) {

        Lib.Debug.debug('DynamoDB updateRecord failed', { table: service_params.TableName, error: error.message });

        return {
          success: false,
          attributes: null,
          error: { type: 'UPDATE_ERROR', message: error.message }
        };

      }

    },


    // ~~~~~~~~~~~~~~~~~~~~ Convenience Functions ~~~~~~~~~~~~~~~~~~~~
    // High-level functions that build params then execute.

    /********************************************************************
    Get a single record by primary key.

    @param {Object} instance - Request instance object reference
    @param {String} table - Table name
    @param {Object} key - Primary key { pk, sk } or { id }

    @return {Promise<Object>} - { success, item, error }
    *********************************************************************/
    getRecord: async function (instance, table, key) {

      // Ensure DynamoDB client is initialized
      _DynamoDB.initIfNot();

      try {

        // Build and send Get command
        const command = new DynamoDBLib.GetCommand({ TableName: table, Key: key });
        const response = await state.client.send(command);

        // Log operation performance
        Lib.Debug.performanceAuditLog('End', 'DynamoDB Get - ' + table, instance['time_ms']);

        // Return item if found, null if not
        return {
          success: true,
          item: response.Item || null,
          error: null
        };

      }
      catch (error) {

        Lib.Debug.debug('DynamoDB getRecord failed', { table: table, error: error.message });

        return {
          success: false,
          item: null,
          error: { type: 'GET_ERROR', message: error.message }
        };

      }

    },


    /********************************************************************
    Write (create or replace) a record. Always upsert - inserts if absent,
    replaces if present. DRY: uses commandBuilderForAddRecord + commandAddRecord.

    @param {Object} instance - Request instance object reference
    @param {String} table - Table name
    @param {Object} item - Item to store

    @return {Promise<Object>} - { success, error }
    *********************************************************************/
    writeRecord: async function (instance, table, item) {

      // Build service params using builder (DRY)
      const service_params = DynamoDB.commandBuilderForAddRecord(table, item);

      // Execute using command executor (DRY)
      return DynamoDB.commandAddRecord(instance, service_params);

    },


    /********************************************************************
    Delete a single record. DRY: uses commandBuilderForDeleteRecord + commandDeleteRecord.

    @param {Object} instance - Request instance object reference
    @param {String} table - Table name
    @param {Object} key - Primary key

    @return {Promise<Object>} - { success, error }
    *********************************************************************/
    deleteRecord: async function (instance, table, key) {

      // Build service params using builder (DRY)
      const service_params = DynamoDB.commandBuilderForDeleteRecord(table, key);

      // Execute using command executor (DRY)
      return DynamoDB.commandDeleteRecord(instance, service_params);

    },


    /********************************************************************
    Update an item using structured builder (SET/REMOVE/INCREMENT/DECREMENT).
    DRY: uses commandBuilderForUpdateRecord + commandUpdateRecord.

    @param {Object} instance - Request instance object reference
    @param {String} table - Table name
    @param {Object} key - Primary key
    @param {Object} [update_data] - Key-value pairs to SET
    @param {String[]} [remove_keys] - Keys to REMOVE
    @param {Object} [increment] - Keys to increment { key: amount }
    @param {Object} [decrement] - Keys to decrement { key: amount }
    @param {String} [return_state] - ReturnValues enum

    @return {Promise<Object>} - { success, attributes, error }
    *********************************************************************/
    updateRecord: async function (instance, table, key, update_data, remove_keys, increment, decrement, return_state) {

      // Build service params using builder (DRY)
      const service_params = DynamoDB.commandBuilderForUpdateRecord(
        table, key, update_data, remove_keys, increment, decrement, return_state
      );

      // Execute using command executor (DRY)
      return DynamoDB.commandUpdateRecord(instance, service_params);

    },


    /********************************************************************
    Query items by partition key with full feature set.

    @param {Object} instance - Request instance object reference
    @param {String} table - Table name
    @param {Object} params - Query parameters
    @param {String} params.pk - Partition key value
    @param {String} params.pkName - Partition key attribute name
    @param {String} [params.skCondition] - Sort key condition expression
    @param {Object} [params.skValues] - Sort key expression values
    @param {Number} [params.limit] - Max items to return
    @param {String} [params.indexName] - Global secondary index name
    @param {Object} [params.startKey] - ExclusiveStartKey for pagination
    @param {Boolean} [params.scanForward] - true=ascending, false=descending (default: false)
    @param {String[]} [params.fields] - ProjectionExpression fields list
    @param {String} [params.select] - Select enum: ALL_ATTRIBUTES | COUNT

    @return {Promise<Object>} - { success, items, count, last_key, error }
    *********************************************************************/
    query: async function (instance, table, params) {

      // Ensure DynamoDB client is initialized
      _DynamoDB.initIfNot();

      try {

        // Build base query params with partition key condition
        const service_params = {
          TableName: table,
          KeyConditionExpression: '#pk = :pk' + (params.skCondition ? ' AND ' + params.skCondition : ''),
          ExpressionAttributeNames: { '#pk': params.pkName },
          ExpressionAttributeValues: { ':pk': params.pk },
          ScanIndexForward: false
        };

        // Merge sort key expression values if provided
        if (params.skValues) {
          Object.assign(service_params.ExpressionAttributeValues, params.skValues);
        }

        // Apply limit if provided
        if (params.limit) {
          service_params.Limit = params.limit;
        }

        // Apply secondary index if provided
        if (!Lib.Utils.isNullOrUndefined(params.indexName)) {
          service_params.IndexName = params.indexName;
        }

        // Apply pagination start key if provided
        if (!Lib.Utils.isNullOrUndefined(params.startKey)) {
          service_params.ExclusiveStartKey = params.startKey;
        }

        // Apply sort order (default: descending)
        if (params.scanForward === true) {
          service_params.ScanIndexForward = true;
        }

        // Apply field projection if provided
        if (!Lib.Utils.isEmpty(params.fields)) {
          service_params.ProjectionExpression = params.fields.join(', ');
        }

        // Apply select if provided (e.g., 'COUNT')
        if (!Lib.Utils.isNullOrUndefined(params.select)) {
          service_params.Select = params.select;
        }

        // Send Query command
        const command = new DynamoDBLib.QueryCommand(service_params);
        const response = await state.client.send(command);

        // Log operation performance
        Lib.Debug.performanceAuditLog('End', 'DynamoDB Query - ' + table, instance['time_ms']);

        // Determine last evaluated key for pagination
        const last_key = !Lib.Utils.isNullOrUndefined(response.LastEvaluatedKey)
          ? response.LastEvaluatedKey
          : null;

        return {
          success: true,
          items: response.Items || [],
          count: response.Count,
          last_key: last_key,
          error: null
        };

      }
      catch (error) {

        Lib.Debug.debug('DynamoDB query failed', { table: table, error: error.message });

        return {
          success: false,
          items: [],
          count: 0,
          last_key: null,
          error: { type: 'QUERY_ERROR', message: error.message }
        };

      }

    },


    /********************************************************************
    Count records matching a partition key (uses query with SELECT='COUNT').

    @param {Object} instance - Request instance object reference
    @param {String} table - Table name
    @param {Object} params - Same as query params (pk, pkName, skCondition, skValues, indexName)

    @return {Promise<Object>} - { success, count, error }
    *********************************************************************/
    count: async function (instance, table, params) {

      // Set select to COUNT and delegate to query (DRY)
      params.select = 'COUNT';
      const result = await DynamoDB.query(instance, table, params);

      return {
        success: result.success,
        count: result.count,
        error: result.error
      };

    },


    /********************************************************************
    Scan entire table (use sparingly on large tables).

    @param {Object} instance - Request instance object reference
    @param {String} table - Table name
    @param {Object} [filter] - Filter expression { expression, names, values }

    @return {Promise<Object>} - { success, items, count, error }
    *********************************************************************/
    scan: async function (instance, table, filter) {

      // Ensure DynamoDB client is initialized
      _DynamoDB.initIfNot();

      try {

        // Build base scan params
        const service_params = { TableName: table };

        // Apply filter expression if provided
        if (filter) {
          service_params.FilterExpression = filter.expression;
          service_params.ExpressionAttributeNames = filter.names;
          service_params.ExpressionAttributeValues = filter.values;
        }

        // Send Scan command
        const command = new DynamoDBLib.ScanCommand(service_params);
        const response = await state.client.send(command);

        // Log operation performance
        Lib.Debug.performanceAuditLog('End', 'DynamoDB Scan - ' + table, instance['time_ms']);

        return {
          success: true,
          items: response.Items || [],
          count: response.Count,
          error: null
        };

      }
      catch (error) {

        Lib.Debug.debug('DynamoDB scan failed', { table: table, error: error.message });

        return {
          success: false,
          items: [],
          count: 0,
          error: { type: 'SCAN_ERROR', message: error.message }
        };

      }

    },


    /********************************************************************
    Batch get multiple items from one or more tables.

    @param {Object} instance - Request instance object reference
    @param {Object} keysByTable - { tableName: [key1, key2, ...] }

    @return {Promise<Object>} - { success, items, error }
    *********************************************************************/
    batchGetRecords: async function (instance, keysByTable) {

      // Ensure DynamoDB client is initialized
      _DynamoDB.initIfNot();

      try {

        // Build request items map from keys-by-table input
        const requestItems = {};
        Object.keys(keysByTable).forEach(function (table) {
          requestItems[table] = { Keys: keysByTable[table] };
        });

        // Send BatchGet command
        const command = new DynamoDBLib.BatchGetCommand({ RequestItems: requestItems });
        const response = await state.client.send(command);

        // Log operation performance
        Lib.Debug.performanceAuditLog('End', 'DynamoDB BatchGet', instance['time_ms']);

        return {
          success: true,
          items: response.Responses || {},
          error: null
        };

      }
      catch (error) {

        Lib.Debug.debug('DynamoDB batchGetRecords failed', { error: error.message });

        return {
          success: false,
          items: {},
          error: { type: 'BATCH_ERROR', message: error.message }
        };

      }

    },


    /********************************************************************
    Batch write (put/delete) items across one or more tables.

    @param {Object} instance - Request instance object reference
    @param {Object} requestsByTable - { tableName: [{ put: item }, { delete: key }] }

    @return {Promise<Object>} - { success, unprocessed, error }
    *********************************************************************/
    batchWriteAndDeleteRecords: async function (instance, requestsByTable) {

      // Ensure DynamoDB client is initialized
      _DynamoDB.initIfNot();

      try {

        // Transform caller-friendly format into AWS BatchWrite format
        const requestItems = _DynamoDB.buildBatchWriteRequestItems(requestsByTable);

        // Send BatchWrite command
        const command = new DynamoDBLib.BatchWriteCommand({ RequestItems: requestItems });
        const response = await state.client.send(command);

        // Log operation performance
        Lib.Debug.performanceAuditLog('End', 'DynamoDB BatchWrite', instance['time_ms']);

        return {
          success: true,
          unprocessed: response.UnprocessedItems || {},
          error: null
        };

      }
      catch (error) {

        Lib.Debug.debug('DynamoDB batchWriteAndDeleteRecords failed', { error: error.message });

        return {
          success: false,
          unprocessed: {},
          error: { type: 'BATCH_ERROR', message: error.message }
        };

      }

    },


    /********************************************************************
    Batch add (put) records across tables with automatic 25-item chunking.
    AWS BatchWriteItem limit is 25 items per request. This function handles
    any number of items by recursively splitting into 25-item chunks.

    @param {Object} instance - Request instance object reference
    @param {Object} itemsByTable - { tableName: [item1, item2, ...] }

    @return {Promise<Object>} - { success, error }
    *********************************************************************/
    batchWriteRecords: async function (instance, itemsByTable) {

      // Ensure DynamoDB client is initialized
      _DynamoDB.initIfNot();

      // Split items into chunks of 25 and remaining
      const chunk = {};
      const remaining = {};
      let available = 25;

      // Iterate each table and split items within the 25-item limit
      Object.keys(itemsByTable).forEach(function (table) {

        const items = itemsByTable[table];

        if (available <= 0) {
        // No capacity left - entire table goes to remaining
          remaining[table] = items;
          return;
        }

        if (items.length <= available) {
        // All items fit within available capacity
          chunk[table] = items.map(function (item) {
            return { PutRequest: { Item: item } };
          });
          available -= items.length;
        }
        else {
        // Split: first part fits, rest goes to remaining
          chunk[table] = items.slice(0, available).map(function (item) {
            return { PutRequest: { Item: item } };
          });
          remaining[table] = items.slice(available);
          available = 0;
        }

      });

      try {

        // Send current chunk
        const command = new DynamoDBLib.BatchWriteCommand({ RequestItems: chunk });
        await state.client.send(command);

        // Log operation performance
        Lib.Debug.performanceAuditLog('End', 'DynamoDB AddBatchRecords', instance['time_ms']);

        // If remaining items exist, recursively process them
        if (Object.keys(remaining).length > 0) {
          return DynamoDB.batchWriteRecords(instance, remaining);
        }

        return {
          success: true,
          error: null
        };

      }
      catch (error) {

        Lib.Debug.debug('DynamoDB batchWriteRecords failed', { error: error.message });

        return {
          success: false,
          error: { type: 'BATCH_ERROR', message: error.message }
        };

      }

    },


    /********************************************************************
    Batch delete records across tables with automatic 25-item chunking.
    AWS BatchWriteItem limit is 25 items per request. This function handles
    any number of keys by recursively splitting into 25-item chunks.

    @param {Object} instance - Request instance object reference
    @param {Object} keysByTable - { tableName: [key1, key2, ...] }

    @return {Promise<Object>} - { success, error }
    *********************************************************************/
    batchDeleteRecords: async function (instance, keysByTable) {

      // Ensure DynamoDB client is initialized
      _DynamoDB.initIfNot();

      // Split keys into chunks of 25 and remaining
      const chunk = {};
      const remaining = {};
      let available = 25;

      // Iterate each table and split keys within the 25-item limit
      Object.keys(keysByTable).forEach(function (table) {

        const keys = keysByTable[table];

        if (available <= 0) {
        // No capacity left - entire table goes to remaining
          remaining[table] = keys;
          return;
        }

        if (keys.length <= available) {
        // All keys fit within available capacity
          chunk[table] = keys.map(function (key) {
            return { DeleteRequest: { Key: key } };
          });
          available -= keys.length;
        }
        else {
        // Split: first part fits, rest goes to remaining
          chunk[table] = keys.slice(0, available).map(function (key) {
            return { DeleteRequest: { Key: key } };
          });
          remaining[table] = keys.slice(available);
          available = 0;
        }

      });

      try {

        // Send current chunk
        const command = new DynamoDBLib.BatchWriteCommand({ RequestItems: chunk });
        await state.client.send(command);

        // Log operation performance
        Lib.Debug.performanceAuditLog('End', 'DynamoDB DeleteBatchRecords', instance['time_ms']);

        // If remaining keys exist, recursively process them
        if (Object.keys(remaining).length > 0) {
          return DynamoDB.batchDeleteRecords(instance, remaining);
        }

        return {
          success: true,
          error: null
        };

      }
      catch (error) {

        Lib.Debug.debug('DynamoDB batchDeleteRecords failed', { error: error.message });

        return {
          success: false,
          error: { type: 'BATCH_ERROR', message: error.message }
        };

      }

    },


    // ~~~~~~~~~~~~~~~~~~~~ Transactions ~~~~~~~~~~~~~~~~~~~~

    /********************************************************************
    Atomic write transaction across one or more tables. Groups up to 10 actions.
    Uses pre-built command objects from commandBuilderForAddRecord, commandBuilderForDeleteRecord,
    and commandBuilderForUpdateRecord.

    @param {Object} instance - Request instance object reference
    @param {Object[]} [add_records] - Array of Put service params
    @param {Object[]} [update_records] - Array of Update service params
    @param {Object[]} [delete_records] - Array of Delete service params

    @return {Promise<Object>} - { success, error }
    *********************************************************************/
    transactWriteRecords: async function (instance, add_records, update_records, delete_records) {

      // Ensure DynamoDB client is initialized
      _DynamoDB.initIfNot();

      try {

        // Build list of transaction items from pre-built command objects
        const transact_items = [];

        // Insert Put commands
        if (!Lib.Utils.isEmpty(add_records)) {
          add_records.forEach(function (command) {
            transact_items.push({ Put: command });
          });
        }

        // Insert Update commands
        if (!Lib.Utils.isEmpty(update_records)) {
          update_records.forEach(function (command) {
            transact_items.push({ Update: command });
          });
        }

        // Insert Delete commands
        if (!Lib.Utils.isEmpty(delete_records)) {
          delete_records.forEach(function (command) {
            transact_items.push({ Delete: command });
          });
        }

        // Build and send TransactWrite command
        const params = { TransactItems: transact_items };
        const command = new DynamoDBLib.TransactWriteCommand(params);
        await state.client.send(command);

        // Log operation performance
        Lib.Debug.performanceAuditLog('End', 'DynamoDB TransactWrite', instance['time_ms']);

        return {
          success: true,
          error: null
        };

      }
      catch (error) {

        Lib.Debug.debug('DynamoDB transactWriteRecords failed', { error: error.message });

        return {
          success: false,
          error: { type: 'TRANSACT_ERROR', message: error.message }
        };

      }

    }

  };///////////////////////////Public Functions END//////////////////////////////



  //////////////////////////Private Functions START/////////////////////////////
  const _DynamoDB = {

    /********************************************************************
    Transform caller-friendly batch write requests into AWS SDK format.

    Input format (caller-friendly):
    { tableName: [{ put: item }, { delete: key }] }

    Output format (AWS SDK BatchWriteCommand):
    { tableName: [{ PutRequest: { Item: item } }, { DeleteRequest: { Key: key } }] }

    Each request object must have either a 'put' key (for insert/replace) or a
    'delete' key (for removal). Any request without either key is filtered out.

    @param {Object} requestsByTable - Caller-friendly batch write requests
    @return {Object} - AWS SDK-formatted RequestItems
    *********************************************************************/
    buildBatchWriteRequestItems: function (requestsByTable) {

      const requestItems = {};

      // Iterate each table and transform its requests
      Object.keys(requestsByTable).forEach(function (table) {

        requestItems[table] = requestsByTable[table].map(function (req) {

          // Put request - insert or replace an item
          if (req.put) {
            return { PutRequest: { Item: req.put } };
          }

          // Delete request - remove an item by key
          if (req.delete) {
            return { DeleteRequest: { Key: req.delete } };
          }

          // Unknown request type - will be filtered out
          return null;

        }).filter(Boolean);

      });

      return requestItems;

    },


    /********************************************************************
    Lazy-load the AWS SDK v3 adapters. Shared across every instance because
    the SDK modules themselves are stateless - only the DocumentClient
    holds per-instance state.

    @return {void}
    *********************************************************************/
    ensureAdapter: function () {

      // DynamoDBClient class (base client constructor)
      if (Lib.Utils.isNullOrUndefined(DynamoDBBaseClient)) {
        DynamoDBBaseClient = require('@aws-sdk/client-dynamodb').DynamoDBClient;
      }

      // Document Client and Commands (single reference; commands accessed as DynamoDBLib.CommandName)
      if (Lib.Utils.isNullOrUndefined(DynamoDBLib)) {
        DynamoDBLib = require('@aws-sdk/lib-dynamodb');
      }

    },


    /********************************************************************
    Create this instance's DynamoDB Document Client on first use. Options
    are built from the merged CONFIG; explicit credentials and custom
    endpoint (for DynamoDB Local) are injected if present.

    @return {void}
    *********************************************************************/
    initIfNot: function () {

      // Already built
      if (!Lib.Utils.isNullOrUndefined(state.client)) {
        return;
      }

      // Adapter must be loaded before client creation
      _DynamoDB.ensureAdapter();

      Lib.Debug.performanceAuditLog('Init-Start', 'DynamoDB Client', Date.now());

      // Base client options - region and retry config
      const client_options = {
        region: CONFIG.REGION,
        maxAttempts: CONFIG.MAX_RETRIES
      };

      // Inject explicit credentials if provided via config
      if (!Lib.Utils.isNullOrUndefined(CONFIG.KEY) && !Lib.Utils.isNullOrUndefined(CONFIG.SECRET)) {
        client_options.credentials = {
          accessKeyId: CONFIG.KEY,
          secretAccessKey: CONFIG.SECRET
        };
      }

      // Set custom endpoint for DynamoDB Local (emulated testing)
      if (!Lib.Utils.isNullOrUndefined(CONFIG.ENDPOINT)) {
        client_options.endpoint = CONFIG.ENDPOINT;
      }

      // Build base DynamoDB client
      const base_client = new DynamoDBBaseClient(client_options);

      // Document client options - controls marshalling behavior
      const document_options = {
        marshallOptions: {
          removeUndefinedValues: CONFIG.REMOVE_UNDEFINED_VALUES
        }
      };

      // Wrap base client in Document Client for simplified data access
      state.client = DynamoDBLib.DynamoDBDocumentClient.from(base_client, document_options);

      Lib.Debug.performanceAuditLog('Init-End', 'DynamoDB Client', Date.now());
      Lib.Debug.debug('DynamoDB Client Initialized', {
        region: CONFIG.REGION,
        endpoint: CONFIG.ENDPOINT || null
      });

    }

  };//////////////////////////Private Functions END/////////////////////////////



  // Return public interface
  return DynamoDB;

};/////////////////////////// createInterface END ///////////////////////////////
