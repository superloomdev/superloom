# Dependency Management

> npm version ranges, resolution strategies, and Superloom conventions.

## npm Version Range Syntax

| Syntax | Range | Example Resolution |
|--------|-------|-------------------|
| `1.0.0` | Exact | Only `1.0.0` |
| `^1.0.0` | Compatible | `≥1.0.0, <2.0.0` |
| `~1.0.0` | Approximately | `≥1.0.0, <1.1.0` |
| `>=1.0.0` | Greater than or equal | `1.0.0` and above |
| `<2.0.0` | Less than | Everything below `2.0.0` |
| `*` | Any | Any version (risky) |
| `latest` | Latest tag | Most recent published |

## The Caret (^) - Superloom Standard

```json
{
  "dependencies": {
    "@superloomdev/js-helper-utils": "^1.0.0"
  }
}
```

**Resolution**: Latest version with same major version number.

| Published | Installed | Why |
|-----------|-----------|-----|
| `1.0.0` | `1.0.0` | Exact match |
| `1.0.1` | `1.0.1` | Patch auto-updates |
| `1.1.0` | `1.1.0` | Minor auto-updates |
| `2.0.0` | `1.x.x` | Major blocked (breaking change) |

**Benefits**:
- Automatic bug fixes (patches)
- Automatic features (minor)
- Protection from breaking changes (major)

## The Tilde (~)

```json
{
  "dependencies": {
    "lodash": "~4.17.0"
  }
}
```

**Resolution**: Latest patch version only.

| Published | Installed |
|-----------|-----------|
| `4.17.20` | `4.17.20` |
| `4.18.0` | `4.17.x` (stays on 4.17) |

**Use case**: When you want bug fixes but not new features.

## Exact Versions

```json
{
  "dependencies": {
    "critical-lib": "1.2.3"
  }
}
```

**Use case**: 
- Production systems requiring reproducible builds
- Known-good versions only
- Compliance/audit requirements

**Trade-off**: No automatic updates, manual version management required.

## Wildcard (*)

```json
{
  "dependencies": {
    "some-lib": "*"
  }
}
```

**Resolution**: Any version, latest available.

**⚠️ Not recommended** - Can introduce breaking changes unexpectedly.

## Superloom Conventions

### Test Dependencies

All test `package.json` files use caret ranges for published dependencies:

```json
{
  "name": "js-server-helper-sqlite-test",
  "dependencies": {
    "@superloomdev/js-helper-utils": "^1.0.0",
    "@superloomdev/js-helper-debug": "^1.0.0",
    "@superloomdev/js-server-helper-instance": "^1.0.0",
    "@superloomdev/js-server-helper-sql-sqlite": "file:../"
  }
}
```

**Rules**:
1. **Published deps**: Use `^1.0.0` (caret range)
2. **Module under test**: Use `file:../` (local path)
3. **External deps** (aws-sdk, pg, mysql2): Use exact or caret as appropriate

### Module Dependencies

Main module `package.json` typically have **no runtime dependencies** (loader pattern):

```json
{
  "name": "@superloomdev/js-helper-utils",
  "dependencies": {},
  "devDependencies": {
    "eslint": "^10.2.0"
  }
}
```

Dependencies are injected at runtime via the loader pattern, not installed via npm.

### Peer Dependencies

Not currently used in Superloom. Dependencies are runtime-injected, not npm-linked.

## Version Resolution in CI

GitHub Actions workflow:

```yaml
- name: Install test dependencies
  run: npm install
  working-directory: src/helper-modules-server/js-server-helper-sql-sqlite/_test
```

**What happens**:
1. npm reads `package.json`
2. Sees `"@superloomdev/js-helper-utils": "^1.0.0"`
3. Queries GitHub Packages registry
4. Finds latest `1.x.x` (e.g., `1.0.2`)
5. Installs `1.0.2`

**Registry configuration**:
```yaml
env:
  NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

This authenticates npm to GitHub Packages (`npm.pkg.github.com`).

## Lock Files (package-lock.json)

**In modules**: Commit `package-lock.json` for reproducible builds.

**In test directories**: `package-lock.json` is generated during `npm install` in CI but not committed (fresh install each run).

## Dependency Conflicts

If two modules require different major versions:

```
Module A needs: utils@^1.0.0 (resolves to 1.2.0)
Module B needs: utils@^2.0.0 (resolves to 2.1.0)
```

**Result**: npm installs both versions (if possible) or errors.

**Solution**: Keep modules on compatible major versions. Plan major version bumps carefully.

## Security Updates

For security patches in dependencies:

```bash
# Update to latest patch version
npm update @superloomdev/js-helper-utils

# Or reinstall with latest compatible
rm -rf node_modules package-lock.json
npm install
```

With caret ranges, security patches are automatically picked up on next `npm install`.

## Best Practices

1. **Use `^` for internal Superloom deps** - Automatic compatible updates
2. **Use exact for external critical deps** - Known-good versions
3. **Pin build tools** (eslint, etc.) - Reproducible development environment
4. **Commit lock files** - Reproducible builds
5. **Audit regularly** - `npm audit` for security issues

## References

- [npm semver calculator](https://semver.npmjs.com/)
- [npm documentation - SemVer](https://docs.npmjs.com/about-semantic-versioning/)
- [Understanding npm Versions](https://medium.com/@esobeisaac/understanding-npm-versions-and-prefixes-0ccf6126aa21)
