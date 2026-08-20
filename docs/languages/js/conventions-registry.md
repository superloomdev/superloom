# Conventions Registry

> **Language:** JavaScript

A lookup table of settled micro-conventions. One row per settled question, with the answer, evidence, and date settled. A module author scans it in under a minute before inventing a new answer to a solved problem.

## Component Tiers

| # | Question | Settled answer | Evidence |
|---|---|---|---|
| 1 | What tiers does the component library use? | Four tiers: `atom/`, `molecule/`, `composite/`, `provider/`. Atoms compose nothing. Molecules compose atoms only. Composites compose atoms, molecules, and other composites. Providers are context-only, render no visual output | `docs/languages/js/client/components.md` - Component Vocabulary |
| 2 | Where do providers register? | `Component.provider.[name]`, matching `Component.variant` and `Component.freeform` namespacing. Providers do not count toward the flat top-level key count | `docs/languages/js/client/components.md` - Provider Set |
| 3 | What is the exception model? | Four buckets: canonical (atom/molecule/composite), provider, structured variant, unstructured freeform | `docs/languages/js/client/components.md` - Four-Bucket Exception Model |

## Accessibility

| # | Question | Settled answer | Evidence |
|---|---|---|---|
| 4 | How are state and value semantics expressed? | Through `aria-*` props, never `accessibilityState` or `accessibilityValue`, which React Native Web does not forward to the DOM. `accessibilityRole` and `accessibilityLabel` remain correct and are used directly | `docs/languages/js/client/components.md` - Accessibility Contract |
| 5 | Where are aria-* props emitted? | Through the `a11y` translator module (`a11y.state()`, `a11y.value()`, `a11y.relation()`, `a11y.position()`). It is the only module in the package allowed to emit accessibility state/value/relation/position props | `component/a11y.js` |
| 6 | What about the deprecated no-op props on web? | `accessibilityHint`, `accessibilityElementsHidden`, `importantForAccessibility`, `accessibilityViewIsModal`, `AccessibilityInfo.announceForAccessibility`, `LayoutAnimation` are all no-ops on web. Use the `aria-*` equivalent instead | `docs/languages/js/client/components.md` - No-op props on web |

## Naming

