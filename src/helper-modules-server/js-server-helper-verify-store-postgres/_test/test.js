// Info: Three-tier test suite for js-server-helper-verify-store-postgres.
//
// Tier 1 - Adapter unit tests (this file, no verify.js dependency):
//   - Store loader rejects bad STORE_CONFIG
//   - Direct store method coverage: getRecord (miss), setRecord round-trip,
//     incrementFailCount atomic, deleteRecord idempotent, cleanupExpiredRecords
//
// Tier 3 - Verify + adapter integration (via store contract suite):
//   Full js-server-helper-verify lifecycle driven against the real
//   Postgres backend. Covers every public Verify API path.
'use strict';

const assert = require('node:assert/strict');
const { describe, it, before, after } = require('node:test');

const { Lib, ERRORS } = require('./loader')();
const StoreLoader = require('@superloomdev/js-server-helper-verify-store-postgres');
const VerifyLoader = require('@superloomdev/js-server-helper-verify');
const runSharedStoreSuite = require('./store-contract-suite');


// ============================================================================
// SHARED FIXTURES
// ============================================================================

const TEST_TABLE = 'verify_codes';

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

const buildVerify = function () {

  return VerifyLoader(Lib, {
    STORE: StoreLoader,
    STORE_CONFIG: {
      table_name: TEST_TABLE,
      lib_sql: Lib.Postgres
    }
  });

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


// ============================================================================
// TIER 1 — DIRECT STORE METHOD TESTS
// ============================================================================

describe('Tier 1: getRecord not-found path', function () {

  before(async function () {

    const store = buildStore();
    await store.setupNewStore(buildInstance(0));
    await Lib.Postgres.write(buildInstance(0), 'DELETE FROM "' + TEST_TABLE + '"');

  });

  it('returns success:true with null record when the row does not exist', async function () {

    const store = buildStore();
    const result = await store.getRecord(
      buildInstance(0),
      'scope-missing',
      'key-missing'
    );
    assert.equal(result.success, true);
    assert.equal(result.record, null);
    assert.equal(result.error, null);

  });

});


describe('Tier 1: setRecord round-trip', function () {

  before(async function () {

    const store = buildStore();
    await store.setupNewStore(buildInstance(0));
    await Lib.Postgres.write(buildInstance(0), 'DELETE FROM "' + TEST_TABLE + '"');

  });

  it('setRecord writes and getRecord reads back the same data', async function () {

    const store = buildStore();
    const record = { code: '1234', fail_count: 0, created_at: 100, expires_at: 9999 };

    const set = await store.setRecord(buildInstance(100), 'scope-A', 'key-1', record);
    assert.equal(set.success, true);
    assert.equal(set.error, null);

    const get = await store.getRecord(buildInstance(100), 'scope-A', 'key-1');
    assert.equal(get.success, true);
    assert.equal(get.error, null);
    assert.ok(get.record !== null);
    assert.equal(String(get.record.code), '1234');
    assert.equal(Number(get.record.fail_count), 0);
    assert.equal(Number(get.record.created_at), 100);
    assert.equal(Number(get.record.expires_at), 9999);

  });

  it('setRecord upserts - second call replaces the record', async function () {

    const store = buildStore();
    const r1 = { code: 'AAAA', fail_count: 0, created_at: 100, expires_at: 500 };
    const r2 = { code: 'BBBB', fail_count: 0, created_at: 200, expires_at: 999 };

    await store.setRecord(buildInstance(100), 'scope-A', 'key-upsert', r1);
    await store.setRecord(buildInstance(200), 'scope-A', 'key-upsert', r2);

    const get = await store.getRecord(buildInstance(200), 'scope-A', 'key-upsert');
    assert.equal(get.record.code, 'BBBB');
    assert.equal(Number(get.record.expires_at), 999);

  });

});


describe('Tier 1: incrementFailCount', function () {

  before(async function () {

    const store = buildStore();
    await store.setupNewStore(buildInstance(0));
    await Lib.Postgres.write(buildInstance(0), 'DELETE FROM "' + TEST_TABLE + '"');

  });

  it('increments fail_count by 1 on each call', async function () {

    const store = buildStore();
    const record = { code: '5678', fail_count: 0, created_at: 100, expires_at: 9999 };

    await store.setRecord(buildInstance(100), 'scope-B', 'key-inc', record);

    await store.incrementFailCount(buildInstance(100), 'scope-B', 'key-inc');
    const after1 = await store.getRecord(buildInstance(100), 'scope-B', 'key-inc');
    assert.equal(Number(after1.record.fail_count), 1);

    await store.incrementFailCount(buildInstance(100), 'scope-B', 'key-inc');
    const after2 = await store.getRecord(buildInstance(100), 'scope-B', 'key-inc');
    assert.equal(Number(after2.record.fail_count), 2);

  });

  it('incrementFailCount on a missing row is a no-op (success)', async function () {

    const store = buildStore();
    const result = await store.incrementFailCount(buildInstance(100), 'scope-B', 'no-such-key');
    assert.equal(result.success, true);
    assert.equal(result.error, null);

  });

});


describe('Tier 1: deleteRecord', function () {

  before(async function () {

    const store = buildStore();
    await store.setupNewStore(buildInstance(0));
    await Lib.Postgres.write(buildInstance(0), 'DELETE FROM "' + TEST_TABLE + '"');

  });

  it('deleteRecord removes the row', async function () {

    const store = buildStore();
    const record = { code: 'DEAD', fail_count: 0, created_at: 100, expires_at: 9999 };

    await store.setRecord(buildInstance(100), 'scope-C', 'key-del', record);
    const del = await store.deleteRecord(buildInstance(100), 'scope-C', 'key-del');
    assert.equal(del.success, true);

    const get = await store.getRecord(buildInstance(100), 'scope-C', 'key-del');
    assert.equal(get.success, true);
    assert.equal(get.record, null);

  });

  it('deleteRecord on a missing row is a no-op (success)', async function () {

    const store = buildStore();
    const result = await store.deleteRecord(buildInstance(100), 'scope-C', 'no-such-key');
    assert.equal(result.success, true);
    assert.equal(result.error, null);

  });

});


describe('Tier 1: cleanupExpiredRecords accuracy', function () {

  before(async function () {

    const store = buildStore();
    await store.setupNewStore(buildInstance(0));
    await Lib.Postgres.write(buildInstance(0), 'DELETE FROM "' + TEST_TABLE + '"');

  });

  it('deletes only rows with expires_at < now and reports accurate deleted_count', async function () {

    const store = buildStore();

    await store.setRecord(buildInstance(100), 'scope-D', 'exp1', { code: 'A', fail_count: 0, created_at: 100, expires_at: 200 });
    await store.setRecord(buildInstance(100), 'scope-D', 'exp2', { code: 'B', fail_count: 0, created_at: 100, expires_at: 300 });
    await store.setRecord(buildInstance(100), 'scope-D', 'live', { code: 'C', fail_count: 0, created_at: 100, expires_at: 9999 });

    const result = await store.cleanupExpiredRecords(buildInstance(400));
    assert.equal(result.success, true);
    assert.equal(result.deleted_count, 2);
    assert.equal(result.error, null);

    const survivor = await store.getRecord(buildInstance(400), 'scope-D', 'live');
    assert.ok(survivor.record !== null);

  });

  it('returns deleted_count 0 when nothing is expired', async function () {

    const store = buildStore();
    await Lib.Postgres.write(buildInstance(0), 'DELETE FROM "' + TEST_TABLE + '"');

    const result = await store.cleanupExpiredRecords(buildInstance(99999));
    assert.equal(result.success, true);
    assert.equal(result.deleted_count, 0);
    assert.equal(result.error, null);

  });

});


// ============================================================================
// TIER 3 — VERIFY + ADAPTER INTEGRATION
// ============================================================================

const cleanupBetweenTests = async function () {

  await Lib.Postgres.write(buildInstance(0), 'DELETE FROM "' + TEST_TABLE + '"');

};


before(async function () {

  const verify = buildVerify();
  const result = await verify.setupNewStore(buildInstance(0));
  if (result.success === false) {
    throw new Error('setupNewStore failed: ' + JSON.stringify(result.error));
  }

});

after(async function () {

  await Lib.Postgres.close();

});


runSharedStoreSuite({
  label: 'postgres (Tier 3)',
  buildVerify: buildVerify,
  buildInstance: buildInstance,
  cleanupBetweenTests: cleanupBetweenTests
});
