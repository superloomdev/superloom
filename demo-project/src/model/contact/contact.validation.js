// Info: Pure validation functions for Contact entity (email + phone)
// Project-specific: different projects may restrict domains, countries, etc.
'use strict';

// Shared dependencies (injected by loader; avoids passing Lib everywhere)
let Lib;

// Domain config (injected; constants/enums, not runtime env)
let CONFIG;

// Error catalog (injected; independent from config)
let ERRORS;


/////////////////////////// Module-Loader START ////////////////////////////////

/********************************************************************
  Loader: inject Lib + CONFIG + ERRORS for this module.

  @param {Object} shared_libs - loaded libraries + models (Lib)
  @param {Object} config - domain config for this module
  @param {Object} errors - error catalog for this module
  @return {void}
  *********************************************************************/
const loader = function (shared_libs, config, errors) {

  Lib = shared_libs;
  CONFIG = config;
  ERRORS = errors;

};

//////////////////////////// Module-Loader END /////////////////////////////////



///////////////////////////// Module Exports START /////////////////////////////
module.exports = function (shared_libs, config, errors) {

  // Run module-scope loader (local DI)
  loader(shared_libs, config, errors);

  // Return Public Functions of this module
  return ContactValidation;

};//////////////////////////// Module Exports END //////////////////////////////



///////////////////////////Public Functions START//////////////////////////////
const ContactValidation = {

  /********************************************************************
  Validate an email address (format, length, domain rules)

  @param {String} email - Email address to validate

  @return {Boolean} false - If validation passes
  @return {Object[]} errors - Array of error objects if validation fails
  *********************************************************************/
  validateEmail: function (email) {

    const errors = [];

    // Required check
    if (!email || typeof email !== 'string') {
      errors.push(ERRORS.EMAIL_REQUIRED);
      return errors;
    }

    const trimmed = email.trim().toLowerCase();

    // Length check
    if (trimmed.length < CONFIG.EMAIL_MIN_LENGTH || trimmed.length > CONFIG.EMAIL_MAX_LENGTH) {
      errors.push(ERRORS.EMAIL_INVALID_LENGTH);
      return errors;
    }

    // Format check (regex)
    if (!CONFIG.EMAIL_REGEX.test(trimmed)) {
      errors.push(ERRORS.EMAIL_INVALID_FORMAT);
      return errors;
    }

    // Domain checks
    const domain = trimmed.split('@')[1];

    // Blocked domains check
    if (CONFIG.EMAIL_BLOCKED_DOMAINS.length > 0 && CONFIG.EMAIL_BLOCKED_DOMAINS.includes(domain)) {
      errors.push(ERRORS.EMAIL_DOMAIN_BLOCKED);
      return errors;
    }

    // Allowed domains check (only if restriction is set)
    if (CONFIG.EMAIL_ALLOWED_DOMAINS.length > 0 && !CONFIG.EMAIL_ALLOWED_DOMAINS.includes(domain)) {
      errors.push(ERRORS.EMAIL_DOMAIN_NOT_ALLOWED);
      return errors;
    }

    return false;

  },


  /********************************************************************
  Validate a phone number with country code

  @param {String} phone_country - Country code key (e.g., 'in', 'us', 'uk')
  @param {String} phone_number - Phone number (digits only, no country prefix)

  @return {Boolean} false - If validation passes
  @return {Object[]} errors - Array of error objects if validation fails
  *********************************************************************/
  validatePhone: function (phone_country, phone_number) {

    const errors = [];

    // Country required
    if (!phone_country || typeof phone_country !== 'string') {
      errors.push(ERRORS.PHONE_COUNTRY_REQUIRED);
      return errors;
    }

    // Country must be supported
    const country_config = CONFIG.PHONE_COUNTRIES[phone_country.toLowerCase()];
    if (!country_config) {
      errors.push(ERRORS.PHONE_COUNTRY_INVALID);
      return errors;
    }

    // Number required
    if (!phone_number || typeof phone_number !== 'string') {
      errors.push(ERRORS.PHONE_NUMBER_REQUIRED);
      return errors;
    }

    // Sanitize: remove non-digit characters
    const sanitized = phone_number.replace(CONFIG.PHONE_SANITIZE_REGEX, '');

    // Validate length
    if (sanitized.length < country_config.min_length || sanitized.length > country_config.max_length) {
      errors.push(ERRORS.PHONE_NUMBER_INVALID);
      return errors;
    }

    // Validate format (country-specific regex)
    if (!country_config.regex.test(sanitized)) {
      errors.push(ERRORS.PHONE_NUMBER_INVALID);
      return errors;
    }

    return false;

  },


  /********************************************************************
  Validate an optional email (skip if not provided)

  @param {String|undefined} email - Email address (undefined = not provided, skip validation)

  @return {Boolean} false - If validation passes or email not provided
  @return {Object[]} errors - Array of error objects if validation fails
  *********************************************************************/
  validateEmailOptional: function (email) {

    if (email === undefined || email === null) {
      return false;
    }

    return ContactValidation.validateEmail(email);

  },


  /********************************************************************
  Validate an optional phone (skip if not provided)

  @param {String|undefined} phone_country - Country code key
  @param {String|undefined} phone_number - Phone number

  @return {Boolean} false - If validation passes or phone not provided
  @return {Object[]} errors - Array of error objects if validation fails
  *********************************************************************/
  validatePhoneOptional: function (phone_country, phone_number) {

    if (
      (phone_country === undefined || phone_country === null) &&
      (phone_number === undefined || phone_number === null)
    ) {
      return false;
    }

    return ContactValidation.validatePhone(phone_country, phone_number);

  }

};///////////////////////////Public Functions END//////////////////////////////
