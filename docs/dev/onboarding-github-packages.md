# GitHub Packages Setup

How helper packages are published (CI/CD only) and consumed. This setup is required **only** for:
- **Approach 1**: Publishing and installing your own `@your-org/*` packages
- **Approach 3**: Installing the framework's `@superloomdev/*` packages

**Approach 2 (Local Copy)** does not require GitHub Packages setup since it uses `file:` references.

**For complete approach comparison and setup instructions, see [`getting-started.md`](../guide/getting-started.md#step-1---choose-your-implementation-approach).**

## On This Page

- [For Approach 1 - Install `@your-org/*` Packages Locally](#for-approach-1---install-your-org-packages-locally)
- [For Approach 3 - Install `@superloomdev/*` Packages Locally](#for-approach-3---install-superloomdev-packages-locally)
- [Publishing - CI/CD Only](#publishing---cicd-only)

---

## For Approach 1 - Install `@your-org/*` Packages Locally

Every developer needs a GitHub token with `read:packages` scope to install `@your-org` packages (Approach 1) or `@superloomdev` packages (Approach 3).

### 1. Create a Read Token

1. GitHub > Settings > Developer settings > Personal access tokens > Tokens (classic)
2. Name: `read-packages-token`, Scope: `read:packages`
3. Copy the token immediately

### 2. Set Up Global npmrc

```bash
npm config set @your-org:registry https://npm.pkg.github.com
npm config set //npm.pkg.github.com/:_authToken '${GITHUB_READ_PACKAGES_TOKEN}'
npm config set registry https://registry.npmjs.org/
```

### 3. Add Token to Environment

```bash
cp docs/dev/.env.dev.example __dev__/.env.dev
# Edit __dev__/.env.dev → set GITHUB_READ_PACKAGES_TOKEN=ghp_your_token_here
```

### 4. Load Environment (Each Terminal Session)

```bash
source init-env.sh   # Select: 1) dev
```

Full details: see [`npmrc-setup.md`](npmrc-setup.md).

---

## For Approach 2 - Local Copy (No GitHub Packages Needed)

**Approach 2 uses `file:` references and does not require GitHub Packages setup.**

Since you copy helper modules directly into your project source:
- No GitHub Packages token needed
- No npmrc configuration needed
- Use `file:` references in package.json
- Complete offline development capability

```json
{
  "dependencies": {
    "js-helper-utils": "file:./src/helper-modules-core/js-helper-utils",
    "js-helper-debug": "file:./src/helper-modules-core/js-helper-debug"
  }
}
```

---

## For Approach 3 - Install `@superloomdev/*` Packages Locally

The setup is identical to Approach 1, but uses the `@superloomdev` scope instead of your own organization scope.

### 1. Create a Read Token

Same as Approach 1 - create a token with `read:packages` scope.

### 2. Set Up Global npmrc

```bash
# Configure global npm to use GitHub Packages for @superloomdev scope
npm config set @superloomdev:registry https://npm.pkg.github.com
npm config set //npm.pkg.github.com/:_authToken '${GITHUB_READ_PACKAGES_TOKEN}'
npm config set registry https://registry.npmjs.org/
```

### 3. Add Token to Environment

Same as Approach 1 - use the same environment variable.

Full details: see [`npmrc-setup.md`](npmrc-setup.md).

---

## Publishing - CI/CD Only

Packages are published **exclusively through CI/CD**. No manual publishing.

The unified pipeline at `.github/workflows/ci-helper-modules.yml`:

1. **Triggers** on every push to `main` and every PR
2. **Tests** all changed modules (offline + DynamoDB with Docker service container)
3. **Publishes** only modules whose `package.json` `version` field changed between `HEAD~1` and `HEAD`, and only after tests pass
4. **Uses** the built-in `GITHUB_TOKEN` - no custom secrets required
5. **Safety net:** if the bumped version is already on the registry, `npm publish` is skipped gracefully instead of failing

**To publish a module:** bump its version in `package.json`, commit, and push to `main`. Commits without a version bump run tests only.

## Further Reading

- [npmrc Setup](npmrc-setup.md) - the full guide for the global npmrc configuration
- [CI/CD Publishing](cicd-publishing.md) - operational details of the publish pipeline
- [Module Publishing](../architecture/module-publishing.md) - the architectural rules around package identity
