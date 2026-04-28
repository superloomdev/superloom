# GitHub Organization Setup

> Reference: docs/ops/source-control/github-org-setup.md

## Prerequisites

- Completed: `00-domain/`

## Steps

### Create New Organization

* GitHub → Settings → Organizations → New Organization
* Organization Name: `[TODO: org-name]`
* Display Name: `[TODO: Organization Display Name]`
* Description: `[TODO: Brief project description]`
* Plan: Free (for public repos) or Team (for private repos)

### Configure Organization Settings

* Settings → Member Privileges
  * Base permissions: Read
  * Repository creation: Disabled (admin only)
* Settings → Security
  * Require two-factor authentication: Enabled

### Create Main Repository

* New Repository → Name: `[TODO: repo-name]`
* Visibility: Private (or Public for open-source)
* Default branch: `main`
* Branch protection rules:
  * Require pull request reviews before merging
  * Require status checks to pass before merging

## Verification

- Organization is accessible at `github.com/[org-name]`
- Repository is created with branch protection rules

## Notes

- Organization credentials stored in: `[SECRET → __dev__/secrets/sandbox.md]`
