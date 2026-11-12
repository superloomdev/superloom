---
description: Use mode - adopt Superloom's principles into another project in that project's own idiom, verify it stands alone, then detach. Also refreshes an adopted project and starts a new one
---

# Adopt Workflow

This workflow runs when the owner says `start` and the working project is not Superloom. The sources of truth are `docs/principles/adopting-superloom.md` and `docs/ai/agent-configuration.md` - Session Modes and Code Words. If this workflow and those documents disagree, the documents win. Report the disagreement.

Invoke as: `start` (code word) or `/adopt [create|refresh|new]`. Infer the verb. If the project has no adopted layout, the verb is `create`. If it has an adopted layout, the verb is `refresh`. If there is no project, the verb is `new`.

`[SUPERLOOM]` is the folder that holds the repository of this workflow. `[PROJECT]` is the root of the working project.

## Operating Principle

> **Translate the principles, never transplant the JavaScript.** At the end, the project has its own complete documents in its platform's idiom and no dependency on `[SUPERLOOM]`.

## Execution Contract (binding)

1. **Phases run in order,** from Phase 0 to Phase 8. The headings below name the phases.
2. **Do not edit `[SUPERLOOM]`.** Each write goes to `[PROJECT]`.
3. **No production code changes.** The adoption ends with a written code plan. Code work starts in a later session under the project's own `AGENTS.md`. The step-comment checker is lint tooling, not production code.
4. **One question batch.** Ask the owner questions once, in Phase 3. Ask four questions or fewer, each with a recommended answer. The documents decide all other items, or the digest records them as judgment calls.
5. **Local Git only.** Do not add a remote. Do not push. Do not add AI attribution to a commit.
6. **Evidence per gate.** Each phase prints its gate block before the next phase starts.

## Phase 0 - Acknowledge

Reply with six lines or fewer. Then continue without a wait:

```text
**AGENTS.md active.** **Superloom use mode.**
**Adopting [PROJECT_NAME]** · **Platform idiom wins** · **Native first** · **Full accessibility** · **Clean-room MIT** · **Local git only** · **No AI attribution** · **High / Low / Fusion / Lean Fusion understood**
Phase: [PHASE] · Next: [NEXT_STEP].
```

If the owner says again the rules that the agent already has, reply "Already known.", the tag line, and "Next time, say start."

## Phase 1 - Survey (cheap scan)

Read the items below in this order. Stop when the question has an answer.

1. The root listing, `README*`, and the existing `AGENTS.md` or agent files.
2. The build manifest (`project.yml`, `Package.swift`, `package.json`, `Cargo.toml`, `pyproject.toml`, or equivalent).
3. The `docs/` listing, one representative source file for each layer, and the test layout.
4. The lint and format configuration, `git status`, and `git remote -v`.

Gate:

```text
Phase 1 - Survey
Project: [name] | Platform: [platform] | Language: [lang] | Min OS/runtime: [value]
Existing docs: [list or none] | Existing agent files: [list or none]
Tests: [framework, command] | Lint: [tool, command] | Git: [local only | remote present]
Verb: create | refresh | new
```

## Phase 2 - Study

Read these documents in `[SUPERLOOM]/docs/` in full:

- `principles/engineering-philosophy.md`, `principles/adopting-superloom.md`, `principles/module-design.md`
- `principles/composition-and-adapters.md`, `principles/file-archetypes.md`, `principles/code-readability.md`
- `principles/error-handling.md`, `principles/testing.md`, `principles/documentation-authoring.md`
- `ai/agent-configuration.md`, `ai/workflow-authoring.md`, `ai/model-tiering.md`

Read `languages/js/index.md` and `languages/js/module-structure.md` as the worked example only. Then read the official guidelines of the platform owner for the project's platform (API design, interface guidelines, accessibility).

**Sibling first.** The owner can name a project on the same platform that was adopted before. If so, read its `AGENTS.md`, `docs/platform/`, `docs/conventions.md` and design documents before the guidelines of the platform owner. Use its answers. Translate from Superloom only what the sibling does not answer. Record the sibling as the source in the digest.

