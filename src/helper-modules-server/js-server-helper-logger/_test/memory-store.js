// Info: In-process array-backed store fixture for Tier-2 logger unit tests.
// Implements the 5-method store contract so logger.js can be tested
// without any Docker container or database driver. All data is stored
// in a simple private array.
//
// This is intentionally a minimal, correct implementation - it is not
// a performance store and should never be used in production.
//
// Store contract (identical shape across all real stores):
//   setupNewStore(instance)                      -> { success, error }
//   addLog(instance, record)                     -> { success, error }
//   getLogsByEntity(instance, query)             -> { success, records, next_cursor, error }
//   getLogsByActor(instance, query)              -> { success, records, next_cursor, error }
//   cleanupExpiredLogs(instance)                 -> { success, deleted_count, error }
'use strict';


/********************************************************************
Create a new in-process memory store. Returns an object matching the
5-method store contract consumed by logger.js. Each call to this
factory produces an independent array, so tests can run in isolation.

@return {Object} - Store interface
*********************************************************************/
module.exports = function createMemoryStore () {

  // Private record storage (isolated per instance)
  const _records = [];

  const Store = {


    /******************************************************************
    No-op schema setup - nothing to provision for an in-memory store.
    ******************************************************************/
    setupNewStore: async function (_instance) {

      return {
        success: true,
        error: null
      };

    },


    /******************************************************************
    Add one record to the in-memory store.
    ******************************************************************/
    addLog: async function (_instance, record) {

      _records.push(record);

      return {
        success: true,
        error: null
      };

    },


    /******************************************************************
    List records by entity (entity_type + entity_id).
    ******************************************************************/
    getLogsByEntity: async function (_instance, query) {

      const filtered = _records.filter(function (r) {
        return r.entity_type === query.entity_type && r.entity_id === query.entity_id;
      });

      return {
        success: true,
        records: filtered,
        next_cursor: null,
        error: null
      };

    },


    /******************************************************************
    List records by actor (actor_type + actor_id).
    ******************************************************************/
    getLogsByActor: async function (_instance, query) {

      const filtered = _records.filter(function (r) {
        return r.actor_type === query.actor_type && r.actor_id === query.actor_id;
      });

      return {
        success: true,
        records: filtered,
        next_cursor: null,
        error: null
      };

    },


    /******************************************************************
    Clean up expired records based on expires_at timestamp.
    ******************************************************************/
    cleanupExpiredLogs: async function (_instance) {

      const now = Date.now();
      let deleted_count = 0;

      for (let i = _records.length - 1; i >= 0; i--) {
        if (_records[i].expires_at && _records[i].expires_at < now) {
          _records.splice(i, 1);
          deleted_count++;
        }
      }

      return {
        success: true,
        deleted_count: deleted_count,
        error: null
      };

    }


  };

  return Store;

};
