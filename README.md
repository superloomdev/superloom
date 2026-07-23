<div align="center">
  <a href="https://superloom.dev">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/superloomdev/superloom/main/superloom.png" height="80">
      <img alt="Superloom" src="https://raw.githubusercontent.com/superloomdev/superloom/main/superloom.png" height="80">
    </picture>
  </a>
  <h1>Superloom</h1>
  <p><strong>A modular application framework and engineering reference. One way to structure data, one way to inject dependencies, one way to handle errors.</strong></p>
  <p><em>Patterns from two decades of production systems, documented with their reasoning.</em></p>

  [![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
  [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/superloomdev/superloom/pulls)

</div>

## Why Superloom

- **The documentation is the framework.** Superloom is an opinionated engineering standard expressed as documentation: universal principles with their reasoning, and per-language implementation guides precise enough to build from. Adopt it as-is, extend it to a new language, or fork it and substitute your own opinions layer by layer.

- **Opinionated enough that AI can't drift.** One loader shape, one validation contract, one error envelope, one skeleton per file archetype. Every contributor stays on the same rails, human or AI, so a six-month-old codebase still looks like a six-day-old one.

- **Designed for human review of AI output.** Section banners, short functions, scoped comments, and a single response envelope let a reviewer read any file top-to-bottom and spot what an AI got wrong, without getting lost in dense logic.

- **Language-independent by design.** The architecture separates universal principles from language-specific opinions. JavaScript is the current reference implementation; the same principles extend to any language.

## What's in This Repository

This repository is the source of truth for the framework:

| Directory | Contents |
|---|---|
| [`docs/`](docs/) | The complete documentation: universal principles, per-language implementation guides, and AI-assisted development standards |
| [`website/`](website/) | The VitePress source for [superloom.dev](https://superloom.dev), which renders `docs/` |

The documentation is organized in three layers:

| Layer | What it holds |
|---|---|
| **Principles** | Universal engineering rules and the reasoning behind them, language-independent |
| **Languages** | Each language's complete, opinionated implementation of the principles (currently JavaScript; more planned) |
| **AI** | Standards for AI-assisted development: agent configuration, workflow authoring, model tiering |

Reference implementations built from this documentation (helper modules, a demo application) live in separate repositories under the [superloomdev](https://github.com/superloomdev) organization.

## Documentation

Read the documentation at **[superloom.dev](https://superloom.dev)**.

| Section | Content |
|---|---|
| [What is Superloom?](https://superloom.dev/docs/) | The 60-second overview and a tour of the framework's shape |
| [Getting Started](https://superloom.dev/docs/guide/getting-started) | From a clean machine to a running project |
| [Engineering Philosophy](https://superloom.dev/docs/principles/engineering-philosophy) | The five convictions every other rule traces back to |
| [JavaScript Implementation](https://superloom.dev/docs/languages/js/index) | The complete JavaScript guide: structure, formatting, testing, publishing |
| [AI-Assisted Development](https://superloom.dev/docs/ai/index) | Agent configuration, workflow authoring, model tiering |

To build the website locally:

```bash
# from website/
npm install
npm run dev
```

## Workflows

This repository ships two agent workflows that maintain the documentation:

| Workflow | Purpose |
|---|---|
| `/learn` | Capture new knowledge from a working session into its canonical place in `docs/` |
| `/finalize-docs` | Validate the documentation to convergence, then propagate it into derived artifacts |

The standard these workflows follow is itself documented in [Workflow Authoring](https://superloom.dev/docs/ai/workflow-authoring).

## Quick Start

```bash
git clone https://github.com/superloomdev/superloom.git
```

Then start with [Getting Started](https://superloom.dev/docs/guide/getting-started) to set up a project, or [What is Superloom?](https://superloom.dev/docs/) to evaluate the framework first.

## License

[MIT](LICENSE) - free for commercial use.

---

<div align="center">
  <a href="https://superloom.dev">Website</a> · <a href="https://superloom.dev/docs/">Docs</a> · <a href="https://github.com/superloomdev">GitHub</a> · <a href="https://aiwonderland.co">By AI Wonderland</a>
</div>