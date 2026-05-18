# API Reference. `js-helper-money`

Every exported function on the public interface, with parameters, return shape, and notes. For loader and dependency notes see [Configuration](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-core/js-helper-money/docs/configuration.md).

## On This Page

- [Conventions](#conventions)
- [Currency Metadata](#currency-metadata)
- [Rounding and Formatting](#rounding-and-formatting)
- [Transactional Amounts](#transactional-amounts)
- [Aggregation](#aggregation)
- [Lifecycle](#lifecycle)

---

## Conventions

Every function in this module is **synchronous, side-effect-free, and platform-agnostic**. There is no async function, no `instance` argument, no success/data/error envelope. Each function returns the type its name implies.

| Pattern | Behaviour |
|---|---|
| **Currency codes are case-insensitive.** | `'USD'`, `'usd'`, and `'Usd'` are all valid and equivalent |
| **Unknown currency codes return null for metadata.** | `getCurrencySymbol('xyz')` returns `null`; `getCurrencyDecimals('xyz')` returns `null` |
| **Arithmetic functions assume valid input.** | `roundAmount`, `sum`, `formatAmount` do not validate the currency code; callers should validate first via `isCurrencyCode` |
| **Min transactional unit vs decimals.** | `decimals` is for display precision (typically 2); `min_transactional_unit` is for rounding rules. INR has `decimals: 2` (display as 15.00) but `min_transactional_unit: 1` (round to whole rupees for transactions) |
| **Integer arithmetic internally.** | Functions like `sum` convert to integer (cents/paise), sum, then convert back. This prevents floating-point errors like `0.1 + 0.2 = 0.30000000000000004` |
| **Denominations are strings.** | The `denominations.minor` and `denominations.major` arrays contain string values (e.g., `"50"`, `"100"`) as defined in the currency data |

---

## Currency Metadata

### `isCurrencyCode(code)`

Returns `true` if the provided code is a known currency, `false` otherwise. Case-insensitive. Returns `false` for empty, null, or undefined inputs.

| Param | Type | Description |
|---|---|---|
| `code` | `String` | Currency code to check |

| Returns | Description |
|---|---|
| `Boolean` | True if known (e.g., `'usd'`, `'INR'`), false otherwise |

---

### `getCurrencySymbol(currency_code)`

Returns the native currency symbol.

| Param | Type | Description |
|---|---|---|
| `currency_code` | `String` | Currency code |

| Returns | Description |
|---|---|
| `String\|null` | Native symbol (e.g., `'₹'`, `'$'`, `'€'`), or null if unknown |

```javascript
Lib.Money.getCurrencySymbol('inr');  // '₹'
Lib.Money.getCurrencySymbol('USD');  // '$'
Lib.Money.getCurrencySymbol('xyz');  // null
```

---

### `getCurrencySymbolForLocale(currency_code, country_code, language_code)`

Returns the currency symbol considering locale preferences. If the country/language combination supports the currency in the internal language table, returns the native symbol; otherwise returns the standard symbol (e.g., `'INR'`, `'USD'`).

| Param | Type | Description |
|---|---|---|
| `currency_code` | `String` | Currency code |
| `country_code` | `String` | Country code (e.g., `'in'`, `'us'`) |
| `language_code` | `String` | Language code (e.g., `'hi_in'`, `'en_us'`) |

| Returns | Description |
|---|---|
| `String\|null` | Selected symbol, or null if unknown currency |

```javascript
Lib.Money.getCurrencySymbolForLocale('inr', 'in', 'hi_in');  // '₹'
Lib.Money.getCurrencySymbolForLocale('inr', 'us', 'en_us');  // 'INR'
Lib.Money.getCurrencySymbolForLocale('usd', 'us', 'en_us');  // '$'
```

---

### `getCurrencySymbolMinor(currency_code)`

Returns the native minor currency symbol (e.g., `'¢'` for USD, `'ส'` for THB).

| Param | Type | Description |
|---|---|---|
| `currency_code` | `String` | Currency code |

| Returns | Description |
|---|---|
| `String\|null` | Native minor symbol, or null if not defined/unknown |

---

### `getCurrencySymbolMinorForLocale(currency_code, country_code, language_code)`

Locale-aware variant for minor symbols.

| Param | Type | Description |
|---|---|---|
| `currency_code` | `String` | Currency code |
| `country_code` | `String` | Country code |
| `language_code` | `String` | Language code |

| Returns | Description |
|---|---|
| `String\|null` | Minor symbol based on locale, or null |

---

### `getCurrencyDecimals(currency_code)`

Returns the number of decimal places for the currency.

| Param | Type | Description |
|---|---|---|
| `currency_code` | `String` | Currency code |

| Returns | Description |
|---|---|
| `Integer\|null` | Decimal places (typically 2), or null if unknown |

```javascript
Lib.Money.getCurrencyDecimals('usd');  // 2
Lib.Money.getCurrencyDecimals('inr');  // 2
```

---

### `getCurrencyMinTransactionalUnit(currency_code)`

Returns the minimum transactional unit for the currency. This is the smallest amount that can be transacted.

| Param | Type | Description |
|---|---|---|
| `currency_code` | `String` | Currency code |

| Returns | Description |
|---|---|
| `Number\|null` | Minimum unit (e.g., `0.01` for USD, `1` for INR), or null |

```javascript
Lib.Money.getCurrencyMinTransactionalUnit('usd');  // 0.01
Lib.Money.getCurrencyMinTransactionalUnit('inr');  // 1
Lib.Money.getCurrencyMinTransactionalUnit('cny');  // 1
```

---

### `getCurrencyDenominations(currency_code)`

Returns the available denominations for a currency.

| Param | Type | Description |
|---|---|---|
| `currency_code` | `String` | Currency code |

| Returns | Description |
|---|---|
| `Object\|null` | `{minor: [...], major: [...]}` with string values, or null if unknown or currency has no denominations (e.g., CNY) |

```javascript
Lib.Money.getCurrencyDenominations('usd');
// { minor: ['1', '5', '10', '25', '50'], major: ['1', '2', '5', '10', '20', '50', '100'] }

Lib.Money.getCurrencyDenominations('cny');  // null (no denominations defined)
```

---

## Rounding and Formatting

### `roundAmount(amount, currency_code, decimals?)`

Round an amount to the correct number of decimal places for the currency. Uses `Lib.Utils.round` internally.

| Param | Type | Required | Description |
|---|---|---|---|
| `amount` | `Number` | Yes | Amount to round |
| `currency_code` | `String` | Yes | Currency code |
| `decimals` | `Number` | No | Override decimal places |

| Returns | Description |
|---|---|
| `Number` | Rounded amount |

```javascript
Lib.Money.roundAmount(15.678, 'usd');        // 15.68
Lib.Money.roundAmount(15.678, 'usd', 1);     // 15.7
Lib.Money.roundAmount(15.678, 'usd', 0);     // 16
```

---

### `formatAmount(amount, currency_code, decimals?, no_pad?)`

Format an amount as a string with correct decimal places. Adds trailing zeros by default unless `no_pad` is true and the result is a whole number.

| Param | Type | Required | Description |
|---|---|---|---|
| `amount` | `Number` | Yes | Amount to format |
| `currency_code` | `String` | Yes | Currency code |
| `decimals` | `Number` | No | Override decimal places |
| `no_pad` | `Boolean` | No | If true, don't add trailing zeros for whole numbers |

| Returns | Description |
|---|---|
| `String` | Formatted amount string |

```javascript
Lib.Money.formatAmount(10, 'usd');              // '10.00'
Lib.Money.formatAmount(10, 'usd', null, true);  // '10'
Lib.Money.formatAmount(10.6, 'usd', null, true);  // '10.60' (keeps decimals for non-integers)
Lib.Money.formatAmount(15.678, 'usd');          // '15.68'
```

---

## Transactional Amounts

### `getTransactionalAmount(amount, currency_code, decimals?, apply_min_unit?)`

Round an amount to the nearest minimum transactional unit when `apply_min_unit` is true. Otherwise applies standard rounding.

| Param | Type | Required | Description |
|---|---|---|---|
| `amount` | `Number` | Yes | Amount to round |
| `currency_code` | `String` | Yes | Currency code |
| `decimals` | `Number` | No | Override decimal places |
| `apply_min_unit` | `Boolean` | No | If true, round to min transactional unit |

| Returns | Description |
|---|---|
| `Number` | Rounded transactional amount |

```javascript
// INR: min_unit = 1, so amounts round to whole rupees
Lib.Money.getTransactionalAmount(15.20, 'inr', null, true);   // 15
Lib.Money.getTransactionalAmount(15.68, 'inr', null, true);   // 16

// USD: min_unit = 0.01, so amounts round to cents
Lib.Money.getTransactionalAmount(20.66666667, 'usd', null, true);  // 20.67
```

---

### `toFractionalUnits(amount, currency_code, decimals?)`

Convert an amount to fractional units (e.g., `$10.57 → 1057` cents, `₹15.68 → 1600` paise). Applies transactional rounding first.

| Param | Type | Required | Description |
|---|---|---|---|
| `amount` | `Number` | Yes | Amount in large currency |
| `currency_code` | `String` | Yes | Currency code |
| `decimals` | `Number` | No | Override decimal places |

| Returns | Description |
|---|---|
| `Integer` | Amount in fractional units |

```javascript
Lib.Money.toFractionalUnits(10.57, 'usd');   // 1057
Lib.Money.toFractionalUnits(18.35, 'usd');     // 1835
Lib.Money.toFractionalUnits(35, 'usd');        // 3500
Lib.Money.toFractionalUnits(15.68, 'inr');     // 1600 (rounded to 16, then ×100 paise)
```

---

### `fromFractionalUnits(amount, currency_code, decimals?)`

Convert fractional units back to large currency (e.g., `1057 → $10.57`, `1600 → ₹16`).

| Param | Type | Required | Description |
|---|---|---|---|
| `amount` | `Number` | Yes | Amount in fractional units |
| `currency_code` | `String` | Yes | Currency code |
| `decimals` | `Number` | No | Override decimal places |

| Returns | Description |
|---|---|
| `Number` | Amount in large currency |

```javascript
Lib.Money.fromFractionalUnits(1057, 'usd');   // 10.57
Lib.Money.fromFractionalUnits(1835, 'usd');  // 18.35
Lib.Money.fromFractionalUnits(100, 'inr');   // 1 (100 paise = 1 rupee)
```

---

## Aggregation

### `sum(amounts, currency_code, decimals?)`

Sum an array of amounts safely, avoiding floating-point errors. Internally converts to integer (cents/paise), sums, then converts back.

| Param | Type | Required | Description |
|---|---|---|---|
| `amounts` | `Number[]` | Yes | Array of amounts to sum |
| `currency_code` | `String` | Yes | Currency code |
| `decimals` | `Number` | No | Override decimal places |

| Returns | Description |
|---|---|
| `Number` | Summed amount |

```javascript
// Classic floating-point fix
Lib.Money.sum([0.1, 0.2], 'usd');              // 0.3 (not 0.30000000000000004)
Lib.Money.sum([10.10, 20.20, 30.30], 'usd');   // 60.6
Lib.Money.sum([], 'usd');                       // 0
Lib.Money.sum([100], 'usd');                    // 100
```

---

### `calculateTotalFromDenominations(majors?, minors?, currency_code, decimals?, apply_min_unit?)`

Calculate total amount from denomination counts.

| Param | Type | Required | Description |
|---|---|---|---|
| `majors` | `Array` | No | Array of `{value, count}` for major denominations (in large currency units) |
| `minors` | `Array` | No | Array of `{value, count}` for minor denominations (in fractional units) |
| `currency_code` | `String` | Yes | Currency code |
| `decimals` | `Number` | No | Override decimal places |
| `apply_min_unit` | `Boolean` | No | If true, apply min transactional unit rounding to result |

| Returns | Description |
|---|---|
| `Number` | Calculated total amount |

```javascript
// Major denominations only
const majors = [{ value: 100, count: 2 }];
Lib.Money.calculateTotalFromDenominations(majors, null, 'usd');  // 200

// Minor denominations only (values in fractional units, e.g., cents)
const minors = [{ value: 25, count: 3 }];  // 3 quarters
Lib.Money.calculateTotalFromDenominations(null, minors, 'usd');  // 0.75

// Both majors and minors
const majors = [{ value: 100, count: 1 }];
const minors = [{ value: 25, count: 2 }];  // 2 quarters
Lib.Money.calculateTotalFromDenominations(majors, minors, 'usd');  // 100.5
```

---

## Lifecycle

There is nothing to clean up. The module exposes only pure synchronous functions. Loader-time initialization captures the function bindings in a closure; after that, no module-level state changes for the lifetime of the process.

For module-level setup details (loader signature, peer-dep notes) see [Configuration → Loader Pattern](https://github.com/superloomdev/superloom/blob/main/src/helper-modules-core/js-helper-money/docs/configuration.md#loader-pattern).
