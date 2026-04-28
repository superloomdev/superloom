// Tests for js-helper-utils
// Covers all exported functions with automated assertions
// Based on handwritten test cases + additional edge cases
'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const Utils = require('../utils.js')({}, {});



// ============================================================================
// 1. TYPE CHECKS
// ============================================================================

describe('isNull', function () {

  it('should return true when value is null', function () {
    assert.strictEqual(Utils.isNull(null), true);
  });

  it('should return false when value is undefined', function () {
    assert.strictEqual(Utils.isNull(undefined), false);
  });

  it('should return false when value is empty string', function () {
    assert.strictEqual(Utils.isNull(''), false);
  });

  it('should return false when value is zero', function () {
    assert.strictEqual(Utils.isNull(0), false);
  });

  it('should return false when value is false', function () {
    assert.strictEqual(Utils.isNull(false), false);
  });

});


describe('isNullOrUndefined', function () {

  it('should return true when value is null', function () {
    assert.strictEqual(Utils.isNullOrUndefined(null), true);
  });

  it('should return true when value is undefined', function () {
    assert.strictEqual(Utils.isNullOrUndefined(undefined), true);
  });

  it('should return false when value is empty string', function () {
    assert.strictEqual(Utils.isNullOrUndefined(''), false);
  });

  it('should return false when value is zero', function () {
    assert.strictEqual(Utils.isNullOrUndefined(0), false);
  });

  it('should return false when value is false', function () {
    assert.strictEqual(Utils.isNullOrUndefined(false), false);
  });

});


describe('isUndefined', function () {

  it('should return true when value is undefined', function () {
    assert.strictEqual(Utils.isUndefined(undefined), true);
  });

  it('should return false when value is null', function () {
    assert.strictEqual(Utils.isUndefined(null), false);
  });

  it('should return false when value is empty string', function () {
    assert.strictEqual(Utils.isUndefined(''), false);
  });

  it('should return false when value is zero', function () {
    assert.strictEqual(Utils.isUndefined(0), false);
  });

});


describe('isBoolean', function () {

  it('should return true when value is true', function () {
    assert.strictEqual(Utils.isBoolean(true), true);
  });

  it('should return true when value is false', function () {
    assert.strictEqual(Utils.isBoolean(false), true);
  });

  it('should return false when value is number 1', function () {
    assert.strictEqual(Utils.isBoolean(1), false);
  });

  it('should return false when value is string true', function () {
    assert.strictEqual(Utils.isBoolean('true'), false);
  });

  it('should return false when value is null', function () {
    assert.strictEqual(Utils.isBoolean(null), false);
  });

});


describe('isNumber', function () {

  it('should return true when value is integer 10', function () {
    assert.strictEqual(Utils.isNumber(10), true);
  });

  it('should return true when value is zero', function () {
    assert.strictEqual(Utils.isNumber(0), true);
  });

  it('should return true when value is negative decimal', function () {
    assert.strictEqual(Utils.isNumber(-1.5), true);
  });

  it('should return false when value is string aa', function () {
    assert.strictEqual(Utils.isNumber('aa'), false);
  });

  it('should return false when value is string 10.20', function () {
    assert.strictEqual(Utils.isNumber('10.20'), false);
  });

  it('should return false when value is empty string', function () {
    assert.strictEqual(Utils.isNumber(''), false);
  });

  it('should return false when value is NaN', function () {
    assert.strictEqual(Utils.isNumber(NaN), false);
  });

  it('should return false when value is Number(aa) which is NaN', function () {
    assert.strictEqual(Utils.isNumber(Number('aa')), false);
  });

  it('should return false when value is null', function () {
    assert.strictEqual(Utils.isNumber(null), false);
  });

});


describe('isString', function () {

  it('should return true when value is hello', function () {
    assert.strictEqual(Utils.isString('hello'), true);
  });

  it('should return true when value is empty string', function () {
    assert.strictEqual(Utils.isString(''), true);
  });

  it('should return false when value is number', function () {
    assert.strictEqual(Utils.isString(42), false);
  });

  it('should return false when value is null', function () {
    assert.strictEqual(Utils.isString(null), false);
  });

});


describe('isInteger', function () {

  it('should return true when value is 11', function () {
    assert.strictEqual(Utils.isInteger(11), true);
  });

  it('should return true when value is 11.00 (whole number)', function () {
    assert.strictEqual(Utils.isInteger(11.0), true);
  });

  it('should return true when value is zero', function () {
    assert.strictEqual(Utils.isInteger(0), true);
  });

  it('should return true when value is negative integer', function () {
    assert.strictEqual(Utils.isInteger(-10), true);
  });

  it('should return false when value is 11.01 (decimal)', function () {
    assert.strictEqual(Utils.isInteger(11.01), false);
  });

  it('should return false when value is 42.5', function () {
    assert.strictEqual(Utils.isInteger(42.5), false);
  });

});


