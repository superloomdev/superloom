// Info: Test loader for js-server-helper-nosql-mongodb
// Mirrors the main project loader pattern: loads dependencies, merges config from environment
'use strict';


/********************************************************************
Load all test dependencies, build Lib container from environment.

process.env is ONLY read here - nowhere else in test code.

@return {Object} result - Runtime objects for testing
@return {Object} result.Lib - Dependency container (Utils, Debug, Instance, MongoDB)
@return {Object} result.Config - Test-wide environment values for test infrastructure
*********************************************************************/
module.exports = function loader () {

  // ========================= CONFIGURATION ========================= //

  const Config = {
    mongodb_connection_string: process.env.MONGODB_CONNECTION_STRING || 'mongodb://localhost:27017',
    mongodb_database: process.env.MONGODB_DATABASE || 'test_db'
  };

  const config_debug = {
    LOG_LEVEL: 'error'
  };

  const config_mongodb = {
    CONNECTION_STRING: Config.mongodb_connection_string,
    DATABASE_NAME: Config.mongodb_database,
    MAX_POOL_SIZE: 10,
    SERVER_SELECTION_TIMEOUT: 5000
  };


  // ==================== DEPENDENCY CONTAINER ======================= //

  const Lib = {};


  // ==================== HELPER MODULES ============================= //

  Lib.Utils = require('@superloomdev/js-helper-utils')(Lib, {});
  Lib.Debug = require('@superloomdev/js-helper-debug')(Lib, config_debug);
  Lib.Instance = require('@superloomdev/js-server-helper-instance')(Lib, {});


  // ==================== SERVER HELPER MODULES ====================== //

  Lib.MongoDB = require('../mongodb.js')(Lib, config_mongodb);


  // Return runtime objects
  return { Lib, Config };

};
