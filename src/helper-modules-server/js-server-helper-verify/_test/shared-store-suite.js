// Info: Backend-agnostic test contract for the verify module. Every store
// runs this suite from its own test file (test-sqlite.js, test-postgres.js,
// etc.) so a regression in any backend - or a divergence between backends -
// is surfaced immediately.
'use strict';


const assert = require('node:assert/strict');
const { describe, it, beforeEach } = require('node:test');


/********************************************************************
Run the shared verify-store contract against a backend.

@param {Object} args - Backend-specific glue
@param {String} args.label - Backend name (used in suite titles)
@param {Function} args.buildVerify - () => Verify instance
@param {Function} args.buildInstance - (time?) => instance object
@param {Object} args.TEST_ERRORS - The domain error catalog used by buildVerify
@param {Function} args.cleanupBetweenTests - async () - empty the store

@return {void}
*********************************************************************/
module.exports = function runSharedStoreSuite (args) {

  const label = args.label;
  const buildVerify = args.buildVerify;
  const buildInstance = args.buildInstance;
  const TEST_ERRORS = args.TEST_ERRORS;
  const cleanupBetweenTests = args.cleanupBetweenTests;


  // Each test gets a fresh store so prior test side effects can never bleed in
  beforeEach(async function () {
    await cleanupBetweenTests();
  });


  // ----- helpers ----------------------------------------------------------

  let counter = 0;
  const uniqueKey = function (suffix) {
    counter = counter + 1;
    return suffix + '-' + counter;
  };

  const sleep = function (ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  };

  const createOptions = function (override) {
    return Object.assign({
      scope: 'tenant-A',
      key: 'will-be-replaced',
      length: 6,
      ttl_seconds: 60,
      cooldown_seconds: 0
    }, override || {});
  };

  const verifyOptions = function (override) {
    return Object.assign({
      scope: 'tenant-A',
      key: 'will-be-replaced',
      value: '000000',
      max_fail_count: 5
    }, override || {});
  };


  // ----- happy path -------------------------------------------------------

  describe(label + ': createPin -> verify lifecycle', function () {

    it('createPin returns a numeric code of the requested length', async function () {

      const Verify = buildVerify();
      const instance = buildInstance();
      const key = uniqueKey('basic');

      const result = await Verify.createPin(instance, createOptions({ key: key, length: 6 }));

      assert.equal(result.success, true);
      assert.equal(result.code.length, 6);
      assert.match(result.code, /^[0-9]+$/);
      assert.equal(typeof result.expires_at, 'number');
      assert.equal(result.error, null);

    });


    it('verify with the correct value returns success and deletes the record', async function () {

      const Verify = buildVerify();
      const instance = buildInstance();
      const key = uniqueKey('happy');

      const created = await Verify.createPin(instance, createOptions({ key: key }));
      assert.equal(created.success, true);

      const verified = await Verify.verify(instance, verifyOptions({ key: key, value: created.code }));
      assert.equal(verified.success, true);
      assert.equal(verified.error, null);

      // Background delete may take a tick on real backends
      await sleep(300);

      const replay = await Verify.verify(instance, verifyOptions({ key: key, value: created.code }));
      assert.equal(replay.success, false);
      assert.deepEqual(replay.error, TEST_ERRORS.NOT_FOUND);

    });

  });


  // ----- error envelopes --------------------------------------------------

  describe(label + ': error envelopes', function () {

    it('verify on an absent record returns NOT_FOUND', async function () {

      const Verify = buildVerify();
      const result = await Verify.verify(buildInstance(), verifyOptions({ key: uniqueKey('absent'), value: '123456' }));

      assert.equal(result.success, false);
      assert.deepEqual(result.error, TEST_ERRORS.NOT_FOUND);

    });


    it('verify with a wrong value increments the fail counter', async function () {

      const Verify = buildVerify();
      const instance = buildInstance();
      const key = uniqueKey('wrong');

      const created = await Verify.createPin(instance, createOptions({ key: key }));
      assert.equal(created.success, true);

      // Pick any value that cannot match a six-digit numeric pin
      const wrong = created.code === '999999' ? '000000' : '999999';

      const r1 = await Verify.verify(instance, verifyOptions({ key: key, value: wrong }));
      assert.equal(r1.success, false);
      assert.deepEqual(r1.error, TEST_ERRORS.WRONG_VALUE);

      const r2 = await Verify.verify(instance, verifyOptions({ key: key, value: wrong }));
      assert.equal(r2.success, false);
      assert.deepEqual(r2.error, TEST_ERRORS.WRONG_VALUE);

      // The correct value should still match because fail_count (=2) is below max_fail_count (=5)
      const r3 = await Verify.verify(instance, verifyOptions({ key: key, value: created.code }));
      assert.equal(r3.success, true);

    });


    it('verify after exceeding max_fail_count returns MAX_FAILS', async function () {

      const Verify = buildVerify();
      const instance = buildInstance();
      const key = uniqueKey('lockout');

      const created = await Verify.createPin(instance, createOptions({ key: key }));
      const wrong = created.code === '999999' ? '000000' : '999999';

      // max_fail_count = 2; two wrong attempts exhaust the budget
      await Verify.verify(instance, verifyOptions({ key: key, value: wrong, max_fail_count: 2 }));
      await Verify.verify(instance, verifyOptions({ key: key, value: wrong, max_fail_count: 2 }));

      // The third attempt - even with the correct code - is locked out
      const locked = await Verify.verify(instance, verifyOptions({ key: key, value: created.code, max_fail_count: 2 }));
      assert.equal(locked.success, false);
      assert.deepEqual(locked.error, TEST_ERRORS.MAX_FAILS);

    });


    it('verify on an expired record returns EXPIRED', async function () {

      const Verify = buildVerify();
      const create_time = 10000;
      const create_instance = buildInstance(create_time);
      const key = uniqueKey('expired');

      const created = await Verify.createPin(create_instance, createOptions({ key: key, ttl_seconds: 60 }));
      assert.equal(created.success, true);

      // Build a verify instance whose clock is past the record's expires_at.
      // Avoids a real-time sleep and any backend-side TTL race (MongoDB's
      // background sweep can otherwise turn EXPIRED into NOT_FOUND).
      const verify_instance = buildInstance(create_time + 120);

      const result = await Verify.verify(verify_instance, verifyOptions({ key: key, value: created.code }));
      assert.equal(result.success, false);
      assert.deepEqual(result.error, TEST_ERRORS.EXPIRED);

    });


    it('createPin while the cooldown is active returns COOLDOWN_ACTIVE', async function () {

      const Verify = buildVerify();
      const t0 = 20000;
      const key = uniqueKey('cooldown');

      const first = await Verify.createPin(buildInstance(t0), createOptions({ key: key, cooldown_seconds: 60 }));
      assert.equal(first.success, true);

      // Try again 10 seconds later - still inside the 60 s cooldown
      const second = await Verify.createPin(buildInstance(t0 + 10), createOptions({ key: key, cooldown_seconds: 60 }));
      assert.equal(second.success, false);
      assert.equal(second.code, null);
      assert.deepEqual(second.error, TEST_ERRORS.COOLDOWN_ACTIVE);

    });


    it('cooldown_seconds:0 allows immediate re-creation', async function () {

      const Verify = buildVerify();
      const key = uniqueKey('no-cooldown');

      const first = await Verify.createPin(buildInstance(30000), createOptions({ key: key, cooldown_seconds: 0 }));
      assert.equal(first.success, true);

      const second = await Verify.createPin(buildInstance(30001), createOptions({ key: key, cooldown_seconds: 0 }));
      assert.equal(second.success, true);
      assert.notEqual(first.code, second.code, 'a fresh code must be generated');

    });

  });


  // ----- charsets ---------------------------------------------------------

  describe(label + ': charset coverage', function () {

    it('createCode returns Crockford Base32 (no I L O U)', async function () {

      const Verify = buildVerify();
      const result = await Verify.createCode(buildInstance(), createOptions({
        key: uniqueKey('code'), length: 8
      }));

      assert.equal(result.success, true);
      assert.equal(result.code.length, 8);
      assert.match(result.code, /^[0-9A-HJKMNP-TV-Z]+$/);

    });


    it('createToken returns a URL-safe alphanumeric token', async function () {

      const Verify = buildVerify();
      const result = await Verify.createToken(buildInstance(), createOptions({
        key: uniqueKey('token'), length: 32
      }));

      assert.equal(result.success, true);
      assert.equal(result.code.length, 32);
      assert.match(result.code, /^[a-zA-Z0-9]+$/);

    });

  });


  // ----- cleanup ----------------------------------------------------------

  describe(label + ': cleanupExpiredRecords', function () {

    it('deletes only the records whose expires_at is in the past', async function () {

      const Verify = buildVerify();
      const t0 = 50000;

      const expired_key = uniqueKey('exp');
      const fresh_key = uniqueKey('fresh');

      // Use cooldown_seconds:0 so both creations land in the table cleanly
      await Verify.createPin(buildInstance(t0), createOptions({
        key: expired_key, ttl_seconds: 30, cooldown_seconds: 0
      }));
      await Verify.createPin(buildInstance(t0 + 1), createOptions({
        key: fresh_key, ttl_seconds: 3600, cooldown_seconds: 0
      }));

      // Now sweep at t0 + 100 - the first record is expired, the second is not
      const result = await Verify.cleanupExpiredRecords(buildInstance(t0 + 100));
      assert.equal(result.success, true);
      assert.ok(result.deleted_count >= 1);

      // The expired record is gone -> NOT_FOUND
      const expired_check = await Verify.verify(buildInstance(t0 + 100), verifyOptions({
        key: expired_key, value: '000000'
      }));
      assert.deepEqual(expired_check.error, TEST_ERRORS.NOT_FOUND);

      // The fresh record survives -> WRONG_VALUE on a wrong probe
      const fresh_check = await Verify.verify(buildInstance(t0 + 100), verifyOptions({
        key: fresh_key, value: '000000'
      }));
      assert.deepEqual(fresh_check.error, TEST_ERRORS.WRONG_VALUE);

    });


    it('returns deleted_count: 0 when nothing is expired', async function () {

      const Verify = buildVerify();
      const result = await Verify.cleanupExpiredRecords(buildInstance(1));

      assert.equal(result.success, true);
      assert.equal(result.deleted_count, 0);

    });

  });


  // ----- multi-tenant / isolation -----------------------------------------

  describe(label + ': scope isolation', function () {

    it('records in one scope are invisible to another scope', async function () {

      const Verify = buildVerify();
      const instance = buildInstance();
      const key_a = uniqueKey('iso');
      const key_b = uniqueKey('iso');

      const created = await Verify.createPin(instance, createOptions({ scope: 'tenant-A', key: key_a }));
      assert.equal(created.success, true);

      // Same key, different scope -> NOT_FOUND
      const cross = await Verify.verify(instance, verifyOptions({ scope: 'tenant-B', key: key_a, value: created.code }));
      assert.deepEqual(cross.error, TEST_ERRORS.NOT_FOUND);

      // Same scope, different key -> NOT_FOUND
      const wrong_key = await Verify.verify(instance, verifyOptions({ scope: 'tenant-A', key: key_b, value: created.code }));
      assert.deepEqual(wrong_key.error, TEST_ERRORS.NOT_FOUND);

    });

  });


  // ----- concurrency / overwrite ------------------------------------------

  describe(label + ': concurrency and replacement', function () {

    it('concurrent createPin calls with cooldown:0 land safely', async function () {

      const Verify = buildVerify();
      const key = uniqueKey('parallel');

      const promises = [];
      for (let i = 0; i < 5; i = i + 1) {
        promises.push(Verify.createPin(buildInstance(60000 + i), createOptions({
          key: key, cooldown_seconds: 0
        })));
      }
      const results = await Promise.all(promises);

      // All five should succeed - the store overwrites by composite key
      for (const r of results) {
        assert.equal(r.success, true);
      }

    });

  });

};