describe('isObject', function () {

  it('should return true when value is plain object', function () {
    assert.strictEqual(Utils.isObject({ a: 1 }), true);
  });

  it('should return true when value is empty object', function () {
    assert.strictEqual(Utils.isObject({}), true);
  });

  it('should return true when value is array (arrays are objects)', function () {
    assert.strictEqual(Utils.isObject([]), true);
  });

  it('should return false when value is null', function () {
    assert.strictEqual(Utils.isObject(null), false);
  });

  it('should return false when value is string a', function () {
    assert.strictEqual(Utils.isObject('a'), false);
  });

  it('should return false when value is number 1', function () {
    assert.strictEqual(Utils.isObject(1), false);
  });

});


describe('isFunction', function () {

  it('should return true when value is function declaration', function () {
    assert.strictEqual(Utils.isFunction(function () {}), true);
  });

  it('should return true when value is arrow function', function () {
    assert.strictEqual(Utils.isFunction(() => {}), true);
  });

  it('should return false when value is number 50', function () {
    assert.strictEqual(Utils.isFunction(50), false);
  });

  it('should return false when value is null', function () {
    assert.strictEqual(Utils.isFunction(null), false);
  });

  it('should return false when value is string', function () {
    assert.strictEqual(Utils.isFunction('function'), false);
  });

});


describe('isError', function () {

  it('should return true when value is Error instance', function () {
    assert.strictEqual(Utils.isError(new Error('test')), true);
  });

  it('should return true when value is TypeError instance', function () {
    assert.strictEqual(Utils.isError(new TypeError('test')), true);
  });

  it('should return false when value is string', function () {
    assert.strictEqual(Utils.isError('not error'), false);
  });

  it('should return false when value is object with message key', function () {
    assert.strictEqual(Utils.isError({ message: 'test' }), false);
  });

});


describe('isEmptyString', function () {

  it('should return true when value is empty string', function () {
    assert.strictEqual(Utils.isEmptyString(''), true);
  });

  it('should return false when value is non-empty string', function () {
    assert.strictEqual(Utils.isEmptyString('a'), false);
  });

  it('should return false when value is whitespace', function () {
    assert.strictEqual(Utils.isEmptyString(' '), false);
  });

});


describe('isEmptyObject', function () {

  it('should return true when value is empty object', function () {
    assert.strictEqual(Utils.isEmptyObject({}), true);
  });

  it('should return false when value is object with keys', function () {
    assert.strictEqual(Utils.isEmptyObject({ a: 1 }), false);
  });

});


describe('isEmpty', function () {

  it('should return true when value is null', function () {
    assert.strictEqual(Utils.isEmpty(null), true);
  });

  it('should return true when value is undefined', function () {
    assert.strictEqual(Utils.isEmpty(undefined), true);
  });

  it('should return true when value is empty string', function () {
    assert.strictEqual(Utils.isEmpty(''), true);
  });

  it('should return true when value is empty object', function () {
    assert.strictEqual(Utils.isEmpty({}), true);
  });

  it('should return true when value is empty array', function () {
    assert.strictEqual(Utils.isEmpty([]), true);
  });

  it('should return false when value is false', function () {
    assert.strictEqual(Utils.isEmpty(false), false);
  });

  it('should return false when value is zero', function () {
    assert.strictEqual(Utils.isEmpty(0), false);
  });

  it('should return false when value is non-empty string', function () {
    assert.strictEqual(Utils.isEmpty('hello'), false);
  });

});



// ============================================================================
// 2. ERROR HANDLING
// ============================================================================

describe('error', function () {

  it('should create Error with code and message when given error object', function () {
    const err = Utils.error({ code: 123, message: 'intentional error' }, 'ctx123');
    assert.strictEqual(err instanceof Error, true);
    assert.strictEqual(err.code, 123);
    assert.strictEqual(err.message, 'intentional error');
    assert.strictEqual(err.name, '123');
    assert.strictEqual(err.context, 'ctx123');
  });

  it('should create Error with string code when given string code', function () {
    const err = Utils.error({ code: 'abc', message: 'intentional error' });
    assert.strictEqual(err.code, 'abc');
    assert.strictEqual(err.name, 'abc');
    assert.strictEqual(err.context, null);
  });

});


describe('nullFunc', function () {

  it('should be a function that returns undefined', function () {
    assert.strictEqual(Utils.isFunction(Utils.nullFunc), true);
    assert.strictEqual(Utils.nullFunc(), undefined);
  });

});



// ============================================================================
// 3. STRING OPERATIONS
// ============================================================================

