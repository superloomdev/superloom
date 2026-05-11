// Info: MongoDB wrapper with CRUD, batch, query, scan, and transaction operations. Lazy-loaded native driver.
// Server-only: uses 'mongodb' npm package with connection pooling.
//
// Compatibility: Node.js 20.19+.
//
// Factory pattern: each loader call returns an independent MongoDB interface
// with its own Lib, CONFIG, and per-instance MongoClient.
//
// Lazy-loaded MongoDB driver (stateless, shared across instances):
//   - 'mongodb' -> MongoClient class, used to build the database client
'use strict';

// Shared stateless MongoDB driver (module-level - require() is cached anyway).
let MongoClient = null;



/////////////////////////// Module-Loader START ////////////////////////////////

/********************************************************************
Factory loader. One call = one independent instance with its own
Lib, CONFIG, and MongoDB client.

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
    require('./mongodb.config'),
    config || {}
  );

  // Internal error catalog
  const ERRORS = require('./mongodb.errors');

  // Mutable per-instance state (MongoClient and Db live here)
  const state = {
    client: null,
    db: null
  };

  // Create and return the public interface
  return createInterface(Lib, CONFIG, ERRORS, state);

};///////////////////////////// Module-Loader END ///////////////////////////////



/////////////////////////// createInterface START //////////////////////////////

/********************************************************************
Builds the public interface for one instance. Public and private
functions close over the provided Lib, CONFIG, and state.

@param {Object} Lib - Dependency container (Utils, Debug, Instance)
@param {Object} CONFIG - Merged configuration for this instance
@param {Object} ERRORS - Error catalog for this module
@param {Object} state - Mutable state holder (MongoClient and Db references)

@return {Object} - Public interface for this module
*********************************************************************/
const createInterface = function (Lib, CONFIG, ERRORS, state) {

  ///////////////////////////Public Functions START//////////////////////////////
  const MongoDB = {

    /********************************************************************
    Get a single record from a collection by filter (typically _id).

    @param {Object} instance - Request instance for performance tracing
    @param {String} collection - Collection name
    @param {Object} filter - MongoDB query filter (e.g. { _id: 'abc' }, { email: 'user@test.com' })
    @param {Object} [options] - findOne options
    @param {Object} [options.projection] - Fields to include/exclude (e.g. { name: 1 } include-only, { secret: 0 } exclude)
    @param {Object} [options.sort] - Sort order when multiple match (e.g. { created_at: -1 } descending, { name: 1 } ascending)
    @param {Object} [options.hint] - Index hint to force a specific index

    @return {Promise<Object>} - { success, document, error }
    *********************************************************************/
    getRecord: async function (instance, collection, filter, options) {

      // Ensure MongoDB client is initialized
      await _MongoDB.initIfNot();

      try {

        // Execute findOne command
        const document = await state.db.collection(collection).findOne(filter, options || {});

        // Return successful response with document
        return {
          success: true,
          document: document,
          error: null
        };

      } catch (error) {

        Lib.Debug.debug('MongoDB getRecord failed', {
          type: ERRORS.DATABASE_READ_FAILED.type,
          collection: collection,
          message: error.message,
          code: error.code || null,
          stack: error.stack
        });

        // Return error response
        return {
          success: false,
          document: null,
          error: ERRORS.DATABASE_READ_FAILED
        };

      }

    },


    /********************************************************************
    Write (create or replace) a single record. Always upsert - inserts if
    the filter matches nothing, replaces if it matches. Callers never need
    to think about insert vs replace.

    @param {Object} instance - Request instance for performance tracing
    @param {String} collection - Collection name
    @param {Object} filter - Filter to identify the record (e.g. { _id: 'user_1' })
    @param {Object} document - Full replacement document (no $ operators). Must include _id if filter uses _id.

    @return {Promise<Object>} - { success, matchedCount, modifiedCount, upsertedId, error }
    *********************************************************************/
    writeRecord: async function (instance, collection, filter, document) {

      // Ensure MongoDB client is initialized
      await _MongoDB.initIfNot();

      try {

        // Execute replaceOne with upsert hardcoded to true
        const result = await state.db.collection(collection).replaceOne(filter, document, { upsert: true });

        // Return successful response with operation counts
        return {
          success: true,
          matchedCount: result.matchedCount,
          modifiedCount: result.modifiedCount,
          upsertedId: result.upsertedId || null,
          error: null
        };

      } catch (error) {

        Lib.Debug.debug('MongoDB writeRecord failed', {
          type: ERRORS.DATABASE_WRITE_FAILED.type,
          collection: collection,
          message: error.message,
          code: error.code || null,
          stack: error.stack
        });

        // Return error response
        return {
          success: false,
          matchedCount: null,
          modifiedCount: null,
          upsertedId: null,
          error: ERRORS.DATABASE_WRITE_FAILED
        };

      }

    },


    /********************************************************************
    Delete a single record from a collection.

    @param {Object} instance - Request instance for performance tracing
    @param {String} collection - Collection name
    @param {Object} filter - Filter to match the record (e.g. { _id: 'user_1' }, { email: 'user@test.com' })

    @return {Promise<Object>} - { success, deletedCount, error }
    *********************************************************************/
    deleteRecord: async function (instance, collection, filter) {

      // Ensure MongoDB client is initialized
      await _MongoDB.initIfNot();

      try {

        // Execute deleteOne command
        const result = await state.db.collection(collection).deleteOne(filter);

        // Return successful response with deleted count
        return {
          success: true,
          deletedCount: result.deletedCount,
          error: null
        };

      } catch (error) {

        Lib.Debug.debug('MongoDB deleteRecord failed', {
          type: ERRORS.DATABASE_DELETE_FAILED.type,
          collection: collection,
          message: error.message,
          code: error.code || null,
          stack: error.stack
        });

        // Return error response
        return {
          success: false,
          deletedCount: null,
          error: ERRORS.DATABASE_DELETE_FAILED
        };

      }

    },


    /********************************************************************
    Update fields in a single record.

    @param {Object} instance - Request instance for performance tracing
    @param {String} collection - Collection name
    @param {Object} filter - Filter to match the record (e.g. { _id: 'user_1' })
    @param {Object} update - MongoDB update operators
    @param {Object} [update.$set] - Fields to set { field: value }
    @param {Object} [update.$inc] - Fields to increment/decrement { field: amount } (negative to decrement)
    @param {Object} [update.$unset] - Fields to remove { field: '' }
    @param {Object} [update.$push] - Values to append to arrays { field: value }
    @param {Object} [update.$pull] - Values to remove from arrays { field: value }
    @param {Object} [update.$rename] - Fields to rename { oldName: 'newName' }

    @return {Promise<Object>} - { success, modifiedCount, error }
    *********************************************************************/
    updateRecord: async function (instance, collection, filter, update) {

      // Ensure MongoDB client is initialized
      await _MongoDB.initIfNot();

      try {

        // Execute updateOne command
        const result = await state.db.collection(collection).updateOne(filter, update);

        // Return successful response with modified count
        return {
          success: true,
          modifiedCount: result.modifiedCount,
          error: null
        };

      } catch (error) {

        Lib.Debug.debug('MongoDB updateRecord failed', {
          type: ERRORS.DATABASE_UPDATE_FAILED.type,
          collection: collection,
          message: error.message,
          code: error.code || null,
          stack: error.stack
        });

        // Return error response
        return {
          success: false,
          modifiedCount: null,
          error: ERRORS.DATABASE_UPDATE_FAILED
        };

      }

    },


    /********************************************************************
    Query multiple records from a collection. Requires a non-empty filter
    to prevent accidental full-collection scans. Use scan() for intentional
    full-collection reads.

    @param {Object} instance - Request instance for performance tracing
    @param {String} collection - Collection name
    @param {Object} filter - MongoDB query filter (must not be empty)
    @param {String|Number|Boolean} filter.<field> - Exact match (e.g. { status: 'active' })
    @param {Object} [filter.<field>.$gt] - Greater than (e.g. { age: { $gt: 18 } })
    @param {Object} [filter.<field>.$gte] - Greater than or equal
    @param {Object} [filter.<field>.$lt] - Less than
    @param {Object} [filter.<field>.$lte] - Less than or equal
    @param {Array} [filter.<field>.$in] - Match any value in array (e.g. { status: { $in: ['active', 'pending'] } })
    @param {RegExp|String} [filter.<field>.$regex] - Regular expression match
    @param {Object} [options] - find options
    @param {Number} [options.limit] - Max documents to return
    @param {Object} [options.sort] - Sort order (e.g. { created_at: -1 } descending, { name: 1 } ascending)
    @param {Number} [options.skip] - Number of documents to skip (pagination offset)
    @param {Object} [options.projection] - Fields to include/exclude (e.g. { name: 1 } or { secret: 0 })

    @return {Promise<Object>} - { success, documents, error }
    *********************************************************************/
    query: async function (instance, collection, filter, options) {

      // Safety net: reject empty filter to prevent accidental full-collection scans
      if (Lib.Utils.isEmpty(filter)) {
        throw new TypeError('MongoDB query requires a non-empty filter. Use scan() for intentional full-collection reads.');
      }

      // Ensure MongoDB client is initialized
      await _MongoDB.initIfNot();

      try {

        // Execute find command and convert cursor to array
        const documents = await state.db.collection(collection).find(filter, options || {}).toArray();

        // Return successful response with documents
        return {
          success: true,
          documents: documents,
          error: null
        };

      } catch (error) {

        Lib.Debug.debug('MongoDB query failed', {
          type: ERRORS.DATABASE_QUERY_FAILED.type,
          collection: collection,
          message: error.message,
          code: error.code || null,
          stack: error.stack
        });

        // Return error response
        return {
          success: false,
          documents: null,
          error: ERRORS.DATABASE_QUERY_FAILED
        };

      }

    },


    /********************************************************************
    Count documents matching a filter.

    @param {Object} instance - Request instance for performance tracing
    @param {String} collection - Collection name
    @param {Object} filter - MongoDB query filter (must not be empty). Same filter syntax as query().

    @return {Promise<Object>} - { success, count, error }
    *********************************************************************/
    count: async function (instance, collection, filter) {

      // Safety net: reject empty filter to prevent accidental full-collection counts
      if (Lib.Utils.isEmpty(filter)) {
        throw new TypeError('MongoDB count requires a non-empty filter. Use scan() for full-collection operations.');
      }

      // Ensure MongoDB client is initialized
      await _MongoDB.initIfNot();

      try {

        // Execute countDocuments command
        const count = await state.db.collection(collection).countDocuments(filter);

        // Return successful response with count
        return {
          success: true,
          count: count,
          error: null
        };

      } catch (error) {

        Lib.Debug.debug('MongoDB count failed', {
          type: ERRORS.DATABASE_QUERY_FAILED.type,
          collection: collection,
          message: error.message,
          code: error.code || null,
          stack: error.stack
        });

        // Return error response
        return {
          success: false,
          count: 0,
          error: ERRORS.DATABASE_QUERY_FAILED
        };

      }

    },


    /********************************************************************
    Scan an entire collection. Returns all documents, or documents
    matching an optional filter. Unlike query(), this function permits
    empty filters for intentional full-collection reads.

    Use sparingly on large collections.

    @param {Object} instance - Request instance for performance tracing
    @param {String} collection - Collection name
    @param {Object} [filter] - Optional MongoDB query filter. Same filter syntax as query(). Omit or pass null for all documents.
    @param {Object} [options] - find options
    @param {Number} [options.limit] - Max documents to return
    @param {Object} [options.sort] - Sort order (e.g. { index: -1 } descending, { name: 1 } ascending)
    @param {Number} [options.skip] - Number of documents to skip
    @param {Object} [options.projection] - Fields to include/exclude (e.g. { name: 1 } or { secret: 0 })

    @return {Promise<Object>} - { success, documents, count, error }
    *********************************************************************/
    scan: async function (instance, collection, filter, options) {

      // Ensure MongoDB client is initialized
      await _MongoDB.initIfNot();

      try {

        // Use empty filter if none provided (intentional full-collection scan)
        const query_filter = filter || {};

        // Execute find command and convert cursor to array
        const documents = await state.db.collection(collection).find(query_filter, options || {}).toArray();

        // Return successful response with documents and count
        return {
          success: true,
          documents: documents,
          count: documents.length,
          error: null
        };

      } catch (error) {

        Lib.Debug.debug('MongoDB scan failed', {
          type: ERRORS.DATABASE_READ_FAILED.type,
          collection: collection,
          message: error.message,
          code: error.code || null,
          stack: error.stack
        });

        // Return error response
        return {
          success: false,
          documents: [],
          count: 0,
          error: ERRORS.DATABASE_QUERY_FAILED
        };

      }

    },


    /********************************************************************
    Delete multiple records from a single collection matching a filter.
    MongoDB-unique convenience function - no DynamoDB equivalent exists.
    DynamoDB requires explicit keys for bulk deletes; this uses filter-based
    deleteMany which is native to MongoDB.

    @param {Object} instance - Request instance for performance tracing
    @param {String} collection - Collection name
    @param {Object} filter - MongoDB query filter (must not be empty). Same filter syntax as query().

    @return {Promise<Object>} - { success, deletedCount, error }
    *********************************************************************/
    deleteRecordsByFilter: async function (instance, collection, filter) {

      // Safety net: reject empty filter to prevent accidental full-collection deletes
      if (Lib.Utils.isEmpty(filter)) {
        throw new TypeError('MongoDB deleteRecordsByFilter requires a non-empty filter. This prevents accidental deletion of all documents.');
      }

      // Ensure MongoDB client is initialized
      await _MongoDB.initIfNot();

      try {

        // Execute deleteMany command
        const result = await state.db.collection(collection).deleteMany(filter);

        // Return successful response with deleted count
        return {
          success: true,
          deletedCount: result.deletedCount,
          error: null
        };

      } catch (error) {

        Lib.Debug.debug('MongoDB deleteRecordsByFilter failed', {
          type: ERRORS.DATABASE_DELETE_FAILED.type,
          collection: collection,
          message: error.message,
          code: error.code || null,
          stack: error.stack
        });

        // Return error response
        return {
          success: false,
          deletedCount: null,
          error: ERRORS.DATABASE_DELETE_FAILED
        };

      }

    },


    /********************************************************************
    Batch get multiple records by _id from one or more collections.
    Consistent with DynamoDB batchGetRecords multi-table interface.

    Note: MongoDB does not natively support multi-collection batch get.
    This function internally loops through each collection and merges results.

    @param {Object} instance - Request instance for performance tracing
    @param {Object} idsByCollection - Map of collection names to _id arrays
    @param {Array<String|Number>} idsByCollection.<collectionName> - Array of _id values to fetch

    @return {Promise<Object>} - { success, documents: { collectionName: [...] }, error }
    *********************************************************************/
    batchGetRecords: async function (instance, idsByCollection) {

      // Ensure MongoDB client is initialized
      await _MongoDB.initIfNot();

      try {

        const documents = {};
        const collections = Object.keys(idsByCollection);

        // Loop through each collection and fetch documents by _id list
        for (let i = 0; i < collections.length; i++) {

          const col_name = collections[i];
          const ids = idsByCollection[col_name];

          // Fetch all matching documents from this collection
          documents[col_name] = await state.db.collection(col_name)
            .find({ _id: { $in: ids } })
            .toArray();

        }

        // Return successful response with documents grouped by collection
        return {
          success: true,
          documents: documents,
          error: null
        };

      } catch (error) {

        Lib.Debug.debug('MongoDB batchGetRecords failed', {
          type: ERRORS.DATABASE_BATCH_GET_FAILED.type,
          message: error.message,
          code: error.code || null,
          stack: error.stack
        });

        // Return error response
        return {
          success: false,
          documents: {},
          error: ERRORS.DATABASE_BATCH_GET_FAILED
        };

      }

    },


    /********************************************************************
    Batch write and delete records across one or more collections using
    MongoDB bulkWrite. Supports mixed insertOne and deleteOne operations
    in a single call per collection.

    Consistent with DynamoDB batchWriteAndDeleteRecords multi-table interface.

    Note: MongoDB does not natively support cross-collection bulkWrite.
    This function internally loops through each collection and runs
    bulkWrite per collection.

    @param {Object} instance - Request instance for performance tracing
    @param {Object} operationsByCollection - Map of collection names to operation arrays
    @param {Object[]} operationsByCollection.<collectionName> - Array of operations for this collection
    @param {Object} [operationsByCollection.<collectionName>[]..put] - Document to insert (e.g. { _id: 'x', name: 'New' })
    @param {Object} [operationsByCollection.<collectionName>[]..delete] - Filter to delete (e.g. { _id: 'y' })

    @return {Promise<Object>} - { success, results: { collectionName: { insertedCount, deletedCount } }, error }
    *********************************************************************/
    batchWriteAndDeleteRecords: async function (instance, operationsByCollection) {

      // Ensure MongoDB client is initialized
      await _MongoDB.initIfNot();

      try {

        const results = {};
        const collections = Object.keys(operationsByCollection);

        // Loop through each collection and build bulkWrite operations
        for (let i = 0; i < collections.length; i++) {

          const col_name = collections[i];
          const operations = operationsByCollection[col_name];

          // Convert our simplified format to MongoDB bulkWrite format
          const bulk_ops = [];
          for (let j = 0; j < operations.length; j++) {

            if (operations[j].put) {
              bulk_ops.push({ insertOne: { document: operations[j].put } });
            }
            else if (operations[j].delete) {
              bulk_ops.push({ deleteOne: { filter: operations[j].delete } });
            }

          }

          // Execute bulkWrite for this collection
          const result = await state.db.collection(col_name).bulkWrite(bulk_ops);

          results[col_name] = {
            insertedCount: result.insertedCount,
            deletedCount: result.deletedCount
          };

        }

        // Return successful response with per-collection results
        return {
          success: true,
          results: results,
          error: null
        };

      } catch (error) {

        Lib.Debug.debug('MongoDB batchWriteAndDeleteRecords failed', {
          type: ERRORS.DATABASE_BATCH_WRITE_DELETE_FAILED.type,
          message: error.message,
          code: error.code || null,
          stack: error.stack
        });

        // Return error response
        return {
          success: false,
          results: {},
          error: ERRORS.DATABASE_BATCH_WRITE_DELETE_FAILED
        };

      }

    },


    /********************************************************************
    Batch write (insert) records across one or more collections.
    Consistent with DynamoDB batchWriteRecords multi-table interface.

    Note: MongoDB does not natively support cross-collection insertMany.
    This function internally loops through each collection and runs
    insertMany per collection.

    @param {Object} instance - Request instance for performance tracing
    @param {Object} documentsByCollection - Map of collection names to document arrays
    @param {Object[]} documentsByCollection.<collectionName> - Array of documents to insert (each should include _id)

    @return {Promise<Object>} - { success, results: { collectionName: { insertedCount } }, error }
    *********************************************************************/
    batchWriteRecords: async function (instance, documentsByCollection) {

      // Ensure MongoDB client is initialized
      await _MongoDB.initIfNot();

      try {

        const results = {};
        const collections = Object.keys(documentsByCollection);

        // Loop through each collection and insert documents
        for (let i = 0; i < collections.length; i++) {

          const col_name = collections[i];
          const docs = documentsByCollection[col_name];

          // Execute insertMany for this collection
          const result = await state.db.collection(col_name).insertMany(docs);

          results[col_name] = {
            insertedCount: result.insertedCount
          };

        }

        // Return successful response with per-collection results
        return {
          success: true,
          results: results,
          error: null
        };

      } catch (error) {

        Lib.Debug.debug('MongoDB batchWriteRecords failed', {
          type: ERRORS.DATABASE_BATCH_WRITE_FAILED.type,
          message: error.message,
          code: error.code || null,
          stack: error.stack
        });

        // Return error response
        return {
          success: false,
          results: {},
          error: ERRORS.DATABASE_BATCH_WRITE_FAILED
        };

      }

    },


    /********************************************************************
    Batch delete records by explicit _id from one or more collections.
    Consistent with DynamoDB batchDeleteRecords multi-table interface.

    Note: MongoDB does not natively support cross-collection batch delete.
    This function internally loops through each collection and runs
    deleteMany with an $in filter per collection.

    @param {Object} instance - Request instance for performance tracing
    @param {Object} idsByCollection - Map of collection names to _id arrays
    @param {Array<String|Number>} idsByCollection.<collectionName> - Array of _id values to delete

    @return {Promise<Object>} - { success, results: { collectionName: { deletedCount } }, error }
    *********************************************************************/
    batchDeleteRecords: async function (instance, idsByCollection) {

      // Ensure MongoDB client is initialized
      await _MongoDB.initIfNot();

      try {

        const results = {};
        const collections = Object.keys(idsByCollection);

        // Loop through each collection and delete documents by _id list
        for (let i = 0; i < collections.length; i++) {

          const col_name = collections[i];
          const ids = idsByCollection[col_name];

          // Execute deleteMany with $in filter for this collection
          const result = await state.db.collection(col_name).deleteMany({ _id: { $in: ids } });

          results[col_name] = {
            deletedCount: result.deletedCount
          };

        }

        // Return successful response with per-collection results
        return {
          success: true,
          results: results,
          error: null
        };

      } catch (error) {

        Lib.Debug.debug('MongoDB batchDeleteRecords failed', {
          type: ERRORS.DATABASE_BATCH_DELETE_FAILED.type,
          message: error.message,
          code: error.code || null,
          stack: error.stack
        });

        // Return error response
        return {
          success: false,
          results: {},
          error: ERRORS.DATABASE_BATCH_DELETE_FAILED
        };

      }

    },


    /********************************************************************
    Execute multiple write operations atomically within a transaction.
    All operations succeed or all are rolled back.

    Requires a MongoDB replica set (standalone servers do not support
    transactions). MongoDB Atlas has replica set enabled by default.
    For local Docker, start mongod with --replSet rs0.

    The callback receives the session and db reference. All operations
    inside the callback must pass { session } as an option to participate
    in the transaction.

    @param {Object} instance - Request instance for performance tracing
    @param {Function} callback - async function(session, db) { ... }
    @param {ClientSession} callback.session - MongoDB session. Pass as { session } option to all operations.
    @param {Db} callback.db - MongoDB database reference. Use db.collection('name') to access collections.

    @return {Promise<Object>} - { success, result, error }
    *********************************************************************/
    transactWriteRecords: async function (instance, callback) {

      // Ensure MongoDB client is initialized
      await _MongoDB.initIfNot();

      try {

        // Use the Convenient Transaction API: withSession + withTransaction
        const result = await state.client.withSession(async function (session) {

          return await session.withTransaction(async function () {

            // Execute the caller's operations within the transaction
            return await callback(session, state.db);

          });

        });

        // Return successful response with transaction result
        return {
          success: true,
          result: result || null,
          error: null
        };

      } catch (error) {

        Lib.Debug.debug('MongoDB transactWriteRecords failed', {
          type: ERRORS.DATABASE_TRANSACTION_FAILED.type,
          message: error.message,
          code: error.code || null,
          stack: error.stack
        });

        // Return error response
        return {
          success: false,
          result: null,
          error: ERRORS.DATABASE_TRANSACTION_FAILED
        };

      }

    },


    /********************************************************************
    Create (or verify) an index on a collection. Idempotent - MongoDB's
    createIndex is a no-op when an equivalent index already exists with
    the same name and spec, which means callers can safely invoke this
    at boot time on every startup without worrying about duplicates.

    @param {Object} instance - Request instance for performance tracing
    @param {String} collection - Collection name
    @param {Object} spec - Index key spec (e.g. { field: 1 } ascending, { field: -1 } descending, { field: 'text' } text index)
    @param {Object} [options] - createIndex options
    @param {String} [options.name] - Explicit index name (recommended for idempotency)
    @param {Boolean} [options.unique] - Enforce uniqueness
    @param {Boolean} [options.sparse] - Skip documents missing the indexed field
    @param {Number} [options.expireAfterSeconds] - TTL index (field must be a Date type)

    @return {Promise<Object>} - { success, index_name, error }
    *********************************************************************/
    createIndex: async function (instance, collection, spec, options) {

      void instance;

      // Ensure MongoDB client is initialized
      await _MongoDB.initIfNot();

      try {

        // MongoDB's createIndex returns the index name
        const index_name = await state.db.collection(collection).createIndex(spec, options || {});

        return {
          success: true,
          index_name: index_name,
          error: null
        };

      } catch (error) {

        Lib.Debug.debug('MongoDB createIndex failed', {
          type: ERRORS.DATABASE_WRITE_FAILED.type,
          collection: collection,
          message: error.message,
          code: error.code || null,
          stack: error.stack
        });

        return {
          success: false,
          index_name: null,
          error: ERRORS.DATABASE_WRITE_FAILED
        };

      }

    },


    /********************************************************************
    Close the MongoDB connection for this instance.

    @param {Object} instance - Request instance for performance tracing

    @return {Promise<Object>} - { success, error }
    *********************************************************************/
    close: async function (_instance) {

      try {

        // Close MongoDB client if it exists
        if (!Lib.Utils.isNullOrUndefined(state.client)) {
          await state.client.close();
          state.client = null;
          state.db = null;
        }

        // Return successful response
        return {
          success: true,
          error: null
        };

      } catch (error) {

        Lib.Debug.debug('MongoDB close failed', {
          type: ERRORS.DATABASE_CONNECTION_FAILED.type,
          message: error.message,
          code: error.code || null,
          stack: error.stack
        });

        // Return error response
        return {
          success: false,
          error: ERRORS.DATABASE_READ_FAILED
        };

      }

    }

  };///////////////////////////Public Functions END//////////////////////////////



  //////////////////////////Private Functions START/////////////////////////////
  const _MongoDB = {

    /********************************************************************
    Lazy-load the MongoDB native driver. Shared across every instance
    because the driver module itself is stateless - only MongoClient
    holds per-instance state.

    @return {void}
    *********************************************************************/
    ensureAdapter: function () {

      // MongoClient class (shared across instances)
      if (Lib.Utils.isNullOrUndefined(MongoClient)) {
        MongoClient = require('mongodb').MongoClient;
      }

    },


    /********************************************************************
    Create this instance's MongoClient on first use. Connects to the
    database and caches both client and db references in state.

    @return {Promise<void>}
    *********************************************************************/
    initIfNot: async function () {

      // Already built
      if (!Lib.Utils.isNullOrUndefined(state.client)) {
        return;
      }

      // Adapter must be loaded before client creation
      _MongoDB.ensureAdapter();

      Lib.Debug.performanceAuditLog('Init-Start', 'MongoDB Client', Date.now());

      // Build MongoClient with connection pooling options
      state.client = new MongoClient(CONFIG.CONNECTION_STRING, {
        maxPoolSize: CONFIG.MAX_POOL_SIZE,
        serverSelectionTimeoutMS: CONFIG.SERVER_SELECTION_TIMEOUT
      });

      // Establish connection
      await state.client.connect();

      // Cache the database reference
      state.db = state.client.db(CONFIG.DATABASE_NAME);

      Lib.Debug.performanceAuditLog('Init-End', 'MongoDB Client', Date.now());
      Lib.Debug.debug('MongoDB Client Initialized', {
        database: CONFIG.DATABASE_NAME
      });

    }

  };//////////////////////////Private Functions END/////////////////////////////



  // Return public interface
  return MongoDB;

};/////////////////////////// createInterface END ///////////////////////////////
