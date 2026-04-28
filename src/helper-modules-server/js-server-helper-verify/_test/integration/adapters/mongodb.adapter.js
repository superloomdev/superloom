// Info: Verify storage adapter for MongoDB.
// Uses Lib.MongoDB (js-server-helper-nosql-mongodb) which exposes replaceOne
// with upsert support for the setRecord path.
//
// Schema:
//
//   Collection:   verification_codes
//   Document:
//     {
//       _id:        { scope: '<scope>', id: '<key>' },   // compound _id
//       code:       '742856',
//       fail_count: 0,
//       created_at: 1730000000,                            // epoch seconds (Number)
//       expires_at: 1730000300,                            // epoch seconds (Number) - app logic uses this
//       _ttl:       ISODate('2026-04-25T18:25:00Z')        // BSON Date - drives the TTL index
//     }
//
//   Indexes:
//     - _id is unique by definition (compound _id approach)
//     - { _ttl: 1 } with expireAfterSeconds: 0  (native TTL, sweeps every ~60s)
//
// Notes:
//   - Compound _id: order of keys matters in MongoDB equality matches; this adapter
//     always builds them in the same order so lookups are stable.
//   - `_ttl` is a Date because MongoDB's TTL index only fires on Date fields.
//     `expires_at` is also stored as epoch seconds because the verify module reads
//     `record.expires_at`. The leading underscore on `_ttl` signals it is a
//     storage-layer mechanism, not part of the verify contract.
'use strict';



/********************************************************************
Build a Verify-compatible storage adapter for a MongoDB collection.

@param {Object} MongoDB - Lib.MongoDB helper instance
@param {Object} options - Adapter config: { collection } (collection name string)

@return {Object} - Store object with getRecord / setRecord / incrementFailCount / deleteRecord
*********************************************************************/
module.exports = function buildMongoDbAdapter (MongoDB, options) {

  const collection = options.collection;


  return {

    getRecord: async function (instance, scope, key) {

      // Equality lookup on the compound _id - O(1) via the implicit _id index
      const result = await MongoDB.getRecord(instance, collection, { _id: { scope: scope, id: key } });

      if (result.success === false) {
        return { success: false, record: null, error: { type: 'STORE_READ_FAILED', message: result.error.message } };
      }

      // Absent record - verify uses this to decide NOT_FOUND
      if (result.document === null) {
        return { success: true, record: null, error: null };
      }

      // Strip _id and the Date mirror; the verify module only reads the four record fields
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


    setRecord: async function (instance, scope, key, record) {

      // writeRecord is always upsert - covers both fresh-insert and full-overwrite
      // (overwrite happens when the previous record's cooldown has expired)
      const filter = { _id: { scope: scope, id: key } };
      const document = {
        _id: { scope: scope, id: key },
        code: record.code,
        fail_count: record.fail_count,
        created_at: record.created_at,
        expires_at: record.expires_at,
        _ttl: new Date(record.expires_at * 1000)
      };

      const result = await MongoDB.writeRecord(instance, collection, filter, document);

      if (result.success === false) {
        return { success: false, error: { type: 'STORE_WRITE_FAILED', message: result.error.message } };
      }

      return { success: true, error: null };

    },


    incrementFailCount: async function (instance, scope, key) {

      // $inc is atomic - safe under concurrent verify attempts
      const result = await MongoDB.updateRecord(
        instance,
        collection,
        { _id: { scope: scope, id: key } },
        { $inc: { fail_count: 1 } }
      );

      if (result.success === false) {
        return { success: false, error: { type: 'STORE_INCREMENT_FAILED', message: result.error.message } };
      }

      return { success: true, error: null };

    },


    deleteRecord: async function (instance, scope, key) {

      const result = await MongoDB.deleteRecord(instance, collection, { _id: { scope: scope, id: key } });

      if (result.success === false) {
        return { success: false, error: { type: 'STORE_DELETE_FAILED', message: result.error.message } };
      }

      return { success: true, error: null };

    }

  };

};
