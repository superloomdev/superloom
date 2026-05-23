// Info: Test loader for js-server-helper-http-gateway. Builds the base Lib
// container (Utils, Debug, Instance) used by all gateway tests.
// No adapter packages are loaded here - tests use the in-process
// memory adapter (memory-adapter.js).
'use strict';


/********************************************************************
Build the dependency container for gateway tests.

No environment variables are read here - the gateway's own tests
use only the in-process memory adapter (memory-adapter.js).

@return {Object} - { Lib }
*********************************************************************/
module.exports = function loader () {

  const config_debug = { LOG_LEVEL: 'error' };


  // ==================== DEPENDENCY CONTAINER ======================= //

  const Lib = {};


  // ==================== FOUNDATION MODULES ========================= //

  Lib.Utils = require('helper-utils')(Lib, {});
  Lib.Debug = require('helper-debug')(Lib, config_debug);


  // ==================== SERVER HELPER MODULES ====================== //

  Lib.Instance = require('helper-instance')(Lib, {});


  return { Lib: Lib };

};
