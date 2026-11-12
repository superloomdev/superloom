---
description: Build one component of the generic RNW component library from its roster row - add (new component) or fix (existing component) - then hand the batch gates to the execution tier
---

# RNW Component Workflow

This workflow builds or repairs ONE component of the generic React Native Web component library in each run. It reads the roster row of the component. It writes or corrects the component folder and its tests. The folder holds the factory, `api.js`, `spec.js`, `sample.js`, `notes.md`, and `reference.js` when the row has a reference. The run proves the component with `npm run check`. The batch gates, the browser tier and the publication are work of the execution tier, which gets them at the end.

Invoke as: `/rnw-component [verb] [Name]`
Example: `/rnw-component add Button`

| Verb | What it does | Mutates files? |
|---|---|---|
| `add` | Build a `pending` roster row into a component folder, its tests and its fire rows | Yes (this component's folder, its test file, the declared-requirement lists, `all.js`, the fire manifest, the roster row) |
| `fix` | Repair a built component against a defect row, a failed gate or a changed standard | Yes (the same set, this component only) |

If the verb is not clear, the name is missing, or the name has no roster row, ask. Do not guess.

`[library-root]` is the root of the component library repository. It holds `data/roster.json`, `component/`, `behaviors/` and `docs/authoring.md`. Each command below runs in that directory, unless the command says `_test`.

## Operating Principle

> **The roster decides. The theme draws. The component only arranges.** A component owns its anatomy and composes behaviors. Each value that it draws is a token, read through the context. Each shape choice is an enum token, and the component implements each value of that enum. Each glyph is an `Icon` with a semantic name. If the theme does not have a value, shape or glyph, the component does not supply one. It queues a contract request and stops at that part.

**Trust files, not memory.** Read the briefing pack from disk again in each run. A rule without a citation (a `docs/` path and section, or a `[library-root]` `file:line`) does not count.

## Execution Contract (binding, every verb)

1. **One component per run.** Touch only these files: its folder, `_test/[stem].test.js`, `component/contract.js`, `all.js`, `_test/fixtures/assertion-integrity.json`, its roster row in `data/roster.json`, the regenerated `docs/components/[Family].md` and the regenerated `catalog.js`. A change to a different file is a STOP.
2. **Phases run in order.** Do not skip, merge or reorder them.
3. **No vendor names** in the files that the package ships (`component/`, `behaviors/`, `components.js`, `all.js`, `README.md`, `ROBOTS.md`) or in `notes.md`. Vendor names are permitted only in `data/`, `scripts/`, `DECISIONS.md` and `_test/`.
4. **Do not invent a behavior, token, enum value or icon name in this run.** A missing behavior is a STOP with a written request (Phase B). So is a token that the contract does not have, or an icon name that is not in `data/icons.json`.
5. **Tier.** This workflow is authored work (HIGH). It does not run `npm run batch`, `npm run verify`, the fire runner over the whole manifest, a publish or a push. Those belong to the Phase F hand-off. In a Fusion session, the lead reads the briefing pack and writes each file (Phases A to C and the Phase E review). The sidekick runs the commands of Phases B, C step 10, D and E, reports their output, and edits nothing (`docs/ai/model-tiering.md` - Owner Vocabulary).
6. **When you are not sure, STOP.** Report what you see, ask, and wait.

## Command Execution Rules

- Set the working directory through the tool's parameter. Do not use `cd`.
- Write one line for each command, or one `&&` chain. Send long output through `| tail -N`.
- `// turbo` marks read-only steps. A mutation step does not run automatically.

## The Standard (embedded; sources cited)

> Compiled from `codebase-superloom/docs/languages/js/client/components.md` (Component Folder, The context seam, Theme Token Contract, Platforms, Accessibility Contract, Geometry and Fidelity) and the library's `docs/authoring.md`. When one of them changes, update this block in the same session (`docs/ai/workflow-authoring.md` - Embedded Content and the Compile Rule).

**Folder** (`components.md` - Component Folder):

- The folder is `component/[tier]/[family]/`. `[stem]` is the kebab-case form of the name.
- It holds `[stem].js`, `api.js`, `spec.js`, `sample.js` and `notes.md`. It holds `reference.js` when `reference.kind` is not `none`.
- It holds `[stem].web.js` and `[stem].native.js` only when `platform.support` is `split`.
- A family folder can hold several components. The extra data files are then `api.[stem].js`, `spec.[stem].js`, `sample.[stem].js` and `reference.[stem].js`, and the components share `notes.md`.
- Tests: `_test/[stem].test.js`.

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

- Do not use JSX. Use `React.createElement` only, because the Node gates load the source directly.
- Do not `import` `react`, `react-native`, `react-native-web` or `react-native-svg`. The frameworks come from `ctx`.
- Other components come from `ctx.Registry.[Other]` at render time. An atom composes no library component.
- Read the platform only through `ctx.platform` (`os`, `isNative`, `split({ web, native })`). A `split` row dispatches in `[stem].js` and renders `null` for a missing half.
- Use the `Lib.Utils` primitives for type guards and emptiness (`isString`, `isNumber`, `isNullOrUndefined`, `isEmptyArray`, `isEmptyString`, `inArray`). Callbacks are duck-typed.

**Context reads** (`components.md` - The context seam):

- `ctx.token(name)`, `ctx.color(leaf)`, `ctx.typeStyle(leaf)`, `ctx.metric(Name, metric)`, `ctx.enum(name)`, `ctx.icon(name, size)`.
- `ctx.focusRing(family, { focused, focusVisible }, border)`.
- `ctx.pressPresentation(state, prefix)` returns `{ container, layer, phase, ... }`.
- `ctx.fieldPresentation(state, { member, height, radius, surface, trailing })` returns `{ root, frame, label, message, raised, placeholder, ... }`.
- Each read throws on a token that the theme does not have. No token falls back to another token.
- A component that shows press or a field frame uses the presentation. It always mounts the parts that it can hide.

**`spec.js`**: `export default Object.freeze({ metric: 'group.token', derived: { tokens: ['a', 'b'], operation: 'sum' | 'subtract' }, decided: { constant: N } })`. A `constant` exists only when the roster row carries `superloom_decision`.

**`api.js`**: `export default Object.freeze({ name, props: { [prop]: { type, required, description } }, kinds: [], variants: [], tokens: [every token read on every render], colors: [every color leaf accepted as a prop value] })`.

**`sample.js`**: `export default Object.freeze([ { label, props } ])`.

- The samples cover the default, each enum value that changes the render, disabled, invalid where the component has it, and the size extremes. Each label is unique.
- A component that fills its container also exports `FRAME = Object.freeze({ width })`. This is the catalog's `frame`. Each showcase and walker lays the component out at that width.
- A part that grows from its content uses `flexGrow: 1, flexShrink: 1, flexBasis: 'auto'`. Do not use `flex: 1`, because its basis is zero on native.
- A truncating sample sets `width`, not `maxWidth`.

**`reference.js`** (rows with a reference): `export default Object.freeze({ kind, mount (React, upstream, props), body?, parts: { [part]: { upstream: '[selector]', ours: '[selector]', measure: 'box' | 'text' | 'type', pseudo? } } })`.

- `kind` is equal to the roster's `reference.kind`.
- `mount` returns null for a state that has no upstream counterpart.
- `body: { width }` is for a component that fills its container.
- Select what is painted (the `path` of an icon), not the mechanism.
- A reference is single. Do not measure a second, independent reference.

**`notes.md`**: it contains no vendor names. It has one `## Decisions` section and one `## Platform` section. The Decisions section names each roster flag of the row in backticks (`no_reference`, `superloom_decision`, `deferred_gap`, `web_only`, `requires_parent`), with the reason. The Platform section states what `platform.support` means for this row.

**Accessibility** (`components.md` - Accessibility Contract):

- Use `aria-*` props, `accessibilityRole` and `accessibilityLabel`.
- Do not use `accessibilityState`, `accessibilityValue`, `accessibilityHint`, `accessibilityViewIsModal` or `importantForAccessibility`.
- The semantic state comes from the prop getters of the behavior, or from `ctx.behaviors.getA11yState`.
- The accessibility tree is the same under each template.

**Declared requirements** (`components.md` - Theme Token Contract):

- Each token in `spec.js` and in `api.tokens` goes into `REQUIRED_TOKENS` in `component/contract.js`.
- Each `api.colors` leaf goes into `SUPPORTED_TOKENS` as `color.[leaf]`.
- An icon that the component draws on its own initiative goes into `REQUIRED_ICONS`.
- The purity test fails when the lists and the folders disagree.

## Phase A - Briefing (read-only, evidence gate)

1. Read these files in full, from disk:
   - `[library-root]/DECISIONS.md`, `[library-root]/docs/authoring.md`, `[library-root]/behaviors/ROBOTS.md`
   - each file of the exemplar folder `[library-root]/component/atom/icon/`
   - the open rows for `[Name]` in the workspace `__dev__/DEFECTS.md`, if the file exists
2. Print the roster row:
   // turbo
   ```bash
   node -e "const r=require('./data/roster.json').rows.find(x=>x.name==='[Name]'); console.log(JSON.stringify(r,null,2))"
   ```
3. **Gate - the reply MUST contain** one verbatim quote from each file of step 1, and a table: `name | tier | family | platform.support | reference.kind | enums | behaviors | parent | flags | status`.

## Phase B - Row checks (read-only, STOP points)

1. `status`: `add` needs `pending`. `fix` needs `built`, `measured` or `frozen`. An upstream export that the library does not build is an `excluded` entry, not a row, and is never built. If the status does not match: STOP.
2. `parent` (row flag `requires_parent`): the parent must be built (`status` is not `pending`). If it is not built: STOP and name the parent.
3. Behaviors: each name in the row's `behaviors` must map to a hook in `behaviors/ROBOTS.md`. If one is missing: STOP. A new behavior is a separate authored change with its own tests.
4. Enums: each token in the row's `enums` must be a contract enum:
   // turbo
   ```bash
   node -e "import('helper-themer').then(async m=>{const u=(await import('helper-utils')).default({});const T=m.default({Utils:u,Debug:(await import('helper-debug')).default({Utils:u})});const c=T.getContract();for(const t of process.argv.slice(1))console.log(t, JSON.stringify(c.tokens[t]||'MISSING'))})" [enum tokens...]
   ```
   (Cwd = `_test`.) If a token prints `MISSING` or has no `values`: STOP.
5. Tokens and icons: list each token that the anatomy needs (heights, paddings, radii, borders, colors, type sets, icon sizes) and each icon name. Check the tokens with the command of step 4. Check the icons against `data/icons.json`.
   - A token that the contract does not have: write a row to the workspace `__dev__/CONTRACT-REQUESTS.md` (token, requesting row, reason). If the `superloom_decision` flag of the roster row covers that part, draw it from the nearest contract token. If not: STOP.
   - An icon that is not in `data/icons.json`: STOP. An icon is added together with its counterpart in each template.
6. **Gate - the reply MUST contain** `Row checks: clean` or the STOP with its reason.

## Phase C - Author (add: create; fix: correct)

Write the files in this order. Write each file whole, by hand, from the embedded Standard:

1. `spec.js`, then `api.js`. The data comes first, so the factory reads only what is declared.
2. `[stem].js` from the factory skeleton, and the split halves if the row is `split`.
3. `sample.js`, then `reference.js` when the row has a reference.
4. `notes.md`.
5. `component/contract.js`: add the token list of the component to `REQUIRED_TOKENS`, `SUPPORTED_TOKENS` or `REQUIRED_ICONS` as a named constant (`[NAME]_REQUIRED`, `[NAME]_SUPPORTED`). Follow the `ICON_*` constants that are already there.
6. `all.js`: add one `export { default as [Name] } from './component/[tier]/[family]/[stem].js';` line, in roster build order.
7. `_test/[stem].test.js`:
   - Render each `sample.js` state under the two shipped templates.
   - Assert exact values that you read from the built theme. Do not assert ranges.
   - Assert each state that a behavior drives (press, focus, disabled, selection) through the DOM.
   - Assert the accessibility answer for each state.
8. `_test/fixtures/assertion-integrity.json`: write one row for each new assertion family. A row is a literal `find`/`replace` in the source of the component that must make one named test fail.
9. `data/roster.json`: set the `status` of this row to `built` (add). Replace a placeholder `description` with one sentence. The sentence states what the component arranges and explains each flag with the phrases of the roster checker.
10. Regenerate the family page and the host catalog:
    ```bash
    node scripts/docs-generate.js && node scripts/catalog-generate.js
    ```

## Phase D - Check (convergence gate)

1. Run:
   ```bash
   git add -N . && npm run check -- [Name] 2>&1 | tail -40
   ```
2. Fire only the new rows of this component, one at a time:
   ```bash
   node fire.js --only [row-id] 2>&1 | tail -5
   ```
   (Cwd = `_test`.) Each row must print `FIRED`. A `NOT FAILED` row means that the test asserts nothing. Fix the test, not the manifest.
3. Roster and docs:
   // turbo
   ```bash
   node scripts/roster-check.js && git diff --stat -- docs/components
   ```
4. Converge: repeat steps 1 to 3 until two runs in a row are clean with no edit between them (cap 5). An edit resets the count.
5. **Gate - the reply MUST contain** these items:
   - `check: [Name] passed` two times, with no edit between them
   - `FIRED` for each new fire row
   - `OK 415 rows`, or the current count of the roster

## Phase E - Contact-sheet self-review (HIGH)

1. Build the bundle and the contact sheet (one PNG for each family, with each template stacked):
   ```bash
   npm run bundle --silent && npx playwright test sheet.spec.js 2>&1 | tail -5
   ```
   (Cwd = `_test`.) Open `_test/test-results/sheet/[Family].png`.
2. Walk the layer-4 checklist in `docs/authoring.md`: anatomy, geometry, color, type, states, enums, icons, cross-template, brand layer, vendor leak. Fix each finding in Phase C and check it again in Phase D.
3. **Gate - the reply MUST contain** `Contact sheet: [Family] reviewed, [N] findings -> fixed` with the checklist ticked.

## Phase F - Hand off (STOP)

1. Commit only this component, after the user approves the evidence of Phases D and E:
   ```bash
   git add -A && git commit -m "feat([family]): [add|fix] [Name]"
   ```
2. Give the next steps to the execution tier by name. Do not run them here: "`npm run batch` when the batch has 8-12 components." "`npm run verify` before any push to `main`."
3. STOP. Do not continue to another component in the same run.

## Loop-backs

- A Phase D failure: go to Phase C for the failing file, then to Phase D step 1. The count resets.
- A Phase E finding: go to Phase C, then Phase D, then Phase E.
- A fire row prints `NOT FAILED`: make the test stronger in Phase C. The manifest row stays.
- A Phase B STOP: write the request, report it and end the run. The row stays `pending`.

## Self-Improvement (every run, last step)

This run can show a failure mode that the gates did not catch. If it does, do these steps:

1. Journal it in `codebase-superloom/docs/dev/pitfalls.md` (Symptom, Cause, Lesson) BEFORE you continue.
2. If a machine check could catch it, add the check to the `_test/` of the library with a fire row.
3. If the gap was in this workflow or in `docs/authoring.md`, change both and run `/finalize-docs`.

## Per-run Verification Checklist

- [ ] Verb and `[Name]` declared, roster row printed, briefing pack read with verbatim quotes
- [ ] Row checks clean (status, parent, behaviors, enums, tokens, icons), or STOP recorded with its request
- [ ] Files written in order: spec, api, factory, sample, reference (if any), notes, contract lists, `all.js`, test, fire rows, roster row, docs page
- [ ] No vendor name in shipped files or `notes.md`, and no framework import
- [ ] No platform read outside `ctx.platform`, no banned accessibility prop, no literal where a token exists
- [ ] `check: [Name] passed` two times with no edit between
- [ ] Each new fire row `FIRED`
- [ ] Roster check OK, family docs page and `catalog.js` regenerated
- [ ] Contact sheet reviewed against the layer-4 checklist, findings fixed
- [ ] Commit approved and made for this component only, batch and verify given to the execution tier, STOPPED
- [ ] New failure modes journaled, workflow and authoring guide changed if needed
