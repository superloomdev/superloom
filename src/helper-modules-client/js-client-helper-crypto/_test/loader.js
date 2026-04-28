// Info: Test loader for js-client-helper-crypto
// Mirrors the main project loader pattern: loads dependencies from environment
// process.env is ONLY read here — nowhere else in test code
'use strict';


/********************************************************************
Load all test dependencies, build Lib container

@return {Object} result - Runtime objects for testing
@return {Object} result.Lib - Dependency container (Utils, Debug, Crypto)
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


  // ==================== CLIENT HELPER MODULES ====================== //

  Lib.Crypto = require('@superloomdev/js-client-helper-crypto')(Lib, {});


  // Return runtime objects
  return { Lib };

};
