---
description: Finalize documentation - validate docs to convergence, fix findings, then propagate to the canonical AGENTS.md and embedded workflow blocks. Optional check mode is report-only.
---

# Finalize Docs Workflow

This is the one workflow that makes a documentation change official. It validates the docs with passes that produce evidence. It fixes what the passes find. It validates again until the state converges. Only then does it propagate the clean state into each derived artifact. The derived artifacts are the canonical `AGENTS.md` and the embedded rule blocks in the workflows.

Invoke as: `/finalize-docs` (full loop) or `/finalize-docs check` (report only, no file writes).

Run it after each addition, modification, rename, move or removal in `docs/` or in a `.devin/workflows/` file. This includes a `/learn` run that places new knowledge.

## Operating Principle

> **Docs are the source of truth. Everything else is compiled.** `AGENTS.md` and the embedded blocks of the workflows are derived artifacts. Only the Propagate phase of this workflow writes them, and only from validated docs. If a derived artifact changed outside this workflow, that is a Blocker, not a starting point.

## Execution Contract (binding)

1. **Phases run in order:** Scope, Validate (passes 1-12), Fix, Validate again, Converge, Propagate, Report. Do not skip, merge or reorder them.
2. **Propagate runs only after convergence.** Documentation that is not validated never goes into `AGENTS.md` or an embedded block.
3. **Each pass produces evidence in the reply.** The evidence is the exact command or the set of files read, and the numeric counts. Each finding has a `file:line` citation and a severity. A pass without evidence is not complete, and it blocks the next pass.
4. **Declare an inapplicable pass. Do not skip it without a word.** Output `Pass N: inapplicable / Reason / Evidence`.
5. **Manual edits only.** Read the file, then apply each fix by hand with the editor tool. Do not use bulk `sed`/`awk`/`perl -pi` rewrites.
6. **`check` mode writes nothing.** Each fix and propagate step reports `would change` and does not edit.
7. **When you are not sure, STOP and ask.** Report a rule that is not clear or a convention that is not decided. Do not guess.

## Command Execution Rules

- **NEVER use `cd`** inside a command. Set the tool's `Cwd` parameter.
- Write one line for each command, or one `&&` chain. Pipe long output through `| tail -N`.
- A sweep grep exits non-zero when it is clean. That is the pass condition. Do not chain sweep greps with `&&`. Chain them with `;`.
- `// turbo` marks read-only detection steps that can run automatically. A mutation step never runs automatically.

## Severity Rules

| Severity | Meaning |
|---|---|
| Blocker | Build failure. Derived artifact edited outside this workflow. Source doc contradicts `AGENTS.md`. Local absolute path in published docs. Embedded-block drift. `AGENTS.md` over the budget ceiling |
| High | Broken link, missing subtype coverage, stale class-level term, code reference to a removed target, contradiction between a table and its detail |
| Medium | Stale wording that can mislead, duplicated rule with different wording, writing-style violation that affects clarity, agent-register (STE) violation in an agent file |
| Low | Minor style issue, weak wording, missing convenience cross-link |

---

## Phase 0 - Scope Detection

Build the blast radius before the validation passes.

1. List the changed files under `docs/`, `.devin/workflows/` and `AGENTS.md`.
2. If `AGENTS.md` changed outside the Propagate phase of this workflow, record a Blocker and stop.
3. For each changed file, name the conceptual change: addition, rename, removal, move, restructure or semantic shift.
4. For each changed concept, search all relevant workspace repositories for the old terms, new terms, section headings, package names and workflow names.
5. The blast radius is the union of the changed files and the files that refer to changed concepts.

Output:

```text
Phase 0 - Scope
Changed files: N
Changed concepts: M
Blast-radius files: K
Direct AGENTS.md edit: yes/no
```

## Pass 1 - Terminology Consistency

Question: does each blast-radius file use the current terminology?

Evidence required:

- A query for each old term and each new term.
- The `file:line` of each old-term occurrence.
- A classification of each occurrence: class-level, subtype-level, historical, changelog or false positive.

Output:

```text
Pass 1 - Terminology
Queries: [list]
Occurrences examined: N
Findings: M
  - path/file.md:42 - High - class-level old term remains
```

## Pass 2 - Link and Anchor Integrity

Question: does each internal link resolve, and does no link use a local filesystem path?

Evidence required:

- The count of Markdown links scanned in the blast-radius files.
- The file-existence result of each relative file link.
- The anchor-existence result of each cross-file `path#anchor` link **and** each same-file bare `#fragment` link. This includes the `On This Page` list of a file.
- The anchor checks use the built HTML as ground truth. Run the anchor audit script after the website build:

