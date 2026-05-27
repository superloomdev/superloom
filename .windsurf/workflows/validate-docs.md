---
description: Validate documentation consistency after any docs change with evidence-based passes
---

# Validate Docs Workflow

Run this workflow after any addition, modification, rename, move, or removal in `docs/` or any `.windsurf/workflows/` file.

`AGENTS.md` is a derived file. This workflow may inspect `AGENTS.md`, but it must not edit it. If `AGENTS.md` changed outside `/compile-agents-md`, treat that as a Blocker.

Run `/compile-agents-md sync` only after this workflow is clean.

## Invocation

Use this workflow when:

- A documented concept was added, renamed, removed, or restructured.
- Content moved between documentation files.
- A workflow file changed.
- `/learn` added new knowledge.
- A documentation change is ready for review or commit.

## Enforcement Rules

Every pass must produce evidence. A pass without evidence is incomplete and blocks the next pass.

For every pass, output:

1. The exact command, query, or file-read set used.
2. The numeric count of items examined.
3. The numeric count of findings.
4. File:line citations for every finding.
5. Severity for every finding: Blocker, High, Medium, or Low.

If a pass is not relevant, do not skip it silently. Output:

```text
Pass N: inapplicable
Reason: [specific reason]
Evidence: [count or file list proving why]
```

## Severity Rules

| Severity | Meaning |
|---|---|
| Blocker | Build failure, direct `AGENTS.md` edit, source-doc to `AGENTS.md` contradiction, local absolute path in published docs, or a workflow hard gate failure |
| High | Broken link, missing subtype coverage, stale class-level term, code reference to removed target, table-detail contradiction |
| Medium | Stale wording that could mislead, duplicated rule with divergent wording, writing-style violation that affects clarity |
| Low | Minor style issue, weak wording, missing convenience cross-link |

## Phase 0 - Scope Detection

Build the blast radius before running validation passes.

1. List changed files under `docs/`, `.windsurf/workflows/`, and `AGENTS.md`.
2. If `AGENTS.md` changed directly and the current task is not `/compile-agents-md`, record a Blocker and stop.
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
- Anchor existence result for every `path#anchor` link.
- Count of absolute local path links.

Rules:

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

Source of truth:

- `docs/dev/documentation-standards.md`
- `docs/dev/documentation-authoring.md`

Mandatory checks:

| # | Rule | Required check |
|---|---|---|
| 1 | No em dash characters | Search for the Unicode U+2014 character |
| 2 | No double hyphen as em dash | Search for space + double hyphen + space |
| 3 | No banned phrases | Search for the banned phrase list from `docs/dev/documentation-standards.md` |
| 4 | Sentence length | Analytic check for sentences over 30 words |
| 5 | American English | Search for common British spellings listed in the style guide |
| 6 | Table-cell punctuation | Check table cells ending in periods; classify valid multi-sentence exceptions |
| 7 | Angle-bracket placeholders | Search for bare `<name>` outside backticks and fenced code |
| 8 | Session-specific language | Search for temporal or conversation-specific phrases from `docs/dev/documentation-authoring.md` |
| 9 | Preamble wording | Search for preamble openings banned by `docs/dev/documentation-authoring.md` |

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

- Workflow files checked across workspace repositories that contain `.windsurf/workflows/`.
- Checklists checked in docs and workflows.
- Templates and skeletons checked against the rules they are meant to illustrate.
- Reference implementations verified to exist.

Repo scope:

- Start with the current repository.
- Include sibling workspace repositories that contain `.windsurf/workflows/` or are listed in `docs/dev/org-structure.md`.
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
- Check touched docs are reachable from the VitePress sidebar, nav, index page, or an intentionally linked parent page.

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

## Final Report

After all passes, output one consolidated table:

```text
| Severity | Pass | File | Line | Issue | Fix |
|---|---|---|---|---|---|
| High | 2 | docs/foo.md | 88 | Broken anchor | Update link to #new-heading |
```

Then output pass status:

```text
| Pass | Status | Evidence Count |
|---|---|---|
| Phase 0 | complete | 8 blast-radius files |
| Pass 1 | complete | 32 terms scanned |
```

## After Validation

1. Fix every Blocker and High issue.
2. Fix every Medium issue unless the user explicitly defers it.
3. Re-run Passes 1, 2, 8, and 10.
4. Run `/compile-agents-md sync` to update `AGENTS.md` through the canonical workflow.
5. Report final clean state with evidence counts.

## Self-Application

This workflow is itself a documentation artifact. When this file changes, apply:

- Pass 1 if the workflow name, command, or pass names changed.
- Pass 2 for internal links and workflow references.
- Pass 5 for consistency between enforcement rules, pass procedures, and output templates.
- Pass 6 for writing style.
- Pass 7 for file placement and discoverability.
- Pass 9 because workflow files are artifacts.
- Pass 11 for structural coherence.

## Failure Mode Catalog

New failure modes found during validation must be added here. If no pass catches the new failure mode, add a pass or extend an existing pass.

| Failure mode | Caught by |
|---|---|
| Concept renamed but old references remain | Pass 1 |
| Concept removed but references remain | Pass 1 and Pass 8 |
| Heading renamed and inbound anchors break | Pass 2 |
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
| `AGENTS.md` edited directly | Phase 0 Blocker |
| `AGENTS.md` missing source-doc rules | `/compile-agents-md` Phase 2.5 |
```
