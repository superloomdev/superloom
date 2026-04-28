---
auto_execution_mode: 0
description: Create a new entity with model, controller, and service layers
---

# New Entity Workflow

When creating a new entity (e.g., product, order, category), scaffold all necessary files across the layered architecture.

## Quick Steps

1. **Define entity structure** - determine name and fields
2. **Create base model** at `demo-project/src/model/[entity]/` (see templates below)
3. **Create controller** at `demo-project/src/server/controller/`
4. **Create service** at `demo-project/src/server/service/`
5. **Register in loader** - update `loader.js`
6. **Verify** - run tests

## Detailed Templates

Determine the entity name and its fields. Follow naming conventions:
- Entity files: `[entity].config.js`, `[entity].entity.js`, `[entity].dto.js`, etc.
- Directory: `demo-project/src/model/[entity]/`

## 2. Create Base Model (`demo-project/src/model/[entity]/`)

### `index.js` - Public export surface
```javascript
// Info: Public export surface for [Entity] base model module
'use strict';

const [entity]_config = require('./[entity].config');
const [entity]_entity = require('./[entity].entity');
const [entity]_validation = require('./[entity].validation');
const [entity]_errors = require('./[entity].errors');
const [entity]_dto = require('./[entity].dto');

module.exports = {
  config: [entity]_config,
  entity: [entity]_entity,
  validation: [entity]_validation,
  errors: [entity]_errors,
  dto: [entity]_dto
};
```

### `[entity].config.js` - Configuration and constants
```javascript
// Info: Configuration constants for [Entity]
'use strict';

module.exports = {
  // Entity-specific constants
  DEFAULT_STATUS: 'active',
  // Validation rules
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 100
};
```

### `[entity].entity.js` - Canonical entity shape and constructors
```javascript
// Info: Canonical domain entity shape and constructors for [Entity]
'use strict';

const CONFIG = require('./[entity].config');

///////////////////////////Public Functions START//////////////////////////////
const [Entity]Entity = module.exports = {

  /********************************************************************
  Create a new [Entity] entity object with defaults

  @param {Object} data - Raw entity data
  @param {String} data.name - Entity name

  @return {Object} - Canonical entity
  *********************************************************************/
  create[Entity]: function (data) {

    return {
      name: data.name ? data.name.trim() : null,
      status: CONFIG.DEFAULT_STATUS,
      created_at: Date.now(),
      updated_at: Date.now()
    };

  },

  /********************************************************************
  Create an update shape (only non-null fields)

  @param {Object} data - Fields to update

  @return {Object} - Update shape with only provided fields
  *********************************************************************/
  createUpdateShape: function (data) {

    const update = {};

    if (data.name !== undefined && data.name !== null) {
      update.name = data.name.trim();
    }

    update.updated_at = Date.now();

    return update;

  }

};///////////////////////////Public Functions END//////////////////////////////
```

### `[entity].validation.js` - Validation logic
```javascript
// Info: Validation logic for [Entity]
'use strict';

const CONFIG = require('./[entity].config');
const ERRORS = require('./[entity].errors');
const { validateString } = require('js-helper-utils');

///////////////////////////Public Functions START//////////////////////////////
const [Entity]Validation = module.exports = {

  /********************************************************************
  Validate create input

  @param {Object} data - Input data

  @return {Array|Boolean} - false if valid, array of errors if invalid
  *********************************************************************/
  validateCreate: function (data) {

    const errors = [];

    // Validate name
    const name_error = validateString(
      data.name,
      'name',
      CONFIG.NAME_MIN_LENGTH,
      CONFIG.NAME_MAX_LENGTH,
      true
    );
    if (name_error) errors.push(name_error);

    return errors.length > 0 ? errors : false;

  },

  /********************************************************************
  Validate update input

  @param {Object} data - Input data

  @return {Array|Boolean} - false if valid, array of errors if invalid
  *********************************************************************/
  validateUpdate: function (data) {

    const errors = [];

    // Add update-specific validation

    return errors.length > 0 ? errors : false;

  }

};///////////////////////////Public Functions END//////////////////////////////
```

### `[entity].errors.js` - Error definitions
```javascript
// Info: Error definitions for [Entity]
'use strict';

///////////////////////////Public Functions START//////////////////////////////
const [Entity]Errors = module.exports = {

  /********************************************************************
  Create a standard error object

  @param {String} code - Error code
  @param {String} message - Human-readable message
  @param {String} field - Field that caused error (optional)

  @return {Object} - Error object
  *********************************************************************/
  createError: function (code, message, field) {

    return {
      code: code,
      message: message,
      field: field || null,
      source: '[entity]'
    };

  },

  // Predefined errors
  NOT_FOUND: function () {
    return this.createError(
      '[ENTITY]_NOT_FOUND',
      '[Entity] not found',
      null
    );
  },

  INVALID_NAME: function () {
    return this.createError(
      'INVALID_[ENTITY]_NAME',
      '[Entity] name is invalid',
      'name'
    );
  }

};///////////////////////////Public Functions END//////////////////////////////
```

