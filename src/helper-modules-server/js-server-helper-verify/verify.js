// Info: One-time verification code lifecycle: generate, store, validate, consume.
// Three create interfaces (pin, code, token) share one core flow; one verify
// interface consumes any of them. Three independent defenses against abuse:
// cooldown on creation, expiry (TTL), and per-record fail counter. On a
// successful verify, the record is deleted in the background so the same
// value cannot be reused.
//
// Storage backends are provided by standalone adapter packages. The caller
// passes the chosen store factory directly as CONFIG.STORE - no string
// dispatch inside this module. Require only the adapter you need:
//   js-server-helper-verify-store-sqlite
//   js-server-helper-verify-store-postgres
//   js-server-helper-verify-store-mysql
//   js-server-helper-verify-store-mongodb
//   js-server-helper-verify-store-dynamodb
//
// Compatibility: Node.js 20.19+
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

  // Load internal error catalog
  const ERRORS = require('./verify.errors');

  // Load the validators singleton and inject Lib
  const Validators = require('./verify.validators')(Lib);

  // Validate CONFIG - throws on misconfiguration
  Validators.validateConfig(CONFIG);

  // Instantiate the store. CONFIG.STORE is the factory function passed in
  // by the caller; it receives (Lib, CONFIG, ERRORS) and extracts its own
  // slice from CONFIG.STORE_CONFIG internally.
  const store = CONFIG.STORE(Lib, CONFIG, ERRORS);

  // Build the public interface, closing over Lib, CONFIG, ERRORS, Validators, and store
  return createInterface(Lib, CONFIG, ERRORS, Validators, store);

};///////////////////////////// Module-Loader END ///////////////////////////////



/////////////////////////// createInterface START //////////////////////////////

