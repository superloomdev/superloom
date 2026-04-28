---
description: Propagate changes across docs and AGENTS.md when code or architecture changes
---

# Change Propagation Workflow

`AGENTS.md` is the **single source of truth for AI agents**. It embeds a compressed version of all project context from `docs/`. When any documentation or module changes, this workflow ensures `AGENTS.md` stays in sync.

**Authoring rules:** All edits made by this workflow must follow `GOD.md` Directive 12 (Documentation Authoring Principles): prescriptive, generic, DRY, compact. For new knowledge that does not fit existing sections, use `/learn` instead.

## On This Page

- [When Any File in `docs/` Changes](#when-any-file-in-docs-changes)
- [When a Helper Module Changes](#when-a-helper-module-changes)
- [When a Model Entity Changes](#when-a-model-entity-changes)
- [When Architecture or Philosophy Changes](#when-architecturephilosophy-changes)
- [When Directory Structure Changes](#when-directory-structure-changes)
- [Verification Checklist](#verification-checklist)

---

## When Any File in `docs/` Changes

This is the most important step. `AGENTS.md` contains a compressed summary of all `docs/` content.

1. Read the changed file(s) in `docs/`
2. Update the corresponding section in `AGENTS.md`:
   - `docs/architecture/code-formatting-js.md` → "Coding Standards (Mandatory)" section
   - `docs/architecture/module-structure.md` → "Module Patterns" section
   - `docs/architecture/module-publishing.md` → "Publishing" section
   - `docs/architecture/peer-dependencies.md` → "Dependency Hierarchy" section
   - `docs/architecture/testing-strategy.md` or `unit-test-authoring.md` → "Testing" section
   - `docs/architecture/architectural-philosophy.md` → "Core Philosophy" section
   - `docs/dev/*` → "Publishing" or relevant operational section
3. Keep the `AGENTS.md` version compressed (tables, bullets, no prose)

## When a Helper Module Changes

1. Update the module's `README.md` with new/changed function signatures
2. Update `AGENTS.md` → "Directory Map" if module added/removed/renamed
3. Update `AGENTS.md` → "Dependency Hierarchy" if dependencies changed
4. Run module tests: `cd [module]/_test && npm test`

## When a Model Entity Changes

1. Update the entity's `README.md` with new/changed functions
2. Update the entity's `_test/test.js` with new test cases
3. If new entity: register in `demo-project/src/server/common/loader.js`
4. If new entity: create Express routes + Lambda handlers
5. If architecture changed: update relevant files in `docs/architecture/`
6. Run `/propagate-changes` to sync `AGENTS.md`

## When Architecture/Philosophy Changes

1. Update the relevant file in `docs/architecture/`
2. Update `AGENTS.md` → corresponding embedded section
3. Update `docs/philosophy/` if applicable

## When Directory Structure Changes

1. Update `AGENTS.md` → "Directory Map"
2. Update `docs/architecture/module-structure.md`
3. Update `docs/architecture/architectural-philosophy.md` directory locations
4. Update `.windsurf/workflows/` if paths changed

## Verification Checklist

// turbo
After propagating changes, run all tests to verify nothing is broken:
```bash
cd src/helper-modules-core/js-helper-utils/_test && npm test
cd src/helper-modules-core/js-helper-debug/_test && npm test
cd src/helper-modules-core/js-helper-time/_test && npm test
```
