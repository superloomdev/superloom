// Info: Survey Server Data Module - Server-only data transformations
// Adds methods to base data module for server-specific operations
'use strict';


///////////////////////////// Module Exports START /////////////////////////////
module.exports = function (shared_libs, config_module) {

  // Return Public Functions of this module
  return SurveyServerData;

};//////////////////////////// Module Exports END //////////////////////////////



////////////////////////////Public Functions START//////////////////////////////
const SurveyServerData = {

  /********************************************************************
  Extend a survey data object with server-only fields

  @param {Object} survey - Base survey data
  @param {String} created_by - User ID who created this survey
  @param {String|null} organization_id - Organization ID (for multi-tenant)

  @return {Object} - Survey data with server-only fields added
  *********************************************************************/
  addServerFields: function (survey, created_by, organization_id) {

    // Return
    return {
      ...survey,
      created_by: created_by,
      organization_id: organization_id || null,
      response_count: 0,
      is_published: false,
      published_at: null,
      closed_at: null,
      internal_notes: null,
      version: 1
    };

  },


  /********************************************************************
  Build a server-only update shape with audit fields

  @param {Object} base_update - Base update shape
  @param {String} updated_by - User ID who performed the update

  @return {Object} - Update shape with server audit fields
  *********************************************************************/
  addServerUpdateFields: function (base_update, updated_by) {

    // Return
    return {
      ...base_update,
      updated_by: updated_by,
      version_increment: true
    };

  },


  /********************************************************************
  Build a server-only output data object (includes fields not sent to public clients)

  @param {String} id - Survey ID
  @param {Object} survey - Full survey data from database
  @param {Number} response_count - Number of responses
  @param {Boolean} is_published - Published status
  @param {String|null} published_at - ISO timestamp of publication
  @param {String|null} closed_at - ISO timestamp of closure
  @param {String} organization_id - Organization ID
  @param {String} internal_notes - Admin-only notes

  @return {Object} - Internal server-only data object
  *********************************************************************/
  toInternal: function (
    id,
    survey,
    response_count,
    is_published,
    published_at,
    closed_at,
    organization_id,
    internal_notes
  ) {

    // Return
    return {
      id: id,
      ...survey,
      response_count: response_count,
      is_published: is_published,
      published_at: published_at,
      closed_at: closed_at,
      organization_id: organization_id,
      internal_notes: internal_notes
    };

  }

};///////////////////////////Public Functions END///////////////////////////////
