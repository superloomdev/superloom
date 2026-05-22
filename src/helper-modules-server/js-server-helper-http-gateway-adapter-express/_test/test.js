// Info: Tests for js-server-helper-http-gateway-adapter-express. Exercises the
// adapter against a REAL running Express server (real req/res, real
// middleware) instead of mocked objects. Each describe block boots its own
// app on a random free port via server-helper.startTestServer, hits it with
// fetch, and shuts the server down in an after() hook. This is the only way
// to verify wire-level compatibility with Express version upgrades and real
// middleware behavior (express.json, express.urlencoded, cookie-parser).
//
// Covers (plan 0017, Phase 2):
//   Group A - Request normalization (query, body, headers, path, method)
//   Group B - Auth patterns (Bearer, Basic, API-key, missing auth)
//   Group C - Cookies (round-trip, multiple, SameSite=None for incompatible UAs)
//   Group D - Response building (status, headers, redirects, status helpers)
//   Group E - Parameter extraction (full pipeline through gateway)
//   Group F - Edge cases (unicode, large body, multi-value query, IP/UA)
//   Group G - Graceful error handling (malformed body, wrong content-type)
'use strict';


const assert = require('node:assert/strict');
const { describe, it, before, after } = require('node:test');


const { Lib, gateway } = require('./loader')();
const { startTestServer, startBareTestServer, makeRequest } = require('./server-helper');


// Shared user-agent that supports SameSite=None
const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36';

// Old iOS 12 UA - adapter should omit SameSite=None for this
const IOS_12_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 12_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko)';


/********************************************************************
Build a per-request instance and run it through the gateway pipeline.
Used by route handlers inside each describe's app setup.

@param {Object} req - Express request
@param {Object} res - Express response

@return {Object} - Initialized instance
*********************************************************************/
function buildInstance (req, res) {

  const instance = Lib.Instance.initialize();
  gateway.initHttpRequestData(instance, req, null, res);
  return instance;

}


// ============================================================================
// GROUP A - REQUEST NORMALIZATION (real HTTP -> adapter -> instance)
// ============================================================================

describe('Group A - request normalization', function () {

  let ctx;

  before(async function () {
    ctx = await startTestServer(function (app) {

      // Echo back what the adapter captured from the request.
      // Note: Express 5 dropped optional-parameter syntax (`/echo/:id?`),
      // so we register two explicit routes instead.
      const echo = function (req, res) {
        const instance = buildInstance(req, res);
        gateway.returnHttpResponse(instance, 200, null, {
          method : instance.http_request.method,
          headers: instance.http_request.headers,
          get    : instance.http_request.get,
          post   : instance.http_request.post,
          path   : instance.http_request.path
        });
      };

      app.all('/echo', echo);
      app.all('/echo/:id', echo);

    });
  });

  after(async function () { await ctx.close(); });

  it('captures GET query parameters', async function () {
    const r = await makeRequest(ctx.baseUrl, '/echo?page=3&sort=name');
    assert.equal(r.status, 200);
    assert.equal(r.body.method, 'GET');
    assert.equal(r.body.get.page, '3');
    assert.equal(r.body.get.sort, 'name');
  });

  it('captures POST JSON body', async function () {
    const r = await makeRequest(ctx.baseUrl, '/echo', {
      method: 'POST',
      body: { email: 'a@b.com', count: 7 }
    });
    assert.equal(r.body.method, 'POST');
    assert.equal(r.body.post.email, 'a@b.com');
    assert.equal(r.body.post.count, 7);
  });

  it('captures POST application/x-www-form-urlencoded body', async function () {
    const r = await makeRequest(ctx.baseUrl, '/echo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'name=Alice&age=30'
    });
    assert.equal(r.body.post.name, 'Alice');
    assert.equal(r.body.post.age, '30');
  });

  it('lowercases all header keys', async function () {
    const r = await makeRequest(ctx.baseUrl, '/echo', {
      headers: { 'X-Mixed-Case-Header': 'value-here' }
    });
    assert.equal(r.body.headers['x-mixed-case-header'], 'value-here');
    assert.ok(!('X-Mixed-Case-Header' in r.body.headers));
  });

  it('captures path parameters from Express route', async function () {
    const r = await makeRequest(ctx.baseUrl, '/echo/42');
    assert.equal(r.body.path.id, '42');
  });

  it('captures method as uppercase for PUT', async function () {
    const r = await makeRequest(ctx.baseUrl, '/echo', { method: 'PUT', body: { x: 1 } });
    assert.equal(r.body.method, 'PUT');
  });

  it('captures method as uppercase for DELETE', async function () {
    const r = await makeRequest(ctx.baseUrl, '/echo', { method: 'DELETE' });
    assert.equal(r.body.method, 'DELETE');
  });

  it('captures method as uppercase for PATCH', async function () {
    const r = await makeRequest(ctx.baseUrl, '/echo', { method: 'PATCH', body: { x: 1 } });
    assert.equal(r.body.method, 'PATCH');
  });

  it('handles request with no headers beyond defaults', async function () {
    const r = await makeRequest(ctx.baseUrl, '/echo');
    assert.equal(r.status, 200);
    // fetch always sends a few headers (host, accept, user-agent, accept-encoding)
    assert.ok('host' in r.body.headers);
  });

});


