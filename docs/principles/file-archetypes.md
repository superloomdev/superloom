# File Archetypes

Every source file in a Superloom codebase belongs to a named **archetype**: a fixed file shape with a defined skeleton, section order, and set of responsibilities. Two files of the same archetype are structurally identical; only their domain content differs. This document defines the concept. Each language layer publishes the concrete skeleton for every archetype it uses.

## On This Page

- [The Concept](#the-concept)
- [Why Archetypes Work](#why-archetypes-work)
- [The Universal Archetype Set](#the-universal-archetype-set)
- [Skeletons Are the Standard](#skeletons-are-the-standard)
- [Conformance](#conformance)
- [Adding an Archetype](#adding-an-archetype)
- [Language Implementations](#language-implementations)

---

## The Concept

An archetype answers one question about a file before anyone opens it: **what shape will this file have?** A module entry file always has the same regions in the same order. An error catalog always looks like every other error catalog. A test suite opens the same way in every module.

The archetype is not a template to start from and then diverge. It is a standing contract: files of the same archetype remain structurally aligned for their entire life. When the archetype changes, every file of that archetype is brought along.

## Why Archetypes Work

**For humans:** a developer who has read one file of an archetype navigates every other instantly. The cost of learning the codebase is the number of archetypes, not the number of files. In practice this is a dozen shapes covering hundreds of files.

**For AI agents:** pattern repetition is what agents do best, and structural invention is where they fail. A codebase whose files declare their archetype gives an agent an exact target: generate a file of shape X with content Y. Review then becomes a conformance check rather than an open-ended reading.

**For review:** structural deviation is a bug signal. When a file of a known archetype has a missing section, a reordered region, or a nonstandard banner, something went wrong in the change that produced it, and the deviation is visible before any logic is read.

This is the single most transferable lesson from the framework's own history: audits that diffed files against their archetype skeleton caught real defects that rule checklists and automated linting both missed.

## The Universal Archetype Set

The specific archetypes vary by language, but every implementation covers these roles:

| Role | What the archetype holds |
|---|---|
| **Module entry** | The loader, dependency wiring, and public interface of a module |
| **Configuration** | Plain default values the module reads, each with a one-line reason |
| **Error catalog** | The module's frozen set of operational error definitions |
| **Validators** | Input and configuration validation, co-located with the module |
| **Parts** | Internal implementation units too large for the entry file |
| **Test loader** | The only file that reads the environment; builds the test dependency container |
| **Test suite** | The tests, organized one description block per function |
| **Domain model** | An entity's data shapes, builders, validation, and domain errors |
| **Controller** | A thin adapter between transport and business logic |
| **Service** | Business logic and orchestration for one entity |

A language layer may add archetypes (a store adapter, a framework extension) but may not blur two archetypes into one file: one file, one archetype, always.

## Skeletons Are the Standard

Each archetype is defined by a **skeleton**: a complete annotated file showing every region, banner, and fixed element, with placeholders where domain content goes. The skeleton is the normative artifact. Prose rules explain the skeleton; they do not replace it.

Rules for skeletons:

- **One skeleton per archetype per language**, kept in that language's documentation. There is exactly one authoritative copy.
- **Skeletons are complete files**, not fragments. Every fixed element appears, including the elements that are easy to forget (step comments in the loader, unused-but-reserved interface slots, closing banners).
- **Real modules defer to the skeleton.** When a passing, published module and the skeleton disagree, the disagreement is resolved deliberately and recorded; neither side silently wins.

## Conformance

A file conforms to its archetype when an element-by-element comparison against the skeleton finds every fixed element present, in order, in standard form. Conformance checking is a first-class review activity:

- **On creation:** a new file is generated from the skeleton, never from memory or from copying a sibling that may itself have drifted.
- **On review:** structural review means opening the skeleton beside the file and walking the elements. Linting and keyword search do not substitute; they cannot see a missing step comment or a reordered region.
- **On standard change:** when a skeleton changes, the change ships with a sweep plan covering every existing file of that archetype.

## Adding an Archetype

A new archetype is warranted when a genuinely new file role appears; it is not warranted for a variation of an existing role. Before adding one, confirm:

1. The role recurs. One file is a file; a shape earns a name when the third instance appears.
2. No existing archetype covers it with a minor, documented variation.
3. The skeleton can be written completely, including its banners, fixed slots, and section order.

The new skeleton lands in the language layer, the archetype is added to that language's catalog, and any generation workflow that produces files of the new shape embeds the skeleton.

---

## Language Implementations

| Language | Document |
|---|---|
| JavaScript | [`languages/js/module-structure.md`](../languages/js/module-structure.md) (module archetypes) and [`languages/js/server/`](../languages/js/server/model-modules.md) (application archetypes) |
