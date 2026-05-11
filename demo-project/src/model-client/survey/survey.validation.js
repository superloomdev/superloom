// Info: Survey Client Validation Module - Client-side input validation
// Pattern: Standard Module Structure
// Dependencies: Lib.Utils, CONFIG, ERRORS
'use strict';

let Lib;
let CONFIG;
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

  loader(shared_libs, config, errors);

  return SurveyClientValidation;

};//////////////////////////// Module Exports END //////////////////////////////



////////////////////////////Public Functions START//////////////////////////////
const SurveyClientValidation = {

  /********************************************************************
  Validate cache status value

  @param {String} status - Cache status to validate

  @return {Object|null} - Error object or null if valid
  *********************************************************************/
  validateCacheStatus: function (status) {

    const valid_statuses = ['fresh', 'stale', 'miss', 'unknown'];

    if (!status) {
      return null;  // null is valid (means not set)
    }

    if (!valid_statuses.includes(status)) {
      return {
        code: 'INVALID_CACHE_STATUS',
        message: `Cache status must be one of: ${valid_statuses.join(', ')}`
      };
    }

    return null;

  },


  /********************************************************************
  Validate cached survey data before use

  @param {Object} cached - Cached survey object

  @return {Object} - { is_valid, error }
  *********************************************************************/
  validateCachedSurvey: function (cached) {

    if (!cached) {
      return { is_valid: false, error: ERRORS.CACHE_MISS };
    }

    if (!cached._cached_at) {
      return { is_valid: false, error: ERRORS.CACHE_MISS };
    }

    const now = Date.now();
    const age = now - cached._cached_at;

    if (age > CONFIG.CACHE_TTL_MS) {
      return { is_valid: false, error: ERRORS.CACHE_EXPIRED };
    }

    return { is_valid: true, error: null };

  }

};///////////////////////////Public Functions END///////////////////////////////
