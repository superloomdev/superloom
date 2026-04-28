# Entity Creation Guide

Complete walkthrough for creating a new domain entity in a Superloom project, from base model through server extensions to controller and service. This is the long-form reference; for the high-level summary see [Creating Entities](../guide/creating-entities.md).

## On This Page

- [Overview](#overview)
- [Phase 1 - Base Model](#phase-1---base-model-creation)
- [Phase 2 - Server Extensions (Optional)](#phase-2---server-extensions-optional)
- [Phase 3 - Service and Controller](#phase-3---service-and-controller)
- [Phase 4 - Update Server Loader](#phase-4---update-server-loader)
- [Checklist](#checklist)
- [Key Principles Summary](#key-principles-summary)

---

## Overview

Creating a new entity involves building across multiple layers:

```
model/[entity]/                          # Base model (pure, IO-free, shared)
  index.js                               #   Package entry point (exports constructor)
  [entity].config.js                     #   Domain constants
  [entity].data.js                       #   Entity builders + DTOs
  [entity].errors.js                     #   Error catalog
  [entity].process.js                    #   Pure business logic
  [entity].validation.js                 #   Validation rules

model-server/[entity]/                   # Server extensions (optional)
  index.js                               #   Package entry point
  [entity].data.js                       #   Server-only data methods
  [entity].process.js                    #   Server-only business logic
  ...

server/service/[entity].service.js       # Business logic, orchestration
server/controller/[entity].controller.js # Thin adapters
```

---

## Phase 1 - Base Model Creation

### Step 1: Create Directory Structure

```bash
mkdir -p src/model/[entity]
mkdir -p src/model/[entity]/_test
```

### Step 2: Create Config Module

**File:** `src/model/[entity]/[entity].config.js`

```javascript
// Info: Domain constants and rules for [Entity] entity
// Pattern: Plain object export (no loader needed)
'use strict';

module.exports = {

  // Entity-specific limits
  MAX_NAME_LENGTH: 100,
  MIN_NAME_LENGTH: 2,

  // Status values
  STATUS_ACTIVE: 'active',
  STATUS_INACTIVE: 'inactive',

  // Regex patterns
  NAME_PATTERN: /^[a-zA-Z0-9\s-_]+$/

};
```

### Step 3: Create Errors Module

**File:** `src/model/[entity]/[entity].errors.js`

```javascript
// Info: Error catalog for [Entity] entity
// Pattern: Plain object export (no loader needed)
'use strict';

module.exports = {

  NAME_REQUIRED: {
    code: 'ENTITY_NAME_REQUIRED',
    message: 'Name is required',
    status: 400
  },

  NAME_INVALID: {
    code: 'ENTITY_NAME_INVALID',
    message: 'Name contains invalid characters',
    status: 400
  },

  NOT_FOUND: {
    code: 'ENTITY_NOT_FOUND',
    message: 'Entity not found',
    status: 404
  }

};
```

### Step 4: Create Data Module

**File:** `src/model/[entity]/[entity].data.js`

```javascript
// Info: [Entity] Data Module - Canonical entity constructors and DTOs
// Pattern: Standard Module Structure
// Dependencies: Lib.Utils, CONFIG
'use strict';

let Lib;
let CONFIG;


/////////////////////////// Module-Loader START ////////////////////////////////

  /********************************************************************
  Loader: inject Lib + CONFIG for this module.

  @param {Object} shared_libs - loaded libraries + models (Lib)
  @param {Object} config - domain config for this module
  @return {void}
  *********************************************************************/
  const loader = function (shared_libs, config) {

    Lib = shared_libs;
    CONFIG = config;

  };

//////////////////////////// Module-Loader END /////////////////////////////////



///////////////////////////// Module Exports START /////////////////////////////
module.exports = function (shared_libs, config) {

  loader(shared_libs, config);

  return EntityData;

};//////////////////////////// Module Exports END //////////////////////////////



////////////////////////////Public Functions START//////////////////////////////
const EntityData = {

  /********************************************************************
  Create a complete [Entity] data object

  @param {String} name - Entity name
  @param {Object} options - Additional options

  @return {Object} - Complete entity data
  *********************************************************************/
  create: function (name, options) {

    const now = Date.now();

    return {
      id: options.id || null,  /* assigned by database */
      name: name,
      status: options.status || CONFIG.STATUS_ACTIVE,
      created_at: now,
      updated_at: now
    };

  },


  /********************************************************************
  Create a partial update shape

  @param {Object} fields - Fields to update

  @return {Object} - Update data object
  *********************************************************************/
  createUpdate: function (fields) {

    const update = {};

    if (fields.name !== undefined) {
      update.name = fields.name;
    }

    if (fields.status !== undefined) {
      update.status = fields.status;
    }

    update.updated_at = Date.now();

    return update;

  },


  /********************************************************************
  Convert to public output (strips server-only fields)

  @param {Object} entity - Full entity data

  @return {Object} - Public-safe data
  *********************************************************************/
  toPublic: function (entity) {

    return {
      id: entity.id,
      name: entity.name,
      status: entity.status,
      created_at: entity.created_at
    };

  },


  /********************************************************************
  Convert to summary output (minimal list view)

  @param {Object} entity - Full entity data

  @return {Object} - Summary data
  *********************************************************************/
  toSummary: function (entity) {

    return {
      id: entity.id,
      name: entity.name,
      status: entity.status
    };

  }

};///////////////////////////Public Functions END///////////////////////////////
```

### Step 5: Create Process Module

**File:** `src/model/[entity]/[entity].process.js`

```javascript
// Info: [Entity] Process Module - Pure business logic
// Pattern: Standard Module Structure
// Dependencies: Lib.Utils, CONFIG
'use strict';

let Lib;
let CONFIG;


/////////////////////////// Module-Loader START ////////////////////////////////

  /********************************************************************
  Loader: inject Lib + CONFIG for this module.

  @param {Object} shared_libs - loaded libraries + models (Lib)
  @param {Object} config - domain config for this module
  @return {void}
  *********************************************************************/
  const loader = function (shared_libs, config) {

    Lib = shared_libs;
    CONFIG = config;

  };

//////////////////////////// Module-Loader END /////////////////////////////////



///////////////////////////// Module Exports START /////////////////////////////
module.exports = function (shared_libs, config) {

  loader(shared_libs, config);

  return EntityProcess;

};//////////////////////////// Module Exports END //////////////////////////////



////////////////////////////Public Functions START//////////////////////////////
const EntityProcess = {

  /********************************************************************
  Check if entity is active

  @param {Object} entity - Entity data

  @return {Boolean} - True if active
  *********************************************************************/
  isActive: function (entity) {

    return entity.status === CONFIG.STATUS_ACTIVE;

  },


  /********************************************************************
  Calculate days since creation

  @param {Object} entity - Entity data

  @return {Number} - Days since created_at
  *********************************************************************/
  getAgeInDays: function (entity) {

    const now = Date.now();
    const created = entity.created_at;
    const diff = now - created;

    return Math.floor(diff / (1000 * 60 * 60 * 24));

  }

};///////////////////////////Public Functions END///////////////////////////////
```

### Step 6: Create Validation Module

**File:** `src/model/[entity]/[entity].validation.js`

```javascript
// Info: [Entity] Validation Module - Input validation
// Pattern: Standard Module Structure
// Dependencies: Lib.Utils, CONFIG, ERRORS
'use strict';

let Lib;
let CONFIG;
let ERRORS;


/////////////////////////// Module-Loader START ////////////////////////////////

  /********************************************************************
  Loader: inject Lib + CONFIG + ERRORS for this module.

  @param {Object} shared_libs - loaded libraries + models (Lib)
  @param {Object} config - domain config for this module
  @param {Object} errors - error catalog for this module
  @return {void}
  *********************************************************************/
  const loader = function (shared_libs, config, errors) {

    Lib = shared_libs;
    CONFIG = config;
    ERRORS = errors;

  };

//////////////////////////// Module-Loader END /////////////////////////////////



///////////////////////////// Module Exports START /////////////////////////////
module.exports = function (shared_libs, config, errors) {

  loader(shared_libs, config, errors);

  return EntityValidation;

};//////////////////////////// Module Exports END //////////////////////////////



////////////////////////////Public Functions START//////////////////////////////
const EntityValidation = {

  /********************************************************************
  Validate name field

  @param {String} name - Name to validate

  @return {Object|null} - Error object or null if valid
  *********************************************************************/
  validateName: function (name) {

    if (!name) {
      return ERRORS.NAME_REQUIRED;
    }

    if (name.length < CONFIG.MIN_NAME_LENGTH) {
      return {
        ...ERRORS.NAME_INVALID,
        message: `Name must be at least ${CONFIG.MIN_NAME_LENGTH} characters`
      };
    }

    if (!CONFIG.NAME_PATTERN.test(name)) {
      return ERRORS.NAME_INVALID;
    }

    return null;

  },


  /********************************************************************
  Validate complete create input

  @param {Object} input - Full input data

  @return {Object} - { is_valid, errors[] }
  *********************************************************************/
  validateCreate: function (input) {

    const errors = [];

    const nameError = this.validateName(input.name);
    if (nameError) {
      errors.push(nameError);
    }

    return {
      is_valid: errors.length === 0,
      errors: errors
    };

  }

};///////////////////////////Public Functions END///////////////////////////////
```

### Step 7: Create Index Module

**File:** `src/model/[entity]/index.js`

```javascript
// Info: Public export surface for [Entity] base model module
// Dependencies: none (or list if any: Contact, User, etc.)
// Standard pattern: Loader receives Lib and Config Override, returns { data, errors, process, validation, _config }
'use strict';


///////////////////////////// Module Exports START /////////////////////////////
module.exports = function (shared_libs, config_override) {

  // Merge domain config with env overrides
  const EntityConfig = Object.assign(
    {},
    require('./[entity].config'),
    config_override || {}
  );

  // Load Error Catalog (independent, not attached to config)
  const EntityErrors = require('./[entity].errors');

  // Load sub-modules with merged module-specific config
  const EntityData = require('./[entity].data')(shared_libs, EntityConfig);
  const EntityProcess = require('./[entity].process')(shared_libs, EntityConfig);
  const EntityValidation = require('./[entity].validation')(shared_libs, EntityConfig, EntityErrors);


  // Return Public APIs as object { data, errors, process, validation, _config }
  // Note: _config is private, for loader use only (passed to server layers)
  return {
    data: EntityData,
    errors: EntityErrors,
    process: EntityProcess,
    validation: EntityValidation,
    _config: EntityConfig
  };

};//////////////////////////// Module Exports END //////////////////////////////
```

### Step 8: Update Package Index

**File:** `src/model/index.js`

Add the new entity to the exports:

```javascript
// Info: Public export surface for the model package
// Each entity module is exported as a named property
'use strict';

module.exports = {
  Contact: require('./contact'),
  User: require('./user'),
  Survey: require('./survey'),
  [Entity]: require('./[entity]')  // Add here
};
```

---

## Phase 2 - Server Extensions (Optional)

Only needed if entity has server-only fields or logic.

### Step 1: Create Server Model Directory

```bash
mkdir -p src/model-server/[entity]
```

### Step 2: Create Server Data Module

**File:** `src/model-server/[entity]/[entity].data.js`

```javascript
// Info: [Entity] Server Data Module - Server-only extensions
// Pattern: Standard Module Structure
// Dependencies: Lib (can reference Lib.[Entity] for base methods)
'use strict';

let Lib;
let CONFIG;


/////////////////////////// Module-Loader START ////////////////////////////////

  /********************************************************************
  Loader: inject Lib + CONFIG for this module.

  @param {Object} shared_libs - loaded libraries + models (Lib)
  @param {Object} config - domain config for this module
  @return {void}
  *********************************************************************/
  const loader = function (shared_libs, config) {

    Lib = shared_libs;
    CONFIG = config;

  };

//////////////////////////// Module-Loader END /////////////////////////////////



///////////////////////////// Module Exports START /////////////////////////////
module.exports = function (shared_libs, config) {

  loader(shared_libs, config);

  return EntityServerData;

};//////////////////////////// Module Exports END //////////////////////////////



////////////////////////////Public Functions START//////////////////////////////
const EntityServerData = {

  /********************************************************************
  Add server-only fields to base entity

  @param {Object} base_entity - Entity from base model
  @param {String} created_by - User ID who created
  @param {String} organization_id - Organization ID

  @return {Object} - Entity with server fields added
  *********************************************************************/
  addServerFields: function (base_entity, created_by, organization_id) {

    return {
      ...base_entity,
      created_by: created_by,
      organization_id: organization_id,
      internal_notes: null,
      version: 1
    };

  }

};///////////////////////////Public Functions END///////////////////////////////
```

### Step 3: Create Server Index Module

**File:** `src/model-server/[entity]/index.js`

```javascript
// Info: Server-only model extensions for [Entity] entity
// Dependencies: [Entity] base (may reference Lib.[Entity] via loader)
// Standard pattern: Loader receives Lib and Config Override, returns { data, errors, process, validation, _config }
'use strict';


///////////////////////////// Module Exports START /////////////////////////////
module.exports = function (shared_libs, config_module) {

  // Merge domain config with env overrides
  const EntityConfig = Object.assign(
    {},
    require('./[entity].config'),
    config_module || {}
  );

  // Load Error Catalog (independent, not attached to config)
  const EntityErrors = require('./[entity].errors');

  // Load sub-modules with merged module-specific config
  const EntityData = require('./[entity].data')(shared_libs, EntityConfig);
  const EntityProcess = require('./[entity].process')(shared_libs, EntityConfig);
  const EntityValidation = require('./[entity].validation')(shared_libs, EntityConfig, EntityErrors);


  // Return Public APIs as object { data, errors, process, validation, _config }
  // Note: _config is private, for loader use only (passed to server layers)
  return {
    data: EntityData,
    errors: EntityErrors,
    process: EntityProcess,
    validation: EntityValidation,
    _config: EntityConfig
  };

};//////////////////////////// Module Exports END //////////////////////////////
```

### Step 4: Update Server Package Index

**File:** `src/model-server/index.js`

```javascript
// Info: Server-side model extensions package
'use strict';

module.exports = {
  Survey: require('./survey'),
  [Entity]: require('./[entity]')  // Add here
};
```

---

## Phase 3 - Service and Controller

### Step 1: Create Service Module

**File:** `src/server/service/[entity].service.js`

```javascript
// Info: [Entity] Service Module - Business logic and orchestration
// Pattern: Standard Module Structure
// Dependencies: Lib, Config (receives entity config from loader)
'use strict';

let Lib;
let Config;


/////////////////////////// Module-Loader START ////////////////////////////////

  /********************************************************************
  Loader: inject Lib + Config for this module.

  @param {Object} shared_libs - loaded libraries + models (Lib)
  @param {Object} config - entity config from model
  @return {void}
  *********************************************************************/
  const loader = function (shared_libs, config) {

    Lib = shared_libs;
    Config = config;

  };

//////////////////////////// Module-Loader END /////////////////////////////////



///////////////////////////// Module Exports START /////////////////////////////
module.exports = function (shared_libs, config) {

  loader(shared_libs, config);

  return EntityService;

};//////////////////////////// Module Exports END //////////////////////////////



////////////////////////////Public Functions START//////////////////////////////
const EntityService = {

  /********************************************************************
  Create a new entity

  @param {Object} data - Create data

  @return {Object} - { success, data } or { success, error }
  *********************************************************************/
  createEntity: async function (data) {

    // Validate via model
    const validation = Lib.[Entity].validation.validateCreate(data);
    if (!validation.is_valid) {
      return { success: false, error: validation.errors[0] };
    }

    // Build data object via model
    const entity_data = Lib.[Entity].data.create(data.name, {
      status: data.status
    });

    // Return (in real implementation, save to DB here)
    return { success: true, data: entity_data };

  }

};///////////////////////////Public Functions END///////////////////////////////
```

### Step 2: Create Controller Module

**File:** `src/server/controller/[entity].controller.js`

```javascript
// Info: [Entity] Controller Module - Thin adapter
// Pattern: Standard Module Structure
// Dependencies: Lib, Config
'use strict';

let Lib;
let Config;


/////////////////////////// Module-Loader START ////////////////////////////////

  /********************************************************************
  Loader: inject Lib + Config for this module.

  @param {Object} shared_libs - loaded libraries + models (Lib)
  @param {Object} config - entity config from model
  @return {void}
  *********************************************************************/
  const loader = function (shared_libs, config) {

    Lib = shared_libs;
    Config = config;

  };

//////////////////////////// Module-Loader END /////////////////////////////////



///////////////////////////// Module Exports START /////////////////////////////
module.exports = function (shared_libs, config) {

  loader(shared_libs, config);

  return EntityController;

};//////////////////////////// Module Exports END //////////////////////////////



////////////////////////////Public Functions START//////////////////////////////
const EntityController = {

  /********************************************************************
  Handle create request

  @param {Object} request - Standardized request { body, auth, meta }

  @return {Object} - Standardized response { success, status, data, error }
  *********************************************************************/
  create: async function (request) {

    const { name, status } = request.body;

    // Delegate to service
    const result = await Lib.[Entity].service.createEntity({
      name: name,
      status: status
    });

    if (!result.success) {
      return Lib.Functions.errorResponse(result.error, result.error.status || 400);
    }

    // Transform output
    const public_data = Lib.[Entity].data.toPublic(result.data);

    return Lib.Functions.successResponse(public_data, 201);

  }

};///////////////////////////Public Functions END///////////////////////////////
```

---

## Phase 4 - Update Server Loader

**File:** `src/server/common/loader.js`

Add to entity namespaces section:

```javascript
  // ==================== ENTITY NAMESPACES START ====================== //

  // Load model packages (non-executed; each entity executed individually)
  const Models = require('../../model');
  const ModelsExtended = require('../../model-server');

  // ... existing entities ...

  // [Entity]: Depends on [list dependencies]. Used by [list dependents]
  // Loads: { data, errors, process, validation, _config }
  const [Entity]Model = Models.[Entity](Lib, {});
  Lib.[Entity] = {
    data: [Entity]Model.data,
    errors: [Entity]Model.errors,
    process: [Entity]Model.process,
    validation: [Entity]Model.validation
  };

  // If entity has server extensions:
  const [Entity]ModelExtended = ModelsExtended.[Entity](Lib, {});
  Lib.[Entity] = { /* extended merges into base, key-by-key */
    data: { ...Lib.[Entity].data, ...[Entity]ModelExtended.data },
    errors: { ...Lib.[Entity].errors, ...[Entity]ModelExtended.errors },
    process: { ...Lib.[Entity].process, ...[Entity]ModelExtended.process },
    validation: { ...Lib.[Entity].validation, ...[Entity]ModelExtended.validation }
  };
  const [Entity]Config = { ...[Entity]Model._config, ...[Entity]ModelExtended._config };
  Lib.[Entity].service = require('../service/[entity].service')(Lib, [Entity]Config);
  Lib.[Entity].controller = require('../controller/[entity].controller')(Lib, [Entity]Config);

  // If no server extensions:
  // Lib.[Entity].service = require('../service/[entity].service')(Lib, [Entity]Model._config);
  // Lib.[Entity].controller = require('../controller/[entity].controller')(Lib, [Entity]Model._config);
```

---

## Checklist

### Base Model
- [ ] Config file created with domain constants
- [ ] Errors file created with error catalog
- [ ] Data file created with builders and DTOs
- [ ] Process file created with pure business logic
- [ ] Validation file created with validation rules
- [ ] Index file created following exact pattern
- [ ] Package index updated to export new entity

### Server Extensions (if needed)
- [ ] Server data file created with server-only methods
- [ ] Server index file created following exact pattern
- [ ] Server package index updated

### Server Layers
- [ ] Service file created with business logic (`src/server/service/[entity].service.js`)
- [ ] Controller file created with adapter logic (`src/server/controller/[entity].controller.js`)
- [ ] Loader updated with new entity (registers `Lib.[Entity].service` and `Lib.[Entity].controller`)

### Testing
- [ ] Model tests created in `_test/test.js`
- [ ] All tests passing: `node --test`

---

## Key Principles Summary

| Aspect | Rule |
|--------|------|
| **Package Index** | Returns `{ Entity: fn, ... }` - non-executed constructors |
| **Entity Execution** | `Models.Entity(Lib, {})` - called individually in loader |
| **Dependencies** | List in header comment; execute in dependency order |
| **Config Privacy** | `_config` stays in loader scope, never on `Lib.Entity` |
| **Extended Pattern** | Base → Lib → Extended → Merge → Config Merge → Service/Controller |
| **File Structure** | Follow exact 3-line header, spacing, and section patterns |
| **Module Format** | All files use identical structure: header → loader → exports → public functions |
