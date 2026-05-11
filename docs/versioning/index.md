# Versioning Guide

> Complete guide to Semantic Versioning, dependency management, and release procedures for Superloom.

## Quick Reference

| Document | Purpose |
|----------|---------|
| [Semantic Versioning](./semantic-versioning.md) | SemVer 2.0.0 spec + Superloom rules |
| [Dependency Management](./dependency-management.md) | npm version ranges: `^`, `~`, exact, wildcards |
| [CI Dependency Graph](./ci-dependency-graph.md) | How GitHub Actions job ordering works |
| [Version Bump Checklist](./bump-checklist.md) | Step-by-step release procedure |
| [Changelog Format](./changelog-format.md) | Conventional Commits → CHANGELOG.md |
| [API Stability (JavaScript)](./api-stability-js.md) | What constitutes "public API" in Superloom |

## Core Principle

Superloom follows [Semantic Versioning 2.0.0](https://semver.org/) across all modules:

```
MAJOR.MINOR.PATCH
  1.0.0
  │ │ │
  │ │ └── Patch: Bug fixes only
  │ └──── Minor: New features, backward compatible
  └────── Major: Breaking changes
```

## Module vs Project Versioning

| Level | Example | Tracks |
|-------|---------|--------|
| **Module** | `js-helper-utils@1.2.3` | Individual package API changes |
| **Project** | `demo-project@2.5.0` | Composition and integration features |
| **Frontend** | `frontend@3.1.0` | UI/UX features and components |

Module versions are independent. A project can use `js-helper-utils@1.3.2` while being at `v2.5.0` itself.

## Automatic Updates

Test dependencies use caret (`^`) ranges:

```json
{
  "dependencies": {
    "@superloomdev/js-helper-utils": "^1.0.0"
  }
}
```

This automatically resolves to latest compatible version:
- `1.0.0` → `1.0.1` (patch) ✓ Auto-updates
- `1.0.0` → `1.1.0` (minor) ✓ Auto-updates  
- `1.0.0` → `2.0.0` (major) ✗ Stays on 1.x.x

Patch and minor updates flow automatically. Major versions require explicit migration.

## Where to Start

- **First time releasing?** → Read [Version Bump Checklist](./bump-checklist.md)
- **Unsure about version impact?** → Read [Semantic Versioning](./semantic-versioning.md)
- **CI job failed?** → Read [CI Dependency Graph](./ci-dependency-graph.md)
- **Adding new dependency?** → Read [Dependency Management](./dependency-management.md)