```
python3 website/scripts/anchor-audit.py [repo-root]
```

The script collects the heading ids from `website/DIST/**/*.html`. It checks each `[txt](path#anchor)` and `[txt](#anchor)` link in `docs/**/*.md` against them. It exits non-zero on a finding. A renamed heading breaks each inbound anchor, also the anchors in the same file.
- The count of absolute local path links.

> A successful website build is not evidence for this pass. VitePress does not validate heading fragments. A strict `ignoreDeadLinks: []` is not evidence that the anchors are correct. It checks that the linked files exist, not that the `#fragment` resolves. The anchor audit script finds what the build cannot find.

Rules (source: `docs/principles/documentation-authoring.md` - Path Portability):

- Use relative links for documentation files.
- Full HTTP links are permitted for external sites and package pages.
- An absolute local path such as `/Users/...` is a Blocker.

Output:

```text
Pass 2 - Links
Links scanned: N
Broken links: M
Absolute local links: K
```

## Pass 3 - Table to Detail Consistency

Question: do the summary tables agree with the detailed sections that they summarize?

Evidence required:

- Each summary table in the blast-radius files.
- A side-by-side comparison of each table row with its detailed section.
- The `file:line` of both claims.

Output:

```text
Pass 3 - Tables
Tables scanned: N
Rows compared: R
Findings: M
```

## Pass 4 - Subtype and Variant Completeness

Question: when a concept has subtypes or variants, do the general descriptions name all of them?

Evidence required:

- The authoritative subtype list and its source `file:line`.
- Each general description of the concept in the blast-radius files.
- For each description: the subtypes that it names.

Rules:

- General definitions, overview tables and top-level concept sections must name all subtypes.
- A section about one subtype can discuss only that subtype.

Output:

```text
Pass 4 - Subtypes
Concept: [name]
Authoritative subtypes: [list]
Generic descriptions checked: N
Findings: M
```

## Pass 5 - Decision Logic and Naming Symmetry

Question: when a rule, decision tree, naming pattern or convention occurs more than one time, do all instances agree?

Evidence required:

- A verbatim quote from each location.
- The `file:line` of each quote.
- A statement: do the wording, the conditions and the conclusion match?

This pass also finds implicit naming asymmetry. Sibling headings, skeletons, table rows or templates can form a set. If they do, their names must use the same level of abstraction, unless the docs state why they are different.

**Layer check (a rule that agrees with itself can still be at the wrong layer).** Do these steps:

1. Take each absolute rule in the blast radius under `docs/principles/`, `docs/ai/` and `docs/dev/`. This means the "never do X" form, the "always do Y" form and each single named remedy.
2. For each rule, name a repository or deployment where the rule is false.
3. If one exists, the rule depends on a policy and is at the wrong layer. It must then state only the mechanism. The policy part goes to the standing-rule file of the repository that owns it. When nothing is declared, the unsurprising behavior is the default.
4. Journal a temporary convention as a condition in the cause of a pitfall, never as a premise inside a rule. Source: `docs/dev/pitfalls.md` entry V5.

Output:

```text
Pass 5 - Rule Agreement
Rules or naming sets examined: N
Absolute rules layer-checked: A
Findings: M
```

## Pass 6 - Writing Style and Prose Quality

Question: do the changed files follow the documented writing rules for their register?

Source of truth: `docs/principles/documentation-authoring.md` (Two Registers, Prose Mechanics, Banned Vocabulary).

First, put each changed file in its register. Agent register: `AGENTS.md`, workflow files, skill wrappers and plan files. Human register: `docs/` and READMEs.

Mandatory checks for every file:

| # | Rule | Required check |
|---|---|---|
| 1 | No em dash characters | Search for the Unicode U+2014 character |
| 2 | No double hyphen as em dash | Search for space + double hyphen + space |
| 3 | No banned phrases | Search for the banned phrase list from `docs/principles/documentation-authoring.md` |
| 4 | Sentence length | Human register: an analytic check for sentences over 30 words. Agent register: check 10 |
| 5 | American English | Search for the usual British spellings listed in `docs/principles/documentation-authoring.md` |
| 6 | Table-cell punctuation | Find table cells that end with a period, and classify valid multi-sentence exceptions |
| 7 | Angle-bracket placeholders | Search for a bare `<name>` outside backticks and fenced code |
| 8 | Session-specific language | Search for temporal or conversation-specific phrases per `docs/principles/documentation-authoring.md` |
| 9 | Preamble wording | Search for the preamble openings that `docs/principles/documentation-authoring.md` bans |

Mandatory checks for agent-register files:

