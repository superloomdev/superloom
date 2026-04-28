// Tests for js-server-helper-nosql-aws-dynamodb
// Works with both emulated (DynamoDB Local) and integration (real AWS) testing
// Config comes from environment variables via loader.js
'use strict';

const assert = require('node:assert/strict');
const { describe, it, before, after } = require('node:test');
const { DynamoDBClient, CreateTableCommand, DeleteTableCommand } = require('@aws-sdk/client-dynamodb');

// Load all dependencies and config via test loader (mirrors main project loader pattern)
// process.env is NEVER accessed in test files — only in loader.js
const { Lib, Config } = require('./loader')();
const DynamoDB = Lib.DynamoDB;
const Instance = Lib.Instance;

// Create a test instance (simulates a real request lifecycle)
const instance = Instance.initialize();

// Test infrastructure: raw AWS SDK client for table setup/teardown
// Not part of the module under test — only used in before/after hooks
// Uses same credentials as the DynamoDB module (both connect to the same target)
const admin_options = {
  region: Config.aws_region,
  credentials: {
    accessKeyId: Config.aws_access_key_id,
    secretAccessKey: Config.aws_secret_access_key
  }
};

// Endpoint is only set for emulated testing (DynamoDB Local)
// For integration testing, this value is undefined — SDK uses real AWS
if (Config.dynamodb_endpoint) {
  admin_options.endpoint = Config.dynamodb_endpoint;
}

const AdminClient = new DynamoDBClient(admin_options);

// Test table names (prefixed with test_ — IAM policy restricts to these)
const TEST_TABLE = 'test_crud';
const TEST_TABLE_COMPOSITE = 'test_composite';


// ============================================================================
// 0. TABLE SETUP / TEARDOWN
// ============================================================================

before(async function () {

  // Create simple table (pk only)
  try {
    await AdminClient.send(new CreateTableCommand({
      TableName: TEST_TABLE,
      AttributeDefinitions: [
        { AttributeName: 'pk', AttributeType: 'S' }
      ],
      KeySchema: [
        { AttributeName: 'pk', KeyType: 'HASH' }
      ],
      BillingMode: 'PAY_PER_REQUEST'
    }));
  }
  catch (err) {
    if (err.name !== 'ResourceInUseException') throw err;
  }

  // Create composite table (pk + sk)
  try {
    await AdminClient.send(new CreateTableCommand({
      TableName: TEST_TABLE_COMPOSITE,
      AttributeDefinitions: [
        { AttributeName: 'pk', AttributeType: 'S' },
        { AttributeName: 'sk', AttributeType: 'S' }
      ],
      KeySchema: [
        { AttributeName: 'pk', KeyType: 'HASH' },
        { AttributeName: 'sk', KeyType: 'RANGE' }
      ],
      BillingMode: 'PAY_PER_REQUEST'
    }));
  }
  catch (err) {
    if (err.name !== 'ResourceInUseException') throw err;
  }

});


after(async function () {

  // Clean up test tables
  try { await AdminClient.send(new DeleteTableCommand({ TableName: TEST_TABLE })); } catch (_) {}
  try { await AdminClient.send(new DeleteTableCommand({ TableName: TEST_TABLE_COMPOSITE })); } catch (_) {}

});



// ============================================================================
// 1. WRITE RECORD
// ============================================================================

describe('writeRecord', function () {

  it('should return success when putting a valid item', async function () {

    const result = await DynamoDB.writeRecord(instance, TEST_TABLE, { pk: 'user_001', name: 'Alice', age: 30 });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.error, null);

  });

  it('should overwrite an existing item with same key', async function () {

    await DynamoDB.writeRecord(instance, TEST_TABLE, { pk: 'user_002', name: 'Bob' });
    const result = await DynamoDB.writeRecord(instance, TEST_TABLE, { pk: 'user_002', name: 'Bob Updated', status: 'active' });

    assert.strictEqual(result.success, true);

    // Verify overwrite
    const get_result = await DynamoDB.getRecord(instance, TEST_TABLE, { pk: 'user_002' });
    assert.strictEqual(get_result.item.name, 'Bob Updated');
    assert.strictEqual(get_result.item.status, 'active');

  });

  it('should write item with composite key', async function () {

    const result = await DynamoDB.writeRecord(instance, TEST_TABLE_COMPOSITE, {
      pk: 'wr_org', sk: 'wr_item_1', name: 'Composite Write'
    });

    assert.strictEqual(result.success, true);

    const get_result = await DynamoDB.getRecord(instance, TEST_TABLE_COMPOSITE, { pk: 'wr_org', sk: 'wr_item_1' });
    assert.strictEqual(get_result.item.name, 'Composite Write');

  });

  it('should write item with various data types', async function () {

    const result = await DynamoDB.writeRecord(instance, TEST_TABLE, {
      pk: 'user_types', name: 'TypeTest', age: 42, active: true, score: 99.5, tags: ['a', 'b']
    });

    assert.strictEqual(result.success, true);

    const get_result = await DynamoDB.getRecord(instance, TEST_TABLE, { pk: 'user_types' });
    assert.strictEqual(get_result.item.age, 42);
    assert.strictEqual(get_result.item.active, true);
    assert.strictEqual(get_result.item.score, 99.5);
    assert.deepStrictEqual(get_result.item.tags, ['a', 'b']);

  });

  it('should write item with nested object', async function () {

    const result = await DynamoDB.writeRecord(instance, TEST_TABLE, {
      pk: 'user_nested', address: { city: 'NYC', zip: '10001' }
    });

    assert.strictEqual(result.success, true);

    const get_result = await DynamoDB.getRecord(instance, TEST_TABLE, { pk: 'user_nested' });
    assert.strictEqual(get_result.item.address.city, 'NYC');
    assert.strictEqual(get_result.item.address.zip, '10001');

  });

});



// ============================================================================
// 2. GET RECORD
// ============================================================================

describe('getRecord', function () {

  it('should return the item when key exists', async function () {

    await DynamoDB.writeRecord(instance, TEST_TABLE, { pk: 'user_get_1', name: 'Charlie' });

    const result = await DynamoDB.getRecord(instance, TEST_TABLE, { pk: 'user_get_1' });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.item.pk, 'user_get_1');
    assert.strictEqual(result.item.name, 'Charlie');
    assert.strictEqual(result.error, null);

  });

  it('should return null item when key does not exist', async function () {

    const result = await DynamoDB.getRecord(instance, TEST_TABLE, { pk: 'nonexistent_key' });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.item, null);

  });

  it('should return item from composite table with full key', async function () {

    await DynamoDB.writeRecord(instance, TEST_TABLE_COMPOSITE, { pk: 'get_org', sk: 'get_sk_1', data: 'found' });

    const result = await DynamoDB.getRecord(instance, TEST_TABLE_COMPOSITE, { pk: 'get_org', sk: 'get_sk_1' });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.item.data, 'found');

  });

  it('should return all stored attributes for an item', async function () {

    await DynamoDB.writeRecord(instance, TEST_TABLE, {
      pk: 'get_full', name: 'Full', age: 30, status: 'active', score: 95.5
    });

    const result = await DynamoDB.getRecord(instance, TEST_TABLE, { pk: 'get_full' });

    assert.strictEqual(result.item.name, 'Full');
    assert.strictEqual(result.item.age, 30);
    assert.strictEqual(result.item.status, 'active');
    assert.strictEqual(result.item.score, 95.5);

  });

});



// ============================================================================
// 3. DELETE RECORD
// ============================================================================

