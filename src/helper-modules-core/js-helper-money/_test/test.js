// Tests for js-helper-money
// Covers all exported functions with automated assertions
'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

// Load dependencies via loader (DI pattern)
const loader = require('./loader');
const { Lib } = loader();
const Money = Lib.Money;



// ============================================================================
// 1. CURRENCY METADATA
// ============================================================================

describe('isCurrencyCode', function () {

  it('should return true for known lowercase codes', function () {

    assert.strictEqual(Money.isCurrencyCode('usd'), true);
    assert.strictEqual(Money.isCurrencyCode('inr'), true);
    assert.strictEqual(Money.isCurrencyCode('eur'), true);
    assert.strictEqual(Money.isCurrencyCode('sar'), true);
    assert.strictEqual(Money.isCurrencyCode('thb'), true);
    assert.strictEqual(Money.isCurrencyCode('cny'), true);
    assert.strictEqual(Money.isCurrencyCode('aed'), true);

  });


  it('should return true for known uppercase codes (case-insensitive)', function () {

    assert.strictEqual(Money.isCurrencyCode('USD'), true);
    assert.strictEqual(Money.isCurrencyCode('INR'), true);
    assert.strictEqual(Money.isCurrencyCode('EUR'), true);

  });


  it('should return false for unknown codes', function () {

    assert.strictEqual(Money.isCurrencyCode('xyz'), false);
    assert.strictEqual(Money.isCurrencyCode('abc'), false);

  });


  it('should return false for empty, null, or undefined', function () {

    assert.strictEqual(Money.isCurrencyCode(''), false);
    assert.strictEqual(Money.isCurrencyCode(null), false);
    assert.strictEqual(Money.isCurrencyCode(undefined), false);

  });

});



describe('getCurrencySymbol', function () {

  it('should return native symbols for known currencies', function () {

    assert.strictEqual(Money.getCurrencySymbol('inr'), '₹');
    assert.strictEqual(Money.getCurrencySymbol('usd'), '$');
    assert.strictEqual(Money.getCurrencySymbol('eur'), '€');
    assert.strictEqual(Money.getCurrencySymbol('cny'), '¥');
    assert.strictEqual(Money.getCurrencySymbol('thb'), '฿');

  });


  it('should return symbol for uppercase codes (case-insensitive)', function () {

    assert.strictEqual(Money.getCurrencySymbol('USD'), '$');
    assert.strictEqual(Money.getCurrencySymbol('INR'), '₹');

  });


  it('should return null for unknown currency', function () {

    assert.strictEqual(Money.getCurrencySymbol('xyz'), null);

  });

});



describe('getCurrencySymbolForLocale', function () {

  it('should return native symbol when country/language supports currency', function () {

    assert.strictEqual(Money.getCurrencySymbolForLocale('inr', 'in', 'hi_in'), '₹');
    assert.strictEqual(Money.getCurrencySymbolForLocale('usd', 'us', 'en_us'), '$');
    assert.strictEqual(Money.getCurrencySymbolForLocale('thb', 'th', 'th_th'), '฿');

  });


  it('should return standard symbol when country/language does not support', function () {

    assert.strictEqual(Money.getCurrencySymbolForLocale('inr', 'us', 'en_us'), 'INR');
    assert.strictEqual(Money.getCurrencySymbolForLocale('usd', 'in', 'hi_in'), 'USD');

  });


  it('should return standard for unknown country', function () {

    assert.strictEqual(Money.getCurrencySymbolForLocale('inr', 'zz', 'en_us'), 'INR');

  });


  it('should return null for unknown currency', function () {

    assert.strictEqual(Money.getCurrencySymbolForLocale('xyz', 'in', 'hi_in'), null);

  });

});



