// Tests for js-server-helper-verify
// Offline module - storage adapter is injected per-test (in-memory implementation).
// process.env is NEVER accessed in test files - only in loader.js
'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

// Load all dependencies via test loader (mirrors main project loader pattern)
const { Lib } = require('./loader')();

// Verify module under test - constructed per-case with its own adapter
const VerifyLoader = require('../verify.js');


// ============================================================================
// DOMAIN ERROR CATALOG (test fixture)
// ============================================================================
//
// Stand-in for the application's `[entity].errors.js` - the verify module is
// pre-configured with these objects and returns them directly on every failure
// path. Real applications would inject `Lib.Auth.errors` or similar.
const TEST_ERRORS = {
  COOLDOWN_ACTIVE:    { code: 'TEST_OTP_COOLDOWN_ACTIVE',    message: 'Please wait before requesting another code.', status: 429 },
  NOT_FOUND:          { code: 'TEST_OTP_NOT_FOUND',          message: 'No active verification code.',                status: 400 },
  EXPIRED:            { code: 'TEST_OTP_EXPIRED',            message: 'This code has expired.',                     status: 400 },
  MAX_FAILS:          { code: 'TEST_OTP_LOCKED',             message: 'Too many failed attempts.',                  status: 429 },
  WRONG_VALUE:        { code: 'TEST_OTP_WRONG_VALUE',        message: 'The code you entered is incorrect.',         status: 400 },
  STORE_READ_FAILED:  { code: 'TEST_SERVICE_UNAVAILABLE',    message: 'Service temporarily unavailable.',           status: 503 },
  STORE_WRITE_FAILED: { code: 'TEST_SERVICE_UNAVAILABLE',    message: 'Service temporarily unavailable.',           status: 503 }
};


// Helper - shorthand to construct a verify instance with the test ERRORS
const buildVerify = function (store) {
  return VerifyLoader(Lib, { STORE: store, ERRORS: TEST_ERRORS });
};


// ============================================================================
// IN-MEMORY STORE ADAPTER (test fixture)
// ============================================================================

// Build a fresh Map-backed adapter that satisfies the verify module's contract.
// Returns the adapter plus a `_records` reference for white-box assertions.
const createInMemoryStore = function () {

  const records = new Map();

  const compositeKey = function (scope, key) {
    return scope + '::' + key;
  };

  return {

    getRecord: async function (instance, scope, key) {
      const stored = records.get(compositeKey(scope, key));
      return {
        success: true,
        record: stored ? Object.assign({}, stored) : null,
        error: null
      };
    },

    setRecord: async function (instance, scope, key, record) {
      records.set(compositeKey(scope, key), Object.assign({}, record));
      return {
        success: true,
        error: null
      };
    },

    incrementFailCount: async function (instance, scope, key) {
      const composite = compositeKey(scope, key);
      const stored = records.get(composite);
      if (!stored) {
        return {
          success: false,
          error: { type: 'NOT_FOUND', message: 'no record to increment' }
        };
      }
      stored.fail_count = stored.fail_count + 1;
      return {
        success: true,
        error: null
      };
    },

    deleteRecord: async function (instance, scope, key) {
      records.delete(compositeKey(scope, key));
      return {
        success: true,
        error: null
      };
    },

    _records: records

  };

};


// Build an adapter that returns failure for every read - used to test
// error propagation paths through the verify module.
const createFailingStore = function () {

  return {

    getRecord: async function () {
      return {
        success: false,
        record: null,
        error: { type: 'STORE_READ_FAILED', message: 'read failed (test fixture)' }
      };
    },

    setRecord: async function () {
      return {
        success: false,
        error: { type: 'STORE_WRITE_FAILED', message: 'write failed (test fixture)' }
      };
    },

    incrementFailCount: async function () {
      return {
        success: false,
        error: { type: 'STORE_INCREMENT_FAILED', message: 'inc failed (test fixture)' }
      };
    },

    deleteRecord: async function () {
      return {
        success: false,
        error: { type: 'STORE_DELETE_FAILED', message: 'delete failed (test fixture)' }
      };
    }

  };

};


