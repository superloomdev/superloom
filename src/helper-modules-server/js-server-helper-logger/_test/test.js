// Info: Unit-level tests for js-server-helper-logger. Uses inline factory
// functions so each test owns isolated state and no external service is
// required.
//
// process.env is NEVER accessed in test files - only in loader.js and
// loader-backend.js. That keeps these unit tests deterministic and
// independent of CI environment configuration.
'use strict';


const assert = require('node:assert/strict');
const { describe, it } = require('node:test');


const { Lib } = require('./loader')();
const LoggerLoader = require('../logger.js');
const createMemoryStore = require('./memory-store');


// ============================================================================
// FIXTURES
// ============================================================================

// Default options for log() - keeps tests focused on the behavior under test.
const defaultLogOptions = function (overrides) {
  return Object.assign({
    scope:       'tenant-A',
    entity_type: 'user',
    entity_id:   'u-1',
    actor_type:  'user',
    actor_id:    'u-1',
    action:      'auth.login',
    retention:   'persistent',
    await:       true
  }, overrides || {});
};


// Wait until every background routine on the instance has signalled completion.
// Background log writes are fire-and-forget; this lets a test assert their
// side-effects deterministically.
const waitForBackgroundQueue = async function (instance) {
  while (Lib.Instance.getBackgroundQueueCount(instance) > 0) {
    await new Promise(function (resolve) { setImmediate(resolve); });
  }
};


// Build a logger backed by the in-memory store.
const buildLogger = function (overrides) {
  return LoggerLoader(Lib, Object.assign({
    STORE: createMemoryStore,
    STORE_CONFIG: {}
  }, overrides || {}));
};


// Build a logger backed by an arbitrary store factory (test fixtures).
const buildLoggerWithStore = function (store_factory, overrides) {
  return LoggerLoader(Lib, Object.assign({
    STORE: store_factory,
    STORE_CONFIG: {}
  }, overrides || {}));
};


// Adapter that fails every call - used to test error envelope propagation.
const createFailingStore = function () {

  return {
    setupNewStore: async function () {
      return { success: true, error: null };
    },
    addLog: async function () {
      return { success: false, error: { type: 'SERVICE_UNAVAILABLE', message: 'write failed' } };
    },
    getLogsByEntity: async function () {
      return { success: false, records: [], next_cursor: null, error: { type: 'SERVICE_UNAVAILABLE', message: 'read failed' } };
    },
    getLogsByActor: async function () {
      return { success: false, records: [], next_cursor: null, error: { type: 'SERVICE_UNAVAILABLE', message: 'read failed' } };
    },
    cleanupExpiredLogs: async function () {
      return { success: false, deleted_count: 0, error: { type: 'SERVICE_UNAVAILABLE', message: 'sweep failed' } };
    }
  };

};


// ============================================================================
// 1. LOADER VALIDATION
// ============================================================================

describe('Loader validation', function () {

  it('throws when CONFIG.STORE is missing', function () {
    assert.throws(function () {
      LoggerLoader(Lib, {});
    }, /CONFIG\.STORE must be a store factory function/);
  });


  it('throws when CONFIG.STORE is not a function', function () {
    assert.throws(function () {
      LoggerLoader(Lib, { STORE: 'sqlite' });
    }, /CONFIG\.STORE must be a store factory function/);
  });




  it('throws when CONFIG.STORE_CONFIG is missing', function () {
    assert.throws(function () {
      LoggerLoader(Lib, { STORE: createMemoryStore });
    }, /CONFIG\.STORE_CONFIG is required/);
  });


  it('throws when CONFIG.STORE_CONFIG is not an object', function () {
    assert.throws(function () {
      LoggerLoader(Lib, { STORE: createMemoryStore, STORE_CONFIG: 'not-an-object' });
    }, /CONFIG\.STORE_CONFIG must be a plain object/);
  });




  it('throws when IP_ENCRYPT_KEY is the empty string', function () {
    assert.throws(function () {
      LoggerLoader(Lib, {
        STORE: createMemoryStore, STORE_CONFIG: {},
        IP_ENCRYPT_KEY: ''
      });
    }, /IP_ENCRYPT_KEY must be a non-empty string when set/);
  });


  it('constructs successfully with the in-memory store', function () {
    const Logger = LoggerLoader(Lib, { STORE: createMemoryStore, STORE_CONFIG: {} });
    assert.equal(typeof Logger.log, 'function');
    assert.equal(typeof Logger.listByEntity, 'function');
    assert.equal(typeof Logger.listByActor, 'function');
    assert.equal(typeof Logger.cleanupExpiredLogs, 'function');
    assert.equal(typeof Logger.setupNewStore, 'function');
  });

});


