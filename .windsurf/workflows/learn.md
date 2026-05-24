---
description: Capture new knowledge into the framework - applies documentation-authoring.md principles
---

# Knowledge Capture Workflow

**Trigger:** User says `/learn` followed by the new knowledge (a rule, pattern, decision, or correction).

**Goal:** Place the knowledge in exactly the right location(s), in the right shape, with cross-references kept consistent - so the user never has to re-explain authoring rules.

**Authority:** This workflow is the operational arm of [`docs/dev/documentation-authoring.md`](../../docs/dev/documentation-authoring.md). All steps below enforce those principles automatically.

---

## Step 1 - Classify the knowledge

Map the user's input to one row in this table (canonical source: `docs/dev/documentation-authoring.md` → Decision Tree):

| Type of knowledge | Destination |
|---|---|
| Universal AI behavior rule | personal `.windsurf/GOD.md` (workspace-root, not committed) |
| Project-wide AI rule (compressed) | `AGENTS.md` |
| Architectural rule, full detail | `docs/[bucket]/[topic].md` (foundations/modules/server/testing) |
| Step-by-step task procedure | `.windsurf/workflows/[name].md` (relevant repo) |
| Module-specific function/usage | `[module]/README.md` + `[module]/ROBOTS.md` |
| Operational runbook (env-specific) | `ops/[NN-category]/[vendor-service].md` |
| Generic infrastructure guide | `docs/ops/[category]/[vendor-service].md` |
| Migration history (gitignored) | `__dev__/migration-changelog.md` |

If the knowledge spans multiple categories, split it: each piece goes to its canonical home, and the others cross-reference.

If unclear which category applies -> **STOP and ask user**. Do not guess.

## Step 2 - Apply authoring principles

Before writing a single character:

- [ ] **Prescriptive:** Rewrite as "use X" instead of "don't use Y, Z, ..."
- [ ] **Generic:** Replace any project/module names with placeholders (`[module]`, `[entity]`, `[name]`)
- [ ] **DRY:** Confirm no other file already owns this rule. If yes → cross-reference, do not duplicate
- [ ] **Compact:** Convert prose to table or bullet list. One rule = one line where possible
- [ ] **No preamble:** Strip "This section explains...", "It is important to note...", etc.

## Step 3 - Locate the canonical file

- Search the destination directory for an existing section that covers a related topic
- If found → extend that section (preserve heading hierarchy)
- If not found → add a new section with a short noun-phrase heading

## Step 4 - Write the change

Apply the edit using `edit` or `multi_edit`. Include:

1. The new rule (compact, prescriptive, generic)
2. A code example **only** if the rule cannot be expressed in text
3. Code examples must use placeholders, never real module names

## Step 5 - Propagate to mirror locations

Run the **decision sub-tree** for cross-file impact:

- Edited a file in `docs/foundations/`, `docs/modules/`, `docs/server/`, or `docs/testing/`? → Update the matching compressed section in `AGENTS.md` (run `/compile-agents-md` if multiple sections affected)
- Edited a rule that appears in code comments anywhere? → Search the codebase and align all comments to match the new wording verbatim
- Edited a workflow? → Update the workflow inventory in the personal `.windsurf/GOD.md` "Current Status" if a workflow was added/removed
- Added a new authoring principle? → It belongs in `docs/dev/documentation-authoring.md`, not in workflows

## Step 6 - Verify cross-reference integrity

// turbo
Run a grep for the old terminology (if renaming) to confirm no stale text remains:

```bash
grep -rn "[old-term]" /Users/sj/Projects/project-superloom/codebase-superloom/docs /Users/sj/Projects/project-superloom/codebase-superloom/AGENTS.md /Users/sj/Projects/project-superloom/codebase-superloom/.windsurf
```

If matches found → fix them in the same change (atomic update).

## Step 7 - Report to user

Reply with a compact table:

| File | Change |
|---|---|
| `path/to/file.md` | Added section [name] |
| `AGENTS.md` | Synced compressed mirror |
| ... | ... |

No prose summary. No validation phrases. Just the table.

---

## Invocation Examples

The user invokes this workflow with minimal input. Examples of valid triggers:

- `/learn helper modules must use const CONFIG = require(...) with comment "Base configuration (overridden by loader-injected config)"`
- `/learn never use module-specific examples in framework docs`
- `/learn add new ops category for caching: docs/ops/caching/`
- `/learn` (then user pastes a longer block of knowledge)

When the trigger is short, you infer scope from existing context (recent edits, open files, related discussion). When ambiguous → ask one targeted question, do not guess.
