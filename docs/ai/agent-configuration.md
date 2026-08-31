# Agent Configuration

How AI agents are configured across the Superloom workspace: which files exist, what each carries, and the size discipline that keeps standing context affordable. The configuration is tool-neutral by design; it works unchanged across agent products and their configuration conventions.

## On This Page

- [The File Set](#the-file-set)
- [AGENTS.md: the Open Standard](#agentsmd-the-open-standard)
- [AGENTS.md Is Compiled, Never Authored](#agentsmd-is-compiled-never-authored)
- [The Size Budget](#the-size-budget)
- [What Belongs In and Out](#what-belongs-in-and-out)
- [Tool-Specific Folders](#tool-specific-folders)
- [Repository Independence](#repository-independence)
- [Module-Level ROBOTS.md](#module-level-robotsmd)
- [Personal Configuration](#personal-configuration)
- [Commit and Attribution Policy](#commit-and-attribution-policy)
- [Release Policy Is Repository-Local](#release-policy-is-repository-local)
- [Autonomous Execution](#autonomous-execution)

---

## The File Set

| File | Scope | Committed | Purpose |
|---|---|---|---|
| `AGENTS.md` | Constitution repository root | Yes | Canonical standing rules for the workspace |
| `ROBOTS.md` | Each module | Yes | Compact per-module API reference: signatures, return shapes, critical behavior |
| Workflow files | Tool folder in the repository that owns the procedure | Yes | Step-by-step procedures invoked on demand; see [Workflow Authoring](workflow-authoring.md) |
| Personal meta-instructions | Workspace root tool folder | No | Individual operating preferences, not framework rules |

## AGENTS.md: the Open Standard

`AGENTS.md` is a cross-vendor open convention: a Markdown file that agent tools load as standing context. Superloom keeps one canonical file at the constitution repository root.

Rules:

- **One canonical `AGENTS.md` in the workspace**, at the constitution repository root
- **No copies or symlinks in dependent repositories.** A second path creates a second distribution surface and can drift from the source
- **Vendor-neutral content.** Nothing in the file assumes a specific agent product. Product-specific needs are handled by pointers (see [Tool-Specific Folders](#tool-specific-folders)), not duplicated content
- **The file serves the ambient case.** Lifecycle operations (creating a module, publishing, reviewing) remain workflow territory

## AGENTS.md Is Compiled, Never Authored

> **`AGENTS.md` is a derived artifact, compiled from `docs/`. It is never edited directly. To change a rule: change the source document, then run the compile workflow.**

This is the Golden Rule of agent configuration, and it has teeth because the failure mode is severe: a directly edited `AGENTS.md` asserts rules the documentation no longer contains, agents follow them confidently, and the divergence is invisible until it produces wrong work. The compile workflow maintains a section map (which documentation file feeds which `AGENTS.md` section), a rule inventory that catches source rules with no compressed mirror, and a verify mode that reports drift without writing.

Even one-word fixes go through the source document. The compile is cheap; the drift is not.

## The Size Budget

`AGENTS.md` is injected into every agent conversation, so its length is a tax on every single interaction. The budget:

> **Target 300 lines; hard ceiling 400 lines. When a sync would exceed the ceiling, content moves out (to documents or workflows) rather than the ceiling moving up.**

The compile workflow checks the budget on every run. Three pressure valves, in order:

1. **Compress harder.** One rule, one line. Tables over prose. Condition and conclusion preserved; everything else dropped.
2. **Demote to reference.** A rule needed only in specific situations becomes one line plus a path to its full document.
3. **Move to a workflow.** A rule needed only during a lifecycle operation belongs embedded in that operation's workflow, not in ambient context.

## What Belongs In and Out

| In `AGENTS.md` | Out (and where it goes) |
|---|---|
| The Golden Rule callout, first block in the file | Full authoring contract (`principles/documentation-authoring.md`) |
| Persona, tech stack, repository map | Architecture reasoning (`principles/`) |
| Boundaries: always allowed, ask first, never | Procedure details (workflows) |
| The high-frequency operational rules (terminal safety, test contract, session rituals) | One-off setup guides (`dev/`) |
| The workflow inventory: one line per workflow, when to use it | The workflow contents themselves |
| Pointers to pitfall journals | The journal entries |

The test for any candidate line: **would an agent editing an arbitrary file need this without knowing to ask?** If yes, it earns ambient space. If it is needed only when doing X, it lives with X.

## Tool-Specific Folders

Agent products read workflows and configuration from product-specific locations (`.devin/`, `.windsurf/`, `.claude/`, and equivalents). The rules:

- **Content lives once.** Workflows are authored in one canonical folder per repository. If a second product needs a different location, it gets a pointer or a copy produced by tooling, never a hand-maintained second version.
- **No product names inside the content.** A workflow says "the agent", not the name of a vendor's product. Renaming a tool must never require editing procedure content.
- **Capability differences are handled at the boundary.** If a product cannot execute some workflow feature, the limitation is noted in the personal configuration layer, not worked around inside shared files.

## Repository Independence

The Superloom repository is the constitution: it defines patterns, not implementations. Language-specific module repositories are built from the documentation, never the other way around. The dependency is one-way.

| Repository | Role | References Superloom docs? | References dependent repos? |
|---|---|---|---|
| `superloom` | Constitution: documentation and website | Is the source | Never: not workflows, not internals, not implementation details |
| `[lang]-helper-modules` | Reference implementation built from the docs | Yes, and should | Not applicable |
| `[lang]-demo-project` | Reference application built from the docs | Yes, and should | Not applicable |

Rules:

- **The constitution repository's workflows, README, and docs never invoke, name, or describe a dependent repository's workflows or internal structure.** The constitution does not know which implementations exist.
- **The constitution repository may name dependent repositories as organizational context** (for example, in `dev/org-structure.md`) but never describes their internals or invokes their workflows.
- **Dependent repositories reference the constitution's docs freely.** Their workflows embed standards compiled from `docs/`; their READMEs link to the published documentation
- **Dependent repositories carry a small repo-local `AGENTS.md`, never a copy of the constitution's.** It holds only what is true of that repository alone: its build and test commands, and any policy the constitution defers to it, such as [release policy](#release-policy-is-repository-local). A framework rule stays in `docs/` and reaches the constitution's `AGENTS.md` by compilation; copying one into a dependent repository is drift
- **Documentation is the prime guide.** Everything language-specific (patterns, skeletons, catalogs, pitfalls) lives in `docs/languages/[lang]/` so that any team can build its own implementation from the same source. A helper modules repository is one implementation that validates the docs against real-world use; it does not own the knowledge.
- **This is an architectural constraint, not a style preference.** A violation couples the constitution to one implementation and breaks the language-independent design.

## Module-Level ROBOTS.md

Every published module carries a `ROBOTS.md`: the compact, agent-facing API reference. Where the README explains the module to a human deciding whether to use it, `ROBOTS.md` gives an agent the exact surface: every public function with its signature and return shape, the loader call, the configuration keys, and the behavioral rules that prevent misuse.

- `ROBOTS.md` is **compiled last** in a module's documentation pass, from the finalized README and reference documents, so it never leads the sources it summarizes.
- Signatures in `ROBOTS.md` match the reference documentation exactly; a mismatch is a release-blocking defect.
- Agents read `ROBOTS.md` **before calling a module's functions**. This rule appears in `AGENTS.md` because it is ambient.

## Personal Configuration

Individual developers keep personal agent instructions (working style, meta-preferences, personal plan conventions) in the workspace-level tool folder, outside every repository, never committed. Framework rules never live there: anything a second developer's agent would need is by definition framework content and belongs in the committed set.

---

## Commit and Attribution Policy

**No AI contributor attribution in commits.** Git commits must not include `Co-Authored-By`, `Generated with`, or any other attribution to AI tools or automated systems. The only author is the project maintainer. Commit messages follow Conventional Commits and contain no machine-generated boilerplate.

This rule overrides any AI tool's built-in or default commit template, including templates supplied by the tool's own system prompt. Attribution is added only when the user explicitly asks for it in that session. Every repo an agent commits to must carry this rule in its own `AGENTS.md`; a rule present only in the constitution repo is not in force elsewhere.

**No AI-generated contributor entries** in `package.json` `contributors` arrays or `author` fields. These fields list human contributors only.

## Release Policy Is Repository-Local

The framework default is normal SemVer: a source change earns a new version number. The publish guard in [`../dev/cicd-publishing.md`](../dev/cicd-publishing.md#the-publish-guard-compares-content-not-version-presence) proves content equality by shasum and fails on a mismatch, but it does not choose the remedy. The remedy is the release policy of the repository being published, and that repository's own `AGENTS.md` declares it.

| Declared policy | Remedy for a shasum mismatch |
|---|---|
| **Normal SemVer**, the default when nothing is declared | Bump the version |
| Fixed version, republished by delete-then-push | Delete the registry version, then push |

A repository choosing the second option states it in its own `AGENTS.md`, marks it as a transitional pre-release convenience rather than a framework rule, and states what removing it costs. Delete-then-push changes the artifact tarball checksum, so every consumer's committed `package-lock.json` must be regenerated after the republish. The working practice: delete the relevant `package-lock.json` and run `npm install` fresh before verifying the consumer.

The constitution never records which policy a dependent repository currently runs. That is an internal detail of that repository ([Repository Independence](#repository-independence)).

## Autonomous Execution

When plans execute unattended through a lower-tier LLM, the autonomous execution protocol in `docs/dev/autonomous-execution.md` is standing doctrine. It defines the authorization boundary (what the executor may do without asking), the convergence loop (run, fix, re-run until two consecutive clean passes), the escalation log (park and continue, never halt), the progress journal (resume from file, not from memory), and the registry ordering rules (delete before push, never `rerun --failed`). The protocol is binding for any plan chain that references it.