describe('stringReverse', function () {

  it('should reverse Hello to olleH', function () {
    assert.strictEqual(Utils.stringReverse('Hello'), 'olleH');
  });

  it('should return empty string when given empty string', function () {
    assert.strictEqual(Utils.stringReverse(''), '');
  });

  it('should reverse single character to same character', function () {
    assert.strictEqual(Utils.stringReverse('a'), 'a');
  });

});


describe('stringToJSON', function () {

  it('should parse valid JSON string to object', function () {
    assert.deepStrictEqual(Utils.stringToJSON('{"a":1}'), { a: 1 });
  });

  it('should return null when given invalid JSON string', function () {
    assert.strictEqual(Utils.stringToJSON('not json'), null);
  });

  it('should return null when given null', function () {
    assert.strictEqual(Utils.stringToJSON(null), null);
  });

});


describe('stringToNumber', function () {

  it('should convert string 10 to number 10', function () {
    assert.strictEqual(Utils.stringToNumber('10'), 10);
  });

  it('should convert string 10.20 to number 10.2', function () {
    assert.strictEqual(Utils.stringToNumber('10.20'), 10.2);
  });

  it('should return null when given empty string', function () {
    assert.strictEqual(Utils.stringToNumber(''), null);
  });

  it('should return number as-is when given number 10', function () {
    assert.strictEqual(Utils.stringToNumber(10), 10);
  });

  it('should return null when given null', function () {
    assert.strictEqual(Utils.stringToNumber(null), null);
  });

});


describe('safeJoin', function () {

  it('should join array [a,b,c] with hyphen to a-b-c', function () {
    assert.strictEqual(Utils.safeJoin(['a', 'b', 'c'], '-'), 'a-b-c');
  });

  it('should return empty string when given empty array', function () {
    assert.strictEqual(Utils.safeJoin([], '-'), '');
  });

  it('should return false as-is when given false', function () {
    assert.strictEqual(Utils.safeJoin(false, '-'), false);
  });

  it('should return null as-is when given null', function () {
    assert.strictEqual(Utils.safeJoin(null, '-'), null);
  });

});


describe('splitWithTrim', function () {

  it('should split and trim comma-separated string', function () {
    assert.deepStrictEqual(
      Utils.splitWithTrim('a, b , c', ','),
      ['a', 'b', 'c']
    );
  });

  it('should preserve empty elements between delimiters', function () {
    assert.deepStrictEqual(
      Utils.splitWithTrim('a,b,c,,e', ','),
      ['a', 'b', 'c', '', 'e']
    );
  });

});


describe('inArray', function () {

  it('should return true when element exists in array', function () {
    assert.strictEqual(Utils.inArray([1, 2, 3], 2), true);
  });

  it('should return false when element does not exist in array', function () {
    assert.strictEqual(Utils.inArray([1, 2, 3], 5), false);
  });

  it('should return true when string element exists', function () {
    assert.strictEqual(Utils.inArray(['a', 'b'], 'a'), true);
  });

});



// ============================================================================
// 4. NUMBER OPERATIONS
// ============================================================================

describe('validateNumber', function () {

  it('should return true when value is valid number 11', function () {
    assert.strictEqual(Utils.validateNumber(11), true);
  });

  it('should return false when value is 0/0 (NaN)', function () {
    assert.strictEqual(Utils.validateNumber(0 / 0), false);
  });

  it('should return false when value is NaN', function () {
    assert.strictEqual(Utils.validateNumber(NaN), false);
  });

  it('should return true when number is within min-max range', function () {
    assert.strictEqual(Utils.validateNumber(5, 1, 10), true);
  });

  it('should return false when number is below minimum', function () {
    assert.strictEqual(Utils.validateNumber(0, 1, 10), false);
  });

  it('should return false when number is above maximum', function () {
    assert.strictEqual(Utils.validateNumber(11, 1, 10), false);
  });

});


describe('round', function () {

  it('should return 11 when rounding 11 to 2 decimals', function () {
    assert.strictEqual(Utils.round(11, 2), 11);
  });

  it('should return 11 when rounding 11.00 to 2 decimals', function () {
    assert.strictEqual(Utils.round(11.00, 2), 11);
  });

  it('should return 11.01 when rounding 11.01 to 2 decimals', function () {
    assert.strictEqual(Utils.round(11.01, 2), 11.01);
  });

  it('should return 11.01 when rounding 11.01111111 to 2 decimals', function () {
    assert.strictEqual(Utils.round(11.01111111, 2), 11.01);
  });

  it('should return 11.02 when rounding 11.01999999 to 2 decimals', function () {
    assert.strictEqual(Utils.round(11.01999999, 2), 11.02);
  });

  it('should return 11.1 when rounding 11.09999999 to 2 decimals', function () {
    assert.strictEqual(Utils.round(11.09999999, 2), 11.1);
  });

  it('should return 12 when rounding 11.99999999 to 2 decimals', function () {
    assert.strictEqual(Utils.round(11.99999999, 2), 12);
  });

  it('should return 11.52 when rounding 11.5249 to 2 decimals (standard rounding)', function () {
    assert.strictEqual(Utils.round(11.5249, 2), 11.52);
  });

  it('should return 351.631 when rounding 351.63149999999996 to 3 decimals', function () {
    assert.strictEqual(Utils.round(351.63149999999996, 3), 351.631);
  });

  it('should return null as-is when given null', function () {
    assert.strictEqual(Utils.round(null, 2), null);
  });

});