/********************************************************************
Builds the public interface for one instance. Public and private
functions close over the provided Lib, CONFIG, ERRORS, Validators,
and store.

@param {Object} Lib        - Dependency container (Utils, Debug, Crypto, Instance)
@param {Object} CONFIG     - Merged configuration for this instance
@param {Object} ERRORS     - Frozen error catalog for this module
@param {Object} Validators - Validator singleton (validateConfig, validateCreateOptions, validateVerifyOptions)
@param {Object} store      - Resolved storage backend interface

@return {Object} - Public interface for this module
*********************************************************************/
const createInterface = function (Lib, CONFIG, ERRORS, Validators, store) {

  ////////////////////////////// Public Functions START ////////////////////////
  const Verify = {


    // ~~~~~~~~~~~~~~~~~~~~ Code Generation ~~~~~~~~~~~~~~~~~~~~
    // Create a one-time code and persist it for later verification.

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

      // Delegate to shared generate-and-store flow with numeric charset
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

      // Delegate to shared generate-and-store flow with alphanumeric charset
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

      // Delegate to shared generate-and-store flow with URL-safe token charset
      return _Verify.generateAndStore(instance, options, CONFIG.TOKEN_CHARSET);

    },


    // ~~~~~~~~~~~~~~~~~~~~ Code Verification ~~~~~~~~~~~~~~~~~~~~
    // Consume a previously created code; one-time use.

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

    @return {Promise<Object>} - { success, error }. On failure, error.type
    is one of: NOT_FOUND, EXPIRED, MAX_FAILS, WRONG_VALUE, SERVICE_UNAVAILABLE.
    *********************************************************************/
    verify: async function (instance, options) {

      // Delegate to shared consume flow
      return _Verify.consume(instance, options);

    },


    // ~~~~~~~~~~~~~~~~~~~~ Store Lifecycle ~~~~~~~~~~~~~~~~~~~~
    // Scheduled cleanup and idempotent schema initialization.

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

      // Delegate to shared cleanup flow
      return _Verify.cleanupExpired(instance);

    },


    /********************************************************************
    Idempotent backend setup. SQL: CREATE TABLE IF NOT EXISTS + index
    on expires_at. MongoDB: createIndex with `expireAfterSeconds: 0`
    for native TTL. DynamoDB: CreateTable with composite key (TTL on
    `expires_at` is opt-in at the table level - enable via AWS console
    or IaC, not by this module). Stores that need no setup are no-ops.

    @param {Object} instance - Request instance

    @return {Promise<Object>} - { success, error }
    *********************************************************************/
    setupNewStore: async function (instance) {

      // Skip if the store needs no setup (no setupNewStore method)
      if (!Lib.Utils.isFunction(store.setupNewStore)) {
        return {
          success: true,
          error: null
        };
      }

      // Run store initialization and return the result
      return await store.setupNewStore(instance);

    }

  };////////////////////////////// Public Functions END ////////////////////////



  ///////////////////////////// Private Functions START ////////////////////////
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
      Validators.validateCreateOptions(options);

      // Look up any existing record so we can apply the cooldown rule
      const existing = await store.getRecord(instance, options.scope, options.key);
      if (existing.success === false) {
        Lib.Debug.debug('Verify cooldown lookup failed', { scope: options.scope, key: options.key, error: existing.error });
        return {
          success: false,
          code: null,
          expires_at: null,
          error: ERRORS.SERVICE_UNAVAILABLE
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
          error: ERRORS.COOLDOWN_ACTIVE
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
          error: ERRORS.SERVICE_UNAVAILABLE
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
      Validators.validateVerifyOptions(options);

      // Pull the stored record for this scope+key
      const lookup = await store.getRecord(instance, options.scope, options.key);
      if (lookup.success === false) {
        Lib.Debug.debug('Verify consume lookup failed', { scope: options.scope, key: options.key, error: lookup.error });
        return {
          success: false,
          error: ERRORS.SERVICE_UNAVAILABLE
        };
      }

      // No record means the caller never created a code for this scope+key
      if (Lib.Utils.isNullOrUndefined(lookup.record)) {
        return {
          success: false,
          error: ERRORS.NOT_FOUND
        };
      }

      // Refuse to validate a record past its expiry window
      if (instance['time'] > lookup.record.expires_at) {
        return {
          success: false,
          error: ERRORS.EXPIRED
        };
      }

      // Refuse to validate after the per-record fail counter is exhausted
      if (lookup.record.fail_count >= options.max_fail_count) {
        return {
          success: false,
          error: ERRORS.MAX_FAILS
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
          error: ERRORS.WRONG_VALUE
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
    the store's cleanupExpiredRecords method. Every shipped store
    implements this; a missing implementation is a programmer error and
    throws rather than returning an envelope.

    @param {Object} instance - Request instance for time reference

    @return {Promise<Object>} - { success, deleted_count, error }
    *********************************************************************/
    cleanupExpired: async function (instance) {

      // Every shipped store implements cleanupExpiredRecords. A missing
      // implementation means a broken store was passed in - surface it
      // as a programmer error (throw) so it fails in dev/CI, not silently
      // at runtime.
      if (!Lib.Utils.isFunction(store.cleanupExpiredRecords)) {
        throw new Error(
          '[js-server-helper-verify] store does not implement cleanupExpiredRecords'
        );
      }

      try {
        return await store.cleanupExpiredRecords(instance);
      } catch (err) {
        Lib.Debug.debug('Verify cleanupExpiredRecords threw', {
          type: ERRORS.SERVICE_UNAVAILABLE.type,
          driver_message: err && err.message,
          driver_code: err && err.code,
          driver_stack: err && err.stack
        });
        return {
          success: false,
          deleted_count: 0,
          error: ERRORS.SERVICE_UNAVAILABLE
        };
      }

    },


    /********************************************************************
    Schedule a fire-and-forget delete of the consumed record. Runs in
    parallel with the request response so the caller is not blocked
    waiting on the cleanup write. Lib and store are closed over from
    createInterface.

    @param {Object} instance - Request instance
    @param {String} scope    - Logical owner namespace
    @param {String} key      - Specific verification purpose

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

    }

  };///////////////////////////// Private Functions END ////////////////////////

  // Return public interface
  return Verify;

};///////////////////////////// createInterface END ////////////////////////////
