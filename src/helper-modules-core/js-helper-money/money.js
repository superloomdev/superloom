// Info: Money utility library. Currency metadata, float-safe rounding,
// formatting, and aggregation. Native JS, no external dependencies.
//
// Compatibility: Node.js 24+ and any modern browser.
//
// Factory pattern: each loader call returns an independent Money interface
// with its own config. All functions are pure - no shared module-level
// state between instances.
'use strict';


/////////////////////////// Module-Loader START ////////////////////////////////

/********************************************************************
Factory loader. One call = one independent instance with its own
config and reference data closures.

@param {Object} shared_libs - Lib container with Utils, Debug
@param {Object} config - Overrides merged over module config defaults

@return {Object} - Public interface for this module
*********************************************************************/
module.exports = function loader (shared_libs, config) {

  // Dependencies for this instance
  const Lib = {
    Utils: shared_libs.Utils,
    Debug: shared_libs.Debug
  };

  // Merge overrides over defaults
  const CONFIG = Object.assign(
    {},
    require('./money.config'),
    config || {}
  );

  // Static reference data (loaded once per loader call)
  const CURRENCIES = require('./data/currencies.json');

  // Error catalog (frozen)
  const ERRORS = require('./money.errors');

  // Validators module (singleton, injected with Lib only)
  const Validators = require('./money.validators')(Lib);

  // Validate config immediately so misconfiguration fails at startup
  Validators.validateConfig(CONFIG);

  return createInterface(Lib, CONFIG, CURRENCIES, Validators);

};/////////////////////////// Module-Loader END /////////////////////////////////



/////////////////////////// createInterface START //////////////////////////////