describe('getCurrencySymbolMinor', function () {

  it('should return native minor symbols where defined', function () {

    assert.strictEqual(Money.getCurrencySymbolMinor('usd'), '¢');
    assert.strictEqual(Money.getCurrencySymbolMinor('thb'), 'ส');

  });


  it('should return null where native minor symbol is not defined', function () {

    assert.strictEqual(Money.getCurrencySymbolMinor('inr'), null);
    assert.strictEqual(Money.getCurrencySymbolMinor('eur'), null);
    assert.strictEqual(Money.getCurrencySymbolMinor('sar'), null);

  });


  it('should return null for unknown currency', function () {

    assert.strictEqual(Money.getCurrencySymbolMinor('xyz'), null);

  });

});



describe('getCurrencySymbolMinorForLocale', function () {

  it('should return native minor symbol when country/language supports', function () {

    assert.strictEqual(Money.getCurrencySymbolMinorForLocale('usd', 'us', 'en_us'), '¢');

  });


  it('should return standard symbol when locale does not support', function () {

    assert.strictEqual(Money.getCurrencySymbolMinorForLocale('usd', 'in', 'hi_in'), 'USD');

  });


  it('should handle null native minor gracefully', function () {

    assert.strictEqual(Money.getCurrencySymbolMinorForLocale('inr', 'in', 'hi_in'), null);

  });

});



describe('getCurrencyDecimals', function () {

  it('should return 2 for all supported currencies', function () {

    assert.strictEqual(Money.getCurrencyDecimals('usd'), 2);
    assert.strictEqual(Money.getCurrencyDecimals('inr'), 2);
    assert.strictEqual(Money.getCurrencyDecimals('eur'), 2);
    assert.strictEqual(Money.getCurrencyDecimals('cny'), 2);
    assert.strictEqual(Money.getCurrencyDecimals('thb'), 2);

  });


  it('should return null for unknown currency', function () {

    assert.strictEqual(Money.getCurrencyDecimals('xyz'), null);

  });

});



describe('getCurrencyMinTransactionalUnit', function () {

  it('should return correct min transactional unit per currency', function () {

    assert.strictEqual(Money.getCurrencyMinTransactionalUnit('inr'), 1);
    assert.strictEqual(Money.getCurrencyMinTransactionalUnit('cny'), 1);
    assert.strictEqual(Money.getCurrencyMinTransactionalUnit('usd'), 0.01);
    assert.strictEqual(Money.getCurrencyMinTransactionalUnit('eur'), 0.01);
    assert.strictEqual(Money.getCurrencyMinTransactionalUnit('sar'), 0.01);
    assert.strictEqual(Money.getCurrencyMinTransactionalUnit('thb'), 0.01);
    assert.strictEqual(Money.getCurrencyMinTransactionalUnit('aed'), 0.01);

  });


  it('should return null for unknown currency', function () {

    assert.strictEqual(Money.getCurrencyMinTransactionalUnit('xyz'), null);

  });

});



describe('getCurrencyDenominations', function () {

  it('should return denominations object for currencies that have them', function () {

    const usd_denoms = Money.getCurrencyDenominations('usd');
    assert.ok(usd_denoms);
    assert.ok(Array.isArray(usd_denoms['minor']));
    assert.ok(Array.isArray(usd_denoms['major']));
    assert.ok(usd_denoms['minor'].includes('1'));
    assert.ok(usd_denoms['major'].includes('1'));

    const inr_denoms = Money.getCurrencyDenominations('inr');
    assert.ok(inr_denoms);
    assert.ok(inr_denoms['minor'].includes('50'));
    assert.ok(inr_denoms['major'].includes('500'));

  });


  it('should return null for currencies without denominations (cny)', function () {

    assert.strictEqual(Money.getCurrencyDenominations('cny'), null);

  });


  it('should return null for unknown currency', function () {

    assert.strictEqual(Money.getCurrencyDenominations('xyz'), null);

  });

});



// ============================================================================
// 2. ROUNDING AND FORMATTING
// ============================================================================

