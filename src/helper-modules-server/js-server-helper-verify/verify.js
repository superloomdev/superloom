// Info: One-time verification code lifecycle: generate, store, validate, consume.
// Three create interfaces (pin, code, token) share one core flow; one verify
// interface consumes any of them. Three independent defenses against abuse:
// cooldown on creation, expiry (TTL), and per-record fail counter. On a
// successful verify, the record is deleted in the background so the same
// value cannot be reused.
//
// Storage backends: memory (tests), sqlite, postgres, mysql, mongodb, dynamodb.
// One backend per loader call - selected via `CONFIG.STORE` (string name) +
// `CONFIG.STORE_CONFIG` (per-store options). Other backends never load.
//
// Compatibility: Node.js 20.19+.
//
// Factory pattern: each loader call returns an independent Verify interface
// with its own Lib and CONFIG.
'use strict';



/////////////////////////// Module-Loader START ////////////////////////////////

/********************************************************************
Factory loader. One call = one independent instance with its own
Lib, CONFIG, and store. Validates CONFIG at construction so
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

  // Validate the config shape
  validateConfig(Lib, CONFIG);

  // Resolve the requested store via the lazy registry. Only the chosen
  // store file is loaded; other backends stay on disk.
  const loadStoreFactory = require('./stores');
  const StoreFactory = loadStoreFactory(CONFIG.STORE);
  const store = StoreFactory(Lib, CONFIG.STORE_CONFIG || {});

  // Create and return the public interface
  return createInterface(Lib, CONFIG, store);

};///////////////////////////// Module-Loader END ///////////////////////////////



//////////////////////////// Config Validation START ///////////////////////////

/********************************************************************
Validate the merged CONFIG. Throws on every missing-required violation
so the loader fails before serving a single request.

@param {Object} Lib - Dependency container
@param {Object} CONFIG - Merged configuration

@return {void}
*********************************************************************/
const validateConfig = function (Lib, CONFIG) {

  // STORE name is required and must be a non-empty string
  if (
    Lib.Utils.isNullOrUndefined(CONFIG.STORE) ||
    !Lib.Utils.isString(CONFIG.STORE) ||
    Lib.Utils.isEmptyString(CONFIG.STORE)
  ) {
    throw new Error('[js-server-helper-verify] CONFIG.STORE is required (one of the supported store names)');
  }

  // STORE_CONFIG is required (may be empty object for the memory store)
  if (Lib.Utils.isNullOrUndefined(CONFIG.STORE_CONFIG)) {
    throw new Error('[js-server-helper-verify] CONFIG.STORE_CONFIG is required (object)');
  }

  if (!Lib.Utils.isObject(CONFIG.STORE_CONFIG)) {
    throw new Error('[js-server-helper-verify] CONFIG.STORE_CONFIG must be a plain object');
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

};

//////////////////////////// Config Validation END /////////////////////////////



/////////////////////////// createInterface START //////////////////////////////

/********************************************************************
Builds the public interface for one instance. Public and private
functions close over the provided Lib, CONFIG, and store.

@param {Object} Lib - Dependency container (Utils, Debug, Crypto, Instance)
@param {Object} CONFIG - Merged configuration for this instance
@param {Object} store - Resolved storage backend interface

@return {Object} - Public interface for this module
*********************************************************************/
const createInterface = function (Lib, CONFIG, store) {

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
    but still expose this method for explicit lifecycle control.

    Intended to be called from a scheduled job (cron, setInterval,
    CloudWatch Events -> Lambda), not on every request.

    @param {Object} instance - Request instance for time reference

    @return {Promise<Object>} - { success, deleted_count, error }
    *********************************************************************/
    cleanupExpiredRecords: async function (instance) {

      return _Verify.cleanupExpired(instance);

    },


    /********************************************************************
    Idempotent backend setup. Memory store: no-op. SQL: CREATE TABLE
    IF NOT EXISTS + index on expires_at. MongoDB: createIndex with
    `expireAfterSeconds: 0` for native TTL. DynamoDB: CreateTable
    with composite key (TTL on `expires_at` is opt-in at the table
    level - enable via AWS console or IaC, not by this module).

    @param {Object} instance - Request instance

    @return {Promise<Object>} - { success, error }
    *********************************************************************/
    initializeStore: async function (instance) {

      if (!Lib.Utils.isFunction(store.initialize)) {
        return { success: true, error: null };
      }

      return await store.initialize(instance);

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
      const existing = await store.getRecord(instance, options.scope, options.key);
      if (existing.success === false) {
        Lib.Debug.debug('Verify cooldown lookup failed', { scope: options.scope, key: options.key, error: existing.error });
        return {
          success: false,
          code: null,
          expires_at: null,
          error: CONFIG.ERRORS.STORE_READ_FAILED
        };
      }

      // Block creation if a previous code is still inside its cooldown window.
      // cooldown_seconds: 0 means "no cooldown" - skip the check entirely. We
      // cannot fall through to the inequality below because under concurrent
      // creates with non-monotonic instance.time the existing record may have
      // a created_at greater than the current instance.time; that makes
      // `time - created_at` negative, and `negative < 0` would wrongly trigger
      // COOLDOWN_ACTIVE for a caller that explicitly opted out of cooldown.
      if (
        options.cooldown_seconds > 0 &&
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
      const write_result = await store.setRecord(instance, options.scope, options.key, record);
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
      const lookup = await store.getRecord(instance, options.scope, options.key);
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
        const inc_result = await store.incrementFailCount(instance, options.scope, options.key);
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

      if (!Lib.Utils.isFunction(store.cleanupExpiredRecords)) {
        return {
          success: false,
          deleted_count: 0,
          error: { type: 'CLEANUP_NOT_SUPPORTED', message: 'Storage adapter does not implement cleanupExpiredRecords' }
        };
      }

      try {
        return await store.cleanupExpiredRecords(instance);
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
      store.deleteRecord(instance, scope, key)
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