// Wait until every background routine on the instance has signalled completion.
// Background deletes are fire-and-forget; this lets a test assert their effect.
const waitForBackgroundQueue = async function (instance) {
  while (Lib.Instance.getBackgroundQueueCount(instance) > 0) {
    await new Promise(function (resolve) { setImmediate(resolve); });
  }
};


// Default options helpers - keep tests focused on the behavior under test.
const defaultCreateOptions = function (overrides) {
  return Object.assign({
    scope: 'user.123',
    key: 'login-phone.+12345',
    length: 6,
    ttl_seconds: 300,
    cooldown_seconds: 60
  }, overrides || {});
};

const defaultVerifyOptions = function (overrides) {
  return Object.assign({
    scope: 'user.123',
    key: 'login-phone.+12345',
    value: '000000',
    max_fail_count: 3
  }, overrides || {});
};



// ============================================================================
// 1. LOADER VALIDATION
// ============================================================================

describe('Loader validation', function () {

  it('should throw when CONFIG.STORE is missing', function () {
    assert.throws(function () {
      VerifyLoader(Lib, { ERRORS: TEST_ERRORS });
    }, /CONFIG\.STORE is required/);
  });


  it('should throw when CONFIG.STORE is null', function () {
    assert.throws(function () {
      VerifyLoader(Lib, { STORE: null, ERRORS: TEST_ERRORS });
    }, /CONFIG\.STORE is required/);
  });


  it('should throw when STORE.getRecord is missing', function () {
    const store = createInMemoryStore();
    delete store.getRecord;
    assert.throws(function () {
      VerifyLoader(Lib, { STORE: store, ERRORS: TEST_ERRORS });
    }, /CONFIG\.STORE\.getRecord must be an async function/);
  });


  it('should throw when STORE.setRecord is not a function', function () {
    const store = createInMemoryStore();
    store.setRecord = 'not a function';
    assert.throws(function () {
      VerifyLoader(Lib, { STORE: store, ERRORS: TEST_ERRORS });
    }, /CONFIG\.STORE\.setRecord must be an async function/);
  });


  it('should throw when STORE.incrementFailCount is missing', function () {
    const store = createInMemoryStore();
    delete store.incrementFailCount;
    assert.throws(function () {
      VerifyLoader(Lib, { STORE: store, ERRORS: TEST_ERRORS });
    }, /CONFIG\.STORE\.incrementFailCount must be an async function/);
  });


  it('should throw when STORE.deleteRecord is missing', function () {
    const store = createInMemoryStore();
    delete store.deleteRecord;
    assert.throws(function () {
      VerifyLoader(Lib, { STORE: store, ERRORS: TEST_ERRORS });
    }, /CONFIG\.STORE\.deleteRecord must be an async function/);
  });


  it('should throw when CONFIG.ERRORS is missing', function () {
    assert.throws(function () {
      VerifyLoader(Lib, { STORE: createInMemoryStore() });
    }, /CONFIG\.ERRORS is required/);
  });


  it('should throw when CONFIG.ERRORS is missing a required key', function () {
    const partial = Object.assign({}, TEST_ERRORS);
    delete partial.COOLDOWN_ACTIVE;
    assert.throws(function () {
      VerifyLoader(Lib, { STORE: createInMemoryStore(), ERRORS: partial });
    }, /CONFIG\.ERRORS\.COOLDOWN_ACTIVE is required/);
  });


  it('should throw when STORE.cleanupExpiredRecords is present but not a function', function () {
    const store = createInMemoryStore();
    store.cleanupExpiredRecords = 'not a function';
    assert.throws(function () {
      VerifyLoader(Lib, { STORE: store, ERRORS: TEST_ERRORS });
    }, /CONFIG\.STORE\.cleanupExpiredRecords must be an async function when provided/);
  });


  it('should construct successfully when STORE has no cleanupExpiredRecords', function () {
    const Verify = buildVerify(createInMemoryStore());
    assert.strictEqual(typeof Verify.createPin, 'function');
    assert.strictEqual(typeof Verify.createCode, 'function');
    assert.strictEqual(typeof Verify.createToken, 'function');
    assert.strictEqual(typeof Verify.verify, 'function');
    assert.strictEqual(typeof Verify.cleanupExpiredRecords, 'function');
  });


  it('should construct successfully when STORE has cleanupExpiredRecords', function () {
    const store = createInMemoryStore();
    store.cleanupExpiredRecords = async function () {
      return { success: true, deleted_count: 0, error: null };
    };
    const Verify = buildVerify(store);
    assert.strictEqual(typeof Verify.cleanupExpiredRecords, 'function');
  });

});