### `[entity].dto.js` - Data Transfer Object builders
```javascript
// Info: DTO builders for [Entity] - ONE shape, ONE builder
'use strict';

const CONFIG = require('./[entity].config');

///////////////////////////Public Functions START//////////////////////////////
const [Entity]DTO = module.exports = {

  /********************************************************************
  Build [Entity] data - ONE canonical shape for all operations
  Absent keys are NOT added. No separate create/update DTOs.

  @param {String} id - Entity ID (undefined for new entities)
  @param {String} name - Entity name
  @param {String} status - Entity status
  @param {Number} created_at - Creation timestamp
  @param {Number} updated_at - Update timestamp

  @return {Object} - Canonical [Entity] data object
  *********************************************************************/
  build[Entity]Data: function (
    id,
    name,
    status,
    created_at,
    updated_at
  ) {

    const data = {};

    if (id !== undefined) data.id = id;
    if (name !== undefined) data.name = name;
    if (status !== undefined) data.status = status;
    if (created_at !== undefined) data.created_at = created_at;
    if (updated_at !== undefined) data.updated_at = updated_at;

    return data;

  },

  /********************************************************************
  Build public [Entity] data - strips server-only fields
  Derives FROM the full object, not a separate builder

  @param {Object} full_data - Complete entity data from build[Entity]Data

  @return {Object} - Public-safe [Entity] data
  *********************************************************************/
  build[Entity]DataPublic: function (full_data) {

    return {
      id: full_data.id,
      name: full_data.name,
      status: full_data.status,
      created_at: full_data.created_at,
      updated_at: full_data.updated_at
    };

  }

};///////////////////////////Public Functions END//////////////////////////////
```

### `_test/test.js` - Test cases
```javascript
// Info: Test Cases for [Entity] model
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const [Entity]Model = require('../index');

describe('[entity] model', function () {

  describe('create[Entity]', function () {

    it('should create entity with default status when [minimal data provided]', function () {

      // Arrange
      const input = { name: 'Test [Entity]' };

      // Act
      const result = [Entity]Model.entity.create[Entity](input);

      // Assert
      assert.strictEqual(result.name, 'Test [Entity]');
      assert.strictEqual(result.status, 'active');
      assert.ok(result.created_at);
      assert.ok(result.updated_at);

    });

  });

  describe('validateCreate', function () {

    it('should return error when [name is too short]', function () {

      // Arrange
      const input = { name: 'A' };

      // Act
      const errors = [Entity]Model.validation.validateCreate(input);

      // Assert
      assert.ok(Array.isArray(errors));
      assert.strictEqual(errors.length, 1);

    });

    it('should return false when [input is valid]', function () {

      // Arrange
      const input = { name: 'Valid Name' };

      // Act
      const errors = [Entity]Model.validation.validateCreate(input);

      // Assert
      assert.strictEqual(errors, false);

    });

  });

});
```

### `README.md` - Compact context document
```markdown
# [Entity] Model

Base domain model for [Entity] entities. Pure, IO-free, shareable with clients.

## Exports

- `config` - Constants and validation rules
- `entity` - Entity constructors (`create[Entity]`, `createUpdateShape`)
- `validation` - Input validation (`validateCreate`, `validateUpdate`)
- `errors` - Error definitions and helpers
- `dto` - DTO builders (`build[Entity]Data`, `build[Entity]DataPublic`)

## DTO Philosophy

**One DTO, One Shape:** `build[Entity]Data()` takes all fields as parameters.
Absent keys are NOT added. Use `build[Entity]DataPublic()` to strip server-only fields.
```

## 3. Create Controller (`demo-project/src/server/controller/[entity]/`)

### `index.js` - Thin adapter
```javascript
// Info: [Entity] Controller Module - Thin adapter between interfaces and service
'use strict';

let Lib = {};

/////////////////////////// Module-Loader START ////////////////////////////////

  const loader = function (shared_libs) {

    Lib = shared_libs;

  };

//////////////////////////// Module-Loader END /////////////////////////////////

///////////////////////////Public Functions START///////////////////////////////
const [Entity]Controller = {

  /********************************************************************
  Create a new [Entity]

  @param {Object} request - Standardized request object
  @param {Object} request.body - Request body

  @return {Object} - Standardized response object
  *********************************************************************/
  create: async function (request) {

    // Step 1: Extract input
    const input = {
      name: request.body.name
    };

    // Step 2: Validate via Model
    const validation_errors = Lib.[Entity]Model.validation.validateCreate(input);
    if (validation_errors) {
      return {
        success: false,
        error: validation_errors
      };
    }

    // Step 3: Build DTO
    const entity_dto = Lib.[Entity]Model.dto.build[Entity]Data(
      /* id */ undefined,  // ID not yet assigned
      input.name,
      undefined,  // status - will use default
      undefined,  // created_at
      undefined   // updated_at
    );

    // Step 4: Delegate to service
    const result = await Lib.[Entity]Service.create(entity_dto);

    // Step 5: Return standardized response
    if (result.success) {
      return {
        success: true,
        status: 201,
        data: result.data
      };
    }

    return {
      success: false,
      status: result.status || 500,
      error: result.error
    };

  },

  /********************************************************************
  Get [Entity] by ID

  @param {Object} request - Standardized request
  @param {String} request.params.id - Entity ID

  @return {Object} - Standardized response
  *********************************************************************/
  getById: async function (request) {

    const id = request.params.id;

    const result = await Lib.[Entity]Service.getById(id);

    if (result.success) {
      return {
        success: true,
        status: 200,
        data: result.data
      };
    }

    return {
      success: false,
      status: result.status || 404,
      error: result.error
    };

  },

  /********************************************************************
  Update [Entity]

  @param {Object} request - Standardized request
  @param {String} request.params.id - Entity ID
  @param {Object} request.body - Fields to update

  @return {Object} - Standardized response
  *********************************************************************/
  update: async function (request) {

    const id = request.params.id;

    // Build update shape
    const update_data = Lib.[Entity]Model.entity.createUpdateShape(request.body);

    const result = await Lib.[Entity]Service.update(id, update_data);

    if (result.success) {
      return {
        success: true,
        status: 200,
        data: result.data
      };
    }

    return {
      success: false,
      status: result.status || 400,
      error: result.error
    };

  }

};///////////////////////////Public Functions END///////////////////////////////

module.exports = { loader, ...[Entity]Controller };
```

