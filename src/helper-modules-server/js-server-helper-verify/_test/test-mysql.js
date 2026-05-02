// Info: MySQL integration test for js-server-helper-verify.
// Requires the mysql container from docker-compose.yml.
'use strict';

process.env.BACKEND_KIND = 'mysql';

const { before, after } = require('node:test');

const { Lib } = require('./loader-backend')();
const VerifyLoader = require('../verify.js');
const runSharedStoreSuite = require('./shared-store-suite');


const TEST_ERRORS = {
  COOLDOWN_ACTIVE:    { code: 'TEST_OTP_COOLDOWN_ACTIVE',    status: 429 },
  NOT_FOUND:          { code: 'TEST_OTP_NOT_FOUND',          status: 400 },
  EXPIRED:            { code: 'TEST_OTP_EXPIRED',            status: 400 },
  MAX_FAILS:          { code: 'TEST_OTP_LOCKED',             status: 429 },
  WRONG_VALUE:        { code: 'TEST_OTP_WRONG_VALUE',        status: 400 },
  STORE_READ_FAILED:  { code: 'TEST_SERVICE_UNAVAILABLE',    status: 503 },
  STORE_WRITE_FAILED: { code: 'TEST_SERVICE_UNAVAILABLE',    status: 503 }
};


const MySQL = Lib.MySQL;
const TEST_TABLE = 'verification_codes_my';


const buildVerify = function () {
  return VerifyLoader(Lib, {
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

  const verify = buildVerify();
  const init_result = await verify.initializeStore(buildInstance(0));
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
  buildVerify: buildVerify,
  buildInstance: buildInstance,
  TEST_ERRORS: TEST_ERRORS,
  cleanupBetweenTests: cleanupBetweenTests
});