// ============================================================================
// 2. CHARSETS - createPin / createCode / createToken
// ============================================================================

describe('createPin', function () {

  it('should return a numeric code of requested length', async function () {
    const Verify = buildVerify(createInMemoryStore());
    const instance = Lib.Instance.initialize();

    const result = await Verify.createPin(instance, defaultCreateOptions({ length: 6 }));

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.code.length, 6);
    assert.match(result.code, /^[0-9]+$/);
    assert.strictEqual(result.error, null);
  });


  it('should set expires_at to now + ttl_seconds', async function () {
    const Verify = buildVerify(createInMemoryStore());
    const instance = Lib.Instance.initialize();

    const result = await Verify.createPin(instance, defaultCreateOptions({ ttl_seconds: 300 }));

    assert.strictEqual(result.expires_at, instance['time'] + 300);
  });

});



describe('createCode', function () {

  it('should return a Crockford Base32 code of requested length', async function () {
    const Verify = buildVerify(createInMemoryStore());
    const instance = Lib.Instance.initialize();

    const result = await Verify.createCode(instance, defaultCreateOptions({ length: 8 }));

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.code.length, 8);
    assert.match(result.code, /^[0-9A-HJKMNP-TV-Z]+$/);
  });


  it('should never include lookalike characters I, L, O, U', async function () {
    const Verify = buildVerify(createInMemoryStore());

    // Generate many codes to make a missing-char failure very likely if the charset is wrong
    for (let i = 0; i < 50; i++) {
      const instance = Lib.Instance.initialize();
      const result = await Verify.createCode(instance, defaultCreateOptions({
        scope: 'sweep',
        key: 'iter.' + i,
        length: 12
      }));
      assert.strictEqual(result.success, true);
      assert.doesNotMatch(result.code, /[ILOU]/);
    }
  });

});



describe('createToken', function () {

  it('should return a URL-safe alphanumeric token of requested length', async function () {
    const Verify = buildVerify(createInMemoryStore());
    const instance = Lib.Instance.initialize();

    const result = await Verify.createToken(instance, defaultCreateOptions({ length: 32 }));

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.code.length, 32);
    assert.match(result.code, /^[a-zA-Z0-9]+$/);
  });

});



// ============================================================================
// 3. COOLDOWN ENFORCEMENT
// ============================================================================

describe('Cooldown enforcement', function () {

  it('should block a second create inside the cooldown window', async function () {
    const Verify = buildVerify(createInMemoryStore());
    const instance = Lib.Instance.initialize();
    const options = defaultCreateOptions({ cooldown_seconds: 60 });

    const first = await Verify.createPin(instance, options);
    const second = await Verify.createPin(instance, options);

    assert.strictEqual(first.success, true);
    assert.strictEqual(second.success, false);
    assert.strictEqual(second.error, TEST_ERRORS.COOLDOWN_ACTIVE);
    assert.strictEqual(second.code, null);
  });


  it('should allow a second create after the cooldown window elapses', async function () {
    const Verify = buildVerify(createInMemoryStore());
    const instance = Lib.Instance.initialize();
    const options = defaultCreateOptions({ cooldown_seconds: 60 });

    const first = await Verify.createPin(instance, options);

    // Simulate 70 seconds of clock advance
    instance['time'] = instance['time'] + 70;

    const second = await Verify.createPin(instance, options);

    assert.strictEqual(first.success, true);
    assert.strictEqual(second.success, true);
    assert.notStrictEqual(first.code, second.code);
  });


  it('should treat cooldown_seconds=0 as no cooldown', async function () {
    const Verify = buildVerify(createInMemoryStore());
    const instance = Lib.Instance.initialize();
    const options = defaultCreateOptions({ cooldown_seconds: 0 });

    const first = await Verify.createPin(instance, options);
    const second = await Verify.createPin(instance, options);

    assert.strictEqual(first.success, true);
    assert.strictEqual(second.success, true);
  });

});



