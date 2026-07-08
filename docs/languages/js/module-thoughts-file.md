# THOUGHTS.md: Engineering Decision Journal

Every module file that captures the *why* behind design decisions, not the *what* or *how*. This convention applies to all Superloom modules regardless of language.

**Companion docs.**

- [`module-structure.md`](module-structure.md) - Standard Files Per Module table which lists `THOUGHTS.md` alongside all other module files.
- [`publishing.md`](publishing.md) - `.npmignore` and equivalent registry exclusion rules.
- [`module-docs.md`](module-docs.md) - what goes in `README.md` and `docs/`; clarifies the boundary with `THOUGHTS.md`.

---

## On This Page

- [Why This Exists](#why-this-exists)
- [What Goes in THOUGHTS.md](#what-goes-in-thoughtsmd)
- [What Does Not Go in THOUGHTS.md](#what-does-not-go-in-thoughtsmd)
- [File Properties](#file-properties)
- [Excluding from Package Registries](#excluding-from-package-registries)
- [Rollout Policy](#rollout-policy)

---

## Why This Exists

Modules are built through design sessions where many alternatives are considered, rejected, and reasoned about. That reasoning lives only in chat logs and human memory. When work on a module resumes months later, or when a new contributor reads the code, none of that context is available. The same dead ends get explored again. The same decisions get re-litigated.

`THOUGHTS.md` captures the thinking process inside the source repository, co-located with the code it explains. It is not a changelog, not a README, and not a plan. It is the internal engineering journal of why the module is the way it is.

---

## What Goes in THOUGHTS.md

A `THOUGHTS.md` file answers five questions for future contributors:

| # | Question | What the answer must include |
|---|---|---|
| 1 | What problems were considered during design? | State each problem clearly. One problem per section or bullet. |
| 2 | What alternatives were evaluated? | List every option that was on the table, including rejected ones. |
| 3 | Why was each alternative rejected? | Specific reason. Not "too complex" but "requires the application to always call X, which creates stuck state if the process dies mid-execution." |
| 4 | What are the known limitations of the chosen approach? | Be honest. If the design only works under certain deployment constraints, say so. |
| 5 | What must never be re-implemented? | Explicit list of things that were tried or seriously considered and found wrong for this module. |

There is no required format beyond addressing these five concerns. Free-form prose organized by problem, numbered lists, and sections with headings are all acceptable, as long as the reasoning is clear and findable.

---

## What Does Not Go in THOUGHTS.md

| Content | Correct location |
|---|---|
| Implementation instructions, setup steps | `README.md` |
| API documentation (function signatures, parameters, return shapes) | `docs/api.md` |
| Data model documentation | `docs/data-model.md` |
| Runtime patterns and wiring examples | `docs/runtime.md` |
| Changelog entries | Git history or `CHANGELOG.md` |
| General project philosophy | `docs/foundations/` |
| Unresolved open questions, TODO items | Active plan in `__dev__/plans/` |

---

## File Properties

| Property | Value |
|---|---|
| Filename | `THOUGHTS.md` (all caps, consistent with `README.md`, `ROBOTS.md`, `AGENTS.md`) |
| Location | Module root, alongside `README.md` |
| Committed to git | Yes. Source documentation, not a build artifact |
| Published to package registry | No. Always excluded via the module's registry ignore file |
| Required for new modules | Yes, when significant design work was done. Skip if the module is trivial with no decisions to document. |
| Required for existing modules | No. Add when the module is next touched for a non-trivial change, or when design decisions are not obvious from the code |

---

## Excluding from Package Registries

`THOUGHTS.md` is internal contributor documentation. Package consumers have no use for it. Every module that has a `THOUGHTS.md` must exclude it from its published tarball.

### JavaScript (npm)

Add `THOUGHTS.md` to the module's `.npmignore` file:

```text
# Engineering decision journal (not for package consumers)
THOUGHTS.md
```

The canonical `.npmignore` reference implementation is `js-helper-utils`. Copy it as the starting point for any new module. See [publishing.md: Registry Ignore File](publishing.md#registry-ignore-file-npmignore) for the full `.npmignore` rules.

Verify the exclusion before publishing:

```bash
npm pack --dry-run
```

`THOUGHTS.md` must not appear in the output.

### Python (pip / PyPI)

Exclude from the source distribution using one of:

- `MANIFEST.in`: add the line `exclude THOUGHTS.md`
- `pyproject.toml` (setuptools): add to the `[tool.setuptools.exclude-package-data]` or the `find:exclude` list as appropriate for your build backend.

### Other runtimes

Apply the same principle: use whatever registry-publish exclusion mechanism your toolchain provides. In every language, `THOUGHTS.md` ships to git and not to the package registry.

---

## Rollout Policy

| Scenario | Action |
|---|---|
| New module (any language) | Include `THOUGHTS.md` from day one if design decisions were made. Skip only if the module is trivially self-evident. |
| Existing module undergoing significant work | Add `THOUGHTS.md` when the module is next touched for a non-trivial change. |
| Stable module with no planned work | Skip. Do not create empty `THOUGHTS.md` files. An empty file is worse than no file. |

**Do not create empty `THOUGHTS.md` files.** An empty or placeholder file carries negative information value: it tells future contributors that decisions were not recorded, which is indistinguishable from "there were no decisions worth recording." Only create the file when there is real content to put in it.
