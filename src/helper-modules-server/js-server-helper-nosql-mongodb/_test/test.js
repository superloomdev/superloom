// Tests for js-server-helper-nosql-mongodb
// Works with both emulated (local MongoDB) and integration (real MongoDB) testing
// Config comes from environment variables via loader.js
'use strict';

const assert = require('node:assert/strict');
const { describe, it, before, after } = require('node:test');
const { MongoClient } = require('mongodb');

// Load all dependencies and config via test loader (mirrors main project loader pattern)
// process.env is NEVER accessed in test files — only in loader.js
const { Lib, Config } = require('./loader')();
const MongoDB = Lib.MongoDB;
const Instance = Lib.Instance;

// Create a test instance (simulates a real request lifecycle)
const instance = Instance.initialize();

// Test collection names (prefixed with test_ for isolation)
const TEST_COLLECTION = 'test_crud';
const TEST_COLLECTION_2 = 'test_second';
const TEST_COLLECTION_3 = 'test_batch';

// Native client for admin operations (drop collections)
let nativeClient = null;
let nativeDb = null;


// ============================================================================
// 0. COLLECTION SETUP / TEARDOWN
// ============================================================================

before(async function () {

  // Connect native client for admin operations
  nativeClient = new MongoClient(Config.mongodb_connection_string);
  await nativeClient.connect();
  nativeDb = nativeClient.db(Config.mongodb_database);

  // Drop test collections (ignore errors if they don't exist)
  try { await nativeDb.dropCollection(TEST_COLLECTION); } catch (_e) { /* ignore */ }
  try { await nativeDb.dropCollection(TEST_COLLECTION_2); } catch (_e) { /* ignore */ }
  try { await nativeDb.dropCollection(TEST_COLLECTION_3); } catch (_e) { /* ignore */ }

});

after(async function () {

  // Drop test collections
  try { await nativeDb.dropCollection(TEST_COLLECTION); } catch (_e) { /* ignore */ }
  try { await nativeDb.dropCollection(TEST_COLLECTION_2); } catch (_e) { /* ignore */ }
  try { await nativeDb.dropCollection(TEST_COLLECTION_3); } catch (_e) { /* ignore */ }

  // Close connections
  await MongoDB.close(instance);
  await nativeClient.close();

});


// ============================================================================
// 1. FACTORY PATTERN
// ============================================================================

describe('Factory Pattern', function () {

  it('should create independent instances', function () {

    const { Lib: Lib2 } = require('./loader')();
    const MongoDB2 = Lib2.MongoDB;

    assert.notStrictEqual(MongoDB, MongoDB2, 'Instances should be independent');
    assert.strictEqual(typeof MongoDB.getRecord, 'function');
    assert.strictEqual(typeof MongoDB2.getRecord, 'function');
  });

  it('should have all 14 required methods', function () {

    const methods = [
      'getRecord', 'writeRecord', 'deleteRecord', 'updateRecord',
      'query', 'count', 'scan',
      'deleteRecordsByFilter',
      'batchGetRecords', 'batchWriteAndDeleteRecords', 'batchWriteRecords', 'batchDeleteRecords',
      'transactWriteRecords',
      'close'
    ];
    methods.forEach(function (m) {
      assert.strictEqual(typeof MongoDB[m], 'function', 'Should have ' + m);
    });
  });

});


// ============================================================================
// 2. GET RECORD
// ============================================================================

describe('getRecord', function () {

  it('should find a single document by _id', async function () {

    await MongoDB.writeRecord(instance, TEST_COLLECTION, { _id: 'gr1' }, { _id: 'gr1', name: 'GetMe', value: 42 });

    const result = await MongoDB.getRecord(instance, TEST_COLLECTION, { _id: 'gr1' });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.document.name, 'GetMe');
    assert.strictEqual(result.document.value, 42);
  });

  it('should return null document when not found', async function () {

    const result = await MongoDB.getRecord(instance, TEST_COLLECTION, { _id: 'nonexistent' });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.document, null);
  });

  it('should find by non-_id filter', async function () {

    await MongoDB.writeRecord(instance, TEST_COLLECTION, { _id: 'gr2' }, { _id: 'gr2', email: 'unique@test.com' });

    const result = await MongoDB.getRecord(instance, TEST_COLLECTION, { email: 'unique@test.com' });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.document._id, 'gr2');
  });

  it('should support projection option', async function () {

    await MongoDB.writeRecord(instance, TEST_COLLECTION, { _id: 'gr3' }, { _id: 'gr3', name: 'Projected', secret: 'hidden' });

    const result = await MongoDB.getRecord(instance, TEST_COLLECTION, { _id: 'gr3' }, { projection: { name: 1 } });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.document.name, 'Projected');
    assert.strictEqual(result.document.secret, undefined, 'Projected-out field should be absent');
  });

});


// ============================================================================
// 3. WRITE RECORD (UPSERT)
// ============================================================================

