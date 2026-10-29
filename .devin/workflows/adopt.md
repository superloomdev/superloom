---
description: Use mode - adopt Superloom's principles into another project in that project's own idiom, verify it stands alone, then detach. Also refreshes an adopted project and starts a new one
---

# Adopt Workflow

Runs when the owner says `start` and the working project is not Superloom. Source of truth: `docs/principles/adopting-superloom.md` and `docs/ai/agent-configuration.md` - Session Modes and Code Words. Where this workflow and those documents disagree, the documents win and the disagreement is reported.

Invoke as: `start` (code word) or `/adopt [create|refresh|new]`. The verb is inferred: no adopted layout in the project means `create`; an adopted layout means `refresh`; no project means `new`.

`[SUPERLOOM]` is the folder holding this workflow's repository. `[PROJECT]` is the working project's root.

## Operating Principle

> **Translate the principles, never transplant the JavaScript.** The project ends with its own complete documents in its platform's idiom and no dependency on `[SUPERLOOM]`.

## Execution Contract (binding)

1. **Phases run in order:** 0 Acknowledge, 1 Survey, 2 Study, 3 Digest and ask, 4 Write principles and platform layer, 5 Write the agent entry, 6 Plan the code, 7 Verify, 8 Detach.
2. **Never edit `[SUPERLOOM]`.** Every write lands in `[PROJECT]`.
3. **No production code changes.** Adoption ends at a written code plan. Code work starts in a later session under the project's own `AGENTS.md`.
4. **One question batch.** Owner questions are asked once, in Phase 3, at most four, each with a recommended answer. Everything else is decided by the documents or recorded in the digest as a judgment call.
5. **Local Git only.** No remote, no push, no AI attribution in any commit.
6. **Evidence per gate.** Each phase prints its gate block before the next phase starts.

## Phase 0 - Acknowledge

Reply with at most six lines, then continue without waiting:

```text
**AGENTS.md active.** **Superloom use mode.**
**Adopting [PROJECT_NAME]** · **Platform idiom wins** · **Native first** · **Full accessibility** · **Clean-room MIT** · **Local git only** · **No AI attribution** · **High / Low / Fusion / Lean Fusion understood**
Phase: [PHASE] · Next: [NEXT_STEP].
```

When the owner restates rules already covered, reply "Already known.", the tag line, and "Next time, say start."

## Phase 1 - Survey (cheap scan)

Read in this order and stop reading as soon as the question is answered: root listing, `README*`, existing `AGENTS.md` or agent files, build manifest (`project.yml`, `Package.swift`, `package.json`, `Cargo.toml`, `pyproject.toml`, or equivalent), `docs/` listing, one representative source file per layer, test layout, lint and format configuration, `git status` and `git remote -v`.

Gate:

```text
Phase 1 - Survey
Project: [name] | Platform: [platform] | Language: [lang] | Min OS/runtime: [value]
Existing docs: [list or none] | Existing agent files: [list or none]
Tests: [framework, command] | Lint: [tool, command] | Git: [local only | remote present]
Verb: create | refresh | new
```

## Phase 2 - Study

Read from `[SUPERLOOM]/docs/`, in full: `principles/engineering-philosophy.md`, `principles/adopting-superloom.md`, `principles/module-design.md`, `principles/composition-and-adapters.md`, `principles/file-archetypes.md`, `principles/code-readability.md`, `principles/error-handling.md`, `principles/testing.md`, `principles/documentation-authoring.md`, `ai/agent-configuration.md`, `ai/workflow-authoring.md`, `ai/model-tiering.md`. Read `languages/js/index.md` and `languages/js/module-structure.md` as the worked example only. Then read the platform owner's official guidelines for the project's platform (API design, interface guidelines, accessibility).

**Sibling first.** When the owner names an already-adopted project on the same platform, read its `AGENTS.md`, `docs/platform/`, `docs/conventions.md` and design documents before the platform owner's guidelines. Inherit its answers; translate from Superloom only what the sibling does not answer. Record the sibling as the source in the digest.

Gate: one line per document read, plus the platform sources consulted with their URLs, plus the sibling used or "none".

## Phase 3 - Digest and ask (hard gate)

Write `[PROJECT]/__dev__/notes/superloom-digest.md`: for each row of "What Carries Over Unchanged" and "What Gets Translated" in the adoption document, how the project answers it today, citing real files, and the gap. Then ask the owner one batch of at most four questions, each with a recommendation. Typical: project name (placeholder allowed), license, public owner (may stay undecided), anything the project contradicts deliberately.

