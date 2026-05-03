// Info: In-memory store for the logger module. Test-only - process-scoped,
// non-durable. Mirrors the five-method contract every other backend honours
// and keeps the records in insertion order so the sort-key ordering rules
// are easy to verify in unit tests without a database.
'use strict';


/********************************************************************
Factory for the memory store.

@param {Object} Lib - Dependency container.
@param {Object} store_config - Ignored for the memory store.

@return {Object} - Store interface.
*********************************************************************/
module.exports = function memoryStoreFactory (Lib, store_config) {

  void Lib;
  void store_config;

  // Records live in a single array - ordering preserved = insertion
  // order. All list queries filter + sort by sort_key descending.
  const records = [];


  return {


    /********************************************************************
    Memory store has no schema to provision.
    *********************************************************************/
    initialize: async function (instance) {
      void instance;
      return { success: true, error: null };
    },


    /********************************************************************
    Append-only write. Duplicates on the composite unique key
    (scope, entity_type, entity_id, sort_key) are possible only when
    two log() calls land at the same millisecond and draw the same
    3-char random suffix - callers tolerate this collision because
    the sort_key is a uniqueness tie-breaker, not a constraint.
    *********************************************************************/
    addRecord: async function (instance, record) {
      void instance;
      records.push(Object.assign({}, record));
      return { success: true, error: null };
    },


    /********************************************************************
    In-memory linear scan. Acceptable for the tests that use this store.
    Real backends use indexed lookups.
    *********************************************************************/
    listByEntity: async function (instance, query) {
      void instance;
      const matches = records.filter(function (r) {
        if (r.scope !== query.scope) { return false; }
        if (r.entity_type !== query.entity_type) { return false; }
        if (r.entity_id !== query.entity_id) { return false; }
        return _matchesQueryFilters(r, query);
      });
      return _paginateByEntity(matches, query);
    },


    listByActor: async function (instance, query) {
      void instance;
      const matches = records.filter(function (r) {
        if (r.scope !== query.scope) { return false; }
        if (r.actor_type !== query.actor_type) { return false; }
        if (r.actor_id !== query.actor_id) { return false; }
        return _matchesQueryFilters(r, query);
      });
      return _paginateByActor(matches, query);
    },


    /********************************************************************
    Delete every record whose expires_at is strictly before instance.time.
    Persistent records have expires_at === null and are skipped.
    *********************************************************************/
    cleanupExpiredRecords: async function (instance) {

      const now = instance.time;
      let deleted = 0;

      for (let i = records.length - 1; i >= 0; i = i - 1) {
        const r = records[i];
        if (r.expires_at !== null && r.expires_at < now) {
          records.splice(i, 1);
          deleted = deleted + 1;
        }
      }

      return { success: true, deleted_count: deleted, error: null };

    }


  };

};


/********************************************************************
Does a record pass the optional filters (actions, time range)?
*********************************************************************/
function _matchesQueryFilters (record, query) {

  // Time range - closed-open interval on created_at_ms
  if (query.start_time_ms !== null && record.created_at_ms < query.start_time_ms) {
    return false;
  }
  if (query.end_time_ms !== null && record.created_at_ms >= query.end_time_ms) {
    return false;
  }

  // Action filter - literal or `prefix.*` glob
  if (query.actions !== null && query.actions.length > 0) {
    let any = false;
    for (const pattern of query.actions) {
      if (_actionMatches(record.action, pattern)) {
        any = true;
        break;
      }
    }
    if (!any) {
      return false;
    }
  }

  return true;

}


/********************************************************************
`prefix.*` matches anything that starts with `prefix.`. Exact match
otherwise. Only one wildcard form is supported because the log action
namespace is a dot-separated tree, not free text.
*********************************************************************/
function _actionMatches (action, pattern) {
  if (pattern.endsWith('.*')) {
    return action === pattern.slice(0, -2) || action.startsWith(pattern.slice(0, -1));
  }
  return action === pattern;
}


/********************************************************************
Sort by sort_key desc, slice by cursor + limit.
*********************************************************************/
function _paginateByEntity (matches, query) {

  const sorted = matches.slice().sort(function (a, b) {
    if (a.sort_key < b.sort_key) { return 1; }
    if (a.sort_key > b.sort_key) { return -1; }
    return 0;
  });

  const start_index = query.cursor === null ? 0 : _findIndexAfter(sorted, query.cursor);
  const page = sorted.slice(start_index, start_index + query.limit);
  const next_cursor = (sorted.length > start_index + query.limit) ? page[page.length - 1].sort_key : null;

  return { success: true, records: page, next_cursor: next_cursor, error: null };

}


function _paginateByActor (matches, query) {
  return _paginateByEntity(matches, query);
}


function _findIndexAfter (sorted, cursor_sort_key) {
  for (let i = 0; i < sorted.length; i = i + 1) {
    if (sorted[i].sort_key < cursor_sort_key) {
      return i;
    }
  }
  return sorted.length;
}
