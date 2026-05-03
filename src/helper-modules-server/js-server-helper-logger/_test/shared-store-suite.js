// Info: Backend-agnostic test contract for the logger module. Every store
// runs this suite from its own test file (test-sqlite.js, test-postgres.js,
// etc.) so a regression in any backend - or a divergence between backends -
// is surfaced immediately.
'use strict';


const assert = require('node:assert/strict');
const { describe, it, beforeEach } = require('node:test');


/********************************************************************
Run the shared logger-store contract against a backend.

@param {Object} args - Backend-specific glue
@param {String} args.label - Backend name (used in suite titles)
@param {Function} args.buildLogger - () => Logger instance
@param {Function} args.buildInstance - (time?) => instance object
@param {Function} args.cleanupBetweenTests - async () => clear the store
*********************************************************************/
module.exports = function runSharedStoreSuite (args) {

  const label = args.label;
  const buildLogger = args.buildLogger;
  const buildInstance = args.buildInstance;
  const cleanupBetweenTests = args.cleanupBetweenTests;


  beforeEach(async function () {
    await cleanupBetweenTests();
  });


  // ----- helpers ----------------------------------------------------------

  // Always log synchronously inside tests so the assertion immediately after
  // the call observes a durable row. Background mode is exercised separately
  // in the unit-level test.js.
  const logOptions = function (override) {
    return Object.assign({
      scope:       'tenant-A',
      entity_type: 'user',
      entity_id:   'u-1',
      actor_type:  'user',
      actor_id:    'u-1',
      action:      'auth.login',
      retention:   'persistent',
      await:       true
    }, override || {});
  };


  // Write a single row and assert it lands.
  const logOne = async function (Logger, instance, override) {
    const result = await Logger.log(instance, logOptions(override));
    assert.equal(result.success, true);
    assert.equal(result.error, null);
    return result;
  };


  // ----- write + read happy path ------------------------------------------

  describe(label + ': log -> listByEntity round trip', function () {

    it('writes a record and reads it back via listByEntity', async function () {

      const Logger = buildLogger();
      const instance = buildInstance(1000);

      await logOne(Logger, instance, {
        entity_type: 'user',
        entity_id:   'alice',
        action:      'profile.name.changed',
        data:        { from: 'Alice', to: 'Alice Smith' }
      });

      const result = await Logger.listByEntity(buildInstance(1100), {
        scope:       'tenant-A',
        entity_type: 'user',
        entity_id:   'alice'
      });

      assert.equal(result.success, true);
      assert.equal(result.records.length, 1);

      const r = result.records[0];
      assert.equal(r.scope, 'tenant-A');
      assert.equal(r.entity_type, 'user');
      assert.equal(r.entity_id, 'alice');
      assert.equal(r.action, 'profile.name.changed');
      assert.deepEqual(r.data, { from: 'Alice', to: 'Alice Smith' });
      assert.equal(r.expires_at, null); // persistent
      assert.equal(typeof r.sort_key, 'string');
      assert.equal(typeof r.created_at, 'number');
      assert.equal(typeof r.created_at_ms, 'number');

    });


    it('returns records most-recent first (sort_key DESC)', async function () {

      const Logger = buildLogger();

      await logOne(Logger, buildInstance(1000), { entity_id: 'u', action: 'a' });
      await logOne(Logger, buildInstance(2000), { entity_id: 'u', action: 'b' });
      await logOne(Logger, buildInstance(3000), { entity_id: 'u', action: 'c' });

      const result = await Logger.listByEntity(buildInstance(4000), {
        scope: 'tenant-A', entity_type: 'user', entity_id: 'u'
      });

      assert.equal(result.success, true);
      assert.equal(result.records.length, 3);
      assert.deepEqual(
        result.records.map(function (r) { return r.action; }),
        ['c', 'b', 'a']
      );

    });


    it('listByActor returns only the rows authored by that actor', async function () {

      const Logger = buildLogger();

      // alice acts on her own profile
      await logOne(Logger, buildInstance(1000), {
        entity_type: 'user', entity_id: 'alice',
        actor_type: 'user', actor_id: 'alice',
        action: 'profile.changed'
      });
      // bob acts on alice's profile (admin scenario)
      await logOne(Logger, buildInstance(2000), {
        entity_type: 'user', entity_id: 'alice',
        actor_type: 'admin', actor_id: 'bob',
        action: 'profile.changed.by.admin'
      });

      const alice = await Logger.listByActor(buildInstance(3000), {
        scope: 'tenant-A', actor_type: 'user', actor_id: 'alice'
      });
      assert.equal(alice.records.length, 1);
      assert.equal(alice.records[0].action, 'profile.changed');

      const bob = await Logger.listByActor(buildInstance(3000), {
        scope: 'tenant-A', actor_type: 'admin', actor_id: 'bob'
      });
      assert.equal(bob.records.length, 1);
      assert.equal(bob.records[0].action, 'profile.changed.by.admin');

    });

  });


  // ----- scope isolation --------------------------------------------------

  describe(label + ': scope isolation', function () {

    it('records in tenant-A are invisible to a tenant-B query', async function () {

      const Logger = buildLogger();

      await logOne(Logger, buildInstance(1000), { scope: 'tenant-A', entity_id: 'shared' });
      await logOne(Logger, buildInstance(1100), { scope: 'tenant-B', entity_id: 'shared' });

      const a_records = await Logger.listByEntity(buildInstance(1200), {
        scope: 'tenant-A', entity_type: 'user', entity_id: 'shared'
      });
      const b_records = await Logger.listByEntity(buildInstance(1200), {
        scope: 'tenant-B', entity_type: 'user', entity_id: 'shared'
      });

      assert.equal(a_records.records.length, 1);
      assert.equal(b_records.records.length, 1);
      assert.notEqual(a_records.records[0].sort_key, b_records.records[0].sort_key);

    });

  });


  // ----- action filter ----------------------------------------------------

  describe(label + ': action filter', function () {

    it('exact action filter returns only matching rows', async function () {

      const Logger = buildLogger();

      await logOne(Logger, buildInstance(1000), { action: 'auth.login' });
      await logOne(Logger, buildInstance(1100), { action: 'auth.logout' });
      await logOne(Logger, buildInstance(1200), { action: 'profile.changed' });

      const result = await Logger.listByEntity(buildInstance(1300), {
        scope: 'tenant-A', entity_type: 'user', entity_id: 'u-1',
        actions: ['auth.login']
      });

      assert.equal(result.records.length, 1);
      assert.equal(result.records[0].action, 'auth.login');

    });


    it('glob `auth.*` matches every auth.* event', async function () {

      const Logger = buildLogger();

      await logOne(Logger, buildInstance(1000), { action: 'auth.login' });
      await logOne(Logger, buildInstance(1100), { action: 'auth.logout' });
      await logOne(Logger, buildInstance(1200), { action: 'auth.password.changed' });
      await logOne(Logger, buildInstance(1300), { action: 'profile.changed' });

      const result = await Logger.listByEntity(buildInstance(1400), {
        scope: 'tenant-A', entity_type: 'user', entity_id: 'u-1',
        actions: ['auth.*']
      });

      assert.equal(result.records.length, 3);
      const actions = result.records.map(function (r) { return r.action; }).sort();
      assert.deepEqual(actions, ['auth.login', 'auth.logout', 'auth.password.changed']);

    });

  });


  // ----- time range filter ------------------------------------------------

  describe(label + ': time-range filter', function () {

    it('start_time_ms is inclusive, end_time_ms is exclusive', async function () {

      const Logger = buildLogger();

      // t = 1000s, 2000s, 3000s
      await logOne(Logger, buildInstance(1000), { action: 'a' });
      await logOne(Logger, buildInstance(2000), { action: 'b' });
      await logOne(Logger, buildInstance(3000), { action: 'c' });

      // window: [2_000_000ms, 3_000_000ms) - should return only 'b'
      const result = await Logger.listByEntity(buildInstance(4000), {
        scope: 'tenant-A', entity_type: 'user', entity_id: 'u-1',
        start_time_ms: 2000 * 1000,
        end_time_ms:   3000 * 1000
      });

      assert.equal(result.records.length, 1);
      assert.equal(result.records[0].action, 'b');

    });

  });


  // ----- pagination -------------------------------------------------------

  describe(label + ': pagination via cursor', function () {

    it('a full page returns next_cursor; the final page returns null', async function () {

      const Logger = buildLogger();

      // Five records spaced one second apart so sort_key ordering is deterministic
      for (let i = 0; i < 5; i = i + 1) {
        await logOne(Logger, buildInstance(1000 + i), { action: 'evt-' + i });
      }

      const page_1 = await Logger.listByEntity(buildInstance(2000), {
        scope: 'tenant-A', entity_type: 'user', entity_id: 'u-1',
        limit: 2
      });
      assert.equal(page_1.records.length, 2);
      assert.notEqual(page_1.next_cursor, null);

      const page_2 = await Logger.listByEntity(buildInstance(2000), {
        scope: 'tenant-A', entity_type: 'user', entity_id: 'u-1',
        limit: 2,
        cursor: page_1.next_cursor
      });
      assert.equal(page_2.records.length, 2);
      assert.notEqual(page_2.next_cursor, null);

      const page_3 = await Logger.listByEntity(buildInstance(2000), {
        scope: 'tenant-A', entity_type: 'user', entity_id: 'u-1',
        limit: 2,
        cursor: page_2.next_cursor
      });
      assert.equal(page_3.records.length, 1);
      assert.equal(page_3.next_cursor, null);

      // No record duplicated across pages
      const seen = page_1.records.concat(page_2.records).concat(page_3.records);
      const seen_actions = seen.map(function (r) { return r.action; });
      assert.deepEqual(
        seen_actions.slice().sort(),
        ['evt-0', 'evt-1', 'evt-2', 'evt-3', 'evt-4']
      );

    });

  });


  // ----- retention --------------------------------------------------------

  describe(label + ': retention modes', function () {

    it('persistent records have expires_at = null', async function () {

      const Logger = buildLogger();

      await logOne(Logger, buildInstance(1000), {
        action: 'persist', retention: 'persistent'
      });

      const result = await Logger.listByEntity(buildInstance(2000), {
        scope: 'tenant-A', entity_type: 'user', entity_id: 'u-1'
      });

      assert.equal(result.records.length, 1);
      assert.equal(result.records[0].expires_at, null);

    });


    it('ttl_seconds N sets expires_at = created_at + N', async function () {

      const Logger = buildLogger();
      const t0 = 5000;

      await logOne(Logger, buildInstance(t0), {
        action: 'ttl', retention: { ttl_seconds: 600 }
      });

      const result = await Logger.listByEntity(buildInstance(t0 + 1), {
        scope: 'tenant-A', entity_type: 'user', entity_id: 'u-1'
      });

      assert.equal(result.records.length, 1);
      assert.equal(result.records[0].expires_at, t0 + 600);

    });

  });


  // ----- cleanup ----------------------------------------------------------

  describe(label + ': cleanupExpiredRecords', function () {

    it('removes only the rows whose expires_at is in the past', async function () {

      const Logger = buildLogger();
      const t0 = 10000;

      // expired in 30s
      await logOne(Logger, buildInstance(t0), {
        action: 'short', retention: { ttl_seconds: 30 }
      });
      // never expires
      await logOne(Logger, buildInstance(t0 + 1), {
        action: 'forever', retention: 'persistent'
      });
      // expires in 1 day
      await logOne(Logger, buildInstance(t0 + 2), {
        action: 'long', retention: { ttl_seconds: 86400 }
      });

      const result = await Logger.cleanupExpiredRecords(buildInstance(t0 + 100));
      assert.equal(result.success, true);
      assert.ok(result.deleted_count >= 1);

      const remaining = await Logger.listByEntity(buildInstance(t0 + 200), {
        scope: 'tenant-A', entity_type: 'user', entity_id: 'u-1'
      });
      const actions = remaining.records.map(function (r) { return r.action; }).sort();
      assert.deepEqual(actions, ['forever', 'long']);

    });


    it('returns deleted_count: 0 when nothing is expired', async function () {

      const Logger = buildLogger();
      const result = await Logger.cleanupExpiredRecords(buildInstance(1));

      assert.equal(result.success, true);
      assert.equal(result.deleted_count, 0);

    });

  });


  // ----- structured data + IP --------------------------------------------

  describe(label + ': payload preservation', function () {

    it('round-trips an arbitrary JSON-serialisable payload', async function () {

      const Logger = buildLogger();
      const payload = {
        old_username: 'alice',
        new_username: 'alice2',
        nested: { a: 1, b: ['x', 'y'], c: { deep: true } },
        empty_array: [],
        scalar: 42
      };

      await logOne(Logger, buildInstance(1000), {
        action: 'profile.username.changed',
        data: payload
      });

      const result = await Logger.listByEntity(buildInstance(2000), {
        scope: 'tenant-A', entity_type: 'user', entity_id: 'u-1'
      });

      assert.equal(result.records.length, 1);
      assert.deepEqual(result.records[0].data, payload);

    });


    it('preserves explicit ip + user_agent options on the record', async function () {

      const Logger = buildLogger();

      await logOne(Logger, buildInstance(1000), {
        action: 'auth.login',
        ip: '203.0.113.5',
        user_agent: 'Mozilla/5.0 (test)'
      });

      const result = await Logger.listByEntity(buildInstance(2000), {
        scope: 'tenant-A', entity_type: 'user', entity_id: 'u-1'
      });

      assert.equal(result.records.length, 1);
      assert.equal(result.records[0].ip, '203.0.113.5');
      assert.equal(result.records[0].user_agent, 'Mozilla/5.0 (test)');

    });

  });

};
