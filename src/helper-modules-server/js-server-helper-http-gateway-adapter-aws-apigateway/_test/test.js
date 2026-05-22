// Info: Tests for js-server-helper-http-gateway-adapter-aws-apigateway. Exercises
// the adapter against REAL API Gateway v2.0 event fixtures, not synthetic mocks.
// Fixtures live in _test/fixtures/. The official `apigw-v2-*.json` files are
// verbatim copies from aws/aws-lambda-go events/testdata - they are the exact
// shapes the AWS Go SDK uses to test its own event handling, which is the
// closest available "real Lambda input" without provisioning AWS infrastructure.
// The hand-written `v2-*.json` fixtures cover scenarios AWS does not publish
// (cookies, bearer auth, multipart, malformed body, unicode, etc.).
//
// Source of official fixtures: aws/aws-lambda-go events/testdata
//   https://github.com/aws/aws-lambda-go/tree/main/events/testdata
//
// Covers (plan 0017, Phase 3):
//   Group A - Official AWS fixture compatibility (all 6 load without crashing)
//   Group B - Method, path, and query extraction
//   Group C - Headers (lowercase, auth, API key, correlation)
//   Group C2 - Cookies (v2 cookies array)
//   Group D - Body parsing (JSON, urlencoded, base64, malformed, multipart, empty, unicode)
//   Group E - Response building (Lambda envelope shape)
//   Group F - Integration with gateway (param extraction, full request->response cycle)
//   Group G - Country code from CloudFront-Viewer-Country
//   Group H - IP/UA/Origin extraction edge cases
//   Group I - Defensive edge cases (no headers, no requestContext, null body)
'use strict';


const fs     = require('node:fs');
const path   = require('node:path');
const assert = require('node:assert/strict');
const { describe, it } = require('node:test');


const { Lib, gateway } = require('./loader')();
const AdapterFactory   = require('@superloomdev/js-server-helper-http-gateway-adapter-aws-apigateway');


// ============================================================================
// FIXTURE LOADERS
// ============================================================================

const FIXTURES_DIR = path.join(__dirname, 'fixtures');


/********************************************************************
Load a fixture by filename (relative to _test/fixtures/) and return
the parsed JSON object. Each call re-reads from disk so mutating the
returned object in one test does not affect another test.

@param {String} filename - e.g. 'v2-post-json.json'

@return {Object} - Parsed fixture
*********************************************************************/
function loadFixture (filename) {

  const raw = fs.readFileSync(path.join(FIXTURES_DIR, filename), 'utf8');
  return JSON.parse(raw);

}


/********************************************************************
Build a per-request instance and run a v2.0 fixture through the full
adapter pipeline. Returns the populated instance and a captured-response
holder so test bodies can both inspect what the adapter loaded and
verify what was emitted to the Lambda callback.

@param {Object} event - API Gateway v2.0 event fixture

@return {Object} - { instance, captured }
*********************************************************************/
function pipe (event) {

  const instance = Lib.Instance.initialize();
  const captured = { err: null, response: null, called: false };

  gateway.initHttpRequestData(instance, event, null, function (err, response) {
    captured.err = err;
    captured.response = response;
    captured.called = true;
  });

  return { instance: instance, captured: captured };

}


// ============================================================================
// GROUP A - OFFICIAL AWS FIXTURE COMPATIBILITY
// ============================================================================
//
// Each of the 6 fixtures copied from aws/aws-lambda-go testdata represents a
// real-world API Gateway event shape that AWS supports in production. The
// adapter must populate the instance for all of them without throwing.
// Authorizer context (JWT claims, IAM identity, Lambda authorizer payload)
// is NOT promoted into standard fields - tests that consume those should read
// directly from raw_request via the gateway integration if needed.

