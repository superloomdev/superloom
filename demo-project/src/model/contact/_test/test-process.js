// Info: Tests for ContactProcess module
'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

// Mock Lib object
const mockLib = {
  Utils: {
    isEmpty: function (val) {
      return val === null || val === undefined || val === '' ||
        (Array.isArray(val) && val.length === 0) ||
        (typeof val === 'object' && Object.keys(val).length === 0);
    }
  }
};

const ContactProcess = require('../contact.process')(mockLib);

describe('ContactProcess', function () {

  describe('formatPhoneNumber', function () {
    it('should format as national by default', function () {
      const result = ContactProcess.formatPhoneNumber('5551234567', 'national');
      assert.ok(result.includes('(555)'));
    });

    it('should format as international', function () {
      const result = ContactProcess.formatPhoneNumber('5551234567', 'international');
      assert.ok(result.startsWith('+1'));
    });

    it('should format as e164', function () {
      const result = ContactProcess.formatPhoneNumber('5551234567', 'e164');
      assert.ok(result.startsWith('+1'));
      assert.ok(!result.includes('('));
    });

    it('should handle empty input', function () {
      const result = ContactProcess.formatPhoneNumber('', 'national');
      assert.strictEqual(result, '');
    });
  });

  describe('maskPhoneNumber', function () {
    it('should mask all but last 4 digits', function () {
      const result = ContactProcess.maskPhoneNumber('555-123-4567');
      assert.strictEqual(result, '***-***-4567');
    });

    it('should return short numbers as-is', function () {
      const result = ContactProcess.maskPhoneNumber('4567');
      assert.strictEqual(result, '4567');
    });

    it('should handle empty input', function () {
      const result = ContactProcess.maskPhoneNumber('');
      assert.strictEqual(result, '');
    });
  });

  describe('maskEmail', function () {
    it('should mask email after first 2 characters', function () {
      const result = ContactProcess.maskEmail('john.doe@example.com');
      assert.ok(result.startsWith('jo'));
      assert.ok(result.includes('***'));
      assert.ok(result.includes('@example.com'));
    });

    it('should handle short local parts', function () {
      const result = ContactProcess.maskEmail('ab@example.com');
      assert.strictEqual(result, 'ab***@example.com');
    });

    it('should return invalid emails as-is', function () {
      const result = ContactProcess.maskEmail('not-an-email');
      assert.strictEqual(result, 'not-an-email');
    });

    it('should handle empty input', function () {
      const result = ContactProcess.maskEmail('');
      assert.strictEqual(result, '');
    });
  });

  describe('normalizeEmail', function () {
    it('should lowercase email', function () {
      const result = ContactProcess.normalizeEmail('John.Doe@Example.COM');
      assert.strictEqual(result, 'john.doe@example.com');
    });

    it('should trim whitespace', function () {
      const result = ContactProcess.normalizeEmail('  john@example.com  ');
      assert.strictEqual(result, 'john@example.com');
    });

    it('should handle empty input', function () {
      const result = ContactProcess.normalizeEmail('');
      assert.strictEqual(result, '');
    });
  });

  describe('extractEmailDomain', function () {
    it('should extract domain from email', function () {
      const result = ContactProcess.extractEmailDomain('john@example.com');
      assert.strictEqual(result, 'example.com');
    });

    it('should lowercase domain', function () {
      const result = ContactProcess.extractEmailDomain('john@EXAMPLE.COM');
      assert.strictEqual(result, 'example.com');
    });

    it('should return null for invalid email', function () {
      const result = ContactProcess.extractEmailDomain('not-an-email');
      assert.strictEqual(result, null);
    });
  });

  describe('formatAddressLine', function () {
    it('should format complete address', function () {
      const address = {
        line1: '123 Main St',
        line2: 'Apt 4B',
        city: 'New York',
        state: 'NY',
        postal_code: '10001',
        country: 'USA'
      };
      const result = ContactProcess.formatAddressLine(address);
      assert.ok(result.includes('123 Main St'));
      assert.ok(result.includes('Apt 4B'));
      assert.ok(result.includes('New York'));
      assert.ok(result.includes('NY'));
      assert.ok(result.includes('10001'));
      assert.ok(result.includes('USA'));
    });

    it('should handle minimal address', function () {
      const address = {
        line1: '123 Main St',
        city: 'New York',
        state: 'NY',
        postal_code: '10001'
      };
      const result = ContactProcess.formatAddressLine(address);
      assert.ok(result.includes('123 Main St'));
      assert.ok(!result.includes('undefined'));
    });

    it('should return empty for empty input', function () {
      const result = ContactProcess.formatAddressLine(null);
      assert.strictEqual(result, '');
    });
  });

  describe('buildContactSummary', function () {
    it('should build contact summary with all fields', function () {
      const contact_data = {
        email: 'john@example.com',
        phone: '555-123-4567',
        address: {
          line1: '123 Main St',
          city: 'New York',
          state: 'NY',
          postal_code: '10001'
        }
      };

      const summary = ContactProcess.buildContactSummary(contact_data);

      assert.strictEqual(summary.email, 'john@example.com');
      assert.ok(summary.email_masked.includes('***'));
      assert.strictEqual(summary.email_domain, 'example.com');
      assert.strictEqual(summary.phone, '555-123-4567');
      assert.ok(summary.phone_masked.includes('***'));
      assert.ok(summary.phone_formatted.includes('('));
      assert.strictEqual(summary.has_address, true);
      assert.ok(summary.address_summary.includes('Main St'));
    });

    it('should handle minimal contact data', function () {
      const contact_data = {
        email: 'john@example.com'
      };

      const summary = ContactProcess.buildContactSummary(contact_data);

      assert.strictEqual(summary.email, 'john@example.com');
      assert.strictEqual(summary.phone, null);
      assert.strictEqual(summary.has_address, false);
      assert.strictEqual(summary.address_summary, null);
    });
  });

  describe('checkCompleteness', function () {
    it('should return complete for all fields present', function () {
      const contact_data = {
        email: 'john@example.com',
        phone: '555-123-4567',
        address: { line1: '123 Main St' }
      };
      const result = ContactProcess.checkCompleteness(contact_data);
      assert.strictEqual(result.is_complete, true);
      assert.strictEqual(result.missing_fields.length, 0);
    });

    it('should return incomplete for missing fields', function () {
      const contact_data = {
        email: 'john@example.com'
      };
      const result = ContactProcess.checkCompleteness(contact_data);
      assert.strictEqual(result.is_complete, false);
      assert.ok(result.missing_fields.includes('phone'));
      assert.ok(result.missing_fields.includes('address'));
    });

    it('should track individual field presence', function () {
      const contact_data = {
        email: 'john@example.com',
        phone: '555-123-4567'
      };
      const result = ContactProcess.checkCompleteness(contact_data);
      assert.strictEqual(result.has_email, true);
      assert.strictEqual(result.has_phone, true);
      assert.strictEqual(result.has_address, false);
    });
  });

});
