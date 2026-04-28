// Info: Unit tests for User Controller
// Tests the validate -> DTO -> delegate -> response flow using mock Lib
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');


// Load the real models for validation/DTO (pure modules, no mocking needed)
// Load models with proper Lib injection
const loadLib = require('../../../../model/_test/loader');
const Lib = loadLib();
const { User, Contact } = Lib;


// Helper: Create a mock Lib with real models but mock service
function createMockLib (service_override) {

  return {
    User: {
      ...User,
      service: service_override || {
        createUser: async function () { return { success: true, data: { id: 'usr_test', name: 'John', email: 'john@example.com', role: 'user', status: 'active', created_at: 1000 } }; },
        getUserById: async function () { return { success: true, data: { id: 'usr_test', name: 'John', email: 'john@example.com', role: 'user', status: 'active', created_at: 1000 } }; },
        updateUser: async function () { return { success: true, data: { id: 'usr_test', name: 'Jane', status: 'inactive' } }; }
      }
    },
    Contact: Contact,
    Functions: {
      successResponse: function (data, status) { return { success: true, status: status || 200, data: data }; },
      errorResponse: function (error, status) { return { success: false, status: status || 500, error: error }; }
    }
  };

}


// Helper: Build a standardized request object
function buildRequest (method, body, params) {

  return {
    method: method,
    path: '/user',
    params: params || {},
    query: {},
    body: body || {},
    headers: {},
    auth: {},
    meta: { request_id: 'test', request_time: Date.now(), source: 'test' }
  };

}


// Load controller with mock Lib
function loadController (mock_lib) {

  // Clear require cache so controller gets fresh Lib each time
  const controller_path = require.resolve('../../user.controller');
  delete require.cache[controller_path];

  return require('../../user.controller')(mock_lib, {});

}



describe('User Controller - create', function () {

  it('should return success when valid data is provided', async function () {

    const controller = loadController(createMockLib());
    const request = buildRequest('POST', { name: 'John', email: 'john@example.com' });

    const result = await controller.create(request);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.status, 201);
    assert.strictEqual(result.data.id, 'usr_test');

  });


  it('should return error when name is missing', async function () {

    const controller = loadController(createMockLib());
    const request = buildRequest('POST', { email: 'john@example.com' });

    const result = await controller.create(request);

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error.code, 'USER_NAME_REQUIRED');

  });


  it('should return error when email is invalid', async function () {

    const controller = loadController(createMockLib());
    const request = buildRequest('POST', { name: 'John', email: 'bad-email' });

    const result = await controller.create(request);

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error.code, 'CONTACT_EMAIL_INVALID_FORMAT');

  });


  it('should return error when service returns failure', async function () {

    const mock_service = {
      createUser: async function () { return { success: false, error: { code: 'USER_EMAIL_ALREADY_EXISTS', message: 'Email taken', status: 409 } }; }
    };

    const controller = loadController(createMockLib(mock_service));
    const request = buildRequest('POST', { name: 'John', email: 'john@example.com' });

    const result = await controller.create(request);

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error.code, 'USER_EMAIL_ALREADY_EXISTS');

  });

});



describe('User Controller - getById', function () {

  it('should return success when ID is provided', async function () {

    const controller = loadController(createMockLib());
    const request = buildRequest('GET', {}, { id: 'usr_test' });

    const result = await controller.getById(request);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.id, 'usr_test');

  });


  it('should return error when ID is missing', async function () {

    const controller = loadController(createMockLib());
    const request = buildRequest('GET', {}, {});

    const result = await controller.getById(request);

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error.code, 'USER_ID_REQUIRED');

  });

});



describe('User Controller - update', function () {

  it('should return success when valid update data is provided', async function () {

    const controller = loadController(createMockLib());
    const request = buildRequest('PUT', { name: 'Jane' }, { id: 'usr_test' });

    const result = await controller.update(request);

    assert.strictEqual(result.success, true);

  });


  it('should return error when ID is missing for update', async function () {

    const controller = loadController(createMockLib());
    const request = buildRequest('PUT', { name: 'Jane' }, {});

    const result = await controller.update(request);

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error.code, 'USER_ID_REQUIRED');

  });

});