describe('Group A - official AWS fixture compatibility', function () {

  // HTTP API v2.0 event shapes - method lives at requestContext.http.method.
  // These are the events the adapter is designed for.
  const HTTP_API_V2_FIXTURES = [
    'apigw-v2-request-no-authorizer.json',
    'apigw-v2-request-iam.json',
    'apigw-v2-request-jwt-authorizer.json',
    'apigw-v2-request-lambda-authorizer.json',
    'apigw-v2-custom-authorizer-v2-request.json'
  ];

  HTTP_API_V2_FIXTURES.forEach(function (fixture_name) {

    it('loads ' + fixture_name + ' without crashing', function () {
      const event = loadFixture(fixture_name);
      const { instance } = pipe(event);

      assert.ok(instance.http_request, 'http_request was not populated');
      assert.ok(typeof instance.http_request.method === 'string', 'method missing');
      assert.ok(instance.http_request.headers, 'headers missing');
      assert.ok(instance.http_request.get, 'get missing');
      assert.ok(instance.http_request.post, 'post missing');
      assert.ok(instance.http_request.path, 'path missing');
      assert.ok(instance.http_request.cookies, 'cookies missing');
      assert.ok(instance.http_response, 'http_response missing');
      assert.ok(typeof instance.gateway_response_callback === 'function');
    });

  });

  // REST API v1.0 custom-authorizer payload - DIFFERENT shape (httpMethod at
  // root, no requestContext.http block). The adapter does NOT support this
  // legacy payload format. This test documents the unsupported boundary:
  // the adapter is expected to populate the instance with method=null rather
  // than crash, so a downstream handler can safely return a 400.
  it('apigw-v2-custom-authorizer-v1-request.json (REST API v1.0): does not crash, method is null', function () {
    const event = loadFixture('apigw-v2-custom-authorizer-v1-request.json');
    const { instance } = pipe(event);
    assert.ok(instance.http_request, 'instance must still be populated');
    assert.equal(instance.http_request.method, null, 'method is null for unsupported v1.0 payload');
    assert.ok(instance.http_request.headers, 'headers still extracted');
  });

  it('apigw-v2-request-no-authorizer: extracts standard fields', function () {
    const event = loadFixture('apigw-v2-request-no-authorizer.json');
    const { instance } = pipe(event);
    assert.equal(instance.http_request.method, 'GET');
    assert.equal(instance.http_request.headers['x-forwarded-for'], '1.2.3.4');
    assert.equal(instance.http_request.headers['user-agent'], 'curl/7.58.0');
  });

  it('apigw-v2-request-jwt-authorizer: JWT context survives on raw event', function () {
    const event = loadFixture('apigw-v2-request-jwt-authorizer.json');
    const { instance } = pipe(event);
    assert.ok(instance.http_request, 'adapter must populate even with JWT authorizer');
    // JWT claims are not promoted to standard fields - they remain on the raw
    // event. This documents the current contract.
    assert.ok(event.requestContext.authorizer, 'fixture must carry authorizer block');
  });

  it('apigw-v2-request-iam: IAM authorizer context does not break extraction', function () {
    const event = loadFixture('apigw-v2-request-iam.json');
    const { instance } = pipe(event);
    assert.ok(instance.http_request);
    assert.equal(typeof instance.http_request.method, 'string');
  });

  it('apigw-v2-request-lambda-authorizer: Lambda authorizer context preserved on raw event', function () {
    const event = loadFixture('apigw-v2-request-lambda-authorizer.json');
    const { instance } = pipe(event);
    assert.ok(instance.http_request);
    assert.ok(event.requestContext.authorizer);
  });

});


// ============================================================================
// GROUP B - METHOD, PATH, AND QUERY EXTRACTION
// ============================================================================

describe('Group B - method, path, and query extraction', function () {

  it('reads method from requestContext.http.method (GET)', function () {
    const event = loadFixture('v2-get-simple.json');
    const { instance } = pipe(event);
    assert.equal(instance.http_request.method, 'GET');
  });

  it('reads method from requestContext.http.method (POST)', function () {
    const event = loadFixture('v2-post-json.json');
    const { instance } = pipe(event);
    assert.equal(instance.http_request.method, 'POST');
  });

  it('uppercases lowercase methods (per adapter contract)', function () {
    const event = loadFixture('v2-get-simple.json');
    event.requestContext.http.method = 'put';
    const { instance } = pipe(event);
    assert.equal(instance.http_request.method, 'PUT');
  });

  it('populates path parameters from event.pathParameters', function () {
    const event = loadFixture('v2-path-params.json');
    const { instance } = pipe(event);
    assert.equal(instance.http_request.path.user_id, '42');
    assert.equal(instance.http_request.path.post_id, '99');
  });

  it('populates query string parameters from event.queryStringParameters', function () {
    const event = loadFixture('v2-get-simple.json');
    const { instance } = pipe(event);
    assert.equal(instance.http_request.get.page, '3');
    assert.equal(instance.http_request.get.sort, 'name');
  });

  it('combines multi-value query parameters with commas per v2 spec', function () {
    const event = loadFixture('v2-multi-value-query.json');
    const { instance } = pipe(event);
    // v2.0 spec combines repeated keys with commas - documented in the fixture
    assert.equal(instance.http_request.get.tag, 'red,green,blue');
    assert.equal(instance.http_request.get.active, 'true');
  });

  it('returns empty path object when pathParameters is null', function () {
    const event = loadFixture('v2-get-simple.json');
    event.pathParameters = null;
    const { instance } = pipe(event);
    assert.deepEqual(instance.http_request.path, {});
  });

  it('returns empty get object when queryStringParameters is null', function () {
    const event = loadFixture('v2-get-simple.json');
    event.queryStringParameters = null;
    const { instance } = pipe(event);
    assert.deepEqual(instance.http_request.get, {});
  });

});


