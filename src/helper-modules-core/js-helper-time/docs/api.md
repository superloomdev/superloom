# API Reference. `js-helper-time`

Every exported function on the public interface, with parameters, return shape, and notes. For loader and dependency notes see [Configuration](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-core/js-helper-time/docs/configuration.md).

## On This Page

- [Conventions](#conventions)
- [Day and Time Calculations](#day-and-time-calculations)
- [Unixtime and Date Conversions](#unixtime-and-date-conversions)
- [Date Data Set](#date-data-set)
- [Time Formatting](#time-formatting)
- [Timezone Operations](#timezone-operations)
- [Calendar](#calendar)
- [Lifecycle](#lifecycle)

---

## Conventions

Every function in this module is **synchronous, side-effect-free, and platform-agnostic**. There is no async function, no `instance` argument, no `success / data / error` envelope. Each function returns the type its name implies.

| Pattern | Behaviour |
|---|---|
| **Unixtime is in seconds.** | Every parameter and every return value labelled "unixtime" is an integer count of seconds since epoch. Multiply by 1000 to get milliseconds for the `Date` constructor |
| **Timezones are IANA strings.** | Pass `'UTC'`, `'America/New_York'`, `'Asia/Kolkata'`. Three-letter abbreviations are not supported |
| **Date-Data-Set has two key conventions.** | Plural keys (`hours`, `minutes`, `seconds`) come from `dateDataSet`; singular keys (`hour`, `minute`, `second`) come from `dateStringToDataSet` and `dateToDataSet`. The shapes are intentionally different and should not be mixed in the same call |
| **DST awareness.** | Timezone offset functions return the **actual** offset for the given unixtime, including DST transitions. They do not assume a fixed offset |
| **Errors.** | Functions that receive an unparseable string return the runtime's default error value (`NaN`, `Invalid Date`, etc.) rather than throwing. Validate inputs upstream when correctness matters |

---

## Day and Time Calculations

### `dayName(year, month, day)`

Returns the lower-cased English day name for a calendar date.

| Param | Type | Description |
|---|---|---|
| `year` | `number` | Four-digit year |
| `month` | `number` | 1-12. **Not** the JavaScript zero-based month |
| `day` | `number` | 1-31 |

| Returns | Description |
|---|---|
| `string` | One of `'sunday'`, `'monday'`, `'tuesday'`, `'wednesday'`, `'thursday'`, `'friday'`, `'saturday'` |

### `epochDay(hours?, minutes?, seconds?)`

Seconds elapsed since midnight. Useful when storing "time of day" independent of any specific date.

| Param | Type | Required | Description |
|---|---|---|---|
| `hours` | `number` | No | 0-23. Defaults to 0 |
| `minutes` | `number` | No | 0-59. Defaults to 0 |
| `seconds` | `number` | No | 0-59. Defaults to 0 |

| Returns | Description |
|---|---|
| `number` | Integer in the range `0` to `86399` |

### `reverseEpochDay(day_in_seconds)`

Inverse of `epochDay`. Decomposes a seconds-past-midnight value back to its components.

| Param | Type | Description |
|---|---|---|
| `day_in_seconds` | `number` | Integer in the range `0` to `86399` |

| Returns | Description |
|---|---|
| `[hours, minutes, seconds]` | Three-element array of integers |

### `time24ToSeconds(time_24h)`

Converts a 24-hour time string (no separator) to seconds-past-midnight. `'2330'` becomes `84600`.

| Param | Type | Description |
|---|---|---|
| `time_24h` | `string` | Four characters; `HHMM` |

| Returns | Description |
|---|---|
| `number` | Seconds past midnight |

---

## Unixtime and Date Conversions

| Function | Signature | Note |
|---|---|---|
| `unixtimeToDate` | `unixtimeToDate(unixtime)` | Returns a `Date`. Multiplies seconds to milliseconds internally |
| `dateToUnixtime` | `dateToUnixtime(date)` | Returns an integer. Inverse of `unixtimeToDate` |
| `unixtimeToDateString` | `unixtimeToDateString(unixtime)` | Returns an ISO 8601 string (e.g. `'2026-05-17T01:25:00.000Z'`) |
| `dateStringToUnixtime` | `dateStringToUnixtime(date_string)` | Parses an ISO 8601 string and returns unixtime in seconds |
| `unixtimeToUtcString` | `unixtimeToUtcString(unixtime)` | Returns an HTTP-style UTC string (e.g. `'Wed, 21 Oct 2015 07:28:00 GMT'`). Use for `Last-Modified` and `Expires` headers |
| `utcStringToUnixtime` | `utcStringToUnixtime(date_string)` | Inverse of `unixtimeToUtcString` |
| `unixtimeToUnixDay` | `unixtimeToUnixDay(unixtime)` | Truncates to the start of the UTC day. Useful for "group by day" aggregations |

> **Choose the right string format.** ISO 8601 is right for most application use; JSON serialization, database storage, and machine-readable logs. UTC strings are right for HTTP headers that the spec mandates in that format. Mixing the two leads to round-trip bugs.

---

## Date Data Set

A "data set" is a plain object representing a date and time as separate fields. The module exposes one builder, two parsers, and three serializers. The two parsers use **singular** keys (`hour`, `minute`, `second`) while the builder uses **plural** keys (`hours`, `minutes`, `seconds`).

### Builders

#### `dateDataSet(year, month, day, hours?, minutes?, seconds?)`

Constructs a date-data-set with **plural** keys. Hours, minutes, seconds default to 0.

```javascript
Lib.Time.dateDataSet(2026, 5, 17, 14, 30);
// { year: 2026, month: 5, day: 17, hours: 14, minutes: 30, seconds: 0 }
```

### Parsers

#### `dateStringToDataSet(date_string)`

Parses an ISO 8601 string into a data-set with **singular**, **string-typed** keys.

```javascript
Lib.Time.dateStringToDataSet('2026-05-17T14:30:00.000Z');
// { year: '2026', month: '05', day: '17', hour: '14', minute: '30', second: '00' }
```

> **Singular keys, string values.** This shape preserves zero-padding (`'05'` not `5`) and is intended for cases where the result feeds into a template or query string. For arithmetic, use `dateToDataSet` or convert via `Number()`.

#### `dateToDataSet(date)`

Parses a `Date` instance into a data-set with **singular**, **number-typed** keys.

### Serializers

#### `dateDataSetToDate(date_data)`

Builds a UTC `Date`. Reads **plural** keys; missing time components are treated as 0.

#### `dateDataSetToDateString(date_data)`

Builds an ISO 8601 string from a plural-keyed data set.

#### `dateDataSetToUnixtime(date_data)`

Builds a unixtime (seconds) from a plural-keyed data set.

> **Mixing key conventions.** The serializers above expect plural keys. If you parsed with `dateStringToDataSet` (singular keys) and want to serialize, either rewrite the keys to plural or go via `dateStringToUnixtime` and `unixtimeToDate*`.

---

## Time Formatting

### `formatHourMinTo12HourTime(hours, minutes)`

24-hour input, 12-hour output with AM/PM suffix.

```javascript
Lib.Time.formatHourMinTo12HourTime(16, 30);
// '4:30 PM'
```

### `secondsToTimeString(seconds)`

Seconds-past-midnight to a 12-hour formatted time. Returns the empty string when the input is null, undefined, or empty.

```javascript
Lib.Time.secondsToTimeString(36300);
// '10:05 AM'
Lib.Time.secondsToTimeString(null);
// ''
```

---

## Timezone Operations

All four functions are DST-aware. They use the runtime's built-in `Intl.DateTimeFormat` to compute the actual offset for the given unixtime, including DST transitions.

### `calcTimeWithOffset(unixtime, offset)`

Adds an offset (in seconds) to a unixtime. Useful when you have a base unixtime and a known offset; it does not look up timezone data.

| Param | Type | Description |
|---|---|---|
| `unixtime` | `number` | Unixtime in seconds |
| `offset` | `number` | Offset in seconds. Negative for west of UTC |

### `getTimezoneOffset(unixtime, timezone)`

Returns the offset (in seconds) for a given unixtime in a given IANA timezone. DST-aware: an `'America/New_York'` query in January returns -18000 (-5 hours), in July returns -14400 (-4 hours).

```javascript
Lib.Time.getTimezoneOffset(1736784000, 'America/New_York'); // January
// -18000

Lib.Time.getTimezoneOffset(1721102400, 'America/New_York'); // July
// -14400
```

### `unixtimeToTimezoneTime(unixtime, timezone)`

Returns the **wall-clock time** in the target timezone, expressed as a unixtime as if that wall-clock time had occurred in UTC. Useful for "format this UTC moment as it would appear on a clock in Mumbai".

### `unixtimeToTimezoneDate(unixtime, timezone)`

Same as above but returns a `Date` instead of a unixtime. The `Date` is "wrong" in the sense that its UTC components encode the local-wall-clock components of the target timezone; this is the documented and intentional shape for use with formatters that read those components.

---

## Calendar

### `getLastDayOfMonth(year, month)`

Returns the last day of the given month, accounting for leap years.

| Param | Type | Description |
|---|---|---|
| `year` | `number` | Four-digit year |
| `month` | `number` | 1-12 |

| Returns | Description |
|---|---|
| `string` | One of `'28'`, `'29'`, `'30'`, `'31'` |

> **String, not number.** The return type is intentionally a string for direct concatenation into ISO 8601 strings. Convert via `parseInt` if you need arithmetic.

---

## Lifecycle

There is nothing to clean up. The module exposes only pure synchronous functions. Loader-time initialization captures the function bindings in a closure (the [Server Loader Architecture](https://github.com/superloomdev/superloom/blob/main/docs/server/server-loader.md) defines this pattern); after that, no module-level state changes for the lifetime of the process.

For module-level setup details (loader signature, peer-dep notes) see [Configuration → Loader Pattern](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-core/js-helper-time/docs/configuration.md#loader-pattern).
