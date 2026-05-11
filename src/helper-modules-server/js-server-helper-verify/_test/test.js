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

// In-process Map-backed store fixture (Tier-2 enabler)
const createMemoryStore = require('./memory-store');


// Helper - shorthand to construct a verify instance backed by an injected
// store fixture. The inline factory receives (Lib, CONFIG, ERRORS) and
// returns the pre-built store object directly.
const buildVerify = function (store) {
  return VerifyLoader(Lib, {
    STORE: function injectFactory () { return store; },
    STORE_CONFIG: {}
  });
};


// Build an adapter that returns failure for every method - used to test
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

  it('throws when CONFIG.STORE is missing', function () {
    assert.throws(function () {
      VerifyLoader(Lib, {});
    }, /CONFIG\.STORE is required/);
  });


  it('throws when CONFIG.STORE is null', function () {
    assert.throws(function () {
      VerifyLoader(Lib, { STORE: null });
    }, /CONFIG\.STORE is required/);
  });


  it('throws when CONFIG.STORE is not a function', function () {
    assert.throws(function () {
      VerifyLoader(Lib, { STORE: 'sqlite', STORE_CONFIG: {} });
    }, /CONFIG\.STORE is required and must be a store factory function/);
  });


  it('throws when store factory throws on bad STORE_CONFIG (e.g. missing table_name)', function () {
    assert.throws(function () {
      VerifyLoader(Lib, {
        STORE: function () { throw new Error('[verify] STORE_CONFIG.table_name is required for sqlite'); },
        STORE_CONFIG: {}
      });
    }, /STORE_CONFIG\.table_name is required for sqlite/);
  });


  it('constructs successfully with a valid inline factory', function () {
    const Verify = buildVerify(createMemoryStore());
    assert.strictEqual(typeof Verify.createPin, 'function');
    assert.strictEqual(typeof Verify.createCode, 'function');
    assert.strictEqual(typeof Verify.createToken, 'function');
    assert.strictEqual(typeof Verify.verify, 'function');
    assert.strictEqual(typeof Verify.cleanupExpiredRecords, 'function');
    assert.strictEqual(typeof Verify.setupNewStore, 'function');
  });

});



// ============================================================================
// 2. CHARSETS - createPin / createCode / createToken
// ============================================================================

describe('createPin', function () {

  it('should return a numeric code of requested length', async function () {
    const Verify = buildVerify(createMemoryStore());
    const instance = Lib.Instance.initialize();

    const result = await Verify.createPin(instance, defaultCreateOptions({ length: 6 }));

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.code.length, 6);
    assert.match(result.code, /^[0-9]+$/);
    assert.strictEqual(result.error, null);
  });


  it('should set expires_at to now + ttl_seconds', async function () {
    const Verify = buildVerify(createMemoryStore());
    const instance = Lib.Instance.initialize();

    const result = await Verify.createPin(instance, defaultCreateOptions({ ttl_seconds: 300 }));

    assert.strictEqual(result.expires_at, instance['time'] + 300);
  });

});



describe('createCode', function () {

  it('should return a Crockford Base32 code of requested length', async function () {
    const Verify = buildVerify(createMemoryStore());
    const instance = Lib.Instance.initialize();

    const result = await Verify.createCode(instance, defaultCreateOptions({ length: 8 }));

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.code.length, 8);
    assert.match(result.code, /^[0-9A-HJKMNP-TV-Z]+$/);
  });


  it('should never include lookalike characters I, L, O, U', async function () {
    const Verify = buildVerify(createMemoryStore());

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
    const Verify = buildVerify(createMemoryStore());
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
    const Verify = buildVerify(createMemoryStore());
    const instance = Lib.Instance.initialize();
    const options = defaultCreateOptions({ cooldown_seconds: 60 });

    const first = await Verify.createPin(instance, options);
    const second = await Verify.createPin(instance, options);

    assert.strictEqual(first.success, true);
    assert.strictEqual(second.success, false);
    assert.strictEqual(second.error.type, 'VERIFY_COOLDOWN_ACTIVE');
    assert.strictEqual(second.code, null);
  });


  it('should allow a second create after the cooldown window elapses', async function () {
    const Verify = buildVerify(createMemoryStore());
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
    const Verify = buildVerify(createMemoryStore());
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
    const store = createMemoryStore();
    const Verify = buildVerify(store);
    const instance = Lib.Instance.initialize();

    const created = await Verify.createPin(instance, defaultCreateOptions());
    const result = await Verify.verify(instance, defaultVerifyOptions({ value: created.code }));

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.error, null);
  });


  it('should delete the record after a successful match (one-time use)', async function () {
    const store = createMemoryStore();
    const Verify = buildVerify(store);
    const instance = Lib.Instance.initialize();

    const created = await Verify.createPin(instance, defaultCreateOptions());
    assert.strictEqual(store._records.size, 1);

    await Verify.verify(instance, defaultVerifyOptions({ value: created.code }));
    await waitForBackgroundQueue(instance);

    assert.strictEqual(store._records.size, 0);
  });


  it('should reject the same value on a second verify call (record gone)', async function () {
    const store = createMemoryStore();
    const Verify = buildVerify(store);
    const instance = Lib.Instance.initialize();

    const created = await Verify.createPin(instance, defaultCreateOptions());
    await Verify.verify(instance, defaultVerifyOptions({ value: created.code }));
    await waitForBackgroundQueue(instance);

    const replay = await Verify.verify(instance, defaultVerifyOptions({ value: created.code }));

    assert.strictEqual(replay.success, false);
    assert.strictEqual(replay.error.type, 'VERIFY_NOT_FOUND');
  });

});



