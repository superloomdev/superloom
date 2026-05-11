// Info: Config and options validators for js-server-helper-verify.
// Called once (validateConfig) at construction time from the loader, and
// per-call (validateCreateOptions, validateVerifyOptions) from _Verify private
// methods. Throws on the first violation so misconfiguration and programmer
// errors surface immediately.
//
// Singleton: Lib is injected once by the loader. Node.js require
// cache guarantees the same reference on every subsequent require.
'use strict';


// Shared dependency injected by loader
let Lib;


/////////////////////////// Module-Loader START ////////////////////////////////

/********************************************************************
Singleton loader. Injects Lib and returns the module-scope
Validators object.

@param {Object} shared_libs - Dependency container (Utils)

@return {Object} - Public Validators interface
*********************************************************************/
module.exports = function loader (shared_libs) {

  // Inject shared dependency
  Lib = shared_libs;

  return Validators;

};///////////////////////////// Module-Loader END ///////////////////////////////



////////////////////////////// Public Functions START ////////////////////////
const Validators = {


  /********************************************************************
  Validate the merged CONFIG object passed to the verify loader.
  Throws on the first violation so misconfiguration surfaces
  immediately at boot time.

  @param {Object} config - Merged configuration object

  @return {void}
  *********************************************************************/
  validateConfig: function (config) {

    // STORE must be the store factory function
    if (
      Lib.Utils.isNullOrUndefined(config.STORE) ||
      !Lib.Utils.isFunction(config.STORE)
    ) {
      throw new Error('[js-server-helper-verify] CONFIG.STORE is required and must be a store factory function');
    }

    // STORE_CONFIG is required - each store validates its own required keys
    if (Lib.Utils.isNullOrUndefined(config.STORE_CONFIG)) {
      throw new Error('[js-server-helper-verify] CONFIG.STORE_CONFIG is required (object)');
    }

    // STORE_CONFIG must be a plain object
    if (!Lib.Utils.isObject(config.STORE_CONFIG)) {
      throw new Error('[js-server-helper-verify] CONFIG.STORE_CONFIG must be a plain object');
    }

  },


  /********************************************************************
  Shape check for createPin / createCode / createToken options.
  Throws TypeError on any violation - these are programmer errors.

  @param {Object} options - Caller-provided options object

  @return {void}
  *********************************************************************/
  validateCreateOptions: function (options) {

    // Programmer error: options object itself must be present
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

    // Programmer error: options object itself must be present
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

};////////////////////////////// Public Functions END ////////////////////////
