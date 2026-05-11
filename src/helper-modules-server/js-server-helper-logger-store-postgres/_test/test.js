// Info: Three-tier test suite for js-server-helper-logger-store-postgres.
//
// Tier 1 - Adapter unit tests (no logger.js dependency):
//   - Store loader rejects bad STORE_CONFIG
//   - setupNewStore creates table + indexes (idempotent)
//   - addLog round-trip: write then read back via getLogsByEntity
//   - getLogsByEntity returns records most-recent first
//   - getLogsByEntity filters by action array
//   - getLogsByEntity supports cursor pagination
//   - getLogsByActor returns actions by actor
//   - cleanupExpiredLogs deletes only expired rows and returns correct count
//
// Tier 3 - Logger + adapter integration (via store contract suite):
//   Full js-server-helper-logger lifecycle driven against real Postgres.
'use strict';

const assert = require('node:assert/strict');
const { describe, it, before, beforeEach } = require('node:test');

const { Lib, ERRORS } = require('./loader')();
const StoreLoader = require('@superloomdev/js-server-helper-logger-store-postgres');
const LoggerLoader = require('@superloomdev/js-server-helper-logger');
const runSharedStoreSuite = require('./store-contract-suite');


// ============================================================================
// SHARED FIXTURES
// ============================================================================

const TEST_TABLE = 'action_log';

// Each Tier 1 describe that seeds data uses its own table to prevent concurrent
// describe execution from causing cross-describe state pollution.
const TABLE_ROUNDTRIP = 'logs_t1_roundtrip';
const TABLE_ACTOR     = 'logs_t1_actor';
const TABLE_CLEANUP   = 'logs_t1_cleanup';

const buildInstance = function (time_seconds) {

  const instance = Lib.Instance.initialize();
  if (typeof time_seconds === 'number') {
    instance.time = time_seconds;
    instance.time_ms = time_seconds * 1000;
  }
  return instance;

};

const buildStore = function (table) {

  const config = {
    STORE_CONFIG: {
      table_name: table || TEST_TABLE,
      lib_sql: Lib.Postgres
    }
  };
  return StoreLoader(Lib, config, ERRORS);

};


// ============================================================================
// TABLE LIFECYCLE
// ============================================================================

before(async function () {

  const instance = buildInstance(0);
  // Drop and recreate all tables to start from clean state
  for (const t of [TEST_TABLE, TABLE_ROUNDTRIP, TABLE_ACTOR, TABLE_CLEANUP]) {
    await Lib.Postgres.write(instance, 'DROP TABLE IF EXISTS "' + t + '"', []);
    const store = buildStore(t);
    const result = await store.setupNewStore(instance);
    if (result.success === false) {
      throw new Error('setupNewStore(' + t + ') failed: ' + JSON.stringify(result.error));
    }
  }

});


// ============================================================================
// TIER 1 - ADAPTER UNIT TESTS
// ============================================================================

describe('Tier 1: store loader validation', function () {

  it('throws when STORE_CONFIG is missing', function () {

    assert.throws(
      function () { StoreLoader(Lib, {}, ERRORS); },
      /STORE_CONFIG must be an object/
    );

  });

  it('throws when table_name is missing', function () {

    assert.throws(
      function () { StoreLoader(Lib, { STORE_CONFIG: { lib_sql: Lib.Postgres } }, ERRORS); },
      /table_name is required/
    );

  });

  it('throws when lib_sql is missing', function () {

    assert.throws(
      function () { StoreLoader(Lib, { STORE_CONFIG: { table_name: 'x' } }, ERRORS); },
      /lib_sql is required/
    );

  });

});


describe('Tier 1: setupNewStore', function () {

  it('is idempotent (can be called twice)', async function () {

    const store = buildStore();
    const instance = buildInstance(0);

    const r1 = await store.setupNewStore(instance);
    assert.equal(r1.success, true);

    const r2 = await store.setupNewStore(instance);
    assert.equal(r2.success, true);
    assert.equal(r2.error, null);

  });

});


