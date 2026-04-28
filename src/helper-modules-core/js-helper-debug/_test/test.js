// Tests for js-helper-debug
// Covers all exported functions with automated assertions
'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');



////////////////////////////// HELPERS ////////////////////////////////////////

// Helper: Create a fresh Debug instance with given config
function createDebug (config_override) {

  const Lib = {};

  return require('@superloomdev/js-helper-debug')(Lib, config_override || {});

}


// Helper: Capture console output during a function call
function captureOutput (fn) {

  const captured = [];
  const original_log = console.log;
  const original_error = console.error;

  console.log = function () {
    captured.push({ stream: 'stdout', args: Array.from(arguments) });
  };

  console.error = function () {
    captured.push({ stream: 'stderr', args: Array.from(arguments) });
  };

  fn();

  console.log = original_log;
  console.error = original_error;

  return captured;

}

///////////////////////////////////////////////////////////////////////////////



// ============================================================================
// 1. LOG LEVEL FUNCTIONS
// ============================================================================

describe('debug', function () {

  it('should output [DEBUG] tag when LOG_LEVEL is debug', function () {

    const Debug = createDebug({ LOG_LEVEL: 'debug', LOG_FORMAT: 'text' });
    const output = captureOutput(function () { Debug.debug('test debug'); });

    assert.strictEqual(output.length, 1);
    assert.ok(output[0].args[0].includes('[DEBUG]'));
    assert.ok(output[0].args[0].includes('test debug'));

  });


  it('should be suppressed when LOG_LEVEL is info', function () {

    const Debug = createDebug({ LOG_LEVEL: 'info', LOG_FORMAT: 'text' });
    const output = captureOutput(function () { Debug.debug('should not appear'); });

    assert.strictEqual(output.length, 0);

  });


  it('should be suppressed when LOG_LEVEL is warn', function () {

    const Debug = createDebug({ LOG_LEVEL: 'warn', LOG_FORMAT: 'text' });
    const output = captureOutput(function () { Debug.debug('suppressed'); });

    assert.strictEqual(output.length, 0);

  });


  it('should include data object when provided', function () {

    const Debug = createDebug({ LOG_LEVEL: 'debug', LOG_FORMAT: 'json' });
    const output = captureOutput(function () { Debug.debug('with data', { key: 'val' }); });

    const parsed = JSON.parse(output[0].args[0]);
    assert.strictEqual(parsed.data.key, 'val');

  });


  it('should include generic data as JSON in text format', function () {

    const Debug = createDebug({ LOG_LEVEL: 'debug', LOG_FORMAT: 'text' });
    const output = captureOutput(function () { Debug.debug('with data', { request_id: '123' }); });

    assert.ok(output[0].args[0].includes('[DEBUG]'));
    assert.ok(output[0].args[0].includes('request_id'));
    assert.ok(output[0].args[0].includes('123'));

  });

});



describe('info', function () {

  it('should output [INFO] tag when LOG_LEVEL is info', function () {

    const Debug = createDebug({ LOG_LEVEL: 'info', LOG_FORMAT: 'text' });
    const output = captureOutput(function () { Debug.info('test info'); });

    assert.strictEqual(output.length, 1);
    assert.ok(output[0].args[0].includes('[INFO]'));

  });


  it('should be suppressed when LOG_LEVEL is warn', function () {

    const Debug = createDebug({ LOG_LEVEL: 'warn', LOG_FORMAT: 'text' });
    const output = captureOutput(function () { Debug.info('suppressed'); });

    assert.strictEqual(output.length, 0);

  });


  it('should output to stdout', function () {

    const Debug = createDebug({ LOG_LEVEL: 'debug', LOG_FORMAT: 'text' });
    const output = captureOutput(function () { Debug.info('stdout test'); });

    assert.strictEqual(output[0].stream, 'stdout');

  });

});



describe('warn', function () {

  it('should output [WARN] tag when LOG_LEVEL is warn', function () {

    const Debug = createDebug({ LOG_LEVEL: 'warn', LOG_FORMAT: 'text' });
    const output = captureOutput(function () { Debug.warn('test warn'); });

    assert.strictEqual(output.length, 1);
    assert.ok(output[0].args[0].includes('[WARN]'));

  });


  it('should be suppressed when LOG_LEVEL is error', function () {

    const Debug = createDebug({ LOG_LEVEL: 'error', LOG_FORMAT: 'text' });
    const output = captureOutput(function () { Debug.warn('suppressed'); });

    assert.strictEqual(output.length, 0);

  });


  it('should output to stdout', function () {

    const Debug = createDebug({ LOG_LEVEL: 'debug', LOG_FORMAT: 'text' });
    const output = captureOutput(function () { Debug.warn('stdout warn'); });

    assert.strictEqual(output[0].stream, 'stdout');

  });

});



