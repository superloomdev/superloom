// Info: All validators for js-server-helper-auth. Two concerns in one place:
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

// Allowed enum values for per-call option validation
const PLATFORM_VALUES = ['web', 'ios', 'android', 'macos', 'windows', 'linux', 'other'];
const FORM_FACTOR_VALUES = ['mobile', 'tablet', 'desktop', 'tv', 'watch', 'other'];


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



////////////////////////////// Public Functions START ////////////////////////
const Validators = {


  // ~~~~~~~~~~~~~~~~~~~~ Config Validators ~~~~~~~~~~~~~~~~~~~~
  // Called once at construction time from the auth.js loader.
  // Take CONFIG as a parameter (not closed over) so they remain
  // testable in isolation. Throw Error (not TypeError) because
  // misconfiguration is a setup error, not a programmer call error.

  /********************************************************************
  Validate the merged CONFIG. Throws on every missing-required
  violation so the loader fails before serving a single request.

  @param {Object} CONFIG - Merged module configuration

  @return {void}
  *********************************************************************/
  validateConfig: function (CONFIG) {

    // STORE must be the store factory function (e.g. require('@superloomdev/js-server-helper-auth-store-sqlite'))
    if (
      Lib.Utils.isNullOrUndefined(CONFIG.STORE) ||
      typeof CONFIG.STORE !== 'function'
    ) {
      throw new Error('[js-server-helper-auth] CONFIG.STORE must be a store factory function (e.g. require("js-server-helper-auth-store-sqlite"))');
    }

    // STORE_CONFIG is required - each store validates its own required keys
    // (table_name, lib_sql, etc.) inside its factory.
    if (Lib.Utils.isNullOrUndefined(CONFIG.STORE_CONFIG)) {
      throw new Error('[js-server-helper-auth] CONFIG.STORE_CONFIG is required (object)');
    }

    if (!Lib.Utils.isObject(CONFIG.STORE_CONFIG)) {
      throw new Error('[js-server-helper-auth] CONFIG.STORE_CONFIG must be a plain object');
    }

    // ACTOR_TYPE is required and must be a non-empty string
    if (
      Lib.Utils.isNullOrUndefined(CONFIG.ACTOR_TYPE) ||
      !Lib.Utils.isString(CONFIG.ACTOR_TYPE) ||
      Lib.Utils.isEmptyString(CONFIG.ACTOR_TYPE)
    ) {
      throw new Error('[js-server-helper-auth] CONFIG.ACTOR_TYPE is required (non-empty string)');
    }

    // TTL_SECONDS must be a positive integer
    if (
      !Lib.Utils.isNumber(CONFIG.TTL_SECONDS) ||
      !Lib.Utils.isInteger(CONFIG.TTL_SECONDS) ||
      CONFIG.TTL_SECONDS <= 0
    ) {
      throw new Error('[js-server-helper-auth] CONFIG.TTL_SECONDS must be a positive integer');
    }

    // LAST_ACTIVE_UPDATE_INTERVAL_SECONDS must be a non-negative integer
    if (
      !Lib.Utils.isNumber(CONFIG.LAST_ACTIVE_UPDATE_INTERVAL_SECONDS) ||
      !Lib.Utils.isInteger(CONFIG.LAST_ACTIVE_UPDATE_INTERVAL_SECONDS) ||
      CONFIG.LAST_ACTIVE_UPDATE_INTERVAL_SECONDS < 0
    ) {
      throw new Error('[js-server-helper-auth] CONFIG.LAST_ACTIVE_UPDATE_INTERVAL_SECONDS must be a non-negative integer');
    }

    // LIMITS object required with proper shape
    if (Lib.Utils.isNullOrUndefined(CONFIG.LIMITS) || !Lib.Utils.isObject(CONFIG.LIMITS)) {
      throw new Error('[js-server-helper-auth] CONFIG.LIMITS is required (plain object)');
    }

    if (
      !Lib.Utils.isNumber(CONFIG.LIMITS.total_max) ||
      !Lib.Utils.isInteger(CONFIG.LIMITS.total_max) ||
      CONFIG.LIMITS.total_max <= 0
    ) {
      throw new Error('[js-server-helper-auth] CONFIG.LIMITS.total_max must be a positive integer');
    }

    if (!Lib.Utils.isBoolean(CONFIG.LIMITS.evict_oldest_on_limit)) {
      throw new Error('[js-server-helper-auth] CONFIG.LIMITS.evict_oldest_on_limit must be a boolean');
    }

    // JWT mode: when enabled, signing key + issuer + audience are mandatory.
    // The signing key must be at least 32 bytes long so an HS256 HMAC
    // has a full security margin.
    if (CONFIG.ENABLE_JWT === true) {

      if (Lib.Utils.isNullOrUndefined(CONFIG.JWT) || !Lib.Utils.isObject(CONFIG.JWT)) {
        throw new Error('[js-server-helper-auth] CONFIG.JWT must be a plain object when ENABLE_JWT is true');
      }

      if (
        Lib.Utils.isNullOrUndefined(CONFIG.JWT.signing_key) ||
        !Lib.Utils.isString(CONFIG.JWT.signing_key) ||
        CONFIG.JWT.signing_key.length < 32
      ) {
        throw new Error('[js-server-helper-auth] CONFIG.JWT.signing_key must be a string of at least 32 chars when ENABLE_JWT is true');
      }

      if (
        Lib.Utils.isNullOrUndefined(CONFIG.JWT.issuer) ||
        !Lib.Utils.isString(CONFIG.JWT.issuer) ||
        Lib.Utils.isEmptyString(CONFIG.JWT.issuer)
      ) {
        throw new Error('[js-server-helper-auth] CONFIG.JWT.issuer is required (non-empty string) when ENABLE_JWT is true');
      }

      if (
        Lib.Utils.isNullOrUndefined(CONFIG.JWT.audience) ||
        !Lib.Utils.isString(CONFIG.JWT.audience) ||
        Lib.Utils.isEmptyString(CONFIG.JWT.audience)
      ) {
        throw new Error('[js-server-helper-auth] CONFIG.JWT.audience is required (non-empty string) when ENABLE_JWT is true');
      }

      if (
        !Lib.Utils.isNumber(CONFIG.JWT.access_token_ttl_seconds) ||
        !Lib.Utils.isInteger(CONFIG.JWT.access_token_ttl_seconds) ||
        CONFIG.JWT.access_token_ttl_seconds <= 0
      ) {
        throw new Error('[js-server-helper-auth] CONFIG.JWT.access_token_ttl_seconds must be a positive integer when ENABLE_JWT is true');
      }

      if (
        !Lib.Utils.isNumber(CONFIG.JWT.refresh_token_ttl_seconds) ||
        !Lib.Utils.isInteger(CONFIG.JWT.refresh_token_ttl_seconds) ||
        CONFIG.JWT.refresh_token_ttl_seconds <= 0
      ) {
        throw new Error('[js-server-helper-auth] CONFIG.JWT.refresh_token_ttl_seconds must be a positive integer when ENABLE_JWT is true');
      }

    }

  },


  // ~~~~~~~~~~~~~~~~~~~~ Options Validators ~~~~~~~~~~~~~~~~~~~~
  // Called per request from public functions in auth.js.
  // Take caller-supplied options as a parameter.
  // Throw TypeError - bad arguments mean the caller's code is wrong.

  /********************************************************************
  Shape check for createSession options.

  @param {Object} options - Caller-provided options object

  @return {void}
  *********************************************************************/
  validateCreateSessionOptions: function (options) {

    // Require a valid options object before checking individual fields
    _Validators.assertOptionsObject(options, 'createSession');

    // Required identity fields
    _Validators.assertNonEmptyString(options.tenant_id, 'tenant_id', 'createSession');
    _Validators.assertNonEmptyString(options.actor_id, 'actor_id', 'createSession');

    // install_platform and install_form_factor are required and enumerated
    _Validators.assertEnum(options.install_platform, PLATFORM_VALUES, 'install_platform', 'createSession');
    _Validators.assertEnum(options.install_form_factor, FORM_FACTOR_VALUES, 'install_form_factor', 'createSession');

    // install_id is optional but if present must be non-empty string
    if (!Lib.Utils.isNullOrUndefined(options.install_id)) {
      _Validators.assertNonEmptyString(options.install_id, 'install_id', 'createSession');
    }

    // Each client_* field is independently optional — type only checked when present
    _Validators.assertOptionalString(options.client_name, 'client_name', 'createSession');
    _Validators.assertOptionalString(options.client_version, 'client_version', 'createSession');
    _Validators.assertOptionalBoolean(options.client_is_browser, 'client_is_browser', 'createSession');
    _Validators.assertOptionalString(options.client_os_name, 'client_os_name', 'createSession');
    _Validators.assertOptionalString(options.client_os_version, 'client_os_version', 'createSession');
    _Validators.assertOptionalInteger(options.client_screen_w, 'client_screen_w', 'createSession');
    _Validators.assertOptionalInteger(options.client_screen_h, 'client_screen_h', 'createSession');
    _Validators.assertOptionalString(options.client_ip_address, 'client_ip_address', 'createSession');
    _Validators.assertOptionalString(options.client_user_agent, 'client_user_agent', 'createSession');

    // custom_data is optional but must be a plain object when present
    if (!Lib.Utils.isNullOrUndefined(options.custom_data)) {

      // Reject non-object values (arrays, strings, etc.)
      if (!Lib.Utils.isObject(options.custom_data)) {
        throw new TypeError('[js-server-helper-auth] createSession options.custom_data must be a plain object');
      }

    }

  },


  /********************************************************************
  Shape check for verifySession options. Either auth_id is supplied
  explicitly, or the caller leaves both auth_id and parsed parts unset
  and the module reads from instance headers/cookies via token-source.

  @param {Object} options - Caller-provided options object

  @return {void}
  *********************************************************************/
  validateVerifySessionOptions: function (options) {

    // verifySession options is allowed to be empty — everything will
    // be read from instance via token-source. We just guard against
    // wrong types when keys are present.

    // Allow null/undefined — caller is relying on token-source
    if (Lib.Utils.isNullOrUndefined(options)) {
      return;
    }

    // Reject non-object values when options is provided
    if (!Lib.Utils.isObject(options)) {
      throw new TypeError('[js-server-helper-auth] verifySession options must be a plain object');
    }

    // auth_id explicitly supplied — must be a non-empty string
    if (!Lib.Utils.isNullOrUndefined(options.auth_id)) {
      _Validators.assertNonEmptyString(options.auth_id, 'auth_id', 'verifySession');
    }

  },


  /********************************************************************
  Shape check for removeSession options.

  @param {Object} options - Caller-provided options object

  @return {void}
  *********************************************************************/
  validateRemoveSessionOptions: function (options) {

    // Require a valid options object before checking individual fields
    _Validators.assertOptionsObject(options, 'removeSession');

    // Required identity fields
    _Validators.assertNonEmptyString(options.tenant_id, 'tenant_id', 'removeSession');
    _Validators.assertNonEmptyString(options.actor_id, 'actor_id', 'removeSession');
    _Validators.assertNonEmptyString(options.token_key, 'token_key', 'removeSession');

  },


  /********************************************************************
  Shape check for removeOtherSessions options.

  @param {Object} options - Caller-provided options object

  @return {void}
  *********************************************************************/
  validateRemoveOtherSessionsOptions: function (options) {

    // Require a valid options object before checking individual fields
    _Validators.assertOptionsObject(options, 'removeOtherSessions');

    // Required identity fields
    _Validators.assertNonEmptyString(options.tenant_id, 'tenant_id', 'removeOtherSessions');
    _Validators.assertNonEmptyString(options.actor_id, 'actor_id', 'removeOtherSessions');
    _Validators.assertNonEmptyString(options.keep_token_key, 'keep_token_key', 'removeOtherSessions');

  },


  /********************************************************************
  Shape check for removeAllSessions / listSessions / countSessions
  options (all share the same minimal shape).

  @param {Object} options - Caller-provided options object
  @param {String} fn_name - The public function name for error messages

  @return {void}
  *********************************************************************/
  validateActorScopedOptions: function (options, fn_name) {

    // Require a valid options object before checking individual fields
    _Validators.assertOptionsObject(options, fn_name);

    // Required identity fields
    _Validators.assertNonEmptyString(options.tenant_id, 'tenant_id', fn_name);
    _Validators.assertNonEmptyString(options.actor_id, 'actor_id', fn_name);

  },


  /********************************************************************
  Shape check for attachDeviceToSession options.

  @param {Object} options - Caller-provided options object

  @return {void}
  *********************************************************************/
  validateAttachDeviceOptions: function (options) {

    // Require a valid options object before checking individual fields
    _Validators.assertOptionsObject(options, 'attachDeviceToSession');

    // Required identity and push fields
    _Validators.assertNonEmptyString(options.tenant_id, 'tenant_id', 'attachDeviceToSession');
    _Validators.assertNonEmptyString(options.actor_id, 'actor_id', 'attachDeviceToSession');
    _Validators.assertNonEmptyString(options.token_key, 'token_key', 'attachDeviceToSession');
    _Validators.assertNonEmptyString(options.push_provider, 'push_provider', 'attachDeviceToSession');
    _Validators.assertNonEmptyString(options.push_token, 'push_token', 'attachDeviceToSession');

  },


  /********************************************************************
  Shape check for detachDeviceFromSession options.

  @param {Object} options - Caller-provided options object

  @return {void}
  *********************************************************************/
  validateDetachDeviceOptions: function (options) {

    // Require a valid options object before checking individual fields
    _Validators.assertOptionsObject(options, 'detachDeviceFromSession');

    // Required identity fields
    _Validators.assertNonEmptyString(options.tenant_id, 'tenant_id', 'detachDeviceFromSession');
    _Validators.assertNonEmptyString(options.actor_id, 'actor_id', 'detachDeviceFromSession');
    _Validators.assertNonEmptyString(options.token_key, 'token_key', 'detachDeviceFromSession');

  },


  /********************************************************************
  Shape check for refreshSessionJwt options.

  @param {Object} options - Caller-provided options object

  @return {void}
  *********************************************************************/
  validateRefreshSessionJwtOptions: function (options) {

    // Require a valid options object before checking individual fields
    _Validators.assertOptionsObject(options, 'refreshSessionJwt');

    // Required fields for refresh token exchange
    _Validators.assertNonEmptyString(options.tenant_id, 'tenant_id', 'refreshSessionJwt');
    _Validators.assertNonEmptyString(options.refresh_token, 'refresh_token', 'refreshSessionJwt');

  }

};////////////////////////////// Public Functions END ////////////////////////



