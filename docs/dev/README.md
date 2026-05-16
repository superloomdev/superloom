# Developer Setup

> **Language:** JavaScript (Node.js). These setup instructions cover the JavaScript modules, which are the current reference implementation.

Everything a developer needs to start working on Superloom helper modules and the demo project. Read this once, in order; you should be running tests within 15 minutes.

## On This Page

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [What's in this Folder](#whats-in-this-folder)
- [Environment Setup](#environment-setup)
- [Personal Dev Workspace](#personal-dev-workspace)

---

## Prerequisites

| Tool | Why |
|---|---|
| **Node.js 24+** | Runtime - download from [nodejs.org](https://nodejs.org). Most modules support `>=20.19`, but 24 is the recommended baseline |
| **Docker Desktop** | Local emulators for service-dependent modules ([docker.com](https://www.docker.com/products/docker-desktop/)) |
| **Git** | Access to `github.com/superloomdev` |
| **GitHub Packages token** | Required for Approach 1 (@your-org/*) and Approach 3 (@superloomdev/*) - see [`onboarding-github-packages.md`](onboarding-github-packages.md). **Not needed for Approach 2 (Local Copy).** For approach details, see [`getting-started.md`](../guide/getting-started.md#step-1---choose-your-implementation-approach). |

---

## Quick Start

### 1. Test an offline module (no Docker needed)

```bash
cd src/helper-modules-core/js-helper-utils/_test
npm install
npm test
```

All core modules and several server modules (crypto, cache, auth, etc.) work this way. See `docs/architecture/module-testing.md` for the full list.

### 2. Test a service-dependent module

Each module manages its own Docker lifecycle automatically via npm scripts:

```bash
cd src/helper-modules-server/js-server-helper-sql-postgres/_test
npm install
npm test
```

`npm test` runs: `pretest` (stop stale containers + start emulator) → `test` (run tests) → `posttest` (stop and remove containers and volumes only — images are cached). No manual `docker compose up/down` needed.

### 3. Central dev services (for application development)

The central `docs/dev/docker-compose.yml` runs all services together for **application-level** development (not module testing). It uses named volumes so data persists across restarts:

```bash
docker compose -f docs/dev/docker-compose.yml up -d    # start
docker compose -f docs/dev/docker-compose.yml down      # stop (data preserved)
docker compose -f docs/dev/docker-compose.yml down -v   # stop + delete volumes
```

---

## What's in this Folder

| File | Purpose |
|---|---|
| `README.md` | This file - developer onboarding |
| `docker-compose.yml` | Local services (databases, S3-compatible store, queue) |
| `.env.dev.example` | Dev environment template (copy to `__dev__/.env.dev`) |
| `.env.integration.example` | Integration environment template (copy to `__dev__/.env.integration`) |
| `npmrc-setup.md` | Complete guide for npmrc configuration and GitHub Packages access |
| `onboarding-git-account.md` | Configure Git for multiple GitHub accounts (SSH key, remote, identity) |
| `onboarding-github-packages.md` | Step-by-step: GitHub token and npm registry setup |
| `cicd-publishing.md` | How helper modules are published to GitHub Packages via CI/CD |
| `mcp-github-setup.md` | Configure AI assistant (Windsurf/Cascade) with GitHub MCP server |
| `pitfalls.md` | Consolidated AI journal for `dev/`: AI terminal, CI/CD publishing, local module testing. Read when a specific failure needs a confirmed fix |
| `repo-setup.md` | One-time GitHub repository creation (founder only) |

---

## Environment Setup

Before running any tests or modules, set up your personal environment files:

### 1. npmrc Configuration (Required for GitHub Packages)

**First-time setup only:**
```bash
# Complete guide available in docs/dev/npmrc-setup.md
npm config set @your-org:registry https://npm.pkg.github.com
npm config set //npm.pkg.github.com/:_authToken '${GITHUB_READ_PACKAGES_TOKEN}'
```

### 2. Environment Files

1. Copy the templates to `__dev__/`:
```bash
cp docs/dev/.env.dev.example __dev__/.env.dev
cp docs/dev/.env.integration.example __dev__/.env.integration
```

2. Fill in your values in each file (GitHub token, DB credentials, etc.)
   - **Important**: Add your GitHub token to `__dev__/.env.dev`:
     ```
     GITHUB_READ_PACKAGES_TOKEN=ghp_your_token_here
     ```

3. Load your environment before working:
```bash
source init-env.sh
```

This prompts you to select `dev` or `integration` and loads the corresponding `__dev__/.env.*` file into your shell session.

**💡 New developers**: See `docs/dev/npmrc-setup.md` for complete npmrc setup guide.

---

## Personal Dev Workspace

The `__dev__/` folder at the repository root is your personal workspace. It is listed in `.gitignore` and never committed. Use it for:

- `me.md` - your GitHub username, SSH key name, local aliases
- `.env.dev` - dev environment values (copied from [`.env.dev.example`](.env.dev.example))
- `.env.integration` - integration environment values (real cloud, sandbox account)
- `progress.md` - current work, pending tasks, session notes
- `context.md` - developer-specific AI context (your patterns, preferences, working notes)
- `migration-changelog.md` - personal log of module migration changes
- `secrets/` - real credentials, API keys, sandbox passwords (never copied anywhere committed)

See [Architectural Philosophy](../architecture/architectural-philosophy.md#personal-workspace-dev) for the full convention.