// ============================================================================
// GROUP C - HEADERS (LOWERCASE, AUTH, API-KEY)
// ============================================================================

describe('Group C - headers', function () {

  it('lowercases all header keys', function () {
    const event = loadFixture('v2-get-simple.json');
    event.headers = { 'Content-Type': 'application/json', 'X-Custom-Header': 'value' };
    const { instance } = pipe(event);
    assert.equal(instance.http_request.headers['content-type'], 'application/json');
    assert.equal(instance.http_request.headers['x-custom-header'], 'value');
    assert.ok(!('Content-Type' in instance.http_request.headers));
  });

  it('extracts Bearer token from Authorization header', function () {
    const event = loadFixture('v2-with-bearer-token.json');
    const { instance } = pipe(event);
    assert.ok(instance.http_request.headers['authorization'].startsWith('Bearer '));
  });

  it('extracts Basic credential from Authorization header', function () {
    const event = loadFixture('v2-with-basic-auth.json');
    const { instance } = pipe(event);
    assert.equal(instance.http_request.headers['authorization'], 'Basic dXNlcjpwYXNzd29yZA==');
  });

  it('extracts X-API-Key custom header', function () {
    const event = loadFixture('v2-with-api-key.json');
    const { instance } = pipe(event);
    assert.equal(instance.http_request.headers['x-api-key'], 'sk_live_abc123def456');
  });

  it('extracts X-Correlation-Id custom header', function () {
    const event = loadFixture('v2-with-api-key.json');
    const { instance } = pipe(event);
    assert.equal(instance.http_request.headers['x-correlation-id'], '7f4e9a2b-1234-5678-9abc-def012345678');
  });

  it('returns empty headers object when event has no headers', function () {
    const event = loadFixture('v2-get-simple.json');
    delete event.headers;
    const { instance } = pipe(event);
    assert.deepEqual(instance.http_request.headers, {});
  });

});


// ============================================================================
// GROUP C2 - COOKIES (V2 SPECIFIC)
// ============================================================================

describe('Group C2 - cookies (v2 specific)', function () {

  it('parses event.cookies array into name/value map', function () {
    const event = loadFixture('v2-with-cookies.json');
    const { instance } = pipe(event);
    assert.equal(instance.http_request.cookies.session, 'sess-abc-123');
    assert.equal(instance.http_request.cookies.theme, 'dark');
  });

  it('returns empty cookies object when event.cookies is absent', function () {
    const event = loadFixture('v2-get-simple.json');
    const { instance } = pipe(event);
    assert.deepEqual(instance.http_request.cookies, {});
  });

  it('returns empty cookies object when event.cookies is an empty array', function () {
    const event = loadFixture('v2-with-cookies.json');
    event.cookies = [];
    const { instance } = pipe(event);
    assert.deepEqual(instance.http_request.cookies, {});
  });

  it('returns empty cookies object when event.cookies is not an array', function () {
    const event = loadFixture('v2-with-cookies.json');
    event.cookies = 'not-an-array';
    const { instance } = pipe(event);
    assert.deepEqual(instance.http_request.cookies, {});
  });

  it('URL-decodes cookie values', function () {
    const event = loadFixture('v2-with-cookies.json');
    event.cookies = ['greeting=' + encodeURIComponent('hello world')];
    const { instance } = pipe(event);
    assert.equal(instance.http_request.cookies.greeting, 'hello world');
  });

});


// ============================================================================
// GROUP D - BODY PARSING
// ============================================================================

