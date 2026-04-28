// Info: Test loader for js-server-helper-verify
// Mirrors the main project loader pattern. The verify module under test is
// NOT loaded here - tests construct it per-case with their own STORE adapter
// so each test owns isolated state.
'use strict';


/********************************************************************
Load all peer dependencies and build the Lib container. The verify
module itself is constructed inside test.js with a per-test in-memory
adapter so tests stay independent.

@return {Object} result - Runtime objects for testing
@return {Object} result.Lib - Dependency container (Utils, Debug, Crypto, Instance)
*********************************************************************/
module.exports = function loader () {

  // ========================= CONFIGURATION ========================= //

  // Sub-configs: each helper module receives ONLY its relevant config slice
  const config_debug = {
    LOG_LEVEL: 'error'
  };


  // ==================== DEPENDENCY CONTAINER ======================= //

  const Lib = {};


  // ==================== HELPER MODULES ============================= //

  Lib.Utils = require('@superloomdev/js-helper-utils')(Lib, {});
  Lib.Debug = require('@superloomdev/js-helper-debug')(Lib, config_debug);


  // ==================== SERVER HELPER MODULES ====================== //

  Lib.Crypto = require('@superloomdev/js-server-helper-crypto')(Lib, {});
  Lib.Instance = require('@superloomdev/js-server-helper-instance')(Lib, {});


  // Return runtime objects
  return { Lib };

};
