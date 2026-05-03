// Info: Compliance-friendly action log. Records one immutable row per
// log-worthy event: who acted (actor_type/actor_id), on what (entity_type/
// entity_id), doing which action (dot-notation string), with free-form
// structured `data` that the application interprets per action type.
// Optional IP + user-agent capture for regulator-facing audit trails.
//
// Per-entry retention: `persistent` = never deleted, or `{ ttl_seconds: N }`
// = auto-deleted at `created_at + N`. The TTL is stored on the row, not as
// a module-wide rule, so a single log table can mix short-retention events
// (logins, read-audits) with forever-retained events (user created,
// account terminated, GDPR deletion markers).
//
// Storage backends: memory (tests), sqlite, postgres, mysql, mongodb,
// dynamodb. One backend per loader call, selected via `CONFIG.STORE`.
// Other backends never load - their npm dependencies stay uninstalled.
//
// Writes are fire-and-forget by default via `Lib.Instance.backgroundRoutine`
// so the request-handling path never waits on the log write. Callers that
// need durable confirmation (compliance: "do not return 200 OK until the
// password-change audit row is committed") pass `options.await = true`.
//
// Compatibility: Node.js 20.19+.
//
// Factory pattern: each loader call returns an independent Logger with its
// own Lib, CONFIG, and store.
'use strict';



/////////////////////////// Module-Loader START ////////////////////////////////

/********************************************************************
Factory loader. One call = one independent instance.

@param {Object} shared_libs - Lib container with Utils, Debug, Crypto,
                              Instance, and optionally HttpHandler for
                              IP / user-agent auto-capture.
@param {Object} config - Overrides merged over module config defaults.

@return {Object} - Public interface for this module.
*********************************************************************/
module.exports = function loader (shared_libs, config) {

  // Dependencies for this instance
  const Lib = {
    Utils: shared_libs.Utils,
    Debug: shared_libs.Debug,
    Crypto: shared_libs.Crypto,
    Instance: shared_libs.Instance,
    HttpHandler: shared_libs.HttpHandler || null
  };

  // Merge overrides over defaults
  const CONFIG = Object.assign(
    {},
    require('./logger.config'),
    config || {}
  );

  // Validate the config shape so misconfiguration fails at boot
  validateConfig(Lib, CONFIG);

  // Resolve the requested store via the lazy registry.
  const loadStoreFactory = require('./stores');
  const StoreFactory = loadStoreFactory(CONFIG.STORE);
  const store = StoreFactory(Lib, CONFIG.STORE_CONFIG || {});

  return createInterface(Lib, CONFIG, store);

};///////////////////////////// Module-Loader END ///////////////////////////////



//////////////////////////// Config Validation START ///////////////////////////

/********************************************************************
Validate the merged CONFIG. Throws on every missing-required violation.

@param {Object} Lib - Dependency container
@param {Object} CONFIG - Merged configuration

@return {void}
*********************************************************************/
const validateConfig = function (Lib, CONFIG) {

  if (
    Lib.Utils.isNullOrUndefined(CONFIG.STORE) ||
    !Lib.Utils.isString(CONFIG.STORE) ||
    Lib.Utils.isEmptyString(CONFIG.STORE)
  ) {
    throw new Error('[js-server-helper-logger] CONFIG.STORE is required (one of the supported store names)');
  }

  if (Lib.Utils.isNullOrUndefined(CONFIG.STORE_CONFIG)) {
    throw new Error('[js-server-helper-logger] CONFIG.STORE_CONFIG is required (object)');
  }

  if (!Lib.Utils.isObject(CONFIG.STORE_CONFIG)) {
    throw new Error('[js-server-helper-logger] CONFIG.STORE_CONFIG must be a plain object');
  }

  if (Lib.Utils.isNullOrUndefined(CONFIG.ERRORS)) {
    throw new Error('[js-server-helper-logger] CONFIG.ERRORS is required (map of failure key to your domain error object)');
  }

  const required_error_keys = [
    'STORE_READ_FAILED',
    'STORE_WRITE_FAILED'
  ];
  for (const error_key of required_error_keys) {
    if (Lib.Utils.isNullOrUndefined(CONFIG.ERRORS[error_key])) {
      throw new Error('[js-server-helper-logger] CONFIG.ERRORS.' + error_key + ' is required');
    }
  }

  // IP_ENCRYPT_KEY is optional, but if present it must be a non-empty string
  if (!Lib.Utils.isNullOrUndefined(CONFIG.IP_ENCRYPT_KEY)) {
    if (
      !Lib.Utils.isString(CONFIG.IP_ENCRYPT_KEY) ||
      Lib.Utils.isEmptyString(CONFIG.IP_ENCRYPT_KEY)
    ) {
      throw new Error('[js-server-helper-logger] CONFIG.IP_ENCRYPT_KEY must be a non-empty string when set');
    }
  }

};

