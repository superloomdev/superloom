// Info: Three-tier test suite for js-server-helper-logger-store-mongodb.
//
// Tier 1 - Adapter unit tests (no logger.js dependency):
//   - Store loader rejects bad STORE_CONFIG
//   - setupNewStore creates indexes (idempotent)
//   - addLog round-trip: write then read back via getLogsByEntity
//   - getLogsByEntity returns records most-recent first
//   - getLogsByEntity filters by action array
//   - getLogsByEntity supports cursor pagination
//   - getLogsByActor returns actions by actor
//   - cleanupExpiredLogs deletes only expired documents and returns correct count
//
// Tier 3 - Logger + adapter integration (via store contract suite):
//   Full js-server-helper-logger lifecycle driven against MongoDB.
//
'use strict';

const assert = require('node:assert/strict');
const { describe, it, before, after, afterEach, beforeEach } = require('node:test');

const { Lib, ERRORS } = require('./loader')();
const StoreLoader = require('@superloomdev/js-server-helper-logger-store-mongodb');
const LoggerLoader = require('@superloomdev/js-server-helper-logger');
const runSharedStoreSuite = require('./store-contract-suite');


// ============================================================================
// SHARED FIXTURES
// ============================================================================

const TEST_COLLECTION = 'action_log';

const buildInstance = function (time_seconds) {

  const instance = Lib.Instance.initialize();
  if (typeof time_seconds === 'number') {
    instance.time = time_seconds;
    instance.time_ms = time_seconds * 1000;
  }
  return instance;

};

const buildStore = function (collection) {

  const config = {
    STORE_CONFIG: {
      collection_name: collection || TEST_COLLECTION,
      lib_mongodb: Lib.MongoDB
    }
  };
  return StoreLoader(Lib, config, ERRORS);

};


// ============================================================================
// COLLECTION LIFECYCLE (shared between Tier 1 and Tier 3)
// ============================================================================

// Drop any leftover collection and provision indexes before any tests run.
before(async function () {

  const instance = buildInstance(0);

  // Drop collection to start clean
  await Lib.MongoDB.deleteRecordsByFilter(instance, TEST_COLLECTION, { _id: { $exists: true } });

  // Provision indexes via setupNewStore
  const store = buildStore();
  const result = await store.setupNewStore(instance);
  if (result.success === false) {
    throw new Error('setupNewStore failed: ' + JSON.stringify(result.error));
  }

});


// Drop collection and close connection after all tests are done
after(async function () {

  const instance = buildInstance(0);
  await Lib.MongoDB.deleteRecordsByFilter(instance, TEST_COLLECTION, { _id: { $exists: true } });
  await Lib.MongoDB.close(instance);

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

  it('throws when collection_name is missing', function () {

    assert.throws(
      function () { StoreLoader(Lib, { STORE_CONFIG: { lib_mongodb: Lib.MongoDB } }, ERRORS); },
      /collection_name is required/
    );

  });

  it('throws when lib_mongodb is missing', function () {

    assert.throws(
      function () { StoreLoader(Lib, { STORE_CONFIG: { collection_name: 'x' } }, ERRORS); },
      /lib_mongodb is required/
    );

  });

});


describe('Tier 1: setupNewStore', function () {

  it('is idempotent (can be called twice)', async function () {

    const store = buildStore();
    const instance = buildInstance(0);

    const r1 = await store.setupNewStore(instance);
    assert.equal(r1.success, true);
    assert.equal(r1.error, null);

    const r2 = await store.setupNewStore(instance);
    assert.equal(r2.success, true);
    assert.equal(r2.error, null);

  });

});


