// Tests for js-server-helper-auth (Phase 1: db_only mode + memory store).
//
// Strategy:
//   - Each test constructs a fresh Auth instance with a fresh memory store.
//   - The pure policy module (parts/policy.js) is tested directly with
//     synthetic existing-session arrays.
//   - process.env is NEVER accessed - only loader.js touches env.
'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { Lib } = require('./loader')();

// Auth module under test - constructed per-case with a per-test CONFIG
const AuthLoader = require('../auth.js');
const PolicyFactory = require('../parts/policy.js');
const RecordShapeFactory = require('../parts/record-shape.js');
const AuthIdFactory = require('../parts/auth-id.js');
const CookieFactory = require('../parts/cookie.js');
const TokenSourceFactory = require('../parts/token-source.js');


// ============================================================================
// DOMAIN ERROR CATALOG (test fixture)
// ============================================================================

const TEST_ERRORS = {
  LIMIT_REACHED:        { code: 'TEST_AUTH_LIMIT_REACHED',       message: 'Session limit reached.',                    status: 429 },
  SESSION_NOT_FOUND:    { code: 'TEST_AUTH_SESSION_NOT_FOUND',   message: 'Session not found.',                        status: 401 },
  SESSION_EXPIRED:      { code: 'TEST_AUTH_SESSION_EXPIRED',     message: 'Session expired.',                          status: 401 },
  INVALID_TOKEN:        { code: 'TEST_AUTH_INVALID_TOKEN',       message: 'Invalid auth token.',                       status: 401 },
  ACTOR_TYPE_MISMATCH:  { code: 'TEST_AUTH_ACTOR_TYPE_MISMATCH', message: 'Actor type mismatch (token tampered).',     status: 401 },
  SERVICE_UNAVAILABLE:  { code: 'TEST_SERVICE_UNAVAILABLE',      message: 'Service temporarily unavailable.',          status: 503 }
};


// ============================================================================
// HELPERS
// ============================================================================

const buildAuth = function (overrides) {

  const config = Object.assign({
    STORE: 'memory',
    STORE_CONFIG: {},
    ACTOR_TYPE: 'user',
    TTL_SECONDS: 3600,
    LAST_ACTIVE_UPDATE_INTERVAL_SECONDS: 600,
    LIMITS: {
      total_max: 5,
      by_form_factor_max: null,
      by_platform_max: null,
      evict_oldest_on_limit: true
    },
    ENABLE_JWT: false,
    COOKIE_PREFIX: 'sl_user_',
    ERRORS: TEST_ERRORS
  }, overrides || {});

  return AuthLoader(Lib, config);

};


const buildInstance = function (time_seconds) {

  const instance = Lib.Instance.initialize();
  if (typeof time_seconds === 'number') {
    instance.time = time_seconds;
    instance.time_ms = time_seconds * 1000;
  }
  return instance;

};


const baseCreateOptions = function (overrides) {

  return Object.assign({
    tenant_id: 'tenant-A',
    actor_id: 'actor1',
    install_id: 'install-X',
    install_platform: 'web',
    install_form_factor: 'desktop',
    client_name: 'Chrome',
    client_version: '120.0',
    client_is_browser: true,
    client_user_agent: 'Mozilla/5.0 ...'
  }, overrides || {});

};



// ============================================================================
// LOADER VALIDATION
// ============================================================================

describe('loader validation', function () {

  it('throws when STORE is missing', function () {

    assert.throws(function () {
      AuthLoader(Lib, { ACTOR_TYPE: 'user', STORE_CONFIG: {}, ERRORS: TEST_ERRORS });
    }, /CONFIG\.STORE is required/);

  });

  it('throws when STORE_CONFIG is missing', function () {

    assert.throws(function () {
      AuthLoader(Lib, { STORE: 'memory', ACTOR_TYPE: 'user', ERRORS: TEST_ERRORS });
    }, /CONFIG\.STORE_CONFIG is required/);

  });

  it('throws when ACTOR_TYPE is missing', function () {

    assert.throws(function () {
      AuthLoader(Lib, { STORE: 'memory', STORE_CONFIG: {}, ERRORS: TEST_ERRORS });
    }, /CONFIG\.ACTOR_TYPE is required/);

  });

  it('throws when ENABLE_JWT is true without a valid JWT.signing_key', function () {

    // Missing JWT block entirely
    assert.throws(function () {
      AuthLoader(Lib, {
        STORE: 'memory',
        STORE_CONFIG: {},
        ACTOR_TYPE: 'user',
        ENABLE_JWT: true,
        JWT: null,
        TTL_SECONDS: 3600,
        LIMITS: { total_max: 5, evict_oldest_on_limit: true },
        ERRORS: TEST_ERRORS
      });
    }, /CONFIG\.JWT must be a plain object/);

    // Signing key too short
    assert.throws(function () {
      AuthLoader(Lib, {
        STORE: 'memory',
        STORE_CONFIG: {},
        ACTOR_TYPE: 'user',
        ENABLE_JWT: true,
        JWT: { signing_key: 'short', issuer: 'test', audience: 'test' },
        TTL_SECONDS: 3600,
        LIMITS: { total_max: 5, evict_oldest_on_limit: true },
        ERRORS: TEST_ERRORS
      });
    }, /CONFIG\.JWT\.signing_key must be a string of at least 32 chars/);

  });

  it('throws when ERRORS catalog is missing a required key', function () {

    const partial = Object.assign({}, TEST_ERRORS);
    delete partial.LIMIT_REACHED;
    assert.throws(function () {
      AuthLoader(Lib, {
        STORE: 'memory',
        STORE_CONFIG: {},
        ACTOR_TYPE: 'user',
        ERRORS: partial
      });
    }, /CONFIG\.ERRORS\.LIMIT_REACHED is required/);

  });

  it('throws on unknown STORE name', function () {

    assert.throws(function () {
      AuthLoader(Lib, {
        STORE: 'redis',
        STORE_CONFIG: {},
        ACTOR_TYPE: 'user',
        ERRORS: TEST_ERRORS
      });
    }, /Unknown CONFIG\.STORE/);

  });

});



