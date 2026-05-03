// Info: DynamoDB integration test for js-server-helper-logger.
// Requires the dynamodb-local container from docker-compose.yml.
'use strict';

process.env.BACKEND_KIND = 'dynamodb';

const { before, after } = require('node:test');

const { Lib } = require('./loader-backend')();
const LoggerLoader = require('../logger.js');
const runSharedStoreSuite = require('./shared-store-suite');


const TEST_ERRORS = {
  STORE_READ_FAILED:  { code: 'TEST_SERVICE_UNAVAILABLE', status: 503 },
  STORE_WRITE_FAILED: { code: 'TEST_SERVICE_UNAVAILABLE', status: 503 }
};


const DynamoDB = Lib.DynamoDB;
const TEST_TABLE = 'action_log_ddb';


const buildLogger = function () {
  return LoggerLoader(Lib, {
    STORE: 'dynamodb',
    STORE_CONFIG: { table_name: TEST_TABLE, lib_dynamodb: DynamoDB },
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


// Scan + batch-delete is the cleanest cross-test reset on DynamoDB Local.
const cleanupBetweenTests = async function () {

  const instance = buildInstance(0);
  const scan = await DynamoDB.scan(instance, TEST_TABLE);
  if (scan.success === false || scan.items.length === 0) {
    return;
  }

  const keysByTable = {};
  keysByTable[TEST_TABLE] = scan.items.map(function (item) {
    return { entity_pk: item.entity_pk, sort_key: item.sort_key };
  });
  await DynamoDB.batchDeleteRecords(instance, keysByTable);

};


before(async function () {

  // Wipe any leftover table then recreate fresh via the store's initialize hook
  await DynamoDB.deleteTable(buildInstance(0), TEST_TABLE);

  const logger = buildLogger();
  const init_result = await logger.initializeStore(buildInstance(0));
  if (init_result.success === false) {
    throw new Error('DynamoDB initializeStore failed: ' + JSON.stringify(init_result.error));
  }

});


after(async function () {
  await DynamoDB.deleteTable(buildInstance(0), TEST_TABLE);
});


runSharedStoreSuite({
  label: 'dynamodb',
  buildLogger: buildLogger,
  buildInstance: buildInstance,
  cleanupBetweenTests: cleanupBetweenTests
});