describe('Group D - body parsing', function () {

  it('parses JSON body when content-type is application/json', function () {
    const event = loadFixture('v2-post-json.json');
    const { instance } = pipe(event);
    assert.equal(instance.http_request.post.email, 'alice@example.com');
    assert.equal(instance.http_request.post.age, 30);
  });

  it('parses url-encoded body when content-type is application/x-www-form-urlencoded', function () {
    const event = loadFixture('v2-post-urlencoded.json');
    const { instance } = pipe(event);
    assert.equal(instance.http_request.post.username, 'bob');
    assert.equal(instance.http_request.post.password, 'secret');
    assert.equal(instance.http_request.post.remember, '1');
  });

  it('decodes base64 body before JSON parsing', function () {
    const event = loadFixture('v2-post-base64.json');
    const { instance } = pipe(event);
    assert.equal(instance.http_request.post.token, 'abc123');
    assert.equal(instance.http_request.post.user, 'alice');
  });

  it('returns empty post object when body is missing', function () {
    const event = loadFixture('v2-get-simple.json');
    const { instance } = pipe(event);
    assert.deepEqual(instance.http_request.post, {});
  });

  it('returns empty post object when body is empty string', function () {
    const event = loadFixture('v2-empty-body.json');
    const { instance } = pipe(event);
    assert.deepEqual(instance.http_request.post, {});
  });

  it('returns empty post object on malformed JSON (no throw)', function () {
    const event = loadFixture('v2-malformed-json-body.json');
    const { instance } = pipe(event);
    assert.deepEqual(instance.http_request.post, {});
  });

  it('returns empty post object on multipart/form-data (unsupported)', function () {
    const event = loadFixture('v2-multipart-body.json');
    const { instance } = pipe(event);
    // Multipart is not supported by the adapter; body becomes empty post.
    assert.deepEqual(instance.http_request.post, {});
  });

  it('handles unicode in JSON body', function () {
    const event = loadFixture('v2-unicode-body.json');
    const { instance } = pipe(event);
    assert.equal(instance.http_request.post.greeting, 'hello 世界 🚀');
    assert.equal(instance.http_request.post.name, '日本語');
  });

  it('returns empty post object when content-type is unknown', function () {
    const event = loadFixture('v2-post-json.json');
    event.headers['content-type'] = 'application/xml';
    const { instance } = pipe(event);
    assert.deepEqual(instance.http_request.post, {});
  });

  it('rejects JSON array body (only plain objects accepted)', function () {
    // The adapter's parseBody rejects arrays so handlers can rely on
    // post being a plain key/value map.
    const event = loadFixture('v2-post-json.json');
    event.body = JSON.stringify([1, 2, 3]);
    const { instance } = pipe(event);
    assert.deepEqual(instance.http_request.post, {});
  });

  it('rejects JSON primitive body (only plain objects accepted)', function () {
    const event = loadFixture('v2-post-json.json');
    event.body = '"plain-string-payload"';
    const { instance } = pipe(event);
    assert.deepEqual(instance.http_request.post, {});
  });

});


// ============================================================================
// GROUP E - RESPONSE BUILDING (LAMBDA ENVELOPE)
// ============================================================================

describe('Group E - response building (Lambda envelope)', function () {

  const adapter = AdapterFactory(null, null, null);

  it('wraps string body in Lambda envelope with isBase64Encoded=false', function () {
    const result = adapter.buildHttpResponseObject(200, { 'Content-Type': 'text/plain' }, 'hello');
    assert.equal(result.statusCode, 200);
    assert.equal(result.body, 'hello');
    assert.equal(result.isBase64Encoded, false);
    assert.equal(result.headers['Content-Type'], 'text/plain');
  });

  it('JSON-stringifies object body', function () {
    const result = adapter.buildHttpResponseObject(200, {}, { ok: true, n: 7 });
    assert.equal(result.body, '{"ok":true,"n":7}');
    assert.equal(result.isBase64Encoded, false);
  });

  it('base64-encodes Buffer body and sets isBase64Encoded=true', function () {
    const buf = Buffer.from('binary-payload');
    const result = adapter.buildHttpResponseObject(200, {}, buf);
    assert.equal(result.body, buf.toString('base64'));
    assert.equal(result.isBase64Encoded, true);
  });

  it('returns empty string body when body is null', function () {
    const result = adapter.buildHttpResponseObject(204, {}, null);
    assert.equal(result.body, '');
    assert.equal(result.isBase64Encoded, false);
  });

  it('returns empty string body when body is undefined', function () {
    const result = adapter.buildHttpResponseObject(204, {});
    assert.equal(result.body, '');
  });

  it('defaults headers to empty object when not provided', function () {
    const result = adapter.buildHttpResponseObject(200, null, 'ok');
    assert.deepEqual(result.headers, {});
  });

  it('gateway_response_callback delivers envelope to the Lambda callback', function () {
    const event = loadFixture('v2-get-simple.json');
    const { instance, captured } = pipe(event);

    gateway.returnHttpResponse(instance, 200, { 'X-Trace': 'abc' }, { ok: true });

    assert.equal(captured.called, true);
    assert.equal(captured.response.statusCode, 200);
    assert.equal(captured.response.isBase64Encoded, false);
    assert.equal(captured.response.body, '{"ok":true}');
    assert.equal(captured.response.headers['X-Trace'], 'abc');
  });

});


