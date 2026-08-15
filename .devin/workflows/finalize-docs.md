---
description: Finalize documentation - validate docs to convergence, fix findings, then propagate to AGENTS.md and embedded workflow blocks. Optional check mode is report-only.
---

# Finalize Docs Workflow

The one workflow that makes a documentation change official. It validates the docs with evidence-based passes, fixes what the passes find, re-validates until the state converges, and only then propagates the clean state into every derived artifact: `AGENTS.md` (both copies) and the embedded rule blocks inside workflows across the workspace.

Invoke as: `/finalize-docs` (full loop) or `/finalize-docs check` (report-only; no file writes anywhere).

Run it after any addition, modification, rename, move, or removal in `docs/` or any `.devin/workflows/` file - including after `/learn` places new knowledge.

## Operating Principle

> **Docs are the source of truth; everything else is compiled.** `AGENTS.md` and workflow embedded blocks are derived artifacts. They are written only by this workflow's Propagate phase, only from validated docs. If a derived artifact changed outside this workflow, that is a Blocker, not a starting point.

## Execution Contract (binding)

1. **Phases run in order:** Scope -> Validate (passes 1-12) -> Fix -> re-Validate -> Converge -> Propagate -> Report. Never skip, merge, or reorder.
2. **Propagate runs only after convergence.** Unvalidated documentation never reaches `AGENTS.md` or an embedded block.
3. **Every pass produces evidence in the reply**: the exact command or file-read set used, numeric counts, file:line citations per finding, severity per finding. A pass without evidence is incomplete and blocks the next pass.
4. **Inapplicable passes are declared, never skipped silently**: output `Pass N: inapplicable / Reason / Evidence`.
5. **Manual edits only.** Fixes are applied by hand with the editor tool after reading the file. No bulk `sed`/`awk`/`perl -pi` rewrites.
6. **`check` mode writes nothing.** All fix and propagate steps report `would change` instead of editing.
7. **When uncertain, STOP and ask.** An ambiguous rule or an undecided convention is reported, not guessed.

## Command Execution Rules

- **NEVER use `cd`** inside a command; set the tool's `Cwd` parameter.
- One line per command, or a single `&&` chain. Pipe long output through `| tail -N`.
- Sweep greps exit non-zero when clean (that is the pass condition). Never `&&`-chain sweep greps; chain with `;`.
- `// turbo` marks read-only detection steps safe to auto-run. No mutation step is ever auto-run.

## Severity Rules

| Severity | Meaning |
|---|---|
| Blocker | Build failure, derived artifact edited outside this workflow, source-doc to `AGENTS.md` contradiction, local absolute path in published docs, embedded-block drift, `AGENTS.md` over budget ceiling |
| High | Broken link, missing subtype coverage, stale class-level term, code reference to removed target, table-detail contradiction |
| Medium | Stale wording that could mislead, duplicated rule with divergent wording, writing-style violation that affects clarity |
| Low | Minor style issue, weak wording, missing convenience cross-link |

---

## Phase 0 - Scope Detection

Build the blast radius before running validation passes.

1. List changed files under `docs/`, `.devin/workflows/`, and `AGENTS.md`.
2. If `AGENTS.md` changed outside this workflow's Propagate phase, record a Blocker and stop.
3. For each changed file, name the conceptual change: addition, rename, removal, move, restructure, or semantic shift.
4. For each changed concept, search all relevant workspace repositories for old terms, new terms, section headings, package names, and workflow names.
5. The blast radius is the union of changed files and files referencing changed concepts.

Output:

```text
Phase 0 - Scope
Changed files: N
Changed concepts: M
Blast-radius files: K
Direct AGENTS.md edit: yes/no
```

## Pass 1 - Terminology Consistency

Question: does every blast-radius file use the current terminology?

Evidence required:

- Query for each old and new term.
- File:line for every old-term occurrence.
- Classification per occurrence: class-level, subtype-level, historical, changelog, or false positive.

