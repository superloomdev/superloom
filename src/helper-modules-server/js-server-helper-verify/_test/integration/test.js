// Integration tests for js-server-helper-verify against five real storage backends.
// Same assertion suite runs against every backend; if a backend fails any case,
// the adapter or schema for that backend is wrong.
//
// Run prerequisites (see ./README.md for full setup):
//   docker compose up -d   # starts postgres / mysql / mongodb / dynamodb-local
//   cp .env.example .env   # then `set -a && source .env && set +a`
//   npm install
//   npm test
'use strict';


const assert = require('node:assert/strict');
const { describe, it, before, after } = require('node:test');

const buildEnv = require('./loader');
const cleanupExpiredSqlRecords = require('./cleanup-sql');


// ============================================================================
// SHARED ENVIRONMENT - one instance, reused by every test
// ============================================================================

// Mirror of the TEST_ERRORS map in loader.js. Tests assert against object
// identity (`result.error === TEST_ERRORS.NOT_FOUND`) which is the contract
// the verify module guarantees - it returns the catalog entries verbatim.
const TEST_ERRORS = {
  COOLDOWN_ACTIVE:    { code: 'TEST_OTP_COOLDOWN_ACTIVE',    message: 'Please wait before requesting another code.', status: 429 },
  NOT_FOUND:          { code: 'TEST_OTP_NOT_FOUND',          message: 'No active verification code.',                status: 400 },
  EXPIRED:            { code: 'TEST_OTP_EXPIRED',            message: 'This code has expired.',                     status: 400 },
  MAX_FAILS:          { code: 'TEST_OTP_LOCKED',             message: 'Too many failed attempts.',                  status: 429 },
  WRONG_VALUE:        { code: 'TEST_OTP_WRONG_VALUE',        message: 'The code you entered is incorrect.',         status: 400 },
  STORE_READ_FAILED:  { code: 'TEST_SERVICE_UNAVAILABLE',    message: 'Service temporarily unavailable.',           status: 503 },
  STORE_WRITE_FAILED: { code: 'TEST_SERVICE_UNAVAILABLE',    message: 'Service temporarily unavailable.',           status: 503 }
};

let ENV;

before(async function () {
  ENV = await buildEnv();
});

after(async function () {
  if (ENV) {
    await ENV.cleanup();
  }
});



// ============================================================================
// SHARED HELPERS
// ============================================================================

const BACKENDS = ['postgres', 'mysql', 'sqlite', 'mongodb', 'dynamodb'];

let counter = 0;
const uniqueKey = function (label) {
  counter = counter + 1;
  return label + '.' + Date.now() + '.' + counter;
};

const sleep = function (ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
};


const defaultCreate = function (override) {
  return Object.assign({
    scope: 'test-user',
    key: 'will-be-replaced',
    length: 6,
    ttl_seconds: 60,
    cooldown_seconds: 0
  }, override || {});
};


const defaultVerify = function (override) {
  return Object.assign({
    scope: 'test-user',
    key: 'will-be-replaced',
    value: '000000',
    max_fail_count: 5
  }, override || {});
};



// ============================================================================
// PARAMETRIZED CONTRACT TESTS - run once per backend
// ============================================================================

