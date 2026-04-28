# Creating Entities

A quick-start guide for adding a domain entity to a Superloom project. Use this for the high-level shape; for the full walkthrough with file-by-file templates, see [Entity Creation Guide](../architecture/entity-creation-guide.md).

## On This Page

- [What You Will Create](#what-you-will-create)
- [Step 1 - Base Model](#step-1---base-model)
- [Step 2 - Register in the Loader](#step-2---register-in-the-loader)
- [Step 3 - Add Routes](#step-3---add-routes)
- [Step 4 - Write and Run Tests](#step-4---write-and-run-tests)
- [Where to Next](#where-to-next)

---

## What You Will Create

A Superloom entity is a vertical slice across the layered architecture. The mandatory pieces are the base model and the controller; everything else is added as your endpoint surface grows.

| Layer | Directory | Files |
|---|---|---|
| **Base Model** (mandatory) | `src/model/[entity]/` | `config`, `data`, `errors`, `validation`, `process`, `index`, `_test/` |
| **Server Extension** (optional) | `src/model-server/[entity]/` | `data`, server-only fields and errors |
| **Client Extension** (optional) | `src/model-client/[entity]/` | client-relevant metadata |
| **Controller** (mandatory) | `src/server/controller/` | `[entity].controller.js` (validate, build DTO, delegate) |
| **Service** (mandatory) | `src/server/service/` | `[entity].service.js` (business logic) |
| **Express Routes** (for Docker) | `src/server/interfaces/api/express/` | route file per entity |
| **AWS Lambda Handlers** (for Serverless) | `src/server/interfaces/api/lambda-aws/[entity]/` | one file per endpoint (`create.js`, `get.js`, `update.js`, ...) |
| **Deploy Config** (for Serverless) | `src/server/_deploy/serverless-aws/[entity]/` | `serverless.yml` |

---

## Step 1 - Base Model

### `[entity].config.js` - Domain Constants

```javascript
module.exports = {
  NAME_MIN_LENGTH: 1,
  NAME_MAX_LENGTH: 100,
  STATUS_VALUES: ['active', 'inactive', 'archived'],
  DEFAULT_STATUS: 'active'
};
```

### `[entity].errors.js` - Error Catalog

```javascript
module.exports = {
  NAME_REQUIRED: { code: 'ENTITY_NAME_REQUIRED', message: 'Name is required', status: 400 },
  NOT_FOUND: { code: 'ENTITY_NOT_FOUND', message: 'Entity not found', status: 404 }
};
```

### `[entity].entity.js` - Entity Constructors

```javascript
const CONFIG = require('./[entity].config');

module.exports = {
  createEntity: function (name, status) {
    return {
      name: name ? name.trim() : null,
      status: status || CONFIG.DEFAULT_STATUS,
      created_at: Date.now(),
      updated_at: Date.now()
    };
  }
};
```

### `[entity].validation.js` - Pure Validation

```javascript
const CONFIG = require('./[entity].config');
const ERRORS = require('./[entity].errors');

module.exports = {
  validateCreate: function (name) {
    const errors = [];
    if (!name || typeof name !== 'string') { errors.push(ERRORS.NAME_REQUIRED); }
    return errors.length > 0 ? errors : false;
  }
};
```

### `[entity].dto.js` - One Shape

```javascript
module.exports = {
  // ONE canonical builder - same shape for create, update, read
  buildEntityData: function (id, name, status, created_at, updated_at) {
    const data = {};
    if (id !== undefined)         { data.id = id; }
    if (name !== undefined)       { data.name = name; }
    if (status !== undefined)     { data.status = status; }
    if (created_at !== undefined) { data.created_at = created_at; }
    if (updated_at !== undefined) { data.updated_at = updated_at; }
    return data;
  },

  // Public version - derived from full object
  buildEntityDataPublic: function (entity_data) {
    const data = {};
    if (entity_data.id !== undefined)         { data.id = entity_data.id; }
    if (entity_data.name !== undefined)       { data.name = entity_data.name; }
    if (entity_data.status !== undefined)     { data.status = entity_data.status; }
    if (entity_data.created_at !== undefined) { data.created_at = entity_data.created_at; }
    return data;
  }
};
```

---

## Step 2 - Register in the Loader

Add the entity to `src/server/common/loader.js` so the rest of the application can reach it through `Lib`. The base model executes first; if a server extension exists, it loads next and merges into the same namespace key-by-key.

```javascript
// Load base model (returns { data, errors, process, validation, _config })
const [Entity]Model = Models.[Entity](Lib, {});
Lib.[Entity] = {
  data: [Entity]Model.data,
  errors: [Entity]Model.errors,
  process: [Entity]Model.process,
  validation: [Entity]Model.validation
};

// Optional - merge server extensions
const [Entity]ServerModel = ModelsExtended.[Entity](Lib, {});
Lib.[Entity] = {
  data: { ...Lib.[Entity].data, ...[Entity]ServerModel.data },
  errors: { ...Lib.[Entity].errors, ...[Entity]ServerModel.errors },
  process: { ...Lib.[Entity].process, ...[Entity]ServerModel.process },
  validation: { ...Lib.[Entity].validation, ...[Entity]ServerModel.validation }
};
const [Entity]Config = { ...[Entity]Model._config, ...[Entity]ServerModel._config };

// Build service and controller layers
Lib.[Entity].service = require('../service/[entity].service')(Lib, [Entity]Config);
Lib.[Entity].controller = require('../controller/[entity].controller')(Lib, [Entity]Config);
```

Full merge mechanics live in [`architecture/model-modules.md`](../architecture/model-modules.md).

---

## Step 3 - Add Routes

**Express** - register a route file in the Express interface:

```javascript
app.use('/[entity]', require('./routes/[entity]')(Lib));
```

**AWS Lambda** - create one handler file per endpoint under `src/server/interfaces/api/lambda-aws/[entity]/` and a corresponding `serverless.yml` under `src/server/_deploy/serverless-aws/[entity]/`. Each entity is its own deployable Serverless service.

See [`architecture/server-interfaces.md`](../architecture/server-interfaces.md) for the standardized request/response shapes both adapters produce.

---

## Step 4 - Write and Run Tests

Create `_test/test.js` covering every exported function. Place fixtures in `_test/mock-data/` as JSON files:

```bash
# Run a single entity's tests
node --test src/model/[entity]/_test/test.js

# Run every base-model entity test
cd src/model && npm test
```

Tests use the Node.js built-in test runner (`node --test`) and `node:assert/strict`. Naming convention: `should [expected behavior] when [condition]`. Full rules in [`architecture/unit-test-authoring.md`](../architecture/unit-test-authoring.md).

---

## Where to Next

| Goal | Read |
|---|---|
| Full file-by-file walkthrough | [Entity Creation Guide](../architecture/entity-creation-guide.md) |
| Understand the one-shape DTO rule | [DTO Philosophy](../philosophy/dto-philosophy.md) |
| Understand validation patterns | [Validation Approach](../architecture/validation-approach.md) |
| Understand error handling | [Error Handling](../architecture/error-handling.md) |
| Understand the loader and Lib container | [Server Loader](../architecture/server-loader.md) |
