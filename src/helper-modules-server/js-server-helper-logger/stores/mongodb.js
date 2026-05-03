// Info: MongoDB backend for the logger module.
//
// Document shape: every canonical record field is written verbatim, plus
// two denormalised string columns (`entity_pk`, `actor_pk`) that are used
// as the indexed keys for the two list query paths. Carrying the composite
// keys explicitly lets each list query be a single equality match against
// a B-tree index rather than a multi-field compound predicate.
//
// TTL: `_ttl` is a `Date` mirror of `expires_at` (epoch seconds). It is
// only set for non-persistent records, so persistent rows lack the field
// and MongoDB's TTL sweeper ignores them. The index is created with
// `expireAfterSeconds: 0` so the sweeper uses each document's `_ttl`
// timestamp directly.
//
// Pagination: callers pass the previous page's last `sort_key` as cursor.
// The store filters `sort_key < cursor` (DESC sort), so pages tile cleanly
// without skipping or duplicating records.
'use strict';


const ENTITY_PK_INDEX = 'logger_entity_pk_idx';
const ACTOR_PK_INDEX  = 'logger_actor_pk_idx';
const TTL_INDEX       = 'logger_ttl_idx';
const EXPIRES_INDEX   = 'logger_expires_at_idx';


/********************************************************************
Factory for the MongoDB store.

@param {Object} Lib - Dependency container (Utils, Debug)
@param {Object} store_config - { collection_name, lib_mongodb }

@return {Object} - Store interface
*********************************************************************/
module.exports = function mongodbStoreFactory (Lib, store_config) {

  if (
    Lib.Utils.isNullOrUndefined(store_config) ||
    !Lib.Utils.isObject(store_config)
  ) {
    throw new Error('[js-server-helper-logger] STORE_CONFIG must be an object for mongodb');
  }

  if (
    Lib.Utils.isNullOrUndefined(store_config.collection_name) ||
    !Lib.Utils.isString(store_config.collection_name) ||
    Lib.Utils.isEmptyString(store_config.collection_name)
  ) {
    throw new Error('[js-server-helper-logger] STORE_CONFIG.collection_name is required for mongodb');
  }

  if (Lib.Utils.isNullOrUndefined(store_config.lib_mongodb)) {
    throw new Error('[js-server-helper-logger] STORE_CONFIG.lib_mongodb is required for mongodb (pass Lib.MongoDB)');
  }

  const collection_name = store_config.collection_name;
  const mongo = store_config.lib_mongodb;


  /********************************************************************
  Compose the partition keys. We use the NUL byte as the separator so
  no caller-supplied identifier (which is text) can collide. The
  module never parses these keys back - they are opaque equality
  match values for the indexes only.
  *********************************************************************/
  const entityPk = function (scope, entity_type, entity_id) {
    return scope + '\u0000' + entity_type + '\u0000' + entity_id;
  };
  const actorPk = function (scope, actor_type, actor_id) {
    return scope + '\u0000' + actor_type + '\u0000' + actor_id;
  };


  /********************************************************************
  Convert a canonical record into the document we store. The TTL
  mirror is omitted for persistent records so MongoDB's TTL sweeper
  never touches them.
  *********************************************************************/
  const recordToDoc = function (record) {

    const doc = {
      scope:         record.scope,
      entity_type:   record.entity_type,
      entity_id:     record.entity_id,
      actor_type:    record.actor_type,
      actor_id:      record.actor_id,
      action:        record.action,
      data:          record.data,
      ip:            record.ip,
      user_agent:    record.user_agent,
      created_at:    record.created_at,
      created_at_ms: record.created_at_ms,
      sort_key:      record.sort_key,
      expires_at:    record.expires_at,
      entity_pk:     entityPk(record.scope, record.entity_type, record.entity_id),
      actor_pk:      actorPk(record.scope, record.actor_type, record.actor_id)
    };

    if (record.expires_at !== null && record.expires_at !== undefined) {
      doc._ttl = new Date(record.expires_at * 1000);
    }

    return doc;

  };


  /********************************************************************
  Reverse - strip storage-only fields so the caller sees the canonical
  record shape and nothing else.
  *********************************************************************/
  const docToRecord = function (doc) {

    if (doc === null || doc === undefined) {
      return null;
    }

    return {
      scope:         doc.scope,
      entity_type:   doc.entity_type,
      entity_id:     doc.entity_id,
      actor_type:    doc.actor_type,
      actor_id:      doc.actor_id,
      action:        doc.action,
      data:          doc.data === undefined ? null : doc.data,
      ip:            doc.ip === undefined ? null : doc.ip,
      user_agent:    doc.user_agent === undefined ? null : doc.user_agent,
      created_at:    doc.created_at,
      created_at_ms: doc.created_at_ms,
      sort_key:      doc.sort_key,
      expires_at:    doc.expires_at === undefined ? null : doc.expires_at
    };

  };


  /********************************************************************
  Build the action-filter clause. Returns null when no filter is set.
  Patterns ending in `.*` become anchored regex; literals become $in.
  *********************************************************************/
  const buildActionFilter = function (actions) {

    if (actions === null || actions === undefined || actions.length === 0) {
      return null;
    }

    const literal_actions = [];
    const regex_actions = [];

    for (const pattern of actions) {
      if (pattern.endsWith('.*')) {
        const prefix = pattern.slice(0, -2).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        regex_actions.push(new RegExp('^' + prefix + '\\.'));
      } else {
        literal_actions.push(pattern);
      }
    }

    if (literal_actions.length > 0 && regex_actions.length === 0) {
      return { $in: literal_actions };
    }
    if (literal_actions.length === 0 && regex_actions.length > 0) {
      return { $in: regex_actions };
    }
    return { $in: literal_actions.concat(regex_actions) };

  };


  /********************************************************************
  Append the optional time-range / cursor / action filters onto a
  base filter object. Mutates `filter` for convenience.
  *********************************************************************/
  const applyOptionalFilters = function (filter, query) {

    if (query.start_time_ms !== null || query.end_time_ms !== null) {
      filter.created_at_ms = {};
      if (query.start_time_ms !== null) {
        filter.created_at_ms.$gte = query.start_time_ms;
      }
      if (query.end_time_ms !== null) {
        filter.created_at_ms.$lt = query.end_time_ms;
      }
    }

    const action_clause = buildActionFilter(query.actions);
    if (action_clause !== null) {
      filter.action = action_clause;
    }

    if (query.cursor !== null) {
      filter.sort_key = { $lt: query.cursor };
    }

  };


  /********************************************************************
  Run a list query (entity or actor) and shape the response.
  *********************************************************************/
  const runListQuery = async function (instance, filter, limit) {

    const result = await mongo.query(
      instance,
      collection_name,
      filter,
      { sort: { sort_key: -1 }, limit: limit }
    );

    if (result.success === false) {
      return { success: false, records: [], next_cursor: null, error: result.error };
    }

    const records = result.documents.map(docToRecord);
    const next_cursor = records.length === limit ? records[records.length - 1].sort_key : null;

    return { success: true, records: records, next_cursor: next_cursor, error: null };

  };


  return {


    /********************************************************************
    Idempotent index setup. Createing the same index twice is a no-op.
    *********************************************************************/
    initialize: async function (instance) {

      const entity_idx = await mongo.createIndex(
        instance,
        collection_name,
        { entity_pk: 1, sort_key: -1 },
        { name: ENTITY_PK_INDEX }
      );
      if (entity_idx && entity_idx.success === false) {
        return { success: false, error: entity_idx.error };
      }

      const actor_idx = await mongo.createIndex(
        instance,
        collection_name,
        { actor_pk: 1, sort_key: -1 },
        { name: ACTOR_PK_INDEX }
      );
      if (actor_idx && actor_idx.success === false) {
        return { success: false, error: actor_idx.error };
      }

      const ttl_idx = await mongo.createIndex(
        instance,
        collection_name,
        { _ttl: 1 },
        { name: TTL_INDEX, expireAfterSeconds: 0 }
      );
      if (ttl_idx && ttl_idx.success === false) {
        return { success: false, error: ttl_idx.error };
      }

      const expires_idx = await mongo.createIndex(
        instance,
        collection_name,
        { expires_at: 1 },
        { name: EXPIRES_INDEX, sparse: true }
      );
      if (expires_idx && expires_idx.success === false) {
        return { success: false, error: expires_idx.error };
      }

      return { success: true, error: null };

    },


    /********************************************************************
    Append a new log record. We use writeRecord with a filter that
    cannot match anything (the auto-generated _id of an unwritten doc)
    so MongoDB always picks the upsert insert path. Direct
    `insertOne` is the natural choice but the helper does not expose
    it - the upsert-with-impossible-filter trick is equivalent and
    keeps us inside the documented helper API.
    *********************************************************************/
    addRecord: async function (instance, record) {

      const doc = recordToDoc(record);

      // The canonical record never carries an _id, so we let MongoDB
      // generate one. Filter on a non-existent flag so writeRecord's
      // replaceOne(upsert=true) always inserts a new doc.
      const result = await mongo.writeRecord(
        instance,
        collection_name,
        { _logger_never_match: true },
        doc
      );

      return {
        success: result.success,
        error: result.error || null
      };

    },


    /********************************************************************
    List by entity. Equality on the precomputed entity_pk + index hint
    via the same compound spec we created in initialize.
    *********************************************************************/
    listByEntity: async function (instance, query) {

      const filter = {
        entity_pk: entityPk(query.scope, query.entity_type, query.entity_id)
      };
      applyOptionalFilters(filter, query);

      return runListQuery(instance, filter, query.limit);

    },


    /********************************************************************
    List by actor. Equality on the precomputed actor_pk.
    *********************************************************************/
    listByActor: async function (instance, query) {

      const filter = {
        actor_pk: actorPk(query.scope, query.actor_type, query.actor_id)
      };
      applyOptionalFilters(filter, query);

      return runListQuery(instance, filter, query.limit);

    },


    /********************************************************************
    Manual sweep. Native TTL is the primary mechanism but we expose
    this for deterministic cleanup or environments where the TTL
    monitor is disabled. Persistent rows (expires_at: null) are
    skipped because the predicate rejects them.
    *********************************************************************/
    cleanupExpiredRecords: async function (instance) {

      const now = instance.time;

      const result = await mongo.deleteRecordsByFilter(
        instance,
        collection_name,
        { expires_at: { $ne: null, $lt: now } }
      );

      if (result.success === false) {
        return { success: false, deleted_count: 0, error: result.error };
      }

      return {
        success: true,
        deleted_count: result.deletedCount || 0,
        error: null
      };

    }


  };

};