Gate: one line for each document that you read, the platform sources with their URLs, and the sibling that you used or "none".

## Phase 3 - Digest and ask (hard gate)

Write `[PROJECT]/__dev__/notes/superloom-digest.md`. The adoption document has two tables: "What Carries Over Unchanged" and "What Gets Translated". For each row, write how the project answers it today, with real files, and the gap. Then ask the owner one batch of four questions or fewer, each with a recommendation. These are the usual questions:

- The project name. A placeholder is permitted.
- The license, and the public owner. The owner can stay undecided.
- Each item that the project contradicts on purpose.

Gate: the digest path, the gap count, and the owner's answers.

## Phase 4 - Write principles and platform layer

Write `docs/principles/` and `docs/platform/` as "The Adopted Layout" gives. Rules:

- Each document names the principle and states it again in one line. Then it gives the complete platform way.
- Each adaptation states its reason at the point of use.
- Write the skeletons before the prose: one skeleton for each file archetype. Each function body in a skeleton shows its step comments, by the full rule set in `principles/code-readability.md` - Step Comments.
- Write the step-comment checker for the platform and add it to the project's lint command (`principles/code-readability.md` - Mechanical Enforcement). If the formatter caps blank lines, write the compressed spacing in the code-shape document.
- `docs/platform/` includes a new-project bootstrap document, so the project can start sibling projects.
- Write `docs/conventions.md` (from the digest) and `docs/references.md` (permissive sources only).
- Write each agent file in the agent register, ASD-STE100 Simplified Technical English. Write each human file in plain English. The lists are in `principles/adopting-superloom.md` - Two Registers of Writing. Do not use em dashes.

Example of a skeleton body with its step comments:

```text
[signature of a function that reads a record]

    [comment] Read the record
    [call]

    [comment] Return the failure if the read failed
    [if the result failed: return the failure]

    [comment] Return the record
    [return the record]
```

Gate: the files that you wrote, with line counts, and the checker command with its output on the skeleton code.

## Phase 5 - Write the agent entry

Write `AGENTS.md` (target 200 lines, ceiling 300) in the agent register. Use these sections in this order:

1. Session start: the code-word reply, like Phase 0, with the project's own tags and its current plan.
2. What this is, and the read path: `AGENTS.md`, then `MEMORY.md`, then the documents.
3. Hard rules, with local Git and no AI attribution.
4. Memory: how to read and update `MEMORY.md` (`ai/agent-configuration.md` - Working Memory).
5. Stack, Commands (with the step-comment checker in lint), Document map.
6. Model vocabulary: High, Low, Fusion, Lean Fusion, one line each.
7. Owner reports: the final summary has four groups, Done, Changed, Overridden, Choices made (`ai/agent-configuration.md` - Owner Reports).

Then do these steps:

1. Write `MEMORY.md` with the sections Current state (with its `Updated` line), Notes, Log and Pitfalls. Write the first log entry for the adoption. The author is `[git-user] ([harness])`.
2. Write `docs/ai/`: agent operation (read path, cheap scan order, hand-off rules), model vocabulary, and tool configuration.
3. Add `CLAUDE.md` that contains `@AGENTS.md`. Put the skills in `.agents/skills/`, with the tool folders as relative symlinks. Add a conformance-audit skill that examines files against the code-shape document.
4. Add the credit line to `README.md` and to the principles index.
5. End `README.md` with a short "For AI agents" section in the agent register. The section gives the read order, the commands to run before a commit, and the files that hold the rules.
6. Write or update `CONTRIBUTING.md` in the human register.
7. Write an audit script that fails on an AI product name in a tracked file. The two exceptions are a `MEMORY.md` entry heading and its `Updated` line.

Example of the closing section of `README.md`:

```text
## For AI agents

- Read `AGENTS.md` first. Then read `MEMORY.md`.
- Before each commit, run the lint, test and audit commands in `AGENTS.md`.
- Code shape and step comments: `docs/platform/[code-shape document]`.
```

