// Info: Test loader for js-server-helper-logger-store-mysql.
'use strict';


/********************************************************************
@return {Object} result
@return {Object} result.Lib    - { Utils, Debug, Crypto, Instance, MySQL }
@return {Object} result.ERRORS - Minimal error catalog (SERVICE_UNAVAILABLE only)
*********************************************************************/
module.exports = function loader () {

  const config_debug = { LOG_LEVEL: 'error' };

  const config_mysql = {
    HOST:     process.env.MYSQL_HOST     || '127.0.0.1',
    PORT:     parseInt(process.env.MYSQL_PORT || '3308', 10),
    DATABASE: process.env.MYSQL_DATABASE || 'test_db',
    USER:     process.env.MYSQL_USER     || 'test_user',
    PASSWORD: process.env.MYSQL_PASSWORD || 'test_pw'
  };


  // ==================== DEPENDENCY CONTAINER ======================= //

  const Lib = {};

  Lib.Utils = require('@superloomdev/js-helper-utils')(Lib, {});
  Lib.Debug = require('@superloomdev/js-helper-debug')(Lib, config_debug);
  Lib.Crypto = require('@superloomdev/js-server-helper-crypto')(Lib, {});
  Lib.Instance = require('@superloomdev/js-server-helper-instance')(Lib, {});
  Lib.MySQL = require('@superloomdev/js-server-helper-sql-mysql')(Lib, config_mysql);


  // ==================== MINIMAL ERRORS CATALOG ===================== //

  const ERRORS = {
    SERVICE_UNAVAILABLE: {
      type: 'SERVICE_UNAVAILABLE',
      message: 'Service unavailable'
    }
  };


  return { Lib: Lib, ERRORS: ERRORS };

};