## 4. Create Service (`demo-project/src/server/service/[entity]/`)

### `index.js` - Business logic
```javascript
// Info: [Entity] Service Module - Business logic and orchestration
'use strict';

let Lib = {};
let Config = {};

/////////////////////////// Module-Loader START ////////////////////////////////

  const loader = function (shared_libs, config) {

    Lib = shared_libs;
    Config = config;

  };

//////////////////////////// Module-Loader END /////////////////////////////////

///////////////////////////Public Functions START///////////////////////////////
const [Entity]Service = {

  /********************************************************************
  Create [Entity]

  @param {Object} entity_dto - Validated DTO

  @return {Object} - { success, data } or { success, error }
  *********************************************************************/
  create: async function (entity_dto) {

    try {

      // TODO: Add persistence logic when database layer is ready
      // For now, return the DTO with a mock ID

      const result = {
        ...entity_dto,
        id: 'mock_' + Date.now()
      };

      return {
        success: true,
        data: result
      };

    } catch (error) {

      return {
        success: false,
        error: Lib.[Entity]Model.errors.createError(
          'CREATE_FAILED',
          'Failed to create [entity]'
        )
      };

    }

  },

  /********************************************************************
  Get [Entity] by ID

  @param {String} id - Entity ID

  @return {Object} - { success, data } or { success, error }
  *********************************************************************/
  getById: async function (id) {

    try {

      // TODO: Add database lookup when ready

      return {
        success: false,
        status: 404,
        error: Lib.[Entity]Model.errors.NOT_FOUND()
      };

    } catch (error) {

      return {
        success: false,
        error: Lib.[Entity]Model.errors.createError(
          'FETCH_FAILED',
          'Failed to fetch [entity]'
        )
      };

    }

  },

  /********************************************************************
  Update [Entity]

  @param {String} id - Entity ID
  @param {Object} update_data - Fields to update

  @return {Object} - { success, data } or { success, error }
  *********************************************************************/
  update: async function (id, update_data) {

    try {

      // TODO: Add persistence logic when database layer is ready

      return {
        success: true,
        data: {
          id: id,
          ...update_data
        }
      };

    } catch (error) {

      return {
        success: false,
        error: Lib.[Entity]Model.errors.createError(
          'UPDATE_FAILED',
          'Failed to update [entity]'
        )
      };

    }

  }

};///////////////////////////Public Functions END///////////////////////////////

module.exports = { loader, ...[Entity]Service };
```

## 5. Register in Loader (`demo-project/src/server/common/loader.js`)

Add the new entity to the loader:

```javascript
// In the entities section, add:

// [Entity] entity
Lib.[Entity]Model = require('../model/[entity]');

// [Entity] service
const [Entity]Service = require('../service/[entity]');
[Entity]Service.loader(Lib, Config);
Lib.[Entity]Service = [Entity]Service;

// [Entity] controller
const [Entity]Controller = require('../controller/[entity]');
[Entity]Controller.loader(Lib);
Lib.[Entity]Controller = [Entity]Controller;
```

## 6. Verify

// turbo
Run model tests:
```bash
cd demo-project/src/model/[entity]/_test && npm install && npm test
```

Run all tests to ensure nothing is broken:
```bash
cd demo-project/src/model && npm test
cd demo-project/src/model-server && npm test
cd demo-project/src/server && npm run test:all
```

## See Also

- [Entity Creation Guide](../../docs/architecture/entity-creation-guide.md) - the full architectural reference
- [Creating Entities](../../docs/guide/creating-entities.md) - quick-start guide
- [Server Service Modules](../../docs/architecture/server-service-modules.md) - the service layer rules
- [Server Controller Modules](../../docs/architecture/server-controller-modules.md) - the controller layer rules
