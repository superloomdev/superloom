// Info: Option-shape validators for every public function. All validators
// throw TypeError on programmer errors - they are NEVER wrapped in the
// success/error envelope. The envelope is reserved for runtime / domain
// failures the caller can react to; bad arguments mean the caller's code
// is wrong.
'use strict';


// Allowed enum values
const PLATFORM_VALUES = ['web', 'ios', 'android', 'macos', 'windows', 'linux', 'other'];
const FORM_FACTOR_VALUES = ['mobile', 'tablet', 'desktop', 'tv', 'watch', 'other'];


module.exports = function (Lib) {


  ////////////////////////////// Public Methods START /////////////////////////////
  const Validators = {

    /********************************************************************
    Shape check for createSession options.

    @param {Object} options - Caller-provided options object

    @return {void}
    *********************************************************************/
    validateCreateSessionOptions: function (options) {

      Validators.assertOptionsObject(options, 'createSession');

      Validators.assertNonEmptyString(options.tenant_id, 'tenant_id', 'createSession');
      Validators.assertNonEmptyString(options.actor_id, 'actor_id', 'createSession');

      // install_platform and install_form_factor are required and enumerated
      Validators.assertEnum(options.install_platform, PLATFORM_VALUES, 'install_platform', 'createSession');
      Validators.assertEnum(options.install_form_factor, FORM_FACTOR_VALUES, 'install_form_factor', 'createSession');

      // install_id is optional but if present must be non-empty string
      if (!Lib.Utils.isNullOrUndefined(options.install_id)) {
        Validators.assertNonEmptyString(options.install_id, 'install_id', 'createSession');
      }

      // Each client_* field is independently optional. Type only checked
      // when present; nulls are passed through to the record.
      Validators.assertOptionalString(options.client_name, 'client_name', 'createSession');
      Validators.assertOptionalString(options.client_version, 'client_version', 'createSession');
      Validators.assertOptionalBoolean(options.client_is_browser, 'client_is_browser', 'createSession');
      Validators.assertOptionalString(options.client_os_name, 'client_os_name', 'createSession');
      Validators.assertOptionalString(options.client_os_version, 'client_os_version', 'createSession');
      Validators.assertOptionalInteger(options.client_screen_w, 'client_screen_w', 'createSession');
      Validators.assertOptionalInteger(options.client_screen_h, 'client_screen_h', 'createSession');
      Validators.assertOptionalString(options.client_ip_address, 'client_ip_address', 'createSession');
      Validators.assertOptionalString(options.client_user_agent, 'client_user_agent', 'createSession');

      // custom_data is optional and must be a plain object when present
      if (!Lib.Utils.isNullOrUndefined(options.custom_data)) {

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

      // verifySession options is allowed to be empty - everything will
      // be read from instance via token-source. We just guard against
      // wrong types when keys are present.

      if (Lib.Utils.isNullOrUndefined(options)) {
        return;
      }

      if (!Lib.Utils.isObject(options)) {
        throw new TypeError('[js-server-helper-auth] verifySession options must be a plain object');
      }

      // auth_id explicitly supplied? Must be a non-empty string.
      if (!Lib.Utils.isNullOrUndefined(options.auth_id)) {
        Validators.assertNonEmptyString(options.auth_id, 'auth_id', 'verifySession');
      }

    },


    /********************************************************************
    Shape check for removeSession options.

    @param {Object} options - Caller-provided options object

    @return {void}
    *********************************************************************/
    validateRemoveSessionOptions: function (options) {

      Validators.assertOptionsObject(options, 'removeSession');

      Validators.assertNonEmptyString(options.tenant_id, 'tenant_id', 'removeSession');
      Validators.assertNonEmptyString(options.actor_id, 'actor_id', 'removeSession');
      Validators.assertNonEmptyString(options.token_key, 'token_key', 'removeSession');

    },


    /********************************************************************
    Shape check for removeOtherSessions options.

    @param {Object} options - Caller-provided options object

    @return {void}
    *********************************************************************/
    validateRemoveOtherSessionsOptions: function (options) {

      Validators.assertOptionsObject(options, 'removeOtherSessions');

      Validators.assertNonEmptyString(options.tenant_id, 'tenant_id', 'removeOtherSessions');
      Validators.assertNonEmptyString(options.actor_id, 'actor_id', 'removeOtherSessions');
      Validators.assertNonEmptyString(options.keep_token_key, 'keep_token_key', 'removeOtherSessions');

    },


    /********************************************************************
    Shape check for removeAllSessions / listSessions / countSessions options
    (all share the same minimal shape).

    @param {Object} options - Caller-provided options object
    @param {String} fn_name - The public function name for error messages

    @return {void}
    *********************************************************************/
    validateActorScopedOptions: function (options, fn_name) {

      Validators.assertOptionsObject(options, fn_name);

      Validators.assertNonEmptyString(options.tenant_id, 'tenant_id', fn_name);
      Validators.assertNonEmptyString(options.actor_id, 'actor_id', fn_name);

    },


    /********************************************************************
    Shape check for attachDeviceToSession options.

    @param {Object} options - Caller-provided options object

    @return {void}
    *********************************************************************/
    validateAttachDeviceOptions: function (options) {

      Validators.assertOptionsObject(options, 'attachDeviceToSession');

      Validators.assertNonEmptyString(options.tenant_id, 'tenant_id', 'attachDeviceToSession');
      Validators.assertNonEmptyString(options.actor_id, 'actor_id', 'attachDeviceToSession');
      Validators.assertNonEmptyString(options.token_key, 'token_key', 'attachDeviceToSession');
      Validators.assertNonEmptyString(options.push_provider, 'push_provider', 'attachDeviceToSession');
      Validators.assertNonEmptyString(options.push_token, 'push_token', 'attachDeviceToSession');

    },


    /********************************************************************
    Shape check for detachDeviceFromSession options.

    @param {Object} options - Caller-provided options object

    @return {void}
    *********************************************************************/
    validateDetachDeviceOptions: function (options) {

      Validators.assertOptionsObject(options, 'detachDeviceFromSession');

      Validators.assertNonEmptyString(options.tenant_id, 'tenant_id', 'detachDeviceFromSession');
      Validators.assertNonEmptyString(options.actor_id, 'actor_id', 'detachDeviceFromSession');
      Validators.assertNonEmptyString(options.token_key, 'token_key', 'detachDeviceFromSession');

    },


    /********************************************************************
    Shape check for refreshSessionJwt options.

    @param {Object} options - Caller-provided options object

    @return {void}
    *********************************************************************/
    validateRefreshSessionJwtOptions: function (options) {

      Validators.assertOptionsObject(options, 'refreshSessionJwt');

      Validators.assertNonEmptyString(options.tenant_id, 'tenant_id', 'refreshSessionJwt');
      Validators.assertNonEmptyString(options.refresh_token, 'refresh_token', 'refreshSessionJwt');

    }

  };//////////////////////////// Public Methods END //////////////////////////////


  ////////////////////////////// Helper Methods START /////////////////////////////

  /********************************************************************
  Throw TypeError if options is missing or not a plain object.

  @param {*} options - The options argument
  @param {String} fn_name - Public function name for error message

  @return {void}
  *********************************************************************/
  Validators.assertOptionsObject = function (options, fn_name) {

    if (Lib.Utils.isNullOrUndefined(options)) {
      throw new TypeError('[js-server-helper-auth] ' + fn_name + ' options object is required');
    }

    if (!Lib.Utils.isObject(options)) {
      throw new TypeError('[js-server-helper-auth] ' + fn_name + ' options must be a plain object');
    }

  };


  /********************************************************************
  Throw TypeError if value is not a non-empty string.

  @param {*} value - Value to check
  @param {String} field - Field name
  @param {String} fn_name - Public function name

  @return {void}
  *********************************************************************/
  Validators.assertNonEmptyString = function (value, field, fn_name) {

    if (
      Lib.Utils.isNullOrUndefined(value) ||
      !Lib.Utils.isString(value) ||
      Lib.Utils.isEmptyString(value)
    ) {
      throw new TypeError('[js-server-helper-auth] ' + fn_name + ' options.' + field + ' must be a non-empty string');
    }

  };


  /********************************************************************
  Throw TypeError if value is one of:
    - null/undefined (allowed - field is optional)
    - non-empty string (allowed)
    - anything else (rejected)

  @param {*} value - Value to check
  @param {String} field - Field name
  @param {String} fn_name - Public function name

  @return {void}
  *********************************************************************/
  Validators.assertOptionalString = function (value, field, fn_name) {

    if (Lib.Utils.isNullOrUndefined(value)) {
      return;
    }

    if (!Lib.Utils.isString(value)) {
      throw new TypeError('[js-server-helper-auth] ' + fn_name + ' options.' + field + ' must be a string when provided');
    }

  };


  /********************************************************************
  Throw TypeError if value is not boolean (when present). null/undefined OK.

  @param {*} value - Value to check
  @param {String} field - Field name
  @param {String} fn_name - Public function name

  @return {void}
  *********************************************************************/
  Validators.assertOptionalBoolean = function (value, field, fn_name) {

    if (Lib.Utils.isNullOrUndefined(value)) {
      return;
    }

    if (!Lib.Utils.isBoolean(value)) {
      throw new TypeError('[js-server-helper-auth] ' + fn_name + ' options.' + field + ' must be a boolean when provided');
    }

  };


  /********************************************************************
  Throw TypeError if value is not an integer (when present). null/undefined OK.

  @param {*} value - Value to check
  @param {String} field - Field name
  @param {String} fn_name - Public function name

  @return {void}
  *********************************************************************/
  Validators.assertOptionalInteger = function (value, field, fn_name) {

    if (Lib.Utils.isNullOrUndefined(value)) {
      return;
    }

    if (!Lib.Utils.isNumber(value) || !Lib.Utils.isInteger(value)) {
      throw new TypeError('[js-server-helper-auth] ' + fn_name + ' options.' + field + ' must be an integer when provided');
    }

  };


  /********************************************************************
  Throw TypeError if value is not one of the allowed enum values.

  @param {*} value - Value to check
  @param {String[]} allowed - Allowed values
  @param {String} field - Field name
  @param {String} fn_name - Public function name

  @return {void}
  *********************************************************************/
  Validators.assertEnum = function (value, allowed, field, fn_name) {

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

  };

  ///////////////////////////// Helper Methods END ////////////////////////////////


  return Validators;

};
