// Info: In-process Map-backed store fixture for Tier-2 verify unit tests.
// Implements the 6-method store contract so verify.js can be tested
// without any Docker container or database driver. All data is stored
// in a plain Map keyed by "scope::key".
//
// This is intentionally a minimal, correct implementation - it is not
// a performance store and should never be used in production.
//
// Store contract (identical shape across all real stores):
//   setupNewStore(instance)                      -> { success, error }
//   getRecord(instance, scope, key)              -> { success, record, error }
//   setRecord(instance, scope, key, record)      -> { success, error }
//   incrementFailCount(instance, scope, key)     -> { success, error }
//   deleteRecord(instance, scope, key)           -> { success, error }
//   cleanupExpiredRecords(instance)              -> { success, deleted_count, error }
'use strict';


/********************************************************************
Build a composite map key from scope + key.

@param {String} scope
@param {String} key

@return {String}
*********************************************************************/
function compositeKey (scope, key) {
  return scope + '::' + key;
}


/********************************************************************
Create a new in-process memory store. Returns an object matching the
6-method store contract consumed by verify.js. Each call to this
factory produces an independent Map, so tests can run in isolation.

@return {Object} - Store interface (plus _records for white-box assertions)
*********************************************************************/
module.exports = function createMemoryStore () {

  const _map = new Map();

  const Store = {

    /******************************************************************
    No-op schema setup - nothing to provision for an in-memory store.
    ******************************************************************/
    setupNewStore: async function () {
      return {
        success: true,
        error: null
      };
    },


    /******************************************************************
    Read one record by composite key. Returns null when absent.
    ******************************************************************/
    getRecord: async function (instance, scope, key) { // eslint-disable-line no-unused-vars

      const stored = _map.get(compositeKey(scope, key));

      return {
        success: true,
        record: stored ? Object.assign({}, stored) : null,
        error: null
      };

    },


    /******************************************************************
    Upsert - overwrites any existing record at the composite key.
    ******************************************************************/
    setRecord: async function (instance, scope, key, record) { // eslint-disable-line no-unused-vars

      _map.set(compositeKey(scope, key), Object.assign({}, record));

      return {
        success: true,
        error: null
      };

    },


    /******************************************************************
    Atomic in-place increment of fail_count. Returns NOT_FOUND-shaped
    error if the record is absent (mirrors real adapter behavior).
    ******************************************************************/
    incrementFailCount: async function (instance, scope, key) { // eslint-disable-line no-unused-vars

      const ck = compositeKey(scope, key);
      const stored = _map.get(ck);

      if (!stored) {
        return {
          success: false,
          error: { type: 'NOT_FOUND', message: 'no record to increment' }
        };
      }

      stored.fail_count = stored.fail_count + 1;

      return {
        success: true,
        error: null
      };

    },


    /******************************************************************
    Idempotent delete (missing key reports success).
    ******************************************************************/
    deleteRecord: async function (instance, scope, key) { // eslint-disable-line no-unused-vars

      _map.delete(compositeKey(scope, key));

      return {
        success: true,
        error: null
      };

    },


    /******************************************************************
    Sweep all records whose expires_at < instance.time.
    ******************************************************************/
    cleanupExpiredRecords: async function (instance) {

      const now = instance.time;
      let deleted_count = 0;

      for (const [k, record] of _map.entries()) {
        if (record.expires_at < now) {
          _map.delete(k);
          deleted_count = deleted_count + 1;
        }
      }

      return {
        success: true,
        deleted_count: deleted_count,
        error: null
      };

    },


    /******************************************************************
    Test helper - expose the raw Map for white-box assertions.
    Not part of the public contract; never used in production code.
    ******************************************************************/
    _records: _map

  };

  return Store;

};
