# Documentation Writing Guide

The writing-style guide every Superloom doc, README, and `ROBOTS.md` follows. Defines voice, prose mechanics, terminology, em-dash ban, table-cell rules, spelling, and placeholder syntax.

**Companion docs.** This file is the **writing-style** half of the documentation standards. The **structural** rules live in:

- [`module-categorization.md`](../modules/module-categorization.md) - the six module classes and which class each existing module belongs to.
- [`module-readme-structure.md`](../modules/module-readme-structure.md) - Universal README Sections, class-specific sections, the three-tier model (README + `docs/` + `ROBOTS.md`), and persona-based review.
- [`complex-module-docs-guide.md`](../modules/complex-module-docs-guide.md) - the deep guide for `docs/` folders in Class E feature modules.

Use this file for **how to write the words**; use the companion docs for **what sections to include**.

---

## Core Philosophy

**Documentation is for humans.** AI can generate the structure, but the words must sound like they came from a person explaining something to a colleague. Simple sentences. No fluff. No buzzwords.

**Key principles:**

- **Lead with the problem.** What does this module do, and why would someone need it?
- **Show, don't just tell.** Reference docs (`docs/`) carry copy-paste-ready, runnable examples. The README explains and carries no runnable code.
- **Consistency across modules.** Once a developer learns one module, learning the next should feel familiar.
- **Progressive disclosure.** Plain-language explanation in the README, exhaustive reference in `docs/`.

---

## Human Writing Style

### Sentence Structure

**Do:**
- "This module handles session lifecycle."
- "One Auth instance is created per actor type."
- "The token expires after 30 days."

**Don't:**
- "This module is designed to facilitate the comprehensive management of authentication sessions."
- "It is recommended that one instantiates an Auth instance for each respective actor type."
- "Upon the elapsing of a 30-day temporal window, the token will be rendered invalid."

### Active Voice

**Do:** "The module returns an error."
**Don't:** "An error is returned by the module."

### Concrete Over Abstract

**Do:** "Checks if the value is null or undefined."
**Don't:** "Performs nullity validation on the input parameter."

### Describe the Module, Not the Reader

Reference prose describes the module, the function, the value, or the config key. It does not address the reader. Recast second person into third person or a declarative statement.

| Avoid (addresses the reader) | Prefer (describes the module) |
|---|---|
| "Pick the adapter that matches your database" | "Each application selects the adapter that matches its database" |
| "Your project trusts the wrapper" | "A consuming project trusts the wrapper" |
| "You create one instance per flow" | "One factory call produces one independent instance" |

