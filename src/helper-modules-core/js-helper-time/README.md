# @superloomdev/js-helper-time

[![Test](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml/badge.svg?branch=main)](https://github.com/superloomdev/superloom/actions/workflows/ci-helper-modules.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-brightgreen.svg)](https://nodejs.org)

Date/Time utility library. Platform-agnostic date math, timezone conversion, and formatting using native JS `Date` and `Intl` APIs. Part of the [Superloom](https://github.com/superloomdev/superloom).

## Peer Dependencies (Injected via Loader)

- `@superloomdev/js-helper-utils` - injected as `Lib.Utils`

## Direct Dependencies (Bundled)

None.

## Installation

```bash
npm install @superloomdev/js-helper-time @superloomdev/js-helper-utils
```

## Exported Functions

Functions are grouped by responsibility. Unixtime values are always in **seconds**, not milliseconds.

### Day and Time Calculations

| Function | Params | Return | Description |
|---|---|---|---|
| `dayName` | `(year, month, day)` | `String` | Week day name for a date |
| `epochDay` | `(hours?, minutes?, seconds?)` | `Integer` | Seconds since midnight |
| `reverseEpochDay` | `(day_in_seconds)` | `[h, m, s]` | Convert seconds to H/M/S |
| `time24ToSeconds` | `(time_24h)` | `Integer` | 24-hour time to seconds: `'2330'` → `84600` |

### Unixtime and Date Conversions

| Function | Params | Return | Description |
|---|---|---|---|
| `unixtimeToDate` | `(unixtime)` | `Date` | Seconds → Date |
| `dateToUnixtime` | `(date)` | `Integer` | Date → seconds |
| `unixtimeToDateString` | `(unixtime)` | `String` | Seconds → ISO 8601 |
| `dateStringToUnixtime` | `(date_string)` | `Integer` | ISO 8601 → seconds |
| `unixtimeToUtcString` | `(unixtime)` | `String` | Seconds → UTC string |
| `utcStringToUnixtime` | `(date_string)` | `Integer` | UTC string → seconds |
| `unixtimeToUnixDay` | `(unixtime)` | `Integer` | Start of day for timestamp |

### Date Data Set

| Function | Params | Return | Description |
|---|---|---|---|
| `dateDataSet` | `(y, m, d, h, min, s)` | `Object` | Build date data set (plural keys) |
| `dateStringToDataSet` | `(date_string)` | `Object` | Parse ISO → data set (singular keys) |
| `dateToDataSet` | `(date)` | `Object` | Date → data set (singular keys) |
| `dateDataSetToDate` | `(date_data)` | `Date` | Data set → Date (UTC) |
| `dateDataSetToDateString` | `(date_data)` | `String` | Data set → ISO string |
| `dateDataSetToUnixtime` | `(date_data)` | `Integer` | Data set → seconds |

### Time Formatting

| Function | Params | Return | Description |
|---|---|---|---|
| `formatHourMinTo12HourTime` | `(hours, minutes)` | `String` | `'4:30 PM'` |
| `secondsToTimeString` | `(seconds)` | `String` | Seconds → `'10:05 AM'` |

### Timezone Operations

| Function | Params | Return | Description |
|---|---|---|---|
| `calcTimeWithOffset` | `(unixtime, offset)` | `Integer` | Add/subtract offset |
| `getTimezoneOffset` | `(unixtime, timezone)` | `Integer` | DST-aware offset in seconds |
| `unixtimeToTimezoneTime` | `(unixtime, timezone)` | `Integer` | UTC → timezone wall-clock time |
| `unixtimeToTimezoneDate` | `(unixtime, timezone)` | `Date` | UTC → timezone Date |

### Calendar

| Function | Params | Return | Description |
|---|---|---|---|
| `getLastDayOfMonth` | `(year, month)` | `String` | Last day of month (`'28'` / `'29'` / `'30'` / `'31'`) |

## Configuration

| Key | Default | Description |
|---|---|---|
| `TIMEZONE_MIN_LENGTH` | `2` | Min IANA timezone string length |
| `TIMEZONE_MAX_LENGTH` | `50` | Max IANA timezone string length |
| `TIMEZONE_SANITIZE_REGEX` | `/[^0-9a-zA-Z/+\-_]/g` | Valid timezone characters |

## Usage

The module is a factory - every loader call returns an independent `Time` interface. In practice, a project loads one instance on `Lib.Time`, but separate instances can be used in tests or when different callers need different config overrides.

```javascript
// In loader
Lib.Time = require('@superloomdev/js-helper-time')(Lib, {});

// Day operations
Lib.Time.dayName(2024, 1, 1);           // 'monday'
Lib.Time.epochDay(14, 30, 0);           // 52200
Lib.Time.time24ToSeconds('2330');       // 84600

// Conversions
Lib.Time.unixtimeToDateString(1600000000); // '2020-09-13T12:26:40.000Z'
Lib.Time.dateStringToUnixtime('2020-09-13T12:26:40.000Z'); // 1600000000

// Timezone
Lib.Time.getTimezoneOffset(1600000000, 'Asia/Kolkata'); // 19800
```

## Patterns

- **Factory per loader:** every loader call returns its own `Time` interface. Functions close over the `Lib` and `CONFIG` captured at loader time. No module-level singletons.
- **Pure functions:** all operations are deterministic transformations of their inputs. No I/O, no side effects.
- **Unixtime in seconds:** every unixtime parameter and return value is in **seconds** (not milliseconds). Convert with `* 1000` when interfacing with native `Date`.
- **Timezone strings:** standard IANA names (`'America/New_York'`, `'UTC'`, `'Asia/Kolkata'`).
- **Date Data Set shape:** two variants - plural keys (`{ year, month, day, hours, minutes, seconds }`) when building a date, singular keys (`{ year, month, day, hour, minute, second }`) when parsing an ISO string. Both variants are supported; pick the one produced by the helper you called.

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
