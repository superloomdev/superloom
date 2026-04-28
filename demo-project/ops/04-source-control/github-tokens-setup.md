# GitHub Personal Access Tokens Setup

> Reference: docs/ops/source-control/github-tokens-setup.md

## Prerequisites

- Completed: `04-source-control/github-org-setup.md`

## Steps

### Create Token for Publishing Packages (CI/CD)

Used by GitHub Actions for automatic creation and deletion of GitHub Packages.

* GitHub → Settings → Developer Settings → Personal Access Tokens (classic)
* Token Name: `[TODO: project-name]-action-publish-access`
* Expiration: No expiration (or set a long expiration with calendar reminder)
* Scopes:
  * `workflow` - Update GitHub Action workflows
  * `write:packages` - Upload packages to GitHub Packages
  * `delete:packages` - Delete packages from GitHub Packages
* Token: `[SECRET → __dev__/secrets/sandbox.md]`

### Create Token for Reading Packages (Development & Deployment)

Used for local development and server deployment to read packages and repositories.

* GitHub → Settings → Developer Settings → Personal Access Tokens (classic)
* Token Name: `[TODO: project-name]-package-access`
* Expiration: No expiration (or set a long expiration with calendar reminder)
* Scopes:
  * `read:packages` - Download packages from GitHub Packages
  * `repo` - Full control of private repositories
* Token: `[SECRET → __dev__/secrets/sandbox.md]`

### Store Tokens as Repository Secrets

* Repository → Settings → Secrets and Variables → Actions
* Add the publish token as a repository secret for CI/CD workflows

## Verification

- Tokens can authenticate: `npm whoami --registry https://npm.pkg.github.com`
- CI/CD workflow can publish packages

## Notes

- Never commit tokens to source control
- Rotate tokens periodically and update in all locations
- See `docs/dev/npmrc-setup.md` for configuring npm to use these tokens locally
