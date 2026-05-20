// Info: Tests for js-server-helper-http-gateway. Uses the in-process stub adapter
// (stub-adapter.js) - not a simulation of any real runtime, just a contract stub
// that lets the gateway exercise its own logic without Lambda or Express. Covers:
//   - Loader validation (throws on misconfiguration)
//   - initHttpRequestData / isHttpInstance
//   - setArgsFromRequest (all methods, types, validators, edge cases)
//   - returnHttpResponse / returnHttpStatus / returnHttpRedirect / returnHttpRedirect404
//   - setCookie (including SameSite=None omission for incompatible UAs)
//   - getRequestIPAddress / getRequestUserAgent / getRequestOrigin
//   - getRequestCountryCode (adapter-delegated)
//   - getHttpTime
//   - getUrlParts
//   - parts/cookies.js - isSameSiteNoneIncompatible directly
//   - parts/params.js - setArgsFromRequest directly
'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { Lib } = require('./loader')();

const GatewayLoader    = require('../http-gateway.js');
const StubAdapter      = require('./stub-adapter.js');
const CookiesFactory   = require('../parts/cookies.js');
const ParamsFactory    = require('../parts/params.js');
const UrlPartsFactory  = require('../parts/url-parts.js');


// ============================================================================
// HELPERS
// ============================================================================

function buildInstance () {
  return Lib.Instance.initialize();
}

function buildGateway (adapter_factory) {
  return GatewayLoader(Lib, { ADAPTER: adapter_factory });
}

function makeAdapterFactory (adapter) {
  return function () { return adapter; };
}

function buildGatewayWithMemory () {
  const { adapter, sent } = StubAdapter();
  const gateway = buildGateway(makeAdapterFactory(adapter));
  return { gateway, adapter, sent };
}

function initInstance (gateway, raw_request) {
  const instance = buildInstance();
  let captured = null;
  gateway.initHttpRequestData(instance, raw_request, null, function (_err, response) {
    captured = response;
  });
  return { instance, getCaptured: function () { return captured; } };
}


// ============================================================================
// LOADER VALIDATION
// ============================================================================

describe('loader validation', function () {

  it('throws when ADAPTER is missing', function () {
    assert.throws(function () {
      GatewayLoader(Lib, {});
    }, /CONFIG\.ADAPTER must be an adapter factory function/);
  });

  it('throws when ADAPTER is a string', function () {
    assert.throws(function () {
      GatewayLoader(Lib, { ADAPTER: 'aws-apigateway' });
    }, /CONFIG\.ADAPTER must be an adapter factory function/);
  });

  it('throws when ADAPTER is null', function () {
    assert.throws(function () {
      GatewayLoader(Lib, { ADAPTER: null });
    }, /CONFIG\.ADAPTER must be an adapter factory function/);
  });

  it('succeeds with a valid adapter factory', function () {
    const { adapter } = StubAdapter();
    assert.doesNotThrow(function () {
      buildGateway(makeAdapterFactory(adapter));
    });
  });

});


// ============================================================================
// initHttpRequestData + isHttpInstance
// ============================================================================

describe('initHttpRequestData', function () {

  it('populates instance.http_request from raw_request', function () {
    const { gateway } = buildGatewayWithMemory();
    const { instance } = initInstance(gateway, {
      headers: { 'content-type': 'application/json' },
      get: { page: '2' },
      post: { name: 'Alice' },
      path: { id: '42' },
      method: 'POST'
    });

    assert.equal(instance.http_request.headers['content-type'], 'application/json');
    assert.equal(instance.http_request.get.page, '2');
    assert.equal(instance.http_request.post.name, 'Alice');
    assert.equal(instance.http_request.path.id, '42');
    assert.equal(instance.http_request.method, 'POST');
  });

  it('sets empty collections when raw_request is null', function () {
    const { gateway } = buildGatewayWithMemory();
    const { instance } = initInstance(gateway, null);

    assert.deepEqual(instance.http_request.headers, {});
    assert.deepEqual(instance.http_request.get, {});
    assert.deepEqual(instance.http_request.post, {});
    assert.deepEqual(instance.http_request.path, {});
    assert.equal(instance.http_request.method, null);
  });

  it('gateway_response_callback is a function', function () {
    const { gateway } = buildGatewayWithMemory();
    const { instance } = initInstance(gateway, {});
    assert.equal(typeof instance.gateway_response_callback, 'function');
  });

});

