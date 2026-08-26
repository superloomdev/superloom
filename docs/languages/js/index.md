# JavaScript Implementation

The JavaScript layer is Superloom's reference implementation: Node.js 24+, Express on Docker and AWS Lambda for the server, GitHub Packages for module distribution, and the built-in Node.js test runner throughout. Every document in this layer is complete on its own; a JavaScript developer works from here without needing the principles layer.

These documents dictate the JavaScript way. The reasoning behind each rule lives in [`principles/`](../../principles/engineering-philosophy.md); each document below implements one or more principles documents, per the mapping table.

## Reading Path

For a developer new to the framework, in order:

1. [Project Structure](project-structure.md) - the directory layout and repository conventions
2. [Code Formatting](code-formatting.md) - spacing, banners, comments, naming, JSDoc
3. [Module Structure](module-structure.md) - loaders, companions, patterns, and every archetype skeleton
4. [Function Naming](function-naming.md) - the verb catalog, return shapes, confusable pairs, and banned verbs
5. [Module Classes](module-classes.md) - the class taxonomy and where every module belongs
6. [Composition and Adapters](composition-and-adapters.md) - the four tiers in JS, host adapters, the adapter gate
7. [Error Handling](error-handling.md) - envelopes, catalogs, throw versus return in JavaScript
8. [Testing Strategy](testing-strategy.md) and [Unit Test Authoring](unit-test-authoring.md)
9. [Server Common](server/server-common.md) - the composition root, loader, and shared runtime foundation
10. [Server Interfaces](server/server-interfaces.md) - the Express and Lambda entry points
11. [Connection Lifecycle](server/connection-lifecycle.md) - three lifetimes, two teardown scopes, the deployment rule
12. [Client Architecture](client/client-architecture.md) - the RNW/Expo stack, project layout, and bundler-agnostic rule (entry point to the `client/` section)
13. [React Native Environment Setup](client/rn-environment-setup.md) - system prerequisites, local development, Metro bundler
14. [Expo Guide](client/expo-guide.md) - Expo capabilities, adapter pattern, cloud account features
15. [React Native Testing](client/rn-testing.md) - testing conventions for RN and Expo modules

## Document Map

| Document | Implements |
|---|---|
| [`project-structure.md`](project-structure.md) | [Engineering Philosophy](../../principles/engineering-philosophy.md) |
| [`code-formatting.md`](code-formatting.md) | [Code Readability](../../principles/code-readability.md) |
| [`module-structure.md`](module-structure.md) | [Module Design](../../principles/module-design.md), [File Archetypes](../../principles/file-archetypes.md) |
| [`function-naming.md`](function-naming.md) | [Code Readability](../../principles/code-readability.md) |
| [`factory-vs-singleton.md`](factory-vs-singleton.md) | [Module Design](../../principles/module-design.md) |
| [`module-classes.md`](module-classes.md) | [Module Design](../../principles/module-design.md) |
| [`composition-and-adapters.md`](composition-and-adapters.md) | [Composition and Adapters](../../principles/composition-and-adapters.md) |
| [`dependencies.md`](dependencies.md) | [Module Design](../../principles/module-design.md) |
| [`error-handling.md`](error-handling.md) | [Error Handling](../../principles/error-handling.md) |
| [`validation.md`](validation.md) | [Validation](../../principles/validation.md) |
| [`testing-strategy.md`](testing-strategy.md), [`unit-test-authoring.md`](unit-test-authoring.md), [`module-testing.md`](module-testing.md), [`integration-testing.md`](integration-testing.md) | [Testing](../../principles/testing.md) |
| [`module-docs.md`](module-docs.md), [`module-docs-complex.md`](module-docs-complex.md), [`module-thoughts-file.md`](module-thoughts-file.md) | [Module Design](../../principles/module-design.md), [Documentation Authoring](../../principles/documentation-authoring.md) |
| [`publishing.md`](publishing.md), [`versioning/`](versioning/index.md) | [Versioning and Releases](../../principles/versioning-and-releases.md) |
| [`dto-philosophy.md`](dto-philosophy.md), [`server/`](server/server-loader.md), [`server/connection-lifecycle.md`](server/connection-lifecycle.md) | [Server Architecture](../../principles/server-architecture.md) |
| [`client/`](client/client-architecture.md) | Client-side architecture: stack, loader, theming, fonts, components, super-app shapes, module taxonomy, RN environment setup, Expo guide, RN testing |
| [`catalog-core.md`](catalog-core.md), [`catalog-server.md`](catalog-server.md), [`catalog-client.md`](catalog-client.md) | The published module catalog per tier |
| [`conventions-registry.md`](conventions-registry.md) | Settled micro-conventions lookup table |
| [`pitfalls-migration.md`](pitfalls-migration.md) | Pitfall journal for module migration work |

## Module Repositories

| Repository role | Contents |
|---|---|
| JS implementation repository | All helper modules: `src/helper-modules-core/`, `src/helper-modules-server/`, `src/helper-modules-client/`, and the publish pipeline |
| JS reference application | The working demo application: models, server layers, ops runbook |

Repository names and the full multi-repo layout: [`org-structure.md`](../../dev/org-structure.md).

## Naming Forms (Two-Form Rule)

A JavaScript module's name exists in exactly two forms:

| Form | Example | Where it may appear |
|---|---|---|
| **Published identity** | `@superloomdev/js-helper-utils` | `package.json` only (`name`, dependency targets, repository field) |
| **Alias short-name** | `helper-utils` | Everywhere else: documentation prose, titles, code comments, JSDoc, error prefixes, banners, `ROBOTS.md` |

The bare package name (`js-helper-utils`) is a directory-layout identifier, acceptable only in URLs that address a real repository path. There is no third form. The alias derivation rule (strip `js-` and the `server`/`client` tier word, keep the rest) lives in [`code-formatting.md`](code-formatting.md#npm-package-aliases).

This is what keeps the ecosystem forkable: a consumer who renames the scope edits `package.json` files and nothing else.