// ============================================================================
// AUTH-ID HELPERS (pure)
// ============================================================================

describe('parts/auth-id', function () {

  const AuthId = AuthIdFactory(Lib);

  it('createAuthId joins parts with "-"', function () {

    const auth_id = AuthId.createAuthId({
      actor_id: 'a1', token_key: 'k1', token_secret: 's1'
    });
    assert.equal(auth_id, 'a1-k1-s1');

  });

  it('parseAuthId returns three parts on a well-formed string', function () {

    const parts = AuthId.parseAuthId('a1-k1-s1');
    assert.deepEqual(parts, { actor_id: 'a1', token_key: 'k1', token_secret: 's1' });

  });

  it('parseAuthId returns null on malformed input', function () {

    assert.equal(AuthId.parseAuthId(''), null);
    assert.equal(AuthId.parseAuthId(null), null);
    assert.equal(AuthId.parseAuthId('a1-k1'), null);
    assert.equal(AuthId.parseAuthId('a1-k1-s1-extra'), null);
    assert.equal(AuthId.parseAuthId('a1--s1'), null);

  });

  it('createAuthId rejects "-" or "#" inside actor_id', function () {

    assert.throws(function () {
      AuthId.createAuthId({ actor_id: 'bad-id', token_key: 'k', token_secret: 's' });
    }, /must not contain "-"/);
    assert.throws(function () {
      AuthId.createAuthId({ actor_id: 'bad#id', token_key: 'k', token_secret: 's' });
    }, /must not contain "#"/);

  });

  it('hashTokenSecret produces a deterministic 64-char hex string', function () {

    const h = AuthId.hashTokenSecret('secret', '');
    assert.equal(typeof h, 'string');
    assert.equal(h.length, 64);
    assert.match(h, /^[0-9a-f]{64}$/);
    assert.equal(h, AuthId.hashTokenSecret('secret', '')); // deterministic

  });

  it('composeSessionKey joins with "#"', function () {

    assert.equal(
      AuthId.composeSessionKey('a1', 'k1', 'h1'),
      'a1#k1#h1'
    );

  });

  it('composeMongoId prepends tenant_id with "#"', function () {

    assert.equal(
      AuthId.composeMongoId('t1', 'a1', 'k1', 'h1'),
      't1#a1#k1#h1'
    );

  });

});



// ============================================================================
// RECORD SHAPE
// ============================================================================

describe('parts/record-shape', function () {

  const RecordShape = RecordShapeFactory(Lib);

  it('buildRecord requires the identity + lifecycle fields', function () {

    assert.throws(function () { RecordShape.buildRecord({}); }, /tenant_id/);

  });

  it('buildRecord produces a fully populated canonical record', function () {

    const r = RecordShape.buildRecord({
      tenant_id: 't1',
      actor_id: 'a1',
      actor_type: 'user',
      token_key: 'k1',
      token_secret_hash: 'h1',
      created_at: 100,
      expires_at: 200,
      last_active_at: 100,
      install_platform: 'web',
      install_form_factor: 'desktop'
    });

    assert.equal(r.tenant_id, 't1');
    assert.equal(r.install_id, null);
    assert.equal(r.client_is_browser, false);
    assert.equal(r.client_screen_w, null);
    assert.equal(r.refresh_token_hash, null);
    assert.equal(r.push_provider, null);
    assert.equal(r.custom_data, null);

  });

});



// ============================================================================
// COOKIE
// ============================================================================

