// Info: One-time verification code lifecycle: generate, store, validate, consume.
// Storage-agnostic adapter pattern. Three create interfaces (pin, code, token)
// share one core flow; one verify interface consumes any of them. Three
// independent defenses against abuse: cooldown on creation, expiry (TTL),
// and per-record fail counter. On a successful verify, the record is deleted
// in the background so the same value cannot be reused.
//
// Compatibility: Node.js 20.19+.
//
// Factory pattern: each loader call returns an independent Verify interface
// with its own Lib and CONFIG. Stateless - the storage adapter is held in
// CONFIG and supplied by the project's loader.
'use strict';



/////////////////////////// Module-Loader START ////////////////////////////////

/********************************************************************
Factory loader. One call = one independent instance with its own
Lib and CONFIG. Validates the storage adapter at construction so
misconfiguration fails fast at startup, not on first request.

@param {Object} shared_libs - Lib container with Utils, Debug, Crypto, Instance
@param {Object} config - Overrides merged over module config defaults

@return {Object} - Public interface for this module
*********************************************************************/
module.exports = function loader (shared_libs, config) {

  // Dependencies for this instance
  const Lib = {
    Utils: shared_libs.Utils,
    Debug: shared_libs.Debug,
    Crypto: shared_libs.Crypto,
    Instance: shared_libs.Instance
  };

  // Merge overrides over defaults
  const CONFIG = Object.assign(
    {},
    require('./verify.config'),
    config || {}
  );

  // Fast-fail if the storage adapter is missing
  if (Lib.Utils.isNullOrUndefined(CONFIG.STORE)) {
    throw new Error('[js-server-helper-verify] CONFIG.STORE is required (object with getRecord, setRecord, incrementFailCount, deleteRecord)');
  }

  // Each adapter method must be a function
  const required_methods = ['getRecord', 'setRecord', 'incrementFailCount', 'deleteRecord'];
  for (const method of required_methods) {
    if (!Lib.Utils.isFunction(CONFIG.STORE[method])) {
      throw new Error('[js-server-helper-verify] CONFIG.STORE.' + method + ' must be an async function');
    }
  }

  // Optional adapter method - only validated if present
  if (
    !Lib.Utils.isNullOrUndefined(CONFIG.STORE.cleanupExpiredRecords) &&
    !Lib.Utils.isFunction(CONFIG.STORE.cleanupExpiredRecords)
  ) {
    throw new Error('[js-server-helper-verify] CONFIG.STORE.cleanupExpiredRecords must be an async function when provided');
  }

  // Fast-fail if the application has not supplied a domain-error catalog.
  // Every failure path returns one of these objects directly to the caller, so
  // the caller can pass-through with `if (!result.success) return result;`
  // instead of mapping helper error.type values to domain errors per call site.
  if (Lib.Utils.isNullOrUndefined(CONFIG.ERRORS)) {
    throw new Error('[js-server-helper-verify] CONFIG.ERRORS is required (map of failure key to your domain error object)');
  }

  // The keys correspond to the seven failure paths inside this module. Each
  // value is whatever shape your application uses for client-facing errors -
  // typically `{ code, message, status }` from your `[entity].errors.js`.
  const required_error_keys = [
    'COOLDOWN_ACTIVE',
    'NOT_FOUND',
    'EXPIRED',
    'MAX_FAILS',
    'WRONG_VALUE',
    'STORE_READ_FAILED',
    'STORE_WRITE_FAILED'
  ];
  for (const error_key of required_error_keys) {
    if (Lib.Utils.isNullOrUndefined(CONFIG.ERRORS[error_key])) {
      throw new Error('[js-server-helper-verify] CONFIG.ERRORS.' + error_key + ' is required');
    }
  }

  // Create and return the public interface
  return createInterface(Lib, CONFIG);

};///////////////////////////// Module-Loader END ///////////////////////////////



/////////////////////////// createInterface START //////////////////////////////

