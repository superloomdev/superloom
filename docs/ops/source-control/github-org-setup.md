# GitHub Organization Setup Guide

## Overview

Each project uses a GitHub organization to host its repositories, manage team access, and run CI/CD workflows via GitHub Actions.

## Creating an Organization

- GitHub → Settings → Organizations → New Organization
- Choose a clear, project-related name
- Set an appropriate plan (Free for public repos, Team for private)

## Recommended Settings

### Member Privileges

- Base permissions: **Read** (default for all members)
- Repository creation: **Disabled** (admin only creates repos)

### Security

- Require two-factor authentication for all members
- Enable IP allow lists if your team has fixed IPs

### Repository Setup

- Default branch: `main`
- Branch protection on `main`:
  - Require pull request reviews before merging
  - Require status checks to pass (CI tests)
  - Require branches to be up to date before merging

## Team Structure

| Team | Access Level | Purpose |
|---|---|---|
| Maintainers | Admin | Repository and org management |
| Developers | Write | Day-to-day development |
| Reviewers | Read + Review | Code review only |
