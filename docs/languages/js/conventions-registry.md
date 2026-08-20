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

## Deferred Questions

Open questions with real drift and no settled answer. Recording an invented answer would be the precise failure this registry exists to prevent. Each is owned by Plan 0121.

| Open question | Drift observed | Owner |
|---|---|---|
| Config key casing | Four patterns: PascalCase (`Store`), SCREAMING (`ACTOR_TYPE`), lowercase (`table_name`), and lowercase nested inside a SCREAMING key (`LIMITS: { total_max }`) | Plan 0121 |
| Does `is*` return a bare Boolean or an envelope | Split. `isKnownCountry`, `isCurrencyCode`, `isPreflightRequest` return Boolean; `isReady`, `isFamilyLoaded`, `isRegistered` return envelopes | Plan 0121 |
| Does `has*` differ from `is*` | All four `has*` return envelopes while most `is*` return Boolean, and no rule states why | Plan 0121 |
| Does `get*` return a bare value or an envelope | Split, with no stated rule. `getAge` returns a bare Number and `getElapsed` returns an envelope, though both read in-memory state | Plan 0121 |
| `create*` versus `generate*` | Plausible rule (resource or identity versus fresh derived value) but `createAddress` returns a plain object with no persistence and no identity | Plan 0121 |
| `delete` / `remove` / `clear` / `cleanup`, and `set` / `update` / `write` | Each cluster has a plausible split, and each has at least one counterexample | Plan 0121 |