Gate: the digest path, the gap count, and the owner's answers.

## Phase 4 - Write principles and platform layer

Write `docs/principles/` and `docs/platform/` per "The Adopted Layout". Rules:

- Each document opens by naming the principle, restates it in one line, then dictates the platform's way completely.
- Every adaptation states its reason at the point of use.
- Write the skeletons before the prose: one skeleton per file archetype.
- `docs/platform/` includes a new-project bootstrap document so the project can seed sibling projects.
- Write `docs/conventions.md` (seeded from the digest) and `docs/references.md` (permissive sources only).
- Agent-facing register: flight-manual English. No em dashes.

Gate: files written with line counts.

## Phase 5 - Write the agent entry

Write `AGENTS.md` (target 200 lines, ceiling 300), with these sections in order: Session start (the code word reply, mirroring Phase 0 with the project's own tags and its current plan), What this is plus read path, Hard rules (including local Git and no AI attribution), Stack, Commands, Document map, Model vocabulary (High, Low, Fusion, Lean Fusion, one line each). Write `docs/ai/`: agent operation (read path, cheap scan order, hand-off rules), model vocabulary, and tool configuration. Add `CLAUDE.md` containing `@AGENTS.md`, put skills in `.agents/skills/` with tool folders as relative symlinks, and add a conformance-audit skill that checks files against the code-shape document. Add the credit line to `README.md` and the principles index. Write or update `CONTRIBUTING.md` in the human register.

Gate: `wc -l AGENTS.md`, the skills list, and the credit line locations.

## Phase 6 - Plan the code

Write `docs/plans/[NNN]-house-style.md`: work packages in order, each with a goal, its tier tag (`[LOW]`, `[HIGH]` or `[OWNER GATE]`), exact commands, a pass condition and a commit message. Respect any existing current plan: the new plan is queued after it, never silently placed ahead of it. End the phase with the switch line for the owner: "Docs done. Code starts under the project's own AGENTS.md; choose the model and say start."

Gate: the plan path and the work package list.

## Phase 7 - Verify (convergence)

Run as one combined sweep, labeled sections, over every file written:

| Check | Pass |
|---|---|
| Residue: `[SUPERLOOM]` folder name, `codebase-superloom`, `Lib.Utils`, `shared_libs`, `js-helper` | Only the credit line, outside `__dev__/` (the digest records the source and is exempt); prove the pattern fires on a planted temporary file first |
| Absolute home paths | None |
| Markdown links resolve | All |
| Em dashes in agent-facing and human-facing files | None |
| Non-permissive project names | None |
| `AGENTS.md` budget | At or under 300 lines |

Fix every finding, re-run. Two consecutive clean passes end the phase; five iterations without convergence stop the run with the findings reported.

## Phase 8 - Detach

1. Commit locally with a Conventional Commit message, no AI attribution. If Git has no author identity, ask the owner which to use; never change Git configuration.
2. Tell the owner: "Adoption done. Remove Superloom from this workspace, open a new session, and say start."
3. The owner's fresh `start` must return the project's own session block; the cold-feature check from "The Detach Test" runs in that session.

## Mode: refresh

Phases 0 to 2 as above. Then diff the project's principles against the current Superloom principles and present the differences as a numbered list for the owner to accept or reject. Never overwrite a recorded adaptation. Apply accepted items, then Phases 7 and 8.

## Mode: new

Ask for the project name, the platform, and whether an adopted sibling on the same platform should be inherited. Create the folder beside the workspace's other projects, run `git init`, then run `create` from Phase 1.

## Loop-backs

| Failure | Returns to |
|---|---|
| A principle has no answer in the platform layer | Phase 4 |
| `AGENTS.md` over budget | Phase 5: compress, demote to a document, or move to a skill |
| Residue found | Phase 4 or 5, whichever wrote the file |
| Fresh `start` does not return the project's block | Phase 5 |

## Per-run Verification Checklist

- [ ] Phase gates 1 to 6 printed
- [ ] Digest written, owner answers recorded
- [ ] Every carried-over principle restated; every translation reasoned
- [ ] `AGENTS.md` within budget, session block present, model vocabulary present
- [ ] Credit line in `README.md` and principles index, nowhere else
- [ ] Phase 7 two clean passes
- [ ] Local commit, no remote, no attribution
- [ ] No file in `[SUPERLOOM]` changed

## Self-Improvement

A failure this workflow did not foresee is journaled in `docs/dev/pitfalls.md` of `[SUPERLOOM]` during the next `dev mode` session, then this workflow gains the missing check.