describe('roundAmount', function () {

  it('should round to currency-specific decimals', function () {

    assert.strictEqual(Money.roundAmount(15.678, 'usd'), 15.68);
    assert.strictEqual(Money.roundAmount(15.678, 'inr'), 15.68);

  });


  it('should respect decimals override', function () {

    assert.strictEqual(Money.roundAmount(15.678, 'usd', 1), 15.7);
    assert.strictEqual(Money.roundAmount(15.678, 'usd', 0), 16);

  });


  it('should handle edge cases', function () {

    assert.strictEqual(Money.roundAmount(10.005, 'usd'), 10.01);
    assert.strictEqual(Money.roundAmount(10.004, 'usd'), 10);

  });

});



describe('formatAmount', function () {

  it('should format with trailing zeros by default', function () {

    assert.strictEqual(Money.formatAmount(10, 'usd'), '10.00');
    assert.strictEqual(Money.formatAmount(10.5, 'usd'), '10.50');
    assert.strictEqual(Money.formatAmount(15.678, 'usd'), '15.68');

  });


  it('should respect no_pad=true for whole numbers', function () {

    assert.strictEqual(Money.formatAmount(10, 'usd', null, true), '10');

  });


  it('should keep decimals with no_pad=true for non-integers', function () {

    assert.strictEqual(Money.formatAmount(10.6, 'usd', null, true), '10.60');
    assert.strictEqual(Money.formatAmount(15.678, 'usd', null, true), '15.68');

  });


  it('should respect decimals override', function () {

    assert.strictEqual(Money.formatAmount(15.678, 'usd', 1), '15.7');
    assert.strictEqual(Money.formatAmount(15.678, 'usd', 0), '16');

  });

});



// ============================================================================
// 3. TRANSACTIONAL AMOUNTS
// ============================================================================

describe('getTransactionalAmount', function () {

  it('should round to min transactional unit when apply_min_unit=true (INR)', function () {

    assert.strictEqual(Money.getTransactionalAmount(15.20, 'inr', null, true), 15);
    assert.strictEqual(Money.getTransactionalAmount(15.68, 'inr', null, true), 16);
    assert.strictEqual(Money.getTransactionalAmount(15.49, 'inr', null, true), 15);
    assert.strictEqual(Money.getTransactionalAmount(15.50, 'inr', null, true), 16);

  });


  it('should round to min transactional unit when apply_min_unit=true (USD)', function () {

    assert.strictEqual(Money.getTransactionalAmount(20.66666667, 'usd', null, true), 20.67);
    assert.strictEqual(Money.getTransactionalAmount(18.35, 'usd', null, true), 18.35);
    assert.strictEqual(Money.getTransactionalAmount(40.88, 'usd', null, true), 40.88);

  });


  it('should apply standard rounding when apply_min_unit=false', function () {

    assert.strictEqual(Money.getTransactionalAmount(15.68, 'inr', null, false), 15.68);
    assert.strictEqual(Money.getTransactionalAmount(20.666, 'usd', null, false), 20.67);

  });

});



describe('toFractionalUnits', function () {

  it('should convert USD amounts to cents correctly', function () {

    assert.strictEqual(Money.toFractionalUnits(10.57, 'usd'), 1057);
    assert.strictEqual(Money.toFractionalUnits(18.35, 'usd'), 1835);
    assert.strictEqual(Money.toFractionalUnits(40.88, 'usd'), 4088);
    assert.strictEqual(Money.toFractionalUnits(35, 'usd'), 3500);
    assert.strictEqual(Money.toFractionalUnits(24.4, 'usd'), 2440);

  });


  it('should handle floating-point edge cases', function () {

    // The classic 0.1 + 0.2 problem: 0.3 should be 30 cents
    assert.strictEqual(Money.toFractionalUnits(0.3, 'usd'), 30);

  });


  it('should handle INR amounts (paise)', function () {

    // 15.68 INR rounds to 16 INR (min_unit=1), then 16 * 100 paise = 1600
    assert.strictEqual(Money.toFractionalUnits(15.68, 'inr'), 1600);
    // 100 INR = 100 * 100 paise = 10000
    assert.strictEqual(Money.toFractionalUnits(100, 'inr'), 10000);

  });

});



