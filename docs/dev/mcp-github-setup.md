# MCP GitHub Integration Setup

Configure your AI agentic IDE (Windsurf, Cursor, ...) to manage your GitHub repositories through the GitHub MCP server. The MCP server gives the AI access to repository code, Actions logs, issues, pull requests, and workflow management.

## On This Page

- [Overview](#overview)
- [Token Requirements](#token-requirements)
- [Creating the Fine-grained PAT](#creating-the-fine-grained-pat)
- [Windsurf Configuration](#windsurf-configuration)
- [Security Notes](#security-notes)
- [Troubleshooting](#troubleshooting)
- [Limitations](#limitations)
- [References](#references)

---

## Overview

The GitHub MCP server allows your AI assistant to:
- Read and manage repository code
- Check GitHub Actions workflow logs
- Create and manage issues and pull requests
- Verify package publishes
- Manage repository settings

## Token Requirements

Fine-grained PATs do **not** support GitHub Packages (GitHub limitation). The MCP server uses repository permissions to access most features.

## Creating the Fine-grained PAT

1. Go to **github.com > Settings > Developer settings > Personal access tokens > Fine-grained tokens**
2. Click **Generate new token**
3. **Token name:** `mcp-ai-assistant-superloomdev`
4. **Description:**
   ```
   AI assistant IDE access to superloomdev organization.
   Allows reading code, checking Actions logs, creating PRs/issues,
   and managing workflows across all repos.
   Created: [Date]. No expiration.
   ```
5. **Resource owner:** Select your organization (`superloomdev`)
6. **Repository access:** All repositories
7. **Permissions** - Add these in order (matches GitHub UI):

### Repository Permissions (Read and write)

Add permissions in this order:

1. **Actions** - Workflows, workflow runs and artifacts
2. **Commit statuses** - Commit statuses
3. **Contents** - Repository contents, commits, branches, downloads, releases, and merges
4. **Environments** - Manage repository environments
5. **Issues** - Issues and related comments, assignees, labels, and milestones
6. **Metadata** - (Required, read-only by default)
7. **Pages** - Retrieve Pages statuses, configuration, and builds
8. **Pull requests** - Pull requests and related comments, assignees, labels, milestones, and merges
9. **Repository security advisories** - View and manage repository security advisories
10. **Secrets** - Manage Actions repository secrets
11. **Variables** - Manage Actions repository variables
12. **Webhooks** - Manage the post-receive hooks for a repository
13. **Workflows** - Update GitHub Action workflow files

### Account Permissions

None required for basic MCP functionality.

## Windsurf Configuration

### Step 1: Locate MCP Config

Find your Windsurf MCP config file:
- **macOS:** `~/.codeium/windsurf/mcp_config.json`
- **Windows:** `%USERPROFILE%\.codeium\windsurf\mcp_config.json`
- **Linux:** `~/.codeium/windsurf/mcp_config.json`

### Step 2: Add GitHub MCP Server

Edit `mcp_config.json`:

```json
{
  "mcpServers": {
    "github": {
      "serverUrl": "https://api.githubcopilot.com/mcp/",
      "headers": {
        "Authorization": "github_pat_xxx_YOUR_TOKEN_HERE"
      }
    }
  }
}
```

Replace `github_pat_xxx_YOUR_TOKEN_HERE` with your generated token.

### Step 3: Store Token Reference (Personal)

Save your token name (not the token itself) to `__dev__/me.md` for your records:

```markdown
# My Developer Context

## GitHub Tokens

| Name | Purpose | Location |
|------|---------|----------|
| `mcp-ai-superloomdev` | MCP server access | Windsurf config |
| `GITHUB_READ_PACKAGES_TOKEN` | Local package install | `__dev__/.env` |

## MCP Server Status
- GitHub MCP: Enabled (fine-grained PAT)
- Permissions: All repositories in superloomdev
```

## Security Notes

- **Never commit tokens** - The actual token lives in Windsurf config only
- **Fine-grained scope** - Token is limited to specific organization repositories
- **No expiration** - Set to your preference (recommend 90 days or 1 year)
- **Audit trail** - GitHub logs all API calls made via PAT

## Troubleshooting

### MCP Not Connecting
1. Verify token is correctly pasted (no extra spaces)
2. Check that `serverUrl` is exactly `https://api.githubcopilot.com/mcp/`
3. Restart Windsurf IDE

### Permission Errors
If MCP reports insufficient permissions:
1. Go to token settings
2. Verify the permission exists and is set to "Read and write"
3. Note: GitHub Packages requires Classic PAT (fine-grained not supported)

### Token Expired
1. Generate new token with same permissions
2. Update `mcp_config.json`
3. Update `__dev__/me.md` with new token name

## Limitations

- **GitHub Packages (Fine-grained PATs):** Fine-grained PATs do not currently include `read:packages` or `write:packages` permissions in the UI. Package publishing is handled via CI/CD using the built-in `GITHUB_TOKEN` with `packages: write` job permission. See [`cicd-publishing.md`](cicd-publishing.md) for details.
- **Org-level settings:** Some organization settings require Classic PAT or direct API access.

## References

- [GitHub MCP Server](https://github.com/github/github-mcp-server)
- [Fine-grained PAT Docs](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token#creating-a-fine-grained-personal-access-token)
- [GitHub Packages Permissions](https://docs.github.com/en/packages/learn-github-packages/about-permissions-for-github-packages) - Note: Only Classic PATs supported
