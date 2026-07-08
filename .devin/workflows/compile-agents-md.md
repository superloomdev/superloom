---
description: Compile AGENTS.md from docs/ - sync (default), rebuild, or verify
---

# Compile AGENTS.md Workflow

`AGENTS.md` is a **compressed, AI-facing mirror** of everything in `docs/`. It is loaded at every conversation start. This workflow keeps it aligned with the canonical sources in `docs/` with zero context loss and minimum tokens.

**Authority:** All edits made by this workflow follow [`docs/principles/documentation-authoring.md`](../../docs/principles/documentation-authoring.md): prescriptive, generic, DRY, compact. For new knowledge that does not fit existing sections, use `/learn` first to place it canonically in `docs/`, then run this workflow.

**Precondition:** If the current task changed `docs/` or `.windsurf/workflows/`, run `/validate-docs` first. Do not sync unvalidated documentation into `AGENTS.md`.

---

## Verb Dispatch

Inspect the user's input after `/compile-agents-md`:

| User says | Verb | Behavior |
|---|---|---|
| `/compile-agents-md` (no verb) or `/compile-agents-md sync` | **sync** *(default)* | Phase 1 conversation diff + Phase 2 full-doc audit + write updates |
| `/compile-agents-md rebuild` | **rebuild** | Skip Phase 1. Walk every doc from scratch. Used when conversation context is lost. |
| `/compile-agents-md verify` | **verify** | Read-only sync check. Report drift without writing. |

If the verb is ambiguous → ask the user, never guess.

---

## Section Map (Canonical)

Every section in `AGENTS.md` mirrors a specific subtree of `docs/`. Use this table to know what to update where. If a new section is added to `docs/` and `AGENTS.md` should mirror it, extend this table first.

