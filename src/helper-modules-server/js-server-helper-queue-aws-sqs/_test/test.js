// Tests for js-server-helper-queue-aws-sqs
// Works with both emulated (ElasticMQ) and integration (real AWS SQS) testing
// Config comes from environment variables via loader.js
'use strict';

const assert = require('node:assert/strict');
const { describe, it, before, after } = require('node:test');
const { SQSClient, CreateQueueCommand, DeleteQueueCommand, PurgeQueueCommand } = require('@aws-sdk/client-sqs');

// Load all dependencies and config via test loader (mirrors main project loader pattern)
// process.env is NEVER accessed in test files — only in loader.js
const { Lib, Config } = require('./loader')();
const SQS = Lib.SQS;
const Instance = Lib.Instance;

// Create a test instance (simulates a real request lifecycle)
const instance = Instance.initialize();

// Test infrastructure: raw AWS SDK client for queue setup/teardown
// Not part of the module under test — only used in before/after hooks
// Uses same credentials as the SQS module (both connect to the same target)
const admin_options = {
  region: Config.aws_region,
  credentials: {
    accessKeyId: Config.aws_access_key_id,
    secretAccessKey: Config.aws_secret_access_key
  }
};

// Endpoint is only set for emulated testing (ElasticMQ)
// For integration testing, this value is undefined — SDK uses real AWS
if (Config.sqs_endpoint) {
  admin_options.endpoint = Config.sqs_endpoint;
}

const AdminClient = new SQSClient(admin_options);

// Test queue name
const TEST_QUEUE = 'test_sqs_module';


describe('SQS', { concurrency: false }, function () {


// ============================================================================
// 0. QUEUE SETUP / TEARDOWN
// ============================================================================

before(async function () {

  // Create test queue
  try {
    await AdminClient.send(new CreateQueueCommand({
      QueueName: TEST_QUEUE
    }));
  }
  catch (err) {
    // Queue may already exist from a previous test run
    if (err.name !== 'QueueAlreadyExists') {
      throw err;
    }
  }

  // Brief wait for queue to be ready
  await new Promise(function (resolve) {
    setTimeout(resolve, 500);
  });

});


after(async function () {

  // Delete test queue
  try {
    // Purge first to avoid deletion delay
    const queue_url = Config.sqs_endpoint
      ? Config.sqs_endpoint + '/000000000000/' + TEST_QUEUE
      : null;

    if (queue_url) {
      await AdminClient.send(new PurgeQueueCommand({ QueueUrl: queue_url }));
    }

    await AdminClient.send(new DeleteQueueCommand({ QueueUrl: queue_url }));
  }
  catch (err) {
    // Ignore cleanup errors
    if (err.name !== 'AWS.SimpleQueueService.NonExistentQueue') {
      // Silently continue — cleanup is best-effort
    }
  }

  // Destroy admin client
  AdminClient.destroy();

});


// ============================================================================
// 1. SEND
// ============================================================================

describe('send', function () {

  it('should send a message and return success with message_id', async function () {

    const result = await SQS.send(instance, TEST_QUEUE, { action: 'test', value: 42 });

    assert.strictEqual(result.success, true);
    assert.strictEqual(typeof result.message_id, 'string');
    assert.strictEqual(result.message_id.length > 0, true);
    assert.strictEqual(result.error, null);

  });


  it('should send a message with delay_seconds option', async function () {

    const result = await SQS.send(instance, TEST_QUEUE, { delayed: true }, { delay_seconds: 1 });

    assert.strictEqual(result.success, true);
    assert.strictEqual(typeof result.message_id, 'string');
    assert.strictEqual(result.error, null);

  });


  it('should return error when queue does not exist', async function () {

    const result = await SQS.send(instance, 'nonexistent_queue_xyz_' + Date.now(), { test: true });

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.message_id, null);
    assert.strictEqual(typeof result.error, 'object');
    assert.strictEqual(result.error.type, 'SEND_ERROR');

  });

});


// ============================================================================
// 2. RECEIVE
// ============================================================================

describe('receive', function () {

  it('should receive messages from queue', async function () {

    // Send a known message first
    const send_result = await SQS.send(instance, TEST_QUEUE, { receive_test: true, ts: Date.now() });
    assert.strictEqual(send_result.success, true);

    // Brief wait for message to be available
    await new Promise(function (resolve) {
      setTimeout(resolve, 300);
    });

    // Receive messages
    const result = await SQS.receive(instance, TEST_QUEUE, { max_messages: 10, wait_time_seconds: 1 });

    assert.strictEqual(result.success, true);
    assert.strictEqual(Array.isArray(result.messages), true);
    assert.strictEqual(result.error, null);

    // Should have at least one message
    assert.strictEqual(result.messages.length > 0, true);

    // Verify message structure
    const msg = result.messages[0];
    assert.strictEqual(typeof msg.message_id, 'string');
    assert.strictEqual(typeof msg.receipt_handle, 'string');
    assert.strictEqual(typeof msg.body, 'object');

  });


  it('should return empty messages array when queue is empty', async function () {

    // Create a separate empty queue for this test
    const empty_queue = 'test_sqs_empty_' + Date.now();

    try {
      await AdminClient.send(new CreateQueueCommand({ QueueName: empty_queue }));
    }
    catch (err) {
      if (err.name !== 'QueueAlreadyExists') {
        throw err;
      }
    }

    // Brief wait for queue to be ready
    await new Promise(function (resolve) {
      setTimeout(resolve, 300);
    });

    const result = await SQS.receive(instance, empty_queue, { max_messages: 1, wait_time_seconds: 0 });

    assert.strictEqual(result.success, true);
    assert.strictEqual(Array.isArray(result.messages), true);
    assert.strictEqual(result.messages.length, 0);
    assert.strictEqual(result.error, null);

  });

});


// ============================================================================
// 3. DELETE
// ============================================================================

describe('delete', function () {

  it('should delete a message using receipt handle', async function () {

    // Send a message
    await SQS.send(instance, TEST_QUEUE, { delete_test: true });

    // Brief wait
    await new Promise(function (resolve) {
      setTimeout(resolve, 300);
    });

    // Receive it to get receipt handle
    const recv = await SQS.receive(instance, TEST_QUEUE, { max_messages: 1, wait_time_seconds: 1 });
    assert.strictEqual(recv.success, true);
    assert.strictEqual(recv.messages.length > 0, true);

    // Delete using receipt handle
    const result = await SQS.delete(instance, TEST_QUEUE, recv.messages[0].receipt_handle);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.error, null);

  });

});


// ============================================================================
// 4. SEND DELAYED
// ============================================================================

describe('sendDelayed', function () {

  it('should send a delayed message and return success', async function () {

    const result = await SQS.sendDelayed(instance, TEST_QUEUE, { scheduled: true }, 1);

    assert.strictEqual(result.success, true);
    assert.strictEqual(typeof result.message_id, 'string');
    assert.strictEqual(result.error, null);

  });

});


});
