// Info: DynamoDB session store adapter for js-server-helper-auth.
// Uses a single-table design tuned for the auth query patterns:
//
//   Partition Key:  tenant_id
//   Sort Key:       "{actor_id}#{token_key}"
//
// This layout makes every hot-path query a direct index hit:
//
//   getSession(t, a, k, h)    -> GetItem  (PK=t, SK=a#k), then hash compare
//   listSessionsByActor(t, a) -> Query    (PK=t, SK begins_with "a#")
//   deleteSession(t, a, k)    -> DeleteItem (PK=t, SK=a#k)
//   setSession(record)        -> PutItem  (PK=t, SK=a#k, attrs)
//   cleanupExpiredSessions    -> Scan with FilterExpression on expires_at
//
// No GSI is required. LRU eviction and install-id replacement both use
// listSessionsByActor + client-side filtering, matching the other backends.
//
// The token_secret_hash is stored as a regular attribute (not in the SK)
// so (tenant_id, actor_id, token_key) stays a unique triple - a second
// call with the same triple overwrites the old record.
//
// The application injects a ready-to-use DynamoDB helper via
// STORE_CONFIG.lib_dynamodb (typically Lib.DynamoDB).
//
// Schema management (table creation, TTL configuration) is out of scope
// for this adapter. The table must be provisioned out-of-band via IaC,
// the AWS Console, or a one-shot script before the auth module is used.
// setupNewStore() exists in the interface contract but is not implemented
// and will return NOT_IMPLEMENTED until the DynamoDB helper exposes a
// table-management API.
//
// Store contract (identical shape across all adapters):
//   - setupNewStore(instance)            -> { success, error }  (NOT_IMPLEMENTED for DynamoDB)
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
Store instance with its own table_name and lib_dynamodb reference.

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
@param {Object} STORE_CONFIG - { table_name, lib_dynamodb }
@param {Object} ERRORS       - Error catalog forwarded from auth.js