| # | Rule | Required check |
|---|---|---|
| 10 | STE mechanics | Run the STE check below. It finds instructions over 20 words, sentences over 25 words, semicolons and contractions. Zero findings |
| 11 | Condition first | Read each conditional instruction. The condition comes before the command |
| 12 | Imperative and active | Read each instruction. It uses the imperative. Each description uses the active voice and the simple present tense |
| 13 | No omitted words | Read each sentence. It keeps its subject, its verb and its articles |
| 14 | One word, one meaning | Each technical name is the same in each occurrence. A noun cluster has three words or fewer |

// turbo
```bash
# Cwd = codebase-superloom
python3 website/scripts/ste-check.py AGENTS.md .devin/workflows/*.md
```

Before you trust a zero result, prove that the STE check finds a planted sentence with a semicolon.

Output:

```text
Pass 6 - Writing Style
Files checked: N (agent register: A, human register: H)
Rule checks run: 14
Findings: M
```

## Pass 7 - File Organization, Table of Contents, and Companion Docs

Question: can readers find the files, are the files in the correct place, and is each file organized correctly?

Evidence required:

- For new or moved files: the chosen folder and the reason.
- For each blast-radius file: the `On This Page` block, checked against the heading ids of the built HTML. Run the TOC check script after the website build:

```
python3 website/scripts/toc-generate.py [repo-root] --check
```

The script exits non-zero if an `On This Page` block is stale (the heading text or the anchor does not match the built HTML). `On This Page` blocks are generated. A stale block means that a person edited it by hand, or that a heading was renamed and the generator did not run again.
- The companion docs block, compared with the related files that the body refers to.
- The index or parent page from which each new file can be reached.

Output:

```text
Pass 7 - Organization
New files: N
Moved files: M
TOC mismatches: K
Unreachable files: L
```

## Pass 8 - Docs to Codebase Drift

Question: do the documented functions, files, modules, package names and config keys still exist?

Evidence required:

- Each code reference in the blast-radius files: file paths, function calls, exported names, package names, config keys, workflow names.
- An existence check with file search or code search.
- The `file:line` of each broken reference.

Output:

```text
Pass 8 - Docs/Code Drift
References scanned: N
Broken references: M
```

## Pass 9 - Artifacts Alignment Across Workspace Repos

Question: do the templates, checklists, workflows and reference implementations follow the current documented rules?

Evidence required:

- The workflow files checked in each workspace repository that has `.devin/workflows/`.
- The checklists checked in docs and workflows.
- The templates and skeletons checked against the rules that they show.
- The reference implementations, verified to exist.

Repo scope:

- Start with the current repository.
- Include the sibling workspace repositories that have `.devin/workflows/` or that `docs/dev/org-structure.md` lists.
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

Question: does the docs website build, and does it include the current docs surface?

Evidence required:

- Run `npm run build` from `website/` when the repository has a `website/package.json`.
- Verify exit code 0.
- Record the critical build errors and the informational warnings separately.
- Verify that the `website/docs/` sync output exists after the build, when the site uses a docs sync step.
- Check that the sidebar, the nav, the index or a parent page links to each touched doc.

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

Question: are concepts defined before their first use, and are they referred to in a logical order?

Evidence required:

- The capitalized project terms, acronyms, class names, pattern names and config keys, in the order of their first appearance.
- For each term: is it defined inline or linked at its first use?
- The forward references, checked against the real order of the sections.

Rules:

- Expand or link an acronym at its first use, unless it is a widely known technical name that the same family of files already uses.
- Define or link a framework-specific term at its first use.
- A forward reference must point to a section that exists.
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

Question: do the contracts of the three layers hold, and are the embedded blocks of the workflows in sync with their sources?

Evidence required:

- Each `docs/languages/[lang]/` document can be reached from the `index.md` document map of that layer, and each mapped principle file exists.
- Each row of a `principles/` Language Implementations table resolves to an existing file.
- Each embedded block of a workflow (marked with its `docs/` source) is compared with its source for drift, in each workspace repository with `.devin/workflows/`.

Severity: embedded-block drift is a Blocker. A missing implementations row is High.

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

1. Fix each Blocker and High finding. Fix each Medium finding, unless the user defers it explicitly. Fix each Low finding, or list it as deferred with a reason.
2. In `check` mode: fix nothing. Assemble the full findings table and go to Report.
3. After the fixes, run again each pass that produced a finding. Always run Passes 1, 2 and 8 again.
4. Exit only after **two validation rounds in a row with zero new Blocker, High or Medium findings**. A fix after a clean round resets the count.
5. State the convergence explicitly: "Round N found zero new findings. The previous round was also clean. Converged."

