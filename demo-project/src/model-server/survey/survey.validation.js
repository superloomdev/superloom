// Info: Survey Server Validation Module - Server-only validation rules
'use strict';


///////////////////////////// Module Exports START /////////////////////////////
module.exports = function (shared_libs, config_module) {

  // Return Public Functions of this module
  return SurveyServerValidation;

};//////////////////////////// Module Exports END //////////////////////////////



////////////////////////////Public Functions START//////////////////////////////
const SurveyServerValidation = {

  /********************************************************************
  Validate publish operation (server-side rules)

  @param {Object} survey - Full survey data
  @param {String} user_id - User attempting to publish

  @return {Object|null} - Error object or null if valid
  *********************************************************************/
  validatePublish: function (survey, user_id) {

    // Placeholder: Check ownership, quotas, etc.
    return null;

  },


  /********************************************************************
  Validate close operation (server-side rules)

  @param {Object} survey - Full survey data

  @return {Object|null} - Error object or null if valid
  *********************************************************************/
  validateClose: function (survey) {

    // Placeholder: Check if survey is published, etc.
    return null;

  }

};///////////////////////////Public Functions END///////////////////////////////