// ============================================================================
// 5. VERIFY - REJECTION PATHS
// ============================================================================

describe('verify - rejection paths', function () {

  it('should return NOT_FOUND error when no record exists for scope+key', async function () {
    const Verify = buildVerify(createMemoryStore());
    const instance = Lib.Instance.initialize();

    const result = await Verify.verify(instance, defaultVerifyOptions({ value: '999999' }));

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error.type, 'VERIFY_NOT_FOUND');
  });


  it('should return EXPIRED error when current time is past expiry', async function () {
    const Verify = buildVerify(createMemoryStore());
    const instance = Lib.Instance.initialize();

    const created = await Verify.createPin(instance, defaultCreateOptions({ ttl_seconds: 60 }));

    // Advance the clock past expiry
    instance['time'] = instance['time'] + 120;

    const result = await Verify.verify(instance, defaultVerifyOptions({ value: created.code }));

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error.type, 'VERIFY_EXPIRED');
  });


  it('should return WRONG_VALUE error when value does not match', async function () {
    const Verify = buildVerify(createMemoryStore());
    const instance = Lib.Instance.initialize();

    await Verify.createPin(instance, defaultCreateOptions());
    const result = await Verify.verify(instance, defaultVerifyOptions({ value: 'wrong!' }));

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error.type, 'VERIFY_WRONG_VALUE');
  });


  it('should increment fail count on every wrong value submission', async function () {
    const store = createMemoryStore();
    const Verify = buildVerify(store);
    const instance = Lib.Instance.initialize();

    await Verify.createPin(instance, defaultCreateOptions());

    await Verify.verify(instance, defaultVerifyOptions({ value: 'wrong1' }));
    await Verify.verify(instance, defaultVerifyOptions({ value: 'wrong2' }));

    const stored = store._records.get('user.123::login-phone.+12345');
    assert.strictEqual(stored.fail_count, 2);
  });


  it('should return MAX_FAILS error once fail_count reaches max_fail_count', async function () {
    const Verify = buildVerify(createMemoryStore());
    const instance = Lib.Instance.initialize();

    const created = await Verify.createPin(instance, defaultCreateOptions());

    // Three wrong attempts trip the counter
    await Verify.verify(instance, defaultVerifyOptions({ value: 'wrong1', max_fail_count: 3 }));
    await Verify.verify(instance, defaultVerifyOptions({ value: 'wrong2', max_fail_count: 3 }));
    await Verify.verify(instance, defaultVerifyOptions({ value: 'wrong3', max_fail_count: 3 }));

    // Even the right value is now refused
    const result = await Verify.verify(instance, defaultVerifyOptions({ value: created.code, max_fail_count: 3 }));

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error.type, 'VERIFY_MAX_FAILS');
  });

});



// ============================================================================
// 6. ADAPTER ERROR PROPAGATION
// ============================================================================