/********************************************************************
Builds the public interface for one instance. Public and private
functions close over the provided Lib and CONFIG.

@param {Object} Lib - Dependency container (Utils, Debug, Crypto, Instance)
@param {Object} CONFIG - Merged configuration for this instance

@return {Object} - Public interface for this module
*********************************************************************/
const createInterface = function (Lib, CONFIG) {

  ///////////////////////////Public Functions START//////////////////////////////
  const Verify = {

    /********************************************************************
    Generate, store, and return a numeric PIN (charset: 0-9).
    Common use case: short numeric OTP delivered via SMS.

    @param {Object} instance - Request instance for time and lifecycle
    @param {Object} options - Per-call parameters
    @param {String} options.scope - Logical owner namespace
    @param {String} options.key - Specific verification purpose
    @param {Integer} options.length - Number of characters in the PIN
    @param {Integer} options.ttl_seconds - Lifetime before expiry
    @param {Integer} options.cooldown_seconds - Min gap before next pin for same scope+key

    @return {Promise<Object>} - { success, code, expires_at, error }
    *********************************************************************/
    createPin: async function (instance, options) {

      return _Verify.generateAndStore(instance, options, CONFIG.PIN_CHARSET);

    },


    /********************************************************************
    Generate, store, and return an alphanumeric code (Crockford Base32).
    Common use case: 6-8 character login or 2FA code printed or read aloud.
    Uppercase, no look-alikes (I, L, O, U excluded).

    @param {Object} instance - Request instance for time and lifecycle
    @param {Object} options - Per-call parameters (see createPin)

    @return {Promise<Object>} - { success, code, expires_at, error }
    *********************************************************************/
    createCode: async function (instance, options) {

      return _Verify.generateAndStore(instance, options, CONFIG.CODE_CHARSET);

    },


    /********************************************************************
    Generate, store, and return a URL-safe token (charset: a-zA-Z0-9).
    Common use case: magic link tail dropped into a query string.
    Highest entropy per character.

    @param {Object} instance - Request instance for time and lifecycle
    @param {Object} options - Per-call parameters (see createPin)

    @return {Promise<Object>} - { success, code, expires_at, error }
    *********************************************************************/
    createToken: async function (instance, options) {

      return _Verify.generateAndStore(instance, options, CONFIG.TOKEN_CHARSET);

    },


    /********************************************************************
    Validate a submitted value against the stored record for scope+key.
    On match, the record is deleted in the background (one-time use).
    On mismatch, the fail count is atomically incremented.

    @param {Object} instance - Request instance for time and lifecycle
    @param {Object} options - Per-call parameters
    @param {String} options.scope - Logical owner namespace
    @param {String} options.key - Specific verification purpose
    @param {String} options.value - Value submitted by the caller
    @param {Integer} options.max_fail_count - Reject after this many failed attempts

    @return {Promise<Object>} - { success, error } - success: true on match,
    success: false on any failure (NOT_FOUND, EXPIRED, MAX_FAILS, WRONG_VALUE,
    or storage failure). On failure, `error` is the domain error from
    CONFIG.ERRORS - the caller can pass it through to the controller without
    inspecting `error.type` or `error.code`.
    *********************************************************************/
    verify: async function (instance, options) {

      return _Verify.consume(instance, options);

    },


    /********************************************************************
    Delete expired records from the storage backend. Optional - only works
    when the adapter provides a `cleanupExpiredRecords` method. SQL-based
    backends (Postgres, MySQL, SQLite) need this because they have no
    native TTL. NoSQL backends (DynamoDB, MongoDB) handle expiry natively
    and do not need to implement this method.

    Intended to be called from a scheduled job (cron, setInterval,
    CloudWatch Events -> Lambda), not on every request.

    @param {Object} instance - Request instance for time reference

    @return {Promise<Object>} - { success, deleted_count, error }
    *********************************************************************/
    cleanupExpiredRecords: async function (instance) {

      return _Verify.cleanupExpired(instance);

    }

  };///////////////////////////Public Functions END//////////////////////////////



  //////////////////////////Private Functions START/////////////////////////////
  const _Verify = {

    /********************************************************************
    Shared create-side flow: validate options, enforce cooldown, generate
    a fresh code from the supplied charset, write the record. Used by
    createPin, createCode, and createToken.

    @param {Object} instance - Request instance for time and lifecycle
    @param {Object} options - Caller-provided options
    @param {String} charset - Charset to draw the code from

    @return {Promise<Object>} - { success, code, expires_at, error }
    *********************************************************************/
    generateAndStore: async function (instance, options, charset) {

      // Programmer errors (bad args) throw synchronously - never returned as envelope
      _Verify.validateCreateOptions(options);

      // Look up any existing record so we can apply the cooldown rule
      const existing = await CONFIG.STORE.getRecord(instance, options.scope, options.key);
      if (existing.success === false) {
        Lib.Debug.debug('Verify cooldown lookup failed', { scope: options.scope, key: options.key, error: existing.error });
        return {
          success: false,
          code: null,
          expires_at: null,
          error: CONFIG.ERRORS.STORE_READ_FAILED
        };
      }

      // Block creation if a previous code is still inside its cooldown window
      if (
        !Lib.Utils.isNullOrUndefined(existing.record) &&
        (instance['time'] - existing.record.created_at) < options.cooldown_seconds
      ) {
        return {
          success: false,
          code: null,
          expires_at: null,
          error: CONFIG.ERRORS.COOLDOWN_ACTIVE
        };
      }

      // Build a fresh record using the requested charset and length
      const new_code = Lib.Crypto.generateRandomString(charset, options.length);
      const created_at = instance['time'];
      const expires_at = created_at + options.ttl_seconds;
      const record = {
        code: new_code,
        fail_count: 0,
        created_at: created_at,
        expires_at: expires_at
      };

      // Write the record (overwrites any prior record now outside cooldown)
      const write_result = await CONFIG.STORE.setRecord(instance, options.scope, options.key, record);
      if (write_result.success === false) {
        Lib.Debug.debug('Verify store write failed', { scope: options.scope, key: options.key, error: write_result.error });
        return {
          success: false,
          code: null,
          expires_at: null,
          error: CONFIG.ERRORS.STORE_WRITE_FAILED
        };
      }

      // Return the freshly generated code to the caller
      return {
        success: true,
        code: new_code,
        expires_at: expires_at,
        error: null
      };

    },


    /********************************************************************
    Verify-side flow: load the record, run lifecycle checks, compare the
    submitted value, and either delete (on success) or increment the
    fail counter (on mismatch). On success, deletion runs in the
    background via Lib.Instance.backgroundRoutine so the caller is not
    blocked waiting for cleanup.

    @param {Object} instance - Request instance for time and lifecycle
    @param {Object} options - Caller-provided options

    @return {Promise<Object>} - { success, error } - same shape as createPin
    *********************************************************************/
    consume: async function (instance, options) {

      // Programmer errors (bad args) throw synchronously - never returned as envelope
      _Verify.validateVerifyOptions(options);

      // Pull the stored record for this scope+key
      const lookup = await CONFIG.STORE.getRecord(instance, options.scope, options.key);
      if (lookup.success === false) {
        Lib.Debug.debug('Verify consume lookup failed', { scope: options.scope, key: options.key, error: lookup.error });
        return {
          success: false,
          error: CONFIG.ERRORS.STORE_READ_FAILED
        };
      }

      // No record means the caller never created a code for this scope+key
      if (Lib.Utils.isNullOrUndefined(lookup.record)) {
        return {
          success: false,
          error: CONFIG.ERRORS.NOT_FOUND
        };
      }

      // Refuse to validate a record past its expiry window
      if (instance['time'] > lookup.record.expires_at) {
        return {
          success: false,
          error: CONFIG.ERRORS.EXPIRED
        };
      }

      // Refuse to validate after the per-record fail counter is exhausted
      if (lookup.record.fail_count >= options.max_fail_count) {
        return {
          success: false,
          error: CONFIG.ERRORS.MAX_FAILS
        };
      }

      // Wrong value: bump the fail counter (best-effort) and reject
      if (lookup.record.code !== options.value) {
        const inc_result = await CONFIG.STORE.incrementFailCount(instance, options.scope, options.key);
        if (inc_result.success === false) {
          Lib.Debug.debug('Verify increment fail count failed (ignored)', { scope: options.scope, key: options.key, error: inc_result.error });
        }
        return {
          success: false,
          error: CONFIG.ERRORS.WRONG_VALUE
        };
      }

      // Match: schedule a background delete so the same code cannot be reused
      _Verify.scheduleBackgroundDelete(instance, options.scope, options.key);

      return {
        success: true,
        error: null
      };

    },


    /********************************************************************
    Delete all records where expires_at < instance.time. Delegates to
    the optional STORE.cleanupExpiredRecords adapter method. Returns a
    clear envelope when the adapter does not support cleanup.

    @param {Object} instance - Request instance for time reference

    @return {Promise<Object>} - { success, deleted_count, error }
    *********************************************************************/
    cleanupExpired: async function (instance) {

      if (!Lib.Utils.isFunction(CONFIG.STORE.cleanupExpiredRecords)) {
        return {
          success: false,
          deleted_count: 0,
          error: { type: 'CLEANUP_NOT_SUPPORTED', message: 'Storage adapter does not implement cleanupExpiredRecords' }
        };
      }

      try {
        return await CONFIG.STORE.cleanupExpiredRecords(instance);
      } catch (err) {
        Lib.Debug.debug('Verify cleanup threw', { error: err.message });
        return {
          success: false,
          deleted_count: 0,
          error: { type: 'CLEANUP_FAILED', message: err.message }
        };
      }

    },


    /********************************************************************
    Fire-and-forget delete using Lib.Instance.backgroundRoutine so the
    request returns success immediately while cleanup runs in parallel
    for consumed records.
    Errors are logged at debug level and otherwise ignored.

    @param {Object} instance - Request instance for time and lifecycle
    @param {String} scope - Logical owner namespace
    @param {String} key - Specific verification purpose

    @return {void}
    *********************************************************************/
    scheduleBackgroundDelete: function (instance, scope, key) {

      // Tell the instance lifecycle that a parallel routine is starting
      const completeBackgroundRoutine = Lib.Instance.backgroundRoutine(instance);

      // Run the delete in the background; signal completion in finally
      CONFIG.STORE.deleteRecord(instance, scope, key)
        .then(function (delete_result) {
          if (delete_result.success === false) {
            Lib.Debug.debug('Verify background delete failed (ignored)', { scope: scope, key: key, error: delete_result.error });
          }
        })
        .catch(function (error) {
          Lib.Debug.debug('Verify background delete threw (ignored)', { scope: scope, key: key, error: error.message });
        })
        .finally(function () {
          completeBackgroundRoutine();
        });

    },


    /********************************************************************
    Shape check for createPin / createCode / createToken options.
    Throws TypeError on any violation - these are programmer errors.

    @param {Object} options - Caller-provided options object

    @return {void}
    *********************************************************************/
    validateCreateOptions: function (options) {

      // Options object itself must be present
      if (Lib.Utils.isNullOrUndefined(options)) {
        throw new TypeError('[js-server-helper-verify] options object is required');
      }

      // Scope and key form the composite identifier
      if (Lib.Utils.isEmpty(options.scope)) {
        throw new TypeError('[js-server-helper-verify] options.scope is required');
      }
      if (Lib.Utils.isEmpty(options.key)) {
        throw new TypeError('[js-server-helper-verify] options.key is required');
      }

      // Length must be a positive integer
      if (!Lib.Utils.isInteger(options.length) || options.length <= 0) {
        throw new TypeError('[js-server-helper-verify] options.length must be a positive integer');
      }

      // TTL must be a positive integer
      if (!Lib.Utils.isInteger(options.ttl_seconds) || options.ttl_seconds <= 0) {
        throw new TypeError('[js-server-helper-verify] options.ttl_seconds must be a positive integer');
      }

      // Cooldown can be zero (no cooldown) but must be a non-negative integer
      if (!Lib.Utils.isInteger(options.cooldown_seconds) || options.cooldown_seconds < 0) {
        throw new TypeError('[js-server-helper-verify] options.cooldown_seconds must be a non-negative integer');
      }

    },


    /********************************************************************
    Shape check for verify() options.
    Throws TypeError on any violation - these are programmer errors.

    @param {Object} options - Caller-provided options object

    @return {void}
    *********************************************************************/
    validateVerifyOptions: function (options) {

      // Options object itself must be present
      if (Lib.Utils.isNullOrUndefined(options)) {
        throw new TypeError('[js-server-helper-verify] options object is required');
      }

      // Scope and key locate the record
      if (Lib.Utils.isEmpty(options.scope)) {
        throw new TypeError('[js-server-helper-verify] options.scope is required');
      }
      if (Lib.Utils.isEmpty(options.key)) {
        throw new TypeError('[js-server-helper-verify] options.key is required');
      }

      // Submitted value must be a non-empty string
      if (!Lib.Utils.isString(options.value) || Lib.Utils.isEmpty(options.value)) {
        throw new TypeError('[js-server-helper-verify] options.value is required (non-empty string)');
      }

      // Max fail count must be a positive integer
      if (!Lib.Utils.isInteger(options.max_fail_count) || options.max_fail_count <= 0) {
        throw new TypeError('[js-server-helper-verify] options.max_fail_count must be a positive integer');
      }

    }

  };//////////////////////////Private Functions END/////////////////////////////



  // Return public interface
  return Verify;

};/////////////////////////// createInterface END ///////////////////////////////
