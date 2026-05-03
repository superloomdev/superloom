// Info: DynamoDB backend for the logger module. Single-table design with
// a global secondary index so both list paths are direct index hits:
//
//   Base table:
//     PK: entity_pk (S)   = "{scope}\u0000{entity_type}\u0000{entity_id}"
//     SK: sort_key  (S)   = "{created_at_ms}-{rand3}"
//
//   GSI `actor_index`:
//     PK: actor_pk  (S)   = "{scope}\u0000{actor_type}\u0000{actor_id}"
//     SK: sort_key  (S)
//
// Each item also carries every canonical record field at top level so
// projection ALL on the GSI returns full records without an extra read.
// `expires_at` doubles as the DynamoDB TTL attribute - if the deployer
// enables table-level TTL on `expires_at`, AWS sweeps records within
// ~48 hours of expiry. Persistent records have `expires_at: null` and
// are skipped by the TTL sweeper.
//
// Optional filters (action, time range) are applied client-side after
// the query because DynamoDB's `FilterExpression` runs after the page
// is read - same total cost. The cursor is the last-seen `sort_key`
// (not the LastEvaluatedKey object) so the cursor format is identical
// across all backends.
'use strict';


const ACTOR_INDEX_NAME = 'actor_pk_sort_key_index';


/********************************************************************
Factory for the DynamoDB store.

@param {Object} Lib - Dependency container (Utils, Debug)
@param {Object} store_config - { table_name, lib_dynamodb }

@return {Object} - Store interface
*********************************************************************/
module.exports = function dynamodbStoreFactory (Lib, store_config) {

  if (
    Lib.Utils.isNullOrUndefined(store_config) ||
    !Lib.Utils.isObject(store_config)
  ) {
    throw new Error('[js-server-helper-logger] STORE_CONFIG must be an object for dynamodb');
  }

  if (
    Lib.Utils.isNullOrUndefined(store_config.table_name) ||
    !Lib.Utils.isString(store_config.table_name) ||
    Lib.Utils.isEmptyString(store_config.table_name)
  ) {
    throw new Error('[js-server-helper-logger] STORE_CONFIG.table_name is required for dynamodb');
  }

  if (Lib.Utils.isNullOrUndefined(store_config.lib_dynamodb)) {
    throw new Error('[js-server-helper-logger] STORE_CONFIG.lib_dynamodb is required for dynamodb (pass Lib.DynamoDB)');
  }

  const table_name = store_config.table_name;
  const dynamo = store_config.lib_dynamodb;


  /********************************************************************
  Composite key helpers. NUL byte separator means no caller-supplied
  identifier (which is text) can collide. The values are opaque
  equality match keys for DynamoDB - we never parse them back.
  *********************************************************************/
  const entityPk = function (scope, entity_type, entity_id) {
    return scope + '\u0000' + entity_type + '\u0000' + entity_id;
  };
  const actorPk = function (scope, actor_type, actor_id) {
    return scope + '\u0000' + actor_type + '\u0000' + actor_id;
  };


  /********************************************************************
  Convert a canonical record into the DynamoDB item shape. Adds the
  base-table PK + GSI PK; everything else is stored as-is. JSON
  serialisation of `data` is unnecessary - DynamoDB stores nested
  objects natively.

  `expires_at` is omitted for persistent records (rather than stored
  as NULL) for two reasons:
    - DynamoDB's table-level TTL feature only sweeps items whose TTL
      attribute is a Number; an absent attribute is correctly ignored.
    - Our cleanupExpiredRecords scan uses `attribute_exists(expires_at)`
      to avoid ever touching persistent rows.
  *********************************************************************/
  const recordToItem = function (record) {

    const item = {
      entity_pk:     entityPk(record.scope, record.entity_type, record.entity_id),
      actor_pk:      actorPk(record.scope, record.actor_type, record.actor_id),
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
      sort_key:      record.sort_key
    };

    if (record.expires_at !== null && record.expires_at !== undefined) {
      item.expires_at = record.expires_at;
    }

    return item;

  };


  /********************************************************************
  Reverse - return only the canonical fields. Drops the index PKs so
  the caller receives the documented shape and nothing else.
  *********************************************************************/
  const itemToRecord = function (item) {

    if (item === null || item === undefined) {
      return null;
    }

    return {
      scope:         item.scope,
      entity_type:   item.entity_type,
      entity_id:     item.entity_id,
      actor_type:    item.actor_type,
      actor_id:      item.actor_id,
      action:        item.action,
      data:          item.data === undefined ? null : item.data,
      ip:            item.ip === undefined ? null : item.ip,
      user_agent:    item.user_agent === undefined ? null : item.user_agent,
      created_at:    item.created_at,
      created_at_ms: item.created_at_ms,
      sort_key:      item.sort_key,
      expires_at:    item.expires_at === undefined ? null : item.expires_at
    };

  };


  /********************************************************************
  Optional client-side filter. Returns true iff the record should be
  kept. Mirrors the SQL/Memory store filter logic byte for byte so
  every backend's contract is observably identical.
  *********************************************************************/
  const passesOptionalFilters = function (record, query) {

    if (query.start_time_ms !== null && record.created_at_ms < query.start_time_ms) {
      return false;
    }
    if (query.end_time_ms !== null && record.created_at_ms >= query.end_time_ms) {
      return false;
    }

    if (query.actions !== null && query.actions.length > 0) {
      let any = false;
      for (const pattern of query.actions) {
        if (pattern.endsWith('.*')) {
          const prefix = pattern.slice(0, -2);
          if (record.action === prefix || record.action.startsWith(prefix + '.')) {
            any = true; break;
          }
        } else if (record.action === pattern) {
          any = true; break;
        }
      }
      if (!any) {
        return false;
      }
    }

    return true;

  };


  /********************************************************************
  Issue a Query, apply filters, build the next cursor.

  The cursor parameter is the previous page's last sort_key.
  *********************************************************************/
  const runListQuery = async function (instance, params, query) {

    const result = await dynamo.query(instance, table_name, params);

    if (result.success === false) {
      return { success: false, records: [], next_cursor: null, error: result.error };
    }

    const all_items = result.items.map(itemToRecord);
    const filtered = all_items.filter(function (r) {
      return passesOptionalFilters(r, query);
    });

    // next_cursor: when DynamoDB returned a full page (limit hit) we
    // resume after the last *seen* item, regardless of whether it
    // passed the filter. Otherwise no more pages exist.
    let next_cursor = null;
    if (all_items.length === query.limit && all_items.length > 0) {
      next_cursor = all_items[all_items.length - 1].sort_key;
    }

    return { success: true, records: filtered, next_cursor: next_cursor, error: null };

  };


  return {


    /********************************************************************
    Idempotent table provisioning with the GSI. PAY_PER_REQUEST is the
    default - production deployments should manage tables via IaC
    instead of relying on this method.
    *********************************************************************/
    initialize: async function (instance) {

      const result = await dynamo.createTable(instance, table_name, {
        attribute_definitions: [
          { name: 'entity_pk', type: 'S' },
          { name: 'actor_pk',  type: 'S' },
          { name: 'sort_key',  type: 'S' }
        ],
        key_schema: [
          { name: 'entity_pk', type: 'HASH' },
          { name: 'sort_key',  type: 'RANGE' }
        ],
        billing_mode: 'PAY_PER_REQUEST',
        global_secondary_indexes: [
          {
            name: ACTOR_INDEX_NAME,
            key_schema: [
              { name: 'actor_pk', type: 'HASH' },
              { name: 'sort_key', type: 'RANGE' }
            ],
            projection_type: 'ALL'
          }
        ]
      });

      if (result.success === false) {
        return { success: false, error: result.error };
      }

      return { success: true, error: null };

    },


    /********************************************************************
    PutItem - the composite (entity_pk, sort_key) is unique by design
    (sort_key embeds a millisecond + 3-char random suffix), so two
    log() calls in the same ms will collide once in 17576 attempts -
    the second call simply overwrites the first, which is acceptable
    for an audit log because the records would be near-identical.
    *********************************************************************/
    addRecord: async function (instance, record) {

      const result = await dynamo.writeRecord(instance, table_name, recordToItem(record));

      return {
        success: result.success,
        error: result.error || null
      };

    },


    /********************************************************************
    Query the base table by entity_pk. Sort key descending is the
    helper's default; we add a cursor predicate when paginating.
    *********************************************************************/
    listByEntity: async function (instance, query) {

      const params = {
        pk:     entityPk(query.scope, query.entity_type, query.entity_id),
        pkName: 'entity_pk',
        limit:  query.limit
      };

      if (query.cursor !== null) {
        params.skCondition = 'sort_key < :cursor';
        params.skValues    = { ':cursor': query.cursor };
      }

      return runListQuery(instance, params, query);

    },


    /********************************************************************
    Query the GSI by actor_pk.
    *********************************************************************/
    listByActor: async function (instance, query) {

      const params = {
        pk:        actorPk(query.scope, query.actor_type, query.actor_id),
        pkName:    'actor_pk',
        indexName: ACTOR_INDEX_NAME,
        limit:     query.limit
      };

      if (query.cursor !== null) {
        params.skCondition = 'sort_key < :cursor';
        params.skValues    = { ':cursor': query.cursor };
      }

      return runListQuery(instance, params, query);

    },


    /********************************************************************
    Manual sweep. Native TTL is the primary mechanism in production
    once `expires_at` is enabled as the table TTL attribute, but this
    explicit fallback is required for environments without that
    feature (DynamoDB Local, deterministic test runs).

    Persistent records have `expires_at: null` so the FilterExpression
    `attribute_exists` ensures they are never selected.
    *********************************************************************/
    cleanupExpiredRecords: async function (instance) {

      const now = instance.time;

      const scan_result = await dynamo.scan(instance, table_name, {
        expression: 'attribute_exists(#ea) AND #ea < :now',
        names: { '#ea': 'expires_at' },
        values: { ':now': now }
      });

      if (scan_result.success === false) {
        return { success: false, deleted_count: 0, error: scan_result.error };
      }

      if (scan_result.items.length === 0) {
        return { success: true, deleted_count: 0, error: null };
      }

      const keysByTable = {};
      keysByTable[table_name] = scan_result.items.map(function (item) {
        return { entity_pk: item.entity_pk, sort_key: item.sort_key };
      });

      const delete_result = await dynamo.batchDeleteRecords(instance, keysByTable);
      if (delete_result.success === false) {
        return { success: false, deleted_count: 0, error: delete_result.error };
      }

      return {
        success: true,
        deleted_count: scan_result.items.length,
        error: null
      };

    }


  };

};