Propagate does not run until this gate passes.

---

## Phase P - Propagate to Derived Artifacts

> This is the only place where `AGENTS.md` is edited. In `check` mode, each step reports `would change` and writes nothing.

### P1 - Section Map (canonical)

Each section in `AGENTS.md` mirrors a specific subtree of `docs/`. If a new docs section must mirror into `AGENTS.md`, extend this table first, in the same change.

**P1.0 - Coverage gate (hard gate).** Before any P1 work, run the coverage script. It confirms that each `docs/**/*.md` file has a row in this table:

```
bash website/scripts/section-map-coverage.sh [repo-root]
```

If the script reports unmapped files, add a row for each of them before you continue. A file with no mirror destination gets `not mirrored (reference material)` with a reason. Do not skip this step. An unmapped file is invisible to P3, and its rules drop out of `AGENTS.md` without a sign.

The real `AGENTS.md` sections: Golden Rule callout (header), Persona, Tech Stack, Documentation Map, AI Behavior Rules, Safe Terminal Patterns, Boundaries, Directory Map, Workflow Inventory.

**A row must name the section that holds the compressed rule.** A filename in the Documentation Map table is a pointer, not a mirror. Do not invent a mirror location to make a row look complete.

The destination has one of three values (a closed set):

| Destination | Meaning |
|---|---|
| `[AGENTS.md section name]` | A compressed rule is in the named `AGENTS.md` section |
| `not mirrored (reference material)` | Looked up for each task, not compressed on purpose. P3 skips it |
| `mirrored to workflow: [workflow-name]` | The rule applies only to a lifecycle, so it lives in the embedded Standard of the named workflow. P3 checks the workflow, not `AGENTS.md` |

