<div align="center">
  <a href="https://superloom.dev">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/superloomdev/superloom/main/superloom.png" height="80">
      <img alt="Superloom" src="https://raw.githubusercontent.com/superloomdev/superloom/main/superloom.png" height="80">
    </picture>
  </a>
  <h1>Superloom</h1>
  <p>A modular Node.js framework for backend applications. Build once. Deploy anywhere. AI-native.</p>

  [![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
  [![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-brightgreen.svg)](https://nodejs.org)
  [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/superloomdev/superloom/blob/main/CONTRIBUTING.md)

</div>

Superloom is an opinionated, modular Node.js framework where the same business logic runs unchanged on **Docker (Express)** and **AWS Lambda** — one codebase, zero duplication. Designed from the ground up for AI-assisted development.

- **Transport-agnostic** — Express and Lambda share every layer except the interface adapter
- **AI-native** — ships with `AGENTS.md` + per-module `ROBOTS.md` so AI assistants onboard in seconds
- **Opinionated** — one DTO shape, one injection pattern, one testing strategy, documented reasoning for every decision
- **20+ helper modules** — databases, auth, storage, queues, crypto, and more — all returning the same `{ success, data, error }` envelope

## Documentation

Full documentation at **[superloom.dev](https://superloom.dev)**.

| Section | Content |
|---|---|
| [What is Superloom?](https://superloom.dev/docs/) | Overview, philosophy, architecture, modules |
| [Getting Started](https://superloom.dev/docs/guide/getting-started) | Run the demo project locally |
| [Architecture](https://superloom.dev/docs/architecture/architectural-philosophy) | Technical standards and patterns |
| [Developer Setup](docs/dev/README.md) | Environment, tokens, Docker, Git |

## Quick Start

```bash
git clone https://github.com/superloomdev/superloom.git
cp -r demo-project/ my-project/
cd my-project && npm install && npm start
```

## License

[MIT](LICENSE) — free for commercial use.

---

<div align="center">
  <a href="https://superloom.dev">Website</a> · <a href="https://superloom.dev/docs/">Docs</a> · <a href="https://aiwonderland.co">By AI Wonderland</a>
</div>