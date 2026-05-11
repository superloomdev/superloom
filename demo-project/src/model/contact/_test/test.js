// Info: Test Cases for Contact model module
// Uses simulating loader pattern for proper dependency injection
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Load models via simulating loader (proper DI pattern)
const loadLib = require('../../_test/loader');
const Lib = loadLib();

// Access Contact module through Lib.Contact
const Contact = Lib.Contact;



describe('Contact Model - Email Validation', function () {

  it('should pass validation for valid email', function () {

    const result = Contact.validation.validateEmail('john@example.com');
    assert.strictEqual(result, false);

  });


  it('should fail when email is missing', function () {

    const result = Contact.validation.validateEmail(null);
    assert.ok(Array.isArray(result));
    assert.strictEqual(result[0].code, 'CONTACT_EMAIL_REQUIRED');

  });


  it('should fail when email format is invalid', function () {

    const result = Contact.validation.validateEmail('not-an-email');
    assert.ok(Array.isArray(result));
    assert.strictEqual(result[0].code, 'CONTACT_EMAIL_INVALID_FORMAT');

  });


  it('should fail when email domain is blocked', function () {

    const result = Contact.validation.validateEmail('user@mailinator.com');
    assert.ok(Array.isArray(result));
    assert.strictEqual(result[0].code, 'CONTACT_EMAIL_DOMAIN_BLOCKED');

  });


  it('should pass optional email when not provided', function () {

    const result = Contact.validation.validateEmailOptional(undefined);
    assert.strictEqual(result, false);

  });


  it('should validate optional email when provided', function () {

    const result = Contact.validation.validateEmailOptional('not-an-email');
    assert.ok(Array.isArray(result));
    assert.strictEqual(result[0].code, 'CONTACT_EMAIL_INVALID_FORMAT');

  });

});



describe('Contact Model - Phone Validation', function () {

  it('should pass validation for valid Indian phone', function () {

    const result = Contact.validation.validatePhone('in', '9876543210');
    assert.strictEqual(result, false);

  });


  it('should pass validation for valid US phone', function () {

    const result = Contact.validation.validatePhone('us', '2125551234');
    assert.strictEqual(result, false);

  });


  it('should fail when country is not supported', function () {

    const result = Contact.validation.validatePhone('zz', '1234567890');
    assert.ok(Array.isArray(result));
    assert.strictEqual(result[0].code, 'CONTACT_PHONE_COUNTRY_INVALID');

  });


  it('should fail when phone number is too short', function () {

    const result = Contact.validation.validatePhone('in', '12345');
    assert.ok(Array.isArray(result));
    assert.strictEqual(result[0].code, 'CONTACT_PHONE_NUMBER_INVALID');

  });


  it('should fail when phone number format is wrong for country', function () {

    // Indian numbers must start with 6-9
    const result = Contact.validation.validatePhone('in', '1234567890');
    assert.ok(Array.isArray(result));
    assert.strictEqual(result[0].code, 'CONTACT_PHONE_NUMBER_INVALID');

  });


  it('should pass optional phone when not provided', function () {

    const result = Contact.validation.validatePhoneOptional(undefined, undefined);
    assert.strictEqual(result, false);

  });

});



describe('Contact Model - Data Builders', function () {

  it('should build email data via data.createEmail (trimmed and lowercased)', function () {

    const data = Contact.data.createEmail(' John@Example.Com ');
    assert.strictEqual(data.email, 'john@example.com');

  });


  it('should build phone data via data.createPhone (sanitized digits only)', function () {

    const data = Contact.data.createPhone('in', '+91-9876-543-210');
    assert.strictEqual(data.phone_country, 'in');
    assert.strictEqual(data.phone_number, '919876543210');

  });


  it('should build phone ID via data.buildPhoneId', function () {

    const id = Contact.data.buildPhoneId('in', '9876543210');
    assert.strictEqual(id, '+91-9876543210');

  });


  it('should not add absent keys when undefined', function () {

    const data = Contact.data.createEmail(undefined);
    assert.strictEqual('email' in data, false);

  });


  it('should build public Contact data via data.toPublic', function () {

    const full = { email: 'john@example.com', phone_country: 'in', phone_number: '9876543210', internal_field: 'secret' };
    const public_data = Contact.data.toPublic(full);

    assert.strictEqual(public_data.email, 'john@example.com');
    assert.strictEqual(public_data.phone_country, 'in');
    assert.strictEqual(public_data.internal_field, undefined);

  });

});