describe('Tier 1: addLog and getLogsByEntity round-trip', { concurrency: false }, function () {

  it('addLog writes and getLogsByEntity reads back', async function () {

    const store = buildStore(TABLE_ROUNDTRIP);
    const instance = buildInstance(1000);

    const record = makeLogRecord({ entity_id: 'pg-user-1', action: 'user.login', sort_key: '1000-abc' });
    const writeResult = await store.addLog(instance, record);

    assert.equal(writeResult.success, true);
    assert.equal(writeResult.error, null);

    const listResult = await store.getLogsByEntity(instance, {
      scope: '', entity_type: 'user', entity_id: 'pg-user-1'
    });

    assert.equal(listResult.success, true);
    assert.equal(listResult.records.length, 1);
    assert.equal(listResult.records[0].action, 'user.login');

  });


  it('getLogsByEntity returns records most-recent first', async function () {

    const store = buildStore(TABLE_ROUNDTRIP);
    const instance = buildInstance(2000);

    await store.addLog(instance, makeLogRecord({ entity_id: 'pg-user-2', action: 'action.first', sort_key: '2000-abc' }));
    await store.addLog(instance, makeLogRecord({ entity_id: 'pg-user-2', action: 'action.second', sort_key: '3000-xyz' }));

    const listResult = await store.getLogsByEntity(instance, {
      scope: '', entity_type: 'user', entity_id: 'pg-user-2'
    });

    assert.equal(listResult.success, true);
    assert.equal(listResult.records.length, 2);
    assert.equal(listResult.records[0].action, 'action.second');
    assert.equal(listResult.records[1].action, 'action.first');

  });


  it('getLogsByEntity filters by action array', async function () {

    const store = buildStore(TABLE_ROUNDTRIP);
    const instance = buildInstance(4000);

    await store.addLog(instance, makeLogRecord({ entity_id: 'pg-user-3', action: 'user.login', sort_key: '4000-a' }));
    await store.addLog(instance, makeLogRecord({ entity_id: 'pg-user-3', action: 'user.logout', sort_key: '4001-b' }));
    await store.addLog(instance, makeLogRecord({ entity_id: 'pg-user-3', action: 'profile.update', sort_key: '4002-c' }));

    const listResult = await store.getLogsByEntity(instance, {
      scope: '', entity_type: 'user', entity_id: 'pg-user-3',
      actions: ['user.login', 'user.logout']
    });

    assert.equal(listResult.success, true);
    assert.equal(listResult.records.length, 2);

  });


  it('getLogsByEntity supports cursor pagination', async function () {

    const store = buildStore(TABLE_ROUNDTRIP);
    const instance = buildInstance(5000);

    for (let i = 0; i < 5; i++) {
      await store.addLog(instance, makeLogRecord({
        entity_id: 'pg-user-4',
        action: 'action.' + i,
        sort_key: (5000 + i) + '-' + i
      }));
    }

    const page1 = await store.getLogsByEntity(instance, {
      scope: '', entity_type: 'user', entity_id: 'pg-user-4', limit: 2
    });
    assert.equal(page1.success, true);
    assert.equal(page1.records.length, 2);
    assert.ok(page1.next_cursor, 'should have next_cursor');

    const page2 = await store.getLogsByEntity(instance, {
      scope: '', entity_type: 'user', entity_id: 'pg-user-4', limit: 2, cursor: page1.next_cursor
    });
    assert.equal(page2.success, true);
    assert.equal(page2.records.length, 2);
    assert.ok(page2.next_cursor, 'should have next_cursor');

    const page3 = await store.getLogsByEntity(instance, {
      scope: '', entity_type: 'user', entity_id: 'pg-user-4', limit: 2, cursor: page2.next_cursor
    });

    assert.equal(page3.success, true);
    assert.equal(page3.records.length, 1);
    assert.equal(page3.next_cursor, null);

  });

});