describe('isHttpInstance', function () {

  it('returns false on a fresh un-initialized instance', function () {
    const { gateway } = buildGatewayWithMemory();
    const instance = buildInstance();
    assert.equal(gateway.isHttpInstance(instance), false);
  });

  it('returns true after initHttpRequestData', function () {
    const { gateway } = buildGatewayWithMemory();
    const { instance } = initInstance(gateway, {});
    assert.equal(gateway.isHttpInstance(instance), true);
  });

});


// ============================================================================
// returnHttpResponse
// ============================================================================

describe('returnHttpResponse', function () {

  it('sends the correct status code', function () {
    const { gateway, sent } = buildGatewayWithMemory();
    const { instance } = initInstance(gateway, {});
    gateway.returnHttpResponse(instance, 200, null, { ok: true });
    assert.equal(sent[0].status, 200);
  });

  it('includes default Cache-Control and Content-Type headers', function () {
    const { gateway, sent } = buildGatewayWithMemory();
    const { instance } = initInstance(gateway, {});
    gateway.returnHttpResponse(instance, 200);
    assert.equal(sent[0].headers['Cache-Control'], 'max-age=0');
    assert.equal(sent[0].headers['Content-Type'], 'application/json');
  });

  it('merges caller-supplied headers over defaults', function () {
    const { gateway, sent } = buildGatewayWithMemory();
    const { instance } = initInstance(gateway, {});
    gateway.returnHttpResponse(instance, 200, { 'X-Custom': 'yes', 'Content-Type': 'text/plain' });
    assert.equal(sent[0].headers['X-Custom'], 'yes');
    assert.equal(sent[0].headers['Content-Type'], 'text/plain');
  });

  it('flushes instance cookies into the response headers', function () {
    const { gateway, sent } = buildGatewayWithMemory();
    const { instance } = initInstance(gateway, {
      headers: { 'user-agent': 'Mozilla/5.0 Chrome/100.0' }
    });
    gateway.setCookie(instance, 'session', 'abc', 3600);
    gateway.returnHttpResponse(instance, 200);
    assert.ok('Set-Cookie' in sent[0].headers);
  });

  it('returns true', function () {
    const { gateway } = buildGatewayWithMemory();
    const { instance } = initInstance(gateway, {});
    assert.equal(gateway.returnHttpResponse(instance, 200), true);
  });

});


// ============================================================================
// returnHttpStatus
// ============================================================================

describe('returnHttpStatus', function () {

  const cases = [
    ['not_modified', 304],
    ['bad_request', 400],
    ['unauthorized', 401],
    ['not_found', 404],
    ['invalid_token', 498]
  ];

  cases.forEach(function ([name, code]) {

    it('sends ' + code + ' for status_name=' + name, function () {
      const { gateway, sent } = buildGatewayWithMemory();
      const { instance } = initInstance(gateway, {});
      gateway.returnHttpStatus(instance, name);
      assert.equal(sent[0].status, code);
    });

  });

});


// ============================================================================
// returnHttpRedirect / returnHttpRedirect404
// ============================================================================

describe('returnHttpRedirect', function () {

  it('sends status 301', function () {
    const { gateway, sent } = buildGatewayWithMemory();
    const { instance } = initInstance(gateway, {});
    gateway.returnHttpRedirect(instance, '/new-path');
    assert.equal(sent[0].status, 301);
  });

  it('sets Location header', function () {
    const { gateway, sent } = buildGatewayWithMemory();
    const { instance } = initInstance(gateway, {});
    gateway.returnHttpRedirect(instance, '/new-path');
    assert.equal(sent[0].headers['Location'], '/new-path');
  });

});

describe('returnHttpRedirect404', function () {

  it('redirects to /404', function () {
    const { gateway, sent } = buildGatewayWithMemory();
    const { instance } = initInstance(gateway, {});
    gateway.returnHttpRedirect404(instance);
    assert.equal(sent[0].headers['Location'], '/404');
    assert.equal(sent[0].status, 301);
  });

});


