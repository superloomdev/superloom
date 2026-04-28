# js-helper-time

Date/Time utility library. Platform-agnostic date math, timezone handling, formatting. Native JS Date and Intl APIs, no external dependencies.

## Type
Core module. Stateless utility. Factory pattern for interface uniformity with other helpers.

## Peer Dependencies
- `@superloomdev/js-helper-utils` (injected as `Lib.Utils`)

## Direct Dependencies
None.

## Loader Pattern (Factory)

```javascript
Lib.Time = require('@superloomdev/js-helper-time')(Lib, { /* config overrides */ });
```

Each loader call returns an independent `Time` interface with its own `Lib` and `CONFIG` captured in closure. Functions are pure - no shared module-level state.

## Config Keys
| Key | Type | Default | Description |
|---|---|---|---|
| TIMEZONE_MIN_LENGTH | Number | 2 | Min valid length of timezone string (reserved) |
| TIMEZONE_MAX_LENGTH | Number | 50 | Max valid length of timezone string (reserved) |
| TIMEZONE_SANITIZE_REGEX | RegExp | `/[^0-9a-zA-Z/+\-_]/g` | Chars stripped from timezone input (reserved) |

Config values are currently reserved - not referenced by any public function. They are merged in the loader so callers can set them today and have them honoured by future validation helpers.

## Exported Functions (24 total)

All functions are synchronous. Unixtime values are in **seconds**.

### Day and Time Calculations

dayName(year, month, day) → String | async:no - 'sunday' | ... | 'saturday'
epochDay(hours?, minutes?, seconds?) → Integer | async:no - seconds past midnight
reverseEpochDay(day_in_seconds) → Array | async:no - [hours, minutes, seconds]
time24ToSeconds(time_24h) → Integer | async:no - '2330' → 84600

### Unixtime and Date Conversions

unixtimeToDate(unixtime) → Date | async:no
dateToUnixtime(date) → Integer | async:no - seconds since epoch
unixtimeToDateString(unixtime) → String | async:no - ISO 8601
dateStringToUnixtime(date_string) → Integer | async:no
unixtimeToUtcString(unixtime) → String | async:no - 'Wed, 21 Oct 2015 07:28:00 GMT'
utcStringToUnixtime(date_string) → Integer | async:no
unixtimeToUnixDay(unixtime) → Integer | async:no - start of day (00:00:00 UTC) as unixtime

### Date Data Set (structured { year, month, day, hh, mm, ss })

dateDataSet(year, month, day, hours?, minutes?, seconds?) → Object | async:no - plural-key build shape
dateStringToDataSet(date_string) → Object | async:no - singular-key parse shape (String values)
dateToDataSet(date) → Object | async:no - singular-key parse shape
dateDataSetToDate(date_data) → Date | async:no - UTC
dateDataSetToDateString(date_data) → String | async:no - ISO 8601
dateDataSetToUnixtime(date_data) → Integer | async:no

### Time Formatting

formatHourMinTo12HourTime(hours, minutes) → String | async:no - '4:30 PM'
secondsToTimeString(seconds) → String | async:no - '10:05 AM'; '' for null/undefined/empty

### Timezone Operations

calcTimeWithOffset(unixtime, offset) → Integer | async:no
getTimezoneOffset(unixtime, timezone) → Integer | async:no - DST-aware, seconds
unixtimeToTimezoneTime(unixtime, timezone) → Integer | async:no - wall-clock as unixtime
unixtimeToTimezoneDate(unixtime, timezone) → Date | async:no - wall-clock Date

### Calendar

getLastDayOfMonth(year, month) → String | async:no - '28' / '29' / '30' / '31'

## Patterns

- **Factory per loader:** every loader call returns its own `Time` interface. No module-level singletons.
- **Pure functions:** all operations are deterministic transformations. No I/O, no side effects.
- **Unixtime in seconds:** every unixtime param and return is in SECONDS (not milliseconds)
- **Timezone strings:** standard IANA names (`'America/New_York'`, `'UTC'`, `'Asia/Kolkata'`)
- **Data Set shape variants:** plural keys (`hours`, `minutes`, `seconds`) produced by `dateDataSet()`; singular keys (`hour`, `minute`, `second`) produced by `dateStringToDataSet()` / `dateToDataSet()`. Both consumable by `dateDataSetToDate()`, which uses plural keys and treats missing time components as 0.
- **Lib.Utils usage:** only `Lib.Utils.isNullOrUndefined` in `secondsToTimeString`. All other functions are self-contained.
