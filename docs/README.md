# Superloom Documentation

> **Audience.** Contributors browsing the source tree on GitHub. This file is excluded from the rendered website.
>
> **For readers:** the published documentation lives at [superloom.dev/docs](https://superloom.dev/docs); start there. The website's landing page is [`index.md`](index.md) in this folder.

This directory is the canonical source for all Superloom technical documentation. The website renders from this content; edit files here directly.

## The Three Layers

| Layer | Purpose | Audience |
|---|---|---|
| [`principles/`](principles/) | Universal engineering rules and their reasoning, language-independent | Architects, evaluators, language extenders |
| [`languages/`](languages/) | Per-language opinionated implementations (currently `js/`) | Developers writing code |
| [`ai/`](ai/) | AI-assisted development standards: agent config, workflows, model tiering | Developers using AI agents, and the agents |

Two support sections sit beside the layers:

| Section | Purpose |
|---|---|
| [`guide/`](guide/) | Task walkthroughs: getting started, creating entities, IDE setup |
| [`dev/`](dev/) | Contributor machine setup, onboarding, planning system, pitfall journal |
| [`ops/`](ops/) | Generic, vendor-agnostic infrastructure setup guides |

## Who Should Read What

| Reader | Start with |
|---|---|
| **First-time visitor** | [`index.md`](index.md) |
| **Application developer** | [`guide/getting-started.md`](guide/getting-started.md) |
| **New contributor** | [`dev/README.md`](dev/README.md) |
| **Architect evaluating the framework** | [`principles/engineering-philosophy.md`](principles/engineering-philosophy.md) |
| **JavaScript module author** | [`languages/js/index.md`](languages/js/index.md) |
| **AI agent** | Repository `AGENTS.md`, then module-level `ROBOTS.md` files |
| **Extending to a new language** | [`principles/extending-to-a-language.md`](principles/extending-to-a-language.md) |
| **DevOps / infrastructure** | [`ops/README.md`](ops/README.md) |

## Directory Tree

```
docs/
  index.md                          # Landing page
  README.md                         # This file - the index

  principles/                       # LAYER 1 - universal rules with reasoning
    engineering-philosophy.md       #   The five convictions
    code-readability.md             #   Vertical rhythm, banners, step comments, scanning model
    file-archetypes.md              #   Named file shapes and conformance
    module-design.md                #   Module contract, companions, injection, class taxonomy
    server-architecture.md          #   MVC + Service layers, request flow, DTO one-shape rule
    error-handling.md               #   Three categories, throw vs return, envelopes, catalogs
    validation.md                   #   Hand-written co-located validation, and why
    testing.md                      #   Tiers, self-contained suites, naming
    versioning-and-releases.md      #   SemVer, conventional commits, pipeline-only releases
    third-party-libraries.md        #   Zero-dependency default and the exception criteria
    operations-documentation.md     #   Three-layer ops documentation strategy
    documentation-authoring.md      #   Voice, mechanics, placement, the Golden Rule
    extending-to-a-language.md      #   How to add or fork a language layer

  languages/
    js/                             # LAYER 2 - the JavaScript implementation
      index.md                      #   Reading path, document map, two-form naming rule
      project-structure.md          #   Directory layout and repository conventions
      code-formatting.md            #   Exact spacing, banners, JSDoc, naming, aliases
      module-structure.md           #   Loader patterns and every archetype skeleton
      module-classes.md             #   Class A-H assignments for every module
      factory-vs-singleton.md       #   The pattern decision
      error-handling.md             #   JS envelopes, frozen catalogs, prefixes
      validation.md                 #   JS validator shapes
      dependencies.md               #   Peer dependencies and the Lib container
      dto-philosophy.md             #   The one-shape rule in JavaScript
      module-docs.md                #   README / ROBOTS / docs structure per module
      module-docs-complex.md        #   docs/ folders for feature modules
      module-thoughts-file.md       #   The THOUGHTS.md engineering journal
      publishing.md                 #   CI/CD publish pipeline
      testing-strategy.md           #   Test layout and runner conventions
      unit-test-authoring.md        #   How to write unit tests
      module-testing.md             #   Testing tiers and emulator setup
      integration-testing.md        #   Real cloud testing in a sandbox account
      pitfalls-migration.md         #   Journal: module-migration failures
      catalog-core.md               #   Published core modules
      catalog-server.md             #   Published server modules
      catalog-client.md             #   Published client modules
      server/                       #   Application server layers (loader, interfaces,
                                    #   controllers, services, models, entity guide)
      versioning/                   #   Bump checklist, changelog format, CI graph,
                                    #   API stability, dependency management

  ai/                               # LAYER 3 - AI-assisted development
    index.md                        #   The operating ideas
    agent-configuration.md          #   AGENTS.md standard, size budget, ROBOTS.md
    workflow-authoring.md           #   The seven properties of reliable workflows
    model-tiering.md                #   Reasoning tier vs execution tier

  guide/                            # Task walkthroughs
  dev/                              # Contributor setup, onboarding, planning, pitfalls.md
  ops/                              # Infrastructure reference (vendor-agnostic folders,
                                    # vendor-prefixed files)
```

## Documentation Principles

Every file here follows [`principles/documentation-authoring.md`](principles/documentation-authoring.md): rule first, reason second, example third; prescriptive, generic, DRY, compact; no em dashes; American English.

Two derived artifacts are compiled from this tree and never edited directly: the repository `AGENTS.md` files and the embedded rule blocks in workflows. See [`ai/agent-configuration.md`](ai/agent-configuration.md).

### Pitfall Journals

Confirmed failures live in append-only journals (Symptom, Cause, Lesson), one per folder that needs one: [`dev/pitfalls.md`](dev/pitfalls.md) for terminal, CI, and testing failures; [`languages/js/pitfalls-migration.md`](languages/js/pitfalls-migration.md) for module-migration failures. Rule documents carry only the positive rules; the stories stay in the journals. Published heading anchors in journals are never renamed.

## Why Markdown

- Readable on GitHub without tooling
- Renders through any static site generator
- Plays well with `git diff`, code review, and AI agents
- No proprietary formats; MIT licensed