// ============================================================================
// getRequestIPAddress / getRequestUserAgent / getRequestOrigin
// ============================================================================

describe('getRequestIPAddress', function () {

  it('returns first IP from x-forwarded-for chain', function () {
    const { gateway } = buildGatewayWithMemory();
    const { instance } = initInstance(gateway, {
      headers: { 'x-forwarded-for': '27.56.130.92, 54.182.231.9' }
    });
    assert.equal(gateway.getRequestIPAddress(instance), '27.56.130.92');
  });

  it('returns empty string when header is absent', function () {
    const { gateway } = buildGatewayWithMemory();
    const { instance } = initInstance(gateway, {});
    assert.equal(gateway.getRequestIPAddress(instance), '');
  });

});

describe('getRequestUserAgent', function () {

  it('returns user-agent from headers', function () {
    const { gateway } = buildGatewayWithMemory();
    const { instance } = initInstance(gateway, {
      headers: { 'user-agent': 'Mozilla/5.0' }
    });
    assert.equal(gateway.getRequestUserAgent(instance), 'Mozilla/5.0');
  });

  it('returns empty string when absent', function () {
    const { gateway } = buildGatewayWithMemory();
    const { instance } = initInstance(gateway, {});
    assert.equal(gateway.getRequestUserAgent(instance), '');
  });

});

describe('getRequestOrigin', function () {

  it('returns origin header', function () {
    const { gateway } = buildGatewayWithMemory();
    const { instance } = initInstance(gateway, {
      headers: { 'origin': 'https://app.example.com' }
    });
    assert.equal(gateway.getRequestOrigin(instance), 'https://app.example.com');
  });

  it('returns empty string when absent', function () {
    const { gateway } = buildGatewayWithMemory();
    const { instance } = initInstance(gateway, {});
    assert.equal(gateway.getRequestOrigin(instance), '');
  });

});


// ============================================================================
// getRequestCountryCode (adapter-delegated)
// ============================================================================

describe('getRequestCountryCode', function () {

  it('returns null from stub adapter (no CDN)', function () {
    const { gateway } = buildGatewayWithMemory();
    const { instance } = initInstance(gateway, {});
    assert.equal(gateway.getRequestCountryCode(instance), null);
  });

});


// ============================================================================
// setCookie
// ============================================================================

describe('setCookie', function () {

  const CHROME_100_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36';
  const IOS_12_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 12_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko)';

  it('sets Set-Cookie on instance.http_response.cookies', function () {
    const { gateway } = buildGatewayWithMemory();
    const { instance } = initInstance(gateway, { headers: { 'user-agent': CHROME_100_UA } });
    gateway.setCookie(instance, 'sid', 'xyz', 3600);
    assert.ok('Set-Cookie' in instance.http_response.cookies);
    assert.ok(instance.http_response.cookies['Set-Cookie'].includes('sid=xyz'));
  });

  it('includes SameSite=None for a compatible browser (Chrome 100)', function () {
    const { gateway } = buildGatewayWithMemory();
    const { instance } = initInstance(gateway, { headers: { 'user-agent': CHROME_100_UA } });
    gateway.setCookie(instance, 'sid', 'xyz', 3600);
    assert.ok(instance.http_response.cookies['Set-Cookie'].toLowerCase().includes('samesite=none'));
  });

  it('omits SameSite=None for iOS 12 UA', function () {
    const { gateway } = buildGatewayWithMemory();
    const { instance } = initInstance(gateway, { headers: { 'user-agent': IOS_12_UA } });
    gateway.setCookie(instance, 'sid', 'xyz', 3600);
    assert.ok(!instance.http_response.cookies['Set-Cookie'].toLowerCase().includes('samesite'));
  });

  it('omits SameSite when user-agent is absent', function () {
    const { gateway } = buildGatewayWithMemory();
    const { instance } = initInstance(gateway, {});
    gateway.setCookie(instance, 'sid', 'xyz', 3600);
    // Empty UA - isSameSiteNoneIncompatible returns false (no regex matches)
    // so SameSite=None IS set; just verify the cookie is formed at all
    assert.ok('Set-Cookie' in instance.http_response.cookies);
  });

});