describe('writeRecord', function () {

  it('should insert a new document when filter matches nothing', async function () {

    const result = await MongoDB.writeRecord(
      instance, TEST_COLLECTION,
      { _id: 'wr1' },
      { _id: 'wr1', name: 'New Record', value: 100 }
    );
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.matchedCount, 0);
    assert.ok(result.upsertedId !== null);

    const get = await MongoDB.getRecord(instance, TEST_COLLECTION, { _id: 'wr1' });
    assert.strictEqual(get.document.name, 'New Record');
    assert.strictEqual(get.document.value, 100);
  });

  it('should replace an existing document (full overwrite)', async function () {

    await MongoDB.writeRecord(instance, TEST_COLLECTION,
      { _id: 'wr2' },
      { _id: 'wr2', name: 'Before', value: 200, extra: 'drop' }
    );

    const result = await MongoDB.writeRecord(instance, TEST_COLLECTION,
      { _id: 'wr2' },
      { _id: 'wr2', name: 'After', value: 300 }
    );
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.matchedCount, 1);
    assert.strictEqual(result.upsertedId, null);

    const get = await MongoDB.getRecord(instance, TEST_COLLECTION, { _id: 'wr2' });
    assert.strictEqual(get.document.name, 'After');
    assert.strictEqual(get.document.value, 300);
    assert.strictEqual(get.document.extra, undefined, 'Extra field should be gone');
  });

  it('should write document with nested objects', async function () {

    const doc = {
      _id: 'wr3',
      name: 'Nested',
      meta: { tags: ['a', 'b'], score: 99 },
      list: [1, 2, 3]
    };
    const result = await MongoDB.writeRecord(instance, TEST_COLLECTION, { _id: 'wr3' }, doc);
    assert.strictEqual(result.success, true);

    const get = await MongoDB.getRecord(instance, TEST_COLLECTION, { _id: 'wr3' });
    assert.deepStrictEqual(get.document.meta, { tags: ['a', 'b'], score: 99 });
    assert.deepStrictEqual(get.document.list, [1, 2, 3]);
  });

  it('should write document with various data types', async function () {

    const doc = {
      _id: 'wr4',
      str: 'hello',
      num: 42,
      float: 3.14,
      bool: true,
      nil: null,
      date: new Date('2025-01-01T00:00:00Z')
    };
    const result = await MongoDB.writeRecord(instance, TEST_COLLECTION, { _id: 'wr4' }, doc);
    assert.strictEqual(result.success, true);

    const get = await MongoDB.getRecord(instance, TEST_COLLECTION, { _id: 'wr4' });
    assert.strictEqual(get.document.str, 'hello');
    assert.strictEqual(get.document.num, 42);
    assert.strictEqual(get.document.float, 3.14);
    assert.strictEqual(get.document.bool, true);
    assert.strictEqual(get.document.nil, null);
  });

  it('should write to a second collection', async function () {

    const result = await MongoDB.writeRecord(instance, TEST_COLLECTION_2,
      { _id: 'wr_other' },
      { _id: 'wr_other', value: 'second' }
    );
    assert.strictEqual(result.success, true);

    const get = await MongoDB.getRecord(instance, TEST_COLLECTION_2, { _id: 'wr_other' });
    assert.strictEqual(get.document.value, 'second');
  });

});


// ============================================================================
// 4. DELETE RECORD
// ============================================================================

describe('deleteRecord', function () {

  it('should delete a document', async function () {

    await MongoDB.writeRecord(instance, TEST_COLLECTION, { _id: 'dr1' }, { _id: 'dr1', name: 'To Delete' });

    const result = await MongoDB.deleteRecord(instance, TEST_COLLECTION, { _id: 'dr1' });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.deletedCount, 1);

    const get = await MongoDB.getRecord(instance, TEST_COLLECTION, { _id: 'dr1' });
    assert.strictEqual(get.document, null);
  });

  it('should return deletedCount 0 for non-existent document', async function () {

    const result = await MongoDB.deleteRecord(instance, TEST_COLLECTION, { _id: 'nonexistent_del' });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.deletedCount, 0);
  });

  it('should delete by non-_id filter', async function () {

    await MongoDB.writeRecord(instance, TEST_COLLECTION, { _id: 'dr2' }, { _id: 'dr2', marker: 'delete_me_unique' });

    const result = await MongoDB.deleteRecord(instance, TEST_COLLECTION, { marker: 'delete_me_unique' });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.deletedCount, 1);
  });

});


// ============================================================================
// 5. UPDATE RECORD
// ============================================================================

