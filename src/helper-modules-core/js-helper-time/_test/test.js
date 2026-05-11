// Tests for js-helper-time
// Covers all exported functions with automated assertions
'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

// Load dependencies via loader (DI pattern)
const loader = require('./loader');
const { Lib } = loader();
const Time = Lib.Time;



// ============================================================================
// 1. DAY AND TIME CALCULATIONS
// ============================================================================

describe('dayName', function () {

  it('should return monday when date is 2024-01-01', function () {

    assert.strictEqual(Time.dayName(2024, 1, 1), 'monday');

  });


  it('should return sunday when date is 2024-01-07', function () {

    assert.strictEqual(Time.dayName(2024, 1, 7), 'sunday');

  });


  it('should return saturday when date is 2024-01-06', function () {

    assert.strictEqual(Time.dayName(2024, 1, 6), 'saturday');

  });


  it('should return wednesday when date is 2024-07-17', function () {

    assert.strictEqual(Time.dayName(2024, 7, 17), 'wednesday');

  });


  it('should handle string inputs for year, month, day', function () {

    assert.strictEqual(Time.dayName('2024', '1', '1'), 'monday');

  });

});



describe('epochDay', function () {

  it('should return 0 when time is midnight (0, 0, 0)', function () {

    assert.strictEqual(Time.epochDay(0, 0, 0), 0);

  });


  it('should return 3600 when time is 1 hour past midnight', function () {

    assert.strictEqual(Time.epochDay(1, 0, 0), 3600);

  });


  it('should return 86399 when time is 23:59:59', function () {

    assert.strictEqual(Time.epochDay(23, 59, 59), 86399);

  });


  it('should handle string inputs', function () {

    assert.strictEqual(Time.epochDay('2', '30', '0'), 9000);

  });


  it('should return 0 when called with no arguments', function () {

    assert.strictEqual(Time.epochDay(), 0);

  });

});



describe('reverseEpochDay', function () {

  it('should return [0, 0, 0] when input is 0', function () {

    assert.deepStrictEqual(Time.reverseEpochDay(0), [0, 0, 0]);

  });


  it('should return [1, 1, 1] when input is 3661', function () {

    assert.deepStrictEqual(Time.reverseEpochDay(3661), [1, 1, 1]);

  });


  it('should return [23, 59, 59] when input is 86399', function () {

    assert.deepStrictEqual(Time.reverseEpochDay(86399), [23, 59, 59]);

  });


  it('should return [12, 0, 0] when input is 43200 (noon)', function () {

    assert.deepStrictEqual(Time.reverseEpochDay(43200), [12, 0, 0]);

  });

});



describe('time24ToSeconds', function () {

  it('should return 0 when input is 0000', function () {

    assert.strictEqual(Time.time24ToSeconds('0000'), 0);

  });


  it('should return 84600 when input is 2330', function () {

    assert.strictEqual(Time.time24ToSeconds('2330'), 84600);

  });


  it('should return 3600 when input is 0100', function () {

    assert.strictEqual(Time.time24ToSeconds('0100'), 3600);

  });


  it('should return 43200 when input is 1200 (noon)', function () {

    assert.strictEqual(Time.time24ToSeconds('1200'), 43200);

  });

});



// ============================================================================
// 2. TIME FORMATTING
// ============================================================================

describe('formatHourMinTo12HourTime', function () {

  it('should return 12:00 AM when hours is 0 (midnight)', function () {

    assert.strictEqual(Time.formatHourMinTo12HourTime(0, 0), '12:00 AM');

  });


  it('should return 12:00 PM when hours is 12 (noon)', function () {

    assert.strictEqual(Time.formatHourMinTo12HourTime(12, 0), '12:00 PM');

  });


  it('should return 1:05 PM when hours is 13 and minutes is 5', function () {

    assert.strictEqual(Time.formatHourMinTo12HourTime(13, 5), '1:05 PM');

  });


  it('should return 9:30 AM when hours is 9 and minutes is 30', function () {

    assert.strictEqual(Time.formatHourMinTo12HourTime(9, 30), '9:30 AM');

  });


  it('should return 12:00 AM when hours is 24', function () {

    assert.strictEqual(Time.formatHourMinTo12HourTime(24, 0), '12:00 AM');

  });


  it('should pad single-digit minutes with leading zero', function () {

    assert.strictEqual(Time.formatHourMinTo12HourTime(3, 5), '3:05 AM');

  });


  it('should return 11:59 PM when hours is 23 and minutes is 59', function () {

    assert.strictEqual(Time.formatHourMinTo12HourTime(23, 59), '11:59 PM');

  });

});



