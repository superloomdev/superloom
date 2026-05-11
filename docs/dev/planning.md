# Planning System

How a developer (and the AI assistant) keeps track of what is being worked on and what was discovered along the way - across sessions that may be days or weeks apart. The format is deliberately small: a folder of markdown files, no tooling, no database. The discipline is the system.

## On This Page

- [Why This Exists](#why-this-exists)
- [Two Layers: Ephemeral and Persistent](#two-layers-ephemeral-and-persistent)
- [Folder Structure](#folder-structure)
- [Plan File Format](#plan-file-format)
- [Backlog Format](#backlog-format)
- [How to Plan](#how-to-plan)
- [Workflow Verbs](#workflow-verbs)
- [Session Rituals](#session-rituals)
- [Common Pitfalls and Fixes](#common-pitfalls-and-fixes)
- [Slash Command](#slash-command)

---

## Why This Exists

Long-horizon work in this repository routinely spans many AI conversations. Each conversation has finite context. Without a persistent record:

- The original goal drifts as side-tasks accumulate
- Discoveries get lost between sessions
- "What were we doing?" becomes the first question of every conversation
- Pending work that was acknowledged but deferred quietly disappears

This planning system is the cure. It is the **persistent memory layer** that complements an AI's per-session working memory.

---

## Two Layers: Ephemeral and Persistent

| Layer | Lifetime | Granularity | Where | Tool |
|---|---|---|---|---|
| **Ephemeral working memory** | One conversation | Fine - individual tool calls, tactical steps | In-memory | The AI's `todo_list` |
| **Persistent plan memory** | Across conversations | Coarse - goal + numbered steps | `__dev__/plans/` | This system |

The two complement each other. The AI's per-session todo list tracks what it is doing **right now**; the plan files track what the developer is doing **this week**. The persistent file is updated at the end of each significant step or at the end of a session.

---

## Folder Structure

```
__dev__/plans/
  backlog.md           Quick-capture list of discovered tasks not yet attached to a plan
  NNNN-<slug>.md       Known plans - any number, any status; all live side by side
  history/
    NNNN-<slug>.md     Completed or discarded plans, kept for reference
```

The folder lives at `__dev__/plans/` because it is **personal**: each developer has their own plans, and PR diffs should not be polluted with plan churn. The folder template described here is what the developer sets up locally; the **rules** (this file) and the **slash command** (`.windsurf/workflows/plan.md`) are tracked.

**There is no index file.** Any number of plans can coexist in `plans/` - this explicitly supports multiple agents or work streams running in parallel. The plan file's own `**Status:**` field is the source of truth. At session start, the AI picks up the most recently modified plan file (by mtime) and confirms it with the user before proceeding.

Plan numbers are zero-padded and **monotonic**: once `0023` exists, the next plan is `0024`, even if `0023` is later deleted. Numbers are never reused. The slug is a short kebab-case description.

Examples:
- `0001-document-auth-derived-patterns.md`
- `0002-migrate-verify-to-adapter-pattern.md`
- `0003-implement-mongodb-create-schema.md`

---

## Plan File Format

Every plan file uses the same shape. Sections in order:

```markdown
# Plan NNNN: <Title>

**Status:** active | completed | discarded
**Created:** YYYY-MM-DD
**Last touched:** YYYY-MM-DD

## Goal
One paragraph. What success looks like, observable from outside.

## Out of scope
- Things explicitly not being done in this plan, even if tempting

## Steps
- [x] Step 1 - <short description> (completed YYYY-MM-DD)
- [ ] Step 2 - <short description> (in progress)
- [ ] Step 3 - <short description>
- [ ] Step 4 - <short description>

## Discoveries
- YYYY-MM-DD: <what was discovered, where it went> (e.g. "found stale lib/ reference -> fixed inline; pushed createSchema gap to backlog")

## Notes
Freeform working notes - design sketches, file paths, mid-edit state, anything that helps a future session resume without re-thinking.
```

**Status values:**

| Status | Meaning | Location |
|---|---|---|
| `active` | Being worked on (by any agent or work stream) | `plans/` |
| `completed` | All steps checked, archived | `history/` |
| `discarded` | Abandoned or superseded, archived | `history/` |

**Step granularity:** each step is something a single focused session could finish. If a step takes more than ~2 hours, split it. Steps are not git commits; one step often produces multiple commits or none at all.

**Out of scope is mandatory** even if empty. Naming what is *not* being done now is the single most effective drift-prevention tool. If a tempting side-task arises, check the "Out of scope" line first - if it is in there, push it to the backlog and keep going.

---

## Backlog Format

`backlog.md` is the catch-all for tasks discovered while doing something else. Items are separated by `---` dividers and carry a small fixed header followed by any amount of freeform context. There is no rigid schema beyond the header fields.

```markdown
# Backlog

Discovered tasks not yet attached to a plan. Reviewed when starting a new plan or when asked "what's next?".

---

**Added:** 2026-05-07  **Tag:** mongodb
Review index recommendations for the sessions collection - the write pattern changed after auth-store refactor and the current index may be suboptimal for the new query shape.

---

**Added:** 2026-05-07  **Tag:** mongodb
Implement `createSchema` in `js-server-helper-nosql-mongodb` (currently returns `NOT_IMPLEMENTED`). Discovered while writing auth-store tests.

---
```

**Header fields** (required on every item):

- `Added` — date captured (YYYY-MM-DD)
- `Tag` — short module or area name (`mongodb`, `dynamodb`, `auth`, `verify`, `docs`, `ci`, `tests`). Use existing tags before inventing new ones.

Everything after the header line is freeform. More context is better; a future session should be able to act on an item without re-discovering the original motivation.

Items leave the backlog by either:

1. Being promoted into a new plan (remove the item, reference it in the plan's `## Goal`).
2. Being marked obsolete (remove the item; brief note in the relevant `history/` plan if applicable).

Never let the backlog grow past ~30 items without a sweep. A bloated backlog is the same as no backlog.

---

## How to Plan

The sections above describe *how the files work*. This section describes *how to think* before reaching for a plan file.

### Deciding whether something needs a plan

Not every task warrants a plan file. Use this as a filter:

- **No plan needed:** a self-contained change completable in a single session with a clear, obvious endpoint (fix a bug, update a README, add a missing field). Capture anything discovered as a backlog item and move on.
- **Plan needed:** work that will span more than one session, involve multiple files or subsystems, or carry real risk of scope creep. If you catch yourself thinking "I should note that for later" more than once - that is a plan.

### Writing a good goal

The `## Goal` section is the most important part of the plan. Write it *before* writing the steps.

A good goal:
- Describes the **outcome**, not the activity. "Auth module's verify path uses the adapter pattern" not "refactor auth module".
- Is **falsifiable**: a future session can read it and say "yes, done" or "no, still missing X".
- **Fits in one paragraph.** If it needs two, the plan is probably two plans.

### Scoping steps

Steps are the unit of forward progress. Each one should be completable in a single focused session (~1-2 hours).

- **Too big:** "Implement adapter pattern" → split into design, scaffold, implement, test, document.
- **Too small:** "Add one import statement" → fold into the surrounding step.
- **Right size:** "Rewrite `auth.js` loader to inject store adapter via `Lib`" — concrete, single-session, verifiable.

Write all the steps you can see *before* starting, but expect to add more as you go. New steps that emerge mid-plan get appended to `## Steps`; surprises belong in `## Discoveries`.

### Using Out of scope aggressively

Every temptation named in `## Out of scope` is a drift vector already defused. Be specific:

```markdown
## Out of scope
- Migrating the dynamodb store adapter (separate plan)
- Changing the auth public API surface
- Updating other modules that depend on auth
```

When a side-task appears mid-session, check this list first. If it is already named here, drop it in the backlog and keep going without discussion.

### When the plan changes mid-flight

Plans are allowed to evolve. If the original goal turns out to be wrong or scope needs adjusting:

1. Edit `## Goal` to reflect what is actually being done.
2. Add a `## Discoveries` entry explaining why the scope shifted.
3. Update `## Out of scope` to reflect the new boundaries.

Do not abandon the plan file and start a new one unless the scope is genuinely different work. A corrected goal is more honest than two half-finished plans.

---

## Workflow Verbs

Seven operations cover every common transition. Each verb maps to a clear file mutation - so a human can do it manually if no slash command is available.

| Verb | What | File mutation |
|---|---|---|
| **new** | Start a new plan | Create `plans/NNNN-<slug>.md` with `Status: active` |
| **show** | Display a plan or list all known plans | Read matching plan file(s) |
| **step** | Mark current step done; advance | Edit the plan's `## Steps`; update `**Last touched:**` |
| **done** | Archive the active plan as completed | Edit status → `completed`; move file to `history/` |
| **discard** | Archive a plan as abandoned | Edit status → `discarded`; move file to `history/` |
| **backlog** | Append to or read the backlog | Edit `backlog.md` |
| **next** | Suggest from backlog given recent context | Read `backlog.md`; reply with 1-3 candidates |

---

## Session Rituals

Two rituals make the system actually work. The AI follows them automatically; a human developer should match them.

### Start of session

1. List plan files in `__dev__/plans/` sorted by modification time, most recent first.
2. Read the most recently modified plan file.
3. State - in one sentence - what that plan is and which step appears to be in progress.
4. Confirm with the user: continue this plan, or pick a different one?
5. If the user's request diverges from the plan in progress, ask whether to capture as backlog or start a new plan.

### End of significant step

1. Edit the active plan's `## Steps` to check off the completed step and mark the next one in progress.
2. Update `**Last touched:**` to today.
3. Add any discoveries to the plan's `## Discoveries` section or to `backlog.md`.

### When the conversation drifts off-topic

The moment a side-task is detected, surface it. Two options:

- **Quick capture, keep going:** drop it into `backlog.md`, continue the active plan. This is the default for small items.
- **New plan:** if the side-task warrants its own goal and steps, create a new plan file. The original plan stays `active` - both plans coexist in `plans/` until one is archived.

Never silently abandon an in-progress plan. Drift detection is the single most important behavior of this system.

---

## Common Pitfalls and Fixes

| Pitfall | Effect | Recommended approach |
|---|---|---|
| Backlog full of vague one-word items (`refactor`, `tests`) | Cannot be acted on without re-discovery | Each item carries enough context to act on standalone |
| Plans with 30+ unchecked steps | Indicates the plan is really an epic | Split into multiple plans; one focused goal each |
| Skipping the `## Out of scope` section | Drift is a near-certainty | Always write it, even if "(none)" |
| Moving to `history/` without updating `**Status:**` | Status and location become inconsistent | Always edit the file before moving |
| Using this system for an entire-product roadmap | Roadmap belongs in `ROADMAP.md` (tracked, shared) | Plans are working artifacts; roadmap is shared intent |
| Committing `__dev__/plans/` | Folder is gitignored on purpose; PRs would drown in noise | Push only changes to `docs/dev/planning.md` and `.windsurf/workflows/plan.md` |

---

## Slash Command

The `/plan` slash command in `.windsurf/workflows/plan.md` automates each verb. Read that workflow file for the exact step-by-step the AI follows when invoked.

The slash command is a **convenience layer** over the file conventions in this document. Either layer can be used independently: a developer can edit the markdown files by hand, and the AI can run the verbs without slash-command invocation. The convention is what matters; the command is sugar.

---

## Further Reading

- [`.windsurf/workflows/plan.md`](../../.windsurf/workflows/plan.md) - the slash-command implementation
- [Personal Workspace](../architecture/architectural-philosophy.md#personal-workspace-dev) - why `__dev__/` exists and what else lives there
- [Migration Pitfalls](../architecture/migration-pitfalls.md) - the journal pattern that this system extends to in-flight work
