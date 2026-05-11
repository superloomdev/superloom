# Server Model Extensions

Server model extensions add server-only properties and methods to base models. They are **peer packages** to the base model - same internal structure, same return shape - independently loaded and merged by the server loader at runtime.

## Why a Separate Package?

Base models (`model/`) are pure and IO-free, safe to ship to both server and client. Server models contain fields and logic that **must not reach clients** - audit trails, internal IDs, admin-only DTOs, policy rules. Keeping them in a separate package ensures clean separation.

## How It Works

Server model extensions do not import or reference the base model internally. Both packages produce the same shape independently:

```javascript
// Base model returns:
{ data, errors, process, validation, _config }

// Server extension returns:
{ data, errors, process, validation, _config }
```

The **loader** merges them at runtime via key-by-key object spread:

```javascript
// 1. Load both packages (non-executed constructors)
const Models = require('../../model');
const ModelsExtended = require('../../model-server');

// 2. Execute base entity first
const SurveyModel = Models.Survey(Lib, {});
Lib.Survey = {
  data: SurveyModel.data,
  errors: SurveyModel.errors,
  process: SurveyModel.process,
  validation: SurveyModel.validation
};

// 3. Execute server extension (can reference Lib.Survey)
const SurveyModelExtended = ModelsExtended.Survey(Lib, {});

// 4. Merge key-by-key (extended adds to or overrides base)
Lib.Survey = {
  data: { ...Lib.Survey.data, ...SurveyModelExtended.data },
  errors: { ...Lib.Survey.errors, ...SurveyModelExtended.errors },
  process: { ...Lib.Survey.process, ...SurveyModelExtended.process },
  validation: { ...Lib.Survey.validation, ...SurveyModelExtended.validation }
};

// 5. Merge configs privately (not exposed on Lib)
const SurveyConfig = { ...SurveyModel._config, ...SurveyModelExtended._config };
```

After merge, callers access `Lib.Survey.data.*` transparently - both base and server methods are available on the same namespace.

## Config Privacy

Server extensions export `_config` (private, for loader use only). The loader merges `base._config + extended._config` into a local variable and passes it to core/controller modules. `_config` is never exposed on `Lib.Entity`.

## File Structure

Each entity follows the same structure as base model:

```
model-server/
  index.js                    # Package entry point: { Survey: fn, Shared: fn }
  survey/
    index.js                  # Constructor: returns { data, errors, process, validation, _config }
    survey.config.js          # Server-only domain constants
    survey.data.js            # Server-only data methods
    survey.errors.js          # Server-only error catalog
    survey.process.js         # Server-only business logic
    survey.validation.js      # Server-only validation rules
  shared/
    index.js
    shared.config.js
    shared.data.js
    shared.errors.js
    shared.process.js
    shared.validation.js
```

## What Belongs Here

- Server-only fields: `created_by`, `organization_id`, `internal_notes`, `audit_trail`
- Admin-only DTOs and output shapes
- Server-side policy logic and authorization rules
- Database-specific concerns: versioning, soft-delete flags

## What Does NOT Belong Here

- Base entity shapes (those live in `model/`)
- Universal validations (those live in `model/`)
- Client-relevant logic (that lives in `model-client/`)

## Testing

```bash
node --test survey/_test/test.js
```
