# GitHub Actions Setup

## Prerequisites

GitHub tokens created and stored.

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

## Notes

- `NODE_AUTH_TOKEN` must be set at job level in CI workflows (not step level)
- See `docs/dev/cicd-publishing.md` for the full publishing guide
