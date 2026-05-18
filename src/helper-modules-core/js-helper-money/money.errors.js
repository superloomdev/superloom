'use strict';

/**
 * Error catalog for js-helper-money.
 * Validation errors returned via validateCurrencyCode.
 * Frozen to prevent accidental mutation.
 */

module.exports = Object.freeze({

  CURRENCY_CODE_REQUIRED: Object.freeze({
    type: 'MONEY_CURRENCY_CODE_REQUIRED',
    message: 'Currency code is required'
  }),

  CURRENCY_CODE_TYPE: Object.freeze({
    type: 'MONEY_CURRENCY_CODE_TYPE',
    message: 'Currency code must be a string'
  }),

  CURRENCY_CODE_LENGTH: Object.freeze({
    type: 'MONEY_CURRENCY_CODE_LENGTH',
    message: 'Currency code must be exactly 3 letters'
  }),

  CURRENCY_CODE_FORMAT: Object.freeze({
    type: 'MONEY_CURRENCY_CODE_FORMAT',
    message: 'Currency code must contain only letters'
  }),

  CURRENCY_CODE_UNKNOWN: Object.freeze({
    type: 'MONEY_CURRENCY_CODE_UNKNOWN',
    message: 'Currency code is not recognized'
  })

});
