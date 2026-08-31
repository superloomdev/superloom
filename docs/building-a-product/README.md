# Building a Product From Zero

How a new product goes from an idea in a person's head to a designed, reviewed, buildable system. This
document describes the **process**, not any particular product. It is written for an AI assistant
starting greenfield work with a person who has domain intent but has not yet been asked the right
questions, and for the person checking that the process is being followed rather than improvised.

## On This Page

- [Why This Exists](#why-this-exists)
- [The Governing Principle](#the-governing-principle)
- [The Five Phases](#the-five-phases)
- [Phase 1: Establish Identity](#phase-1-establish-identity)
- [Phase 2: Offer Alternatives With Costs](#phase-2-offer-alternatives-with-costs)
- [Phase 3: Ask The Invalidating Questions](#phase-3-ask-the-invalidating-questions)
- [Phase 4: Top-Level Architecture, Then Drill](#phase-4-top-level-architecture-then-drill)
  - [Step 1: Produce a top-level shape, quickly and cheaply](#step-1-produce-a-top-level-shape-quickly-and-cheaply)
  - [Step 2: Decompose into areas ordered by constraint](#step-2-decompose-into-areas-ordered-by-constraint)
  - [Step 3: For each area, questions first, then draft](#step-3-for-each-area-questions-first-then-draft)
  - [Step 4: Reconcile in both directions](#step-4-reconcile-in-both-directions)
  - [Step 5: Record risk, not just decisions](#step-5-record-risk-not-just-decisions)
- [Phase 5: Build Module By Module](#phase-5-build-module-by-module)
- [Eliciting A Decision](#eliciting-a-decision)
- [Failure Modes And The Rules They Produced](#failure-modes-and-the-rules-they-produced)
- [Artifacts](#artifacts)
- [Further Reading](#further-reading)

---
## Why This Exists

An assistant asked to build a product will, by default, start writing. It will infer a domain, assume a
data model, and produce something large and confident. The output looks like progress and is frequently
unreviewable, which means its errors are discovered during implementation rather than during design.

The cure is not more care while writing. It is a process that forces the expensive questions to the
front and keeps every deliverable small enough to actually be checked.

This document is that process, recorded so it does not have to be rediscovered on the next product.

---

## The Governing Principle

> **The size of a deliverable must match the size of the review the work can actually receive.**

A specification nobody can read is not a specification. It is a draft carrying unearned confidence,
and confident phrasing is indistinguishable from a settled decision to a later reader.

Two corollaries follow, and both are easy to violate:

1. **Front-loading questions does not license unreviewed volume.** Four questions answered at the start
   do not authorize three hundred decisions taken afterwards. Questions bound the space; they do not
   approve what fills it.
2. **An assistant's default register is declarative.** Prose that reads as settled gets reviewed as
   settled. A proposal must be marked as a proposal *in the text*, not merely in the author's intent.

---

## The Five Phases

| Phase | Produces | Gate before moving on |
|---|---|---|
| 1. Identity | What the product is, who it serves, what binds it together | The person confirms the domain and its constraints |
| 2. Alternatives | A scored comparison when a foundational choice is reopened | The person selects, having seen each option's cost |
| 3. Invalidating questions | Answers to the few decisions that would force a rewrite | Every such decision is answered, not assumed |
| 4. Architecture | A top-level shape, then each area drilled and reviewed in turn | Each area is signed off individually |
| 5. Build | Working software, area by area | Each area's gate is green before the next starts |

Phases 1 to 3 are cheap and fast. Phase 4 is where most of the calendar time goes and is where the
process earns its value.

---

## Phase 1: Establish Identity

**Do this before anything else.** Without a stated product, every later step invents its own
requirement, and "done" becomes undefinable. Component work can be judged against a contract;
application work cannot be judged against nothing.

**Ask before proposing.** There may be industries, prior engagements, or vocabulary that are off limits
for reasons an assistant cannot infer. Surfacing those constraints as an explicit question costs one
exchange. Discovering them after the product documents are written costs a full rewrite.

Ask at minimum:

- Are there domains, industries, or sources of vocabulary that must be avoided, and why
- Is this one application or several sharing a core
- Who are the distinct audiences, and does one person ever occupy two of those roles

**Produce** the fixed artifact set in [`../principles/project-management.md`](../principles/project-management.md).
Fixed structure matters here because it can be audited rather than admired.

**Leave unsettled sections explicitly unsettled.** A section filled in speculatively is worse than one
marked as pending, because a later reader cannot tell the two apart. Name the area that will settle it.

---

## Phase 2: Offer Alternatives With Costs

When a foundational choice is open or reopened, the job is not to propose one answer. It is to generate
several and score each against the constraints already settled.

**A recommendation is only useful with its cost attached.** State the trade-off, not just the pitch. The
most valuable sentence available is often "this option clears every bar and teaches you nothing new,"
because it lets the person choose on grounds the assistant cannot weigh for them.

**Apply a stated test consistently.** A useful one for scope decisions:

> Does answering this the expensive way exercise a capability that the cheap way leaves untested?

If the answer is no, the expensive option is cut regardless of how much more correct it looks. Write the
test down, then check your own recommendations against it before presenting them.

---

## Phase 3: Ask The Invalidating Questions

Before writing anything large, identify the decisions whose answers would force a rewrite, and ask only
those. The filter is mechanical:

| Question type | Ask before drafting? | Why |
|---|---|---|
| Adds or removes an entity, service, or deployable | **Yes** | Cannot be edited into an existing draft; the draft has to be rebuilt |
| Changes a field, a limit, an enum, or a name | No | Can be answered against a draft and edited in place |

**When a new instruction contradicts a settled decision, name the contradiction and make the person
choose.** Never resolve it silently in either direction. Silently honoring the new instruction discards
a decision that had reasons; silently honoring the old one ignores the person.

---

## Phase 4: Top-Level Architecture, Then Drill

This is the phase the governing principle exists to protect.

### Step 1: Produce a top-level shape, quickly and cheaply

An assistant is good at generating a broad first-pass architecture. Let it. The output is valuable as a
**source of candidate answers** and as a map of what needs deciding. It is not a design.

Treat it explicitly as a draft input. It is demoted the moment the drilling starts, and where it
disagrees with a reviewed area, the reviewed area wins.

### Step 2: Decompose into areas ordered by constraint

Split the architecture into areas and order them so each constrains the ones below it. Data shape
decides storage; storage decides service boundaries; boundaries decide the interface surface.

**Order matters more than it appears.** Reopening the first area after the fifth is settled means
re-reviewing everything between, so an area is never left half agreed.

**Do not draft a later area while an earlier one is open**, even though later areas are often more
concrete and feel more productive. The dependency runs one way. A later area drafted against unsettled
foundations is rework, not progress. Where a later concern genuinely bears on an earlier decision,
record it as an open question in the earlier area.

### Step 3: For each area, questions first, then draft

For every area, in order:

1. **Write the open-question list before writing any design.** This is the artifact that makes gaps
   visible instead of letting them become silent assumptions.
2. **Separate the questions that change the structure from those that change details.** Ask the
   structural ones and wait.
3. **Draft the area** once those are answered, with every remaining question answered as a clearly
   marked proposal carrying a confidence level.
4. **Publish confidence per proposal, and name the weakest one.** This directs limited review attention
   at the weakest link instead of spreading it evenly.
5. **Get sign-off, then move on.**

### Step 4: Reconcile in both directions

Before declaring an area settled, check it against the neighboring artifacts in both directions. An
entity list checked against a schema and an interface surface catches things that are *used but never
declared*, a class of gap that a schema-first or interface-first pass misses structurally.

Do this as an explicit step. It is mechanical and it reliably finds real omissions.

### Step 5: Record risk, not just decisions

When the cheaper option is chosen over the more correct one, **state the accepted risk and attach a
mitigation that costs nothing today.** This converts a silent liability into a known one, and it
usually confines a future retrofit to one area instead of letting it spread.

Do not re-argue a decision the person has made. Record it, bound it, move on.

---

## Phase 5: Build Module By Module

Implementation follows the same discipline as design: one area at a time, each with a gate that must be
green before the next starts. Existing framework documentation governs the mechanics of the work itself,
including [`../dev/planning.md`](../dev/planning.md) for tracking and
[`../dev/autonomous-execution.md`](../dev/autonomous-execution.md) for unattended runs.

The only addition this document makes: **the architecture is the contract.** Code is written against the
settled architecture documents, and a disagreement between code and architecture is resolved by
correcting one of them deliberately, never by letting them drift.

---

## Eliciting A Decision

The quality of a greenfield design is bounded by the quality of the questions asked. Practices that
work:

- **Two to four questions at a time.** More than that and answers get rushed or skipped.
- **Every option carries its cost**, not only its benefit.
- **Mark your own recommendation**, and say why.
- **Include the option you expect to be rejected** when it is genuinely defensible. It calibrates the
  others.
- **Never present a settled decision as an open question.** It wastes attention and implies the record
  is unreliable.
- **When overruled, re-audit the recommendation rather than defending it.** If the person's choice is
  better, record *why the recommendation was wrong*. That is more useful to a future run than the
  decision itself, and it is frequently a case of a stated test applied inconsistently.

---

## Failure Modes And The Rules They Produced

Each row is an observed failure, not a hypothetical.

| Failure | Rule produced |
|---|---|
| A domain was proposed, accepted, and fully documented before a binding constraint on domains surfaced | Ask for domain constraints before proposing a domain |
| A single very large specification was produced covering every layer at once. It could not be reviewed, so its decisions were approved wholesale | Match deliverable size to reviewable size. Decompose by area with a gate on each |
| Several positions in that specification were assumptions never examined, and read as decisions because the prose was declarative | Mark proposals as proposals in the text. Track which positions were examined and which were inherited |
| Entities were used throughout a specification without ever being declared. Each had storage and an interface, but no definition | Reconcile the entity list against the schema and the interface list in both directions, as an explicit step |
| Two fields could both express a capacity limit, with no stated reconciliation | Prefer removing a competing source of truth over reconciling two. One value cannot disagree with itself |
| A design artifact intended to outlive the work was placed in an uncommitted scratch location | Anything meant to outlive the work is versioned with the code from the start |
| A recommendation was made that contradicted a scope test the same author had written down one paragraph earlier | Check your own recommendations against your own stated tests before presenting them |

---

## Artifacts

| Artifact | Lives | Purpose |
|---|---|---|
| Product management set | Product repository root | What the product is. Structure fixed by [`../principles/project-management.md`](../principles/project-management.md) |
| Architecture areas | Product repository, versioned | The design. One directory per area, reviewed and signed off individually |
| Decision log | Product management set | Every foundational decision, its alternatives, and its reasoning |
| Open questions | Inside each architecture area | Gaps made visible. Empty is a statement; absent is an oversight |
| Top-level first-pass draft | Outside the product repository | Candidate answers. Demoted once drilling begins |

Each architecture area carries three files split by audience, and may carry an optional appendix holding
context that is implicit to an experienced reader and must be explicit for an automated one. That
appendix may never be the sole home of a requirement: the test is that deleting every such appendix
loses no requirement, only speed.

---

## Further Reading

- [Project Management](../principles/project-management.md) - the product artifact set and its fixed structure
- [Planning System](../dev/planning.md) - tracking work across sessions
- [Documentation Authoring](../principles/documentation-authoring.md) - prose mechanics and size budgets
- [Engineering Philosophy](../principles/engineering-philosophy.md) - including the rule that a settled question is not answered twice