| `docs/` source | `AGENTS.md` section |
|---|---|
| `docs/principles/engineering-philosophy.md` | "Core Philosophy" |
| `docs/principles/documentation-authoring.md` | "Documentation Rules" (compressed) + the Golden Rule callout |
| `docs/languages/js/code-formatting.md` | "Coding Standards (Mandatory)" |
| `docs/languages/js/project-structure.md` | "Core Philosophy" + "Directory Map" |
| `docs/languages/js/error-handling.md` | "Error Handling" |
| `docs/languages/js/module-structure.md` | "Module Patterns" |
| `docs/languages/js/module-classes.md` | "Module Classes" |
| `docs/languages/js/publishing.md` | "Publishing" |
| `docs/languages/js/module-thoughts-file.md` | "Standard Files Per Module" (THOUGHTS.md row) |
| `docs/languages/js/dependencies.md` | "Dependency Hierarchy" |
| `docs/languages/js/module-docs.md` | "README Structure" |
| `docs/languages/js/index.md` | "Two-Form Naming Rule" |
| `docs/languages/js/catalog-client.md` | "Client Module Patterns" |
| `docs/languages/js/server/*` | "Server Layer Rules" |
| `docs/languages/js/testing-strategy.md`, `unit-test-authoring.md`, `module-testing.md` | "Testing" |
| `docs/languages/js/pitfalls-migration.md` | "Two-pass check" reference |
| `docs/ai/agent-configuration.md` | "AI Behavior Rules" (this workflow's own budget rule lives there) |
| `docs/ai/workflow-authoring.md` | Workflow inventory descriptions |
| `docs/ai/model-tiering.md` | Session and token discipline lines |
| `docs/dev/pitfalls.md` | "Safe Terminal Patterns" + entry-specific callouts |
| `docs/dev/testing-local-modules.md` | "Module testing contract" |
| `docs/dev/cicd-publishing.md` | "Publish-job CI rules" |
| `docs/dev/planning.md` | "At session start" line |
| `docs/dev/org-structure.md` | "Directory Map" |
| `docs/languages/js/versioning/bump-checklist.md` | "Version and Publish" |
| `docs/languages/js/versioning/dependency-management.md` | "Dependency Management" |
| `docs/ops/**` | (referenced as "see ops/" - not embedded) |

---

## Phase 1 - Conversation Diff

Run only on `sync` (skip on `rebuild`).

1. Identify every file I edited in this session under `docs/` or `.windsurf/`
2. For each, look up its `AGENTS.md` section via the Section Map above
3. Read the new source content; compare to the current `AGENTS.md` section
4. Apply a compressed update per the authoring principles (see "Compression Discipline" below)

If a touched file has no entry in the Section Map → ask the user where it should mirror (or whether it should mirror at all), then update the Section Map in the same change.

---

## Phase 2 - Full-Doc Audit

Run on both `sync` and `rebuild`.

Walk the `docs/` tree in this fixed order:

1. `docs/principles/`
2. `docs/languages/js/` (including `server/` and `versioning/`)
3. `docs/ai/`
4. `docs/dev/`
5. `docs/ops/` (only the index, not every runbook)

For each file:

1. Read its current state
2. Find the matching `AGENTS.md` section via the Section Map
3. Compare for drift (rule wording changed in source but not in mirror)
4. Apply corrections, preserving compression

On `rebuild`, write each section from scratch rather than diff-and-patch.

---

## Phase 2.5 - Unmirrored Rule Scan

Run after Phase 2 on `sync`, `rebuild`, and `verify`.

This phase guarantees zero-context-loss compression. Phase 2 catches drift. Phase 2.5 catches omissions: rules that exist in `docs/` but have no compressed representation in `AGENTS.md`.

1. **Build the rule inventory.** For every file in the Section Map, extract each sentence or list item that contains one of these rule markers: `must`, `must not`, `should`, `should not`, `never`, `always`, `required`, `forbidden`, `do not`, `only`, `use`, `run`, `write`, `create`, `delete`, `update`, `prefer`, `avoid`.
2. **Preserve source location.** Every inventory item must include `source file:line`.
3. **Cross-check against `AGENTS.md`.** For each inventory item, search `AGENTS.md` for a compressed rule that preserves both condition and conclusion. A conclusion without its condition is not mirrored.
4. **Report unmirrored rules.** For every missing or incomplete mirror, report source file:line and suggested compressed wording.
5. **Apply or report depending on verb.**
   - `sync` / `rebuild`: add the compressed rule to the correct `AGENTS.md` section before Phase 3.
   - `verify`: report `would update`; do not edit `AGENTS.md`.

Output:

```
Phase 2.5 - Unmirrored Rule Scan
Rules in source inventory: N
Rules mirrored in AGENTS.md: M
Unmirrored rules: K
  - docs/foo.md:42 | missing | suggested: [compressed rule]
  - docs/bar.md:88 | condition missing | suggested: [compressed rule with condition]
```

This is a hard gate. Phase 3 does not run until Phase 2.5 reports zero unmirrored rules for `sync` and `rebuild`, or reports the complete would-update list for `verify`.

---

## Phase 3 - Write & Verify

After Phase 1 + Phase 2 + Phase 2.5 produce the updated `AGENTS.md`:

1. **Golden Rule check.** Confirm the Golden Rule callout is still the first content block, with the correct propagation workflow name (`/compile-agents-md`).
2. **Size budget (hard gate).** Count the lines. Target 300, hard ceiling 400 (`docs/ai/agent-configuration.md` - The Size Budget). Over the ceiling: compress harder, demote rules to one-line pointers, or move lifecycle-only content into the owning workflow. Never raise the ceiling.
3. **Table of contents.** If `AGENTS.md` has an explicit ToC, regenerate it from the actual `##` headings.
4. **Internal links.** Every relative path referenced in `AGENTS.md` must point to a file that exists under `docs/` or the repo root.
5. **Workflow embedded blocks.** Workflows carry compiled rule blocks marked with their `docs/` sources (`docs/ai/workflow-authoring.md` - Embedded Content and the Compile Rule). For each workflow in every workspace repo, if a source feeding an embedded block changed this session, update the block in the same change and report it.
6. **Report.** Reply with a compact table of changed sections.

```
| Section | Source | Change |
|---|---|---|
| Coding Standards | docs/languages/js/code-formatting.md | Added rule about [X] |
| Safe Terminal Patterns | docs/dev/pitfalls.md | Updated entry 18 wording |
| (no other changes) | | |
```

No prose summary. No validation phrases.

---

## Verify-Only Mode

When invoked as `/compile-agents-md verify`:

1. Run Phase 1 (conversation diff) and Phase 2 (full-doc audit) **read-only**
2. For every drift found, report it in the table format above with `Change: would update`
3. Do not write to `AGENTS.md`

This is the safe pre-commit check: it tells the user exactly what `/compile-agents-md sync` would change, without changing anything.

---

## Compression Discipline

Every line written to `AGENTS.md` follows [`docs/dev/documentation-authoring.md`](../../docs/dev/documentation-authoring.md):

- **Tables over prose.** Rules with attributes become tables. One-shot statements become bullets.
- **One rule = one line** where possible.
- **Strip preamble.** Do not use filler openings; start with the rule.
- **Cross-reference, do not duplicate.** A rule that exists in full detail in `docs/` appears in `AGENTS.md` as a one-line compressed statement plus `See docs/[path].md`.
- **No code examples** unless the rule cannot be expressed in text. Prefer one-line patterns over multi-line snippets.
- **Preserve the Golden Rule callout at the very top.** It must always reference this workflow by its current name.

---

## When Knowledge Is New (Not Just Drifted)

If new knowledge surfaced during the session that does not yet live anywhere in `docs/`:

1. **STOP.** Do not write it directly to `AGENTS.md`.
2. Tell the user: "This is a new rule. Run `/learn <description>` first to place it in the canonical doc."
3. After `/learn` completes, re-run `/compile-agents-md sync` to mirror it.

This guarantees `AGENTS.md` never asserts something that `docs/` does not also assert.

---

## Invocation Examples

- `/compile-agents-md` → default sync after a session of doc edits
- `/compile-agents-md sync` → same, explicit verb
- `/compile-agents-md rebuild` → after context loss; rebuild every section from current `docs/` state
- `/compile-agents-md verify` → pre-commit check; report drift without writing