///////////////////////////// Private Functions START ////////////////////////
const _Validators = {


  /********************************************************************
  Throw TypeError if options is missing or not a plain object.

  @param {*}      options - The options argument
  @param {String} fn_name - Public function name for error message

  @return {void}
  *********************************************************************/
  assertOptionsObject: function (options, fn_name) {

    // Throw if options was not passed at all
    if (Lib.Utils.isNullOrUndefined(options)) {
      throw new TypeError('[js-server-helper-auth] ' + fn_name + ' options object is required');
    }

    // Throw if options is not a plain object
    if (!Lib.Utils.isObject(options)) {
      throw new TypeError('[js-server-helper-auth] ' + fn_name + ' options must be a plain object');
    }

  },


  /********************************************************************
  Throw TypeError if value is not a non-empty string.

  @param {*}      value   - Value to check
  @param {String} field   - Field name
  @param {String} fn_name - Public function name

  @return {void}
  *********************************************************************/
  assertNonEmptyString: function (value, field, fn_name) {

    // Throw if the value is absent, non-string, or empty
    if (
      Lib.Utils.isNullOrUndefined(value) ||
      !Lib.Utils.isString(value) ||
      Lib.Utils.isEmptyString(value)
    ) {
      throw new TypeError('[js-server-helper-auth] ' + fn_name + ' options.' + field + ' must be a non-empty string');
    }

  },


  /********************************************************************
  Throw TypeError if value is present and not a string.
  null/undefined is allowed (field is optional).

  @param {*}      value   - Value to check
  @param {String} field   - Field name
  @param {String} fn_name - Public function name

  @return {void}
  *********************************************************************/
  assertOptionalString: function (value, field, fn_name) {

    // Allow null/undefined — field is optional
    if (Lib.Utils.isNullOrUndefined(value)) {
      return;
    }

    // Throw if a non-null value is not a string
    if (!Lib.Utils.isString(value)) {
      throw new TypeError('[js-server-helper-auth] ' + fn_name + ' options.' + field + ' must be a string when provided');
    }

  },


  /********************************************************************
  Throw TypeError if value is present and not a boolean.
  null/undefined is allowed (field is optional).

  @param {*}      value   - Value to check
  @param {String} field   - Field name
  @param {String} fn_name - Public function name

  @return {void}
  *********************************************************************/
  assertOptionalBoolean: function (value, field, fn_name) {

    // Allow null/undefined — field is optional
    if (Lib.Utils.isNullOrUndefined(value)) {
      return;
    }

    // Throw if a non-null value is not a boolean
    if (!Lib.Utils.isBoolean(value)) {
      throw new TypeError('[js-server-helper-auth] ' + fn_name + ' options.' + field + ' must be a boolean when provided');
    }

  },


  /********************************************************************
  Throw TypeError if value is present and not an integer.
  null/undefined is allowed (field is optional).

  @param {*}      value   - Value to check
  @param {String} field   - Field name
  @param {String} fn_name - Public function name

  @return {void}
  *********************************************************************/
  assertOptionalInteger: function (value, field, fn_name) {

    // Allow null/undefined — field is optional
    if (Lib.Utils.isNullOrUndefined(value)) {
      return;
    }

    // Throw if a non-null value is not an integer
    if (!Lib.Utils.isNumber(value) || !Lib.Utils.isInteger(value)) {
      throw new TypeError('[js-server-helper-auth] ' + fn_name + ' options.' + field + ' must be an integer when provided');
    }

  },


  /********************************************************************
  Throw TypeError if value is not one of the allowed enum values.

  @param {*}        value   - Value to check
  @param {String[]} allowed - Allowed values
  @param {String}   field   - Field name
  @param {String}   fn_name - Public function name

  @return {void}
  *********************************************************************/
  assertEnum: function (value, allowed, field, fn_name) {

    // Throw if the value is absent, non-string, or not in the allowed list
    if (
      Lib.Utils.isNullOrUndefined(value) ||
      !Lib.Utils.isString(value) ||
      allowed.indexOf(value) === -1
    ) {
      throw new TypeError(
        '[js-server-helper-auth] ' + fn_name + ' options.' + field +
        ' must be one of: ' + allowed.join(', ')
      );
    }

  }


};///////////////////////////// Private Functions END ////////////////////////
