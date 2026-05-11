# Changelog Format

> Conventional Commits to structured CHANGELOG.md

## Conventional Commits

Commit messages follow [Conventional Commits](https://conventionalcommits.org/) specification:

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

| Type | Description | Changelog Section |
|------|-------------|-------------------|
| `feat` | New feature | ### Added |
| `fix` | Bug fix | ### Fixed |
| `docs` | Documentation | ### Documentation |
| `style` | Code style (formatting) | (no changelog entry) |
| `refactor` | Code restructuring | ### Changed |
| `perf` | Performance improvement | ### Performance |
| `test` | Tests | ### Testing |
| `chore` | Maintenance | (no changelog entry) |
| `build` | Build system | ### Build |
| `ci` | CI/CD changes | ### CI/CD |

### Scope

Module name (required for Superloom):

```
feat(utils): add isValidEmail()
fix(sqlite): handle connection timeout
chore(docs): update README
```

### Breaking Changes

Indicated by `!` or `BREAKING CHANGE` footer:

```
feat(utils)!: change validate() return type

BREAKING CHANGE: validate() now returns object {valid, errors}
instead of boolean. Update calls accordingly.
```

## CHANGELOG.md Structure

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- New features since last release

### Fixed
- Bug fixes since last release

## [1.0.2] - 2024-01-15

### Fixed
- `isEmpty()` now handles null prototype objects (@username, #123)
- Edge case in `deepClone()` for circular references

## [1.0.1] - 2024-01-10

### Documentation
- Improved JSDoc examples for `toSlug()`
- Added usage examples to README

## [1.0.0] - 2024-01-01

### Added
- Initial stable release
- All utility functions documented in ROBOTS.md
- Complete test coverage
```

## Sections

### Added
New features, capabilities, or integrations.

```markdown
### Added
- `isValidEmail(email)` - Validate email format
- Support for ISO 8601 date strings in `parseDate()`
- TypeScript type definitions
```

### Fixed
Bug fixes and corrections.

```markdown
### Fixed
- `isEmpty()` returned false for objects with null prototype (#456)
- Memory leak in connection pooling (#789)
- Race condition in async batch operations
```

### Changed
Changes to existing functionality (not breaking).

```markdown
### Changed
- Improved error messages for validation failures
- Updated internal data structures for better performance
- Refactored database query builder
```

### Deprecated
Soon-to-be-removed features (warnings added).

```markdown
### Deprecated
- `oldFunction()` - Use `newFunction()` instead (will be removed in 2.0.0)
- `legacyOption` config key - Use `modernOption` instead
```

### Removed
Removed features (breaking changes in major versions).

```markdown
### Removed
- `deprecatedFunction()` (was deprecated in 1.2.0)
- Support for Node.js < 18
```

### Security
Security-related changes.

```markdown
### Security
- Fixed regex DoS vulnerability in `sanitizeInput()`
- Updated dependency `lodash` to patched version
```

### Performance
Performance improvements.

```markdown
### Performance
- Reduced memory usage by 40% in `deepClone()`
- Improved query execution time with connection pooling
```

### Documentation
Documentation-only changes.

```markdown
### Documentation
- Added examples for complex use cases
- Fixed typos in ROBOTS.md
- Clarified configuration options
```

### Testing
Test-related changes.

```markdown
### Testing
- Added integration tests for Postgres adapter
- Increased coverage to 95%
- Added property-based tests for edge cases
```

### Build
Build system changes.

```markdown
### Build
- Migrated to ESBuild for faster compilation
- Updated ESLint configuration
```

### CI/CD
CI/CD pipeline changes.

```markdown
### CI/CD
- Added automated security scanning
- Parallelized test execution
```

## Version Headers

Format: `## [VERSION] - YYYY-MM-DD`

```markdown
## [1.2.3] - 2024-01-15
## [1.2.3-beta.1] - 2024-01-10
## [Unreleased]
```

## Linking References

Link to issues and PRs:

```markdown
### Fixed
- Memory leak in connection pool (#456)
- Race condition in async operations (@username, PR #789)
```

## Unreleased Section

Keep an `## [Unreleased]` section at the top for changes since last release:

```markdown
## [Unreleased]

### Added
- New feature in development

### Fixed
- Bug fix pending release

## [1.0.2] - 2024-01-15
...
```

Move entries from `Unreleased` to version section when releasing.

## Commit to Changelog Mapping

| Commit Message | CHANGELOG Entry |
|----------------|-----------------|
| `feat(utils): add isValidEmail()` | ### Added - `isValidEmail(email)` - Validate email format |
| `fix(utils): handle null in isEmpty()` | ### Fixed - `isEmpty()` now handles null values |
| `docs(utils): improve examples` | ### Documentation - Improved usage examples |
| `perf(utils): optimize loop` | ### Performance - Improved execution speed |
| `refactor(utils): simplify logic` | ### Changed - Simplified internal implementation |
| `test(utils): add edge cases` | ### Testing - Added edge case tests |

## Automation

Future consideration: Use tools like:

- [standard-version](https://github.com/conventional-changelog/standard-version)
- [semantic-release](https://github.com/semantic-release/semantic-release)
- [release-please](https://github.com/googleapis/release-please)

For now: Manual changelog maintenance ensures accuracy.

## File Location

Each module has its own changelog:

```
src/helper-modules-core/js-helper-utils/
  ├── utils.js
  ├── package.json
  ├── README.md
  └── CHANGELOG.md  ← Here
```

## References

- [Keep a Changelog](https://keepachangelog.com/)
- [Conventional Commits](https://conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)
