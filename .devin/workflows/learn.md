---
description: Capture new knowledge into the framework docs - harvest it from the conversation, place each piece in its canonical home, then hand off to /finalize-docs
---

# Learn Workflow

Turns knowledge that surfaced in a conversation into documentation. The input is either an explicit statement (`/learn [the new rule]`) or the conversation itself (`/learn` alone: harvest everything documentation-worthy from this session). The output is edits to canonical `docs/` files only - this workflow never touches derived artifacts.

Invoke as: `/learn [knowledge]` or `/learn` (harvest mode).

When done, run `/finalize-docs` to validate and propagate. This workflow captures; that workflow makes it official.

## Operating Principle

> **Knowledge lives in exactly one canonical place.** Every piece captured here gets one home per the placement table, and every other location that needs it gets a cross-reference, never a copy. If a piece has no clear home, that is a question for the user, not a guess.

## Execution Contract (binding)

1. **Docs only.** This workflow edits files under `docs/` (and module `README.md`/`ROBOTS.md` when the knowledge is module-specific). It never edits `AGENTS.md` or a workflow's embedded block - those are `/finalize-docs` Phase P territory.
2. **Steps run in order.** Harvest -> Classify -> Shape -> Write -> Sweep -> Hand off.
3. **Every harvested item is dispositioned.** Captured, already-documented (with citation), or explicitly rejected with a reason. No silent drops.
4. **Unclear classification stops the run.** Ask one targeted question; never guess a home.
5. **Manual edits only**, after reading the target file in full around the insertion point.

## Step 1 - Harvest (hard gate)

Build the candidate list. In harvest mode, re-read the conversation for every item of these kinds:

| Kind | Signal in the conversation |
|---|---|
| New rule or convention | A decision was made ("we do X, not Y"), or the user corrected the agent |
| Gap found | Something the docs should have answered but did not |
| Failure mode | A bug, broken build, or wrong output was diagnosed and fixed |
| Architecture change | A structure, pattern, class, or layer changed meaning |
| New category | A new kind of module, file, or process appeared |
| Extension | An existing documented concept gained a case, option, or subtype |

Output the harvest table - this is the gate's evidence:

```text
Step 1 - Harvest
| # | Item (one line) | Kind | Source in conversation |
|---|---|---|---|
Candidates: N
```

If invoked with explicit knowledge, the table has one or more rows from that input; still scan the conversation for adjacent items the user may have implied.

## Step 2 - Classify (per item)

Map each item to one row (canonical source: `docs/principles/documentation-authoring.md` - Placement):

| Type of knowledge | Destination |
|---|---|
| Universal engineering rule with reasoning | `docs/principles/[topic].md` |
| Language-specific rule, syntax, or skeleton | `docs/languages/[lang]/[topic].md` |
| AI agent config or workflow standard | `docs/ai/[topic].md` |
| Step-by-step task procedure | a workflow file in the relevant repo (flag for the user; procedures are not docs content) |
| Module-specific function/usage | `[module]/README.md` + `[module]/ROBOTS.md` |
| Operational runbook (env-specific) | `ops/[NN-category]/[vendor-service].md` |
| Generic infrastructure guide | `docs/ops/[category]/[vendor-service].md` |
| Failure diagnosed and fixed | the domain's pitfall journal: `docs/dev/pitfalls.md` (terminal, CI, testing) or `docs/languages/js/pitfalls-migration.md` (module migration) |
| Personal AI preference | workspace-root personal meta file (not committed; flag for the user) |

If an item spans categories, split it: each piece goes to its canonical home; the others cross-reference.

Output per item: `#N -> [destination file] ([reason])` or `#N -> already documented at [file:line]` or `#N -> rejected ([reason])`.

## Step 3 - Shape the writing

Before writing a single character, per item (source: `docs/principles/documentation-authoring.md`):

- [ ] **Prescriptive:** state what to do, not a list of what to avoid
- [ ] **Generic:** project/module names replaced with placeholders (`[module]`, `[entity]`, `[name]`)
- [ ] **DRY:** confirmed no other file owns this rule (searched); if one does, cross-reference instead
- [ ] **Compact:** table or bullet where possible; one rule = one line
- [ ] **No preamble:** no "This section explains...", no filler openings
- [ ] **Pitfall shape:** journal entries are Symptom -> Cause -> Lesson/Fix, appended, never rewriting old entries

## Step 4 - Write

1. Search the destination file for an existing section covering the topic. Extend it if found; otherwise add a new section with a short noun-phrase heading, updating the file's `On This Page` list.
2. A code example only if the rule cannot be expressed in text; examples use placeholders, never real module names.
3. New failure modes go to the pitfall journal BEFORE any related fix elsewhere (the Golden Rule ordering).

## Step 5 - Sweep (convergence gate)

If anything was renamed or re-worded, grep for the old terminology and fix every hit in the same change:

// turbo
```bash
# Cwd = codebase-superloom
grep -rn "[old-term]" docs/ | tail -20
```

Re-run after fixing. Exit only when the sweep returns nothing (or only intentional historical mentions, each justified).

## Step 6 - Hand off and report

Report the disposition table:

```text
| # | Item | Destination | Change |
|---|---|---|---|
| 1 | [item] | docs/[path].md | Added section [name] |
| 2 | [item] | already documented | docs/[path].md:[line] |
```

Then state: "Docs updated. Run `/finalize-docs` to validate and propagate." Do not run it automatically; the user may want to batch more captures first.

No prose summary. No validation phrases.

## Loop-backs

- Classification unclear -> ask the user -> resume at Step 2 for that item.
- Sweep finds stale terms -> fix -> re-run Step 5.
- An item turns out to be a procedure, not knowledge -> flag it for the owning workflow's repo; do not write it into `docs/`.

## Self-Improvement (every run, last step)

If this run exposed a knowledge kind the Harvest table misses, or a destination the placement table lacks: the placement gap goes to `docs/principles/documentation-authoring.md` (Placement) first, then this file's embedded tables are updated in the same session (the compile rule). A capture workflow that cannot capture its own gaps defeats its purpose.

## Per-run Verification Checklist

- [ ] Harvest table output with all candidates and conversation sources
- [ ] Every item dispositioned: captured, already-documented (cited), or rejected (reasoned)
- [ ] Each captured item in its canonical home per the placement table
- [ ] Shaping checklist applied per item (prescriptive, generic, DRY, compact, no preamble)
- [ ] Failure modes journaled in pitfall shape before related fixes
- [ ] Old-term sweep clean
- [ ] Disposition table reported; `/finalize-docs` hand-off stated

## Invocation Examples

- `/learn helper modules must use const CONFIG = require(...) with comment "Base configuration (overridden by loader-injected config)"`
- `/learn never use module-specific examples in framework docs`
- `/learn add new ops category for caching: docs/ops/caching/`
- `/learn` - harvest mode: extract everything documentation-worthy from this conversation
