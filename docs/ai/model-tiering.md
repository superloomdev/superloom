# Model Tiering

AI-assisted development runs on models of very different cost and capability, and the cost structure is unforgiving: every tool call re-sends the accumulated conversation, so total cost compounds as calls multiplied by context size. Model tiering is the discipline of assigning each kind of work to the cheapest tier that does it correctly, with plan files as the interface between tiers. The framework's own experience is the proof: a well-authored workflow executes with full precision on an inexpensive model, because the precision lives in the workflow, not the model.

## On This Page

- [The Two Tiers](#the-two-tiers)
- [The Division of Labor](#the-division-of-labor)
- [Plans as the Interface](#plans-as-the-interface)
- [Session Discipline](#session-discipline)
- [Token Discipline Within a Session](#token-discipline-within-a-session)

---

## The Two Tiers

| Tier | Character | Paid for |
|---|---|---|
| **Reasoning tier** | The most capable model available | Judgment: resolving contradictions, designing standards, authoring documents and workflows, deciding what correct means |
| **Execution tier** | The least expensive model that follows procedures reliably | Throughput: running workflows, sweeps, full-file verification reads, commits, pipeline watching |

The boundary is judgment. Work whose steps are already written belongs to the execution tier no matter how important it is; work that requires deciding among defensible options belongs to the reasoning tier no matter how small it looks. Importance is not the criterion. Ambiguity is.

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

## Token Discipline Within a Session

Rules that hold for both tiers, hardest-won first:

- **Batch before acting.** Run the complete detection pass once, collect all findings, then fix file by file with one edit call each. Alternating detect-fix-detect multiplies calls against a growing context.
- **Blocking calls for short commands.** Any command expected under half a minute runs blocking: one call, no polling round-trips. Non-blocking with status polls is reserved for genuinely long jobs.
- **One combined sweep command** per target, with labeled sections, instead of one command per pattern.
- **Read with intent.** The reasoning tier reads sections and greps first, whole files only when authoring against them. The execution tier reads whole files when its workflow demands it, and that demand stays in the workflow.
- **Parallelize independent calls.** Independent reads and searches go in one batch, not sequential turns.
- **Broad retrieval at most once per session**, with a narrow question. Repeated exploratory searches over a known codebase are targeted reads that lost their way.
