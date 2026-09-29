---
description: Build one component of the generic RNW component library from its roster row - add (new component) or fix (existing component) - then hand the batch gates to the execution tier
---

# RNW Component Workflow

Builds or repairs exactly ONE component of the generic React Native Web component library per run: reads its roster row, writes or corrects its folder (factory, `api.js`, `spec.js`, `sample.js`, `notes.md`, `reference.js` when the row has a reference) and its tests, and proves it with `npm run check`. The batch gates, the browser tier and publication are the execution tier's work, handed off at the end.

Invoke as: `/rnw-component [verb] [Name]`
Example: `/rnw-component add Button`

| Verb | What it does | Mutates files? |
|---|---|---|
| `add` | Build a `pending` roster row into a component folder, its tests and its fire rows | Yes (this component's folder, its test file, the declared-requirement lists, `all.js`, the fire manifest, the roster row) |
| `fix` | Repair a built component against a defect row, a failed gate or a changed standard | Yes (the same set, this component only) |

Ambiguous verb, missing name, or a name with no roster row: ask, never guess.

`[library-root]` is the component library's repository root (it holds `data/roster.json`, `component/`, `behaviors/`, `docs/authoring.md`). Every command below runs with its working directory set there unless it says `_test`.

## Operating Principle

> **The roster decides; the theme draws; the component only arranges.** A component owns its anatomy and composes behaviors. Every value it draws is a token read through the context, every shape choice an enum token it implements every value of, every glyph an `Icon` with a semantic name. If a value, shape or glyph is not in the theme, the component does not supply one: it queues a contract request and stops at that part.

**Trust files, not memory.** Re-read the briefing pack from disk every run. A rule asserted without a citation (`docs/` path and section, or `[library-root]` `file:line`) does not count.

## Execution Contract (binding, every verb)

1. **One component per run.** Touch only: its folder, `_test/[stem].test.js`, `component/contract.js`, `all.js`, `_test/fixtures/assertion-integrity.json`, its roster row in `data/roster.json`, and the regenerated `docs/components/[Family].md`. Anything else is a STOP.
2. **Phases run in order**, never skipped, merged or reordered.
3. **No vendor names** in anything the package ships (`component/`, `behaviors/`, `components.js`, `all.js`, `README.md`, `ROBOTS.md`) or in `notes.md`. Vendor names belong in `data/`, `scripts/`, `DECISIONS.md` and `_test/` only.
4. **No new behavior, token, enum value or icon name is invented in this run.** A missing behavior, a token the contract lacks, or an icon name absent from `data/icons.json` is a STOP with a written request (Phase B).
5. **Tier.** This workflow is authored work (HIGH). It never runs `npm run batch`, `npm run verify`, the fire runner over the whole manifest, a publish, or a push; those are the Phase F hand-off.
6. **When uncertain, STOP**: report what is seen, ask, wait.

## Command Execution Rules

- The working directory is set through the tool's parameter, never with `cd`.
- One line per command, or one `&&` chain; long output through `| tail -N`.
- `// turbo` marks read-only steps. No mutation step is auto-run.

## The Standard (embedded; sources cited)

> Compiled from `codebase-superloom/docs/languages/js/client/components.md` (Component Folder, The context seam, Theme Token Contract, Platforms, Accessibility Contract, Geometry and Fidelity) and the library's `docs/authoring.md`. When either changes, this block is updated in the same session (`docs/ai/workflow-authoring.md` - Embedded Content and the Compile Rule).

**Folder** (`components.md` - Component Folder): `component/[tier]/[family]/` with `[stem].js` (`[stem]` = kebab-case of the name), `api.js`, `spec.js`, `sample.js`, `notes.md`, `reference.js` when `reference.kind` is not `none`; `[stem].web.js` + `[stem].native.js` only when `platform.support` is `split`. A family folder holding several components names the extra data files `api.[stem].js`, `spec.[stem].js`, `sample.[stem].js`, `reference.[stem].js` and shares `notes.md`. Tests: `_test/[stem].test.js`.

**Factory skeleton** (`components.md` - The context seam):

```js
// Info: [Name] [tier]. [One line: what it arranges, which behaviors it composes.]

import SPEC from './spec.js';


/********************************************************************
[Name] factory.

@param {Object} ctx - Component context

@return {Function} - The [Name] component
*********************************************************************/
export default function [Name] (ctx) {

  const React = ctx.React;
  const Utils = ctx.Utils;
  const { View, Text, Pressable } = ctx.ReactNative;
  const { [behaviorHook] } = ctx.behaviors;


  /********************************************************************
  [Name] component.

  @param {Object} props - See `api.js`

  @return {Object} - React element
  *********************************************************************/
  function [Name]Component (props) {

    // Init the behavior and its state
    const behavior = [behaviorHook](props);

    // Read every drawn value through the context
    const height = ctx.metric('[Name]', 'height');

    // Render the anatomy
    return React.createElement(View, { style: { height: height } });

  }

  [Name]Component.displayName = '[Name]';

  return [Name]Component;

}

[Name].spec = SPEC;
```

- No JSX; `React.createElement` only (the Node gates load source directly).
- No `import` of `react`, `react-native`, `react-native-web` or `react-native-svg`; frameworks come from `ctx`.
- Other components come from `ctx.Registry.[Other]` at render time. An atom composes no library component.
- Platform only through `ctx.platform` (`os`, `isNative`, `split({ web, native })`); `split` rows dispatch in `[stem].js` and render `null` for a missing half.
- `Lib.Utils` primitives for type guards and emptiness (`isString`, `isNumber`, `isNullOrUndefined`, `isEmptyArray`, `isEmptyString`, `inArray`); callbacks are duck-typed.

**Context reads** (`components.md` - The context seam): `ctx.token(name)`, `ctx.color(leaf)`, `ctx.typeStyle(leaf)`, `ctx.metric(Name, metric)`, `ctx.enum(name)`, `ctx.icon(name, size)`, `ctx.focusPresentation(focused)`. Each throws on a token the theme lacks; nothing falls back from one token to another.

**`spec.js`**: `export default Object.freeze({ metric: 'group.token', derived: { tokens: ['a', 'b'], operation: 'sum' | 'subtract' }, decided: { constant: N } })`. A `constant` exists only when the roster row carries `superloom_decision`.

**`api.js`**: `export default Object.freeze({ name, props: { [prop]: { type, required, description } }, kinds: [], variants: [], tokens: [every token read on every render], colors: [every color leaf accepted as a prop value] })`.

**`sample.js`**: `export default Object.freeze([ { label, props } ])` covering default, every enum value that changes the render, disabled, invalid where the component has it, and size extremes. Labels are unique.

**`reference.js`** (rows with a reference): `export default Object.freeze({ kind, mount (React, upstream, props), parts: { root: '[selector]', ... } })`, with `kind` equal to the roster's `reference.kind`.

**`notes.md`**: vendor-free. One `## Decisions` section naming every roster flag the row carries in backticks (`no_reference`, `superloom_decision`, `deferred_gap`, `web_only`, `requires_parent`) with the reason, and one `## Platform` section stating what `platform.support` means for this row.

**Accessibility** (`components.md` - Accessibility Contract): `aria-*` props plus `accessibilityRole` and `accessibilityLabel`; never `accessibilityState`, `accessibilityValue`, `accessibilityHint`, `accessibilityViewIsModal`, `importantForAccessibility`. Semantic state comes from the behavior's prop getters or `ctx.behaviors.getA11yState`; the accessibility tree is identical under every template.

**Declared requirements** (`components.md` - Theme Token Contract): every token in `spec.js` and `api.tokens` joins `REQUIRED_TOKENS` in `component/contract.js`; every `api.colors` leaf joins `SUPPORTED_TOKENS` as `color.[leaf]`; an icon the component draws on its own initiative joins `REQUIRED_ICONS`. The purity test fails when the lists and the folders disagree.

## Phase A - Briefing (read-only, evidence gate)

1. Read in full, from disk: `[library-root]/DECISIONS.md`, `[library-root]/docs/authoring.md`, `[library-root]/behaviors/ROBOTS.md`, the exemplar folder `[library-root]/component/atom/icon/` (every file), and the open rows for `[Name]` in the workspace `__dev__/DEFECTS.md` (if the file exists).
2. Print the roster row:
   // turbo
   ```bash
   node -e "const r=require('./data/roster.json').rows.find(x=>x.name==='[Name]'); console.log(JSON.stringify(r,null,2))"
   ```
3. **Gate - the reply MUST contain** one verbatim quote from each file read in step 1, and a table: `name | tier | family | platform.support | reference.kind | enums | behaviors | parent | flags | status`.

## Phase B - Row checks (read-only, STOP points)

1. `status`: `add` requires `pending`; `fix` requires `built`, `measured` or `frozen`. `not_applicable` is never built. Mismatch: STOP.
2. `parent` (row flag `requires_parent`): the parent must already be built (`status` not `pending`). If not: STOP and name the parent.
3. Behaviors: every name in the row's `behaviors` must map to an existing hook in `behaviors/ROBOTS.md`. A missing one: STOP - a new behavior is its own authored change with its own tests.
4. Enums: every token in the row's `enums` must be a contract enum:
   // turbo
   ```bash
   node -e "import('helper-themer').then(async m=>{const u=(await import('helper-utils')).default({});const T=m.default({Utils:u,Debug:(await import('helper-debug')).default({Utils:u})});const c=T.getContract();for(const t of process.argv.slice(1))console.log(t, JSON.stringify(c.tokens[t]||'MISSING'))})" [enum tokens...]
   ```
   (Cwd = `_test`.) `MISSING` or no `values`: STOP.
5. Tokens and icons: list every token the anatomy needs (heights, paddings, radii, borders, colors, type sets, icon sizes) and every icon name. Check tokens with the command in step 4 and icons against `data/icons.json`. A token the contract lacks: write a row to the workspace `__dev__/CONTRACT-REQUESTS.md` (token, requesting row, reason), draw that part from the nearest existing contract token only if the roster row's `superloom_decision` flag covers it, otherwise STOP. An icon absent from `data/icons.json`: STOP (icons are added with every template's counterpart at once).
6. **Gate - the reply MUST contain** `Row checks: clean` or the STOP with its reason.

