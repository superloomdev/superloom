# Agent Configuration

How AI agents are configured across Superloom repositories: which files exist, what each carries, how they stay synchronized with the documentation, and the size discipline that keeps them affordable. The configuration is tool-neutral by design; it works unchanged across agent products and their configuration conventions.

## On This Page

- [The File Set](#the-file-set)
- [AGENTS.md: the Open Standard](#agentsmd-the-open-standard)
- [AGENTS.md Is Compiled, Never Authored](#agentsmd-is-compiled-never-authored)
- [The Size Budget](#the-size-budget)
- [What Belongs In and Out](#what-belongs-in-and-out)
- [Tool-Specific Folders](#tool-specific-folders)
- [Module-Level ROBOTS.md](#module-level-robotsmd)
- [Personal Configuration](#personal-configuration)

---

## The File Set

| File | Scope | Committed | Purpose |
|---|---|---|---|
| `AGENTS.md` | Repository root | Yes | Standing rules an agent loads at every conversation start |
| `ROBOTS.md` | Each module | Yes | Compact per-module API reference: signatures, return shapes, critical behavior |
| Workflow files | Tool folder in each repository | Yes | Step-by-step procedures invoked on demand; see [Workflow Authoring](workflow-authoring.md) |
| Personal meta-instructions | Workspace root tool folder | No | Individual operating preferences, not framework rules |

## AGENTS.md: the Open Standard

`AGENTS.md` is a cross-vendor open convention: a Markdown file at the repository root that agent tools read automatically at conversation start. Superloom adopts it as the single standing-configuration file per repository.

Rules:

- **One `AGENTS.md` per repository**, at the root.
- **Vendor-neutral content.** Nothing in the file assumes a specific agent product. Product-specific needs are handled by pointers (see [Tool-Specific Folders](#tool-specific-folders)), never by duplicating content per product.
- **The file serves the ambient case**: an agent asked to edit, fix, or extend existing code needs the house rules without invoking anything. Lifecycle operations (creating a module, publishing, reviewing) are workflow territory and stay out of it.

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

## Module-Level ROBOTS.md

Every published module carries a `ROBOTS.md`: the compact, agent-facing API reference. Where the README explains the module to a human deciding whether to use it, `ROBOTS.md` gives an agent the exact surface: every public function with its signature and return shape, the loader call, the configuration keys, and the behavioral rules that prevent misuse.

- `ROBOTS.md` is **compiled last** in a module's documentation pass, from the finalized README and reference documents, so it never leads the sources it summarizes.
- Signatures in `ROBOTS.md` match the reference documentation exactly; a mismatch is a release-blocking defect.
- Agents read `ROBOTS.md` **before calling a module's functions**. This rule appears in `AGENTS.md` because it is ambient.

## Personal Configuration

Individual developers keep personal agent instructions (working style, meta-preferences, personal plan conventions) in the workspace-level tool folder, outside every repository, never committed. Framework rules never live there: anything a second developer's agent would need is by definition framework content and belongs in the committed set.