@return {Object} - Store interface (8 methods: setupNewStore, getSession, listSessionsByActor, setSession, updateSessionActivity, deleteSession, deleteSessions, cleanupExpiredSessions)
*********************************************************************/
const createInterface = function (Lib, STORE_CONFIG, ERRORS) {

  ////////////////////////////// Public Functions START ////////////////////////
  const Store = {


    // ~~~~~~~~~~~~~~~~~~~~ Schema Setup ~~~~~~~~~~~~~~~~~~~~
    // DynamoDB table creation and TTL configuration must be provisioned
    // out-of-band (IaC, AWS Console, or the DynamoDB helper module
    // once it gains a table-management API). setupNewStore is part of
    // the store contract but is not yet implemented for this backend.

    /********************************************************************
    Not implemented for DynamoDB. Table provisioning and TTL
    configuration must be done out-of-band until the DynamoDB helper
    exposes a table-management API.

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
    // getSession is a direct GetItem on (PK=tenant_id, SK=actor#key)
    // and verifies the hash client-side so a mismatch looks like
    // "not found" (no timing leak). listSessionsByActor is a Query
    // with begins_with(session_key, "actor#") - served from the
    // composite key's primary index, no scan and no GSI.

    /********************************************************************
    Exact key lookup. Hash compare after the read stays local so a
    wrong secret looks like "record not found" (no timing leak).
    *********************************************************************/
    getSession: async function (instance, tenant_id, actor_id, token_key, token_secret_hash) {

      // Fetch the item by composite primary key
      const result = await STORE_CONFIG.lib_dynamodb.getRecord(instance, STORE_CONFIG.table_name, {
        tenant_id: tenant_id,
        session_key: _Store.sortKey(actor_id, token_key)
      });

      // Return a service error if the driver call failed
      if (result.success === false) {
        Lib.Debug.debug('Auth dynamodb getSession failed', {
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

      // Return early when the item does not exist
      if (result.item === null || result.item === undefined) {
        return {
          success: true,
          record: null,
          error: null
        };
      }

      // Constant-behaviour hash compare - mismatch returns "not found"
      if (result.item.token_secret_hash !== token_secret_hash) {
        return {
          success: true,
          record: null,
          error: null
        };
      }

      // Strip DynamoDB-only keys and return the canonical record
      return {
        success: true,
        record: _Store.itemToRecord(result.item),
        error: null
      };

    },


    /********************************************************************
    Query by partition key with SK begins_with - hits the composite
    key's primary index, no scan. The helper's query() only auto-aliases
    the partition key (#pk); the sort-key clause is appended verbatim,
    so we use the real attribute name "session_key" directly.
    *********************************************************************/
    listSessionsByActor: async function (instance, tenant_id, actor_id) {

      // Build the sort-key prefix that all sessions for this actor share
      const prefix = actor_id + '#';

      // Query using the PK + SK begins_with condition
      const result = await STORE_CONFIG.lib_dynamodb.query(instance, STORE_CONFIG.table_name, {
        pk: tenant_id,
        pkName: 'tenant_id',
        skCondition: 'begins_with(session_key, :sk)',
        skValues: { ':sk': prefix }
      });

      // Return a service error if the driver call failed
      if (result.success === false) {
        Lib.Debug.debug('Auth dynamodb listSessionsByActor failed', {
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

      // Strip DynamoDB-only keys from every item and return the list
      const records = result.items.map(function (item) { return _Store.itemToRecord(item); });
      return {
        success: true,
        records: records,
        error: null
      };

    },


    // ~~~~~~~~~~~~~~~~~~~~ Write ~~~~~~~~~~~~~~~~~~~~
    // Full upsert and partial mutable-field update. setSession uses
    // PutItem so the same (tenant, actor, token_key) triple overwrites
    // the old item. updateSessionActivity uses UpdateItem and refuses
    // identity/PK fields (including session_key) to keep composite-key
    // integrity tamper-proof.

    /********************************************************************
    Upsert via PutItem. The same (tenant_id, actor_id, token_key)
    triple overwrites the existing item.
    *********************************************************************/
    setSession: async function (instance, record) {

      // Encode the canonical record to a DynamoDB item and write it
      const result = await STORE_CONFIG.lib_dynamodb.writeRecord(
        instance,
        STORE_CONFIG.table_name,
        _Store.recordToItem(record)
      );

      // Return a service error if the driver call failed
      if (result.success === false) {
        Lib.Debug.debug('Auth dynamodb setSession failed', {
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
    Partial update via UpdateItem (SET expression). The helper builds
    the ExpressionAttributeNames / Values internally. Identity-column
    guard mirrors the SQL stores so programmer errors fail fast.
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
      // the DynamoDB-specific session_key sort-key attribute
      for (const k of update_keys) {
        if (_Store.UPDATE_IDENTITY_BLOCKLIST.indexOf(k) !== -1) {
          throw new TypeError(
            '[js-server-helper-auth-store-dynamodb] updateSessionActivity cannot modify identity field "' + k + '"'
          );
        }
      }

      // Run the partial UpdateItem against the target session item
      const result = await STORE_CONFIG.lib_dynamodb.updateRecord(
        instance,
        STORE_CONFIG.table_name,
        { tenant_id: tenant_id, session_key: _Store.sortKey(actor_id, token_key) },
        updates
      );

      // Return a service error if the driver call failed
      if (result.success === false) {
        Lib.Debug.debug('Auth dynamodb updateSessionActivity failed', {
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
    // Single and bulk deletion by composite key. Bulk variant uses
    // batchDeleteRecords (AWS 25-item limit; the helper chunks
    // automatically) so revokeAllSessions / install-id replacement
    // stay bounded-cost regardless of session count.

    /********************************************************************
    Delete one session by composite key.
    *********************************************************************/
    deleteSession: async function (instance, tenant_id, actor_id, token_key) {

      // Remove the item by its composite primary key
      const result = await STORE_CONFIG.lib_dynamodb.deleteRecord(
        instance,
        STORE_CONFIG.table_name,
        { tenant_id: tenant_id, session_key: _Store.sortKey(actor_id, token_key) }
      );

      // Return a service error if the driver call failed
      if (result.success === false) {
        Lib.Debug.debug('Auth dynamodb deleteSession failed', {
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
    Batch delete many sessions. AWS limits the batch to 25 items; the
    helper chunks automatically. Skips the round-trip if the keys list
    is empty.
    *********************************************************************/
    deleteSessions: async function (instance, tenant_id, keys) {

      // Skip the round-trip when the caller provides no keys
      if (keys.length === 0) {
        return {
          success: true,
          error: null
        };
      }

      // Build the batchDeleteRecords key map for this table
      const keysByTable = {};
      keysByTable[STORE_CONFIG.table_name] = keys.map(function (k) {
        return {
          tenant_id: tenant_id,
          session_key: _Store.sortKey(k.actor_id, k.token_key)
        };
      });

      // Delete all matched items in one (or more, if chunked) round-trips
      const result = await STORE_CONFIG.lib_dynamodb.batchDeleteRecords(instance, keysByTable);

      // Return a service error if the driver call failed
      if (result.success === false) {
        Lib.Debug.debug('Auth dynamodb deleteSessions failed', {
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
    // Background sweep for expired items. DynamoDB has no DELETE by
    // predicate, so cleanupExpiredSessions scans then batch-deletes.
    // Production deployments may prefer enabling native DynamoDB TTL
    // on expires_at (the integer seconds-since-epoch value stored
    // matches the TTL-attribute format AWS expects).

    /********************************************************************
    Sweep expired sessions. DynamoDB does not support a single-shot
    DELETE by predicate - we Scan with a filter then batchDelete.
    Since cleanup runs rarely (cron-driven), this is acceptable.
    Production deployments may enable DynamoDB TTL on expires_at
    out-of-band for automatic expiry without scans.
    *********************************************************************/
    cleanupExpiredSessions: async function (instance) {

      // Scan for all items whose expires_at is in the past
      const now = instance.time;
      const scan_result = await STORE_CONFIG.lib_dynamodb.scan(instance, STORE_CONFIG.table_name, {
        expression: '#ea < :now',
        names: { '#ea': 'expires_at' },
        values: { ':now': now }
      });

      // Return a service error if the scan failed
      if (scan_result.success === false) {
        Lib.Debug.debug('Auth dynamodb cleanupExpiredSessions scan failed', {
          type: ERRORS.SERVICE_UNAVAILABLE.type,
          driver_type: scan_result.error && scan_result.error.type,
          driver_message: scan_result.error && scan_result.error.message
        });
        return {
          success: false,
          deleted_count: 0,
          error: ERRORS.SERVICE_UNAVAILABLE
        };
      }

      // Return early with 0 when no expired items were found
      if (scan_result.items.length === 0) {
        return {
          success: true,
          deleted_count: 0,
          error: null
        };
      }

      // Build the batchDelete key map from the scanned items
      const keysByTable = {};
      keysByTable[STORE_CONFIG.table_name] = scan_result.items.map(function (item) {
        return { tenant_id: item.tenant_id, session_key: item.session_key };
      });

      // Delete the expired items in one (or more, if chunked) batch call
      const delete_result = await STORE_CONFIG.lib_dynamodb.batchDeleteRecords(instance, keysByTable);

      // Return a service error if the batch delete failed
      if (delete_result.success === false) {
        Lib.Debug.debug('Auth dynamodb cleanupExpiredSessions batchDelete failed', {
          type: ERRORS.SERVICE_UNAVAILABLE.type,
          driver_type: delete_result.error && delete_result.error.type,
          driver_message: delete_result.error && delete_result.error.message,
          batch_size: scan_result.items.length
        });
        return {
          success: false,
          deleted_count: 0,
          error: ERRORS.SERVICE_UNAVAILABLE
        };
      }

      // Report success with the number of items removed
      return {
        success: true,
        deleted_count: scan_result.items.length,
        error: null
      };

    }

  };////////////////////////////// Public Functions END ////////////////////////



  ///////////////////////////// Private Functions START ////////////////////////
  const _Store = {

    // Columns the caller is never allowed to mutate through
    // updateSessionActivity. This is a security + integrity blocklist -
    // passing any of these triggers a TypeError so the regression is
    // visible in dev / CI immediately. session_key is the DynamoDB SK
    // attribute and must be included alongside the canonical identity fields.
    UPDATE_IDENTITY_BLOCKLIST: [
      'tenant_id', 'actor_id', 'actor_type', 'token_key', 'token_secret_hash',
      'created_at', 'install_id', 'install_platform', 'install_form_factor',
      'session_key'
    ],


    /********************************************************************
    Compose the sort key from actor_id and token_key. actor_id is
    validated for '-' and '#' by the higher auth layer; token_key is
    generated from the controlled TOKEN_CHARSET so '#' never appears.

    @param {String} actor_id  - Actor identifier
    @param {String} token_key - Session token key

    @return {String} - "{actor_id}#{token_key}"
    *********************************************************************/
    sortKey: function (actor_id, token_key) {

      // Concatenate with the # separator reserved for composite keys
      return actor_id + '#' + token_key;

    },


    /********************************************************************
    Convert a canonical session record into the DynamoDB item shape.
    Each canonical field becomes a top-level attribute; tenant_id is
    the PK and session_key is the SK.

    @param {Object} record - Canonical session record

    @return {Object} - DynamoDB item (record + PK/SK attributes)
    *********************************************************************/
    recordToItem: function (record) {

      // Merge the sort-key attribute into a copy of the canonical record
      return Object.assign(
        {
          tenant_id: record.tenant_id,
          session_key: _Store.sortKey(record.actor_id, record.token_key)
        },
        record
      );

    },


    /********************************************************************
    Strip the DynamoDB-only session_key attribute so callers receive a
    clean canonical record.

    @param {Object} item - Raw DynamoDB item

    @return {Object|null} - Canonical session record, or null
    *********************************************************************/
    itemToRecord: function (item) {

      // Return null for missing items (driver-returned undefined or null)
      if (item === null || item === undefined) {
        return null;
      }

      // Delete the DynamoDB-specific sort-key attribute from a shallow copy
      const rec = Object.assign({}, item);
      delete rec.session_key;
      return rec;

    }

  };///////////////////////////// Private Functions END ////////////////////////


  return Store;

};///////////////////////////// createInterface END /////////////////////////////
