// Info: Test loader for js-server-helper-aws-dynamodb
// Mirrors the main project loader pattern: loads dependencies, merges config from environment
// Same loader works for both emulated (dev) and integration testing — env vars control the target
'use strict';


/********************************************************************
Load all test dependencies, build Lib container from environment

process.env is ONLY read here — nowhere else in test code.

Config = test-wide environment values, available to test.js for any purpose
  (e.g., AdminClient setup, assertions, debugging). Independent of any module.
config_dynamodb = module-specific config slice, only passed to the DynamoDB module.

@return {Object} result - Runtime objects for testing
@return {Object} result.Lib - Dependency container (Utils, Debug, DynamoDB)
@return {Object} result.Config - Test-wide environment values for test infrastructure
*********************************************************************/
module.exports = function loader () {

  // ========================= CONFIGURATION ========================= //

  // Test-wide environment config — available to test.js for test infrastructure
  // This is NOT a module config. It holds raw env values that test.js may need
  // (e.g., AdminClient credentials, endpoint for table setup/teardown)
  const Config = {
    aws_region: process.env.AWS_REGION,
    aws_access_key_id: process.env.AWS_ACCESS_KEY_ID,
    aws_secret_access_key: process.env.AWS_SECRET_ACCESS_KEY,
    dynamodb_endpoint: process.env.DYNAMODB_ENDPOINT
  };

  // Sub-configs: each helper module receives ONLY its relevant config slice
  // process.env is ONLY read here — nowhere else in test code
  const config_debug = {
    LOG_LEVEL: 'error'
  };

  const config_dynamodb = {
    REGION: process.env.AWS_REGION,
    KEY: process.env.AWS_ACCESS_KEY_ID,
    SECRET: process.env.AWS_SECRET_ACCESS_KEY,
    ENDPOINT: process.env.DYNAMODB_ENDPOINT
  };


  // ==================== DEPENDENCY CONTAINER ======================= //

  const Lib = {};


  // ==================== HELPER MODULES ============================= //

  Lib.Utils = require('@superloomdev/js-helper-utils')(Lib, {});
  Lib.Debug = require('@superloomdev/js-helper-debug')(Lib, config_debug);
  Lib.Instance = require('@superloomdev/js-server-helper-instance')(Lib, {});


  // ==================== SERVER HELPER MODULES ====================== //

  Lib.DynamoDB = require('@superloomdev/js-server-helper-nosql-aws-dynamodb')(Lib, config_dynamodb);


  // Return runtime objects
  return { Lib, Config };

};