| `docs/` source | `AGENTS.md` section |
|---|---|
| `docs/principles/engineering-philosophy.md` | Persona + Golden Rule callout + AI Behavior Rules (before-inventing-search, reserved vocabulary, comments never cite `docs/`, idempotency guards compare fingerprints) |
| `docs/principles/documentation-authoring.md` | Golden Rule callout + AI Behavior Rules (no plan references, two registers, STE rules, site-form anchors, generated On This Page blocks) |
| `docs/principles/project-management.md` | AI Behavior Rules (product management layer) |
| `docs/principles/testing.md` | AI Behavior Rules (assertions pin exact values) |
| `docs/languages/js/code-formatting.md` | AI Behavior Rules (step comments, two-pass check) |
| `docs/languages/js/project-structure.md` | Directory Map |
| `docs/languages/js/error-handling.md` | AI Behavior Rules (three-category error disposal + wrapper purity + service translation) |
| `docs/languages/js/module-structure.md` | mirrored to workflow: js-helper-module |
| `docs/languages/js/factory-vs-singleton.md` | not mirrored (reference material: a decision guide looked up for each task, which the js-helper-module workflow refers to) |
| `docs/principles/module-design.md` | AI Behavior Rules (class taxonomy reference, composition patterns) + Documentation Map |
| `docs/principles/composition-and-adapters.md` | AI Behavior Rules (composition and adapters doctrine) + Documentation Map |
| `docs/languages/js/module-classes.md` | not mirrored (reference material: class definitions and documentation footprints are looked up, not memorized) |
| `docs/languages/js/composition-and-adapters.md` | AI Behavior Rules (composition and adapters doctrine, JS-specific) + Documentation Map |
| `docs/languages/js/validation.md` | AI Behavior Rules (type-guard primitive rule) |
| `docs/languages/js/client/client-modules.md` | AI Behavior Rules (client naming taxonomy + loader-pattern rule) |
| `docs/languages/js/client/components.md` | AI Behavior Rules (component accessibility aria-* rule + theme token contract + named barrel) |
| `docs/languages/js/client/theming.md` | AI Behavior Rules (RNW native projection rule + scheme versus variant doctrine + generated artifact provenance) |
| `docs/languages/js/client/fonts.md` | AI Behavior Rules (theme-names/host-loads contract + manifest style entry rule) |
| `docs/languages/js/client/client-loader.md` | not mirrored (reference material: the Lib container table of the loader is looked up for each task) |
| `docs/languages/js/client/client-architecture.md` | not mirrored (reference material: the stack decision and the project layout are looked up for each task) |
| `docs/languages/js/client/super-app.md` | not mirrored (reference material: the shape registry and the route wrapper patterns are looked up for each task) |
| `docs/languages/js/conventions-registry.md` | not mirrored (reference material: a lookup table scanned for each task) |
| `docs/languages/js/function-naming.md` | AI Behavior Rules (verb-first naming rule, banned verbs) |
| `docs/languages/js/publishing.md` | Boundaries / Never (publish is CI-only) + Safe Terminal Patterns (same-version republish for generated packages) |
| `docs/languages/js/module-thoughts-file.md` | Directory Map (THOUGHTS.md in standard files list) |
| `docs/languages/js/dependencies.md` | AI Behavior Rules (peer dependencies declare full runtime contract) |
| `docs/languages/js/module-docs.md` | Directory Map (standard files per module line) |
| `docs/languages/js/index.md` | AI Behavior Rules (two-form naming rule) |
| `docs/languages/js/catalog-client.md` | not mirrored (reference material: the naming taxonomy rule comes from `client/client-modules.md`) |
| `docs/languages/js/server/*` | not mirrored (reference material: the contracts of the server layer are looked up for each task) |
| `docs/languages/js/testing-strategy.md`, `unit-test-authoring.md`, `module-testing.md` | AI Behavior Rules (run tests, assertions pin exact values, generated package provenance) + Safe Terminal Patterns (module testing contract) |
| `docs/languages/js/pitfalls-migration.md` | AI Behavior Rules (two-pass check reference) |
| `docs/languages/js/versioning/bump-checklist.md` | Boundaries / Never (publish is CI-only) + Safe Terminal Patterns (pre-publish gate) |
| `docs/languages/js/versioning/dependency-management.md` | AI Behavior Rules (peer dependencies rule) |
| `docs/ai/agent-configuration.md` | Golden Rule callout (size budget, repo-local `AGENTS.md`). Session Modes (code words, reply rules). AI Behavior Rules (repository independence, local release policy, `MEMORY.md`, owner reports) |
| `docs/ai/workflow-authoring.md` | Workflow Inventory (descriptions + authoring standard + workflows in the agent register) |
| `docs/ai/workflow-archetypes.md` | Workflow Inventory (archetype family pointer line) |
| `docs/ai/model-tiering.md` | Session Modes (owner vocabulary line) + Workflow Inventory (model-tier split line) |
| `docs/dev/pitfalls.md` | Safe Terminal Patterns (all entries) |
| `docs/dev/testing-local-modules.md` | Safe Terminal Patterns (module testing contract) |
| `docs/dev/cicd-publishing.md` | Safe Terminal Patterns (CI chained publishes) |
| `docs/dev/local-ci-parity.md` | Safe Terminal Patterns (local CI parity contract) |
| `docs/dev/planning.md` | AI Behavior Rules (at session start) |
| `docs/dev/autonomous-execution.md` | AI Behavior Rules (autonomous execution protocol) |
| `docs/dev/org-structure.md` | Directory Map |
| `docs/ops/**` | (referenced as "see ops/" - not embedded) |
| `docs/README.md` | not mirrored (reference material: the top-level documentation index) |
| `docs/index.md` | not mirrored (reference material: the public landing page) |
| `docs/ai/index.md` | not mirrored (reference material: the navigation of the AI docs) |
| `docs/building-a-product/README.md` | not mirrored (reference material: the product-building process, looked up for each engagement) |
| `docs/dev/README.md` | not mirrored (reference material: the contributor onboarding index) |
| `docs/dev/mcp-github-setup.md` | not mirrored (reference material: IDE setup for each developer) |
| `docs/dev/npmrc-setup.md` | not mirrored (reference material: the npmrc walkthrough for each machine) |
| `docs/dev/onboarding-git-account.md` | not mirrored (reference material: one-time SSH and git identity setup) |
| `docs/dev/onboarding-github-packages.md` | mirrored to workflow: js-helper-module-publish |
| `docs/dev/repo-setup.md` | not mirrored (reference material: the one-time repository creation guide) |
| `docs/guide/getting-started.md` | not mirrored (reference material: the project setup walkthrough) |
| `docs/guide/ide-setup.md` | not mirrored (reference material: editor configuration recommendations) |
| `docs/guide/creating-entities-js.md` | not mirrored (reference material: the quick-start walkthrough for entity creation) |
| `docs/guide/adopting-superloom.md` | not mirrored (reference material: the use-mode walkthrough, looked up for each adoption) |
| `docs/principles/adopting-superloom.md` | not mirrored (reference material: the use-mode doctrine and workflow contract, looked up for each adoption) |
| `docs/principles/code-readability.md` | AI Behavior Rules (blank-line hierarchy, formatter cap, banners, public/private grouping, step-comment rules, step-comment checker) |
| `docs/principles/error-handling.md` | AI Behavior Rules (three-category error disposal, universal doctrine) |
| `docs/principles/extending-to-a-language.md` | not mirrored (reference material: the procedure to add a language layer. Its rules are mirrored through server-architecture, validation, versioning-and-releases and testing) |
| `docs/principles/file-archetypes.md` | AI Behavior Rules (one file one archetype, skeleton conformance) |
| `docs/principles/operations-documentation.md` | AI Behavior Rules (three-layer ops doc split, vendor-agnostic directories, secrets never inline) |
| `docs/principles/server-architecture.md` | AI Behavior Rules (MVC+service layers, one envelope, one-shape DTO, downward dependencies) |
| `docs/principles/third-party-libraries.md` | AI Behavior Rules (zero-dependency default, acceptance criteria) |
| `docs/principles/validation.md` | AI Behavior Rules (validation doctrine, universal. The JS implementation is mirrored through docs/languages/js/validation.md) |
| `docs/principles/versioning-and-releases.md` | AI Behavior Rules (SemVer, Conventional Commits, pipeline-only releases, pinned caret ranges) |
| `docs/languages/js/catalog-core.md` | not mirrored (reference material: the module catalog. The rules that can be enforced are in module-structure and module-classes) |
| `docs/languages/js/catalog-server.md` | not mirrored (reference material: the server module catalog. The rules that can be enforced are in module-structure and third-party-libraries) |
| `docs/languages/js/client/expo-guide.md` | not mirrored (reference material: Expo capability and setup. The adapter rules are in module-structure and composition-and-adapters) |
| `docs/languages/js/client/rn-environment-setup.md` | not mirrored (reference material: the local React Native environment setup) |
| `docs/languages/js/client/rn-testing.md` | AI Behavior Rules (UI acceptance four-gate model) + Safe Terminal Patterns (stale dev server, presence-only E2E) |
| `docs/languages/js/dto-philosophy.md` | AI Behavior Rules (one canonical builder per entity, absent keys not added, public DTOs derive from internal) |
| `docs/languages/js/integration-testing.md` | not mirrored (reference material: the real-cloud integration test setup, looked up for each test run) |
| `docs/languages/js/module-docs-complex.md` | mirrored to workflow: js-helper-module |
| `docs/languages/js/versioning/index.md` | not mirrored (reference material: the navigation of the versioning section) |
| `docs/languages/js/versioning/semantic-versioning.md` | not mirrored (reference material: the SemVer 2.0.0 reference. The rules are in versioning-and-releases) |
| `docs/languages/js/versioning/api-stability-js.md` | not mirrored (reference material: the JS API-stability reference. The rules are in versioning-and-releases and publishing) |
| `docs/languages/js/versioning/changelog-format.md` | not mirrored (reference material: the changelog template, looked up to write CHANGELOG.md) |
| `docs/languages/js/versioning/ci-dependency-graph.md` | not mirrored (reference material: the recipe book for CI job dependencies) |
| `docs/languages/js/versioning/version-bump-section.md` | not mirrored (reference material: the template of the README versioning section) |