| # | Question | Settled answer | Evidence |
|---|---|---|---|
| 7 | Carbon `Switch` vs React Native `Switch` | Carbon's becomes `ContentSwitcherItem`. React Native's on/off toggle concept becomes `Toggle` | `docs/languages/js/client/components.md` - Divergences from Carbon |
| 8 | Carbon `ProgressIndicator` vs `ProgressBar` | Carbon's multi-step stepper becomes `ProgressSteps`. The determinate bar becomes `ProgressBar` | `docs/languages/js/client/components.md` - Divergences from Carbon |
| 9 | Build a Superloom-owned composite identifier string, and read it back | `create[Thing]Id` / `parse[Thing]Id`. `parse` returns an **Object**, never a positional array | `auth.createAuthId`/`parseAuthId`, `contact-phone.createPhoneId`/`parsePhoneId` (D3) |
| 10 | Render **one logical value** into a different notation of that same value, and read it back | `format[Standard]` / `parse[Standard]`. **Always returns a String.** The output carries the same information as the input; only the notation changes. If the inputs are several independent facts rather than one value plus render modifiers, this is not `format` - see row 20 | All 4 `format*` functions return String (D8b) |
| 11 | Decompose an external format that has no build direction | `disjoin[Thing]` | `utils.disjoinUrl`, `utils.disjoinPathname` (D3) |
| 12 | Verbs never to use for the above | `construct*`, `deconstruct*` | 1 live violation across 65 modules, and it is private (D2) |
| 20 | Assemble **several independent parts** into a new composite artifact | `build[Artifact]`. Returns whatever shape the artifact is: String for a text artifact (`buildQuery`), Object for a structured one (`buildResponseEnvelope`). Distinguished from row 10 by whether the inputs are one value plus render modifiers (`format`) or several independent facts (`build`) | 8 distinct functions, 26 occurrences (D8b) |
| 21 | Does `is*` return a bare Boolean or an envelope | Bare Boolean, always. Bad input throws `TypeError`; an operation that can fail at runtime is `get`, not `is`. See `function-naming.md` - Return Shape by Verb Class | 15 bare, 8 enveloped (all 8 in the font family, migrated to bare by Plan 0121) |
| 22 | Does `has*` differ from `is*` | `has*` is a pure in-memory existence check returning a bare Boolean, same throw rule as `is*`. An existence check that can fail at runtime is `getRecordExists` with an envelope, not `has*`. See `function-naming.md` - Confusable Pairs | 4 `has*` functions, all touching storage engines, migrated to `getRecordExists*` by Plan 0121 |
| 23 | Does `get*` return a bare value or an envelope | Bare value when the call cannot fail for any reason other than "not found"; envelope when I/O can fail. See `function-naming.md` - Return Shape by Verb Class | 41 enveloped, 7 bare (all 7 pure computation or field reads, already correct) |
| 24 | `create*` versus `generate*` | `create*` produces a resource or durable identity; `generate*` produces a fresh derived value with no persistence; `build*` composes several independent parts. See `function-naming.md` - Confusable Pairs | `createAddress` renamed to `buildAddress` by Plan 0121 (composes fields, no persistence, no identity) |
| 25 | `delete` / `remove` / `clear` / `cleanup` | `delete` removes from a persistent store; `remove` takes an item out of an in-memory collection; `clear` wipes an entire collection; `cleanup` removes expired or stale items. See `function-naming.md` - Confusable Pairs | `dropCollection` renamed to `deleteCollection` by Plan 0121 (same operation as `deleteTable`) |
| 26 | `set` / `update` / `write` | `set` overwrites a slot; `update` mutates part of a record; `write` is the domain-neutral "put a record" verb. Domain-specific verbs that carry a semantic `write` does not are kept. See `function-naming.md` - Confusable Pairs | `addLog` kept (append semantic); split recorded as Exceptions |
| 27 | Config key casing | `SCREAMING_SNAKE_CASE` for all data keys, including nested. `PascalCase` for injected live objects only. See `function-naming.md` - Config Key Casing | 4 patterns unified by Plan 0121: PascalCase (kept for live objects), SCREAMING, lowercase, nested-lowercase |
| 28 | `validateCurrencyCode` return shape | `{ valid, reason }`, matching the adapter validator contract. The prior `false \| Array` shape inverted truthiness against every other validator | `money.validateCurrencyCode` migrated by Plan 0121 |
| 29 | Noun-first function names | Banned. The verb goes first. `commandBuilderForAddRecord` becomes `buildAddRecordCommand`; `commandAddRecord` becomes `runAddRecordCommand`. See `function-naming.md` - Naming Shape Rules | 12 noun-first `command*` names migrated by Plan 0121 |
| 30 | `xToY` conversion names | Banned. The direction determines the verb: `format` for rendering to a notation, `parse` for reading back. See `function-naming.md` - Banned Verbs | `helper-time` `xToY` names migrated by Plan 0121 |
| 31 | Verb-in-the-middle names | Banned. The verb goes first; the object is the parameter. `absenteeKeysCheckObject` becomes `checkAbsenteeKeys`. See `function-naming.md` - Naming Shape Rules | `utils` verb-in-the-middle names migrated by Plan 0121 |
| 32 | Error catalog prefix | Every error type string carries the module prefix. `NOT_IMPLEMENTED` becomes `HTTP_GATEWAY_NOT_IMPLEMENTED` | `http-gateway` migrated by Plan 0121 |
| 33 | `found` versus `exists` in KV envelopes | Unify on `exists`. See `function-naming.md` - Return Shape by Verb Class | `localstorage` and `mmkv` migrated by Plan 0121 |
| 34 | Banned verbs with zero uses | `read`, `ensure`, `transform` are banned from new code. Each has a settled alternative in `function-naming.md` - Banned Verbs | 0 uses across 65 modules at settlement time; ESLint rule added by Plan 0121 |
| 35 | `validate` / `assert` / `check` split | Already consistent. `validate*` = config/contract validation; `assert*` = throws `TypeError` on programmer error; `check*` = domain logic. Documented in `function-naming.md`, not migrated | Verified consistent across all modules |
| 36 | `Sync` suffix, `instance`/`options` params, `_ModuleName` helpers, `async:yes/no` accuracy | Already 100% consistent. `Sync` suffix only when both variants exist; `instance` first for I/O; `options` for function options; `_ModuleName` for private helpers. Documented in `function-naming.md`, not migrated | Verified consistent across all modules |
| 37 | What is the top isolation boundary called? | `tenant_id`, in every module. Never `scope`, never `org_id`, never `workspace_id`. A single-tenant deployment uses the reserved literal `'system'`, never the empty string | `auth` partition key; `logger` leading index column |
| 38 | What does `scope` mean? | An OAuth permission set carried in a token, per RFC 6749. **Reserved.** It is never a tenancy or namespace field | `verify` and `logger` both vacated the word |
| 39 | What is a composite-key segment with no domain meaning called? | `namespace`. Used when a key segment groups records but is not the tenant and the module places no constraint on what it holds | `verify.namespace` |
| 40 | What characters may an identifier that reaches a wire format contain? | Any, when the format is parsed by fixed-width right-anchored segments. A reserved character is justified only when relaxing it would break a correctness property such as prefix-query isolation, never merely to make parsing easier. When a separator is needed for composite internal keys, prefer a non-printable control character (`\u001F`, ASCII Unit Separator) that cannot appear in any human-readable identifier, over a printable character that requires a caller-facing constraint | `auth.parseAuthId` accepts a UUID; composite keys use `\u001F` as separator, following `distinct-queue-store-dynamodb` |
| 41 | What are the two identifier parameters of a cache entry? | `namespace` for the group and `cache_code` for the entry within it. The word `key` is not used, because it already means three different things across backends (a flat string in Valkey, a partition plus sort pair in DynamoDB, `_id` in MongoDB). `namespace` maps to the Valkey key segment, the DynamoDB partition key, and the MongoDB `_id` prefix; `cache_code` maps to the Valkey key suffix, the DynamoDB sort key, and the MongoDB `_id` suffix | `cache` module and its store adapters |

