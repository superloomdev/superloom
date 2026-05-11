// Info: Survey Server Errors Module - Server-only error catalog
'use strict';


///////////////////////////// Module Exports START /////////////////////////////
module.exports = function () {

  // Return Public Functions of this module
  return SurveyServerErrors;

};//////////////////////////// Module Exports END //////////////////////////////



////////////////////////////Public Functions START//////////////////////////////
const SurveyServerErrors = {

  /********************************************************************
  Server-only error codes not exposed to clients
  *********************************************************************/

  QUOTA_EXCEEDED: {
    code: 'SURVEY_QUOTA_EXCEEDED',
    message: 'Organization has reached maximum number of surveys',
    status: 403
  },

  PUBLISH_NOT_ALLOWED: {
    code: 'SURVEY_PUBLISH_NOT_ALLOWED',
    message: 'Survey cannot be published in its current state',
    status: 400
  },

  ALREADY_PUBLISHED: {
    code: 'SURVEY_ALREADY_PUBLISHED',
    message: 'Survey is already published',
    status: 409
  },

  CLOSE_NOT_ALLOWED: {
    code: 'SURVEY_CLOSE_NOT_ALLOWED',
    message: 'Only published surveys can be closed',
    status: 400
  }

};///////////////////////////Public Functions END///////////////////////////////
