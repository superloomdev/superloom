---
description: Compile concrete workflow families for any implementation repository from language-agnostic archetypes and language-specific documentation. Self-verifies through a headless workshop.
---

# Compile Workflows From Docs Workflow

This is the generator that compiles the concrete workflow files of an implementation repository again. Its inputs are the archetype specifications in `docs/ai/workflow-archetypes.md`, the language documentation in `docs/languages/[lang]/`, and the layout of the target repository. It runs from the constitution repository (`codebase-superloom`). It writes to the `.devin/workflows/` directory of the target repository.

Invoke as: `/compile-workflows-from-docs [target-repo] [language]`
Example: `/compile-workflows-from-docs [lang]-helper-modules [lang]`

## Operating Principle

> **Archetypes are language-agnostic. Concrete workflows are compiled.** The archetype specifications define the phase structure, the hand-off protocol and the family contract. The language docs give the content of the embedded Standard. The repository layout gives the concrete paths. The compile step puts the three together into workflow files that an inexpensive model can execute without judgment calls.

**Repository independence (hard gate).** This workflow lives in the constitution repository. It never contains the fixed paths of a dependent repository. The target repository and the language are runtime parameters. The `docs/` of the constitution never refer to the workflows or internals of a dependent repository.

**The constitution repository is a valid target.** The `js-helper-module` family lives in `codebase-superloom/.devin/workflows/`. The reason: the constitution repository is the composition root of the JavaScript module lifecycle. It holds the docs that the embedded Standard compiles from, and the family runs from there against module paths in any repository. So a target that is the constitution repository is expected. It does not contradict repository independence. Independence forbids that the `docs/` of the constitution name a dependent repository. It does not forbid that the constitution hosts a workflow family. Do not move the family to an implementation repository only because of the `[target-repo]` parameter.

## Execution Contract (binding)

1. **One target repository per run.** The invocation names the target repository.
2. **Phases run in order.** Do not skip, merge, reorder or parallelize them.
3. **No improvisation.** Use only the commands and templates in this file. If no instruction matches a situation, STOP and ask.
4. **When you are not sure, STOP.** Report what you see and ask.
5. **Manual edits only.** Write each workflow file by hand with the editor tool. Do not use scripts or bulk generation.
6. **Read before you write.** Read the archetype specifications, the language docs and the existing workflow files before you generate.
7. **Agent register.** Write each generated file in ASD-STE100 Simplified Technical English (`docs/ai/workflow-authoring.md` - Structure of a Workflow File). Keep the headings, step numbers, gate names, commands and output templates of the existing files. Plans and other workflows refer to them.

## Command Execution Rules

- **NEVER use `cd`** inside a command. Set the tool's `Cwd` parameter.
- Write one line for each command, or one `&&` chain. Pipe long output through `| tail -N`.
- `// turbo` marks read-only steps that can run automatically. A mutation step never runs automatically.

---

## Phase G0 - Scope and Inputs

1. **Declare the target.** State the name of the target repository, the language and the prefix of the workflow family. Write one line: "Compiling [family-prefix] workflows for [target-repo] from [language] docs."

2. **Read the archetype specifications:**
   // turbo
   ```bash
   # Cwd = codebase-superloom
   cat docs/ai/workflow-archetypes.md
   ```

3. **List the language docs that feed the embedded Standard:**
   // turbo
   ```bash
   # Cwd = codebase-superloom
   find docs/languages/[lang] -name '*.md' | sort
   ```

4. **Read the layout of the target repository:**
   // turbo
   ```bash
   # Cwd = [target-repo]
   find . -maxdepth 2 -type d -not -path '*/node_modules/*' -not -path '*/.git/*' | sort
   ```

5. **List the existing workflow files of the target repository:**
   // turbo
   ```bash
   # Cwd = [target-repo]
   find .devin/workflows -name '*.md' | sort
   ```

6. **Read each existing workflow file in full.** These are the files that you generate again. You must know their current state to make a correct diff.

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

The embedded Standard block is the set of rules compiled from the language docs. It is the single source of truth for what the Build and Audit workflows check.

1. **Read the re-ground set.** These are the documents whose rules make the embedded Standard. If the Build workflow of the target repository exists, its embedded Standard block declares the current re-ground set. For a new language, get it from the phase structure of the Build archetype and from `docs/languages/[lang]/index.md`.

2. **For each document of the re-ground set, extract these items:**
   - The normative rules of the document (statements with must, never, always, required or forbidden)
   - The structural invariants (loader signature, companion files, naming rules and similar)
   - The source path of each rule, for the citation

3. **Assemble the embedded Standard block** as it shows in the generated Build workflow:
   - Re-ground set (an ordered list of docs, each with its purpose)
   - Structural invariants (each with its source citation)
   - Formatting rules
   - Naming rules
   - Testing rules
   - Documentation rules

