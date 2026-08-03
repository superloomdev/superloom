# Project Management

How a product built on the framework records what it is, what it does, and how it changes. This layer exists so that a product owner, a product manager, a new engineer, or an AI agent can understand a project in minutes and can maintain it without inventing structure. Everything here is language-agnostic and applies to any product repository.

## On This Page

- [The Canonical File](#the-canonical-file)
- [PROJECT.md Structure](#projectmd-structure)
- [The Feature Ledger](#the-feature-ledger)
- [The Changelog](#the-changelog)
- [The Decision Log](#the-decision-log)
- [Update Triggers](#update-triggers)
- [Size Budgets and Overflow](#size-budgets-and-overflow)
- [Multi-Repo Products](#multi-repo-products)
- [Provenance Neutrality](#provenance-neutrality)
- [Why These Formats](#why-these-formats)

## The Canonical File

Every product has exactly one management entry point: **`PROJECT.md` at the root of the product's main repository**. The main repository is the one that owns the domain - usually the server repository. Client repositories, SDK packages, and other satellites link to it from their `README.md` and never duplicate its content.

`PROJECT.md` is the product owner's view. It answers, in order: what problem exists, what the solution is, who uses it, what applications and services compose it, what features exist and in what state, and how the system is shaped at the top level. It is not engineering documentation; it links to engineering documentation.

Two companions are standard files with standard names, because tooling and readers expect them:

| File | Holds |
|---|---|
| `PROJECT.md` | Identity, applications, services, feature ledger, architecture overview, decision log |
| `CHANGELOG.md` | Release history in Keep a Changelog format |
| `docs/` (product repo) | Deep engineering documentation that `PROJECT.md` links into |

## PROJECT.md Structure

Fixed section order. A section that does not apply is kept with the line "Not applicable" and a reason, so absence is a statement rather than an oversight.

1. **Identity.** Product name, one-line description, the problem in two or three sentences, the solution in two or three sentences. A reader who stops here still knows what the product is.
2. **Actors.** Who touches the system, one row per actor: role, what they want, which application serves them.
3. **Applications.** One row per application: name, audience, purpose, status. For a super-app, every shape is a row, and the launcher is a row. This table is the definition of the product surface.
4. **Services.** One row per deployable server: name, entities it owns, transport. A product with one server has one row. A product composed of several connected servers lists each; the table is what makes a multi-server product legible.
5. **Common thread.** One short paragraph stating what binds the applications into one product: shared account, shared tenancy, shared data, shared pass, whatever the binding is. A super-app without a stated common thread is a bundle, not a product.
6. **Scale assumptions.** The numbers the architecture is designed against: tenants, daily active users, peak concurrent operations, data volume, retention. Numbers may be illustrative but must be internally consistent and labeled as assumptions. They exist because architecture choices are otherwise unjustifiable - a queue, a cache, or a read replica is only explainable against a number.
7. **Architecture overview.** The map of the territory: layers, stores, service boundaries, and the system invariants that must not be violated. Describe boundaries and responsibilities, not file trees. Link to deeper documentation for everything below the top level.
8. **Feature ledger.** See [The Feature Ledger](#the-feature-ledger). Moves to `FEATURES.md` on overflow.
9. **Decision log.** See [The Decision Log](#the-decision-log).
10. **Links.** `CHANGELOG.md`, satellite repositories, engineering docs, operational runbooks.

## The Feature Ledger

The ledger is the source of truth for what the product does, did, and will do. Commits, releases, and planning all reference features by ID, so the format is fixed and machine-followable.

One entry per feature:

```
F-012  Booking hold countdown
Apps:      member, kiosk
Actor:     signed-in member
Summary:   one sentence
Entities:  booking
Modules:   client timer, sdk booking module
Status:    shipped
Outcome:   -
```

Rules:

- **IDs are permanent.** Never reused, never renumbered. A retired feature keeps its ID forever
- **Status vocabulary is closed:** `proposed`, `approved`, `building`, `shipped`, `retired`. Nothing else
- **Retired features record an outcome:** `succeeded` (served its purpose, superseded or sunset), `failed` (did not achieve its goal), each with a one-line reason. This is how the ledger answers which features worked and which did not - retirement without a recorded outcome loses the only knowledge retirement produces
- **Every feature names at least one application, one entity, and one module.** An entry that names none of these is a wish, and wishes do not enter the ledger; they stay in planning
- **`proposed` rows are cheap and welcome.** The ledger is also the intake for what needs to be added; a product manager reads the `proposed` rows as the backlog summary

## The Changelog

`CHANGELOG.md` in the main repository, following the Keep a Changelog convention, because it is the most widely adopted open-source format and both humans and tools parse it:

- One `## [version] - date` section per release, newest first, with an `## [Unreleased]` section on top
- Entries grouped under `### Added`, `### Changed`, `### Fixed`, `### Removed`, `### Deprecated`, `### Security`
- Entries cite feature IDs where a feature is involved: `Added booking hold countdown (F-012)`
- Versions follow Semantic Versioning as applied to the product's public surface

The product changelog records product-level change. Module and package changelogs are a separate concern with their own conventions under the language documentation; the product changelog links to them rather than absorbing them.

## The Decision Log

Major decisions - the ones a future maintainer would otherwise re-litigate - get a short dated record: context in one or two sentences, the decision, the reason, and what was rejected. Keep them as a table or short list inside `PROJECT.md` until they outgrow it, then move to one file per decision under `docs/decisions/` with the table remaining as an index.

A decision belongs in the log when reversing it would be expensive or when the reasoning would be invisible from the code. Store choices, service boundaries, protocol choices, and buy-versus-build calls qualify. Formatting preferences do not.

## Update Triggers

Stale management documents are worse than absent ones, because readers trust them. Each artifact has a defined trigger, and the update travels in the same change as the work:

| Event | Update |
|---|---|
| Feature work ships | Ledger row flips to `shipped` in the same change |
| Feature is abandoned or removed | Row flips to `retired` with outcome and reason, in the same change |
| Release is cut | `Unreleased` section becomes the release section in `CHANGELOG.md` |
| Service or store is added or removed | Services table and architecture overview, in the same change |
| Application or shape is added | Applications table, in the same change |
| Major decision is made | Decision log entry, when the decision lands |

The rule that makes this work: **a change that alters the product surface is incomplete until the management layer reflects it.** Review should reject the change, not schedule a follow-up.

## Size Budgets and Overflow

`PROJECT.md` targets 300 lines with a hard ceiling of 400. At the ceiling, overflow in this order:

1. Feature ledger moves to `FEATURES.md`; `PROJECT.md` keeps a five-line summary (counts by status) and the link
2. Architecture overview moves to `ARCHITECTURE.md`; `PROJECT.md` keeps the invariants and the link
3. Decision log moves to `docs/decisions/`; `PROJECT.md` keeps the index table

Identity, actors, applications, services, common thread, and scale assumptions never move out. If those alone breach the budget, the product description is bloated, not the format.

## Multi-Repo Products

The main repository owns `PROJECT.md`. Every satellite repository's `README.md` carries a line identifying which product it belongs to and linking to the main repository's `PROJECT.md`. Satellites never carry their own feature ledgers or product changelogs; they carry only their own package-level changelogs where the language conventions require them.

The applications table in `PROJECT.md` names the repository each application lives in, so the file is also the map of the product's repositories.

## Provenance Neutrality

Product documentation never names other projects, clients, or products that informed its design - neither predecessors, nor inspirations, nor prior work the team has access to. This holds for `PROJECT.md`, feature descriptions, code comments, sample data, and naming inside the product. Domain vocabulary is chosen fresh for the product at hand.

The reasons: prior work may be owned by or associated with other parties who never agreed to be referenced; and a product defined by reference to another product is illegible to anyone who does not know the referent. Knowledge transfers; names do not.

## Why These Formats

Chosen for three properties simultaneously:

- **Open-source native.** `CHANGELOG.md` with Keep a Changelog, SemVer, and a root-level project file are conventions readers and tools already know. Nothing here requires proprietary tooling; everything is plain Markdown in the repository, versioned with the code it describes
- **AI-executable.** Fixed section orders, closed status vocabularies, stable IDs, and defined update triggers mean an agent can create, update, and audit these documents without judgment calls about structure. Judgment is spent on content
- **Human-sufficient.** A product owner reads `PROJECT.md` top to bottom and knows the product; a product manager reads the ledger's `proposed` and `retired` rows and knows the backlog and the lessons; an engineer reads the architecture overview and knows the boundaries. Each audience has one place to look
