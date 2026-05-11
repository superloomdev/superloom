// Info: Pure-helper tests for js-server-helper-auth. Exercises every
// stateless part (auth-id, record-shape, cookie, token-source, policy)
// directly via its factory + a small set of loader-validation cases
// using the in-process memory store (no DB driver required).
'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { Lib } = require('./loader')();

const AuthLoader    = require('../auth.js');
const MemoryStore   = require('./memory-store');
const ERRORS = require('../auth.errors');
const CONFIG_STUB = {};

const PolicyFactory      = require('../parts/policy.js');
const RecordShapeFactory = require('../parts/record-shape.js');
const AuthIdFactory      = require('../parts/auth-id.js');
const CookieFactory      = require('../parts/cookie.js');
const TokenSourceFactory = require('../parts/token-source.js');


const buildInstance = function (time_seconds) {

  const instance = Lib.Instance.initialize();
  if (typeof time_seconds === 'number') {
    instance.time = time_seconds;
    instance.time_ms = time_seconds * 1000;
  }
  return instance;

};


// ============================================================================
// LOADER VALIDATION (uses in-process memory store - no DB driver needed)
// ============================================================================

describe('loader validation', function () {

  // Memory store needs no config - STORE_CONFIG: {} satisfies the validator.
  const valid_store_config = {};

  it('throws when STORE is missing', function () {

    assert.throws(function () {
      AuthLoader(Lib, { ACTOR_TYPE: 'user', STORE_CONFIG: valid_store_config });
    }, /CONFIG\.STORE must be a store factory function/);

  });

  it('throws when STORE is not a function', function () {

    assert.throws(function () {
      AuthLoader(Lib, { STORE: 'sqlite', ACTOR_TYPE: 'user', STORE_CONFIG: valid_store_config });
    }, /CONFIG\.STORE must be a store factory function/);

  });

  it('throws when STORE_CONFIG is missing', function () {

    assert.throws(function () {
      AuthLoader(Lib, { STORE: MemoryStore, ACTOR_TYPE: 'user' });
    }, /CONFIG\.STORE_CONFIG is required/);

  });

  it('throws when ACTOR_TYPE is missing', function () {

    assert.throws(function () {
      AuthLoader(Lib, { STORE: MemoryStore, STORE_CONFIG: valid_store_config });
    }, /CONFIG\.ACTOR_TYPE is required/);

  });

  it('throws when ENABLE_JWT is true without a valid JWT.signing_key', function () {

    // Missing JWT block entirely
    assert.throws(function () {
      AuthLoader(Lib, {
        STORE: MemoryStore,
        STORE_CONFIG: valid_store_config,
        ACTOR_TYPE: 'user',
        ENABLE_JWT: true,
        JWT: null,
        TTL_SECONDS: 3600,
        LIMITS: { total_max: 5, evict_oldest_on_limit: true }
      });
    }, /CONFIG\.JWT must be a plain object/);

    // Signing key too short
    assert.throws(function () {
      AuthLoader(Lib, {
        STORE: MemoryStore,
        STORE_CONFIG: valid_store_config,
        ACTOR_TYPE: 'user',
        ENABLE_JWT: true,
        JWT: { signing_key: 'short', issuer: 'test', audience: 'test' },
        TTL_SECONDS: 3600,
        LIMITS: { total_max: 5, evict_oldest_on_limit: true }
      });
    }, /CONFIG\.JWT\.signing_key must be a string of at least 32 chars/);

  });

});



// ============================================================================
// AUTH-ID HELPERS (pure)
// ============================================================================

describe('parts/auth-id', function () {

  const AuthId = AuthIdFactory(Lib, CONFIG_STUB, ERRORS);

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

  const RecordShape = RecordShapeFactory(Lib, CONFIG_STUB, ERRORS);

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

  const Cookie = CookieFactory(Lib, CONFIG_STUB, ERRORS);

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

  const TokenSource = TokenSourceFactory(Lib, CONFIG_STUB, ERRORS);

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

  const Policy = PolicyFactory(Lib, CONFIG_STUB, ERRORS);

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