describe('roundWithCascading', function () {

  it('should return 11 when cascading-rounding 11 to 2 decimals', function () {
    assert.strictEqual(Utils.roundWithCascading(11, 2, 10), 11);
  });

  it('should return 11.01 when cascading-rounding 11.01 to 2 decimals', function () {
    assert.strictEqual(Utils.roundWithCascading(11.01, 2, 10), 11.01);
  });

  it('should return 11.01 when cascading-rounding 11.01111111 to 2 decimals', function () {
    assert.strictEqual(Utils.roundWithCascading(11.01111111, 2, 10), 11.01);
  });

  it('should return 11.02 when cascading-rounding 11.01999999 to 2 decimals', function () {
    assert.strictEqual(Utils.roundWithCascading(11.01999999, 2, 10), 11.02);
  });

  it('should return 11.1 when cascading-rounding 11.09999999 to 2 decimals', function () {
    assert.strictEqual(Utils.roundWithCascading(11.09999999, 2, 10), 11.1);
  });

  it('should return 12 when cascading-rounding 11.99999999 to 2 decimals', function () {
    assert.strictEqual(Utils.roundWithCascading(11.99999999, 2, 10), 12);
  });

  it('should return 11.53 when cascading-rounding 11.5249 to 2 decimals (cascading difference)', function () {
    assert.strictEqual(Utils.roundWithCascading(11.5249, 2, 10), 11.53);
  });

  it('should return 351.632 when cascading-rounding 351.63149999999996 to 3 decimals', function () {
    assert.strictEqual(Utils.roundWithCascading(351.63149999999996, 3, 10), 351.632);
  });

  it('should return null as-is when given null', function () {
    assert.strictEqual(Utils.roundWithCascading(null, 2, 10), null);
  });

});


describe('sanitizeInteger', function () {

  it('should return 1 when given string 1', function () {
    assert.strictEqual(Utils.sanitizeInteger('1'), 1);
  });

  it('should return 1 when given number 1', function () {
    assert.strictEqual(Utils.sanitizeInteger(1), 1);
  });

  it('should return -1 when given string -1', function () {
    assert.strictEqual(Utils.sanitizeInteger('-1'), -1);
  });

  it('should return -1 when given number -1', function () {
    assert.strictEqual(Utils.sanitizeInteger(-1), -1);
  });

  it('should return null when given string A', function () {
    assert.strictEqual(Utils.sanitizeInteger('A'), null);
  });

  it('should return 1 when given decimal 1.333 (floor)', function () {
    assert.strictEqual(Utils.sanitizeInteger(1.333), 1);
  });

  it('should return 1 when given decimal 1.999 (floor)', function () {
    assert.strictEqual(Utils.sanitizeInteger(1.999), 1);
  });

});


describe('sanitizeBoolean', function () {

  it('should return true when given string 1', function () {
    assert.strictEqual(Utils.sanitizeBoolean('1'), true);
  });

  it('should return true when given number 1', function () {
    assert.strictEqual(Utils.sanitizeBoolean(1), true);
  });

  it('should return false when given string 0', function () {
    assert.strictEqual(Utils.sanitizeBoolean('0'), false);
  });

  it('should return false when given number 0', function () {
    assert.strictEqual(Utils.sanitizeBoolean(0), false);
  });

  it('should return true when given string 33', function () {
    assert.strictEqual(Utils.sanitizeBoolean('33'), true);
  });

  it('should return true when given number 33', function () {
    assert.strictEqual(Utils.sanitizeBoolean(33), true);
  });

  it('should return true when given string -33', function () {
    assert.strictEqual(Utils.sanitizeBoolean('-33'), true);
  });

  it('should return true when given number -33', function () {
    assert.strictEqual(Utils.sanitizeBoolean(-33), true);
  });

  it('should return false when given string abc (NaN)', function () {
    assert.strictEqual(Utils.sanitizeBoolean('abc'), false);
  });

  it('should return false when given string true (NaN)', function () {
    assert.strictEqual(Utils.sanitizeBoolean('true'), false);
  });

  it('should return false when given string false (NaN)', function () {
    assert.strictEqual(Utils.sanitizeBoolean('false'), false);
  });

  it('should return true when given boolean true', function () {
    assert.strictEqual(Utils.sanitizeBoolean(true), true);
  });

  it('should return false when given boolean false', function () {
    assert.strictEqual(Utils.sanitizeBoolean(false), false);
  });

});