describe('Tier 1: addLog and getLogsByEntity round-trip', { concurrency: false }, function () {

  beforeEach(async function () {
    const instance = buildInstance(0);
    await Lib.MongoDB.deleteRecordsByFilter(instance, TEST_COLLECTION, { _id: { $exists: true } });
  });

  it('addLog writes and getLogsByEntity reads back', async function () {

    const store = buildStore();
    const instance = buildInstance(1000);

    const record = makeLogRecord({ entity_id: 'user-1', action: 'user.login', sort_key: '1000-abc' });
    const writeResult = await store.addLog(instance, record);

    assert.equal(writeResult.success, true);
    assert.equal(writeResult.error, null);

    const listResult = await store.getLogsByEntity(instance, {
      scope: '',
      entity_type: 'user',
      entity_id: 'user-1'
    });

    assert.equal(listResult.success, true);
    assert.equal(listResult.records.length, 1);
    assert.equal(listResult.records[0].action, 'user.login');

  });

  it('getLogsByEntity returns records most-recent first', async function () {

    const store = buildStore();
    const instance = buildInstance(2000);

    await store.addLog(instance, makeLogRecord({ entity_id: 'user-2', action: 'action.first', sort_key: '2000-abc' }));
    await store.addLog(instance, makeLogRecord({ entity_id: 'user-2', action: 'action.second', sort_key: '3000-xyz' }));

    const listResult = await store.getLogsByEntity(instance, {
      scope: '',
      entity_type: 'user',
      entity_id: 'user-2'
    });

    assert.equal(listResult.success, true);
    assert.equal(listResult.records.length, 2);
    assert.equal(listResult.records[0].action, 'action.second');
    assert.equal(listResult.records[1].action, 'action.first');

  });

  it('getLogsByEntity filters by action array', async function () {

    const store = buildStore();
    const instance = buildInstance(4000);

    await store.addLog(instance, makeLogRecord({ entity_id: 'user-3', action: 'user.login', sort_key: '4000-a' }));
    await store.addLog(instance, makeLogRecord({ entity_id: 'user-3', action: 'user.logout', sort_key: '4001-b' }));
    await store.addLog(instance, makeLogRecord({ entity_id: 'user-3', action: 'profile.update', sort_key: '4002-c' }));

    const listResult = await store.getLogsByEntity(instance, {
      scope: '',
      entity_type: 'user',
      entity_id: 'user-3',
      actions: ['user.login', 'user.logout']
    });

    assert.equal(listResult.success, true);
    assert.equal(listResult.records.length, 2);

  });

  it('getLogsByEntity supports cursor pagination', async function () {

    const store = buildStore();
    const instance = buildInstance(5000);

    for (let i = 0; i < 5; i++) {
      await store.addLog(instance, makeLogRecord({
        entity_id: 'user-4',
        action: 'action.' + i,
        sort_key: (5000 + i) + '-' + i
      }));
    }

    const page1 = await store.getLogsByEntity(instance, {
      scope: '', entity_type: 'user', entity_id: 'user-4', limit: 2
    });

    assert.equal(page1.success, true);
    assert.equal(page1.records.length, 2);
    assert.ok(page1.next_cursor, 'should have next_cursor');

    const page2 = await store.getLogsByEntity(instance, {
      scope: '', entity_type: 'user', entity_id: 'user-4', limit: 2, cursor: page1.next_cursor
    });

    assert.equal(page2.success, true);
    assert.equal(page2.records.length, 2);
    assert.ok(page2.next_cursor, 'should have next_cursor');

    const page3 = await store.getLogsByEntity(instance, {
      scope: '', entity_type: 'user', entity_id: 'user-4', limit: 2, cursor: page2.next_cursor
    });

    assert.equal(page3.success, true);
    assert.equal(page3.records.length, 1);
    assert.equal(page3.next_cursor, null);

  });

});


describe('Tier 1: getLogsByActor', { concurrency: false }, function () {

  beforeEach(async function () {

    const instance = buildInstance(0);
    await Lib.MongoDB.deleteRecordsByFilter(instance, TEST_COLLECTION, { _id: { $exists: true } });

    const store = buildStore();
    const r1 = await store.addLog(instance, makeLogRecord({ entity_id: 'user-5', actor_id: 'admin-1', action: 'user.delete', sort_key: '6000-a' }));
    const r2 = await store.addLog(instance, makeLogRecord({ entity_id: 'project-1', entity_type: 'project', actor_id: 'admin-1', action: 'project.create', sort_key: '6001-b' }));
    const r3 = await store.addLog(instance, makeLogRecord({ entity_id: 'user-6', actor_id: 'admin-2', action: 'user.create', sort_key: '6002-c' }));

    if (!r1.success || !r2.success || !r3.success) {
      throw new Error('getLogsByActor seed failed: ' + JSON.stringify([r1.error, r2.error, r3.error]));
    }

  });

  it('returns actions by actor, most-recent first', async function () {

    const store = buildStore();
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

    const store = buildStore();
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
    const instance = buildInstance(0);
    await Lib.MongoDB.deleteRecordsByFilter(instance, TEST_COLLECTION, { _id: { $exists: true } });
  });

  it('deletes only expired documents and returns correct count', async function () {

    const store = buildStore();
    const baseTime = 1000000000;
    const instance = buildInstance(baseTime);

    // Persistent (expires_at: null)
    await store.addLog(instance, makeLogRecord({ entity_id: 'u-persist', action: 'a.keep', sort_key: String(baseTime) + '-zzz', expires_at: null }));

    // TTL = expires at baseTime + 60
    await store.addLog(instance, makeLogRecord({ entity_id: 'u-ttl', action: 'a.expire', sort_key: String(baseTime + 1) + '-yyy', expires_at: baseTime + 60 }));

    // Move past expiry
    const future = buildInstance(baseTime + 120);

    const result = await store.cleanupExpiredLogs(future);
    assert.equal(result.success, true);
    assert.equal(result.deleted_count, 1);

    // Persistent record still exists
    const remaining = await store.getLogsByEntity(instance, {
      scope: '', entity_type: 'user', entity_id: 'u-persist'
    });
    assert.equal(remaining.records.length, 1);

  });

  it('returns zero deleted_count when nothing to clean', async function () {

    const store = buildStore();
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
    STORE_CONFIG: { collection_name: TEST_COLLECTION, lib_mongodb: Lib.MongoDB }
  }, overrides || {});

  return LoggerLoader(Lib, config);

};

const cleanupBetweenTests = async function () {

  const instance = buildInstance(0);
  const result = await Lib.MongoDB.deleteRecordsByFilter(instance, TEST_COLLECTION, { _id: { $exists: true } });
  if (result.success === false) {
    throw new Error('cleanup failed: ' + JSON.stringify(result.error));
  }

};


runSharedStoreSuite({
  label: 'mongodb (Tier 3)',
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