describe('updateRecord', function () {

  it('should update fields with $set', async function () {

    await MongoDB.writeRecord(instance, TEST_COLLECTION, { _id: 'ur1' }, { _id: 'ur1', name: 'Original', value: 10 });

    const result = await MongoDB.updateRecord(instance, TEST_COLLECTION,
      { _id: 'ur1' },
      { $set: { name: 'Updated', value: 20 } }
    );
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.modifiedCount, 1);

    const get = await MongoDB.getRecord(instance, TEST_COLLECTION, { _id: 'ur1' });
    assert.strictEqual(get.document.name, 'Updated');
    assert.strictEqual(get.document.value, 20);
  });

  it('should increment with $inc', async function () {

    await MongoDB.writeRecord(instance, TEST_COLLECTION, { _id: 'ur2' }, { _id: 'ur2', counter: 10 });

    const result = await MongoDB.updateRecord(instance, TEST_COLLECTION,
      { _id: 'ur2' },
      { $inc: { counter: 5 } }
    );
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.modifiedCount, 1);

    const get = await MongoDB.getRecord(instance, TEST_COLLECTION, { _id: 'ur2' });
    assert.strictEqual(get.document.counter, 15);
  });

  it('should decrement with $inc (negative)', async function () {

    const result = await MongoDB.updateRecord(instance, TEST_COLLECTION,
      { _id: 'ur2' },
      { $inc: { counter: -3 } }
    );
    assert.strictEqual(result.success, true);

    const get = await MongoDB.getRecord(instance, TEST_COLLECTION, { _id: 'ur2' });
    assert.strictEqual(get.document.counter, 12);
  });

  it('should remove fields with $unset', async function () {

    await MongoDB.writeRecord(instance, TEST_COLLECTION, { _id: 'ur3' }, { _id: 'ur3', name: 'Test', temp: 'remove_me' });

    const result = await MongoDB.updateRecord(instance, TEST_COLLECTION,
      { _id: 'ur3' },
      { $unset: { temp: '' } }
    );
    assert.strictEqual(result.success, true);

    const get = await MongoDB.getRecord(instance, TEST_COLLECTION, { _id: 'ur3' });
    assert.strictEqual(get.document.name, 'Test');
    assert.strictEqual(get.document.temp, undefined);
  });

  it('should push to array with $push', async function () {

    await MongoDB.writeRecord(instance, TEST_COLLECTION, { _id: 'ur4' }, { _id: 'ur4', tags: ['a'] });

    await MongoDB.updateRecord(instance, TEST_COLLECTION,
      { _id: 'ur4' },
      { $push: { tags: 'b' } }
    );

    const get = await MongoDB.getRecord(instance, TEST_COLLECTION, { _id: 'ur4' });
    assert.deepStrictEqual(get.document.tags, ['a', 'b']);
  });

  it('should pull from array with $pull', async function () {

    await MongoDB.updateRecord(instance, TEST_COLLECTION,
      { _id: 'ur4' },
      { $pull: { tags: 'a' } }
    );

    const get = await MongoDB.getRecord(instance, TEST_COLLECTION, { _id: 'ur4' });
    assert.deepStrictEqual(get.document.tags, ['b']);
  });

  it('should rename field with $rename', async function () {

    await MongoDB.writeRecord(instance, TEST_COLLECTION, { _id: 'ur5' }, { _id: 'ur5', old_name: 'value' });

    await MongoDB.updateRecord(instance, TEST_COLLECTION,
      { _id: 'ur5' },
      { $rename: { old_name: 'new_name' } }
    );

    const get = await MongoDB.getRecord(instance, TEST_COLLECTION, { _id: 'ur5' });
    assert.strictEqual(get.document.new_name, 'value');
    assert.strictEqual(get.document.old_name, undefined);
  });

  it('should return modifiedCount 0 for non-existent document', async function () {

    const result = await MongoDB.updateRecord(instance, TEST_COLLECTION,
      { _id: 'nonexistent_update' },
      { $set: { name: 'Ghost' } }
    );
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.modifiedCount, 0);
  });

  it('should combine $set and $inc in one update', async function () {

    await MongoDB.writeRecord(instance, TEST_COLLECTION, { _id: 'ur6' }, { _id: 'ur6', name: 'Combo', views: 0 });

    await MongoDB.updateRecord(instance, TEST_COLLECTION,
      { _id: 'ur6' },
      { $set: { name: 'ComboUpdated' }, $inc: { views: 1 } }
    );

    const get = await MongoDB.getRecord(instance, TEST_COLLECTION, { _id: 'ur6' });
    assert.strictEqual(get.document.name, 'ComboUpdated');
    assert.strictEqual(get.document.views, 1);
  });

});


// ============================================================================
// 6. QUERY
// ============================================================================