// ============================================================================
// 5. ARRAY OPERATIONS
// ============================================================================

describe('arrayDistint', function () {

  it('should remove duplicates from [1,2,2,3,3,3,a,a]', function () {
    assert.deepStrictEqual(
      Utils.arrayDistint([1, 2, 2, 3, 3, 3, 'a', 'a']),
      [1, 2, 3, 'a']
    );
  });

  it('should return empty array when given empty array', function () {
    assert.deepStrictEqual(Utils.arrayDistint([]), []);
  });

  it('should return non-array value as-is when given string', function () {
    assert.strictEqual(Utils.arrayDistint('bad input'), 'bad input');
  });

  it('should return null as-is when given null', function () {
    assert.strictEqual(Utils.arrayDistint(null), null);
  });

});



// ============================================================================
// 6. OBJECT OPERATIONS
// ============================================================================

describe('keyValueToObject', function () {

  it('should merge key-value arrays into object', function () {
    assert.deepStrictEqual(
      Utils.keyValueToObject(['field_1', 'field_2'], ['value_1', 'value_2']),
      { field_1: 'value_1', field_2: 'value_2' }
    );
  });

  it('should create single key-value pair from strings', function () {
    assert.deepStrictEqual(
      Utils.keyValueToObject('some_key', 'some_value'),
      { some_key: 'some_value' }
    );
  });

});


describe('overrideObject', function () {

  it('should override base object with non-null keys from multiple new objects', function () {
    const base = { k1: 1, k2: 2, k3: null };
    const new1 = { k1: null, k2: 100, k4: 4 };
    const new2 = { k2: 200, k5: 5 };
    const result = Utils.overrideObject(base, new1, new2);
    assert.deepStrictEqual(result, { k1: 1, k2: 200, k3: null, k4: 4, k5: 5 });
  });

  it('should not mutate the original base object', function () {
    const base = { k1: 1 };
    Utils.overrideObject(base, { k1: 2 });
    assert.strictEqual(base.k1, 1);
  });

});


describe('setNonEmptyKey', function () {

  it('should set key when value is non-null', function () {
    const obj = {};
    Utils.setNonEmptyKey(obj, 'key1', 'something');
    assert.strictEqual(obj.key1, 'something');
  });

  it('should not set key when value is null', function () {
    const obj = {};
    Utils.setNonEmptyKey(obj, 'key2', null);
    assert.strictEqual(obj.key2, undefined);
  });

  it('should not set key when value is undefined', function () {
    const obj = {};
    Utils.setNonEmptyKey(obj, 'key3', undefined);
    assert.strictEqual(obj.key3, undefined);
  });

  it('should return the object', function () {
    const obj = {};
    const result = Utils.setNonEmptyKey(obj, 'k', 'v');
    assert.strictEqual(result, obj);
  });

});


describe('fallback', function () {

  it('should return fallback when value is null', function () {
    assert.strictEqual(Utils.fallback(null, 'old_val'), 'old_val');
  });

  it('should return new value when value is not null', function () {
    assert.strictEqual(Utils.fallback('new_val', 'old_val'), 'new_val');
  });

  it('should return null when value is null and no fallback provided', function () {
    assert.strictEqual(Utils.fallback(null), null);
  });

  it('should return zero when value is zero (not null)', function () {
    assert.strictEqual(Utils.fallback(0, 'fallback'), 0);
  });

});


describe('sanitizeObject', function () {

  const obj = { k1: 'a', k2: 10, k3: null, k5: 'b' };

  it('should return null when given non-object', function () {
    assert.strictEqual(Utils.sanitizeObject('abc', ['k1']), null);
  });

  it('should return null when given null', function () {
    assert.strictEqual(Utils.sanitizeObject(null, ['k1']), null);
  });

  it('should keep only whitelisted keys', function () {
    assert.deepStrictEqual(
      Utils.sanitizeObject(obj, ['k1']),
      { k1: 'a' }
    );
  });

  it('should remove blacklisted keys', function () {
    const result = Utils.sanitizeObject(obj, null, ['k1']);
    assert.strictEqual(result.k1, undefined);
    assert.strictEqual(result.k2, 10);
  });

  it('should not mutate the original object', function () {
    Utils.sanitizeObject(obj, ['k1']);
    assert.strictEqual(obj.k2, 10);
  });

});


