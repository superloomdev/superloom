// Info: Money utility library. Currency metadata, float-safe rounding,
// formatting, and aggregation. Native JS, no external dependencies.
//
// Compatibility: Node.js 24+ and any modern browser.
//
// Singleton: Lib and CONFIG are injected once by the loader. Public and
// private objects are declared at module scope - Node.js require cache
// guarantees the same Money object is returned on every subsequent require.
// No factory needed.
'use strict';


// Shared dependency injected by loader
let Lib;

// Domain config injected by loader
let CONFIG;

// Error catalog (frozen)
const ERRORS = require('./money.errors'); // eslint-disable-line no-unused-vars

// Validators module (singleton, set by loader after Lib is available)
let Validators;

// Static reference data (loaded once at require time)
const CURRENCIES = require('./data/currencies.json');


/////////////////////////// Module-Loader START ////////////////////////////////

/********************************************************************
Singleton loader. Injects Lib and CONFIG, initializes Validators,
and returns the module-scope Money object directly. Node.js require
cache guarantees a single instance across the process.

@param {Object} shared_libs - Lib container with Utils, Debug
@param {Object} config - Overrides merged over module config defaults

@return {Object} - Public Money interface
*********************************************************************/
module.exports = function loader (shared_libs, config) {

  // Inject shared dependencies
  Lib = {
    Utils: shared_libs.Utils,
    Debug: shared_libs.Debug
  };

  // Merge overrides over defaults
  CONFIG = Object.assign(
    {},
    require('./money.config'),
    config || {}
  );

  // Initialize validators (needs Lib to be set first)
  Validators = require('./money.validators')(Lib);

  // Validate config immediately so misconfiguration fails at startup
  Validators.validateConfig(CONFIG);

  return Money;

};///////////////////////////// Module-Loader END ///////////////////////////////