//////////////////////////// Config Validation END /////////////////////////////



/////////////////////////// createInterface START //////////////////////////////

/********************************************************************
Builds the public interface for one instance.

@param {Object} Lib - Dependency container
@param {Object} CONFIG - Merged configuration for this instance
@param {Object} store - Resolved storage backend interface

@return {Object} - Public interface for this module.
*********************************************************************/
const createInterface = function (Lib, CONFIG, store) {

  /*======================= Public Functions ===============================*/
  const Logger = {


    /********************************************************************
    Record one action log entry.

    By default the store write runs in the background and this function
    returns immediately with `{ success: true }`. Pass `options.await = true`
    to make the write synchronous - required for compliance scenarios that
    must not return 200 OK until the audit row is durable.

    @param {Object} instance - Request instance (for time, lifecycle, and
                               http_request auto-capture).
    @param {Object} options  - Log entry fields.
    @param {String} [options.scope]        - Multi-tenant namespace (default '').
    @param {String} options.entity_type    - Type of the affected entity
                                             (e.g. 'user', 'project', 'invoice').
    @param {String} options.entity_id      - ID of the affected entity.
    @param {String} options.actor_type     - Type of the actor who triggered
                                             the event (e.g. 'user', 'admin',
                                             'system', 'webhook').
    @param {String} options.actor_id       - ID of the actor.
    @param {String} options.action         - Dot-notation action type - e.g.
                                             'auth.login', 'profile.name.changed'.
                                             The application owns the namespace;
                                             this module is opaque to it.
    @param {Object} [options.data]         - Free-form structured payload
                                             describing the event. Must be
                                             JSON-serializable.
    @param {String} [options.ip]           - Event IP. Auto-captured from
                                             `instance.http_request` via
                                             `Lib.HttpHandler.getHttpRequestIPAddress`
                                             when that helper is present.
    @param {String} [options.user_agent]   - Event user-agent. Same auto-capture.
    @param {String|Object} options.retention
       - 'persistent'         -> never deleted
       - { ttl_seconds: N }    -> deleted at created_at + N seconds
    @param {Boolean} [options.await] - Await the store write (default false).

    @return {Promise<Object>} - `{ success, error }`.
    *********************************************************************/
    log: async function (instance, options) {

      // Programmer errors throw synchronously - they are never envelope errors
      _Logger.validateLogOptions(options);

      // Build the persistent record, enriching with auto-captured context
      // and applying IP encryption before the value leaves memory.
      const record = _Logger.buildRecord(instance, options);

      // Fire-and-forget is the default. Compliance callers opt in to await.
      if (options.await === true) {

        const write_result = await store.addRecord(instance, record);
        if (write_result.success === false) {
          Lib.Debug.debug('Logger addRecord failed', {
            scope: record.scope,
            entity_type: record.entity_type,
            entity_id: record.entity_id,
            action: record.action,
            error: write_result.error
          });
          return { success: false, error: CONFIG.ERRORS.STORE_WRITE_FAILED };
        }

        return { success: true, error: null };

      }

      // Detach the write from the request lifecycle. Errors are logged but
      // never surface to the caller - the point of background mode is to
      // not block response time on an audit row.
      const completeBackgroundRoutine = Lib.Instance.backgroundRoutine(instance);
      store.addRecord(instance, record)
        .then(function (write_result) {
          if (write_result.success === false) {
            Lib.Debug.debug('Logger addRecord failed (background)', {
              scope: record.scope,
              entity_type: record.entity_type,
              entity_id: record.entity_id,
              action: record.action,
              error: write_result.error
            });
          }
        })
        .catch(function (err) {
          Lib.Debug.debug('Logger addRecord threw (background)', { error: err && err.message });
        })
        .finally(function () {
          completeBackgroundRoutine();
        });

      return { success: true, error: null };

    },


    /********************************************************************
    List actions recorded for one entity, most-recent first.

    @param {Object} instance - Request instance.
    @param {Object} options - Query options.
    @param {String} [options.scope]          - Multi-tenant namespace (default '').
    @param {String} options.entity_type      - Entity type filter.
    @param {String} options.entity_id        - Entity id filter.
    @param {String[]} [options.actions]      - Optional action filter. Each
                                               entry is a literal action or
                                               an `"auth.*"` glob prefix.
    @param {Integer} [options.start_time_ms] - Inclusive lower bound on
                                               created_at_ms.
    @param {Integer} [options.end_time_ms]   - Exclusive upper bound on
                                               created_at_ms.
    @param {String} [options.cursor]         - Opaque resume token from the
                                               previous page's `next_cursor`.
    @param {Integer} [options.limit]         - Page size (default 50).

    @return {Promise<Object>} - `{ success, records, next_cursor, error }`.
    *********************************************************************/
    listByEntity: async function (instance, options) {

      _Logger.validateListByEntityOptions(options);

      const result = await store.listByEntity(instance, _Logger.buildQuery(options));
      if (result.success === false) {
        return {
          success: false,
          records: [],
          next_cursor: null,
          error: CONFIG.ERRORS.STORE_READ_FAILED
        };
      }

      return {
        success: true,
        records: result.records.map(_Logger.enrichRecordForRead),
        next_cursor: result.next_cursor,
        error: null
      };

    },


    /********************************************************************
    List actions performed by one actor, most-recent first.

    Same return shape as listByEntity. See listByEntity for the options
    contract - `actor_type` / `actor_id` replace entity_* on this side.
    *********************************************************************/
    listByActor: async function (instance, options) {

      _Logger.validateListByActorOptions(options);

      const result = await store.listByActor(instance, _Logger.buildQuery(options));
      if (result.success === false) {
        return {
          success: false,
          records: [],
          next_cursor: null,
          error: CONFIG.ERRORS.STORE_READ_FAILED
        };
      }

      return {
        success: true,
        records: result.records.map(_Logger.enrichRecordForRead),
        next_cursor: result.next_cursor,
        error: null
      };

    },


    /********************************************************************
    Delete records whose `expires_at` is in the past. Intended to run
    from cron / EventBridge / `setInterval`. Native TTL on MongoDB and
    DynamoDB already handles expiry in the background; this function is
    the explicit fallback when a deployer wants deterministic cleanup.

    SQL backends (postgres, mysql, sqlite) have no native TTL - this is
    the primary sweep mechanism for those.

    @param {Object} instance - Request instance.

    @return {Promise<Object>} - `{ success, deleted_count, error }`.
    *********************************************************************/
    cleanupExpiredRecords: async function (instance) {

      if (!Lib.Utils.isFunction(store.cleanupExpiredRecords)) {
        return { success: true, deleted_count: 0, error: null };
      }

      const result = await store.cleanupExpiredRecords(instance);
      if (result.success === false) {
        return {
          success: false,
          deleted_count: 0,
          error: CONFIG.ERRORS.STORE_WRITE_FAILED
        };
      }

      return {
        success: true,
        deleted_count: result.deleted_count || 0,
        error: null
      };

    },


    /********************************************************************
    Idempotent backend setup. Memory store: no-op. SQL: CREATE TABLE
    IF NOT EXISTS + indexes on (entity_pk) / (actor_pk) / (expires_at).
    MongoDB: TTL index on `_ttl` + compound indexes on the two query
    paths. DynamoDB: CreateTable with the GSI for actor queries.
    *********************************************************************/
    initializeStore: async function (instance) {

      if (!Lib.Utils.isFunction(store.initialize)) {
        return { success: true, error: null };
      }

      return await store.initialize(instance);

    }


  };
  /*======================= / Public Functions =============================*/



  /*======================= Private Helpers ================================*/
  const _Logger = {


    /********************************************************************
    Validate the shape of the options map passed to log(). Throws on the
    first missing-required or wrong-type field so programmer errors never
    look like envelope errors at the caller.
    *********************************************************************/
    validateLogOptions: function (options) {

      if (Lib.Utils.isNullOrUndefined(options) || !Lib.Utils.isObject(options)) {
        throw new TypeError('[js-server-helper-logger] log() options must be an object');
      }

      const required_strings = [
        'entity_type',
        'entity_id',
        'actor_type',
        'actor_id',
        'action'
      ];
      for (const field of required_strings) {
        if (
          Lib.Utils.isNullOrUndefined(options[field]) ||
          !Lib.Utils.isString(options[field]) ||
          Lib.Utils.isEmptyString(options[field])
        ) {
          throw new TypeError('[js-server-helper-logger] log() options.' + field + ' is required (non-empty string)');
        }
      }

      // Retention must be either the literal 'persistent' string, or an
      // object with a positive integer ttl_seconds field. No other shape
      // is permitted - every caller decides one or the other per event.
      if (Lib.Utils.isNullOrUndefined(options.retention)) {
        throw new TypeError('[js-server-helper-logger] log() options.retention is required');
      }
      if (options.retention !== 'persistent') {
        if (
          !Lib.Utils.isObject(options.retention) ||
          !Lib.Utils.isInteger(options.retention.ttl_seconds) ||
          options.retention.ttl_seconds <= 0
        ) {
          throw new TypeError('[js-server-helper-logger] log() options.retention must be "persistent" or { ttl_seconds: positive integer }');
        }
      }

      // Optional fields - check type only when present.
      if (!Lib.Utils.isNullOrUndefined(options.scope) && !Lib.Utils.isString(options.scope)) {
        throw new TypeError('[js-server-helper-logger] log() options.scope must be a string when present');
      }
      if (!Lib.Utils.isNullOrUndefined(options.data) && !Lib.Utils.isObject(options.data)) {
        throw new TypeError('[js-server-helper-logger] log() options.data must be a plain object when present');
      }
      if (!Lib.Utils.isNullOrUndefined(options.ip) && !Lib.Utils.isString(options.ip)) {
        throw new TypeError('[js-server-helper-logger] log() options.ip must be a string when present');
      }
      if (!Lib.Utils.isNullOrUndefined(options.user_agent) && !Lib.Utils.isString(options.user_agent)) {
        throw new TypeError('[js-server-helper-logger] log() options.user_agent must be a string when present');
      }

    },


    /********************************************************************
    Validate listByEntity options. entity_type + entity_id required;
    everything else optional.
    *********************************************************************/
    validateListByEntityOptions: function (options) {
      _Logger.validateListOptionsShape(options);
      _Logger.requireNonEmptyString(options, 'entity_type');
      _Logger.requireNonEmptyString(options, 'entity_id');
    },


    /********************************************************************
    Validate listByActor options. actor_type + actor_id required.
    *********************************************************************/
    validateListByActorOptions: function (options) {
      _Logger.validateListOptionsShape(options);
      _Logger.requireNonEmptyString(options, 'actor_type');
      _Logger.requireNonEmptyString(options, 'actor_id');
    },


    /********************************************************************
    Shared pre-checks for the two list functions.
    *********************************************************************/
    validateListOptionsShape: function (options) {
      if (Lib.Utils.isNullOrUndefined(options) || !Lib.Utils.isObject(options)) {
        throw new TypeError('[js-server-helper-logger] list options must be an object');
      }
      if (!Lib.Utils.isNullOrUndefined(options.scope) && !Lib.Utils.isString(options.scope)) {
        throw new TypeError('[js-server-helper-logger] list options.scope must be a string when present');
      }
      if (!Lib.Utils.isNullOrUndefined(options.actions)) {
        if (!Array.isArray(options.actions)) {
          throw new TypeError('[js-server-helper-logger] list options.actions must be an array of strings when present');
        }
        for (const item of options.actions) {
          if (!Lib.Utils.isString(item) || Lib.Utils.isEmptyString(item)) {
            throw new TypeError('[js-server-helper-logger] list options.actions entries must be non-empty strings');
          }
        }
      }
      if (!Lib.Utils.isNullOrUndefined(options.start_time_ms) && !Lib.Utils.isInteger(options.start_time_ms)) {
        throw new TypeError('[js-server-helper-logger] list options.start_time_ms must be an integer (epoch ms) when present');
      }
      if (!Lib.Utils.isNullOrUndefined(options.end_time_ms) && !Lib.Utils.isInteger(options.end_time_ms)) {
        throw new TypeError('[js-server-helper-logger] list options.end_time_ms must be an integer (epoch ms) when present');
      }
      if (!Lib.Utils.isNullOrUndefined(options.limit) && (!Lib.Utils.isInteger(options.limit) || options.limit <= 0)) {
        throw new TypeError('[js-server-helper-logger] list options.limit must be a positive integer when present');
      }
      if (!Lib.Utils.isNullOrUndefined(options.cursor) && !Lib.Utils.isString(options.cursor)) {
        throw new TypeError('[js-server-helper-logger] list options.cursor must be a string when present');
      }
    },


    requireNonEmptyString: function (options, field) {
      if (
        Lib.Utils.isNullOrUndefined(options[field]) ||
        !Lib.Utils.isString(options[field]) ||
        Lib.Utils.isEmptyString(options[field])
      ) {
        throw new TypeError('[js-server-helper-logger] options.' + field + ' is required (non-empty string)');
      }
    },


    /********************************************************************
    Build the durable record that will be handed to the store. Pulls
    created_at from instance.time_ms, auto-captures IP / user-agent from
    the incoming HTTP request when possible, and encrypts the IP under
    CONFIG.IP_ENCRYPT_KEY when one is configured.
    *********************************************************************/
    buildRecord: function (instance, options) {

      const created_at_ms = instance.time_ms;
      const created_at = Math.floor(created_at_ms / 1000);

      // Resolve retention
      let expires_at = null;
      if (options.retention !== 'persistent') {
        expires_at = created_at + options.retention.ttl_seconds;
      }

      // Resolve IP / user-agent. Explicit options win over auto-capture.
      let ip = options.ip;
      let user_agent = options.user_agent;

      if (
        (Lib.Utils.isNullOrUndefined(ip) || Lib.Utils.isNullOrUndefined(user_agent)) &&
        !Lib.Utils.isNullOrUndefined(Lib.HttpHandler) &&
        !Lib.Utils.isNullOrUndefined(instance.http_request)
      ) {

        if (
          Lib.Utils.isNullOrUndefined(ip) &&
          Lib.Utils.isFunction(Lib.HttpHandler.getHttpRequestIPAddress)
        ) {
          ip = Lib.HttpHandler.getHttpRequestIPAddress(instance);
        }
        if (
          Lib.Utils.isNullOrUndefined(user_agent) &&
          Lib.Utils.isFunction(Lib.HttpHandler.getHttpRequestUserAgent)
        ) {
          user_agent = Lib.HttpHandler.getHttpRequestUserAgent(instance);
        }

      }

      // Encrypt IP if a key was configured. Empty/falsy IPs stay empty.
      if (
        !Lib.Utils.isNullOrUndefined(CONFIG.IP_ENCRYPT_KEY) &&
        !Lib.Utils.isNullOrUndefined(ip) &&
        !Lib.Utils.isEmptyString(ip)
      ) {
        ip = Lib.Crypto.aesEncrypt(ip, CONFIG.IP_ENCRYPT_KEY);
      }

      // Build the sort key so two events in the same millisecond stay
      // ordered by insertion. 3 lowercase-alpha chars = 17576 unique
      // values per ms - more than enough for request-scoped bursts.
      const sort_key = created_at_ms + '-' + Lib.Crypto.generateRandomString('abcdefghijklmnopqrstuvwxyz', 3);

      return {
        scope:         options.scope || '',
        entity_type:   options.entity_type,
        entity_id:     options.entity_id,
        actor_type:    options.actor_type,
        actor_id:      options.actor_id,
        action:        options.action,
        data:          options.data || null,
        ip:            Lib.Utils.isNullOrUndefined(ip) ? null : ip,
        user_agent:    Lib.Utils.isNullOrUndefined(user_agent) ? null : user_agent,
        created_at:    created_at,
        created_at_ms: created_at_ms,
        sort_key:      sort_key,
        expires_at:    expires_at
      };

    },


    /********************************************************************
    Translate public list-options into the query object the stores
    consume. Stores never see the caller's raw options directly.
    *********************************************************************/
    buildQuery: function (options) {

      return {
        scope:          options.scope || '',
        entity_type:    options.entity_type || null,
        entity_id:      options.entity_id || null,
        actor_type:     options.actor_type || null,
        actor_id:       options.actor_id || null,
        actions:        options.actions || null,
        start_time_ms:  Lib.Utils.isNullOrUndefined(options.start_time_ms) ? null : options.start_time_ms,
        end_time_ms:    Lib.Utils.isNullOrUndefined(options.end_time_ms) ? null : options.end_time_ms,
        cursor:         options.cursor || null,
        limit:          options.limit || 50
      };

    },


    /********************************************************************
    Decrypt IP for reads, if encryption is configured. Never throws on
    bad ciphertext - an unparseable IP column just returns the ciphertext
    so audit reviewers at least see the opaque blob rather than nothing.
    *********************************************************************/
    enrichRecordForRead: function (record) {

      if (
        Lib.Utils.isNullOrUndefined(CONFIG.IP_ENCRYPT_KEY) ||
        Lib.Utils.isNullOrUndefined(record.ip) ||
        record.ip === ''
      ) {
        return record;
      }

      try {
        return Object.assign({}, record, {
          ip: Lib.Crypto.aesDecrypt(record.ip, CONFIG.IP_ENCRYPT_KEY)
        });
      } catch (err) {
        Lib.Debug.debug('Logger IP decrypt failed - returning ciphertext', { error: err.message });
        return record;
      }

    }


  };
  /*======================= / Private Helpers ==============================*/


  return Logger;

};

/////////////////////////// createInterface END ////////////////////////////////