describe('sanitizeArray', function () {

  const sanitize_func = function (item) {
    return Utils.sanitizeObject(item, ['k1']);
  };

  it('should return null when given null', function () {
    assert.strictEqual(Utils.sanitizeArray(null, sanitize_func), null);
  });

  it('should return null when given non-array', function () {
    assert.strictEqual(Utils.sanitizeArray('string', sanitize_func), null);
  });

  it('should sanitize each item in array using provided function', function () {
    const input = [{ k1: 'a', k2: 10 }, { k1: 'b', k2: 20 }];
    assert.deepStrictEqual(
      Utils.sanitizeArray(input, sanitize_func),
      [{ k1: 'a' }, { k1: 'b' }]
    );
  });

});


describe('sanitizeUsingRegx', function () {

  it('should remove characters matching regex', function () {
    assert.strictEqual(Utils.sanitizeUsingRegx('abc123', /[0-9]/g), 'abc');
  });

  it('should return null as-is when given null', function () {
    assert.strictEqual(Utils.sanitizeUsingRegx(null, /[0-9]/g), null);
  });

  it('should return empty string as-is', function () {
    assert.strictEqual(Utils.sanitizeUsingRegx('', /[0-9]/g), '');
  });

});



// ============================================================================
// 7. DEEP COPY AND COMPARISON
// ============================================================================

describe('deepCopyObject', function () {

  it('should create an independent copy of nested object', function () {
    const original = { a: 'abc', b: 123, d: { aa: 1, bb: { g: 1 } } };
    const copy = Utils.deepCopyObject(original);
    copy.d.aa = 'modified';
    assert.strictEqual(original.d.aa, 1);
    assert.strictEqual(copy.d.aa, 'modified');
  });

  it('should copy arrays deeply', function () {
    const original = { c: ['x', 1, ['p', 'q']] };
    const copy = Utils.deepCopyObject(original);
    copy.c[2].push('r');
    assert.strictEqual(original.c[2].length, 2);
    assert.strictEqual(copy.c[2].length, 3);
  });

  it('should copy Date objects', function () {
    const original = { e: new Date('2030-09-16T07:31:13.000Z') };
    const copy = Utils.deepCopyObject(original);
    assert.strictEqual(copy.e.getTime(), original.e.getTime());
  });

});


describe('compareObjects', function () {

  const obj_a = {
    a: 'abc', b: 123,
    c: ['x', 1, ['p', 'q', { e: 1 }], { f: '*' }],
    d: { aa: 1, bb: { g: 1, h: [1, 2, 'd'] }, cc: ['x', 'y', 'z'] },
    e: new Date('2030-09-16T07:31:13.000Z')
  };
  const obj_b = {
    a: 'abc', b: 123,
    c: ['x', 1, ['p', 'q', { e: 1 }], { f: '*' }],
    d: { aa: 1, bb: { g: 1, h: [1, 2, 'd'] }, cc: ['x', 'y', 'z'] },
    e: new Date('2030-09-16T07:31:13.000Z')
  };

  it('should return true when two identical complex objects are compared', function () {
    assert.strictEqual(Utils.compareObjects(obj_a, obj_b), true);
  });

  it('should return false when array has different length', function () {
    const obj_c = { ...obj_a, c: ['x', 1, ['p', 'q', { e: 1 }]] };
    assert.strictEqual(Utils.compareObjects(obj_a, obj_c), false);
  });

  it('should return false when nested array has missing element', function () {
    const obj_d = {
      ...obj_a,
      d: { aa: 1, bb: { g: 1, h: [1, 2, 'd'] }, cc: ['x', 'z'] }
    };
    assert.strictEqual(Utils.compareObjects(obj_a, obj_d), false);
  });

  it('should return false when Date values differ', function () {
    const obj_e = { ...obj_a, e: new Date('2030-09-17T07:31:13.000Z') };
    assert.strictEqual(Utils.compareObjects(obj_a, obj_e), false);
  });

  it('should return false when compared with null', function () {
    assert.strictEqual(Utils.compareObjects(obj_a, null), false);
  });

  it('should return true when both values are null', function () {
    assert.strictEqual(Utils.compareObjects(null, null), true);
  });

  it('should return true when both values are same primitive', function () {
    assert.strictEqual(Utils.compareObjects(42, 42), true);
  });

  it('should return false when primitives differ', function () {
    assert.strictEqual(Utils.compareObjects(42, 43), false);
  });

});



// ============================================================================
// 8. VALIDATION
// ============================================================================

