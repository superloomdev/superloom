// Info: DynamoDB backend integration tests. Uses the shared store
// suite so every backend exercises identical behaviour. Requires the
// dynamodb-local container from docker-compose.yml on 127.0.0.1:8000.
'use strict';

process.env.BACKEND_KIND = 'dynamodb';

const { before, after } = require('node:test');

const { Lib } = require('./loader-sql')();
const AuthLoader = require('../auth.js');
const runSharedStoreSuite = require('./shared-store-suite');


const TEST_ERRORS = {
  LIMIT_REACHED:        { code: 'T_LIMIT',   status: 429 },
  SESSION_NOT_FOUND:    { code: 'T_NF',      status: 401 },
  SESSION_EXPIRED:      { code: 'T_EXPIRED', status: 401 },
  INVALID_TOKEN:        { code: 'T_INVALID', status: 401 },
  ACTOR_TYPE_MISMATCH:  { code: 'T_MISMATCH', status: 401 },
  SERVICE_UNAVAILABLE:  { code: 'T_SVC',     status: 503 }
};


const DynamoDB = Lib.DynamoDB;
const TEST_TABLE = 'sessions_user_ddb';


const buildAuth = function (overrides) {

  const config = Object.assign({
    STORE: 'dynamodb',
    STORE_CONFIG: { table_name: TEST_TABLE, lib_dynamodb: DynamoDB },
    ACTOR_TYPE: 'user',
    TTL_SECONDS: 3600,
    LAST_ACTIVE_UPDATE_INTERVAL_SECONDS: 600,
    LIMITS: {
      total_max: 5,
      by_form_factor_max: null,
      by_platform_max: null,
      evict_oldest_on_limit: true
    },
    ENABLE_JWT: false,
    COOKIE_PREFIX: 'sl_user_',
    ERRORS: TEST_ERRORS
  }, overrides || {});

  return AuthLoader(Lib, config);

};


const buildInstance = function (time_seconds) {

  const instance = Lib.Instance.initialize();
  if (typeof time_seconds === 'number') {
    instance.time = time_seconds;
    instance.time_ms = time_seconds * 1000;
  }
  return instance;

};


const baseCreateOptions = function (overrides) {

  return Object.assign({
    tenant_id: 'tenant-A',
    actor_id: 'actor1',
    install_id: 'install-X',
    install_platform: 'web',
    install_form_factor: 'desktop',
    client_name: 'Chrome',
    client_version: '120.0',
    client_is_browser: true,
    client_user_agent: 'Mozilla/5.0 ...'
  }, overrides || {});

};


// Fast cleanup - delete table contents by scanning + batch-deleting.
// Since DynamoDB-Local is in-memory, we could drop+recreate the table
// instead, but that pays the provisioning hit (~500ms) per test.
const cleanupBetweenTests = async function () {

  const admin_instance = buildInstance(0);

  const scan = await DynamoDB.scan(admin_instance, TEST_TABLE);
  if (scan.success === false) {
    throw new Error('cleanup scan failed: ' + JSON.stringify(scan.error));
  }

  if (scan.items.length === 0) {
    return;
  }

  const keysByTable = {};
  keysByTable[TEST_TABLE] = scan.items.map(function (item) {
    return { tenant_id: item.tenant_id, session_key: item.session_key };
  });
  await DynamoDB.batchDeleteRecords(admin_instance, keysByTable);

};


before(async function () {

  const auth = buildAuth();
  const admin_instance = buildInstance(0);

  // Wipe any existing table then re-create fresh
  await DynamoDB.deleteTable(admin_instance, TEST_TABLE);

  const result = await auth.initializeSessionStore(admin_instance);
  if (result.success === false) {
    throw new Error('DynamoDB initializeSessionStore failed: ' + JSON.stringify(result.error));
  }

});


after(async function () {

  const admin_instance = buildInstance(0);
  await DynamoDB.deleteTable(admin_instance, TEST_TABLE);

});


runSharedStoreSuite({
  label: 'dynamodb',
  buildAuth: buildAuth,
  buildInstance: buildInstance,
  baseCreateOptions: baseCreateOptions,
  TEST_ERRORS: TEST_ERRORS,
  cleanupBetweenTests: cleanupBetweenTests
});