Output:

```text
Pass 1 - Terminology
Queries: [list]
Occurrences examined: N
Findings: M
  - path/file.md:42 - High - class-level old term remains
```

## Pass 2 - Link and Anchor Integrity

Question: does every internal link resolve and avoid local filesystem paths?

Evidence required:

- Count of Markdown links scanned in blast-radius files.
- File existence result for every relative file link.
- Anchor existence result for every cross-file `path#anchor` link **and** every same-file bare `#fragment` link, including a file's own `On This Page` list.
- Anchor checks compare against slugs derived from the target file's actual headings (lowercase, punctuation and backticks stripped, spaces to hyphens). Renaming a heading invalidates every inbound anchor including those in the same file.
- Count of absolute local path links.

> A successful website build is not evidence for this pass. VitePress does not fail on unresolved same-file fragments, so anchors must be verified by slug comparison.

Rules (source: `docs/principles/documentation-authoring.md` - Path Portability):

- Relative links are preferred for documentation files.
- Full HTTP links are allowed when linking to external sites or package pages.
- Absolute local paths such as `/Users/...` are Blockers.

Output:

```text
Pass 2 - Links
Links scanned: N
Broken links: M
Absolute local links: K
```

## Pass 3 - Table to Detail Consistency

Question: do summary tables match the detailed sections they summarize?

Evidence required:

- Every summary table in blast-radius files.
- Side-by-side comparison of table row and corresponding detailed section.
- File:line for both claims.

Output:

```text
Pass 3 - Tables
Tables scanned: N
Rows compared: R
Findings: M
```

## Pass 4 - Subtype and Variant Completeness

Question: when a concept has subtypes or variants, do general descriptions acknowledge all of them?

Evidence required:

- Authoritative subtype list and its source file:line.
- Every generic description of the concept in blast-radius files.
- Per description: which subtypes are mentioned.

Rules:

- General definitions, overview tables, and top-level concept sections must mention all subtypes.
- Subtype-specific sections may intentionally discuss only one subtype.

Output:

```text
Pass 4 - Subtypes
Concept: [name]
Authoritative subtypes: [list]
Generic descriptions checked: N
Findings: M
```

## Pass 5 - Decision Logic and Naming Symmetry

Question: where a rule, decision tree, naming pattern, or convention appears more than once, do all instances agree?

Evidence required:

- Verbatim quote from each location.
- File:line for each quote.
- Statement of whether wording, conditions, and conclusion match.

This pass also catches implicit naming asymmetry. If sibling headings, skeletons, table rows, or templates form a set, their names must use the same abstraction level unless the docs state why they differ.

Output:

```text
Pass 5 - Rule Agreement
Rules or naming sets examined: N
Findings: M
```

## Pass 6 - Writing Style and Prose Quality

Question: do changed files follow the documented writing rules?

Source of truth: `docs/principles/documentation-authoring.md`.

Mandatory checks:

| # | Rule | Required check |
|---|---|---|
| 1 | No em dash characters | Search for the Unicode U+2014 character |
| 2 | No double hyphen as em dash | Search for space + double hyphen + space |
| 3 | No banned phrases | Search for the banned phrase list from `docs/principles/documentation-authoring.md` |
| 4 | Sentence length | Analytic check for sentences over 30 words |
| 5 | American English | Search for common British spellings listed in `docs/principles/documentation-authoring.md` |
| 6 | Table-cell punctuation | Check table cells ending in periods; classify valid multi-sentence exceptions |
| 7 | Angle-bracket placeholders | Search for bare `<name>` outside backticks and fenced code |
| 8 | Session-specific language | Search for temporal or conversation-specific phrases per `docs/principles/documentation-authoring.md` |
| 9 | Preamble wording | Search for preamble openings banned by `docs/principles/documentation-authoring.md` |

Output:

```text
Pass 6 - Writing Style
Files checked: N
Rule checks run: 9
Findings: M
```