Gate: `wc -l AGENTS.md MEMORY.md`, the skills list, and the places of the credit line.

## Phase 6 - Plan the code

Write `docs/plans/[NNN]-house-style.md`. Each work package has a goal, its tier tag (`[LOW]`, `[HIGH]` or `[OWNER GATE]`), exact commands, a pass condition and a commit message. Put the findings of the step-comment checker on the existing code into work packages. If the project has a current plan, put the new plan after it. Do not put the new plan before it without a word. End the phase with the switch line for the owner: "Docs done. Code starts under the project's own AGENTS.md. Choose the model and say start."

Gate: the plan path and the list of work packages.

## Phase 7 - Verify (convergence)

Run one combined sweep, with labeled sections, over each file that you wrote:

| Check | Pass |
|---|---|
| Residue: the `[SUPERLOOM]` folder name, `codebase-superloom`, `Lib.Utils`, `shared_libs`, `js-helper` | Only the credit line, outside `__dev__/`. The digest records the source and is exempt. First prove that the pattern finds a planted temporary file |
| Absolute home paths | None |
| Markdown links resolve | All |
| Em dashes in agent files and human files | None |
| Non-permissive project names | None |
| `AGENTS.md` budget | 300 lines or fewer |
| Step-comment checker | It runs in the lint command. It finds a planted block with no comment. Its findings on existing code are in the Phase 6 plan |
| AI product names | Only in `MEMORY.md` entry headings and its `Updated` line. The audit script finds a planted name first |
| Register | The agent files follow the Simplified Technical English rules. The human files are plain English |

Fix each finding and run the sweep again. Two clean passes in a row end the phase. If five iterations do not converge, stop the run and report the findings.

## Phase 8 - Detach

1. Commit locally with a Conventional Commit message and no AI attribution. If Git has no author identity, ask the owner which identity to use. Do not change the Git configuration.
2. Tell the owner: "Adoption done. Remove Superloom from this workspace, open a new session, and say start."
3. The owner's new `start` must return the project's own session block. The cold-feature check of "The Detach Test" runs in that session.

## Mode: refresh

Run Phases 0 to 2 as above. Then compare the project's principles with the current Superloom principles. Show the differences as a numbered list that the owner accepts or rejects. Do not overwrite a recorded adaptation. Apply the accepted items, then run Phases 7 and 8.

## Mode: new

Ask for the project name and the platform. Ask if the project inherits from an adopted sibling on the same platform. Create the folder next to the other projects of the workspace. Run `git init`, then run `create` from Phase 1.

## Loop-backs

| Failure | Returns to |
|---|---|
| A principle has no answer in the platform layer | Phase 4 |
| The step-comment checker is missing or does not find a planted block | Phase 4 |
| `AGENTS.md` is over budget | Phase 5: compress, move the text to a document, or move it to a skill |
| Residue found | Phase 4 or 5, the phase that wrote the file |
| A new `start` does not return the project's block | Phase 5 |

## Per-run Verification Checklist

- [ ] Phase gates 1 to 6 printed
- [ ] Digest written, owner answers recorded
- [ ] Each carried-over principle stated again, each translation with its reason
- [ ] Each skeleton body shows step comments. The checker runs in lint and finds a planted block
- [ ] `AGENTS.md` within budget, with the session block, the Memory section, the model vocabulary and the owner-report rule
- [ ] `MEMORY.md` written, and `README.md` ends with "For AI agents"
- [ ] Credit line in `README.md` and the principles index, and nowhere else
- [ ] Phase 7: two clean passes
- [ ] Local commit, no remote, no attribution
- [ ] No file in `[SUPERLOOM]` changed

## Self-Improvement

If a failure occurs that this workflow did not expect, journal it in `docs/dev/pitfalls.md` of `[SUPERLOOM]` during the next `dev mode` session. Then add the missing check to this workflow.
