// Info: MongoDB session store adapter for js-server-helper-auth.
// Uses the composite
//   "{tenant_id}#{actor_id}#{token_key}#{token_secret_hash}"
// as the document _id so:
//   - Direct reads (getSession) are O(1) against the default _id index
//   - Wrong-secret probes return "not found" without any extra read
//     (the hash is baked into _id, a mismatch never hits a doc)
//   - listSessionsByActor uses equality on an indexed `prefix` field,
//     hitting the B-tree directly without a regex or collection scan
//
// The application injects a ready-to-use MongoDB helper via
// STORE_CONFIG.lib_mongodb (typically Lib.MongoDB). This adapter never
// requires `mongodb` directly - projects not using this store never
// load the native driver.
//
// Schema management (collection creation, secondary indexes, TTL) is
// out of scope for this adapter. MongoDB auto-creates the collection on
// first write. Secondary indexes on `prefix` and a Date-typed TTL field
// must be provisioned out-of-band until the MongoDB helper exposes a
// schema-management API. setupNewStore() exists in the interface contract
// but is not yet implemented and returns NOT_IMPLEMENTED.
//
// Store contract (identical shape across all adapters):
//   - setupNewStore(instance)            -> { success, error }  (NOT_IMPLEMENTED)
//   - getSession(instance, t, a, k, h)  -> { success, record, error }
//   - listSessionsByActor(instance, t, a) -> { success, records, error }
//   - setSession(instance, record)      -> { success, error }
//   - updateSessionActivity(instance, t, a, k, updates) -> { success, error }
//   - deleteSession(instance, t, a, k)  -> { success, error }
//   - deleteSessions(instance, t, keys) -> { success, error }
//   - cleanupExpiredSessions(instance)  -> { success, deleted_count, error }

'use strict';



/////////////////////////// Module-Loader START ////////////////////////////////