## Pass 7 - File Organization, Table of Contents, and Companion Docs

Question: are files discoverable, correctly placed, and internally organized?

Evidence required:

- For new or moved files: chosen folder and reason.
- For each blast-radius file: extracted `On This Page` entries compared to actual headings.
- Companion docs block compared to related files referenced in the body.
- Index or parent-page reachability for every new file.

Output:

```text
Pass 7 - Organization
New files: N
Moved files: M
TOC mismatches: K
Unreachable files: L
```

## Pass 8 - Docs to Codebase Drift

Question: do documented functions, files, modules, package names, and config keys still exist?

Evidence required:

- Every code reference in blast-radius files: file paths, function calls, exported names, package names, config keys, workflow names.
- Existence check using file search or code search.
- File:line for broken references.

Output:

```text
Pass 8 - Docs/Code Drift
References scanned: N
Broken references: M
```

## Pass 9 - Artifacts Alignment Across Workspace Repos

Question: do templates, checklists, workflows, and reference implementations reflect current documented rules?

Evidence required:

- Workflow files checked across workspace repositories that contain `.devin/workflows/`.
- Checklists checked in docs and workflows.
- Templates and skeletons checked against the rules they are meant to illustrate.
- Reference implementations verified to exist.

Repo scope:

- Start with the current repository.
- Include sibling workspace repositories that contain `.devin/workflows/` or are listed in `docs/dev/org-structure.md`.
- Do not write local absolute paths into docs or workflows.

Output:

```text
Pass 9 - Artifacts Alignment
Repos checked: N
Workflow files checked: M
Templates checked: K
Findings: J
```

## Pass 10 - Website Build and Published Docs Surface

Question: does the docs website build and include the current docs surface?

Evidence required:

- Run `npm run build` from `website/` when the repository has a `website/package.json`.
- Verify exit code 0.
- Capture critical build errors and informational warnings separately.
- Verify `website/docs/` sync output exists after build when the site uses a docs sync step.
- Check touched docs are reachable from the site sidebar, nav, index page, or an intentionally linked parent page.

Output:

```text
Pass 10 - Website
Build run: yes/no
Exit code: [code]
Critical warnings: N
Informational warnings: M
Reachability findings: K
```

## Pass 11 - Structural Coherence

Question: are concepts defined before first use and referenced in a logical order?

Evidence required:

- Capitalized project terms, acronyms, class names, pattern names, and config keys in order of first appearance.
- Whether each term is defined inline or linked at first use.
- Forward references checked against actual section order.

Rules:

- Acronyms must be expanded or linked at first use unless they are widely-known technical names already established in the same file family.
- Framework-specific terms must be defined or linked at first use.
- Forward references must point to sections that exist.
- A concept used in an intro must be defined in the intro or linked to its definition.

Output:

```text
Pass 11 - Structural Coherence
Files checked: N
Terms examined: M
Undefined first uses: K
Bad forward references: L
```

## Pass 12 - Layer Contracts and Embedded Blocks

Question: do the three-layer contracts hold and are workflow embedded blocks in sync with their sources?

Evidence required:

- Every `docs/languages/[lang]/` document reachable from that layer's `index.md` document map, and every mapped principle file existing.
- Every `principles/` Language Implementations table row resolving to an existing file.
- Every workflow embedded block (marked with its `docs/` source) compared against its source for drift, across every workspace repo with `.devin/workflows/`.

Severity: embedded-block drift is a Blocker; a missing implementations row is High.

Output:

```text
Pass 12 - Layers and Embedded Blocks
Language docs checked: N
Implementation rows checked: M
Embedded blocks compared: K
Findings: J
```

---

## Convergence Gate (hard gate)