describe('secondsToTimeString', function () {

  it('should return empty string when input is null', function () {

    assert.strictEqual(Time.secondsToTimeString(null), '');

  });


  it('should return empty string when input is undefined', function () {

    assert.strictEqual(Time.secondsToTimeString(undefined), '');

  });


  it('should return empty string when input is empty string', function () {

    assert.strictEqual(Time.secondsToTimeString(''), '');

  });


  it('should return 12:00 AM when input is 0 (midnight epoch)', function () {

    assert.strictEqual(Time.secondsToTimeString(0), '12:00 AM');

  });


  it('should return correct time string for a known unixtime', function () {

    // 1600241473 = 2020-09-16T07:31:13Z -> 7:31 AM
    assert.strictEqual(Time.secondsToTimeString(1600241473), '7:31 AM');

  });

});



// ============================================================================
// 3. UNIX TIMESTAMP CONVERSIONS
// ============================================================================

describe('unixtimeToDate', function () {

  it('should return 1970-01-01T00:00:00.000Z when input is 0', function () {

    const date = Time.unixtimeToDate(0);

    assert.strictEqual(date.toISOString(), '1970-01-01T00:00:00.000Z');

  });


  it('should return correct Date for 1600000000', function () {

    const date = Time.unixtimeToDate(1600000000);

    assert.strictEqual(date.toISOString(), '2020-09-13T12:26:40.000Z');

  });

});



describe('dateToUnixtime', function () {

  it('should return 0 when input is epoch date', function () {

    assert.strictEqual(Time.dateToUnixtime(new Date('1970-01-01T00:00:00.000Z')), 0);

  });


  it('should round-trip with unixtimeToDate', function () {

    const unixtime = 1600000000;
    const date = Time.unixtimeToDate(unixtime);

    assert.strictEqual(Time.dateToUnixtime(date), unixtime);

  });

});



describe('unixtimeToDateString', function () {

  it('should return ISO string for epoch 0', function () {

    assert.strictEqual(Time.unixtimeToDateString(0), '1970-01-01T00:00:00.000Z');

  });


  it('should return correct ISO string for 1600000000', function () {

    assert.strictEqual(Time.unixtimeToDateString(1600000000), '2020-09-13T12:26:40.000Z');

  });

});



describe('dateStringToUnixtime', function () {

  it('should return 1600241473 when input is 2020-09-16T07:31:13.000Z', function () {

    assert.strictEqual(Time.dateStringToUnixtime('2020-09-16T07:31:13.000Z'), 1600241473);

  });


  it('should return 0 when input is epoch ISO string', function () {

    assert.strictEqual(Time.dateStringToUnixtime('1970-01-01T00:00:00.000Z'), 0);

  });


  it('should round-trip with unixtimeToDateString', function () {

    const original = 1700000000;
    const date_string = Time.unixtimeToDateString(original);

    assert.strictEqual(Time.dateStringToUnixtime(date_string), original);

  });

});



describe('unixtimeToUtcString', function () {

  it('should return correct UTC string for 1445409480', function () {

    assert.strictEqual(Time.unixtimeToUtcString(1445409480), 'Wed, 21 Oct 2015 06:38:00 GMT');

  });


  it('should return Thu, 01 Jan 1970 00:00:00 GMT for epoch 0', function () {

    assert.strictEqual(Time.unixtimeToUtcString(0), 'Thu, 01 Jan 1970 00:00:00 GMT');

  });

});



describe('utcStringToUnixtime', function () {

  it('should return 0 when input is epoch UTC string', function () {

    assert.strictEqual(Time.utcStringToUnixtime('Thu, 01 Jan 1970 00:00:00 GMT'), 0);

  });


  it('should round-trip with unixtimeToUtcString', function () {

    const original = 1600000000;
    const utc_string = Time.unixtimeToUtcString(original);

    assert.strictEqual(Time.utcStringToUnixtime(utc_string), original);

  });

});



