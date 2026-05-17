<div align="center">
  <a href="https://superloom.dev">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/superloomdev/superloom/main/superloom.png" height="80">
      <img alt="Superloom" src="https://raw.githubusercontent.com/superloomdev/superloom/main/superloom.png" height="80">
    </picture>
  </a>
  <h1>Superloom</h1>
  <p><strong>A modular Node.js framework for backends that survive AI-paced change. Build once, deploy anywhere, review anything.</strong></p>
  <p><em>Built on patterns proven across two decades of production systems, distilled into a thin opinionated frame around real, pre-tested helper modules.</em></p>

  [![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
  [![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-brightgreen.svg)](https://nodejs.org)
  [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/superloomdev/superloom/pulls)

</div>

## Why Superloom

- **Build once. Reuse on every new project.** Every module ships pre-tested with a stable contract, so the next codebase — and the AI agent helping build it — relies on the wrapper instead of re-discovering the plumbing each time.

- **Designed for human review of AI output.** Section banners, short functions, scoped comments, and a single response envelope let a reviewer read any module top-to-bottom and spot what an AI got wrong, without getting lost in dense logic.

- **Opinionated enough that AI can't drift.** One loader shape, one validation contract, one error envelope — every contributor stays on the same rails, human or AI, so a six-month-old codebase still looks like a six-day-old one.

- **Real modules, not an abstraction layer.** Each helper wraps one production library (Postgres, S3, MongoDB, …) so when an upstream driver changes, only the wrapper updates. Your application code stays exactly as it is.

## What's in the Box

30+ helper modules across **databases** (Postgres, MySQL, SQLite, MongoDB, DynamoDB), **storage and queues** (S3, SQS), **auth and verification** (sessions, JWT, one-time codes — with hot-swappable store adapters per backend), **observability** (structured logging, compliance-friendly action logs), and **utilities** (crypto, HTTP, time, instance lifecycle). Each module is independently versioned, independently testable, and ships with its own README, `ROBOTS.md`, and CI pipeline. Full catalog in the [docs](https://superloom.dev/docs/).

A reference demo project (`demo-project/`) shows how the layers fit together: model → controller → service → interfaces (Express + Lambda), with the same business logic running unchanged on both.

## Documentation

Full documentation at **[superloom.dev](https://superloom.dev)**.

| Section | Content |
|---|---|
| [What is Superloom?](https://superloom.dev/docs/) | The 60-second overview, the four messages above in detail, and a tour of a real module file |
| [Getting Started](https://superloom.dev/docs/guide/getting-started) | Three integration approaches (fork, local copy, direct), running the demo project, first endpoint |
| [Architecture](https://superloom.dev/docs/foundations/architectural-philosophy) | Layered design, request flow, validation, error handling, code-formatting standards |
| [Developer Setup](docs/dev/README.md) | Environment, tokens, Docker, Git |

## Quick Start

```bash
git clone https://github.com/superloomdev/superloom.git
```

Then follow [Getting Started](https://superloom.dev/docs/guide/getting-started) to pick one of the three integration approaches and run the demo project. The demo is a multi-package layout — each layer (`model`, `model-server`, `server`, …) is its own package, so the install steps live with the guide rather than here.

## License

[MIT](LICENSE) — free for commercial use.

---

<div align="center">
  <a href="https://superloom.dev">Website</a> · <a href="https://superloom.dev/docs/">Docs</a> · <a href="https://aiwonderland.co">By AI Wonderland</a>
</div>