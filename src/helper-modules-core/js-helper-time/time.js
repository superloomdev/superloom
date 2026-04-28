// Info: Date/Time utility library. Platform-agnostic date math, timezone,
// and formatting using native JS Date and Intl APIs. No external dependencies.
//
// Compatibility: Node.js 20.19+ (Intl.DateTimeFormat with hourCycle, native Date).
//
// Factory pattern: each loader call returns an independent Time interface
// with its own config. All functions are pure - no shared module-level
// state between instances.
'use strict';


/////////////////////////// Module-Loader START ////////////////////////////////

/********************************************************************
Factory loader. One call = one independent instance with its own
config.

@param {Object} shared_libs - Lib container with Utils
@param {Object} config - Overrides merged over module config defaults

@return {Object} - Public interface for this module
*********************************************************************/
module.exports = function loader (shared_libs, config) {

  // Dependencies for this instance
  const Lib = {
    Utils: shared_libs.Utils
  };

  // Merge overrides over defaults
  const CONFIG = Object.assign(
    {},
    require('./time.config'),
    config || {}
  );

  // Create and return the public interface
  return createInterface(Lib, CONFIG);

};/////////////////////////// Module-Loader END /////////////////////////////////



/////////////////////////// createInterface START //////////////////////////////

/********************************************************************
Builds the public interface for one instance. Public functions close
over the provided Lib and CONFIG.

@param {Object} Lib - Dependency container (Utils)
@param {Object} CONFIG - Merged configuration for this instance (reserved for future use)

@return {Object} - Public interface for this module
*********************************************************************/
const createInterface = function (Lib, CONFIG) { // eslint-disable-line no-unused-vars

  ///////////////////////////Public Functions START//////////////////////////////
  const Time = { // Public functions accessible by other modules

    // ~~~~~~~~~~~~~~~~~~~~ Day and Time Calculations ~~~~~~~~~~~~~~~~~~~~
    // Primitive day-name lookup and within-day second arithmetic. No
    // dependencies on other helpers - pure calculations over Number inputs.

    /********************************************************************
    Return week day name for a specific date.

    @param {String|Integer} year - Year
    @param {String|Integer} month - Month (1-12)
    @param {String|Integer} day - Day (1-31)

    @return {String} - Week day name ('sunday'|'monday'|...|'saturday')
    *********************************************************************/
    dayName: function (year, month, day) {

      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

      const date = new Date(Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day)
      ));

      return days[date.getDay()];

    },


    /********************************************************************
    Return seconds past midnight 00:00:00 for a given wall-clock time.

    @param {Integer|String} [hours] - Hours past midnight (default 0)
    @param {Integer|String} [minutes] - Minutes past the hour (default 0)
    @param {Integer|String} [seconds] - Seconds past the minute (default 0)

    @return {Integer} - Seconds with midnight 00:00 as reference (0-86399)
    *********************************************************************/
    epochDay: function (hours, minutes, seconds) {

      return (
        (Number(hours || 0) * 3600) +
        (Number(minutes || 0) * 60) +
        Number(seconds || 0)
      );

    },


    /********************************************************************
    Convert seconds past midnight to [hours, minutes, seconds] tuple.
    Inverse of epochDay().

    @param {Integer} day_in_seconds - Seconds in a day (0-86400)

    @return {Array} - [hours, minutes, seconds]
    *********************************************************************/
    reverseEpochDay: function (day_in_seconds) {

      const hours = Math.floor(day_in_seconds / 3600);
      const minutes = Math.floor(day_in_seconds % 3600 / 60);
      const seconds = Math.floor(day_in_seconds % 3600 % 60);

      return [hours, minutes, seconds];

    },


    /********************************************************************
    Convert 24-hour format time string to seconds past midnight.
    Composes epochDay() from the parsed components.

    @param {String} time_24h - 24-hour time string ('0100' | '2330')

    @return {Integer} - Seconds since midnight
    *********************************************************************/
    time24ToSeconds: function (time_24h) {

      const hours = Number(time_24h.substring(0, 2));
      const mins = Number(time_24h.substring(2, 4));

      return Time.epochDay(hours, mins, 0);

    },


    // ~~~~~~~~~~~~~~~~~~~~ Unixtime and Date Conversions ~~~~~~~~~~~~~~~~~~~~
    // Conversions between Unix seconds, Date objects, ISO strings, and UTC
    // strings. These are building blocks for every higher-level helper
    // below (formatting, timezone math, data set operations).
    //
    // All unixtime values in this module are in SECONDS, not milliseconds.

    /********************************************************************
    Convert unixtime (seconds) to native Date object.

    @param {Integer} unixtime - Seconds since Unix epoch

    @return {Date} - Date object
    *********************************************************************/
    unixtimeToDate: function (unixtime) {

      return new Date(unixtime * 1000);

    },


    /********************************************************************
    Convert native Date object to unixtime (seconds).

    @param {Date} date - Date object

    @return {Integer} - Seconds since Unix epoch (UTC)
    *********************************************************************/
    dateToUnixtime: function (date) {

      return Math.floor(date.getTime() / 1000);

    },


    /********************************************************************
    Convert unixtime to ISO 8601 date string.

    @param {Integer} unixtime - Seconds since Unix epoch

    @return {String} - ISO 8601 date string ('2020-09-16T07:31:13.000Z')
    *********************************************************************/
    unixtimeToDateString: function (unixtime) {

      return Time.unixtimeToDate(unixtime).toISOString();

    },


    /********************************************************************
    Convert ISO 8601 date string to unixtime (seconds).

    @param {String} date_string - ISO 8601 date string

    @return {Integer} - Seconds since Unix epoch
    *********************************************************************/
    dateStringToUnixtime: function (date_string) {

      return Math.floor(new Date(date_string).getTime() / 1000);

    },


    /********************************************************************
    Convert unixtime to UTC date string (RFC 7231 / HTTP-date format).

    @param {Integer} unixtime - Seconds since Unix epoch

    @return {String} - UTC date string ('Wed, 21 Oct 2015 07:28:00 GMT')
    *********************************************************************/
    unixtimeToUtcString: function (unixtime) {

      return Time.unixtimeToDate(unixtime).toUTCString();

    },


    /********************************************************************
    Convert UTC date string to unixtime (seconds).

    @param {String} date_string - UTC date string

    @return {Integer} - Seconds since Unix epoch
    *********************************************************************/
    utcStringToUnixtime: function (date_string) {

      return Time.dateToUnixtime(new Date(date_string));

    },


    /********************************************************************
    Return unixtime for the start of day (00:00:00 UTC) for a given
    timestamp. Useful for bucketing events by calendar day.

    @param {Integer} unixtime - Seconds since Unix epoch (UTC)

    @return {Integer} - Unixtime at 00:00:00 of that day
    *********************************************************************/
    unixtimeToUnixDay: function (unixtime) {

      const date = new Date(unixtime * 1000);

      const date_at_00 = new Date(Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate()
      ));

      return Math.floor(date_at_00.getTime() / 1000);

    },


    // ~~~~~~~~~~~~~~~~~~~~ Date Data Set ~~~~~~~~~~~~~~~~~~~~
    // Structured { year, month, day, hours/hour, minutes/minute,
    // seconds/second } representation. Used as an intermediate shape when
    // building or decomposing dates without the Date object overhead.
    //
    // Note the two shape variants: dateDataSet()/dateDataSetToDate() use
    // plural keys (hours, minutes, seconds) - this is the "build" shape.
    // dateStringToDataSet()/dateToDataSet() return singular keys (hour,
    // minute, second) - this is the "parse" shape produced from ISO input.

    /********************************************************************
    Build a date data set from individual components.

    @param {String|Integer} year - Year
    @param {String|Integer} month - Month (1-12)
    @param {String|Integer} day - Day (1-31)
    @param {String|Integer} [hours] - Hours (0-23)
    @param {String|Integer} [minutes] - Minutes (0-59)
    @param {String|Integer} [seconds] - Seconds (0-59)

    @return {Object} - { year, month, day, hours, minutes, seconds }
    *********************************************************************/
    dateDataSet: function (year, month, day, hours, minutes, seconds) {

      return {
        'year': year,
        'month': month,
        'day': day,
        'hours': hours,
        'minutes': minutes,
        'seconds': seconds
      };

    },


    /********************************************************************
    Split ISO 8601 date string into a data set with singular keys.

    @param {String} date_string - ISO 8601 date string ('2020-09-16T07:31:13.000Z')

    @return {Object} - { year, month, day, hour, minute, second } (all String)
    *********************************************************************/
    dateStringToDataSet: function (date_string) {

      return {
        'year': date_string.substring(0, 4),
        'month': date_string.substring(5, 7),
        'day': date_string.substring(8, 10),
        'hour': date_string.substring(11, 13),
        'minute': date_string.substring(14, 16),
        'second': date_string.substring(17, 19)
      };

    },


    /********************************************************************
    Split a native Date object into a data set with singular keys.
    Delegates to dateStringToDataSet via ISO serialization.

    @param {Date} date - Date object

    @return {Object} - { year, month, day, hour, minute, second }
    *********************************************************************/
    dateToDataSet: function (date) {

      return Time.dateStringToDataSet(date.toISOString());

    },


    /********************************************************************
    Convert a data set (plural-key build shape) to a native Date object
    interpreted as UTC.

    @param {Object} date_data - { year, month, day, hours, minutes, seconds }

    @return {Date} - Date object (UTC)
    *********************************************************************/
    dateDataSetToDate: function (date_data) {

      return new Date(Date.UTC(
        Number(date_data['year']),
        Number(date_data['month']) - 1,
        Number(date_data['day']),
        Number(date_data['hours'] || 0),
        Number(date_data['minutes'] || 0),
        Number(date_data['seconds'] || 0)
      ));

    },


    /********************************************************************
    Convert a data set to ISO 8601 date string.

    @param {Object} date_data - { year, month, day, hours, minutes, seconds }

    @return {String} - ISO 8601 date string
    *********************************************************************/
    dateDataSetToDateString: function (date_data) {

      return Time.dateDataSetToDate(date_data).toISOString();

    },


    /********************************************************************
    Convert a data set to unixtime (seconds since epoch).

    @param {Object} date_data - { year, month, day, hours, minutes, seconds }

    @return {Integer} - Seconds since Unix epoch
    *********************************************************************/
    dateDataSetToUnixtime: function (date_data) {

      return Time.dateToUnixtime(
        Time.dateDataSetToDate(date_data)
      );

    },


    // ~~~~~~~~~~~~~~~~~~~~ Time Formatting ~~~~~~~~~~~~~~~~~~~~
    // Human-readable wall-clock time output. Composes the Unixtime /
    // Date Data Set helpers above, so those sections must come first.

    /********************************************************************
    Format hours (24h) and minutes to a 12-hour time string.
    Single-digit minutes are zero-padded. Handles 0 and 24 as midnight.

    @param {Integer} hours - Hours past midnight (0-24)
    @param {Integer} minutes - Minutes past the hour (0-59)

    @return {String} - Formatted time ('4:30 PM')
    *********************************************************************/
    formatHourMinTo12HourTime: function (hours, minutes) {

      minutes = (minutes < 10) ? ('0' + minutes) : ('' + minutes);

      if (hours === 24 || hours === 0) {
        return `12:${minutes} AM`;
      }
      else if (hours === 12) {
        return `12:${minutes} PM`;
      }
      else if (hours < 12) {
        return `${hours}:${minutes} AM`;
      }
      else {
        return `${hours - 12}:${minutes} PM`;
      }

    },


    /********************************************************************
    Convert unixtime to a 12-hour time string. Returns an empty string
    for null/undefined/empty input so callers can safely render the
    result in a template without guarding for falsy values.

    @param {Integer} seconds - Seconds since Unix epoch

    @return {String} - Formatted time ('10:05 AM'), or '' for empty input
    *********************************************************************/
    secondsToTimeString: function (seconds) {

      if (Lib.Utils.isNullOrUndefined(seconds) || seconds === '') {
        return '';
      }

      const date_string = Time.unixtimeToDateString(seconds);
      const date_data = Time.dateStringToDataSet(date_string);

      return Time.formatHourMinTo12HourTime(
        Number(date_data['hour']),
        Number(date_data['minute'])
      );

    },


    // ~~~~~~~~~~~~~~~~~~~~ Timezone Operations ~~~~~~~~~~~~~~~~~~~~
    // DST-aware timezone math using Intl.DateTimeFormat. Converts UTC
    // unixtime into wall-clock time for a named IANA timezone, and vice
    // versa. Offset varies across the year for zones that observe DST.

    /********************************************************************
    Add a signed offset (in seconds) to a unixtime. Thin arithmetic
    helper used by unixtimeToTimezoneTime and callers doing manual
    offset math.

    @param {Integer} unixtime - Seconds since epoch
    @param {Number} offset - Offset in seconds (can be negative)

    @return {Integer} - Adjusted unixtime
    *********************************************************************/
    calcTimeWithOffset: function (unixtime, offset) {

      return unixtime + offset;

    },


    /********************************************************************
    Return the offset of a timezone at a particular instant, accounting
    for DST. The offset is the value you would add to UTC unixtime to
    produce the wall-clock time in that zone.

    @param {Integer} unixtime - Seconds since Unix epoch (UTC)
    @param {String} timezone - IANA Timezone ID (e.g., 'America/New_York')

    @return {Integer} - Offset in seconds
    *********************************************************************/
    getTimezoneOffset: function (unixtime, timezone) {

      const date = new Date(unixtime * 1000);

      const options = {
        year: 'numeric', month: 'long', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hourCycle: 'h23',
        timeZone: timezone
      };

      const new_date_string_parts = Intl.DateTimeFormat('en', options).formatToParts(date);

      const new_date_string_data = {};
      new_date_string_parts.forEach(function (item) {
        new_date_string_data[item.type] = item.value;
      });

      const new_date_string = `${new_date_string_data.day} ${new_date_string_data.month} ${new_date_string_data.year},  ${new_date_string_data.hour}:${new_date_string_data.minute}:${new_date_string_data.second}`;

      const time_with_fix = (
        (new Date(new_date_string)).getTime() / 1000 -
        (new Date().getTimezoneOffset() * 60)
      );

      return (time_with_fix - unixtime);

    },


    /********************************************************************
    Convert UTC unixtime to "wall-clock" unixtime in a specific timezone.
    The returned value is NOT a real unixtime - it is the local wall
    clock expressed as seconds since epoch, useful as an intermediate
    before formatting.

    @param {Integer} unixtime - Seconds since Unix epoch (UTC)
    @param {String} timezone - IANA Timezone ID

    @return {Integer} - Offset-adjusted unixtime
    *********************************************************************/
    unixtimeToTimezoneTime: function (unixtime, timezone) {

      return Time.calcTimeWithOffset(
        unixtime,
        Time.getTimezoneOffset(unixtime, timezone)
      );

    },


    /********************************************************************
    Convert UTC unixtime to a Date object whose toISOString() reads as
    the wall-clock time in the target timezone (not the real UTC time).

    @param {Integer} unixtime - Seconds since Unix epoch (UTC)
    @param {String} timezone - IANA Timezone ID

    @return {Date} - Wall-clock Date for the timezone
    *********************************************************************/
    unixtimeToTimezoneDate: function (unixtime, timezone) {

      return new Date(
        Time.unixtimeToTimezoneTime(unixtime, timezone) * 1000
      );

    },


    // ~~~~~~~~~~~~~~~~~~~~ Calendar ~~~~~~~~~~~~~~~~~~~~
    // Month and year-level helpers. Build on the Date Data Set section.

    /********************************************************************
    Return the last day of a specific month as a two-character day
    string. Handles leap years correctly via the underlying Date
    arithmetic (day 0 of month N+1 == last day of month N).

    @param {String|Integer} year - Year
    @param {String|Integer} month - Month (1-12)

    @return {String} - Last day of the month ('28'|'29'|'30'|'31')
    *********************************************************************/
    getLastDayOfMonth: function (year, month) {

      const date_set = Time.dateDataSet(
        year,
        Number(month) + 1,
        0
      );

      const date = Time.dateDataSetToDate(date_set);

      return Time.dateToDataSet(date).day;

    }

  };///////////////////////////Public Functions END//////////////////////////////


  // Return the public interface
  return Time;

};/////////////////////////// createInterface END //////////////////////////////
