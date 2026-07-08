# Code Readability

Code in this framework is formatted for the person scrolling it, not the person typing it. A source file is read tens of times for every time it is edited, and in AI-assisted development most files arrive generated rather than typed. The formatting rules exist to make fast, confident review possible: a reader should orient inside any file in seconds and detect a structural mistake by eye before reading a single expression.

This document states the universal readability rules. Exact counts, banner widths, and comment syntax per language live in the `languages/` layer.

## On This Page

- [The Scanning Model](#the-scanning-model)
- [Vertical Rhythm](#vertical-rhythm)
- [Section Banners](#section-banners)
- [Public and Private Grouping](#public-and-private-grouping)
- [Step Comments](#step-comments)
- [Function Documentation Headers](#function-documentation-headers)
- [Naming](#naming)
- [Prose Quality in Code](#prose-quality-in-code)
- [Language Implementations](#language-implementations)

---

## The Scanning Model

The rules below share one mental model: **a reader scrolls a file at speed and stops only where something matters.** Every formatting decision either creates a reliable stopping cue or removes visual noise between cues.

Three cue levels, from coarse to fine:

1. **Section banners** mark the major regions of a file (loader, public surface, private surface). A reader jumps between them without reading anything else.
2. **Vertical spacing** distinguishes boundaries by blank-line count alone: more space means a bigger boundary. A reader perceives structure peripherally, without reading.
3. **Step comments** narrate the logic inside a function, one line per logical block. A reader follows the algorithm by reading only the comments, then descends into code where needed.

A file formatted this way is skimmable at three speeds: banners only (what is this file), comments only (what does this function do), full code (is it correct). Each speed is useful; the formatting keeps all three honest.

---

## Vertical Rhythm

The rule: **blank-line counts are a strict hierarchy, applied identically in every file.** The bigger the structural boundary, the more blank lines. Nothing else about spacing is left to taste.

The universal hierarchy has three levels:

| Boundary | Relative spacing |
|---|---|
| Between major sections of a file | Largest |
| Between function definitions | Middle |
| Between logical blocks inside a function | Smallest |

The reason: spacing that varies by author carries no information; spacing that follows a fixed hierarchy is a structural signal a reader processes without conscious effort. When the same counts appear in every file, a violation is visible at a glance, and a reviewer who sees an unusual gap knows something structural is wrong.

Each language implementation fixes the exact counts (JavaScript uses 3/2/1) and the edge cases (spacing around control-flow blocks, after early returns, inside object literals).

---

## Section Banners

The rule: **the major regions of a file are wrapped in high-visibility START and END banner comments, few in number and identical in shape across every file.**

A banner is a full-width comment line naming the region: module loader, public functions, private functions, exports. Sections are large and few; a file should not carry more than four or five banners. Their value is as scroll anchors: a reader moving fast through an unfamiliar file uses them exactly the way a book reader uses chapter headings.

Two rules keep banners useful:

- **Identical shape everywhere.** Same width, same wording pattern, same placement, in every file of the same archetype. A banner that varies is a banner that must be read instead of recognized.
- **Banners divide, they do not decorate.** A banner exists only where a genuine structural region begins or ends. Decorative banners dilute the signal.

---

## Public and Private Grouping

The rule: **all public functions live together in one region, all private functions in another. The two regions never interleave.**

The public region is the module's contract; the private region is its machinery. Keeping them physically separated means a reader auditing the API surface reads one contiguous region, and a reader tracing an implementation detail knows exactly where to look.

Within each region, related functions are grouped under second-level section headers when the region grows beyond a handful of functions. The grouping criterion is responsibility, not alphabet.

---

## Step Comments

The rule: **every logical block inside a function is preceded by a one-line comment stating what the next few lines do.** No bare block of code without a narrating comment above it.

This is the most opinionated rule in the framework, and the most defended. The reasons:

- **Comments are the medium-speed reading layer.** A reader who follows only the step comments gets the full algorithm without parsing a line of code. This is the layer most reviewers actually use.
- **Comments are drift detectors.** When a change makes a comment wrong, the mismatch is visible in review. A wrong comment next to right code, or right comment next to wrong code, is precisely the class of error AI-generated changes introduce.
- **Comments force decomposition.** A block that cannot be described in one line is two blocks. The rule pushes functions toward small, nameable steps.

Step comments state *what and why*, never *how*: the code already says how. They also never reference internal documentation paths; a comment must be understandable with the file alone.

---

## Function Documentation Headers

The rule: **every public function carries a structured documentation header naming its purpose, parameters, and return shape.**

The header answers "what does this function expect, and what does it give back" without the reader entering the body. Combined with a consistent return envelope (see [Error Handling](error-handling.md)), the header makes every public function auditable from its signature block alone.

Headers follow the language's native documentation convention (JSDoc in JavaScript, docstrings in Python) with the framework's fixed field order. Private functions carry headers at the same standard; the surface being internal does not lower the bar.

---

## Naming

The rule: **names are chosen for the reader who arrives with no context.** Full words over abbreviations, specific over generic, one term per concept across the whole codebase.

- Functions are verbs or verb phrases stating what they do (`createSession`, `validateConfig`), not what they are (`sessionHelper`, `configUtil`).
- A concept keeps one name everywhere. If the documentation calls it a loader, no file calls it a bootstrapper.
- Casing conventions per identifier kind (functions, constants, config keys, files) are fixed per language and never mixed within one.

---

## Prose Quality in Code

Comments, error messages, and documentation strings are prose, and carry the same standards as the documentation: American English spelling, plain declarative sentences, no filler vocabulary, standard hyphens rather than em dashes. The full writing contract is in [Documentation Authoring](documentation-authoring.md); it applies inside source files too.

---

## Language Implementations

| Language | Document |
|---|---|
| JavaScript | [`languages/js/code-formatting.md`](../languages/js/code-formatting.md) |
