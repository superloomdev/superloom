# GitHub Personal Access Tokens Guide

## Overview

GitHub Personal Access Tokens (PATs) are used for two purposes in Superloom projects:

1. **CI/CD Publishing** - GitHub Actions uses a token to publish packages to GitHub Packages
2. **Development & Deployment** - Developers and servers use a token to read packages and access repositories

## Token Types

### Publishing Token (CI/CD)

Used by GitHub Actions for automatic package publishing.

| Setting | Value |
|---|---|
| Type | Classic |
| Scopes | `workflow`, `write:packages`, `delete:packages` |
| Expiration | No expiration (or long-lived with renewal reminder) |

### Read Token (Development)

Used by developers locally and servers in deployment for reading packages.

| Setting | Value |
|---|---|
| Type | Classic |
| Scopes | `read:packages`, `repo` |
| Expiration | No expiration (or long-lived with renewal reminder) |

## Storage

- **Publishing token**: Stored as a GitHub Actions repository secret
- **Read token**: Stored in each developer's `__dev__/.env` as `GITHUB_READ_PACKAGES_TOKEN`
- **Both tokens**: Documented in `__dev__/secrets/` for the project owner

## NPM Configuration

The read token is used by npm to access GitHub Packages:

```bash
npm config set @[scope]:registry https://npm.pkg.github.com
npm config set //npm.pkg.github.com/:_authToken '${GITHUB_READ_PACKAGES_TOKEN}'
```

See `docs/dev/npmrc-setup.md` for the complete npmrc setup guide.

## Security

- Never commit tokens to source control
- Rotate tokens periodically
- Use the minimum required scopes for each token
- If a token is compromised, revoke it immediately and create a replacement