### P2 - Session Diff and Full-Doc Audit

1. For each file changed in this session under `docs/` or `.devin/workflows/`, find its `AGENTS.md` section in the Section Map. Read the new source content and compare it with the current `AGENTS.md` section.
2. Then walk the full `docs/` tree in this fixed order. Compare each file with its mirrored section for drift.
   - `principles/`
   - `languages/js/`, with `server/` and `versioning/`
   - `ai/`, then `dev/`
   - the `ops/` index only
3. Apply compressed corrections with the Compression Discipline below. If a section has three or more stale rules, write that section again from its sources. Do not patch it.
4. If a touched file has no entry in the Section Map, ask the user where it mirrors, or if it mirrors at all. Then extend the Section Map in the same change.

### P3 - Unmirrored Rule Scan (hard gate)

P2 finds drift. This step finds omissions: rules that are in `docs/` and have no compressed form in `AGENTS.md`.

1. For each file in the Section Map, extract each sentence or list item with a rule marker. The rule markers are below.
   - `must`, `must not`, `should`, `should not`, `never`, `always`
   - `required`, `forbidden`, `do not`, `only`, `prefer`, `avoid`
   - `use`, `run`, `write`, `create`, `delete`, `update`
2. Each item of the inventory carries its `source file:line`.
3. For each item, search `AGENTS.md` for a compressed rule that keeps both the condition and the conclusion. A conclusion without its condition is not mirrored.
4. Add each missing compressed rule to the correct `AGENTS.md` section. In `check` mode, report `would update`.
5. Skip the sources whose Section Map row reads `not mirrored (reference material)`, but report the skip with a count. Do not change a row to `not mirrored` to clear a finding. That decision belongs to the user.
6. Do not check the sources whose Section Map row reads `mirrored to workflow: [name]` against `AGENTS.md`. Confirm that the embedded Standard of the named workflow carries the rule. Report these sources in their own count line. Do not change a row to `mirrored to workflow` to clear a finding. That decision belongs to the user.

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

