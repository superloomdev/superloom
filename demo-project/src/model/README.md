# Model Package

Shared domain models for Superloom applications. This package contains entity definitions, validation rules, data transfer objects (DTOs), and pure business logic (process functions) that can be used on both client and server sides.

## Model Structure

Each entity model follows a consistent structure with these files:

### Required Files

| File | Purpose | Description |
|------|---------|-------------|
| `index.js` | Public API surface | Aggregates and exports all public APIs from the model |
| `{entity}.config.js` | Configuration | Entity-specific constants, enums, and configuration values |
| `{entity}.data.js` | Data shapes (Entity + DTO) | Combined entity constructors and DTO transformations |
| `{entity}.validation.js` | Validation rules | Input validation functions for create/update operations |
| `{entity}.errors.js` | Error definitions | Standardized error codes and messages |
| `{entity}.process.js` | Business logic | Pure functions for data transformation and calculations |

### Data Module Structure (`{entity}.data.js`)

Combines entity and DTO patterns into one module:

```javascript
module.exports = {
  // Core data builders (canonical shapes with defaults)
  create: createEntityData,           // DTO terminology: Use the term "DTO" (Data Transfer Object) for internal and external shapes. No separate create/update shapes.
  createDeep: createDeepData,         // Nested structure assembly

  // Output transformations (DTO pattern)
  toPublic: toPublicData,             // Strip server-only fields
  toSummary: toSummaryData,          // Minimal for list views
};
```

### Test Files

| File | Purpose |
|------|---------|
| `_test/test.js` | Main test suite for the entity |
| `_test/test-process.js` | Tests for process functions |
| `_test/mock-data/` | JSON fixtures for tests |

## Architecture Principles

### 1. Model is Pure and IO-Free

Models contain **no database calls, HTTP requests, or external I/O**. They are pure JavaScript that transforms data.

### 2. Process Functions are Data Transformers

Process modules (`{entity}.process.js`) contain pure business logic:
- Calculate derived values (e.g., `calculateAccountAgeDays`)
- Format data for display (e.g., `formatPhoneNumber`)
- Filter and sort collections
- Transform data structures

Process functions receive `Lib` (with `Lib.Utils`) via the loader pattern but make no external calls.

### 3. One Data Module, One Shape

Each entity has ONE consolidated data module (`{entity}.data.js`) combining entity construction and output transformations (DTOs). This ensures a single source of truth for the entity's structure across the entire application.

### 4. Validation is Model-Local

Validation logic lives in `{entity}.validation.js` and uses reusable utilities. It validates data before it is processed or stored.

### 5. Shared Model Pattern

Model modules are **shared between client and server**. The server loader injects `Lib` dependencies at runtime, while clients can load them as pure modules if they don't require cross-module dependencies.

### 6. Shared Module Exception

The **`shared/` module** is for exceptional cases only - when a function needs to operate on data from **multiple entities** and cannot logically belong to any single entity module.

**When to use Shared:**
- Cross-entity calculations requiring data from several modules
- Common utilities that multiple modules depend on (e.g., date formatting, string sanitization)
- Functions that transform data across entity boundaries

**When NOT to use Shared:**
- If the function primarily operates on one entity's data → belongs in that entity's `process.js`
- If the function is specific to a single use case → belongs in the calling module

## Module Pattern Reference

All model modules follow a strict **Standard Module Structure** for dependency injection and lifecycle management.

### Module Structure Overview

```javascript
// Info: Module description
// Pattern: Standard Module Structure
'use strict';

// =============================================================================
// SHARED DEPENDENCIES (Injected by Loader)
// =============================================================================
// These are populated by the module loader at runtime. Do not modify directly.
let Lib;
let CONFIG;


// =============================================================================
// MODULE LOADER
// =============================================================================
// Injects shared dependencies and configuration into this module's scope.
// Called once by the parent loader before module functions are accessed.

  /********************************************************************
  Module Constructor / Loader

  @param {Object} shared_libs - Library container with Utils, Debug, sibling models
  @param {Object} config_module - Entity configuration (constants, enums, defaults)

  @return {void}
  *********************************************************************/
  const loader = function(shared_libs, config_module){

    // Shared Dependencies (Managed by Main Entry Module)
    Lib = shared_libs;

    // Configuration
    CONFIG = config_module;

  };

// =============================================================================
// MODULE EXPORTS
// =============================================================================
// Returns public function object after loading dependencies.

module.exports = function(shared_libs, config_module){

  // Run Loader
  loader(shared_libs, config_module);

  // Return Public Functions
  return PublicFunctionObject;

};

// =============================================================================
// PUBLIC FUNCTIONS
// =============================================================================
// All public functions are methods of a single exported object.

const PublicFunctionObject = {

  /********************************************************************
  Function description

  @param {Object} data - Input data

  @return {Object} - Transformed result
  *********************************************************************/
  functionName: function(data) {

    // Initialize
    const result = {};

    // Logic block
    result.value = calculate(data);


    // Return
    return result;

  }

};
```