// ============================================================================
// 4. VERIFY - HAPPY PATH
// ============================================================================

describe('verify - happy path', function () {

  it('should return success=true when value matches the stored code', async function () {
    const store = createInMemoryStore();
    const Verify = buildVerify(store);
    const instance = Lib.Instance.initialize();

    const created = await Verify.createPin(instance, defaultCreateOptions());
    const result = await Verify.verify(instance, defaultVerifyOptions({ value: created.code }));

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.error, null);
  });


  it('should delete the record after a successful match (one-time use)', async function () {
    const store = createInMemoryStore();
    const Verify = buildVerify(store);
    const instance = Lib.Instance.initialize();

    const created = await Verify.createPin(instance, defaultCreateOptions());
    assert.strictEqual(store._records.size, 1);

    await Verify.verify(instance, defaultVerifyOptions({ value: created.code }));
    await waitForBackgroundQueue(instance);

    assert.strictEqual(store._records.size, 0);
  });


  it('should reject the same value on a second verify call (record gone)', async function () {
    const store = createInMemoryStore();
    const Verify = buildVerify(store);
    const instance = Lib.Instance.initialize();

    const created = await Verify.createPin(instance, defaultCreateOptions());
    await Verify.verify(instance, defaultVerifyOptions({ value: created.code }));
    await waitForBackgroundQueue(instance);

    const replay = await Verify.verify(instance, defaultVerifyOptions({ value: created.code }));

    assert.strictEqual(replay.success, false);
    assert.strictEqual(replay.error, TEST_ERRORS.NOT_FOUND);
  });

});



// ============================================================================
// 5. VERIFY - REJECTION PATHS
// ============================================================================

describe('verify - rejection paths', function () {

  it('should return NOT_FOUND error when no record exists for scope+key', async function () {
    const Verify = buildVerify(createInMemoryStore());
    const instance = Lib.Instance.initialize();

    const result = await Verify.verify(instance, defaultVerifyOptions({ value: '999999' }));

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, TEST_ERRORS.NOT_FOUND);
  });


  it('should return EXPIRED error when current time is past expiry', async function () {
    const Verify = buildVerify(createInMemoryStore());
    const instance = Lib.Instance.initialize();

    const created = await Verify.createPin(instance, defaultCreateOptions({ ttl_seconds: 60 }));

    // Advance the clock past expiry
    instance['time'] = instance['time'] + 120;

    const result = await Verify.verify(instance, defaultVerifyOptions({ value: created.code }));

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, TEST_ERRORS.EXPIRED);
  });


  it('should return WRONG_VALUE error when value does not match', async function () {
    const Verify = buildVerify(createInMemoryStore());
    const instance = Lib.Instance.initialize();

    await Verify.createPin(instance, defaultCreateOptions());
    const result = await Verify.verify(instance, defaultVerifyOptions({ value: 'wrong!' }));

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, TEST_ERRORS.WRONG_VALUE);
  });


  it('should increment fail count on every wrong value submission', async function () {
    const store = createInMemoryStore();
    const Verify = buildVerify(store);
    const instance = Lib.Instance.initialize();

    await Verify.createPin(instance, defaultCreateOptions());

    await Verify.verify(instance, defaultVerifyOptions({ value: 'wrong1' }));
    await Verify.verify(instance, defaultVerifyOptions({ value: 'wrong2' }));

    const stored = store._records.get('user.123::login-phone.+12345');
    assert.strictEqual(stored.fail_count, 2);
  });


  it('should return MAX_FAILS error once fail_count reaches max_fail_count', async function () {
    const Verify = buildVerify(createInMemoryStore());
    const instance = Lib.Instance.initialize();

    const created = await Verify.createPin(instance, defaultCreateOptions());

    // Three wrong attempts trip the counter
    await Verify.verify(instance, defaultVerifyOptions({ value: 'wrong1', max_fail_count: 3 }));
    await Verify.verify(instance, defaultVerifyOptions({ value: 'wrong2', max_fail_count: 3 }));
    await Verify.verify(instance, defaultVerifyOptions({ value: 'wrong3', max_fail_count: 3 }));

    // Even the right value is now refused
    const result = await Verify.verify(instance, defaultVerifyOptions({ value: created.code, max_fail_count: 3 }));

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, TEST_ERRORS.MAX_FAILS);
  });

});



