# Extending to a Language

Superloom's principles layer is a contract that any language can implement. This document is the procedure for adding a language layer: what must be answered, in what order, and how to do it without touching the core. It covers both paths: authoring an implementation from scratch, and deriving one from an existing mature codebase whose conventions a team already trusts.

## On This Page

- [What an Implementation Is](#what-an-implementation-is)
- [The Contract to Answer](#the-contract-to-answer)
- [Path One: Authoring from Scratch](#path-one-authoring-from-scratch)
- [Path Two: Deriving from an Existing Codebase](#path-two-deriving-from-an-existing-codebase)
- [Repository and Naming Conventions](#repository-and-naming-conventions)
- [What Never Changes](#what-never-changes)
- [Forking and Re-Opinionating](#forking-and-re-opinionating)

---

## What an Implementation Is

A language implementation is a directory `docs/languages/[lang]/` containing that language's complete, self-sufficient answer to every principles document, plus a module repository (`[lang]-helper-modules`) whose code demonstrates every answer. The JavaScript layer is the reference: its structure is the template for every subsequent language.

An implementation is complete when a developer fluent in the language, but new to Superloom, can build a conforming module using only `docs/languages/[lang]/` and the reference modules, without reading the principles layer or any other language's documents.

## The Contract to Answer

Each principles document poses questions a language layer must answer concretely. The core set:

| Principles document | The language layer must fix |
|---|---|
| [Code Readability](code-readability.md) | Exact blank-line counts, banner syntax and widths, comment syntax, documentation-header format, casing per identifier kind |
| [File Archetypes](file-archetypes.md) | The full archetype catalog with one complete skeleton per archetype |
| [Module Design](module-design.md) | Loader signature, companion file names, container conventions, interface slot order, package manifest rules |
| [Error Handling](error-handling.md) | Envelope field names, catalog file shape, freezing mechanism, error prefix format |
| [Validation](validation.md) | Validator file shape, injection signature, verdict format |
| [Testing](testing.md) | Runner and assertion choice, suite layout, loader pattern, emulator lifecycle wiring |
| [Versioning and Releases](versioning-and-releases.md) | Registry, pipeline implementation, bump procedure, range syntax |
| [Third-Party Libraries](third-party-libraries.md) | The dependency-free baseline for the language and the accepted exceptions |

Every answer follows the same document pattern: open by naming the principle implemented, restate it in one line, then dictate the language's way completely. Where the language forces a deviation from a principle (a runtime constraint, an ecosystem reality), the deviation is stated explicitly with its reason, in the language document, at the point of deviation.

## Path One: Authoring from Scratch

1. **Read the principles layer end to end.** Every document, in full. The implementation must answer all of it, and gaps discovered late force rework.
2. **Fix the archetype catalog first.** Archetypes drive everything else: once the file shapes exist, formatting, module structure, and testing rules have concrete objects to attach to.
3. **Write the skeletons before the prose.** A skeleton forces every undecided detail to the surface. Prose written first hides gaps behind generality.
4. **Build the first foundation module against the skeletons.** The first real module is the trial of the whole layer. Every friction point found while building it is a documentation defect; fix the documents, not just the module.
5. **Wire the pipeline.** Registry, test-then-publish automation, and the pre-publish gate, per [Versioning and Releases](versioning-and-releases.md).
6. **Add the implementations table rows.** One row per principles document, linking to the new layer. This is the only edit the core receives.

## Path Two: Deriving from an Existing Codebase

A team with a mature codebase in the target language already has opinions that work. The task is extraction and mapping, not invention, and it is well suited to an AI agent working under review:

1. **Give the agent the principles layer and the codebase.** The instruction: for each principles document, locate how this codebase answers it.
2. **Extract the observed conventions.** File shapes that recur become archetype candidates; the error style, test layout, and dependency posture become the draft answers. The agent cites real files as evidence for every extracted convention.
3. **Map gaps and conflicts.** Where the codebase has no answer, the principles default stands and the layer says so. Where the codebase contradicts a principle, the team decides deliberately: adopt the principle, or record a reasoned deviation in the language document.
4. **Write the layer in the standard document pattern**, then validate it the same way as path one: build or retrofit one module to full conformance using only the new documents.

The result is a language layer that codifies what the team already does, normalized into the Superloom structure, with every deviation deliberate and written down.

## Repository and Naming Conventions

| Artifact | Pattern | Example |
|---|---|---|
| Documentation layer | `docs/languages/[lang]/` | `docs/languages/py/` |
| Module repository | `[lang]-helper-modules` | `py-helper-modules` |
| Demo application | `[lang]-demo-project` | `py-demo-project` |
| Core module | `[lang]-helper-[name]` | `py-helper-utils` |
| Server module | `[lang]-server-helper-[name]` | `py-server-helper-sql-postgres` |
| Client module | `[lang]-[platform]-helper-[name]` | `js-client-helper-crypto` |

`[lang]` is the lowercase language identifier (`js`, `py`, `java`, `cs`, `go`). The full repository layout rules live in [`dev/org-structure.md`](../dev/org-structure.md).

## What Never Changes

A language implementation adapts syntax; it does not renegotiate the architecture. Fixed across every language:

- The layered server pattern and its dependency direction ([Server Architecture](server-architecture.md))
- The module contract: loader, companions, injection, envelope ([Module Design](module-design.md))
- The class taxonomy and its dependency rules
- The three error categories and the throw-versus-return boundary
- JSON as the universal transport
- Pipeline-only releases and semantic versioning

If an implementation cannot satisfy one of these, the finding goes to the principles layer as a proposed amendment, argued at the concept level. The core changes by deliberate amendment for everyone, never by one language quietly diverging.

## Forking and Re-Opinionating

The whole documentation is designed to be forked. A team that wants Superloom's structure but different opinions changes them in layers:

- **Different language answers** (spacing counts, naming casings, tool choices): edit the forked `languages/[lang]/` documents. The principles layer is untouched.
- **Different universal opinions** (a different validation stance, a different service layer shape): edit the forked `principles/` documents, keeping the rule-reason-example pattern so the fork's rules stay as enforceable as the originals.
- **Keep the maintenance machinery.** The derived-artifact rule, the validation workflows, and the pitfall journals ([Documentation Authoring](documentation-authoring.md)) are what keep a fork coherent after the fork; discard them and the fork decays into folklore.
