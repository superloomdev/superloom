# Shared Model Module

Common data transformation utilities and pure functions used across multiple entity models. This module handles cross-cutting concerns that don't belong to a single entity.

## Overview

The Shared model provides reusable logic for:
- Date and time transformations
- String sanitization and slug generation
- Collection pagination
- Deep cloning and object manipulation
- Cross-entity calculations

## Module Files

| File | Purpose |
|---|---|
| `shared.process.js` | Pure transformation utilities and shared logic |

## Exported Functions

### Process (`model.process`)

- **`unixToIsoString(unix_timestamp, is_milliseconds)`** - Convert Unix to ISO date
- **`daysBetween(date_a, date_b)`** - Calculate days between two ISO dates
- **`formatDate(iso_date, format)`** - Format date (short, long, relative)
- **`getRelativeTimeString(date)`** - Get human-readable relative time
- **`sanitizeString(input, options)`** - Clean string for display
- **`generateSlug(text)`** - URL-friendly slug generation
- **`paginate(items, page, limit)`** - Standardized array pagination
- **`deepClone(obj)`** - Recursive object cloning
- **`pick(obj, keys)`** - Create object with selected keys
- **`omit(obj, keys)`** - Create object without specific keys
- **`groupBy(items, key)`** - Group array by property
- **`calculateNumericStats(numbers)`** - Min, max, avg, count, sum for arrays

## Usage

```javascript
// Load via parent loader
const loadLib = require('../_test/loader');
const Lib = loadLib();
const SharedProcess = Lib.SharedProcess;

// Format a date
const display = SharedProcess.formatDate('2026-04-01T06:00:00Z', 'relative');

// Paginate results
const result = SharedProcess.paginate(largeArray, 1, 20);
```

## Dependencies
- `Lib.Utils`: For underlying type checks and sanitization