describe('parts/cookie', function () {

  const Cookie = CookieFactory(Lib);

  it('serializeCookie writes name=value and the standard attributes', function () {

    const header = Cookie.serializeCookie('sl_user_T', 'value', {
      max_age: 600, http_only: true, secure: true, same_site: 'lax'
    });

    assert.match(header, /^sl_user_T=value/);
    assert.match(header, /Max-Age=600/);
    assert.match(header, /Path=\//);
    assert.match(header, /HttpOnly/);
    assert.match(header, /Secure/);
    assert.match(header, /SameSite=Lax/);

  });

  it('parseCookieHeader returns a name->value map', function () {

    const m = Cookie.parseCookieHeader('a=1; b=two; c=three');
    assert.deepEqual(m, { a: '1', b: 'two', c: 'three' });

  });

  it('parseCookieHeader tolerates whitespace and equal-signs in values', function () {

    const m = Cookie.parseCookieHeader('  k =val=ue ');
    assert.equal(m.k, 'val=ue');

  });

  it('setCookieOnResponse stamps instance.http_response.cookies', function () {

    const instance = buildInstance(0);
    Cookie.setCookieOnResponse(instance, 'sl_user_T', 'val', { max_age: 600 });
    assert.match(instance.http_response.cookies['sl_user_T'], /^sl_user_T=val/);

  });

  it('clearCookieOnResponse sets Max-Age=0', function () {

    const instance = buildInstance(0);
    Cookie.clearCookieOnResponse(instance, 'sl_user_T', {});
    assert.match(instance.http_response.cookies['sl_user_T'], /Max-Age=0/);

  });

});



// ============================================================================
// TOKEN SOURCE (priority chain)
// ============================================================================

describe('parts/token-source', function () {

  const Cookie = CookieFactory(Lib);
  const TokenSource = TokenSourceFactory(Lib, Cookie);

  it('prefers Authorization: Bearer over cookie', function () {

    const instance = buildInstance(0);
    instance.http_request = {
      headers: {
        authorization: 'Bearer bearer-value',
        cookie: 'sl_user_T=cookie-value'
      }
    };

    const auth_id = TokenSource.readAuthId(instance, {
      cookie_prefix: 'sl_user_', tenant_id: 'T'
    });
    assert.equal(auth_id, 'bearer-value');

  });

  it('falls back to cookie when no Authorization header', function () {

    const instance = buildInstance(0);
    instance.http_request = {
      headers: { cookie: 'sl_user_T=cookie-value' }
    };

    const auth_id = TokenSource.readAuthId(instance, {
      cookie_prefix: 'sl_user_', tenant_id: 'T'
    });
    assert.equal(auth_id, 'cookie-value');

  });

  it('returns null when neither source is present', function () {

    const instance = buildInstance(0);
    instance.http_request = { headers: {} };
    const auth_id = TokenSource.readAuthId(instance, {
      cookie_prefix: 'sl_user_', tenant_id: 'T'
    });
    assert.equal(auth_id, null);

  });

  it('rejects non-Bearer Authorization schemes', function () {

    const instance = buildInstance(0);
    instance.http_request = {
      headers: { authorization: 'Basic ' + Buffer.from('user:pass').toString('base64') }
    };
    const auth_id = TokenSource.readAuthId(instance, {});
    assert.equal(auth_id, null);

  });

});



// ============================================================================
// POLICY (pure list-then-filter)
// ============================================================================

describe('parts/policy', function () {

  const Policy = PolicyFactory(Lib);

  const session = function (overrides) {
    return Object.assign({
      tenant_id: 'T',
      actor_id: 'A',
      token_key: 'k',
      install_id: null,
      install_platform: 'web',
      install_form_factor: 'desktop',
      created_at: 0,
      expires_at: 1000,
      last_active_at: 0
    }, overrides);
  };

  it('allows insertion when no existing sessions', function () {

    const result = Policy.applyLimits({
      existing: [],
      now: 100,
      install_id: null,
      install_form_factor: 'desktop',
      install_platform: 'web',
      limits: { total_max: 5, by_form_factor_max: null, by_platform_max: null, evict_oldest_on_limit: true }
    });
    assert.equal(result.decision, 'allow');
    assert.equal(result.to_delete.length, 0);

  });

  it('drops expired existing sessions before counting', function () {

    const result = Policy.applyLimits({
      existing: [
        session({ token_key: 'k1', expires_at: 50 }),  // expired
        session({ token_key: 'k2', expires_at: 200 })  // active
      ],
      now: 100,
      install_id: null,
      install_form_factor: 'desktop',
      install_platform: 'web',
      limits: { total_max: 1, by_form_factor_max: null, by_platform_max: null, evict_oldest_on_limit: false }
    });
    // active count = 1 (k2). total_max = 1. k2 already at the cap, so the
    // new session is rejected. The expired k1 is NOT in to_delete - the
    // policy doesn't garbage-collect expired sessions; cleanup is a separate path.
    assert.equal(result.decision, 'reject');
    assert.equal(result.tier, 'total');

  });

  it('same-install replacement runs even when under the cap', function () {

    const result = Policy.applyLimits({
      existing: [
        session({ token_key: 'k1', install_id: 'install-X', expires_at: 200 })
      ],
      now: 100,
      install_id: 'install-X',
      install_form_factor: 'desktop',
      install_platform: 'web',
      limits: { total_max: 5, by_form_factor_max: null, by_platform_max: null, evict_oldest_on_limit: true }
    });
    assert.equal(result.decision, 'allow');
    assert.equal(result.to_delete.length, 1);
    assert.equal(result.to_delete[0].token_key, 'k1');

  });

  it('evicts the LRU session when the total cap is hit and eviction is on', function () {

    const result = Policy.applyLimits({
      existing: [
        session({ token_key: 'k1', last_active_at: 10, expires_at: 200 }),
        session({ token_key: 'k2', last_active_at: 50, expires_at: 200 }),
        session({ token_key: 'k3', last_active_at: 20, expires_at: 200 })
      ],
      now: 100,
      install_id: null,
      install_form_factor: 'desktop',
      install_platform: 'web',
      limits: { total_max: 3, by_form_factor_max: null, by_platform_max: null, evict_oldest_on_limit: true }
    });
    // 3 active sessions, cap = 3, so adding one more requires LRU eviction
    assert.equal(result.decision, 'allow');
    assert.equal(result.to_delete.length, 1);
    assert.equal(result.to_delete[0].token_key, 'k1'); // last_active_at: 10

  });

  it('rejects when cap is hit and eviction is off', function () {

    const result = Policy.applyLimits({
      existing: [
        session({ token_key: 'k1', last_active_at: 10, expires_at: 200 }),
        session({ token_key: 'k2', last_active_at: 50, expires_at: 200 }),
        session({ token_key: 'k3', last_active_at: 20, expires_at: 200 })
      ],
      now: 100,
      install_id: null,
      install_form_factor: 'desktop',
      install_platform: 'web',
      limits: { total_max: 3, by_form_factor_max: null, by_platform_max: null, evict_oldest_on_limit: false }
    });
    assert.equal(result.decision, 'reject');
    assert.equal(result.tier, 'total');

  });

  it('per-form-factor cap evicts the LRU session within that form factor', function () {

    const result = Policy.applyLimits({
      existing: [
        session({ token_key: 'm1', install_form_factor: 'mobile',  last_active_at: 100, expires_at: 1000 }),
        session({ token_key: 'm2', install_form_factor: 'mobile',  last_active_at: 200, expires_at: 1000 }),
        session({ token_key: 'd1', install_form_factor: 'desktop', last_active_at:  50, expires_at: 1000 })
      ],
      now: 500,
      install_id: null,
      install_form_factor: 'mobile',
      install_platform: 'web',
      limits: {
        total_max: 10,
        by_form_factor_max: { mobile: 2 },
        by_platform_max: null,
        evict_oldest_on_limit: true
      }
    });
    assert.equal(result.decision, 'allow');
    // m1 is the LRU mobile session
    assert.equal(result.to_delete.length, 1);
    assert.equal(result.to_delete[0].token_key, 'm1');

  });

  it('per-platform cap rejects when configured to do so', function () {

    const result = Policy.applyLimits({
      existing: [
        session({ token_key: 'i1', install_platform: 'ios', last_active_at: 100, expires_at: 1000 }),
        session({ token_key: 'i2', install_platform: 'ios', last_active_at: 200, expires_at: 1000 })
      ],
      now: 500,
      install_id: null,
      install_form_factor: 'mobile',
      install_platform: 'ios',
      limits: {
        total_max: 10,
        by_form_factor_max: null,
        by_platform_max: { ios: 2 },
        evict_oldest_on_limit: false
      }
    });
    assert.equal(result.decision, 'reject');
    assert.equal(result.tier, 'platform');

  });

  it('same-install replacement counts before tier checks', function () {

    // One mobile session with the same install_id as the new one - it
    // should be queued for replacement BEFORE the tier check sees it,
    // so the tier check passes.
    const result = Policy.applyLimits({
      existing: [
        session({ token_key: 'm1', install_id: 'install-X', install_form_factor: 'mobile', last_active_at: 100, expires_at: 1000 }),
        session({ token_key: 'm2', install_id: 'install-Y', install_form_factor: 'mobile', last_active_at: 200, expires_at: 1000 })
      ],
      now: 500,
      install_id: 'install-X',
      install_form_factor: 'mobile',
      install_platform: 'web',
      limits: {
        total_max: 10,
        by_form_factor_max: { mobile: 2 },
        by_platform_max: null,
        evict_oldest_on_limit: false       // would otherwise reject
      }
    });
    assert.equal(result.decision, 'allow');
    assert.equal(result.to_delete.length, 1);
    assert.equal(result.to_delete[0].token_key, 'm1');

  });

});



// ============================================================================
// CREATE / VERIFY / REMOVE LIFECYCLE
// ============================================================================

describe('createSession + verifySession lifecycle', function () {

  it('createSession returns an auth_id and persists the session', async function () {

    const auth = buildAuth();
    const instance = buildInstance(1000);

    const result = await auth.createSession(instance, baseCreateOptions());
    assert.equal(result.success, true);
    assert.equal(typeof result.auth_id, 'string');
    assert.match(result.auth_id, /^actor1-[a-zA-Z0-9]+-[a-zA-Z0-9]+$/);
    assert.equal(result.session.tenant_id, 'tenant-A');
    assert.equal(result.session.actor_id, 'actor1');
    assert.equal(result.session.actor_type, 'user');
    assert.equal(result.session.expires_at, 1000 + 3600);
    assert.equal(result.session.install_id, 'install-X');

  });

  it('createSession stamps the cookie when COOKIE_PREFIX is set', async function () {

    const auth = buildAuth();
    const instance = buildInstance(1000);

    const result = await auth.createSession(instance, baseCreateOptions());
    assert.equal(result.success, true);
    assert.match(instance.http_response.cookies['sl_user_tenant-A'], /^sl_user_tenant-A=/);
    assert.match(instance.http_response.cookies['sl_user_tenant-A'], /Max-Age=3600/);

  });

  it('verifySession with a fresh auth_id hydrates instance.session', async function () {

    const auth = buildAuth();
    const create_instance = buildInstance(1000);

    const created = await auth.createSession(create_instance, baseCreateOptions());

    const verify_instance = buildInstance(1500);
    const verified = await auth.verifySession(verify_instance, {
      auth_id: created.auth_id,
      tenant_id: 'tenant-A'
    });

    assert.equal(verified.success, true);
    assert.equal(verified.session.actor_id, 'actor1');
    assert.equal(verify_instance.session.actor_id, 'actor1');

  });

  it('verifySession rejects a forged auth_id', async function () {

    const auth = buildAuth();
    const instance = buildInstance(1000);

    const verified = await auth.verifySession(instance, {
      auth_id: 'actor1-forged-secret',
      tenant_id: 'tenant-A'
    });
    assert.equal(verified.success, false);
    assert.equal(verified.error, TEST_ERRORS.INVALID_TOKEN);

  });

  it('verifySession rejects malformed auth_id', async function () {

    const auth = buildAuth();
    const instance = buildInstance(1000);

    const verified = await auth.verifySession(instance, {
      auth_id: 'not-properly-shaped-token-with-too-many-parts',
      tenant_id: 'tenant-A'
    });
    assert.equal(verified.success, false);
    assert.equal(verified.error, TEST_ERRORS.INVALID_TOKEN);

  });

  it('verifySession rejects an expired session', async function () {

    const auth = buildAuth();
    const create_instance = buildInstance(1000);
    const created = await auth.createSession(create_instance, baseCreateOptions());

    // Jump past the TTL
    const verify_instance = buildInstance(1000 + 3600 + 60);
    const verified = await auth.verifySession(verify_instance, {
      auth_id: created.auth_id,
      tenant_id: 'tenant-A'
    });
    assert.equal(verified.success, false);
    assert.equal(verified.error, TEST_ERRORS.SESSION_EXPIRED);

  });

  it('verifySession reads auth_id from cookie when not passed explicitly', async function () {

    const auth = buildAuth();
    const create_instance = buildInstance(1000);
    const created = await auth.createSession(create_instance, baseCreateOptions());

    const verify_instance = buildInstance(1500);
    verify_instance.http_request = {
      headers: { cookie: 'sl_user_tenant-A=' + created.auth_id }
    };
    const verified = await auth.verifySession(verify_instance, { tenant_id: 'tenant-A' });
    assert.equal(verified.success, true);

  });

  it('removeSession destroys the session and clears the cookie', async function () {

    const auth = buildAuth();
    const create_instance = buildInstance(1000);
    const created = await auth.createSession(create_instance, baseCreateOptions());

    const remove_instance = buildInstance(1500);
    const removed = await auth.removeSession(remove_instance, {
      tenant_id: 'tenant-A',
      actor_id: 'actor1',
      token_key: created.session.token_key
    });
    assert.equal(removed.success, true);
    assert.match(remove_instance.http_response.cookies['sl_user_tenant-A'], /Max-Age=0/);

    // Verify is now rejected
    const verified = await auth.verifySession(buildInstance(1500), {
      auth_id: created.auth_id,
      tenant_id: 'tenant-A'
    });
    assert.equal(verified.success, false);
    assert.equal(verified.error, TEST_ERRORS.INVALID_TOKEN);

  });

});



// ============================================================================
// LIST / COUNT / REMOVE-OTHERS / REMOVE-ALL
// ============================================================================

describe('list / count / removeOthers / removeAll', function () {

  it('listSessions returns only active sessions for the actor', async function () {

    const auth = buildAuth();

    await auth.createSession(buildInstance(1000), baseCreateOptions({ install_id: 'install-1' }));
    await auth.createSession(buildInstance(1001), baseCreateOptions({ install_id: 'install-2' }));
    await auth.createSession(buildInstance(1002), baseCreateOptions({ actor_id: 'otherActor', install_id: 'install-9' }));

    const list = await auth.listSessions(buildInstance(1500), {
      tenant_id: 'tenant-A', actor_id: 'actor1'
    });
    assert.equal(list.success, true);
    assert.equal(list.sessions.length, 2);

  });

  it('countSessions returns the count', async function () {

    const auth = buildAuth();

    await auth.createSession(buildInstance(1000), baseCreateOptions({ install_id: 'install-1' }));
    await auth.createSession(buildInstance(1001), baseCreateOptions({ install_id: 'install-2' }));

    const counted = await auth.countSessions(buildInstance(1500), {
      tenant_id: 'tenant-A', actor_id: 'actor1'
    });
    assert.equal(counted.success, true);
    assert.equal(counted.count, 2);

  });

  it('removeOtherSessions keeps the named token and deletes the rest', async function () {

    const auth = buildAuth();

    const a = await auth.createSession(buildInstance(1000), baseCreateOptions({ install_id: 'install-1' }));
    const b = await auth.createSession(buildInstance(1001), baseCreateOptions({ install_id: 'install-2' }));
    const c = await auth.createSession(buildInstance(1002), baseCreateOptions({ install_id: 'install-3' }));

    const result = await auth.removeOtherSessions(buildInstance(1500), {
      tenant_id: 'tenant-A',
      actor_id: 'actor1',
      keep_token_key: b.session.token_key
    });
    assert.equal(result.success, true);
    assert.equal(result.removed_count, 2);

    // a and c should now be invalid
    const a_check = await auth.verifySession(buildInstance(1500), {
      auth_id: a.auth_id, tenant_id: 'tenant-A'
    });
    assert.equal(a_check.success, false);
    const b_check = await auth.verifySession(buildInstance(1500), {
      auth_id: b.auth_id, tenant_id: 'tenant-A'
    });
    assert.equal(b_check.success, true);
    const c_check = await auth.verifySession(buildInstance(1500), {
      auth_id: c.auth_id, tenant_id: 'tenant-A'
    });
    assert.equal(c_check.success, false);

  });

  it('removeAllSessions deletes everything for the actor and clears the cookie', async function () {

    const auth = buildAuth();

    await auth.createSession(buildInstance(1000), baseCreateOptions({ install_id: 'install-1' }));
    await auth.createSession(buildInstance(1001), baseCreateOptions({ install_id: 'install-2' }));

    const remove_instance = buildInstance(1500);
    const result = await auth.removeAllSessions(remove_instance, {
      tenant_id: 'tenant-A', actor_id: 'actor1'
    });
    assert.equal(result.success, true);
    assert.equal(result.removed_count, 2);
    assert.match(remove_instance.http_response.cookies['sl_user_tenant-A'], /Max-Age=0/);

    const list = await auth.listSessions(buildInstance(1500), {
      tenant_id: 'tenant-A', actor_id: 'actor1'
    });
    assert.equal(list.sessions.length, 0);

  });

});



// ============================================================================
// SAME-INSTALL REPLACEMENT (END-TO-END)
// ============================================================================

describe('same-install replacement end-to-end', function () {

  it('createSession with the same install_id replaces the previous session', async function () {

    const auth = buildAuth();

    const a = await auth.createSession(buildInstance(1000), baseCreateOptions({ install_id: 'install-X' }));
    const b = await auth.createSession(buildInstance(1100), baseCreateOptions({ install_id: 'install-X' }));

    // Old auth_id no longer valid
    const a_check = await auth.verifySession(buildInstance(1500), {
      auth_id: a.auth_id, tenant_id: 'tenant-A'
    });
    assert.equal(a_check.success, false);

    // New auth_id valid
    const b_check = await auth.verifySession(buildInstance(1500), {
      auth_id: b.auth_id, tenant_id: 'tenant-A'
    });
    assert.equal(b_check.success, true);

    // Only one session lives
    const list = await auth.listSessions(buildInstance(1500), {
      tenant_id: 'tenant-A', actor_id: 'actor1'
    });
    assert.equal(list.sessions.length, 1);

  });

  it('createSession with a different install_id keeps both sessions', async function () {

    const auth = buildAuth();

    const a = await auth.createSession(buildInstance(1000), baseCreateOptions({ install_id: 'install-X' }));
    const b = await auth.createSession(buildInstance(1100), baseCreateOptions({ install_id: 'install-Y' }));

    const a_check = await auth.verifySession(buildInstance(1500), { auth_id: a.auth_id, tenant_id: 'tenant-A' });
    const b_check = await auth.verifySession(buildInstance(1500), { auth_id: b.auth_id, tenant_id: 'tenant-A' });
    assert.equal(a_check.success, true);
    assert.equal(b_check.success, true);

  });

});



// ============================================================================
// LIMITS (END-TO-END)
// ============================================================================

describe('limits end-to-end', function () {

  it('total_max with eviction silently removes the LRU session', async function () {

    const auth = buildAuth({
      LIMITS: {
        total_max: 2,
        by_form_factor_max: null,
        by_platform_max: null,
        evict_oldest_on_limit: true
      }
    });

    const a = await auth.createSession(buildInstance(1000), baseCreateOptions({ install_id: 'install-1' }));
    await auth.createSession(buildInstance(1100), baseCreateOptions({ install_id: 'install-2' }));
    const c = await auth.createSession(buildInstance(1200), baseCreateOptions({ install_id: 'install-3' }));

    // Three creates, cap=2 with eviction. The oldest (a, last_active_at=1000) was evicted.
    const a_check = await auth.verifySession(buildInstance(1500), { auth_id: a.auth_id, tenant_id: 'tenant-A' });
    const c_check = await auth.verifySession(buildInstance(1500), { auth_id: c.auth_id, tenant_id: 'tenant-A' });
    assert.equal(a_check.success, false);
    assert.equal(c_check.success, true);

    const list = await auth.listSessions(buildInstance(1500), { tenant_id: 'tenant-A', actor_id: 'actor1' });
    assert.equal(list.sessions.length, 2);

  });

  it('total_max without eviction returns LIMIT_REACHED', async function () {

    const auth = buildAuth({
      LIMITS: {
        total_max: 1,
        by_form_factor_max: null,
        by_platform_max: null,
        evict_oldest_on_limit: false
      }
    });

    await auth.createSession(buildInstance(1000), baseCreateOptions({ install_id: 'install-1' }));
    const second = await auth.createSession(buildInstance(1100), baseCreateOptions({ install_id: 'install-2' }));

    assert.equal(second.success, false);
    assert.equal(second.error, TEST_ERRORS.LIMIT_REACHED);

  });

});



// ============================================================================
// ATTACH / DETACH DEVICE
// ============================================================================

describe('attachDeviceToSession / detachDeviceFromSession', function () {

  it('attachDeviceToSession sets push_provider + push_token on the session', async function () {

    const auth = buildAuth();
    const created = await auth.createSession(buildInstance(1000), baseCreateOptions());

    const attached = await auth.attachDeviceToSession(buildInstance(1500), {
      tenant_id: 'tenant-A',
      actor_id: 'actor1',
      token_key: created.session.token_key,
      push_provider: 'apns',
      push_token: 'apns-token-abc'
    });
    assert.equal(attached.success, true);

    const list = await auth.listSessions(buildInstance(1500), { tenant_id: 'tenant-A', actor_id: 'actor1' });
    assert.equal(list.sessions[0].push_provider, 'apns');
    assert.equal(list.sessions[0].push_token, 'apns-token-abc');

  });

  it('detachDeviceFromSession nullifies push fields', async function () {

    const auth = buildAuth();
    const created = await auth.createSession(buildInstance(1000), baseCreateOptions());

    await auth.attachDeviceToSession(buildInstance(1500), {
      tenant_id: 'tenant-A',
      actor_id: 'actor1',
      token_key: created.session.token_key,
      push_provider: 'apns',
      push_token: 'apns-token-abc'
    });

    await auth.detachDeviceFromSession(buildInstance(1700), {
      tenant_id: 'tenant-A',
      actor_id: 'actor1',
      token_key: created.session.token_key
    });

    const list = await auth.listSessions(buildInstance(1800), { tenant_id: 'tenant-A', actor_id: 'actor1' });
    assert.equal(list.sessions[0].push_provider, null);
    assert.equal(list.sessions[0].push_token, null);

  });

});



// ============================================================================
// LIST PUSH TARGETS
// ============================================================================

describe('listPushTargetsByActor', function () {

  it('returns only sessions with push_provider AND push_token set', async function () {

    const auth = buildAuth();

    // Three sessions, two of which will get push tokens
    const c1 = await auth.createSession(buildInstance(1000), baseCreateOptions({ install_id: 'i1' }));
    const c2 = await auth.createSession(buildInstance(1001), baseCreateOptions({ install_id: 'i2' }));
    await auth.createSession(buildInstance(1002), baseCreateOptions({ install_id: 'i3' })); // no push

    await auth.attachDeviceToSession(buildInstance(1003), {
      tenant_id: 'tenant-A', actor_id: 'actor1',
      token_key: c1.session.token_key,
      push_provider: 'apns', push_token: 'tok-apns-1'
    });
    await auth.attachDeviceToSession(buildInstance(1004), {
      tenant_id: 'tenant-A', actor_id: 'actor1',
      token_key: c2.session.token_key,
      push_provider: 'fcm', push_token: 'tok-fcm-2'
    });

    const result = await auth.listPushTargetsByActor(buildInstance(1100), {
      tenant_id: 'tenant-A',
      actor_id: 'actor1'
    });

    assert.equal(result.success, true);
    assert.equal(result.targets.length, 2);

    const providers = result.targets.map(function (t) { return t.push_provider; }).sort();
    assert.deepEqual(providers, ['apns', 'fcm']);

    // Each target has every canonical field of a session record
    for (const t of result.targets) {
      assert.equal(typeof t.token_key, 'string');
      assert.equal(t.actor_id, 'actor1');
      assert.equal(t.tenant_id, 'tenant-A');
      assert.equal(typeof t.install_platform, 'string');
    }

  });

  it('omits sessions whose push fields were detached', async function () {

    const auth = buildAuth();
    const c = await auth.createSession(buildInstance(1000), baseCreateOptions());

    await auth.attachDeviceToSession(buildInstance(1010), {
      tenant_id: 'tenant-A', actor_id: 'actor1',
      token_key: c.session.token_key,
      push_provider: 'apns', push_token: 'tok'
    });
    let result = await auth.listPushTargetsByActor(buildInstance(1020), {
      tenant_id: 'tenant-A', actor_id: 'actor1'
    });
    assert.equal(result.targets.length, 1);

    await auth.detachDeviceFromSession(buildInstance(1030), {
      tenant_id: 'tenant-A', actor_id: 'actor1',
      token_key: c.session.token_key
    });
    result = await auth.listPushTargetsByActor(buildInstance(1040), {
      tenant_id: 'tenant-A', actor_id: 'actor1'
    });
    assert.equal(result.targets.length, 0);

  });

  it('returns zero targets when the actor has no sessions', async function () {

    const auth = buildAuth();

    const result = await auth.listPushTargetsByActor(buildInstance(1000), {
      tenant_id: 'tenant-A',
      actor_id: 'no-such-actor'
    });
    assert.equal(result.success, true);
    assert.equal(result.targets.length, 0);

  });

});



// ============================================================================
// CLEANUP
// ============================================================================

describe('cleanupExpiredSessions', function () {

  it('removes expired sessions and reports the count', async function () {

    const auth = buildAuth();

    await auth.createSession(buildInstance(1000), baseCreateOptions({ install_id: 'install-1' }));
    await auth.createSession(buildInstance(1001), baseCreateOptions({ install_id: 'install-2' }));

    // Jump well past both sessions' expires_at (1000+3600=4600 and 1001+3600=4601)
    const cleanup_time = 5000;
    const cleanup_instance = buildInstance(cleanup_time);
    const result = await auth.cleanupExpiredSessions(cleanup_instance);
    assert.equal(result.success, true);
    assert.equal(result.deleted_count, 2);

    const list = await auth.listSessions(buildInstance(cleanup_time), {
      tenant_id: 'tenant-A', actor_id: 'actor1'
    });
    assert.equal(list.sessions.length, 0);

  });

});



// ============================================================================
// VALIDATORS (programmer error - throws synchronously)
// ============================================================================

describe('validator throws on programmer errors', function () {

  it('createSession rejects on missing tenant_id', async function () {

    const auth = buildAuth();
    await assert.rejects(
      auth.createSession(buildInstance(1000), { actor_id: 'a', install_platform: 'web', install_form_factor: 'desktop' }),
      TypeError
    );

  });

  it('createSession rejects on bad install_platform', async function () {

    const auth = buildAuth();
    await assert.rejects(
      auth.createSession(buildInstance(1000), {
        tenant_id: 't', actor_id: 'a', install_platform: 'plan9', install_form_factor: 'desktop'
      }),
      TypeError
    );

  });

  it('createAuthId rejects "-" inside actor_id', function () {

    const auth = buildAuth();
    assert.throws(function () {
      auth.createAuthId({ actor_id: 'has-dash', token_key: 'k', token_secret: 's' });
    }, TypeError);

  });

  it('parseAuthId returns null for malformed strings', function () {

    const auth = buildAuth();
    assert.equal(auth.parseAuthId('garbage'), null);
    assert.equal(auth.parseAuthId(null), null);

  });

});
