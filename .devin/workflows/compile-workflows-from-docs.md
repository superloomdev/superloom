---
description: Compile concrete workflow families for any implementation repository from language-agnostic archetypes and language-specific documentation. Self-verifies through a headless workshop.
---

# Compile Workflows From Docs Workflow

The generator that recompiles concrete workflow files for an implementation repository from the archetype specifications in `docs/ai/workflow-archetypes.md`, the language-specific documentation in `docs/languages/[lang]/`, and the target repository's layout. It is invoked from the constitution repo (`codebase-superloom`) and writes to the target repo's `.devin/workflows/` directory.

Invoke as: `/compile-workflows-from-docs [target-repo] [language]`
Example: `/compile-workflows-from-docs [lang]-helper-modules [lang]`

## Operating Principle

> **Archetypes are language-agnostic; concrete workflows are compiled.** The archetype specs define the phase structure, hand-off protocol, and family contract. The language docs provide the embedded Standard content. The repo layout provides the concrete paths. The compile step assembles all three into workflow files that an inexpensive model can execute without judgment calls.

**Repository independence (hard gate).** This workflow lives in the constitution repo and never hard-codes a dependent repo's paths. The target repo and language are runtime parameters. The constitution repo's `docs/` never references a dependent repo's workflows or internals.

## Execution Contract (binding)

1. **One target repo per run.** The target repo is named in the invocation.
2. **Phases run in order.** Never skip, merge, reorder, or parallelize.
3. **No improvisation.** Use only the commands and templates written here. A situation with no matching instruction means STOP and ask.
4. **When uncertain, STOP.** Report exactly what is seen and ask.
5. **Manual edits only.** Every workflow file is written by hand with the editor tool. No scripts, no bulk generation.
6. **Read before writing.** Read the archetype specs, the language docs, and the existing workflow files before generating.

## Command Execution Rules

- **NEVER use `cd`** inside a command; set the tool's `Cwd` parameter.
- One line per command, or a single `&&` chain. Pipe long output through `| tail -N`.
- `// turbo` marks read-only steps safe to auto-run. No mutation step is ever auto-run.

---

## Phase G0 - Scope and Inputs

1. **Declare the target.** State the target repository name, the language, and the workflow family prefix. Write one line: "Compiling [family-prefix] workflows for [target-repo] from [language] docs."

2. **Read the archetype specs:**
   // turbo
   ```bash
   # Cwd = codebase-superloom
   cat docs/ai/workflow-archetypes.md
   ```

3. **Enumerate the language docs that feed the embedded Standard:**
   // turbo
   ```bash
   # Cwd = codebase-superloom
   find docs/languages/[lang] -name '*.md' | sort
   ```

4. **Read the target repo's layout:**
   // turbo
   ```bash
   # Cwd = [target-repo]
   find . -maxdepth 2 -type d -not -path '*/node_modules/*' -not -path '*/.git/*' | sort
   ```

5. **Enumerate existing workflow files in the target repo:**
   // turbo
   ```bash
   # Cwd = [target-repo]
   find .devin/workflows -name '*.md' | sort
   ```

6. **Read every existing workflow file in full.** These are the files being regenerated. Understanding their current state is required to produce a correct diff.

7. **Output the input manifest:**
   ```text
   G0 - Inputs
   Target repo: [name]
   Language: [lang]
   Family prefix: [prefix]
   Archetype spec: docs/ai/workflow-archetypes.md
   Language docs: N files
   Existing workflows: M files
   ```

## Phase G1 - Extract Embedded Standard Content

The embedded Standard block is the compiled rules from the language docs. It is the single source of truth for what the Build and Audit workflows check.

1. **Read the re-ground set** (the documents whose rules form the embedded Standard). If the target repo's Build workflow already exists, its embedded Standard block declares the current re-ground set. For a new language, derive it from the archetype spec's Build archetype phase structure and `docs/languages/[lang]/index.md`.

2. **For each document in the re-ground set, extract:**
   - The document's normative rules (statements with must/never/always/required/forbidden)
   - The structural invariants (loader signature, companion files, naming rules, etc.)
   - The source path for each rule (for citation)

3. **Assemble the embedded Standard block** as it will appear in the generated Build workflow:
   - Re-ground set (ordered list of docs with their purpose)
   - Structural invariants (each with its source citation)
   - Formatting rules
   - Naming rules
   - Testing rules
   - Documentation rules

