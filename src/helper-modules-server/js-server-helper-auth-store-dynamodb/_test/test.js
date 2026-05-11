// Info: Three-tier test suite for js-server-helper-auth-store-dynamodb.
//
// Tier 1 - Adapter unit tests (no auth.js dependency):
//   - Store loader rejects bad STORE_CONFIG
//   - setupNewStore returns NOT_IMPLEMENTED (table must be provisioned out-of-band)
//   - updateSessionActivity throws TypeError on identity fields
//   - updateSessionActivity empty-updates is a no-op success
//   - deleteSessions with empty keys is a no-op success
//   - session round-trip: setSession / getSession / hash guard
//   - listSessionsByActor returns only matching actor's sessions
//   - deleteSession removes the row; other actor unaffected
//   - cleanupExpiredSessions deletes only past-expires_at rows
//
// Tier 3 - Auth + adapter integration (via store contract suite):
//   Full js-server-helper-auth lifecycle driven against DynamoDB Local.
//   Table is provisioned directly before the suite via Lib.DynamoDB.createTable
//   (setupNewStore() is not yet implemented for this backend).
'use strict';

const assert = require('node:assert/strict');
const { describe, it, before, after } = require('node:test');

const { Lib, ERRORS } = require('./loader')();
const StoreLoader = require('@superloomdev/js-server-helper-auth-store-dynamodb');
const AuthLoader = require('@superloomdev/js-server-helper-auth');
const runSharedStoreSuite = require('./store-contract-suite');


// ============================================================================
// SHARED FIXTURES
// ============================================================================

