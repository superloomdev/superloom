// Info: Test loader for js-helper-debug.
// Mirrors the main project loader pattern: builds Lib container and Config.
// process.env is not used — this module has no env-dependent values.
'use strict';


/********************************************************************
Load all test dependencies and build the Lib container.

@return {Object} result - Runtime objects for testing
@return {Object} result.Lib - Dependency container (Debug)
@return {Object} result.Config - Test-wide config values
*********************************************************************/
module.exports = function loader () {

  // Test-wide config — use test-friendly defaults
  const Config = {
    LOG_LEVEL: 'debug',
    LOG_FORMAT: 'text',
    INCLUDE_STACK_TRACE: true,
    INCLUDE_MEMORY_USAGE: true,
    APP_NAME: 'test',
    ENVIRONMENT: 'test'
  };


  // Build Lib container
  const Lib = {};


  // Load Debug instance
  Lib.Debug = require('@superloomdev/js-helper-debug')(Lib, Config);


  // Return runtime objects
  return { Lib, Config };

};