4. **Output the extracted Standard with citation counts:**
   ```text
   G1 - Embedded Standard
   Re-ground set: N documents
   Structural invariants: M rules
   Citations verified: K
   ```

## Phase G2 - Generate Build Workflow

Generate the `[prefix].md` workflow file (the Build archetype: create + fix).

1. **Frontmatter:** `description: [one line: what it does and its verbs]`

2. **Header:** Workflow name, purpose, invocation form, verb table (create + fix).

3. **Operating Principle:** Trust nothing in working memory; re-derive from files.

4. **Execution Contract:** One module per run, phases in order, no improvisation, manual edits only.

5. **Command Execution Rules:** No `cd`, one line per command, turbo markers.

6. **The Standard (embedded):** The block assembled in G1, with its source citation header.

7. **Verb: create:** Class first, re-ground, generate from skeleton, adapter/extension lifecycle, register env vars, run fix phases.

8. **Verb: fix:** Phases A-E (Re-ground, Audit, Apply, Verify to Convergence, Present). Include all sweep commands, gate checks, convergence rules.

9. **Loop-backs:** Phase D fails -> Phase C; user requests changes -> Phase D + E.

10. **Self-Improvement hook.**

11. **Per-run Verification Checklist.**

12. **Write the file** to `[target-repo]/.devin/workflows/[prefix].md`.

## Phase G3 - Generate Audit Workflow

Generate the `[prefix]-audit.md` workflow file (the Audit archetype: deep, read-only).

1. **Frontmatter:** `description: [one line: read-only deep audit with drift classification]`

2. **Header:** Workflow name, purpose, invocation form.

3. **Operating Principle:** Trust nothing, re-derive from files, read-only.

4. **When To Run:** Drifted agent, context compaction, resuming work, before fix/publish, periodic health check.

5. **Command Execution Rules.**

6. **Phase 0: Activate and Scope.**

7. **Phase 1: Re-read the Constitution** - enumerate all docs, read in full, output binding-rules checklist.

8. **Phase 2: Survey Sibling Modules** - enumerate, categorize, read references, record fingerprint.

9. **Phase 3: Line-by-line Audit** - read twice, audit map, gates, converge.

10. **Phase 4: Diagnose Drift Root Cause** - root cause, re-anchor plan, self-improve.

11. **Phase 4.5: Creator-Diff (three-bucket)** - Bucket 1 (docs drift), Bucket 2 (code drift), Bucket 3 (intentional). Classification table with evidence.

12. **Phase 5: Report and Hand Off** - report structure, hand to `[prefix] fix`, STOP.

13. **Verification Checklist.**

14. **Write the file** to `[target-repo]/.devin/workflows/[prefix]-audit.md`.

## Phase G4 - Generate Publish Workflow

Generate the `[prefix]-publish.md` workflow file (the Publish archetype: release).

1. **Frontmatter:** `description: [one line: pre-publish gate, CI registration, version, release]`

2. **Header:** Workflow name, purpose, invocation form.

3. **Operating Principle:** CI-only publishing.

4. **Execution Contract.**

5. **Command Execution Rules.**

6. **Phase 1: Pre-publish Gate** - lint exit 0, clean-install tests green.

7. **Phase 2: Package Identity** - name, private, license, engines, registry, version.

8. **Phase 3: Ship Check** - `npm pack --dry-run`.

9. **Phase 4: CI Registration** - first publish only, job pair, chaining.

10. **Phase 5: Same-version Republish** - delete old versions, verify 404.

11. **Phase 6: Commit** - module-only, approval gate, push.

12. **Phase 7: Verify CI Published** - watch green, confirm live.

13. **Loop-backs.**

14. **Self-Improvement hook.**

15. **Per-run Verification Checklist.**

16. **Write the file** to `[target-repo]/.devin/workflows/[prefix]-publish.md`.

## Phase G5 - Self-Verification (Headless Workshop)

The generator self-verifies by running a headless workshop against dummy modules. This phase is mandatory; a skipped workshop is a failed compile.

1. **Create the workshop workspace** (in `__dev__/workshop/`, outside any repo):
   // turbo
   ```bash
   # Cwd = project-superloom (workspace root)
   mkdir -p __dev__/workshop/dummy-modules
   ```