## Phase C - Author (add: create; fix: correct)

Files in this order; each written whole, by hand, from the embedded Standard:

1. `spec.js`, then `api.js` - the data first, so the factory reads only what is declared.
2. `[stem].js` (and the split halves if `split`) from the factory skeleton.
3. `sample.js`, then `reference.js` when the row has a reference.
4. `notes.md`.
5. `component/contract.js`: add the component's token list to `REQUIRED_TOKENS` / `SUPPORTED_TOKENS` / `REQUIRED_ICONS` as a named constant (`[NAME]_REQUIRED`, `[NAME]_SUPPORTED`), following the `ICON_*` constants already there.
6. `all.js`: one `export { default as [Name] } from './component/[tier]/[family]/[stem].js';` line in roster build order.
7. `_test/[stem].test.js`: render every `sample.js` state under all three templates; assert exact values read from the built theme (never ranges); assert every behavior-driven state (press, focus, disabled, selection) through the DOM; assert the accessibility answer for each state.
8. `_test/fixtures/assertion-integrity.json`: one row per new assertion family - a literal `find`/`replace` in the component's source that must make one named test fail.
9. `data/roster.json`: this row's `status` -> `built` (add), and replace a placeholder `description` with one sentence that states what the component arranges and explains every flag using the roster checker's phrases.
10. Regenerate the family page:
    ```bash
    node scripts/docs-generate.js
    ```

