// Info: Test loader for js-server-helper-http
// Mirrors the main project loader pattern: loads dependencies from environment
// process.env is ONLY read here — nowhere else in test code
'use strict';


/********************************************************************
Load all test dependencies, build Lib container

@return {Object} result - Runtime objects for testing
@return {Object} result.Lib - Dependency container (Utils, Debug, Http)
*********************************************************************/
module.exports = function loader () {

  // ========================= CONFIGURATION ========================= //

  const config_debug = {
    LOG_LEVEL: 'error'
  };


  // ==================== DEPENDENCY CONTAINER ======================= //

  const Lib = {};


  // ==================== HELPER MODULES ============================= //

  Lib.Utils = require('@superloomdev/js-helper-utils')(Lib, {});
  Lib.Debug = require('@superloomdev/js-helper-debug')(Lib, config_debug);


  // ==================== SERVER HELPER MODULES ====================== //

  Lib.Http = require('@superloomdev/js-server-helper-http')(Lib, {});


  // Return runtime objects
  return { Lib };

};
