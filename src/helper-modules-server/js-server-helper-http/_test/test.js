// Info: Test Cases for js-server-helper-http
// Uses httpbin.org for real HTTP verification — requires network access.
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Load dependencies via loader (DI pattern)
const loader = require('./loader');
const { Lib } = loader();
const Http = Lib.Http;



describe('Http module structure', function () {

  it('should export all expected functions', function () {

    assert.strictEqual(typeof Http.fetchJSON, 'function');
    assert.strictEqual(typeof Http.get, 'function');
    assert.strictEqual(typeof Http.post, 'function');
    assert.strictEqual(typeof Http.postForm, 'function');
    assert.strictEqual(typeof Http.put, 'function');
    assert.strictEqual(typeof Http.delete, 'function');
    assert.strictEqual(typeof Http.patch, 'function');

  });

});



describe('GET requests', function () {

  it('should return success=true for successful GET', async function () {

    const result = await Http.get('https://httpbin.org/get');

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.status, 200);

  });


  it('should send query parameters', async function () {

    const result = await Http.get('https://httpbin.org/get', { foo: 'bar', num: 123 });

    assert.strictEqual(result.success, true);
    assert.ok(result.data);
    assert.strictEqual(result.data.args.foo, 'bar');
    assert.strictEqual(result.data.args.num, '123');

  });


  it('should handle 404 error gracefully', async function () {

    const result = await Http.get('https://httpbin.org/status/404');

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.status, 404);

  });

});



describe('POST requests', function () {

  it('should POST JSON data', async function () {

    const payload = { name: 'test', value: 42 };
    const result = await Http.post('https://httpbin.org/post', payload);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.status, 200);
    assert.ok(result.data);
    assert.strictEqual(result.data.json.name, 'test');
    assert.strictEqual(result.data.json.value, 42);

  });


  it('should POST form data', async function () {

    const payload = { name: 'test', value: 'hello' };
    const result = await Http.postForm('https://httpbin.org/post', payload);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.status, 200);
    assert.ok(result.data);
    assert.strictEqual(result.data.form.name, 'test');

  });

});



describe('PUT requests', function () {

  it('should PUT JSON data', async function () {

    const payload = { updated: true };
    const result = await Http.put('https://httpbin.org/put', payload);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.status, 200);
    assert.ok(result.data);
    assert.strictEqual(result.data.json.updated, true);

  });

});



describe('DELETE requests', function () {

  it('should send DELETE request', async function () {

    const result = await Http.delete('https://httpbin.org/delete');

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.status, 200);

  });

});



describe('PATCH requests', function () {

  it('should PATCH JSON data', async function () {

    const payload = { patched: true };
    const result = await Http.patch('https://httpbin.org/patch', payload);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.status, 200);
    assert.ok(result.data);
    assert.strictEqual(result.data.json.patched, true);

  });

});



describe('Authentication', function () {

  it('should send Bearer token', async function () {

    const result = await Http.get(
      'https://httpbin.org/bearer',
      null,
      { auth: { bearer_token: 'test-token-123' } }
    );

    assert.strictEqual(result.success, true);
    assert.ok(result.data);
    assert.strictEqual(result.data.token, 'test-token-123');

  });


  it('should send Basic auth', async function () {

    const result = await Http.get(
      'https://httpbin.org/basic-auth/user/pass',
      null,
      { auth: { basic: { username: 'user', password: 'pass' } } }
    );

    assert.strictEqual(result.success, true);
    assert.ok(result.data);

  });

});



describe('Custom headers', function () {

  it('should send custom headers', async function () {

    const result = await Http.get(
      'https://httpbin.org/headers',
      null,
      { headers: { 'X-Custom-Header': 'custom-value' } }
    );

    assert.strictEqual(result.success, true);
    assert.ok(result.data);
    assert.ok(result.data.headers);
    assert.strictEqual(result.data.headers['X-Custom-Header'], 'custom-value');

  });

});



describe('Response structure', function () {

  it('should return normalized headers with lowercase keys', async function () {

    const result = await Http.get('https://httpbin.org/get');

    assert.ok(result.headers);
    assert.ok(result.headers['content-type']);

  });


  it('should include error details on failure', async function () {

    const result = await Http.get('https://httpbin.org/status/500');

    assert.strictEqual(result.success, false);
    assert.ok(result.error);
    assert.strictEqual(result.error.type, 'HTTP_ERROR');

  });


  it('should return NETWORK_ERROR on timeout', async function () {

    // httpbin /delay/5 waits 5 seconds, we timeout after 1
    const result = await Http.get(
      'https://httpbin.org/delay/5',
      null,
      { timeout: 1 }
    );

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.status, 0);
    assert.ok(result.error);
    assert.strictEqual(result.error.type, 'NETWORK_ERROR');

  });

});