for (const backend of BACKENDS) {

  describe('Verify contract against ' + backend, function () {


    it('createPin generates a code and stores the record', async function () {

      const Verify = ENV.VerifyByBackend[backend];
      const instance = ENV.Lib.Instance.initialize();
      const key = uniqueKey('basic');

      const result = await Verify.createPin(instance, defaultCreate({ key: key }));

      assert.strictEqual(result.success, true);
      assert.match(result.code, /^[0-9]{6}$/);
      assert.ok(typeof result.expires_at === 'number');
      assert.strictEqual(result.error, null);

    });


    it('verify with the correct value returns success:true and deletes the record', async function () {

      const Verify = ENV.VerifyByBackend[backend];
      const instance = ENV.Lib.Instance.initialize();
      const key = uniqueKey('happy-path');

      const created = await Verify.createPin(instance, defaultCreate({ key: key }));
      assert.strictEqual(created.success, true);

      const verified = await Verify.verify(instance, defaultVerify({ key: key, value: created.code }));

      assert.strictEqual(verified.success, true);
      assert.strictEqual(verified.error, null);

      // Allow background delete to complete (best-effort cleanup, real DB calls take ~10-100ms)
      await sleep(300);

      // Re-verify should now report NOT_FOUND because the record was deleted on success
      const replay = await Verify.verify(instance, defaultVerify({ key: key, value: created.code }));
      assert.strictEqual(replay.success, false);
      assert.deepStrictEqual(replay.error, TEST_ERRORS.NOT_FOUND);

    });


    it('verify on an absent record returns NOT_FOUND domain error', async function () {

      const Verify = ENV.VerifyByBackend[backend];
      const instance = ENV.Lib.Instance.initialize();
      const key = uniqueKey('absent');

      const result = await Verify.verify(instance, defaultVerify({ key: key, value: '123456' }));

      assert.strictEqual(result.success, false);
      assert.deepStrictEqual(result.error, TEST_ERRORS.NOT_FOUND);

    });


    it('verify with wrong value returns WRONG_VALUE and increments fail count', async function () {

      const Verify = ENV.VerifyByBackend[backend];
      const instance = ENV.Lib.Instance.initialize();
      const key = uniqueKey('wrong');

      const created = await Verify.createPin(instance, defaultCreate({ key: key }));
      assert.strictEqual(created.success, true);

      // Pick a value that is guaranteed not to match the random 6-digit code
      const wrong_value = created.code === '999999' ? '000000' : '999999';

      const first = await Verify.verify(instance, defaultVerify({ key: key, value: wrong_value }));
      assert.strictEqual(first.success, false);
      assert.deepStrictEqual(first.error, TEST_ERRORS.WRONG_VALUE);

      const second = await Verify.verify(instance, defaultVerify({ key: key, value: wrong_value }));
      assert.strictEqual(second.success, false);
      assert.deepStrictEqual(second.error, TEST_ERRORS.WRONG_VALUE);

      // After two wrong attempts the correct value should still match (fail_count < max_fail_count of 5)
      const correct = await Verify.verify(instance, defaultVerify({ key: key, value: created.code }));
      assert.strictEqual(correct.success, true);
      assert.strictEqual(correct.error, null);

    });


    it('verify after exceeding max_fail_count returns MAX_FAILS', async function () {

      const Verify = ENV.VerifyByBackend[backend];
      const instance = ENV.Lib.Instance.initialize();
      const key = uniqueKey('lockout');

      const created = await Verify.createPin(instance, defaultCreate({ key: key }));
      const wrong_value = created.code === '999999' ? '000000' : '999999';

      // max_fail_count = 2 => the second wrong is the last allowed
      await Verify.verify(instance, defaultVerify({ key: key, value: wrong_value, max_fail_count: 2 }));
      await Verify.verify(instance, defaultVerify({ key: key, value: wrong_value, max_fail_count: 2 }));

      // Third attempt - even with the correct code - should be locked out
      const locked = await Verify.verify(instance, defaultVerify({ key: key, value: created.code, max_fail_count: 2 }));
      assert.strictEqual(locked.success, false);
      assert.deepStrictEqual(locked.error, TEST_ERRORS.MAX_FAILS);

    });


    it('verify on an expired record returns EXPIRED', async function () {

      const Verify = ENV.VerifyByBackend[backend];
      const createInstance = ENV.Lib.Instance.initialize();
      const key = uniqueKey('expired');

      // Create with a normal TTL - the actual value does not matter since we
      // control time via the verify-side instance below
      const created = await Verify.createPin(createInstance, defaultCreate({ key: key, ttl_seconds: 60 }));
      assert.strictEqual(created.success, true);

      // Build a verify instance whose time has been advanced past the record's expires_at.
      // This avoids real-time sleeps and any backend-side TTL sweep race
      // (MongoDB's background TTL thread can purge a record within the test window
      // and turn EXPIRED into NOT_FOUND - non-deterministic).
      const verifyInstance = ENV.Lib.Instance.initialize();
      verifyInstance.time = createInstance.time + 120;

      const result = await Verify.verify(verifyInstance, defaultVerify({ key: key, value: created.code }));

      assert.strictEqual(result.success, false);
      assert.deepStrictEqual(result.error, TEST_ERRORS.EXPIRED);

    });


    it('createPin while cooldown is active returns COOLDOWN_ACTIVE', async function () {

      const Verify = ENV.VerifyByBackend[backend];
      const instance = ENV.Lib.Instance.initialize();
      const key = uniqueKey('cooldown');

      const first = await Verify.createPin(instance, defaultCreate({ key: key, cooldown_seconds: 60 }));
      assert.strictEqual(first.success, true);

      // Same scope+key, fresh instance - should be blocked by cooldown
      const blockedInstance = ENV.Lib.Instance.initialize();
      const second = await Verify.createPin(blockedInstance, defaultCreate({ key: key, cooldown_seconds: 60 }));

      assert.strictEqual(second.success, false);
      assert.strictEqual(second.code, null);
      assert.deepStrictEqual(second.error, TEST_ERRORS.COOLDOWN_ACTIVE);

    });


    it('cooldown_seconds:0 allows immediate re-creation', async function () {

      const Verify = ENV.VerifyByBackend[backend];
      const instance = ENV.Lib.Instance.initialize();
      const key = uniqueKey('no-cooldown');

      const first = await Verify.createPin(instance, defaultCreate({ key: key, cooldown_seconds: 0 }));
      assert.strictEqual(first.success, true);

      const secondInstance = ENV.Lib.Instance.initialize();
      const second = await Verify.createPin(secondInstance, defaultCreate({ key: key, cooldown_seconds: 0 }));
      assert.strictEqual(second.success, true);

      // The second code should overwrite the first
      assert.notStrictEqual(first.code, second.code);

    });


  });

}