describe('error', function () {

  it('should output [ERROR] tag to stderr', function () {

    const Debug = createDebug({ LOG_LEVEL: 'debug', LOG_FORMAT: 'text' });
    const err = new Error('test error');
    const output = captureOutput(function () { Debug.error('something failed', err); });

    assert.strictEqual(output.length, 1);
    assert.strictEqual(output[0].stream, 'stderr');
    assert.ok(output[0].args[0].includes('[ERROR]'));

  });


  it('should include error message and code in text format', function () {

    const Debug = createDebug({ LOG_LEVEL: 'debug', LOG_FORMAT: 'text', INCLUDE_STACK_TRACE: false });
    const err = new Error('text error test');
    err.code = 'ERR_TEST';
    const output = captureOutput(function () { Debug.error('failed', err); });

    assert.ok(output[0].args[0].includes('Error: text error test'));
    assert.ok(output[0].args[0].includes('Code: ERR_TEST'));
    assert.ok(!output[0].args[0].includes('Stack:'));

  });


  it('should include stack trace when INCLUDE_STACK_TRACE is true', function () {

    const Debug = createDebug({ LOG_LEVEL: 'debug', LOG_FORMAT: 'json', INCLUDE_STACK_TRACE: true });
    const err = new Error('stack test');
    const output = captureOutput(function () { Debug.error('failed', err); });

    const parsed = JSON.parse(output[0].args[0]);
    assert.ok(parsed.data.stack);

  });


  it('should exclude stack trace when INCLUDE_STACK_TRACE is false', function () {

    const Debug = createDebug({ LOG_LEVEL: 'debug', LOG_FORMAT: 'json', INCLUDE_STACK_TRACE: false });
    const err = new Error('no stack');
    const output = captureOutput(function () { Debug.error('failed', err); });

    const parsed = JSON.parse(output[0].args[0]);
    assert.strictEqual(parsed.data.stack, undefined);

  });


  it('should include extra_info when provided', function () {

    const Debug = createDebug({ LOG_LEVEL: 'debug', LOG_FORMAT: 'json' });
    const err = new Error('with extra');
    const output = captureOutput(function () { Debug.error('failed', err, 'extra context'); });

    const parsed = JSON.parse(output[0].args[0]);
    assert.strictEqual(parsed.data.extra, 'extra context');

  });


  it('should handle error without code gracefully', function () {

    const Debug = createDebug({ LOG_LEVEL: 'debug', LOG_FORMAT: 'json' });
    const err = new Error('no code');
    const output = captureOutput(function () { Debug.error('failed', err); });

    const parsed = JSON.parse(output[0].args[0]);
    assert.strictEqual(parsed.data.code, null);

  });


  it('should log message only when no error object provided', function () {

    const Debug = createDebug({ LOG_LEVEL: 'debug', LOG_FORMAT: 'json' });
    const output = captureOutput(function () { Debug.error('just a message'); });

    const parsed = JSON.parse(output[0].args[0]);
    assert.strictEqual(parsed.message, 'just a message');

  });


  it('should be suppressed when LOG_LEVEL is none', function () {

    const Debug = createDebug({ LOG_LEVEL: 'none', LOG_FORMAT: 'text' });
    const output = captureOutput(function () { Debug.error('suppressed'); });

    assert.strictEqual(output.length, 0);

  });

});



// ============================================================================
// 2. OUTPUT FORMAT
// ============================================================================

describe('info (JSON format)', function () {

  it('should output valid JSON with all fields when LOG_FORMAT is json', function () {

    const Debug = createDebug({ LOG_LEVEL: 'debug', LOG_FORMAT: 'json', APP_NAME: 'test-app', ENVIRONMENT: 'test' });
    const output = captureOutput(function () { Debug.info('json test', { key: 'value' }); });

    assert.strictEqual(output.length, 1);

    const parsed = JSON.parse(output[0].args[0]);
    assert.strictEqual(parsed.level, 'INFO');
    assert.strictEqual(parsed.message, 'json test');
    assert.strictEqual(parsed.app, 'test-app');
    assert.strictEqual(parsed.env, 'test');
    assert.strictEqual(parsed.data.key, 'value');
    assert.ok(parsed.timestamp);

  });

});



