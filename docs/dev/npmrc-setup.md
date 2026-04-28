# npmrc Setup

Global npmrc configuration for installing helper packages from GitHub Packages. This setup is required **only** for:
- **Approach 1**: Installing your own `@your-org/*` packages
- **Approach 3**: Installing the framework's `@superloomdev/*` packages

**Approach 2 (Local Copy)** does not require npmrc setup since it uses `file:` references.

**For complete approach comparison and setup instructions, see [`getting-started.md`](../guide/getting-started.md#step-1---choose-your-implementation-approach).**

## On This Page

- [Setup](#setup)
- [Token Creation](#token-creation)
- [Verify](#verify)
- [Troubleshooting](#troubleshooting)
- [Notes](#notes)

---

## Setup

```bash
# For Approach 1: configure global npm to use GitHub Packages for @your-org scope
npm config set @your-org:registry https://npm.pkg.github.com

# For Approach 3: configure global npm to use GitHub Packages for @superloomdev scope
npm config set @superloomdev:registry https://npm.pkg.github.com
npm config set //npm.pkg.github.com/:_authToken '${GITHUB_READ_PACKAGES_TOKEN}'

# 1b. Safeguard: explicitly set default registry
# npm's built-in default is registry.npmjs.org, but environment variables
# (e.g., npm_config_registry) or other tools can silently override it.
# This line ensures your default registry is always what you expect.
npm config set registry https://registry.npmjs.org/

# 2. One-time: add your GitHub token to __dev__/.env.dev
cp docs/dev/.env.dev.example __dev__/.env.dev
# Edit __dev__/.env.dev → set GITHUB_READ_PACKAGES_TOKEN=ghp_your_token_here

# 3. Each terminal session: load environment
source init-env.sh   # Select: 1) dev
```

Your `~/.npmrc` will contain:
```
@your-org:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_READ_PACKAGES_TOKEN}
registry=https://registry.npmjs.org/
```

**How it works:**
- `@your-org:registry` - scoped config: only `@your-org/*` packages use GitHub Packages
- `_authToken` - GitHub read token, injected via environment variable
- `registry` - safeguard: explicitly sets the default registry. npm's built-in default is `registry.npmjs.org`, but environment variables (like `npm_config_registry`) or other tools can silently override it. This line protects against that.

**Warning:** The environment variable `npm_config_registry` overrides all npmrc settings, including this file. If you see 404 errors for public packages, check `echo $npm_config_registry` - if it's set, `unset npm_config_registry` and find what's setting it.

---

## Token Creation

1. GitHub > Settings > Developer settings > Personal access tokens > Tokens (classic)
2. Name: `read-packages-token`, Scope: `read:packages`
3. Copy token > paste into `__dev__/.env.dev`

---

## Verify

```bash
source init-env.sh
npm view @your-org/js-helper-utils --registry=https://npm.pkg.github.com
```

---

## Troubleshooting

| Issue | Fix |
|---|---|
| 401 Unauthorized | Run `source init-env.sh`, check `echo $GITHUB_READ_PACKAGES_TOKEN` |
| 404 Not Found for public packages | Check `echo $npm_config_registry` - if set, `unset npm_config_registry` |
| 404 Not Found for @your-org packages | Check package name/version, verify token has org access |
| npmrc not working | Verify: `npm config get @your-org:registry` should return `https://npm.pkg.github.com` |
| Registry overridden | Run `npm config list` and look for "overridden by env" - unset the offending variable |

---

## Notes

- **No per-module `.npmrc` files** - global config handles everything
- **CI/CD** uses `GITHUB_TOKEN` automatically - no manual tokens needed
- **Multiple orgs** - works because the token is an environment variable, not hardcoded
