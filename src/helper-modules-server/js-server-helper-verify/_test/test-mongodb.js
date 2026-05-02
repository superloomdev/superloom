// Info: MongoDB integration test for js-server-helper-verify.
// Requires the mongodb container from docker-compose.yml.
'use strict';

process.env.BACKEND_KIND = 'mongodb';

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


const MongoDB = Lib.MongoDB;
const TEST_COLLECTION = 'verification_codes_mongo';


const buildVerify = function () {
  return VerifyLoader(Lib, {
    STORE: 'mongodb',
    STORE_CONFIG: { collection_name: TEST_COLLECTION, lib_mongodb: MongoDB },
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
  await MongoDB.deleteRecordsByFilter(
    buildInstance(0),
    TEST_COLLECTION,
    { _id: { $exists: true } }
  );
};


before(async function () {

  // Start clean - drop any leftover documents from a prior crashed run
  await MongoDB.deleteRecordsByFilter(
    buildInstance(0),
    TEST_COLLECTION,
    { _id: { $exists: true } }
  );

  const verify = buildVerify();
  const init_result = await verify.initializeStore(buildInstance(0));
  if (init_result.success === false) {
    throw new Error('MongoDB initializeStore failed: ' + JSON.stringify(init_result.error));
  }

});


after(async function () {

  await MongoDB.deleteRecordsByFilter(
    buildInstance(0),
    TEST_COLLECTION,
    { _id: { $exists: true } }
  );
  await MongoDB.close(buildInstance(0));

});


runSharedStoreSuite({
  label: 'mongodb',
  buildVerify: buildVerify,
  buildInstance: buildInstance,
  TEST_ERRORS: TEST_ERRORS,
  cleanupBetweenTests: cleanupBetweenTests
});
