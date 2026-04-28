# GitHub Actions CI/CD Guide

## Overview

GitHub Actions runs automated workflows for testing and publishing. Superloom uses a **single unified workflow** (`ci-helper-modules.yml`) that:

1. Runs tests on every push and pull request
2. Publishes helper modules to GitHub Packages only when their `package.json` version has changed (gated behind a successful test run)

This replaces the earlier two-workflow setup (`test.yml` + `publish-helper-module.yml`), which caused duplicate runs per commit and `409 already-published` failures whenever a push didn't include a version bump.

## Repository Configuration

### Secrets

- Repository → Settings → Secrets and Variables → Actions
- `GITHUB_TOKEN` is automatically available (no setup needed)
- Add additional secrets as needed by deployment workflows

### Workflow Permissions

- Repository → Settings → Actions → General → Workflow permissions
- Select: **Read and write permissions**
- Check: Allow GitHub Actions to create and approve pull requests

## Key Rules

- `NODE_AUTH_TOKEN` must be set at **job level**, not step level
- Publishing uses `GITHUB_TOKEN` (not a personal access token)
- Test jobs run on `push` to `main` and on `pull_request` events
- Publish jobs run only on `push` to `main` AND only when the module's `package.json` version changed between `HEAD~1` and `HEAD`

## Workflow Location

All workflows live in `.github/workflows/`:

```
.github/
  workflows/
    ci-helper-modules.yml    # Unified test + publish pipeline
```

Jobs inside `ci-helper-modules.yml`:
- `detect` - scan changed modules and version bumps
- `test-offline` - matrix of offline modules
- `test-dynamodb` - DynamoDB module with Docker service container
- `publish-offline` - conditional on version bump + passing tests
- `publish-dynamodb` - conditional on version bump + passing tests

See `docs/dev/cicd-publishing.md` for the full publishing guide.