// ============================================================================
// 2. log() OPTION VALIDATION (programmer errors throw)
// ============================================================================

describe('log option validation', function () {

  it('throws TypeError when options is not an object', async function () {
    const Logger = buildLogger();
    await assert.rejects(
      async function () { await Logger.log(Lib.Instance.initialize(), null); },
      TypeError
    );
  });


  it('throws TypeError when entity_type is missing', async function () {
    const Logger = buildLogger();
    const opts = defaultLogOptions();
    delete opts.entity_type;
    await assert.rejects(
      async function () { await Logger.log(Lib.Instance.initialize(), opts); },
      /entity_type is required/
    );
  });


  it('throws TypeError when action is the empty string', async function () {
    const Logger = buildLogger();
    await assert.rejects(
      async function () { await Logger.log(Lib.Instance.initialize(), defaultLogOptions({ action: '' })); },
      /action is required/
    );
  });


  it('missing retention defaults to persistent (no throw)', async function () {
    const Logger = buildLogger();
    const opts = defaultLogOptions();
    delete opts.retention;
    const result = await Logger.log(Lib.Instance.initialize(), opts);
    assert.equal(result.success, true);
  });


  it('throws TypeError when retention.ttl_seconds is zero or negative', async function () {
    const Logger = buildLogger();
    await assert.rejects(
      async function () {
        await Logger.log(Lib.Instance.initialize(), defaultLogOptions({ retention: { ttl_seconds: 0 } }));
      },
      /retention must be "persistent" or .* ttl_seconds/
    );
  });


  it('throws TypeError when data is not a plain object', async function () {
    const Logger = buildLogger();
    await assert.rejects(
      async function () {
        await Logger.log(Lib.Instance.initialize(), defaultLogOptions({ data: 'not-an-object' }));
      },
      /options.data must be an object/
    );
  });

});


// ============================================================================
// 3. log() WRITE BEHAVIOUR
// ============================================================================

describe('log() write behaviour', function () {

  it('await:true returns success and the record is immediately readable', async function () {

    const Logger = buildLogger();
    const instance = Lib.Instance.initialize();
    instance.time = 1000;
    instance.time_ms = 1000 * 1000;

    const result = await Logger.log(instance, defaultLogOptions());
    assert.equal(result.success, true);
    assert.equal(result.error, null);

    const list = await Logger.listByEntity(Lib.Instance.initialize(), {
      scope: 'tenant-A', entity_type: 'user', entity_id: 'u-1'
    });
    assert.equal(list.records.length, 1);

  });


  it('await defaults to false (background mode); the record lands after the queue drains', async function () {

    const Logger = buildLogger();
    const instance = Lib.Instance.initialize();
    instance.time = 2000;
    instance.time_ms = 2000 * 1000;

    const result = await Logger.log(instance, defaultLogOptions({ await: false }));
    assert.equal(result.success, true);

    await waitForBackgroundQueue(instance);

    const list = await Logger.listByEntity(Lib.Instance.initialize(), {
      scope: 'tenant-A', entity_type: 'user', entity_id: 'u-1'
    });
    assert.equal(list.records.length, 1);

  });


  it('await:true surfaces store write failure as SERVICE_UNAVAILABLE', async function () {

    const Logger = buildLoggerWithStore(createFailingStore);
    const result = await Logger.log(Lib.Instance.initialize(), defaultLogOptions());

    assert.equal(result.success, false);
    assert.equal(result.error.type, 'LOGGER_SERVICE_UNAVAILABLE');

  });


  it('await:false swallows store write failure (caller never sees it)', async function () {

    const Logger = buildLoggerWithStore(createFailingStore);
    const instance = Lib.Instance.initialize();

    const result = await Logger.log(instance, defaultLogOptions({ await: false }));
    assert.equal(result.success, true);
    assert.equal(result.error, null);

    // Drain the queue so the failure is observed (and silently dropped).
    await waitForBackgroundQueue(instance);

  });

});