This is a hard gate. P4 does not run until this step reports zero unmirrored rules, or the complete `would update` list in `check` mode.

### P4 - Write and Verify AGENTS.md

1. **Golden Rule check.** The Golden Rule callout stays the first content block. It refers to this workflow by its current name (`/finalize-docs`).
2. **Size budget (hard gate).** Count the lines. The target is 300 and the hard ceiling is 400 (`docs/ai/agent-configuration.md` - The Size Budget). Over the ceiling: compress more, change rules to one-line pointers, or move lifecycle-only content into the workflow that owns it. Do not raise the ceiling.
3. **Table of contents.** If `AGENTS.md` has an explicit table of contents, generate it again from the real `##` headings.
4. **Internal links.** Each relative path in `AGENTS.md` must point to a file that exists under `docs/` or the repository root.
5. **Workflow inventory.** Write one line for each workflow of the workspace. Each line matches the current `description:` frontmatter and the verbs of that workflow file.
6. **Register.** `AGENTS.md` is in the agent register. Run the STE check of Pass 6 on it. The result must be zero findings.

### P5 - Embedded Workflow Blocks

Examine each workflow in each workspace repository with `.devin/workflows/`. If a `docs/` source that feeds one of its embedded blocks (marked with its source path) changed in this session, the block must change.

**Three paths, by what changed:**

1. **Language docs changed** (for example, `docs/languages/js/module-structure.md` was edited). The embedded Standard block in the Build workflow of the target repository is stale. Run `/compile-workflows-from-docs [target-repo] [lang]` to generate the workflow family again from the archetype specifications and the updated language docs. The compile workflow verifies itself through a headless workshop. When the source docs changed, do not patch embedded blocks by hand. The generator is the correct tool.

2. **Archetype specifications changed** (for example, `docs/ai/workflow-archetypes.md` was edited). All workflow families in all implementation repositories are stale. Run `/compile-workflows-from-docs [target-repo] [lang]` for each implementation repository that has `.devin/workflows/`. The generator writes the updated workflow files from the new archetypes.

3. **Content inside a workflow changed** (a sweep command or a gate was added directly to a workflow file). If a docs change did not cause it, update the workflow file in place. This is the only case where a manual patch is correct.

**Detection:** check if a file under `docs/ai/workflow-archetypes.md` or `docs/languages/[lang]/` changed in this session. If yes, path 1 or 2 applies. If only `.devin/workflows/` files changed, path 3 applies.

This step closes two compile rules. They are `docs/ai/workflow-authoring.md` - Embedded Content and the Compile Rule, and `docs/ai/workflow-archetypes.md` - The Compile Rule.

### P6 - Verify Canonical AGENTS.md Placement

The compiled constitution `AGENTS.md` exists only at the root of the constitution repository. Examine each sibling repository of the workspace for a copy or a symlink of it.

A sibling repository has its own small `AGENTS.md`. It holds only what is true of that repository alone. That is its build and test commands, and each policy that the constitution gives to it, such as its release policy. Source: `docs/ai/agent-configuration.md` - Repository Independence, Release Policy Is Repository-Local. That file is not a propagation target, and this workflow never writes it.

Drift is a sibling file that copies, symlinks or restates a compiled rule of the constitution. Report its repository, the file type and the restated rule. Remove or trim it only with explicit approval of the user. Then verify that the canonical file did not change.

### Compression Discipline

Each line written to `AGENTS.md` follows `docs/principles/documentation-authoring.md`:

- **Agent register.** Write each line in ASD-STE100 Simplified Technical English (Two Registers). One instruction per sentence. An instruction has 20 words or fewer. The condition comes first. Use the imperative, and omit no words.
- **Tables over prose.** A rule with attributes becomes a table. A one-shot statement becomes a bullet.
- **One rule is one line** where possible.
- **Remove preamble.** Start with the rule.
- **Cross-reference. Do not duplicate.** A rule detailed in `docs/` shows as one compressed line and `See docs/[path].md`.
- **No code examples**, unless text cannot express the rule.
- **Keep the Golden Rule callout at the top.** It refers to this workflow by its current name.

### When Knowledge Is New (Not Just Drifted)

If new knowledge came up that is not yet in `docs/`:

