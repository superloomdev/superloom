// Info: Configuration file for js-helper-money
'use strict';


module.exports = {

  // Default currency code (used when caller passes null/undefined)
  DEFAULT_CURRENCY_CODE: 'usd',

  // Constraints on currency code (reserved — no validator reads these yet)
  CURRENCY_CODE_MIN_LENGTH: 3,
  CURRENCY_CODE_MAX_LENGTH: 3,
  CURRENCY_CODE_SANITIZE_REGEX: /[^a-zA-Z]/g

};
