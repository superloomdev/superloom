// Info: Test Cases for User base model module
// Uses simulating loader pattern for proper dependency injection
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Load models via simulating loader (proper DI pattern)
const loadLib = require('../../_test/loader');
const Lib = loadLib();

// Access User module through Lib.User
const User = Lib.User;

// Load config directly (entity modules do not export their config)
const UserConfig = require('../user.config');



describe('User Model - Config', function () {

  it('should have valid status values', function () {

    assert.ok(Array.isArray(UserConfig.STATUS_VALUES));
    assert.ok(UserConfig.STATUS_VALUES.includes('active'));

  });


  it('should have valid role values', function () {

    assert.ok(Array.isArray(UserConfig.ROLE_VALUES));
    assert.ok(UserConfig.ROLE_VALUES.includes('user'));
    assert.ok(UserConfig.ROLE_VALUES.includes('admin'));

  });

});



describe('User Model - Data', function () {

  it('should create a user with defaults via data.create', function () {

    const user = User.data.create({
      name: ' John Doe ',
      email: ' John@Example.com '
    });

    assert.strictEqual(user.name, 'John Doe');
    assert.strictEqual(user.email, 'john@example.com');
    assert.strictEqual(user.role, 'user');
    assert.strictEqual(user.status, 'active');
    assert.ok(user.created_at);

  });


  it('should create update shape with only provided fields via data.createUpdate', function () {

    const update = User.data.createUpdate({
      name: 'Jane Doe'
    });

    assert.strictEqual(update.name, 'Jane Doe');
    assert.strictEqual('email' in update, false);
    assert.ok(update.updated_at);

  });

});



describe('User Model - Validation', function () {

  it('should pass validation for valid create data', function () {

    const result = User.validation.validateCreate({
      name: 'John Doe',
      email: 'john@example.com'
    });

    assert.strictEqual(result, false);

  });


  it('should fail validation when name is missing', function () {

    const result = User.validation.validateCreate({
      email: 'john@example.com'
    });

    assert.ok(Array.isArray(result));
    assert.strictEqual(result[0].code, 'USER_NAME_REQUIRED');

  });


  it('should fail validation when email is invalid (delegated to Contact model)', function () {

    const result = User.validation.validateCreate({
      name: 'John',
      email: 'not-an-email'
    });

    assert.ok(Array.isArray(result));
    assert.strictEqual(result[0].code, 'CONTACT_EMAIL_INVALID_FORMAT');

  });


  it('should fail validation when role is invalid', function () {

    const result = User.validation.validateCreate({
      name: 'John',
      email: 'john@example.com',
      role: 'superadmin'
    });

    assert.ok(Array.isArray(result));
    assert.strictEqual(result[0].code, 'USER_ROLE_INVALID');

  });


  it('should pass update validation with partial data', function () {

    const result = User.validation.validateUpdate({
      name: 'Updated Name'
    });

    assert.strictEqual(result, false);

  });


  it('should fail update validation with invalid status', function () {

    const result = User.validation.validateUpdate({
      status: 'unknown'
    });

    assert.ok(Array.isArray(result));
    assert.strictEqual(result[0].code, 'USER_STATUS_INVALID');

  });

});



describe('User Model - DTO Transformations', function () {

  it('should build complete user data with all provided keys via data.create', function () {

    const data = User.data.create({
      id: 'usr_123',
      name: 'John',
      email: 'john@example.com',
      phone: '1234567890',
      role: 'user',
      status: 'active'
    });

    assert.strictEqual(data.id, 'usr_123');
    assert.strictEqual(data.name, 'John');
    assert.strictEqual(data.email, 'john@example.com');
    assert.strictEqual(data.phone, '1234567890');
    assert.strictEqual(data.role, 'user');
    assert.strictEqual(data.status, 'active');
    assert.ok(data.created_at);
    assert.ok(data.updated_at);

  });


  it('should not add keys that are undefined (absent keys use defaults)', function () {

    const data = User.data.create({
      id: 'usr_123',
      name: 'Jane',
      status: 'inactive'
    });

    assert.strictEqual(data.id, 'usr_123');
    assert.strictEqual(data.name, 'Jane');
    assert.strictEqual(data.status, 'inactive');
    assert.strictEqual(data.phone, null);
    assert.strictEqual(data.role, 'user');

  });


  it('should build public data from full object, stripping server-only fields via data.toPublic', function () {

    const full_data = User.data.create({
      id: 'usr_123',
      name: 'John',
      email: 'john@example.com',
      phone: null,
      role: 'user',
      status: 'active'
    });

    const public_data = User.data.toPublic(full_data);

    assert.strictEqual(public_data.id, 'usr_123');
    assert.strictEqual(public_data.name, 'John');
    assert.strictEqual(public_data.email, 'john@example.com');
    assert.strictEqual('updated_at' in public_data, false);

  });

});
