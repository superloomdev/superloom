# Workflow Archetypes

The language-agnostic patterns that concrete workflow families are compiled from. Each implementation repository (`[lang]-helper-modules`) has a family of workflows generated from these archetypes plus its language-specific documentation and repo layout. This document is the source of truth for what a workflow family contains, how its members relate, and how they are generated.

## On This Page

- [What a Workflow Family Is](#what-a-workflow-family-is)
- [The Three Archetypes](#the-three-archetypes)
  - [Archetype 1: Build (create + fix)](#archetype-1-build-create-fix)
  - [Archetype 2: Audit (deep, read-only)](#archetype-2-audit-deep-read-only)
  - [Archetype 3: Publish (release)](#archetype-3-publish-release)
- [Family Contract](#family-contract)
  - [Naming Convention](#naming-convention)
  - [Shared Embedded Standard](#shared-embedded-standard)
  - [Hand-off Protocol](#hand-off-protocol)
  - [Repository Independence](#repository-independence)
- [The Compile Rule](#the-compile-rule)
  - [Inputs](#inputs)
  - [Output](#output)
  - [Verification](#verification)
  - [When to Recompile](#when-to-recompile)
- [Cross-References](#cross-references)

---
## What a Workflow Family Is

A workflow family is a set of workflows that together cover the full lifecycle of one artifact type in one implementation repository. For a helper-modules repository, the artifact is "a helper module" and the family is:

| Workflow | Archetype | Role |
|---|---|---|
| `/[prefix]` | Build | Create new modules; audit and fix existing ones |
| `/[prefix]-audit` | Audit | Deep, read-only audit with drift classification |
| `/[prefix]-publish` | Publish | Pre-publish gate, CI registration, version bump, release |

A family is not a single workflow with many verbs. Each member is a standalone workflow file with its own frontmatter, invocation, and execution contract. They share an embedded Standard block (the compiled rules from the constitution docs) and hand off to each other by name.

The family pattern exists because:

- **Separation of concerns.** A deep audit is a different operation from applying fixes, and publishing is a different concern from either. Combining them produces a workflow that is too large for an inexpensive model to execute without skipping.
- **Independent invocation.** A user who wants only an audit report (no changes) invokes the audit workflow. A user who wants to fix invokes the build workflow. A user who wants to publish invokes the publish workflow. No verb dispatch ambiguity.
- **Future extensibility.** When a new implementation repository appears for another language, the same archetypes generate a new family with different embedded content but identical structure.

---

## The Three Archetypes

### Archetype 1: Build (create + fix)

**Purpose:** Build new artifacts from skeletons, and audit and fix existing artifacts against the embedded standard.

**Verbs:** `create`, `fix`

**Phases:**
1. **Re-ground** - Re-read the constitution docs (the embedded Standard's re-ground set), re-derive the fingerprint from a clean reference module, output a binding-rules checklist with citations.
2. **Audit** - Enumerate every file, read each twice, skeleton conformance diff, assemble gap list grouped by severity (S1 correctness, S2 consistency, S3 cosmetic, sweeps, docs, naming).
3. **Apply** - Fix findings in severity order. Mechanical sweeps, naming, documentation in compile order (ROBOTS last).
4. **Verify to convergence** - Lint, clean-install tests, sweep battery, JSDoc indentation, performance-audit ownership, companion and injection checks, step-comment conformance (every function body checked against the mandatory step-comment set in the language's formatting doc), skeleton conformance re-diff. Two consecutive clean passes required.
5. **Present** - Verification checklist, change report, explicit user approval before any mutation.

**Key properties:**
- The embedded Standard block is the compiled rules from the constitution docs. It is the single source of truth for what the workflow checks.
- `create` runs the full audit and fix phases on the new module after generating it from skeletons. Soft properties (step comments, assertion strength) are enforced at check time by the verify gates, never assumed from generation-time compliance - fresh creations have no prior version to diff against, which is exactly where soft properties drift.
- The skeleton conformance diff includes function bodies: the language's skeleton shows a worked body whose step comments are normative.
- `fix` is also the retrofit verb: when docs change, running `fix` on an existing module re-audits against the recompiled embedded Standard.
- If an audit report from the Audit archetype is available, Phases 1-2 may be skipped; the report provides the re-grounding and gap list.

**Hand-offs:**
- Receives audit reports from the Audit archetype (to skip re-audit).
- Hands off to the Publish archetype after convergence and user approval.

### Archetype 2: Audit (deep, read-only)

**Purpose:** Rebuild context from source, audit the target line by line against the constitution, classify every deviation into drift buckets, and report findings with citations. Changes nothing.

**Phases:**
1. **Re-read the constitution** - Read every doc in full, re-read sibling workflows, output binding-rules checklist.
2. **Survey sibling modules** - Enumerate all modules, categorize, read one reference per category in full, record the convention fingerprint.
3. **Line-by-line audit** - Read each target file twice, audit against the audit map, run gates (lint, tests, stale-name scrub, step-comment conformance). Converge: two consecutive passes with zero new deviations. Missing step comments are an S2 (consistency) finding, escalated to S1 when the uncommentable block hides a correctness issue.
4. **Diagnose drift root cause** - Identify why drift happened, re-anchor the plan, self-improve hook.
5. **Creator-diff (three-bucket classification)** - Classify every deviation:
   - **Bucket 1: Docs drift** - The code matched the docs when written, but the docs evolved. Action: retrofit via Build archetype.
   - **Bucket 2: Code drift** - The code never matched the docs. Action: fix via Build archetype.
   - **Bucket 3: Intentional deviation** - The code deliberately diverges for a documented reason. Action: verify the reason is still valid, acknowledge in report.
6. **Report and hand off** - Present the audit report with conventions, drift diagnosis, deviations, creator-diff classification (with bucket counts), gate results, and plan state. Hand corrections to the Build archetype. STOP.

**Key properties:**
- Always-deep: re-reads all docs every run. Never trusts embedded content or working memory.
- Read-only: mutates nothing. The report is the only output.
- The creator-diff phase uses git history to distinguish docs-evolved from code-diverged.
- Unclassified deviations are investigated further before proceeding.

**Hand-offs:**
- Hands off to the Build archetype (`fix` verb) with the full audit report as input.

### Archetype 3: Publish (release)

**Purpose:** Prepare an artifact for release: verify the pre-publish gate, check package identity, bump version, register CI jobs if needed, commit, and verify CI published.

**Phases:**
1. **Pre-publish gate** - Lint exit 0, clean-install tests green. Both in this run.
2. **Package identity** - Verify name, private flag, license, runtime engine constraint, registry, version.
3. **Ship check** - The package manager's dry-run pack confirms only source and the published documentation set ship.
4. **CI registration** - First publish only: add the test/publish job pair to the CI workflow, re-chain dependencies.
5. **Same-version republish** - Skipped by default. Entered only when the target repository's own standing-rule file declares same-version republishing as its release mechanism: delete old versions, verify the registry reports them gone.
6. **Commit** - Module-only commit, explicit user approval before push.
7. **Verify CI published** - Watch the workflow green, confirm the version is live via the registry API, and confirm the published artifact's fingerprint matches what this commit packs.

**Key properties:**
- CI-only publishing: no human runs the publish command manually. The commit triggers CI.
- Pre-publish gate is mandatory and runs in the same session.
- CI job shapes follow the publishing pipeline rules in `docs/dev/cicd-publishing.md`.

**Hand-offs:**
- On CI failure, hands back to the Build archetype for diagnosis and fix, then re-runs from Phase 1.

---

## Family Contract

### Naming Convention

Family members use a shared prefix derived from the artifact type, with suffixes for audit and publish:

| Member | Name pattern |
|---|---|
| Build | `[prefix]` |
| Audit | `[prefix]-audit` |
| Publish | `[prefix]-publish` |

The prefix is the artifact type's short name, prefixed with the language (for example, `[lang]-helper-module` for a helper-modules repository).

### Shared Embedded Standard

The Build and Audit workflows share an embedded Standard block: the compiled rules from the constitution docs. The Build workflow embeds it for use during create and fix. The Audit workflow re-reads the docs directly (it distrusts embedded content by design), but the embedded Standard in the Build workflow is the compile target that the generator produces.

When the constitution docs change, the embedded Standard in the Build workflow is recompiled in the same session (see the Compile Rule below). The Audit workflow is unaffected because it always reads from source.

### Hand-off Protocol

Hand-offs between family members are by name, never by embedding:

- Audit hands off to Build: `/[prefix] fix [module-path]` with the audit report in the conversation.
- Build hands off to Publish: `/[prefix]-publish [module-path]` after convergence and approval.
- Publish hands back to Build on CI failure: `/[prefix] fix [module-path]`.

A hand-off is a suggestion to the user, not an auto-invocation. The user confirms each transition.

### Repository Independence

The archetypes are language-agnostic and repository-agnostic. They do not name any specific repository, language, or module. Concrete workflows are generated from archetypes by the compile workflow (see below), which parameterizes them with:

- The implementation repository's path
- The language-specific docs subtree
- The repo's directory layout (where modules live)

The constitution repo (`codebase-superloom`) never references dependent repos' workflows or internals. Dependent repos reference the constitution docs freely. See [Agent Configuration](agent-configuration.md#repository-independence).

---

## The Compile Rule

Concrete workflows are compiled from archetypes plus language-specific documentation plus repo layout. The compile workflow (`/compile-workflows` in the constitution repo) performs this generation.

### Inputs

1. **Archetype specs** - This document (`docs/ai/workflow-archetypes.md`).
2. **Language docs** - The `docs/languages/[lang]/` subtree that defines the module structure, formatting, testing, and publishing rules for the target language.
3. **Repo layout** - The implementation repository's directory structure (where modules live, where CI workflows are, where the `.devin/workflows/` directory is).

### Output

A set of workflow files in the implementation repository's `.devin/workflows/` directory, one per family member, each with:

- The archetype's phase structure
- An embedded Standard block compiled from the language docs
- Concrete commands with the repo's actual paths
- The family's naming convention applied

### Verification

The compile workflow self-verifies by running a headless workshop: it generates the workflows, then executes them against dummy modules in a temporary workspace. The workshop checks:

- **Convergence:** the audit workflow converges on the dummy modules (two clean passes).
- **Citations:** every rule in the embedded Standard cites a real doc path.
- **No missing knowledge:** the embedded Standard covers every normative rule in the language docs that the workflow's phases check.

A workshop verdict is written to the workspace. A failed verdict blocks propagation.

### When to Recompile

- After any change to the archetype specs (this document).
- After any change to the language docs that affects the embedded Standard.
- After a directory layout change in the implementation repository.

The `/finalize-docs` workflow's embedded-block pass (P5) triggers recompilation when it detects drift between the archetypes and the concrete workflows.

---

## Cross-References

- [Workflow Authoring](workflow-authoring.md) - the seven mandatory properties every workflow has, the embedded content compile rule, command discipline
- [Agent Configuration](agent-configuration.md) - repository independence, the `AGENTS.md` Golden Rule, derived artifacts
- [Model Tiering](model-tiering.md) - the economic argument for workflows (authored once by the capable model, executed many times by the inexpensive one)
- [Documentation Authoring](../principles/documentation-authoring.md) - the derived-artifact Golden Rule, placement of knowledge
- [File Archetypes](../principles/file-archetypes.md) - the structural conformance model that the Build archetype's skeleton diff checks against
