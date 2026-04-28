# Client Model Extensions

Client model extensions add client-relevant properties and methods to base models. They are **peer packages** to the base model - same internal structure, same return shape - independently loaded and merged by the client-side loader at runtime.

## Why a Separate Package?

Base models (`model/`) contain universal domain logic shared by both server and client. Client models add fields and logic that are **only relevant on the client side** - things the server doesn't need and shouldn't carry. Keeping them separate keeps server bundles light.

## How It Works

Same peer-package pattern as `model-server/`. Client extensions do not import or reference the base model internally. Both packages produce the same shape, and the client-side loader merges them at runtime via key-by-key object spread.

```javascript
// 1. Load both packages
const Models = require('../../model');
const ModelsClient = require('../../model-client');

// 2. Execute base entity
const SurveyModel = Models.Survey(Lib, {});
Lib.Survey = {
  data: SurveyModel.data,
  errors: SurveyModel.errors,
  process: SurveyModel.process,
  validation: SurveyModel.validation
};

// 3. Execute client extension and merge
const SurveyModelClient = ModelsClient.Survey(Lib, {});
Lib.Survey = {
  data: { ...Lib.Survey.data, ...SurveyModelClient.data },
  errors: { ...Lib.Survey.errors, ...SurveyModelClient.errors },
  process: { ...Lib.Survey.process, ...SurveyModelClient.process },
  validation: { ...Lib.Survey.validation, ...SurveyModelClient.validation }
};
```

After merge, callers access `Lib.Survey.data.*` transparently - both base and client methods are available.

## What Belongs Here

- Client-relevant metadata: `last_fetched_date`, `cache_expiry`, `sync_status`
- Client-side state tracking helpers
- Lightweight client-only validations (e.g., real-time form checks)
- Client-specific formatting and presentation helpers
- Optimistic update logic

## What Does NOT Belong Here

- Server logic (that lives in `model-server/`)
- Security-critical validations (those must be in `model/` or `model-server/`)
- Database or API calls (those belong in service layers)
- Browser-specific or platform-specific APIs (`localStorage`, `window`, `document`)

## File Structure

Same structure as base model and server model:

```
model-client/
  index.js                    # Package entry point: { Survey: fn, ... }
  [entity]/
    index.js                  # Constructor: returns { data, errors, process, validation, _config }
    [entity].config.js
    [entity].data.js
    [entity].errors.js
    [entity].process.js
    [entity].validation.js
```

## Current Status

Placeholder - no entity extensions yet. Structure is ready for future client-specific additions.