describe('unixtimeToUnixDay', function () {

  it('should return start of day for a mid-day timestamp', function () {

    // 2020-09-13T12:26:40Z = 1600000000, day start = 2020-09-13T00:00:00Z
    assert.strictEqual(Time.unixtimeToUnixDay(1600000000), 1599955200);

  });


  it('should return same value when input is already midnight', function () {

    assert.strictEqual(Time.unixtimeToUnixDay(1599955200), 1599955200);

  });


  it('should return 0 for epoch 0', function () {

    assert.strictEqual(Time.unixtimeToUnixDay(0), 0);

  });

});



// ============================================================================
// 4. TIMEZONE OPERATIONS
// ============================================================================

describe('calcTimeWithOffset', function () {

  it('should return 1500 when adding offset 500 to 1000', function () {

    assert.strictEqual(Time.calcTimeWithOffset(1000, 500), 1500);

  });


  it('should return 800 when adding offset -200 to 1000', function () {

    assert.strictEqual(Time.calcTimeWithOffset(1000, -200), 800);

  });


  it('should return same value when offset is 0', function () {

    assert.strictEqual(Time.calcTimeWithOffset(1600000000, 0), 1600000000);

  });

});



describe('getTimezoneOffset', function () {

  it('should return a number for valid timezone', function () {

    const offset = Time.getTimezoneOffset(1600000000, 'America/New_York');

    assert.strictEqual(typeof offset, 'number');

  });


  it('should return different offsets for different timezones', function () {

    const ny_offset = Time.getTimezoneOffset(1600000000, 'America/New_York');
    const tokyo_offset = Time.getTimezoneOffset(1600000000, 'Asia/Tokyo');

    assert.notStrictEqual(ny_offset, tokyo_offset);

  });


  it('should return 0 for UTC timezone', function () {

    const offset = Time.getTimezoneOffset(1600000000, 'UTC');

    assert.strictEqual(offset, 0);

  });

});



describe('unixtimeToTimezoneTime', function () {

  it('should return adjusted unixtime for UTC (offset 0)', function () {

    const result = Time.unixtimeToTimezoneTime(1600000000, 'UTC');

    assert.strictEqual(result, 1600000000);

  });


  it('should return different value for non-UTC timezone', function () {

    const result = Time.unixtimeToTimezoneTime(1600000000, 'Asia/Tokyo');

    assert.notStrictEqual(result, 1600000000);

  });

});



describe('unixtimeToTimezoneDate', function () {

  it('should return a Date object', function () {

    const result = Time.unixtimeToTimezoneDate(1600000000, 'UTC');

    assert.ok(result instanceof Date);

  });


  it('should return same date for UTC timezone', function () {

    const result = Time.unixtimeToTimezoneDate(1600000000, 'UTC');

    assert.strictEqual(result.toISOString(), '2020-09-13T12:26:40.000Z');

  });

});



// ============================================================================
// 5. DATE DATA SET OPERATIONS
// ============================================================================

describe('dateDataSet', function () {

  it('should return object with all date components', function () {

    const result = Time.dateDataSet(2024, 1, 15, 10, 30, 45);

    assert.deepStrictEqual(result, {
      year: 2024,
      month: 1,
      day: 15,
      hours: 10,
      minutes: 30,
      seconds: 45
    });

  });


  it('should preserve undefined for missing optional params', function () {

    const result = Time.dateDataSet(2024, 6, 1);

    assert.strictEqual(result.year, 2024);
    assert.strictEqual(result.month, 6);
    assert.strictEqual(result.day, 1);
    assert.strictEqual(result.hours, undefined);
    assert.strictEqual(result.minutes, undefined);
    assert.strictEqual(result.seconds, undefined);

  });

});