### Why This Pattern?

| Problem | Solution |
|---------|----------|
| **Circular dependencies** | Modules reference each other via `Lib.OtherModel` instead of direct `require()` |
| **Testability** | Simulating loader can inject mock `Lib` and `CONFIG` for isolated testing |
| **Configuration isolation** | Each module gets only its config, preventing accidental access to other entity configs |
| **Clear boundaries** | Public/private separation through exported object vs internal variables |

### Standard Vertical Spacing

| Location | Blank Lines | Example |
|----------|-------------|---------|
| Between var declarations | 1 | `var Lib;` → 1 blank → `var CONFIG;` |
| After CONFIG before Module-Loader | 2 | `var CONFIG;` → 2 blanks → `///////////////////////////` |
| Between major sections | 3 | `//////////////// Module-Loader END` → 3 blanks → `//////////////// Module Exports START` |
| Between function definitions | 2 | `},` → 2 blanks → next function |
| Inside functions (start/end) | 1 | `function() {` → 1 blank → `// Initialize` |
| Before `// Return` | 1 | logic → 1 blank → `// Return` |

### Terminology Standards

| Term | Usage | Example |
|------|-------|---------|
| `Lib` | Shared library container | `Lib.Utils`, `Lib.ContactModel` |
| `CONFIG` | Entity-specific configuration | `CONFIG.DEFAULT_STATUS` |
| `config_module` | Parameter name for loader | `loader(shared_libs, config_module)` |
| `shared_libs` | Parameter name for Lib | `loader(shared_libs, config_module)` |
| `Initialize` | American English (Z not S) | `// Initialize` |
| `loader` | Function name for dependency injection | `const loader = function(...) {...}` |

### Testing with Simulating Loader

The simulating loader mimics production dependency injection for isolated testing:

```javascript
// In test files
const loadLib = require('./loader');
const Lib = loadLib();

// Access loaded modules
const UserData = Lib.UserModel.data;
const UserProcess = Lib.UserProcess;

// Test with full Lib injection
const user = UserData.create({ name: 'Test', email: 'test@example.com' });
const summary = UserProcess.buildUserSummary(user);
```

## Entity Types

### Base Models (`src/model/`)

Pure models that can run anywhere:
- **User** - User accounts with authentication
- **Survey** - Survey definitions and questions
- **Contact** - Email, phone, address handling

### Server Model Extensions (`src/model-server/`)

Server-only extensions that add server-specific fields and methods. They are **peer packages** - same structure, same return shape - merged by the loader at runtime via key-by-key spread.

- **Survey** - Adds server-only data methods, validation, processing
- **Shared** - Adds server-only shared utilities

```javascript
// Loader merges base + server extension
const Models = require('../../model');
const ModelsExtended = require('../../model-server');

const SurveyModel = Models.Survey(Lib, {});
Lib.Survey = { data: SurveyModel.data, errors: SurveyModel.errors, ... };

const SurveyModelExtended = ModelsExtended.Survey(Lib, {});
Lib.Survey = { /* extended merges into base, key-by-key */
  data: { ...Lib.Survey.data, ...SurveyModelExtended.data },
  ...
};
// After merge: Lib.Survey.data has both base + server methods
```

## Usage Patterns

Model modules are primarily used via the `Lib` object on the server or imported directly on the client.

### Standard Data Operations

```javascript
// Building canonical data
const userData = Lib.User.data.create({ name: 'John Doe', email: 'john@example.com' });

// Building update shapes
const updateData = Lib.User.data.createUpdate({ status: 'inactive' });

// Output transformations
const publicData = Lib.User.data.toPublic(userData);
```

### Pure Business Logic (Process)

Process functions are injected with `Lib` to allow cross-module utility usage while remaining pure and testable.

```javascript
const score = Lib.User.process.calculateActivityScore(metrics);
const formatted = Lib.Contact.process.formatPhoneNumber(phone, 'international');
```

## Entity Models

For detailed documentation, data attributes, and available functions for each entity, see:

- [User Model](./user/README.md) - Accounts and profiles
- [Survey Model](./survey/README.md) - Complex nested structures and rules
- [Contact Model](./contact/README.md) - Email, phone, and address handling
- [Shared Module](./shared/README.md) - Common cross-entity utilities

## Testing

Run all model tests from the consolidated test suite:

```bash
cd src/model/_test
node --test test.js user/test-process.js survey/test-process.js contact/test-process.js shared/test.js
```

The simulating loader (`loader.js`) provides a complete `Lib` object with all models and cross-module dependencies loaded.

Run specific entity tests:

```bash
node --test user/test-process.js
node --test survey/test-process.js
```