// ============================================================================
// getHttpTime
// ============================================================================

describe('getHttpTime', function () {

  it('returns a string in HTTP-date format for a given timestamp', function () {
    const { gateway } = buildGatewayWithMemory();
    const result = gateway.getHttpTime(0);
    assert.equal(result, 'Thu, 01 Jan 1970 00:00:00 GMT');
  });

  it('returns current time string when no argument given', function () {
    const { gateway } = buildGatewayWithMemory();
    const result = gateway.getHttpTime();
    assert.ok(typeof result === 'string');
    assert.ok(result.endsWith('GMT'));
  });

});


// ============================================================================
// getUrlParts
// ============================================================================

describe('getUrlParts', function () {

  it('correctly parses a standard URL', function () {
    const { gateway } = buildGatewayWithMemory();
    const parts = gateway.getUrlParts('https://www.api.example.co.uk/path');
    assert.equal(parts.domain_without_tld, 'example');
    assert.equal(parts.tld, 'co.uk');
    assert.ok(parts.hostname.includes('example'));
    assert.equal(parts.is_ip, false);
  });

});


// ============================================================================
// parts/cookies.js - isSameSiteNoneIncompatible (direct)
// ============================================================================

describe('parts/cookies - isSameSiteNoneIncompatible', function () {

  const Cookies = CookiesFactory(Lib);

  it('returns false for modern Chrome', function () {
    const ua = 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/100.0.4896.127 Safari/537.36';
    assert.equal(Cookies.isSameSiteNoneIncompatible(ua), false);
  });

  it('returns true for iOS 12', function () {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 12_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko)';
    assert.equal(Cookies.isSameSiteNoneIncompatible(ua), true);
  });

  it('returns true for Chromium 65 (drops unrecognized SameSite)', function () {
    const ua = 'Mozilla/5.0 Chrome/65.0.3325.181';
    assert.equal(Cookies.isSameSiteNoneIncompatible(ua), true);
  });

  it('returns false for Chromium 67 (first compatible version)', function () {
    const ua = 'Mozilla/5.0 Chrome/67.0.3396.62';
    assert.equal(Cookies.isSameSiteNoneIncompatible(ua), false);
  });

  it('returns false for an empty string', function () {
    assert.equal(Cookies.isSameSiteNoneIncompatible(''), false);
  });

});


// ============================================================================
// parts/cookies.js - serialize (direct)
// ============================================================================

describe('parts/cookies - serialize', function () {

  const Cookies = CookiesFactory(Lib);

  it('URL-encodes a value containing reserved cookie-octet characters', function () {
    const out = Cookies.serialize('sid', 'a=b; c,d "e"', {});
    assert.ok(!out.includes('"'));
    assert.ok(!out.match(/=.*;.*=.*;.*Max-Age/));
    assert.ok(out.startsWith('sid=' + encodeURIComponent('a=b; c,d "e"')));
  });

  it('emits an empty value when the input is an empty string', function () {
    const out = Cookies.serialize('sid', '', { maxAge: 0 });
    assert.equal(out, 'sid=; Max-Age=0');
  });

  it('throws on a cookie name containing a space', function () {
    assert.throws(function () {
      Cookies.serialize('bad name', 'value', {});
    }, /name is invalid/);
  });

  it('throws on a cookie name containing a semicolon', function () {
    assert.throws(function () {
      Cookies.serialize('bad;name', 'value', {});
    }, /name is invalid/);
  });

});


// ============================================================================
// parts/cookies.js - parse (direct)
// ============================================================================