describe('dateStringToDataSet', function () {

  it('should parse ISO string into data set', function () {

    const result = Time.dateStringToDataSet('2020-09-16T07:31:13.000Z');

    assert.deepStrictEqual(result, {
      year: '2020',
      month: '09',
      day: '16',
      hour: '07',
      minute: '31',
      second: '13'
    });

  });


  it('should parse epoch ISO string', function () {

    const result = Time.dateStringToDataSet('1970-01-01T00:00:00.000Z');

    assert.strictEqual(result.year, '1970');
    assert.strictEqual(result.month, '01');
    assert.strictEqual(result.day, '01');
    assert.strictEqual(result.hour, '00');
    assert.strictEqual(result.minute, '00');
    assert.strictEqual(result.second, '00');

  });

});



describe('dateToDataSet', function () {

  it('should convert Date object to data set', function () {

    const date = new Date('2024-06-15T10:30:45.000Z');
    const result = Time.dateToDataSet(date);

    assert.strictEqual(result.year, '2024');
    assert.strictEqual(result.month, '06');
    assert.strictEqual(result.day, '15');
    assert.strictEqual(result.hour, '10');
    assert.strictEqual(result.minute, '30');
    assert.strictEqual(result.second, '45');

  });


  it('should convert epoch Date to data set', function () {

    const date = new Date('1970-01-01T00:00:00.000Z');
    const result = Time.dateToDataSet(date);

    assert.strictEqual(result.year, '1970');
    assert.strictEqual(result.hour, '00');

  });

});



describe('dateDataSetToDate', function () {

  it('should convert data set to Date object', function () {

    const data_set = { year: 2024, month: 6, day: 15, hours: 10, minutes: 30, seconds: 0 };
    const date = Time.dateDataSetToDate(data_set);

    assert.strictEqual(date.toISOString(), '2024-06-15T10:30:00.000Z');

  });


  it('should default missing time components to 0', function () {

    const data_set = { year: 2024, month: 1, day: 1 };
    const date = Time.dateDataSetToDate(data_set);

    assert.strictEqual(date.toISOString(), '2024-01-01T00:00:00.000Z');

  });

});



describe('dateDataSetToDateString', function () {

  it('should convert data set to ISO string', function () {

    const data_set = { year: 2024, month: 1, day: 1, hours: 0, minutes: 0, seconds: 0 };

    assert.strictEqual(Time.dateDataSetToDateString(data_set), '2024-01-01T00:00:00.000Z');

  });


  it('should handle data set with time components', function () {

    const data_set = { year: 2020, month: 9, day: 16, hours: 7, minutes: 31, seconds: 13 };

    assert.strictEqual(Time.dateDataSetToDateString(data_set), '2020-09-16T07:31:13.000Z');

  });

});



describe('dateDataSetToUnixtime', function () {

  it('should return 0 for epoch data set', function () {

    const data_set = { year: 1970, month: 1, day: 1, hours: 0, minutes: 0, seconds: 0 };

    assert.strictEqual(Time.dateDataSetToUnixtime(data_set), 0);

  });


  it('should return correct unixtime for known date', function () {

    const data_set = { year: 2020, month: 9, day: 16, hours: 7, minutes: 31, seconds: 13 };

    assert.strictEqual(Time.dateDataSetToUnixtime(data_set), 1600241473);

  });

});



// ============================================================================
// 6. MONTH CALCULATIONS
// ============================================================================

describe('getLastDayOfMonth', function () {

  it('should return 31 when month is January', function () {

    assert.strictEqual(Time.getLastDayOfMonth(2024, 1), '31');

  });


  it('should return 29 when month is February in leap year', function () {

    assert.strictEqual(Time.getLastDayOfMonth(2024, 2), '29');

  });


  it('should return 28 when month is February in non-leap year', function () {

    assert.strictEqual(Time.getLastDayOfMonth(2023, 2), '28');

  });


  it('should return 30 when month is April', function () {

    assert.strictEqual(Time.getLastDayOfMonth(2024, 4), '30');

  });


  it('should return 31 when month is December', function () {

    assert.strictEqual(Time.getLastDayOfMonth(2024, 12), '31');

  });


  it('should return 30 when month is June', function () {

    assert.strictEqual(Time.getLastDayOfMonth(2024, 6), '30');

  });


  it('should handle string inputs', function () {

    assert.strictEqual(Time.getLastDayOfMonth('2024', '2'), '29');

  });

});