// ============================================================================
// 6. ADAPTER ERROR PROPAGATION
// ============================================================================

describe('Adapter error propagation', function () {

  it('should surface STORE_READ_FAILED domain error from createPin cooldown lookup', async function () {
    const Verify = buildVerify(createFailingStore());
    const instance = Lib.Instance.initialize();

    const result = await Verify.createPin(instance, defaultCreateOptions());

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, TEST_ERRORS.STORE_READ_FAILED);
  });


  it('should surface STORE_WRITE_FAILED domain error from setRecord', async function () {
    // Mix: getRecord works (no existing record), setRecord fails
    const failing_store = createInMemoryStore();
    failing_store.setRecord = async function () {
      return {
        success: false,
        error: { type: 'STORE_WRITE_FAILED', message: 'forced write failure' }
      };
    };

    const Verify = buildVerify(failing_store);
    const instance = Lib.Instance.initialize();

    const result = await Verify.createPin(instance, defaultCreateOptions());

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, TEST_ERRORS.STORE_WRITE_FAILED);
  });


  it('should surface STORE_READ_FAILED domain error from verify lookup', async function () {
    const Verify = buildVerify(createFailingStore());
    const instance = Lib.Instance.initialize();

    const result = await Verify.verify(instance, defaultVerifyOptions({ value: 'anything' }));

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, TEST_ERRORS.STORE_READ_FAILED);
  });


  it('should not error out when incrementFailCount fails', async function () {
    // Create succeeds (in-memory), but incrementFailCount is broken
    const store = createInMemoryStore();
    store.incrementFailCount = async function () {
      return {
        success: false,
        error: { type: 'STORE_INCREMENT_FAILED', message: 'forced inc failure' }
      };
    };

    const Verify = buildVerify(store);
    const instance = Lib.Instance.initialize();

    await Verify.createPin(instance, defaultCreateOptions());
    const result = await Verify.verify(instance, defaultVerifyOptions({ value: 'wrong!' }));

    // Verify still surfaces WRONG_VALUE - increment failure is logged, not surfaced
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, TEST_ERRORS.WRONG_VALUE);
  });

});



// ============================================================================
// 7. INPUT VALIDATION
// ============================================================================

describe('Input validation (programmer errors throw, never returned as envelope)', function () {

  it('should throw TypeError on createPin when scope is missing', async function () {
    const Verify = buildVerify(createInMemoryStore());
    const instance = Lib.Instance.initialize();

    await assert.rejects(
      Verify.createPin(instance, defaultCreateOptions({ scope: '' })),
      { name: 'TypeError', message: /scope is required/ }
    );
  });


  it('should throw TypeError on createPin when length is zero', async function () {
    const Verify = buildVerify(createInMemoryStore());
    const instance = Lib.Instance.initialize();

    await assert.rejects(
      Verify.createPin(instance, defaultCreateOptions({ length: 0 })),
      { name: 'TypeError', message: /length must be a positive integer/ }
    );
  });


  it('should throw TypeError on createPin when ttl_seconds is missing', async function () {
    const Verify = buildVerify(createInMemoryStore());
    const instance = Lib.Instance.initialize();

    const options = defaultCreateOptions();
    delete options.ttl_seconds;

    await assert.rejects(
      Verify.createPin(instance, options),
      { name: 'TypeError', message: /ttl_seconds must be a positive integer/ }
    );
  });


  it('should throw TypeError on verify when value is missing', async function () {
    const Verify = buildVerify(createInMemoryStore());
    const instance = Lib.Instance.initialize();

    const options = defaultVerifyOptions();
    delete options.value;

    await assert.rejects(
      Verify.verify(instance, options),
      { name: 'TypeError', message: /value is required/ }
    );
  });


  it('should throw TypeError on verify when max_fail_count is missing', async function () {
    const Verify = buildVerify(createInMemoryStore());
    const instance = Lib.Instance.initialize();

    const options = defaultVerifyOptions();
    delete options.max_fail_count;

    await assert.rejects(
      Verify.verify(instance, options),
      { name: 'TypeError', message: /max_fail_count must be a positive integer/ }
    );
  });

});



