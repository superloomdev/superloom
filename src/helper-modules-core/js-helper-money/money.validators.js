// Info: All validators for js-helper-money. Four roles:
//   1. Config validators - called once at loader time. Throw Error.
//   2. Programmer-error assertions - called per request. Throw TypeError.
//   3. Domain-style validators - return false | Error[].
//   4. Pure normalizers - no throws.
//
// Singleton: Lib injected once by loader; static data required internally.
'use strict';


// Static data loaded once at require time
const CURRENCIES = require('./data/currencies.json');
const ERRORS = require('./money.errors');
const CONFIG = require('./money.config');

// Shared dependency injected by loader
let Lib;


/////////////////////////// Module-Loader START ////////////////////////////////

/********************************************************************
Singleton loader. Injects Lib and returns the module-scope Validators object.

@param {Object} shared_libs - Lib container with Utils

@return {Object} - Public Validators interface
*********************************************************************/
module.exports = function loader (shared_libs) {

  // Inject shared dependency
  Lib = shared_libs;

  // Return the Validators interface
  return Validators;

};///////////////////////////// Module-Loader END ///////////////////////////////



////////////////////////////// Public Functions START ////////////////////////////

const Validators = {


  // ~~~~~~~~~~~~~~~~~~~~ Config Validators ~~~~~~~~~~~~~~~~~~~~
  // Called once at construction time from the money.js loader.
  // Throw Error (not TypeError) because misconfiguration is a setup error,
  // not a programmer call error.

  /********************************************************************
  Validate the merged CONFIG. Throws on every violation so the loader
  fails before serving a single request.

  @param {Object} config - Merged module configuration

  @return {void}
  *********************************************************************/
  validateConfig: function (config) {

    // DEFAULT_CURRENCY_CODE, if set, must be a known currency
    if (
      !Lib.Utils.isNullOrUndefined(config.DEFAULT_CURRENCY_CODE) &&
      !(config.DEFAULT_CURRENCY_CODE.toLowerCase() in CURRENCIES)
    ) {
      throw new Error(
        '[js-helper-money] CONFIG.DEFAULT_CURRENCY_CODE "' +
        config.DEFAULT_CURRENCY_CODE +
        '" is not a known currency'
      );
    }

    // CURRENCY_CODE_MIN_LENGTH must be a positive integer
    if (
      !Lib.Utils.isNumber(config.CURRENCY_CODE_MIN_LENGTH) ||
      !Lib.Utils.isInteger(config.CURRENCY_CODE_MIN_LENGTH) ||
      config.CURRENCY_CODE_MIN_LENGTH <= 0
    ) {
      throw new Error(
        '[js-helper-money] CONFIG.CURRENCY_CODE_MIN_LENGTH must be a positive integer'
      );
    }

    // CURRENCY_CODE_MAX_LENGTH must be a positive integer
    if (
      !Lib.Utils.isNumber(config.CURRENCY_CODE_MAX_LENGTH) ||
      !Lib.Utils.isInteger(config.CURRENCY_CODE_MAX_LENGTH) ||
      config.CURRENCY_CODE_MAX_LENGTH <= 0
    ) {
      throw new Error(
        '[js-helper-money] CONFIG.CURRENCY_CODE_MAX_LENGTH must be a positive integer'
      );
    }

    // CURRENCY_CODE_SANITIZE_REGEX must be a RegExp
    if (!(config.CURRENCY_CODE_SANITIZE_REGEX instanceof RegExp)) {
      throw new Error(
        '[js-helper-money] CONFIG.CURRENCY_CODE_SANITIZE_REGEX must be a RegExp'
      );
    }

  },


  // ~~~~~~~~~~~~~~~~~~~~ Programmer-Error Assertions ~~~~~~~~~~~~~~~~~~~~
  // Called per request from public functions in money.js.
  // Throw TypeError - bad arguments mean the caller's code is wrong.

  /********************************************************************
  Throw TypeError if currency code is missing, wrong type, or not a known
  currency.

  Returns the normalized lowercase code on success.

  @param {*}      code     - The currency code to validate
  @param {String} fn_name  - Public function name for error message

  @return {String} - Normalized lowercase currency code
  *********************************************************************/
  assertCurrencyCode: function (code, fn_name) {

    // Fallback path: caller passed null/undefined and a default exists
    if (Lib.Utils.isNullOrUndefined(code)) {
      if (CONFIG.DEFAULT_CURRENCY_CODE) {
        return CONFIG.DEFAULT_CURRENCY_CODE.toLowerCase();
      }
      throw new TypeError(
        '[js-helper-money] ' + fn_name + ': currency_code is required'
      );
    }

    // Check length before further processing
    if (code.length !== CONFIG.CURRENCY_CODE_MIN_LENGTH) {
      throw new TypeError(
        '[js-helper-money] ' + fn_name + ': currency_code must be exactly ' +
        CONFIG.CURRENCY_CODE_MIN_LENGTH + ' letters'
      );
    }

    // Must be a string
    if (!Lib.Utils.isString(code)) {
      throw new TypeError(
        '[js-helper-money] ' + fn_name + ': currency_code must be a string'
      );
    }

    // Normalize to lowercase
    const normalized = code.toLowerCase();

    // Always check membership - throw if unknown
    if (!(normalized in CURRENCIES)) {
      throw new TypeError(
        '[js-helper-money] ' + fn_name + ': unknown currency_code "' + code + '"'
      );
    }

    return normalized;

  },


  /********************************************************************
  Throw TypeError if value is not a finite number.

  @param {*}      value   - The value to check
  @param {String} field   - Field name for error message
  @param {String} fn_name - Public function name for error message

  @return {void}
  *********************************************************************/
  assertNumber: function (value, field, fn_name) {

    if (Lib.Utils.isNullOrUndefined(value)) {
      throw new TypeError(
        '[js-helper-money] ' + fn_name + ': ' + field + ' is required'
      );
    }

    if (!Lib.Utils.isNumber(value) || !Number.isFinite(value)) {
      throw new TypeError(
        '[js-helper-money] ' + fn_name + ': ' + field + ' must be a finite number'
      );
    }

  },


  /********************************************************************
  Throw TypeError if value is present and not an integer.
  null/undefined is allowed (field is optional).

  @param {*}      value   - The value to check
  @param {String} field   - Field name for error message
  @param {String} fn_name - Public function name for error message

  @return {void}
  *********************************************************************/
  assertOptionalInteger: function (value, field, fn_name) {

    // Allow null/undefined — field is optional
    if (Lib.Utils.isNullOrUndefined(value)) {
      return;
    }

    // Throw if a non-null value is not an integer
    if (!Lib.Utils.isNumber(value) || !Lib.Utils.isInteger(value)) {
      throw new TypeError(
        '[js-helper-money] ' + fn_name + ': ' + field + ' must be an integer when provided'
      );
    }

  },


  // ~~~~~~~~~~~~~~~~~~~~ Domain-Style Validators ~~~~~~~~~~~~~~~~~~~~
  // Called by validateCurrencyCode public function.
  // Return false on success, Error[] on failure.

  /********************************************************************
  Validate a currency code without throwing.
  Returns false if valid, or an array of error objects from the catalog.

  @param {*} code - The currency code to validate

  @return {false|Array} - false if valid, Error[] if invalid
  *********************************************************************/
  validateCurrencyCode: function (code) {

    // Required check
    if (Lib.Utils.isNullOrUndefined(code)) {
      return [ERRORS.CURRENCY_CODE_REQUIRED];
    }

    // Type check
    if (!Lib.Utils.isString(code)) {
      return [ERRORS.CURRENCY_CODE_TYPE];
    }

    const errors = [];

    // Length check
    if (code.length !== CONFIG.CURRENCY_CODE_MIN_LENGTH) {
      errors.push(ERRORS.CURRENCY_CODE_LENGTH);
    }

    // Format check (contains non-letters)
    if (CONFIG.CURRENCY_CODE_SANITIZE_REGEX.test(code)) {
      errors.push(ERRORS.CURRENCY_CODE_FORMAT);
    }

    // Membership check (only if format is OK so far)
    if (errors.length === 0 && !(code.toLowerCase() in CURRENCIES)) {
      errors.push(ERRORS.CURRENCY_CODE_UNKNOWN);
    }

    return errors.length > 0 ? errors : false;

  },


  // ~~~~~~~~~~~~~~~~~~~~ Pure Normalizers ~~~~~~~~~~~~~~~~~~~~
  // No throws. Return cleaned value or null.

  /********************************************************************
  Sanitize a currency code: lowercase, strip non-letters.
  Returns null if the result has wrong length.

  @param {*} code - The currency code to sanitize

  @return {String|null} - Sanitized code or null
  *********************************************************************/
  sanitizeCurrencyCode: function (code) {

    // Reject null/undefined or non-string
    if (Lib.Utils.isNullOrUndefined(code) || !Lib.Utils.isString(code)) {
      return null;
    }

    // Strip non-letters and lowercase
    const cleaned = code.replace(CONFIG.CURRENCY_CODE_SANITIZE_REGEX, '').toLowerCase();

    // Check length constraints
    if (
      cleaned.length < CONFIG.CURRENCY_CODE_MIN_LENGTH ||
      cleaned.length > CONFIG.CURRENCY_CODE_MAX_LENGTH
    ) {
      return null;
    }

    return cleaned;

  }


};////////////////////////////// Public Functions END ////////////////////////////
