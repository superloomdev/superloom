// Info: Shared module data builders
// Data transformation and builder functions for shared utilities
'use strict';


// Shared dependencies (injected by loader; avoids passing Lib everywhere)
let Lib = {};
let CONFIG = {};


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

  // Run module-scope loader (local DI)
  loader(shared_libs, config);

  // Return Public Functions of this module
  return SharedData;

};//////////////////////////// Module Exports END //////////////////////////////



///////////////////////////Public Functions START///////////////////////////////
const SharedData = {

  /********************************************************************
  Create empty data placeholder for shared module
  Shared module primarily provides process functions, minimal data

  @return {Object} - Empty shared data object
  *********************************************************************/
  create: function () {

    return {};

  },


  /********************************************************************
  Convert to public format (no-op for shared)

  @param {Object} data - Internal data shape
  @return {Object} - Public data shape (same for shared)
  *********************************************************************/
  toPublic: function (data) {

    return data;

  }


};////////////////////////////Public Functions END///////////////////////////////