1. Fix every Blocker and High finding. Fix every Medium finding unless the user explicitly defers it. Low findings are fixed or listed as deferred with reasons.
2. In `check` mode: fix nothing; assemble the full findings table and skip to Report.
3. After fixes, re-run every pass that produced a finding, plus Passes 1, 2, and 8 always.
4. Exit only after **two consecutive validation rounds with zero new Blocker/High/Medium findings**. Any fix after a clean round resets the count.
5. State convergence explicitly: "Round N found zero new findings; previous round also clean - converged."

Propagate does not run until this gate passes.

---

## Phase P - Propagate to Derived Artifacts

> This is the only place `AGENTS.md` is ever edited. In `check` mode every step reports `would change` and writes nothing.

### P1 - Section Map (canonical)

Every section in `AGENTS.md` mirrors a specific subtree of `docs/`. If a new docs section should mirror into `AGENTS.md`, extend this table first, in the same change.

Actual `AGENTS.md` sections: Golden Rule callout (header), Persona, Tech Stack, Documentation Map, AI Behavior Rules, Safe Terminal Patterns, Boundaries, Directory Map, Workflow Inventory.

**A row must name the section that carries the compressed rule.** A filename appearing in the Documentation Map table is a pointer, not a mirror. Never invent a mirror location to make a row look complete.

Three allowed destination values, closed set:

| Destination | Meaning |
|---|---|
| `[AGENTS.md section name]` | A compressed rule sits in the named `AGENTS.md` section |
| `not mirrored (reference material)` | Looked up per task, deliberately uncompressed; P3 skips it |
| `mirrored to workflow: [workflow-name]` | The rule is lifecycle-only, so it lives in the named workflow's embedded Standard; P3 checks the workflow instead of `AGENTS.md` |

| `docs/` source | `AGENTS.md` section |
|---|---|
| `docs/principles/engineering-philosophy.md` | Persona + Golden Rule callout |
| `docs/principles/documentation-authoring.md` | Golden Rule callout + AI Behavior Rules (docs-never-reference-plans rule) |
| `docs/principles/project-management.md` | AI Behavior Rules (product management layer) |
| `docs/principles/testing.md` | AI Behavior Rules (assertions pin exact values) |
| `docs/languages/js/code-formatting.md` | AI Behavior Rules (step comments, two-pass check) |
| `docs/languages/js/project-structure.md` | Directory Map |
| `docs/languages/js/error-handling.md` | AI Behavior Rules (three-category error disposal + wrapper purity + service translation) |
| `docs/languages/js/module-structure.md` | mirrored to workflow: js-helper-module |
| `docs/principles/module-design.md` | AI Behavior Rules (class taxonomy reference, composition patterns) + Documentation Map |
| `docs/principles/composition-and-adapters.md` | AI Behavior Rules (composition and adapters doctrine) + Documentation Map |
| `docs/languages/js/module-classes.md` | not mirrored (reference material; class definitions and per-class doc footprints are looked up, not memorized) |
| `docs/languages/js/composition-and-adapters.md` | AI Behavior Rules (composition and adapters doctrine, JS-specific) + Documentation Map |
| `docs/languages/js/validation.md` | AI Behavior Rules (type-guard primitive rule) |
| `docs/languages/js/client/client-modules.md` | AI Behavior Rules (client naming taxonomy + loader-pattern rule) |
| `docs/languages/js/client/components.md` | AI Behavior Rules (component accessibility aria-* rule) |
| `docs/languages/js/conventions-registry.md` | not mirrored (reference material; lookup table scanned per task) |
| `docs/languages/js/publishing.md` | Boundaries / Never (publish is CI-only) |
| `docs/languages/js/module-thoughts-file.md` | Directory Map (THOUGHTS.md in standard files list) |
| `docs/languages/js/dependencies.md` | AI Behavior Rules (peer dependencies declare full runtime contract) |
| `docs/languages/js/module-docs.md` | Directory Map (standard files per module line) |
| `docs/languages/js/index.md` | AI Behavior Rules (two-form naming rule) |
| `docs/languages/js/catalog-client.md` | not mirrored (reference material; the naming taxonomy rule is sourced from `client/client-modules.md`) |
| `docs/languages/js/server/*` | not mirrored (reference material; server layer contracts are looked up per task) |
| `docs/languages/js/testing-strategy.md`, `unit-test-authoring.md`, `module-testing.md` | AI Behavior Rules (run tests, assertions pin exact values) + Safe Terminal Patterns (module testing contract) |
| `docs/languages/js/pitfalls-migration.md` | AI Behavior Rules (two-pass check reference) |
| `docs/languages/js/versioning/bump-checklist.md` | Boundaries / Never (publish is CI-only) + Safe Terminal Patterns (pre-publish gate) |
| `docs/languages/js/versioning/dependency-management.md` | AI Behavior Rules (peer dependencies rule) |
| `docs/ai/agent-configuration.md` | Golden Rule callout (size budget) + AI Behavior Rules (repository independence) |
| `docs/ai/workflow-authoring.md` | Workflow Inventory (descriptions + authoring standard) |
| `docs/ai/model-tiering.md` | Workflow Inventory (model-tier split line) |
| `docs/dev/pitfalls.md` | Safe Terminal Patterns (all entries) |
| `docs/dev/testing-local-modules.md` | Safe Terminal Patterns (module testing contract) |
| `docs/dev/cicd-publishing.md` | Safe Terminal Patterns (CI chained publishes) |
| `docs/dev/planning.md` | AI Behavior Rules (at session start) |
| `docs/dev/org-structure.md` | Directory Map |
| `docs/ops/**` | (referenced as "see ops/" - not embedded) |

