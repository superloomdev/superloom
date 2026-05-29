# Organisation Structure

How the Superloom project is divided across repositories and how they relate to each other.

## On This Page

- [Repository Map](#repository-map)
- [Naming Convention](#naming-convention)
- [Local Workspace Layout](#local-workspace-layout)
- [Personal Workspace (`__dev__/`)](#personal-workspace-dev)
- [When to Create a New Repo](#when-to-create-a-new-repo)

---

## Repository Map

```
superloomdev/
  superloom              - Framework constitution: docs, conventions, architecture, website
  js-helper-modules      - All JavaScript helper modules (published as @superloomdev/*)
  js-demo-project        - JavaScript reference demo application
  [future]
  py-helper-modules      - Python helper modules (when ready)
  js-helper-modules-specialized  - Non-core or community JS wrappers (when ready)
```

| Repository | Purpose | What lives here |
|---|---|---|
| `superloom` | The constitution | `docs/`, `website/`, framework conventions, architectural philosophy, this file |
| `js-helper-modules` | JS implementation | `src/helper-modules-core/`, `src/helper-modules-server/`, `src/helper-modules-client/`, CI/CD publish pipeline |
| `js-demo-project` | JS reference app | Full demo application - model, server, ops runbook |

The `superloom` repo is language-agnostic. It defines patterns, not implementations. Language-specific implementations live in their own repos and reference `superloom` for conventions.

---

## Naming Convention

| Repo type | Pattern | Example |
|---|---|---|
| Core language modules | `[lang]-helper-modules` | `js-helper-modules`, `py-helper-modules` |
| Specialised/non-core modules | `[lang]-helper-modules-specialized` | `js-helper-modules-specialized` |
| Demo/reference application | `[lang]-demo-project` | `js-demo-project` |

`[lang]` is the lowercase language identifier: `js`, `py`, `go`, etc.

A specialised repo is warranted when modules are non-core (community wrappers, niche SDKs, opinionated integrations) and should be distributed separately from the main module set.

---

## Local Workspace Layout

All repositories in the project share a single parent directory on the developer's machine:

```
project-superloom/
  codebase-superloom/          - clone of superloomdev/superloom
  codebase-js-helper-modules/  - clone of superloomdev/js-helper-modules
  codebase-js-demo-project/    - clone of superloomdev/js-demo-project
  __dev__/                     - personal workspace (never committed, see below)
  superloom.code-workspace     - multi-root workspace file for VSCode / Windsurf
```

The `superloom.code-workspace` file ties all repos together into a single IDE window. Each repo has its own `.git/` and its own CI/CD, but a developer works across all of them from one IDE session.

---

## Personal Workspace (`__dev__/`)

The `__dev__/` folder lives at the **workspace root** (`project-superloom/__dev__/`), one level above all repository clones. It is never committed to any repository.

This location was chosen deliberately: `__dev__/` spans all repos. Plans, secrets, and notes are not tied to any individual repository - they belong to the workspace as a whole.

| File / Folder | Purpose |
|---|---|
| `me.md` | Your GitHub username, SSH key name, local aliases, machine-specific notes |
| `.env.dev` | Dev environment values (copied from `codebase-superloom/docs/dev/.env.dev.example`) |
| `.env.integration` | Integration environment values (real cloud, sandbox account) |
| `progress.md` | Current work, pending tasks, session notes |
| `context.md` | Developer-specific AI context - your patterns, preferences, working notes |
| `plans/` | Long-horizon plans and backlog. See [`planning.md`](planning.md) |
| `secrets/` | Real credentials, API keys, sandbox passwords (never copied anywhere committed) |

Because `__dev__/` lives outside any git repo, it does not need a `.gitignore` entry - it is simply never tracked.

---

## When to Create a New Repo

Create a new language module repo (`[lang]-helper-modules`) when:
- A first production-quality module exists in that language
- The module follows the same loader/factory/adapter patterns defined in `superloom` docs
- CI/CD for testing and publishing is ready to be wired up

Create a specialised module repo (`[lang]-helper-modules-specialized`) when:
- Modules are opinionated wrappers around niche third-party SDKs
- They should be opt-in rather than part of the standard module set
- They may have different quality/maintenance expectations than core modules

Do not create a new repo for a single experimental module. Use a branch in the relevant repo until the module is stable.
