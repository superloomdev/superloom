// Info: Test loader for js-server-helper-logger-store-sqlite.
// Builds the Lib container and a minimal ERRORS stub so both Tier 1
// (adapter unit tests, no logger.js) and Tier 3 (full logger lifecycle
// via the store contract suite) can share the same runtime objects.
//
// SQLite is offline - no Docker, no network. SQLITE_FILE defaults to
// :memory: so tests always start from a clean state.
'use strict';


/********************************************************************
Build the dependency container and a minimal ERRORS catalog.

process.env is ONLY read here - never in test.js.

@return {Object} result
@return {Object} result.Lib    - { Utils, Debug, Crypto, Instance, SQLite }
@return {Object} result.ERRORS - Minimal error catalog (SERVICE_UNAVAILABLE only)
*********************************************************************/
module.exports = function loader () {

  const config_debug = { LOG_LEVEL: 'error' };

  const config_sqlite = {
    FILE: process.env.SQLITE_FILE || ':memory:'
  };


  // ==================== DEPENDENCY CONTAINER ======================= //

  const Lib = {};


  // ==================== FOUNDATION MODULES ========================= //

  Lib.Utils = require('@superloomdev/js-helper-utils')(Lib, {});
  Lib.Debug = require('@superloomdev/js-helper-debug')(Lib, config_debug);


  // ==================== SERVER HELPER MODULES ====================== //

  Lib.Crypto = require('@superloomdev/js-server-helper-crypto')(Lib, {});
  Lib.Instance = require('@superloomdev/js-server-helper-instance')(Lib, {});
  Lib.SQLite = require('@superloomdev/js-server-helper-sql-sqlite')(Lib, config_sqlite);


  // ==================== MINIMAL ERRORS CATALOG ===================== //

  // Tier 1 tests call the store loader directly (no logger.js). The
  // store requires only SERVICE_UNAVAILABLE from ERRORS. Tier 3 tests
  // load logger.js which supplies its own full ERRORS catalog internally.
  const ERRORS = {
    SERVICE_UNAVAILABLE: {
      type: 'SERVICE_UNAVAILABLE',
      message: 'Service unavailable'
    }
  };


  return { Lib: Lib, ERRORS: ERRORS };

};
