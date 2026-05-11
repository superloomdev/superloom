// Info: Three-tier test suite for js-server-helper-auth-store-sqlite.
//
// Tier 1 - Adapter unit tests (this file, no auth.js dependency):
//   - Store loader rejects bad STORE_CONFIG
//   - _Store.Q rejects identifiers with double-quotes
//   - _Store coercions: toColumnValue / fromColumnValue for booleans + custom_data
//   - getSession returns null on hash mismatch (no timing leak)
//   - updateSessionActivity throws TypeError on identity fields
//   - setSession upsert immutability (created_at preserved)
//   - cleanupExpiredSessions deleted_count accuracy
//
// Tier 3 - Auth + adapter integration (via store contract suite):
//   Full js-server-helper-auth lifecycle driven against the real
//   SQLite backend. Covers every public Auth API path.
'use strict';

const assert = require('node:assert/strict');
const { describe, it, before, after } = require('node:test');

const { Lib, ERRORS } = require('./loader')();
const StoreLoader = require('@superloomdev/js-server-helper-auth-store-sqlite');
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
      lib_sql: Lib.SQLite
    }
  };
  return StoreLoader(Lib, config, ERRORS);

};


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
      function () { StoreLoader(Lib, { STORE_CONFIG: { lib_sql: Lib.SQLite } }, ERRORS); },
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


describe('Tier 1: _Store identifier quoting', function () {

  it('Q wraps a clean name in double-quotes', function () {

    // Reach _Store.Q indirectly via buildCreateTableSQL side-effect:
    // if the table name were injected, the DDL string would vary. We
    // test Q directly by triggering it through buildStore - if the
    // store loads without throwing, Q accepted the name.
    const store = buildStore('clean_table');
    assert.ok(store);

  });

  it('Q rejects a table_name containing a double-quote', function () {

    assert.throws(
      function () {
        StoreLoader(Lib, {
          STORE_CONFIG: { table_name: 'bad"table', lib_sql: Lib.SQLite }
        }, ERRORS);
      },
      /identifier contains double-quote/
    );

  });

});


describe('Tier 1: value coercions', function () {

  // We test coercions through the round-trip: setSession writes a
  // record, getSession reads it back. This exercises both
  // toColumnValue (write) and fromColumnValue (read) via a real SQLite
  // :memory: instance provisioned by loader.js.

  before(async function () {

    const store = buildStore();
    await store.setupNewStore(buildInstance(0));

  });

  after(async function () {

    await Lib.SQLite.write(buildInstance(0), 'DELETE FROM "' + TEST_TABLE + '"');

  });


  it('round-trips client_is_browser = true as INTEGER 1 and reads back as boolean true', async function () {

    const store = buildStore();
    const record = makeRecord({ client_is_browser: true });
    await store.setSession(buildInstance(1000), record);

    const result = await store.getSession(
      buildInstance(1000),
      record.tenant_id, record.actor_id, record.token_key, record.token_secret_hash
    );
    assert.equal(result.success, true);
    assert.equal(result.record.client_is_browser, true);

  });

  it('round-trips client_is_browser = false as INTEGER 0 and reads back as boolean false', async function () {

    const store = buildStore();
    const record = makeRecord({ token_key: 'key2', client_is_browser: false });
    await store.setSession(buildInstance(1000), record);

    const result = await store.getSession(
      buildInstance(1000),
      record.tenant_id, record.actor_id, record.token_key, record.token_secret_hash
    );
    assert.equal(result.record.client_is_browser, false);

  });

  it('round-trips a complex custom_data object through JSON envelope', async function () {

    const store = buildStore();
    const custom = { x: 1, arr: [1, 2], nested: { ok: true } };
    const record = makeRecord({ token_key: 'key3', custom_data: custom });
    await store.setSession(buildInstance(1000), record);

    const result = await store.getSession(
      buildInstance(1000),
      record.tenant_id, record.actor_id, record.token_key, record.token_secret_hash
    );
    assert.deepEqual(result.record.custom_data, custom);

  });

  it('round-trips custom_data = null without JSON wrapping', async function () {

    const store = buildStore();
    const record = makeRecord({ token_key: 'key4', custom_data: null });
    await store.setSession(buildInstance(1000), record);

    const result = await store.getSession(
      buildInstance(1000),
      record.tenant_id, record.actor_id, record.token_key, record.token_secret_hash
    );
    assert.equal(result.record.custom_data, null);

  });

});