describe('query', function () {

  before(async function () {

    // Seed data for query tests
    const docs = [];
    for (let i = 0; i < 100; i++) {
      docs.push({ _id: 'q_bulk_' + i, index: i, category: i % 2 === 0 ? 'even' : 'odd' });
    }
    await nativeDb.collection(TEST_COLLECTION).insertMany(docs);

    await MongoDB.writeRecord(instance, TEST_COLLECTION, { _id: 'q_multi' }, { _id: 'q_multi', category: 'X', status: 'active' });
    await MongoDB.writeRecord(instance, TEST_COLLECTION, { _id: 'q_multi2' }, { _id: 'q_multi2', category: 'X', status: 'inactive' });
  });

  it('should find multiple documents matching filter', async function () {

    const result = await MongoDB.query(instance, TEST_COLLECTION, { category: 'even' });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.documents.length, 50);
  });

  it('should return empty array when no documents match', async function () {

    const result = await MongoDB.query(instance, TEST_COLLECTION, { category: 'NONEXISTENT' });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.documents.length, 0);
  });

  it('should support limit option', async function () {

    const result = await MongoDB.query(instance, TEST_COLLECTION, { category: 'even' }, { limit: 5 });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.documents.length, 5);
  });

  it('should support sort option', async function () {

    const result = await MongoDB.query(instance, TEST_COLLECTION, { category: 'even' }, { sort: { index: -1 }, limit: 3 });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.documents.length, 3);
    assert.ok(result.documents[0].index > result.documents[1].index, 'Should be descending');
  });

  it('should support projection option', async function () {

    const result = await MongoDB.query(instance, TEST_COLLECTION, { category: 'X' }, { projection: { category: 1 } });
    assert.strictEqual(result.success, true);
    result.documents.forEach(function (doc) {
      assert.ok(doc.category, 'Should have category');
      assert.strictEqual(doc.status, undefined, 'Should not have status (projected out)');
    });
  });

  it('should support multi-field filter', async function () {

    const result = await MongoDB.query(instance, TEST_COLLECTION, { category: 'X', status: 'active' });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.documents.length, 1);
    assert.strictEqual(result.documents[0]._id, 'q_multi');
  });

  it('should throw TypeError when filter is empty object', async function () {

    await assert.rejects(
      async function () { await MongoDB.query(instance, TEST_COLLECTION, {}); },
      { name: 'TypeError', message: /non-empty filter/ }
    );
  });

  it('should throw TypeError when filter is null', async function () {

    await assert.rejects(
      async function () { await MongoDB.query(instance, TEST_COLLECTION, null); },
      { name: 'TypeError', message: /non-empty filter/ }
    );
  });

  it('should throw TypeError when filter is undefined', async function () {

    await assert.rejects(
      async function () { await MongoDB.query(instance, TEST_COLLECTION); },
      { name: 'TypeError', message: /non-empty filter/ }
    );
  });

});


// ============================================================================
// 7. COUNT
// ============================================================================

describe('count', function () {

  it('should count documents matching filter', async function () {

    const result = await MongoDB.count(instance, TEST_COLLECTION, { category: 'even' });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.count, 50, 'Should count 50 even documents');
  });

  it('should return zero for non-matching filter', async function () {

    const result = await MongoDB.count(instance, TEST_COLLECTION, { category: 'NONEXISTENT' });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.count, 0);
  });

  it('should count with multi-field filter', async function () {

    const result = await MongoDB.count(instance, TEST_COLLECTION, { category: 'X', status: 'active' });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.count, 1);
  });

  it('should throw TypeError when filter is empty object', async function () {

    await assert.rejects(
      async function () { await MongoDB.count(instance, TEST_COLLECTION, {}); },
      { name: 'TypeError', message: /non-empty filter/ }
    );
  });

  it('should throw TypeError when filter is null', async function () {

    await assert.rejects(
      async function () { await MongoDB.count(instance, TEST_COLLECTION, null); },
      { name: 'TypeError', message: /non-empty filter/ }
    );
  });

});


// ============================================================================
// 8. SCAN
// ============================================================================

describe('scan', function () {

  it('should return all documents when no filter provided', async function () {

    const result = await MongoDB.scan(instance, TEST_COLLECTION);
    assert.strictEqual(result.success, true);
    assert.ok(result.documents.length > 100, 'Should return many documents');
    assert.strictEqual(result.count, result.documents.length, 'Count should match documents length');
  });

  it('should return all documents when filter is null', async function () {

    const result = await MongoDB.scan(instance, TEST_COLLECTION, null);
    assert.strictEqual(result.success, true);
    assert.ok(result.documents.length > 100);
  });

  it('should return filtered documents when filter provided', async function () {

    const result = await MongoDB.scan(instance, TEST_COLLECTION, { category: 'odd' });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.count, 50, 'Should find 50 odd documents');
    result.documents.forEach(function (doc) {
      assert.strictEqual(doc.category, 'odd');
    });
  });

  it('should return empty array for non-matching filter', async function () {

    const result = await MongoDB.scan(instance, TEST_COLLECTION, { category: 'NOPE' });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.documents.length, 0);
    assert.strictEqual(result.count, 0);
  });

  it('should support options (limit, sort)', async function () {

    const result = await MongoDB.scan(instance, TEST_COLLECTION, { category: 'even' }, { limit: 5, sort: { index: 1 } });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.count, 5);
    assert.ok(result.documents[0].index < result.documents[4].index, 'Should be ascending');
  });

  it('should scan a different collection', async function () {

    const result = await MongoDB.scan(instance, TEST_COLLECTION_2);
    assert.strictEqual(result.success, true);
    assert.ok(result.count >= 1, 'TEST_COLLECTION_2 should have at least 1 doc');
  });

});