describe('validateString', function () {

  it('should return true when string meets min and max length', function () {
    assert.strictEqual(Utils.validateString('hello', 1, 10), true);
  });

  it('should return false when string is shorter than min length', function () {
    assert.strictEqual(Utils.validateString('hi', 5, 10), false);
  });

  it('should return false when string is longer than max length', function () {
    assert.strictEqual(Utils.validateString('hello world', 1, 5), false);
  });

  it('should return true when null is allowed via min_length 0', function () {
    assert.strictEqual(Utils.validateString(null, 0, 10), true);
  });

  it('should return true when empty string is allowed via min_length 0', function () {
    assert.strictEqual(Utils.validateString('', 0, 10), true);
  });

  it('should return false when value is not a string type', function () {
    assert.strictEqual(Utils.validateString(123, 1, 10), false);
  });

  it('should return true when no min/max specified', function () {
    assert.strictEqual(Utils.validateString('anything'), true);
  });

});


describe('validateStringRegx', function () {

  it('should return true when string matches regex', function () {
    assert.strictEqual(Utils.validateStringRegx('abc123', /^[a-z0-9]+$/), true);
  });

  it('should return false when string does not match regex', function () {
    assert.strictEqual(Utils.validateStringRegx('abc 123', /^[a-z0-9]+$/), false);
  });

  it('should return true when null is allowed via min_length 0', function () {
    assert.strictEqual(Utils.validateStringRegx(null, /^[a-z]+$/, 0), true);
  });

  it('should return false when string is too short', function () {
    assert.strictEqual(Utils.validateStringRegx('ab', /^[a-z]+$/, 3), false);
  });

});



// ============================================================================
// 9. ABSENTEE AND INVALID KEY CHECKS
// ============================================================================

describe('absenteeKeysCheckObject', function () {

  const err = { code: 123, message: 'field missing' };
  const config = {
    k1: { error: err },
    k3: { error: err, not_null: true },
    k4: { error: err },
    k5: { error: err }
  };

  it('should return errors when required keys are missing or null', function () {
    const obj = { k1: 'a', k2: 10, k3: null, k5: 'b' };
    const result = Utils.absenteeKeysCheckObject(obj, 'ctx', config, ['k1', 'k3', 'k4']);
    assert.strictEqual(Array.isArray(result), true);
    assert.strictEqual(result.length, 2);
  });

  it('should return false when all required keys are present and valid', function () {
    const obj = { k1: 'a', k5: 'b' };
    const result = Utils.absenteeKeysCheckObject(obj, null, config, ['k1', 'k5']);
    assert.strictEqual(result, false);
  });

  it('should add dependent keys when parent key has matching value', function () {
    const obj = { k1: 'a', k2: 10, k3: null, k5: 'b' };
    const result = Utils.absenteeKeysCheckObject(obj, null, config, ['k1'], {
      k2: [{ keys: ['k5'], values: [10, 15] }]
    });
    assert.strictEqual(result, false);
  });

});


describe('invalidKeysCheckObject', function () {

  const err = { code: 123, message: 'invalid' };
  const obj = { k1: 'a', k2: 10 };

  it('should return errors when validation function returns false', function () {
    const validation_config = [
      { func: function (k1, k2) { return false; }, params: ['k1', 'k2'], error: err }
    ];
    const result = Utils.invalidKeysCheckObject(obj, 'ctx', validation_config);
    assert.strictEqual(Array.isArray(result), true);
    assert.strictEqual(result.length, 1);
  });

  it('should return false when all validations pass', function () {
    const validation_config = [
      { func: function (k1) { return k1 === 'a'; }, params: ['k1'], error: err },
      { func: function (k2) { return k2 === 10; }, params: ['k2'], error: err }
    ];
    const result = Utils.invalidKeysCheckObject(obj, null, validation_config);
    assert.strictEqual(result, false);
  });

  it('should support invalidation functions for nested objects', function () {
    const inner_config = [
      { func: function (k1) { return k1 === 'a'; }, params: ['k1'], error: err }
    ];
    const deep_obj = { obj_data: obj };
    const invalidation_config = [
      {
        func: function (inner) { return Utils.invalidKeysCheckObject(inner, null, inner_config); },
        params: ['obj_data']
      }
    ];
    const result = Utils.invalidKeysCheckObject(deep_obj, 'ctx', null, invalidation_config);
    assert.strictEqual(result, false);
  });

});



// ============================================================================
// 10. URL OPERATIONS
// ============================================================================

describe('disjoinUrl', function () {

  it('should extract all parts from full URL with port and query', function () {
    const result = Utils.disjoinUrl('https://subdomain.example.com:8080/abc/pqr/query?param1=apple');
    assert.strictEqual(result.protocol, 'https:');
    assert.strictEqual(result.hostname, 'subdomain.example.com');
    assert.strictEqual(result.port, '8080');
    assert.strictEqual(result.pathname, '/abc/pqr/query');
    assert.strictEqual(result.search, '?param1=apple');
  });

  it('should extract username and password from URL', function () {
    const result = Utils.disjoinUrl('https://user:pass@example.com/abc');
    assert.strictEqual(result.username, 'user');
    assert.strictEqual(result.password, 'pass');
  });

  it('should extract hash fragment from URL', function () {
    const result = Utils.disjoinUrl('https://example.com/abc#section1');
    assert.strictEqual(result.hash, '#section1');
  });

  it('should return false when given invalid URL', function () {
    assert.strictEqual(Utils.disjoinUrl('I am invalid url'), false);
  });

});