2. **Create three dummy modules** representing different complexity levels:
   - **Simple:** A Class A/B core module (e.g., `dummy-utils`) - stateless, no deps
   - **Medium:** A Class D store adapter (e.g., `dummy-store-memory`) - stateful factory, in-memory
   - **Complex:** A Class E feature module (e.g., `dummy-feature`) - parts, multiple files

   Each dummy module is intentionally minimal: entry file, three companions, `package.json`, `_test/` set, `README.md`, `ROBOTS.md`. They do not need to be published or even lint-clean; they exist to exercise the workflow's audit and fix phases.

3. **Run the Audit workflow** against each dummy module (headless: read the workflow, execute its phases, produce the report in the conversation):
   - Verify the audit converges (two consecutive clean passes or documented findings)
   - Verify every citation in the report points to a real doc path
   - Verify the creator-diff classification produces bucket counts

4. **Run the Build workflow's fix verb** against one dummy module with an intentional defect:
   - Inject one defect (e.g., a wrong loader signature, a missing companion)
   - Run fix phases A-E
   - Verify the defect is caught in Phase B and fixed in Phase C
   - Verify convergence is reached

5. **Check citation completeness:** every rule in the embedded Standard block must cite a real `docs/` path. Run:
   // turbo
   ```bash
   # Cwd = codebase-superloom
   grep -oE 'docs/[a-z/-]+\.md' [target-repo]/.devin/workflows/[prefix].md | sort -u | while read f; do test -f "$f" && echo "OK: $f" || echo "MISSING: $f"; done
   ```

6. **Write the workshop verdict:**
   ```text
   G5 - Workshop Verdict
   Dummy modules created: 3
   Audit runs: 3 (converged: Y/N)
   Fix run: 1 (defect caught: Y/N, fixed: Y/N, converged: Y/N)
   Citations checked: N (valid: M, missing: K)
   Verdict: [PASS | FAIL]
   ```

   A FAIL verdict blocks propagation. Report the failure and STOP.

## Phase G6 - Report

1. **Present the compile report:**
   ```text
   Compile Workflows Report
   Target: [target-repo]
   Language: [lang]
   Family: [prefix]
   
   Files generated:
   - [prefix].md (Build: create + fix)
   - [prefix]-audit.md (Audit: deep, read-only)
   - [prefix]-publish.md (Publish: release)
   
   Workshop verdict: [PASS | FAIL]
   Citations: N verified
   ```

2. **STOP.** Ask: "Workflows compiled and verified. Approve the changes to [target-repo]?"

3. On approval, the changes are ready for commit. The commit is done as part of the normal workflow in the target repo, not here.

## Loop-backs

- G5 workshop FAIL -> diagnose the failure -> return to G2/G3/G4 to fix the generated workflow -> re-run G5.
- Citation check finds missing docs -> the embedded Standard references a doc that does not exist -> STOP and ask.
- Existing workflow has content not covered by the archetypes -> STOP and ask whether to preserve it or discard it.

## Self-Improvement (every run, last step)

If this run exposed a failure mode or a gap in the archetype specs or in this workflow: journal it (`/learn` into the correct pitfall file) BEFORE moving on, run `/finalize-docs` in `codebase-superloom`, and amend this workflow or the archetype specs so the next run benefits. Then update the active plan in `__dev__/plans/` and STOP.

## Per-run Verification Checklist

- [ ] Target repo, language, and family prefix declared
- [ ] Archetype specs read in full
- [ ] Language docs enumerated and read
- [ ] Target repo layout and existing workflows read
- [ ] Embedded Standard extracted with citations
- [ ] Build workflow generated (create + fix, all phases, embedded Standard, sweeps, gates)
- [ ] Audit workflow generated (deep, read-only, creator-diff, three-bucket, hand-off to fix)
- [ ] Publish workflow generated (pre-publish gate, CI registration, version, release)
- [ ] Workshop: 3 dummy modules created, audit converged, fix caught and fixed defect
- [ ] Citations: every embedded Standard rule cites a real doc path
- [ ] Workshop verdict: PASS
- [ ] Report presented; user approval requested
- [ ] New failure modes journaled; plan updated; STOPPED