// ============================================================================
// 4. RETENTION
// ============================================================================

describe('retention modes', function () {

  it('persistent records have expires_at: null', async function () {

    const Logger = buildLogger();
    const instance = Lib.Instance.initialize();
    instance.time = 1000; instance.time_ms = 1000 * 1000;

    await Logger.log(instance, defaultLogOptions({ retention: 'persistent' }));

    const list = await Logger.listByEntity(Lib.Instance.initialize(), {
      scope: 'tenant-A', entity_type: 'user', entity_id: 'u-1'
    });
    assert.equal(list.records[0].expires_at, null);

  });


  it('ttl_seconds:N records have expires_at = created_at + N', async function () {

    const Logger = buildLogger();
    const instance = Lib.Instance.initialize();
    instance.time = 5000; instance.time_ms = 5000 * 1000;

    await Logger.log(instance, defaultLogOptions({ retention: { ttl_seconds: 600 } }));

    const list = await Logger.listByEntity(Lib.Instance.initialize(), {
      scope: 'tenant-A', entity_type: 'user', entity_id: 'u-1'
    });
    assert.equal(list.records[0].expires_at, 5000 + 600);

  });

});


// ============================================================================
// 5. IP ENCRYPTION
// ============================================================================

describe('IP encryption', function () {

  // Generate a 64-hex-char (256-bit) AES key per test - consistent with the
  // crypto helper's contract.
  const newKey = function () {
    return Lib.Crypto.generateRandomString('0123456789abcdef', 64);
  };


  it('round-trips an IP address through encrypt+decrypt invisibly', async function () {

    const key = newKey();
    const Logger = buildLogger({ IP_ENCRYPT_KEY: key });
    const instance = Lib.Instance.initialize();

    await Logger.log(instance, defaultLogOptions({
      action: 'auth.login',
      ip: '203.0.113.42',
      await: true
    }));

    const list = await Logger.listByEntity(Lib.Instance.initialize(), {
      scope: 'tenant-A', entity_type: 'user', entity_id: 'u-1'
    });

    assert.equal(list.records.length, 1);
    assert.equal(list.records[0].ip, '203.0.113.42');

  });


  it('persists the IP as ciphertext under the configured key', async function () {

    // Capture the raw record at the store layer to verify ciphertext storage.
    const captured = [];
    const captureStore = {
      setupNewStore: async function () { return { success: true, error: null }; },
      addLog: async function (instance, record) {
        captured.push(record);
        return { success: true, error: null };
      },
      getLogsByEntity: async function () { return { success: true, records: [], next_cursor: null, error: null }; },
      getLogsByActor: async function () { return { success: true, records: [], next_cursor: null, error: null }; },
      cleanupExpiredLogs: async function () { return { success: true, deleted_count: 0, error: null }; }
    };

    const key = newKey();
    const Logger = buildLoggerWithStore(function () { return captureStore; }, { IP_ENCRYPT_KEY: key });

    await Logger.log(Lib.Instance.initialize(), defaultLogOptions({
      ip: '198.51.100.7', await: true
    }));

    assert.equal(captured.length, 1);
    assert.notEqual(captured[0].ip, '198.51.100.7');
    assert.equal(typeof captured[0].ip, 'string');
    assert.ok(captured[0].ip.length > 0);

    // And the ciphertext decrypts back to the original
    const decrypted = Lib.Crypto.aesDecrypt(captured[0].ip, key);
    assert.equal(decrypted, '198.51.100.7');

  });


  it('returns the ciphertext if the key cannot decrypt (no throw)', async function () {

    // Store a record encrypted under key1, then read with a logger
    // configured with key2. The reader should see the raw ciphertext
    // (not throw), so audit reviewers at least see something.
    const captured = [];
    const captureStore = {
      setupNewStore: async function () { return { success: true, error: null }; },
      addLog: async function (instance, record) {
        captured.push(Object.assign({}, record));
        return { success: true, error: null };
      },
      getLogsByEntity: async function () {
        return { success: true, records: captured.slice(), next_cursor: null, error: null };
      },
      getLogsByActor: async function () { return { success: true, records: [], next_cursor: null, error: null }; },
      cleanupExpiredLogs: async function () { return { success: true, deleted_count: 0, error: null }; }
    };

    const key1 = newKey();
    const key2 = newKey();

    const writer = buildLoggerWithStore(function () { return captureStore; }, { IP_ENCRYPT_KEY: key1 });
    await writer.log(Lib.Instance.initialize(), defaultLogOptions({ ip: '203.0.113.7', await: true }));

    const reader = buildLoggerWithStore(function () { return captureStore; }, { IP_ENCRYPT_KEY: key2 });
    const list = await reader.listByEntity(Lib.Instance.initialize(), {
      scope: 'tenant-A', entity_type: 'user', entity_id: 'u-1'
    });

    assert.equal(list.records.length, 1);
    // The reader cannot decrypt, so it returns the ciphertext verbatim
    assert.notEqual(list.records[0].ip, '203.0.113.7');

  });

});


