# JavaScript Implementation

The JavaScript layer is Superloom's reference implementation: Node.js 24+, Express on Docker and AWS Lambda for the server, GitHub Packages for module distribution, and the built-in Node.js test runner throughout. Every document in this layer is complete on its own; a JavaScript developer works from here without needing the principles layer.

These documents dictate the JavaScript way. The reasoning behind each rule lives in [`principles/`](../../principles/engineering-philosophy.md); each document below implements one or more principles documents, per the mapping table.

## Reading Path

For a developer new to the framework, in order:

1. [Project Structure](project-structure.md) - the directory layout and repository conventions
2. [Code Formatting](code-formatting.md) - spacing, banners, comments, naming, JSDoc
3. [Module Structure](module-structure.md) - loaders, companions, patterns, and every archetype skeleton
4. [Module Classes](module-classes.md) - the class taxonomy and where every module belongs
5. [Error Handling](error-handling.md) - envelopes, catalogs, throw versus return in JavaScript
6. [Testing Strategy](testing-strategy.md) and [Unit Test Authoring](unit-test-authoring.md)

## Document Map

| Document | Implements |
|---|---|
| [`project-structure.md`](project-structure.md) | [Engineering Philosophy](../../principles/engineering-philosophy.md) |
| [`code-formatting.md`](code-formatting.md) | [Code Readability](../../principles/code-readability.md) |
| [`module-structure.md`](module-structure.md) | [Module Design](../../principles/module-design.md), [File Archetypes](../../principles/file-archetypes.md) |
| [`factory-vs-singleton.md`](factory-vs-singleton.md) | [Module Design](../../principles/module-design.md) |
| [`module-classes.md`](module-classes.md) | [Module Design](../../principles/module-design.md) |
| [`dependencies.md`](dependencies.md) | [Module Design](../../principles/module-design.md) |
| [`error-handling.md`](error-handling.md) | [Error Handling](../../principles/error-handling.md) |
| [`validation.md`](validation.md) | [Validation](../../principles/validation.md) |
| [`testing-strategy.md`](testing-strategy.md), [`unit-test-authoring.md`](unit-test-authoring.md), [`module-testing.md`](module-testing.md), [`integration-testing.md`](integration-testing.md) | [Testing](../../principles/testing.md) |
| [`module-docs.md`](module-docs.md), [`module-docs-complex.md`](module-docs-complex.md), [`module-thoughts-file.md`](module-thoughts-file.md) | [Module Design](../../principles/module-design.md), [Documentation Authoring](../../principles/documentation-authoring.md) |
| [`publishing.md`](publishing.md), [`versioning/`](versioning/index.md) | [Versioning and Releases](../../principles/versioning-and-releases.md) |
| [`dto-philosophy.md`](dto-philosophy.md), [`server/`](server/server-loader.md) | [Server Architecture](../../principles/server-architecture.md) |
| [`catalog-core.md`](catalog-core.md), [`catalog-server.md`](catalog-server.md), [`catalog-client.md`](catalog-client.md) | The published module catalog per tier |
| [`pitfalls-migration.md`](pitfalls-migration.md) | Pitfall journal for module migration work |

## Module Repositories

| Repository | Contents |
|---|---|
| `js-helper-modules` | All helper modules: `src/helper-modules-core/`, `src/helper-modules-server/`, `src/helper-modules-client/`, and the publish pipeline |
| `js-demo-project` | The reference application: models, server layers, ops runbook |

## Naming Forms (Two-Form Rule)

A JavaScript module's name exists in exactly two forms:

| Form | Example | Where it may appear |
|---|---|---|
| **Published identity** | `@superloomdev/js-helper-utils` | `package.json` only (`name`, dependency targets, repository field) |
| **Alias short-name** | `helper-utils` | Everywhere else: documentation prose, titles, code comments, JSDoc, error prefixes, banners, `ROBOTS.md` |

The bare package name (`js-helper-utils`) is a directory-layout identifier, acceptable only in URLs that address a real repository path. There is no third form. The alias derivation rule (strip `js-` and the `server`/`client` tier word, keep the rest) lives in [`code-formatting.md`](code-formatting.md#npm-package-aliases).

This is what keeps the ecosystem forkable: a consumer who renames the scope edits `package.json` files and nothing else.
