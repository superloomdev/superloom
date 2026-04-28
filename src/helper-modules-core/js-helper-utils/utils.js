// Info: Utility functions for type checks, validation, sanitization, and data
// manipulation. Zero runtime dependencies - no external libs required.
//
// Compatibility: Node.js 20.19+.
//
// Factory pattern: each loader call returns an independent Utils interface.
// Functions are pure - no shared module-level state between instances.
'use strict';



/////////////////////////// Module-Loader START ////////////////////////////////

/********************************************************************
Factory loader. One call = one independent instance.
shared_libs accepted for interface uniformity but unused.

@param {Object} shared_libs - Lib container (unused)
@param {Object} config - Reserved for future config overrides

@return {Object} - Public interface for this module
*********************************************************************/
module.exports = function loader (shared_libs, config) { // eslint-disable-line no-unused-vars

  // Create and return the public interface
  return createInterface();

};///////////////////////////// Module-Loader END ///////////////////////////////



/////////////////////////// createInterface START //////////////////////////////

/********************************************************************
Builds the public interface for one instance.

@return {Object} - Public interface for this module
*********************************************************************/
const createInterface = function () {

  ///////////////////////////Public Functions START//////////////////////////////
  const Utils = { // Public functions accessible by other modules

    /********************************************************************
    Copy of Util Functions from Node JS util lib
    Link: https://github.com/isaacs/core-util-is/blob/master/lib/util.js
    *********************************************************************/
    isNull: function (arg) {
      return arg === null;
    },

    isNullOrUndefined: function (arg) {
      return arg == null;
    },

    isUndefined: function (arg) {
      return arg === void 0;
    },

    isBoolean: function (arg) {
      return typeof arg === 'boolean';
    },

    isNumber: function (arg) {
      return (
        (typeof arg === 'number') && // Is Number Type
        !isNaN(arg) // Should not be NaN. NaN is considered as Number Type
      );
    },

    isString: function (arg) {
      return typeof arg === 'string';
    },


    // ~~~~~~~~~~~~~~~~~~~~ Basic Utilities ~~~~~~~~~~~~~~~~~~~~
    // Core type checks and empty-value helpers.

    /********************************************************************
    Check if number is Integer (Whole Number)

    @param {Mixed} num - Number to be checked

    @return {Boolean} - true if Integer (10.0 | 10)
    @return {Boolean} - false if Decimal number (10.7 | 0.7)
    *********************************************************************/
    isInteger: function (num) {

      // Return
      return num % 1 == 0;

    },


    /********************************************************************
    Check if variable is any non-null object type (includes arrays, Date,
    RegExp, etc.). Ported from core-util-is. Use Array.isArray() when you
    need to distinguish arrays from plain objects.

    @param {Mixed} arg - Item to be checked

    @return {Boolean} - 'true' if Object otherwise 'false'
    *********************************************************************/
    isObject: function (arg) {
      return typeof arg === 'object' && !Utils.isNull(arg); // (null is also an object)
    },


    /********************************************************************
    Check if variable is Function

    @param {Mixed} arg - Item to be checked

    @return {Boolean} - 'true' if type id Function otherwise 'false'
    *********************************************************************/
    isFunction: function (arg) {
      return typeof arg === 'function';
    },


    /********************************************************************
    Check if variable is Error Type

    @param {Mixed} arg - Item to be checked

    @return {Boolean} - 'true' if type of object Error otherwise 'false'
    *********************************************************************/
    isError: function (arg) {
      return typeof arg === 'object' && (arg instanceof Error); // This won't work if the error was thrown in a different window/frame/iframe than where the check is happening
    },


    /********************************************************************
    Check if string is empty ''

    @param {String} str - String to be checked

    @return {Boolean} - 'true' if empty otherwise 'false'
    *********************************************************************/
    isEmptyString: function (str) {
      return str.length === 0;
    },


    /********************************************************************
    Check if an Object is empty with no keys {}

    @param {Set} obj - Object to be checked

    @return {Boolean} - 'true' if empty otherwise 'false'
    *********************************************************************/
    isEmptyObject: function (obj) {
      return Object.keys(obj).length === 0;
    },


    /********************************************************************
    Whether value is null or undefined or '' or {} or []

    @param {String | Integer | Object} arg - Item to be checked

    @return {Boolean} - 'true' if empty otherwise 'false'
    *********************************************************************/
    isEmpty: function (arg) {
      return (
        Utils.isNullOrUndefined(arg) || // Check for Null or Undefined
        Utils.isEmptyString(arg) || // Check for empty String (Bonus check for empty Array)
        (Utils.isObject(arg) && Utils.isEmptyObject(arg)) // Check for empty Object or Array
      );
    },


    /********************************************************************
    Whether an array contains a string (return 'true' if does otherwise 'false')

    @param {String | Integer | Object} arr - Error object
    @param {String} element - Item to be searched

    @return {Boolean} - 'true' if does otherwise 'false'
    *********************************************************************/
    inArray: function (arr, element) {
      return arr.indexOf(element) > -1;
    },


    // ~~~~~~~~~~~~~~~~~~~~ Errors & Misc ~~~~~~~~~~~~~~~~~~~~
    // Error construction and no-op utilities.

    /********************************************************************
    Custom Error

    @param {String | Integer | Object} err_obj - Error object with 'code' and 'message' keys
    @param {String} [context] - ID for Handshaking

    @return - JSON Object
    *********************************************************************/
    error: function (err_obj, context) {

      const err = Error(err_obj['message']);
      err.code = err_obj['code'];
      err.name = err_obj['code'].toString(); // Instead of showing 'Error' as title in stack trace, show 'Error Code'.
      err.context = context || null;

      // Return Newly built Error
      return err;

    },


    /********************************************************************
    Null function - For optional callback functions

    @return None
    *********************************************************************/
    nullFunc: function () {},


    // ~~~~~~~~~~~~~~~~~~~~ String Utilities ~~~~~~~~~~~~~~~~~~~~
    // String conversion, parsing, and manipulation helpers.

    /********************************************************************
    Return JSON object from flattened string

    @param {string} str - String to be converted into JSON

    @return - JSON Object
    *********************************************************************/
    stringToJSON: function (str) {

      // Convert flattened-json string into JSON
      if ( !Utils.isNull(str) ) { // Only if not null
        try {
          str = JSON.parse(str); // Convert string -> JSON
        }
        catch {
          str = null; // Set as null if invalid json
        }
      }

      return str;

    },


    /********************************************************************
    Return reversed String
    Note: Only works for ASCII strings and some Unicodes

    @param {string} str - String to be reversed

    @return - Reversed string
    *********************************************************************/
    stringReverse: function (str) {

      return Array.from(str).reverse().join('');

    },


    /********************************************************************
    Join an array of strings. If non-array, then returned as-it-is

    @param {string[]|Boolean|Null} list - List of Strings to be joined. If non-array, then returned as-it-is
    @param {string} separator - Delimiter for Split

    @return - String
    *********************************************************************/
    safeJoin: function (list, separator) {

      if ( Array.isArray(list) ) {
        return list.join(separator); // Join and Return
      }
      else {
        return list; // Return orignal value as-it-is
      }

    },


    /********************************************************************
    Filter an array to only contain Distint values
    [1, 2, 2, 3, 3, 3, 'a', 'a'] -> [1, 2, 3, 'a']

    @param {string|Number[]} arr - Array to be filtered

    @return - Array
    *********************************************************************/
    arrayDistint: function (arr) {

      if ( Array.isArray(arr) ) {
        return [...new Set(arr)];
      }
      else {
        return arr; // Return orignal value as-it-is
      }

    },


    /********************************************************************
    Split a String and remove Whitespaces

    @param {string} str - String to be Splited
    @param {string} delimiter - Delimiter for Split

    @return - Array of String
    *********************************************************************/
    splitWithTrim: function (str, delimiter) {

      return str.split(delimiter).map(function (item) {
        return item.trim();
      });

    },


    // ~~~~~~~~~~~~~~~~~~~~ Sanitization ~~~~~~~~~~~~~~~~~~~~
    // Remove or normalize unwanted values from objects, arrays, and strings.

    /********************************************************************
    Remove unwanted feilds of Object (By Ref)

    @param {Set} obj - JSON Object to be cleaned
    @param {string[]} whitelist - All the key other then these will be removed from JSON
    @param {string[]} blacklist - These keys will be removed from JSON

    @return - Sanatized Object
    *********************************************************************/
    sanitizeObject: function (obj, whitelist, blacklist) {

      // Return as null if obj is null or undefined or not-an-array
      if (
        Utils.isNullOrUndefined(obj) ||
        !Utils.isObject(obj)
      ) {
        return null;
      }


      // Create Shallow Copy of Object
      const new_obj = { ...obj };


      // Remove Blacklist keys from Object
      // Ref: https://stackoverflow.com/a/32535117
      if (blacklist) {

        blacklist.forEach( function (key) {
          delete new_obj[key]; // By Reference
        });

      }


      // Remove Non-Whitelist keys from Object
      // Ref: https://stackoverflow.com/a/38750895
      if (whitelist) {

        Object.keys(new_obj)
          .filter(key => !whitelist.includes(key))
          .forEach(key => delete new_obj[key]); // By Reference

      }


      // Return Clean JSON
      return new_obj;

    },


    /********************************************************************
    Sanatize each item of Array (By Ref)

    @param {Mixed[]} list - Array to be Cleaned
    @param {Function} sanatize_func - Array item sanatizer

    @return - Sanatized Object
    *********************************************************************/
    sanitizeArray: function (list, sanatize_func) {

      // Return as null if list is null or undefined or not-an-array
      if (
        Utils.isNullOrUndefined(list) ||
        !Array.isArray(list)
      ) {
        return null;
      }


      // Sanatize each item of array
      return list.map(function (item) {
        return sanatize_func(item);
      });

    },


    /********************************************************************
    Return cleaned string with only characters from specific regular expresion
    Remove all the dangerous characters excluding those who satisfy RegExp

    @param {string} str - String to be sanatized/cleaned
    @param {string} regx - The regular expression

    @return - Sanatized string
    *********************************************************************/
    sanitizeUsingRegx: function (str, regx) {

      // If null or undefined or zero-length, return value as-it-is
      if (Utils.isNullOrUndefined(str) || str.length == 0) {
        return str;
      }


      // Return Clean String
      return str.replace(regx, ''); // Clean and return

    },


    /********************************************************************
    Return cleaned Integer. Convert String/Decimals to a whole-number.

    @param {Unknown} num - Number to be cleaned

    @return {Number} - Sanitized number. Rounded to 'Floor' in case of decimal.
    *********************************************************************/
    sanitizeInteger: function (num) {

      // Convert to Integer
      const i = parseInt( Number(num) ); // Convert String/Decimal or any type to equivalent Integer

      // Check if NaN in case of Alphabates String passed as number
      if ( isNaN(i) ) {
        return null; // Return Null in case it's not a number
      }
      else {
        return i; // Return clean Integer
      }

    },


    /********************************************************************
    Return cleaned Boolean. Convert String/Number to true/false

    @param {Unknown} bool - Boolean to be cleaned

    @return {Boolean} - Sanitized boolean value
    *********************************************************************/
    sanitizeBoolean: function (bool) {

      // Return
      return Boolean( Number(bool) ); // Return string -> number -> boolean

    },


    // ~~~~~~~~~~~~~~~~~~~~ Number Utilities ~~~~~~~~~~~~~~~~~~~~
    // Timestamp, rounding, and numeric conversion helpers.

    /********************************************************************
    Return specific/current unix timestamp in seconds

    @param {string} [date] - (Optional) Date to be converted into unix timestamp. If not sent in param, then return current time

    @return {String} - Unix timestamp (Seconds)
    *********************************************************************/
    getUnixTime: function (date) {

      // Return Unix Timestamp equivalant of specific date in seconds
      return Math.floor( Utils.getUnixTimeInMilliSeconds(date) / 1000 ); // Convert Milli-Seconds to Seconds

    },


    /********************************************************************
    Return specific/current unix timestamp in Milli-Seconds

    @param {string} [date] - (Optional) Date to be converted into unix timestamp. If not sent in param, then return current time

    @return {String} - Unix timestamp (Milli-Seconds)
    *********************************************************************/
    getUnixTimeInMilliSeconds: function (date) {

      // Check if custom date is sent
      if ( !Utils.isNullOrUndefined(date) ) {
        return ( new Date(date) ); // Return Unix Timestamp equivalant of specific date in Milliseconds
      }
      else {
        return ( new Date().getTime() ); // Return Unix Timestamp equivalant of current time in Milliseconds
      }

    },


    /********************************************************************
    Round a Decimal number to specified number of digits after decimal. Standard rounding rules
    Ref: https://stackoverflow.com/questions/11832914/round-to-at-most-2-decimal-places-only-if-necessary
    Note: math.round() is more precise then Number.toFixed()
    (11.5249, 2) => 11.52
    (11.525, 2) => 11.53

    @param {Number} num - Number to be rounded off
    @param {Number} digits_after_decimal - Number of digits after decimal

    @return {Number} - Rounded off number
    *********************************************************************/
    round: function (num, digits_after_decimal) {

      // If null or undefined, return value as-it-is
      if (Utils.isNullOrUndefined(num)) {
        return num;
      }

      // Calculate multiplier
      const multiplier = Number(`1e${digits_after_decimal}`); // 1e0 === 1, 1e1 === 10, 1e2 === 100

      // Return
      return Math.round(num * multiplier) / multiplier; // 123.456 = 123.45, 123.4 = 123.4

    },


    /********************************************************************
    Round a Decimal number to specified number of digits after decimal. Cascading base rounding rules
    (11.5249, 2) => 11.53

    @param {Number} num - Number to be rounded off
    @param {Number} digits_after_decimal - Number of digits after decimal
    @param {Integer} safety - Number of decimals to start rounding from (default 10)

    @return {Number} - Rounded off number
    *********************************************************************/
    roundWithCascading: function (num, digits_after_decimal, safety = 10) {

      // If null or undefined, return value as-it-is
      if (Utils.isNullOrUndefined(num)) {
        return num;
      }

      // Round off by stepping down one decimal at a time, starting from 'safety' decimal places
      for (let i = safety; i >= digits_after_decimal; i--) {
        num = Utils.round(num, i);
      }

      // Return rounded number
      return num;

    },


    /********************************************************************
    Convert String to Integer (Return NaN if invalid value)

    @param {String} str - String to be converted to Number

    @return {Number} - Number equivalant of the string. Null if String is Empty.
    @return {Number} - NaN if invalid string or Array or Object
    *********************************************************************/
    stringToNumber: function (str) {

      if ( Utils.isEmpty(str) ) { // If Empty String, return Null instead of 0
        return null;
      }
      else {
        return Number(str); // Convert to Number
      }

    },


    /********************************************************************
    Break string into array with a delimiter
    (Inbuilt skips all empty elements and trim whitespaces and convert to lowercase)

    @param {String} delimiter - The boundary string
    @param {String} str - The input string. Can be NULL or Empty

    @return {Boolean} - false if input sring is null or ''
    @return {String[]} - Newly converted array of strings
    *********************************************************************/
    stringToArray: function (delimiter, str) {

      if (str.length === 0) {
        return false; //Empty string
      }

      let arr = str.split(delimiter);        // Split into Array
      arr = arr.map( function (item) { return item.trim().toLowerCase(); } );    // Convert to lowercase and Trim white spaces including \n \t \r
      arr = arr.filter( Boolean);            // Remove Empty element from array in case string is null/''/0/false/undefined. (If you split an empty string, you get back a one-element array with 0 as the key and an empty string for the value.)


      // Check if resultant array is empty, then return false
      if ( arr.length > 0 ) {
        return arr;
      }
      else {
        return false; // Empty array
      }

    },


    /********************************************************************
    Join 2 Arrays (or String) of 'key' and 'value' into one Object

    @param {String|Array} keys - Array with list of keys or single item string
    @param {String|Array} values - Array with list of values or single item string

    @return {Set} - Object with mearged key vale pairs
    *********************************************************************/
    keyValueToObject: function (keys, values) {

      const obj = {};

      if ( !Array.isArray(keys) ) { // If single item string
        obj[keys] = values;
      }
      else {
        keys.map( function (key, index) { obj[key] = values[index]; } ); // Create a Set from feilds-array with corrosponding values-array
      }

      return obj;

    },


    /********************************************************************
    Creates a new object by overriding keys of base-object with non-null keys of new-object
    Both Objects should be identical. Keys not present in base object won't be added to it

    @param {Set} base_obj - Base object
    @param {Set} new_objs - (... List) New object whose non-null keys will override base-object keys

    @return {Set} - Object with mearged data
    *********************************************************************/
    overrideObject: function (base_obj, ...new_objs) {

      // Create copy of base-object
      const { ...obj } = { ...base_obj };


      // Iterate each new-object
      new_objs.forEach(function (new_obj) {

        // Copy exclusive/Non-Null keys in New-Object
        for ( const key in new_obj ) {

          if (
            !(key in obj) || // Exclusive keys in New-Object (Keys which were not present in output-object)
            !Utils.isNull(new_obj[key]) // Non-Null key of New-Object
          ) {
            obj[key] = new_obj[key];
          }

        }

      });


      // Return new object
      return obj;

    },


    /********************************************************************
    Set a value for specific key of object (Only if value is not null or undefined)
    By Reference: Changes are made directly in orignal object

    @param {Set} obj - Object in which value is to be inserted
    @param {Set} key - Key to which this value is to be assigned
    @param {Mixed} new_val - New value

    @return {Set} obj - Updated Object
    *********************************************************************/
    setNonEmptyKey: function (obj, key, new_val) {

      // Set value if it's not null/undefined
      if ( !Utils.isNullOrUndefined(new_val) ) {
        obj[key] = new_val;
      }

      // Return Object
      return obj;

    },


    /********************************************************************
    Set a value with fallback value if it's null/undefined

    @param {Mixed} new_val - New value
    @param {Mixed} [fallback_val] - (Optional) Falback value. Auto null if not sent in param

    @return {Set} - Object with mearged data
    *********************************************************************/
    fallback: function (new_val, fallback_val) {

      // If fallback-value is not sent, set it as null
      if ( Utils.isUndefined(fallback_val) ) {
        fallback_val = null;
      }

      // Return new object
      return ( !Utils.isNullOrUndefined(new_val) ? new_val : fallback_val );

    },


    /********************************************************************
    Check if All chracters in string are of valid charset and string has
    minimum and maximum length

    @param {String} str - The variable to be checked
    @param {Number} [min_length] - (Optional) Minimum required length this string must have
    @param {Number} [max_length] - (Optional) Maximum length this string can have

    @return {Boolean} - true on success
    @return {Boolean} - false if validation fails

    Note: Always check this function output against identic (===) FALSE to
    avoid mismatches with text 'false' or '0' or empty strings
    *********************************************************************/
    validateString: function (str, min_length, max_length) {

      // Null/Empty-String Allowed (Only if minimum length is specified)
      if ( !Utils.isNullOrUndefined(min_length) && // sent in param
        min_length === 0 &&
        ( str === null || str === '')
      ) {
        return true;
      }


      // Check if string type
      if ( typeof str !== 'string' ) {
        return false;
      }


      // Check Min and Max length limit
      const len = str.length; //Store var length

      // Check Min Length (Only if specified)
      if ( !Utils.isNullOrUndefined(min_length) && len < min_length ) {
        return false; // Less then minimum required length
      }

      // Check Max Length (Only if specified)
      if ( !Utils.isNullOrUndefined(max_length) && len > max_length ) {
        return false; // More then maximum allowed length
      }


      // Reach here means all validations passed
      return true; // Validation successful

    },


    /********************************************************************
    Check if All chracters in string statisfy particular regular expression
    and string has minimum and maximum length

    @param {String} str - The variable to be checked
    @param {String} regx - The regular expression (EX: '[a-z0-9]{6}')
    @param {Number} [min_length] - (Optional) Minimum required length this string must have
    @param {Number} [max_length] - (Optional) Maximum length this string can have

    @return {Boolean} - true on success
    @return {Boolean} - false if validation fails
    *********************************************************************/
    validateStringRegx: function (str, regx, min_length, max_length) {

      // Null/Empty-String Allowed (Only if minimum length is specified)
      if ( !Utils.isNullOrUndefined(min_length) && // Sent in params
        min_length === 0 &&
        ( str === null || str === '')
      ) {
        return true;
      }


      // Check string against regular expression
      if ( !regx.test(str) ) {
        return false;
      }


      // Check Min and Max length limit
      const len = str.length; //Store var length

      // Check Min Length (Only if specified)
      if ( !Utils.isNullOrUndefined(min_length) && len < min_length ) {
        return false; // Less then minimum required length
      }

      // Check Max Length (Only if specified)
      if ( !Utils.isNullOrUndefined(max_length) && len > max_length ) {
        return false; // More then maximum allowed length
      }


      // Reach here means all validations passed
      return true; // Validation successful

    },


    /********************************************************************
    Check if Integer is within Minimum and maximum range (including min and max)

    @param {String} num - The variable to be checked
    @param {Number} [min_value] - (Optional) Minimum required value
    @param {Number} [max_value] - (Optional) Maximum allowed value (including)

    @return {Boolean} - true on success
    @return {Boolean} - false if validation fails
    *********************************************************************/
    validateNumber: function (num, min_value, max_value) {

      // Validate type
      if ( typeof num !== 'number' || isNaN(num) ) {
        return false;
      }

      // Check Minimum Value
      if ( !Utils.isNullOrUndefined(min_value) && num < min_value ) { // If Minimum value set in parameter
        return false;
      }

      // Check Maximum Value
      if ( !Utils.isNullOrUndefined(max_value) && num > max_value ) { // If Maximum value set in parameter
        return false;
      }

      // Reach here means all validations passed
      return true; // Validation successful

    },


    /********************************************************************
    Return Deep Copy of an Object
    Uses native structuredClone() for better performance when available, falls back to custom polyfill for older environments.

    @param {Object} obj - Object to be deep cloned

    @return {Object} response - Deep copy of object
    @return {Error} response - Error if unsupported object
    *********************************************************************/
    deepCopyObject: function (obj) {

      // Check if modern structuredClone() is available in this environment
      if (typeof structuredClone === 'function') {
        try {
          // Use native structuredClone() for optimal performance
          return structuredClone(obj);
        }
        catch {
          // Fallback to polyfill if structuredClone fails (e.g., unsupported object types)
          return _Utils.deepCopyObjectPolyfill(obj);
        }
      }

      // Fallback to polyfill for older environments that don't support structuredClone()
      return _Utils.deepCopyObjectPolyfill(obj);

    },


    /********************************************************************
    Performs a deep comparison between two values to determine if they are equivalent in terms of content and structure
    Similar implementation as of nodeJS assert.deepStrictEqual

    @param {Object|*} a - Object to be compared
    @param {Object|*} b - Object to be compared

    @return {Boolean} response - Returns true if the values are deeply equal, otherwise false
    *********************************************************************/
    compareObjects: function (a, b) {

      // Primitive Type Comparisions. Directly compare primitive values or references
      if (a === b) {
        return true;
      }


      // If both are Functions, check if they have the same implementation
      if ( Utils.isFunction(a) && Utils.isFunction(b) ) {
        return a.toString() === b.toString();
      // Note: It only checks if the toString representation of the two functions is the same,
      // which means two different functions with the same body will be seen as equal
      }

      // If only one is a Function, they are not equal
      if ( Utils.isFunction(a) || Utils.isFunction(b) ) {
        return false;
      }


      // If either is null or not an object, they cannot be deeply equal
      if ( !Utils.isObject(a) || !Utils.isObject(b) ) {
        return false;
      }


      // If both are Date objects, check if they represent the same time
      if ( a instanceof Date && b instanceof Date ) {
        return a.getTime() === b.getTime();
      }

      // If only one is a Date object, they are not equal
      if ( a instanceof Date || b instanceof Date ) {
        return false;
      }


      // If both are RegExp objects, check if they have the same pattern and flags
      if ( a instanceof RegExp && b instanceof RegExp ) {
        return a.toString() === b.toString();
      }

      // If only one is a RegExp object, they are not equal
      if ( a instanceof RegExp || b instanceof RegExp ) {
        return false;
      }


      // Check if both values are arrays.
      if ( Array.isArray(a) && Array.isArray(b) ) {

        // If arrays have different lengths, they are not equal
        if (a.length !== b.length) {
          return false;
        }

        // Recursively compare each item in the arrays
        for (let i = 0; i < a.length; i++) {
          if ( !Utils.compareObjects(a[i], b[i]) ) {
            return false;
          }
        }

        // Reach here means equal
        return true;

      }

      // If only one is an array, they cannot be deeply equal
      if ( Array.isArray(a) || Array.isArray(b) ) {
        return false;
      }


      // At this point, both values should be regular objects
      // Start by comparing their sets of keys.
      const keys_a = Object.keys(a);
      const keys_b = Object.keys(b);

      // If they have different numbers of keys, they are not equal
      if ( keys_a.length !== keys_b.length ) {
        return false;
      }

      // Check that all keys in the first object exist in the second, and that their associated values are deeply equal
      for (const key of keys_a) {
        if ( !Object.prototype.hasOwnProperty.call(b, key) ) {
          return false;
        }
        if ( !Utils.compareObjects(a[key], b[key]) ) {
          return false;
        }
      }


      // If all checks passed, the objects are deeply equal
      return true;

    },


    // ~~~~~~~~~~~~~~~~~~~~ Object Validation Framework ~~~~~~~~~~~~~~~~~~~~
    // Validate required keys, invalid keys, and nested object lists.

    /********************************************************************
    Return Error-Object if required keys of object are missing or null

    @param {Object} obj - Object to be checked
    @param {String} [context] - (Optional) Request context
    @param {Object} required_config - Map of key names to their validation rules
    @param {Set} required_config[key].error - Custom-Error Object to push when key is missing
    @param {Boolean} [required_config[key].not_null] - (Optional) If true, null values are also rejected
    @param {String|Object[]} required_keys - Keys to check. Strings are always required; Objects are conditionally required
    @param {Object} [dependent_keys] - Keys that become required when another key has a specific value
    @param {Object[]} [dependent_keys[parentKey]] - Rules array for a given parent key
    @param {String[]} dependent_keys[parentKey][].keys - Dependent key names to add as required
    @param {Boolean|Integer|String[]} [dependent_keys[parentKey][].values] - (Optional) Parent key values that trigger the dependency. Null means any value

    @return {Error[]} response - Array of Error-Objects if required fields not sent
    @return {Boolean} response - false if valid data
    *********************************************************************/
    absenteeKeysCheckObject: function (
      obj, context, required_config,
      required_keys, dependent_keys = {}
    ) {

      // Initialize empty list of errors
      const errs = [];


      // Iterate through all dependent keys
      for ( const key in dependent_keys ) {

        // Only if this key is present in obj
        if ( !Utils.isNullOrUndefined( obj[key] ) ) {

          // Iterate all rules on this Key
          dependent_keys[key].forEach(function (rule) {

            // Test this Key's value against possible values
            if (
              Utils.isNullOrUndefined( rule['values'] ) || // Null means any value
              rule['values'].includes( obj[key] ) // Matches a possible allowed value
            ) {
              required_keys = [...required_keys, ...rule['keys']]; // Add dependeny-Keys to list of required-Keys
            }

          });

        }

      }


      // Iterate through all required keys
      required_keys.forEach(function ( key ) {

        // Check if value is null or undefined
        if (
          Utils.isUndefined( obj[key] ) || // Check for undefined
          (
            required_config[key]['not_null'] && // Only if null value is not allowed
            Utils.isNull( obj[key] ) // Check for null
          )
        ) {
          errs.push( // Error found. Add Error Object to List of Errors
            Utils.error( // Cerate Error Object
              required_config[key]['error'],
              context
            )
          );
        }

      });

      // Return Error if any
      return errs.length ? errs : false; // If Error List has more then 0 items, then return error list. Otherwise, false.

    },


    /********************************************************************
    Return Error-Object if validations for an object failed

    @param {Object} obj - Object to be checked
    @param {String} [context] - (Optional) Request context
    @param {Object[]} [validation_config] - Validation rules; each must pass or an error is added
    @param {Function} [validation_config[].func] - Function returning true if valid
    @param {String[]} validation_config[].params - Object keys passed as arguments to func
    @param {Set} validation_config[].error - Error to push when func returns false
    @param {Object[]} [invalidation_config] - Invalidation rules; each may return errors directly
    @param {Function} [invalidation_config[].func] - Function returning Error[] or false
    @param {String[]} invalidation_config[].params - Object keys passed as arguments to func

    @return {Error[]} response - Array of Error-Objects if required fields not sent
    @return {Boolean} response - false if valid data
    *********************************************************************/
    invalidKeysCheckObject: function (
      obj, context,
      validation_config, invalidation_config
    ) {

      // Initialize empty list of errors
      let errs = [];


      // Iterate through all validation rules
      if (validation_config) { // If any validation rules are sent in param
        validation_config.forEach(function ( validation_rule ) {

          // Only validate if param(s) are not null
          if (
            validation_rule['params'].every(function (param) { // Only validate if every param is not-null
              return !Utils.isNullOrUndefined(obj[param]);
            }) &&
            !Utils.isNullOrUndefined( validation_rule['func'] ) && // Only if function is not-null
            !validation_rule['func']( // Execute validation function with params
              ...validation_rule['params'].map(function (key) { // Iterate params - substitute 'key' with its value
                return obj[key];
              })
            )
          ) {
            errs.push( // Error found. Add Error Object to List of Errors
              Utils.error( // Cerate Error Object
                validation_rule['error'],
                context
              )
            );
          }

        });
      }


      // Iterate through all Invalidation rules
      if (invalidation_config) { // If any invalidation rules are sent in param
        invalidation_config.forEach(function ( invalidation_rule ) {

          // Only validate if param(s) are not null
          if (
            invalidation_rule['params'].every(function (param) { // Only validate if every param is not-null
              return !Utils.isNullOrUndefined(obj[param]);
            }) &&
            !Utils.isNullOrUndefined( invalidation_rule['func'] ) // Only if function is not-null
          ) {

            const obj_errs = invalidation_rule['func']( // Execute invalidation function with params
              ...invalidation_rule['params'].map(function (key) { // Iterate params - substitute 'key' with its value
                return obj[key];
              })
            );


            // If Errors found, then merge it to full list of errors
            if (obj_errs) {
              errs = [...errs, ...obj_errs];
            }

          }

        });
      }

      // Return Error if any
      return errs.length ? errs : false; // If Error List has more then 0 items, then return error list. Otherwise, false.

    },


    /********************************************************************
    Does both required-keys-check and invalid-keys-check for an Object
    Only checks for invalid-keys if there are no keys absent

    @param {Object} obj - Object to be checked
    @param {String[]} required_keys - List of required keys
    @param {Set} dependent_keys - List of keys which are required only if another key is present
    @param {Function} require_check_func - Function to check required-keys
    @param {Function} invalidate_check_func - Function to check invalid-keys

    @return {Error[]} response - Array of Error-Objects if invalid data
    @return {Boolean} response - false if valid data
    *********************************************************************/
    checkObjectData: function (
      obj, required_keys, dependent_keys,
      require_check_func, invalidate_check_func
    ) {

      // Return after checking required params and validations
      return (
        require_check_func( obj, required_keys, dependent_keys ) || // Return absentee-Keys-check errors if any
        invalidate_check_func( obj ) // Return invalid-keys-check errors if no absentee-Keys-check errors
      );

    },


    /********************************************************************
    Check and return Errors in each Object in a array

    @param {Set[]} objs_list - List of Partiton Items
    @param {Function} new_obj_check_func - Function to check required-keys of Deep-Object
    @param {Integer} [min_length] - (Optional) Minimum Length of Objects list (Including)
    @param {Error} [min_length_error] - (Optional) Error for Minimum Length
    @param {Integer} [max_length] - (Optional) Maximum Length of Objects list (Including)
    @param {Error} [max_length_error] - (Optional) Error for Maximum Length

    @return {Error} response - Error-Object if invalid data
    @return {Boolean} response - false if valid data
    *********************************************************************/
    checkNewObjectsList: function (
      objs_list,
      new_obj_check_func,
      min_length, min_length_error,
      max_length, max_length_error
    ) {

      let errs = [];


      // Check for Min length of Objects List (if found then push respective error)
      if (
        !Utils.isNullOrUndefined(min_length) &&
        objs_list.length < min_length
      ) {
        errs.push(min_length_error);
      }

      // Check for Max length of Objects List (if found then push respective error)
      if (
        !Utils.isNullOrUndefined(max_length) &&
        objs_list.length > max_length
      ) {
        errs.push(max_length_error);
      }


      // Iterate each obj in objs_list
      for ( const key in objs_list ) {

        // Check error
        const obj_errs = new_obj_check_func( objs_list[key] );

        // If Errors found, then merge it to full list of errors
        if (obj_errs) {
          errs = [...errs, ...obj_errs];
        }

      }

      // Return Errors if any
      return errs.length ? errs : false; // If Error List has more then 0 items, then return error list. Otherwise, false.

    },


    /********************************************************************
    Check and return Errors in each Object in a array
    Automatically Check if New or Edit or No-Change in object based on 'cmd'

    @param {Set[]} objs_list - List of Partiton Items
    @param {Function} new_obj_check_func - Function to check New Object
    @param {Function} edit_obj_check_func - Function to check Edit Object

    @return {Error} response - Error-Object if invalid data
    @return {Boolean} response - false if valid data
    *********************************************************************/
    checkEditObjectsList: function (
      objs_list,
      new_obj_check_func, edit_obj_check_func
    ) {

      let errs = [];

      // Iterate each obj in objs_list
      for ( const key in objs_list ) {

        // Check error
        let obj_errs;
        if ( objs_list[key]['command'] == 'new' ) {
          obj_errs = new_obj_check_func( objs_list[key] );
        }
        else { // Edit/No-Change
          obj_errs = edit_obj_check_func( objs_list[key] );
        }


        // If Errors found, then merge it to full list of errors
        if (obj_errs) {
          errs = [...errs, ...obj_errs];
        }

      }

      // Return Errors if any
      return errs.length ? errs : false; // If Error List has more then 0 items, then return error list. Otherwise, false.

    },


    // ~~~~~~~~~~~~~~~~~~~~ URL, CSV & Misc ~~~~~~~~~~~~~~~~~~~~
    // URL parsing, CSV conversion, module checks, and random generation.

    /********************************************************************
    Check if a node module is available

    @param {string} module_name - Request Instance object reference

    @return {Boolean} - True if module is available. False if not available
    *********************************************************************/
    moduleAvailable: function (module_name) {

      // Check if module is available
      try {
        require.resolve(module_name);
        return true; // Module found
      }
      catch {
        // Reach here means module not found
        return false;
      }

    },


    /********************************************************************
    Extract Protocol, Domain, Port, Path from a valid domain
    Example: https://user:pass@subdomain.example.com:8080/abc/pqr/query?param1=apple#section1

    @param {String} url - Full url

    @return {Boolean} - false if invalid URL
    @return {Object} - URL data object if valid
    @return {String} .origin - Scheme+Domain+Port ('https://subdomain.example.com:8080')
    @return {String} .protocol - Protocol including ':' ('https:')
    @return {String} .username - Username before domain ('user')
    @return {String} .password - Password before domain ('pass')
    @return {String} .hostname - Domain including subdomains ('subdomain.example.com')
    @return {String} .host - Hostname+Port ('subdomain.example.com:8080')
    @return {String} .port - Port number ('8080')
    @return {String} .pathname - Path not including query or fragment ('/abc/pqr/query')
    @return {String} .search - Query string including '?' ('?param1=apple')
    @return {String} .hash - Fragment including '#' ('#section1')
    *********************************************************************/
    disjoinUrl: function (url) {

      try {

        // Extract URL data
        const url_data = new URL(url);

        // Return URL Data
        return {
          origin: url_data['origin'], // 'https://subdomain.example.com:8080'
          protocol: url_data['protocol'], // 'https:'
          username: url_data['username'], // 'user'
          password: url_data['password'], // 'pass'
          hostname: url_data['hostname'], // 'subdomain.example.com'
          host: url_data['host'], // 'subdomain.example.com:8080'
          port: url_data['port'], // '8080'
          pathname: url_data['pathname'], // '/abc/pqr/query'
          search: url_data['search'], // '?param1=apple'
          hash: url_data['hash'] // '#section1'
        };

      }
      catch {
        return false; // Return false if Invalid/Malformed URL
      }

    },


    /********************************************************************
    Extract Routing Data from Path Data
    Example: /abc/pqr/query?param1=apple#section1

    @param {String} pathname - Path portion of URL, not including query string or fragment ('/abc/pqr/query')

    @return {Object} - Route data object
    @return {String} .route - First path segment ('abc')
    @return {String[]} .values - Remaining path segments (['pqr', 'query'])
    *********************************************************************/
    disjoinPathname: function (pathname) {

      // Remove Querystring or Hash from Pathname
      pathname = pathname.split(/[?#]/)[0];

      // Extract path values
      let path_data = pathname.split('/');

      // Clean Path Values by removing empty strings
      path_data = path_data.filter(function (value) {
        return !Utils.isEmptyString(value);
      });

      // Get Route from Pathname
      const route = Utils.fallback(
        path_data.shift(), // Remove and return first value from array
        null // fallback
      );

      // Return
      return {
        route: route,
        values: path_data
      };

    },


    /********************************************************************
    Convert CSV String to Data (CSV File Should have Header)

    @param {String} csv_data - CSV Data

    @return {Set[]} data - List of Objects
    *********************************************************************/
    convertCsvToData: function (csv_data) {

      // Create lines from CSV. Internally normalize line breaks (\rn). Internally removes empty lines.
      const lines = csv_data.replace(/\r\n/g, '\n').split('\n').filter(line => line.trim());

      // If no data lines, return empty array
      if ( lines.length <= 1 ) { // Either no line, or only header is present in file
        return []; // Return Empty Array (No data present)
      }

      // Get header keys from the first line of CSV
      const header = Utils.splitWithTrim(
        lines.shift(), // Get 1st item (0th Index) of Lines and remove it simultaneously
        ','
      );


      // iterate all lines and Return
      return lines.map(function (line) {

        // Convert line-string to array
        let data = Utils.splitWithTrim(line, ',');

        // Convert empty strings to undefined
        data = data.map(function (item) {
          return ( Utils.isEmptyString(item) ? void 0 : item );
        });

        return Utils.keyValueToObject(header, data);

      });

    },


    /********************************************************************
    Convert Data to CSV String
    NOTE: Headers are Automatically extracted from data

    @param {Set[]} records - List of Records as Objects

    @return {String} csv_data - CSV Data
    *********************************************************************/
    convertDataToCsv: function (records) {

      // Initialization
      let csv_data;
      let fields = [];
      const values = [];

      // If empty array (no data)
      if (records.length == 0) {
        return '';
      }

      // Extract keys from first record
      fields = Object.keys(records[0]);

      // Iterate over records
      records.forEach(function (record) {

        // Get array contain values of record
        const row = fields.map(function (field) {
          return Utils.fallback(record[field], ''); // if not found, replace with empty string
        });

        values.push( // Push string of row (array contain record values) values seperated by comma
          row.join(',') // join row (array contain record values) seperated by comma
        );

      });

      // Join fields array elements seperated by comma
      csv_data = fields.join(',') + '\n';

      // Join values array elements seperated by new line (\n)
      csv_data += values.join('\n');


      // Return CSV Data
      return csv_data;

    },


    /********************************************************************
    Convert Data to CSV String
    NOTE: Headers are explicitly specified along with data

    @param {Set[]} fields - Array of Column Names
    @param {Set[]} records - List of Objects

    @return {String} csv_data - CSV Data
    *********************************************************************/
    convertDataToCsv2: function (fields, records) {

      // Initialization
      let csv_data;
      const values = [];

      // If empty array (no data)
      if (records.length == 0) {
        return '';
      }


      // Iterate over records
      records.forEach(function (record) {

        // Get array contain values of record
        const row = fields.map(function (field) {
          return Utils.fallback(record[field], ''); // if not found, replace with empty string
        });

        values.push( // Push string of row (array contain record values) values seperated by comma
          row.join(',') // join row (array contain record values) seperated by comma
        );

      });

      // Join fields array elements seperated by comma
      csv_data = fields.join(',') + '\n';

      // Join values array elements seperated by new line (\n)
      csv_data += values.join('\n');


      // Return CSV Data
      return csv_data;

    },


    /********************************************************************
    Generate Unique string.
    Use this method for generating non-secure random-ids only.
    For secure random string, prefer crypto library.

    @param {Number} length - length of Unique string

    @return {String} - Unique string
    *********************************************************************/
    generateRandomString: function (length) {

      // Standard character set
      const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let result = '';

      // LCG parameters
      // 'm', 'a', and 'c' are constants used in the LCG algorithm
      const m = Math.pow(2, 32);
      const a = 1664525;
      const c = 1013904223;

      // Using the current timestamp as an initial seed value for the LCG
      let seed = Date.now();

      // LCG function to generate pseudo-random numbers
      function lcg () {
        // Updating the seed value using the LCG formula
        seed = (a * seed + c) % m;
        // Normalizing the result to produce a number between 0 and 1
        return seed / m;
      }

      // Generating the random string
      for (let i = 0; i < length; i++) {
        // For each iteration, generate a pseudo-random number using the LCG,
        // multiply it by the length of the character set to get a random index,
        // and use this index to select a character from the character set.
        result += characters.charAt(Math.floor(lcg() * characters.length));
      }

      // Returning the final generated random string
      return result;

    }

  }; // Close Public Functions

  ////////////////////////////Public Functions END///////////////////////////////



  //////////////////////////Private Functions START//////////////////////////////
  const _Utils = { // Private functions accessible within this modules only

    /********************************************************************
    Return Deep Copy of an Object (For older version of nodeJS or browsers that do not support structuredClone)
    It uses recursion to handle nested objects and arrays.
    Only works for plain JavaScript objects and arrays.

    @param {Object} obj - Object to be deep cloned

    @return {Object} response - Deep copy of object
    @return {Error} response - Error if unsupported object
    *********************************************************************/
    deepCopyObjectPolyfill: function (obj) {

      // Initialize object's Copy
      let copy;

      // Handle the 3 simple types, and null or undefined
      if ( null == obj || 'object' != typeof obj ) {
        return obj;
      }

      // Handle Date
      if (obj instanceof Date) {
        copy = new Date();
        copy.setTime(obj.getTime());
        return copy;
      }

      // Handle Array
      if (obj instanceof Array) {
        copy = [];
        for (let i = 0, len = obj.length; i < len; i++) {
          copy[i] = Utils.deepCopyObject(obj[i]);
        }
        return copy;
      }

      // Handle Object
      if (obj instanceof Object) {
        copy = {};
        for (const attr in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, attr)) {
            copy[attr] = Utils.deepCopyObject(obj[attr]);
          }
        }
        return copy;
      }

      // Reach here means unsupported object type
      throw new Error('Unable to copy obj. Its type is not supported.');

    }

  };///////////////////////////Private Functions END/////////////////////////////




  // Return public interface
  return Utils;

};/////////////////////////// createInterface END ///////////////////////////////
