// Info: DynamoDB backend for the verify module.
// Schema:
//   PK: scope (S)
//   SK: id    (S)
//   Attributes: code (S), fail_count (N), created_at (N), expires_at (N)
// `expires_at` doubles as the DynamoDB TTL attribute - if the deployer
// enables the table-level TTL on `expires_at`, AWS will sweep records
// within ~48 hours of expiry. The verify module's consume-time
// `instance.time > record.expires_at` check guarantees correctness even
// if cleanup runs late.
'use strict';


/********************************************************************
Factory for the DynamoDB store.

@param {Object} Lib - Dependency container (Utils, Debug)
@param {Object} store_config - { table_name, lib_dynamodb }

@return {Object} - Store interface
*********************************************************************/
module.exports = function dynamodbStoreFactory (Lib, store_config) {

  if (
    Lib.Utils.isNullOrUndefined(store_config) ||
    !Lib.Utils.isObject(store_config)
  ) {
    throw new Error('[js-server-helper-verify] STORE_CONFIG must be an object for dynamodb');
  }

  if (
    Lib.Utils.isNullOrUndefined(store_config.table_name) ||
    !Lib.Utils.isString(store_config.table_name) ||
    Lib.Utils.isEmptyString(store_config.table_name)
  ) {
    throw new Error('[js-server-helper-verify] STORE_CONFIG.table_name is required for dynamodb');
  }

  if (Lib.Utils.isNullOrUndefined(store_config.lib_dynamodb)) {
    throw new Error('[js-server-helper-verify] STORE_CONFIG.lib_dynamodb is required for dynamodb (pass Lib.DynamoDB)');
  }

  const table_name = store_config.table_name;
  const dynamo = store_config.lib_dynamodb;


  return {


    /********************************************************************
    Idempotent table provisioning. Pay-per-request billing is the
    correct default for a bursty verification workload.
    *********************************************************************/
    initialize: async function (instance) {

      const result = await dynamo.createTable(instance, table_name, {
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

      if (result.success === false) {
        return { success: false, error: result.error };
      }

      return { success: true, error: null };

    },


    /********************************************************************
    Direct GetItem on the composite key.
    *********************************************************************/
    getRecord: async function (instance, scope, key) {

      const result = await dynamo.getRecord(instance, table_name, { scope: scope, id: key });

      if (result.success === false) {
        return { success: false, record: null, error: result.error };
      }

      if (result.item === null || result.item === undefined) {
        return { success: true, record: null, error: null };
      }

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
    *********************************************************************/
    setRecord: async function (instance, scope, key, record) {

      const item = {
        scope: scope,
        id: key,
        code: record.code,
        fail_count: record.fail_count,
        created_at: record.created_at,
        expires_at: record.expires_at
      };

      const result = await dynamo.writeRecord(instance, table_name, item);

      return {
        success: result.success,
        error: result.error || null
      };

    },


    /********************************************************************
    Atomic ADD via the helper's `increment` parameter.
    *********************************************************************/
    incrementFailCount: async function (instance, scope, key) {

      const result = await dynamo.updateRecord(
        instance,
        table_name,
        { scope: scope, id: key },
        null,
        null,
        { fail_count: 1 }
      );

      return {
        success: result.success,
        error: result.error || null
      };

    },


    /********************************************************************
    Idempotent delete.
    *********************************************************************/
    deleteRecord: async function (instance, scope, key) {

      const result = await dynamo.deleteRecord(instance, table_name, { scope: scope, id: key });

      return {
        success: result.success,
        error: result.error || null
      };

    },


    /********************************************************************
    Explicit sweep. Mirrors the auth module's DynamoDB cleanup: scan
    with a FilterExpression aliased through ExpressionAttributeNames
    (DynamoDB rejects empty `names` against attribute references), then
    batch-delete the matching keys.
    *********************************************************************/
    cleanupExpiredRecords: async function (instance) {

      const now = instance.time;

      const scan_result = await dynamo.scan(instance, table_name, {
        expression: '#ea < :now',
        names: { '#ea': 'expires_at' },
        values: { ':now': now }
      });

      if (scan_result.success === false) {
        return { success: false, deleted_count: 0, error: scan_result.error };
      }

      if (scan_result.items.length === 0) {
        return { success: true, deleted_count: 0, error: null };
      }

      const keysByTable = {};
      keysByTable[table_name] = scan_result.items.map(function (item) {
        return { scope: item.scope, id: item.id };
      });

      const delete_result = await dynamo.batchDeleteRecords(instance, keysByTable);
      if (delete_result.success === false) {
        return { success: false, deleted_count: 0, error: delete_result.error };
      }

      return {
        success: true,
        deleted_count: scan_result.items.length,
        error: null
      };

    }


  };

};
