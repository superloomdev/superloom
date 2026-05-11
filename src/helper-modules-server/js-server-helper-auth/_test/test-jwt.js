// Info: JWT-mode tests for js-server-helper-auth.
// JWT logic is store-agnostic. We back these tests with the in-process
// memory store (no DB driver required). The few code paths that need a
// real store (chiefly refreshSessionJwt) work correctly with it.
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { Lib } = require('./loader')();
const AuthLoader  = require('../auth.js');
const MemoryStore = require('./memory-store');


// Shared store instance so cleanupBetweenTests can call _clear().
const sharedStore = MemoryStore();


// 64-char signing key gives HS256 the full security margin.
const SIGNING_KEY = 'k'.repeat(64);


const buildAuth = function (overrides) {

  const config = Object.assign({
    STORE: function () { return sharedStore; },
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
    ENABLE_JWT: true,
    JWT: {
      signing_key: SIGNING_KEY,
      algorithm: 'HS256',
      issuer: 'test-issuer',
      audience: 'test-audience',
      access_token_ttl_seconds: 900,
      refresh_token_ttl_seconds: 2592000,
      rotate_refresh_token: true
    },
    COOKIE_PREFIX: 'sl_user_'
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


// No before/after needed for the memory store - no connection to open or close.


// Wipe all records between tests so unique-key collisions don't leak across cases.
const cleanupBetweenTests = function () {
  sharedStore._clear();
};


describe('jwt-mode: createSession returns access + refresh tokens', function () {

  it('mints both tokens with sensible claims', async function () {

    cleanupBetweenTests();
    const auth = buildAuth();
    const instance = buildInstance(1000);

    const result = await auth.createSession(instance, baseCreateOptions());

    assert.equal(result.success, true);
    assert.equal(typeof result.access_token, 'string');
    assert.equal(typeof result.refresh_token, 'string');

    // Access token: header.payload.signature
    assert.equal(result.access_token.split('.').length, 3);

    // Refresh token: actor_id-token_key-secret (3 segments split by '-')
    assert.equal(result.refresh_token.split('-').length, 3);

    // Verify the access token statelessly
    const verify = auth.verifyJwt(instance, { jwt: result.access_token });
    assert.equal(verify.success, true);
    assert.equal(verify.claims.iss, 'test-issuer');
    assert.equal(verify.claims.aud, 'test-audience');
    assert.equal(verify.claims.sub, 'actor1');
    assert.equal(verify.claims.tid, 'tenant-A');
    assert.equal(verify.claims.atp, 'user');
    assert.equal(verify.claims.iat, 1000);
    assert.equal(verify.claims.exp, 1000 + 900);

  });

});


describe('jwt-mode: verifyJwt rejects malformed / tampered / expired tokens', function () {

  it('rejects an empty / non-string jwt as INVALID_TOKEN', function () {

    const auth = buildAuth();
    const instance = buildInstance(1000);

    const r1 = auth.verifyJwt(instance, { jwt: '' });
    assert.equal(r1.success, false);
    assert.equal(r1.error.type, 'AUTH_INVALID_TOKEN');

    const r2 = auth.verifyJwt(instance, { jwt: null });
    assert.equal(r2.success, false);
    assert.equal(r2.error.type, 'AUTH_INVALID_TOKEN');

  });

  it('rejects a token with the wrong signature', async function () {

    cleanupBetweenTests();

    const auth_a = buildAuth({ JWT: { signing_key: 'a'.repeat(64), issuer: 'iss', audience: 'aud', access_token_ttl_seconds: 900, refresh_token_ttl_seconds: 1000, rotate_refresh_token: true } });
    const auth_b = buildAuth({ JWT: { signing_key: 'b'.repeat(64), issuer: 'iss', audience: 'aud', access_token_ttl_seconds: 900, refresh_token_ttl_seconds: 1000, rotate_refresh_token: true } });

    const create = await auth_a.createSession(buildInstance(1000), baseCreateOptions());
    const verify = auth_b.verifyJwt(buildInstance(1000), { jwt: create.access_token });

    assert.equal(verify.success, false);
    assert.equal(verify.error.type, 'AUTH_INVALID_TOKEN');

  });

  it('rejects an expired token with SESSION_EXPIRED', async function () {

    cleanupBetweenTests();
    const auth = buildAuth();
    const create = await auth.createSession(buildInstance(1000), baseCreateOptions());

    // 901 seconds later - access token TTL is 900
    const verify = auth.verifyJwt(buildInstance(1000 + 901), { jwt: create.access_token });

    assert.equal(verify.success, false);
    assert.equal(verify.error.type, 'AUTH_SESSION_EXPIRED');

  });

  it('rejects a token from a sibling actor_type with ACTOR_TYPE_MISMATCH', async function () {

    cleanupBetweenTests();

    const auth_user = buildAuth({ ACTOR_TYPE: 'user' });
    const auth_admin = buildAuth({ ACTOR_TYPE: 'admin' });

    const create = await auth_user.createSession(buildInstance(1000), baseCreateOptions());

    // Admin instance shares the signing key but has a different ACTOR_TYPE
    const verify = auth_admin.verifyJwt(buildInstance(1000), { jwt: create.access_token });

    assert.equal(verify.success, false);
    assert.equal(verify.error.type, 'AUTH_ACTOR_TYPE_MISMATCH');

  });

});


describe('jwt-mode: refreshSessionJwt rotation flow', function () {

  it('exchanges a valid refresh token for new access + new refresh', async function () {

    cleanupBetweenTests();
    const auth = buildAuth();
    const create = await auth.createSession(buildInstance(1000), baseCreateOptions());

    const refresh_instance = buildInstance(2000);
    const refreshed = await auth.refreshSessionJwt(refresh_instance, {
      tenant_id: 'tenant-A',
      refresh_token: create.refresh_token
    });

    assert.equal(refreshed.success, true);
    assert.notEqual(refreshed.refresh_token, create.refresh_token, 'refresh token must rotate');
    // The same actor_id and token_key are kept, only the secret rotates
    assert.equal(refreshed.refresh_token.split('-')[0], 'actor1');
    assert.equal(refreshed.refresh_token.split('-')[1], create.refresh_token.split('-')[1]);

    // The new access token must verify
    const verify = auth.verifyJwt(refresh_instance, { jwt: refreshed.access_token });
    assert.equal(verify.success, true);
    // Iat reflects the refresh time, not the original create time
    assert.equal(verify.claims.iat, 2000);

    // The session lifecycle was rolled forward
    assert.equal(refreshed.session.last_active_at, 2000);
    assert.equal(refreshed.session.expires_at, 2000 + 3600);

  });

  it('invalidates the old refresh token after rotation (single-use)', async function () {

    cleanupBetweenTests();
    const auth = buildAuth();
    const create = await auth.createSession(buildInstance(1000), baseCreateOptions());

    // First refresh: success
    const first = await auth.refreshSessionJwt(buildInstance(2000), {
      tenant_id: 'tenant-A',
      refresh_token: create.refresh_token
    });
    assert.equal(first.success, true);

    // Second refresh with the OLD token: must fail
    const second = await auth.refreshSessionJwt(buildInstance(3000), {
      tenant_id: 'tenant-A',
      refresh_token: create.refresh_token
    });
    assert.equal(second.success, false);
    assert.equal(second.error.type, 'AUTH_INVALID_TOKEN');

  });

  it('rejects a malformed refresh token with INVALID_TOKEN', async function () {

    cleanupBetweenTests();
    const auth = buildAuth();
    await auth.createSession(buildInstance(1000), baseCreateOptions());

    const r = await auth.refreshSessionJwt(buildInstance(2000), {
      tenant_id: 'tenant-A',
      refresh_token: 'garbage-only-two-segments'
    });
    assert.equal(r.success, false);
    assert.equal(r.error.type, 'AUTH_INVALID_TOKEN');

  });

  it('rejects refresh after session expires', async function () {

    cleanupBetweenTests();
    const auth = buildAuth({ TTL_SECONDS: 100 });
    const create = await auth.createSession(buildInstance(1000), baseCreateOptions());

    // 200 seconds later - past the TTL of 100
    const r = await auth.refreshSessionJwt(buildInstance(1200), {
      tenant_id: 'tenant-A',
      refresh_token: create.refresh_token
    });
    assert.equal(r.success, false);
    assert.equal(r.error.type, 'AUTH_SESSION_EXPIRED');

  });

  it('rejects refresh tokens from a different tenant', async function () {

    cleanupBetweenTests();
    const auth = buildAuth();
    const create = await auth.createSession(buildInstance(1000), baseCreateOptions({ tenant_id: 'tenant-A' }));

    const r = await auth.refreshSessionJwt(buildInstance(2000), {
      tenant_id: 'tenant-B', // wrong tenant
      refresh_token: create.refresh_token
    });
    assert.equal(r.success, false);
    assert.equal(r.error.type, 'AUTH_INVALID_TOKEN');

  });

});


describe('jwt-mode: signSessionJwt mints a token from an existing session', function () {

  it('returns a fresh access token for a record that was created via createSession', async function () {

    cleanupBetweenTests();
    const auth = buildAuth();
    const create = await auth.createSession(buildInstance(1000), baseCreateOptions());

    const minted = auth.signSessionJwt(buildInstance(2000), { session: create.session });

    assert.equal(minted.success, true);
    assert.equal(typeof minted.access_token, 'string');

    const verify = auth.verifyJwt(buildInstance(2000), { jwt: minted.access_token });
    assert.equal(verify.success, true);
    assert.equal(verify.claims.iat, 2000);
    assert.equal(verify.claims.exp, 2000 + 900);

  });

});


describe('jwt-mode: db-mode APIs throw when called with ENABLE_JWT=false', function () {

  it('verifyJwt requires ENABLE_JWT=true', function () {

    const auth = buildAuth({ ENABLE_JWT: false, JWT: undefined });
    assert.throws(function () {
      auth.verifyJwt(buildInstance(1000), { jwt: 'whatever' });
    }, /requires CONFIG\.ENABLE_JWT=true/);

  });

  it('refreshSessionJwt requires ENABLE_JWT=true', async function () {

    const auth = buildAuth({ ENABLE_JWT: false, JWT: undefined });
    await assert.rejects(async function () {
      await auth.refreshSessionJwt(buildInstance(1000), {
        tenant_id: 't', refresh_token: 'x-y-z'
      });
    }, /requires CONFIG\.ENABLE_JWT=true/);

  });

});
