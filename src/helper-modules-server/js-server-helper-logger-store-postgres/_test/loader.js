// Info: Test loader for js-server-helper-logger-store-postgres.
// Builds the Lib container and a minimal ERRORS stub so both Tier 1
// (adapter unit tests, no logger.js) and Tier 3 (full logger lifecycle
// via the store contract suite) can share the same runtime objects.
//
// Requires a running Postgres instance. In CI and local testing this
// is provided by docker-compose.yml managed by the pretest/posttest
// npm scripts.
'use strict';


/********************************************************************
Build the dependency container and a minimal ERRORS catalog.

process.env is ONLY read here - never in test.js.

@return {Object} result
@return {Object} result.Lib    - { Utils, Debug, Crypto, Instance, Postgres }
@return {Object} result.ERRORS - Minimal error catalog (SERVICE_UNAVAILABLE only)
*********************************************************************/
module.exports = function loader () {

  const config_debug = { LOG_LEVEL: 'error' };

  const config_postgres = {
    HOST:     process.env.POSTGRES_HOST,
    PORT:     parseInt(process.env.POSTGRES_PORT, 10),
    DATABASE: process.env.POSTGRES_DATABASE,
    USER:     process.env.POSTGRES_USER,
    PASSWORD: process.env.POSTGRES_PASSWORD,
    POOL_MAX: 5
  };


  // ==================== DEPENDENCY CONTAINER ======================= //

  const Lib = {};


  // ==================== FOUNDATION MODULES ========================= //

  Lib.Utils = require('@superloomdev/js-helper-utils')(Lib, {});
  Lib.Debug = require('@superloomdev/js-helper-debug')(Lib, config_debug);


  // ==================== SERVER HELPER MODULES ====================== //

  Lib.Crypto = require('@superloomdev/js-server-helper-crypto')(Lib, {});
  Lib.Instance = require('@superloomdev/js-server-helper-instance')(Lib, {});
  Lib.Postgres = require('@superloomdev/js-server-helper-sql-postgres')(Lib, config_postgres);


  // ==================== MINIMAL ERRORS CATALOG ===================== //

  const ERRORS = {
    SERVICE_UNAVAILABLE: {
      type: 'SERVICE_UNAVAILABLE',
      message: 'Service unavailable'
    }
  };


  return { Lib: Lib, ERRORS: ERRORS };

};
