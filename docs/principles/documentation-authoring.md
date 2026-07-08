# Documentation Authoring

This is the contract for writing and maintaining Superloom documentation itself: the voice, the prose mechanics, the placement rules, and the rituals that keep eighty documents coherent over years of change. Every file under `docs/`, every module README, every agent-facing file, and every workflow follows it. It applies to prose inside source files (comments, error messages) as much as to standalone documents.

## On This Page

- [Voice](#voice)
- [The Rule, Reason, Example Pattern](#the-rule-reason-example-pattern)
- [Prose Mechanics](#prose-mechanics)
- [Banned Vocabulary](#banned-vocabulary)
- [Placement: Where Knowledge Goes](#placement-where-knowledge-goes)
- [The Three-Layer Structure](#the-three-layer-structure)
- [Derived Artifacts and the Golden Rule](#derived-artifacts-and-the-golden-rule)
- [Cross-Reference Integrity](#cross-reference-integrity)
- [Pitfall Journals](#pitfall-journals)
- [Maintenance Rituals](#maintenance-rituals)

---

## Voice

The documentation speaks as a senior practitioner dictating house style: declarative, specific, calm. It states positions and stands behind them with reasons. It does not hedge, does not sell, and does not apologize for being opinionated.

- **Prescriptive over prohibitive.** State what to do. Negative lists ("do not do X, Y, Z") are unbounded; positive rules are finite and checkable. One short "common mistake" callout is acceptable when a specific error genuinely recurs.
- **Third person for reference prose.** Describe the module, the rule, the system, not the reader. "The loader validates configuration at initialization", not "you should validate your configuration". A bare imperative is reserved for genuine command steps in a procedure.
- **Confidence with mechanism.** Every strong claim carries its reasoning in the same breath. A claim without an adjacent mechanism is marketing, and marketing is out of scope.
- **Generic over specific.** Framework rules use placeholders (`[module]`, `[entity]`, `[lang]`), never real module or project names. Specific examples belong in the specific module's own documentation.

## The Rule, Reason, Example Pattern

Every normative section follows the same internal order:

1. **The rule**, in one or two sentences, stated so a reader could enforce it without reading further.
2. **The reason**, in one short paragraph. Rules without recorded reasons get relitigated forever; the reason is what makes the rule durable.
3. **The example**, only when the rule cannot be fully understood from text, and then minimal and real.

This order is deliberate. A returning reader retrieves the rule instantly; a first-time reader continues into the reason; nobody wades through motivation to find the instruction.

## Prose Mechanics

- **Short sentences.** Roughly thirty words maximum. Split at conjunctions when a sentence grows past that.
- **Active voice.** "The module returns an error", not "an error is returned by the module".
- **No em dashes.** Not in any file, of any format. Use a comma, a period, or a plain hyphen surrounded by spaces where a break is genuinely needed. Restructure the sentence only when it reads better restructured.
- **American English.** `initialize`, `behavior`, `license`, `organization`, in prose and code alike.
- **Table cells do not end with periods.** Cells are fragments, not sentences.
- **Tables and lists over paragraphs for rules.** Prose is for reasoning; structure is for rules. One rule, one line, where possible.
- **No preamble.** Delete "this section explains", "it is important to note", and every equivalent. Start with the content.
- **No emoji, no exclamation marks, no rhetorical questions** in reference material.
- **Placeholders in prose use square brackets** (`[module]`, `[entity]`). Angle-bracket placeholders outside backticks break the site build's HTML parsing; curly braces collide with template syntax. In fenced template blocks, uppercase angle-bracket placeholders (`<PACKAGE_NAME>`) are the convention, with the block language set to plain text.
- **Code blocks contain only real comments.** Instructional labels ("correct", "wrong") live in the prose above the block, never inside it as fake comments.
- **One term per concept.** The documentation says loader, config, returns, required. It does not rotate synonyms for variety; variety in terminology is ambiguity.

## Banned Vocabulary

These words and phrases are removed on sight, not softened. They are the shared tells of machine-generated and marketing prose, and their presence undermines the authority of everything around them:

`comprehensive`, `seamless`, `robust`, `powerful`, `blazing`, `effortless`, `leverage`, `facilitate`, `battle-tested`, `cutting-edge`, `world-class`, `simply`, `easily`, `just` (as filler), `in order to`, `it is important to note`, `please note`, `feel free to`, `out of the box`, `a wide range of`.

## Placement: Where Knowledge Goes

Every piece of knowledge has exactly one canonical home. When new knowledge arrives, place it by this table:

| Kind of knowledge | Canonical home |
|---|---|
| Universal engineering rule with its reasoning | `docs/principles/[topic].md` |
| Language-specific rule, syntax, or skeleton | `docs/languages/[lang]/[topic].md` |
| AI agent configuration or workflow standard | `docs/ai/[topic].md` |
| Step-by-step task procedure for an agent | A workflow file in the relevant repository |
| Module-specific behavior and usage | That module's `README.md`, `docs/`, and `ROBOTS.md` |
| Contributor machine setup and onboarding | `docs/dev/` |
| Generic infrastructure guide | `docs/ops/[category]/[vendor-service].md` |
| Project-specific runbook step | The project's own `ops/` directory |
| A failure that was diagnosed and fixed | The pitfall journal beside the domain it belongs to |

If a piece of knowledge spans categories, split it: each piece goes to its home and the others cross-reference. If the right home is genuinely unclear, stop and decide deliberately; a rule filed in the wrong place is a rule nobody finds.

## The Three-Layer Structure

The documentation is organized in three layers, and the layering carries maintenance rules:

- **`principles/`** holds universal rules and their reasoning. A principles document never contains language-specific syntax beyond short illustrative fragments. Each principles document ends with a **Language Implementations** table linking to its per-language counterparts.
- **`languages/[lang]/`** holds one language's complete, self-sufficient implementation of the principles. Each document opens by naming the principle it implements. A developer in that language never needs the principles layer for daily work.
- **`ai/`** holds the standards for AI-assisted development: agent configuration, workflow authoring, model tiering.

**Extending a language never edits a principles file** beyond adding one row to its implementations table. This is the property that keeps the core stable while the ecosystem grows; the full procedure is in [Extending to a Language](extending-to-a-language.md).

When language treatments of one concept are structurally similar, the principles document may show short parallel fragments in tabbed code groups. When they differ structurally, each language document handles the concept its own way, and the principles document stays at the concept level. Never force parallel structure where the languages genuinely diverge.

## Derived Artifacts and the Golden Rule

Some files are **compiled from** the documentation rather than authored directly: the repository `AGENTS.md` files, and the embedded rule blocks inside workflows. For these:

> **Never edit a derived artifact directly. Change the source document, then recompile.**

Editing a derived file creates two versions of the truth, and the divergence surfaces as an agent confidently following a rule the documentation no longer states. The compile and verification workflows exist to make the correct path cheaper than the shortcut. The full mechanism is in [`ai/agent-configuration.md`](../ai/agent-configuration.md) and [`ai/workflow-authoring.md`](../ai/workflow-authoring.md).

## Cross-Reference Integrity

Whenever a rule is added, moved, renamed, or reworded:

1. Search all repositories for the old terminology and update every reference in the same change.
2. Recompile derived artifacts (agent files, embedded workflow blocks).
3. Align any code comments that quote the rule; a quoted rule matches its source verbatim.
4. Keep published heading anchors stable; external references rely on them. Renaming a published heading requires sweeping its inbound links.

## Pitfall Journals

Failures that were diagnosed and fixed are recorded in **pitfall journals**: append-only files of Symptom, Cause, Lesson entries, kept beside the domain they belong to (one journal per documentation folder that needs one).

- Journals hold the negatives; rule documents hold only positive rules. When a failure teaches a durable rule, the rule goes to its canonical document and the story stays in the journal.
- A new failure mode is journaled **before** it is fixed. The entry is cheapest to write while the diagnosis is fresh, and the discipline is what makes the same lesson never need re-learning.
- Journal entries are never rewritten for style. They are evidence, not literature.

## Maintenance Rituals

- **After any documentation change**, run the validation workflow (link integrity, terminology consistency, style checks, derived-artifact sync) before committing.
- **After changing any source a derived artifact mirrors**, run the compile workflow for that artifact in the same session.
- **Documentation changes ride with the change that caused them.** A behavior change and its documentation update are one commit, not two intentions.
