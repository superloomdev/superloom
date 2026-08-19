---
description: Create, transition, and close plans - the persistent memory layer for multi-session work. Handles new, next, done, revive, supersede, and status verbs.
---

# Plan Workflow

Manages plan files in `__dev__/plans/`. Plans are the persistent memory layer that spans sessions and agents. This workflow handles the seven operations that cover every common transition.

Plans are authored by an expensive model and executed by a cheaper one that will not ask clarifying questions and will improvise if a gap appears. The authoring contract below exists because of that asymmetry.

## Operating Principle

> **A plan is a handoff artifact.** It must be executable by a model that cannot ask questions.
> Every path is absolute or has an explicit Cwd. Every command is copy-pasteable. Every step
> has a pass signature and an on-failure action. Every judgment call is pre-decided.

## When To Run

- Starting new multi-session work that needs a durable record
- Transitioning between steps, plans, or chains
- Resuming work after a gap
- Closing out completed or abandoned work
- Checking the status of in-flight work

## Verbs

| Verb | What | File mutation |
|---|---|---|
| **new** | Start a new plan | Create `__dev__/plans/NNNN-<slug>.md` with `Status: active` |
| **next** | Advance to the next step or plan | Edit `__dev__/PROGRESS.md`, update the plan's Steps |
| **done** | Archive a completed plan | Edit `Status:` to `completed`, move to `__dev__/plans/history/` |
| **revive** | Reopen an archived plan | Move back to `__dev__/plans/`, edit `Status:` to `active` |
| **supersede** | Replace one plan with another | Mark old as `discarded`, create new with a Provenance pointing to old |
| **status** | Show current position and plan state | Read `__dev__/RUNBOOK.md`, `PROGRESS.md`, `ESCALATIONS.md` |

## Mandatory Plan Sections

A plan missing any of these is not executable and must not be handed off:

| Section | Contains |
|---|---|
| Header block | Status, Created, Last touched, Chain position, Repo, Depends on, Governing protocol, Execution tier, Runtime estimate |
| **Provenance** | Parent plan, the chain of events that created this plan, what was already tried and failed and why, rules the failure produced, what this plan supersedes |
| Purpose | One paragraph. What done looks like |
| Out of scope | Aggressive. Names the adjacent work that is explicitly not included |
| **Dry Run** | Every read-only command executed at authoring time with real output pasted |
| Parts and Steps | Each step: Cwd, exact command, pass signature, and an explicit on-failure action |
| Ledger | Present whenever the plan iterates over more than five targets |
| Steps checklist | Coarse checkboxes |
| **Loop-backs** | Table mapping every anticipated failure to an action |
| Completion checklist | Machine-verifiable where possible |
| Close-out part | Update `PROGRESS.md`, edit status, move to `history/`, start the next plan |

## The No-Questions Authoring Contract

Plans are authored by an expensive model and executed by a cheap one that will not ask clarifying questions and will improvise if a gap appears. This is the no-questions contract: before handing off, the author verifies each item:

- [ ] Every path is absolute or has an explicit `Cwd`. No "the module directory".
- [ ] Every command is copy-pasteable. No placeholders except bracketed tokens the ledger resolves.
- [ ] Every step has a pass signature that is an exit code, an exact string, or an emptiness check. Never "looks correct".
- [ ] Every step has an explicit on-failure action. Never leave failure implicit.
- [ ] Every judgment call is pre-decided in the plan text. If a step says "judge each hit", the criteria are written out.
- [ ] Every read-only command has been executed and its output pasted into Dry Run.
- [ ] Loop-backs cover every failure the author can name.
- [ ] Hard stops are enumerated and distinguished from park-and-continue items.
- [ ] Iteration over many targets has a ledger, so progress survives a crash.
- [ ] The close-out part advances `PROGRESS.md` and archives the plan.

## Anti-Patterns to Reject at Authoring Time

- "Run the audit and fix what it finds" with no criteria
- "Verify it works"
- "Repeat for each module" without a ledger
- Any command never executed by the author
- Any step whose failure mode the author cannot articulate

## Plan Chains

When multiple plans must execute in sequence, a `RUNBOOK.md` at `__dev__/RUNBOOK.md` is the single entry point. It names the chain order, hard stops, and park-and-continue items. `PROGRESS.md` tracks the current position. See `docs/dev/planning.md` for the full state-file documentation.

## Session Start Ritual

1. Read `__dev__/RUNBOOK.md` (if it exists), otherwise list `__dev__/plans/` by mtime
2. Read `__dev__/PROGRESS.md`
3. Read `__dev__/ESCALATIONS.md`
4. Read the plan named as `CURRENT` in `PROGRESS.md`
5. State the current position in one sentence
6. Begin at the step `PROGRESS.md` names

Never select a plan by mtime when a `RUNBOOK.md` exists. Never trust a conversation summary over `PROGRESS.md`.
