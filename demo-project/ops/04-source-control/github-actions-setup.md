# GitHub Actions Setup

> Reference: docs/ops/source-control/github-actions-setup.md

## Prerequisites

- Completed: `04-source-control/github-tokens-setup.md`

## Steps

### Configure CI/CD Workflows

The framework provides a single unified workflow template in `.github/workflows/`:

* `ci-helper-modules.yml` - Runs tests on every push and pull request; publishes helper modules to GitHub Packages when a module's `package.json` version has changed

### Set Repository Secrets

* Repository → Settings → Secrets and Variables → Actions
* Required secrets:
  * `GITHUB_TOKEN` - Automatically provided by GitHub Actions
  * `[TODO: Add any additional secrets needed by workflows]`

### Configure Workflow Permissions

* Repository → Settings → Actions → General → Workflow permissions
* Select: Read and write permissions
* Check: Allow GitHub Actions to create and approve pull requests

## Verification

- Push to `main` triggers `ci-helper-modules.yml` (tests always, publish only on version bump)
- Pull requests trigger `ci-helper-modules.yml` (tests only, no publish)
- Packages appear in the organization's GitHub Packages registry after a successful version-bump push

## Notes

- `NODE_AUTH_TOKEN` must be set at job level in CI workflows (not step level)
- See `docs/dev/cicd-publishing.md` for the full publishing guide