### P2 - Session Diff and Full-Doc Audit

1. For every file changed this session under `docs/` or `.devin/workflows/`, look up its `AGENTS.md` section via the Section Map, read the new source content, and compare to the current `AGENTS.md` section.
2. Then walk the full `docs/` tree in fixed order (`principles/` -> `languages/js/` incl. `server/` and `versioning/` -> `ai/` -> `dev/` -> `ops/` index only), comparing each file to its mirrored section for drift.
3. Apply compressed corrections per the Compression Discipline below. If a section is pervasively drifted (three or more stale rules), rewrite that section from scratch from its sources instead of patching.
4. If a touched file has no entry in the Section Map: ask the user where it should mirror (or whether it should mirror at all), then extend the Section Map in the same change.

### P3 - Unmirrored Rule Scan (hard gate)

P2 catches drift. This step catches omissions: rules that exist in `docs/` but have no compressed representation in `AGENTS.md`.

1. For every file in the Section Map, extract each sentence or list item containing a rule marker: `must`, `must not`, `should`, `should not`, `never`, `always`, `required`, `forbidden`, `do not`, `only`, `use`, `run`, `write`, `create`, `delete`, `update`, `prefer`, `avoid`.
2. Every inventory item carries `source file:line`.
3. For each item, search `AGENTS.md` for a compressed rule preserving both condition and conclusion. A conclusion without its condition is not mirrored.
4. Add each missing compressed rule to the correct `AGENTS.md` section (or report `would update` in `check` mode).
5. Sources whose Section Map row reads `not mirrored (reference material)` are skipped, but the skip is reported with a count. A row is never relabelled `not mirrored` to clear a finding; that decision is the user's.
6. Sources whose Section Map row reads `mirrored to workflow: [name]` are not checked against `AGENTS.md`. Instead, confirm the named workflow's embedded Standard carries the rule, and report these in their own count line. A row is never relabelled `mirrored to workflow` to clear a finding; that decision is the user's.

Output:

```text
P3 - Rule Mirroring
Rules extracted (counted, with file:line each): N
Mirrored to AGENTS.md: A
Mirrored to workflow Standard: B
Not mirrored (reference material): C
Unmirrored (findings): D
A + B + C + D must equal N; if it does not, the scan is incomplete - do not report
  - docs/foo.md:42 | missing | suggested: [compressed rule]
```

