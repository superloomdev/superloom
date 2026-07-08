# Workflow Authoring

A workflow is a procedure an AI agent executes: a Markdown file of ordered steps, invoked by name, that turns a complex operation into a sequence requiring no judgment calls. This document is the standard for writing them. It exists because the difference between a workflow that executes flawlessly on an inexpensive model and one that drifts, skips, and improvises is not the model. It is seven design properties, each learned from executed work and each mandatory.

## On This Page

- [When to Write a Workflow](#when-to-write-a-workflow)
- [The Seven Properties](#the-seven-properties)
- [Structure of a Workflow File](#structure-of-a-workflow-file)
- [Embedded Content and the Compile Rule](#embedded-content-and-the-compile-rule)
- [Command Discipline](#command-discipline)
- [The Verb Pattern](#the-verb-pattern)
- [Self-Improvement](#self-improvement)
- [Anti-Patterns](#anti-patterns)

---

## When to Write a Workflow

A workflow is warranted for an operation that is **repeated, multi-step, and correctness-critical**: creating a module, reviewing one against the standard, publishing, recovering a drifted session. It is not warranted for one-off tasks (direct instruction is cheaper) or for knowledge (that is a document; see [Documentation Authoring](../principles/documentation-authoring.md)).

The economic argument: a workflow is written once by the most capable model (or human) available and executed many times by the least expensive one that can follow it. Every judgment call removed from execution time is moved to authoring time, where it is paid once. See [Model Tiering](model-tiering.md).

## The Seven Properties

Every workflow has all seven. A workflow missing one is not done.

### 1. Self-contained execution content

Everything the executor needs during a step is written in the step: the exact command, the complete checklist, the full skeleton, the precise pass condition. Links are for background reasoning only. An agent that must follow a link mid-procedure to know what to do will eventually not follow it, and will improvise instead.

### 2. Hard gates with visible evidence

A gate is a step the workflow cannot pass without producing **evidence in the reply**: a verbatim quote proving a document was read this run, a per-file table proving every file was covered, a named verdict line ("Review verdict: clean"). The form matters: evidence the agent must display is evidence the user can audit at a glance, and a gate without an evidence demand will be silently skipped under context pressure.

### 3. Convergence exit conditions

Iterative phases (audit, fix, verify) exit on a measured state, never on effort: "two consecutive full passes with zero new findings", not "when everything is fixed". Agents systematically underestimate remaining work; a convergence condition converts "I think it is done" into "the last two passes prove it is done". Any fix after a clean pass resets the count.

### 4. Fixed phase order with stop points

Phases run in a declared order, never skipped, merged, or parallelized, with explicit STOP points where the agent must wait for the user: before anything irreversible (publishing, deleting, committing), and whenever an instruction has no matching situation. The rule at a stop is uniform: report exactly what is seen, ask, wait. Working around ambiguity is the root of most agent damage.

### 5. Exact commands with substitution tokens

Every terminal command is written out literally, with square-bracket tokens (`[module-path]`) as the only variable parts. The executor substitutes; it never composes. Written commands encode the hard-won details (working directory discipline, output limiting, safe flags) that composed commands lose. Steps that are safe to run without confirmation (read-only, idempotent) are marked as such; mutation steps never are.

### 6. Skeletons over rule recall

Where the workflow checks structure, it diffs against a complete skeleton or embedded checklist, element by element, rather than instructing the agent to "verify it follows the standard". Recall-based checking finds what the agent remembers; conformance diffing finds what is actually missing. This is the single highest-yield property: structural defects invisible to linting and keyword search are caught exactly here.

### 7. A self-improvement hook

The workflow's final phase instructs the executor to record any newly discovered failure mode in the appropriate pitfall journal and, where the gap was in the workflow itself, to amend the workflow. An instrument that sharpens with use compounds; one that cannot learn repeats its gaps forever.

## Structure of a Workflow File

```text
---
description: [one line: what it does and its verbs]
---

# [Name] Workflow

[Two or three lines: purpose, invocation form, scope per run.]

## Operating Principle          (the mindset rule, e.g. trust files, not memory)
## Execution Contract           (binding numbered rules: order, scope, stops)
## [Verb or Phase sections]     (the procedure, with embedded content and gates)
## Loop-backs                   (what returns where when a check fails)
## Per-run Verification Checklist  (every gate as a tickable line)
```

The closing checklist is not decoration: the executor fills it at the final gate, each tick pointing to where in the conversation the evidence lives, and an unticked line blocks completion. It is the user's one-screen audit of the whole run.

## Embedded Content and the Compile Rule

Property 1 (self-containment) collides with the single-source-of-truth rule: embedded checklists and skeletons duplicate canonical documentation. The resolution is the same as for `AGENTS.md`:

> **Embedded execution content is compiled from its canonical source, marked with its source path, and verified against it by the validation workflow. Drift between an embedded block and its source is a release-blocking defect in the workflow.**

Practically: when a skeleton or rule changes in the documentation, the same change session updates every workflow that embeds it. The validation workflow checks the correspondence. The workflow file states, above each embedded block, the source it mirrors, so the linkage is auditable in both directions.

## Command Discipline

Rules for every command an agent workflow contains, each tracing to a journaled failure:

- **No directory-changing inside commands.** The working directory is set through the tool's parameter, never with `cd`. Each command runs in a fresh shell.
- **One line per command**, or a single chain. Nothing appended after; no filler.
- **Long output is truncated at the source** (`| tail -N`); the output budget is part of the procedure, not left to chance.
- **Multi-line strings never reach the shell.** Heredocs and multi-line quoted arguments hang non-interactive shells; content goes through file-writing tools and temporary files.
- **Detection commands and mutation commands are visually distinct**, and only detection commands are ever marked auto-runnable.

## The Verb Pattern

A workflow covering one lifecycle owns all of that lifecycle's operations as **verbs** (`create`, `review`, `fix`, `publish`), dispatched from the invocation text, with a dispatch table at the top of the file mapping input to verb. Ambiguous input resolves by asking, never guessing.

Verbs share the workflow's embedded standards, which is the point: `review` and `fix` check the same embedded checklist that `create` builds from, so the lifecycle cannot disagree with itself. The pairing rule for audit verbs: **`review` produces a cited findings report and changes nothing; `fix` is `review` plus application plus re-verification to convergence.** Both exist because sometimes the user wants the report first.

## Self-Improvement

When an executed run hits a failure mode the workflow did not anticipate:

1. **Journal it first** in the domain's pitfall journal (Symptom, Cause, Lesson), before fixing the immediate problem.
2. **Amend the workflow** with the missing check, sweep, or gate, so the next run benefits.
3. **Recompile derived artifacts** if the lesson changed any canonical source.

The order matters: the journal entry is cheapest while the diagnosis is fresh, and a fixed-but-unjournaled failure will be re-diagnosed from scratch by the next session that hits it.

## Anti-Patterns

| Anti-pattern | Why it fails |
|---|---|
| "Follow the standard in [document]" as an execution step | The agent recalls a summary of the document instead of reading it; property 1 violated |
| Gates that demand action but no displayed evidence | Skipped silently under context pressure; property 2 violated |
| "Repeat until everything passes" | Exits on the agent's optimism, not on measured state; property 3 violated |
| A workflow that both decides scope and executes it | Scope creep at execution time; scope belongs in the invocation argument and the contract |
| Duplicating another workflow's steps inline | Two versions of one procedure drift; invoke the other workflow or extract a shared source |
| Product-specific instructions in shared workflows | Breaks portability across agent tools; see [Agent Configuration](agent-configuration.md) |
