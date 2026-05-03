// Info: MySQL integration test for js-server-helper-logger.
// Requires the mysql container from docker-compose.yml.
'use strict';

process.env.BACKEND_KIND = 'mysql';

const { before, after } = require('node:test');

const { Lib } = require('./loader-backend')();
const LoggerLoader = require('../logger.js');
const runSharedStoreSuite = require('./shared-store-suite');


const TEST_ERRORS = {
  STORE_READ_FAILED:  { code: 'TEST_SERVICE_UNAVAILABLE', status: 503 },
  STORE_WRITE_FAILED: { code: 'TEST_SERVICE_UNAVAILABLE', status: 503 }
};


const MySQL = Lib.MySQL;
const TEST_TABLE = 'action_log_mysql';


const buildLogger = function () {
  return LoggerLoader(Lib, {
    STORE: 'mysql',
    STORE_CONFIG: { table_name: TEST_TABLE, lib_sql: MySQL },
    ERRORS: TEST_ERRORS
  });
};


const buildInstance = function (time_seconds) {
  const instance = Lib.Instance.initialize();
  if (typeof time_seconds === 'number') {
    instance.time = time_seconds;
    instance.time_ms = time_seconds * 1000;
  }
  return instance;
};


const cleanupBetweenTests = async function () {
  await MySQL.write(buildInstance(0), 'DELETE FROM `' + TEST_TABLE + '`', []);
};


before(async function () {

  const logger = buildLogger();
  const init_result = await logger.initializeStore(buildInstance(0));
  if (init_result.success === false) {
    throw new Error('MySQL initializeStore failed: ' + JSON.stringify(init_result.error));
  }

});


after(async function () {

  await MySQL.write(buildInstance(0), 'DROP TABLE IF EXISTS `' + TEST_TABLE + '`', []);
  await MySQL.close();

});


runSharedStoreSuite({
  label: 'mysql',
  buildLogger: buildLogger,
  buildInstance: buildInstance,
  cleanupBetweenTests: cleanupBetweenTests
});
