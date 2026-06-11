# Documentation Authoring Principles

The authoring contract that governs every edit to framework documentation, `AGENTS.md`, `.windsurf/`, `README.md`, `ROBOTS.md`, or any other AI-readable file in this project. These rules are enforced by the `/learn` and `/compile-agents-md` workflows.

**Companion docs.** This file is the **authoring-discipline** half of documentation standards. The **writing-style** half lives in [`documentation-standards.md`](./documentation-standards.md): voice, prose mechanics, em-dash ban, placeholder syntax, American English. Use `documentation-standards.md` for how to write words. Use this file for **where a rule belongs, how compact it should be, and how cross-references stay consistent.**

---

## On This Page

- [Why This Exists](#why-this-exists)
- [Core Principles](#core-principles)
- [Decision Tree: Where Does New Knowledge Go?](#decision-tree-where-does-new-knowledge-go)
- [Cross-Reference Integrity](#cross-reference-integrity)
- [Verification Before Commit](#verification-before-commit)
- [Related Workflows](#related-workflows)

---

## Why This Exists

Framework knowledge accumulates over time: rules, patterns, decisions, corrections. Without an authoring contract:

- Rules get duplicated across files, then drift apart
- Negative rules ("don't do X, Y, Z, ...") expand without bound
- Specific project examples leak into language-agnostic framework docs
- `AGENTS.md` asserts things `docs/` no longer says (or vice versa)

This file is the contract. Every new rule that lands in `docs/`, `AGENTS.md`, or `.windsurf/workflows/` must follow it.

---

## Core Principles

### A. Prescriptive over prohibitive

State what TO do, not what NOT to do. Negative examples are unbounded ("don't do X, Y, Z, ...") - positive rules are finite and enforceable.

**Exception:** A single short "common mistake" callout is acceptable when one specific anti-pattern recurs and breaks builds.

### B. Generic over specific

Framework docs (`docs/foundations/`, `docs/modules/`, `docs/server/`, `docs/testing/`, `AGENTS.md`, workflows) must use placeholders: `[module]`, `[entity]`, `[name]`.

- No project names, no module names (no "MySQL", "Postgres", "DynamoDB" in framework rules)
- Module-specific examples belong only in that module's `README.md` / `ROBOTS.md`

### C. DRY - single source of truth

Each rule lives in exactly one canonical file:

- Other files cross-reference via path: `see docs/[bucket]/[file].md section [name]`
- Never duplicate full rule text across files
- `AGENTS.md` is the only allowed compressed mirror of the architecture docs (`docs/foundations/`, `docs/modules/`, `docs/server/`, `docs/testing/`)

### D. Compact over verbose

Tables and bullets, never prose paragraphs for rules.

- One rule = one line where possible
- Code examples only when the pattern cannot be expressed in text
- Strip all preamble ("This section explains...", "It is important to note...")

### E. Clear and direct language

Write like you speak. Simple sentences. No fluff.

- **Good**: "Extension consumes core. Extension is boss."
- **Bad**: "In the extension pattern, the extension module acts as the consumer of the core module's functionality, establishing an inverse dependency relationship where..."
- Use active voice. Subject-verb-object.
- Remove filler words: "essentially", "basically", "in order to", "it is important to note"
- Remove redundant phrases: "the reason why is because", "each and every"

---

## Decision Tree: Where Does New Knowledge Go?

When a new rule, pattern, or correction arrives, map it to one row:

| Type of knowledge | Destination |
|---|---|
| Universal AI behavior rule | personal `.windsurf/GOD.md` (workspace-root, not committed) |
| Project-wide AI rule (compressed) | `AGENTS.md` |
| Architectural rule, full detail | `docs/[bucket]/[topic].md` (foundations / modules / server / testing) |
| Step-by-step task procedure | `.windsurf/workflows/[name].md` (relevant repo) |
| Module-specific function/usage | `[module]/README.md` + `[module]/ROBOTS.md` |
| Operational runbook (env-specific) | `ops/[NN-category]/[vendor-service].md` |
| Generic infrastructure guide | `docs/ops/[category]/[vendor-service].md` |
| Migration history (gitignored) | `__dev__/migration-changelog.md` |

If knowledge spans multiple categories, split it. Each piece goes to its canonical home, and the others cross-reference.

If unclear which category applies → **STOP and ask the user.** Do not guess.

---

## Cross-Reference Integrity

Whenever a rule is added, moved, or renamed:

1. Search the codebase for stale references to the old terminology
2. `AGENTS.md` mirror sections must be re-synced via `/compile-agents-md`
3. Workflow checklists must reference the canonical doc, not embed the rule text
4. Any rule embedded in code comments (e.g., the `// Base configuration` comment) must match the doc verbatim

---

## Verification Before Commit

After editing docs:

1. Grep for the old terminology to confirm no stale text remains
2. Run `/compile-agents-md verify` to confirm `docs/` and `AGENTS.md` are in sync
3. If a VitePress-rendered file in `docs/` was changed, run `npm run build` from `website/` to catch parser failures before CI

---

## Related Workflows

- **`/learn`** - operational arm of this contract. When the user types `/learn <new rule>`, the workflow classifies the knowledge against the decision tree above, applies the core principles, and writes the change in the right place.
- **`/compile-agents-md`** - keeps the compressed mirror in `AGENTS.md` aligned with the canonical `docs/` sources. Sub-verbs: `sync` (default, conversation diff + full audit), `rebuild` (full doc walk only), `verify` (read-only drift report).

These workflows enforce the principles automatically. The discipline survives across sessions and contributors.
