// Info: All validators for js-server-helper-logger. Two concerns in one place:
//   1. Config validators  - called once at construction time, take CONFIG as a
//      parameter, throw Error on misconfiguration.
//   2. Options validators - called per request, take caller options as a
//      parameter, throw TypeError on programmer errors.
//
// Singleton: Lib is injected once by the loader. Public and private objects
// are declared at module scope - Node.js require cache guarantees the same
// reference is returned on every subsequent require. No factory needed.
'use strict';


// Shared dependency injected by loader
let Lib;


/////////////////////////// Module-Loader START ////////////////////////////////

/********************************************************************
Singleton loader. Injects Lib and returns the module-scope Validators
object. Takes only Lib - no CONFIG or ERRORS - because validators run
before CONFIG is validated and never consume the error catalog.

@param {Object} shared_libs - Dependency container (Utils)

@return {Object} - Public Validators interface
*********************************************************************/
module.exports = function loader (shared_libs) {

  // Inject shared dependency
  Lib = shared_libs;

  return Validators;

};///////////////////////////// Module-Loader END ///////////////////////////////



////////////////////////////// Public Functions START //////////////////////////
const Validators = {


  // ~~~~~~~~~~~~~~~~~~~~ Config Validators ~~~~~~~~~~~~~~~~~~~~
  // Called once at construction time from the logger.js loader.
  // Take CONFIG as a parameter (not closed over) so they remain
  // testable in isolation. Throw Error (not TypeError) because
  // misconfiguration is a setup error, not a programmer call error.

  /********************************************************************
  Validate the merged CONFIG. Throws on every missing-required violation.

  @param {Object} CONFIG - Merged module configuration

  @return {void}
  *********************************************************************/
  validateConfig: function (CONFIG) {

    // STORE must be the store factory function
    if (
      Lib.Utils.isNullOrUndefined(CONFIG.STORE) ||
      !Lib.Utils.isFunction(CONFIG.STORE)
    ) {
      throw new Error('[js-server-helper-logger] CONFIG.STORE must be a store factory function');
    }

    // STORE_CONFIG is required - each store validates its own required keys
    if (Lib.Utils.isNullOrUndefined(CONFIG.STORE_CONFIG)) {
      throw new Error('[js-server-helper-logger] CONFIG.STORE_CONFIG is required (object)');
    }

    if (!Lib.Utils.isObject(CONFIG.STORE_CONFIG)) {
      throw new Error('[js-server-helper-logger] CONFIG.STORE_CONFIG must be a plain object');
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

  },


  // ~~~~~~~~~~~~~~~~~~~~ Options Validators ~~~~~~~~~~~~~~~~~~~~
  // Called per-request from the public interface. Throw TypeError
  // on any violation - these are programmer errors, not operational.

  /********************************************************************
  Validate log() options. Throws on first missing-required or wrong-type
  field so programmer errors never look like envelope errors at caller.

  @param {Object} options - Caller-provided options object

  @return {void}
  *********************************************************************/
  validateLogOptions: function (options) {

    if (Lib.Utils.isNullOrUndefined(options) || !Lib.Utils.isObject(options)) {
      throw new TypeError('[js-server-helper-logger] log() options must be an object');
    }

    Validators.requireNonEmptyString(options, 'entity_type');
    Validators.requireNonEmptyString(options, 'entity_id');
    Validators.requireNonEmptyString(options, 'actor_type');
    Validators.requireNonEmptyString(options, 'actor_id');
    Validators.requireNonEmptyString(options, 'action');

    // retention: either 'persistent' (default) or { ttl_seconds: number > 0 }
    // Missing retention defaults to 'persistent' - only fail if it is present but wrong.
    if (!Lib.Utils.isNullOrUndefined(options.retention) && options.retention !== 'persistent') {
      if (
        !Lib.Utils.isObject(options.retention) ||
        Lib.Utils.isNullOrUndefined(options.retention.ttl_seconds) ||
        !Lib.Utils.isInteger(options.retention.ttl_seconds) ||
        options.retention.ttl_seconds <= 0
      ) {
        throw new TypeError('[js-server-helper-logger] options.retention must be "persistent" or { ttl_seconds: positive_integer }');
      }
    }

    // Optional fields
    if (!Lib.Utils.isNullOrUndefined(options.data) && !Lib.Utils.isObject(options.data)) {
      throw new TypeError('[js-server-helper-logger] options.data must be an object when present');
    }
    if (!Lib.Utils.isNullOrUndefined(options.ip) && !Lib.Utils.isString(options.ip)) {
      throw new TypeError('[js-server-helper-logger] options.ip must be a string when present');
    }
    if (!Lib.Utils.isNullOrUndefined(options.user_agent) && !Lib.Utils.isString(options.user_agent)) {
      throw new TypeError('[js-server-helper-logger] options.user_agent must be a string when present');
    }
    if (!Lib.Utils.isNullOrUndefined(options.await) && !Lib.Utils.isBoolean(options.await)) {
      throw new TypeError('[js-server-helper-logger] options.await must be a boolean when present');
    }

  },


  /********************************************************************
  Validate listByEntity options. entity_type + entity_id required;
  everything else optional.

  @param {Object} options - Caller-provided options object

  @return {void}
  *********************************************************************/
  validateListByEntityOptions: function (options) {

    Validators.validateListOptionsShape(options);
    Validators.requireNonEmptyString(options, 'entity_type');
    Validators.requireNonEmptyString(options, 'entity_id');

  },


  /********************************************************************
  Validate listByActor options. actor_type + actor_id required.

  @param {Object} options - Caller-provided options object

  @return {void}
  *********************************************************************/
  validateListByActorOptions: function (options) {

    Validators.validateListOptionsShape(options);
    Validators.requireNonEmptyString(options, 'actor_type');
    Validators.requireNonEmptyString(options, 'actor_id');

  },


  /********************************************************************
  Shared pre-checks for the two list functions.

  @param {Object} options - Caller-provided options object

  @return {void}
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


  /********************************************************************
  Helper: require a non-empty string field.

  @param {Object} options - Options object to validate
  @param {String} field - Field name to check

  @return {void}
  *********************************************************************/
  requireNonEmptyString: function (options, field) {

    if (
      Lib.Utils.isNullOrUndefined(options[field]) ||
      !Lib.Utils.isString(options[field]) ||
      Lib.Utils.isEmptyString(options[field])
    ) {
      throw new TypeError('[js-server-helper-logger] options.' + field + ' is required (non-empty string)');
    }

  }


};///////////////////////////// Public Functions END //////////////////////////
