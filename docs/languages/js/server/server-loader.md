# Server Loader

> **Language:** JavaScript

The `loader.js` at `src/server/common/loader.js` is the **bootstrap and dependency-injection root** of the server. It loads configuration, builds the `Lib` container, registers every entity, and wires controllers and services together. Nothing else in the server runtime reads `process.env` or instantiates helper modules - that all happens here.

## On This Page

- [What the Loader Does](#what-the-loader-does)
- [Runtime Objects](#runtime-objects)
- [Lifecycle Configuration](#lifecycle-configuration)
- [Why Dependency Injection](#why-dependency-injection)
- [Dependency Injection Rules](#dependency-injection-rules)
- [Scope Boundaries](#scope-boundaries)
- [Mental Model](#mental-model)
- [Example - Loading Models and Services](#example---loading-models-and-services)
- [Key Principles](#key-principles)
- [Further Reading](#further-reading)

---

## What the Loader Does

The loader runs once per process. It performs five tasks in order:

1. **Load static config** from `config.js`
2. **Merge environment variables** over the static config (env overrides static)
3. **Apply entry-point policy** from the loader argument
4. **Build runtime objects** - the `Lib` dependency container and the `Config` configuration
5. **Wire entities** - load each model package, execute it with `Lib`, build service and controller layers

After the loader returns, the rest of the server runtime treats `Lib` as a read-only registry.

---

## Runtime Objects

The loader builds two runtime objects and returns them.

### `Lib` - Dependency Container

The central registry of all loaded dependencies (external helpers + internal project modules). Passed **as-is** to every module that needs it. Modules ask `Lib` for what they need; nothing else.

### `Config` - Resolved Application Config

The full merged configuration (static + env). Modules should not read `process.env` or load config files directly - the loader provides the relevant slice. Configuration must be:

- **Immutable** after load
- **Explicitly passed** to consumers
- **Centralized and auditable** - the loader is the only place that reads env vars

---

## Lifecycle Configuration

The entry point calls the loader with its runtime policy. The loader uses that value when it constructs `Lib.Instance`:

```javascript
import buildUtils from 'helper-utils';
import buildDebug from 'helper-debug';
import buildInstance from 'helper-instance';

const buildLib = function (runtime_config) {

  const Lib = {};

  Lib.Utils = buildUtils(Lib, {});
  Lib.Debug = buildDebug(Lib, {});
  Lib.Instance = buildInstance(Lib, {
    CLOSE_ON_CLEANUP: runtime_config.CLOSE_ON_CLEANUP
  });

  return Lib;

};
```

The persistent entry point passes `false`; the request-isolated entry point passes `true`. The loader constructs `Lib.Instance` once, so every module registers against the same process cleanup queue.

---

## Why Dependency Injection

The alternative is direct `import` calls scattered across modules. The problem with direct imports is coupling: if a service hard-codes `import db from '../helpers/db.js'`, you cannot test that service without a real database. With `Lib`, you can replace any dependency by swapping what the loader puts in the container: a real DB connection in production, a lightweight stub in tests.

The loader also controls initialization order. Helpers load first (they have no dependencies on entity code), then models (they depend on helpers), then services (they depend on both), then controllers (they depend on everything). Nothing reads `process.env` or loads a config file outside this sequence. The entire dependency graph is visible in one file.

---

## Dependency Injection Rules

| Rule | Detail |
|---|---|
| **All modules receive `Lib`** | Through the loader function's first argument (`shared_libs`) |
| **All server-modules receive `Config`** | Through the loader function's second argument |
| **Helper modules receive only their relevant sub-config** | Never the entire `Config` object - only the slice they need |
| **No other module reads `process.env`** | The loader is the sole gateway to the environment |
| **No module loads config files directly** | The loader is the sole gateway to `config.js` |
| **No module imports random packages** | Only helper-module wrappers may import the libraries they wrap |

---

## Scope Boundaries

- Business or domain logic - belongs in `server-service`
- Request handling - belongs in `server-interfaces`
- Entity-specific workflows - belongs in `server-service`

The loader is plumbing. It wires things up and gets out of the way.

---

## Mental Model

| Question | Answer |
|---|---|
| A module needs something | It asks `Lib` |
| A module needs configuration | It receives only the slice the loader gives it |
| Something is not in `Lib` | It does not exist for the application |

---

## Example - Loading Models and Services

```javascript
// src/server/common/loader.js
import staticConfig from './config.js';
import buildUtils from 'helper-utils';
import buildDebug from 'helper-debug';
import buildInstance from 'helper-instance';
// import buildDb from '@your-org/js-server-helper-sql-postgres';
// import buildS3 from '@your-org/js-server-helper-storage-aws-s3';
import Models from '../../model/index.js';
import ModelsExtended from '../../model-server/index.js';
import buildContactService from '../service/contact.service.js';
import buildUserService from '../service/user.service.js';
import buildSurveyService from '../service/survey.service.js';
import buildContactController from '../controller/contact.controller.js';
import buildUserController from '../controller/user.controller.js';
import buildSurveyController from '../controller/survey.controller.js';

const loader = async function (runtime_config) {

  // Step 1: Load static config and merge with environment variables
  const Config = {
    ...staticConfig,
    PORT: process.env.PORT || staticConfig.PORT,
    DB_HOST: process.env.DB_HOST || staticConfig.DB_HOST
  };

  // Step 2: Build dependency container
  const Lib = {};

  // Step 3: Load foundation helpers
  Lib.Utils = buildUtils(Lib, {});
  Lib.Debug = buildDebug(Lib, Config.debug);

  // Step 4: Load one lifecycle manager with entry-point policy
  Lib.Instance = buildInstance(Lib, {
    CLOSE_ON_CLEANUP: runtime_config.CLOSE_ON_CLEANUP
  });

  // Optional: Uncomment and configure as needed
  // Lib.DB = buildDb(Lib, Config.database);
  // Lib.S3 = buildS3(Lib, Config.aws_s3);

  // Step 5: Load model packages (non-executed - returns object of constructors)
  // Models and ModelsExtended imported at top level

  // Step 6: Execute entities in dependency order (independent first)

  // Contact - no dependencies
  const ContactModel = Models.Contact(Lib, {});
  Lib.Contact = {
    data: ContactModel.data,
    errors: ContactModel.errors,
    process: ContactModel.process,
    validation: ContactModel.validation
  };

  // User - depends on Contact
  const UserModel = Models.User(Lib, {});
  Lib.User = {
    data: UserModel.data,
    errors: UserModel.errors,
    process: UserModel.process,
    validation: UserModel.validation
  };

  // Survey - depends on Contact, User; has server extensions
  const SurveyModel = Models.Survey(Lib, {});
  Lib.Survey = {
    data: SurveyModel.data,
    errors: SurveyModel.errors,
    process: SurveyModel.process,
    validation: SurveyModel.validation
  };

  // Load and merge extended model
  const SurveyModelExtended = ModelsExtended.Survey(Lib, {});
  Lib.Survey = {
    data: { ...Lib.Survey.data, ...SurveyModelExtended.data },
    errors: { ...Lib.Survey.errors, ...SurveyModelExtended.errors },
    process: { ...Lib.Survey.process, ...SurveyModelExtended.process },
    validation: { ...Lib.Survey.validation, ...SurveyModelExtended.validation }
  };

  // Merge configs privately (not exposed on Lib)
  const SurveyConfig = { ...SurveyModel._config, ...SurveyModelExtended._config };

  // Step 7: Build service modules (receive Lib + private _config)
  Lib.Contact.service = buildContactService(Lib, ContactModel._config);
  Lib.User.service = buildUserService(Lib, UserModel._config);
  Lib.Survey.service = buildSurveyService(Lib, SurveyConfig);

  // Step 8: Build controller modules (receive Lib + private _config)
  Lib.Contact.controller = buildContactController(Lib, ContactModel._config);
  Lib.User.controller = buildUserController(Lib, UserModel._config);
  Lib.Survey.controller = buildSurveyController(Lib, SurveyConfig);

  // Return runtime objects
  return { Lib, Config };

};

export default loader;
```

---

## Key Principles

The example above demonstrates the rules every loader follows:

1. **Lifecycle manager loaded once** - every cleanup registration reaches the same queue
2. **Package indices loaded once** - `import Models from '../../model/index.js'` is the entry point
3. **Each entity executed individually** - `Models.Entity(Lib, {})` returns the entity's APIs
4. **Dependencies available in `Lib` for subsequent entities** - Contact loads first because User depends on it
5. **Extended models load after the base is assigned to `Lib`** - so the extension can reference its own base
6. **`_config` stays private** - never exposed on `Lib.Entity`, only passed to service and controller
7. **Service and controller receive their config via parameters** - not from a global

---

## Further Reading

- [Server Common](server-common.md) - the directory `loader.js` lives in and what else lives there
- [Connection Lifecycle](connection-lifecycle.md) - runtime policy and cleanup ownership
- [Server Service Modules](server-service-modules.md) - what services do once the loader builds them
- [Server Controller Modules](server-controller-modules.md) - what controllers do once the loader builds them
- [Module Structure (JavaScript)](../module-structure) - the model package index and the server-extension merge mechanics
- [Model Modules](model-modules.md) - the base + server + client model layers