4. **Output the extracted Standard with the citation counts:**
   ```text
   G1 - Embedded Standard
   Re-ground set: N documents
   Structural invariants: M rules
   Citations verified: K
   ```

## Phase G2 - Generate Build Workflow

Generate the `[prefix].md` workflow file (the Build archetype: create and fix).

1. **Frontmatter:** `description: [one line: what it does and its verbs]`

2. **Header:** the workflow name, purpose, invocation form and verb table (create and fix).

3. **Operating Principle:** trust nothing in working memory. Get each rule again from the files.

4. **Execution Contract:** one module per run, phases in order, no improvisation, manual edits only.

5. **Command Execution Rules:** no `cd`, one line for each command, turbo markers.

6. **The Standard (embedded):** the block of G1, with its source citation header.

7. **Verb: create:** class first, re-ground, generate from the skeleton, adapter and extension lifecycle, register environment variables, run the fix phases.

8. **Verb: fix:** Phases A-E (Re-ground, Audit, Apply, Verify to Convergence, Present). Include all sweep commands, gate checks and convergence rules.

9. **Loop-backs:** a Phase D failure goes to Phase C. A change request from the user goes to Phase D and E.

10. **Self-Improvement hook.**

11. **Per-run Verification Checklist.**

12. **Write the file** to `[target-repo]/.devin/workflows/[prefix].md`.

## Phase G3 - Generate Audit Workflow

Generate the `[prefix]-audit.md` workflow file (the Audit archetype: deep and read-only).

1. **Frontmatter:** `description: [one line: read-only deep audit with drift classification]`

2. **Header:** the workflow name, purpose and invocation form.

3. **Operating Principle:** trust nothing, get each rule again from the files, change nothing.

4. **When To Run:** a drifted agent, context compaction, work that continues, before fix or publish, a periodic health check.

5. **Command Execution Rules.**

6. **Phase 0: Activate and Scope.**

7. **Phase 1: Re-read the Constitution.** List all docs, read them in full, output the binding-rules checklist.

8. **Phase 2: Survey Sibling Modules.** List, categorize, read references, record the fingerprint.

9. **Phase 3: Line-by-line Audit.** Read two times, use the audit map, run the gates, converge.

10. **Phase 4: Diagnose Drift Root Cause.** Root cause, re-anchor plan, self-improve.

11. **Phase 4.5: Creator-Diff (three-bucket).** Bucket 1 (docs drift), Bucket 2 (code drift), Bucket 3 (intentional). A classification table with evidence.

12. **Phase 5: Report and Hand Off.** The report structure, the hand-off to `[prefix] fix`, STOP.

13. **Verification Checklist.**

14. **Write the file** to `[target-repo]/.devin/workflows/[prefix]-audit.md`.

## Phase G4 - Generate Publish Workflow

Generate the `[prefix]-publish.md` workflow file (the Publish archetype: release).

1. **Frontmatter:** `description: [one line: pre-publish gate, CI registration, version, release]`

2. **Header:** the workflow name, purpose and invocation form.

3. **Operating Principle:** only CI publishes.

4. **Execution Contract.**

5. **Command Execution Rules.**

6. **Phase 1: Pre-publish Gate.** Lint exit 0, clean-install tests pass.

7. **Phase 2: Package Identity.** Name, private, license, engines, registry, version.

8. **Phase 3: Ship Check.** `npm pack --dry-run`.

9. **Phase 4: CI Registration.** First publish only, job pair, chaining.

10. **Phase 5: Same-version Republish.** It depends on the policy in the `AGENTS.md` of the target repository, and a normal bump skips it. Delete the old versions and verify the 404.

11. **Phase 6: Commit.** Module only, approval gate, push.

12. **Phase 7: Verify CI Published.** Watch until green, make sure that the version is live, and compare the published shasum with the packed shasum.

13. **Loop-backs.**

14. **Self-Improvement hook.**

15. **Per-run Verification Checklist.**

16. **Write the file** to `[target-repo]/.devin/workflows/[prefix]-publish.md`.

## Phase G5 - Self-Verification (Headless Workshop)

The generator verifies itself with a headless workshop against dummy modules. This phase is mandatory. If the workshop is skipped, the compile failed.

1. **Create the workshop workspace** in `__dev__/workshop/`, outside each repository:
   // turbo
   ```bash
   # Cwd = project-superloom (workspace root)
   mkdir -p __dev__/workshop/dummy-modules
   ```