///////////////////////////Public Functions START//////////////////////////////
const Money = {

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

    // Delegate to the validators module
    return Validators.sanitizeCurrencyCode(code);

  },


  /********************************************************************
  Validate a currency code without throwing.
  Returns false if valid, or an array of error objects on failure.

  @param {*} code - Currency code to validate

  @return {false|Array} - false if valid, Error[] if invalid
  *********************************************************************/
  validateCurrencyCode: function (code) {

    // Delegate to the validators module
    return Validators.validateCurrencyCode(code);

  },


  /********************************************************************
  Get the native currency symbol (e.g., '₹', '$', '€').

  @param {String} currency_code - Currency code

  @return {String|null} - Native symbol, or null if unknown
  *********************************************************************/
  getCurrencySymbol: function (currency_code) {

    // Normalize and verify the currency code is known
    const code = Validators.normalizeCurrencyCode(currency_code);

    if (code === null) { return null; }

    return CURRENCIES[code]['symbol']['native'];

  },


  /********************************************************************
  Get the locale-aware currency symbol. Returns the native symbol
  when the country_code matches the first two characters of the
  currency code (e.g., 'inr' in 'in'). Otherwise returns the
  standard (ISO alpha) symbol.

  @param {String} currency_code - Currency code
  @param {String} country_code  - ISO 3166-1 alpha-2 country code
  @param {String} language_code - Locale identifier (e.g., 'hi_in')

  @return {String|null} - Locale-aware symbol, or null if unknown
  *********************************************************************/
  getCurrencySymbolForLocale: function (currency_code, country_code, language_code) { // eslint-disable-line no-unused-vars

    // Normalize and verify the currency code is known
    const code = Validators.normalizeCurrencyCode(currency_code);

    if (code === null) { return null; }

    // Normalize the country code for comparison
    const country = Lib.Utils.isString(country_code)
      ? country_code.toLowerCase()
      : '';

    // Return native symbol when country matches currency's home country
    if (code.substring(0, 2) === country) {
      return CURRENCIES[code]['symbol']['native'];
    }

    return CURRENCIES[code]['symbol']['standard'];

  },


  /********************************************************************
  Get the ISO 4217 alpha code (e.g., 'USD', 'INR').

  @param {String} currency_code - Currency code

  @return {String|null} - ISO alpha code, or null if unknown
  *********************************************************************/
  getCurrencyIsoAlpha: function (currency_code) {

    // Normalize and verify the currency code is known
    const code = Validators.normalizeCurrencyCode(currency_code);

    if (code === null) { return null; }

    return CURRENCIES[code]['iso_alpha'];

  },


  /********************************************************************
  Get the ISO 4217 numeric code as a zero-padded string (e.g., '840', '036').

  @param {String} currency_code - Currency code

  @return {String|null} - ISO numeric code, or null if unknown
  *********************************************************************/
  getCurrencyIsoNumeric: function (currency_code) {

    // Normalize and verify the currency code is known
    const code = Validators.normalizeCurrencyCode(currency_code);

    if (code === null) { return null; }

    return CURRENCIES[code]['iso_numeric'];

  },


  /********************************************************************
  Get the English name for a currency (ISO 4217 official name).

  @param {String} currency_code - Currency code

  @return {String|null} - English name, or null if unknown
  *********************************************************************/
  getCurrencyName: function (currency_code) {

    // Normalize and verify the currency code is known
    const code = Validators.normalizeCurrencyCode(currency_code);

    if (code === null) { return null; }

    return CURRENCIES[code]['name_en'];

  },


  /********************************************************************
  Get the native minor currency symbol (e.g., '¢' for USD).

  @param {String} currency_code - Currency code

  @return {String|null} - Native minor symbol, or null if currency
                          has none or is unknown
  *********************************************************************/
  getCurrencySymbolMinor: function (currency_code) {

    // Normalize and verify the currency code is known
    const code = Validators.normalizeCurrencyCode(currency_code);

    if (code === null) { return null; }

    return CURRENCIES[code]['symbol_minor']['native'];

  },


  /********************************************************************
  Get the locale-aware minor currency symbol. Returns the native minor
  symbol when the country_code matches the first two characters of the
  currency code. Otherwise returns the standard (ISO alpha) symbol.
  Returns null if the currency's native minor symbol is null (e.g., INR
  has no minor symbol).

  @param {String} currency_code - Currency code
  @param {String} country_code  - ISO 3166-1 alpha-2 country code
  @param {String} language_code - Locale identifier (e.g., 'en_us')

  @return {String|null} - Locale-aware minor symbol, or null if
                          currency has no minor symbol or is unknown
  *********************************************************************/
  getCurrencySymbolMinorForLocale: function (currency_code, country_code, language_code) { // eslint-disable-line no-unused-vars

    // Normalize and verify the currency code is known
    const code = Validators.normalizeCurrencyCode(currency_code);

    if (code === null) { return null; }

    // Check if the currency has a native minor symbol at all
    const native_minor = CURRENCIES[code]['symbol_minor']['native'];

    // If no native minor symbol exists, return null regardless of locale
    if (native_minor === null) { return null; }

    // Normalize the country code for comparison
    const country = Lib.Utils.isString(country_code)
      ? country_code.toLowerCase()
      : '';

    // Return native minor symbol when country matches currency's home country
    if (code.substring(0, 2) === country) {
      return native_minor;
    }

    return CURRENCIES[code]['symbol_minor']['standard'];

  },


  /********************************************************************
  Get the number of decimal places for a currency.

  @param {String} currency_code - Currency code

  @return {Integer|null} - Decimal places (e.g., 2), or null if unknown
  *********************************************************************/
  getCurrencyDecimals: function (currency_code) {

    // Normalize and verify the currency code is known
    const code = Validators.normalizeCurrencyCode(currency_code);

    if (code === null) { return null; }

    return CURRENCIES[code]['decimals'];

  },


  /********************************************************************
  Get the minimum transactional unit for a currency.
  This is the smallest amount that can be transacted (e.g., 0.01 for USD,
  1 for INR).

  @param {String} currency_code - Currency code

  @return {Number|null} - Minimum transactional unit, or null if unknown
  *********************************************************************/
  getCurrencyMinTransactionalUnit: function (currency_code) {

    // Normalize and verify the currency code is known
    const code = Validators.normalizeCurrencyCode(currency_code);

    if (code === null) { return null; }

    return CURRENCIES[code]['min_transactional_unit'];

  },


  /********************************************************************
  Get the available denominations for a currency.

  @param {String} currency_code - Currency code

  @return {Object|null} - { minor: [...], major: [...] } or null if
                          currency has no denominations or is unknown
  *********************************************************************/
  getCurrencyDenominations: function (currency_code) {

    // Normalize and verify the currency code is known
    const code = Validators.normalizeCurrencyCode(currency_code);

    if (code === null) { return null; }

    // Check if this currency defines denominations
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

    // Validate currency code and amount
    const code = Validators.assertCurrencyCode(currency_code, 'roundAmount');
    Validators.assertNumber(amount, 'amount', 'roundAmount');

    // Resolve decimal places (caller override or currency default)
    const currency_decimals = CURRENCIES[code]['decimals'];
    const resolved = Lib.Utils.fallback(decimals, currency_decimals);

    Validators.assertOptionalInteger(resolved, 'decimals', 'roundAmount');

    // Round and return
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

    // Validate currency code and amount
    const code = Validators.assertCurrencyCode(currency_code, 'formatAmount');
    Validators.assertNumber(amount, 'amount', 'formatAmount');

    // Round first, then resolve decimal places for formatting
    const rounded = Money.roundAmount(amount, currency_code, decimals);
    const currency_decimals = CURRENCIES[code]['decimals'];
    const resolved = Lib.Utils.fallback(decimals, currency_decimals);

    Validators.assertOptionalInteger(resolved, 'decimals', 'formatAmount');

    // Pad with trailing zeros unless no_pad is true and result is whole
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

    // Validate currency code and amount
    const code = Validators.assertCurrencyCode(currency_code, 'getTransactionalAmount');
    Validators.assertNumber(amount, 'amount', 'getTransactionalAmount');

    // Resolve decimal places (caller override or currency default)
    const currency_decimals = CURRENCIES[code]['decimals'];
    const resolved_decimals = Lib.Utils.fallback(decimals, currency_decimals);

    Validators.assertOptionalInteger(resolved_decimals, 'decimals', 'getTransactionalAmount');

    // Convert to integer representation for float-safe arithmetic
    const integer_amount = _Money.toIntegerAmount(amount, code, resolved_decimals);

    // Return standard rounding when min-unit rounding is not requested
    if (!apply_min_unit) {
      return _Money.fromIntegerAmount(integer_amount, code, resolved_decimals);
    }

    // Round to the nearest minimum transactional unit
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

    // Validate currency code and amount
    const code = Validators.assertCurrencyCode(currency_code, 'toFractionalUnits');
    Validators.assertNumber(amount, 'amount', 'toFractionalUnits');

    // Resolve decimal places (caller override or currency default)
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

    // Validate currency code and amount
    const code = Validators.assertCurrencyCode(currency_code, 'fromFractionalUnits');
    Validators.assertNumber(amount, 'amount', 'fromFractionalUnits');

    // Resolve decimal places (caller override or currency default)
    const currency_decimals = CURRENCIES[code]['decimals'];
    const resolved = Lib.Utils.fallback(decimals, currency_decimals);

    Validators.assertOptionalInteger(resolved, 'decimals', 'fromFractionalUnits');

    // Convert integer units back to large currency
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

    // Validate currency code and optional decimals override
    const code = Validators.assertCurrencyCode(currency_code, 'sum');

    Validators.assertOptionalInteger(decimals, 'decimals', 'sum');

    // Resolve decimal places (caller override or currency default)
    const currency_decimals = CURRENCIES[code]['decimals'];
    const resolved = Lib.Utils.fallback(decimals, currency_decimals);

    // Sum in integer space to avoid floating-point errors
    const total = amounts.reduce(function (sum, current) {
      Validators.assertNumber(current, 'amount item', 'sum');
      return sum + _Money.toIntegerAmount(current, code, resolved);
    }, 0);

    // Convert back to large currency
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

    // Validate currency code and optional decimals override
    const code = Validators.assertCurrencyCode(currency_code, 'calculateTotalFromDenominations');

    Validators.assertOptionalInteger(decimals, 'decimals', 'calculateTotalFromDenominations');

    // Resolve decimal places (caller override or currency default)
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

    // Apply min transactional unit rounding if requested
    if (apply_min_unit) {
      return Money.getTransactionalAmount(total, currency_code, resolved, true);
    }

    return total;

  }

};///////////////////////////Public Functions END//////////////////////////////



///////////////////////////Private Functions START/////////////////////////////
// Internal helpers that close over module-scope Lib and CURRENCIES.

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

    // Multiply by 10^decimals and round to nearest integer
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

    // Divide by 10^decimals and round to avoid floating-point drift
    const float_amount = integer_amount / Number(`1e${decimals}`);

    return Lib.Utils.round(float_amount, decimals);

  }

};//////////////////////////Private Functions END///////////////////////////////
