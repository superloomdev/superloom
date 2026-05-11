// Info: Shared Process Module - Common data transformation utilities
// Pure functions for common data manipulations used across multiple entities
'use strict';

// Shared dependencies (injected by loader; avoids passing Lib everywhere)
let Lib = {};


/////////////////////////// Module-Loader START ////////////////////////////////

/********************************************************************
  Loader: inject Lib for this module.

  @param {Object} shared_libs - loaded libraries + models (Lib)
  @return {void}
  *********************************************************************/
const loader = function (shared_libs) {

  Lib = shared_libs;

};

//////////////////////////// Module-Loader END /////////////////////////////////



///////////////////////////// Module Exports START /////////////////////////////
module.exports = function (shared_libs) {

  // Run module-scope loader (local DI)
  loader(shared_libs);

  // Return Public Functions of this module
  return SharedProcess;

};//////////////////////////// Module Exports END //////////////////////////////



///////////////////////////Public Functions START///////////////////////////////
const SharedProcess = {

  /********************************************************************
  Convert Unix timestamp to ISO date string

  @param {Number} unix_timestamp - Unix timestamp in seconds or milliseconds
  @param {Boolean} is_milliseconds - True if timestamp is in milliseconds

  @return {String} - ISO 8601 date string
  *********************************************************************/
  unixToIsoString: function (unix_timestamp, is_milliseconds) {

    const ms = is_milliseconds ? unix_timestamp : unix_timestamp * 1000;
    return new Date(ms).toISOString();

  },


  /********************************************************************
  Calculate days between two dates

  @param {String} date_a - First date (ISO string)
  @param {String} date_b - Second date (ISO string)

  @return {Number} - Days between dates
  *********************************************************************/
  daysBetween: function (date_a, date_b) {

    const d1 = new Date(date_a);
    const d2 = new Date(date_b);
    const diff_ms = Math.abs(d2 - d1);
    return Math.floor(diff_ms / (1000 * 60 * 60 * 24));

  },


  /********************************************************************
  Format date for display

  @param {String} iso_date - ISO date string
  @param {String} format - Output format (short, long, relative)

  @return {String} - Formatted date string
  *********************************************************************/
  formatDate: function (iso_date, format) {

    const date = new Date(iso_date);

    switch (format) {
    case 'short':
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });

    case 'long':
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
      });

    case 'relative':
      return SharedProcess.getRelativeTimeString(date);

    default:
      return date.toISOString();
    }

  },


  /********************************************************************
  Get relative time string (e.g., "2 days ago")

  @param {Date} date - Date object

  @return {String} - Relative time description
  *********************************************************************/
  getRelativeTimeString: function (date) {

    const now = new Date();
    const diff_ms = now - date;
    const diff_seconds = Math.floor(diff_ms / 1000);
    const diff_minutes = Math.floor(diff_seconds / 60);
    const diff_hours = Math.floor(diff_minutes / 60);
    const diff_days = Math.floor(diff_hours / 24);

    if (diff_seconds < 60) {
      return 'just now';
    }

    if (diff_minutes < 60) {
      return `${diff_minutes} minute${diff_minutes > 1 ? 's' : ''} ago`;
    }

    if (diff_hours < 24) {
      return `${diff_hours} hour${diff_hours > 1 ? 's' : ''} ago`;
    }

    if (diff_days < 30) {
      return `${diff_days} day${diff_days > 1 ? 's' : ''} ago`;
    }

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  },


  /********************************************************************
  Sanitize string for display (remove extra whitespace, special chars)

  @param {String} input - Input string
  @param {Object} options - Sanitization options

  @return {String} - Sanitized string
  *********************************************************************/
  sanitizeString: function (input, options) {

    if (Lib.Utils.isEmpty(input)) {
      return '';
    }

    let result = String(input).trim();

    if (options && options.remove_extra_spaces) {
      result = result.replace(/\s+/g, ' ');
    }

    if (options && options.lowercase) {
      result = result.toLowerCase();
    }

    if (options && options.uppercase) {
      result = result.toUpperCase();
    }

    if (options && options.max_length && result.length > options.max_length) {
      result = result.substring(0, options.max_length) + (options.truncate_suffix || '...');
    }

    return result;

  },


  /********************************************************************
  Generate a slug from a string (URL-friendly)

  @param {String} text - Input text

  @return {String} - URL-friendly slug
  *********************************************************************/
  generateSlug: function (text) {

    if (Lib.Utils.isEmpty(text)) {
      return '';
    }

    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');

  },


  /********************************************************************
  Paginate array

  @param {Array} items - Array to paginate
  @param {Number} page - Page number (1-based)
  @param {Number} limit - Items per page

  @return {Object} - Paginated result with metadata
  *********************************************************************/
  paginate: function (items, page, limit) {

    const total_items = items.length;
    const total_pages = Math.ceil(total_items / limit);
    const current_page = Math.max(1, Math.min(page, total_pages || 1));
    const offset = (current_page - 1) * limit;

    const paginated_items = items.slice(offset, offset + limit);

    return {
      data: paginated_items,
      pagination: {
        current_page: current_page,
        total_pages: total_pages,
        total_items: total_items,
        items_per_page: limit,
        has_next: current_page < total_pages,
        has_prev: current_page > 1
      }
    };

  },


  /********************************************************************
  Deep clone an object

  @param {Object} obj - Object to clone

  @return {Object} - Deep cloned object
  *********************************************************************/
  deepClone: function (obj) {

    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (obj instanceof Date) {
      return new Date(obj.getTime());
    }

    if (Array.isArray(obj)) {
      return obj.map(function (item) {
        return SharedProcess.deepClone(item);
      });
    }

    const cloned = {};
    Object.keys(obj).forEach(function (key) {
      cloned[key] = SharedProcess.deepClone(obj[key]);
    });

    return cloned;

  },


  /********************************************************************
  Pick specific keys from an object

  @param {Object} obj - Source object
  @param {Array} keys - Keys to pick

  @return {Object} - Object with only picked keys
  *********************************************************************/
  pick: function (obj, keys) {

    const result = {};

    keys.forEach(function (key) {
      if (obj.hasOwnProperty(key)) {
        result[key] = obj[key];
      }
    });

    return result;

  },


  /********************************************************************
  Omit specific keys from an object

  @param {Object} obj - Source object
  @param {Array} keys - Keys to omit

  @return {Object} - Object without omitted keys
  *********************************************************************/
  omit: function (obj, keys) {

    const result = { ...obj };

    keys.forEach(function (key) {
      delete result[key];
    });

    return result;

  },


  /********************************************************************
  Group array items by a key

  @param {Array} items - Array of objects
  @param {String} key - Key to group by

  @return {Object} - Grouped object
  *********************************************************************/
  groupBy: function (items, key) {

    const groups = {};

    items.forEach(function (item) {
      const group_key = item[key];
      if (!groups[group_key]) {
        groups[group_key] = [];
      }
      groups[group_key].push(item);
    });

    return groups;

  },


  /********************************************************************
  Calculate simple statistics on numeric array

  @param {Array} numbers - Array of numbers

  @return {Object} - Statistics (min, max, avg, count, sum)
  *********************************************************************/
  calculateNumericStats: function (numbers) {

    if (Lib.Utils.isEmpty(numbers) || numbers.length === 0) {
      return { min: 0, max: 0, avg: 0, count: 0, sum: 0 };
    }

    const valid_numbers = numbers.filter(function (n) {
      return typeof n === 'number' && !isNaN(n);
    });

    if (valid_numbers.length === 0) {
      return { min: 0, max: 0, avg: 0, count: 0, sum: 0 };
    }

    const sum = valid_numbers.reduce(function (acc, val) {
      return acc + val;
    }, 0);

    return {
      min: Math.min(...valid_numbers),
      max: Math.max(...valid_numbers),
      avg: sum / valid_numbers.length,
      count: valid_numbers.length,
      sum: sum
    };

  }

};///////////////////////////Public Functions END///////////////////////////////

//////////////////////////////Module Exports START//////////////////////////////
module.exports = function (shared_libs) {

  // Run module-scope loader (local DI)
  loader(shared_libs);

  // Return Public Functions of this module
  return SharedProcess;

};/////////////////////////////Module Exports END///////////////////////////////
