// Info: DynamoDB backend for the auth module. Uses a single-table
// design tuned for the auth query patterns:
//
//   - Partition Key:  tenant_id
//   - Sort Key:       "{actor_id}#{token_key}"
//
// This layout makes every hot-path query a direct index hit:
//
//   getSession(t, a, k, h)       -> GetItem  (PK=t, SK=a#k), then hash compare
//   listSessionsByActor(t, a)    -> Query    (PK=t, SK begins_with "a#")
//   deleteSession(t, a, k)       -> DeleteItem (PK=t, SK=a#k)
//   setSession(record)           -> PutItem  (PK=t, SK=a#k, attrs)
//   cleanupExpiredSessions       -> Scan with FilterExpression on expires_at
//
// No GSI is required - LRU eviction happens client-side via listSessionsByActor
// + the pure Policy module, matching the other backends. Install-id replacement
// also piggybacks on the list-then-filter algorithm, so we avoid secondary
// indexes entirely.
//
// The token_secret_hash is stored as a regular attribute (not in the SK) so
// (tenant_id, actor_id, token_key) remains a unique triple - a second call
// with the same triple overwrites the old record rather than creating a
// parallel row with a different hash.
//
// The application injects a ready-to-use DynamoDB helper via
// CONFIG.STORE_CONFIG.lib_dynamodb.
'use strict';


