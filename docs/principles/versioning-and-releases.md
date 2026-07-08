# Versioning and Releases

Modules are published independently, versioned semantically, and released exclusively through the automated pipeline. The rules exist so a consumer can trust a version range and a maintainer can release without ceremony or fear. This document states the universal rules; the operational procedures (bump checklists, pipeline mechanics, dependency graphs) live in the language layers.

## On This Page

- [Semantic Versioning](#semantic-versioning)
- [Conventional Commits](#conventional-commits)
- [Releases Are Pipeline-Only](#releases-are-pipeline-only)
- [The Pre-Publish Gate](#the-pre-publish-gate)
- [Dependency Ranges](#dependency-ranges)
- [Language Implementations](#language-implementations)

---

## Semantic Versioning

Every module follows [Semantic Versioning](https://semver.org): `MAJOR.MINOR.PATCH`.

| Bump | When |
|---|---|
| **MAJOR** | Any change a consumer could observe as breaking: a removed or renamed public function, a changed parameter order, a changed return shape, a removed error catalog entry, a raised runtime requirement |
| **MINOR** | New capability, backward compatible: a new public function, a new optional parameter, a new catalog entry |
| **PATCH** | A fix or internal change with no observable contract difference |

The public surface for versioning purposes is everything a consumer can depend on: function signatures, return envelope shapes, error catalog types, and configuration keys. Documentation-only changes are patches. When in doubt between two bump levels, take the higher one; a conservative major costs consumers a review, an optimistic minor costs them an outage.

Version numbers move forward only. A bad release is followed by a higher fixed version, never by republishing over an existing number: consumers resolve ranges against the registry, and a mutated version breaks the one guarantee versioning provides.

## Conventional Commits

Commit messages follow [Conventional Commits](https://conventionalcommits.org): `type(scope): summary`, where the scope names the module touched. The commit type and the version bump correspond (`fix` to patch, `feat` to minor, a breaking marker to major), which makes the release history reconstructible from the log alone. Commits stay single-line unless a body genuinely adds information.

## Releases Are Pipeline-Only

The rule: **no human publishes a package manually. Ever.**

A release happens by bumping the version in the module's manifest and pushing to the main branch. The pipeline detects the version that is not yet on the registry, runs the module's lint and tests, and publishes only on success. The pipeline also self-heals: after a registry wipe or an organization migration, the same detection logic republishes everything missing, with a safety check that never overwrites a version already live.

The reasoning: a manual publish bypasses the test gate, produces artifacts that do not correspond to a commit, and cannot be reconstructed later. The pipeline makes every published artifact traceable to a green build of a specific commit.

## The Pre-Publish Gate

Before a version bump is pushed, the module must pass its full local gate: linting with zero findings and the complete test suite green, run from a clean dependency install. The pipeline runs the same checks, but pushing an unverified bump converts a private mistake into a broken pipeline run that blocks everyone downstream. The gate is the contributor's procedure; the pipeline is the enforcement.

## Dependency Ranges

- **Modules depend on each other through published versions**, using compatible-range specifiers (caret ranges), never through local file links outside a module's own test setup.
- **Ranges are pinned to the version whose API the code actually calls.** Consuming code that uses a function added in `1.2.0` declares `^1.2.0`, not `^1.0.0`; otherwise a fresh install may resolve an older version and the missing API surfaces as a runtime failure far from its cause.
- **Foundation modules stay conservative.** The lowest-level modules are the most depended-upon; their majors are rare, deliberate events with migration notes.

---

## Language Implementations

| Language | Document |
|---|---|
| JavaScript | [`languages/js/versioning/index.md`](../languages/js/versioning/index.md) (bump checklist, changelog format, CI dependency graph, API stability) and [`languages/js/publishing.md`](../languages/js/publishing.md) |
