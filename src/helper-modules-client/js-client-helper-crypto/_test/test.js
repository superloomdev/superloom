// Tests for js-client-helper-crypto
// Covers all exported functions with automated assertions
'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

// Load dependencies via loader (DI pattern)
const loader = require('./loader');
const { Lib } = loader();
const Crypto = Lib.Crypto;



// ============================================================================
// 1. RANDOM STRING GENERATION
// ============================================================================

describe('generateRandomString', function () {

  it('should return empty string when charset is missing', function () {

    assert.strictEqual(Crypto.generateRandomString('', 8), '');

  });


  it('should return empty string when length is missing', function () {

    assert.strictEqual(Crypto.generateRandomString('abc'), '');

  });


  it('should return empty string when length is zero', function () {

    assert.strictEqual(Crypto.generateRandomString('abc', 0), '');

  });


  it('should return string with requested length', function () {

    assert.strictEqual(Crypto.generateRandomString('abc123', 16).length, 16);

  });


  it('should return only characters from charset', function () {

    const charset = 'abc123';
    const result = Crypto.generateRandomString(charset, 64);

    for (var i = 0; i < result.length; i++) {
      assert.ok(charset.includes(result[i]));
    }

  });


  it('should generate different strings on each call', function () {

    const result1 = Crypto.generateRandomString('0123456789abcdef', 32);
    const result2 = Crypto.generateRandomString('0123456789abcdef', 32);

    assert.notStrictEqual(result1, result2);

  });

});



// ============================================================================
// 2. UUID GENERATION
// ============================================================================

describe('generateUUID', function () {

  it('should return UUIDv4 format', function () {

    const uuid = Crypto.generateUUID();
    const uuid_regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

    assert.ok(uuid_regex.test(uuid));

  });


  it('should return 36-character string', function () {

    assert.strictEqual(Crypto.generateUUID().length, 36);

  });


  it('should return different values on multiple calls', function () {

    const uuid_1 = Crypto.generateUUID();
    const uuid_2 = Crypto.generateUUID();

    assert.notStrictEqual(uuid_1, uuid_2);

  });

});



describe('generateCompactUUID', function () {

  it('should return 25-character string', function () {

    assert.strictEqual(Crypto.generateCompactUUID().length, 25);

  });


  it('should return base36-only characters', function () {

    const result = Crypto.generateCompactUUID();

    assert.ok(/^[0-9a-z]+$/.test(result));

  });


  it('should return different values on multiple calls', function () {

    const uuid_1 = Crypto.generateCompactUUID();
    const uuid_2 = Crypto.generateCompactUUID();

    assert.notStrictEqual(uuid_1, uuid_2);

  });

});



// ============================================================================
// 3. BASE64 ENCODING/DECODING
// ============================================================================

describe('stringToBase64', function () {

  it('should return known base64 for ASCII string', function () {

    assert.strictEqual(Crypto.stringToBase64('Hello'), 'SGVsbG8=');

  });


  it('should encode empty string', function () {

    assert.strictEqual(Crypto.stringToBase64(''), '');

  });


  it('should round-trip unicode strings with base64ToString', function () {

    const original = '日本語テスト 🎉';
    const encoded = Crypto.stringToBase64(original);

    assert.strictEqual(Crypto.base64ToString(encoded), original);

  });

});



describe('base64ToString', function () {

  it('should decode known base64 string', function () {

    assert.strictEqual(Crypto.base64ToString('SGVsbG8='), 'Hello');

  });


  it('should decode unicode data encoded by stringToBase64', function () {

    const original = '¡Hola! Привет!';

    assert.strictEqual(Crypto.base64ToString(Crypto.stringToBase64(original)), original);

  });

});



// ============================================================================
// 4. URL-SAFE BASE64
// ============================================================================

describe('urlEncodeBase64', function () {

  it('should replace + with - and / with _ and remove =', function () {

    assert.strictEqual(Crypto.urlEncodeBase64('ab+cd/ef=='), 'ab-cd_ef');

  });


  it('should handle standard base64 with no special chars', function () {

    assert.strictEqual(Crypto.urlEncodeBase64('SGVsbG8'), 'SGVsbG8');

  });

});



describe('urlDecodeBase64', function () {

  it('should reverse URL-safe base64 encoding', function () {

    const original = 'SGVsbG8gV29ybGQ=';
    const encoded = Crypto.urlEncodeBase64(original);

    assert.strictEqual(Crypto.urlDecodeBase64(encoded), original);

  });


  it('should return null when input is null', function () {

    assert.strictEqual(Crypto.urlDecodeBase64(null), null);

  });


  it('should return empty string when input is empty', function () {

    assert.strictEqual(Crypto.urlDecodeBase64(''), '');

  });

});