describe('error (JSON format)', function () {

  it('should include error, code, extra, and stack in JSON output', function () {

    const Debug = createDebug({ LOG_LEVEL: 'debug', LOG_FORMAT: 'json', INCLUDE_STACK_TRACE: true });
    const err = new Error('json error test');
    err.code = 'TEST_ERROR';
    const output = captureOutput(function () { Debug.error('failed', err, 'extra context'); });

    const parsed = JSON.parse(output[0].args[0]);
    assert.strictEqual(parsed.data.error, 'json error test');
    assert.strictEqual(parsed.data.code, 'TEST_ERROR');
    assert.strictEqual(parsed.data.extra, 'extra context');
    assert.ok(parsed.data.stack);

  });

});



// ============================================================================
// 3. LOG LEVEL NONE (suppress all)
// ============================================================================

describe('debug (LOG_LEVEL none)', function () {

  it('should suppress all messages when LOG_LEVEL is none', function () {

    const Debug = createDebug({ LOG_LEVEL: 'none', LOG_FORMAT: 'text' });
    const output = captureOutput(function () {
      Debug.debug('no');
      Debug.info('no');
      Debug.warn('no');
      Debug.error('no');
    });

    assert.strictEqual(output.length, 0);

  });

});



// ============================================================================
// 4. BACKWARD COMPATIBILITY
// ============================================================================

describe('log', function () {

  it('should forward arguments to console.log when LOG_LEVEL allows info', function () {

    const Debug = createDebug({ LOG_LEVEL: 'debug' });
    const output = captureOutput(function () { Debug.log('old style log'); });

    assert.strictEqual(output.length, 1);
    assert.strictEqual(output[0].args[0], 'old style log');

  });


  it('should be suppressed when LOG_LEVEL is warn', function () {

    const Debug = createDebug({ LOG_LEVEL: 'warn' });
    const output = captureOutput(function () { Debug.log('suppressed'); });

    assert.strictEqual(output.length, 0);

  });


  it('should support multiple arguments like console.log', function () {

    const Debug = createDebug({ LOG_LEVEL: 'debug' });
    const output = captureOutput(function () { Debug.log('a', 'b', 'c'); });

    assert.strictEqual(output.length, 1);
    assert.strictEqual(output[0].args[0], 'a');
    assert.strictEqual(output[0].args[1], 'b');
    assert.strictEqual(output[0].args[2], 'c');

  });

});



// ============================================================================
// 5. PERFORMANCE AUDIT
// ============================================================================

describe('performanceAuditLog', function () {

  it('should log timing data with elapsed_ms and heap_used_mb', function () {

    const Debug = createDebug({ LOG_LEVEL: 'debug', LOG_FORMAT: 'json', INCLUDE_MEMORY_USAGE: true });
    const ref_time = Date.now() - 100;
    const output = captureOutput(function () { Debug.performanceAuditLog('End', 'My Process', ref_time); });

    assert.strictEqual(output.length, 1);

    const parsed = JSON.parse(output[0].args[0]);
    assert.ok(parsed.message.includes('[AUDIT]'));
    assert.ok(parsed.data.elapsed_ms >= 90); // allow small timing variance
    assert.ok(parsed.data.heap_used_mb > 0);

  });


  it('should set elapsed_ms to null when no reference_time provided', function () {

    const Debug = createDebug({ LOG_LEVEL: 'debug', LOG_FORMAT: 'json', INCLUDE_MEMORY_USAGE: false });
    const output = captureOutput(function () { Debug.performanceAuditLog('Start', 'Init'); });

    const parsed = JSON.parse(output[0].args[0]);
    assert.strictEqual(parsed.data.elapsed_ms, null);

  });


  it('should be suppressed when LOG_LEVEL is info', function () {

    const Debug = createDebug({ LOG_LEVEL: 'info', LOG_FORMAT: 'json' });
    const output = captureOutput(function () { Debug.performanceAuditLog('End', 'Process'); });

    assert.strictEqual(output.length, 0);

  });


  it('should include action and routine in message', function () {

    const Debug = createDebug({ LOG_LEVEL: 'debug', LOG_FORMAT: 'json' });
    const output = captureOutput(function () { Debug.performanceAuditLog('End', 'DB Query'); });

    const parsed = JSON.parse(output[0].args[0]);
    assert.ok(parsed.message.includes('End'));
    assert.ok(parsed.message.includes('DB Query'));

  });

});
