// Info: Tests for SharedProcess module
'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

// Mock Lib object with minimal Utils
const mockLib = {
  Utils: {
    isEmpty: function (val) {
      return val === null || val === undefined || val === '' ||
        (Array.isArray(val) && val.length === 0) ||
        (typeof val === 'object' && Object.keys(val).length === 0);
    }
  }
};

const SharedProcess = require('../shared.process')(mockLib);

describe('SharedProcess', function () {

  describe('unixToIsoString', function () {
    it('should convert seconds timestamp to ISO string', function () {
      const result = SharedProcess.unixToIsoString(1609459200, false);
      assert.ok(result.includes('2021'));
    });

    it('should convert milliseconds timestamp to ISO string', function () {
      const result = SharedProcess.unixToIsoString(1609459200000, true);
      assert.ok(result.includes('2021'));
    });
  });

  describe('daysBetween', function () {
    it('should calculate days between two dates', function () {
      const days = SharedProcess.daysBetween('2021-01-01', '2021-01-10');
      assert.strictEqual(days, 9);
    });

    it('should handle same date', function () {
      const days = SharedProcess.daysBetween('2021-01-01', '2021-01-01');
      assert.strictEqual(days, 0);
    });
  });

  describe('formatDate', function () {
    it('should format date as short', function () {
      const result = SharedProcess.formatDate('2021-06-15T00:00:00Z', 'short');
      assert.ok(typeof result === 'string');
      assert.ok(result.includes('Jun') || result.includes('15'));
    });

    it('should format date as long', function () {
      const result = SharedProcess.formatDate('2021-06-15T00:00:00Z', 'long');
      assert.ok(typeof result === 'string');
    });

    it('should return relative time for relative format', function () {
      const recent = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
      const result = SharedProcess.formatDate(recent, 'relative');
      assert.ok(result.includes('ago'));
    });
  });

  describe('sanitizeString', function () {
    it('should trim whitespace', function () {
      const result = SharedProcess.sanitizeString('  hello world  ');
      assert.strictEqual(result, 'hello world');
    });

    it('should handle empty input', function () {
      const result = SharedProcess.sanitizeString('');
      assert.strictEqual(result, '');
    });

    it('should remove extra spaces when option set', function () {
      const result = SharedProcess.sanitizeString('hello    world', { remove_extra_spaces: true });
      assert.strictEqual(result, 'hello world');
    });

    it('should truncate when max_length set', function () {
      const result = SharedProcess.sanitizeString('hello world', { max_length: 5 });
      assert.ok(result.length <= 8); // includes "..."
    });
  });

  describe('generateSlug', function () {
    it('should generate URL-friendly slug', function () {
      const result = SharedProcess.generateSlug('Hello World Test');
      assert.strictEqual(result, 'hello-world-test');
    });

    it('should handle empty input', function () {
      const result = SharedProcess.generateSlug('');
      assert.strictEqual(result, '');
    });

    it('should remove special characters', function () {
      const result = SharedProcess.generateSlug('Hello! @World# Test$');
      assert.strictEqual(result, 'hello-world-test');
    });
  });

  describe('paginate', function () {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    it('should return correct page of items', function () {
      const result = SharedProcess.paginate(items, 1, 3);
      assert.strictEqual(result.data.length, 3);
      assert.deepStrictEqual(result.data, [1, 2, 3]);
    });

    it('should return pagination metadata', function () {
      const result = SharedProcess.paginate(items, 2, 3);
      assert.strictEqual(result.pagination.current_page, 2);
      assert.strictEqual(result.pagination.total_pages, 4);
      assert.strictEqual(result.pagination.total_items, 10);
      assert.strictEqual(result.pagination.has_next, true);
      assert.strictEqual(result.pagination.has_prev, true);
    });

    it('should handle last page', function () {
      const result = SharedProcess.paginate(items, 4, 3);
      assert.strictEqual(result.data.length, 1);
      assert.strictEqual(result.pagination.has_next, false);
    });
  });

  describe('deepClone', function () {
    it('should deep clone an object', function () {
      const original = { a: 1, b: { c: 2 } };
      const cloned = SharedProcess.deepClone(original);
      assert.deepStrictEqual(cloned, original);
      cloned.b.c = 3;
      assert.strictEqual(original.b.c, 2); // Original unchanged
    });

    it('should handle arrays', function () {
      const original = [{ a: 1 }, { b: 2 }];
      const cloned = SharedProcess.deepClone(original);
      assert.deepStrictEqual(cloned, original);
      cloned[0].a = 3;
      assert.strictEqual(original[0].a, 1); // Original unchanged
    });

    it('should handle dates', function () {
      const date = new Date('2021-06-15');
      const cloned = SharedProcess.deepClone(date);
      assert.ok(cloned instanceof Date);
      assert.strictEqual(cloned.getTime(), date.getTime());
    });
  });

  describe('pick', function () {
    it('should pick specified keys', function () {
      const obj = { a: 1, b: 2, c: 3, d: 4 };
      const result = SharedProcess.pick(obj, ['a', 'c']);
      assert.deepStrictEqual(result, { a: 1, c: 3 });
    });

    it('should ignore non-existent keys', function () {
      const obj = { a: 1, b: 2 };
      const result = SharedProcess.pick(obj, ['a', 'z']);
      assert.deepStrictEqual(result, { a: 1 });
    });
  });

  describe('omit', function () {
    it('should omit specified keys', function () {
      const obj = { a: 1, b: 2, c: 3, d: 4 };
      const result = SharedProcess.omit(obj, ['b', 'd']);
      assert.deepStrictEqual(result, { a: 1, c: 3 });
    });
  });

  describe('groupBy', function () {
    it('should group items by key', function () {
      const items = [
        { type: 'a', value: 1 },
        { type: 'b', value: 2 },
        { type: 'a', value: 3 }
      ];
      const result = SharedProcess.groupBy(items, 'type');
      assert.strictEqual(result.a.length, 2);
      assert.strictEqual(result.b.length, 1);
    });
  });

  describe('calculateNumericStats', function () {
    it('should calculate stats for numeric array', function () {
      const result = SharedProcess.calculateNumericStats([1, 2, 3, 4, 5]);
      assert.strictEqual(result.min, 1);
      assert.strictEqual(result.max, 5);
      assert.strictEqual(result.avg, 3);
      assert.strictEqual(result.count, 5);
      assert.strictEqual(result.sum, 15);
    });

    it('should handle empty array', function () {
      const result = SharedProcess.calculateNumericStats([]);
      assert.strictEqual(result.count, 0);
      assert.strictEqual(result.sum, 0);
    });

    it('should filter out non-numeric values', function () {
      const result = SharedProcess.calculateNumericStats([1, 'two', 3, null, 5]);
      assert.strictEqual(result.count, 3);
    });
  });

});
