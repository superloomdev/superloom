// Info: Test Cases for js-server-helper-instance
// Config comes from environment variables via loader.js
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Load all dependencies via test loader (mirrors main project loader pattern)
const { Lib } = require('./loader')();
const Instance = Lib.Instance;



describe('initialize', function () {

  it('should return an object with required properties', function () {

    const instance = Instance.initialize();

    assert.ok(instance, 'Instance should be created');
    assert.strictEqual(typeof instance.time, 'number');
    assert.strictEqual(typeof instance.time_ms, 'number');
    assert.strictEqual(instance.logger_counter, 0);
    assert.strictEqual(instance.background_queue, 0);
    assert.ok(Array.isArray(instance.cleanup_queue));
    assert.strictEqual(instance.cleanup_queue.length, 0);

  });


  it('should set time to current unix timestamp in seconds', function () {

    const before = Math.floor(Date.now() / 1000);
    const instance = Instance.initialize();
    const after = Math.floor(Date.now() / 1000);

    assert.ok(instance.time >= before);
    assert.ok(instance.time <= after);

  });


  it('should set time_ms to current time in milliseconds', function () {

    const before = Date.now();
    const instance = Instance.initialize();
    const after = Date.now();

    assert.ok(instance.time_ms >= before);
    assert.ok(instance.time_ms <= after);

  });


  it('should create independent instances each call', function () {

    const instance1 = Instance.initialize();
    const instance2 = Instance.initialize();

    instance1.logger_counter = 5;

    assert.strictEqual(instance2.logger_counter, 0);

  });

});



describe('addCleanupRoutine', function () {

  it('should add a function to cleanup queue', function () {

    const instance = Instance.initialize();
    const fn = function () {};

    Instance.addCleanupRoutine(instance, fn);

    assert.strictEqual(instance.cleanup_queue.length, 1);
    assert.strictEqual(instance.cleanup_queue[0], fn);

  });


  it('should add multiple cleanup functions', function () {

    const instance = Instance.initialize();

    Instance.addCleanupRoutine(instance, function () {});
    Instance.addCleanupRoutine(instance, function () {});
    Instance.addCleanupRoutine(instance, function () {});

    assert.strictEqual(instance.cleanup_queue.length, 3);

  });

});



describe('cleanup', function () {

  it('should execute all cleanup functions', function () {

    const instance = Instance.initialize();
    let call_count = 0;

    Instance.addCleanupRoutine(instance, function () { call_count++; });
    Instance.addCleanupRoutine(instance, function () { call_count++; });

    Instance.cleanup(instance);

    assert.strictEqual(call_count, 2);

  });


  it('should pass instance to cleanup functions', function () {

    const instance = Instance.initialize();
    let received_instance = null;

    Instance.addCleanupRoutine(instance, function (inst) {
      received_instance = inst;
    });

    Instance.cleanup(instance);

    assert.strictEqual(received_instance, instance);

  });


  it('should reset cleanup queue after execution', function () {

    const instance = Instance.initialize();

    Instance.addCleanupRoutine(instance, function () {});
    Instance.cleanup(instance);

    assert.strictEqual(instance.cleanup_queue.length, 0);

  });


  it('should not run cleanup if background routines are pending', function () {

    const instance = Instance.initialize();
    let call_count = 0;

    instance.background_queue = 1;
    Instance.addCleanupRoutine(instance, function () { call_count++; });

    Instance.cleanup(instance);

    assert.strictEqual(call_count, 0);
    assert.strictEqual(instance.cleanup_queue.length, 1);

  });


  it('should do nothing if cleanup queue is empty', function () {

    const instance = Instance.initialize();

    // Should not throw
    Instance.cleanup(instance);

    assert.strictEqual(instance.cleanup_queue.length, 0);

  });

});



describe('backgroundRoutine', function () {

  it('should increment background queue counter', function () {

    const instance = Instance.initialize();

    Instance.backgroundRoutine(instance);

    assert.strictEqual(instance.background_queue, 1);

  });


  it('should return a completion callback function', function () {

    const instance = Instance.initialize();

    const done = Instance.backgroundRoutine(instance);

    assert.strictEqual(typeof done, 'function');

  });


  it('should decrement counter when completion callback is called', function () {

    const instance = Instance.initialize();

    const done = Instance.backgroundRoutine(instance);
    assert.strictEqual(instance.background_queue, 1);

    done();
    assert.strictEqual(instance.background_queue, 0);

  });


  it('should track multiple background routines independently', function () {

    const instance = Instance.initialize();

    const done1 = Instance.backgroundRoutine(instance);
    const done2 = Instance.backgroundRoutine(instance);
    const done3 = Instance.backgroundRoutine(instance);

    assert.strictEqual(instance.background_queue, 3);

    done1();
    assert.strictEqual(instance.background_queue, 2);

    done2();
    assert.strictEqual(instance.background_queue, 1);

    done3();
    assert.strictEqual(instance.background_queue, 0);

  });


  it('should trigger cleanup when last background routine completes', function () {

    const instance = Instance.initialize();
    let cleanup_called = false;

    Instance.addCleanupRoutine(instance, function () { cleanup_called = true; });

    const done1 = Instance.backgroundRoutine(instance);
    const done2 = Instance.backgroundRoutine(instance);

    // Complete first — cleanup should NOT run yet
    done1();
    assert.strictEqual(cleanup_called, false);

    // Complete last — cleanup SHOULD run
    done2();
    assert.strictEqual(cleanup_called, true);

  });

});



describe('getBackgroundQueueCount', function () {

  it('should return 0 for new instance', function () {

    const instance = Instance.initialize();

    assert.strictEqual(Instance.getBackgroundQueueCount(instance), 0);

  });


  it('should return correct count after adding routines', function () {

    const instance = Instance.initialize();

    Instance.backgroundRoutine(instance);
    Instance.backgroundRoutine(instance);

    assert.strictEqual(Instance.getBackgroundQueueCount(instance), 2);

  });

});



describe('getCleanupQueueCount', function () {

  it('should return 0 for new instance', function () {

    const instance = Instance.initialize();

    assert.strictEqual(Instance.getCleanupQueueCount(instance), 0);

  });


  it('should return correct count after adding routines', function () {

    const instance = Instance.initialize();

    Instance.addCleanupRoutine(instance, function () {});
    Instance.addCleanupRoutine(instance, function () {});

    assert.strictEqual(Instance.getCleanupQueueCount(instance), 2);

  });

});



describe('getAge', function () {

  it('should return a non-negative number', function () {

    const instance = Instance.initialize();
    const age = Instance.getAge(instance);

    assert.ok(age >= 0);

  });


  it('should increase over time', function () {

    const instance = Instance.initialize();

    // Manually set time_ms to 50ms ago
    instance.time_ms = Date.now() - 50;

    const age = Instance.getAge(instance);

    assert.ok(age >= 50);

  });

});
