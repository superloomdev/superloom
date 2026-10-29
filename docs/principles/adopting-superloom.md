# Adopting Superloom

How any project, in any language or platform, absorbs Superloom's engineering principles into its own documents and then continues without Superloom. Adoption is the use mode of this repository: the folder is added to another project's workspace, the agent translates the principles into that project's idiom, verifies the result stands alone, and the folder is removed.

## On This Page

- [What Adoption Is](#what-adoption-is)
- [What Carries Over Unchanged](#what-carries-over-unchanged)
- [What Gets Translated](#what-gets-translated)
- [Native First](#native-first)
- [The Adopted Layout](#the-adopted-layout)
- [Two Registers of Writing](#two-registers-of-writing)
- [Licensing and Clean-Room Work](#licensing-and-clean-room-work)
- [Credit, Git, and Attribution](#credit-git-and-attribution)
- [The Detach Test](#the-detach-test)
- [Refreshing an Adopted Project](#refreshing-an-adopted-project)
- [Starting a New Project](#starting-a-new-project)

---
## What Adoption Is

> **An adopting project keeps its own complete copy of the principles, rewritten in its own platform's idiom. After adoption it never reads Superloom again.**

A project relates to Superloom in exactly one of two ways:

| Relationship | Lives where | Reads Superloom docs | Carries its own principles |
|---|---|---|---|
| Dependent repository | Beside the constitution, in the Superloom workspace | Yes, continuously | No; a small repo-local `AGENTS.md` only ([Repository Independence](../ai/agent-configuration.md#repository-independence)) |
| Adopted project | Anywhere; Superloom is present only during adoption or refresh | Only during adoption or refresh | Yes; the full translated set |

Adoption is the [Forking and Re-Opinionating](extending-to-a-language.md#forking-and-re-opinionating) path applied to one project rather than to the whole documentation. The reason it exists: a principle that lives only in an external folder stops being in force the moment the folder is gone, and a project that will outlive its first author cannot depend on a workspace arrangement.

## What Carries Over Unchanged

These are concept-level rules. The adopted documents restate each one in their own words, with the reason, and never renegotiate it:

| Principle | Source |
|---|---|
| Consistency is the product; one way per question | [Engineering Philosophy](engineering-philosophy.md) |
| Before inventing, search the settled conventions registry | [Engineering Philosophy](engineering-philosophy.md#before-inventing-search) |
| Platform and third-party APIs sit behind project-owned interfaces | [Composition and Adapters](composition-and-adapters.md) |
| One responsibility per module; one composition root wires everything once | [Module Design](module-design.md) |
| Every file kind has a normative skeleton; conformance is checked element by element | [File Archetypes](file-archetypes.md) |
| Three error categories with three disposals; frozen error catalogs | [Error Handling](error-handling.md) |
| Fakes over real system calls in tests; assertions pin exact values | [Testing](testing.md) |
| Rule, reason, example; derived artifacts are compiled, never edited; pitfall journals | [Documentation Authoring](documentation-authoring.md) |
| Workflows carry hard gates, evidence, convergence, fixed order, self-improvement | [Workflow Authoring](../ai/workflow-authoring.md) |
| Cheapest correct model tier per kind of work | [Model Tiering](../ai/model-tiering.md) |
| Conventional Commits, SemVer, no AI attribution | [Versioning and Releases](versioning-and-releases.md), [Agent Configuration](../ai/agent-configuration.md#commit-and-attribution-policy) |

## What Gets Translated

> **The platform owner's official guidelines decide syntax and style. Superloom's JavaScript layer is a worked example of answering the principles, never a style to transplant.**

Each row below is a question the adopted platform layer answers concretely, the same contract a language layer answers in [Extending to a Language](extending-to-a-language.md#the-contract-to-answer):

| Superloom answer in JavaScript | The adopted layer fixes |
|---|---|
| 3/2/1 blank-line spacing, banner comments | The platform's own spacing and section markers, as its official formatter and IDE assume |
| Verb catalog and return shapes | A verb catalog expressed in the platform's naming guidelines, with banned placeholder names |
| Success and error envelopes | The platform's error idiom (typed errors, result types) mapped onto the three categories |
| Loader and `shared_libs` injection | The platform's dependency injection at one composition root |
| `node --test`, ESLint | The platform's test framework, linter and formatter, with the commands in `AGENTS.md` |
| Module companions (config, errors, validators) | The file archetype catalog for the platform, one skeleton each |

Every adaptation is written down at its point of use with its reason. The reason: an unrecorded adaptation looks like drift to the next agent, which "fixes" it back toward the JavaScript example.

Example: a Swift project replaces the 3/2/1 counts with one blank line between members plus `// MARK: -` sections in a fixed order, because Xcode's navigator and the standard formatter are built around that shape. The adopted code-shape document states the substitution and the reason in one line.

## Native First

> **A platform application uses the platform's own components, materials and accessibility services before any custom construction.**

- **System components first.** A custom control is justified only by a written gap in the system set.
- **New platform materials through one owned factory.** Availability checks live in one place with a graceful fallback for older systems and for accessibility settings. Callers never branch on system version.
- **Accessibility is part of done.** Screen reader labels on every control, full keyboard operation, respect for reduced motion, reduced transparency, increased contrast and text scaling, and no state carried by color alone. Each changed screen is checked with the platform's screen reader and inspector.
- **Unverified platform claims are marked unverified.** A behavior the official documentation does not state is recorded as a hypothesis until a test or a run proves it.

The reason: native components carry the performance, accessibility and future visual updates the platform owner ships. Custom construction forfeits all three silently.

## The Adopted Layout

The adopted project receives this set. Names are fixed so every adopted project is navigable the same way:

| Path | Audience | Holds |
|---|---|---|
| `AGENTS.md` | AI | Session block, code words, hard rules, commands, document map. Target 200 lines, hard ceiling 300 |
| `CLAUDE.md` and tool folders | AI | One-line pointer to `AGENTS.md`; tool skill folders are symlinks to `.agents/skills/` |
| `.agents/skills/` | AI | Canonical project workflows, tool-neutral, including a conformance audit |
| `docs/principles/` | AI | The universal rules restated in the project's words |
| `docs/platform/` | AI | The platform's way: code shape and skeletons, naming, UI, packaging, new-project bootstrap |
| `docs/conventions.md` | AI | The settled-answers registry |
| `docs/references.md` | AI | Inspiration log, permissive licenses only |
| `docs/ai/` | AI | Agent operation: read path, cheap scan order, model vocabulary, hand-off rules, tool configuration |
| `docs/plans/` | AI | The code migration plan and later plans |
| `README.md`, `CONTRIBUTING.md`, `LICENSE` | Human | What the project is, how to contribute, the credit line |

A project that already has documents keeps them; adoption maps them into this layout and records the mapping in the digest.

## Two Registers of Writing

| Register | Where | Style |
|---|---|---|
| Agent-facing | `AGENTS.md`, `docs/`, skills | Flight-manual English: short declarative lines, tables over prose, one term per concept, no filler |
| Human-facing | Code comments, `README.md`, `CONTRIBUTING.md`, user interface copy | Plain complete English, no abbreviations, readable by a developer with no agent |

The reason: agent documents are read on every session and their length is a recurring cost; code is read by humans who inherit the project and must not need an agent to understand it.

## Licensing and Clean-Room Work

> **Learn from anything; copy only from permissively licensed sources, with attribution; name no non-permissive project anywhere in the repository.**

- **Industry-standard patterns are free.** A pattern present across many independent products is common practice, not anyone's expression.
- **Permissive sources** (MIT, BSD, Apache 2.0) may be referenced in `docs/references.md` with their license.
- **Non-permissive sources** are studied, if at all, outside the repository. Their names, code, assets and exact visual expression never enter it.
- **Original implementation.** Code is written from the project's own documents and the platform owner's documentation.

The reason: a single copied passage or named competitor in a public repository is a standing legal liability that no later cleanup fully removes from history.

## Credit, Git, and Attribution

- **One credit line**, in `README.md` and the principles index: `Engineering principles adapted from [superloom.dev](https://superloom.dev).` No other mention of Superloom, its paths or its modules.
- **Local Git first.** `git init` locally. No remote is added and nothing is pushed until the owner says so.
- **No AI attribution** in commits or contributor fields. Any AI tool may help; the human operator is the sole author. The adopted `AGENTS.md` carries this rule because a rule present only in Superloom is not in force in the project.

## The Detach Test

Adoption is complete only when all three checks pass:

1. **No residue.** A search of the project for the Superloom folder name, its paths and JavaScript-layer identifiers returns only the credit line. The search is first proven to fire on a planted example.
2. **Fresh start.** With Superloom removed from the workspace, a new session told `start` answers with the project's own session block and current plan.
3. **Cold feature.** A new agent asked how to add a representative feature answers from the project's documents alone, naming the module, the skeleton and the tests.

## Refreshing an Adopted Project

When Superloom is added back to an adopted project and the owner says `start`, the agent compares the project's principles with the current Superloom principles and proposes changes as a list for the owner to accept. Recorded adaptations are never overwritten. After the refresh the detach test runs again.

## Starting a New Project

When `start` is said and no other project is in the workspace, the agent offers to create one: it asks for the name and platform, runs `git init` locally, and adopts. An adopted project's own `docs/platform/` new-project bootstrap document then lets it seed further projects on the same platform without Superloom, so a family of projects keeps one house style.

> **A sibling outranks a fresh translation.** When the owner names an already-adopted project on the same platform, its platform layer, conventions, design language and agent setup are inherited first; Superloom fills only the gaps.

The reason: the sibling's platform choices were already decided, reviewed and proven in real code. Translating again from the principles would produce defensible but different answers, and two projects by one owner would drift apart in style.
