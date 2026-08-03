---
description: Create, update, or audit a product's management layer (PROJECT.md, feature ledger, CHANGELOG.md, decision log) per docs/principles/project-management.md
---

# Project Docs Workflow

Operationalizes `docs/principles/project-management.md`. Read that document before executing any mode; it is the source of truth for structure, vocabularies, and triggers. This workflow never invents structure - where the principles document and this workflow disagree, the principles document wins and the disagreement is reported.

Invocation: `/project-docs create`, `/project-docs update [what changed]`, `/project-docs audit`.

## Mode: create

Bootstraps the management layer for a product whose main repository lacks it.

1. Confirm the target is the product's **main repository** (usually the server). If invoked in a satellite repo, stop and point at the main repo instead.
2. Collect from the user, or from an existing product definition if one is provided: identity (problem, solution, one-liner), actors, applications, services, common thread, scale assumptions. Do not fabricate any of these; ask for what is missing. Scale numbers may be illustrative but must be labeled as assumptions and be internally consistent.
3. Write `PROJECT.md` with all ten sections in the fixed order from the principles document. Sections that do not apply carry "Not applicable" plus a reason.
4. Seed the feature ledger. Every feature row must name at least one application, one entity, and one module; reject rows that name none. IDs start at `F-001` and are permanent.
5. Write `CHANGELOG.md` with an `[Unreleased]` section only, in Keep a Changelog format.
6. Add the `PROJECT.md` link line to the `README.md` of every satellite repository the applications table names.
7. Run the audit mode below before reporting done.

## Mode: update

Applies one of the defined update triggers. Refuse updates that do not correspond to a trigger; ad hoc edits erode trust in the layer.

1. Identify the trigger: feature shipped, feature retired, release cut, service or store changed, application added, or decision made.
2. Apply exactly the update the trigger table in the principles document prescribes, in the same change set as the work when the work is present.
3. For a retired feature: status flips to `retired` and an outcome (`succeeded` or `failed`) with a one-line reason is mandatory. Never retire a feature without an outcome.
4. For a release: move `Unreleased` entries into a new dated version section; entries citing feature work carry feature IDs.
5. Never renumber, reuse, or delete a feature ID. Never edit history sections of the changelog.

## Mode: audit

Read-only verification. Output is a findings report; fixes go through update mode.

1. Structure: `PROJECT.md` sections present in the fixed order; missing sections carry "Not applicable" with a reason.
2. Ledger integrity: IDs unique and unbroken by reuse; statuses only from the closed vocabulary; every `retired` row carries an outcome and reason; every row names at least one application, one entity, and one module.
3. Cross-consistency: every application in the ledger exists in the applications table; every repository the applications table names links back to `PROJECT.md`; changelog feature IDs exist in the ledger.
4. Budgets: `PROJECT.md` within 300 target and 400 ceiling; on breach, recommend the overflow order from the principles document.
5. Provenance neutrality: search product documentation, sample data, and naming for references to other projects, clients, or predecessor products. Any hit is a finding. Prove the search pattern fires on a known example before trusting an empty result.
6. Staleness: sample recent changes that altered the product surface and confirm the management layer moved with them; a shipped feature still marked `building` is a finding.

Report findings with file and line references, severity, and the trigger that should have prevented each one.
