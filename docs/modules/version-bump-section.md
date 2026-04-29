# Versioning

This module follows [Semantic Versioning 2.0.0](https://semver.org/).

## Current Version

See `package.json` for the current version number.

## Public API

The public API is documented in [ROBOTS.md](./ROBOTS.md). All functions and configuration options listed there are subject to semantic versioning.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for a history of changes.

## Version Bump Procedure

When releasing a new version:

### 1. Classify Your Changes

Review all changes since the last release:

| Change Type | Version Impact | Example |
|-------------|----------------|---------|
| New function added | **MINOR** | `feat(module): add newFunction()` |
| Bug fix | **PATCH** | `fix(module): resolve edge case` |
| Documentation update | **PATCH** | `docs(module): improve examples` |
| Breaking API change | **MAJOR** | `BREAKING CHANGE: modify signature` |

### 2. Update Version

Edit `package.json`:

```json
{
  "version": "1.0.1"  // Bump according to change type
}
```

### 3. Update Changelog

Add entry to `CHANGELOG.md`:

```markdown
## [1.0.1] - YYYY-MM-DD

### Fixed
- Description of bug fix
```

### 4. Commit with Conventional Commits

```bash
git add package.json CHANGELOG.md
git commit -m "fix(module): resolve edge case in functionName()"
git push origin main
```

### 5. Monitor CI

CI automatically publishes to GitHub Packages. Monitor at:
https://github.com/superloomdev/superloom/actions

## Dependency Notes

This module's test dependencies use caret (`^`) ranges:

```json
{
  "dependencies": {
    "@superloomdev/js-helper-utils": "^1.0.0"
  }
}
```

This means patch and minor updates are automatically picked up. No manual updates needed when dependencies release compatible versions.

## Detailed Documentation

For comprehensive versioning documentation:

- [Versioning Guide](../../docs/versioning/index.md)
- [Semantic Versioning](../../docs/versioning/semantic-versioning.md)
- [Version Bump Checklist](../../docs/versioning/bump-checklist.md)
- [API Stability](../../docs/versioning/api-stability.md)