describe('deleteRecord', function () {

  it('should return success when deleting an existing item', async function () {

    await DynamoDB.writeRecord(instance, TEST_TABLE, { pk: 'user_del_1', name: 'ToDelete' });

    const result = await DynamoDB.deleteRecord(instance, TEST_TABLE, { pk: 'user_del_1' });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.error, null);

    // Verify deletion
    const get_result = await DynamoDB.getRecord(instance, TEST_TABLE, { pk: 'user_del_1' });
    assert.strictEqual(get_result.item, null);

  });

  it('should return success when deleting a non-existent key', async function () {

    const result = await DynamoDB.deleteRecord(instance, TEST_TABLE, { pk: 'nonexistent_del' });

    assert.strictEqual(result.success, true);

  });

  it('should delete item from composite table', async function () {

    await DynamoDB.writeRecord(instance, TEST_TABLE_COMPOSITE, { pk: 'del_org', sk: 'del_sk_1', data: 'gone' });

    const result = await DynamoDB.deleteRecord(instance, TEST_TABLE_COMPOSITE, { pk: 'del_org', sk: 'del_sk_1' });

    assert.strictEqual(result.success, true);

    const get_result = await DynamoDB.getRecord(instance, TEST_TABLE_COMPOSITE, { pk: 'del_org', sk: 'del_sk_1' });
    assert.strictEqual(get_result.item, null);

  });

});



// ============================================================================
// 4. UPDATE RECORD (structured builder)
// ============================================================================

describe('updateRecord', function () {

  it('should update using structured builder (SET)', async function () {

    await DynamoDB.writeRecord(instance, TEST_TABLE, { pk: 'ur_1', name: 'Original', age: 20 });

    const result = await DynamoDB.updateRecord(
      instance, TEST_TABLE, { pk: 'ur_1' },
      { name: 'Updated', age: 25 },
      null, null, null,
      'ALL_NEW'
    );

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.attributes.name, 'Updated');
    assert.strictEqual(result.attributes.age, 25);

  });

  it('should increment a counter using builder', async function () {

    await DynamoDB.writeRecord(instance, TEST_TABLE, { pk: 'ur_inc', views: 10 });

    const result = await DynamoDB.updateRecord(
      instance, TEST_TABLE, { pk: 'ur_inc' },
      null, null,
      { views: 5 },
      null,
      'ALL_NEW'
    );

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.attributes.views, 15);

  });

  it('should decrement a counter using builder', async function () {

    await DynamoDB.writeRecord(instance, TEST_TABLE, { pk: 'ur_dec', credits: 100 });

    const result = await DynamoDB.updateRecord(
      instance, TEST_TABLE, { pk: 'ur_dec' },
      null, null, null,
      { credits: 30 },
      'ALL_NEW'
    );

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.attributes.credits, 70);

  });

  it('should remove keys using builder', async function () {

    await DynamoDB.writeRecord(instance, TEST_TABLE, { pk: 'ur_rm', name: 'Frank', temp: 'discard', old: 'gone' });

    const result = await DynamoDB.updateRecord(
      instance, TEST_TABLE, { pk: 'ur_rm' },
      { name: 'Frank' },
      ['temp', 'old'],
      null, null,
      'ALL_NEW'
    );

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.attributes.name, 'Frank');
    assert.strictEqual(result.attributes.temp, undefined);
    assert.strictEqual(result.attributes.old, undefined);

  });

  it('should combine SET + REMOVE + INCREMENT in one call', async function () {

    await DynamoDB.writeRecord(instance, TEST_TABLE, { pk: 'ur_combo', name: 'Grace', status: 'draft', old_field: 'x', views: 5 });

    const result = await DynamoDB.updateRecord(
      instance, TEST_TABLE, { pk: 'ur_combo' },
      { name: 'Grace Updated', status: 'active' },
      ['old_field'],
      { views: 3 },
      null,
      'ALL_NEW'
    );

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.attributes.name, 'Grace Updated');
    assert.strictEqual(result.attributes.status, 'active');
    assert.strictEqual(result.attributes.old_field, undefined);
    assert.strictEqual(result.attributes.views, 8);

  });

  it('should combine SET + DECREMENT in one call', async function () {

    await DynamoDB.writeRecord(instance, TEST_TABLE, { pk: 'ur_set_dec', name: 'Old', balance: 500 });

    const result = await DynamoDB.updateRecord(
      instance, TEST_TABLE, { pk: 'ur_set_dec' },
      { name: 'New' },
      null, null,
      { balance: 100 },
      'ALL_NEW'
    );

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.attributes.name, 'New');
    assert.strictEqual(result.attributes.balance, 400);

  });

  it('should upsert a non-existent item via updateRecord', async function () {

    const result = await DynamoDB.updateRecord(
      instance, TEST_TABLE, { pk: 'ur_upsert' },
      { name: 'Created Via Update', status: 'new' },
      null, null, null,
      'ALL_NEW'
    );

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.attributes.name, 'Created Via Update');
    assert.strictEqual(result.attributes.status, 'new');

  });

  it('should combine all four operations: SET + REMOVE + INCREMENT + DECREMENT', async function () {

    await DynamoDB.writeRecord(instance, TEST_TABLE, {
      pk: 'ur_all4', name: 'Start', temp: 'remove_me', views: 10, credits: 100
    });

    const result = await DynamoDB.updateRecord(
      instance, TEST_TABLE, { pk: 'ur_all4' },
      { name: 'End' },
      ['temp'],
      { views: 5 },
      { credits: 20 },
      'ALL_NEW'
    );

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.attributes.name, 'End');
    assert.strictEqual(result.attributes.temp, undefined);
    assert.strictEqual(result.attributes.views, 15);
    assert.strictEqual(result.attributes.credits, 80);

  });

  it('should update item in composite table', async function () {

    await DynamoDB.writeRecord(instance, TEST_TABLE_COMPOSITE, { pk: 'ur_comp_org', sk: 'ur_comp_sk', name: 'Before' });

    const result = await DynamoDB.updateRecord(
      instance, TEST_TABLE_COMPOSITE, { pk: 'ur_comp_org', sk: 'ur_comp_sk' },
      { name: 'After' },
      null, null, null,
      'ALL_NEW'
    );

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.attributes.name, 'After');

  });

  it('should increment multiple counters simultaneously', async function () {

    await DynamoDB.writeRecord(instance, TEST_TABLE, { pk: 'ur_multi_inc', views: 0, likes: 0, shares: 0 });

    const result = await DynamoDB.updateRecord(
      instance, TEST_TABLE, { pk: 'ur_multi_inc' },
      null, null,
      { views: 10, likes: 5, shares: 2 },
      null,
      'ALL_NEW'
    );

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.attributes.views, 10);
    assert.strictEqual(result.attributes.likes, 5);
    assert.strictEqual(result.attributes.shares, 2);

  });

  it('should return NONE by default (no attributes)', async function () {

    await DynamoDB.writeRecord(instance, TEST_TABLE, { pk: 'ur_none', name: 'Test' });

    const result = await DynamoDB.updateRecord(
      instance, TEST_TABLE, { pk: 'ur_none' },
      { name: 'Updated' }
    );

    assert.strictEqual(result.success, true);

  });

});



// ============================================================================
// 5. QUERY
// ============================================================================

