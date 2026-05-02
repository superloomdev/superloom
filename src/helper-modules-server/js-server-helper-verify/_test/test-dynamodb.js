// Info: DynamoDB integration test for js-server-helper-verify.
// Requires the dynamodb-local container from docker-compose.yml.
'use strict';

process.env.BACKEND_KIND = 'dynamodb';

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


const DynamoDB = Lib.DynamoDB;
const TEST_TABLE = 'verification_codes_ddb';


const buildVerify = function () {
  return VerifyLoader(Lib, {
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


// DynamoDB-Local is in-memory so dropping + recreating the table is fast,
// but the cleanest cross-test cleanup is to scan + batch-delete the rows.
const cleanupBetweenTests = async function () {

  const instance = buildInstance(0);
  const scan = await DynamoDB.scan(instance, TEST_TABLE);
  if (scan.success === false || scan.items.length === 0) {
    return;
  }

  const keysByTable = {};
  keysByTable[TEST_TABLE] = scan.items.map(function (item) {
    return { scope: item.scope, id: item.id };
  });
  await DynamoDB.batchDeleteRecords(instance, keysByTable);

};


before(async function () {

  // Wipe any leftover table then recreate fresh via the store's initialize hook
  await DynamoDB.deleteTable(buildInstance(0), TEST_TABLE);

  const verify = buildVerify();
  const init_result = await verify.initializeStore(buildInstance(0));
  if (init_result.success === false) {
    throw new Error('DynamoDB initializeStore failed: ' + JSON.stringify(init_result.error));
  }

});


after(async function () {
  await DynamoDB.deleteTable(buildInstance(0), TEST_TABLE);
});


runSharedStoreSuite({
  label: 'dynamodb',
  buildVerify: buildVerify,
  buildInstance: buildInstance,
  TEST_ERRORS: TEST_ERRORS,
  cleanupBetweenTests: cleanupBetweenTests
});