## Config Keys

| # | Question | Settled answer | Evidence |
|---|---|---|---|
| 13 | A duration config key | Always carries a unit suffix, `_MS` or `_SECONDS` | 11 distinct keys with, 4 without (D4) |
| 14 | The local-testing override key for a cloud service | Exactly `ENDPOINT` at the config layer. A prefixed form is an environment variable name, not a config key | 9 occurrences, 0 prefixed (D5) |
| 16 | Inject a driver into a store adapter | `Lib.[Family]` picked from `shared_libs`. Family-generic key when the API is interchangeable (`Lib.SQL`), backend-specific when it is not (`Lib.MongoDB`) | Already doctrine in `module-structure.md`; row exists so the lookup succeeds |
| 17 | Pass a live object through config | Never. A `lib_*` config key is a deprecated shape | Already doctrine in `module-structure.md` |

## Testing

| # | Question | Settled answer | Evidence |
|---|---|---|---|
| 15 | How to test a module that fronts a cloud service | A local equivalent in Docker, never the real service. `pretest` runs `docker compose down -v` first, dummy credentials in the test script, `127.0.0.1:PORT:PORT` binding | 22 compose files, 0 cloud-credentialed suites (D6) |

## Return Shapes

| # | Question | Settled answer | Evidence |
|---|---|---|---|
| 18 | Name the count field an operation returns | The **past participle of that operation's own verb**: `clear` returns `cleared_count`, `remove*` returns `removed_count`, `stopAll` returns `stopped_count`, a delete or cleanup returns `deleted_count` | D8. One outlier recorded in Exceptions |
| 19 | Name a plural payload in an envelope | For the collection it holds: `records`, `keys`, `values`, `results` | D8 |

## Exceptions

An undocumented exception is a defect. Each is named with its disposition.

| Exception | Row | Disposition |
|---|---|---|
| `SERVER_SELECTION_TIMEOUT` | 13 | Drift, unify on next touch of that module. Do not rename in this plan |
| `NETWORK_TIMEOUT` | 13 | Drift, unify on next touch |
| `ADMIN_WAIT_TIMEOUT` | 13 | Drift, unify on next touch |
| `DEFAULT_VISIBILITY_TIMEOUT` | 13 | Drift, unify on next touch |
| `clearIdleHandlers` returns `removed_count` | 18 | Drift, unify on next touch. `cleared_count` is the rule-conformant name |
| `canonicalize` in `contact-email` | 9-12 | Permanent. Established term of art for email normalization; renaming a published public function buys nothing |
| `addLog` versus `writeRecord` / `setSession` | 26 | Permanent. `addLog` carries an append semantic that `writeLog` loses. The "put a record" family is not unified; each domain-specific verb reads correctly in its own domain |