describe('fromFractionalUnits', function () {

  it('should convert cents to USD amounts', function () {

    assert.strictEqual(Money.fromFractionalUnits(1057, 'usd'), 10.57);
    assert.strictEqual(Money.fromFractionalUnits(1835, 'usd'), 18.35);
    assert.strictEqual(Money.fromFractionalUnits(4088, 'usd'), 40.88);

  });


  it('should convert INR paise to rupees', function () {

    assert.strictEqual(Money.fromFractionalUnits(100, 'inr'), 1);
    assert.strictEqual(Money.fromFractionalUnits(50, 'inr'), 0.5);

  });

});



// ============================================================================
// 4. AGGREGATION (FLOAT-SAFE)
// ============================================================================

describe('sum', function () {

  it('should sum without floating-point errors', function () {

    // The classic 0.1 + 0.2 = 0.3 case
    assert.strictEqual(Money.sum([0.1, 0.2], 'usd'), 0.3);

    // Multiple values
    assert.strictEqual(Money.sum([0.1, 0.1, 0.1], 'usd'), 0.3);

  });


  it('should sum larger amounts correctly', function () {

    assert.strictEqual(Money.sum([10.10, 20.20, 30.30], 'usd'), 60.6);
    assert.strictEqual(Money.sum([100, 200, 300], 'usd'), 600);

  });


  it('should handle empty array', function () {

    assert.strictEqual(Money.sum([], 'usd'), 0);

  });


  it('should handle single value', function () {

    assert.strictEqual(Money.sum([100], 'usd'), 100);

  });


  it('should respect decimals override', function () {

    assert.strictEqual(Money.sum([1.111, 2.222], 'usd', 1), 3.3);

  });

});



describe('calculateTotalFromDenominations', function () {

  it('should calculate total from major denominations only', function () {

    const majors = [{ value: 100, count: 2 }];
    assert.strictEqual(Money.calculateTotalFromDenominations(majors, null, 'usd'), 200);

  });


  it('should calculate total from minor denominations only', function () {

    // 3 quarters = 75 cents = $0.75
    const minors = [{ value: 25, count: 3 }];
    assert.strictEqual(Money.calculateTotalFromDenominations(null, minors, 'usd'), 0.75);

  });


  it('should calculate total from both majors and minors', function () {

    // 1 x $100 + 2 x 25¢ = $100.50
    const majors = [{ value: 100, count: 1 }];
    const minors = [{ value: 25, count: 2 }];
    assert.strictEqual(Money.calculateTotalFromDenominations(majors, minors, 'usd'), 100.5);

  });


  it('should return 0 for empty inputs', function () {

    assert.strictEqual(Money.calculateTotalFromDenominations(null, null, 'usd'), 0);
    assert.strictEqual(Money.calculateTotalFromDenominations([], [], 'usd'), 0);

  });


  it('should apply min transactional unit when apply_min_unit=true', function () {

    // INR with 15.49 should round to 15 when apply_min_unit
    const majors = [{ value: 15, count: 1 }];
    const minors = [{ value: 49, count: 1 }];  // 49 paise
    assert.strictEqual(
      Money.calculateTotalFromDenominations(majors, minors, 'inr', null, true),
      15  // rounds to whole rupee
    );

  });

});



// ============================================================================
// 5. NEW CURRENCY COVERAGE (Extended currencies)
// ============================================================================

