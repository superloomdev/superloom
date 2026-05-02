// Info: In-memory store. Used by the unit-test suite. NOT shipped as a
// production option - real deployments must pick a persistent backend.
//
// Storage shape: a Map keyed by "{tenant_id}#{actor_id}#{token_key}".
// listSessionsByActor scans the Map's values - acceptable because the
// suite is small. Real backends do indexed queries.
'use strict';


/********************************************************************
Factory for the memory store. One call returns one independent
storage instance with its own Map. Tests construct a fresh memory
store per case to keep state isolated.

@param {Object} Lib - Dependency container (Utils, etc.)
@param {Object} store_config - Per-instance store config (currently unused)

@return {Object} - Store interface with the standard contract methods
*********************************************************************/
module.exports = function memoryStoreFactory (Lib, store_config) {

  // Suppress unused-var warning - store_config reserved for future options
  void store_config;
  // Lib used inside helper functions below
  void Lib;

  // Backing storage. Map of composite-key -> session record.
  const records = new Map();


  /********************************************************************
  Build the composite key used internally. SQL-like: three parts.
  *********************************************************************/
  const key = function (tenant_id, actor_id, token_key) {

    return tenant_id + '#' + actor_id + '#' + token_key;

  };


  return {

    /********************************************************************
    Idempotent setup. Memory store has nothing to set up.
    *********************************************************************/
    initialize: async function () {

      return { success: true, error: null };

    },


    /********************************************************************
    Read a single session by its composite key. The expected
    token_secret_hash is checked too - mismatch returns "not found"
    so the caller cannot distinguish "wrong key" from "wrong secret".

    @param {Object} instance - Request instance (unused here; honored for contract symmetry)
    @param {String} tenant_id
    @param {String} actor_id
    @param {String} token_key
    @param {String} token_secret_hash - The hash to verify against

    @return {Promise<Object>} - { success, record, error }
    *********************************************************************/
    getSession: async function (instance, tenant_id, actor_id, token_key, token_secret_hash) {

      void instance;

      const stored = records.get(key(tenant_id, actor_id, token_key));

      if (stored === undefined) {
        return { success: true, record: null, error: null };
      }

      // Hash mismatch - report as "not found" (no timing leak)
      if (stored.token_secret_hash !== token_secret_hash) {
        return { success: true, record: null, error: null };
      }

      // Return a defensive copy so callers can't mutate stored state
      return {
        success: true,
        record: Object.assign({}, stored),
        error: null
      };

    },


    /********************************************************************
    Insert or upsert a session record.

    @param {Object} instance - Request instance (unused)
    @param {Object} record - Canonical session record

    @return {Promise<Object>} - { success, error }
    *********************************************************************/
    setSession: async function (instance, record) {

      void instance;

      records.set(
        key(record.tenant_id, record.actor_id, record.token_key),
        Object.assign({}, record)
      );

      return { success: true, error: null };

    },


    /********************************************************************
    Delete one session by composite key.

    @param {Object} instance - Request instance (unused)
    @param {String} tenant_id
    @param {String} actor_id
    @param {String} token_key

    @return {Promise<Object>} - { success, error }
    *********************************************************************/
    deleteSession: async function (instance, tenant_id, actor_id, token_key) {

      void instance;

      records.delete(key(tenant_id, actor_id, token_key));

      return { success: true, error: null };

    },


    /********************************************************************
    Delete many sessions by composite-key list. Used when removeAll
    or batch eviction needs to clear several rows at once.

    @param {Object} instance - Request instance (unused)
    @param {String} tenant_id
    @param {Object[]} keys - Array of { actor_id, token_key }

    @return {Promise<Object>} - { success, error }
    *********************************************************************/
    deleteSessions: async function (instance, tenant_id, keys) {

      void instance;

      for (const k of keys) {
        records.delete(key(tenant_id, k.actor_id, k.token_key));
      }

      return { success: true, error: null };

    },


    /********************************************************************
    List all sessions for a (tenant_id, actor_id) pair. Returns a
    defensive copy of each matching record.

    @param {Object} instance - Request instance (unused)
    @param {String} tenant_id
    @param {String} actor_id

    @return {Promise<Object>} - { success, records, error }
    *********************************************************************/
    listSessionsByActor: async function (instance, tenant_id, actor_id) {

      void instance;

      const matches = [];
      // Iterate Map values - small and bounded by sessions per actor
      for (const stored of records.values()) {

        if (
          stored.tenant_id === tenant_id &&
          stored.actor_id === actor_id
        ) {
          matches.push(Object.assign({}, stored));
        }

      }

      return { success: true, records: matches, error: null };

    },


    /********************************************************************
    Update mutable fields on an existing session: last_active_at,
    expires_at, and any client_* / push_* fields.

    @param {Object} instance - Request instance (unused)
    @param {String} tenant_id
    @param {String} actor_id
    @param {String} token_key
    @param {Object} updates - Partial map of canonical-field updates

    @return {Promise<Object>} - { success, error }
    *********************************************************************/
    updateSessionActivity: async function (instance, tenant_id, actor_id, token_key, updates) {

      void instance;

      const composite = key(tenant_id, actor_id, token_key);
      const stored = records.get(composite);
      if (stored === undefined) {
        return { success: true, error: null };
      }

      records.set(composite, Object.assign({}, stored, updates));

      return { success: true, error: null };

    },


    /********************************************************************
    Delete sessions whose expires_at < now. Used by the optional
    cleanup cron path. SQL backends override this with a single DELETE.

    @param {Object} instance - Request instance (uses instance.time)

    @return {Promise<Object>} - { success, deleted_count, error }
    *********************************************************************/
    cleanupExpiredSessions: async function (instance) {

      const now = instance.time;
      const to_delete = [];

      for (const [composite, stored] of records.entries()) {

        if (stored.expires_at < now) {
          to_delete.push(composite);
        }

      }

      for (const composite of to_delete) {
        records.delete(composite);
      }

      return { success: true, deleted_count: to_delete.length, error: null };

    },


    // White-box hook for tests. Not part of the standard store contract -
    // production stores do not expose this.
    _records: records

  };

};
