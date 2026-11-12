---
description: Capture new knowledge into the framework docs - harvest it from the conversation, place each piece in its canonical home, then hand off to /finalize-docs
---

# Learn Workflow

This workflow turns knowledge from a conversation into documentation. The input is an explicit statement (`/learn [the new rule]`) or the conversation itself (`/learn` alone). In the second case, harvest each item from this session that the documentation must hold. The output is edits to canonical `docs/` files only. This workflow does not touch derived artifacts.

Invoke as: `/learn [knowledge]` or `/learn` (harvest mode).

When this workflow is done, run `/finalize-docs` to validate and propagate. This workflow captures. That workflow makes the change official.

## Operating Principle

> **Knowledge lives in exactly one canonical place.** Each captured piece gets one home from the placement table. Each other location that needs it gets a cross-reference, not a copy. If a piece has no clear home, ask the user. Do not guess.

## Execution Contract (binding)

1. **Docs only.** This workflow edits files under `docs/`. It also edits a module's `README.md` and `ROBOTS.md` when the knowledge is about that module. It does not edit `AGENTS.md` or an embedded block of a workflow. Those belong to Phase P of `/finalize-docs`.
2. **Steps run in order:** Harvest, Classify, Shape, Write, Sweep, Hand off.
3. **Each harvested item gets a disposition:** captured, already documented (with a citation), or rejected with a reason. Do not drop an item silently.
4. **If a classification is not clear, stop the run.** Ask one specific question. Do not guess a home.
5. **Manual edits only.** Read the target file in full around the insertion point before you edit it.

## Step 1 - Harvest (hard gate)

Build the candidate list. In harvest mode, read the conversation again and find each item of these kinds:

| Kind | Signal in the conversation |
|---|---|
| New rule or convention | A decision was made ("we do X, not Y"), or the user corrected the agent |
| Gap found | The docs did not answer a question that they should answer |
| Failure mode | A bug, a broken build or a wrong output was diagnosed and fixed |
| Architecture change | A structure, pattern, class or layer changed its meaning |
| New category | A new kind of module, file or process appeared |
| Extension | A documented concept got a new case, option or subtype |

Output the harvest table. It is the evidence for this gate:

```text
Step 1 - Harvest
| # | Item (one line) | Kind | Source in conversation |
|---|---|---|---|
Candidates: N
```

If the invocation gives explicit knowledge, the table has one or more rows from that input. Also scan the conversation for adjacent items that the user implied.

## Step 2 - Classify (per item)

Map each item to one row. The canonical source is `docs/principles/documentation-authoring.md` - Placement.

| Type of knowledge | Destination |
|---|---|
| Universal engineering rule with reasoning | `docs/principles/[topic].md` |
| Language-specific rule, syntax, or skeleton | `docs/languages/[lang]/[topic].md` |
| AI agent config or workflow standard | `docs/ai/[topic].md` |
| Step-by-step task procedure | a workflow file in the relevant repo (flag for the user: procedures are not docs content) |
| Module-specific function/usage | `[module]/README.md` + `[module]/ROBOTS.md` |
| Operational runbook (env-specific) | `ops/[NN-category]/[vendor-service].md` |
| Generic infrastructure guide | `docs/ops/[category]/[vendor-service].md` |
| Failure diagnosed and fixed | the domain's pitfall journal: `docs/dev/pitfalls.md` (terminal, CI, testing) or `docs/languages/js/pitfalls-migration.md` (module migration) |
| Personal AI preference | workspace-root personal meta file (not committed, flag for the user) |

If an item covers more than one category, split it. Put each piece in its canonical home. The other homes get a cross-reference.

Output one line for each item: `#N -> [destination file] ([reason])`, or `#N -> already documented at [file:line]`, or `#N -> rejected ([reason])`.

## Step 3 - Shape the writing

Before you write, examine each item against `docs/principles/documentation-authoring.md`:

- [ ] **Prescriptive:** state what to do. Do not write a list of things to avoid.
- [ ] **Generic:** replace project and module names with placeholders (`[module]`, `[entity]`, `[name]`).
- [ ] **DRY:** search, and make sure that no other file owns this rule. If a file owns it, write a cross-reference.
- [ ] **Compact:** use a table or a bullet where possible. One rule is one line.
- [ ] **No preamble:** do not start with "This section explains" or a similar opening.
- [ ] **Register:** use the human register for `docs/` and the agent register (Simplified Technical English) for agent files (Two Registers).
- [ ] **Pitfall shape:** a journal entry is Symptom, Cause, Lesson or Fix. Append it. Do not rewrite old entries.

## Step 4 - Write

1. Search the destination file for a section about the topic. If a section exists, extend it. If no section exists, add a section with a short noun-phrase heading.
2. Add a code example only if text cannot express the rule. An example uses placeholders, not real module names.
3. Write a new failure mode in the pitfall journal BEFORE a related fix in another file. This is the order of the Golden Rule.

## Step 5 - Sweep (convergence gate)

If you renamed or reworded a term, search for the old term. Fix each hit in the same change:

// turbo
```bash
# Cwd = codebase-superloom
grep -rn "[old-term]" docs/ | tail -20
```

Run the search again after the fixes. Stop only when the search finds nothing, or only historical mentions that you justify one by one.

## Step 6 - Hand off and report

Report the disposition table:

```text
| # | Item | Destination | Change |
|---|---|---|---|
| 1 | [item] | docs/[path].md | Added section [name] |
| 2 | [item] | already documented | docs/[path].md:[line] |
```

Then write: "Docs updated. Run `/finalize-docs` to validate and propagate." Do not run it automatically. The user can capture more items first.

Do not write a prose summary. Do not write validation phrases.

## Loop-backs

- The classification is not clear: ask the user, then continue at Step 2 for that item.
- The sweep finds an old term: fix it, then run Step 5 again.
- An item is a procedure, not knowledge: flag it for the repository that owns the workflow. Do not write it into `docs/`.

## Self-Improvement (every run, last step)

This run can find a kind of knowledge that the Harvest table does not have. It can also find a destination that the placement table does not have. If it does, do these steps. First, add the destination to `docs/principles/documentation-authoring.md` (Placement). Then, in the same session, update the tables in this file (the compile rule). A capture workflow that cannot capture its own gaps fails its purpose.

## Per-run Verification Checklist

- [ ] The harvest table has all candidates and their sources in the conversation
- [ ] Each item has a disposition: captured, already documented (cited), or rejected (with a reason)
- [ ] Each captured item is in its canonical home from the placement table
- [ ] The shaping checklist was applied to each item (prescriptive, generic, DRY, compact, no preamble, register)
- [ ] Each failure mode is in the pitfall journal before the related fixes
- [ ] The old-term sweep is clean
- [ ] The disposition table is reported, and the `/finalize-docs` hand-off is stated

## Invocation Examples

- `/learn helper modules must use import CONFIG from '...' with comment "Base configuration (overridden by loader-injected config)"`
- `/learn never use module-specific examples in framework docs`
- `/learn add new ops category for caching: docs/ops/caching/`
- `/learn` - harvest mode: extract each item from this conversation that the documentation must hold
