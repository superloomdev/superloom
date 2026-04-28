// Info: Survey Client Data Module - Client-only data transformations
// Adds methods for client-specific metadata and caching
'use strict';


///////////////////////////// Module Exports START /////////////////////////////
module.exports = function (shared_libs, config_module) {

  // Return Public Functions of this module
  return SurveyClientData;

};//////////////////////////// Module Exports END //////////////////////////////



////////////////////////////Public Functions START//////////////////////////////
const SurveyClientData = {

  /********************************************************************
  Add client-only fields to a survey data object

  @param {Object} survey - Base survey data
  @param {Number} last_fetched_at - Timestamp of last fetch
  @param {String} cache_status - Cache status: 'fresh', 'stale', 'miss'

  @return {Object} - Survey data with client fields added
  *********************************************************************/
  addClientFields: function (survey, last_fetched_at, cache_status) {

    return {
      ...survey,
      _last_fetched_at: last_fetched_at,
      _cache_status: cache_status || 'unknown',
      _client_version: 1
    };

  },


  /********************************************************************
  Build a minimal cached version for local storage (stripped of heavy data)

  @param {Object} survey - Full survey data
  @param {Number} cached_at - Timestamp when cached

  @return {Object} - Lightweight cached version
  *********************************************************************/
  toCache: function (survey, cached_at) {

    return {
      id: survey.id || survey.survey_id,
      title: survey.title,
      status: survey.status,
      question_count: survey.questions ? survey.questions.length : 0,
      _cached_at: cached_at,
      _cache_ttl: 5 * 60 * 1000  // 5 minutes
    };

  },


  /********************************************************************
  Check if cached survey is stale based on TTL

  @param {Object} cached_survey - Cached survey with _cached_at
  @param {Number} now - Current timestamp

  @return {Boolean} - True if stale
  *********************************************************************/
  isStale: function (cached_survey, now) {

    if (!cached_survey._cached_at) {
      return true;
    }

    const ttl = cached_survey._cache_ttl || 5 * 60 * 1000;
    return (now - cached_survey._cached_at) > ttl;

  }

};///////////////////////////Public Functions END///////////////////////////////