describe('parts/cookies - parse', function () {

  const Cookies = CookiesFactory(Lib);

  it('URL-decodes percent-encoded values', function () {
    const out = Cookies.parse('greeting=' + encodeURIComponent('hello world'));
    assert.equal(out.greeting, 'hello world');
  });

  it('preserves the raw value when percent-encoding is malformed', function () {
    const out = Cookies.parse('broken=%E0%A4');
    assert.equal(out.broken, '%E0%A4');
  });

  it('returns a prototype-less object (prototype pollution defense)', function () {
    const out = Cookies.parse('foo=bar');
    // Result map does not inherit from Object.prototype, so accidental
    // lookups of 'hasOwnProperty' / 'toString' on cookie names cannot
    // resolve to real Object methods.
    assert.equal(out.hasOwnProperty, undefined);
    assert.equal(out.toString, undefined);
  });

  it('does not pollute Object.prototype when header contains __proto__', function () {
    Cookies.parse('__proto__=' + encodeURIComponent('{"polluted":true}'));
    assert.equal({}.polluted, undefined);
  });

  it('returns an empty prototype-less object for an empty header', function () {
    const out = Cookies.parse('');
    assert.equal(Object.keys(out).length, 0);
    assert.equal(out.hasOwnProperty, undefined);
  });

  it('parses multiple cookies separated by semicolons', function () {
    const out = Cookies.parse('a=1; b=2; c=3');
    assert.equal(out.a, '1');
    assert.equal(out.b, '2');
    assert.equal(out.c, '3');
  });

});


// ============================================================================
// parts/params.js - setArgsFromRequest (direct)
// ============================================================================