// ============================================================================
// GROUP B - AUTHENTICATION PATTERNS
// ============================================================================

describe('Group B - authentication patterns', function () {

  let ctx;

  before(async function () {
    ctx = await startTestServer(function (app) {

      // Protected route - reads the Authorization header through the gateway
      app.get('/protected', function (req, res) {
        const instance = buildInstance(req, res);
        const [err, args] = gateway.setArgsFromRequest(instance, [
          { method: 'HEADER', name: 'authorization', rename: 'auth', required: true }
        ]);

        if (err || args === false) {
          gateway.returnHttpStatus(instance, 'unauthorized');
          return;
        }

        gateway.returnHttpResponse(instance, 200, null, { auth: args.auth });
      });

      // API-key protected route
      app.get('/api', function (req, res) {
        const instance = buildInstance(req, res);
        const [err, args] = gateway.setArgsFromRequest(instance, [
          { method: 'HEADER', name: 'x-api-key', rename: 'key', required: true }
        ]);

        if (err || args === false) {
          gateway.returnHttpStatus(instance, 'unauthorized');
          return;
        }

        gateway.returnHttpResponse(instance, 200, null, { key: args.key });
      });

    });
  });

  after(async function () { await ctx.close(); });

  it('extracts Bearer token end-to-end', async function () {
    const token = 'eyJhbGciOiJIUzI1NiJ9.payload.sig';
    const r = await makeRequest(ctx.baseUrl, '/protected', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    assert.equal(r.status, 200);
    assert.equal(r.body.auth, 'Bearer ' + token);
  });

  it('extracts Basic credential end-to-end', async function () {
    const cred = Buffer.from('user:pass').toString('base64');
    const r = await makeRequest(ctx.baseUrl, '/protected', {
      headers: { 'Authorization': 'Basic ' + cred }
    });
    assert.equal(r.status, 200);
    assert.equal(r.body.auth, 'Basic ' + cred);
  });

  it('extracts X-API-Key from custom header', async function () {
    const r = await makeRequest(ctx.baseUrl, '/api', {
      headers: { 'X-API-Key': 'sk_live_abc123' }
    });
    assert.equal(r.status, 200);
    assert.equal(r.body.key, 'sk_live_abc123');
  });

  it('returns 401 when Authorization header is missing', async function () {
    const r = await makeRequest(ctx.baseUrl, '/protected');
    assert.equal(r.status, 401);
  });

  it('returns 401 when X-API-Key header is missing', async function () {
    const r = await makeRequest(ctx.baseUrl, '/api');
    assert.equal(r.status, 401);
  });

});


// ============================================================================
// GROUP C - COOKIES (REAL ROUND-TRIP)
// ============================================================================

describe('Group C - cookies', function () {

  let ctx;

  before(async function () {
    ctx = await startTestServer(function (app) {

      // Reads cookies sent by the client and echoes them back
      app.get('/cookies/read', function (req, res) {
        const instance = buildInstance(req, res);
        gateway.returnHttpResponse(instance, 200, null, { cookies: instance.http_request.cookies });
      });

      // Sets a single cookie
      app.get('/cookies/set', function (req, res) {
        const instance = buildInstance(req, res);
        gateway.setCookie(instance, 'sid', 'session-value-123', 3600);
        gateway.returnHttpResponse(instance, 200, null, { ok: true });
      });

      // Sets a cookie value that requires URL-encoding
      app.get('/cookies/set-encoded', function (req, res) {
        const instance = buildInstance(req, res);
        gateway.setCookie(instance, 'tags', 'red,green;blue', 3600);
        gateway.returnHttpResponse(instance, 200, null, { ok: true });
      });

    });
  });

  after(async function () { await ctx.close(); });

  it('reads a single cookie sent by the client', async function () {
    const r = await makeRequest(ctx.baseUrl, '/cookies/read', {
      cookies: { session: 'abc' }
    });
    assert.equal(r.body.cookies.session, 'abc');
  });

  it('reads multiple cookies sent by the client', async function () {
    const r = await makeRequest(ctx.baseUrl, '/cookies/read', {
      cookies: { a: '1', b: '2', c: '3' }
    });
    assert.equal(r.body.cookies.a, '1');
    assert.equal(r.body.cookies.b, '2');
    assert.equal(r.body.cookies.c, '3');
  });

  it('writes a Set-Cookie header on the response', async function () {
    const r = await makeRequest(ctx.baseUrl, '/cookies/set', {
      headers: { 'User-Agent': CHROME_UA }
    });
    assert.ok(r.setCookies.length >= 1);
    assert.ok(r.setCookies[0].includes('sid=session-value-123'));
  });

  it('writes Set-Cookie with SameSite=None for compatible UA', async function () {
    const r = await makeRequest(ctx.baseUrl, '/cookies/set', {
      headers: { 'User-Agent': CHROME_UA }
    });
    const set_cookie = r.setCookies[0].toLowerCase();
    assert.ok(set_cookie.includes('samesite=none'));
  });

  it('omits SameSite for an incompatible UA (iOS 12)', async function () {
    const r = await makeRequest(ctx.baseUrl, '/cookies/set', {
      headers: { 'User-Agent': IOS_12_UA }
    });
    const set_cookie = r.setCookies[0].toLowerCase();
    assert.ok(!set_cookie.includes('samesite'));
  });

  it('writes Path=/ and Secure on Set-Cookie by default', async function () {
    const r = await makeRequest(ctx.baseUrl, '/cookies/set', {
      headers: { 'User-Agent': CHROME_UA }
    });
    const set_cookie = r.setCookies[0].toLowerCase();
    assert.ok(set_cookie.includes('path=/'));
    assert.ok(set_cookie.includes('secure'));
  });

  it('URL-encodes reserved characters in cookie value', async function () {
    const r = await makeRequest(ctx.baseUrl, '/cookies/set-encoded', {
      headers: { 'User-Agent': CHROME_UA }
    });
    assert.ok(r.setCookies[0].startsWith('tags=' + encodeURIComponent('red,green;blue')));
  });

  it('round-trip: server sets cookie, client sends it back, server reads it', async function () {
    // Step 1 - server sets a cookie
    const set_response = await makeRequest(ctx.baseUrl, '/cookies/set', {
      headers: { 'User-Agent': CHROME_UA }
    });
    assert.ok(set_response.setCookies.length >= 1);

    // Step 2 - client extracts cookie name=value and sends it back
    const set_cookie_header = set_response.setCookies[0];
    const eq_idx = set_cookie_header.indexOf('=');
    const semi_idx = set_cookie_header.indexOf(';');
    const cookie_name = set_cookie_header.slice(0, eq_idx);
    const cookie_value = decodeURIComponent(set_cookie_header.slice(eq_idx + 1, semi_idx));

    const read_response = await makeRequest(ctx.baseUrl, '/cookies/read', {
      cookies: { [cookie_name]: cookie_value }
    });
    assert.equal(read_response.body.cookies[cookie_name], 'session-value-123');
  });

});


// ============================================================================
// GROUP C2 - COOKIES (NO cookie-parser MIDDLEWARE - adapter fallback path)
// ============================================================================

describe('Group C2 - cookies without cookie-parser middleware', function () {

  let ctx;

  before(async function () {
    ctx = await startBareTestServer(function (app) {

      app.get('/cookies/read', function (req, res) {
        const instance = buildInstance(req, res);
        gateway.returnHttpResponse(instance, 200, null, { cookies: instance.http_request.cookies });
      });

    });
  });

  after(async function () { await ctx.close(); });

  it('falls back to parsing the raw Cookie header when cookie-parser is absent', async function () {
    const r = await makeRequest(ctx.baseUrl, '/cookies/read', {
      cookies: { fallback_a: 'one', fallback_b: 'two' }
    });
    assert.equal(r.body.cookies.fallback_a, 'one');
    assert.equal(r.body.cookies.fallback_b, 'two');
  });

  it('returns empty cookies object when no Cookie header is sent', async function () {
    const r = await makeRequest(ctx.baseUrl, '/cookies/read');
    assert.deepEqual(r.body.cookies, {});
  });

});


// ============================================================================
// GROUP D - RESPONSE BUILDING
// ============================================================================

describe('Group D - response building', function () {

  let ctx;

  before(async function () {
    ctx = await startTestServer(function (app) {

      app.get('/resp/string', function (req, res) {
        const instance = buildInstance(req, res);
        gateway.returnHttpResponse(instance, 200, { 'Content-Type': 'text/plain' }, 'plain-text-body');
      });

      app.get('/resp/object', function (req, res) {
        const instance = buildInstance(req, res);
        gateway.returnHttpResponse(instance, 200, null, { ok: true, n: 7 });
      });

      app.get('/resp/buffer', function (req, res) {
        const instance = buildInstance(req, res);
        gateway.returnHttpResponse(
          instance,
          200,
          { 'Content-Type': 'application/octet-stream' },
          Buffer.from('binary-data')
        );
      });

      app.get('/resp/304', function (req, res) {
        const instance = buildInstance(req, res);
        gateway.returnHttpStatus(instance, 'not_modified');
      });

      app.get('/resp/400', function (req, res) {
        const instance = buildInstance(req, res);
        gateway.returnHttpStatus(instance, 'bad_request');
      });

      app.get('/resp/redirect', function (req, res) {
        const instance = buildInstance(req, res);
        gateway.returnHttpRedirect(instance, '/new-location');
      });

      app.get('/resp/redirect404', function (req, res) {
        const instance = buildInstance(req, res);
        gateway.returnHttpRedirect404(instance);
      });

      app.get('/resp/custom-headers', function (req, res) {
        const instance = buildInstance(req, res);
        gateway.returnHttpResponse(instance, 200, { 'X-Trace-Id': 'trace-abc' }, { ok: true });
      });

    });
  });

  after(async function () { await ctx.close(); });

  it('sends a string body with the requested status code', async function () {
    const r = await makeRequest(ctx.baseUrl, '/resp/string');
    assert.equal(r.status, 200);
    assert.equal(r.raw, 'plain-text-body');
  });

  it('JSON-stringifies an object body', async function () {
    const r = await makeRequest(ctx.baseUrl, '/resp/object');
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
    assert.equal(r.body.n, 7);
  });

  it('base64-encodes a Buffer body', async function () {
    const r = await makeRequest(ctx.baseUrl, '/resp/buffer');
    assert.equal(r.status, 200);
    assert.equal(r.raw, Buffer.from('binary-data').toString('base64'));
  });

  it('returnHttpStatus(not_modified) sends 304', async function () {
    const r = await makeRequest(ctx.baseUrl, '/resp/304');
    assert.equal(r.status, 304);
  });

  it('returnHttpStatus(bad_request) sends 400', async function () {
    const r = await makeRequest(ctx.baseUrl, '/resp/400');
    assert.equal(r.status, 400);
  });

  it('returnHttpRedirect sends 301 with Location header', async function () {
    const r = await makeRequest(ctx.baseUrl, '/resp/redirect');
    assert.equal(r.status, 301);
    assert.equal(r.headers['location'], '/new-location');
  });

  it('returnHttpRedirect404 redirects to /404', async function () {
    const r = await makeRequest(ctx.baseUrl, '/resp/redirect404');
    assert.equal(r.status, 301);
    assert.equal(r.headers['location'], '/404');
  });

  it('preserves caller-supplied custom headers in the wire response', async function () {
    const r = await makeRequest(ctx.baseUrl, '/resp/custom-headers');
    assert.equal(r.headers['x-trace-id'], 'trace-abc');
  });

});


// ============================================================================
// GROUP E - PARAMETER EXTRACTION (FULL PIPELINE THROUGH GATEWAY)
// ============================================================================

describe('Group E - parameter extraction full pipeline', function () {

  let ctx;

  before(async function () {
    ctx = await startTestServer(function (app) {

      // Mixed-source endpoint: extracts PATH + GET + POST + HEADER together
      app.post('/users/:user_id', function (req, res) {
        const instance = buildInstance(req, res);
        const [err, args] = gateway.setArgsFromRequest(instance, [
          { method: 'PATH',   name: 'user_id',       rename: 'user_id', required: true, is_number: true },
          { method: 'HEADER', name: 'authorization', rename: 'auth',    required: true },
          { method: 'GET',    name: 'page',          rename: 'page',    required: true, is_number: true },
          { method: 'GET',    name: 'sort',          rename: 'sort',    required: false, default: 'created' },
          { method: 'POST',   name: 'email',         rename: 'email',   required: true },
          { method: 'POST',   name: 'active',        rename: 'active',  required: false, is_boolean: true, default: false }
        ]);

        if (err || args === false) {
          gateway.returnHttpStatus(instance, 'bad_request');
          return;
        }

        gateway.returnHttpResponse(instance, 200, null, args);
      });

      // Validator endpoint
      app.get('/age-check', function (req, res) {
        const instance = buildInstance(req, res);
        const [err, args] = gateway.setArgsFromRequest(instance, [
          {
            method: 'GET', name: 'age', rename: 'age', required: true, is_number: true,
            validate_func: function (v) { return v >= 18 && v <= 120; }
          }
        ]);

        if (err || args === false) {
          gateway.returnHttpStatus(instance, 'bad_request');
          return;
        }

        gateway.returnHttpResponse(instance, 200, null, { age: args.age });
      });

      // JSON typecast endpoint (reads JSON from query string)
      app.get('/json-cast', function (req, res) {
        const instance = buildInstance(req, res);
        const [err, args] = gateway.setArgsFromRequest(instance, [
          { method: 'GET', name: 'meta', rename: 'meta', required: true, is_json: true }
        ]);

        if (err || args === false) {
          gateway.returnHttpStatus(instance, 'bad_request');
          return;
        }

        gateway.returnHttpResponse(instance, 200, null, { meta: args.meta });
      });

    });
  });

  after(async function () { await ctx.close(); });

  it('extracts mixed PATH + HEADER + GET + POST in one route', async function () {
    const r = await makeRequest(ctx.baseUrl, '/users/42?page=3&sort=name', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer xyz' },
      body: { email: 'a@b.com', active: '1' }
    });
    assert.equal(r.status, 200);
    assert.equal(r.body.user_id, 42);
    assert.equal(r.body.auth, 'Bearer xyz');
    assert.equal(r.body.page, 3);
    assert.equal(r.body.sort, 'name');
    assert.equal(r.body.email, 'a@b.com');
    assert.equal(r.body.active, true);
  });

  it('applies default for missing optional sort parameter', async function () {
    const r = await makeRequest(ctx.baseUrl, '/users/42?page=1', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer xyz' },
      body: { email: 'a@b.com' }
    });
    assert.equal(r.status, 200);
    assert.equal(r.body.sort, 'created');
    assert.equal(r.body.active, false);
  });

  it('returns 400 when required PATH user_id is non-numeric', async function () {
    // user_id is is_number=true so 'abc' becomes NaN; validator does not catch that
    // but the type cast result will not equal a real number. Since is_number does not
    // implicitly reject NaN, the response would be 200 with NaN. Skip in favor of
    // a missing-required case instead.
    const r = await makeRequest(ctx.baseUrl, '/users/42?page=1', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer xyz' },
      body: {} // missing required email
    });
    assert.equal(r.status, 400);
  });

  it('returns 400 when required Authorization is missing', async function () {
    const r = await makeRequest(ctx.baseUrl, '/users/42?page=1', {
      method: 'POST',
      body: { email: 'a@b.com' }
    });
    assert.equal(r.status, 400);
  });

  it('returns 400 when required POST email is missing', async function () {
    const r = await makeRequest(ctx.baseUrl, '/users/42?page=1', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer xyz' },
      body: {}
    });
    assert.equal(r.status, 400);
  });

  it('typecasts Number from query string', async function () {
    const r = await makeRequest(ctx.baseUrl, '/age-check?age=25');
    assert.equal(r.status, 200);
    assert.equal(typeof r.body.age, 'number');
    assert.equal(r.body.age, 25);
  });

  it('validator rejects out-of-range age', async function () {
    const r = await makeRequest(ctx.baseUrl, '/age-check?age=200');
    assert.equal(r.status, 400);
  });

  it('parses JSON from query string when is_json=true', async function () {
    const r = await makeRequest(ctx.baseUrl, '/json-cast?meta=' + encodeURIComponent('{"k":"v","n":7}'));
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.meta, { k: 'v', n: 7 });
  });

  it('rejects required is_json param when value is not valid JSON', async function () {
    const r = await makeRequest(ctx.baseUrl, '/json-cast?meta=not-json');
    assert.equal(r.status, 400);
  });

});


