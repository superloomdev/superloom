# API Reference. `js-helper-utils`

Every exported function on the public interface, with parameters, return shape, and notes. For loader and dependency notes see [Configuration](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-core/js-helper-utils/docs/configuration.md).

## On This Page

- [Conventions](#conventions)
- [Type Checks](#type-checks)
- [Object and Array Helpers](#object-and-array-helpers)
- [String Helpers](#string-helpers)
- [Number and Math](#number-and-math)
- [Validation](#validation)
- [URL and Path Parsing](#url-and-path-parsing)
- [CSV and Misc](#csv-and-misc)

---

## Conventions

Every function in this module is **synchronous, side-effect-free, and platform-agnostic**. There is no async function, no `instance` argument, no `success / data / error` envelope. Each function returns the type its name implies.

| Pattern | Behaviour |
|---|---|
| **Type checks** (`isString`, `isNumber`, `isObject`, etc.) | Return `Boolean`. Never throw |
| **Sanitizers** (`sanitizeObject`, `sanitizeInteger`) | Return a cleaned value. Return `null` (or the input unchanged) when the input is unsupported |
| **Converters** (`stringToJSON`, `stringToNumber`, `convertCsvToData`) | Return the converted value, or `null` if the input cannot be converted |
| **Validators** (`validateString`, `validateNumber`, `checkObjectData`) | Return `Boolean`. Some take callback functions for context-specific failure handling |
| **`error()`** | Returns a normalized `Error` instance with `code`, `name`, and `context`. The only function that constructs an exception (it does not throw) |

`null` is a common return value for "input was unsupported"; consumers should branch on it rather than rely on a thrown exception. The two exceptions are `isEmptyString(str)` and `isEmptyObject(obj)` which assume their argument is the named type and can throw if called with `null` or `undefined`. Use the type-check function first, or use `isEmpty(arg)` which handles `null` and `undefined` itself.

---

## Type Checks

Fourteen single-purpose checks. Every one returns `Boolean` and never throws.

| Function | Signature | Note |
|---|---|---|
| `isNull` | `isNull(arg)` | `true` only for strict `null`. Not `undefined` |
| `isUndefined` | `isUndefined(arg)` | `true` only for strict `undefined`. Not `null` |
| `isNullOrUndefined` | `isNullOrUndefined(arg)` | `true` for either. Implemented via `arg == null` |
| `isBoolean` | `isBoolean(arg)` | `typeof arg === 'boolean'` |
| `isNumber` | `isNumber(arg)` | `typeof arg === 'number'` **and** not `NaN`. `isNaN` is **not** a number |
| `isString` | `isString(arg)` | `typeof arg === 'string'` |
| `isInteger` | `isInteger(num)` | Whole number. `10.0` is integer, `10.7` is not. Assumes `num` is a number |
| `isObject` | `isObject(arg)` | Any non-null object including arrays, `Date`, `RegExp`. Use `Array.isArray` to distinguish arrays |
| `isFunction` | `isFunction(arg)` | `typeof arg === 'function'` |
| `isError` | `isError(arg)` | `arg instanceof Error`. Cross-realm `Error` instances will not be detected |
| `isEmptyString` | `isEmptyString(str)` | `str.length === 0`. Assumes `str` is a string. Use `isEmpty` for safe variant |
| `isEmptyObject` | `isEmptyObject(obj)` | `Object.keys(obj).length === 0`. Assumes `obj` is an object |
| `isEmpty` | `isEmpty(arg)` | `true` for `null`, `undefined`, `''`, `[]`, `{}`. The canonical "is this value uninteresting" check |
| `inArray` | `inArray(arr, element)` | `arr.indexOf(element) > -1`. Assumes `arr` is an array |

> **Why `isEmpty` is canonical.** Every Superloom helper module that needs an empty-check uses this function, not its own. Adopting `isEmpty` removes a class of subtle bugs where two parts of a codebase disagree about whether `0` or `false` count as empty. `isEmpty(0)` is `false`. `isEmpty(false)` is `false`. Numbers and booleans are never "empty"; only `null`, `undefined`, empty strings, empty arrays, and empty objects are.

---

## Object and Array Helpers

Eleven helpers for non-mutating object and array work.

### `deepCopyObject(obj)`

Returns a deep copy. Internally uses `structuredClone` when available, falls back to `deepCopyObjectPolyfill` otherwise. Handles plain objects, arrays, `Date`, `RegExp`, primitives, and circular references (via `structuredClone`). Does **not** copy functions or class instances.

### `deepCopyObjectPolyfill(obj)`

Pure-JavaScript deep clone. Used internally as the fallback for `deepCopyObject` when `structuredClone` is unavailable. Exposed publicly so callers who specifically need the polyfill behaviour (no circular-reference handling) can opt in.

### `compareObjects(a, b)`

Deep equality. `true` when every key, every nested value, every array index matches. Behaviour mirrors Node's `assert.deepStrictEqual` but as a `Boolean`-returning function.

### `sanitizeObject(obj, whitelist, blacklist)`

Returns a shallow copy with the `blacklist` keys removed and only the `whitelist` keys retained. Either argument can be omitted. Returns `null` if `obj` is null/undefined or not an object.

```javascript
const safe_user = Utils.sanitizeObject(user, null, ['password', 'pin']);
// safe_user has every key except password and pin
```

### `overrideObject(base_obj, ...new_objs)`

Shallow merge. Later objects' non-null values overwrite earlier ones. `null` and `undefined` values are skipped (so `overrideObject({a:1}, {a:null})` keeps `{a:1}`). Use this for "merge config defaults with user overrides" patterns.

### `setNonEmptyKey(obj, key, new_val)`

Sets `obj[key] = new_val` only if `new_val` is non-empty (per `isEmpty`). Returns `obj`. Useful when building DTOs where empty fields must be omitted entirely rather than serialized as `null`.

### `fallback(new_val, fallback_val)`

Returns `new_val` if non-empty, otherwise `fallback_val`. Equivalent to "use this if it has a value, else default".

### `sanitizeArray(list, sanitize_func)`

Returns a new array where each item has been passed through `sanitize_func`. Items where the function returns `null` or `undefined` are dropped.

### `arrayDistint(arr)`

De-duplicates. Returns the input unchanged if it is not an array.

### `keyValueToObject(keys, values)`

Builds an object from two parallel arrays: `{ keys[i]: values[i] }`. Useful for converting database row arrays into objects.

### `safeJoin(list, separator)`

Calls `Array.prototype.join` if `list` is an array, returns `list` unchanged otherwise. Useful when handling input that *might* be an array but might also be a single string.

---

## String Helpers

| Function | Signature | Note |
|---|---|---|
| `stringReverse` | `stringReverse(str)` | Reverses a string. ASCII and most BMP Unicode. Surrogate pairs and grapheme clusters may render incorrectly |
| `stringToJSON` | `stringToJSON(str)` | Safe `JSON.parse`. Returns `null` on parse failure or `null` input. Never throws |
| `stringToNumber` | `stringToNumber(str)` | Convert string to number with validation. Returns `null` for non-numeric strings |
| `stringToArray` | `stringToArray(delimiter, str)` | Split + trim + lowercase each token. Convention: `delimiter` first, then `str` |
| `splitWithTrim` | `splitWithTrim(str, delimiter)` | Split + trim. Does **not** lowercase. Convention: `str` first, then `delimiter` |
| `sanitizeUsingRegx` | `sanitizeUsingRegx(str, regx)` | Removes characters not matching the regex |

> **Argument order pitfall.** `stringToArray` takes the delimiter first while `splitWithTrim` takes the string first. The two functions are intentionally separate (different output) but the order divergence is historic. Read carefully.

---

## Number and Math

| Function | Signature | Note |
|---|---|---|
| `sanitizeInteger` | `sanitizeInteger(num)` | Convert to integer with `NaN` handling. Returns `null` for un-coercible inputs |
| `sanitizeBoolean` | `sanitizeBoolean(bool)` | Convert to a strict boolean. Truthy strings (`"true"`, `"1"`) become `true` |
| `round` | `round(num, digits_after_decimal)` | Round to N decimal places. Uses standard rounding |
| `roundWithCascading` | `roundWithCascading(num, digits_after_decimal, safety)` | Cascading rounding. Reduces floating-point drift on iterated rounds. Use for currency calculations where precision matters across multiple operations |
| `getUnixTime` | `getUnixTime(date)` | Unix timestamp in **seconds**. Pass a `Date` or millisecond number |
| `getUnixTimeInMilliSeconds` | `getUnixTimeInMilliSeconds(date)` | Unix timestamp in **milliseconds** |

---

## Validation

Validation has two tiers: simple value validators and the four-function "object-shape" mini-framework.

### Value Validators

| Function | Signature | Note |
|---|---|---|
| `validateString` | `validateString(str, min_length, max_length)` | `true` if `str` is a string within the inclusive length range |
| `validateStringRegx` | `validateStringRegx(str, regx, min_length, max_length)` | Validates length **and** matches the regex |
| `validateNumber` | `validateNumber(num, min_value, max_value)` | Validates numeric range |

### Object Shape Validators

A small framework for validating the shape of incoming data (typically request bodies). Three concepts compose into the public interface:

- **Required keys.** Keys that must be present on the object.
- **Dependent keys.** Keys whose presence requires another key to also be present.
- **Validation rules.** A map of `key → check function`. The check function receives the value and a context, and returns truthy on valid.

#### `absenteeKeysCheckObject(obj, context, required_config, required_keys, dependent_keys)`

Returns `true` if all required keys are present and all dependent-key constraints are satisfied. The `context` argument is forwarded to user-supplied checks.

#### `invalidKeysCheckObject(obj, context, validation_config, invalidation_config)`

Returns `true` if every key in `obj` passes its corresponding validation rule and no key matches an invalidation rule.

#### `checkObjectData(obj, required_keys, dependent_keys, require_check_func, invalidate_check_func)`

The combined check. Runs `absenteeKeysCheckObject` then `invalidKeysCheckObject` and returns the AND.

#### `checkNewObjectsList(objs_list, new_obj_check_func, min_length, min_length_error, max_length, max_length_error)`

Validates an array of objects. Each item is passed through `new_obj_check_func`. The list itself is range-checked. Returns `true` if every item passes and the list length is within bounds.

#### `checkEditObjectsList(objs_list, new_obj_check_func, edit_obj_check_func)`

Validates an array of objects where each item carries an implicit "new" or "edit" command. New items are validated by `new_obj_check_func`, edits by `edit_obj_check_func`.

> **Worked example.** The validation framework is most useful in DTO-style request handlers where the body is an array of "create or update" entries. The pattern: define one check function per object shape, pass it into `checkEditObjectsList`, branch on the boolean return. The framework does not throw; failure surfaces as `false`.

---

## URL and Path Parsing

| Function | Signature | Returns |
|---|---|---|
| `disjoinUrl` | `disjoinUrl(url)` | `{ protocol, domain, port, path, query, hash }`. Each field is a string or `null` |
| `disjoinPathname` | `disjoinPathname(pathname)` | Routing data extracted from the path (segments, query string, etc.) |

Useful in routing layers and link-rendering helpers. Both functions are pure string manipulation. They do not call `URL`, do not require a network, and work consistently in browser and Node.

---

## CSV and Misc

### CSV

| Function | Signature | Note |
|---|---|---|
| `convertCsvToData` | `convertCsvToData(csv_data)` | Parse CSV string. Returns an array of plain objects keyed by the header row |
| `convertDataToCsv` | `convertDataToCsv(records)` | Inverse: array of objects to CSV string. Header row is derived from the first record's keys |
| `convertDataToCsv2` | `convertDataToCsv2(fields, records)` | Same as `convertDataToCsv` but with an explicit field list. Use when records may have varying keys or when you want a stable column order |

### Errors

#### `error(err_obj, context)`

Returns a normalized `Error` instance:

| Property | Value |
|---|---|
| `message` | `err_obj.message` |
| `code` | `err_obj.code` |
| `name` | `err_obj.code.toString()` (so the stack trace shows the code, not the generic `Error`) |
| `context` | `context` argument, or `null` |

Does **not** throw. The caller decides whether to throw the returned object or attach it to a response.

#### `nullFunc()`

A no-op. Useful where an API requires a function but no behaviour is desired (`callback || Utils.nullFunc`).

### Module Management

#### `moduleAvailable(module_name)`

Returns `true` if `require(module_name)` would succeed. Implemented via `require.resolve` and a try/catch. Useful for optional-dependency code paths.

### Random

#### `generateRandomString(length)`

Returns a pseudo-random alphanumeric string of the requested length. **Not cryptographically secure.** Use `js-server-helper-crypto` or `js-client-helper-crypto` for security-sensitive randomness (tokens, IDs, salts).

---

## Lifecycle

There is nothing to clean up. The module exposes only pure synchronous functions. Loader-time initialization captures the function bindings in a closure (the [Server Loader Architecture](https://github.com/superloomdev/superloom/blob/main/docs/architecture/server-loader.md) defines this pattern); after that, no module-level state changes for the lifetime of the process.

For module-level setup details (loader signature, why `Lib` and config arguments are accepted but not read) see [Configuration → Loader Pattern](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-core/js-helper-utils/docs/configuration.md#loader-pattern).
