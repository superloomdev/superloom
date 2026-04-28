// Info: Test loader for js-server-helper-mysql.
// Mirrors the main project loader pattern: reads environment variables,
// builds Lib container, returns { Lib, Config }. Same loader works for
// both emulated (Docker MySQL 8) and integration (real database) testing.
'use strict';


/********************************************************************
Load all test dependencies and build the Lib container from environment.

process.env is ONLY read here — never in test.js.

@return {Object} result - Runtime objects for testing
@return {Object} result.Lib - Dependency container (Utils, Debug, Instance, MySQL)
@return {Object} result.Config - Test-wide environment values (admin credentials, etc.)
*********************************************************************/
module.exports = function loader () {

  // ========================= CONFIGURATION ========================= //

  // Test-wide environment config — available to test.js for AdminClient setup
  const Config = {
    mysql_host: process.env.MYSQL_HOST,
    mysql_port: parseInt(process.env.MYSQL_PORT, 10),
    mysql_database: process.env.MYSQL_DATABASE,
    mysql_user: process.env.MYSQL_USER,
    mysql_password: process.env.MYSQL_PASSWORD,
    mysql_root_password: process.env.MYSQL_ROOT_PASSWORD
  };

  // Sub-configs: each helper module receives ONLY its relevant slice
  const config_debug = {
    LOG_LEVEL: 'error'
  };

  const config_mysql = {
    HOST: Config.mysql_host,
    PORT: Config.mysql_port,
    DATABASE: Config.mysql_database,
    USER: Config.mysql_user,
    PASSWORD: Config.mysql_password,
    POOL_MAX: 5
  };


  // ==================== DEPENDENCY CONTAINER ======================= //

  const Lib = {};


  // ==================== HELPER MODULES ============================= //

  Lib.Utils = require('@superloomdev/js-helper-utils')();
  Lib.Debug = require('@superloomdev/js-helper-debug')(Lib, config_debug);
  Lib.Instance = require('@superloomdev/js-server-helper-instance')(Lib, {});


  // ==================== SERVER HELPER MODULES ====================== //

  Lib.MySQL = require('@superloomdev/js-server-helper-sql-mysql')(Lib, config_mysql);


  // Return runtime objects
  return { Lib, Config };

};