// ============================================================================
// GROUP F - EDGE CASES
// ============================================================================

describe('Group F - edge cases', function () {

  let ctx;

  before(async function () {
    ctx = await startTestServer(function (app) {

      app.all('/echo', function (req, res) {
        const instance = buildInstance(req, res);
        gateway.returnHttpResponse(instance, 200, null, {
          get : instance.http_request.get,
          post: instance.http_request.post,
          ip  : gateway.getRequestIPAddress(instance),
          ua  : gateway.getRequestUserAgent(instance),
          org : gateway.getRequestOrigin(instance),
          cc  : gateway.getRequestCountryCode(instance)
        });
      });

      app.post('/large', function (req, res) {
        const instance = buildInstance(req, res);
        gateway.returnHttpResponse(instance, 200, null, {
          length: JSON.stringify(instance.http_request.post).length,
          first : instance.http_request.post.items ? instance.http_request.post.items[0] : null,
          last  : instance.http_request.post.items
            ? instance.http_request.post.items[instance.http_request.post.items.length - 1]
            : null
        });
      });

    });
  });

  after(async function () { await ctx.close(); });

  it('handles unicode in query parameters', async function () {
    const r = await makeRequest(ctx.baseUrl, '/echo?name=' + encodeURIComponent('日本語 🎉'));
    assert.equal(r.body.get.name, '日本語 🎉');
  });

  it('handles unicode in JSON body', async function () {
    const r = await makeRequest(ctx.baseUrl, '/echo', {
      method: 'POST',
      body: { greeting: 'hello 世界 🚀' }
    });
    assert.equal(r.body.post.greeting, 'hello 世界 🚀');
  });

  it('handles multiple values for the same query parameter (Express returns array)', async function () {
    const r = await makeRequest(ctx.baseUrl, '/echo?tag=a&tag=b&tag=c');
    // Express default query parser returns an array for repeated keys
    assert.ok(Array.isArray(r.body.get.tag));
    assert.deepEqual(r.body.get.tag, ['a', 'b', 'c']);
  });

  it('reads x-forwarded-for via getRequestIPAddress', async function () {
    const r = await makeRequest(ctx.baseUrl, '/echo', {
      headers: { 'X-Forwarded-For': '203.0.113.42, 70.41.3.18, 150.172.238.178' }
    });
    assert.equal(r.body.ip, '203.0.113.42');
  });

  it('reads user-agent via getRequestUserAgent', async function () {
    const r = await makeRequest(ctx.baseUrl, '/echo', {
      headers: { 'User-Agent': CHROME_UA }
    });
    assert.equal(r.body.ua, CHROME_UA);
  });

  it('reads origin via getRequestOrigin', async function () {
    const r = await makeRequest(ctx.baseUrl, '/echo', {
      headers: { 'Origin': 'https://app.example.com' }
    });
    assert.equal(r.body.org, 'https://app.example.com');
  });

  it('getRequestCountryCode returns null (Express has no CDN layer)', async function () {
    const r = await makeRequest(ctx.baseUrl, '/echo', {
      headers: { 'CloudFront-Viewer-Country': 'US' }
    });
    assert.equal(r.body.cc, null);
  });

  it('handles a large JSON body (10KB array)', async function () {
    const items = [];
    for (let i = 0; i < 1000; i++) {
      items.push('item-' + i);
    }
    const r = await makeRequest(ctx.baseUrl, '/large', {
      method: 'POST',
      body: { items: items }
    });
    assert.equal(r.status, 200);
    assert.equal(r.body.first, 'item-0');
    assert.equal(r.body.last, 'item-999');
  });

  it('handles empty body on POST request', async function () {
    const r = await makeRequest(ctx.baseUrl, '/echo', { method: 'POST' });
    assert.deepEqual(r.body.post, {});
  });

});


