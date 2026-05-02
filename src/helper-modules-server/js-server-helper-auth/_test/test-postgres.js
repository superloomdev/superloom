// Info: Postgres backend integration tests. Uses the shared store suite
// so every backend exercises identical behaviour against the same
// expectations. Requires the Postgres container from docker-compose.yml
// to be running on 127.0.0.1:5432.
'use strict';

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


const SqlDB = Lib.Postgres;
const TEST_TABLE = 'sessions_user_pg';


const buildAuth = function (overrides) {

  const config = Object.assign({
    STORE: 'postgres',
    STORE_CONFIG: { table_name: TEST_TABLE, lib_sql: SqlDB },
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
  await SqlDB.write(admin_instance, 'DELETE FROM "' + TEST_TABLE + '"');

};


before(async function () {

  const auth = buildAuth();
  const admin_instance = buildInstance(0);

  // Drop the table first so schema changes land on each run
  await SqlDB.write(admin_instance, 'DROP TABLE IF EXISTS "' + TEST_TABLE + '"');

  const result = await auth.initializeSessionStore(admin_instance);
  if (result.success === false) {
    throw new Error('Postgres initializeSessionStore failed: ' + JSON.stringify(result.error));
  }

});


after(async function () {

  const admin_instance = buildInstance(0);
  await SqlDB.write(admin_instance, 'DROP TABLE IF EXISTS "' + TEST_TABLE + '"');
  await SqlDB.close();

});


runSharedStoreSuite({
  label: 'postgres',
  buildAuth: buildAuth,
  buildInstance: buildInstance,
  baseCreateOptions: baseCreateOptions,
  TEST_ERRORS: TEST_ERRORS,
  cleanupBetweenTests: cleanupBetweenTests
});
