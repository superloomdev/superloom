// Info: MongoDB backend integration tests. Uses the shared store suite
// so every backend exercises identical behaviour. Requires the MongoDB
// container from docker-compose.yml to be running on 127.0.0.1:27017.
'use strict';

process.env.BACKEND_KIND = 'mongodb';

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


const MongoDB = Lib.MongoDB;
const TEST_COLLECTION = 'sessions_user_mongo';


const buildAuth = function (overrides) {

  const config = Object.assign({
    STORE: 'mongodb',
    STORE_CONFIG: { collection_name: TEST_COLLECTION, lib_mongodb: MongoDB },
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


const cleanupBetweenTests = async function () {

  const admin_instance = buildInstance(0);
  // deleteRecordsByFilter requires a non-empty filter, so we use a
  // always-true predicate: `{ _id: { $exists: true } }`.
  await MongoDB.deleteRecordsByFilter(
    admin_instance,
    TEST_COLLECTION,
    { _id: { $exists: true } }
  );

};


before(async function () {

  const auth = buildAuth();
  const admin_instance = buildInstance(0);

  // Ensure clean slate on re-runs
  await MongoDB.deleteRecordsByFilter(
    admin_instance,
    TEST_COLLECTION,
    { _id: { $exists: true } }
  );

  const result = await auth.initializeSessionStore(admin_instance);
  if (result.success === false) {
    throw new Error('MongoDB initializeSessionStore failed: ' + JSON.stringify(result.error));
  }

});


after(async function () {

  const admin_instance = buildInstance(0);
  await MongoDB.deleteRecordsByFilter(
    admin_instance,
    TEST_COLLECTION,
    { _id: { $exists: true } }
  );
  await MongoDB.close(admin_instance);

});


runSharedStoreSuite({
  label: 'mongodb',
  buildAuth: buildAuth,
  buildInstance: buildInstance,
  baseCreateOptions: baseCreateOptions,
  TEST_ERRORS: TEST_ERRORS,
  cleanupBetweenTests: cleanupBetweenTests
});
