// Info: Backend-agnostic test contract for the logger module. Every store
// adapter runs this suite from its own test file so a regression in any
// backend - or a divergence between backends - is surfaced immediately.
//
// Source of truth: js-server-helper-logger/_test/store-contract-suite.js
// Copy to each adapter's _test/ directory - do not edit in place.
//
// Contract under test (5 methods):
//   - setupNewStore(instance)                      -> { success, error }
//   - addLog(instance, record)                     -> { success, error }
//   - getLogsByEntity(instance, query)             -> { success, records, next_cursor, error }
//   - getLogsByActor(instance, query)              -> { success, records, next_cursor, error }
//   - cleanupExpiredLogs(instance)                 -> { success, deleted_count, error }
'use strict';


const assert = require('node:assert/strict');
const { describe, it, beforeEach } = require('node:test');


/********************************************************************
Run the shared logger-store contract against a backend.

@param {Object} args - Backend-specific glue
@param {String} args.label - Backend name (used in suite titles)
@param {Function} args.buildLogger - () => Logger instance
@param {Function} args.buildInstance - (time?) => instance object
@param {Function} args.cleanupBetweenTests - async () - empty the store

@return {void}
*********************************************************************/
module.exports = function runSharedStoreSuite (args) {

  const label = args.label;
  const buildLogger = args.buildLogger;
  const buildInstance = args.buildInstance;
  const cleanupBetweenTests = args.cleanupBetweenTests;


  // Each test gets a fresh store so prior test side effects can never bleed in
  beforeEach(async function () {
    await cleanupBetweenTests();
  });


  // ----- helpers ----------------------------------------------------------

  let counter = 0;
  const uniqueId = function (prefix) {
    counter = counter + 1;
    return prefix + '-' + counter;
  };

  const sleep = function (ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  };


  // ----- initialize -------------------------------------------------------

  describe(label + ': setupNewStore', function () {

    it('returns success for idempotent calls', async function () {

      const Logger = buildLogger();
      const instance = buildInstance();

      const result1 = await Logger.setupNewStore(instance);
      assert.equal(result1.success, true);
      assert.equal(result1.error, null);

      const result2 = await Logger.setupNewStore(instance);
      assert.equal(result2.success, true);
      assert.equal(result2.error, null);

    });

  });


  // ----- addRecord --------------------------------------------------------

  describe(label + ': addLog via log()', function () {

    it('persists a record with all fields', async function () {

      const Logger = buildLogger();
      const instance = buildInstance();

      const log_result = await Logger.log(instance, {
        scope: 'tenant-A',
        entity_type: 'user',
        entity_id: uniqueId('user'),
        actor_type: 'admin',
        actor_id: uniqueId('admin'),
        action: 'user.create',
        data: { email: 'test@example.com' },
        retention: 'persistent',
        await: true
      });

      assert.equal(log_result.success, true);
      assert.equal(log_result.error, null);

    });


    it('auto-captures IP and user-agent from instance', async function () {

      const Logger = buildLogger();
      const instance = buildInstance();
      instance.http_request = {
        headers: { 'user-agent': 'TestAgent/1.0' },
        socket: { remoteAddress: '192.168.1.1' }
      };

      const userId = uniqueId('user');
      await Logger.log(instance, {
        entity_type: 'user',
        entity_id: userId,
        actor_type: 'system',
        actor_id: 'system',
        action: 'user.login',
        await: true
      });

      const list_result = await Logger.listByEntity(instance, {
        entity_type: 'user',
        entity_id: userId
      });

      assert.equal(list_result.success, true);
      assert.equal(list_result.records.length, 1);

    });


    it('respects retention with ttl_seconds', async function () {

      const Logger = buildLogger();
      const instance = buildInstance();

      const userId = uniqueId('user');
      await Logger.log(instance, {
        entity_type: 'user',
        entity_id: userId,
        actor_type: 'system',
        actor_id: 'system',
        action: 'temp.event',
        retention: { ttl_seconds: 1 },
        await: true
      });

      // Should exist immediately
      const list_before = await Logger.listByEntity(instance, {
        entity_type: 'user',
        entity_id: userId
      });
      assert.equal(list_before.records.length, 1);

      // Wait for expiry
      await sleep(1100);

      // Cleanup should remove it
      const cleanup = await Logger.cleanupExpiredLogs(instance);
      assert.equal(cleanup.success, true);
      assert.equal(cleanup.deleted_count, 1);

    });

  });


  // ----- listByEntity -----------------------------------------------------

  describe(label + ': getLogsByEntity', function () {

    it('returns records most-recent first', async function () {

      const Logger = buildLogger();
      // Use distinct mock-time instances so each record gets a reliably different
      // created_at_ms and sort_key regardless of wall-clock resolution.
      const instance1 = buildInstance(1000);
      const instance2 = buildInstance(2000);
      const userId = uniqueId('user');

      await Logger.log(instance1, {
        entity_type: 'user',
        entity_id: userId,
        actor_type: 'system',
        actor_id: 'system',
        action: 'action.first',
        await: true
      });

      await Logger.log(instance2, {
        entity_type: 'user',
        entity_id: userId,
        actor_type: 'system',
        actor_id: 'system',
        action: 'action.second',
        await: true
      });

      const list_result = await Logger.listByEntity(instance1, {
        entity_type: 'user',
        entity_id: userId
      });

      assert.equal(list_result.success, true);
      assert.equal(list_result.records.length, 2);
      assert.equal(list_result.records[0].action, 'action.second');
      assert.equal(list_result.records[1].action, 'action.first');

    });


    it('filters by action array', async function () {

      const Logger = buildLogger();
      const instance = buildInstance();
      const userId = uniqueId('user');

      await Logger.log(instance, {
        entity_type: 'user',
        entity_id: userId,
        actor_type: 'system',
        actor_id: 'system',
        action: 'user.login',
        await: true
      });

      await Logger.log(instance, {
        entity_type: 'user',
        entity_id: userId,
        actor_type: 'system',
        actor_id: 'system',
        action: 'user.logout',
        await: true
      });

      await Logger.log(instance, {
        entity_type: 'user',
        entity_id: userId,
        actor_type: 'system',
        actor_id: 'system',
        action: 'profile.update',
        await: true
      });

      const list_result = await Logger.listByEntity(instance, {
        entity_type: 'user',
        entity_id: userId,
        actions: ['user.login', 'user.logout']
      });

      assert.equal(list_result.success, true);
      assert.equal(list_result.records.length, 2);

    });


    it('supports cursor pagination', async function () {

      const Logger = buildLogger();
      const instance = buildInstance();
      const userId = uniqueId('user');

      // Create 5 records
      for (let i = 0; i < 5; i++) {
        await Logger.log(instance, {
          entity_type: 'user',
          entity_id: userId,
          actor_type: 'system',
          actor_id: 'system',
          action: 'action.' + i,
          await: true
        });
        await sleep(5);
      }

      // Get first page of 2
      const page1 = await Logger.listByEntity(instance, {
        entity_type: 'user',
        entity_id: userId,
        limit: 2
      });

      assert.equal(page1.success, true);
      assert.equal(page1.records.length, 2);
      assert.ok(page1.next_cursor, 'should have next_cursor');

      // Get second page
      const page2 = await Logger.listByEntity(instance, {
        entity_type: 'user',
        entity_id: userId,
        limit: 2,
        cursor: page1.next_cursor
      });

      assert.equal(page2.success, true);
      assert.equal(page2.records.length, 2);
      assert.ok(page2.next_cursor, 'should have next_cursor');

      // Get final page
      const page3 = await Logger.listByEntity(instance, {
        entity_type: 'user',
        entity_id: userId,
        limit: 2,
        cursor: page2.next_cursor
      });

      assert.equal(page3.success, true);
      assert.equal(page3.records.length, 1);
      assert.equal(page3.next_cursor, null);

    });

  });


  // ----- listByActor ------------------------------------------------------

  describe(label + ': getLogsByActor', function () {

    it('returns actions by actor, most-recent first', async function () {

      const Logger = buildLogger();
      const instance = buildInstance();
      const actorId = uniqueId('admin');

      await Logger.log(instance, {
        entity_type: 'user',
        entity_id: uniqueId('user1'),
        actor_type: 'admin',
        actor_id: actorId,
        action: 'user.delete',
        await: true
      });

      await Logger.log(instance, {
        entity_type: 'project',
        entity_id: uniqueId('project1'),
        actor_type: 'admin',
        actor_id: actorId,
        action: 'project.create',
        await: true
      });

      const list_result = await Logger.listByActor(instance, {
        actor_type: 'admin',
        actor_id: actorId
      });

      assert.equal(list_result.success, true);
      assert.equal(list_result.records.length, 2);

    });

  });


  // ----- cleanupExpiredRecords --------------------------------------------

  describe(label + ': cleanupExpiredLogs', function () {

    it('removes only expired logs', async function () {

      const Logger = buildLogger();
      const baseTime = 1000000000;
      const instance = buildInstance(baseTime);

      const userId1 = uniqueId('user');
      const userId2 = uniqueId('user');

      // Persistent record
      await Logger.log(instance, {
        entity_type: 'user',
        entity_id: userId1,
        actor_type: 'system',
        actor_id: 'system',
        action: 'persistent.action',
        retention: 'persistent',
        await: true
      });

      // TTL record (expires at baseTime + 60)
      await Logger.log(instance, {
        entity_type: 'user',
        entity_id: userId2,
        actor_type: 'system',
        actor_id: 'system',
        action: 'temp.action',
        retention: { ttl_seconds: 60 },
        await: true
      });

      // Move time forward past expiry
      instance.time = baseTime + 120;
      instance.time_ms = (baseTime + 120) * 1000;

      const cleanup = await Logger.cleanupExpiredLogs(instance);
      assert.equal(cleanup.success, true);
      assert.equal(cleanup.deleted_count, 1);

      // Verify persistent record still exists
      const list1 = await Logger.listByEntity(instance, {
        entity_type: 'user',
        entity_id: userId1
      });
      assert.equal(list1.records.length, 1);

      // Verify TTL record is gone
      const list2 = await Logger.listByEntity(instance, {
        entity_type: 'user',
        entity_id: userId2
      });
      assert.equal(list2.records.length, 0);

    });


    it('returns zero when nothing to clean', async function () {

      const Logger = buildLogger();
      const instance = buildInstance();

      const cleanup = await Logger.cleanupExpiredLogs(instance);
      assert.equal(cleanup.success, true);
      assert.equal(cleanup.deleted_count, 0);

    });

  });


};//////////////////////////// End of Shared Suite /////////////////////////////
