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

  // Internal error catalog (frozen)
  const ERRORS = require('./logger.errors');

  // Load validators singleton
  const Validators = require('./logger.validators')(Lib);

  // Validate the config shape so misconfiguration fails at boot
  Validators.validateConfig(CONFIG);

  // Instantiate the store with canonical signature (matching verify/auth pattern)
  const store = CONFIG.STORE(Lib, CONFIG, ERRORS);

  return createInterface(Lib, CONFIG, ERRORS, Validators, store);

};///////////////////////////// Module-Loader END ///////////////////////////////



/////////////////////////// createInterface START //////////////////////////////

/********************************************************************
Builds the public interface for one instance.

@param {Object} Lib - Dependency container
@param {Object} CONFIG - Merged configuration for this instance
@param {Object} ERRORS - Frozen error catalog
@param {Object} Validators - Validation singleton
@param {Object} store - Resolved storage backend interface

@return {Object} - Public interface for this module.
*********************************************************************/
const createInterface = function (Lib, CONFIG, ERRORS, Validators, store) {

  ////////////////////////////// Public Functions START //////////////////////////
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
      Validators.validateLogOptions(options);

      // Build the persistent record, enriching with auto-captured context
      // and applying IP encryption before the value leaves memory.
      const record = _Logger.buildRecord(instance, options);

      // Fire-and-forget is the default. Compliance callers opt in to await.
      if (options.await === true) {

        const write_result = await store.addLog(instance, record);
        if (write_result.success === false) {
          Lib.Debug.debug('Logger addLog failed', {
            scope: record.scope,
            entity_type: record.entity_type,
            entity_id: record.entity_id,
            action: record.action,
            error: write_result.error
          });
          return { success: false, error: ERRORS.SERVICE_UNAVAILABLE };
        }

        return { success: true, error: null };

      }

      // Detach the write from the request lifecycle. Errors are logged but
      // never surface to the caller - the point of background mode is to
      // not block response time on an audit row.
      const completeBackgroundRoutine = Lib.Instance.backgroundRoutine(instance);
      store.addLog(instance, record)
        .then(function (write_result) {
          if (write_result.success === false) {
            Lib.Debug.debug('Logger addLog failed (background)', {
              scope: record.scope,
              entity_type: record.entity_type,
              entity_id: record.entity_id,
              action: record.action,
              error: write_result.error
            });
          }
        })
        .catch(function (err) {
          Lib.Debug.debug('Logger addLog threw (background)', { error: err && err.message });
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

      Validators.validateListByEntityOptions(options);

      const result = await store.getLogsByEntity(instance, _Logger.buildQuery(options));
      if (result.success === false) {
        return {
          success: false,
          records: [],
          next_cursor: null,
          error: ERRORS.SERVICE_UNAVAILABLE
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

      Validators.validateListByActorOptions(options);

      const result = await store.getLogsByActor(instance, _Logger.buildQuery(options));
      if (result.success === false) {
        return {
          success: false,
          records: [],
          next_cursor: null,
          error: ERRORS.SERVICE_UNAVAILABLE
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
    cleanupExpiredLogs: async function (instance) {

      if (!Lib.Utils.isFunction(store.cleanupExpiredLogs)) {
        return { success: true, deleted_count: 0, error: null };
      }

      const result = await store.cleanupExpiredLogs(instance);
      if (result.success === false) {
        return {
          success: false,
          deleted_count: 0,
          error: ERRORS.SERVICE_UNAVAILABLE
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
    setupNewStore: async function (instance) {

      if (!Lib.Utils.isFunction(store.setupNewStore)) {
        return { success: true, error: null };
      }

      return await store.setupNewStore(instance);

    }


  };////////////////////////////// Public Functions END ////////////////////////



  ///////////////////////////// Private Helpers START //////////////////////////
  const _Logger = {


    /********************************************************************
    Build the durable record that will be handed to the store. Pulls
    created_at from instance.time_ms, auto-captures IP / user-agent from
    the incoming HTTP request when possible, and encrypts the IP under
    CONFIG.IP_ENCRYPT_KEY when one is configured.
    *********************************************************************/
    buildRecord: function (instance, options) {

      const created_at_ms = instance.time_ms;
      const created_at = Math.floor(created_at_ms / 1000);

      // Resolve retention - missing defaults to 'persistent'
      let expires_at = null;
      const retention = Lib.Utils.isNullOrUndefined(options.retention) ? 'persistent' : options.retention;
      if (retention !== 'persistent') {
        expires_at = created_at + retention.ttl_seconds;
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


  };////////////////////////////// Private Helpers END /////////////////////////


  return Logger;

};/////////////////////////// createInterface END ////////////////////////////////