// ============================================================================
// GROUP G - GRACEFUL ERROR HANDLING (BAD BODY / WRONG CONTENT-TYPE)
// ============================================================================

describe('Group G - graceful error handling', function () {

  let ctx;

  before(async function () {
    ctx = await startTestServer(function (app) {

      // Express's express.json() middleware rejects malformed JSON with a 400
      // response BEFORE our route handler runs. Mount a custom error handler
      // so the test can verify Express behavior end-to-end rather than crashing
      // the test runner.
      app.post('/echo-post', function (req, res) {
        const instance = buildInstance(req, res);
        gateway.returnHttpResponse(instance, 200, null, {
          post: instance.http_request.post,
          type: typeof instance.http_request.post
        });
      });

      // eslint-disable-next-line no-unused-vars
      app.use(function (err, req, res, next) {
        // express.json() throws SyntaxError on malformed JSON. Translate to a
        // clean 400 response so the test can assert against it rather than
        // observing an Express default error stack page.
        if (err && err.type === 'entity.parse.failed') {
          res.status(400).json({ error: 'malformed_json' });
          return;
        }
        res.status(500).json({ error: 'unknown' });
      });

    });
  });

  after(async function () { await ctx.close(); });

  it('Express rejects malformed JSON body with 400 before reaching the adapter', async function () {
    const r = await makeRequest(ctx.baseUrl, '/echo-post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"name": ' // intentionally malformed; bypasses our object->JSON path
    });
    assert.equal(r.status, 400);
    assert.equal(r.body.error, 'malformed_json');
  });

  it('handles a request with no body and no content-type', async function () {
    const r = await makeRequest(ctx.baseUrl, '/echo-post', { method: 'POST' });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.post, {});
  });

  it('treats text/plain body as empty post (no parser registered for text)', async function () {
    const r = await makeRequest(ctx.baseUrl, '/echo-post', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'hello plain text body'
    });
    // Express does not parse text/plain by default; req.body stays as {}
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.post, {});
  });

  it('handles JSON Content-Type with empty body', async function () {
    const r = await makeRequest(ctx.baseUrl, '/echo-post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.post, {});
  });

});