// ============================================================================
// 9. DELETE RECORDS BY FILTER (MongoDB-unique)
// ============================================================================

describe('deleteRecordsByFilter', function () {

  it('should delete multiple documents matching filter', async function () {

    // Seed 5 docs with same marker
    for (let i = 0; i < 5; i++) {
      await MongoDB.writeRecord(instance, TEST_COLLECTION,
        { _id: 'drf_' + i },
        { _id: 'drf_' + i, marker: 'filter_delete' }
      );
    }

    const result = await MongoDB.deleteRecordsByFilter(instance, TEST_COLLECTION, { marker: 'filter_delete' });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.deletedCount, 5);
  });

  it('should return deletedCount 0 when no documents match', async function () {

    const result = await MongoDB.deleteRecordsByFilter(instance, TEST_COLLECTION, { marker: 'nothing_here' });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.deletedCount, 0);
  });

  it('should throw TypeError when filter is empty object', async function () {

    await assert.rejects(
      async function () { await MongoDB.deleteRecordsByFilter(instance, TEST_COLLECTION, {}); },
      { name: 'TypeError', message: /non-empty filter/ }
    );
  });

  it('should throw TypeError when filter is null', async function () {

    await assert.rejects(
      async function () { await MongoDB.deleteRecordsByFilter(instance, TEST_COLLECTION, null); },
      { name: 'TypeError', message: /non-empty filter/ }
    );
  });

});


// ============================================================================
// 10. BATCH GET RECORDS (multi-collection)
// ============================================================================

describe('batchGetRecords', function () {

  before(async function () {

    // Seed data in two collections for batch get
    await MongoDB.writeRecord(instance, TEST_COLLECTION, { _id: 'bg1' }, { _id: 'bg1', name: 'Batch 1' });
    await MongoDB.writeRecord(instance, TEST_COLLECTION, { _id: 'bg2' }, { _id: 'bg2', name: 'Batch 2' });
    await MongoDB.writeRecord(instance, TEST_COLLECTION_2, { _id: 'bg_s1' }, { _id: 'bg_s1', name: 'Second 1' });
  });

  it('should get records from a single collection', async function () {

    const result = await MongoDB.batchGetRecords(instance, {
      [TEST_COLLECTION]: ['bg1', 'bg2']
    });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.documents[TEST_COLLECTION].length, 2);
  });

  it('should get records from multiple collections', async function () {

    const result = await MongoDB.batchGetRecords(instance, {
      [TEST_COLLECTION]: ['bg1', 'bg2'],
      [TEST_COLLECTION_2]: ['bg_s1']
    });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.documents[TEST_COLLECTION].length, 2);
    assert.strictEqual(result.documents[TEST_COLLECTION_2].length, 1);
    assert.strictEqual(result.documents[TEST_COLLECTION_2][0].name, 'Second 1');
  });

  it('should return empty array for non-existent ids', async function () {

    const result = await MongoDB.batchGetRecords(instance, {
      [TEST_COLLECTION]: ['nonexistent_1', 'nonexistent_2']
    });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.documents[TEST_COLLECTION].length, 0);
  });

  it('should handle mixed existing and non-existing ids', async function () {

    const result = await MongoDB.batchGetRecords(instance, {
      [TEST_COLLECTION]: ['bg1', 'nonexistent_x']
    });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.documents[TEST_COLLECTION].length, 1);
    assert.strictEqual(result.documents[TEST_COLLECTION][0]._id, 'bg1');
  });

});


// ============================================================================
// 11. BATCH WRITE AND DELETE RECORDS (multi-collection)
// ============================================================================

