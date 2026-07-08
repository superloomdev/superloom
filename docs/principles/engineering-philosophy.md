# Engineering Philosophy

Superloom is a set of engineering convictions expressed as an enforceable house style. The framework holds one position above all others: **a codebase should look like it was written by one careful person on one calm day**, regardless of how many people, machines, or years actually produced it. Every rule in this documentation serves that position.

This document states the convictions. The documents beside it turn each conviction into concrete, checkable rules, and the `languages/` layer turns those rules into exact syntax for each implementation language.

## On This Page

- [The Five Convictions](#the-five-convictions)
- [Consistency Is the Product](#consistency-is-the-product)
- [Modularity and Decoupling](#modularity-and-decoupling)
- [Wrap Everything External](#wrap-everything-external)
- [Build Once, Run Anywhere](#build-once-run-anywhere)
- [Designed for AI-Assisted Development](#designed-for-ai-assisted-development)
- [How the Documentation Is Layered](#how-the-documentation-is-layered)
- [Language Implementations](#language-implementations)

---

## The Five Convictions

| Conviction | One-line consequence |
|---|---|
| **Consistency is the product** | Two files of the same kind are structurally identical, byte for byte where the rules reach |
| **Modules own one responsibility** | Adding or removing a feature touches a known set of files in a known order |
| **External code is always wrapped** | A third-party library is imported in exactly one place, behind an interface the project owns |
| **The same logic runs anywhere** | Business code never knows its transport, host, or vendor; only thin adapters at the edge do |
| **Structure is written for review** | Every file is organized so a human or an AI can scan it, orient in seconds, and spot what is wrong |

Each conviction has a home document where its rules live in full: [Code Readability](code-readability.md), [Module Design](module-design.md), [Third-Party Libraries](third-party-libraries.md), [Server Architecture](server-architecture.md), and [File Archetypes](file-archetypes.md).

---

## Consistency Is the Product

Most style debates are arguments between defensible options. Superloom ends the debate by picking one option and enforcing it everywhere. The value is not that the chosen option is objectively best. The value is that there is exactly one, so nothing needs to be re-decided, re-reviewed, or re-learned.

The rule: **one way to structure data, one way to inject dependencies, one way to handle errors, one way to lay out a file.** A developer who has read one module can navigate every module. An AI agent that has learned one pattern reproduces it correctly in the next file, because there is no second pattern to confuse it with.

This conviction is what makes the framework durable under high-volume AI-assisted development. Code generators drift when a codebase offers them choices. A codebase with one visible answer per question gives them nothing to drift toward.

---

## Modularity and Decoupling

The rule: **every module has one responsibility, states its dependencies explicitly, and communicates through a stable published contract.**

The reason is replaceability. A module that owns one job, receives its dependencies by injection, and speaks through a fixed interface can be rewritten, mocked, or swapped without its consumers noticing. A module that reaches into globals, imports its own dependencies ad hoc, or exposes its internals cannot.

Three rules carry the conviction:

- **Single responsibility.** A module does one job. Collections of unrelated utility functions ("kitchen sinks") are split until each piece has one reason to change.
- **Dependency injection.** A module receives its dependencies through its loader at initialization. It does not construct them, locate them, or import sibling modules directly. See [Module Design](module-design.md).
- **DRY through delegation.** Before writing a utility inline, check whether a foundation module already provides it. Application code carries business logic and integrations; reusable mechanics belong in helper modules, written once and tested once.

---

## Wrap Everything External

The rule: **third-party libraries are imported only inside designated wrapper modules. Application code consumes the wrapper, never the library.**

The reason is reversibility. A dependency confined to one file costs one edit to replace. A dependency scattered across a codebase costs a migration project. The wrapper also normalizes the library's error behavior and calling conventions into the project's own, so upstream churn stops at the wrapper boundary.

The default is stronger than wrapping: **a new module ships with zero runtime dependencies unless a strict set of criteria is met.** The criteria, the layers where third-party imports are permitted, and the mandatory README disclosure rule live in [Third-Party Libraries](third-party-libraries.md).

---

## Build Once, Run Anywhere

The rule: **business logic is written once and runs unchanged in every deployment target. Only the adapter at the edge changes.**

In the current JavaScript implementation, the same services run behind Express in a Docker container and behind AWS Lambda handlers, with no branching inside business code. The pattern generalizes: any host, any transport, any vendor is an adapter concern.

Two supporting rules:

- **JSON is the universal transport.** All internal and external data shapes are plain JSON. No serialization format that ties data to a language or vendor.
- **Configuration is data, not objects.** Config files carry plain values. Live objects (clients, drivers, connections) arrive through dependency injection, never through configuration keys.

The architecture itself is language-independent. The interface, controller, service, and model separation described in [Server Architecture](server-architecture.md) is a pattern, not a language feature. The same structure applies whether the implementation is JavaScript, Python, Java, or C#.

---

## Designed for AI-Assisted Development

Superloom treats AI agents as a permanent audience, equal in standing to human developers. This changes how code and documentation are written:

- **Predictable structure over cleverness.** An agent trained on one Superloom file generates the next one correctly. Novel structures force it to guess.
- **Explicit contracts over convention-by-folklore.** Every rule an agent needs is written down, in a file it can read. Nothing load-bearing lives only in a maintainer's head.
- **Review-oriented formatting.** Section banners, step comments, and strict vertical rhythm exist so a reviewer can audit AI-generated code quickly. See [Code Readability](code-readability.md).
- **A dedicated AI documentation layer.** Agent configuration, workflow authoring, and model-tiering standards live in [`docs/ai/`](../ai/index.md).

---

## How the Documentation Is Layered

The documentation has three layers, separated by how the content varies:

| Layer | Location | Varies by | Audience |
|---|---|---|---|
| **Principles** | `docs/principles/` | Never; universal rules and their reasoning | Architects, evaluators, language extenders |
| **Language implementations** | `docs/languages/[lang]/` | Per language; exact syntax, spacing, tooling | Developers writing code |
| **AI-assisted development** | `docs/ai/` | Per tooling generation; agent config and workflow standards | Developers using AI agents, and the agents themselves |

A developer working in one language reads that language's layer and nothing else; each language document is complete on its own. The principles layer exists for decisions that outlive any single language, and it is the contract a new language implementation must answer. The extension procedure lives in [Extending to a Language](extending-to-a-language.md).

---

## Language Implementations

| Language | Entry point | Status |
|---|---|---|
| JavaScript | [`languages/js/index.md`](../languages/js/index.md) | Reference implementation |