describe('Adapter error propagation', function () {

  it('should surface SERVICE_UNAVAILABLE when createPin cooldown lookup fails', async function () {
    const Verify = buildVerify(createFailingStore());
    const instance = Lib.Instance.initialize();

    const result = await Verify.createPin(instance, defaultCreateOptions());

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error.type, 'VERIFY_SERVICE_UNAVAILABLE');
  });


  it('should surface SERVICE_UNAVAILABLE when setRecord fails', async function () {
    // Mix: getRecord works (no existing record), setRecord fails
    const failing_store = createMemoryStore();
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
    assert.strictEqual(result.error.type, 'VERIFY_SERVICE_UNAVAILABLE');
  });


  it('should surface SERVICE_UNAVAILABLE when verify lookup fails', async function () {
    const Verify = buildVerify(createFailingStore());
    const instance = Lib.Instance.initialize();

    const result = await Verify.verify(instance, defaultVerifyOptions({ value: 'anything' }));

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error.type, 'VERIFY_SERVICE_UNAVAILABLE');
  });


  it('should not error out when incrementFailCount fails', async function () {
    // Create succeeds (in-memory), but incrementFailCount is broken
    const store = createMemoryStore();
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
    assert.strictEqual(result.error.type, 'VERIFY_WRONG_VALUE');
  });

});



// ============================================================================
// 7. INPUT VALIDATION
// ============================================================================

describe('Input validation (programmer errors throw, never returned as envelope)', function () {

  it('should throw TypeError on createPin when scope is missing', async function () {
    const Verify = buildVerify(createMemoryStore());
    const instance = Lib.Instance.initialize();

    await assert.rejects(
      Verify.createPin(instance, defaultCreateOptions({ scope: '' })),
      { name: 'TypeError', message: /scope is required/ }
    );
  });


  it('should throw TypeError on createPin when length is zero', async function () {
    const Verify = buildVerify(createMemoryStore());
    const instance = Lib.Instance.initialize();

    await assert.rejects(
      Verify.createPin(instance, defaultCreateOptions({ length: 0 })),
      { name: 'TypeError', message: /length must be a positive integer/ }
    );
  });


  it('should throw TypeError on createPin when ttl_seconds is missing', async function () {
    const Verify = buildVerify(createMemoryStore());
    const instance = Lib.Instance.initialize();

    const options = defaultCreateOptions();
    delete options.ttl_seconds;

    await assert.rejects(
      Verify.createPin(instance, options),
      { name: 'TypeError', message: /ttl_seconds must be a positive integer/ }
    );
  });


  it('should throw TypeError on verify when value is missing', async function () {
    const Verify = buildVerify(createMemoryStore());
    const instance = Lib.Instance.initialize();

    const options = defaultVerifyOptions();
    delete options.value;

    await assert.rejects(
      Verify.verify(instance, options),
      { name: 'TypeError', message: /value is required/ }
    );
  });


  it('should throw TypeError on verify when max_fail_count is missing', async function () {
    const Verify = buildVerify(createMemoryStore());
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

  it('should throw when adapter does not implement cleanupExpiredRecords', async function () {
    // Use a stripped store that has no cleanupExpiredRecords method
    const stripped_store = createMemoryStore();
    delete stripped_store.cleanupExpiredRecords;
    const Verify = buildVerify(stripped_store);
    const instance = Lib.Instance.initialize();

    await assert.rejects(
      () => Verify.cleanupExpiredRecords(instance),
      /store does not implement cleanupExpiredRecords/
    );
  });


  it('should delegate to adapter and return its result', async function () {
    const store = createMemoryStore();
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
    const store = createMemoryStore();
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


  it('should catch adapter exceptions and return SERVICE_UNAVAILABLE', async function () {
    const store = createMemoryStore();
    store.cleanupExpiredRecords = async function () {
      throw new Error('database connection lost');
    };

    const Verify = buildVerify(store);
    const instance = Lib.Instance.initialize();

    const result = await Verify.cleanupExpiredRecords(instance);

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.deleted_count, 0);
    assert.strictEqual(result.error.type, 'VERIFY_SERVICE_UNAVAILABLE');
  });


  it('should pass through adapter failure envelope when adapter returns success=false', async function () {
    const store = createMemoryStore();
    store.cleanupExpiredRecords = async function () {
      return {
        success: false,
        deleted_count: 0,
        error: { type: 'SERVICE_UNAVAILABLE', message: 'permission denied' }
      };
    };

    const Verify = buildVerify(store);
    const instance = Lib.Instance.initialize();

    const result = await Verify.cleanupExpiredRecords(instance);

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error.type, 'SERVICE_UNAVAILABLE');
  });

});



// ============================================================================
// 9. FACTORY PATTERN
// ============================================================================

describe('Factory pattern', function () {

  it('should produce independent instances with isolated stores', async function () {
    const store_a = createMemoryStore();
    const store_b = createMemoryStore();
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