A bare imperative is allowed only for a genuine command step in a how-to, and carries no "you": "Run the cleanup on a schedule" is correct; "You should run the cleanup" is not. Integration is framed loader-first, never as an `npm install` command. See [`module-readme-structure.md`](../modules/module-readme-structure.md#section-9-adding-to-your-project).

### Confidence Without Hype

State the design stance plainly and back it with its mechanism in the same breath. A strong claim with no adjacent rationale is hype. Reference docs carry no emoji, no exclamation marks, and no rhetorical questions.

### Banned Vocabulary

These words are AI and marketing tells. They are removed, not softened.

`facilitate`, `comprehensive`, `robust`, `seamless`, `leverage`, `powerful`, `blazing`, `effortless`, `simply`, `easily`, `just` (as filler), `in order to`, `it is important to note`, `please note`, `feel free to`, `a wide range of`, `out of the box`, `battle-tested`, `cutting-edge`, `world-class`.

The word `utilize` is retained: it is established house vocabulary (`module-categorization.md` uses "the parent utilizes the adapter") and is not a tell in this codebase.

### Consistent Terminology

Use the same words across all docs:

| Concept | Use This | Not This |
|---------|----------|----------|
| Function return | returns | yields, produces, emits |
| Error handling | returns an error | throws, raises, surfaces |
| Configuration | config | configuration object, settings |
| Initialize | loader | factory, constructor |
| Required parameter | required | mandatory, compulsory |
| Optional parameter | optional | not required |

---

## Language and Spelling

All project text uses **American English**: code comments, documentation, `package.json` descriptions, commit messages, and README files.

| Pattern | Correct | Incorrect |
|---|---|---|
| **-ize not -ise** | `initialize`, `standardize`, `optimize` | `initialise`, `standardise`, `optimise` |
| **-or not -our** | `behavior`, `color`, `favor` | `behaviour`, `colour`, `favour` |
| **-ization not -isation** | `optimization`, `organization` | `optimisation`, `organisation` |
| **license** | `license` | `licence` |

The full spelling and prose-quality table lives in [`code-formatting-js.md`](../foundations/code-formatting-js.md#spelling-and-prose-quality).

---

## Punctuation and Formatting Rules

### Em Dash

Em dashes are not used in any project file: `.js`, `.md`, `package.json`, commit messages, or any other format. Use a hyphen `-` only for compound words. Use a period to end a term description in a bullet list.

| Pattern | Correct | Incorrect |
|---|---|---|
| Sentence aside | `The loader runs once. It is the only place that reads env vars.` | `The loader runs once - it is the only place that reads env vars.` |
| Bullet list item | `**Term.** Explanation sentence.` | `**Term** - explanation` |
| Compound word | `transport-agnostic`, `hand-written`, `per-entity` | `transport-agnostic` |

### Table Cell Punctuation

Do not end table cells with a period. Table cells are not sentences.

| Correct | Incorrect |
|---|---|
| `Transport-agnostic controllers and services` | `Transport-agnostic controllers and services.` |

### Code Comments in Examples

Code blocks in documentation must contain only comments that would appear in real code. Do not use code comments as doc instructions (e.g. `// Correct`, `// Do this instead`). Move all instructional labels to prose above the code block.

### Sentence Length

Keep prose sentences to approximately 30 words or fewer. Split at conjunctions (`and`, `but`, `because`, `so`) when a sentence grows beyond that. Long sentences are harder to scan and harder for AI agents to parse unambiguously.

---

## Template Placeholder Syntax

When writing template files (fill-in-the-blank READMEs, guides, or any document with placeholder values), use **angle brackets with uppercase names**:

```
<PACKAGE_NAME>
<ONE_SENTENCE_DESCRIPTION>
<DRIVER_MODULE>
```

Do not use curly braces `{PLACEHOLDER}` - VitePress parses them as Vue template expressions and will crash when building the documentation site.

| Correct | Incorrect |
|---|---|
| `<PACKAGE_NAME>` | `{PACKAGE_NAME}` |
| `<ONE_SENTENCE_DESCRIPTION>` | `{ONE_SENTENCE_DESCRIPTION}` |
| `<VERSION>` | `{VERSION}` |

This convention also matches the standard placeholder syntax used in CLI documentation, RFCs, and man pages, so readers recognize fill-in slots immediately.

---

## Common Writing Mistakes

1. **Starting with implementation details.** Lead with purpose, not mechanics.
2. **Writing for yourself.** The reader doesn't know your design decisions.
3. **Skipping the "why."** Every section should answer why, not just what.
4. **Missing runnable examples in `docs/`.** Every code block in the reference layer is copy-paste ready. The README carries no runnable code.
5. **Assuming context.** Mention Superloom, link to related modules, explain terminology.
6. **AI and marketing tells.** See [Banned Vocabulary](#banned-vocabulary). Use a verb the reader would say out loud.

For **structural** mistakes (wrong section order, missing Universal Sections, wrong class-specific sections), see [`module-readme-structure.md` → Anti-Patterns](../modules/module-readme-structure.md#anti-patterns-to-avoid).

---

## Review Checklist (Writing-Style Pass)

Before finalizing any `.md` file:

- [ ] One-sentence description is clear and accurate
- [ ] No banned vocabulary (see [Banned Vocabulary](#banned-vocabulary))
- [ ] Active voice used throughout
- [ ] Reference prose is third-person; bare imperative only for genuine command steps (no "you")
- [ ] No emoji, no exclamation marks, no rhetorical questions
- [ ] README carries no function signatures, config tables, or `npm install` command; runnable examples live in `docs/`
- [ ] Consistent terminology with other modules
- [ ] No em dashes anywhere (`-` only for compound words)
- [ ] No periods at the end of table cells
- [ ] Code blocks contain only real comments, no doc instructions disguised as comments
- [ ] Sentences are roughly 30 words or fewer
- [ ] American English spelling (`-ize`, `-or`, `-ization`, `license`)
- [ ] Placeholders use `<UPPERCASE>` angle brackets, not `{curly braces}`

For the **structural** README checklist (Universal Sections present, class-specific section correct, ROBOTS.md current, etc.), see [`module-readme-structure.md` → Checklist](../modules/module-readme-structure.md#checklist).

---

## Code Comment Standards

Source files must never contain paths or links to internal `docs/` files. Explain the reason inline. Documentation cross-references belong in documentation, not in code.

**Rationale:** Code comments should be self-contained and explain the *what* and *why* directly. External documentation links create drift - documentation moves but comments don't update. Inline explanations keep the code comprehensible in isolation.

**Prohibited patterns:**
- `// See docs/foundations/third-party-libraries.md`
- `// See: docs/dev/testing-local-modules.md`
- `// Documentation: ../docs/architecture.md`
- Any comment containing `docs/` as a reference to project documentation

**Allowed patterns:**
- `// Reference: https://docs.aws.amazon.com/...` (external API documentation)
- `// RFC 6749 section 4.1` (public specification references)
- `// Node.js v24+ requirement for node:sqlite` (version requirements)
- Self-contained explanations: `// SQLite has no native boolean; stored as INTEGER 0/1`

---

## Brand Usage in Documentation and Comments

The module name exists in exactly **two forms**. The npm scope form (`@superloomdev/js-helper-utils`) and the bare package form (`js-helper-utils`) are `package.json` and directory-layout identifiers only. Everywhere else - documentation prose, titles, code comments, examples, JSDoc, error messages, file banners - use the **alias short-name** (e.g. `helper-utils`, `helper-sql-sqlite`) defined in [`code-formatting-js.md` → NPM Aliases](../foundations/code-formatting-js.md#npm-package-aliases). There is no third form: a surface either carries the published identity (`package.json`) or the alias.

This keeps the codebase forkable. A consumer who renames the scope only edits `package.json` aliases; nothing else moves.

| Where | Use the brand? |
|---|---|
| `package.json` (`name`, `repository`, `peerDependencies` target) | **Yes** - the published identity |
| Top-level project `README.md` and `docs/index.md` | **Yes** - introducing the project |
| Module `README.md` intro line | **Yes, once** - "Part of Superloom" or equivalent |
| Module `README.md` H1 and sibling/family links | **No** - alias short-names only |
| Module `docs/` API reference, examples, code blocks, H1 titles | **No** - use alias short-names |
| Source code: `require()`, error prefixes, JSDoc, comments, `// Info:` banners | **No** - alias short-names only |
| Error-catalog file headers (`[name].errors.js`) | **No** - alias short-names only |
| `ROBOTS.md` (body and H1) | **No** - alias short-names only |

The alias derivation rule itself (strip `js-` and `server`/`client`, keep everything else) is the single source of truth in [`code-formatting-js.md`](../foundations/code-formatting-js.md#npm-package-aliases) and is not duplicated here.

---

## Related Documentation

- [`module-categorization.md`](../modules/module-categorization.md) - the six module classes
- [`module-readme-structure.md`](../modules/module-readme-structure.md) - Universal README Sections and class-specific sections
- [`complex-module-docs-guide.md`](../modules/complex-module-docs-guide.md) - `docs/` folder structure for Class E feature modules
- [`code-formatting-js.md`](../foundations/code-formatting-js.md) - JavaScript code style (the prose-style rules above also apply to `.js` comments and JSDoc)
- [`module-testing.md`](../testing/module-testing.md) and [`unit-test-authoring-js.md`](../testing/unit-test-authoring-js.md) - testing rules and how to author a unit test
