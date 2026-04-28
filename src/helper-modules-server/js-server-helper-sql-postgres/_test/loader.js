// Info: Test loader for js-server-helper-postgres.
// Mirrors the main project loader pattern: reads environment variables,
// builds Lib container, returns { Lib, Config }. Same loader works for
// both emulated (Docker Postgres) and integration (real database) testing.
'use strict';


/********************************************************************
Load all test dependencies and build the Lib container from environment.

process.env is ONLY read here — never in test.js.

@return {Object} result - Runtime objects for testing
@return {Object} result.Lib - Dependency container (Utils, Debug, Instance, Postgres)
@return {Object} result.Config - Test-wide environment values (admin credentials, etc.)
*********************************************************************/
module.exports = function loader () {

  // ========================= CONFIGURATION ========================= //

  // Test-wide environment config — available to test.js for AdminClient setup
  const Config = {
    postgres_host: process.env.POSTGRES_HOST,
    postgres_port: parseInt(process.env.POSTGRES_PORT, 10),
    postgres_database: process.env.POSTGRES_DATABASE,
    postgres_user: process.env.POSTGRES_USER,
    postgres_password: process.env.POSTGRES_PASSWORD
  };

  // Sub-configs: each helper module receives ONLY its relevant slice
  const config_debug = {
    LOG_LEVEL: 'error'
  };

  const config_postgres = {
    HOST: Config.postgres_host,
    PORT: Config.postgres_port,
    DATABASE: Config.postgres_database,
    USER: Config.postgres_user,
    PASSWORD: Config.postgres_password,
    POOL_MAX: 5
  };


  // ==================== DEPENDENCY CONTAINER ======================= //

  const Lib = {};


  // ==================== HELPER MODULES ============================= //

  Lib.Utils = require('@superloomdev/js-helper-utils')();
  Lib.Debug = require('@superloomdev/js-helper-debug')(Lib, config_debug);
  Lib.Instance = require('@superloomdev/js-server-helper-instance')(Lib, {});


  // ==================== SERVER HELPER MODULES ====================== //

  Lib.Postgres = require('@superloomdev/js-server-helper-sql-postgres')(Lib, config_postgres);


  // Return runtime objects
  return { Lib, Config };

};
