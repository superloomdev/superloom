---
description: Compile AGENTS.md from docs/ - sync (default), rebuild, or verify
---

# Compile AGENTS.md Workflow

`AGENTS.md` is a **compressed, AI-facing mirror** of everything in `docs/`. It is loaded at every conversation start. This workflow keeps it aligned with the canonical sources in `docs/` with zero context loss and minimum tokens.

**Authority:** All edits made by this workflow follow [`docs/dev/documentation-authoring.md`](../../docs/dev/documentation-authoring.md): prescriptive, generic, DRY, compact. For new knowledge that does not fit existing sections, use `/learn` first to place it canonically in `docs/`, then run this workflow.

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
| `docs/foundations/code-formatting-js.md` | "Coding Standards (Mandatory)" |
| `docs/foundations/architectural-philosophy.md` | "Core Philosophy" |
| `docs/foundations/error-handling.md` | "Error Handling" |
| `docs/modules/module-structure-js.md` | "Module Patterns" |
| `docs/modules/module-categorization.md` | "Module Classes" |
| `docs/modules/module-publishing.md` | "Publishing" |
| `docs/modules/module-thoughts-file.md` | "Standard Files Per Module" (THOUGHTS.md row in module-structure mirror) |
| `docs/modules/peer-dependencies.md` | "Dependency Hierarchy" |
| `docs/modules/module-readme-structure.md` | "README Structure" |
| `docs/server/*` | "Server Layer Rules" |
| `docs/testing/testing-strategy.md` | "Testing" |
| `docs/testing/unit-test-authoring-js.md` | "Testing" |
| `docs/testing/module-testing.md` | "Testing" |
| `docs/testing/migration-pitfalls.md` | "Two-pass check" reference |
| `docs/dev/pitfalls.md` | "Safe Terminal Patterns" + various entry-specific callouts |
| `docs/dev/testing-local-modules.md` | "Module testing contract" |
| `docs/dev/cicd-publishing.md` | "Publish-job CI rules" |
| `docs/dev/planning.md` | "At session start" line |
| `docs/dev/documentation-authoring.md` | (referenced; not mirrored - `/learn` enforces the rules directly) |
| `docs/dev/org-structure.md` | "Directory Map" |
| `docs/versioning/bump-checklist.md` | "Version and Publish" |
| `docs/versioning/dependency-management.md` | "Dependency Management" |
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

1. `docs/foundations/`
2. `docs/modules/`
3. `docs/server/`
4. `docs/testing/`
5. `docs/dev/`
6. `docs/versioning/`
7. `docs/ops/` (only the index, not every runbook)

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
2. **Table of contents.** If `AGENTS.md` has an explicit ToC, regenerate it from the actual `##` headings.
3. **Internal links.** Every relative path referenced in `AGENTS.md` must point to a file that exists under `docs/` or the repo root.
4. **Report.** Reply with a compact table of changed sections.

```
| Section | Source | Change |
|---|---|---|
| Coding Standards | docs/foundations/code-formatting-js.md | Added rule about [X] |
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
