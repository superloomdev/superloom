// Info: In-memory store for the verify module. Test-only - process-scoped,
// non-durable, no TTL sweeps. Mirrors the auth module's memory store and
// implements the same five-method contract every other backend honours.
'use strict';


/********************************************************************
Factory for the memory store.

@param {Object} Lib - Dependency container (Utils)
@param {Object} store_config - Ignored for the memory store

@return {Object} - Store interface (getRecord, setRecord, incrementFailCount,
                   deleteRecord, cleanupExpiredRecords, initialize)
*********************************************************************/
module.exports = function memoryStoreFactory (Lib, store_config) {

  void Lib;
  void store_config;

  // The store is a Map keyed by `${scope}\u0000${key}` so the composite
  // identifier is unambiguous regardless of what characters the project
  // uses inside scope or key.
  const records = new Map();

  const composeId = function (scope, key) {
    return scope + '\u0000' + key;
  };

  return {


    /********************************************************************
    Memory store has no schema to provision.
    *********************************************************************/
    initialize: async function (instance) {
      void instance;
      return { success: true, error: null };
    },


    /********************************************************************
    Return a clone of the stored record so callers can't mutate the
    on-disk state by editing the returned object.
    *********************************************************************/
    getRecord: async function (instance, scope, key) {

      void instance;

      const id = composeId(scope, key);
      const stored = records.get(id);

      if (stored === undefined) {
        return { success: true, record: null, error: null };
      }

      return {
        success: true,
        record: Object.assign({}, stored),
        error: null
      };

    },


    /********************************************************************
    Upsert by composite identifier.
    *********************************************************************/
    setRecord: async function (instance, scope, key, record) {

      void instance;

      records.set(composeId(scope, key), Object.assign({}, record));
      return { success: true, error: null };

    },


    /********************************************************************
    Atomic-by-construction in single-process JS - increment in place.
    *********************************************************************/
    incrementFailCount: async function (instance, scope, key) {

      void instance;

      const id = composeId(scope, key);
      const stored = records.get(id);
      if (stored === undefined) {
        return { success: true, error: null };
      }

      stored.fail_count = stored.fail_count + 1;
      return { success: true, error: null };

    },


    /********************************************************************
    Idempotent delete - missing key is not an error.
    *********************************************************************/
    deleteRecord: async function (instance, scope, key) {

      void instance;

      records.delete(composeId(scope, key));
      return { success: true, error: null };

    },


    /********************************************************************
    Linear scan + delete. Acceptable for tests.
    *********************************************************************/
    cleanupExpiredRecords: async function (instance) {

      const now = instance.time;
      let deleted = 0;

      for (const [id, rec] of records.entries()) {
        if (rec.expires_at < now) {
          records.delete(id);
          deleted = deleted + 1;
        }
      }

      return { success: true, deleted_count: deleted, error: null };

    }


  };

};
