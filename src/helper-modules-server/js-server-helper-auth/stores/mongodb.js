// Info: MongoDB backend for the auth module. Uses the composite
// `{tenant_id}#{actor_id}#{token_key}#{token_secret_hash}` as the
// document _id so:
//   - Direct reads (getSession) are O(1) against the default _id index
//   - Wrong-secret probes return "not found" without any extra read
//     (the hash is baked into the _id, a mismatch never hits a doc)
//   - listSessionsByActor uses an anchored prefix regex on _id, which
//     the MongoDB query planner serves from the _id B-tree without a
//     collection scan.
//
// The application injects a ready-to-use MongoDB helper via
// CONFIG.STORE_CONFIG.lib_mongodb (typically Lib.MongoDB). The auth
// module never requires `mongodb` directly - projects not using this
// store never load the native driver.
'use strict';


/********************************************************************
Factory for the MongoDB store.

@param {Object} Lib - Dependency container (Utils, Debug)
@param {Object} store_config - { collection_name, lib_mongodb }

@return {Object} - Store interface matching the memory/sql stores
*********************************************************************/
module.exports = function mongodbStoreFactory (Lib, store_config) {

  // Validate store_config
  if (
    Lib.Utils.isNullOrUndefined(store_config) ||
    !Lib.Utils.isObject(store_config)
  ) {
    throw new Error('[js-server-helper-auth] STORE_CONFIG must be an object for mongodb');
  }

  if (
    Lib.Utils.isNullOrUndefined(store_config.collection_name) ||
    !Lib.Utils.isString(store_config.collection_name) ||
    Lib.Utils.isEmptyString(store_config.collection_name)
  ) {
    throw new Error('[js-server-helper-auth] STORE_CONFIG.collection_name is required for mongodb');
  }

  if (Lib.Utils.isNullOrUndefined(store_config.lib_mongodb)) {
    throw new Error('[js-server-helper-auth] STORE_CONFIG.lib_mongodb is required for mongodb (pass Lib.MongoDB)');
  }

  const collection_name = store_config.collection_name;
  const mongo = store_config.lib_mongodb;

  const AuthIdFactory = require('../parts/auth-id');
  const AuthId = AuthIdFactory(Lib);


  /********************************************************************
  Escape a string so it can be used literally inside a regex. We use
  this to build the `^prefix` regex for listSessionsByActor. tenant_id
  and actor_id are already rejected for '-' and '#' via AuthId, but
  regex metacharacters like '.' or '[' would still slip through, so
  we escape aggressively.
  *********************************************************************/
  const escapeRegExp = function (str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };


  /********************************************************************
  Build the document shape persisted by this store. We keep the
  canonical record fields verbatim and add:
    _id: composite key for O(1) reads
    prefix: "{tenant_id}#{actor_id}#" - indexed separately so that
            listSessionsByActor can use an equality-on-prefix match
            which is faster than anchored regex on large collections.

  The prefix field is a denormalised redundant copy of the tenant+actor
  segment already embedded in _id. Writing it explicitly lets us build
  a btree index on it and run exact-match queries (rather than regex).
  *********************************************************************/
  const recordToDoc = function (record) {

    const _id = AuthId.composeMongoId(
      record.tenant_id,
      record.actor_id,
      record.token_key,
      record.token_secret_hash
    );

    const prefix = AuthId.composeMongoActorPrefix(record.tenant_id, record.actor_id);

    return Object.assign({ _id: _id, prefix: prefix }, record);

  };


  /********************************************************************
  Reverse - strip MongoDB-specific keys so the caller gets a clean
  canonical record back.
  *********************************************************************/
  const docToRecord = function (doc) {

    if (doc === null || doc === undefined) {
      return null;
    }

    const rec = Object.assign({}, doc);
    delete rec._id;
    delete rec.prefix;
    return rec;

  };


  return {


    /********************************************************************
    Idempotent setup. Creates:
      - Unique index on _id (MongoDB creates this by default - no-op)
      - B-tree index on prefix for efficient listSessionsByActor
      - B-tree index on expires_at for cleanupExpiredSessions
    MongoDB's createIndex is idempotent when the name matches.
    *********************************************************************/
    initialize: async function (instance) {

      void instance;

      // Prefix index - supports equality-on-prefix listSessionsByActor
      const prefix_result = await mongo.createIndex(
        instance,
        collection_name,
        { prefix: 1 },
        { name: 'auth_prefix_idx' }
      );

      if (prefix_result && prefix_result.success === false) {
        return { success: false, error: prefix_result.error };
      }

      // expires_at index - supports cleanupExpiredSessions
      const expires_result = await mongo.createIndex(
        instance,
        collection_name,
        { expires_at: 1 },
        { name: 'auth_expires_at_idx' }
      );

      if (expires_result && expires_result.success === false) {
        return { success: false, error: expires_result.error };
      }

      return { success: true, error: null };

    },


    /********************************************************************
    Direct read by composite _id. No token_secret_hash compare needed
    here - a mismatch produces the wrong _id and MongoDB returns null,
    which we surface as "not found" (no timing leak).
    *********************************************************************/
    getSession: async function (instance, tenant_id, actor_id, token_key, token_secret_hash) {

      const _id = AuthId.composeMongoId(tenant_id, actor_id, token_key, token_secret_hash);

      const result = await mongo.getRecord(instance, collection_name, { _id: _id });

      if (result.success === false) {
        return { success: false, record: null, error: result.error };
      }

      return {
        success: true,
        record: docToRecord(result.document),
        error: null
      };

    },


    /********************************************************************
    Upsert a session document. Always uses replaceOne+upsert so the
    same (tenant_id, actor_id, token_key, token_secret_hash) quadruple
    yields a single document.
    *********************************************************************/
    setSession: async function (instance, record) {

      const doc = recordToDoc(record);

      const result = await mongo.writeRecord(
        instance,
        collection_name,
        { _id: doc._id },
        doc
      );

      if (result.success === false) {
        return { success: false, error: result.error };
      }

      return { success: true, error: null };

    },


    /********************************************************************
    Delete by (tenant_id, actor_id, token_key). The token_secret_hash
    is NOT in the caller's hand here (it's only in the stored doc), so
    we use an anchored prefix query instead of an exact _id - there is
    at most one document matching this prefix (because the {actor_id +
    token_key} portion of _id is unique under a given tenant_id).
    *********************************************************************/
    deleteSession: async function (instance, tenant_id, actor_id, token_key) {

      const prefix = tenant_id + '#' + actor_id + '#' + token_key + '#';
      const anchored = new RegExp('^' + escapeRegExp(prefix));

      const result = await mongo.deleteRecordsByFilter(
        instance,
        collection_name,
        { _id: anchored }
      );

      if (result.success === false) {
        return { success: false, error: result.error };
      }

      return { success: true, error: null };

    },


    /********************************************************************
    Delete many sessions by a list of { actor_id, token_key } pairs.
    Batched into one deleteMany by building an $or over all the _id
    prefixes.
    *********************************************************************/
    deleteSessions: async function (instance, tenant_id, keys) {

      if (keys.length === 0) {
        return { success: true, error: null };
      }

      const or_clauses = keys.map(function (k) {
        const prefix = tenant_id + '#' + k.actor_id + '#' + k.token_key + '#';
        return { _id: new RegExp('^' + escapeRegExp(prefix)) };
      });

      const result = await mongo.deleteRecordsByFilter(
        instance,
        collection_name,
        { $or: or_clauses }
      );

      if (result.success === false) {
        return { success: false, error: result.error };
      }

      return { success: true, error: null };

    },


    /********************************************************************
    List all sessions for (tenant_id, actor_id). Uses equality on the
    pre-computed `prefix` field so we hit the B-tree index directly
    (faster than anchored regex on _id for large collections).
    *********************************************************************/
    listSessionsByActor: async function (instance, tenant_id, actor_id) {

      const prefix = AuthId.composeMongoActorPrefix(tenant_id, actor_id);

      const result = await mongo.query(
        instance,
        collection_name,
        { prefix: prefix }
      );

      if (result.success === false) {
        return { success: false, records: null, error: result.error };
      }

      const records = result.documents.map(docToRecord);

      return { success: true, records: records, error: null };

    },


    /********************************************************************
    Partial update - uses $set. Identity-column guard mirrors the SQL
    store so programmer errors fail fast.
    *********************************************************************/
    updateSessionActivity: async function (instance, tenant_id, actor_id, token_key, updates) {

      const update_keys = Object.keys(updates);
      if (update_keys.length === 0) {
        return { success: true, error: null };
      }

      for (const k of update_keys) {
        if (
          k === 'tenant_id' || k === 'actor_id' || k === 'actor_type' ||
          k === 'token_key' || k === 'token_secret_hash' ||
          k === 'created_at' || k === 'install_id' ||
          k === 'install_platform' || k === 'install_form_factor' ||
          k === '_id' || k === 'prefix'
        ) {
          return {
            success: false,
            error: {
              type: 'UPDATE_FORBIDDEN_FIELD',
              message: 'updateSessionActivity cannot modify field ' + k
            }
          };
        }
      }

      // Find the document by (tenant+actor+token_key) prefix then update.
      // We need the full _id (which includes the hash) to target exactly
      // one doc via updateOne. Since deleteSession uses the same prefix
      // pattern, we mirror that logic: updateRecord with a regex filter.
      const prefix = tenant_id + '#' + actor_id + '#' + token_key + '#';
      const anchored = new RegExp('^' + escapeRegExp(prefix));

      const result = await mongo.updateRecord(
        instance,
        collection_name,
        { _id: anchored },
        { $set: updates }
      );

      if (result.success === false) {
        return { success: false, error: result.error };
      }

      return { success: true, error: null };

    },


    /********************************************************************
    Sweep expired sessions using the expires_at index.
    *********************************************************************/
    cleanupExpiredSessions: async function (instance) {

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