const TEST_TABLE = 'sessions_user';

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

  // Create the table with the auth composite key schema
  const result = await Lib.DynamoDB.createTable(instance, TEST_TABLE, {
    attribute_definitions: [
      { name: 'tenant_id',   type: 'S' },
      { name: 'session_key', type: 'S' }
    ],
    key_schema: [
      { name: 'tenant_id',   type: 'HASH' },
      { name: 'session_key', type: 'RANGE' }
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
// TIER 1 — ADAPTER UNIT TESTS
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


describe('Tier 1: setupNewStore returns NOT_IMPLEMENTED', function () {

  it('setupNewStore returns success:false with NOT_IMPLEMENTED error type', async function () {

    const store = buildStore();
    const result = await store.setupNewStore(buildInstance(0));

    assert.equal(result.success, false);
    assert.equal(result.error.type, 'NOT_IMPLEMENTED');
    assert.ok(result.error.message.includes('not yet implemented'));

  });

});


describe('Tier 1: updateSessionActivity guards', { concurrency: false }, function () {

  before(async function () {

    // Seed one row for the guard tests
    const store = buildStore();
    await store.setSession(buildInstance(1000), makeRecord({ token_key: 'guardkey' }));

  });

  it('throws TypeError when trying to overwrite tenant_id', async function () {

    const store = buildStore();
    await assert.rejects(
      store.updateSessionActivity(buildInstance(1000), 'tenant-A', 'actor1', 'guardkey', {
        tenant_id: 'evil'
      }),
      TypeError
    );

  });

  it('throws TypeError when trying to overwrite token_secret_hash', async function () {

    const store = buildStore();
    await assert.rejects(
      store.updateSessionActivity(buildInstance(1000), 'tenant-A', 'actor1', 'guardkey', {
        token_secret_hash: 'evil'
      }),
      TypeError
    );

  });

  it('throws TypeError when trying to overwrite session_key (DynamoDB SK)', async function () {

    const store = buildStore();
    await assert.rejects(
      store.updateSessionActivity(buildInstance(1000), 'tenant-A', 'actor1', 'guardkey', {
        session_key: 'actor1#bad'
      }),
      TypeError
    );

  });

  it('empty updates is a no-op success (no round-trip)', async function () {

    const store = buildStore();
    const result = await store.updateSessionActivity(
      buildInstance(1000), 'tenant-A', 'actor1', 'guardkey', {}
    );
    assert.equal(result.success, true);
    assert.equal(result.error, null);

  });

  it('allows updating last_active_at and expires_at', async function () {

    const store = buildStore();
    const result = await store.updateSessionActivity(
      buildInstance(1500), 'tenant-A', 'actor1', 'guardkey',
      { last_active_at: 1500, expires_at: 9999 }
    );
    assert.equal(result.success, true);

  });

});


describe('Tier 1: session round-trip and hash guard', { concurrency: false }, function () {

  before(async function () {

    const instance = buildInstance(0);
    // Clear the table between Tier 1 describe blocks
    const scan = await Lib.DynamoDB.scan(instance, TEST_TABLE);
    if (scan.success && scan.items.length > 0) {
      const keysByTable = {};
      keysByTable[TEST_TABLE] = scan.items.map(function (item) {
        return { tenant_id: item.tenant_id, session_key: item.session_key };
      });
      await Lib.DynamoDB.batchDeleteRecords(instance, keysByTable);
    }

  });

  it('setSession + getSession returns the canonical record', async function () {

    const store = buildStore();
    const record = makeRecord({ token_key: 'rk1' });
    await store.setSession(buildInstance(1000), record);

    const result = await store.getSession(
      buildInstance(1000),
      record.tenant_id, record.actor_id, record.token_key, record.token_secret_hash
    );
    assert.equal(result.success, true);
    assert.ok(result.record !== null);
    assert.equal(result.record.token_key, 'rk1');
    assert.equal(result.record.actor_id, 'actor1');

  });

  it('getSession returns null on wrong hash (no timing leak)', async function () {

    const store = buildStore();
    const result = await store.getSession(
      buildInstance(1000), 'tenant-A', 'actor1', 'rk1', 'WRONG_HASH'
    );
    assert.equal(result.success, true);
    assert.equal(result.record, null);

  });

  it('getSession returns null for a key that does not exist', async function () {

    const store = buildStore();
    const result = await store.getSession(
      buildInstance(1000), 'tenant-A', 'actor1', 'no-such-key', 'any-hash'
    );
    assert.equal(result.success, true);
    assert.equal(result.record, null);

  });

  it('session_key attribute is stripped from the returned record', async function () {

    const store = buildStore();
    const record = makeRecord({ token_key: 'rk1' });
    const result = await store.getSession(
      buildInstance(1000),
      record.tenant_id, record.actor_id, record.token_key, record.token_secret_hash
    );
    assert.ok(!Object.prototype.hasOwnProperty.call(result.record, 'session_key'));

  });

  it('custom_data round-trips as a native DynamoDB object (no JSON envelope)', async function () {

    const store = buildStore();
    const custom = { x: 1, arr: [1, 2], nested: { ok: true } };
    const record = makeRecord({ token_key: 'rk2', custom_data: custom });
    await store.setSession(buildInstance(1000), record);

    const result = await store.getSession(
      buildInstance(1000),
      record.tenant_id, record.actor_id, record.token_key, record.token_secret_hash
    );
    assert.deepEqual(result.record.custom_data, custom);

  });

});


describe('Tier 1: listSessionsByActor isolation', { concurrency: false }, function () {

  before(async function () {

    const instance = buildInstance(0);
    const scan = await Lib.DynamoDB.scan(instance, TEST_TABLE);
    if (scan.success && scan.items.length > 0) {
      const keysByTable = {};
      keysByTable[TEST_TABLE] = scan.items.map(function (item) {
        return { tenant_id: item.tenant_id, session_key: item.session_key };
      });
      await Lib.DynamoDB.batchDeleteRecords(instance, keysByTable);
    }

    // Seed 3 sessions for actor1, 2 for actor2
    const store = buildStore();
    await store.setSession(buildInstance(1000), makeRecord({ actor_id: 'actor1', token_key: 'a1k1' }));
    await store.setSession(buildInstance(1000), makeRecord({ actor_id: 'actor1', token_key: 'a1k2' }));
    await store.setSession(buildInstance(1000), makeRecord({ actor_id: 'actor1', token_key: 'a1k3' }));
    await store.setSession(buildInstance(1000), makeRecord({ actor_id: 'actor2', token_key: 'a2k1' }));
    await store.setSession(buildInstance(1000), makeRecord({ actor_id: 'actor2', token_key: 'a2k2' }));

  });

  it('listSessionsByActor returns exactly the matching actor sessions', async function () {

    const store = buildStore();
    const r1 = await store.listSessionsByActor(buildInstance(1000), 'tenant-A', 'actor1');
    const r2 = await store.listSessionsByActor(buildInstance(1000), 'tenant-A', 'actor2');

    assert.equal(r1.records.length, 3);
    assert.equal(r2.records.length, 2);

  });

  it('deleteSession removes exactly one row, other actor unaffected', async function () {

    const store = buildStore();
    await store.deleteSession(buildInstance(1000), 'tenant-A', 'actor1', 'a1k1');

    const r1 = await store.listSessionsByActor(buildInstance(1000), 'tenant-A', 'actor1');
    const r2 = await store.listSessionsByActor(buildInstance(1000), 'tenant-A', 'actor2');
    assert.equal(r1.records.length, 2);
    assert.equal(r2.records.length, 2);

  });

  it('deleteSessions with empty array is a no-op success', async function () {

    const store = buildStore();
    const result = await store.deleteSessions(buildInstance(1000), 'tenant-A', []);
    assert.equal(result.success, true);
    assert.equal(result.error, null);

  });

  it('deleteSessions removes multiple keys in one batch call', async function () {

    const store = buildStore();
    await store.deleteSessions(buildInstance(1000), 'tenant-A', [
      { actor_id: 'actor1', token_key: 'a1k2' },
      { actor_id: 'actor1', token_key: 'a1k3' }
    ]);

    const r1 = await store.listSessionsByActor(buildInstance(1000), 'tenant-A', 'actor1');
    assert.equal(r1.records.length, 0);

  });

});


describe('Tier 1: cleanupExpiredSessions', { concurrency: false }, function () {

  before(async function () {

    const instance = buildInstance(0);
    const scan = await Lib.DynamoDB.scan(instance, TEST_TABLE);
    if (scan.success && scan.items.length > 0) {
      const keysByTable = {};
      keysByTable[TEST_TABLE] = scan.items.map(function (item) {
        return { tenant_id: item.tenant_id, session_key: item.session_key };
      });
      await Lib.DynamoDB.batchDeleteRecords(instance, keysByTable);
    }

  });

  it('deleted_count is 0 on empty table', async function () {

    const store = buildStore();
    const result = await store.cleanupExpiredSessions(buildInstance(99999));
    assert.equal(result.success, true);
    assert.equal(result.deleted_count, 0);

  });

  it('deletes only rows past expires_at and returns accurate deleted_count', async function () {

    const store = buildStore();
    await store.setSession(buildInstance(100), makeRecord({ token_key: 'exp1', expires_at: 500 }));
    await store.setSession(buildInstance(100), makeRecord({ token_key: 'exp2', expires_at: 600 }));
    await store.setSession(buildInstance(100), makeRecord({ token_key: 'live', expires_at: 99999 }));

    const result = await store.cleanupExpiredSessions(buildInstance(700));
    assert.equal(result.success, true);
    assert.equal(result.deleted_count, 2);

    const remaining = await store.listSessionsByActor(buildInstance(700), 'tenant-A', 'actor1');
    assert.equal(remaining.records.length, 1);
    assert.equal(remaining.records[0].token_key, 'live');

  });

});


// ============================================================================
// TIER 3 — AUTH + ADAPTER INTEGRATION
// ============================================================================

const buildAuth = function (overrides) {

  const config = Object.assign({
    STORE: StoreLoader,
    STORE_CONFIG: { table_name: TEST_TABLE, lib_dynamodb: Lib.DynamoDB },
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
    COOKIE_PREFIX: 'sl_user_'
  }, overrides || {});

  return AuthLoader(Lib, config);

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
    return { tenant_id: item.tenant_id, session_key: item.session_key };
  });
  await Lib.DynamoDB.batchDeleteRecords(instance, keysByTable);

};


runSharedStoreSuite({
  label: 'dynamodb (Tier 3)',
  buildAuth: buildAuth,
  buildInstance: buildInstance,
  baseCreateOptions: baseCreateOptions,
  cleanupBetweenTests: cleanupBetweenTests
});


// ============================================================================
// HELPERS (local to this file)
// ============================================================================

function makeRecord (overrides) {

  return Object.assign({
    tenant_id: 'tenant-A',
    actor_id: 'actor1',
    actor_type: 'user',
    token_key: 'key1',
    token_secret_hash: 'hash-abc',
    refresh_token_hash: null,
    refresh_family_id: null,
    created_at: 1000,
    expires_at: 5000,
    last_active_at: 1000,
    install_id: 'install-X',
    install_platform: 'web',
    install_form_factor: 'desktop',
    client_name: 'Chrome',
    client_version: '120.0',
    client_is_browser: true,
    client_os_name: null,
    client_os_version: null,
    client_screen_w: null,
    client_screen_h: null,
    client_ip_address: null,
    client_user_agent: 'Mozilla/5.0',
    push_provider: null,
    push_token: null,
    custom_data: null
  }, overrides || {});

}