/********************************************************************
Thin loader. Validates STORE_CONFIG via the Validators singleton
then delegates to createInterface. Each call returns an independent
Store instance with its own collection_name and lib_mongodb reference.

@param {Object} Lib    - Dependency container (Utils, Debug)
@param {Object} CONFIG - Merged module configuration
@param {Object} ERRORS - Error catalog forwarded from auth.js

@return {Object} - Store interface (8 methods: setupNewStore, getSession, listSessionsByActor, setSession, updateSessionActivity, deleteSession, deleteSessions, cleanupExpiredSessions)
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
@param {Object} STORE_CONFIG - { collection_name, lib_mongodb }
@param {Object} ERRORS       - Error catalog forwarded from auth.js

@return {Object} - Store interface (8 methods: setupNewStore, getSession, listSessionsByActor, setSession, updateSessionActivity, deleteSession, deleteSessions, cleanupExpiredSessions)
*********************************************************************/
const createInterface = function (Lib, STORE_CONFIG, ERRORS) {

  ////////////////////////////// Public Functions START ////////////////////////
  const Store = {


    // ~~~~~~~~~~~~~~~~~~~~ Schema Setup ~~~~~~~~~~~~~~~~~~~~
    // MongoDB auto-creates collections on first write. Secondary indexes
    // and TTL must be provisioned out-of-band. setupNewStore is part of
    // the store contract but is not yet implemented for this backend.

    /********************************************************************
    Not implemented for MongoDB. Collection and index provisioning
    must be done out-of-band until the MongoDB helper exposes a
    schema-management API.

    @param {Object} instance - Request instance (unused)

    @return {Promise<Object>} - { success, error }  (always NOT_IMPLEMENTED)
    *********************************************************************/
    setupNewStore: async function (instance) { // eslint-disable-line no-unused-vars

      return {
        success: false,
        error: ERRORS.NOT_IMPLEMENTED
      };

    },


    // ~~~~~~~~~~~~~~~~~~~~ Read ~~~~~~~~~~~~~~~~~~~~
    // getSession is O(1) against the default _id index - the hash is
    // baked into _id so a wrong secret produces a miss, not a timing
    // leak. listSessionsByActor uses equality on the indexed `prefix`
    // field, hitting the B-tree directly.

    /********************************************************************
    Direct read by composite _id. The token_secret_hash is baked into
    _id so a wrong secret produces a miss (no timing leak, no extra
    read). Returns null record when the document is not found.
    *********************************************************************/
    getSession: async function (instance, tenant_id, actor_id, token_key, token_secret_hash) {

      // Build the composite _id including the secret hash
      const _id = _Store.composeMongoId(tenant_id, actor_id, token_key, token_secret_hash);

      // Fetch the document by _id - mismatch returns null naturally
      const result = await STORE_CONFIG.lib_mongodb.getRecord(
        instance,
        STORE_CONFIG.collection_name,
        { _id: _id }
      );

      // Return a service error if the driver call failed
      if (result.success === false) {
        Lib.Debug.debug('Auth mongodb getSession failed', {
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

      // Strip MongoDB-specific fields and return the canonical record (or null)
      return {
        success: true,
        record: _Store.docToRecord(result.document),
        error: null
      };

    },


    /********************************************************************
    List all sessions for (tenant_id, actor_id). Uses equality on the
    pre-computed `prefix` field so we hit the B-tree index directly.
    *********************************************************************/
    listSessionsByActor: async function (instance, tenant_id, actor_id) {

      // Build the indexed prefix that all docs for this actor share
      const prefix = _Store.composeMongoActorPrefix(tenant_id, actor_id);

      // Query using exact equality on the indexed `prefix` field
      const result = await STORE_CONFIG.lib_mongodb.query(
        instance,
        STORE_CONFIG.collection_name,
        { prefix: prefix }
      );

      // Return a service error if the driver call failed
      if (result.success === false) {
        Lib.Debug.debug('Auth mongodb listSessionsByActor failed', {
          type: ERRORS.SERVICE_UNAVAILABLE.type,
          driver_type: result.error && result.error.type,
          driver_message: result.error && result.error.message
        });
        return {
          success: false,
          records: null,
          error: ERRORS.SERVICE_UNAVAILABLE
        };
      }

      // Strip MongoDB-specific fields from every document and return the list
      const records = result.documents.map(function (doc) { return _Store.docToRecord(doc); });
      return {
        success: true,
        records: records,
        error: null
      };

    },


    // ~~~~~~~~~~~~~~~~~~~~ Write ~~~~~~~~~~~~~~~~~~~~
    // Full upsert and partial mutable-field update. setSession uses
    // replaceOne+upsert so the same (tenant, actor, token_key, hash)
    // quadruple yields a single document. updateSessionActivity uses
    // $set and refuses identity/PK fields (including _id and prefix).

    /********************************************************************
    Upsert a session document. replaceOne+upsert on _id ensures the
    same (tenant_id, actor_id, token_key, token_secret_hash) quadruple
    yields exactly one document.
    *********************************************************************/
    setSession: async function (instance, record) {

      // Build the document shape (canonical record + _id + prefix)
      const doc = _Store.recordToDoc(record);

      // Upsert by _id - replaces existing doc or inserts if absent
      const result = await STORE_CONFIG.lib_mongodb.writeRecord(
        instance,
        STORE_CONFIG.collection_name,
        { _id: doc._id },
        doc
      );

      // Return a service error if the driver call failed
      if (result.success === false) {
        Lib.Debug.debug('Auth mongodb setSession failed', {
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
    Partial update via $set. Uses an anchored prefix regex on _id to
    locate the document (the caller only has actor_id + token_key,
    not the hash baked into _id). Identity-column guard mirrors the
    SQL stores so programmer errors fail fast.
    *********************************************************************/
    updateSessionActivity: async function (instance, tenant_id, actor_id, token_key, updates) {

      // Skip the round-trip when there is nothing to update
      const update_keys = Object.keys(updates);
      if (update_keys.length === 0) {
        return {
          success: true,
          error: null
        };
      }

      // Guard against callers attempting to overwrite identity fields or
      // the MongoDB-specific _id and prefix attributes
      for (const k of update_keys) {
        if (_Store.UPDATE_IDENTITY_BLOCKLIST.indexOf(k) !== -1) {
          throw new TypeError(
            '[js-server-helper-auth-store-mongodb] updateSessionActivity cannot modify identity field "' + k + '"'
          );
        }
      }

      // Build an anchored prefix regex to locate the target document via _id.
      // The hash is baked into _id so we match on the tenant+actor+token_key
      // prefix - at most one document matches since the triple is unique.
      const prefix = tenant_id + '#' + actor_id + '#' + token_key + '#';
      const anchored = new RegExp('^' + _Store.escapeRegExp(prefix));

      // Run the partial $set update against the matched document
      const result = await STORE_CONFIG.lib_mongodb.updateRecord(
        instance,
        STORE_CONFIG.collection_name,
        { _id: anchored },
        { $set: updates }
      );

      // Return a service error if the driver call failed
      if (result.success === false) {
        Lib.Debug.debug('Auth mongodb updateSessionActivity failed', {
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


    // ~~~~~~~~~~~~~~~~~~~~ Delete ~~~~~~~~~~~~~~~~~~~~
    // Single and bulk deletion by composite _id prefix. The caller
    // only has (tenant, actor, token_key) - not the hash baked into
    // _id - so we use an anchored prefix regex. At most one document
    // matches because {actor_id + token_key} is unique per tenant.

    /********************************************************************
    Delete by (tenant_id, actor_id, token_key). Uses an anchored prefix
    regex on _id since the caller does not have the hash. At most one
    document matches this prefix.
    *********************************************************************/
    deleteSession: async function (instance, tenant_id, actor_id, token_key) {

      // Build an anchored prefix regex for the target document
      const prefix = tenant_id + '#' + actor_id + '#' + token_key + '#';
      const anchored = new RegExp('^' + _Store.escapeRegExp(prefix));

      // Delete the matched document by prefix regex on _id
      const result = await STORE_CONFIG.lib_mongodb.deleteRecordsByFilter(
        instance,
        STORE_CONFIG.collection_name,
        { _id: anchored }
      );

      // Return a service error if the driver call failed
      if (result.success === false) {
        Lib.Debug.debug('Auth mongodb deleteSession failed', {
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
    Bulk delete by $or over all _id prefixes. One deleteMany round-trip
    regardless of how many keys are in the list.
    *********************************************************************/
    deleteSessions: async function (instance, tenant_id, keys) {

      // Skip the round-trip when the caller provides no keys
      if (keys.length === 0) {
        return {
          success: true,
          error: null
        };
      }

      // Build an $or clause with one anchored prefix regex per key
      const or_clauses = keys.map(function (k) {
        const prefix = tenant_id + '#' + k.actor_id + '#' + k.token_key + '#';
        return { _id: new RegExp('^' + _Store.escapeRegExp(prefix)) };
      });

      // Delete all matched documents in one deleteMany round-trip
      const result = await STORE_CONFIG.lib_mongodb.deleteRecordsByFilter(
        instance,
        STORE_CONFIG.collection_name,
        { $or: or_clauses }
      );

      // Return a service error if the driver call failed
      if (result.success === false) {
        Lib.Debug.debug('Auth mongodb deleteSessions failed', {
          type: ERRORS.SERVICE_UNAVAILABLE.type,
          driver_type: result.error && result.error.type,
          driver_message: result.error && result.error.message,
          batch_size: keys.length
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


    // ~~~~~~~~~~~~~~~~~~~~ Maintenance ~~~~~~~~~~~~~~~~~~~~
    // Background sweep for expired documents using the expires_at
    // field (integer unix-seconds). MongoDB's native TTL does not
    // honor integer fields (it requires a Date-typed field), so this
    // manual sweep is the garbage-collection path - run it on a cron.

    /********************************************************************
    Sweep expired sessions using the expires_at integer field. MongoDB
    native TTL requires a Date-typed field, so this manual deleteMany
    is the garbage-collection path - run it on a cron.
    *********************************************************************/
    cleanupExpiredSessions: async function (instance) {

      // Delete all documents whose expires_at is in the past
      const now = instance.time;
      const result = await STORE_CONFIG.lib_mongodb.deleteRecordsByFilter(
        instance,
        STORE_CONFIG.collection_name,
        { expires_at: { $lt: now } }
      );

      // Return a service error if the driver call failed
      if (result.success === false) {
        Lib.Debug.debug('Auth mongodb cleanupExpiredSessions failed', {
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

      // Report success with the count of deleted documents
      return {
        success: true,
        deleted_count: result.deletedCount,
        error: null
      };

    }

  };////////////////////////////// Public Functions END ////////////////////////



  ///////////////////////////// Private Functions START ////////////////////////
  const _Store = {

    // Columns the caller is never allowed to mutate through
    // updateSessionActivity. Security + integrity blocklist - any match
    // throws a TypeError so the regression is visible in dev / CI
    // immediately. _id and prefix are MongoDB-specific and must be
    // included alongside the canonical identity fields.
    UPDATE_IDENTITY_BLOCKLIST: [
      'tenant_id', 'actor_id', 'actor_type', 'token_key', 'token_secret_hash',
      'created_at', 'install_id', 'install_platform', 'install_form_factor',
      '_id', 'prefix'
    ],


    /********************************************************************
    Escape a string for safe use inside a RegExp literal. Handles all
    regex metacharacters so tenant_id and actor_id values that contain
    dots, brackets, etc. never corrupt the anchored prefix pattern.

    @param {String} str - Raw string to escape

    @return {String} - Regex-safe escaped string
    *********************************************************************/
    escapeRegExp: function (str) {

      // Replace each metacharacter with its backslash-escaped equivalent
      return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    },


    /********************************************************************
    Build the MongoDB _id for a session document. Composite key:
      "{tenant_id}#{actor_id}#{token_key}#{token_secret_hash}"

    Including the hash in _id means a wrong-secret getSession probe
    produces a different _id and MongoDB returns null without reading
    the document (O(1), no timing leak).

    @param {String} tenant_id         - Tenant identifier
    @param {String} actor_id          - Actor identifier
    @param {String} token_key         - Session token key
    @param {String} token_secret_hash - Hashed token secret

    @return {String} - Composite _id string
    *********************************************************************/
    composeMongoId: function (tenant_id, actor_id, token_key, token_secret_hash) {

      // Concatenate all four segments with the '#' composite-key separator
      return tenant_id + '#' + actor_id + '#' + token_key + '#' + token_secret_hash;

    },


    /********************************************************************
    Build the indexed `prefix` field stored on every document. Format:
      "{tenant_id}#{actor_id}#"

    Equality queries on this field (via a btree index) replace the
    anchored-regex scan on _id for listSessionsByActor.

    @param {String} tenant_id - Tenant identifier
    @param {String} actor_id  - Actor identifier

    @return {String} - Prefix string
    *********************************************************************/
    composeMongoActorPrefix: function (tenant_id, actor_id) {

      // Concatenate tenant and actor segments with trailing separator
      return tenant_id + '#' + actor_id + '#';

    },


    /********************************************************************
    Build the document shape persisted by this store. Merges the
    canonical record with the computed _id and prefix fields.

    @param {Object} record - Canonical session record

    @return {Object} - MongoDB document (_id + prefix + record fields)
    *********************************************************************/
    recordToDoc: function (record) {

      // Compute _id and prefix, then merge them in front of the record
      const _id = _Store.composeMongoId(
        record.tenant_id,
        record.actor_id,
        record.token_key,
        record.token_secret_hash
      );

      const prefix = _Store.composeMongoActorPrefix(record.tenant_id, record.actor_id);

      return Object.assign({ _id: _id, prefix: prefix }, record);

    },


    /********************************************************************
    Strip MongoDB-specific fields so callers receive a clean canonical
    record. Returns null for missing or undefined input.

    @param {Object} doc - Raw MongoDB document

    @return {Object|null} - Canonical session record, or null
    *********************************************************************/
    docToRecord: function (doc) {

      // Return null for missing documents (driver returned null/undefined)
      if (doc === null || doc === undefined) {
        return null;
      }

      // Remove _id and prefix from a shallow copy of the document
      const rec = Object.assign({}, doc);
      delete rec._id;
      delete rec.prefix;
      return rec;

    }

  };///////////////////////////// Private Functions END ////////////////////////


  return Store;

};///////////////////////////// createInterface END /////////////////////////////
