// Info: Tests for UserProcess module
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

const UserProcess = require('../user.process')(mockLib);

describe('UserProcess', function () {

  describe('calculateAccountAgeDays', function () {
    it('should calculate days since account creation', function () {
      const created_at = new Date(Date.now() - 86400000 * 5).toISOString(); // 5 days ago
      const days = UserProcess.calculateAccountAgeDays(created_at);
      assert.strictEqual(days, 5);
    });

    it('should return 0 for today', function () {
      const created_at = new Date().toISOString();
      const days = UserProcess.calculateAccountAgeDays(created_at);
      assert.strictEqual(days, 0);
    });
  });

  describe('formatDisplayName', function () {
    it('should return name when available', function () {
      const result = UserProcess.formatDisplayName({ name: 'John Doe', email: 'john@example.com' });
      assert.strictEqual(result, 'John Doe');
    });

    it('should use email prefix when name is empty', function () {
      const result = UserProcess.formatDisplayName({ name: '', email: 'john@example.com' });
      assert.strictEqual(result, 'john');
    });

    it('should return Anonymous when both are empty', function () {
      const result = UserProcess.formatDisplayName({ name: '', email: '' });
      assert.strictEqual(result, 'Anonymous');
    });
  });

  describe('calculateActivityScore', function () {
    it('should calculate high score for active user', function () {
      const score = UserProcess.calculateActivityScore({
        login_count: 20,
        survey_count: 5,
        days_since_last_login: 0
      });
      assert.ok(score >= 70, 'Should be high activity');
    });

    it('should calculate low score for inactive user', function () {
      const score = UserProcess.calculateActivityScore({
        login_count: 1,
        survey_count: 0,
        days_since_last_login: 60
      });
      assert.ok(score < 40, 'Should be low activity');
    });

    it('should cap at 100', function () {
      const score = UserProcess.calculateActivityScore({
        login_count: 50,
        survey_count: 10,
        days_since_last_login: 0
      });
      assert.strictEqual(score, 100);
    });
  });

  describe('buildUserSummary', function () {
    it('should build summary with computed fields', function () {
      const user_data = {
        id: 'usr_123',
        name: 'John Doe',
        email: 'john@example.com',
        role: 'admin',
        status: 'active',
        created_at: new Date(Date.now() - 86400000 * 3).toISOString() // 3 days ago
      };

      const summary = UserProcess.buildUserSummary(user_data);

      assert.strictEqual(summary.id, 'usr_123');
      assert.strictEqual(summary.display_name, 'John Doe');
      assert.strictEqual(summary.email, 'john@example.com');
      assert.strictEqual(summary.role, 'admin');
      assert.strictEqual(summary.status, 'active');
      assert.strictEqual(summary.account_age_days, 3);
      assert.strictEqual(summary.is_new, true);
    });
  });

  describe('enrichUserData', function () {
    it('should add computed fields to user data', function () {
      const user_data = {
        id: 'usr_123',
        name: 'John Doe',
        email: 'john@example.com',
        created_at: new Date().toISOString()
      };

      const enriched = UserProcess.enrichUserData(user_data, {
        login_count: 10,
        survey_count: 2,
        days_since_last_login: 5
      });

      assert.ok(enriched.display_name);
      assert.ok(typeof enriched.account_age_days === 'number');
      assert.ok(typeof enriched.activity_score === 'number');
      assert.ok(['high', 'medium', 'low'].includes(enriched.activity_level));
    });
  });

  describe('validatePasswordStrength', function () {
    it('should return null for strong password', function () {
      const result = UserProcess.validatePasswordStrength('StrongPass123');
      assert.strictEqual(result, null);
    });

    it('should reject short password', function () {
      const result = UserProcess.validatePasswordStrength('Short1');
      assert.ok(result !== null);
      assert.ok(result.message.includes('8'));
    });

    it('should reject password without uppercase', function () {
      const result = UserProcess.validatePasswordStrength('lowercase123');
      assert.ok(result !== null);
      assert.ok(result.message.includes('uppercase'));
    });

    it('should reject password without lowercase', function () {
      const result = UserProcess.validatePasswordStrength('UPPERCASE123');
      assert.ok(result !== null);
      assert.ok(result.message.includes('lowercase'));
    });

    it('should reject password without number', function () {
      const result = UserProcess.validatePasswordStrength('NoNumbersHere');
      assert.ok(result !== null);
      assert.ok(result.message.includes('number'));
    });
  });

  describe('filterUsers', function () {
    const users = [
      { id: '1', name: 'Alice', role: 'admin', status: 'active', created_at: new Date().toISOString() },
      { id: '2', name: 'Bob', role: 'user', status: 'inactive', created_at: new Date(Date.now() - 86400000 * 10).toISOString() },
      { id: '3', name: 'Carol', role: 'user', status: 'active', created_at: new Date().toISOString() }
    ];

    it('should filter by role', function () {
      const result = UserProcess.filterUsers(users, { role: 'admin' });
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].name, 'Alice');
    });

    it('should filter by status', function () {
      const result = UserProcess.filterUsers(users, { status: 'active' });
      assert.strictEqual(result.length, 2);
    });

    it('should filter by is_new', function () {
      const result = UserProcess.filterUsers(users, { is_new: true });
      assert.strictEqual(result.length, 2);
    });
  });

  describe('sortUsers', function () {
    const users = [
      { id: '1', name: 'Charlie', created_at: '2021-01-01' },
      { id: '2', name: 'Alice', created_at: '2021-03-01' },
      { id: '3', name: 'Bob', created_at: '2021-02-01' }
    ];

    it('should sort by name ascending', function () {
      const result = UserProcess.sortUsers(users, 'name', 'asc');
      assert.strictEqual(result[0].name, 'Alice');
      assert.strictEqual(result[2].name, 'Charlie');
    });

    it('should sort by name descending', function () {
      const result = UserProcess.sortUsers(users, 'name', 'desc');
      assert.strictEqual(result[0].name, 'Charlie');
      assert.strictEqual(result[2].name, 'Alice');
    });
  });

});
