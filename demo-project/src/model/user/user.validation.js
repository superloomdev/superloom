// Info: Pure validation functions for User entity
// Uses Utils.validateString() for generic string checks (reusable from helper module)
// Uses Contact model for email/phone validation via Lib (demonstrates inter-module reference)
// Returns domain errors from user.errors.js
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
  return UserValidation;

};//////////////////////////// Module Exports END //////////////////////////////



///////////////////////////Public Functions START//////////////////////////////
const UserValidation = {

  /********************************************************************
  Validate data for creating a new User

  @param {Object} data - User data to validate
  @param {String} data.name - User full name
  @param {String} data.email - User email address
  @param {String} [data.phone] - (Optional) User phone number
  @param {String} [data.role] - (Optional) User role

  @return {Boolean} false - If validation passes
  @return {Object[]} errors - Array of error objects if validation fails
  *********************************************************************/
  validateCreate: function (data) {

    let errors = [];

    // Validate name (required) — using Lib.Utils.validateString() for generic string check
    if (!data.name || typeof data.name !== 'string') {
      errors.push(ERRORS.NAME_REQUIRED);
    }
    else if (!Lib.Utils.validateString(data.name.trim(), CONFIG.NAME_MIN_LENGTH, CONFIG.NAME_MAX_LENGTH)) {
      errors.push(ERRORS.NAME_INVALID);
    }

    // Validate email (required) — delegated to Contact model via Lib
    const email_errors = Lib.Contact.validation.validateEmail(data.email);
    if (email_errors) {
      errors = errors.concat(email_errors);
    }

    // Validate phone (optional) — delegated to Contact model via Lib
    if (data.phone_country !== undefined || data.phone_number !== undefined) {
      const phone_errors = Lib.Contact.validation.validatePhoneOptional(data.phone_country, data.phone_number);
      if (phone_errors) {
        errors = errors.concat(phone_errors);
      }
    }

    // Validate role (optional)
    if (data.role !== undefined && data.role !== null) {
      if (!CONFIG.ROLE_VALUES.includes(data.role)) {
        errors.push(ERRORS.ROLE_INVALID);
      }
    }

    // Return errors or false
    return errors.length > 0 ? errors : false;

  },


  /********************************************************************
  Validate data for updating a User

  @param {Object} data - User data to validate
  @param {String} [data.name] - (Optional) Updated name
  @param {String} [data.email] - (Optional) Updated email
  @param {String} [data.phone] - (Optional) Updated phone
  @param {String} [data.status] - (Optional) Updated status

  @return {Boolean} false - If validation passes
  @return {Object[]} errors - Array of error objects if validation fails
  *********************************************************************/
  validateUpdate: function (data) {

    let errors = [];

    // Validate name (if provided) — using Lib.Utils.validateString() for generic string check
    if (data.name !== undefined && data.name !== null) {
      if (!Lib.Utils.validateString(data.name, CONFIG.NAME_MIN_LENGTH, CONFIG.NAME_MAX_LENGTH)) {
        errors.push(ERRORS.NAME_INVALID);
      }
    }

    // Validate email (if provided) — delegated to Contact model via Lib
    const email_errors = Lib.Contact.validation.validateEmailOptional(data.email);
    if (email_errors) {
      errors = errors.concat(email_errors);
    }

    // Validate phone (if provided) — delegated to Contact model via Lib
    const phone_errors = Lib.Contact.validation.validatePhoneOptional(data.phone_country, data.phone_number);
    if (phone_errors) {
      errors = errors.concat(phone_errors);
    }

    // Validate status (if provided)
    if (data.status !== undefined && data.status !== null) {
      if (!CONFIG.STATUS_VALUES.includes(data.status)) {
        errors.push(ERRORS.STATUS_INVALID);
      }
    }

    // Return errors or false
    return errors.length > 0 ? errors : false;

  }

};///////////////////////////Public Functions END//////////////////////////////