describe('disjoinPathname', function () {

  it('should extract route and values from pathname', function () {
    const result = Utils.disjoinPathname('/abc/pqr/query?param1=apple');
    assert.strictEqual(result.route, 'abc');
    assert.deepStrictEqual(result.values, ['pqr', 'query']);
  });

  it('should return null route when given empty string', function () {
    const result = Utils.disjoinPathname('');
    assert.strictEqual(result.route, null);
    assert.deepStrictEqual(result.values, []);
  });

  it('should handle multiple consecutive slashes', function () {
    const result = Utils.disjoinPathname('//abc/pqr////query?param1=apple');
    assert.strictEqual(result.route, 'abc');
    assert.deepStrictEqual(result.values, ['pqr', 'query']);
  });

});



// ============================================================================
// 11. CSV OPERATIONS
// ============================================================================

describe('convertCsvToData', function () {

  it('should convert CSV string with header to array of objects', function () {
    const csv = 'phone,full_name\n+919999999991,John Doe\n+919999999992,';
    const result = Utils.convertCsvToData(csv);
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].phone, '+919999999991');
    assert.strictEqual(result[0].full_name, 'John Doe');
  });

  it('should return empty array when CSV has only header', function () {
    assert.deepStrictEqual(Utils.convertCsvToData('phone,name'), []);
  });

  it('should return empty array when CSV is empty', function () {
    assert.deepStrictEqual(Utils.convertCsvToData(''), []);
  });

  it('should trim whitespace in values', function () {
    const csv = 'phone,name\n+91999,  Mike';
    const result = Utils.convertCsvToData(csv);
    assert.strictEqual(result[0].name, 'Mike');
  });

});


describe('convertDataToCsv', function () {

  it('should convert array of objects to CSV string', function () {
    const data = [
      { phone: '+919999999991', full_name: 'John Doe' },
      { phone: '+919999999992', full_name: undefined }
    ];
    const result = Utils.convertDataToCsv(data);
    assert.strictEqual(result.startsWith('phone,full_name'), true);
    assert.strictEqual(result.includes('+919999999991,John Doe'), true);
    assert.strictEqual(result.includes('+919999999992,'), true);
  });

  it('should return empty string when given empty array', function () {
    assert.strictEqual(Utils.convertDataToCsv([]), '');
  });

});


describe('convertDataToCsv2', function () {

  it('should convert data to CSV using explicit field list', function () {
    const fields = ['phone', 'full_name'];
    const data = [
      { phone: '+919999999991', full_name: 'John Doe' },
      { phone: '+919999999992', full_name: undefined }
    ];
    const result = Utils.convertDataToCsv2(fields, data);
    assert.strictEqual(result.startsWith('phone,full_name'), true);
    assert.strictEqual(result.includes('+919999999991,John Doe'), true);
  });

  it('should return empty string when given empty data array', function () {
    assert.strictEqual(Utils.convertDataToCsv2(['a'], []), '');
  });

});



// ============================================================================
// 12. MISCELLANEOUS
// ============================================================================

describe('moduleAvailable', function () {

  it('should return true when module fs exists', function () {
    assert.strictEqual(Utils.moduleAvailable('fs'), true);
  });

  it('should return false when module fake does not exist', function () {
    assert.strictEqual(Utils.moduleAvailable('fake'), false);
  });

});


describe('generateRandomString', function () {

  it('should generate string of requested length 10', function () {
    const result = Utils.generateRandomString(10);
    assert.strictEqual(result.length, 10);
    assert.strictEqual(typeof result, 'string');
  });

  it('should generate string of length 1', function () {
    assert.strictEqual(Utils.generateRandomString(1).length, 1);
  });

  it('should contain only alphanumeric characters', function () {
    const result = Utils.generateRandomString(100);
    assert.strictEqual(/^[A-Za-z0-9]+$/.test(result), true);
  });

});


describe('getUnixTime', function () {

  it('should return current time as integer in seconds', function () {
    const result = Utils.getUnixTime();
    assert.strictEqual(Utils.isNumber(result), true);
    assert.strictEqual(Utils.isInteger(result), true);
  });

  it('should return unix timestamp for specific date', function () {
    const result = Utils.getUnixTime('2030-01-01T00:00:00.000Z');
    assert.strictEqual(result, 1893456000);
  });

});
