---
description: Create, transition, and close plans - the persistent memory layer for multi-session work. Handles new, next, done, revive, supersede, and status verbs.
---

# Plan Workflow

This workflow manages the plan files in `__dev__/plans/`. Plans are the memory that continues across sessions and agents. This workflow has the operations for each usual transition.

An expensive model writes a plan. A less expensive model executes it. The executor does not ask questions, and it improvises when the plan has a gap. The authoring contract below exists because of this difference.

## Operating Principle

> **A plan is a handoff artifact.** A model that cannot ask questions must be able to execute it.
> Each path is absolute or has an explicit Cwd. Each command can be copied and run as written. Each step
> has a pass signature and an on-failure action. Each judgment call is decided in the plan.

## When To Run

- Start new work that continues across sessions and needs a durable record
- Move between steps, plans or chains
- Continue work after a gap
- Close work that is complete or abandoned
- Show the status of work in progress

## Verbs

| Verb | What | File mutation |
|---|---|---|
| **new** | Start a new plan | Create `__dev__/plans/NNNN-<slug>.md` with `Status: active` |
| **next** | Go to the next step or plan | Edit `__dev__/PROGRESS.md`, update the plan's Steps |
| **done** | Archive a completed plan | Set `Status:` to `completed`, move the file to `__dev__/plans/history/` |
| **revive** | Open an archived plan again | Move the file back to `__dev__/plans/`, set `Status:` to `active` |
| **supersede** | Replace one plan with another | Mark the old plan `discarded`, create the new plan with a Provenance that points to the old plan |
| **status** | Show the current position and the plan state | Read `__dev__/RUNBOOK.md`, `PROGRESS.md`, `ESCALATIONS.md` |

## Mandatory Plan Sections

If a plan does not have all of these sections, the plan is not executable. Do not hand it off.

| Section | Contains |
|---|---|
| Header block | Status, Created, Last touched, Chain position, Repo, Depends on, Governing protocol, Execution tier, Runtime estimate |
| **Provenance** | Parent plan. The events that created this plan. What failed before, and why. The rules from that failure. The plan that this plan supersedes |
| Purpose | One paragraph: what done looks like |
| Out of scope | Strict. It names the adjacent work that is not included |
| **Dry Run** | Each read-only command, run at authoring time, with its real output. If the output is longer than one screen, put it in the evidence file (`__dev__/evidence/<plan>/dry-run.md`) and refer to it |
| Parts and Steps | Each step: Cwd, exact command, pass signature, explicit on-failure action |
| Ledger | Necessary when the plan iterates over more than five targets |
| Steps checklist | Coarse checkboxes |
| **Loop-backs** | A table that maps each expected failure to an action |
| Completion checklist | Machine-verifiable items where possible |
| Close-out part | Update `PROGRESS.md`, edit the status, move the file to `history/`, start the next plan |

## The No-Questions Authoring Contract

The executor does not ask questions, and it improvises when the plan has a gap. Before the handoff, the author verifies each item:

- [ ] Each path is absolute or has an explicit `Cwd`. Do not write "the module directory".
- [ ] Each command can be copied and run as written. The only placeholders are bracketed tokens that the ledger resolves.
- [ ] Each step has a pass signature: an exit code, an exact string, or an emptiness check. Do not write "looks correct".
- [ ] Each step has an explicit on-failure action. A failure is never implicit.
- [ ] Each judgment call is decided in the plan text. If a step says "judge each hit", the plan writes the criteria.
- [ ] Each read-only command was run, and its output is in Dry Run or in the evidence file under a named heading.
- [ ] The loop-backs cover each failure that the author can name.
- [ ] The hard stops are listed and are different from the park-and-continue items.
- [ ] Iteration over many targets has a ledger, so the progress stays after a crash.
- [ ] The close-out part advances `PROGRESS.md` and archives the plan.

## Anti-Patterns to Reject at Authoring Time

- "Run the audit and fix what it finds" with no criteria
- "Verify it works"
- "Repeat for each module" without a ledger
- A command that the author did not run
- A step whose failure mode the author cannot describe

## Plan Chains

If plans must run in a sequence, `__dev__/RUNBOOK.md` is the one entry point. It names the chain order, the hard stops and the park-and-continue items. `PROGRESS.md` records the current position. The state files are described in `docs/dev/planning.md`.

## Session Start Ritual

1. Read `__dev__/RUNBOOK.md` if it exists. If it does not exist, list `__dev__/plans/` by modification time.
2. Read `__dev__/PROGRESS.md`.
3. Read `__dev__/ESCALATIONS.md`.
4. Read the plan that `PROGRESS.md` names as `CURRENT`.
5. State the current position in one sentence.
6. Start at the step that `PROGRESS.md` names.

If a `RUNBOOK.md` exists, do not select a plan by modification time. Do not trust a conversation summary over `PROGRESS.md`.
