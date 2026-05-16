# Module README Structure

How every helper module documents itself. The rule is that each module ships three files — `README.md`, `docs/*.md`, and `ROBOTS.md` — each targeted at a distinct reader and a distinct purpose. This page defines what goes where, in what order, and why.

## On This Page

- [The Three-Tier Model](#the-three-tier-model)
- [Audiences and Personas](#audiences-and-personas)
- [Universal README Sections](#universal-readme-sections)
- [Class-Specific Sections](#class-specific-sections)
- [`docs/` Folder Pattern by Class](#docs-folder-pattern-by-class)
- [Section Order and Why It Matters](#section-order-and-why-it-matters)
- [Readability Test Passes](#readability-test-passes)
- [Authoring Checklist](#authoring-checklist)
- [Further Reading](#further-reading)

---

## The Three-Tier Model

Each module's documentation is split across three files. Each file has one audience and one job. They do not duplicate each other.

| File | Audience | Tone | Length budget |
|---|---|---|---|
| `README.md` | Non-technical evaluator, developer evaluating, developer integrating (first read) | Plain language, value-first | ~150 lines |
| `docs/*.md` | Developer integrating (deep), maintainer, code reviewer | Reference-grade, exhaustive | No fixed limit |
| `ROBOTS.md` | AI assistant generating or reviewing code | Compact, dense, machine-friendly | ~100-150 lines |

**The README is the entry point.** It explains *what the module is and why it exists* in plain language. It links into `docs/` for reference detail and to `ROBOTS.md` for AI-specific guidance. It does not contain configuration tables, function signatures, or return shapes — those belong in `docs/`.

**The `docs/` folder is the reference layer.** Complete, exhaustive, written for someone actively integrating or maintaining the module. Adapter modules and simple foundation modules usually skip this folder; driver and feature modules need it.

**`ROBOTS.md` is the AI surface.** Compact, structured, every exported function with its signature and return shape. See `ROBOTS.md` in each module for the existing convention.

---

## Audiences and Personas

Five personas guide README authoring. Run a readability pass against each one before publishing.

| # | Persona | Reads | Looking for |
|---|---|---|---|
| 1 | **Manager / decision-maker** | README only | Identity, value, social proof, philosophy frame |
| 2 | **Developer evaluating** | README + skims `docs/` | What it does, what it does NOT do, how it differs from raw `pg`/`mysql2`/etc. |
| 3 | **Developer integrating** | README quick-start, then `docs/api.md` + `docs/configuration.md` | Install, minimal example, full API |
| 4 | **Code reviewer / auditor** | README "Why use this" + scans source | Confidence the wrapper is well-built, predictable, well-tested |
| 5 | **AI assistant** (Cascade, Cursor, Copilot) | `ROBOTS.md` first, README only on user request | Exact signatures, return shapes, gotchas, config keys |

**The single most important rule:** persona 1 (manager) must be able to read the README top-to-bottom and finish with a clear, accurate understanding of what the module is and why it exists — without ever seeing a configuration table or function signature.

---

## Universal README Sections

Every module README follows this section order, regardless of class. Two sections are class-conditional and slot in between the Why bullets and the Aligned-with-Superloom paragraph; everything else is universal.

| # | Section | Purpose |
|---|---|---|
| 1 | **Title + Identity Badges** | Visual identity. License + runtime version only. The CI / test status badges are NOT here — they belong with the testing block at the bottom. |
| 2 | **Tagline** | One sentence; plain English; ends with "Part of [Superloom](https://superloom.dev)". Do NOT mention sibling backends or competitor modules in the tagline — see [Anti-Patterns](#anti-patterns-to-avoid). |
| 3 | **What this is** | 1-2 short paragraphs in plain English explaining the module's role. May include a tiny vertically-spaced illustration of the module's response shape — never a full code example. |
| 4 | **Why use this module** | Value bullets (5-7 points) — the core marketing pitch. Jargon-free, vendor-neutral. Each bullet is one sentence + at most one supporting sentence. |
| 5 | **Hot-Swappable with Other Backends** *(class-conditional)* | Bullet list of sibling modules with the same API. Present for any module with at least one sibling (Class B drivers, some Class C cloud wrappers, some Class E feature modules). |
| 6 | **Class-Specific Section** *(class-conditional)* | One section per [Class-Specific Sections](#class-specific-sections) (e.g. "Architecture overview" for Class E feature modules). |
| 7 | **Aligned with Superloom Philosophy** | One short paragraph explaining that the module follows Superloom conventions, so adopting it preserves consistency for projects already on Superloom. |
| 8 | **Learn More** | Links to extended documentation in `docs/` and to Superloom. Does NOT link to `ROBOTS.md` — that file is for AI assistants, not human readers. |
| 9 | **Adding to Your Project** | Recommends installation as a peer dependency through the project's loader pattern. Does NOT include a copy-paste `npm install` snippet — links to the loader-pattern doc instead. |
| 10 | **Testing Status** | Status table showing which test tiers have passed (Emulated / Integration). Test runtime details (Docker lifecycle, env vars) live in `docs/configuration.md` under "Testing Tiers", not here. |
| 11 | **License** | MIT |

### Section 4 — Why Use This Module

This is the heart of the README. The bullets articulate the value of the wrapper pattern in concrete, persona-friendly language. Most modules can adapt these recurring themes — but adapt the **wording** to the module class and audience:

| Theme | Framing example |
|---|---|
| **Insulation** | "When the underlying driver ships a breaking change, only this module needs updating. Your application code stays exactly as it is." |
| **Pre-tested** | "A full test suite runs against a real instance in CI on every push. Your project trusts the wrapper instead of re-verifying plumbing on each release." |
| **Reviewability** | Frame around what a reviewer can SEE: clearly-marked visual sections, short functions, comments as checkpoints, scannable top-to-bottom flow. Do NOT use the word "metaprogramming". Invite the reader to open the source to verify. |
| **Observability** | Frame around capabilities (timing, slow-query review, toggle for prod vs dev). Do NOT name the specific functions or config keys — those go in `docs/`. |
| **Deployment flexibility** | "Works on both serverless and persistent infrastructure". Use industry-neutral category names. Vendor names (Lambda, EC2, Kubernetes) only as illustrative examples in parentheses, never as headline categories. |

Pick the five-to-seven themes that apply to the module's class. The principle behind these bullets lives in [`architectural-philosophy.md`](architectural-philosophy.md#coding-practices) — "All external libraries wrapped".

### Section 5 — Hot-Swappable with Other Backends *(class-conditional)*

A short paragraph followed by a bullet list of sibling modules. Each bullet links to the sibling on GitHub. Drives home that switching backends is a one-line loader change. Belongs in its own section so adding a new sibling is a single-line edit, not a hunt across the whole README.

### Section 7 — Aligned with Superloom Philosophy

One short paragraph. Frames Superloom alignment as **consistency for projects that already use Superloom**, not as a "why use this wrapper" benefit. The framing is: "if your project is built on Superloom conventions, this module slots in without you needing to learn anything new."

This deliberately is NOT one of the Why bullets — see [Anti-Patterns](#anti-patterns-to-avoid).

### Section 8 — Learn More

A short list pointing to:

- `docs/api.md` (if present) — full API reference
- `docs/configuration.md` (if present) — all config keys, environment variables, patterns
- `docs/data-model.md` / `docs/storage-adapters.md` (Class E only)
- [Superloom](https://superloom.dev) — the framework

Do NOT link to `ROBOTS.md` from the README. `ROBOTS.md` is the AI surface; humans should not be directed there.

### Section 9 — Adding to Your Project

Frame the integration as **package peer-dependency through the loader pattern**, not as a `npm install <pkg>` command. Recommend the published package; warn against vendoring or local file dependencies. Link to:

- [Server Loader Architecture](https://github.com/superloomdev/superloom/blob/main/docs/architecture/server-loader.md) — the loader pattern doc on GitHub
- [npmrc setup](https://github.com/superloomdev/superloom/blob/main/docs/dev/npmrc-setup.md) — one-time GitHub Packages registry setup

### Section 10 — Testing Status

A status table showing which tiers have passed:

| Tier | Runtime | Status |
|---|---|---|
| Emulated | (e.g. Postgres 17 in Docker) | CI badge |
| Integration | (e.g. real PostgreSQL 15+) | Status badge |

Detailed test instructions (Docker lifecycle, env vars, integration setup) live in `docs/configuration.md` under "Testing Tiers", not in the README.

---

## Class-Specific Sections

Every module belongs to one of six classes (enumerated in [`module-categorization.md`](module-categorization.md)). Each class can add one section between sections 4 (Why bullets) and 7 (Aligned with Superloom). The class-specific section sits at position 6 in the section order.

| Class | Section name | Contents |
|---|---|---|
| **A. Foundation utility** | "API Categories" | Grouped overview of available functions, one line each. No signatures. |
| **B. Driver wrapper** | (none extra) | The Hot-Swappable section at position 5 already serves Class B's special case. |
| **C. Cloud service wrapper** | "Credentials & Permissions" | Short section on credentials, regional config, IAM/permissions. Vendor-neutral wording. |
| **D. Lifecycle helper** | "Behavior" | Explains lifecycle semantics (cleanup ordering, background tasks). |
| **E. Feature module with adapters** | "Architecture Overview" | High-level diagram or tree. Storage-adapter selection callout linking to `docs/storage-adapters.md`. |
| **F. Storage adapter** | "How This Fits Into the Parent Module" | Adapter factory protocol explanation. Link to parent module's docs. |

The Hot-Swappable section at position 5 is itself class-conditional — it appears whenever a module has at least one sibling, irrespective of class.

---

## `docs/` Folder Pattern by Class

The `docs/` folder is where the dense technical material lives. Different classes need different depths.

| Class | Recommended `docs/` files |
|---|---|
| **A. Foundation** | None — the README is enough |
| **B. Driver** | `docs/api.md`, `docs/configuration.md` |
| **C. Cloud service** | `docs/api.md`, `docs/configuration.md`, optionally `docs/iam.md` |
| **D. Lifecycle** | Usually none; `docs/api.md` only if the lifecycle is non-trivial |
| **E. Feature** | `docs/data-model.md`, `docs/configuration.md`, `docs/storage-adapters.md`, optionally `docs/integration-express.md`, `docs/integration-lambda.md` |
| **F. Adapter** | None — the README and the schema section inside it are enough |

For the long-form structure of feature-module `docs/` folders see [`complex-module-docs-guide.md`](complex-module-docs-guide.md).

### `docs/api.md`

Full function reference. One subsection per function with:

- Signature
- Parameter table (name, type, required, description)
- Return shape (success and error envelopes)
- Examples
- Semantics, gotchas, library-specific notes

The intro of `docs/api.md` cross-references `docs/configuration.md` (the user often needs both). It does NOT cross-reference `ROBOTS.md` — that file is for AI agents and lives in a separate flow.

### `docs/configuration.md`

Every config key the loader accepts. Every environment variable consumed by `_test/loader.js`. Peer dependencies. Multi-instance patterns. Pool tuning guidance. SSL configuration for managed services.

**Internal ordering rule:** the page splits into two halves:

| Half | Sections |
|---|---|
| **Reference** (top) | Loader Pattern → Configuration Keys → Environment Variables → Peer Dependencies → Direct Dependencies |
| **Patterns and Examples** (bottom) | Multi-instance / Multi-DB Setup → SSL / TLS Configuration → Pool / Resource Tuning → Testing Tiers |

The reference half answers "what can I set?". The patterns half answers "how do I combine those settings for X scenario?". An example needs the reader to have absorbed the keys first, so examples never sit between the keys.

The `Configuration Keys` table includes a **Required** column. Use "Yes (override)" for keys whose default exists but is never useful in production (`HOST`, `DATABASE`, `USER`, `PASSWORD`); "No" for everything else.

---

## Link Form

**README.md ships to npm and is rendered on the package page.** npm does not resolve relative paths. Therefore:

- **Every link in `README.md` must be a fully-qualified GitHub URL** (`https://github.com/superloomdev/superloom/blob/main/...` for files, `.../tree/main/...` for directories). Relative paths (`docs/api.md`, `../foo`) silently break on the npm page.
- Links inside `docs/*.md` may be relative or full GitHub URLs. Full GitHub URLs are still preferred for cross-references, because docs files may be opened in standalone viewers (GitHub raw, search results) where relative resolution is brittle.
- Use `blob/main/...` for files, `tree/main/...` for directories.

---

## Section Order and Why It Matters

The universal section order serves four reading paths simultaneously:

| Reader path | Sections read | Outcome |
|---|---|---|
| **Manager skim** (60 seconds) | 1 → 2 → 3 → 4 → stop | Understands identity and value; can decide whether to dig deeper |
| **Developer evaluating** (5 minutes) | 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → stop | Knows what it does, what it does NOT do, what's swappable, where to go next |
| **Developer integrating** (15+ minutes) | 1 → 8 → 9 → `docs/api.md` → `docs/configuration.md` | Skips marketing, jumps to install / loader / API |
| **Code reviewer** | 4 → source | Confirms the wrapper claims and verifies them in `postgres.js` |

The "Why use this module" section at position 4 — before any code, before installation, before configuration — is the single biggest structural choice. It serves the manager/evaluator before they bounce.

"Adding to Your Project" at position 9 (just before testing status) is intentional. An npm package's job is to be installed via `package.json`, not via copy-paste. The readers who need to install it want a pointer to the loader pattern, not a `npm install` line that bypasses the project's existing peer-dependency conventions.

---

## Readability Test Passes

Before publishing a README, run two passes:

### Pass 1 — Layman pass (Persona 1)

Read the README top-to-bottom with a non-technical hat on. After each section, ask:

- Did I understand what this section said in plain language?
- Did anything assume technical knowledge I would not have?
- By the end of section 4, do I know what the module is and why someone would use it?

If the answer to either of the first two is "no", revise. If the answer to the third is "no" by the end of section 4, the Why bullets need work.

### Pass 2 — Integrator pass (Persona 3)

Read the README looking at sections 8 (Learn More) and 9 (Adding to Your Project). Ask:

- Do I know which extended docs to read for the API and the configuration?
- Do I know how to add this module to my project as a peer dependency?
- Did I have to copy-paste a shell command, or did the README direct me to the loader pattern?

If any answer is "no" or you copy-pasted a shell command, sections 8 / 9 need work.

---

## Anti-Patterns to Avoid

These were the failure modes surfaced when the rubric was first applied to the Postgres pilot. Codified here so future migrations skip them.

- **Sibling-backend mention in the tagline.** "Same API across Postgres, MySQL, SQLite" in the tagline reads as "this module does all three" to a non-technical evaluator. Hot-swap goes in its own section (position 5), not in the headline.
- **Vendor lock-in language.** Cloud product names (AWS Lambda, EC2, RDS) at category headings make the module read as AWS-only. Use industry-neutral category names ("serverless", "persistent infrastructure", "auto-scaling managed databases") with vendor names only as illustrative examples in parentheses.
- **Jargon in marketing prose.** Words like *metaprogramming*, *idempotent*, *cargo cult* mean nothing to persona 1 and are pretentious to persona 4. Replace with concrete observable claims ("clearly-marked visual sections you can scan top to bottom").
- **Function names as marketing.** Listing `getRow / getRows / getValue / write / buildQuery` in a Why bullet is tone-deaf to persona 1. Function listings live in `docs/api.md` and `ROBOTS.md`. The Why bullet talks about capability, not surface.
- **"Part of Superloom" as a Why bullet.** Belonging to a framework is not a benefit; consistency with a project's existing philosophy is. Frame as alignment ("if your project uses Superloom conventions, this slots in") in its own section, not as a value bullet.
- **Quick Start in the README.** Pilot showed Quick Start adds noise without serving any persona well — the layman skips it, the integrator wants real examples in `docs/api.md`. Drop it. If a class genuinely needs an example block, it goes in `docs/api.md`.
- **"What this module is NOT" section.** Pilot showed boundary clarity is better served by precise wording in "What this is" than by a separate negative-list section. Drop it.
- **"Installation" with `npm install` snippet.** Wrong framing for a module published as a peer dependency. The reader who would copy-paste an install command is the wrong reader; the right reader follows the loader pattern. Replace with peer-dependency / loader pointer.
- **Test instructions in the README.** Test runtime detail (Docker lifecycle, env vars) is reference material; it lives in `docs/configuration.md`. README has only the testing **status** at the bottom.
- **Relative links in the README.** npm strips relative paths. Always use full `https://github.com/superloomdev/superloom/blob/main/...` URLs in `README.md`.
- **CI / test status badges at the top of the README.** They distract from identity. Identity badges (license, runtime) at top; test status badges in the testing-status block at the bottom.

---

## Authoring Checklist

When writing or revising a module README:

- [ ] Section order matches [Universal README Sections](#universal-readme-sections)
- [ ] Class-conditional sections (Hot-Swappable, class-specific) are present where applicable
- [ ] Value bullets at section 4 use plain language — no jargon ([Anti-Patterns](#anti-patterns-to-avoid))
- [ ] No vendor product names as category headings (Lambda, EC2, RDS, etc.) — only as illustrative examples
- [ ] No function names in marketing prose — they live in `docs/api.md` / `ROBOTS.md`
- [ ] Sibling backends (if any) are listed in the Hot-Swappable section, not in the tagline or Why bullets
- [ ] "Aligned with Superloom" sits in its own section, not in the Why bullets
- [ ] No `npm install` snippet — section 9 points to the loader pattern instead
- [ ] No detailed test instructions — section 10 shows status only; details live in `docs/configuration.md`
- [ ] Test status badges sit in the testing block at the bottom; only license + runtime badges sit at the top
- [ ] Every link in the README is a full `https://github.com/...` URL (no relative paths)
- [ ] No configuration tables in the README — they live in `docs/configuration.md`
- [ ] No function signature tables in the README — they live in `docs/api.md`
- [ ] No `ROBOTS.md` link in the README's Learn More — `ROBOTS.md` is for AI agents, not human readers
- [ ] `ROBOTS.md` is current and matches the actual exported surface
- [ ] `docs/configuration.md` reference block (Loader, Keys, Env Vars, Deps) precedes its patterns block (Multi-instance, SSL, Pool tuning, Testing)
- [ ] Passes the Layman pass (Persona 1)
- [ ] Passes the Integrator pass (Persona 3)

---

## Further Reading

- [`module-categorization.md`](module-categorization.md) — the six module classes and which class each existing module belongs to
- [`complex-module-docs-guide.md`](complex-module-docs-guide.md) — the deep guide for `docs/` folders in Class E feature modules
- [`templates/`](templates/) — concrete README templates (`README-foundation-module.md`, `README-master-template.md`, `README-feature-module.md`, `README-storage-adapter.md`)
- [`architectural-philosophy.md`](architectural-philosophy.md#coding-practices) — the "All external libraries wrapped" principle that the value bullets articulate