describe('Tier 1: getLogsByActor', { concurrency: false }, function () {

  before(async function () {

    const store = buildStore(TABLE_ACTOR);
    const instance = buildInstance(6000);

    await store.addLog(instance, makeLogRecord({ entity_id: 'pg-user-5', actor_id: 'admin-1', action: 'user.delete', sort_key: '6000-a' }));
    await store.addLog(instance, makeLogRecord({ entity_id: 'pg-proj-1', entity_type: 'project', actor_id: 'admin-1', action: 'project.create', sort_key: '6001-b' }));
    await store.addLog(instance, makeLogRecord({ entity_id: 'pg-user-6', actor_id: 'admin-2', action: 'user.create', sort_key: '6002-c' }));

  });

  it('returns actions by actor, most-recent first', async function () {

    const store = buildStore(TABLE_ACTOR);
    const instance = buildInstance(7000);

    const result = await store.getLogsByActor(instance, {
      scope: '', actor_type: 'admin', actor_id: 'admin-1'
    });

    assert.equal(result.success, true);
    assert.equal(result.records.length, 2);
    assert.equal(result.records[0].action, 'project.create');
    assert.equal(result.records[1].action, 'user.delete');

  });


  it('returns only matching actor records', async function () {

    const store = buildStore(TABLE_ACTOR);
    const instance = buildInstance(7000);

    const result = await store.getLogsByActor(instance, {
      scope: '', actor_type: 'admin', actor_id: 'admin-2'
    });

    assert.equal(result.success, true);
    assert.equal(result.records.length, 1);
    assert.equal(result.records[0].action, 'user.create');

  });

});


describe('Tier 1: cleanupExpiredLogs', { concurrency: false }, function () {

  beforeEach(async function () {
    await Lib.Postgres.write(buildInstance(0), 'DELETE FROM "' + TABLE_CLEANUP + '"', []);
  });

  it('deletes only expired rows and returns correct count', async function () {

    const store = buildStore(TABLE_CLEANUP);
    const baseTime = 1000000000;
    const instance = buildInstance(baseTime);

    await store.addLog(instance, makeLogRecord({ entity_id: 'pg-persist', action: 'a.keep', sort_key: String(baseTime) + '-zzz', expires_at: null }));
    await store.addLog(instance, makeLogRecord({ entity_id: 'pg-ttl', action: 'a.expire', sort_key: String(baseTime + 1) + '-yyy', expires_at: baseTime + 60 }));

    const result = await store.cleanupExpiredLogs(instance);
    assert.equal(result.success, true);
    assert.equal(result.deleted_count, 1);

    const remaining = await store.getLogsByEntity(instance, {
      scope: '', entity_type: 'user', entity_id: 'pg-persist'
    });
    assert.equal(remaining.records.length, 1);

  });


  it('returns zero deleted_count when nothing to clean', async function () {

    const store = buildStore(TABLE_CLEANUP);
    const instance = buildInstance(8000);

    const result = await store.cleanupExpiredLogs(instance);
    assert.equal(result.success, true);
    assert.equal(result.deleted_count, 0);
    assert.equal(result.error, null);

  });

});


// ============================================================================
// TIER 3 - LOGGER + ADAPTER INTEGRATION
// ============================================================================

const buildLogger = function (overrides) {

  const config = Object.assign({
    STORE: StoreLoader,
    STORE_CONFIG: { table_name: TEST_TABLE, lib_sql: Lib.Postgres }
  }, overrides || {});

  return LoggerLoader(Lib, config);

};

const cleanupBetweenTests = async function () {

  const instance = buildInstance(0);
  await Lib.Postgres.write(instance, 'DELETE FROM "' + TEST_TABLE + '"', []);

};


runSharedStoreSuite({
  label: 'postgres (Tier 3)',
  buildLogger: buildLogger,
  buildInstance: buildInstance,
  cleanupBetweenTests: cleanupBetweenTests
});


// ============================================================================
// HELPERS (local to this file)
// ============================================================================

function makeLogRecord (overrides) {

  return Object.assign({
    scope: '',
    entity_type: 'user',
    entity_id: 'user-test',
    actor_type: 'admin',
    actor_id: 'admin-test',
    action: 'test.action',
    data: null,
    ip: null,
    user_agent: null,
    created_at: 1000,
    created_at_ms: 1000000,
    sort_key: '1000-abc',
    expires_at: null
  }, overrides || {});

}