2. **Create three dummy modules** at different levels of complexity:
   - **Simple:** a Class A/B core module (for example `dummy-utils`), stateless, no dependencies
   - **Medium:** a Class F store adapter (for example `dummy-store-memory`), a stateful factory in memory
   - **Complex:** a Class E feature module (for example `dummy-feature`), with parts and several files

   Each dummy module is minimal on purpose: the entry file, three companions, `package.json`, the `_test/` set, `README.md` and `ROBOTS.md`. They do not need a publish, and they do not need to pass lint. They exist to exercise the audit and fix phases of the workflow.

3. **Run the Audit workflow** against each dummy module. Run it headless: read the workflow, execute its phases and produce the report in the conversation. Then verify these items:
   - The audit converges (two clean passes in a row, or documented findings).
   - Each citation in the report points to a real doc path.
   - The creator-diff classification gives bucket counts.

4. **Run the fix verb of the Build workflow** against one dummy module with an intentional defect:
   - Put one defect in the module (for example a wrong loader signature, or a missing companion).
   - Run fix phases A-E.
   - Verify that Phase B finds the defect and Phase C fixes it.
   - Verify that the run converges.

5. **Check the citations.** Each rule in the embedded Standard block must cite a real `docs/` path. Run:
   // turbo
   ```bash
   # Cwd = codebase-superloom
   grep -oE 'docs/[a-z/-]+\.md' [target-repo]/.devin/workflows/[prefix].md | sort -u | while read f; do test -f "$f" && echo "OK: $f" || echo "MISSING: $f"; done
   ```
   Module-relative paths (`docs/api.md`, `docs/configuration.md`, `docs/schemas.md`) resolve inside a module, not in the constitution. They are expected misses. Judge each one. Do not use the count as the verdict.

6. **Sweep-parity check (hard gate).** The Build and Audit workflows share one Standard. A sweep that is in one file and missing or narrower in the other is a compile defect. Extract each `git grep` pattern from both files and compare the two sets. Report each difference and fix it before the verdict.

7. **A dummy module must exercise the edge cases of each sweep, not only its happy path.** A sweep that only runs against conforming code never shows that it can tell a violation from a legal construct. Give at least one dummy a JSON import, a nested JSDoc block and a permitted raw `typeof` (argument-shape dispatch). Then a sweep that cannot tell those from violations fails here, not in a real module.

8. **Check the register.** Each generated file must pass the STE check with zero findings:
   // turbo
   ```bash
   # Cwd = codebase-superloom
   python3 website/scripts/ste-check.py [target-repo]/.devin/workflows/[prefix].md [target-repo]/.devin/workflows/[prefix]-audit.md [target-repo]/.devin/workflows/[prefix]-publish.md
   ```

9. **Write the workshop verdict:**
   ```text
   G5 - Workshop Verdict
   Dummy modules created: 3
   Audit runs: 3 (converged: Y/N)
   Fix run: 1 (defect caught: Y/N, fixed: Y/N, converged: Y/N)
   Citations checked: N (valid: M, missing: K)
   Sweep parity: [symmetric | N asymmetries -> fixed]
   STE check: [0 findings | N findings -> fixed]
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

3. After the approval, the changes are ready for a commit. The commit occurs in the normal workflow of the target repository, not here.

## Loop-backs

- The G5 workshop fails: diagnose the failure, go to G2, G3 or G4 to fix the generated workflow, then run G5 again.
- The citation check finds a missing doc: the embedded Standard refers to a doc that does not exist. STOP and ask.
- An existing workflow has content that the archetypes do not cover: STOP and ask if you keep it or discard it.

## Self-Improvement (every run, last step)

This run can show a failure mode or a gap in the archetype specifications or in this workflow. If it does, do these steps in this order:

1. Journal it with `/learn` in the correct pitfall file BEFORE you continue.
2. Run `/finalize-docs` in `codebase-superloom`.
3. Change this workflow or the archetype specifications, so that the next run benefits.
4. Update the active plan in `__dev__/plans/` and STOP.

## Per-run Verification Checklist

- [ ] Target repository, language and family prefix declared
- [ ] Archetype specifications read in full
- [ ] Language docs listed and read
- [ ] Layout of the target repository and existing workflows read
- [ ] Embedded Standard extracted with citations
- [ ] Build workflow generated (create and fix, all phases, embedded Standard, sweeps, gates)
- [ ] Audit workflow generated (deep, read-only, creator-diff, three buckets, hand-off to fix)
- [ ] Publish workflow generated (pre-publish gate, CI registration, version, release)
- [ ] Workshop: 3 dummy modules created, audit converged, fix found and fixed the defect
- [ ] Citations: each embedded Standard rule cites a real doc path
- [ ] STE check: zero findings on each generated file
- [ ] Workshop verdict: PASS
- [ ] Report presented, user approval requested
- [ ] New failure modes journaled, plan updated, STOPPED
