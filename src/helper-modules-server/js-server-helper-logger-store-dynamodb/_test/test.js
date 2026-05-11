// Info: Three-tier test suite for js-server-helper-logger-store-dynamodb.
//
// Tier 1 - Adapter unit tests (no logger.js dependency):
//   - Store loader rejects bad STORE_CONFIG
//   - initialize returns success (DynamoDB table provisioned out-of-band)
//   - addRecord round-trip: write then read back via listByEntity
//   - listByEntity returns records most-recent first
//   - listByEntity filters by action array
//   - listByEntity supports cursor pagination
//   - listByActor returns actions by actor
//   - cleanupExpiredLogs returns 0 (TTL is native for DynamoDB)
//
// Tier 3 - Logger + adapter integration (via store contract suite):
//   Full js-server-helper-logger lifecycle driven against DynamoDB Local.
//   Table is provisioned directly before the suite via Lib.DynamoDB.createTable.
//
'use strict';

const assert = require('node:assert/strict');
const { describe, it, before, after, beforeEach } = require('node:test');

const { Lib, ERRORS } = require('./loader')();
const StoreLoader = require('@superloomdev/js-server-helper-logger-store-dynamodb');
const LoggerLoader = require('@superloomdev/js-server-helper-logger');
const runSharedStoreSuite = require('./store-contract-suite');


// ============================================================================
// SHARED FIXTURES
// ============================================================================

const TEST_TABLE = 'action_log';

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
      lib_dynamodb: Lib.DynamoDB
    }
  };
  return StoreLoader(Lib, config, ERRORS);

};


// ============================================================================
// TABLE LIFECYCLE (shared between Tier 1 and Tier 3)
// ============================================================================

// Provision the DynamoDB table before any tests run. DynamoDB Local is
// in-memory so a single table creation per suite is sufficient.
before(async function () {

  const instance = buildInstance(0);

  // Drop any leftover table from a previous interrupted run
  await Lib.DynamoDB.deleteTable(instance, TEST_TABLE);

  // Create the table with the logger schema
  // pk: for entity lookups, sk: sort_key, actor_pk: for actor lookups (GSI)
  const result = await Lib.DynamoDB.createTable(instance, TEST_TABLE, {
    attribute_definitions: [
      { name: 'pk', type: 'S' },
      { name: 'sort_key', type: 'S' },
      { name: 'actor_pk', type: 'S' }
    ],
    key_schema: [
      { name: 'pk', type: 'HASH' },
      { name: 'sort_key', type: 'RANGE' }
    ],
    global_secondary_indexes: [
      {
        name: 'actor_pk-sort_key-index',
        key_schema: [
          { name: 'actor_pk', type: 'HASH' },
          { name: 'sort_key', type: 'RANGE' }
        ],
        projection: { projection_type: 'ALL' }
      }
    ],
    billing_mode: 'PAY_PER_REQUEST'
  });

  if (result.success === false) {
    throw new Error('DynamoDB.createTable failed: ' + JSON.stringify(result.error));
  }

});


// Drop the table after all tests are done
after(async function () {

  const instance = buildInstance(0);
  await Lib.DynamoDB.deleteTable(instance, TEST_TABLE);

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
      function () { StoreLoader(Lib, { STORE_CONFIG: { lib_dynamodb: Lib.DynamoDB } }, ERRORS); },
      /table_name is required/
    );

  });

  it('throws when lib_dynamodb is missing', function () {

    assert.throws(
      function () { StoreLoader(Lib, { STORE_CONFIG: { table_name: 'x' } }, ERRORS); },
      /lib_dynamodb is required/
    );

  });

});


describe('Tier 1: setupNewStore', function () {

  it('returns success (table provisioned out-of-band)', async function () {

    const store = buildStore();
    const result = await store.setupNewStore(buildInstance(0));

    assert.equal(result.success, true);
    assert.equal(result.error, null);

  });

});