// ============================================================================
// SQL CLEANUP HELPER - runs once per SQL dialect
// ============================================================================

for (const dialect of ['postgres', 'mysql', 'sqlite']) {

  describe('cleanup-sql helper against ' + dialect, function () {


    it('deletes only the records whose expires_at is in the past', async function () {

      const Verify = ENV.VerifyByBackend[dialect];
      const Sql = ENV.SqlByDialect[dialect];
      const instance = ENV.Lib.Instance.initialize();

      // Seed: one expired record + one fresh record (cooldown disabled so both store cleanly)
      const expiredKey = uniqueKey('cleanup-expired');
      const freshKey = uniqueKey('cleanup-fresh');

      await Verify.createPin(instance, defaultCreate({ key: expiredKey, ttl_seconds: 1, cooldown_seconds: 0 }));
      await Verify.createPin(instance, defaultCreate({ key: freshKey, ttl_seconds: 3600, cooldown_seconds: 0 }));

      // Wait for the expired one to actually be expired (cross full second boundary)
      await sleep(2100);

      // Run the cleanup helper - it deletes WHERE expires_at < now()
      const cleanupInstance = ENV.Lib.Instance.initialize();
      const result = await cleanupExpiredSqlRecords(Sql, cleanupInstance, { table: ENV.sqlTable });

      assert.strictEqual(result.success, true);
      assert.ok(result.deleted_count >= 1, 'cleanup deleted at least one expired record');

      // Verify the fresh record survived: a wrong-value verify should return
      // WRONG_VALUE, not NOT_FOUND. NOT_FOUND would mean cleanup deleted it.
      const freshVerifyInstance = ENV.Lib.Instance.initialize();
      const freshResult = await Verify.verify(freshVerifyInstance, defaultVerify({
        key: freshKey,
        value: '000000'
      }));
      assert.strictEqual(freshResult.success, false);
      assert.notDeepStrictEqual(freshResult.error, TEST_ERRORS.NOT_FOUND);

      // Verify the expired record is now absent
      const expiredVerifyInstance = ENV.Lib.Instance.initialize();
      const expiredResult = await Verify.verify(expiredVerifyInstance, defaultVerify({
        key: expiredKey,
        value: '000000'
      }));
      assert.strictEqual(expiredResult.success, false);
      assert.deepStrictEqual(expiredResult.error, TEST_ERRORS.NOT_FOUND);

    });


    it('returns deleted_count: 0 when nothing is expired', async function () {

      const Sql = ENV.SqlByDialect[dialect];
      const instance = ENV.Lib.Instance.initialize();

      // Cleanup with a before_epoch in the distant past - should match nothing
      const result = await cleanupExpiredSqlRecords(Sql, instance, {
        table: ENV.sqlTable,
        before_epoch: 0
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.deleted_count, 0);

    });


  });

}