// ============================================================================
// 6. HTTP AUTO-CAPTURE (IP + user_agent from instance.http_request)
// ============================================================================

describe('HttpHandler auto-capture', function () {

  it('pulls IP / user_agent from the instance when explicit options are absent', async function () {

    const captured = [];
    const captureStore = {
      setupNewStore: async function () { return { success: true, error: null }; },
      addLog: async function (instance, record) {
        captured.push(record);
        return { success: true, error: null };
      },
      getLogsByEntity: async function () { return { success: true, records: [], next_cursor: null, error: null }; },
      getLogsByActor: async function () { return { success: true, records: [], next_cursor: null, error: null }; },
      cleanupExpiredLogs: async function () { return { success: true, deleted_count: 0, error: null }; }
    };

    const FakeHttpHandler = {
      getHttpRequestIPAddress: function () { return '198.51.100.99'; },
      getHttpRequestUserAgent: function () { return 'Test-UA/1.0'; }
    };

    const Logger = LoggerLoader(
      Object.assign({}, Lib, { HttpHandler: FakeHttpHandler }),
      { STORE: function () { return captureStore; }, STORE_CONFIG: {} }
    );

    const instance = Lib.Instance.initialize();
    instance.http_request = { headers: {}, connection: {} }; // truthy marker

    const opts = defaultLogOptions();
    delete opts.ip;
    delete opts.user_agent;

    await Logger.log(instance, opts);

    assert.equal(captured.length, 1);
    assert.equal(captured[0].ip, '198.51.100.99');
    assert.equal(captured[0].user_agent, 'Test-UA/1.0');

  });


  it('explicit options always win over auto-capture', async function () {

    const captured = [];
    const captureStore = {
      setupNewStore: async function () { return { success: true, error: null }; },
      addLog: async function (instance, record) {
        captured.push(record);
        return { success: true, error: null };
      },
      getLogsByEntity: async function () { return { success: true, records: [], next_cursor: null, error: null }; },
      getLogsByActor: async function () { return { success: true, records: [], next_cursor: null, error: null }; },
      cleanupExpiredLogs: async function () { return { success: true, deleted_count: 0, error: null }; }
    };

    const FakeHttpHandler = {
      getHttpRequestIPAddress: function () { return '198.51.100.99'; },
      getHttpRequestUserAgent: function () { return 'Test-UA/1.0'; }
    };

    const Logger = LoggerLoader(
      Object.assign({}, Lib, { HttpHandler: FakeHttpHandler }),
      { STORE: function () { return captureStore; }, STORE_CONFIG: {} }
    );

    const instance = Lib.Instance.initialize();
    instance.http_request = { headers: {}, connection: {} };

    await Logger.log(instance, defaultLogOptions({
      ip: '203.0.113.55', user_agent: 'Explicit/1.0'
    }));

    assert.equal(captured[0].ip, '203.0.113.55');
    assert.equal(captured[0].user_agent, 'Explicit/1.0');

  });

});