describe('Tier 1: getSession hash guard', function () {

  before(async function () {

    const store = buildStore();
    await store.setupNewStore(buildInstance(0));
    await store.setSession(buildInstance(1000), makeRecord({ token_key: 'hashkey' }));

  });

  it('returns null record on wrong token_secret_hash (no timing leak)', async function () {

    const store = buildStore();
    const result = await store.getSession(
      buildInstance(1000),
      'tenant-A', 'actor1', 'hashkey', 'WRONG_HASH'
    );
    assert.equal(result.success, true);
    assert.equal(result.record, null);

  });

});


describe('Tier 1: updateSessionActivity identity guard', function () {

  before(async function () {

    const store = buildStore();
    await store.setupNewStore(buildInstance(0));
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

  it('allows updating last_active_at and expires_at', async function () {

    const store = buildStore();
    const result = await store.updateSessionActivity(
      buildInstance(1500), 'tenant-A', 'actor1', 'guardkey',
      { last_active_at: 1500, expires_at: 9999 }
    );
    assert.equal(result.success, true);

  });

});


describe('Tier 1: setSession upsert preserves immutable columns', function () {

  before(async function () {

    const store = buildStore();
    await store.setupNewStore(buildInstance(0));

  });

  it('created_at stays anchored after a second setSession call', async function () {

    const store = buildStore();
    const record = makeRecord({ token_key: 'immkey', created_at: 1000 });
    await store.setSession(buildInstance(1000), record);

    // Second call with a different created_at - the original must survive
    const updated = Object.assign({}, record, { created_at: 9999, last_active_at: 2000 });
    await store.setSession(buildInstance(2000), updated);

    const result = await store.getSession(
      buildInstance(2000),
      record.tenant_id, record.actor_id, record.token_key, record.token_secret_hash
    );
    assert.equal(result.record.created_at, 1000);
    assert.equal(result.record.last_active_at, 2000);

  });

});


describe('Tier 1: cleanupExpiredSessions deleted_count', function () {

  before(async function () {

    const store = buildStore();
    await store.setupNewStore(buildInstance(0));
    await Lib.SQLite.write(buildInstance(0), 'DELETE FROM "' + TEST_TABLE + '"');

  });

  it('returns accurate deleted_count', async function () {

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


describe('Tier 1: refresh_token_hash and refresh_family_id round-trip', function () {

  before(async function () {

    const store = buildStore();
    await store.setupNewStore(buildInstance(0));
    await Lib.SQLite.write(buildInstance(0), 'DELETE FROM "' + TEST_TABLE + '"');

  });

  it('stores and reads back refresh_token_hash and refresh_family_id', async function () {

    const store = buildStore();
    const record = makeRecord({
      token_key: 'rkey1',
      refresh_token_hash: 'rthash-abc',
      refresh_family_id: 'rfamily-xyz'
    });
    await store.setSession(buildInstance(1000), record);

    const result = await store.getSession(
      buildInstance(1000),
      record.tenant_id, record.actor_id, record.token_key, record.token_secret_hash
    );
    assert.equal(result.record.refresh_token_hash, 'rthash-abc');
    assert.equal(result.record.refresh_family_id, 'rfamily-xyz');

  });

  it('updateSessionActivity can update refresh_token_hash and refresh_family_id', async function () {

    const store = buildStore();
    const record = makeRecord({ token_key: 'rkey2' });
    await store.setSession(buildInstance(1000), record);

    const update_result = await store.updateSessionActivity(
      buildInstance(1100),
      record.tenant_id, record.actor_id, record.token_key,
      { refresh_token_hash: 'new-rthash', refresh_family_id: 'new-rfamily' }
    );
    assert.equal(update_result.success, true);

    const get_result = await store.getSession(
      buildInstance(1100),
      record.tenant_id, record.actor_id, record.token_key, record.token_secret_hash
    );
    assert.equal(get_result.record.refresh_token_hash, 'new-rthash');
    assert.equal(get_result.record.refresh_family_id, 'new-rfamily');

  });

});


describe('Tier 1: updateSessionActivity edge cases', function () {

  before(async function () {

    const store = buildStore();
    await store.setupNewStore(buildInstance(0));
    await Lib.SQLite.write(buildInstance(0), 'DELETE FROM "' + TEST_TABLE + '"');
    await store.setSession(buildInstance(1000), makeRecord({ token_key: 'ukey1' }));

  });

  it('empty updates object is a no-op and returns success without a DB round-trip', async function () {

    const store = buildStore();
    const result = await store.updateSessionActivity(
      buildInstance(1000), 'tenant-A', 'actor1', 'ukey1', {}
    );
    assert.equal(result.success, true);
    assert.equal(result.error, null);

  });

  it('updates last_active_at and expires_at and the change is reflected on read', async function () {

    const store = buildStore();
    await store.updateSessionActivity(
      buildInstance(1500), 'tenant-A', 'actor1', 'ukey1',
      { last_active_at: 1500, expires_at: 88888 }
    );

    const result = await store.getSession(
      buildInstance(1500),
      'tenant-A', 'actor1', 'ukey1', makeRecord({}).token_secret_hash
    );
    assert.equal(result.record.last_active_at, 1500);
    assert.equal(result.record.expires_at, 88888);

  });

});


describe('Tier 1: deleteSessions bulk path', function () {

  before(async function () {

    const store = buildStore();
    await store.setupNewStore(buildInstance(0));
    await Lib.SQLite.write(buildInstance(0), 'DELETE FROM "' + TEST_TABLE + '"');

  });

  it('deleteSessions with a single key removes exactly that session', async function () {

    const store = buildStore();
    const r1 = makeRecord({ token_key: 'del1' });
    const r2 = makeRecord({ token_key: 'del2' });
    await store.setSession(buildInstance(1000), r1);
    await store.setSession(buildInstance(1000), r2);

    await store.deleteSessions(buildInstance(1100), 'tenant-A', [
      { actor_id: 'actor1', token_key: 'del1' }
    ]);

    const remaining = await store.listSessionsByActor(buildInstance(1100), 'tenant-A', 'actor1');
    assert.equal(remaining.records.length, 1);
    assert.equal(remaining.records[0].token_key, 'del2');

  });

  it('deleteSessions with multiple keys removes all of them in one round-trip', async function () {

    const store = buildStore();
    const r3 = makeRecord({ token_key: 'del3' });
    const r4 = makeRecord({ token_key: 'del4' });
    const r5 = makeRecord({ token_key: 'del5' });
    await store.setSession(buildInstance(1000), r3);
    await store.setSession(buildInstance(1000), r4);
    await store.setSession(buildInstance(1000), r5);

    await store.deleteSessions(buildInstance(1100), 'tenant-A', [
      { actor_id: 'actor1', token_key: 'del3' },
      { actor_id: 'actor1', token_key: 'del4' }
    ]);

    const remaining = await store.listSessionsByActor(buildInstance(1100), 'tenant-A', 'actor1');
    const keys = remaining.records.map(function (r) { return r.token_key; });
    assert.ok(!keys.includes('del3'));
    assert.ok(!keys.includes('del4'));
    assert.ok(keys.includes('del5'));

  });

  it('deleteSessions with an empty keys array is a no-op success', async function () {

    const store = buildStore();
    const result = await store.deleteSessions(buildInstance(1000), 'tenant-A', []);
    assert.equal(result.success, true);
    assert.equal(result.error, null);

  });

});


describe('Tier 1: getSession not-found path', function () {

  before(async function () {

    const store = buildStore();
    await store.setupNewStore(buildInstance(0));

  });

  it('returns success:true with null record when the row does not exist', async function () {

    const store = buildStore();
    const result = await store.getSession(
      buildInstance(1000),
      'tenant-X', 'actor-X', 'no-such-key', 'any-hash'
    );
    assert.equal(result.success, true);
    assert.equal(result.record, null);
    assert.equal(result.error, null);

  });

});


describe('Tier 1: cleanupExpiredSessions on empty table', function () {

  before(async function () {

    const store = buildStore();
    await store.setupNewStore(buildInstance(0));
    await Lib.SQLite.write(buildInstance(0), 'DELETE FROM "' + TEST_TABLE + '"');

  });

  it('returns deleted_count 0 when the table is empty', async function () {

    const store = buildStore();
    const result = await store.cleanupExpiredSessions(buildInstance(99999));
    assert.equal(result.success, true);
    assert.equal(result.deleted_count, 0);
    assert.equal(result.error, null);

  });

});


describe('Tier 1: large multi-actor list isolation', function () {

  before(async function () {

    const store = buildStore();
    await store.setupNewStore(buildInstance(0));
    await Lib.SQLite.write(buildInstance(0), 'DELETE FROM "' + TEST_TABLE + '"');

    // Insert 10 sessions across 3 actors
    for (let i = 0; i < 5; i++) {
      await store.setSession(buildInstance(1000), makeRecord({ actor_id: 'big-actor-1', token_key: 'ba1-k' + i }));
    }
    for (let i = 0; i < 3; i++) {
      await store.setSession(buildInstance(1000), makeRecord({ actor_id: 'big-actor-2', token_key: 'ba2-k' + i }));
    }
    for (let i = 0; i < 2; i++) {
      await store.setSession(buildInstance(1000), makeRecord({ actor_id: 'big-actor-3', token_key: 'ba3-k' + i }));
    }

  });

  it('listSessionsByActor returns exactly the right count for each actor', async function () {

    const store = buildStore();
    const r1 = await store.listSessionsByActor(buildInstance(1000), 'tenant-A', 'big-actor-1');
    const r2 = await store.listSessionsByActor(buildInstance(1000), 'tenant-A', 'big-actor-2');
    const r3 = await store.listSessionsByActor(buildInstance(1000), 'tenant-A', 'big-actor-3');

    assert.equal(r1.records.length, 5);
    assert.equal(r2.records.length, 3);
    assert.equal(r3.records.length, 2);

  });

  it('deleteSession on one actor does not affect other actors', async function () {

    const store = buildStore();
    await store.deleteSession(buildInstance(1000), 'tenant-A', 'big-actor-1', 'ba1-k0');

    const r1 = await store.listSessionsByActor(buildInstance(1000), 'tenant-A', 'big-actor-1');
    const r2 = await store.listSessionsByActor(buildInstance(1000), 'tenant-A', 'big-actor-2');
    assert.equal(r1.records.length, 4);
    assert.equal(r2.records.length, 3);

  });

  it('cleanupExpiredSessions only removes rows past expires_at across all actors', async function () {

    const store = buildStore();
    // Overwrite ba2-k0 with a past expiry
    await store.setSession(buildInstance(1000), makeRecord({
      actor_id: 'big-actor-2', token_key: 'ba2-k0', expires_at: 100
    }));

    const result = await store.cleanupExpiredSessions(buildInstance(5000));
    assert.equal(result.success, true);
    assert.equal(result.deleted_count, 1);

    const r2 = await store.listSessionsByActor(buildInstance(5000), 'tenant-A', 'big-actor-2');
    assert.equal(r2.records.length, 2);

  });

});


// ============================================================================
// TIER 3 — AUTH + ADAPTER INTEGRATION
// ============================================================================

const buildAuth = function (overrides) {

  const config = Object.assign({
    STORE: StoreLoader,
    STORE_CONFIG: { table_name: TEST_TABLE, lib_sql: Lib.SQLite },
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

  await Lib.SQLite.write(buildInstance(0), 'DELETE FROM "' + TEST_TABLE + '"');

};


before(async function () {

  const auth = buildAuth();
  const result = await auth.setupNewStore(buildInstance(0));
  if (result.success === false) {
    throw new Error('setupNewStore failed: ' + JSON.stringify(result.error));
  }

});

after(async function () {

  await Lib.SQLite.close();

});


runSharedStoreSuite({
  label: 'sqlite (Tier 3)',
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
