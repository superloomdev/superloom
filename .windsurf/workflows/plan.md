---
description: Manage long-horizon plans across sessions - known plans, backlog, history
---

# Plan Workflow

**Trigger:** User says `/plan` optionally followed by a verb and arguments.

**Goal:** Maintain a persistent plan record across AI conversations so long-horizon work survives context loss, parallel work streams, and week-long gaps.

**Authority:** This workflow is the operational arm of [`docs/dev/planning.md`](../../docs/dev/planning.md). All file conventions, formats, and rituals are defined there - this workflow is the executor.

**Folder:** All plan artifacts live in `__dev__/plans/` (gitignored personal workspace).

---

## Verb Dispatch

Inspect the user's input after `/plan`:

| User says | Verb | Behavior |
|---|---|---|
| `/plan` (no verb) or `/plan show` | **show** | List all known plans and display the most recently modified one |
| `/plan show <NNNN or slug>` | **show** | Display a specific plan by number or slug fragment |
| `/plan new <title>` | **new** | Start a brand-new plan |
| `/plan step` | **step** | Mark current step done; advance to next (on most recent plan) |
| `/plan step <NNNN> <text>` | **step** | Target a specific plan; update the in-progress step description |
| `/plan done <NNNN or slug>` | **done** | Mark a plan complete and move to `history/` |
| `/plan discard <NNNN or slug>` | **discard** | Mark a plan as abandoned and move to `history/` |
| `/plan backlog` | **backlog show** | Print the current backlog |
| `/plan backlog <text>` | **backlog add** | Append an item to the backlog |
| `/plan next` | **next** | Suggest 1-3 candidates from backlog given recent context |

If the verb is ambiguous → ask the user; never guess.

---

## Bootstrap Check (Run Once Per New Workspace)

Before any verb runs, verify `__dev__/plans/` exists. If not:

```
__dev__/plans/
  backlog.md     (empty header + first divider)
  history/
```

Use `write_to_file` for each - the folder is gitignored, so the user's local workspace must be initialized on first use. If files already exist, do not touch them.

---

## Verb: show

**No argument** (`/plan show` or `/plan`):

1. List all `.md` files in `__dev__/plans/` (not in `history/`), sorted by mtime descending.
2. For each, read the `**Status:**` and first line of `## Goal`.
3. Read the most recently modified file in full.
4. Reply with the list, then display the most recent plan in full.

**With argument** (`/plan show 0003` or `/plan show verify`):

1. Find the matching plan file by number prefix or slug fragment.
2. Read and display the full file.

Reply format - keep it compact:

```
Known plans (most recent first):
- 0002-migrate-verify.md  [active]  Migrate verify module to adapter pattern
- 0001-document-patterns.md  [active]  Document auth-derived architectural patterns

--- Most recent: 0002 ---
<full plan content>
```

---

## Verb: new

1. Confirm scope. If the user provided only a title, ask one targeted question to extract the goal in one sentence.
2. Find the next plan number: list all `.md` files in `__dev__/plans/` and `__dev__/plans/history/`, take the max `NNNN` prefix, add 1. Zero-pad to 4 digits.
3. Generate a slug from the title: lowercase, kebab-case, drop articles.
4. Create `__dev__/plans/NNNN-<slug>.md` using the format in `docs/dev/planning.md` § Plan File Format. Pre-populate:
   - `**Status:** active`
   - Today's date for `Created` and `Last touched`
   - `## Goal` filled with the one-sentence statement
   - `## Out of scope` with `- (none yet - add as you discover)`
   - `## Steps` left empty for now (unless the user already listed them)
5. Reply with the path of the new plan and a prompt to fill in the steps.

Do not check for "an active plan already exists" - multiple active plans are allowed and expected.

---

## Verb: step

**No plan argument** (`/plan step`):

1. Find the most recently modified plan file in `__dev__/plans/` with `**Status:** active`.
2. Find the line marked `(in progress)` or the first unchecked `- [ ]`.
3. Edit that line: change `- [ ]` → `- [x]` and append `(completed YYYY-MM-DD)`.
4. Find the next unchecked `- [ ]` line. Append `(in progress)`.
5. Update `**Last touched:**` to today.