// ============================================================================
// GROUP F - INTEGRATION WITH GATEWAY (FULL REQUEST -> RESPONSE)
// ============================================================================

describe('Group F - integration with gateway', function () {

  it('extracts mixed PATH + HEADER + GET in one call', function () {
    const event = loadFixture('v2-path-params.json');
    event.queryStringParameters = { page: '5' };
    event.headers['authorization'] = 'Bearer xyz';

    const { instance, captured } = pipe(event);

    const [err, args] = gateway.setArgsFromRequest(instance, [
      { method: 'PATH',   name: 'user_id',       rename: 'user_id', required: true, is_number: true },
      { method: 'PATH',   name: 'post_id',       rename: 'post_id', required: true, is_number: true },
      { method: 'GET',    name: 'page',          rename: 'page',    required: true, is_number: true },
      { method: 'HEADER', name: 'authorization', rename: 'auth',    required: true }
    ]);

    assert.equal(err, null);
    assert.equal(args.user_id, 42);
    assert.equal(args.post_id, 99);
    assert.equal(args.page, 5);
    assert.equal(args.auth, 'Bearer xyz');

    gateway.returnHttpResponse(instance, 200, null, args);
    assert.equal(captured.response.statusCode, 200);
    assert.deepEqual(JSON.parse(captured.response.body), {
      user_id: 42, post_id: 99, page: 5, auth: 'Bearer xyz'
    });
  });

  it('extracts Bearer token and returns 200 response envelope', function () {
    const event = loadFixture('v2-with-bearer-token.json');
    const { instance, captured } = pipe(event);

    const [err, args] = gateway.setArgsFromRequest(instance, [
      { method: 'HEADER', name: 'authorization', rename: 'auth', required: true }
    ]);

    assert.equal(err, null);
    assert.ok(args.auth.startsWith('Bearer '));

    gateway.returnHttpResponse(instance, 200, null, { ok: true });
    assert.equal(captured.response.statusCode, 200);
  });

  it('emits 401 envelope when required Authorization is missing', function () {
    const event = loadFixture('v2-get-simple.json');
    const { instance, captured } = pipe(event);

    const [err, args] = gateway.setArgsFromRequest(instance, [
      { method: 'HEADER', name: 'authorization', rename: 'auth', required: true }
    ]);

    assert.equal(err, null);
    assert.equal(args, false);

    gateway.returnHttpStatus(instance, 'unauthorized');
    assert.equal(captured.response.statusCode, 401);
  });

  it('returnHttpRedirect emits 301 envelope with Location header', function () {
    const event = loadFixture('v2-get-simple.json');
    const { instance, captured } = pipe(event);

    gateway.returnHttpRedirect(instance, '/new-location');

    assert.equal(captured.response.statusCode, 301);
    assert.equal(captured.response.headers['Location'], '/new-location');
  });

  it('setCookie writes Set-Cookie into the response envelope headers', function () {
    const event = loadFixture('v2-get-simple.json');
    const { instance, captured } = pipe(event);

    gateway.setCookie(instance, 'sid', 'session-xyz', 3600);
    gateway.returnHttpResponse(instance, 200, null, { ok: true });

    assert.ok('Set-Cookie' in captured.response.headers);
    assert.ok(captured.response.headers['Set-Cookie'].includes('sid=session-xyz'));
  });

});