describe('query', function () {

  it('should return items matching partition key', async function () {

    // Seed composite table
    await DynamoDB.writeRecord(instance, TEST_TABLE_COMPOSITE, { pk: 'org_1', sk: 'user_a', name: 'Alpha' });
    await DynamoDB.writeRecord(instance, TEST_TABLE_COMPOSITE, { pk: 'org_1', sk: 'user_b', name: 'Beta' });
    await DynamoDB.writeRecord(instance, TEST_TABLE_COMPOSITE, { pk: 'org_2', sk: 'user_c', name: 'Gamma' });

    const result = await DynamoDB.query(instance, TEST_TABLE_COMPOSITE, {
      pk: 'org_1',
      pkName: 'pk'
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.items.length, 2);
    assert.strictEqual(result.error, null);

  });

  it('should return empty items when partition key has no matches', async function () {

    const result = await DynamoDB.query(instance, TEST_TABLE_COMPOSITE, {
      pk: 'nonexistent_org',
      pkName: 'pk'
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.items.length, 0);
    assert.strictEqual(result.count, 0);

  });

  it('should respect limit parameter', async function () {

    const result = await DynamoDB.query(instance, TEST_TABLE_COMPOSITE, {
      pk: 'org_1',
      pkName: 'pk',
      limit: 1
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.items.length, 1);

  });

  it('should filter by sort key condition (equals)', async function () {

    const result = await DynamoDB.query(instance, TEST_TABLE_COMPOSITE, {
      pk: 'org_1',
      pkName: 'pk',
      skCondition: 'sk = :sk',
      skValues: { ':sk': 'user_a' }
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.items.length, 1);
    assert.strictEqual(result.items[0].name, 'Alpha');

  });

  it('should filter by sort key condition (begins_with)', async function () {

    // Seed items with sort keys that share a prefix
    await DynamoDB.writeRecord(instance, TEST_TABLE_COMPOSITE, { pk: 'prefix_org', sk: 'doc_001', name: 'Doc1' });
    await DynamoDB.writeRecord(instance, TEST_TABLE_COMPOSITE, { pk: 'prefix_org', sk: 'doc_002', name: 'Doc2' });
    await DynamoDB.writeRecord(instance, TEST_TABLE_COMPOSITE, { pk: 'prefix_org', sk: 'img_001', name: 'Img1' });

    const result = await DynamoDB.query(instance, TEST_TABLE_COMPOSITE, {
      pk: 'prefix_org',
      pkName: 'pk',
      skCondition: 'begins_with(sk, :prefix)',
      skValues: { ':prefix': 'doc_' }
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.items.length, 2);

  });

  it('should filter by sort key condition (between)', async function () {

    // Seed items with ordered sort keys
    await DynamoDB.writeRecord(instance, TEST_TABLE_COMPOSITE, { pk: 'between_org', sk: 'a', name: 'A' });
    await DynamoDB.writeRecord(instance, TEST_TABLE_COMPOSITE, { pk: 'between_org', sk: 'b', name: 'B' });
    await DynamoDB.writeRecord(instance, TEST_TABLE_COMPOSITE, { pk: 'between_org', sk: 'c', name: 'C' });
    await DynamoDB.writeRecord(instance, TEST_TABLE_COMPOSITE, { pk: 'between_org', sk: 'd', name: 'D' });

    const result = await DynamoDB.query(instance, TEST_TABLE_COMPOSITE, {
      pk: 'between_org',
      pkName: 'pk',
      skCondition: 'sk BETWEEN :lo AND :hi',
      skValues: { ':lo': 'b', ':hi': 'c' },
      scanForward: true
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.items.length, 2);
    assert.strictEqual(result.items[0].sk, 'b');
    assert.strictEqual(result.items[1].sk, 'c');

  });

  it('should return results in ascending order when scanForward is true', async function () {

    // Seed ordered items
    await DynamoDB.writeRecord(instance, TEST_TABLE_COMPOSITE, { pk: 'sort_org', sk: 'aaa', name: 'First' });
    await DynamoDB.writeRecord(instance, TEST_TABLE_COMPOSITE, { pk: 'sort_org', sk: 'bbb', name: 'Second' });
    await DynamoDB.writeRecord(instance, TEST_TABLE_COMPOSITE, { pk: 'sort_org', sk: 'ccc', name: 'Third' });

    const result_asc = await DynamoDB.query(instance, TEST_TABLE_COMPOSITE, {
      pk: 'sort_org',
      pkName: 'pk',
      scanForward: true
    });

    assert.strictEqual(result_asc.success, true);
    assert.strictEqual(result_asc.items[0].sk, 'aaa');
    assert.strictEqual(result_asc.items[2].sk, 'ccc');

    // Default descending
    const result_desc = await DynamoDB.query(instance, TEST_TABLE_COMPOSITE, {
      pk: 'sort_org',
      pkName: 'pk'
    });

    assert.strictEqual(result_desc.items[0].sk, 'ccc');
    assert.strictEqual(result_desc.items[2].sk, 'aaa');

  });

  it('should support pagination with startKey and last_key', async function () {

    // Seed 10 items
    for (let i = 0; i < 10; i++) {
      await DynamoDB.writeRecord(instance, TEST_TABLE_COMPOSITE, {
        pk: 'page_org',
        sk: 'item_' + String(i).padStart(3, '0'),
        name: 'Page Item ' + i
      });
    }

    // Page 1: limit 3
    const page1 = await DynamoDB.query(instance, TEST_TABLE_COMPOSITE, {
      pk: 'page_org',
      pkName: 'pk',
      limit: 3,
      scanForward: true
    });

    assert.strictEqual(page1.success, true);
    assert.strictEqual(page1.items.length, 3);
    assert.notStrictEqual(page1.last_key, null);

    // Page 2: use last_key from page 1
    const page2 = await DynamoDB.query(instance, TEST_TABLE_COMPOSITE, {
      pk: 'page_org',
      pkName: 'pk',
      limit: 3,
      startKey: page1.last_key,
      scanForward: true
    });

    assert.strictEqual(page2.success, true);
    assert.strictEqual(page2.items.length, 3);

    // Page 2 should start after page 1
    assert.notStrictEqual(page2.items[0].sk, page1.items[2].sk);

    // Continue paging until no more data
    let all_items = [...page1.items, ...page2.items];
    let last_key = page2.last_key;

    while (last_key !== null) {

      const next_page = await DynamoDB.query(instance, TEST_TABLE_COMPOSITE, {
        pk: 'page_org',
        pkName: 'pk',
        limit: 3,
        startKey: last_key,
        scanForward: true
      });

      all_items = all_items.concat(next_page.items);
      last_key = next_page.last_key;

    }

    // All 10 items should be retrieved
    assert.strictEqual(all_items.length, 10);

  });

  it('should project only requested fields', async function () {

    await DynamoDB.writeRecord(instance, TEST_TABLE_COMPOSITE, {
      pk: 'proj_org', sk: 'proj_1', name: 'Projected', secret: 'hidden', age: 42
    });

    const result = await DynamoDB.query(instance, TEST_TABLE_COMPOSITE, {
      pk: 'proj_org',
      pkName: 'pk',
      fields: ['pk', 'sk'],
      skCondition: 'sk = :sk',
      skValues: { ':sk': 'proj_1' }
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.items.length, 1);
    assert.strictEqual(result.items[0].pk, 'proj_org');
    assert.strictEqual(result.items[0].sk, 'proj_1');
    // Projected fields only — secret and age should be absent
    assert.strictEqual(result.items[0].secret, undefined);
    assert.strictEqual(result.items[0].age, undefined);

  });

  it('should return single item when querying with exact pk + sk', async function () {

    await DynamoDB.writeRecord(instance, TEST_TABLE_COMPOSITE, { pk: 'exact_org', sk: 'exact_sk', name: 'Exact Match' });

    const result = await DynamoDB.query(instance, TEST_TABLE_COMPOSITE, {
      pk: 'exact_org',
      pkName: 'pk',
      skCondition: 'sk = :sk',
      skValues: { ':sk': 'exact_sk' }
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.items.length, 1);
    assert.strictEqual(result.items[0].name, 'Exact Match');

  });

  it('should return last_key as null when all results fit in one page', async function () {

    await DynamoDB.writeRecord(instance, TEST_TABLE_COMPOSITE, { pk: 'nopage_org', sk: 'a', name: 'Only' });

    const result = await DynamoDB.query(instance, TEST_TABLE_COMPOSITE, {
      pk: 'nopage_org',
      pkName: 'pk',
      limit: 100
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.last_key, null);

  });

});



// ============================================================================
// 6. COUNT
// ============================================================================

describe('count', function () {

  it('should return count of items matching partition key', async function () {

    // Seed composite table with known data
    await DynamoDB.writeRecord(instance, TEST_TABLE_COMPOSITE, { pk: 'count_org', sk: 'a', name: 'A' });
    await DynamoDB.writeRecord(instance, TEST_TABLE_COMPOSITE, { pk: 'count_org', sk: 'b', name: 'B' });

    const result = await DynamoDB.count(instance, TEST_TABLE_COMPOSITE, {
      pk: 'count_org',
      pkName: 'pk'
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.count, 2);

  });

  it('should return zero for non-existent partition key', async function () {

    const result = await DynamoDB.count(instance, TEST_TABLE_COMPOSITE, {
      pk: 'count_nonexistent',
      pkName: 'pk'
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.count, 0);

  });

  it('should count with sort key condition', async function () {

    await DynamoDB.writeRecord(instance, TEST_TABLE_COMPOSITE, { pk: 'count_sk_org', sk: 'doc_1', name: 'D1' });
    await DynamoDB.writeRecord(instance, TEST_TABLE_COMPOSITE, { pk: 'count_sk_org', sk: 'doc_2', name: 'D2' });
    await DynamoDB.writeRecord(instance, TEST_TABLE_COMPOSITE, { pk: 'count_sk_org', sk: 'img_1', name: 'I1' });

    const result = await DynamoDB.count(instance, TEST_TABLE_COMPOSITE, {
      pk: 'count_sk_org',
      pkName: 'pk',
      skCondition: 'begins_with(sk, :prefix)',
      skValues: { ':prefix': 'doc_' }
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.count, 2);

  });

});



// ============================================================================
// 7. SCAN
// ============================================================================

describe('scan', function () {

  it('should return all items in a table', async function () {

    const result = await DynamoDB.scan(instance, TEST_TABLE);

    assert.strictEqual(result.success, true);
    assert.ok(result.items.length > 0);
    assert.strictEqual(result.error, null);

  });

  it('should filter items with filter expression', async function () {

    // Seed specific data
    await DynamoDB.writeRecord(instance, TEST_TABLE, { pk: 'scan_f1', status: 'active' });
    await DynamoDB.writeRecord(instance, TEST_TABLE, { pk: 'scan_f2', status: 'inactive' });

    const result = await DynamoDB.scan(instance, TEST_TABLE, {
      expression: '#status = :status',
      names: { '#status': 'status' },
      values: { ':status': 'active' }
    });

    assert.strictEqual(result.success, true);
    assert.ok(result.items.length >= 1);

    // All returned items should have status 'active'
    result.items.forEach(function (item) {
      assert.strictEqual(item.status, 'active');
    });

  });

  it('should return count matching items array length', async function () {

    const result = await DynamoDB.scan(instance, TEST_TABLE);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.count, result.items.length);

  });

  it('should return empty results for filter that matches nothing', async function () {

    const result = await DynamoDB.scan(instance, TEST_TABLE, {
      expression: '#pk = :pk',
      names: { '#pk': 'pk' },
      values: { ':pk': 'absolutely_no_match_ever_xyz_999' }
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.items.length, 0);
    assert.strictEqual(result.count, 0);

  });

});



// ============================================================================
// 8. COMMAND BUILDERS (pure, no I/O)
// ============================================================================

describe('commandBuilderForAddRecord', function () {

  it('should return service params with TableName and Item', function () {

    const params = DynamoDB.commandBuilderForAddRecord('my_table', { pk: 'u1', name: 'Test' });

    assert.strictEqual(params.TableName, 'my_table');
    assert.strictEqual(params.Item.pk, 'u1');
    assert.strictEqual(params.Item.name, 'Test');

  });

  it('should preserve all item fields in output', function () {

    const params = DynamoDB.commandBuilderForAddRecord('t', {
      pk: 'x', name: 'Y', age: 10, active: true, tags: ['a']
    });

    assert.strictEqual(params.Item.age, 10);
    assert.strictEqual(params.Item.active, true);
    assert.deepStrictEqual(params.Item.tags, ['a']);

  });

});


describe('commandBuilderForDeleteRecord', function () {

  it('should return service params with TableName and Key', function () {

    const params = DynamoDB.commandBuilderForDeleteRecord('my_table', { pk: 'u1' });

    assert.strictEqual(params.TableName, 'my_table');
    assert.strictEqual(params.Key.pk, 'u1');

  });

  it('should support composite key', function () {

    const params = DynamoDB.commandBuilderForDeleteRecord('t', { pk: 'org', sk: 'item' });

    assert.strictEqual(params.Key.pk, 'org');
    assert.strictEqual(params.Key.sk, 'item');

  });

});


describe('commandBuilderForUpdateRecord', function () {

  it('should build SET expression for update_data', function () {

    const params = DynamoDB.commandBuilderForUpdateRecord(
      'my_table', { pk: 'u1' },
      { name: 'Updated', age: 30 }
    );

    assert.ok(params.UpdateExpression.includes('SET'));
    assert.ok(params.UpdateExpression.includes('#n1 = :v1'));
    assert.ok(params.UpdateExpression.includes('#n2 = :v2'));
    assert.strictEqual(params.ExpressionAttributeNames['#n1'], 'name');
    assert.strictEqual(params.ExpressionAttributeValues[':v1'], 'Updated');
    assert.strictEqual(params.ExpressionAttributeValues[':v2'], 30);
    assert.strictEqual(params.ReturnValues, 'NONE');

  });

  it('should build INCREMENT expression', function () {

    const params = DynamoDB.commandBuilderForUpdateRecord(
      'my_table', { pk: 'u1' },
      null, null,
      { view_count: 1 }
    );

    assert.ok(params.UpdateExpression.includes('#n1 = #n1 + :v1'));
    assert.strictEqual(params.ExpressionAttributeNames['#n1'], 'view_count');
    assert.strictEqual(params.ExpressionAttributeValues[':v1'], 1);

  });

  it('should build DECREMENT expression', function () {

    const params = DynamoDB.commandBuilderForUpdateRecord(
      'my_table', { pk: 'u1' },
      null, null, null,
      { credits: 5 }
    );

    assert.ok(params.UpdateExpression.includes('#n1 = #n1 - :v1'));
    assert.strictEqual(params.ExpressionAttributeNames['#n1'], 'credits');
    assert.strictEqual(params.ExpressionAttributeValues[':v1'], 5);

  });

  it('should build REMOVE expression', function () {

    const params = DynamoDB.commandBuilderForUpdateRecord(
      'my_table', { pk: 'u1' },
      null, ['temp_field', 'old_field']
    );

    assert.ok(params.UpdateExpression.includes('REMOVE'));
    assert.strictEqual(params.ExpressionAttributeNames['#n1'], 'temp_field');
    assert.strictEqual(params.ExpressionAttributeNames['#n2'], 'old_field');

  });

  it('should combine SET and REMOVE in one expression', function () {

    const params = DynamoDB.commandBuilderForUpdateRecord(
      'my_table', { pk: 'u1' },
      { name: 'New' },
      ['old_field']
    );

    assert.ok(params.UpdateExpression.includes('SET'));
    assert.ok(params.UpdateExpression.includes('REMOVE'));

  });

  it('should override ReturnValues when return_state is provided', function () {

    const params = DynamoDB.commandBuilderForUpdateRecord(
      'my_table', { pk: 'u1' },
      { name: 'New' },
      null, null, null,
      'ALL_NEW'
    );

    assert.strictEqual(params.ReturnValues, 'ALL_NEW');

  });

  it('should combine all four operations in one expression', function () {

    const params = DynamoDB.commandBuilderForUpdateRecord(
      'my_table', { pk: 'u1' },
      { name: 'X' },
      ['temp'],
      { views: 1 },
      { credits: 5 }
    );

    assert.ok(params.UpdateExpression.includes('SET'));
    assert.ok(params.UpdateExpression.includes('REMOVE'));
    // SET should contain name, views increment, credits decrement
    assert.strictEqual(params.ExpressionAttributeNames['#n1'], 'name');
    assert.strictEqual(params.ExpressionAttributeNames['#n2'], 'views');
    assert.strictEqual(params.ExpressionAttributeNames['#n3'], 'credits');
    // REMOVE should contain temp
    assert.strictEqual(params.ExpressionAttributeNames['#n4'], 'temp');

  });

  it('should support composite key', function () {

    const params = DynamoDB.commandBuilderForUpdateRecord(
      'my_table', { pk: 'org', sk: 'item' },
      { status: 'done' }
    );

    assert.strictEqual(params.Key.pk, 'org');
    assert.strictEqual(params.Key.sk, 'item');

  });

});



// ============================================================================
// 9. BATCH GET RECORDS
// ============================================================================

describe('batchGetRecords', function () {

  it('should return multiple items by keys', async function () {

    await DynamoDB.writeRecord(instance, TEST_TABLE, { pk: 'batch_g1', name: 'One' });
    await DynamoDB.writeRecord(instance, TEST_TABLE, { pk: 'batch_g2', name: 'Two' });

    const result = await DynamoDB.batchGetRecords(instance, {
      [TEST_TABLE]: [{ pk: 'batch_g1' }, { pk: 'batch_g2' }]
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.items[TEST_TABLE].length, 2);
    assert.strictEqual(result.error, null);

  });

  it('should return empty array for missing keys', async function () {

    const result = await DynamoDB.batchGetRecords(instance, {
      [TEST_TABLE]: [{ pk: 'batch_missing_1' }, { pk: 'batch_missing_2' }]
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.items[TEST_TABLE].length, 0);

  });

  it('should return items from multiple tables', async function () {

    await DynamoDB.writeRecord(instance, TEST_TABLE, { pk: 'bg_multi_1', name: 'Table1' });
    await DynamoDB.writeRecord(instance, TEST_TABLE_COMPOSITE, { pk: 'bg_multi_1', sk: 'sk_1', name: 'Table2' });

    const result = await DynamoDB.batchGetRecords(instance, {
      [TEST_TABLE]: [{ pk: 'bg_multi_1' }],
      [TEST_TABLE_COMPOSITE]: [{ pk: 'bg_multi_1', sk: 'sk_1' }]
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.items[TEST_TABLE].length, 1);
    assert.strictEqual(result.items[TEST_TABLE_COMPOSITE].length, 1);

  });

  it('should return single item for single key request', async function () {

    await DynamoDB.writeRecord(instance, TEST_TABLE, { pk: 'bg_single', name: 'Solo' });

    const result = await DynamoDB.batchGetRecords(instance, {
      [TEST_TABLE]: [{ pk: 'bg_single' }]
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.items[TEST_TABLE].length, 1);
    assert.strictEqual(result.items[TEST_TABLE][0].name, 'Solo');

  });

  it('should return mix of found and not-found keys', async function () {

    await DynamoDB.writeRecord(instance, TEST_TABLE, { pk: 'bg_mix_found', name: 'Exists' });

    const result = await DynamoDB.batchGetRecords(instance, {
      [TEST_TABLE]: [{ pk: 'bg_mix_found' }, { pk: 'bg_mix_missing' }]
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.items[TEST_TABLE].length, 1);

  });

});



// ============================================================================
// 10. BATCH WRITE AND DELETE RECORDS
// ============================================================================

describe('batchWriteAndDeleteRecords', function () {

  it('should put multiple items in a single batch', async function () {

    const result = await DynamoDB.batchWriteAndDeleteRecords(instance, {
      [TEST_TABLE]: [
        { put: { pk: 'bw_1', name: 'Batch One' } },
        { put: { pk: 'bw_2', name: 'Batch Two' } }
      ]
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.error, null);

    // Verify both items exist
    const g1 = await DynamoDB.getRecord(instance, TEST_TABLE, { pk: 'bw_1' });
    const g2 = await DynamoDB.getRecord(instance, TEST_TABLE, { pk: 'bw_2' });
    assert.strictEqual(g1.item.name, 'Batch One');
    assert.strictEqual(g2.item.name, 'Batch Two');

  });

  it('should delete items in a batch', async function () {

    await DynamoDB.writeRecord(instance, TEST_TABLE, { pk: 'bw_del_1', name: 'Delete Me' });

    const result = await DynamoDB.batchWriteAndDeleteRecords(instance, {
      [TEST_TABLE]: [
        { delete: { pk: 'bw_del_1' } }
      ]
    });

    assert.strictEqual(result.success, true);

    // Verify deletion
    const get_result = await DynamoDB.getRecord(instance, TEST_TABLE, { pk: 'bw_del_1' });
    assert.strictEqual(get_result.item, null);

  });

  it('should mix put and delete in one batch', async function () {

    await DynamoDB.writeRecord(instance, TEST_TABLE, { pk: 'bw_mix_del', name: 'Old Item' });

    const result = await DynamoDB.batchWriteAndDeleteRecords(instance, {
      [TEST_TABLE]: [
        { put: { pk: 'bw_mix_add', name: 'New Item' } },
        { delete: { pk: 'bw_mix_del' } }
      ]
    });

    assert.strictEqual(result.success, true);

    const added = await DynamoDB.getRecord(instance, TEST_TABLE, { pk: 'bw_mix_add' });
    const deleted = await DynamoDB.getRecord(instance, TEST_TABLE, { pk: 'bw_mix_del' });
    assert.strictEqual(added.item.name, 'New Item');
    assert.strictEqual(deleted.item, null);

  });

  it('should work across multiple tables', async function () {

    const result = await DynamoDB.batchWriteAndDeleteRecords(instance, {
      [TEST_TABLE]: [
        { put: { pk: 'bw_cross_1', name: 'Table1' } }
      ],
      [TEST_TABLE_COMPOSITE]: [
        { put: { pk: 'bw_cross_1', sk: 'sk_1', name: 'Table2' } }
      ]
    });

    assert.strictEqual(result.success, true);

    const g1 = await DynamoDB.getRecord(instance, TEST_TABLE, { pk: 'bw_cross_1' });
    const g2 = await DynamoDB.getRecord(instance, TEST_TABLE_COMPOSITE, { pk: 'bw_cross_1', sk: 'sk_1' });
    assert.strictEqual(g1.item.name, 'Table1');
    assert.strictEqual(g2.item.name, 'Table2');

  });

});



// ============================================================================
// 11. BATCH WRITE RECORDS (25-item chunking)
// ============================================================================

describe('batchWriteRecords', function () {

  it('should add multiple items across tables', async function () {

    const result = await DynamoDB.batchWriteRecords(instance, {
      [TEST_TABLE]: [
        { pk: 'abr_1', name: 'Batch A' },
        { pk: 'abr_2', name: 'Batch B' },
        { pk: 'abr_3', name: 'Batch C' }
      ]
    });

    assert.strictEqual(result.success, true);

    // Verify all items exist
    const g1 = await DynamoDB.getRecord(instance, TEST_TABLE, { pk: 'abr_1' });
    const g2 = await DynamoDB.getRecord(instance, TEST_TABLE, { pk: 'abr_2' });
    const g3 = await DynamoDB.getRecord(instance, TEST_TABLE, { pk: 'abr_3' });
    assert.strictEqual(g1.item.name, 'Batch A');
    assert.strictEqual(g2.item.name, 'Batch B');
    assert.strictEqual(g3.item.name, 'Batch C');

  });

  it('should write exactly 25 items (boundary - single chunk)', async function () {

    const items = [];
    for (let i = 0; i < 25; i++) {
      items.push({ pk: 'bw25_' + String(i).padStart(2, '0'), name: 'Item ' + i });
    }

    const result = await DynamoDB.batchWriteRecords(instance, { [TEST_TABLE]: items });

    assert.strictEqual(result.success, true);

    const first = await DynamoDB.getRecord(instance, TEST_TABLE, { pk: 'bw25_00' });
    const last = await DynamoDB.getRecord(instance, TEST_TABLE, { pk: 'bw25_24' });
    assert.strictEqual(first.item.name, 'Item 0');
    assert.strictEqual(last.item.name, 'Item 24');

  });

  it('should handle more than 25 items via auto-chunking', async function () {

    // Generate 60 items — requires 3 chunks (25 + 25 + 10)
    const items = [];
    for (let i = 0; i < 60; i++) {
      items.push({ pk: 'chunk_' + String(i).padStart(3, '0'), name: 'Chunked Item ' + i });
    }

    const result = await DynamoDB.batchWriteRecords(instance, {
      [TEST_TABLE]: items
    });

    assert.strictEqual(result.success, true);

    // Verify first, middle, and last items
    const first = await DynamoDB.getRecord(instance, TEST_TABLE, { pk: 'chunk_000' });
    const middle = await DynamoDB.getRecord(instance, TEST_TABLE, { pk: 'chunk_030' });
    const last = await DynamoDB.getRecord(instance, TEST_TABLE, { pk: 'chunk_059' });
    assert.strictEqual(first.item.name, 'Chunked Item 0');
    assert.strictEqual(middle.item.name, 'Chunked Item 30');
    assert.strictEqual(last.item.name, 'Chunked Item 59');

  });

  it('should write single item', async function () {

    const result = await DynamoDB.batchWriteRecords(instance, {
      [TEST_TABLE]: [{ pk: 'bw_single_1', name: 'Single' }]
    });

    assert.strictEqual(result.success, true);

    const get_result = await DynamoDB.getRecord(instance, TEST_TABLE, { pk: 'bw_single_1' });
    assert.strictEqual(get_result.item.name, 'Single');

  });

});



// ============================================================================
// 12. BATCH DELETE RECORDS (25-item chunking)
// ============================================================================

describe('batchDeleteRecords', function () {

  it('should delete multiple items', async function () {

    // Seed data
    await DynamoDB.batchWriteRecords(instance, {
      [TEST_TABLE]: [
        { pk: 'dbr_1', name: 'Delete A' },
        { pk: 'dbr_2', name: 'Delete B' }
      ]
    });

    // Delete them
    const result = await DynamoDB.batchDeleteRecords(instance, {
      [TEST_TABLE]: [
        { pk: 'dbr_1' },
        { pk: 'dbr_2' }
      ]
    });

    assert.strictEqual(result.success, true);

    // Verify deletion
    const g1 = await DynamoDB.getRecord(instance, TEST_TABLE, { pk: 'dbr_1' });
    const g2 = await DynamoDB.getRecord(instance, TEST_TABLE, { pk: 'dbr_2' });
    assert.strictEqual(g1.item, null);
    assert.strictEqual(g2.item, null);

  });

  it('should delete exactly 25 items (boundary - single chunk)', async function () {

    const items = [];
    for (let i = 0; i < 25; i++) {
      items.push({ pk: 'bd25_' + String(i).padStart(2, '0'), name: 'Del ' + i });
    }
    await DynamoDB.batchWriteRecords(instance, { [TEST_TABLE]: items });

    const keys = items.map(function (item) { return { pk: item.pk }; });
    const result = await DynamoDB.batchDeleteRecords(instance, { [TEST_TABLE]: keys });

    assert.strictEqual(result.success, true);

    const first = await DynamoDB.getRecord(instance, TEST_TABLE, { pk: 'bd25_00' });
    const last = await DynamoDB.getRecord(instance, TEST_TABLE, { pk: 'bd25_24' });
    assert.strictEqual(first.item, null);
    assert.strictEqual(last.item, null);

  });

  it('should handle more than 25 deletes via auto-chunking', async function () {

    // Seed 50 items
    const items = [];
    for (let i = 0; i < 50; i++) {
      items.push({ pk: 'del_chunk_' + String(i).padStart(3, '0'), name: 'To Delete ' + i });
    }
    await DynamoDB.batchWriteRecords(instance, { [TEST_TABLE]: items });

    // Delete all 50 — requires 2 chunks (25 + 25)
    const keys = items.map(function (item) { return { pk: item.pk }; });
    const result = await DynamoDB.batchDeleteRecords(instance, { [TEST_TABLE]: keys });

    assert.strictEqual(result.success, true);

    // Verify first and last are deleted
    const first = await DynamoDB.getRecord(instance, TEST_TABLE, { pk: 'del_chunk_000' });
    const last = await DynamoDB.getRecord(instance, TEST_TABLE, { pk: 'del_chunk_049' });
    assert.strictEqual(first.item, null);
    assert.strictEqual(last.item, null);

  });

  it('should delete single item', async function () {

    await DynamoDB.writeRecord(instance, TEST_TABLE, { pk: 'bd_single', name: 'Gone' });

    const result = await DynamoDB.batchDeleteRecords(instance, {
      [TEST_TABLE]: [{ pk: 'bd_single' }]
    });

    assert.strictEqual(result.success, true);

    const get_result = await DynamoDB.getRecord(instance, TEST_TABLE, { pk: 'bd_single' });
    assert.strictEqual(get_result.item, null);

  });

});



// ============================================================================
// 13. TRANSACT WRITE RECORDS
// ============================================================================

describe('transactWriteRecords', function () {

  it('should execute transaction with a single put action', async function () {

    const cmd = DynamoDB.commandBuilderForAddRecord(TEST_TABLE, { pk: 'tx_single_1', name: 'Single Transact' });

    const result = await DynamoDB.transactWriteRecords(instance, [cmd], null, null);
    assert.strictEqual(result.success, true);

    const get_result = await DynamoDB.getRecord(instance, TEST_TABLE, { pk: 'tx_single_1' });
    assert.strictEqual(get_result.item.name, 'Single Transact');

  });

  it('should execute atomic transaction with put and delete', async function () {

    // Build commands using command builders
    const add_cmd = DynamoDB.commandBuilderForAddRecord(TEST_TABLE, { pk: 'tx_add_1', name: 'Transact Add' });
    const delete_cmd = DynamoDB.commandBuilderForDeleteRecord(TEST_TABLE, { pk: 'tx_add_1' });

    // First add the item
    const add_result = await DynamoDB.transactWriteRecords(instance, [add_cmd], null, null);
    assert.strictEqual(add_result.success, true);

    // Verify item was added
    const get_result = await DynamoDB.getRecord(instance, TEST_TABLE, { pk: 'tx_add_1' });
    assert.strictEqual(get_result.item.name, 'Transact Add');

    // Now delete it via transaction
    const del_result = await DynamoDB.transactWriteRecords(instance, null, null, [delete_cmd]);
    assert.strictEqual(del_result.success, true);

    // Verify item was deleted
    const verify = await DynamoDB.getRecord(instance, TEST_TABLE, { pk: 'tx_add_1' });
    assert.strictEqual(verify.item, null);

  });

  it('should execute atomic transaction with multiple puts', async function () {

    const cmd1 = DynamoDB.commandBuilderForAddRecord(TEST_TABLE, { pk: 'tx_multi_1', name: 'One' });
    const cmd2 = DynamoDB.commandBuilderForAddRecord(TEST_TABLE, { pk: 'tx_multi_2', name: 'Two' });

    const result = await DynamoDB.transactWriteRecords(instance, [cmd1, cmd2], null, null);
    assert.strictEqual(result.success, true);

    // Verify both items exist
    const g1 = await DynamoDB.getRecord(instance, TEST_TABLE, { pk: 'tx_multi_1' });
    const g2 = await DynamoDB.getRecord(instance, TEST_TABLE, { pk: 'tx_multi_2' });
    assert.strictEqual(g1.item.name, 'One');
    assert.strictEqual(g2.item.name, 'Two');

  });

  it('should execute transaction with exactly 10 actions', async function () {

    const commands = [];
    for (let i = 0; i < 10; i++) {
      commands.push(DynamoDB.commandBuilderForAddRecord(TEST_TABLE, {
        pk: 'tx_max_' + i,
        name: 'Max Action ' + i
      }));
    }

    const result = await DynamoDB.transactWriteRecords(instance, commands, null, null);
    assert.strictEqual(result.success, true);

    // Verify all 10 items exist
    for (let i = 0; i < 10; i++) {
      const get_result = await DynamoDB.getRecord(instance, TEST_TABLE, { pk: 'tx_max_' + i });
      assert.strictEqual(get_result.item.name, 'Max Action ' + i);
    }

  });

  it('should fail when exceeding 100 actions (AWS limit)', async function () {

    // Build more than 100 Put commands — AWS TransactWriteItems rejects > 100
    const commands = [];
    for (let i = 0; i < 101; i++) {
      commands.push(DynamoDB.commandBuilderForAddRecord(TEST_TABLE, {
        pk: 'tx_over_' + i,
        name: 'Over Limit ' + i
      }));
    }

    const result = await DynamoDB.transactWriteRecords(instance, commands, null, null);
    assert.strictEqual(result.success, false);
    assert.notStrictEqual(result.error, null);

  });

  it('should execute transaction with mixed put, update, and delete', async function () {

    // Seed an item to update and one to delete
    await DynamoDB.writeRecord(instance, TEST_TABLE, { pk: 'tx_mix_upd', name: 'Before Update', status: 'old' });
    await DynamoDB.writeRecord(instance, TEST_TABLE, { pk: 'tx_mix_del', name: 'To Delete' });

    // Build mixed commands
    const add_cmd = DynamoDB.commandBuilderForAddRecord(TEST_TABLE, { pk: 'tx_mix_add', name: 'New' });
    const update_cmd = DynamoDB.commandBuilderForUpdateRecord(
      TEST_TABLE, { pk: 'tx_mix_upd' },
      { name: 'After Update', status: 'new' }
    );
    const delete_cmd = DynamoDB.commandBuilderForDeleteRecord(TEST_TABLE, { pk: 'tx_mix_del' });

    const result = await DynamoDB.transactWriteRecords(instance, [add_cmd], [update_cmd], [delete_cmd]);
    assert.strictEqual(result.success, true);

    // Verify add
    const added = await DynamoDB.getRecord(instance, TEST_TABLE, { pk: 'tx_mix_add' });
    assert.strictEqual(added.item.name, 'New');

    // Verify update
    const updated = await DynamoDB.getRecord(instance, TEST_TABLE, { pk: 'tx_mix_upd' });
    assert.strictEqual(updated.item.name, 'After Update');
    assert.strictEqual(updated.item.status, 'new');

    // Verify delete
    const deleted = await DynamoDB.getRecord(instance, TEST_TABLE, { pk: 'tx_mix_del' });
    assert.strictEqual(deleted.item, null);

  });

  it('should execute update-only transaction', async function () {

    await DynamoDB.writeRecord(instance, TEST_TABLE, { pk: 'tx_upd_only_1', name: 'Before1' });
    await DynamoDB.writeRecord(instance, TEST_TABLE, { pk: 'tx_upd_only_2', name: 'Before2' });

    const upd1 = DynamoDB.commandBuilderForUpdateRecord(TEST_TABLE, { pk: 'tx_upd_only_1' }, { name: 'After1' });
    const upd2 = DynamoDB.commandBuilderForUpdateRecord(TEST_TABLE, { pk: 'tx_upd_only_2' }, { name: 'After2' });

    const result = await DynamoDB.transactWriteRecords(instance, null, [upd1, upd2], null);
    assert.strictEqual(result.success, true);

    const g1 = await DynamoDB.getRecord(instance, TEST_TABLE, { pk: 'tx_upd_only_1' });
    const g2 = await DynamoDB.getRecord(instance, TEST_TABLE, { pk: 'tx_upd_only_2' });
    assert.strictEqual(g1.item.name, 'After1');
    assert.strictEqual(g2.item.name, 'After2');

  });

  it('should execute delete-only transaction', async function () {

    await DynamoDB.writeRecord(instance, TEST_TABLE, { pk: 'tx_del_only_1', name: 'Gone1' });
    await DynamoDB.writeRecord(instance, TEST_TABLE, { pk: 'tx_del_only_2', name: 'Gone2' });

    const del1 = DynamoDB.commandBuilderForDeleteRecord(TEST_TABLE, { pk: 'tx_del_only_1' });
    const del2 = DynamoDB.commandBuilderForDeleteRecord(TEST_TABLE, { pk: 'tx_del_only_2' });

    const result = await DynamoDB.transactWriteRecords(instance, null, null, [del1, del2]);
    assert.strictEqual(result.success, true);

    const g1 = await DynamoDB.getRecord(instance, TEST_TABLE, { pk: 'tx_del_only_1' });
    const g2 = await DynamoDB.getRecord(instance, TEST_TABLE, { pk: 'tx_del_only_2' });
    assert.strictEqual(g1.item, null);
    assert.strictEqual(g2.item, null);

  });

  it('should execute transaction across multiple tables', async function () {

    const add1 = DynamoDB.commandBuilderForAddRecord(TEST_TABLE, { pk: 'tx_cross_1', name: 'CrossTable1' });
    const add2 = DynamoDB.commandBuilderForAddRecord(TEST_TABLE_COMPOSITE, { pk: 'tx_cross_org', sk: 'tx_cross_sk', name: 'CrossTable2' });

    const result = await DynamoDB.transactWriteRecords(instance, [add1, add2], null, null);
    assert.strictEqual(result.success, true);

    const g1 = await DynamoDB.getRecord(instance, TEST_TABLE, { pk: 'tx_cross_1' });
    const g2 = await DynamoDB.getRecord(instance, TEST_TABLE_COMPOSITE, { pk: 'tx_cross_org', sk: 'tx_cross_sk' });
    assert.strictEqual(g1.item.name, 'CrossTable1');
    assert.strictEqual(g2.item.name, 'CrossTable2');

  });

  it('should execute transaction with increment in update command', async function () {

    await DynamoDB.writeRecord(instance, TEST_TABLE, { pk: 'tx_inc', views: 10, name: 'Counter' });

    const upd_cmd = DynamoDB.commandBuilderForUpdateRecord(
      TEST_TABLE, { pk: 'tx_inc' },
      null, null,
      { views: 5 }
    );

    const result = await DynamoDB.transactWriteRecords(instance, null, [upd_cmd], null);
    assert.strictEqual(result.success, true);

    const get_result = await DynamoDB.getRecord(instance, TEST_TABLE, { pk: 'tx_inc' });
    assert.strictEqual(get_result.item.views, 15);

  });

  it('should execute transaction with decrement and remove in update command', async function () {

    await DynamoDB.writeRecord(instance, TEST_TABLE, { pk: 'tx_dec_rm', credits: 100, temp: 'discard', name: 'Mixed' });

    const upd_cmd = DynamoDB.commandBuilderForUpdateRecord(
      TEST_TABLE, { pk: 'tx_dec_rm' },
      null,
      ['temp'],
      null,
      { credits: 25 }
    );

    const result = await DynamoDB.transactWriteRecords(instance, null, [upd_cmd], null);
    assert.strictEqual(result.success, true);

    const get_result = await DynamoDB.getRecord(instance, TEST_TABLE, { pk: 'tx_dec_rm' });
    assert.strictEqual(get_result.item.credits, 75);
    assert.strictEqual(get_result.item.temp, undefined);
    assert.strictEqual(get_result.item.name, 'Mixed');

  });

});



// ============================================================================
// 14. LARGE-SCALE DATA (1000 records) - scan, query, batch operations
// ============================================================================

describe('large-scale operations (1000 records)', function () {

  it('should write 1000 records via batchWriteRecords', async function () {

    // Generate 1000 items in composite table under one partition key
    const items = [];
    for (let i = 0; i < 1000; i++) {
      items.push({
        pk: 'large_org',
        sk: 'rec_' + String(i).padStart(4, '0'),
        category: (i % 3 === 0) ? 'alpha' : (i % 3 === 1) ? 'beta' : 'gamma',
        value: i
      });
    }

    const write_result = await DynamoDB.batchWriteRecords(instance, {
      [TEST_TABLE_COMPOSITE]: items
    });

    assert.strictEqual(write_result.success, true);

  });

  it('should query all 1000 records by partition key', async function () {

    const query_result = await DynamoDB.query(instance, TEST_TABLE_COMPOSITE, {
      pk: 'large_org',
      pkName: 'pk'
    });

    assert.strictEqual(query_result.success, true);
    assert.strictEqual(query_result.count, 1000);

  });

  it('should query 1000 records with pagination (50 per page)', async function () {

    let all_items = [];
    let last_key = null;
    let page_count = 0;

    // Paginate through all 1000 records, 50 at a time
    do {

      const params = {
        pk: 'large_org',
        pkName: 'pk',
        limit: 50,
        scanForward: true
      };

      if (last_key !== null) {
        params.startKey = last_key;
      }

      const result = await DynamoDB.query(instance, TEST_TABLE_COMPOSITE, params);
      assert.strictEqual(result.success, true);

      all_items = all_items.concat(result.items);
      last_key = result.last_key;
      page_count++;

    } while (last_key !== null);

    assert.strictEqual(all_items.length, 1000);
    assert.ok(page_count >= 20, 'should require at least 20 pages for 1000 records with limit 50');

    // Verify ascending order
    assert.strictEqual(all_items[0].sk, 'rec_0000');
    assert.strictEqual(all_items[999].sk, 'rec_0999');

  });

  it('should query with sort key range on large dataset', async function () {

    const result = await DynamoDB.query(instance, TEST_TABLE_COMPOSITE, {
      pk: 'large_org',
      pkName: 'pk',
      skCondition: 'sk BETWEEN :lo AND :hi',
      skValues: { ':lo': 'rec_0100', ':hi': 'rec_0199' },
      scanForward: true
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.items.length, 100);
    assert.strictEqual(result.items[0].sk, 'rec_0100');
    assert.strictEqual(result.items[99].sk, 'rec_0199');

  });

  it('should count 1000 records by partition key', async function () {

    const result = await DynamoDB.count(instance, TEST_TABLE_COMPOSITE, {
      pk: 'large_org',
      pkName: 'pk'
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.count, 1000);

  });

  it('should scan composite table and return large-scale results', async function () {

    const result = await DynamoDB.scan(instance, TEST_TABLE_COMPOSITE);

    assert.strictEqual(result.success, true);
    // Table has items from multiple tests + 1000 large-scale items
    assert.ok(result.items.length >= 1000);

  });

  it('should scan with filter on large dataset', async function () {

    const result = await DynamoDB.scan(instance, TEST_TABLE_COMPOSITE, {
      expression: '#cat = :cat AND #pk = :pk',
      names: { '#cat': 'category', '#pk': 'pk' },
      values: { ':cat': 'alpha', ':pk': 'large_org' }
    });

    assert.strictEqual(result.success, true);
    // Category 'alpha' = every 3rd item (i % 3 === 0): indices 0,3,6,...,999 = 334 items
    assert.strictEqual(result.items.length, 334);

  });

  it('should batchGetRecords for selected items from large dataset', async function () {

    // Pick 10 specific keys from the 1000 records
    const keys = [];
    for (let i = 0; i < 10; i++) {
      keys.push({ pk: 'large_org', sk: 'rec_' + String(i * 100).padStart(4, '0') });
    }

    const result = await DynamoDB.batchGetRecords(instance, {
      [TEST_TABLE_COMPOSITE]: keys
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.items[TEST_TABLE_COMPOSITE].length, 10);

  });

  it('should batchGetRecords for 100 items from large dataset', async function () {

    const keys = [];
    for (let i = 0; i < 100; i++) {
      keys.push({ pk: 'large_org', sk: 'rec_' + String(i * 10).padStart(4, '0') });
    }

    const result = await DynamoDB.batchGetRecords(instance, {
      [TEST_TABLE_COMPOSITE]: keys
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.items[TEST_TABLE_COMPOSITE].length, 100);

  });

  it('should batchDeleteRecords for all 1000 records via auto-chunking', async function () {

    // Build keys for all 1000 records
    const keys = [];
    for (let i = 0; i < 1000; i++) {
      keys.push({ pk: 'large_org', sk: 'rec_' + String(i).padStart(4, '0') });
    }

    const result = await DynamoDB.batchDeleteRecords(instance, {
      [TEST_TABLE_COMPOSITE]: keys
    });

    assert.strictEqual(result.success, true);

    // Verify partition key is empty
    const query_result = await DynamoDB.query(instance, TEST_TABLE_COMPOSITE, {
      pk: 'large_org',
      pkName: 'pk'
    });

    assert.strictEqual(query_result.count, 0);

  });

});
