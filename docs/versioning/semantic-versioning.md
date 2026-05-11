# Semantic Versioning

> Superloom follows [SemVer 2.0.0](https://semver.org/) with project-specific rules.

## SemVer Specification

Version format: **MAJOR.MINOR.PATCH** (X.Y.Z)

| Component | Increment When | Example |
|-------------|----------------|---------|
| **MAJOR** (X) | Breaking API changes | Removing a function, changing parameter types |
| **MINOR** (Y) | New backward-compatible features | Adding a helper function, new config option |
| **PATCH** (Z) | Backward-compatible bug fixes | Fixing logic, documentation updates |

## Superloom-Specific Rules

### 1. Public API Declaration

Every module MUST declare its public API in `ROBOTS.md`:

```markdown
## Public API

### Functions
- `isEmpty(value)` - Check if value is empty
- `toSlug(str)` - Convert string to URL slug

### Configuration
- `CONFIG.timezone` - Default timezone string
```

**Rule**: Breaking changes to any documented function = Major version bump.

### 2. Initial Development Phase

Versions `0.y.z` indicate initial development:

```json
{
  "version": "0.5.2"
}
```

- Anything MAY change at any time
- Public API is NOT stable
- Use in production at your own risk

**First stable release**: `1.0.0` establishes the public API contract.

### 3. Version Determination Matrix

| Change Type | Version Impact | Example Commit |
|-------------|----------------|----------------|
| New function added | Minor bump | `feat(utils): add isValidEmail()` |
| Function parameter changed | Major bump | `BREAKING: change validate() signature` |
| Bug fix in existing function | Patch bump | `fix(utils): handle null in isEmpty()` |
| Documentation update | Patch bump | `docs(utils): improve JSDoc examples` |
| Internal refactoring | Patch bump | `refactor(utils): simplify type checks` |
| Performance improvement | Patch bump | `perf(utils): optimize deepClone()` |
| New test coverage | Patch bump | `test(utils): add edge case tests` |

### 4. Pre-Release Versions

For beta/alpha releases:

```json
{
  "version": "1.0.0-beta.1"
}
```

Pre-release versions:
- Have lower precedence than the associated normal version
- Indicate instability
- Should not satisfy `^` or `~` ranges

### 5. Build Metadata

Build info (ignored for precedence):

```json
{
  "version": "1.0.0+build.2024.01.15"
}
```

## Breaking Change Definition

A change is **breaking** if:

1. **Function removed** - Code calling it will error
2. **Parameter type changed** - `string` → `number` breaks callers
3. **Return structure changed** - `{id, name}` → `{userId, userName}` breaks destructuring
4. **Default behavior changed** - `trim: false` → `trim: true` changes output
5. **Error thrown where none before** - New validation throws unexpectedly

A change is **NOT breaking** if:

1. **New function added** - Existing code unaffected
2. **New optional parameter** - Existing calls work unchanged
3. **Additional return properties** - `{id, name}` → `{id, name, email}` is additive
4. **Bug fix** - Corrects previously wrong behavior

## Version Bump Decision Tree

```
Did you change the public API?
├── No → PATCH (1.0.0 → 1.0.1)
│
└── Yes → Is it backward compatible?
    ├── Yes → MINOR (1.0.0 → 1.1.0)
    │
    └── No → MAJOR (1.0.0 → 2.0.0)
```

## Commit Message Convention

Use [Conventional Commits](https://conventionalcommits.org/) to automate changelog:

| Type | Version Impact | Example |
|------|----------------|---------|
| `feat` | Minor | `feat(utils): add isValidEmail()` |
| `fix` | Patch | `fix(utils): handle null in isEmpty()` |
| `docs` | Patch | `docs(utils): add usage examples` |
| `style` | Patch | `style(utils): fix indentation` |
| `refactor` | Patch | `refactor(utils): simplify logic` |
| `perf` | Patch | `perf(utils): optimize loop` |
| `test` | Patch | `test(utils): add edge cases` |
| `BREAKING CHANGE` | Major | Footer: `BREAKING CHANGE: removed toSlug()` |

## FAQ

**Q: Won't I end up at version 42.0.0 rapidly?**
A: No. Major bumps indicate breaking changes. If you maintain backward compatibility, you stay on the same major version.

**Q: What about updating dependencies?**
A: Updating your own dependencies without changing your public API = patch bump (if dependency change is transparent to users).

**Q: How do I handle deprecating functionality?**
A: 
1. Minor bump: Mark as deprecated in docs, add deprecation warning
2. Major bump (later): Remove the deprecated function

**Q: What if I accidentally release a breaking change as minor?**
A: 
1. Immediately release a revert as patch
2. Re-release the breaking change as major
3. Document the incident in changelog

## References

- [Semantic Versioning 2.0.0 Specification](https://semver.org/spec/v2.0.0.html)
- [Conventional Commits](https://conventionalcommits.org/)
- [npm Semantic Versioning](https://docs.npmjs.com/about-semantic-versioning/)
