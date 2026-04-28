// Info: Survey Client Process Module - Client-only business logic
// Pattern: Standard Module Structure
// Dependencies: Lib.Utils, CONFIG
'use strict';

let Lib;
let CONFIG;


/////////////////////////// Module-Loader START ////////////////////////////////

/********************************************************************
  Loader: inject Lib + CONFIG for this module.

  @param {Object} shared_libs - loaded libraries + models (Lib)
  @param {Object} config - domain config for this module
  @return {void}
  *********************************************************************/
const loader = function (shared_libs, config) {

  Lib = shared_libs;
  CONFIG = config;

};

//////////////////////////// Module-Loader END /////////////////////////////////



///////////////////////////// Module Exports START /////////////////////////////
module.exports = function (shared_libs, config) {

  loader(shared_libs, config);

  return SurveyClientProcess;

};//////////////////////////// Module Exports END //////////////////////////////



////////////////////////////Public Functions START//////////////////////////////
const SurveyClientProcess = {

  /********************************************************************
  Calculate time since last fetch in seconds

  @param {Number} last_fetched_at - Timestamp
  @param {Number} now - Current timestamp

  @return {Number} - Seconds since last fetch
  *********************************************************************/
  secondsSinceFetch: function (last_fetched_at, now) {

    if (!last_fetched_at) {
      return Infinity;
    }

    return Math.floor((now - last_fetched_at) / 1000);

  },


  /********************************************************************
  Determine if survey needs refresh based on age and status

  @param {Object} survey - Survey with client metadata
  @param {Number} now - Current timestamp

  @return {Boolean} - True if refresh needed
  *********************************************************************/
  needsRefresh: function (survey, now) {

    if (!survey._last_fetched_at) {
      return true;
    }

    const age_ms = now - survey._last_fetched_at;
    return age_ms > CONFIG.CACHE_TTL_MS;

  },


  /********************************************************************
  Format last fetched time for UI display

  @param {Number} timestamp - Last fetched timestamp

  @return {String} - Human readable string (e.g., "2 minutes ago")
  *********************************************************************/
  formatLastFetched: function (timestamp) {

    if (!timestamp) {
      return 'never';
    }

    const now = Date.now();
    const seconds = Math.floor((now - timestamp) / 1000);

    if (seconds < 60) {
      return 'just now';
    }

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return minutes + ' minute' + (minutes === 1 ? '' : 's') + ' ago';
    }

    const hours = Math.floor(minutes / 60);
    return hours + ' hour' + (hours === 1 ? '' : 's') + ' ago';

  }

};///////////////////////////Public Functions END///////////////////////////////