// ============================================================================
// 7. listByEntity / listByActor INPUT VALIDATION
// ============================================================================

describe('list option validation', function () {

  it('listByEntity throws when entity_type is missing', async function () {
    const Logger = buildLogger();
    await assert.rejects(
      async function () {
        await Logger.listByEntity(Lib.Instance.initialize(), {
          scope: 'tenant-A', entity_id: 'u-1'
        });
      },
      /entity_type is required/
    );
  });


  it('listByActor throws when actor_id is missing', async function () {
    const Logger = buildLogger();
    await assert.rejects(
      async function () {
        await Logger.listByActor(Lib.Instance.initialize(), {
          scope: 'tenant-A', actor_type: 'user'
        });
      },
      /actor_id is required/
    );
  });


  it('listByEntity rejects a non-string action filter', async function () {
    const Logger = buildLogger();
    await assert.rejects(
      async function () {
        await Logger.listByEntity(Lib.Instance.initialize(), {
          scope: 'tenant-A', entity_type: 'user', entity_id: 'u-1',
          actions: ['', 'auth.*']
        });
      },
      /actions entries must be non-empty strings/
    );
  });

});


// ============================================================================
// 8. STORE READ/WRITE ENVELOPES
// ============================================================================

describe('Store error envelopes', function () {

  it('listByEntity surfaces a store read failure as SERVICE_UNAVAILABLE', async function () {

    const Logger = buildLoggerWithStore(createFailingStore);
    const result = await Logger.listByEntity(Lib.Instance.initialize(), {
      entity_type: 'test',
      entity_id: '1'
    });

    assert.equal(result.success, false);
    assert.equal(result.error.type, 'LOGGER_SERVICE_UNAVAILABLE');

  });


  it('listByActor surfaces a store read failure as SERVICE_UNAVAILABLE', async function () {

    const Logger = buildLoggerWithStore(createFailingStore);
    const result = await Logger.listByActor(Lib.Instance.initialize(), {
      actor_type: 'user',
      actor_id: '1'
    });

    assert.equal(result.success, false);
    assert.equal(result.error.type, 'LOGGER_SERVICE_UNAVAILABLE');

  });


  it('cleanupExpiredLogs surfaces failure as SERVICE_UNAVAILABLE', async function () {

    const Logger = buildLoggerWithStore(createFailingStore);
    const result = await Logger.cleanupExpiredLogs(Lib.Instance.initialize());

    assert.equal(result.success, false);
    assert.equal(result.error.type, 'LOGGER_SERVICE_UNAVAILABLE');

  });

});


// ============================================================================
// 9. INITIALIZE STORE
// ============================================================================

describe('setupNewStore', function () {

  it('memory store: setupNewStore is a no-op that returns success', async function () {
    const Logger = buildLogger();
    const result = await Logger.setupNewStore(Lib.Instance.initialize());
    assert.equal(result.success, true);
    assert.equal(result.error, null);
  });


  it('store missing setupNewStore() returns success', async function () {
    const minimalStore = {
      addLog: async function () { return { success: true, error: null }; },
      getLogsByEntity: async function () { return { success: true, records: [], next_cursor: null, error: null }; },
      getLogsByActor: async function () { return { success: true, records: [], next_cursor: null, error: null }; }
    };

    const Logger = buildLoggerWithStore(function () { return minimalStore; });
    const result = await Logger.setupNewStore(Lib.Instance.initialize());
    assert.equal(result.success, true);
  });


  it('store missing cleanupExpiredLogs() returns success with deleted_count: 0', async function () {
    const minimalStore = {
      addLog: async function () { return { success: true, error: null }; },
      getLogsByEntity: async function () { return { success: true, records: [], next_cursor: null, error: null }; },
      getLogsByActor: async function () { return { success: true, records: [], next_cursor: null, error: null }; }
    };

    const Logger = buildLoggerWithStore(function () { return minimalStore; });
    const result = await Logger.cleanupExpiredLogs(Lib.Instance.initialize());
    assert.equal(result.success, true);
    assert.equal(result.deleted_count, 0);
  });

});