describe('Extended currencies', function () {

  it('should recognize all new currency codes', function () {

    assert.strictEqual(Money.isCurrencyCode('cad'), true);
    assert.strictEqual(Money.isCurrencyCode('gbp'), true);
    assert.strictEqual(Money.isCurrencyCode('jpy'), true);
    assert.strictEqual(Money.isCurrencyCode('aud'), true);
    assert.strictEqual(Money.isCurrencyCode('mxn'), true);
    assert.strictEqual(Money.isCurrencyCode('brl'), true);
    assert.strictEqual(Money.isCurrencyCode('kwd'), true);
    assert.strictEqual(Money.isCurrencyCode('qar'), true);
    assert.strictEqual(Money.isCurrencyCode('bhd'), true);
    assert.strictEqual(Money.isCurrencyCode('omr'), true);
    assert.strictEqual(Money.isCurrencyCode('sgd'), true);

  });


  it('should return correct symbols for new currencies', function () {

    assert.strictEqual(Money.getCurrencySymbol('cad'), '$');
    assert.strictEqual(Money.getCurrencySymbol('gbp'), '£');
    assert.strictEqual(Money.getCurrencySymbol('jpy'), '¥');
    assert.strictEqual(Money.getCurrencySymbol('aud'), '$');
    assert.strictEqual(Money.getCurrencySymbol('mxn'), '$');
    assert.strictEqual(Money.getCurrencySymbol('brl'), 'R$');
    assert.strictEqual(Money.getCurrencySymbol('kwd'), 'د.ك');
    assert.strictEqual(Money.getCurrencySymbol('sgd'), '$');

  });


  it('should handle JPY with 0 decimals', function () {

    assert.strictEqual(Money.getCurrencyDecimals('jpy'), 0);
    assert.strictEqual(Money.getCurrencyMinTransactionalUnit('jpy'), 1);
    assert.strictEqual(Money.roundAmount(123.7, 'jpy'), 124);
    assert.strictEqual(Money.formatAmount(1000, 'jpy'), '1000');

  });


  it('should handle Gulf currencies with 3 decimals', function () {

    assert.strictEqual(Money.getCurrencyDecimals('kwd'), 3);
    assert.strictEqual(Money.getCurrencyDecimals('bhd'), 3);
    assert.strictEqual(Money.getCurrencyDecimals('omr'), 3);
    assert.strictEqual(Money.getCurrencyMinTransactionalUnit('kwd'), 0.001);
    assert.strictEqual(Money.getCurrencyMinTransactionalUnit('bhd'), 0.001);
    assert.strictEqual(Money.getCurrencyMinTransactionalUnit('omr'), 0.001);

  });


  it('should round correctly for 3-decimal currencies', function () {

    assert.strictEqual(Money.roundAmount(10.1234, 'kwd'), 10.123);
    assert.strictEqual(Money.roundAmount(10.1236, 'kwd'), 10.124);
    assert.strictEqual(Money.roundAmount(5.5555, 'bhd'), 5.556);

  });

});



// ============================================================================
// 6. VALIDATION AND NEW FUNCTIONS
// ============================================================================

