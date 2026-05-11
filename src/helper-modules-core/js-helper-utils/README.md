# @superloomdev/js-helper-utils

[![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-brightgreen.svg)](https://nodejs.org)

A comprehensive utility library providing essential JavaScript functions for type checks, validation, and data manipulation. Part of the [Superloom](https://github.com/superloomdev/superloom).

> **Foundation module** - zero runtime dependencies by design. This module and `js-helper-debug` form the self-contained base layer. All other helper modules may depend on them, but never the reverse.

## Installation

Configure your project to use the GitHub Packages registry for the `@superloomdev` scope:

```bash
# .npmrc (project root)
@superloomdev:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_READ_PACKAGES_TOKEN}
```

Then install:

```bash
npm install @superloomdev/js-helper-utils
```

## Usage

```javascript
// In loader (shared_libs unused - Utils has no peer deps)
Lib.Utils = require('@superloomdev/js-helper-utils')(Lib, { /* config overrides */ });

// Type checking
Lib.Utils.isNullOrUndefined(value);

// Deep copy objects
const copy = Lib.Utils.deepCopyObject({ a: 1, b: { c: 2 } });

// JSON parsing with error handling
const data = Lib.Utils.stringToJSON('{"key": "value"}');
```

## Source

- **Repository:** [github.com/superloomdev/superloom](https://github.com/superloomdev/superloom)
- **Package:** [github.com/superloomdev/superloom/pkgs/npm/js-helper-utils](https://github.com/superloomdev/superloom/pkgs/npm/js-helper-utils)
- **Issues:** [github.com/superloomdev/superloom/issues](https://github.com/superloomdev/superloom/issues)

## API Reference

### Type Checking & Validation

#### Basic Type Checks
- `isNull(arg)` - Check if value is `null`
- `isUndefined(arg)` - Check if value is `undefined`
- `isNullOrUndefined(arg)` - Check if value is `null` or `undefined`
- `isBoolean(arg)` - Check if value is boolean
- `isNumber(arg)` - Check if value is a valid number (not NaN)
- `isString(arg)` - Check if value is string
- `isInteger(num)` - Check if number is whole number (no decimals)
- `isObject(arg)` - Check if value is any non-null object (includes arrays, Date, etc.)
- `isFunction(arg)` - Check if value is function
- `isError(arg)` - Check if value is Error instance

#### Empty Value Checks
- `isEmptyString(str)` - Check if string is empty `''`
- `isEmptyObject(obj)` - Check if object has no keys `{}`
- `isEmpty(arg)` - Comprehensive check for null/undefined/empty string/empty object/empty array
- `inArray(arr, element)` - Check if array contains specific element

### Data Manipulation

#### Object Operations
- `deepCopyObject(obj)` - Create deep copy of objects (uses `structuredClone` with polyfill fallback)
- `compareObjects(a, b)` - Deep comparison of objects (similar to Node.js `assert.deepStrictEqual`)
- `sanitizeObject(obj, whitelist, blacklist)` - Remove unwanted fields from object
- `overrideObject(base_obj, ...new_objs)` - Merge objects with non-null values
- `setNonEmptyKey(obj, key, new_val)` - Set value only if not null/undefined
- `fallback(new_val, fallback_val)` - Return value with fallback if null/undefined

#### Array Operations
- `sanitizeArray(list, sanitize_func)` - Apply sanitization function to each array item
- `arrayDistint(arr)` - Remove duplicate values from array
- `keyValueToObject(keys, values)` - Convert key-value arrays to object
- `safeJoin(list, separator)` - Safely join array with fallback for non-arrays

### String Utilities

#### String Manipulation
- `stringReverse(str)` - Reverse string (ASCII and some Unicode support)
- `stringToJSON(str)` - Parse JSON string with error handling
- `stringToNumber(str)` - Convert string to number with validation
- `stringToArray(delimiter, str)` - Split string to array with trimming and lowercase conversion
- `splitWithTrim(str, delimiter)` - Split string and remove whitespaces
- `sanitizeUsingRegx(str, regx)` - Remove characters not matching regex pattern

#### String Validation
- `validateString(str, min_length, max_length)` - Validate string length and type
- `validateStringRegx(str, regx, min_length, max_length)` - Validate string against regex with length constraints

### Number Utilities

#### Number Processing
- `sanitizeInteger(num)` - Convert to integer with NaN handling
- `sanitizeBoolean(bool)` - Convert to boolean value
- `round(num, digits_after_decimal)` - Round number to specified decimal places
- `roundWithCascading(num, digits_after_decimal, safety)` - Cascading rounding for precision
- `getUnixTime(date)` - Get Unix timestamp in seconds
- `getUnixTimeInMilliSeconds(date)` - Get Unix timestamp in milliseconds

#### Number Validation
- `validateNumber(num, min_value, max_value)` - Validate number within range

### Error Handling

#### Error Management
- `error(err_obj, context)` - Create custom error objects with code and context
- `nullFunc()` - Empty function for optional callbacks

### URL & Path Utilities

#### URL Processing
- `disjoinUrl(url)` - Extract URL components (protocol, domain, port, path, query, hash)
- `disjoinPathname(pathname)` - Extract routing data from path

### Data Format Conversion

#### CSV Operations
- `convertCsvToData(csv_data)` - Convert CSV string to array of objects
- `convertDataToCsv(records)` - Convert array of objects to CSV string
- `convertDataToCsv2(fields, records)` - Convert data to CSV with explicit headers

### Utility Functions

#### Random Generation
- `generateRandomString(length)` - Generate pseudo-random string (non-cryptographic)

#### Module Management
- `moduleAvailable(module_name)` - Check if Node.js module is available

### Data Validation Framework

#### Object Validation
- `absenteeKeysCheckObject(obj, context, required_config, required_keys, dependent_keys)` - Check for missing required keys
- `invalidKeysCheckObject(obj, context, validation_config, invalidation_config)` - Validate object against rules
- `checkObjectData(obj, required_keys, dependent_keys, require_check_func, invalidate_check_func)` - Combined validation
- `checkNewObjectsList(objs_list, new_obj_check_func, min_length, min_length_error, max_length, max_length_error)` - Validate array of objects
- `checkEditObjectsList(objs_list, new_obj_check_func, edit_obj_check_func)` - Validate objects with edit/new commands

## Testing

| Tier | Runtime | Status |
|---|---|---|
| **Unit Tests** | Node.js `node --test` | [![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml) |

Run locally:

```bash
cd _test
npm install && npm test
```

See [Module Testing](https://github.com/superloomdev/superloom/blob/main/docs/architecture/module-testing.md) for the full testing architecture.

## License

MIT