describe('batchWriteAndDeleteRecords', function () {

  it('should insert and delete in one call (single collection)', async function () {

    // Seed a doc to delete
    await MongoDB.writeRecord(instance, TEST_COLLECTION, { _id: 'bwd_del' }, { _id: 'bwd_del', name: 'Delete Me' });

    const result = await MongoDB.batchWriteAndDeleteRecords(instance, {
      [TEST_COLLECTION]: [
        { put: { _id: 'bwd_new1', name: 'New 1' } },
        { put: { _id: 'bwd_new2', name: 'New 2' } },
        { delete: { _id: 'bwd_del' } }
      ]
    });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.results[TEST_COLLECTION].insertedCount, 2);
    assert.strictEqual(result.results[TEST_COLLECTION].deletedCount, 1);

    // Verify inserted
    const get1 = await MongoDB.getRecord(instance, TEST_COLLECTION, { _id: 'bwd_new1' });
    assert.strictEqual(get1.document.name, 'New 1');

    // Verify deleted
    const getDel = await MongoDB.getRecord(instance, TEST_COLLECTION, { _id: 'bwd_del' });
    assert.strictEqual(getDel.document, null);
  });

  it('should work across multiple collections', async function () {

    const result = await MongoDB.batchWriteAndDeleteRecords(instance, {
      [TEST_COLLECTION]: [
        { put: { _id: 'bwd_cross1', name: 'Cross 1' } }
      ],
      [TEST_COLLECTION_2]: [
        { put: { _id: 'bwd_cross2', name: 'Cross 2' } }
      ]
    });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.results[TEST_COLLECTION].insertedCount, 1);
    assert.strictEqual(result.results[TEST_COLLECTION_2].insertedCount, 1);
  });

});


// ============================================================================
// 12. BATCH WRITE RECORDS (multi-collection)
// ============================================================================

describe('batchWriteRecords', function () {

  it('should insert documents into a single collection', async function () {

    const result = await MongoDB.batchWriteRecords(instance, {
      [TEST_COLLECTION]: [
        { _id: 'bwr1', name: 'Batch W 1' },
        { _id: 'bwr2', name: 'Batch W 2' },
        { _id: 'bwr3', name: 'Batch W 3' }
      ]
    });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.results[TEST_COLLECTION].insertedCount, 3);
  });

  it('should insert documents across multiple collections', async function () {

    const result = await MongoDB.batchWriteRecords(instance, {
      [TEST_COLLECTION]: [
        { _id: 'bwr_mc1', name: 'Multi 1' }
      ],
      [TEST_COLLECTION_2]: [
        { _id: 'bwr_mc2', name: 'Multi 2' },
        { _id: 'bwr_mc3', name: 'Multi 3' }
      ]
    });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.results[TEST_COLLECTION].insertedCount, 1);
    assert.strictEqual(result.results[TEST_COLLECTION_2].insertedCount, 2);

    // Verify
    const get = await MongoDB.getRecord(instance, TEST_COLLECTION_2, { _id: 'bwr_mc2' });
    assert.strictEqual(get.document.name, 'Multi 2');
  });

  it('should insert 100 documents in batch', async function () {

    const docs = [];
    for (let i = 0; i < 100; i++) {
      docs.push({ _id: 'bwr_bulk_' + i, index: i });
    }
    const result = await MongoDB.batchWriteRecords(instance, {
      [TEST_COLLECTION_3]: docs
    });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.results[TEST_COLLECTION_3].insertedCount, 100);
  });

});


// ============================================================================
// 13. BATCH DELETE RECORDS (multi-collection)
// ============================================================================

describe('batchDeleteRecords', function () {

  before(async function () {

    // Seed data for batch delete
    await MongoDB.writeRecord(instance, TEST_COLLECTION, { _id: 'bd1' }, { _id: 'bd1', name: 'Delete 1' });
    await MongoDB.writeRecord(instance, TEST_COLLECTION, { _id: 'bd2' }, { _id: 'bd2', name: 'Delete 2' });
    await MongoDB.writeRecord(instance, TEST_COLLECTION_2, { _id: 'bd_s1' }, { _id: 'bd_s1', name: 'Delete S1' });
  });

  it('should delete records from a single collection', async function () {

    const result = await MongoDB.batchDeleteRecords(instance, {
      [TEST_COLLECTION]: ['bd1', 'bd2']
    });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.results[TEST_COLLECTION].deletedCount, 2);

    // Verify deleted
    const get = await MongoDB.getRecord(instance, TEST_COLLECTION, { _id: 'bd1' });
    assert.strictEqual(get.document, null);
  });

  it('should delete records from multiple collections', async function () {

    // Seed fresh data
    await MongoDB.writeRecord(instance, TEST_COLLECTION, { _id: 'bd_mc1' }, { _id: 'bd_mc1', name: 'MC Del 1' });
    await MongoDB.writeRecord(instance, TEST_COLLECTION_2, { _id: 'bd_mc2' }, { _id: 'bd_mc2', name: 'MC Del 2' });

    const result = await MongoDB.batchDeleteRecords(instance, {
      [TEST_COLLECTION]: ['bd_mc1'],
      [TEST_COLLECTION_2]: ['bd_mc2', 'bd_s1']
    });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.results[TEST_COLLECTION].deletedCount, 1);
    assert.strictEqual(result.results[TEST_COLLECTION_2].deletedCount, 2);
  });

  it('should return deletedCount 0 for non-existent ids', async function () {

    const result = await MongoDB.batchDeleteRecords(instance, {
      [TEST_COLLECTION]: ['nonexistent_bd']
    });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.results[TEST_COLLECTION].deletedCount, 0);
  });

});


// ============================================================================
// 14. TRANSACT WRITE RECORDS
// ============================================================================

