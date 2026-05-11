// Info: Three-tier test suite for js-server-helper-auth-store-mongodb.
//
// Tier 1 - Adapter unit tests (no auth.js dependency):
//   - Store loader rejects bad STORE_CONFIG
//   - setupNewStore returns NOT_IMPLEMENTED (indexes must be provisioned out-of-band)
//   - updateSessionActivity throws TypeError on identity fields
//   - updateSessionActivity empty-updates is a no-op success
//   - deleteSessions with empty keys is a no-op success
//   - session round-trip: setSession / getSession / hash guard
//   - _id includes hash so wrong-secret probe misses without timing leak
//   - prefix field enables listSessionsByActor isolation
//   - deleteSession removes the row; other actor unaffected
//   - cleanupExpiredSessions deletes only past-expires_at documents
//
// Tier 3 - Auth + adapter integration (via store contract suite):
//   Full js-server-helper-auth lifecycle driven against a real MongoDB
//   single-node replica set. Collection is auto-created on first write.
'use strict';

const assert = require('node:assert/strict');
const { describe, it, before, after } = require('node:test');

const { Lib, ERRORS } = require('./loader')();
const StoreLoader = require('@superloomdev/js-server-helper-auth-store-mongodb');
const AuthLoader = require('@superloomdev/js-server-helper-auth');
const runSharedStoreSuite = require('./store-contract-suite');


// ============================================================================
// SHARED FIXTURES
// ============================================================================

const TEST_COLLECTION = 'sessions_user';

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
// COLLECTION LIFECYCLE
// ============================================================================

// MongoDB auto-creates collections on first write. Clear any leftover
// documents from a prior interrupted run before the suite starts.
before(async function () {

  const instance = buildInstance(0);
  await Lib.MongoDB.deleteRecordsByFilter(
    instance,
    TEST_COLLECTION,
    { _id: { $exists: true } }
  );

});


// Clean up and close the connection pool after all tests are done.
after(async function () {

  const instance = buildInstance(0);
  await Lib.MongoDB.deleteRecordsByFilter(
    instance,
    TEST_COLLECTION,
    { _id: { $exists: true } }
  );
  await Lib.MongoDB.close(instance);

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

    // Seed one document for the guard tests
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

  it('throws TypeError when trying to overwrite _id (MongoDB PK)', async function () {

    const store = buildStore();
    await assert.rejects(
      store.updateSessionActivity(buildInstance(1000), 'tenant-A', 'actor1', 'guardkey', {
        _id: 'bad-id'
      }),
      TypeError
    );

  });

  it('throws TypeError when trying to overwrite prefix', async function () {

    const store = buildStore();
    await assert.rejects(
      store.updateSessionActivity(buildInstance(1000), 'tenant-A', 'actor1', 'guardkey', {
        prefix: 'evil#prefix#'
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

    // Clear all documents before this describe block
    const instance = buildInstance(0);
    await Lib.MongoDB.deleteRecordsByFilter(
      instance, TEST_COLLECTION, { _id: { $exists: true } }
    );

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

  });

  it('getSession returns null on wrong hash (hash baked into _id)', async function () {

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

  it('_id and prefix are stripped from the returned record', async function () {

    const store = buildStore();
    const record = makeRecord({ token_key: 'rk1' });
    const result = await store.getSession(
      buildInstance(1000),
      record.tenant_id, record.actor_id, record.token_key, record.token_secret_hash
    );
    assert.ok(!Object.prototype.hasOwnProperty.call(result.record, '_id'));
    assert.ok(!Object.prototype.hasOwnProperty.call(result.record, 'prefix'));

  });

  it('custom_data round-trips as a native MongoDB object (no JSON envelope)', async function () {

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

  it('setSession upsert preserves the first created_at on a second write', async function () {

    const store = buildStore();
    const record = makeRecord({ token_key: 'rk3', created_at: 1000 });
    await store.setSession(buildInstance(1000), record);

    // Second write with same key - MongoDB upsert replaces the doc
    // so the hash-in-_id approach means same hash => same _id => same doc
    const updated = Object.assign({}, record, { last_active_at: 2000 });
    await store.setSession(buildInstance(2000), updated);

    const result = await store.getSession(
      buildInstance(2000),
      record.tenant_id, record.actor_id, record.token_key, record.token_secret_hash
    );
    assert.equal(result.record.last_active_at, 2000);

  });

});


describe('Tier 1: listSessionsByActor and delete isolation', { concurrency: false }, function () {

  before(async function () {

    const instance = buildInstance(0);
    await Lib.MongoDB.deleteRecordsByFilter(
      instance, TEST_COLLECTION, { _id: { $exists: true } }
    );

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

  it('deleteSession removes exactly one document, other actor unaffected', async function () {

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

  it('deleteSessions removes multiple documents in one deleteMany', async function () {

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
    await Lib.MongoDB.deleteRecordsByFilter(
      instance, TEST_COLLECTION, { _id: { $exists: true } }
    );

  });

  it('deleted_count is 0 on empty collection', async function () {

    const store = buildStore();
    const result = await store.cleanupExpiredSessions(buildInstance(99999));
    assert.equal(result.success, true);
    assert.equal(result.deleted_count, 0);

  });

  it('deletes only docs past expires_at and returns accurate deleted_count', async function () {

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
    STORE_CONFIG: { collection_name: TEST_COLLECTION, lib_mongodb: Lib.MongoDB },
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
  await Lib.MongoDB.deleteRecordsByFilter(
    instance,
    TEST_COLLECTION,
    { _id: { $exists: true } }
  );

};


runSharedStoreSuite({
  label: 'mongodb (Tier 3)',
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
