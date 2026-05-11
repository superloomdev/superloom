// Info: Test loader for js-server-helper-aws-s3
// Mirrors the main project loader pattern: loads dependencies, merges config from environment
// Same loader works for both emulated (dev) and integration testing — env vars control the target
'use strict';


/********************************************************************
Load all test dependencies, build Lib container from environment

process.env is ONLY read here — nowhere else in test code.

Config = test-wide environment values, available to test.js for any purpose
  (e.g., AdminClient setup, assertions, debugging). Independent of any module.
config_s3 = module-specific config slice, only passed to the S3 module.

@return {Object} result - Runtime objects for testing
@return {Object} result.Lib - Dependency container (Utils, Debug, Instance, S3)
@return {Object} result.Config - Test-wide environment values for test infrastructure
*********************************************************************/
module.exports = function loader () {

  // ========================= CONFIGURATION ========================= //

  // Test-wide environment config — available to test.js for test infrastructure
  // This is NOT a module config. It holds raw env values that test.js may need
  // (e.g., AdminClient credentials, endpoint for bucket setup/teardown)
  const Config = {
    s3_region: process.env.S3_REGION,
    s3_access_key: process.env.S3_ACCESS_KEY,
    s3_secret_key: process.env.S3_SECRET_KEY,
    s3_endpoint: process.env.S3_ENDPOINT,
    s3_force_path_style: process.env.S3_FORCE_PATH_STYLE === 'true'
  };

  // Sub-configs: each helper module receives ONLY its relevant config slice
  // process.env is ONLY read here — nowhere else in test code
  const config_debug = {
    LOG_LEVEL: 'error'
  };

  const config_s3 = {
    REGION: process.env.S3_REGION,
    KEY: process.env.S3_ACCESS_KEY,
    SECRET: process.env.S3_SECRET_KEY,
    ENDPOINT: process.env.S3_ENDPOINT,
    FORCE_PATH_STYLE: process.env.S3_FORCE_PATH_STYLE === 'true'
  };


  // ==================== DEPENDENCY CONTAINER ======================= //

  const Lib = {};


  // ==================== HELPER MODULES ============================= //

  Lib.Utils = require('@superloomdev/js-helper-utils')(Lib, {});
  Lib.Debug = require('@superloomdev/js-helper-debug')(Lib, config_debug);
  Lib.Instance = require('@superloomdev/js-server-helper-instance')(Lib, {});


  // ==================== SERVER HELPER MODULES ====================== //

  Lib.S3 = require('@superloomdev/js-server-helper-storage-aws-s3')(Lib, config_s3);


  // Return runtime objects
  return { Lib, Config };

};