/********************************************************************
Factory for the DynamoDB store.

@param {Object} Lib - Dependency container (Utils, Debug)
@param {Object} store_config - { table_name, lib_dynamodb }

@return {Object} - Store interface matching the other stores
*********************************************************************/
module.exports = function dynamodbStoreFactory (Lib, store_config) {

  if (
    Lib.Utils.isNullOrUndefined(store_config) ||
    !Lib.Utils.isObject(store_config)
  ) {
    throw new Error('[js-server-helper-auth] STORE_CONFIG must be an object for dynamodb');
  }

  if (
    Lib.Utils.isNullOrUndefined(store_config.table_name) ||
    !Lib.Utils.isString(store_config.table_name) ||
    Lib.Utils.isEmptyString(store_config.table_name)
  ) {
    throw new Error('[js-server-helper-auth] STORE_CONFIG.table_name is required for dynamodb');
  }

  if (Lib.Utils.isNullOrUndefined(store_config.lib_dynamodb)) {
    throw new Error('[js-server-helper-auth] STORE_CONFIG.lib_dynamodb is required for dynamodb (pass Lib.DynamoDB)');
  }

  const table_name = store_config.table_name;
  const dynamo = store_config.lib_dynamodb;


  /********************************************************************
  Compose the sort key. actor_id is already validated for '-' and '#'
  by the higher layers; token_key is generated internally from the
  TOKEN_CHARSET so it is guaranteed not to contain '#'.
  *********************************************************************/
  const sortKey = function (actor_id, token_key) {
    return actor_id + '#' + token_key;
  };


  /********************************************************************
  Convert a canonical session record into the DynamoDB item shape.
  We keep each canonical field as a top-level attribute plus add the
  PK + SK. DynamoDB stores booleans natively and accepts nested
  objects for custom_data directly - no JSON string needed.
  *********************************************************************/
  const recordToItem = function (record) {

    return Object.assign(
      {
        tenant_id: record.tenant_id,        // PK
        session_key: sortKey(record.actor_id, record.token_key) // SK
      },
      record
    );

  };


  /********************************************************************
  Strip the DynamoDB-only attributes so callers receive a clean
  canonical record.
  *********************************************************************/
  const itemToRecord = function (item) {

    if (item === null || item === undefined) {
      return null;
    }

    const rec = Object.assign({}, item);
    delete rec.session_key;
    return rec;

  };


  return {


    /********************************************************************
    Idempotent setup. Creates the single-table with composite key.
    PAY_PER_REQUEST is the default - suitable for small apps and
    DynamoDB Local. Production apps can pre-provision via IaC instead.
    *********************************************************************/
    initialize: async function (instance) {

      const result = await dynamo.createTable(instance, table_name, {
        attribute_definitions: [
          { name: 'tenant_id',   type: 'S' },
          { name: 'session_key', type: 'S' }
        ],
        key_schema: [
          { name: 'tenant_id',   type: 'HASH' },
          { name: 'session_key', type: 'RANGE' }
        ],
        billing_mode: 'PAY_PER_REQUEST'
      });

      if (result.success === false) {
        return { success: false, error: result.error };
      }

      return { success: true, error: null };

    },


    /********************************************************************
    Exact key lookup. Hash compare after the read stays local so a
    wrong secret looks like "record not found".
    *********************************************************************/
    getSession: async function (instance, tenant_id, actor_id, token_key, token_secret_hash) {

      const result = await dynamo.getRecord(instance, table_name, {
        tenant_id: tenant_id,
        session_key: sortKey(actor_id, token_key)
      });

      if (result.success === false) {
        return { success: false, record: null, error: result.error };
      }

      if (result.item === null || result.item === undefined) {
        return { success: true, record: null, error: null };
      }

      if (result.item.token_secret_hash !== token_secret_hash) {
        return { success: true, record: null, error: null };
      }

      return { success: true, record: itemToRecord(result.item), error: null };

    },


    /********************************************************************
    Upsert via PutItem. Matches (tenant_id, actor_id, token_key) by
    composite PK so a second call overwrites the row.
    *********************************************************************/
    setSession: async function (instance, record) {

      const result = await dynamo.writeRecord(instance, table_name, recordToItem(record));

      if (result.success === false) {
        return { success: false, error: result.error };
      }

      return { success: true, error: null };

    },


    /********************************************************************
    Delete one session by composite key.
    *********************************************************************/
    deleteSession: async function (instance, tenant_id, actor_id, token_key) {

      const result = await dynamo.deleteRecord(instance, table_name, {
        tenant_id: tenant_id,
        session_key: sortKey(actor_id, token_key)
      });

      if (result.success === false) {
        return { success: false, error: result.error };
      }

      return { success: true, error: null };

    },


    /********************************************************************
    Batch delete many sessions via batchDeleteRecords. AWS limits the
    batch to 25 items; the helper chunks automatically.
    *********************************************************************/
    deleteSessions: async function (instance, tenant_id, keys) {

      if (keys.length === 0) {
        return { success: true, error: null };
      }

      const keysByTable = {};
      keysByTable[table_name] = keys.map(function (k) {
        return {
          tenant_id: tenant_id,
          session_key: sortKey(k.actor_id, k.token_key)
        };
      });

      const result = await dynamo.batchDeleteRecords(instance, keysByTable);

      if (result.success === false) {
        return { success: false, error: result.error };
      }

      return { success: true, error: null };

    },


    /********************************************************************
    Query by partition key with SK begins_with - hits the composite
    key's primary index, no scan.
    *********************************************************************/
    listSessionsByActor: async function (instance, tenant_id, actor_id) {

      const prefix = actor_id + '#';

      const result = await dynamo.query(instance, table_name, {
        pk: tenant_id,
        pkName: 'tenant_id',
        skCondition: 'begins_with(#sk, :sk)',
        skValues: { ':sk': prefix }
      });

      // The helper's query uses ExpressionAttributeNames for #pk but
      // not for #sk - we add the sk alias manually through skCondition.
      // We need a raw condition with no alias; passing #sk requires the
      // name to be defined. Fall back to manual builder when required.
      // In practice the helper exposes pkName; skCondition is appended
      // directly. To avoid the #sk alias issue, rewrite the condition
      // to use the real attribute name:
      if (result.success === false && result.error && /sk/.test(result.error.message || '')) {
        const retry = await dynamo.query(instance, table_name, {
          pk: tenant_id,
          pkName: 'tenant_id',
          skCondition: 'begins_with(session_key, :sk)',
          skValues: { ':sk': prefix }
        });
        if (retry.success === false) {
          return { success: false, records: null, error: retry.error };
        }
        const records = retry.items.map(itemToRecord);
        return { success: true, records: records, error: null };
      }

      if (result.success === false) {
        return { success: false, records: null, error: result.error };
      }

      const records = result.items.map(itemToRecord);
      return { success: true, records: records, error: null };

    },


    /********************************************************************
    Partial update via UpdateItem (SET expression). The helper builds
    the ExpressionAttributeNames / Values internally.
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
          k === 'session_key'
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

      const result = await dynamo.updateRecord(
        instance,
        table_name,
        { tenant_id: tenant_id, session_key: sortKey(actor_id, token_key) },
        updates
      );

      if (result.success === false) {
        return { success: false, error: result.error };
      }

      return { success: true, error: null };

    },


    /********************************************************************
    Sweep expired sessions. DynamoDB does not support a single-shot
    DELETE by predicate - we scan and batch-delete. Since cleanup runs
    rarely (cron-driven), this is acceptable; production deployments
    may prefer DynamoDB TTL (expires_at must then be a number of
    seconds-since-epoch, which we already store).
    *********************************************************************/
    cleanupExpiredSessions: async function (instance) {

      const now = instance.time;

      // Scan with a filter. Use an ExpressionAttributeNames alias for
      // expires_at to avoid any reserved-word collision (AWS rejects
      // the filter if an empty names map is passed alongside a filter
      // that references raw attribute names).
      const scan_result = await dynamo.scan(instance, table_name, {
        expression: '#ea < :now',
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
        return { tenant_id: item.tenant_id, session_key: item.session_key };
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