// ============================================================================
// GROUP G - COUNTRY CODE (CLOUDFRONT-VIEWER-COUNTRY)
// ============================================================================

describe('Group G - country code', function () {

  it('returns the country code from CloudFront-Viewer-Country header', function () {
    const event = loadFixture('v2-with-cloudfront-country.json');
    const { instance } = pipe(event);
    assert.equal(gateway.getRequestCountryCode(instance), 'US');
  });

  it('returns null when CloudFront-Viewer-Country header is absent', function () {
    const event = loadFixture('v2-get-simple.json');
    const { instance } = pipe(event);
    assert.equal(gateway.getRequestCountryCode(instance), null);
  });

  it('reads the header case-insensitively (adapter lowercases keys)', function () {
    const event = loadFixture('v2-get-simple.json');
    event.headers = { 'CloudFront-Viewer-Country': 'DE' };
    const { instance } = pipe(event);
    assert.equal(gateway.getRequestCountryCode(instance), 'DE');
  });

});


// ============================================================================
// GROUP H - IP / USER-AGENT / ORIGIN EXTRACTION
// ============================================================================

describe('Group H - IP / user-agent / origin extraction', function () {

  it('reads first IP from X-Forwarded-For via getRequestIPAddress', function () {
    const event = loadFixture('v2-x-forwarded-for.json');
    const { instance } = pipe(event);
    assert.equal(gateway.getRequestIPAddress(instance), '203.0.113.42');
  });

  it('returns empty string when X-Forwarded-For header is absent', function () {
    const event = loadFixture('v2-get-simple.json');
    const { instance } = pipe(event);
    assert.equal(gateway.getRequestIPAddress(instance), '');
  });

  it('reads user-agent header via getRequestUserAgent', function () {
    const event = loadFixture('v2-get-simple.json');
    event.headers['user-agent'] = 'CustomClient/2.0';
    const { instance } = pipe(event);
    assert.equal(gateway.getRequestUserAgent(instance), 'CustomClient/2.0');
  });

  it('reads origin header via getRequestOrigin', function () {
    const event = loadFixture('v2-get-simple.json');
    event.headers['origin'] = 'https://app.example.com';
    const { instance } = pipe(event);
    assert.equal(gateway.getRequestOrigin(instance), 'https://app.example.com');
  });

});


// ============================================================================
// GROUP I - DEFENSIVE EDGE CASES
// ============================================================================

describe('Group I - defensive edge cases', function () {

  it('handles a minimal event (no headers, no body, no params)', function () {
    const event = loadFixture('v2-minimal.json');
    const { instance } = pipe(event);
    assert.equal(instance.http_request.method, 'GET');
    assert.deepEqual(instance.http_request.headers, {});
    assert.deepEqual(instance.http_request.get, {});
    assert.deepEqual(instance.http_request.post, {});
    assert.deepEqual(instance.http_request.path, {});
    assert.deepEqual(instance.http_request.cookies, {});
  });

  it('handles a null raw_request without throwing', function () {
    const instance = Lib.Instance.initialize();
    assert.doesNotThrow(function () {
      gateway.initHttpRequestData(instance, null, null, function () {});
    });
    assert.equal(instance.http_request.method, null);
  });

  it('handles missing requestContext (method becomes null)', function () {
    const event = loadFixture('v2-get-simple.json');
    delete event.requestContext;
    const { instance } = pipe(event);
    assert.equal(instance.http_request.method, null);
  });

  it('handles requestContext without http block', function () {
    const event = loadFixture('v2-get-simple.json');
    event.requestContext = { accountId: '123' };
    const { instance } = pipe(event);
    assert.equal(instance.http_request.method, null);
  });

  it('handles body=null without throwing', function () {
    const event = loadFixture('v2-post-json.json');
    event.body = null;
    const { instance } = pipe(event);
    assert.deepEqual(instance.http_request.post, {});
  });

  it('handles a base64 body that decodes to invalid JSON', function () {
    const event = loadFixture('v2-post-base64.json');
    event.body = Buffer.from('not-json-at-all').toString('base64');
    const { instance } = pipe(event);
    assert.deepEqual(instance.http_request.post, {});
  });

  it('isHttpInstance returns true after initialization', function () {
    const event = loadFixture('v2-get-simple.json');
    const { instance } = pipe(event);
    assert.equal(gateway.isHttpInstance(instance), true);
  });

});
