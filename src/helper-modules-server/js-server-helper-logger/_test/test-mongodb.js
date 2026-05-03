// Info: MongoDB integration test for js-server-helper-logger.
// Requires the mongodb container from docker-compose.yml.
'use strict';

process.env.BACKEND_KIND = 'mongodb';

const { before, after } = require('node:test');

const { Lib } = require('./loader-backend')();
const LoggerLoader = require('../logger.js');
const runSharedStoreSuite = require('./shared-store-suite');


const TEST_ERRORS = {
  STORE_READ_FAILED:  { code: 'TEST_SERVICE_UNAVAILABLE', status: 503 },
  STORE_WRITE_FAILED: { code: 'TEST_SERVICE_UNAVAILABLE', status: 503 }
};


const MongoDB = Lib.MongoDB;
const TEST_COLLECTION = 'action_log_mongo';


const buildLogger = function () {
  return LoggerLoader(Lib, {
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

  const logger = buildLogger();
  const init_result = await logger.initializeStore(buildInstance(0));
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
  buildLogger: buildLogger,
  buildInstance: buildInstance,
  cleanupBetweenTests: cleanupBetweenTests
});