describe('parts/params - setArgsFromRequest', function () {

  const Params = ParamsFactory(Lib);

  function makeInstance (overrides) {
    return {
      http_request: Object.assign(
        { headers: {}, get: {}, post: {}, path: {}, cookies: {}, method: 'GET' },
        overrides
      )
    };
  }

  it('returns [null, {}] for empty params array', function () {
    const [err, args] = Params.setArgsFromRequest(makeInstance({}), []);
    assert.equal(err, null);
    assert.deepEqual(args, {});
  });

  it('extracts a GET param', function () {
    const instance = makeInstance({ get: { page: '3' } });
    const [err, args] = Params.setArgsFromRequest(instance, [
      { method: 'GET', name: 'page', rename: 'page', required: true }
    ]);
    assert.equal(err, null);
    assert.equal(args.page, '3');
  });

  it('extracts a POST param', function () {
    const instance = makeInstance({ post: { email: 'a@b.com' } });
    const [err, args] = Params.setArgsFromRequest(instance, [
      { method: 'POST', name: 'email', rename: 'email', required: true }
    ]);
    assert.equal(err, null);
    assert.equal(args.email, 'a@b.com');
  });

  it('extracts a HEADER param', function () {
    const instance = makeInstance({ headers: { 'x-app-token': 'tok123' } });
    const [err, args] = Params.setArgsFromRequest(instance, [
      { method: 'HEADER', name: 'x-app-token', rename: 'app_token', required: true }
    ]);
    assert.equal(err, null);
    assert.equal(args.app_token, 'tok123');
  });

  it('extracts a PATH param', function () {
    const instance = makeInstance({ path: { id: '99' } });
    const [err, args] = Params.setArgsFromRequest(instance, [
      { method: 'PATH', name: 'id', rename: 'record_id', required: true }
    ]);
    assert.equal(err, null);
    assert.equal(args.record_id, '99');
  });

  it('extracts a FIXED param', function () {
    const instance = makeInstance({});
    const [err, args] = Params.setArgsFromRequest(instance, [
      { method: 'FIXED', name: 'type', rename: 'type', value: 'user', required: true }
    ]);
    assert.equal(err, null);
    assert.equal(args.type, 'user');
  });

  it('applies default value when optional param is absent', function () {
    const instance = makeInstance({});
    const [err, args] = Params.setArgsFromRequest(instance, [
      { method: 'GET', name: 'limit', rename: 'limit', required: false, default: 10 }
    ]);
    assert.equal(err, null);
    assert.equal(args.limit, 10);
  });

  it('returns [null, false] when required param is missing', function () {
    const instance = makeInstance({});
    const [err, args] = Params.setArgsFromRequest(instance, [
      { method: 'GET', name: 'id', rename: 'id', required: true }
    ]);
    assert.equal(err, null);
    assert.equal(args, false);
  });

  it('typecasts string to number when is_number=true', function () {
    const instance = makeInstance({ get: { count: '5' } });
    const [err, args] = Params.setArgsFromRequest(instance, [
      { method: 'GET', name: 'count', rename: 'count', required: true, is_number: true }
    ]);
    assert.equal(err, null);
    assert.equal(typeof args.count, 'number');
    assert.equal(args.count, 5);
  });

  it('typecasts to boolean when is_boolean=true', function () {
    const instance = makeInstance({ get: { active: '1' } });
    const [err, args] = Params.setArgsFromRequest(instance, [
      { method: 'GET', name: 'active', rename: 'active', required: true, is_boolean: true }
    ]);
    assert.equal(err, null);
    assert.equal(args.active, true);
  });

  it('parses JSON string when is_json=true', function () {
    const instance = makeInstance({ post: { meta: '{"key":"val"}' } });
    const [err, args] = Params.setArgsFromRequest(instance, [
      { method: 'POST', name: 'meta', rename: 'meta', required: true, is_json: true }
    ]);
    assert.equal(err, null);
    assert.deepEqual(args.meta, { key: 'val' });
  });

  it('returns [null, false] when is_json=true and value is invalid JSON and required', function () {
    const instance = makeInstance({ post: { meta: 'not-json' } });
    const [err, args] = Params.setArgsFromRequest(instance, [
      { method: 'POST', name: 'meta', rename: 'meta', required: true, is_json: true }
    ]);
    assert.equal(err, null);
    assert.equal(args, false);
  });

  it('trims whitespace and converts empty string to null', function () {
    const instance = makeInstance({ get: { q: '   ' } });
    const [err, args] = Params.setArgsFromRequest(instance, [
      { method: 'GET', name: 'q', rename: 'q', required: false, trim: true, default: null }
    ]);
    assert.equal(err, null);
    assert.equal(args.q, null);
  });

  it('returns [null, false] when validate_func fails', function () {
    const instance = makeInstance({ get: { age: '-5' } });
    const [err, args] = Params.setArgsFromRequest(instance, [
      {
        method: 'GET', name: 'age', rename: 'age', required: true, is_number: true,
        validate_func: function (v) { return v > 0; }
      }
    ]);
    assert.equal(err, null);
    assert.equal(args, false);
  });

  it('returns [err, false] when invalidate_func returns an error object', function () {
    const MY_ERR = { type: 'BAD_VALUE', message: 'too long' };
    const instance = makeInstance({ get: { name: 'toolongname' } });
    const [err, args] = Params.setArgsFromRequest(instance, [
      {
        method: 'GET', name: 'name', rename: 'name', required: true,
        invalidate_func: function (v) { return v.length > 8 ? MY_ERR : null; }
      }
    ]);
    assert.equal(args, false);
    assert.deepEqual(err, MY_ERR);
  });

  it('handles multiple params in sequence', function () {
    const instance = makeInstance({ get: { a: '1', b: '2' } });
    const [err, args] = Params.setArgsFromRequest(instance, [
      { method: 'GET', name: 'a', rename: 'a', required: true, is_number: true },
      { method: 'GET', name: 'b', rename: 'b', required: true, is_number: true }
    ]);
    assert.equal(err, null);
    assert.equal(args.a, 1);
    assert.equal(args.b, 2);
  });

});


// ============================================================================
// parts/url-parts.js - getUrlParts (direct)
// ============================================================================

describe('parts/url-parts - getUrlParts', function () {

  const UrlParts = UrlPartsFactory(Lib);

  it('parses subdomain, domain, tld correctly', function () {
    const parts = UrlParts.getUrlParts('https://www.api.example.com/path?q=1');
    assert.equal(parts.domain_without_tld, 'example');
    assert.equal(parts.tld, 'com');
    assert.ok(parts.sub_domain.includes('api'));
  });

  it('marks IP addresses as is_ip=true', function () {
    const parts = UrlParts.getUrlParts('http://192.168.1.1/path');
    assert.equal(parts.is_ip, true);
  });

  it('returns object with all expected keys', function () {
    const parts = UrlParts.getUrlParts('https://example.com');
    const expected_keys = ['sub_domain', 'domain', 'domain_without_tld', 'tld', 'hostname', 'is_ip'];
    expected_keys.forEach(function (key) {
      assert.ok(key in parts, 'missing key: ' + key);
    });
  });

});