This is a hard gate: P4 does not run until this reports zero unmirrored rules (or the complete would-update list in `check` mode).

### P4 - Write and Verify AGENTS.md

1. **Golden Rule check.** The Golden Rule callout stays the first content block and references this workflow by its current name (`/finalize-docs`).
2. **Size budget (hard gate).** Count lines. Target 300, hard ceiling 400 (`docs/ai/agent-configuration.md` - The Size Budget). Over the ceiling: compress harder, demote rules to one-line pointers, or move lifecycle-only content into the owning workflow. Never raise the ceiling.
3. **Table of contents.** If `AGENTS.md` has an explicit ToC, regenerate it from the actual `##` headings.
4. **Internal links.** Every relative path in `AGENTS.md` must point to a file that exists under `docs/` or the repo root.
5. **Workflow inventory.** One line per workflow across the workspace, each matching that workflow file's current `description:` frontmatter and verbs.

### P5 - Embedded Workflow Blocks

For each workflow in every workspace repo with `.devin/workflows/`: if a `docs/` source feeding one of its embedded blocks (marked with its source path) changed this session, the block must be updated.

**Two paths depending on what changed:**

1. **Language docs changed** (e.g., `docs/languages/js/module-structure.md` was edited): The embedded Standard block in the target repo's Build workflow is stale. Run `/compile-workflows-from-docs [target-repo] [lang]` to regenerate the workflow family from the archetype specs and the updated language docs. The compile workflow self-verifies through a headless workshop. Do not manually patch embedded blocks when the source docs changed; the generator is the correct tool.

2. **Archetype specs changed** (e.g., `docs/ai/workflow-archetypes.md` was edited): All workflow families in all implementation repos are stale. Run `/compile-workflows-from-docs [target-repo] [lang]` for each implementation repo that has `.devin/workflows/`. The generator produces the updated workflow files from the new archetypes.

3. **Workflow-internal content changed** (a sweep command or gate added to a workflow file directly): If the change is not driven by a docs change, update the workflow file in place. This is the only case where manual patching is correct.

**Detection:** Check whether any file under `docs/ai/workflow-archetypes.md` or `docs/languages/[lang]/` changed this session. If yes, path 1 or 2 applies. If only `.devin/workflows/` files changed, path 3 applies.

This closes the compile rule from `docs/ai/workflow-authoring.md` - Embedded Content and the Compile Rule, and the archetype compile rule from `docs/ai/workflow-archetypes.md` - The Compile Rule.

### P6 - Propagate to Sibling Repositories

If a sibling repository maintains a copy of this `AGENTS.md` (a real file, not a symlink), update it after propagation; diverged copies give agents in that workspace stale rules. For each sibling repository that holds a copy:

```bash
# Cwd = codebase-superloom
cp AGENTS.md ../[sibling-repo]/AGENTS.md
```

Then commit the copy in the sibling repository (mutation - never auto-run):

```bash
# Cwd = [sibling-repo]
git add AGENTS.md && git commit -m "chore: sync AGENTS.md from codebase-superloom"
```

### Compression Discipline

Every line written to `AGENTS.md` follows `docs/principles/documentation-authoring.md`:

- **Tables over prose.** Rules with attributes become tables. One-shot statements become bullets.
- **One rule = one line** where possible.
- **Strip preamble.** Start with the rule.
- **Cross-reference, do not duplicate.** A rule detailed in `docs/` appears as one compressed line plus `See docs/[path].md`.
- **No code examples** unless the rule cannot be expressed in text.
- **Preserve the Golden Rule callout at the very top**, referencing this workflow by its current name.

### When Knowledge Is New (Not Just Drifted)

If new knowledge surfaced that does not yet live anywhere in `docs/`:

