# GitHub Organization Setup

## Prerequisites

None.

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

## Notes

- Store organization owner credentials in a secure password manager