## Phase D - Check (convergence gate)

1. Run:
   ```bash
   git add -N . && npm run check -- [Name] 2>&1 | tail -40
   ```
2. Fire this component's new rows only, one at a time:
   ```bash
   node fire.js --only [row-id] 2>&1 | tail -5
   ```
   (Cwd = `_test`.) Every row must print `FIRED`. A `NOT FAILED` row means the test asserts nothing: fix the test, not the manifest.
3. Roster and docs:
   // turbo
   ```bash
   node scripts/roster-check.js && git diff --stat -- docs/components
   ```
4. Converge: repeat steps 1-3 until two consecutive runs are clean with no edit in between (cap 5). Any edit resets the count.
5. **Gate - the reply MUST contain** `check: [Name] passed` twice with no edit between, every new fire row `FIRED`, and `OK 415 rows` (or the roster's current count).

## Phase E - Contact-sheet self-review (HIGH)

1. Build the bundle and the contact sheet (one PNG per family, every template stacked):
   ```bash
   npm run bundle --silent && npx playwright test sheet.spec.js 2>&1 | tail -5
   ```
   (Cwd = `_test`.) Open `_test/test-results/sheet/[Family].png`.
2. Walk the layer-4 checklist in `docs/authoring.md` (anatomy, geometry, color, type, states, enums, icons, cross-template, brand layer, vendor leak). Each finding is fixed in Phase C and re-checked in Phase D.
3. **Gate - the reply MUST contain** `Contact sheet: [Family] reviewed, [N] findings -> fixed` with the checklist ticked.

## Phase F - Hand off (STOP)

1. Commit this component only (the tier guard runs in the hook):
   ```bash
   git add -A && git commit -m "feat([family]): [add|fix] [Name]"
   ```
   Only after the user approves the Phase D and E evidence.
2. Hand to the execution tier by name, never by running it here: "`npm run batch` when the batch has 8-12 components; `npm run verify` before any push to `main`."
3. STOP. Never continue to another component in the same run.

## Loop-backs

- A Phase D failure -> Phase C for the failing file, then Phase D from step 1 (the count resets).
- A Phase E finding -> Phase C, Phase D, Phase E.
- A fire row `NOT FAILED` -> strengthen the test in Phase C; the manifest row stays.
- A Phase B STOP -> write the request, report it, end the run; the row stays `pending`.

## Self-Improvement (every run, last step)

If this run exposed a failure mode the gates did not catch: journal it in `codebase-superloom/docs/dev/pitfalls.md` (Symptom, Cause, Lesson) BEFORE moving on; where a machine check could have caught it, add the check to the library's `_test/` with a fire row; where the gap was in this workflow or `docs/authoring.md`, amend both and run `/finalize-docs`.

## Per-run Verification Checklist

- [ ] Verb and `[Name]` declared; roster row printed; briefing pack read with verbatim quotes
- [ ] Row checks clean (status, parent, behaviors, enums, tokens, icons) or STOP recorded with its request
- [ ] Files authored in order: spec, api, factory, sample, reference (if any), notes, contract lists, `all.js`, test, fire rows, roster row, docs page
- [ ] No vendor name in shipped files or `notes.md`; no framework import; no platform read outside `ctx.platform`; no banned accessibility prop; no literal where a token exists
- [ ] `check: [Name] passed` twice with no edit between
- [ ] Every new fire row `FIRED`
- [ ] Roster check OK; family docs page regenerated
- [ ] Contact sheet reviewed against the layer-4 checklist; findings fixed
- [ ] Commit approved and made for this component only; batch/verify handed to the execution tier; STOPPED
- [ ] New failure modes journaled; workflow and authoring guide amended if needed