describe('Validation and new functions', function () {

  it('sanitizeCurrencyCode should normalize and clean codes', function () {

    assert.strictEqual(Money.sanitizeCurrencyCode('USD'), 'usd');
    assert.strictEqual(Money.sanitizeCurrencyCode('inr'), 'inr');
    assert.strictEqual(Money.sanitizeCurrencyCode(' Usd '), 'usd');
    assert.strictEqual(Money.sanitizeCurrencyCode('U$S$D'), 'usd');
    assert.strictEqual(Money.sanitizeCurrencyCode('us'), null);  // too short
    assert.strictEqual(Money.sanitizeCurrencyCode('usds'), null);  // too long
    assert.strictEqual(Money.sanitizeCurrencyCode(null), null);
    assert.strictEqual(Money.sanitizeCurrencyCode(123), null);

  });


  it('validateCurrencyCode should return false for valid codes', function () {

    assert.strictEqual(Money.validateCurrencyCode('usd'), false);
    assert.strictEqual(Money.validateCurrencyCode('USD'), false);
    assert.strictEqual(Money.validateCurrencyCode('inr'), false);

  });


  it('validateCurrencyCode should return errors for invalid codes', function () {

    const nullErrors = Money.validateCurrencyCode(null);
    assert.strictEqual(Array.isArray(nullErrors), true);
    assert.strictEqual(nullErrors[0].type, 'MONEY_CURRENCY_CODE_REQUIRED');

    const typeErrors = Money.validateCurrencyCode(123);
    assert.strictEqual(Array.isArray(typeErrors), true);
    assert.strictEqual(typeErrors[0].type, 'MONEY_CURRENCY_CODE_TYPE');

    const lengthErrors = Money.validateCurrencyCode('us');
    assert.strictEqual(Array.isArray(lengthErrors), true);
    assert.strictEqual(lengthErrors[0].type, 'MONEY_CURRENCY_CODE_LENGTH');

    const formatErrors = Money.validateCurrencyCode('u$d');
    assert.strictEqual(Array.isArray(formatErrors), true);
    assert.strictEqual(formatErrors[0].type, 'MONEY_CURRENCY_CODE_FORMAT');

    const unknownErrors = Money.validateCurrencyCode('xyz');
    assert.strictEqual(Array.isArray(unknownErrors), true);
    assert.strictEqual(unknownErrors[0].type, 'MONEY_CURRENCY_CODE_UNKNOWN');

  });


  it('getCurrencyName should return English names', function () {

    assert.strictEqual(Money.getCurrencyName('usd'), 'United States Dollar');
    assert.strictEqual(Money.getCurrencyName('inr'), 'Indian Rupee');

  });


  it('getCurrencyIsoAlpha should return uppercase codes', function () {

    assert.strictEqual(Money.getCurrencyIsoAlpha('usd'), 'USD');
    assert.strictEqual(Money.getCurrencyIsoAlpha('INR'), 'INR');

  });


  it('getCurrencyIsoNumeric should return zero-padded numeric codes', function () {

    assert.strictEqual(Money.getCurrencyIsoNumeric('usd'), '840');
    assert.strictEqual(Money.getCurrencyIsoNumeric('aud'), '036');

  });


  it('should throw TypeError for null/undefined currency_code in arithmetic functions', function () {

    assert.throws(function () {
      Money.roundAmount(10, null);
    }, /currency_code is required/);

    assert.throws(function () {
      Money.formatAmount(10, undefined);
    }, /currency_code is required/);

    assert.throws(function () {
      Money.sum([1, 2], null);
    }, /currency_code is required/);

  });


  it('should throw TypeError for non-string currency_code', function () {

    assert.throws(function () {
      Money.roundAmount(10, 123);
    }, /currency_code must be a string/);

    assert.throws(function () {
      Money.getCurrencySymbol({});
    }, /currency_code must be a string/);

  });


  it('should throw TypeError for unknown currency_code', function () {

    assert.throws(function () {
      Money.roundAmount(10, 'xyz');
    }, /unknown currency_code/);

    assert.throws(function () {
      Money.sum([1, 2], 'abc');
    }, /unknown currency_code/);

    assert.throws(function () {
      Money.getCurrencySymbol('xyz');
    }, /unknown currency_code/);

    assert.throws(function () {
      Money.getCurrencyDecimals('xyz');
    }, /unknown currency_code/);

    assert.throws(function () {
      Money.getCurrencyName('xyz');
    }, /unknown currency_code/);

  });




  it('should throw TypeError for non-number amounts', function () {

    assert.throws(function () {
      Money.roundAmount('10', 'usd');
    }, /amount must be a finite number/);

    assert.throws(function () {
      Money.roundAmount(NaN, 'usd');
    }, /amount must be a finite number/);

    assert.throws(function () {
      Money.roundAmount(Infinity, 'usd');
    }, /amount must be a finite number/);

  });

});
