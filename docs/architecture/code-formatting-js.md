# JavaScript Coding Standards

The complete style guide for JavaScript code in Superloom modules. ESLint enforces most of these rules automatically; the rest are conventions every contributor and AI agent is expected to follow. The compressed mirror of this guide lives in [`AGENTS.md`](../../AGENTS.md).

## On This Page

- [Tooling](#tooling)
- [Source Style](#source-style)
- [Vertical Spacing (3/2/1 Rule)](#vertical-spacing-321-rule)
- [Section Header Hierarchy](#section-header-hierarchy)
- [Private Functions Enclosure](#private-functions-enclosure)
- [Section Closing Banners](#section-closing-banners)
- [Variable Declarations](#variable-declarations)
- [Naming Conventions](#naming-conventions)
- [Function Parameter Conventions](#function-parameter-conventions)
- [Multi-line Literals](#multi-line-literals)
- [Return Objects](#return-objects)
- [Control Flow](#control-flow)
- [Data Output](#data-output)
- [Error Handling Disposal](#error-handling-disposal)
- [Performance Logging](#performance-logging)
- [JSDoc Style](#jsdoc-style)
- [Comment Style](#comment-style)
- [Spelling and Prose Quality](#spelling-and-prose-quality)
- [Dependencies](#dependencies)
- [AWS and Cloud SDK Modules](#aws-and-cloud-sdk-modules)

---

## Tooling

| Tool | Role | Command |
|---|---|---|
| **ESLint v9+** | Lint and auto-fix | `npm run lint`, `npm run lint:fix` |
| **Flat config** | Required by ESLint v9 | Every module ships an `eslint.config.js` |
| **Editor integration** | Auto-fix on save | See [`docs/guide/ide-setup.md`](../guide/ide-setup.md) |

ESLint catches `no-var`, `prefer-const`, `no-unused-vars`, `no-useless-assignment`, and the formatting rules below. CI runs `npm run lint` on every push - fix locally before pushing.

### General Principles

- **Keep it simple.** Code should be easy to read and understand.
- **Functions over classes.** Prefer plain functions and object literals.
- **Node.js standards.** Follow standard Node.js conventions; no clever tricks.

---

## Source Style

| Rule | Example |
|---|---|
| Single quotes for strings | `'hello'` not `"hello"` |
| 2-space indentation | Spaces, never tabs |
| No trailing commas | `[1, 2, 3]` not `[1, 2, 3,]` |
| No trailing whitespace | Editor must trim |
| Newline at end of file | Required |
| Semicolons | Required at end of every statement |
| Space before function paren | `function (param)` not `function(param)` |
| Space before block | `if (cond) {` not `if (cond){` |
| Space around operators | `a + b` not `a+b`, `x === y` not `x===y` |
| Object brace spacing | `{ key: value }` not `{key:value}` |
| Array bracket spacing | `[1, 2, 3]` not `[ 1, 2, 3 ]` |
| Comma spacing | `[1, 2, 3]` not `[1 ,2 ,3]` |

---

## Vertical Spacing (3/2/1 Rule)

The vertical spacing follows a strict hierarchy that creates visual structure at three scales:

| Spacing | Purpose |
|---|---|
| **3 blank lines** | Between major module sections (Module-Loader, Module Exports, Public Functions, Private Functions, `createInterface`) |
| **2 blank lines** | Between individual function definitions |
| **1 blank line** | After opening `{`, before closing `}`, between logical blocks inside a function |

### Spacing Reference Table

| Location | Blank lines | Why |
|---|---|---|
| Between `let` declarations at module top | 1 | `let Lib;` → blank → `let CONFIG;` |
| After CONFIG, before Module-Loader header | 2 | Marks the start of the loader section |
| Between major module sections | 3 | Largest visual separator |
| Between function definitions | 2 | Functions are visually distinct units |
| After function opening `{` | 1 | Internal breathing room |
| Before function closing `}` | 1 | Internal breathing room |
| Between logical blocks inside a function | 1 | Groups related statements |
| Before comment headers (`// Initialize`, `// Run query`) | 1 | Sets the comment apart visually |
| After JSDoc, before function body | 1 | Separates docs from code |
| Between `if`/`else` blocks | 1 | Visual branch separation |
| After `return` statement | 1 | Returns are visually isolated |

### Standard Module Skeleton

```javascript
// Info: [Module purpose - 1 line]
// [What it does - 1 line]
// [Pattern indicator - 1 line]
'use strict';


// Shared dependencies (injected by loader; avoids passing Lib everywhere)
let Lib;

// Domain config (injected; constants/enums, not runtime env)
let CONFIG;


/////////////////////////// Module-Loader START ////////////////////////////////

const loader = function (shared_libs, config) {

  Lib = shared_libs;
  CONFIG = config;

};

//////////////////////////// Module-Loader END /////////////////////////////////



///////////////////////////// Module Exports START /////////////////////////////
module.exports = function (shared_libs, config) {

  loader(shared_libs, config);
  return ModuleName;

};//////////////////////////// Module Exports END //////////////////////////////



////////////////////////////Public Functions START//////////////////////////////
const ModuleName = {

  /********************************************************************
  Function description.

  @param {Type} name - Description
  @return {Type} - Description
  *********************************************************************/
  functionName: function (params) {

    // Compute the result
    const result = doSomething(params);

    // Return the computed value
    return result;

  }

};////////////////////////////Public Functions END///////////////////////////////
```

---

## Section Header Hierarchy

Three levels of section separators signal different granularity. Use them from coarsest to finest.

| Level | Marker | Purpose |
|---|---|---|
| **1** | `/////////////////////////// [Name] START /////////////////////` | Major module sections: `Module-Loader`, `Module Exports`, `createInterface`, `Public Functions`, `Private Functions` |
| **2** | `// ~~~~~~~~~~~~~~~~~~~~ [Name] ~~~~~~~~~~~~~~~~~~~~` + one-line purpose | Subsections inside a public/private function object, grouped by responsibility |
| **3** | `// [comment]` | Inline comment above a logical block inside a function |

### When to Use Level 2 Subsections

Use Level 2 subsections inside public or private function objects when **either**:

- The module has 5+ exported functions, **or**
- The functions fall into 2+ clear responsibility groups (e.g., `Core Execution`, `Read Helpers`, `Transactions`, `Lifecycle`)

### Level 2 Example

```javascript
const ModuleName = {

  // ~~~~~~~~~~~~~~~~~~~~ Read Helpers ~~~~~~~~~~~~~~~~~~~~
  // Functions that return data without modifying state.

  /********************************************************************
  Function description
  *********************************************************************/
  getRow: function () { /* ... */ },


  /********************************************************************
  Function description
  *********************************************************************/
  getRows: function () { /* ... */ },


  // ~~~~~~~~~~~~~~~~~~~~ Write Helpers ~~~~~~~~~~~~~~~~~~~~
  // Functions that modify state.

  /********************************************************************
  Function description
  *********************************************************************/
  insert: function () { /* ... */ }

};
```

**Subsection rules:**

- Subsection name is a short noun phrase, two to four words, title-cased
- The purpose comment under the marker explains what binds the functions together. Keep it concise - one line is ideal, up to 4 lines is acceptable when the grouping needs real motivation (dialect quirks, hot-path notes, security invariants)
- Leave 2 blank lines between the last function of one subsection and the next subsection marker

---

## Private Functions Enclosure

Private helpers inside `createInterface` must always be declared as a `const _Name = { ... }` object literal — never as bare `Name.method = function(...)` property assignments on the public object.

```javascript
///////////////////////////Private Functions START/////////////////////////////
const _Validators = {

  assertNonEmptyString: function (value, field, fn_name) {
    // ...
  },

  assertEnum: function (value, field, fn_name, allowed) {
    // ...
  }

};///////////////////////////Private Functions END//////////////////////////////
```

**Rules:**

- The private enclosure is named `_Name` where `Name` matches the public object (e.g., `_Auth`, `_Validators`, `_Cookie`, `_RecordShape`)
- All call sites inside the public object use `_Name.method(...)`, not `Name.method(...)`
- The enclosure follows immediately after the `///Private Functions START///` banner
- If a private helper calls another private helper, it uses `_Name.otherHelper(...)` as well

---

## Section Closing Banners

The closing `};` of every named section must be combined on the same line as the `///...END...///` banner — never on a separate line.

The closing `};` combined with the END banner:

```javascript
  };///////////////////////////Public Functions END////////////////////////////////

  };///////////////////////////Private Functions END//////////////////////////////

};/////////////////////////// createInterface END ////////////////////////////////
```

This applies to every section closer: `Public Functions END`, `Private Functions END`, `createInterface END`, `Module-Loader END`, `Module Exports END`.

---

## Variable Declarations

| Declaration | When to use |
|---|---|
| **`const`** | Default. Use for any variable whose binding never changes - including objects and arrays (the reference does not change, only the contents) |
| **`let`** | Only when the binding is reassigned. Examples: `let Lib;` reassigned in loader; `let count = 0;` in a loop |
| **`var`** | **Never.** All modern Node.js (>= 14) and browsers support block-scoped `let`/`const`. `var`'s function scoping and hoisting cause subtle bugs |

ESLint enforces this via `no-var` (error) and `prefer-const` (error).

### Variable Initialization

Do not initialize a variable with a placeholder value if it will be reassigned before it is ever read. ESLint v10's `no-useless-assignment` rule flags this.

| Pattern | Verdict |
|---|---|
| `let result;` then `result = calculate();` | ✅ Initializer omitted, assigned before read |
| `let result = '';` then `result = calculate();` | ❌ Empty string is never read - useless assignment |
| `let result = '';` then conditional reassignment in some branches | ✅ Useful when some branches read without reassigning |

---

## Naming Conventions

### Function Naming

- **Standard pattern:** descriptive verb-noun, no HTTP method suffix - `createUser()`, `deleteFile()`, `sendEmail()`
- **Multi-HTTP-method pattern:** when 2+ functions do the same thing with different HTTP methods, suffix with the method:
  - `generateUploadUrlPut()` - PUT method (simple URL)
  - `generateUploadUrlPost()` - POST method (with form fields)
  - `generateDownloadUrlGet()` - GET method
- **Decision rule:** apply HTTP method suffixes only when 2+ functions exist for the same goal. Single-method functions stay plain
- **Avoid generic wrappers:** prefer `generateUploadUrlPut()` and `generateDownloadUrlGet()` over a `generateUrls()` convenience function

### Module Naming

Use category-based naming so related modules sort and group together:

| Category | Prefix | Examples |
|---|---|---|
| Relational databases | `sql-` | `js-server-helper-sql-mysql`, `js-server-helper-sql-postgres`, `js-server-helper-sql-sqlite` |
| NoSQL databases | `nosql-` | `js-server-helper-nosql-mongodb` |
| AWS NoSQL | `nosql-aws-` | `js-server-helper-nosql-aws-dynamodb` |
| AWS object storage | `storage-aws-` | `js-server-helper-storage-aws-s3`, `js-server-helper-storage-aws-s3-url-signer` |
| AWS message queue | `queue-aws-` | `js-server-helper-queue-aws-sqs` |

**Vendor placement:**

- Vendor name as **infix** for cloud-specific services (`-aws-`, `-gcp-`)
- No vendor prefix for vendor-agnostic modules (`sql-mysql`, `nosql-mongodb`)
- Pattern: `[category]-[vendor]-[service]` for cloud-specific modules

### Module Terminology (Consistent Across Modules)

| Term | Meaning |
|---|---|
| `Lib` | Shared library container injected at loader time |
| `CONFIG` | Entity-specific or module-specific configuration |
| `loader` | Dependency injection function |
| `shared_libs` | Parameter name for the `Lib` argument in `loader` |
| `config_module` | Parameter name for module configuration in `loader` |

### Parameter Naming

- **No underscore prefix on parameters.** Use an inline `// eslint-disable-line no-unused-vars` comment on the function signature instead of `_param` to suppress ESLint's `no-unused-vars` warning
- **No `void param;` statements.** `void` executes at runtime (as a no-op expression) and is a non-standard workaround. Always use the `eslint-disable-line` approach instead

Clean parameter name with an inline directive when needed:

```javascript
const createInterface = function (Lib, CONFIG, ERRORS) { // eslint-disable-line no-unused-vars
```

### Uniform Factory Signatures

When a module family (e.g. `parts/`) uses a **uniform factory signature** for consistency so the parent can call all parts identically, some parts will not consume every parameter. This is expected and correct — do not change the signature to match only what is consumed today.

The signature is uniform across all parts: `(Lib, CONFIG, ERRORS)`. When a part only uses `Lib` today, `CONFIG` and `ERRORS` are suppressed with `eslint-disable-line`. The directive is **optional** — add it only when there is an unused parameter; remove it when all parameters are consumed.

```javascript
const createInterface = function (Lib, CONFIG, ERRORS) { // eslint-disable-line no-unused-vars
```

Never use `void CONFIG;` or `void ERRORS;` as a workaround for this case.

---

## Function Parameter Conventions

Use this decision rule for every function signature:

| Situation | Pattern | Name |
|---|---|---|
| 4+ parameters, or any optional parameter, or parameters likely to grow | Single options object | `options` |
| 3 or fewer parameters, all required, all unlikely to change | Positional params | `param1, param2, param3` |

**Never use `args` as a parameter name.** Use `options` for named-property bundles and plain descriptive names for positional params.

7+ fields — use an options object:

```javascript
applyLimits: function (options) {
  options.existing; options.limits.total_max; // etc.
}
```

2 required positional parameters:

```javascript
composeCookieName: function (cookie_prefix, tenant_id) { }
```

**Closed-over dependencies are never in the options object.** If a private helper function accesses `Lib`, `CONFIG`, or `store` from the enclosing closure, do not pass those as fields in the options bundle. Only pass the per-call data the function cannot otherwise reach.

Only pass per-call data that the function cannot reach from its enclosing closure:

```javascript
_Auth.scheduleBackgroundRefresh(instance, record, ttl_seconds, tenant_id);
```

---

## Multi-line Literals

Multi-line layouts keep `git diff` readable when fields are added later.

| Construct | Always multi-line | Single-line acceptable |
|---|---|---|
| **Return objects** | Yes - always multi-line | Never |
| **`package.json`** | Yes - always multi-line | Never |
| **YAML arrays** | Yes - `branches:\n  - main` | Never `branches: [main]` |
| **Nested JSON** | Yes when 2+ items or nested structure | Single-line OK only for `{}` and `[]` |
| **JS object literals in assignments** | Multi-line preferred when fields might grow | Single-line OK if short and stable |

---

## Return Objects

Return statements with objects must always be multi-line. This applies to success returns, error returns, and any `return { ... }` pattern.

```javascript
return {
  success: false,
  items: [],
  count: 0,
  error: { type: 'QUERY_ERROR', message: error.message }
};
```

---

## Control Flow

| Rule | Applies to |
|---|---|
| **Block statements always** | All `if` statements use `{}` braces - no inline `if (cond) doStuff();` |
| **Explicit returns** | Always use the `return` keyword - no implicit returns from arrow functions where return value matters |

---

## Data Output

| Rule | Example |
|---|---|
| **Snake case for output JSON** | `user_agent`, `ip_address`, `created_at` (never `userAgent`) |
| **Named undefined params** | `/* id */ undefined, // ID not yet assigned` when passing positional `undefined` |

---

## Error Handling Disposal

Three categories, three disposal mechanisms. Never mix them.

| Category | Disposal |
|---|---|
| **Programmer error** (bad arguments, wrong shape) | `throw new TypeError(...)` synchronously |
| **Operational / state error from a helper module** | Return envelope `{ success: false, error: { type, message } }` |
| **Domain / user-facing validation error** | Return `{ success: false, error: <DomainError> }` where `<DomainError>` is `{ code, message, status }` from `[entity].errors.js` |

Full rule with rationale and worked examples: [`error-handling.mdx`](error-handling.mdx).

---

## Performance Logging

Every external service operation (database, cloud API, HTTP, queue) must log performance.

```javascript
const time_start = Date.now();
const response = await cloud_client.send(command);
Lib.Debug.performanceAuditLog('End', 'ServiceName Operation - ' + identifier, time_start);
```

**Rules:**

- Use `Lib.Debug.performanceAuditLog(action, routine, time_start)` - it calculates `elapsed_ms` and includes memory usage
- For instance-tracked modules, prefer `instance['time_ms']` over `time_start` so the log shows elapsed time since the request began (request-level timeline)
- Client/SDK initialization must log performance - import + connect time matters
- Error logs must include performance data - duration on failure helps diagnose timeouts

---

## JSDoc Style

Every exported function carries a JSDoc block. Document the action, then the parameters, then the return shape.

### JSDoc Block Conventions

- Open with a one-sentence summary stating the action the function performs
- Optional second paragraph for non-obvious behavior, examples, or syntax notes
- `@param` lines list every parameter in signature order with type and one-line purpose
- `@return` (singular, not `@returns`) describes the return shape; for object returns, list the keys inline (not as separate `* @return` sub-fields)

### Body Indentation

All lines inside a JSDoc block (description, `@param`, `@return`, notes) are indented **4 spaces** from the column of the `/*` delimiter. This applies even when the JSDoc block sits inside an object literal that is itself indented 4 spaces.

### Nested Object Params and Returns

Use JSDoc dot-notation - one `@param` or `@return` line per nested field. Never use custom `* @param` sub-indentation.

```javascript
/********************************************************************
    Validate every key in the options map.

    @param {Object} [options] - Map of option names to their rule definitions
    @param {Set} options[key].error - Error object for this key
    @param {Boolean} [options[key].not_null] - (Optional) Reject null values

    @return {Object} - Result data object
    @return {String} .name - Name of the item
    @return {String[]} .tags - List of associated tags
*********************************************************************/
```

---

## Comment Style

Write comments as a teammate would explain the line, not as marketing or reference-manual prose.

### Voice and Tone

- **Prescriptive voice:** "Run the query", "Return a service error if the driver call failed", "Build pool on first call"
- **One idea per comment.** Split multi-idea sentences into separate lines or remove the redundant half
- **State the why** when it is not obvious from the code; skip the comment when the code already says it
- **No vendor-specific examples** in framework-level docs; vendor names belong in parenthetical clarifications only (e.g. `Serverless function (Lambda, Cloud Function)`)
- **No migration breadcrumbs**, no "legacy" labels, no references to previous codebases - that context belongs in `__dev__/migration-changelog.md`

### Inline Step Comments Inside Functions

- Every logical block within a function gets a single-line comment explaining what the next 2-5 lines do
- The first logical block after the opening `{` starts with a one-line step comment (`// Build pool on first call`, `// Start performance timeline`, ...)
- Every subsequent block separated by a blank line also gets a one-line comment
- Comments describe **intent**, not syntax: prefer `// Pick the first column of the row` over `// Get keys[0]`
- Inside `try`/`catch`, the `catch` block's first comment explains the **fallback behavior**, not that the try failed
- **No exceptions for short functions.** Even a single-block function with one `await` and one `if` still gets its opening step comment
- Use plain, direct language in comments: `// Return a service error if the driver call failed` not `// Bubble up the error`

Every block has a step comment, even a short function:

```javascript
removeItem: async function (instance, id) {

  // Delete the row by primary key
  const result = await Lib.DB.write(
    instance,
    'DELETE FROM items WHERE id = ?',
    [id]
  );

  // Return a service error if the driver call failed
  if (result.success === false) {
    Lib.Debug.debug('removeItem failed', { ... });
    return { success: false, error: ERRORS.SERVICE_UNAVAILABLE };
  }

  // Report success
  return { success: true, error: null };

},
```

### Adapter and Driver Lazy-Load Pattern

- Third-party drivers, SDKs, and native clients are cached at module scope via a private helper named `ensureAdapter()`
- The first call to any function that needs the external library calls `ensureAdapter()` first
- Use `ensureAdapter` for every multi-instance module that wraps a vendor library (MySQL, Postgres, MongoDB, AWS SDK, ...) - do not invent a new name per module

---

## Spelling and Prose Quality

These rules apply to **every file** the AI or human writes - `.js` comments and strings, `.md` documentation, `package.json` descriptions, `README.md`, `ROBOTS.md`, workflow files, and commit messages.

| Rule | Correct | Incorrect |
|---|---|---|
| American English (z not s) | `initialize`, `standardize`, `optimize`, `organize`, `centralize`, `authorize` | `initialise`, `standardise`, `optimise`, `organise`, `centralise`, `authorise` |
| American English (or not our) | `behavior`, `color`, `favor` | `behaviour`, `colour`, `favour` |
| American English (ize not ise) | `optimization`, `organization` | `optimisation`, `organisation` |
| American English (license) | `license` | `licence` |
| No em-dashes | `- description` or `word - word` in all files | `word — word` (Unicode U+2014) in any file type |
| No Unicode arrows in code files | `->` in `.js` comments and strings | `→` is forbidden in `.js` files. `→` IS allowed in `.md` documentation (reduces tokens, improves clarity) |
| No em-dash as list-item separator | `**Term.** Explanation sentence.` | `**Term** — explanation` |

---

## Dependencies

| Rule | Detail |
|---|---|
| **Minimize external deps** | Prefer built-in Node.js APIs over external libraries when possible |
| **Wrap all libraries** | All external libraries are wrapped in helper modules. No direct imports in business logic |
| **Reuse `Lib.Utils`** | Before writing a utility (type check, validation, sanitization), check if `Lib.Utils` already provides it |
| **Pin to verified latest** | Verify the current latest version with Context7 MCP and `npm view <pkg> version` before locking a range |
| **Declare `engines.node`** | Every module's `package.json` declares the minimum Node.js version it supports |
| **No `keywords` field** | Omit `keywords` from `package.json` entirely |

Full publishing pipeline: [`module-publishing.md`](module-publishing.md). Peer dependency strategy: [`peer-dependencies.md`](peer-dependencies.md).

---

## AWS and Cloud SDK Modules

When writing helper modules that wrap AWS or other cloud SDKs:

| Rule | Detail |
|---|---|
| **3-layer DRY** | Builder (pure, no I/O) → Command Executor (I/O) → Convenience (calls both). Convenience functions internally use `commandBuilder` + `commandExecutor`. Builders are also used by transaction functions |
| **Explicit credentials** | Always pass `KEY` and `SECRET` from CONFIG - never rely on the implicit credential chain inside module code. Loader injects credentials |
| **Descriptive SDK variable names** | Name imports after the service - `S3Client`, `DynamoDB`, `SQSClient` - never `lib`, `sdk`, or single letters |
| **`ensureAdapter()`** | Loads the vendor SDK on first call. Module-scoped, shared across instances because the adapter is stateless |
| **`initIfNot()`** | Builds the per-instance resource (pool, client, connection) on first call. Calls `ensureAdapter()` first |
| **Guard with `Lib.Utils.isNullOrUndefined`** | Both lazy-load helpers guard their cache check with this helper - never inline `if (x !== null) return` |
| **Pure config files** | Config files contain only defaults - no `process.env` reads. Environment values are injected by the test loader or project loader |
| **Reserved keywords** | Cloud services may have reserved words in query/expression languages. Always use aliasing (e.g., expression attribute names) to avoid conflicts with common field names like `name`, `status`, `data`, `type` |
| **Batch API limits** | Cloud APIs impose batch size limits. Handle large batches with recursive chunking - split, process sequentially, combine results |
| **Service-specific options** | Configure marshalling, serialization, and retry behavior appropriate to the cloud service (e.g., removing undefined values, retry config) |

Full module structure templates (Pattern 1 Singleton vs Pattern 2 Factory) live in [`module-structure-js.mdx`](module-structure-js.mdx) under "Helper Module Configuration Patterns".