describe('transactWriteRecords', function () {

  it('should commit a successful transaction', async function () {

    // Seed accounts
    await MongoDB.writeRecord(instance, TEST_COLLECTION, { _id: 'txn_acc1' }, { _id: 'txn_acc1', balance: 100 });
    await MongoDB.writeRecord(instance, TEST_COLLECTION, { _id: 'txn_acc2' }, { _id: 'txn_acc2', balance: 50 });

    const result = await MongoDB.transactWriteRecords(instance, async function (session, db) {

      await db.collection(TEST_COLLECTION).updateOne(
        { _id: 'txn_acc1' },
        { $inc: { balance: -30 } },
        { session }
      );

      await db.collection(TEST_COLLECTION).updateOne(
        { _id: 'txn_acc2' },
        { $inc: { balance: 30 } },
        { session }
      );

      return { transferred: 30 };

    });

    assert.strictEqual(result.success, true);

    // Verify balances
    const acc1 = await MongoDB.getRecord(instance, TEST_COLLECTION, { _id: 'txn_acc1' });
    const acc2 = await MongoDB.getRecord(instance, TEST_COLLECTION, { _id: 'txn_acc2' });
    assert.strictEqual(acc1.document.balance, 70);
    assert.strictEqual(acc2.document.balance, 80);
  });

  it('should roll back on error', async function () {

    // Seed account
    await MongoDB.writeRecord(instance, TEST_COLLECTION, { _id: 'txn_rb1' }, { _id: 'txn_rb1', balance: 200 });

    const result = await MongoDB.transactWriteRecords(instance, async function (session, db) {

      await db.collection(TEST_COLLECTION).updateOne(
        { _id: 'txn_rb1' },
        { $inc: { balance: -50 } },
        { session }
      );

      // Force an error to trigger rollback
      throw new Error('Intentional failure');

    });

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error.type, 'TRANSACTION_ERROR');

    // Verify balance is unchanged (rolled back)
    const acc = await MongoDB.getRecord(instance, TEST_COLLECTION, { _id: 'txn_rb1' });
    assert.strictEqual(acc.document.balance, 200);
  });

  it('should work across multiple collections', async function () {

    await MongoDB.writeRecord(instance, TEST_COLLECTION, { _id: 'txn_cross1' }, { _id: 'txn_cross1', value: 10 });
    await MongoDB.writeRecord(instance, TEST_COLLECTION_2, { _id: 'txn_cross2' }, { _id: 'txn_cross2', value: 20 });

    const result = await MongoDB.transactWriteRecords(instance, async function (session, db) {

      await db.collection(TEST_COLLECTION).updateOne(
        { _id: 'txn_cross1' },
        { $set: { value: 99 } },
        { session }
      );

      await db.collection(TEST_COLLECTION_2).updateOne(
        { _id: 'txn_cross2' },
        { $set: { value: 88 } },
        { session }
      );

    });

    assert.strictEqual(result.success, true);

    const g1 = await MongoDB.getRecord(instance, TEST_COLLECTION, { _id: 'txn_cross1' });
    const g2 = await MongoDB.getRecord(instance, TEST_COLLECTION_2, { _id: 'txn_cross2' });
    assert.strictEqual(g1.document.value, 99);
    assert.strictEqual(g2.document.value, 88);
  });

  it('should support insert and delete in a transaction', async function () {

    await MongoDB.writeRecord(instance, TEST_COLLECTION, { _id: 'txn_del' }, { _id: 'txn_del', name: 'To Delete' });

    const result = await MongoDB.transactWriteRecords(instance, async function (session, db) {

      await db.collection(TEST_COLLECTION).insertOne(
        { _id: 'txn_ins', name: 'Inserted' },
        { session }
      );

      await db.collection(TEST_COLLECTION).deleteOne(
        { _id: 'txn_del' },
        { session }
      );

    });

    assert.strictEqual(result.success, true);

    const ins = await MongoDB.getRecord(instance, TEST_COLLECTION, { _id: 'txn_ins' });
    assert.strictEqual(ins.document.name, 'Inserted');

    const del = await MongoDB.getRecord(instance, TEST_COLLECTION, { _id: 'txn_del' });
    assert.strictEqual(del.document, null);
  });

});


// ============================================================================
// 15. CLOSE
// ============================================================================

describe('close', function () {

  it('should close without error', async function () {

    // Create a separate instance to test close without affecting other tests
    const { Lib: Lib3 } = require('./loader')();
    const MongoDB3 = Lib3.MongoDB;
    const instance3 = Lib3.Instance.initialize();

    // Force connection by performing an operation
    await MongoDB3.scan(instance3, TEST_COLLECTION);

    const result = await MongoDB3.close(instance3);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.error, null);
  });

  it('should handle double-close gracefully', async function () {

    const { Lib: Lib4 } = require('./loader')();
    const MongoDB4 = Lib4.MongoDB;
    const instance4 = Lib4.Instance.initialize();

    await MongoDB4.scan(instance4, TEST_COLLECTION);
    await MongoDB4.close(instance4);

    // Second close should not throw
    const result = await MongoDB4.close(instance4);
    assert.strictEqual(result.success, true);
  });

});