1. **STOP.** Do not write it directly to `AGENTS.md` or to a workflow.
2. Tell the user: "This is a new rule. Run `/learn [description]` first to place it in the canonical doc."
3. After `/learn` is complete, run `/finalize-docs` again.

This makes sure that derived artifacts never state a rule that `docs/` does not also state.

---

## Final Report

Output one consolidated findings table, then the pass status, then the propagation summary:

```text
| Severity | Pass | File | Line | Issue | Fix |
|---|---|---|---|---|---|

| Pass | Status | Evidence Count |
|---|---|---|

| Derived artifact | Source | Change |
|---|---|---|
```

Do not write a prose summary. Do not write validation phrases.

## Loop-backs

- A pass finding: fix it, run the affected passes again. The convergence count resets.
- P3 finds unmirrored rules: add them, then run P3 again.
- P4 budget breach: compress, demote or move content, then run P4 again.
- A convention is undecided: STOP and ask. After the decision, put the answer into `docs/` with `/learn`, then run this workflow again.

## Self-Improvement (every run, last step)

This run can show a failure mode that no pass catches. If it does, do these steps:

1. Journal it in the correct pitfall file first.
2. Extend a pass or add a pass in this file, in the same session.
3. Record both in the Failure Mode Catalog below.

## Per-run Verification Checklist

- [ ] Mode declared (`full` or `check`), scope built with counts (Phase 0)
- [ ] Passes 1-12 run or declared inapplicable, each with evidence counts
- [ ] All Blocker, High and Medium findings fixed (or listed in `check` mode)
- [ ] Converged: two clean validation rounds in a row, stated explicitly
- [ ] P2 session diff and full-doc audit done, sections with pervasive drift written again
- [ ] P3 unmirrored rule scan reports zero (or the complete `would update` list)
- [ ] P4: Golden Rule first, budget within the ceiling, table of contents and links verified, workflow inventory current, STE check zero
- [ ] P5 embedded blocks synced across all workspace repositories
- [ ] P6 sibling-repository copies checked (a change only with user approval)
- [ ] Final report tables output
- [ ] New failure modes journaled and cataloged

## Failure Mode Catalog

Add each new failure mode found in a run here. If no pass catches the new failure mode, add a pass or extend a pass.

| Failure mode | Caught by |
|---|---|
| Concept renamed but old references remain | Pass 1 |
| Concept removed but references remain | Pass 1 and Pass 8 |
| Heading renamed and inbound anchors break | Pass 2 (anchor-audit.py) |
| Heading renamed and the file's own `On This Page` anchor breaks | Pass 2 (anchor-audit.py) |
| Green website build accepted as anchor evidence | Pass 2 (the build is explicitly not evidence, anchor-audit.py is the gate) |
| Anchor written in GitHub form instead of site form | Pass 2 (anchor-audit.py finds the slugifier divergence) |
| `On This Page` block edited by hand or stale after a heading rename | Pass 7 (toc-generate.py --check) |
| Local filesystem path in published docs | Pass 2 |
| Summary table and detailed section disagree | Pass 3 |
| Concept gets a subtype but general docs name only the old subtypes | Pass 4 |
| Same decision rule diverges across files | Pass 5 |
| Sibling names use different levels of abstraction | Pass 5 |
| A transitional repository policy is stated as permanent framework doctrine | Pass 5 layer check (pitfalls V5) |
| Writing-style rule is violated | Pass 6 |
| Agent file not in Simplified Technical English | Pass 6 (checks 10-14, ste-check.py) |
| New file is in the wrong place or cannot be reached | Pass 7 |
| Documentation refers to removed code | Pass 8 |
| Workflow or checklist refers to stale docs concepts | Pass 9 |
| Website build fails or a touched doc cannot be reached | Pass 10 |
| Term used before its definition | Pass 11 |
| Language doc cannot be reached or a principle row is broken | Pass 12 |
| Embedded block of a workflow drifted from its source | Pass 12 |
| `AGENTS.md` edited outside Phase P | Phase 0 Blocker |
| `AGENTS.md` misses a rule of a source doc | P3 |
| Section Map row names a section that does not exist in `AGENTS.md` | P1 (a row must name a real section) |
| `docs/` file with no Section Map row | P1.0 (coverage gate, run `section-map-coverage.sh`) |
| Section Map row names a real section, but the rule is not there | P1 (a Documentation Map filename is a pointer, not a mirror) |
| Section Map row changed to `not mirrored` to clear a P3 finding | P3 step 5 (a user decision, not the agent's) |
| Section Map row destination not clear between AGENTS.md and a workflow | P1 |
| `AGENTS.md` over the size budget | P4 |
| Sibling repository has an AGENTS.md copy or symlink | P6 |
