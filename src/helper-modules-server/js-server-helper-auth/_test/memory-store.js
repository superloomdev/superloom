// Info: In-process Map-backed store mock for Tier-2 auth unit tests.
// Implements the 8-method store contract so auth.js can be tested
// without any Docker container or database driver. All data is stored
// in a plain Map keyed by "{tenant_id}/{actor_id}/{token_key}".
//
// This is intentionally a minimal, correct implementation - it is not
// a performance store and should never be used in production.
//
// Store contract (identical shape across all real stores):
//   setupNewStore(instance)                           -> { success, error }
//   getSession(instance, t, a, k, h)                 -> { success, record, error }
//   listSessionsByActor(instance, t, a)              -> { success, records, error }
//   setSession(instance, record)                     -> { success, error }
//   updateSessionActivity(instance, t, a, k, updates)-> { success, error }
//   deleteSession(instance, t, a, k)                 -> { success, error }
//   deleteSessions(instance, t, keys)                -> { success, error }
//   cleanupExpiredSessions(instance)                 -> { success, deleted_count, error }
'use strict';


/********************************************************************
Build a key from (tenant_id, actor_id, token_key).

@param {String} tenant_id
@param {String} actor_id
@param {String} token_key

@return {String}
*********************************************************************/
function makeKey (tenant_id, actor_id, token_key) {
  return tenant_id + '/' + actor_id + '/' + token_key;
}


/********************************************************************
Create a new in-process memory store. Returns an object matching the
8-method store contract consumed by auth.js. Each call to this
factory produces an independent Map, so tests can run in isolation.

@return {Object} - Store interface
*********************************************************************/
module.exports = function createMemoryStore () {

  const _map = new Map();

  const Store = {

    /******************************************************************
    No-op schema setup - nothing to provision for an in-memory store.
    ******************************************************************/
    setupNewStore: async function () {
      return { success: true, error: null };
    },


    /******************************************************************
    Read one record by composite key + hash. Mirrors the real stores:
    a hash mismatch returns { success: true, record: null } so a wrong
    secret looks like "not found".
    ******************************************************************/
    getSession: async function (instance, tenant_id, actor_id, token_key, token_secret_hash) {

      void instance;
      const key = makeKey(tenant_id, actor_id, token_key);
      const record = _map.get(key);

      if (record === undefined) {
        return { success: true, record: null, error: null };
      }

      if (record.token_secret_hash !== token_secret_hash) {
        return { success: true, record: null, error: null };
      }

      return { success: true, record: Object.assign({}, record), error: null };

    },


    /******************************************************************
    Return all records for (tenant_id, actor_id) regardless of hash.
    ******************************************************************/
    listSessionsByActor: async function (instance, tenant_id, actor_id) {

      void instance;
      const records = [];

      for (const record of _map.values()) {
        if (record.tenant_id === tenant_id && record.actor_id === actor_id) {
          records.push(Object.assign({}, record));
        }
      }

      return { success: true, records: records, error: null };

    },


    /******************************************************************
    Upsert a record. A second call with the same composite key
    replaces the mutable columns while preserving immutable ones.
    Mirrors ON CONFLICT ... DO UPDATE from the SQL stores.
    ******************************************************************/
    setSession: async function (instance, record) {

      void instance;
      const key = makeKey(record.tenant_id, record.actor_id, record.token_key);
      const existing = _map.get(key);

      if (existing !== undefined) {
        // Preserve immutable columns (mirrors UPSERT_IMMUTABLE_COLUMNS
        // from the SQL stores).
        const merged = Object.assign({}, record, {
          created_at:           existing.created_at,
          install_id:           existing.install_id,
          install_platform:     existing.install_platform,
          install_form_factor:  existing.install_form_factor
        });
        _map.set(key, merged);
      } else {
        _map.set(key, Object.assign({}, record));
      }

      return { success: true, error: null };

    },


    /******************************************************************
    Partial update - applies the updates object as a shallow $set.
    Identity / key fields are blocked.
    ******************************************************************/
    updateSessionActivity: async function (instance, tenant_id, actor_id, token_key, updates) {

      void instance;

      const IDENTITY_BLOCKLIST = [
        'tenant_id', 'actor_id', 'actor_type', 'token_key', 'token_secret_hash',
        'created_at', 'install_id', 'install_platform', 'install_form_factor'
      ];

      for (const k of Object.keys(updates)) {
        if (IDENTITY_BLOCKLIST.indexOf(k) !== -1) {
          throw new TypeError(
            '[memory-store] updateSessionActivity cannot modify identity field "' + k + '"'
          );
        }
      }

      const key = makeKey(tenant_id, actor_id, token_key);
      const record = _map.get(key);

      if (record === undefined) {
        return { success: true, error: null };
      }

      _map.set(key, Object.assign({}, record, updates));
      return { success: true, error: null };

    },


    /******************************************************************
    Delete one record by composite key.
    ******************************************************************/
    deleteSession: async function (instance, tenant_id, actor_id, token_key) {

      void instance;
      _map.delete(makeKey(tenant_id, actor_id, token_key));
      return { success: true, error: null };

    },


    /******************************************************************
    Delete many records in one call. keys is an array of
    { actor_id, token_key } objects.
    ******************************************************************/
    deleteSessions: async function (instance, tenant_id, keys) {

      void instance;

      for (const k of keys) {
        _map.delete(makeKey(tenant_id, k.actor_id, k.token_key));
      }

      return { success: true, error: null };

    },


    /******************************************************************
    Sweep all records whose expires_at < instance.time.
    ******************************************************************/
    cleanupExpiredSessions: async function (instance) {

      const now = instance.time;
      let deleted_count = 0;

      for (const [key, record] of _map.entries()) {
        if (record.expires_at < now) {
          _map.delete(key);
          deleted_count++;
        }
      }

      return { success: true, deleted_count: deleted_count, error: null };

    },


    /******************************************************************
    Test helper - wipe all records. Not part of the public contract;
    only available on the memory store for test isolation.
    ******************************************************************/
    _clear: function () {
      _map.clear();
    },


    /******************************************************************
    Test helper - return a snapshot of all stored records. Not part
    of the public contract; only available on the memory store.
    ******************************************************************/
    _dump: function () {
      const out = [];
      for (const record of _map.values()) {
        out.push(Object.assign({}, record));
      }
      return out;
    }

  };

  return Store;

};