/********************************************************************
Builds the public interface for one instance. Public functions close
over the provided Lib, CONFIG, CURRENCIES, and Validators.

@param {Object} Lib - Dependency container (Utils, Debug)
@param {Object} CONFIG - Merged configuration for this instance
@param {Object} CURRENCIES - Currency reference data
@param {Object} Validators - The validators interface

@return {Object} - Public interface for this module
*********************************************************************/
const createInterface = function (Lib, CONFIG, CURRENCIES, Validators) {

  ///////////////////////////Public Functions START//////////////////////////////
  const Money = { // Public functions accessible by other modules

    // ~~~~~~~~~~~~~~~~~~~~ Currency Metadata ~~~~~~~~~~~~~~~~~~~~
    // Lookup functions for currency symbols, decimals, and denominations.
    // All functions accept currency codes case-insensitively and return
    // null for unknown codes.

    /********************************************************************
    Check if a currency code is known to the module.

    @param {String} code - Currency code (e.g., 'usd', 'INR')

    @return {Boolean} - True if known, false otherwise (including null/undefined)
    *********************************************************************/
    isCurrencyCode: function (code) {

      // Fast path: check type first
      if (!Lib.Utils.isString(code)) {
        return false;
      }

      const normalized = code.toLowerCase();

      // Length check
      if (normalized.length !== CONFIG.CURRENCY_CODE_MIN_LENGTH) {
        return false;
      }

      // Format check
      if (CONFIG.CURRENCY_CODE_SANITIZE_REGEX.test(normalized)) {
        return false;
      }

      return (normalized in CURRENCIES);

    },


    /********************************************************************
    Sanitize a currency code. Lowercase, strip non-letters.
    Returns null if result has wrong length.

    @param {*} code - Currency code to sanitize

    @return {String|null} - Sanitized code or null
    *********************************************************************/
    sanitizeCurrencyCode: function (code) {

      return Validators.sanitizeCurrencyCode(code);

    },


    /********************************************************************
    Validate a currency code without throwing.
    Returns false if valid, or an array of error objects on failure.

    @param {*} code - Currency code to validate

    @return {false|Array} - false if valid, Error[] if invalid
    *********************************************************************/
    validateCurrencyCode: function (code) {

      return Validators.validateCurrencyCode(code);

    },


    /********************************************************************
    Get the native currency symbol (e.g., '₹', '$', '€').

    @param {String} currency_code - Currency code

    @return {String} - Native symbol
    @throws {TypeError} - If currency_code is invalid or unknown
    *********************************************************************/
    getCurrencySymbol: function (currency_code) {

      const code = Validators.assertCurrencyCode(currency_code, 'getCurrencySymbol');

      return CURRENCIES[code]['symbol']['native'];

    },


    /********************************************************************
    Get the ISO 4217 alpha code (e.g., 'USD', 'INR').

    @param {String} currency_code - Currency code

    @return {String} - ISO alpha code
    @throws {TypeError} - If currency_code is invalid or unknown
    *********************************************************************/
    getCurrencyIsoAlpha: function (currency_code) {

      const code = Validators.assertCurrencyCode(currency_code, 'getCurrencyIsoAlpha');

      return CURRENCIES[code]['iso_alpha'];

    },


    /********************************************************************
    Get the ISO 4217 numeric code as a zero-padded string (e.g., '840', '036').

    @param {String} currency_code - Currency code

    @return {String} - ISO numeric code
    @throws {TypeError} - If currency_code is invalid or unknown
    *********************************************************************/
    getCurrencyIsoNumeric: function (currency_code) {

      const code = Validators.assertCurrencyCode(currency_code, 'getCurrencyIsoNumeric');

      return CURRENCIES[code]['iso_numeric'];

    },


    /********************************************************************
    Get the English name for a currency (ISO 4217 official name).

    @param {String} currency_code - Currency code

    @return {String} - English name
    @throws {TypeError} - If currency_code is invalid or unknown
    *********************************************************************/
    getCurrencyName: function (currency_code) {

      const code = Validators.assertCurrencyCode(currency_code, 'getCurrencyName');

      return CURRENCIES[code]['name_en'];

    },


    /********************************************************************
    Get the native minor currency symbol (e.g., '¢' for USD).

    @param {String} currency_code - Currency code

    @return {String|null} - Native minor symbol, or null if currency has none
    @throws {TypeError} - If currency_code is invalid or unknown
    *********************************************************************/
    getCurrencySymbolMinor: function (currency_code) {

      const code = Validators.assertCurrencyCode(currency_code, 'getCurrencySymbolMinor');

      return CURRENCIES[code]['symbol_minor']['native'];

    },


    /********************************************************************
    Get the number of decimal places for a currency.

    @param {String} currency_code - Currency code

    @return {Integer} - Decimal places (e.g., 2)
    @throws {TypeError} - If currency_code is invalid or unknown
    *********************************************************************/
    getCurrencyDecimals: function (currency_code) {

      const code = Validators.assertCurrencyCode(currency_code, 'getCurrencyDecimals');

      return CURRENCIES[code]['decimals'];

    },


    /********************************************************************
    Get the minimum transactional unit for a currency.
    This is the smallest amount that can be transacted (e.g., 0.01 for USD,
    1 for INR).

    @param {String} currency_code - Currency code

    @return {Number} - Minimum transactional unit
    @throws {TypeError} - If currency_code is invalid or unknown
    *********************************************************************/
    getCurrencyMinTransactionalUnit: function (currency_code) {

      const code = Validators.assertCurrencyCode(currency_code, 'getCurrencyMinTransactionalUnit');

      return CURRENCIES[code]['min_transactional_unit'];

    },


    /********************************************************************
    Get the available denominations for a currency.

    @param {String} currency_code - Currency code

    @return {Object|null} - { minor: [...], major: [...] } or null if
                            currency has no denominations (e.g., CNY)
    @throws {TypeError} - If currency_code is invalid or unknown
    *********************************************************************/
    getCurrencyDenominations: function (currency_code) {

      const code = Validators.assertCurrencyCode(currency_code, 'getCurrencyDenominations');

      const currency = CURRENCIES[code];

      if (!('denominations' in currency)) {
        return null;
      }

      return currency['denominations'];

    },


    // ~~~~~~~~~~~~~~~~~~~~ Rounding and Formatting ~~~~~~~~~~~~~~~~~~~~
    // Float-safe rounding and string formatting for display.

    /********************************************************************
    Round an amount to the correct number of decimal places for a currency.
    Uses Lib.Utils.round internally.

    @param {Number} amount - Amount to round
    @param {String} currency_code - Currency code
    @param {Number} [decimals] - Optional override for decimal places

    @return {Number} - Rounded amount
    *********************************************************************/
    roundAmount: function (amount, currency_code, decimals) {

      const code = Validators.assertCurrencyCode(currency_code, 'roundAmount');
      Validators.assertNumber(amount, 'amount', 'roundAmount');

      const currency_decimals = CURRENCIES[code]['decimals'];
      const resolved = Lib.Utils.fallback(decimals, currency_decimals);

      Validators.assertOptionalInteger(resolved, 'decimals', 'roundAmount');

      return Lib.Utils.round(amount, resolved);

    },


    /********************************************************************
    Format an amount as a string with correct decimal places.
    Adds trailing zeros unless no_pad is true and the result is a whole number.

    @param {Number} amount - Amount to format
    @param {String} currency_code - Currency code
    @param {Number} [decimals] - Optional override for decimal places
    @param {Boolean} [no_pad] - If true, don't add trailing zeros for whole numbers

    @return {String} - Formatted amount string
    *********************************************************************/
    formatAmount: function (amount, currency_code, decimals, no_pad = false) {

      const code = Validators.assertCurrencyCode(currency_code, 'formatAmount');
      Validators.assertNumber(amount, 'amount', 'formatAmount');

      const rounded = Money.roundAmount(amount, currency_code, decimals);
      const currency_decimals = CURRENCIES[code]['decimals'];
      const resolved = Lib.Utils.fallback(decimals, currency_decimals);

      Validators.assertOptionalInteger(resolved, 'decimals', 'formatAmount');

      if (!no_pad || !Lib.Utils.isInteger(rounded)) {
        return rounded.toFixed(resolved);
      }

      return rounded.toString();

    },


    // ~~~~~~~~~~~~~~~~~~~~ Transactional Amounts ~~~~~~~~~~~~~~~~~~~~
    // Conversions to/from fractional units and transactional rounding.

    /********************************************************************
    Round an amount to the nearest minimum transactional unit.
    When apply_min_unit is false, just applies standard rounding.

    @param {Number} amount - Amount to round
    @param {String} currency_code - Currency code
    @param {Number} [decimals] - Optional override for decimal places
    @param {Boolean} [apply_min_unit] - If true, round to min transactional unit

    @return {Number} - Rounded transactional amount
    *********************************************************************/
    getTransactionalAmount: function (amount, currency_code, decimals, apply_min_unit) {

      const code = Validators.assertCurrencyCode(currency_code, 'getTransactionalAmount');
      Validators.assertNumber(amount, 'amount', 'getTransactionalAmount');

      const currency_decimals = CURRENCIES[code]['decimals'];
      const resolved_decimals = Lib.Utils.fallback(decimals, currency_decimals);

      Validators.assertOptionalInteger(resolved_decimals, 'decimals', 'getTransactionalAmount');

      const integer_amount = _Money.toIntegerAmount(amount, code, resolved_decimals);

      if (!apply_min_unit) {
        return _Money.fromIntegerAmount(integer_amount, code, resolved_decimals);
      }

      const min_unit = CURRENCIES[code]['min_transactional_unit'];
      const integer_min_unit = _Money.toIntegerAmount(min_unit, code, resolved_decimals);

      const rounded = Math.round(integer_amount / integer_min_unit) * integer_min_unit;

      return _Money.fromIntegerAmount(rounded, code, resolved_decimals);

    },


    /********************************************************************
    Convert an amount to fractional units (e.g., $10.57 → 1057 cents).
    Applies transactional rounding first.

    @param {Number} amount - Amount in large currency
    @param {String} currency_code - Currency code
    @param {Number} [decimals] - Optional override for decimal places

    @return {Integer} - Amount in fractional units
    *********************************************************************/
    toFractionalUnits: function (amount, currency_code, decimals) {

      const code = Validators.assertCurrencyCode(currency_code, 'toFractionalUnits');
      Validators.assertNumber(amount, 'amount', 'toFractionalUnits');

      const currency_decimals = CURRENCIES[code]['decimals'];
      const resolved = Lib.Utils.fallback(decimals, currency_decimals);

      Validators.assertOptionalInteger(resolved, 'decimals', 'toFractionalUnits');

      // Round to min transactional unit first, then convert to integer
      const rounded = Money.getTransactionalAmount(amount, currency_code, resolved, true);

      return _Money.toIntegerAmount(rounded, code, resolved);

    },


    /********************************************************************
    Convert fractional units back to large currency (e.g., 1057 → $10.57).

    @param {Number} amount - Amount in fractional units
    @param {String} currency_code - Currency code
    @param {Number} [decimals] - Optional override for decimal places

    @return {Number} - Amount in large currency
    *********************************************************************/
    fromFractionalUnits: function (amount, currency_code, decimals) {

      const code = Validators.assertCurrencyCode(currency_code, 'fromFractionalUnits');
      Validators.assertNumber(amount, 'amount', 'fromFractionalUnits');

      const currency_decimals = CURRENCIES[code]['decimals'];
      const resolved = Lib.Utils.fallback(decimals, currency_decimals);

      Validators.assertOptionalInteger(resolved, 'decimals', 'fromFractionalUnits');

      return _Money.fromIntegerAmount(amount, code, resolved);

    },


    // ~~~~~~~~~~~~~~~~~~~~ Aggregation (float-safe) ~~~~~~~~~~~~~~~~~~~~
    // Summing multiple amounts safely using integer arithmetic internally.

    /********************************************************************
    Sum an array of amounts safely, avoiding floating-point errors.
    (e.g., 0.1 + 0.2 = 0.3 exactly, not 0.30000000000000004)

    @param {Number[]} amounts - Array of amounts to sum
    @param {String} currency_code - Currency code
    @param {Number} [decimals] - Optional override for decimal places

    @return {Number} - Summed amount
    *********************************************************************/
    sum: function (amounts, currency_code, decimals) {

      const code = Validators.assertCurrencyCode(currency_code, 'sum');

      Validators.assertOptionalInteger(decimals, 'decimals', 'sum');

      const currency_decimals = CURRENCIES[code]['decimals'];
      const resolved = Lib.Utils.fallback(decimals, currency_decimals);

      const total = amounts.reduce(function (sum, current) {
        Validators.assertNumber(current, 'amount item', 'sum');
        return sum + _Money.toIntegerAmount(current, code, resolved);
      }, 0);

      return _Money.fromIntegerAmount(total, code, resolved);

    },


    /********************************************************************
    Calculate total amount from denomination counts.

    @param {Array} [majors] - Array of { value, count } for major denominations
    @param {Array} [minors] - Array of { value, count } for minor denominations (in fractional units)
    @param {String} currency_code - Currency code
    @param {Number} [decimals] - Optional override for decimal places
    @param {Boolean} [apply_min_unit] - If true, apply min transactional unit rounding

    @return {Number} - Calculated total amount
    *********************************************************************/
    calculateTotalFromDenominations: function (majors, minors, currency_code, decimals, apply_min_unit) {

      const code = Validators.assertCurrencyCode(currency_code, 'calculateTotalFromDenominations');

      Validators.assertOptionalInteger(decimals, 'decimals', 'calculateTotalFromDenominations');

      const currency_decimals = CURRENCIES[code]['decimals'];
      const resolved = Lib.Utils.fallback(decimals, currency_decimals);

      let total = 0;

      // Calculate majors (in large currency units)
      if (!Lib.Utils.isNullOrUndefined(majors)) {
        majors.forEach(function (major) {
          Validators.assertNumber(major['value'], 'major.value', 'calculateTotalFromDenominations');
          Validators.assertNumber(major['count'], 'major.count', 'calculateTotalFromDenominations');
          total = Money.sum([
            total,
            major['value'] * major['count']
          ], currency_code, resolved);
        });
      }

      // Calculate minors (values are in fractional units, e.g., paise/cents)
      if (!Lib.Utils.isNullOrUndefined(minors)) {
        minors.forEach(function (minor) {
          Validators.assertNumber(minor['value'], 'minor.value', 'calculateTotalFromDenominations');
          Validators.assertNumber(minor['count'], 'minor.count', 'calculateTotalFromDenominations');
          // Convert fractional units to large currency: divide by 10^decimals
          const minor_in_large = (minor['value'] * minor['count']) / Number(`1e${resolved}`);
          total = Money.sum([
            total,
            minor_in_large
          ], currency_code, resolved);
        });
      }

      if (apply_min_unit) {
        return Money.getTransactionalAmount(total, currency_code, resolved, true);
      }

      return total;

    }

  };///////////////////////////Public Functions END//////////////////////////////


  ///////////////////////////Private Functions START/////////////////////////////
  // Internal helpers that close over Lib and CURRENCIES.

  const _Money = {

    /********************************************************************
    Convert a large-currency amount to integer representation
    by multiplying by 10^decimals.

    @param {Number} amount - Amount in large currency
    @param {String} code - Normalized currency code (already validated)
    @param {Number} decimals - Decimal places for this currency

    @return {Integer} - Amount in integer units
    *********************************************************************/
    toIntegerAmount: function (amount, code, decimals) {

      return Math.round(
        amount * Number(`1e${decimals}`)
      );

    },


    /********************************************************************
    Convert an integer amount back to large-currency representation
    by dividing by 10^decimals and rounding appropriately.

    @param {Number} integer_amount - Amount in integer units
    @param {String} code - Normalized currency code (already validated)
    @param {Number} decimals - Decimal places for this currency

    @return {Number} - Amount in large currency
    *********************************************************************/
    fromIntegerAmount: function (integer_amount, code, decimals) {

      const float_amount = integer_amount / Number(`1e${decimals}`);

      return Lib.Utils.round(float_amount, decimals);

    }

  };/////////////////////////Private Functions END///////////////////////////////


  // Return the public interface
  return Money;

};/////////////////////////// createInterface END //////////////////////////////
