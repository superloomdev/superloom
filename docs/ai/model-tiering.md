# Model Tiering

AI-assisted development runs on models of very different cost and capability, and the cost structure is unforgiving: every tool call re-sends the accumulated conversation, so total cost compounds as calls multiplied by context size. Model tiering is the discipline of assigning each kind of work to the cheapest tier that does it correctly, with plan files as the interface between tiers. The framework's own experience is the proof: a well-authored workflow executes with full precision on an inexpensive model, because the precision lives in the workflow, not the model.

## On This Page

- [The Two Tiers](#the-two-tiers)
- [Owner Vocabulary](#owner-vocabulary)
- [The Division of Labor](#the-division-of-labor)
- [Plans as the Interface](#plans-as-the-interface)
- [Session Discipline](#session-discipline)
- [Hand-off Within a Plan](#hand-off-within-a-plan)
- [Token Discipline Within a Session](#token-discipline-within-a-session)

---
## The Two Tiers

| Tier | Character | Paid for |
|---|---|---|
| **Reasoning tier** | The most capable model available | Judgment: resolving contradictions, designing standards, authoring documents and workflows, deciding what correct means |
| **Execution tier** | The least expensive model that follows procedures reliably | Throughput: running workflows, sweeps, full-file verification reads, commits, pipeline watching |

The boundary is judgment. Work whose steps are already written belongs to the execution tier no matter how important it is; work that requires deciding among defensible options belongs to the reasoning tier no matter how small it looks. Importance is not the criterion. Ambiguity is.

## Owner Vocabulary

Short words the owner uses to name the session setup. Every agent understands them without asking:

| Word | Meaning | Who reads and decides | Who edits and runs |
|---|---|---|---|
| **High** | One session on the reasoning tier alone | The session | The session |
| **Low** | One session on the execution tier alone | Nobody; it follows a written plan and stops at owner gates | The session |
| **Fusion** | One session: a reasoning-tier lead plus an execution-tier sidekick | The lead: reads the code, decides, and authors every tracked file | The lead edits; the sidekick runs commands and reports |
| **Lean Fusion** | Fusion with the lead's reading cut to the minimum; applies only when the owner names it | The lead, from reports only | The sidekick, including reading the plan |

**Fusion rules**, the default whenever a tool pairs a lead with a sidekick:

- **The lead authors.** The lead writes every character of source, tests, specs, data, configuration and documentation, after reading the code it changes.
- **The sidekick runs.** Installs, builds, checks, test suites, probes, publication steps from a written recipe, and pipeline or device waits. It reports exit codes, counts, each failing test's name with its expected and actual values, and artifact paths.
- **The sidekick edits no tracked file.** A file produced by a script it runs (generated documentation, a lockfile, evidence) is that script's output, and the lead reviews it. A fix the sidekick sees is a line in its report, never an edit.
- **A workflow keeps its steps and changes hands.** The lead performs a workflow's authoring and mutation steps; the sidekick runs its command and verification steps.
- **The boundary is checked mechanically.** The lead stages its work before each handoff. An unstaged change to a tracked file after the handoff, outside the generated paths, was written by the sidekick: the lead restores it and repeats the handoff.
- **The sidekick never ends a handoff to save context** where the tool summarizes a full context automatically. A context usage counter is then not a budget ([pitfall](../dev/pitfalls.md#rule-delivery)). A report that names context as its reason is answered with "continue", never with a narrower brief.
- **Bulk mechanical editing is not Fusion work.** A workspace-wide rename or sweep runs as a Low session from a written plan, or under Lean Fusion when the owner names it.

The reason: a sidekick that authors makes the lead pay three times for one change. The lead writes a brief, the sidekick re-reads the same sources to act on it, and the lead reviews and reworks the result. A wrong guess arrives as a plausible diff. When the lead authors, the judgment is spent once, and the sidekick's low cost goes where it is safe: running, waiting and reporting.

**Lean Fusion rules**, for when the owner names it because the reasoning tier's tokens are the scarce resource:

- **The lead reads only** the pasted session prompt, the last lines of `PROGRESS.md`, and the sidekick's reports. It opens another file only when a report's decision line names it.
- **The lead does only:** one-line handoffs ("next unit" or "continue"); answers to decision lines in three lines or fewer, choosing one option; design no written plan settles; owner-level approvals; one review of the run's commits at the end.
- **The sidekick does everything else:** reads the plan and briefs, edits, runs gates, commits and pushes to work branches, updates `PROGRESS.md`, writes the next session prompt.
- **One handoff is one unit** under an hour, ending at a clean boundary with a report of at most fifteen lines: `UNIT`, `COMMITS`, `GATES`, `OUTSIDE-BRIEF`, `DECISION` (options with a recommendation, or "none"), `WARN`, `NEXT`.
- **A sidekick that fails one unit twice** reports a decision line; the lead takes over hands-on work only when the sidekick fails the same unit twice more after the lead's answer.

## The Division of Labor

| Work | Tier | Why |
|---|---|---|
| Writing and amending standards, principles, skeletons | Reasoning | Every downstream file inherits the decision |
| Authoring and revising workflows | Reasoning | Judgment removed here is judgment the execution tier never needs |
| Long-horizon planning, contradiction resolution | Reasoning | The plan is the interface; its quality bounds everything after it |
| Executing a workflow end to end | Execution | The seven properties of [Workflow Authoring](workflow-authoring.md) exist precisely to make this safe |
| Mechanical sweeps, renames, full-file double reads | Execution | High token volume, zero ambiguity |
| Verification passes, lint and test loops, CI watching | Execution | Written pass conditions; no judgment |
| Website builds, compilations, commits per written instructions | Execution | Procedural |

The corollary for the reasoning tier: **it does not spend its context on mechanical volume.** Full-file verification reading is execution-tier work even when a reasoning-tier session discovered the need for it; the reasoning session writes the instruction into the plan and ends.

The table assigns work to a tier, and a tier that works alone (a Low session) both edits and runs. A Fusion sidekick takes only the run-and-report share of the execution rows; the editing share stays with the lead ([Owner Vocabulary](#owner-vocabulary)).

## Plans as the Interface

Tiers cooperate through the persistent plan files of the [Planning System](../dev/planning.md), not through shared conversation context:

- The reasoning tier ends a session by writing decisions, dispositions, and next steps into the plan, in enough detail that a fresh execution session needs no other briefing.
- The execution tier starts from the plan, executes against it, and writes results and surprises back into it.
- Anything the execution tier finds that requires judgment goes into the plan as an open question, not into an improvised decision.

A plan entry that cannot be executed without asking what it means is a defect of the reasoning session that wrote it.

## Session Discipline

- **One phase, one session.** Long conversations are the cost multiplier, since every call re-sends everything. End sessions at phase boundaries; write state to the plan; start the next phase clean.
- **Never mix authoring and mechanical execution in one session.** A design discussion dragging behind a sweep pass taxes every remaining call with dead context.
- **A session states its plan position at start** (which plan, which step) and updates the plan at end. The ritual is what makes fresh sessions cheap.
- **A long run starts a session; it never ends a long one.** A waiting session is not free: a tool can re-send the waiting lead's whole context at intervals to keep it cached. Start a run of an hour or more in a fresh session, while the context is small.

## Hand-off Within a Plan

**One session with a sidekick (the default when the tool offers it).** A lead on the reasoning model and a sidekick on the execution model share one session under the Fusion rules of [Owner Vocabulary](#owner-vocabulary). The lead decides, authors every tracked file, reviews generated output and contact sheets, and talks to the owner. The sidekick runs the gates and the commands the lead names, and reports with numbers and artifact paths. Steps carry no tier tags, nobody stops for a model switch, and no tier guard runs. The progress file and the plan remain the memory between sessions, and numbers in evidence still come only from scripts.

**Two sessions, switched by hand (when no sidekick is available).** A plan whose steps alternate between judgment and execution tags every step `[HIGH]` (reasoning) or `[LOW]` (execution), and the two tiers hand off through the progress file, not through conversation:

- **`PROGRESS.md` carries a `TIER` field** beside the plan, part and step. It names the tier that owns the next step. Whoever finishes a step writes the next step's tier, prints exactly `>>> SWITCH TO LOW <<<` or `>>> SWITCH TO HIGH <<<`, and ends the turn. The owner switches the model and says "continue".
- **A tier switch is a hard stop.** Before starting any step, the session compares the step's tag with `TIER`. If they differ, it writes the step's tier, prints the switch line and stops - it never starts the step in the same turn, and never chains a step of the other tier because the owner said "continue". If the tier the owner announces does not match the file, the session says so instead of working. A hand-off that is skipped once is skipped silently, because the model that skipped it is the one that would have noticed.
- **The boundary is mechanical, not a convention.** A tier guard runs before every commit and fails when `TIER` is `LOW` and any changed path is one the reasoning tier authors: tests, specs, API data, sample data, roster and icon data, `notes.md`, constitution docs, decision records, plan files. The execution tier may run, regenerate, commit and push; it may not author a decision, a test, a spec value, a fidelity classification or a numeric evidence value. Proof that the guard fires (a planted forbidden file rejected under `LOW`) is recorded before the guard is trusted.
- **The reasoning tier reads a fixed briefing pack**, named in the plan: the decision record, the rows it is working on, the authoring guide, the behavior reference, one exemplar, the current defects list and the latest contact sheet. Never raw logs, never plan history, never the progress file beyond its header. What it needs to know is put into those files by the execution tier; the execution tier's numbers are written by scripts, never typed.
- **Existing workflows are execution-tier work even inside a reasoning-tier plan.** Module audits, publishes, documentation propagation, clean installs and CI watching run on the execution tier through the workflows written for them; the plan marks them `[LOW]` and the reasoning tier does not spend its context on them.

## Token Discipline Within a Session

Rules that hold for both tiers, hardest-won first:

- **Batch before acting.** Run the complete detection pass once, collect all findings, then fix file by file with one edit call each. Alternating detect-fix-detect multiplies calls against a growing context.
- **Blocking calls for short commands.** Any command expected under half a minute runs blocking: one call, no polling round-trips. Non-blocking with status polls is reserved for genuinely long jobs.
- **One combined sweep command** per target, with labeled sections, instead of one command per pattern.
- **Read with intent.** The reasoning tier reads sections and greps first, whole files only when authoring against them. The execution tier reads whole files when its workflow demands it, and that demand stays in the workflow.
- **Parallelize independent calls.** Independent reads and searches go in one batch, not sequential turns.
- **Broad retrieval at most once per session**, with a narrow question. Repeated exploratory searches over a known codebase are targeted reads that lost their way.