describe('Tier 1: addLog and getLogsByEntity round-trip', { concurrency: false }, function () {

  before(async function () {

    const instance = buildInstance(0);
    // Clear the table between describe blocks
    const scan = await Lib.DynamoDB.scan(instance, TEST_TABLE);
    if (scan.success && scan.items.length > 0) {
      const keysByTable = {};
      keysByTable[TEST_TABLE] = scan.items.map(function (item) {
        return { pk: item.pk, sort_key: item.sort_key };
      });
      await Lib.DynamoDB.batchDeleteRecords(instance, keysByTable);
    }

  });

  it('addLog writes and getLogsByEntity reads back', async function () {

    const store = buildStore();
    const instance = buildInstance(1000);

    const record = makeLogRecord({ scope: 'tenant-A', entity_id: 'user-1', action: 'user.login' });
    const writeResult = await store.addLog(instance, record);

    assert.equal(writeResult.success, true);
    assert.equal(writeResult.error, null);

    const listResult = await store.getLogsByEntity(instance, {
      scope: 'tenant-A',
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

    // Write two records with different sort_keys (time-based)
    await store.addLog(instance, makeLogRecord({ scope: 'tenant-B', entity_id: 'user-2', action: 'action.first', sort_key: '2000-abc' }));
    await store.addLog(instance, makeLogRecord({ scope: 'tenant-B', entity_id: 'user-2', action: 'action.second', sort_key: '3000-xyz' }));

    const listResult = await store.getLogsByEntity(instance, {
      scope: 'tenant-B',
      entity_type: 'user',
      entity_id: 'user-2'
    });

    assert.equal(listResult.success, true);
    assert.equal(listResult.records.length, 2);
    // Most recent first (descending sort_key)
    assert.equal(listResult.records[0].action, 'action.second');
    assert.equal(listResult.records[1].action, 'action.first');

  });

  it('getLogsByEntity filters by action array', async function () {

    const store = buildStore();
    const instance = buildInstance(4000);

    // Write three records
    await store.addLog(instance, makeLogRecord({ scope: 'tenant-C', entity_id: 'user-3', action: 'user.login', sort_key: '4000-a' }));
    await store.addLog(instance, makeLogRecord({ scope: 'tenant-C', entity_id: 'user-3', action: 'user.logout', sort_key: '4001-b' }));
    await store.addLog(instance, makeLogRecord({ scope: 'tenant-C', entity_id: 'user-3', action: 'profile.update', sort_key: '4002-c' }));

    const listResult = await store.getLogsByEntity(instance, {
      scope: 'tenant-C',
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

    // Write 5 records
    for (let i = 0; i < 5; i++) {
      await store.addLog(instance, makeLogRecord({
        scope: 'tenant-D',
        entity_id: 'user-4',
        action: 'action.' + i,
        sort_key: (5000 + i) + '-' + i
      }));
    }

    // Get first page of 2
    const page1 = await store.getLogsByEntity(instance, {
      scope: 'tenant-D',
      entity_type: 'user',
      entity_id: 'user-4',
      limit: 2
    });

    assert.equal(page1.success, true);
    assert.equal(page1.records.length, 2);
    assert.ok(page1.next_cursor, 'should have next_cursor');

    // Get second page
    const page2 = await store.getLogsByEntity(instance, {
      scope: 'tenant-D',
      entity_type: 'user',
      entity_id: 'user-4',
      limit: 2,
      cursor: page1.next_cursor
    });

    assert.equal(page2.success, true);
    assert.equal(page2.records.length, 2);
    assert.ok(page2.next_cursor, 'should have next_cursor');

    // Get final page
    const page3 = await store.getLogsByEntity(instance, {
      scope: 'tenant-D',
      entity_type: 'user',
      entity_id: 'user-4',
      limit: 2,
      cursor: page2.next_cursor
    });

    assert.equal(page3.success, true);
    assert.equal(page3.records.length, 1);
    assert.equal(page3.next_cursor, null);

  });

});


describe('Tier 1: getLogsByActor', { concurrency: false }, function () {

  beforeEach(async function () {

    const instance = buildInstance(0);
    // Clear the table
    const scan = await Lib.DynamoDB.scan(instance, TEST_TABLE);
    if (scan.success && scan.items.length > 0) {
      const keysByTable = {};
      keysByTable[TEST_TABLE] = scan.items.map(function (item) {
        return { pk: item.pk, sort_key: item.sort_key };
      });
      await Lib.DynamoDB.batchDeleteRecords(instance, keysByTable);
    }

    // Seed records for two different actors
    const store = buildStore();
    await store.addLog(instance, makeLogRecord({
      scope: 'tenant-E',
      entity_id: 'user-5',
      actor_id: 'admin-1',
      action: 'user.delete',
      sort_key: '6000-a'
    }));
    await store.addLog(instance, makeLogRecord({
      scope: 'tenant-E',
      entity_id: 'project-1',
      actor_id: 'admin-1',
      action: 'project.create',
      sort_key: '6001-b'
    }));
    await store.addLog(instance, makeLogRecord({
      scope: 'tenant-E',
      entity_id: 'user-6',
      actor_id: 'admin-2',
      action: 'user.create',
      sort_key: '6002-c'
    }));

    // Small delay to allow DynamoDB Local GSI to propagate writes
    await new Promise(function (resolve) { setTimeout(resolve, 200); });

  });

  it('returns actions by actor, most-recent first', async function () {

    const store = buildStore();
    const instance = buildInstance(7000);

    const result = await store.getLogsByActor(instance, {
      scope: 'tenant-E',
      actor_type: 'admin',
      actor_id: 'admin-1'
    });

    assert.equal(result.success, true);
    assert.equal(result.records.length, 2);
    // Most recent first
    assert.equal(result.records[0].action, 'project.create');
    assert.equal(result.records[1].action, 'user.delete');

  });

  it('returns only matching actor records', async function () {

    const store = buildStore();
    const instance = buildInstance(7000);

    const result = await store.getLogsByActor(instance, {
      scope: 'tenant-E',
      actor_type: 'admin',
      actor_id: 'admin-2'
    });

    assert.equal(result.success, true);
    assert.equal(result.records.length, 1);
    assert.equal(result.records[0].action, 'user.create');

  });

});


describe('Tier 1: cleanupExpiredLogs', function () {

  it('returns 0 deleted_count (TTL is native for DynamoDB)', async function () {

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
    STORE_CONFIG: { table_name: TEST_TABLE, lib_dynamodb: Lib.DynamoDB }
  }, overrides || {});

  return LoggerLoader(Lib, config);

};

const cleanupBetweenTests = async function () {

  const instance = buildInstance(0);
  const scan = await Lib.DynamoDB.scan(instance, TEST_TABLE);
  if (scan.success === false) {
    throw new Error('cleanup scan failed: ' + JSON.stringify(scan.error));
  }

  if (scan.items.length === 0) {
    return;
  }

  const keysByTable = {};
  keysByTable[TEST_TABLE] = scan.items.map(function (item) {
    return { pk: item.pk, sort_key: item.sort_key };
  });
  await Lib.DynamoDB.batchDeleteRecords(instance, keysByTable);

};


runSharedStoreSuite({
  label: 'dynamodb (Tier 3)',
  buildLogger: buildLogger,
  buildInstance: buildInstance,
  cleanupBetweenTests: cleanupBetweenTests
});


// ============================================================================
// HELPERS (local to this file)
// ============================================================================

function makeLogRecord(overrides) {

  return Object.assign({
    scope: 'tenant-test',
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
    expires_at: null,
    // DynamoDB-specific computed fields
    pk: (overrides && overrides.scope || 'tenant-test') + '#user#' + (overrides && overrides.entity_id || 'user-test'),
    actor_pk: (overrides && overrides.scope || 'tenant-test') + '#admin#' + (overrides && overrides.actor_id || 'admin-test')
  }, overrides || {});

}