// ============================================================================
// 16. LARGE-SCALE OPERATIONS (1000 records)
// ============================================================================

describe('large-scale operations (1000 records)', function () {

  const LARGE_COLLECTION = 'test_large';

  before(async function () {

    // Drop collection for clean state
    try { await nativeDb.dropCollection(LARGE_COLLECTION); } catch (_e) { /* ignore */ }

    // Insert 1000 records via batchWriteRecords
    const docs = [];
    for (let i = 0; i < 1000; i++) {
      docs.push({
        _id: 'lg_' + String(i).padStart(4, '0'),
        index: i,
        category: i % 3 === 0 ? 'fizz' : i % 5 === 0 ? 'buzz' : 'plain',
        value: i * 10,
        group: 'batch_' + Math.floor(i / 100)
      });
    }
    const result = await MongoDB.batchWriteRecords(instance, {
      [LARGE_COLLECTION]: docs
    });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.results[LARGE_COLLECTION].insertedCount, 1000);
  });

  after(async function () {

    try { await nativeDb.dropCollection(LARGE_COLLECTION); } catch (_e) { /* ignore */ }
  });

  it('should scan all 1000 records', async function () {

    const result = await MongoDB.scan(instance, LARGE_COLLECTION);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.count, 1000);
  });

  it('should scan with filter on large dataset', async function () {

    const result = await MongoDB.scan(instance, LARGE_COLLECTION, { category: 'fizz' });
    assert.strictEqual(result.success, true);
    assert.ok(result.count > 300, 'Should find fizz docs');
    result.documents.forEach(function (doc) {
      assert.strictEqual(doc.category, 'fizz');
    });
  });

  it('should scan with options (limit + sort) on large dataset', async function () {

    const result = await MongoDB.scan(instance, LARGE_COLLECTION, {}, { limit: 10, sort: { index: -1 } });
    assert.strictEqual(result.count, 10);
    assert.strictEqual(result.documents[0].index, 999);
    assert.strictEqual(result.documents[9].index, 990);
  });

  it('should count documents in large dataset', async function () {

    const result = await MongoDB.count(instance, LARGE_COLLECTION, { category: 'plain' });
    assert.strictEqual(result.success, true);
    assert.ok(result.count > 400, 'Should have many plain docs');
  });

  it('should query with filter on large dataset', async function () {

    const result = await MongoDB.query(instance, LARGE_COLLECTION, { group: 'batch_5' });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.documents.length, 100);
  });

  it('should query with limit and sort on large dataset', async function () {

    const result = await MongoDB.query(instance, LARGE_COLLECTION,
      { category: 'plain' },
      { limit: 20, sort: { value: -1 } }
    );
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.documents.length, 20);
    assert.ok(result.documents[0].value > result.documents[19].value, 'Should be descending by value');
  });

  it('should getRecord by _id from large dataset', async function () {

    const result = await MongoDB.getRecord(instance, LARGE_COLLECTION, { _id: 'lg_0500' });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.document.index, 500);
    assert.strictEqual(result.document.value, 5000);
  });

  it('should batchGetRecords from large dataset', async function () {

    const result = await MongoDB.batchGetRecords(instance, {
      [LARGE_COLLECTION]: ['lg_0000', 'lg_0500', 'lg_0999']
    });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.documents[LARGE_COLLECTION].length, 3);
  });

  it('should deleteRecordsByFilter from large dataset', async function () {

    const result = await MongoDB.deleteRecordsByFilter(instance, LARGE_COLLECTION, { group: 'batch_9' });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.deletedCount, 100);

    // Verify remaining
    const scan = await MongoDB.scan(instance, LARGE_COLLECTION);
    assert.strictEqual(scan.count, 900);
  });

  it('should batchDeleteRecords from large dataset', async function () {

    const ids = [];
    for (let i = 800; i < 810; i++) {
      ids.push('lg_' + String(i).padStart(4, '0'));
    }
    const result = await MongoDB.batchDeleteRecords(instance, {
      [LARGE_COLLECTION]: ids
    });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.results[LARGE_COLLECTION].deletedCount, 10);
  });

  it('should update a record in large dataset and verify', async function () {

    await MongoDB.updateRecord(instance, LARGE_COLLECTION,
      { _id: 'lg_0001' },
      { $set: { name: 'updated' }, $inc: { value: 1 } }
    );

    const get = await MongoDB.getRecord(instance, LARGE_COLLECTION, { _id: 'lg_0001' });
    assert.strictEqual(get.document.name, 'updated');
    assert.strictEqual(get.document.value, 11);
  });

});
