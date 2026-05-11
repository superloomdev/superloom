// Info: Test loader for js-server-helper-auth-store-mysql.
// Builds the Lib container and a minimal ERRORS stub so both Tier 1
// (adapter unit tests, no auth.js) and Tier 3 (full auth lifecycle
// via the store contract suite) can share the same runtime objects.
//
// MySQL connection settings are read exclusively from environment
// variables here - test.js never reads process.env directly.
'use strict';


/********************************************************************
Build the dependency container and a minimal ERRORS catalog.

process.env is ONLY read here - never in test.js.

@return {Object} result
@return {Object} result.Lib    - { Utils, Debug, Crypto, Instance, MySQL }
@return {Object} result.ERRORS - Minimal error catalog (SERVICE_UNAVAILABLE only)
*********************************************************************/
module.exports = function loader () {

  const config_debug = { LOG_LEVEL: 'error' };

  const config_mysql = {
    HOST:     process.env.MYSQL_HOST     || '127.0.0.1',
    PORT:     parseInt(process.env.MYSQL_PORT || '3307', 10),
    DATABASE: process.env.MYSQL_DATABASE || 'test_db',
    USER:     process.env.MYSQL_USER     || 'test_user',
    PASSWORD: process.env.MYSQL_PASSWORD || 'test_pw'
  };


  // ==================== DEPENDENCY CONTAINER ======================= //

  const Lib = {};


  // ==================== FOUNDATION MODULES ========================= //

  Lib.Utils = require('@superloomdev/js-helper-utils')(Lib, {});
  Lib.Debug = require('@superloomdev/js-helper-debug')(Lib, config_debug);


  // ==================== SERVER HELPER MODULES ====================== //

  Lib.Crypto = require('@superloomdev/js-server-helper-crypto')(Lib, {});
  Lib.Instance = require('@superloomdev/js-server-helper-instance')(Lib, {});
  Lib.MySQL = require('@superloomdev/js-server-helper-sql-mysql')(Lib, config_mysql);


  // ==================== MINIMAL ERRORS CATALOG ===================== //

  // Tier 1 tests call the store loader directly (no auth.js). The
  // store requires only SERVICE_UNAVAILABLE from ERRORS. Tier 3 tests
  // load auth.js which supplies its own full ERRORS catalog internally.
  const ERRORS = {
    SERVICE_UNAVAILABLE: {
      type: 'SERVICE_UNAVAILABLE',
      message: 'Service unavailable'
    }
  };


  return { Lib: Lib, ERRORS: ERRORS };

};