1. **STOP.** Do not write it directly to `AGENTS.md` or any workflow.
2. Tell the user: "This is a new rule. Run `/learn [description]` first to place it in the canonical doc."
3. After `/learn` completes, re-run `/finalize-docs`.

This guarantees derived artifacts never assert something `docs/` does not also assert.

---

## Final Report

One consolidated findings table, then pass status, then propagation summary:

```text
| Severity | Pass | File | Line | Issue | Fix |
|---|---|---|---|---|---|

| Pass | Status | Evidence Count |
|---|---|---|

| Derived artifact | Source | Change |
|---|---|---|
```

No prose summary. No validation phrases.

## Loop-backs

- Any pass finding -> fix -> re-run affected passes -> convergence count resets.
- P3 finds unmirrored rules -> add them -> re-run P3.
- P4 budget breach -> compress/demote/move -> re-run P4.
- A genuinely undecided convention -> STOP and ask; once resolved, the answer goes to `docs/` via `/learn`, then this workflow re-runs.

## Self-Improvement (every run, last step)

If this run exposed a failure mode no pass catches: journal it in the correct pitfall file first, extend or add a pass in this file in the same session, and record both in the Failure Mode Catalog below.

## Per-run Verification Checklist

- [ ] Mode declared (`full` or `check`); scope built with counts (Phase 0)
- [ ] Passes 1-12 run or declared inapplicable, each with evidence counts
- [ ] All Blocker/High/Medium findings fixed (or listed in `check` mode)
- [ ] Converged: two consecutive clean validation rounds, stated explicitly
- [ ] P2 session diff + full-doc audit done; pervasively drifted sections rebuilt
- [ ] P3 unmirrored rule scan reports zero (or complete would-update list)
- [ ] P4: Golden Rule first, budget within ceiling, ToC and links verified, workflow inventory current
- [ ] P5 embedded blocks synced across all workspace repos
- [ ] P6 sibling-repo copies made (commit approved by user)
- [ ] Final report tables output
- [ ] New failure modes journaled and catalogued

## Failure Mode Catalog

New failure modes found during a run must be added here. If no pass catches the new failure mode, add a pass or extend an existing pass.

| Failure mode | Caught by |
|---|---|
| Concept renamed but old references remain | Pass 1 |
| Concept removed but references remain | Pass 1 and Pass 8 |
| Heading renamed and inbound anchors break | Pass 2 |
| Heading renamed and the file's own `On This Page` anchor breaks | Pass 2 |
| Green website build accepted as anchor evidence | Pass 2 (build is explicitly not evidence) |
| Local filesystem path appears in published docs | Pass 2 |
| Summary table and detailed section disagree | Pass 3 |
| Concept gains subtype but general docs mention only old subtype | Pass 4 |
| Same decision rule diverges across files | Pass 5 |
| Sibling names use inconsistent abstraction levels | Pass 5 |
| Writing-style rule is violated | Pass 6 |
| New file is misplaced or unreachable | Pass 7 |
| Documentation references removed code | Pass 8 |
| Workflow or checklist references stale docs concepts | Pass 9 |
| Website build fails or touched doc is unreachable | Pass 10 |
| Term is used before definition | Pass 11 |
| Language doc unreachable or principle row broken | Pass 12 |
| Workflow embedded block drifted from its source | Pass 12 |
| `AGENTS.md` edited outside Phase P | Phase 0 Blocker |
| `AGENTS.md` missing a source-doc rule | P3 |
| Section Map row names a section that does not exist in `AGENTS.md` | P1 (row must name a real section) |
| Section Map row names a real section but the rule is not actually there | P1 (a Documentation Map filename is a pointer, not a mirror) |
| Section Map row relabelled `not mirrored` to clear a P3 finding | P3 step 5 (user decision, not the agent's) |
| Section Map row destination left ambiguous between AGENTS.md and a workflow | P1 |
| `AGENTS.md` over the size budget | P4 |
| Sibling-repo AGENTS.md copy diverged | P6 |
