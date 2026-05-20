// Info: Request parameter extraction for js-server-helper-http-gateway.
// Reads from the normalized instance.http_request shape (populated by the
// adapter) and builds a clean, typed, validated args object.
//
// Multipart/form-data bodies are NOT supported. Attempts to submit
// multipart bodies will be treated as an unknown content-type and ignored.
// Pass content-type application/json or application/x-www-form-urlencoded
// for POST data.
//
// Singleton: Lib is injected once by the loader. All callers share the same
// Params object. Lib.Utils and Lib.Debug are the only dependencies and do
// not vary per caller. Node.js require cache guarantees the same Params
// object is returned on every subsequent require.
//
// NOTE: Lib.Utils and Lib.Debug are currently factory modules but qualify as
// singletons (stateless, shared identity, no per-caller config). They will
// be converted in a future plan; this file will require no changes when that
// happens because Lib is injected once and the reference updates in place.
'use strict';


// Shared dependencies injected by loader (uniform parts signature)
let Lib;
let CONFIG; // eslint-disable-line no-unused-vars
let ERRORS; // eslint-disable-line no-unused-vars


/////////////////////////// Module-Loader START ////////////////////////////////

/********************************************************************
Singleton loader. Injects Lib, CONFIG, and ERRORS and returns the
module-scope Params object directly. CONFIG and ERRORS are accepted
for signature uniformity with other parts — not consumed today.

@param {Object} shared_libs - Dependency container (Utils, Debug)
@param {Object} config      - Merged module configuration
@param {Object} errors      - Module error catalog

@return {Object} - Public Params interface
*********************************************************************/
module.exports = function loader (shared_libs, config, errors) {

  // Assign to module-scope vars so public and private objects can close over them
  Lib = shared_libs;
  CONFIG = config;
  ERRORS = errors;

  return Params;

};///////////////////////////// Module-Loader END ///////////////////////////////



///////////////////////////Public Functions START//////////////////////////////
const Params = {

  /********************************************************************
    Build a typed, validated args object from the normalized HTTP request
    data in instance.http_request.

    Each entry in the params array describes one parameter:
      method          {String}   - 'GET' | 'POST' | 'PATH' | 'HEADER' | 'FIXED'
      name            {String}   - Key name in the source location
      rename          {String}   - Output key name in the returned args object
      value           {*}        - Literal value (only for method: 'FIXED')
      required        {Boolean}  - true = abort and return [null, false] if missing
      default         {*}        - Value used when param is absent and not required
      is_number       {Boolean}  - Typecast string -> Number
      is_boolean      {Boolean}  - Typecast via Boolean(Number(value))
      is_json         {Boolean}  - JSON.parse the string value
      trim            {Boolean}  - String trim; converts empty string to null
      json_func       {Function} - Transform applied after JSON.parse
      sanatize_func   {Function} - Sanitization function applied to the value
      validate_func   {Function} - Must return true; failure returns [null, false]
      invalidate_func {Function} - Must return falsy; truthy return is forwarded
                                   as the error: [err, false]

    @param {Object}   instance - Per-request instance with http_request populated
    @param {Object[]} params   - Array of parameter descriptor objects

    @return {Array} [null, {Object}]    - On success: [null, args]
    @return {Array} [null, false]       - On required-param failure or validation failure
    @return {Array} [{Object}, false]   - On invalidate_func failure: [err, false]
    *********************************************************************/
  setArgsFromRequest: function (instance, params) {

    // Empty param list - return empty args immediately
    if (Lib.Utils.isNullOrUndefined(params) || params.length === 0) {
      return [null, {}];
    }

    let errs = null;
    let args = {};

    // Walk params. Array.prototype.every allows early exit via return false.
    const completed = params.every(function (param) {

      let param_value = null;

      // Extract raw value from the correct source
      if (param.method === 'GET' && param.name in instance.http_request.get) {
        param_value = instance.http_request.get[param.name];
      }
      else if (param.method === 'POST' && param.name in instance.http_request.post) {
        param_value = instance.http_request.post[param.name];
      }
      else if (param.method === 'HEADER' && param.name in instance.http_request.headers) {
        param_value = instance.http_request.headers[param.name];
      }
      else if (param.method === 'PATH' && param.name in instance.http_request.path) {
        param_value = instance.http_request.path[param.name];
      }
      else if (param.method === 'FIXED') {
        param_value = param.value;
      }

      Lib.Debug.log('Params raw', param.name + ': ' + param_value);

      // Required check - first pass (before any typecast)
      if (param.required && Lib.Utils.isNullOrUndefined(param_value)) {
        args = false;
        return false;
      }

      // Process value only when it is present
      if (!Lib.Utils.isNullOrUndefined(param_value)) {

        // Trim whitespace (strings only)
        if (param.trim && Lib.Utils.isString(param_value)) {
          param_value = param_value.trim();

          if (Lib.Utils.isEmptyString(param_value)) {
            param_value = null;
          }
        }

        // Typecast: string -> Number
        if (param.is_number && Lib.Utils.isString(param_value)) {
          param_value = Number(param_value);
        }

        // Typecast: string -> Boolean (via Number intermediate)
        if (param.is_boolean) {
          param_value = Boolean(Number(param_value));
        }

        // Typecast: string -> JSON
        if (param.is_json && Lib.Utils.isString(param_value)) {
          try {
            param_value = JSON.parse(param_value);
          }
          catch {
            param_value = null;

            if (param.required) {
              args = false;
              return false;
            }
          }
        }

        // JSON transform function
        if (param.is_json && !Lib.Utils.isNullOrUndefined(param.json_func)) {
          param_value = param.json_func(param_value);
        }

        // Sanitization function
        if ('sanatize_func' in param && !Lib.Utils.isNullOrUndefined(param_value)) {
          param_value = param.sanatize_func(param_value);
        }

        args[param.rename] = param_value;

      }
      else {
        // Use default when absent and not required
        args[param.rename] = param.default;
      }

      Lib.Debug.log(
        'Params clean',
        param.name + ': ' + (Lib.Utils.isObject(param_value) ? JSON.stringify(param_value) : String(param_value))
      );

      // Required check - second pass (catches empty-string and null-after-typecast)
      if (param.required && Lib.Utils.isNullOrUndefined(param_value)) {
        args = false;
        return false;
      }

      // Validate function - must return truthy
      if (
        'validate_func' in param &&
          !Lib.Utils.isNullOrUndefined(param_value) &&
          !param.validate_func(param_value)
      ) {
        args = false;
        return false;
      }

      // Invalidate function - must return falsy; truthy return is the error
      if ('invalidate_func' in param && !Lib.Utils.isNullOrUndefined(param_value)) {
        const err = param.invalidate_func(param_value);

        if (err) {
          errs = err;
          args = false;
          return false;
        }
      }

      return true;

    });

    if (!completed || args === false) {
      return [errs, false];
    }

    return [null, args];

  }

};
////////////////////////////Public Functions END//////////////////////////////
