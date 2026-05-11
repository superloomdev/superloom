// Info: Test loader for js-helper-time
// Mirrors the main project loader pattern: loads dependencies from environment
// process.env is ONLY read here — nowhere else in test code
'use strict';


/********************************************************************
Load all test dependencies and build the Lib container from environment.

process.env is ONLY read here — never in test.js.

@return {Object} result - Runtime objects for testing
@return {Object} result.Lib - Dependency container (Utils, Debug, Time)
@return {Object} result.Config - Test-wide environment values (none for this module)
*********************************************************************/
module.exports = function loader () {

  // ========================= CONFIGURATION ========================= //

  // Test-wide environment config — this module has no env-dependent values
  const Config = {};

  // Sub-configs: each helper module receives ONLY its relevant slice
  const config_debug = {
    LOG_LEVEL: 'error'
  };


  // ==================== DEPENDENCY CONTAINER ======================= //

  const Lib = {};


  // ==================== HELPER MODULES ============================= //

  Lib.Utils = require('@superloomdev/js-helper-utils')();
  Lib.Debug = require('@superloomdev/js-helper-debug')(Lib, config_debug);


  // ==================== CORE HELPER MODULES ======================== //

  Lib.Time = require('@superloomdev/js-helper-time')(Lib, {});


  // Return runtime objects
  return { Lib, Config };

};
