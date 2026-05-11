// Info: Shared module validation
// Validation functions for shared utilities
'use strict';


// Shared dependencies (injected by loader; avoids passing Lib everywhere)
let Lib = {};
let CONFIG = {};
let ERRORS = {};


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
  return SharedValidation;

};//////////////////////////// Module Exports END //////////////////////////////



///////////////////////////Public Functions START///////////////////////////////
const SharedValidation = {

  /********************************************************************
  Validate date format

  @param {String} iso_date - ISO date string to validate
  @return {Boolean} - True if valid
  *********************************************************************/
  validateDate: function (iso_date) {

    if (!iso_date) {
      return false;
    }
    const date = new Date(iso_date);
    return !isNaN(date.getTime());

  },


  /********************************************************************
  Validate timestamp

  @param {Number} timestamp - Unix timestamp
  @return {Boolean} - True if valid
  *********************************************************************/
  validateTimestamp: function (timestamp) {

    return typeof timestamp === 'number' && timestamp > 0;

  }


};////////////////////////////Public Functions END///////////////////////////////
