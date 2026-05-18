# js-helper-money

Money utility library. Currency metadata, float-safe rounding, formatting, and aggregation. Native JS, no external dependencies.

## Type

Core module. Stateless utility. Factory pattern.

## Peer Dependencies

| Peer | Why |
|---|---|
| `@superloomdev/js-helper-utils` | Used by `roundAmount`, `formatAmount`, `sum`, and `calculateTotalFromDenominations` for rounding, null-checks, and integer conversion |
| `@superloomdev/js-helper-debug` | Reserved for future logging (injected but not currently used) |

## Direct Dependencies

None.

## Loader Pattern (Factory)

```javascript
Lib.Money = require('@superloomdev/js-helper-money')(Lib, { /* config overrides */ });
```

Each loader call returns an independent `Money` interface with its own merged configuration captured in a closure. Functions are pure - no shared module-level state between instances.

## Config Keys

| Key | Type | Default | Description |
|---|---|---|---|
| `DEFAULT_CURRENCY_CODE` | `String` | `'usd'` | Default currency code (reserved for future use) |
| `CURRENCY_CODE_MIN_LENGTH` | `Number` | `3` | Reserved. Minimum valid length of a currency code |
| `CURRENCY_CODE_MAX_LENGTH` | `Number` | `3` | Reserved. Maximum valid length of a currency code |
| `CURRENCY_CODE_SANITIZE_REGEX` | `RegExp` | `/[^a-zA-Z]/g` | Reserved. Characters stripped from sanitized input |

Config values are currently reserved - not referenced by any current public function. They are merged in the loader so callers can set them today and have them honoured by future validation helpers.

## Exported Functions (13 total)

All functions are synchronous. Currency codes are case-insensitive on input.

### Currency Metadata

| Function | Signature | Returns |
|---|---|---|
| `isCurrencyCode` | `isCurrencyCode(code)` | `Boolean` - true if code is known |
| `getCurrencySymbol` | `getCurrencySymbol(currency_code)` | `String\|null` - native symbol (e.g., '₹', '$') |
| `getCurrencySymbolForLocale` | `getCurrencySymbolForLocale(currency_code, country_code, language_code)` | `String\|null` - locale-aware symbol selection |
| `getCurrencySymbolMinor` | `getCurrencySymbolMinor(currency_code)` | `String\|null` - native minor symbol (e.g., '¢') |
| `getCurrencySymbolMinorForLocale` | `getCurrencySymbolMinorForLocale(currency_code, country_code, language_code)` | `String\|null` - locale-aware minor symbol |
| `getCurrencyDecimals` | `getCurrencyDecimals(currency_code)` | `Integer\|null` - decimal places (typically 2) |
| `getCurrencyMinTransactionalUnit` | `getCurrencyMinTransactionalUnit(currency_code)` | `Number\|null` - smallest transactable unit |
| `getCurrencyDenominations` | `getCurrencyDenominations(currency_code)` | `Object\|null` - `{minor: [...], major: [...]}` |

### Rounding and Formatting

| Function | Signature | Returns |
|---|---|---|
| `roundAmount` | `roundAmount(amount, currency_code, decimals?)` | `Number` - rounded amount |
| `formatAmount` | `formatAmount(amount, currency_code, decimals?, no_pad?)` | `String` - formatted string |

### Transactional Amounts

| Function | Signature | Returns |
|---|---|---|
| `getTransactionalAmount` | `getTransactionalAmount(amount, currency_code, decimals?, apply_min_unit?)` | `Number` - rounded to min unit |
| `toFractionalUnits` | `toFractionalUnits(amount, currency_code, decimals?)` | `Integer` - e.g., 1057 cents |
| `fromFractionalUnits` | `fromFractionalUnits(amount, currency_code, decimals?)` | `Number` - e.g., 10.57 |

### Aggregation

| Function | Signature | Returns |
|---|---|---|
| `sum` | `sum(amounts[], currency_code, decimals?)` | `Number` - float-safe sum |
| `calculateTotalFromDenominations` | `calculateTotalFromDenominations(majors?, minors?, currency_code, decimals?, apply_min_unit?)` | `Number` - total from denomination counts |

## Patterns

- **Factory per loader:** every loader call returns its own `Money` interface. No module-level singletons.
- **Pure functions:** all operations are deterministic transformations. No I/O, no side effects.
- **Case-insensitive currency codes:** inputs are normalized to lowercase internally.
- **Locale separation:** `getCurrencySymbol` returns the native symbol always; `getCurrencySymbolForLocale` applies locale-aware selection logic.
- **Integer arithmetic for float safety:** `sum` and related functions convert to integer (cents/paise) internally, sum, then convert back. This prevents `0.1 + 0.2 = 0.30000000000000004` errors.
- **Min transactional unit vs decimals:** `decimals` is for display precision (2 for USD/INR); `min_transactional_unit` is for rounding rules (0.01 for USD, 1 for INR). A currency may have 2 decimals but round to whole units for transactions.
