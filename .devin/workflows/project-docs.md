---
description: Create, update, or audit a product's management layer (PROJECT.md, feature ledger, CHANGELOG.md, decision log) per docs/principles/project-management.md
---

# Project Docs Workflow

This workflow applies `docs/principles/project-management.md`. Read that document before you run a mode. It is the source of truth for structure, vocabularies and triggers. This workflow does not invent structure. If the document and this workflow disagree, the document wins. Report the disagreement.

Invocation: `/project-docs create`, `/project-docs update [what changed]`, `/project-docs audit`.

## Mode: create

This mode writes the management layer for a product whose main repository does not have it.

1. Make sure that the target is the product's **main repository** (usually the server). If the target is a satellite repository, stop and name the main repository.
2. Collect the items below from the user, or from a product definition that the user gives. Items: identity (problem, solution, one-line description), actors, applications, services, common thread, scale assumptions. Do not invent an item. Ask for each missing item. Scale numbers can be examples. Label them as assumptions and make sure that they agree with each other.
3. Write `PROJECT.md` with all ten sections in the fixed order of the principles document. If a section does not apply, write "Not applicable" and the reason.
4. Write the first rows of the feature ledger. Each row names at least one application, one entity and one module. Reject a row that names none. IDs start at `F-001` and do not change.
5. Write `CHANGELOG.md` in the Keep a Changelog format, with only an `[Unreleased]` section.
6. Add the `PROJECT.md` link line to the `README.md` of each satellite repository that the applications table names.
7. Run the audit mode before you report the work as done.

## Mode: update

This mode applies one of the defined update triggers. Refuse an update that has no trigger. Edits without a trigger make the layer less trusted.

1. Identify the trigger: feature shipped, feature retired, release cut, service or store changed, application added, or decision made.
2. Apply the update that the trigger table of the principles document gives. If the work is in the same change set, put the update in that change set.
3. For a retired feature: set the status to `retired` and write an outcome (`succeeded` or `failed`) with a one-line reason. Do not retire a feature without an outcome.
4. For a release: move the `Unreleased` entries into a new section with the version and the date. An entry about feature work carries its feature ID.
5. Do not renumber, reuse or delete a feature ID. Do not edit the release sections of the changelog.

## Mode: audit

This mode reads and does not change files. The output is a findings report. Fixes go through the update mode.

1. Structure: the `PROJECT.md` sections are present in the fixed order. A section that does not apply carries "Not applicable" and a reason.
2. Ledger integrity: each ID is unique and no ID is reused. Each status comes from the closed vocabulary. Each `retired` row carries an outcome and a reason. Each row names at least one application, one entity and one module.
3. Cross-consistency: each application in the ledger is in the applications table. Each repository that the applications table names links back to `PROJECT.md`. Each feature ID in the changelog is in the ledger.
4. Budgets: `PROJECT.md` has 300 lines or fewer (target) and not more than 400 lines (ceiling). If the file passes the ceiling, recommend the overflow order of the principles document.
5. Provenance neutrality: search the product documentation, the sample data and the names for references to other projects, clients or earlier products. Each hit is a finding. Before you trust an empty result, prove that the search pattern finds a known example.
6. Staleness: examine recent changes to the product surface. Make sure that the management layer changed with them. A shipped feature that is still marked `building` is a finding.

Report each finding with the file and line, the severity, and the trigger that should have prevented it.
