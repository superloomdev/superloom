// Info: MongoDB backend for the verify module. Uses a compound `_id` of
// `{ scope, id }` so reads/writes hit the implicit `_id` index without
// any secondary index. Native TTL is implemented via a `_ttl` Date field
// + a TTL index (`{ _ttl: 1 }, expireAfterSeconds: 0`); the Date mirror
// is the only field MongoDB's TTL sweeper recognises.
//
// `expires_at` (epoch seconds) is stored alongside `_ttl` because the
// verify module reads it directly during the consume-time expiry check.
'use strict';


/********************************************************************
Factory for the MongoDB store.

@param {Object} Lib - Dependency container (Utils, Debug)
@param {Object} store_config - { collection_name, lib_mongodb }

@return {Object} - Store interface
*********************************************************************/
module.exports = function mongodbStoreFactory (Lib, store_config) {

  if (
    Lib.Utils.isNullOrUndefined(store_config) ||
    !Lib.Utils.isObject(store_config)
  ) {
    throw new Error('[js-server-helper-verify] STORE_CONFIG must be an object for mongodb');
  }

  if (
    Lib.Utils.isNullOrUndefined(store_config.collection_name) ||
    !Lib.Utils.isString(store_config.collection_name) ||
    Lib.Utils.isEmptyString(store_config.collection_name)
  ) {
    throw new Error('[js-server-helper-verify] STORE_CONFIG.collection_name is required for mongodb');
  }

  if (Lib.Utils.isNullOrUndefined(store_config.lib_mongodb)) {
    throw new Error('[js-server-helper-verify] STORE_CONFIG.lib_mongodb is required for mongodb (pass Lib.MongoDB)');
  }

  const collection_name = store_config.collection_name;
  const mongo = store_config.lib_mongodb;


  return {


    /********************************************************************
    Idempotent setup. Creates the TTL index on `_ttl`. The compound
    `_id` index is implicit so no second index is needed for the
    primary access path.
    *********************************************************************/
    initialize: async function (instance) {

      const result = await mongo.createIndex(
        instance,
        collection_name,
        { _ttl: 1 },
        { name: 'verify_ttl_idx', expireAfterSeconds: 0 }
      );

      if (result && result.success === false) {
        return { success: false, error: result.error };
      }

      return { success: true, error: null };

    },


    /********************************************************************
    Equality lookup on the compound `_id` - O(1) via the implicit index.
    Returns null when absent.
    *********************************************************************/
    getRecord: async function (instance, scope, key) {

      const result = await mongo.getRecord(instance, collection_name, {
        _id: { scope: scope, id: key }
      });

      if (result.success === false) {
        return { success: false, record: null, error: result.error };
      }

      if (result.document === null || result.document === undefined) {
        return { success: true, record: null, error: null };
      }

      return {
        success: true,
        record: {
          code: result.document.code,
          fail_count: result.document.fail_count,
          created_at: result.document.created_at,
          expires_at: result.document.expires_at
        },
        error: null
      };

    },


    /********************************************************************
    Upsert via replaceOne. The `_ttl` Date is computed from
    `expires_at` so a single source of truth (epoch seconds) feeds
    both the TTL sweeper and the verify-time expiry check.
    *********************************************************************/
    setRecord: async function (instance, scope, key, record) {

      const filter = { _id: { scope: scope, id: key } };
      const document = {
        _id: { scope: scope, id: key },
        code: record.code,
        fail_count: record.fail_count,
        created_at: record.created_at,
        expires_at: record.expires_at,
        _ttl: new Date(record.expires_at * 1000)
      };

      const result = await mongo.writeRecord(instance, collection_name, filter, document);

      if (result.success === false) {
        return { success: false, error: result.error };
      }

      return { success: true, error: null };

    },


    /********************************************************************
    Atomic $inc - safe under concurrent verify attempts.
    *********************************************************************/
    incrementFailCount: async function (instance, scope, key) {

      const result = await mongo.updateRecord(
        instance,
        collection_name,
        { _id: { scope: scope, id: key } },
        { $inc: { fail_count: 1 } }
      );

      if (result.success === false) {
        return { success: false, error: result.error };
      }

      return { success: true, error: null };

    },


    /********************************************************************
    Idempotent delete (missing _id reports success).
    *********************************************************************/
    deleteRecord: async function (instance, scope, key) {

      const result = await mongo.deleteRecord(instance, collection_name, {
        _id: { scope: scope, id: key }
      });

      if (result.success === false) {
        return { success: false, error: result.error };
      }

      return { success: true, error: null };

    },


    /********************************************************************
    Manual sweep mirroring the SQL stores. The native TTL index is the
    primary mechanism, but we expose this so applications relying on
    `cleanupExpiredRecords` for explicit lifecycle control still work.
    *********************************************************************/
    cleanupExpiredRecords: async function (instance) {

      const now = instance.time;

      const result = await mongo.deleteRecordsByFilter(
        instance,
        collection_name,
        { expires_at: { $lt: now } }
      );

      if (result.success === false) {
        return { success: false, deleted_count: 0, error: result.error };
      }

      return {
        success: true,
        deleted_count: result.deletedCount,
        error: null
      };

    }


  };

};