// ============================================================================
// 8. CLEANUP EXPIRED RECORDS
// ============================================================================

describe('cleanupExpiredRecords', function () {

  it('should return CLEANUP_NOT_SUPPORTED when adapter does not implement it', async function () {
    const Verify = buildVerify(createInMemoryStore());
    const instance = Lib.Instance.initialize();

    const result = await Verify.cleanupExpiredRecords(instance);

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.deleted_count, 0);
    assert.strictEqual(result.error.type, 'CLEANUP_NOT_SUPPORTED');
  });


  it('should delegate to adapter and return its result', async function () {
    const store = createInMemoryStore();
    store.cleanupExpiredRecords = async function () {
      return { success: true, deleted_count: 5, error: null };
    };

    const Verify = buildVerify(store);
    const instance = Lib.Instance.initialize();

    const result = await Verify.cleanupExpiredRecords(instance);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.deleted_count, 5);
    assert.strictEqual(result.error, null);
  });


  it('should pass instance to the adapter', async function () {
    const store = createInMemoryStore();
    let received_instance = null;
    store.cleanupExpiredRecords = async function (inst) {
      received_instance = inst;
      return { success: true, deleted_count: 0, error: null };
    };

    const Verify = buildVerify(store);
    const instance = Lib.Instance.initialize();

    await Verify.cleanupExpiredRecords(instance);

    assert.strictEqual(received_instance, instance);
  });


  it('should catch adapter exceptions and return CLEANUP_FAILED', async function () {
    const store = createInMemoryStore();
    store.cleanupExpiredRecords = async function () {
      throw new Error('database connection lost');
    };

    const Verify = buildVerify(store);
    const instance = Lib.Instance.initialize();

    const result = await Verify.cleanupExpiredRecords(instance);

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.deleted_count, 0);
    assert.strictEqual(result.error.type, 'CLEANUP_FAILED');
    assert.strictEqual(result.error.message, 'database connection lost');
  });


  it('should surface adapter failure envelope as-is', async function () {
    const store = createInMemoryStore();
    store.cleanupExpiredRecords = async function () {
      return {
        success: false,
        deleted_count: 0,
        error: { type: 'STORE_ERROR', message: 'permission denied' }
      };
    };

    const Verify = buildVerify(store);
    const instance = Lib.Instance.initialize();

    const result = await Verify.cleanupExpiredRecords(instance);

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error.type, 'STORE_ERROR');
  });

});



// ============================================================================
// 9. FACTORY PATTERN
// ============================================================================

describe('Factory pattern', function () {

  it('should produce independent instances with isolated stores', async function () {
    const store_a = createInMemoryStore();
    const store_b = createInMemoryStore();
    const Verify_A = buildVerify(store_a);
    const Verify_B = buildVerify(store_b);

    const instance = Lib.Instance.initialize();

    await Verify_A.createPin(instance, defaultCreateOptions({ scope: 'tenant.a' }));
    await Verify_B.createPin(instance, defaultCreateOptions({ scope: 'tenant.b' }));

    assert.strictEqual(store_a._records.size, 1);
    assert.strictEqual(store_b._records.size, 1);
    assert.notStrictEqual(Verify_A, Verify_B);
  });

});