**With plan and description** (`/plan step 0002 updated description`):

1. Find the specified plan file.
2. Replace the in-progress step's description with the new text.
3. Update `**Last touched:**` to today.

If no step is currently in-progress: ask the user to first add steps to the plan.

---

## Verb: done

`/plan done <NNNN or slug>` - mark a plan complete and archive.

1. Find the plan file.
2. Check if all steps are checked. If any are unchecked → ask the user: complete remaining steps now, push them to backlog, or genuinely done anyway? Do not silently mark done with unfinished steps.
3. Edit the file: `**Status:** active` → `**Status:** completed`. Update `**Last touched:**`.
4. **Move** the file to `__dev__/plans/history/` using `run_command mv`.
5. Reply with a confirmation showing the new path.

---

## Verb: discard

`/plan discard <NNNN or slug>` - mark a plan as abandoned and archive.

1. Find the plan file.
2. Ask the user for one sentence on why it is being discarded (optional but encouraged).
3. Edit the file: change `**Status:**` → `**Status:** discarded`. Update `**Last touched:**`. Add a `## Discarded` section with the date and reason.
4. **Move** the file to `__dev__/plans/history/` using `run_command mv`.
5. Reply with a confirmation showing the new path.

---

## Verb: backlog

**Read** (`/plan backlog`):

1. Read `__dev__/plans/backlog.md`.
2. Reply with the full content - or the last 10 items if it is long.

**Add** (`/plan backlog <text>`):

1. Parse the text. Extract tag if provided as a prefix (`mongodb: review indexes`); else infer from recent file activity or ask.
2. Append to `backlog.md` using the format in `docs/dev/planning.md` § Backlog Format:

```markdown
---

**Added:** YYYY-MM-DD  **Tag:** <tag>
<full description - no length limit>

```

3. Reply with the appended item only.

---

## Verb: next

`/plan next` - suggest what to pick up.

1. Read `__dev__/plans/backlog.md`.
2. Scan active plan files for recently completed steps (check `**Last touched:**`).
3. Score backlog items by:
   - **Same tag** as recent plan work (highest signal of context continuity)
   - **Age** (older items first, to prevent staleness)
   - **Tag clusters** (if 3+ items share a tag, that tag is a candidate plan)
4. Reply with up to 3 suggestions. For each, give:
   - The backlog item (verbatim)
   - One sentence on why it scored
   - Whether it should become its own plan or fold into a multi-item plan

Do not auto-create a plan. The user picks; then `/plan new <title>` actually creates it.

---

## Cross-Verb Rules

- **Always update `**Last touched:**`** on the plan file after any edit.
- **Move, don't copy.** When archiving to `history/`, use `run_command mv` - there is exactly one canonical location per plan. Do not duplicate.
- **Never edit `history/` plans.** Once archived, they are history. If a completed plan reopens → run `/plan new` for a follow-up; reference the archived plan in `## Goal`.
- **Never silently overwrite.** Any state transition that risks losing data must ask the user first.

---

## Reply Style

After every verb, give the user one of two compact replies:

**State summary** (after show / new):

```
**Plans:**
- 0002-migrate-verify.md  [active]  Migrate verify module to adapter pattern
- 0001-document-patterns.md  [active]  Document auth-derived patterns
```

**Action summary** (after step / done / discard / backlog add):

```
| File | Change |
|---|---|
| 0002-migrate-verify.md | Step 2 marked done; Step 3 in progress |
```

No prose, no preamble, no validation phrases. Match the project's existing workflow conventions (see `/learn`, `/propagate-changes`).

---

## Invocation Examples

- `/plan` → show all known plans + most recent
- `/plan show 0002` → show plan 0002 in full
- `/plan new migrate verify to adapter pattern` → create plan 0002
- `/plan step` → mark current step done on the most recent active plan
- `/plan step 0002 refine the factory interface` → update in-progress step description
- `/plan done 0001` → archive plan 0001 as completed
- `/plan discard 0003` → archive plan 0003 as abandoned
- `/plan backlog mongodb: review session collection indexes` → append to backlog
- `/plan next` → suggest from backlog
