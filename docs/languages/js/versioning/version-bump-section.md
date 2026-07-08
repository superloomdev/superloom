# README Versioning Section (Template)

This page provides a copy-paste **Versioning** section that every helper module's `README.md` should include. The relative paths inside the snippet (`./ROBOTS.md`, `./CHANGELOG.md`, `../../docs/versioning/...`) resolve from the **module's own `README.md`**, not from this docs page - which is why this page renders the snippet verbatim rather than hyperlinking each reference.

## How to use

1. Open your module's `README.md`.
2. Append the section below (everything inside the code fence).
3. Adjust the dependency block to list the module's actual dependencies.

## The snippet

````markdown
## Versioning

This module follows [Semantic Versioning 2.0.0](https://semver.org/).

### Current Version

See `package.json` for the current version number.

### Public API

The public API is documented in [ROBOTS.md](./ROBOTS.md). All functions and configuration options listed there are subject to semantic versioning.

### Changelog

See [CHANGELOG.md](./CHANGELOG.md) for a history of changes.

### Version Bump Procedure

When releasing a new version:

#### 1. Classify Your Changes

Review all changes since the last release:

| Change Type | Version Impact | Example |
|-------------|----------------|---------|
| New function added | **MINOR** | `feat(module): add newFunction()` |
| Bug fix | **PATCH** | `fix(module): resolve edge case` |
| Documentation update | **PATCH** | `docs(module): improve examples` |
| Breaking API change | **MAJOR** | `BREAKING CHANGE: modify signature` |

#### 2. Update Version

Edit `package.json`:

```json
{
  "version": "1.0.1"
}
```

#### 3. Update Changelog

Add entry to `CHANGELOG.md`:

```markdown
## [1.0.1] - YYYY-MM-DD

### Fixed
- Description of bug fix
```

#### 4. Commit with Conventional Commits

```bash
git add package.json CHANGELOG.md
git commit -m "fix(module): resolve edge case in functionName()"
git push origin main
```

#### 5. Monitor CI

CI automatically publishes to GitHub Packages. Monitor at:
<https://github.com/superloomdev/superloom/actions>

### Dependency Notes

This module's test dependencies use caret (`^`) ranges:

```json
{
  "dependencies": {
    "@superloomdev/js-helper-utils": "^1.0.0"
  }
}
```

This means patch and minor updates are automatically picked up.

### Detailed Documentation

For comprehensive versioning documentation:

- [Versioning Guide](../../docs/versioning/index.md)
- [Semantic Versioning](../../docs/versioning/semantic-versioning.md)
- [Version Bump Checklist](../../docs/versioning/bump-checklist.md)
- [API Stability (JavaScript)](../../docs/versioning/api-stability-js.md)
````

## Why this is wrapped in a code fence

When VitePress renders this page, every relative link inside the snippet would resolve relative to `docs/versioning/`, not the destination module. By keeping the snippet inside a fenced code block the links display verbatim, the build passes strict link-checking, and the only thing a module author needs to do is copy everything between the outer code fences into their own README.
